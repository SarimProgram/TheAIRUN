import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { io } from 'socket.io-client';
import { useAuth } from '@/src/auth/authContext';
import { useChat } from '@/contexts/ChatContext';
import { API_BASE_URL } from '@/config/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useStepSync } from '@/hooks/UseStepSync';
import { parseTugReminderMessage } from '@/utils/tugReminderMessage';
import TugReminderScene from './TugReminderScene';

type Session = { id: string; side: 'left' | 'right'; partnerName: string };
type StepState = {
  hasPartner: boolean;
  participants: { you: { name: string; liveTodaySteps: number }; partner: { name: string; liveTodaySteps: number } } | null;
};

function LiveTug({ session, onClose }: { session: Session; onClose: () => void }) {
  const { user, accessToken, authFetch } = useAuth();
  // Keep the established health-to-server sync running even when opened outside Home.
  // This hook respects the person's existing step permission consent.
  const stepSync = useStepSync({ accessToken });
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<StepState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!accessToken) return;
    const controller = new AbortController();
    let fetching = false;
    const refresh = async () => {
      if (fetching || controller.signal.aborted || AppState.currentState !== 'active') return;
      fetching = true;
      setLoading(true);
      try {
        const res = await authFetch(`${API_BASE_URL}/activity/steps/tracer-state`, { signal: controller.signal });
        if (!res.ok) throw new Error('Could not load steps');
        const next: StepState = await res.json();
        if (controller.signal.aborted) return;
        setState(next);
        setError(next.hasPartner ? null : 'Partner connection unavailable');
      } catch {
        if (!controller.signal.aborted) setError('Could not sync steps');
      } finally {
        fetching = false;
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    refreshRef.current = () => { void refresh(); };
    void refresh();
    const timer = setInterval(() => { void refresh(); }, 5000);
    const appState = AppState.addEventListener('change', value => { if (value === 'active') void refresh(); });
    // Reuse the existing authenticated partner step stream; polling reconciles our own steps.
    const socket = io(API_BASE_URL.replace(/\/api\/?$/, ''), {
      auth: { token: accessToken }, transports: ['websocket', 'polling'],
    });
    socket.on('stepUpdate', () => { void refresh(); });
    socket.on('connect', () => { void refresh(); });
    return () => {
      controller.abort(); clearInterval(timer); appState.remove(); socket.disconnect();
      refreshRef.current = () => {};
    };
  }, [accessToken, authFetch]);

  return <TugReminderScene
    side={session.side} name={state?.participants?.you.name || user?.displayName || 'You'}
    partnerName={state?.participants?.partner.name || session.partnerName}
    identity={String(user?.gender).toLowerCase() === 'female' ? 'female' : 'male'}
    steps={state?.participants?.you.liveTodaySteps ?? null}
    partnerSteps={state?.participants?.partner.liveTodaySteps ?? null}
    loading={loading} error={error} topInset={insets.top} bottomInset={insets.bottom}
    onClose={onClose} onRefresh={() => { void stepSync.refresh().finally(() => refreshRef.current()); }}
  />;
}

export default function TugReminderOverlay() {
  const { messages, currentUserId } = useChat();
  const { isAuthenticated } = useAuth();
  const dark = useColorScheme() === 'dark';
  const pathname = usePathname().toLowerCase();
  const [session, setSession] = useState<Session | null>(null);
  const [hydrated, setHydrated] = useState<string | null>(null);
  const handled = useRef(new Set<string>());
  const storageKey = `partner.tug.handled.v1.${currentUserId}`;
  const allowed = isAuthenticated && !!currentUserId && hydrated === currentUserId
    && !/onboarding|welcome|paywall|login/.test(pathname);

  useEffect(() => {
    let cancelled = false;
    setSession(null); setHydrated(null); handled.current = new Set();
    if (!currentUserId) return;
    AsyncStorage.getItem(storageKey).then(raw => {
      if (!cancelled && raw) handled.current = new Set(JSON.parse(raw));
    }).catch(() => {}).finally(() => { if (!cancelled) setHydrated(currentUserId); });
    return () => { cancelled = true; };
  }, [currentUserId, storageKey]);

  const open = useCallback((next: Session) => {
    if (handled.current.has(next.id)) return;
    handled.current.add(next.id);
    AsyncStorage.setItem(storageKey, JSON.stringify([...handled.current].slice(-80))).catch(() => {});
    setSession(next);
  }, [storageKey]);

  useEffect(() => {
    if (!allowed) return;
    const latest = [...messages].reverse().find(message => {
      const id = parseTugReminderMessage(message.content);
      const age = Date.now() - Date.parse(message.createdAt);
      return id && !message.optimistic && !handled.current.has(id) && age >= -30_000 && age < 120_000
        && (message.fromUserId === currentUserId || message.toUserId === currentUserId);
    });
    if (!latest) return;
    open({ id: parseTugReminderMessage(latest.content)!, side: latest.fromUserId === currentUserId ? 'left' : 'right', partnerName: latest.fromUserId === currentUserId ? 'Your partner' : latest.fromName });
  }, [allowed, messages, currentUserId, open]);

  useEffect(() => {
    if (!allowed) return;
    const receive = (notification: Notifications.Notification) => {
      const data = notification.request.content.data;
      if (data?.kind !== 'step_tug' || data.toUserId !== currentUserId || typeof data.content !== 'string') return;
      const id = parseTugReminderMessage(data.content);
      const age = Date.now() - Date.parse(String(data.createdAt));
      if (!id || !Number.isFinite(age) || age < -30_000 || age > 600_000) return;
      open({ id, side: 'right', partnerName: typeof data.fromName === 'string' ? data.fromName : 'Your partner' });
    };
    const incoming = Notifications.addNotificationReceivedListener(receive);
    const response = Notifications.addNotificationResponseReceivedListener(event => receive(event.notification));
    Notifications.getLastNotificationResponseAsync().then(event => { if (event) receive(event.notification); }).catch(() => {});
    return () => { incoming.remove(); response.remove(); };
  }, [allowed, currentUserId, open]);

  return <Modal visible={allowed && session !== null} animationType="fade" presentationStyle="fullScreen" onRequestClose={() => setSession(null)}>
    <StatusBar style={dark ? 'light' : 'dark'} />
    {session && allowed ? <LiveTug key={session.id} session={session} onClose={() => setSession(null)} /> : null}
  </Modal>;
}
