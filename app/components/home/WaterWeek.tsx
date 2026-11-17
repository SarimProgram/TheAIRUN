import { useColorScheme } from '@/hooks/use-color-scheme';
import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Check, Minus, X } from 'lucide-react-native';
import { useAuth } from '@/src/auth/authContext';
import { API_BASE_URL } from '@/config/api';
import { calendarWeek, WEEKDAY_LABELS } from './goalWeek';

type WaterDay = { dayKey: string; waterMl: number; waterTarget: number };

export default function WaterWeek({ dayKey, current, target }: {
  dayKey?: string;
  current?: number | null;
  target?: number | null;
}) {
  const dark = useColorScheme() === 'dark';
  const { authFetch, isAuthenticated } = useAuth();
  const [history, setHistory] = useState<WaterDay[]>([]);
  const [failed, setFailed] = useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    setHistory([]);
    setFailed(false);
    if (isAuthenticated && dayKey) {
      const pastDays = calendarWeek(dayKey).filter(day => day < dayKey);
      void Promise.allSettled(pastDays.map(async day => {
        const response = await authFetch(`${API_BASE_URL}/summary/${day}`);
        if (response.status === 404) return null;
        if (!response.ok) throw new Error('Water history unavailable');
        return await response.json() as WaterDay;
      })).then(results => {
        if (!active) return;
        setHistory(results.flatMap(result => result.status === 'fulfilled' && result.value ? [result.value] : []));
        setFailed(results.some(result => result.status === 'rejected'));
      });
    }
    return () => { active = false; };
  }, [authFetch, isAuthenticated, dayKey]));

  const days = dayKey ? calendarWeek(dayKey) : [];
  return <View>
    <View style={styles.week}>
      {WEEKDAY_LABELS.map((label, index) => {
        const day = days[index];
        const today = !!dayKey && day === dayKey;
        const upcoming = !!dayKey && day > dayKey;
        const entry = history.find(item => item.dayKey === day);
        const intake = today ? current : entry?.waterMl;
        const goal = today ? target : entry?.waterTarget;
        const unavailable = intake == null || !Number.isFinite(intake) || goal == null || !Number.isFinite(goal) || goal <= 0;
        const neutral = upcoming || unavailable;
        const complete = !neutral && intake! >= goal!;
        const Icon = neutral ? Minus : complete ? Check : X;
        const status = upcoming ? 'upcoming' : unavailable ? 'unavailable' : complete ? 'complete' : 'incomplete';
        const details = neutral ? '' : `, ${Math.round(intake!).toLocaleString()} of ${Math.round(goal!).toLocaleString()} ml`;
        return <View key={label} style={styles.day} accessible accessibilityLabel={`${label}${day ? `, ${day}` : ''}, ${status}${details}${today ? ', today' : ''}`}>
          <Text style={[styles.label, today && { color: dark ? '#F1F5F9' : '#111827', fontWeight: '700' }]}>{label}</Text>
          <View style={styles.statusTarget}>
            <View style={[styles.status, { backgroundColor: neutral ? '#F3F4F6' : complete ? '#DCFCE7' : '#FEF2F2' }, today && styles.today]}>
              <Icon size={12} color={neutral ? '#6B7280' : complete ? '#15803D' : '#B91C1C'} strokeWidth={3} />
            </View>
          </View>
        </View>;
      })}
    </View>
    {failed && <Text style={styles.error}>Weekly water progress unavailable</Text>}
  </View>;
}

const styles = StyleSheet.create({
  week: { width: '100%', flexDirection: 'row' },
  day: { flex: 1, minWidth: 0, alignItems: 'center' },
  label: { fontSize: 10, color: '#6B7280', fontWeight: '500' },
  statusTarget: { height: 44, justifyContent: 'center', alignItems: 'center' },
  status: { width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  today: { borderWidth: 1, borderColor: '#6B7280' },
  error: { color: '#6B7280', fontSize: 12, marginTop: 8 },
});
