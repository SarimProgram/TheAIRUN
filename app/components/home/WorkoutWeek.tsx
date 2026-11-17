import { useColorScheme } from '@/hooks/use-color-scheme';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Check, Minus, X } from 'lucide-react-native';
import type { WorkoutPhotosController } from '@/hooks/useWorkoutPhotos';
import { calendarWeek, WEEKDAY_LABELS } from './goalWeek';
import type { WorkoutParticipant } from '@/hooks/useWorkoutOverview';

export default function WorkoutWeek({ dayKey, participant, unavailable }: { photos: WorkoutPhotosController; dayKey?: string; participant?: WorkoutParticipant; unavailable?: boolean }) {
  const dark = useColorScheme() === 'dark';
  const now = new Date();
  const today = participant?.today ?? dayKey ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const completed = new Set(participant?.completedDays ?? []);
  return <View style={styles.week}>
    {calendarWeek(today).map((day, index) => {
      const done = completed.has(day);
      const recovery = !participant?.scheduled.some(session => session.dayKey === day);
      const neutral = recovery || day > today || unavailable || !participant;
      const Icon = done ? Check : neutral ? Minus : X;
      const color = done ? '#15803D' : neutral ? '#6B7280' : '#B91C1C';
      return <View key={day} style={styles.day} accessible accessibilityLabel={`${WEEKDAY_LABELS[index]}, ${day}, ${done ? 'completed' : unavailable || !participant ? 'unavailable' : recovery ? 'recovery' : neutral ? 'upcoming' : 'not logged'}${day === today ? ', today' : ''}`}>
        <Text style={[styles.label, day === today && { color: dark ? '#F1F5F9' : '#111827', fontWeight: '700' }]}>{WEEKDAY_LABELS[index]}</Text>
        <View style={styles.statusTarget}>
          <View style={[styles.status, { backgroundColor: done ? '#DCFCE7' : neutral ? '#F3F4F6' : '#FEF2F2' }, day === today && styles.today]}>
            <Icon size={12} color={color} strokeWidth={3} />
          </View>
        </View>
      </View>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  week: { width: '100%', flexDirection: 'row' },
  day: { flex: 1, minWidth: 0, alignItems: 'center' },
  label: { fontSize: 10, color: '#6B7280', fontWeight: '500' },
  statusTarget: { height: 44, justifyContent: 'center', alignItems: 'center' },
  status: { width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  today: { borderWidth: 1, borderColor: '#6B7280' },
});
