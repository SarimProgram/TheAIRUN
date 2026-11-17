import React, { useCallback, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StatusBar } from 'expo-status-bar';
import StepbattleFullView, { PALETTES, type BattleState } from '@/components/battle/StepbattleFullView';
import { useAuth } from '@/src/auth/authContext';
import { useCoupleChallenge } from '@/hooks/useCoupleChallenge';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { API_BASE_URL } from '@/config/api';

export default function StepbattleFull() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dark = useColorScheme() === 'dark';
  const colors = PALETTES[dark ? 'dark' : 'light'];
  const { accessToken, authFetch, user } = useAuth();
  const coupleChallenge = useCoupleChallenge();
  const [battle, setBattle] = useState<BattleState | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBattle = useCallback(async (signal?: AbortSignal) => {
    if (!accessToken) { setLoading(false); return; }
    try {
      const response = await authFetch(`${API_BASE_URL}/activity/steps/tracer-state`, { signal });
      if (!response.ok) throw new Error('Your battle couldn’t refresh. Try again in a moment.');
      const data: BattleState = await response.json();
      if (!signal?.aborted) { setBattle(data); setError(null); }
    } catch (err) {
      if (!signal?.aborted) setError(err instanceof Error ? err.message : 'Your battle couldn’t refresh.');
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [accessToken, authFetch]);

  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    void loadBattle(controller.signal);
    const timer = setInterval(() => { void loadBattle(controller.signal); }, 45_000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [loadBattle]));

  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try { await Promise.all([loadBattle(), coupleChallenge.refetch()]); }
    finally { setRefreshing(false); }
  };

  return <>
    <Stack.Screen options={{
      headerShown: true,
      title: 'Steps Battle',
      headerStyle: { backgroundColor: colors.bg },
      headerTintColor: colors.coralInk,
      headerTitleStyle: { color: colors.ink, fontWeight: '700' },
      headerShadowVisible: false,
      headerBackButtonDisplayMode: 'minimal',
    }} />
    <StatusBar style={dark ? 'light' : 'dark'} />
    <StepbattleFullView
      battle={battle} userName={user?.displayName} gender={user?.gender}
      authenticated={!!accessToken} loading={loading} error={error}
      refreshing={refreshing} topInset={0} bottomInset={insets.bottom}
      challenge={coupleChallenge.data} challengeLoading={coupleChallenge.loading} challengeError={coupleChallenge.error}
      onRefresh={refresh}
      onConnect={() => router.push('/Partner')} onSignIn={() => router.replace('/welcome')}
      onOpenChallenge={() => router.push('/race/couple-steps')}
    />
  </>;
}
