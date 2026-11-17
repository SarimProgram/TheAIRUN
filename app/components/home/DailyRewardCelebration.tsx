import React, { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/src/auth/authContext';
import { subscribeToDailyRewards } from '@/lib/daily-reward-events';
import { subscribeToGoalCompletions } from '@/lib/goal-celebration-events';
import GoalCelebration, { type Celebration } from './GoalCelebration';

const LABELS = { WALK_RUN: 'Walk/run', STEPS: 'Steps', CALORIES: 'Calorie', MOBILITY: 'Workout', HYDRATION: 'Water' };
const CATEGORIES = { calories: 'CALORIES', steps: 'STEPS', workout: 'WORKOUT_WEEK', water: 'HYDRATION' };
const MESSAGES = {
  calories: 'A little consistency goes a long way.',
  steps: 'Every step added up. Well done.',
  workout: 'Your workouts for the week, complete.',
  water: 'Your daily water target, reached.',
};
let nextId = 0;

/** One queue for completions and confirmed point awards, including awards from other screens. */
export default function DailyRewardCelebration() {
  const { user } = useAuth();
  const [queue, setQueue] = useState<Celebration[]>([]);
  const scope = useRef(user?.id);
  scope.current = user?.id;
  useEffect(() => {
    setQueue([]);
    if (!user?.id) return;
    const userId = user.id;
    let active = true;
    let pending = Promise.resolve();
    const storageKey = `goal-celebrations:v1:${userId}`;
    let seen: string[] | null = null;
    const enqueue = (event: Omit<Celebration, 'id'>) => {
      pending = pending.then(async () => {
        if (!active || scope.current !== userId) return;
        if (event.preview) {
          setQueue(current => [...current, { ...event, id: ++nextId }]);
          return;
        }
        if (!seen) {
          try {
            const stored: unknown = JSON.parse(await AsyncStorage.getItem(storageKey) || '[]');
            seen = Array.isArray(stored) ? stored.filter((key): key is string => typeof key === 'string') : [];
          } catch { seen = []; }
        }
        if (!active || scope.current !== userId) return;
        if (seen.includes(event.key)) {
          // A point award can arrive just after completion: enrich the open celebration.
          if (event.points != null) setQueue(current => current.map(item => item.key === event.key ? { ...item, points: event.points } : item));
          return;
        }
        seen = [...seen, event.key].slice(-128);
        setQueue(current => [...current, { ...event, id: ++nextId }]);
        try { await AsyncStorage.setItem(storageKey, JSON.stringify(seen)); } catch { /* Keep session deduplication if storage is unavailable. */ }
      });
    };
    const unsubscribeRewards = subscribeToDailyRewards(event => {
      const now = new Date();
      const day = event.dayKey ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      enqueue({ key: `${event.category}:${day}`, title: `${LABELS[event.category]} goal complete`, message: 'A little progress, every day.', points: event.points });
    });
    const unsubscribeGoals = subscribeToGoalCompletions(event => {
      const label = { calories: 'Calorie', steps: 'Steps', workout: 'Workout', water: 'Water' }[event.goal];
      enqueue({ key: `${CATEGORIES[event.goal]}:${event.period}`, title: `${label} goal complete`, message: MESSAGES[event.goal], preview: event.preview, points: event.preview ? 50 : undefined });
    });
    return () => { active = false; unsubscribeRewards(); unsubscribeGoals(); };
  }, [user?.id]);
  const close = useCallback(() => setQueue(current => current.slice(1)), []);
  const reward = queue[0];
  if (!reward) return null;
  return <GoalCelebration key={reward.id} reward={reward} onClose={close} />;
}
