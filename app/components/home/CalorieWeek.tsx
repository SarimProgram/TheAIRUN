import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import CalorieStatus from './CalorieStatus';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@/src/auth/authContext';
import { API_BASE_URL } from '../../config/api';
import type { DailySummary } from '../../hooks/useDailySummary';
import { Flame } from 'lucide-react-native';
import { calorieGoalStatus } from './calorieGoalStatus';
import { calendarWeek, weeklyStreak } from './goalWeek';

type NutritionDay = { day: string; calories: number; calorieTarget?: number | null };
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function CalorieWeek({ summary, compact = false, children }: {
  summary: DailySummary | null;
  compact?: boolean;
  children?: (content: { calendar: React.ReactNode; streakBadge: React.ReactNode }) => React.ReactNode;
}) {
  const { authFetch, isAuthenticated } = useAuth();
  const [history, setHistory] = useState<NutritionDay[]>([]);
  const [failed, setFailed] = useState(false);
  useFocusEffect(useCallback(() => {
    let active = true;
    setHistory([]);
    setFailed(false);
    if (isAuthenticated && summary?.dayKey) {
      authFetch(`${API_BASE_URL}/summary/nutrition-history`)
        .then(async response => {
          if (!response.ok) throw new Error('Nutrition history unavailable');
          const data = await response.json();
          if (!Array.isArray(data)) throw new Error('Invalid nutrition history');
          if (active) setHistory(data);
        })
        .catch(() => { if (active) setFailed(true); });
    }
    return () => { active = false; };
  }, [authFetch, isAuthenticated, summary?.dayKey]));

  const streak = summary ? weeklyStreak(calendarWeek(summary.dayKey), summary.dayKey, dayKey => {
    const day = history.find(entry => entry.day === dayKey);
    return dayKey === summary.dayKey
      ? calorieGoalStatus(summary.consumedCalories, summary.calorieTarget).complete
      : calorieGoalStatus(day?.calories, day?.calorieTarget).complete;
  }) : 0;

  const streakBadge = !failed && (history.length > 0 || streak > 0) ? (
    <View style={styles.streakBadge} accessible accessibilityLabel={`${streak}-day calorie goal streak this week`}>
      <Flame size={13} color="#F97316" fill="#FDBA74" />
      <Text style={styles.streakText} numberOfLines={1}>{streak}-day</Text>
    </View>
  ) : null;

  const calendar = (
    <View style={[styles.container, compact && styles.compactContainer]}>
      <View style={[styles.progressRow, compact && styles.compactProgressRow]}>
      <View style={[styles.week, compact && styles.compactWeek]}>
        {DAYS.map((label, index) => {
          const day = history[index];
          const isToday = !!day && day.day === summary?.dayKey;
          const isFuture = !!day && !!summary && day.day > summary.dayKey;
          const calories = isToday ? summary!.consumedCalories : day?.calories;
          const target = isToday ? summary!.calorieTarget : day?.calorieTarget;
          return (
            <View key={label} style={styles.day}>
              <Text style={[styles.label, isToday && styles.todayLabel]}>{label}</Text>
              <CalorieStatus compact calories={calories} target={target} upcoming={isFuture} today={isToday} dayLabel={`${label}${day ? `, ${day.day}` : ''}`} />
            </View>
          );
        })}
      </View>
      {!children && streakBadge}
      </View>
      {failed && <Text style={styles.error}>Weekly progress unavailable</Text>}
    </View>
  );
  return children ? children({ calendar, streakBadge }) : calendar;
}

const styles = StyleSheet.create({
  streakBadge: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, backgroundColor: '#FFF1E6' },
  streakText: { fontSize: 11, fontWeight: '600', color: '#9A3412' },
  container: { width: '100%' },
  compactContainer: { marginBottom: 0 },
  compactProgressRow: { flexWrap: 'wrap' },
  compactWeek: { flexBasis: 164, gap: 0 },
  progressRow: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 4 },
  week: { flex: 1, minWidth: 0, flexDirection: 'row', justifyContent: 'space-between', gap: 0 },
  day: { flex: 1, minWidth: 0, alignItems: 'center', gap: 0 },
  label: { fontSize: 10, color: '#6B7280', fontWeight: '500' },
  todayLabel: { color: '#111827', fontWeight: '700' },
  circle: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
  today: { borderColor: '#6B7280' },
  complete: { backgroundColor: '#15803D', borderColor: '#15803D' },
  empty: { color: '#9CA3AF', fontSize: 11 },
  error: { color: '#6B7280', fontSize: 12, marginTop: 8, textAlign: 'center' },
});
