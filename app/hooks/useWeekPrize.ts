import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../src/auth/authContext';
import { API_BASE_URL } from '../config/api';
import { notifyInvitationChange, subscribeToInvitationChanges } from '../lib/invitation-events';

export type WeeklyResult = {
  id: string;
  weekStart: string;
  weekEnd: string;
  weekprize: string | null;
  yourGoalsCompleted: number;
  partnerGoalsCompleted: number;
  winner: 'you' | 'partner' | 'tie';
};

export type WeekPrize = {
  weekprize: string | null;
  /** null when there is no prize, or it predates proposals. */
  proposedByYou: boolean | null;
  accepted: boolean;
  yourSignature: string[] | null;
  partnerSignature: string[] | null;
  weekStart: string;
  weekEnd: string;
  weekTimezone: string;
  hasPartner: boolean;
  partnerName: string | null;
  yourGoalsCompleted: number;
  partnerGoalsCompleted: number | null;
  lastWeek?: WeeklyResult | null;
};

export function useWeekPrize(initialData?: WeekPrize | null) {
  const { authFetch, isAuthenticated } = useAuth();
  const [data, setData] = useState<WeekPrize | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);

  const refetch = useCallback(async () => {
    const version = ++requestVersion.current;
    if (!isAuthenticated) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch(`${API_BASE_URL}/weekprize`);
      if (!response.ok) throw new Error('Could not load your weekly prize. Tap to retry.');
      const result: WeekPrize = await response.json();
      if (version === requestVersion.current) setData(result);
    } catch (cause) {
      if (version === requestVersion.current) setError(cause instanceof Error ? cause.message : 'Could not load your weekly prize.');
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [authFetch, isAuthenticated]);

  useFocusEffect(useCallback(() => {
    void refetch();
    const timer = setInterval(() => { void refetch(); }, 60_000);
    return () => {
      clearInterval(timer);
      requestVersion.current += 1;
    };
  }, [refetch]));

  useEffect(() => {
    return subscribeToInvitationChanges(change => {
      if (change.scope !== 'weekly_prize') return;
      if (change.data) {
        if (!data) { void refetch(); return; }
        requestVersion.current += 1;
        setData(current => current ? { ...current, ...change.data } : current);
        setLoading(false);
        setError(null);
      } else void refetch();
    });
  }, [refetch, data]);

  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(notification => {
      if (notification.request.content.data?.type === 'weekly_prize') void refetch();
    });
    return () => subscription.remove();
  }, [refetch]);

  const write = useCallback(async (path: string, method: string, body: unknown, fallback: string) => {
    const response = await authFetch(`${API_BASE_URL}/weekprize${path}`, { method, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || fallback);
    // Ignore an older load response, which may still contain the previous prize.
    requestVersion.current += 1;
    setData(current => current ? { ...current, ...result } : current);
    setError(null);
    setLoading(false);
    notifyInvitationChange({ scope: 'weekly_prize', data: result });
  }, [authFetch]);

  const save = useCallback(async (weekprize: string) => {
    if (saving) return;
    setSaving(true);
    try { await write('', 'PUT', { weekprize: weekprize.trim() }, 'Could not save your prize. Try again.'); }
    finally { setSaving(false); }
  }, [saving, write]);

  const accept = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try { await write('/accept', 'POST', {}, 'Could not accept the prize. Try again.'); }
    finally { setSaving(false); }
  }, [saving, write]);

  const sign = useCallback((paths: string[]) =>
    write('/signature', 'PUT', { paths }, 'Could not save your doodle. Try again.'), [write]);

  const decline = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try { await write('/decline', 'POST', {}, 'Could not deny the prize. Try again.'); }
    finally { setSaving(false); }
  }, [saving, write]);

  return { data, loading, saving, error, refetch, save, accept, decline, sign };
}
