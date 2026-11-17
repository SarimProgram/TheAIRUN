import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@/src/auth/authContext';
import { API_BASE_URL } from '@/config/api';
import { notifyInvitationChange, subscribeToInvitationChanges } from '@/lib/invitation-events';

export const HOME_GOALS = ['calories', 'steps', 'workout', 'water'] as const;
export type HomeGoal = typeof HOME_GOALS[number];
export const HOME_GOAL_LABELS: Record<HomeGoal, string> = {
  calories: 'Calorie goal', steps: 'Steps goal', workout: 'Workout goal', water: 'Water goal',
};
export type GoalRemoval = { id: string; goal: HomeGoal; requestedByYou: boolean; accepted: boolean };
type Settings = { order: HomeGoal[]; weekStart: string; weekEnd: string; partnerId: string | null; removals: GoalRemoval[] };

export function useHomeGoals(partnerId: string | null, active: boolean) {
  const { user, authFetch } = useAuth();
  const scope = `${user?.id ?? 'none'}:${partnerId ?? 'solo'}`;
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const serial = useRef(0);
  const lock = useRef(false);
  const [saved, setSaved] = useState<{ scope: string; data: Settings } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const settings = saved?.scope === scope ? saved.data : null;

  const refresh = useCallback(async () => {
    if (!user?.id || lock.current) return;
    const request = ++serial.current;
    try {
      const response = await authFetch(`${API_BASE_URL}/home-goals`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.message || 'Could not load goal settings.');
      if (currentScope.current !== scope || request !== serial.current) return;
      setSaved({ scope, data });
      setError('');
    } catch (e) {
      if (currentScope.current === scope && request === serial.current) setError(e instanceof Error ? e.message : 'Could not load goal settings.');
    }
  }, [authFetch, scope, user?.id]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  useEffect(() => subscribeToInvitationChanges(change => {
    if (active && change.scope === 'home_goals') void refresh();
  }), [active, refresh]);
  useEffect(() => {
    setError('');
    if (!active) return;
    void refresh();
    const timer = setInterval(() => { void refresh(); }, 20000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [active, refresh]);

  const mutate = useCallback(async (path: string, body: object, order?: HomeGoal[]) => {
    if (lock.current || !settings) return false;
    lock.current = true;
    ++serial.current;
    setBusy(true);
    setError('');
    const before = settings;
    if (order) setSaved({ scope, data: { ...settings, order } });
    let success = false;
    try {
      const response = await authFetch(`${API_BASE_URL}/home-goals/${path}`, {
        method: path === 'order' ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.message || 'Could not update your goals.');
      success = true;
    } catch (e) {
      if (currentScope.current === scope) {
        setSaved({ scope, data: before });
        setError(e instanceof Error ? e.message : 'Could not update your goals.');
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
    if (success && currentScope.current === scope) {
      await refresh();
      if (path !== 'order') notifyInvitationChange({ scope: 'weekly_prize' });
    }
    return success;
  }, [authFetch, refresh, scope, settings]);

  const order = settings?.order ?? [...HOME_GOALS];
  const removals = settings?.removals ?? [];
  return { order, removals, visible: order.filter(goal => !removals.some(row => row.goal === goal && row.accepted)),
    ready: !!settings, busy, error, refresh, hasPartner: !!settings?.partnerId,
    weekEnd: settings?.weekEnd,
    reorder: (next: HomeGoal[]) => mutate('order', { order: next }, next),
    requestRemoval: (goal: HomeGoal) => mutate('removals', { goal, weekStart: settings?.weekStart }),
    respond: (row: GoalRemoval, accept: boolean) => mutate(`removals/${row.id}/respond`, { accept, weekStart: settings?.weekStart }),
  };
}
