import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@/src/auth/authContext';
import { API_BASE_URL } from '@/config/api';
import type { WorkoutPreference } from '@/utils/trainingSchedule';
import type { Workout } from '@/components/plan/workoutCatalog';
import { notifyWorkoutOverview, subscribeToWorkoutChanges } from '@/lib/workout-events';

export type OverviewSession = {
  dayKey: string; dayOfWeek: number; week: number; activity: 'RUN' | 'WALK' | 'WORKOUT';
  workoutPreference?: WorkoutPreference; workoutId?: string; runType: string | null; distanceKm: number; sessionId?: string;
};
export type WorkoutParticipant = {
  userId: string; today: string; weekStart: string; planId: string | null; hasPlan: boolean; ended: boolean;
  todaySession: OverviewSession | null; nextSession: OverviewSession | null; scheduled: OverviewSession[];
  weeklyTarget: number; weeklyCount: number; completedDays: string[]; todayCompleted: boolean;
};
export type WorkoutOverview = { mine: WorkoutParticipant; partner: WorkoutParticipant | null; partnerId: string | null };

export function useWorkoutOverview() {
  const { user, authFetch } = useAuth();
  const scope = `${user?.id ?? ''}:${user?.partnerId ?? ''}`;
  const currentScope = useRef(scope); currentScope.current = scope;
  const serial = useRef(0);
  const [saved, setSaved] = useState<{ scope: string; data: WorkoutOverview } | null>(null);
  const [status, setStatus] = useState({ scope, loading: true, error: '' });
  const data = saved?.scope === scope ? saved.data : null;
  const latestData = useRef(data); latestData.current = data;
  const refresh = useCallback(async () => {
    if (!user?.id) return;
    const request = ++serial.current;
    setStatus(previous => ({ scope, loading: true, error: previous.scope === scope ? previous.error : '' }));
    try {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const response = await authFetch(`${API_BASE_URL}/plan/workout-overview?timezone=${encodeURIComponent(zone)}`);
      if (!response.ok) throw new Error('Could not load your workout plan.');
      const result: WorkoutOverview = await response.json();
      if (currentScope.current !== scope || request !== serial.current) return;
      setSaved({ scope, data: result });
      setStatus({ scope, loading: false, error: '' });
    } catch (error) {
      if (currentScope.current === scope && request === serial.current) setStatus({ scope, loading: false,
        error: error instanceof Error ? error.message : 'Could not load your workout plan.' });
    }
  }, [authFetch, scope, user?.id]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  useEffect(() => {
    const unsubscribe = subscribeToWorkoutChanges(() => { void refresh(); });
    const app = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    // Also updates the partner's progress and crosses midnight while the screen stays open.
    const timer = setInterval(() => { if (AppState.currentState === 'active') void refresh(); }, 30000);
    return () => { unsubscribe(); app.remove(); clearInterval(timer); };
  }, [refresh]);
  const saveCompletion = useCallback(async (workout: Workout, startedAt: Date) => {
    if (currentScope.current !== scope) throw new Error('Your account changed. Reopen your workout plan.');
    const mine = data?.mine ?? latestData.current?.mine;
    if (!mine?.planId || mine.todaySession?.activity !== 'WORKOUT' || mine.todaySession.workoutPreference === 'gym') {
      throw new Error('This session is no longer scheduled. Refresh your workout plan.');
    }
    const endedAt = new Date();
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const response = await authFetch(`${API_BASE_URL}/summary/workouts`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: `guided:${mine.planId}:${mine.today}`, type: 'OTHER', source: 'APP_TRACKED',
        title: workout.title, startedAt: startedAt.toISOString(), endedAt: endedAt.toISOString(), timezone: zone,
        durationMinutes: Math.max(1, Math.round((endedAt.getTime() - startedAt.getTime()) / 60000)) }) });
    if (!response.ok) throw new Error('Your workout finished, but could not be saved. Try again.');
    if (currentScope.current !== scope) return;
    notifyWorkoutOverview();
    await refresh();
  }, [authFetch, data, refresh, scope]);
  return { data, loading: status.scope !== scope || status.loading, error: status.scope === scope ? status.error : '', refresh, saveCompletion };
}
