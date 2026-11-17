import { useColorScheme } from '@/hooks/use-color-scheme';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowUpRight, PersonStanding } from 'lucide-react-native';
import { useAuth } from '@/src/auth/authContext';
import { API_BASE_URL } from '@/config/api';
import { getMappedDays } from '@/utils/planProjection';
import { calendarWeek } from './goalWeek';
import { type TrainingSession, workoutLabel } from '@/utils/trainingSchedule';
import { findPartnerWorkout } from '../plan/partnerWorkoutDefinitions';

type ScheduledDay = { dayOfWeek: number; dayType: 'RUN' | 'STEP' | 'RECOVERY'; runType: string | null; runKm?: number; trainingSession?: TrainingSession | null };
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function WorkoutScheduleSheet({ participant = 'you', name, dayKey, weekNumber, onViewPlan }: {
  participant?: 'you' | 'partner'; name?: string; dayKey?: string; weekNumber?: number; onViewPlan: () => void;
}) {
  const { authFetch, isAuthenticated, user } = useAuth();
  const insets = useSafeAreaInsets();
  const dark = useColorScheme() === 'dark';
  const colors = { bg: dark ? '#0F172A' : '#FFFFFF', text: dark ? '#F1F5F9' : '#182033', muted: dark ? '#94A3B8' : '#64748B', border: dark ? '#334155' : '#E9EDF2', soft: dark ? '#39252C' : '#FFF1F2' };
  const [days, setDays] = useState<ScheduledDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const referenceDay = dayKey && /^\d{4}-\d{2}-\d{2}$/.test(dayKey) ? dayKey : today;
  const week = calendarWeek(referenceDay);

  useFocusEffect(useCallback(() => {
    let active = true;
    setDays([]);
    setFailed(false);
    setLoading(true);
    const load = async () => {
      if (!isAuthenticated) throw new Error('Sign in to view your workout days.');
      if (participant === 'partner') {
        const response = await authFetch(`${API_BASE_URL}/plan/partner/weekly`);
        if (response.status === 404) return [];
        if (!response.ok) throw new Error('Schedule unavailable');
        const data = await response.json();
        const table = data['Weekly Plan Table'];
        const current = Array.isArray(table) ? table.find((row: { Week: number }) => row.Week === (weekNumber ?? data.plan?.currentWeek)) : null;
        return current ? getMappedDays(current, data.plan?.availableDays).map(day => ({ dayOfWeek: day.dayIdx, dayType: day.type, runType: day.runType, runKm: day.targetKm,
          trainingSession: day.workoutPreference ? { dayOfWeek: day.dayIdx, activity: 'WORKOUT' as const, workoutPreference: day.workoutPreference, workoutId: day.workoutId } : null })) : [];
      }
      let currentWeek = weekNumber ?? 0;
      if (!currentWeek) {
        const summaryResponse = await authFetch(`${API_BASE_URL}/summary/week`);
        if (summaryResponse.status === 404) return [];
        if (!summaryResponse.ok) throw new Error('Schedule unavailable');
        const summary = await summaryResponse.json();
        currentWeek = Number(summary.currentWeek);
      }
      if (!Number.isInteger(currentWeek) || currentWeek < 1) return [];
      const response = await authFetch(`${API_BASE_URL}/plan/daily/${currentWeek}`);
      if (response.status === 404) return [];
      if (!response.ok) throw new Error('Schedule unavailable');
      const data = await response.json();
      if (!Array.isArray(data.days)) throw new Error('Schedule unavailable');
      return data.days as ScheduledDay[];
    };
    void load().then(result => { if (active) setDays(result); })
      .catch(() => { if (active) setFailed(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  // Reload on retry, account changes, and a new calendar day as well as focus.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authFetch, isAuthenticated, user?.id, participant, referenceDay, today, attempt, weekNumber]));

  return <View style={[styles.container, { backgroundColor: colors.bg }]}>
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={styles.scroll} contentContainerStyle={styles.content}>
    <Text style={[styles.subtitle, { color: colors.muted }]}>{participant === 'partner' ? `${name || 'Your partner'}’s schedule` : 'Your schedule'}{weekNumber ? ` · Week ${weekNumber}` : ' this week'}</Text>
    {loading ? <View style={styles.state} accessibilityLiveRegion="polite"><ActivityIndicator color="#FF6B6B" /><Text style={{ color: colors.muted }}>Loading workout days…</Text></View>
      : failed ? <View style={styles.state}><Text style={[styles.message, { color: colors.text }]}>Couldn’t load workout days.</Text><Pressable accessibilityRole="button" onPress={() => setAttempt(value => value + 1)} style={[styles.retry, { backgroundColor: colors.soft }]}><Text style={styles.retryText}>Try again</Text></Pressable></View>
      : !days.length ? <View style={styles.state}><Text style={[styles.message, { color: colors.text }]}>No workout days allocated yet.</Text><Text style={[styles.message, { color: colors.muted }]}>Your schedule will appear here when your plan is ready.</Text></View>
      : <View style={styles.days}>{week.map((dateKey, index) => {
        const day = days.find(item => item.dayOfWeek === index);
        const workout = day?.dayType === 'RUN' || day?.trainingSession?.activity === 'WORKOUT';
        const recovery = day?.dayType === 'RECOVERY';
        const dateLabel = new Date(`${dateKey}T12:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
        const preference = day?.trainingSession?.workoutPreference;
        const label = preference ? findPartnerWorkout(day?.trainingSession?.workoutId)?.name ?? workoutLabel(preference) : workout ? day?.runType || 'Workout' : recovery ? 'Recovery day' : 'Steps day';
        const detail = preference === 'gym' ? 'Your routine, with photo proof' : preference ? 'Library recommendation, or your own workout'
          : workout ? day?.runKm && day.runKm > 0 ? `${day.runKm.toLocaleString()} km allocated` : 'Workout allocated' : 'Daily goals continue';
        return <View key={dateKey} style={[styles.row, workout && styles.workoutRow, workout && { backgroundColor: colors.soft }]} accessible accessibilityLabel={`${DAY_NAMES[index]}, ${dateLabel}${dateKey === today ? ', today' : ''}, ${label}, ${detail}`}>
          <View style={styles.date}><Text style={[styles.day, { color: workout ? colors.text : colors.muted }, workout && styles.workoutDay]}>{DAY_NAMES[index]}</Text><Text style={[styles.dateText, { color: colors.muted }]}>{dateLabel}{dateKey === today ? ' · Today' : ''}</Text></View>
          <View style={styles.activity}><View style={styles.activityTitle}>{workout && <PersonStanding size={17} color="#FF6B6B" />}<Text style={[styles.activityText, { color: workout ? colors.text : colors.muted }, workout && styles.workoutActivity]}>{label}</Text></View>{workout && <Text style={[styles.detail, { color: colors.muted }]}>{detail}</Text>}</View>
        </View>;
      })}</View>}
    </ScrollView>
    <View style={[styles.footer, { borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 16) }]}>
      <Pressable accessibilityRole="button" accessibilityHint="Closes the sheet and opens your training plan" onPress={onViewPlan} style={({ pressed }) => [styles.planButton, pressed && styles.pressed]}>
        <Text style={styles.planButtonText}>{participant === 'partner' ? 'View your training plan' : 'View training plan'}</Text><ArrowUpRight size={18} color="#FFFFFF" strokeWidth={2} />
      </Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16 },
  subtitle: { fontSize: 14, lineHeight: 20, marginBottom: 12 },
  days: { gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 10, paddingHorizontal: 12 },
  workoutRow: { paddingVertical: 16, borderRadius: 16, borderCurve: 'continuous', borderLeftWidth: 3, borderLeftColor: '#FF6B6B', paddingLeft: 9 },
  workoutDay: { fontWeight: '700' },
  workoutActivity: { fontWeight: '700' },
  date: { flex: 1, minWidth: 0, gap: 4 },
  day: { fontSize: 15, lineHeight: 21, fontWeight: '500' },
  dateText: { fontSize: 12, lineHeight: 18 },
  activity: { flex: 1.3, minWidth: 0, gap: 4 },
  activityTitle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  activityText: { flexShrink: 1, fontSize: 14, lineHeight: 21, fontWeight: '400' },
  detail: { fontSize: 12, lineHeight: 18 },
  state: { minHeight: 220, justifyContent: 'center', alignItems: 'center', gap: 12 },
  message: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  retry: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 20, borderRadius: 16, borderCurve: 'continuous' },
  retryText: { color: '#FF6B6B', fontWeight: '700', fontSize: 15 },
  footer: { paddingHorizontal: 24, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  planButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16, borderRadius: 20, borderCurve: 'continuous', backgroundColor: '#FF6B6B' },
  planButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.7 },
});
