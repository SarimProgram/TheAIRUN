import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../src/auth/authContext';
import { API_BASE_URL } from '../config/api';
import { notifyInvitationChange, subscribeToInvitationChanges } from '../lib/invitation-events';
import {
  coupleChallengeSim,
  type CoupleChallengeState,
  type CoupleChallengeType,
  type CoupleView,
} from '../utils/coupleChallengeSim';

const DEV_SIM_KEY = 'dev.coupleChallengeSim';
const POLL_MS = 60_000;

export function useCoupleChallenge() {
  const { authFetch, isAuthenticated, user } = useAuth();
  const [data, setData] = useState<CoupleChallengeState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [simulated, setSimulated] = useState(false);
  const [simReady, setSimReady] = useState(!__DEV__);
  const requestVersion = useRef(0);
  const yourName = String(user?.displayName ?? user?.name ?? 'You').trim().split(/\s+/)[0] || 'You';

  useEffect(() => {
    if (!__DEV__) return;
    AsyncStorage.getItem(DEV_SIM_KEY)
      .then(value => setSimulated(value === '1'))
      .finally(() => setSimReady(true));
  }, []);

  const request = useCallback(async (path: string, init?: RequestInit) => {
    const response = await authFetch(`${API_BASE_URL}/couple-challenges${path}`, init);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'Something went wrong. Try again.');
    return body;
  }, [authFetch]);

  const refetch = useCallback(async () => {
    if (!simReady) return;
    const version = ++requestVersion.current;
    if (simulated) {
      setData(coupleChallengeSim.state(yourName));
      setError(null);
      setLoading(false);
      return;
    }
    if (!isAuthenticated) {
      setData(null);
      setLoading(false);
      return;
    }
    try {
      const result: CoupleChallengeState = await request('/me');
      if (version === requestVersion.current) {
        setData(result);
        setError(null);
      }
    } catch (cause) {
      if (version === requestVersion.current) {
        setError(cause instanceof Error ? cause.message : 'Could not load your step challenge.');
      }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [isAuthenticated, request, simReady, simulated, yourName]);

  useFocusEffect(useCallback(() => {
    void refetch();
    const timer = setInterval(() => { void refetch(); }, POLL_MS);
    return () => {
      clearInterval(timer);
      requestVersion.current += 1;
    };
  }, [refetch]));

  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(notification => {
      if (notification.request.content.data?.type === 'couple_challenge') void refetch();
    });
    return () => subscription.remove();
  }, [refetch]);

  const run = useCallback(async (action: () => Promise<unknown> | unknown) => {
    setBusy(true);
    try {
      await action();
      notifyInvitationChange({ scope: 'couple_challenge' });
      await refetch();
    } finally {
      setBusy(false);
    }
  }, [refetch]);

  useEffect(() => subscribeToInvitationChanges(change => {
    if (change.scope === 'couple_challenge') void refetch();
  }), [refetch]);

  const lookup = useCallback(async (code: string): Promise<CoupleView> => {
    if (simulated) return coupleChallengeSim.lookup(code);
    const result = await request(`/lookup/${encodeURIComponent(code)}`);
    return result.couple;
  }, [request, simulated]);

  const invite = useCallback((opponentCode: string, type: CoupleChallengeType, prize: string) => run(() => simulated
    ? coupleChallengeSim.invite(yourName, opponentCode, type, prize)
    : request('/', { method: 'POST', body: JSON.stringify({ opponentCode, type, prize }) })), [request, run, simulated, yourName]);

  const accept = useCallback((id: string) => run(async () => {
    const result = simulated ? coupleChallengeSim.accept(id) : await request(`/${id}/accept`, { method: 'POST' });
    setData(current => simulated ? coupleChallengeSim.state(yourName) : current ? {
      ...current, incoming: current.incoming.filter(item => item.id !== id), active: result.challenge,
    } : current);
  }), [request, run, simulated, yourName]);

  const decline = useCallback((id: string) => run(async () => {
    if (simulated) coupleChallengeSim.decline(id);
    else await request(`/${id}/decline`, { method: 'POST' });
    setData(current => current ? { ...current, incoming: current.incoming.filter(item => item.id !== id) } : current);
  }), [request, run, simulated]);

  const cancel = useCallback((id: string) => run(() => simulated
    ? coupleChallengeSim.cancel(id)
    : request(`/${id}`, { method: 'DELETE' })), [request, run, simulated]);

  const setSimulatedMode = useCallback((enabled: boolean) => {
    if (!__DEV__) return;
    requestVersion.current += 1;
    setSimulated(enabled);
    setLoading(true);
    void AsyncStorage.setItem(DEV_SIM_KEY, enabled ? '1' : '0');
  }, []);

  const sim = {
    receiveInvite: () => run(() => coupleChallengeSim.receiveInvite(yourName)),
    theyAccept: () => run(() => coupleChallengeSim.theyAccept()),
    addSteps: () => run(() => coupleChallengeSim.addSteps()),
    finishNow: () => run(() => coupleChallengeSim.finishNow()),
    addWins: () => run(() => coupleChallengeSim.addWins(5)),
    reset: () => run(() => coupleChallengeSim.reset()),
  };

  return { data, loading, busy, error, refetch, lookup, invite, accept, decline, cancel, simulated, setSimulatedMode, sim };
}
