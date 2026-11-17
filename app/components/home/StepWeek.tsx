import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@/src/auth/authContext';
import { API_BASE_URL } from '@/config/api';
import type { DailySummary } from '@/hooks/useDailySummary';
import StepGoalStatus from './StepGoalStatus';
import GoalStreakBadge from './GoalStreakBadge';
import { calendarWeek, WEEKDAY_LABELS } from './goalWeek';

type StepDay = { dayKey: string; steps: number; stepsTarget: number };

export default function StepWeek({ summary, steps, target, streak, compact = false, children }: {
  summary: DailySummary | null; steps: number; target: number; streak?: { count: number; name: string } | null;
  compact?: boolean;
  children?: (content: { calendar: React.ReactNode; streakBadge: React.ReactNode }) => React.ReactNode;
}) {
  const { authFetch, isAuthenticated } = useAuth();
  const [history, setHistory] = useState<StepDay[]>([]);
  const [failed, setFailed] = useState(false);
  const today = summary?.dayKey;
  useFocusEffect(useCallback(() => {
    let active = true;
    setHistory([]);
    setFailed(false);
    if (isAuthenticated && today) {
      // Historical summaries preserve each day's own target instead of applying today's goal retroactively.
      const pastDays = calendarWeek(today).filter(day => day < today);
      void Promise.allSettled(pastDays.map(async day => {
        const response = await authFetch(`${API_BASE_URL}/summary/${day}`);
        if (response.status === 404) return null;
        if (!response.ok) throw new Error('Step history unavailable');
        return await response.json() as StepDay;
      })).then(results => {
        if (!active) return;
        setHistory(results.flatMap(result => result.status === 'fulfilled' && result.value ? [result.value] : []));
        setFailed(results.some(result => result.status === 'rejected'));
      });
    }
    return () => { active = false; };
  }, [authFetch, isAuthenticated, today]));

  const days = today ? calendarWeek(today) : [];
  const streakBadge = streak ? <GoalStreakBadge compact count={streak.count} name={streak.name} /> : null;
  const calendar = <View style={[styles.container, compact && styles.compactContainer]}>
    <View style={[styles.progressRow, compact && styles.compactProgressRow]}>
    <View style={[styles.week, compact && styles.compactWeek]}>
      {WEEKDAY_LABELS.map((label, index) => {
        const dayKey = days[index];
        const day = history.find(entry => entry.dayKey === dayKey);
        const isToday = !!today && dayKey === today;
        return <View key={label} style={[styles.day, compact && styles.compactDay]}>
          <Text style={[styles.label, isToday && styles.todayLabel]}>{label}</Text>
          <StepGoalStatus compact steps={isToday ? steps : day?.steps} target={isToday ? target : day?.stepsTarget}
            upcoming={!!today && dayKey > today} today={isToday} dayLabel={`${label}${dayKey ? `, ${dayKey}` : ''}`} />
        </View>;
      })}
    </View>
    {!children && streakBadge}
    </View>
    {failed && <Text style={styles.error}>Weekly step progress unavailable</Text>}
  </View>;
  return children ? children({ calendar, streakBadge }) : calendar;
}

const styles = StyleSheet.create({
  container: { marginBottom: 8, width: '100%' },
  compactContainer: { marginBottom: 0 },
  compactProgressRow: { width: '100%', maxWidth: '100%', gap: 4, flexWrap: 'wrap' },
  compactWeek: { flexBasis: 164, maxWidth: '100%', gap: 0 },
  compactDay: { minWidth: 0, gap: 0 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: 304 },
  week: { flex: 1, minWidth: 0, maxWidth: 224, flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  day: { flex: 1, alignItems: 'center', gap: 4 },
  label: { fontSize: 10, color: '#6B7280', fontWeight: '500' },
  todayLabel: { color: '#111827', fontWeight: '700' },
  error: { color: '#6B7280', fontSize: 12, marginTop: 8 },
});
