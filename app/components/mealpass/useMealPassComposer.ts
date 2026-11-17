import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Crypto from 'expo-crypto';
import {
  DEFAULT_PARTNER_SHARE, normalizePlateItems, overallShare, senderPortion, sentPlateLabel, uniformShares,
  type PlateItem,
} from '@/lib/meal-pass';
import { createSharedMeal, fetchPassPartner, type PassPartner, type SharedMeal } from '@/lib/meal-pass-api';
import { recordSentPlate, useSentPlates } from '@/lib/meal-pass-store';
import { saveLocalPortion } from '@/lib/offline-meals';

export type PassChoice = 'SOLO' | 'SPLIT' | 'COPY';
export type PassPhase = 'idle' | 'aiming' | 'sending' | 'passed' | 'error';

type AuthFetch = (input: string, init?: RequestInit) => Promise<Response>;

/** Owns the "Just me · Share meal · Copy my plate" choice and the pass itself for one food log session. */
export function useMealPassComposer({ authFetch, partnerLinked, partnerId, open, userKey, rawItems }: {
  authFetch: AuthFetch; partnerLinked: boolean; partnerId?: string | null; open: boolean; userKey: string; rawItems: unknown[];
}) {
  const [partner, setPartner] = useState<PassPartner | null>(null);
  const [choice, setChoice] = useState<PassChoice>('SOLO');
  const [shares, setShares] = useState<number[]>([]);
  const [phase, setPhase] = useState<PassPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<SharedMeal | null>(null);
  const attempt = useRef<{ clientMealId: string; clientId: string; logged: boolean } | null>(null);
  const items = useMemo(() => normalizePlateItems(rawItems), [rawItems]);

  useEffect(() => {
    if (!open || !partnerLinked) return;
    let cancelled = false;
    fetchPassPartner(authFetch).then((next) => { if (!cancelled) setPartner(next); }).catch(() => {
      // A flaky lookup shouldn't hide the choice; the send itself surfaces any real failure.
      if (!cancelled && partnerId) setPartner((current) => current ?? { id: partnerId, name: 'Your partner', gender: null });
    });
    return () => { cancelled = true; };
  }, [authFetch, open, partnerId, partnerLinked]);

  const reset = useCallback(() => {
    attempt.current = null;
    setChoice('SOLO'); setShares([]); setPhase('idle'); setError(null); setSent(null);
  }, []);
  useEffect(() => { if (!open) reset(); }, [open, reset]);

  // Calorie edits can add or remove rows; every row always has a share.
  const fallback = choice === 'COPY' ? 1 : DEFAULT_PARTNER_SHARE;
  const effectiveShares = useMemo(() => items.map((_, index) => shares[index] ?? fallback), [fallback, items, shares]);

  const choose = useCallback((next: PassChoice) => {
    setChoice(next);
    setShares(next === 'SOLO' ? [] : uniformShares(items, next === 'COPY' ? 1 : DEFAULT_PARTNER_SHARE));
    setPhase('idle'); setError(null);
  }, [items]);

  const lift = useCallback(() => { setError(null); setPhase('aiming'); }, []);
  const cancel = useCallback(() => setPhase((current) => (current === 'aiming' ? 'idle' : current)), []);

  /** Runs on release: log locally first, then upload and deliver the partner's plate. */
  const throwPlate = useCallback(async (params: {
    xPct: number; mealType: SharedMeal['mealType']; dayKey: string; photoUri?: string | null; cutoutUri?: string | null;
    inputText?: string | null; onLogged?: () => void;
  }) => {
    if (!partner || choice === 'SOLO' || !items.length) return;
    setPhase('sending');
    const mode = choice;
    attempt.current ??= { clientMealId: Crypto.randomUUID(), clientId: Crypto.randomUUID(), logged: false };
    const current = attempt.current;
    const { clientMealId, clientId } = current;
    try {
      if (!current.logged) {
        await saveLocalPortion({
          userKey, dayKey: params.dayKey, mealType: params.mealType, clientMealId, hadImage: !!params.photoUri,
          inputText: params.inputText, items: senderPortion(items, effectiveShares, mode),
        });
        current.logged = true;
        params.onLogged?.();
      }
      const meal = await createSharedMeal(authFetch, {
        clientId, mode, mealType: params.mealType, items, itemShares: effectiveShares,
        senderClientMealId: clientMealId, xPct: params.xPct, photoUri: params.photoUri, cutoutUri: params.cutoutUri,
      });
      await recordSentPlate({
        sharedMealId: meal.id, clientMealId, userKey, mode, status: 'PENDING',
        partnerShare: overallShare(items, effectiveShares), partnerName: partner.name, partnerGender: partner.gender,
        sentAt: new Date().toISOString(),
      });
      setSent(meal);
      setPhase('passed');
      return clientMealId;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not pass the plate. Try again.';
      setError(current.logged ? `Your portion is logged. ${message}` : message);
      setPhase('error');
      return null;
    }
  }, [authFetch, choice, effectiveShares, items, partner, userKey]);

  const plates = useSentPlates(userKey);
  const sentPlate = sent ? plates.find((plate) => plate.sharedMealId === sent.id) ?? null : null;

  return {
    available: partnerLinked && !!partner,
    partner, items, choice, choose, shares: effectiveShares, setShares,
    phase, error, lift, cancel, throwPlate, reset,
    statusLabel: sentPlate ? sentPlateLabel(sentPlate) : null,
  };
}

export type MealPassComposer = ReturnType<typeof useMealPassComposer>;
export type { PlateItem };
