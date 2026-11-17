import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/src/auth/authContext';
import { API_BASE_URL } from '@/config/api';
import { TrainingWeekScreen } from '@/components/onboarding/TrainingWeekScreen';
import type { TrainingActivity, TrainingSchedule, TrainingSession } from '@/utils/trainingSchedule';

export default function CustomizePlan() {
  const router = useRouter();
  const { entry } = useLocalSearchParams<{ entry?: string }>();
  const { authFetch } = useAuth();
  const [schedule, setSchedule] = useState<TrainingSchedule | null>(null);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [activities, setActivities] = useState<TrainingActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await authFetch(`${API_BASE_URL}/plan/training-schedule`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not load your training week.');
      if (!data.schedule || (entry === '1' && data.schedule.customizationCompleted)) { router.replace('/(tabs)'); return; }
      setSchedule(data.schedule); setSessions(data.schedule.sessions); setActivities(data.allowedActivities);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not load your training week.'); }
    finally { setLoading(false); }
  }, [authFetch, router, entry]);
  useEffect(() => { void load(); }, [load]);
  const save = async () => {
    if (!schedule || lock.current || sessions.length !== schedule.sessions.length) return;
    lock.current = true; setSaving(true); setError('');
    try {
      const response = await authFetch(`${API_BASE_URL}/plan/training-schedule`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessions }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not save your training week.');
      if (schedule.customizationCompleted) router.replace('/Plans');
      else router.replace('/welcome');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save your training week.'); }
    finally { lock.current = false; setSaving(false); }
  };
  return <>
    <Stack.Screen options={{ headerShown: false }} />
    <TrainingWeekScreen schedule={schedule} sessions={sessions} activities={activities}
      loading={loading} saving={saving} error={error} onSave={save} onRetry={load}
      onBack={entry !== '1' && router.canGoBack() ? () => router.back() : undefined}
      onSessionsChange={next => { setSessions(next); setError(''); }} />
  </>;
}
