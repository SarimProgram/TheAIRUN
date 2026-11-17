import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { usePathname } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { useChat } from '@/contexts/ChatContext';
import { useAuth } from '@/src/auth/authContext';
import { homeAvatarKey } from '@/lib/home-avatar';
import { type PlateItem } from '@/lib/meal-pass';
import {
  fetchPendingSharedMeals, fetchSharedMeal, respondToSharedMeal, sharedMealImage, type SharedMeal,
} from '@/lib/meal-pass-api';
import { cacheReceivedPlate, refreshPendingSentPlates, refreshSentPlate } from '@/lib/meal-pass-sync';
import { loadArrivedPlates, markPlateArrived } from '@/lib/meal-pass-store';
import { registerPartnerFoodWidgetPush } from '@/lib/partner-food-widget';
import { parseMealPlateMessage, parseMealReplyMessage } from '@/utils/mealPassMessage';
import FloatingPlate from './FloatingPlate';
import MealPassReviewSheet from './MealPassReviewSheet';
import { usePassColors } from './passTheme';

const HIDDEN_ROUTE_PREFIXES = ['/onboarding', '/(tabs)/onboarding', '/welcome', '/paywall'];

type Arrival = { meal: SharedMeal; xPct: number; imageUri: string | null; isCutout: boolean };

export type DevPlate = { xPct?: number; imageUri?: string | null; isCutout?: boolean; mealType?: SharedMeal['mealType']; items?: PlateItem[] };
const DEV_ITEMS: PlateItem[] = [
  { foodName: 'Grilled chicken', calories: 420, grams: 180, proteinG: 52, carbsG: 0, fatG: 22 },
  { foodName: 'Rice', calories: 300, grams: 230, proteinG: 6, carbsG: 66, fatG: 1 },
  { foodName: 'Greens', calories: 60, grams: 120, proteinG: 3, carbsG: 8, fatG: 2 },
];
const devListeners = new Set<(plate: DevPlate) => void>();
const isDevPlate = (id: string) => id.startsWith('dev-');

/** Dev only: lands a fake plate from the partner, so the arrival can be tried on one phone without the API. */
export function simulateIncomingPlate(plate: DevPlate = {}) {
  if (__DEV__) devListeners.forEach((listener) => listener(plate));
}

/** Receives passed plates (live, from a push, or on open) and catches answers to plates this user passed. */
export default function MealPassOverlay() {
  const { messages, currentUserId } = useChat();
  const { authFetch, isAuthenticated, user } = useAuth();
  const pathname = usePathname().toLowerCase();
  const colors = usePassColors();
  const userKey = user?.id || user?.email || 'default-user';
  const [queue, setQueue] = useState<Arrival[]>([]);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<{ id: string; kind: 'accepted' | 'declined' } | null>(null);
  const queueRef = useRef<Arrival[]>([]);
  const handledMessages = useRef(new Set<string>());
  /** Plates that have already flown in this session; they reappear docked, never replaying the arrival. */
  const arrived = useRef(new Set<string>());
  const outcomeRef = useRef(outcome);
  outcomeRef.current = outcome;
  const reviewingRef = useRef(reviewingId);
  reviewingRef.current = reviewingId;

  const commit = useCallback((next: Arrival[]) => { queueRef.current = next; setQueue(next); }, []);

  /** Downloads the plate image first so it flies in with the actual food on it. */
  const prepare = useCallback(async (meal: SharedMeal, xPct: number): Promise<Arrival> => {
    const kind = meal.hasCutout ? 'cutout' : meal.hasPhoto ? 'photo' : null;
    const imageUri = kind
      ? await Promise.race([sharedMealImage(authFetch, meal, kind), new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500))]).catch(() => null)
      : null;
    return { meal, xPct, imageUri, isCutout: kind === 'cutout' && !!imageUri };
  }, [authFetch]);

  // Newest on top so a fresh throw always flies in, even over a plate left for later;
  // the one being reviewed or settled stays put until it's done.
  const insert = useCallback((arrival: Arrival) => {
    if (queueRef.current.some((entry) => entry.meal.id === arrival.meal.id)) return;
    const current = queueRef.current[0];
    const busy = current && (reviewingRef.current === current.meal.id || outcomeRef.current?.id === current.meal.id);
    const sorted = [...queueRef.current, arrival].sort((a, b) => Date.parse(b.meal.createdAt) - Date.parse(a.meal.createdAt));
    commit(busy ? [current, ...sorted.filter((entry) => entry !== current)] : sorted);
  }, [commit]);

  const add = useCallback(async (meal: SharedMeal, xPct: number) => {
    if (meal.status !== 'PENDING' || meal.recipientUserId !== user?.id) return;
    await cacheReceivedPlate(authFetch, meal, userKey, user?.timezone);
    if (queueRef.current.some((entry) => entry.meal.id === meal.id)) return;
    const [arrival, seen] = await Promise.all([prepare(meal, xPct), loadArrivedPlates()]);
    seen.forEach((id) => arrived.current.add(id));
    insert(arrival);
  }, [authFetch, insert, prepare, user?.id, user?.timezone, userKey]);

  useEffect(() => {
    if (!__DEV__) return;
    const listener = (plate: DevPlate) => {
      const items = plate.items?.length ? plate.items : DEV_ITEMS;
      const now = Date.now();
      const imageUri = plate.imageUri ?? null;
      const meal: SharedMeal = {
        id: `dev-${now}`, mode: 'SPLIT', mealType: plate.mealType ?? 'DINNER', items, itemShares: items.map(() => 0.4),
        status: 'PENDING', createdAt: new Date(now).toISOString(), respondedAt: null, expiresAt: new Date(now + 3_600_000).toISOString(),
        senderUserId: user?.partnerId ?? 'dev-partner', recipientUserId: user?.id ?? 'dev-you',
        senderName: 'Your partner', senderGender: null, recipientName: 'You', recipientGender: user?.gender ?? null,
        hasPhoto: !!imageUri && !plate.isCutout, hasCutout: !!imageUri && !!plate.isCutout, senderClientMealId: null,
      };
      insert({ meal, xPct: plate.xPct ?? 0.15 + Math.random() * 0.7, imageUri, isCutout: !!imageUri && !!plate.isCutout });
    };
    devListeners.add(listener);
    return () => { devListeners.delete(listener); };
  }, [insert, user?.gender, user?.id, user?.partnerId]);

  const loadPending = useCallback(async () => {
    if (!isAuthenticated || !user?.id) return;
    try {
      const pending = await fetchPendingSharedMeals(authFetch);
      const ids = new Set(pending.map((meal) => meal.id));
      for (const entry of queueRef.current) {
        if (!ids.has(entry.meal.id) && !isDevPlate(entry.meal.id)) {
          const latest = await fetchSharedMeal(authFetch, entry.meal.id);
          await cacheReceivedPlate(authFetch, latest, userKey, user?.timezone);
        }
      }
      // Answered on another device or expired: drop it, unless it's mid-settle here.
      commit(queueRef.current.filter((entry) => ids.has(entry.meal.id) || isDevPlate(entry.meal.id) || entry.meal.id === outcomeRef.current?.id));
      const newestFirst = [...pending].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      for (const meal of newestFirst) await add(meal, 0.5);
    } catch {}
    void refreshPendingSentPlates(authFetch, userKey);
    void registerPartnerFoodWidgetPush(authFetch, user.id).catch((error) => console.warn('[PartnerFoodWidget]', error));
  }, [add, authFetch, commit, isAuthenticated, user?.id, user?.timezone, userKey]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) { commit([]); return; }
    void loadPending();
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') void loadPending(); });
    return () => subscription.remove();
  }, [commit, isAuthenticated, loadPending, user?.id]);

  // Live path: the partner's chat signal lands within a few hundred ms of the throw.
  useEffect(() => {
    if (!currentUserId) return;
    for (const message of messages) {
      if (message.optimistic || message.fromUserId === currentUserId || handledMessages.current.has(message.id)) continue;
      const plate = parseMealPlateMessage(message.content);
      const reply = plate ? null : parseMealReplyMessage(message.content);
      if (!plate && !reply) continue;
      handledMessages.current.add(message.id);
      if (plate) fetchSharedMeal(authFetch, plate.sharedMealId).then((meal) => add(meal, plate.xPct)).catch(() => {});
      if (reply) void refreshSentPlate(authFetch, reply.sharedMealId).catch(() => {});
    }
  }, [add, authFetch, currentUserId, messages]);

  // Offline path: a plate or answer that arrived as a push while the app was in the background.
  useEffect(() => {
    const ingest = (notification: Notifications.Notification) => {
      const kind = (notification.request.content.data as Record<string, unknown> | undefined)?.kind;
      if (kind === 'meal_pass' || kind === 'meal_pass_reply') void loadPending();
    };
    const received = Notifications.addNotificationReceivedListener(ingest);
    const responded = Notifications.addNotificationResponseReceivedListener((response) => ingest(response.notification));
    return () => { received.remove(); responded.remove(); };
  }, [loadPending]);

  const top = queue[0];
  const reviewing = reviewingId ? queue.find((entry) => entry.meal.id === reviewingId) ?? null : null;
  const topId = top?.meal.id;
  useEffect(() => {
    if (!topId) return;
    arrived.current.add(topId);
    if (!isDevPlate(topId)) void markPlateArrived(topId);
  }, [topId]);

  const accept = useCallback(async (shares: number[]) => {
    if (!reviewing) return;
    if (isDevPlate(reviewing.meal.id)) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setReviewingId(null);
      setOutcome({ id: reviewing.meal.id, kind: 'accepted' });
      return;
    }
    const answered = await respondToSharedMeal(authFetch, reviewing.meal.id, 'accept', shares);
    await cacheReceivedPlate(authFetch, answered, userKey, user?.timezone);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setReviewingId(null);
    setOutcome({ id: answered.id, kind: 'accepted' });
  }, [authFetch, reviewing, user?.timezone, userKey]);

  const decline = useCallback(async () => {
    if (!reviewing) return;
    if (!isDevPlate(reviewing.meal.id)) {
      const answered = await respondToSharedMeal(authFetch, reviewing.meal.id, 'decline');
      await cacheReceivedPlate(authFetch, answered, userKey, user?.timezone);
    }
    setReviewingId(null);
    setOutcome({ id: reviewing.meal.id, kind: 'declined' });
  }, [authFetch, reviewing, user?.timezone, userKey]);

  const settled = useCallback(() => {
    const id = outcomeRef.current?.id;
    setOutcome(null);
    if (id) commit(queueRef.current.filter((entry) => entry.meal.id !== id));
  }, [commit]);

  const hidden = HIDDEN_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (!isAuthenticated || !top || hidden) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <FloatingPlate
        key={top.meal.id} arrive={!arrived.current.has(top.meal.id)}
        meal={top.meal} xPct={top.xPct} imageUri={top.imageUri} isCutout={top.isCutout} count={queue.length}
        outcome={outcome?.id === top.meal.id ? outcome.kind : null} colors={colors}
        senderAvatarKey={user?.id && user?.partnerId ? homeAvatarKey(user.id, 'partner', user.partnerId) : undefined}
        onTap={() => setReviewingId(top.meal.id)} onSettled={settled}
      />
      <MealPassReviewSheet
        meal={reviewing?.meal ?? null} imageUri={reviewing?.imageUri ?? null} isCutout={!!reviewing?.isCutout} colors={colors}
        youAvatarKey={user?.id ? homeAvatarKey(user.id, 'you') : undefined}
        partnerAvatarKey={user?.id && user?.partnerId ? homeAvatarKey(user.id, 'partner', user.partnerId) : undefined}
        youGender={user?.gender}
        onAccept={accept} onDecline={decline} onLater={() => setReviewingId(null)}
      />
    </View>
  );
}
