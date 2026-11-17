import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image, type ImageSource } from 'expo-image';
import { Check, Moon, Pencil, RotateCcw, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, OnboardingScreen, ScreenTitle, SURFACE, SURFACE_SELECTED, useCompact } from './OnboardingKit';
import type { TrainingActivity, TrainingSchedule, TrainingSession, WorkoutPreference } from '../../utils/trainingSchedule';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const ART = {
  gym: require('../../assets/goals/workout-gym.png'), home: require('../../assets/goals/workout-home.png'),
  strength: require('../../assets/goals/workout-strength.png'),
  RUN: require('../../assets/goals/goal-stronger-runner.png'), WALK: require('../../assets/goals/goal-walking.png'),
};
const MUTED = 'rgba(8,36,55,0.55)';
type Choice = { title: string; activity: TrainingActivity | null; preference?: WorkoutPreference };
type Props = {
  schedule: TrainingSchedule | null; sessions: TrainingSession[]; activities: TrainingActivity[];
  loading: boolean; saving: boolean; error: string; onSessionsChange: (sessions: TrainingSession[]) => void;
  onSave: () => void; onRetry: () => void; onBack?: () => void;
};
function sessionLabel(session?: TrainingSession) {
  if (!session) return 'Recovery';
  if (session.activity === 'RUN') return 'Running';
  if (session.activity === 'WALK') return 'Walking';
  return session.workoutPreference === 'gym' ? 'Gym' : session.workoutPreference === 'home' ? 'Home' : 'Strength';
}
function ActivityArt({ session, size = 56 }: { session?: TrainingSession; size?: number }) {
  const source: ImageSource | undefined = session ? session.activity === 'WORKOUT'
    ? ART[session.workoutPreference ?? 'strength'] : ART[session.activity] : undefined;
  return source ? <Image source={source} contentFit="contain" style={{ width: size, height: size }} accessible={false} />
    : <View style={[s.recoveryArt, { width: size, height: size }]}><Moon size={size * 0.48} color="#93A6A9" strokeWidth={1.6} /></View>;
}

export function TrainingWeekScreen(p: Props) {
  const compact = useCompact();
  const insets = useSafeAreaInsets();
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const target = p.schedule?.sessions.length ?? 0;
  const valid = p.sessions.length === target;
  const editing = p.sessions.find(session => session.dayOfWeek === editingDay);
  const options: Choice[] = [
    ...p.activities.flatMap<Choice>(activity => activity === 'WORKOUT'
      ? (['strength', 'gym', 'home'] as const).map(preference => ({ title: preference === 'gym' ? 'Gym' : preference === 'home' ? 'Home' : 'Strength', activity, preference }))
      : [{ title: activity === 'RUN' ? 'Running' : 'Walking', activity }]),
    { title: 'Recovery', activity: null },
  ];
  const choose = (choice: Choice) => {
    if (editingDay == null || p.saving) return;
    void Haptics.selectionAsync().catch(() => {});
    p.onSessionsChange([...p.sessions.filter(session => session.dayOfWeek !== editingDay),
      ...(choice.activity ? [{ dayOfWeek: editingDay, activity: choice.activity,
        ...(choice.activity === 'WORKOUT' ? { workoutPreference: choice.preference ?? 'strength' as const } : {}) }] : [])]
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek));
    setEditingDay(null);
  };
  return <>
    <OnboardingScreen showBrand scrollable onBack={p.onBack}
      ctaLabel={p.loading ? undefined : p.schedule ? p.schedule.customizationCompleted ? 'Save changes' : 'Start my plan' : 'Try again'}
      onCta={p.schedule ? p.onSave : p.onRetry} ctaLoading={p.saving} ctaDisabled={!!p.schedule && !valid} ctaDelay={0}>
      <ScreenTitle lead="Your training " accent="week" lines={2} style={{ marginTop: compact ? 16 : 24 }} />
      <Text style={s.hint}>Tap a day to change</Text>
      <View style={[s.week, compact && s.weekCompact]}>
        {DAYS.map((day, dayOfWeek) => {
          const session = p.sessions.find(session => session.dayOfWeek === dayOfWeek);
          return p.loading ? <View key={day} style={[s.row, compact && s.rowCompact, s.skeleton]} accessible={false}>
            <View style={s.skeletonLabel} /><View style={s.skeletonArt} />
          </View> : p.schedule ? <Pressable key={day} accessibilityRole="button"
            accessibilityLabel={`${day}, ${sessionLabel(session)}. Change activity`} disabled={p.saving}
            onPress={() => { void Haptics.selectionAsync().catch(() => {}); setEditingDay(dayOfWeek); }}
            style={({ pressed }) => [s.row, compact && s.rowCompact, dayOfWeek === 6 && s.lastRow, { opacity: p.saving ? 0.55 : pressed ? 0.72 : 1 }]}>
            <Text style={[s.day, compact && s.dayCompact, !session && s.recoveryLabel]}>{day}</Text>
            <ActivityArt session={session} size={compact ? 40 : 44} />
            <Text style={[s.activity, compact && s.activityCompact, !session && s.recoveryLabel]}>{sessionLabel(session)}</Text>
            <Pencil size={13} color={session ? C.coral : MUTED} />
          </Pressable> : null;
        })}
      </View>
      {(p.loading || p.schedule) && <View style={s.summary}>
          {p.loading ? <ActivityIndicator accessibilityLabel="Loading your training week" color={C.coral} /> : <>
            <Text accessibilityLiveRegion="polite" accessibilityLabel={`${p.sessions.length} of ${target} training days selected`} style={[s.count, !valid && s.countIncomplete]}>
              {p.sessions.length}<Text style={s.countTarget}> / {target}</Text>
              <Text style={s.countLabel}> training days</Text>
            </Text>
          </>}
        {p.schedule && <Pressable accessibilityRole="button" accessibilityLabel="Reset training week" disabled={p.saving}
        onPress={() => { void Haptics.selectionAsync().catch(() => {}); p.onSessionsChange(p.schedule!.sessions); }} style={({ pressed }) => [s.reset, { opacity: pressed ? 0.5 : 1 }]}>
        <RotateCcw size={14} color={MUTED} /><Text style={s.resetText}>Reset</Text>
        </Pressable>}
      </View>}
      {p.schedule && !valid && <Text accessibilityLiveRegion="polite" style={s.validation}>Choose {target} training {target === 1 ? 'day' : 'days'}</Text>}
      {!!p.error && <Text accessibilityRole="alert" style={s.error}>{p.error}</Text>}
    </OnboardingScreen>
    <Modal visible={editingDay != null} transparent animationType="fade" onRequestClose={() => setEditingDay(null)}>
      <View style={s.backdrop}>
        <Pressable accessibilityLabel="Close activity choices" accessibilityRole="button" style={StyleSheet.absoluteFill} onPress={() => setEditingDay(null)} />
        <View accessibilityViewIsModal style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 20), maxHeight: '85%' }]}>
          <View style={s.sheetHeader}>
            <Text accessibilityRole="header" style={s.sheetTitle}>{editingDay == null ? '' : DAYS[editingDay]}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close activity picker" onPress={() => setEditingDay(null)} style={s.close}><X size={22} color={C.ink} /></Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.choices}>
            {options.map(choice => {
              const selected = (editing?.activity ?? null) === choice.activity && (choice.activity !== 'WORKOUT' || editing?.workoutPreference === choice.preference);
              const session = choice.activity ? { dayOfWeek: editingDay ?? 0, activity: choice.activity, workoutPreference: choice.preference } : undefined;
              return <Pressable key={choice.title} accessibilityRole="radio" accessibilityState={{ checked: selected }} accessibilityLabel={choice.title}
                onPress={() => choose(choice)} style={({ pressed }) => [s.choice, selected && s.choiceSelected, { opacity: pressed ? 0.72 : 1 }]}>
                <ActivityArt session={session} size={48} /><Text style={s.choiceLabel}>{choice.title}</Text>
                {selected && <View style={s.selectedMark}><Check size={13} color={C.white} strokeWidth={3} /></View>}
              </Pressable>;
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  </>;
}

const s = StyleSheet.create({
  hint: { color: MUTED, fontSize: 15, fontWeight: '500', textAlign: 'center', marginTop: 12 },
  week: { marginTop: 24, paddingHorizontal: 16, borderRadius: 24, borderCurve: 'continuous', borderWidth: 1.5, borderColor: C.border, backgroundColor: SURFACE, overflow: 'hidden' }, weekCompact: { marginTop: 16, paddingHorizontal: 12 },
  row: { minHeight: 64, paddingVertical: 8, gap: 10, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  rowCompact: { minHeight: 58, gap: 6 }, lastRow: { borderBottomWidth: 0 },
  day: { flex: 1, color: C.ink, fontSize: 16, fontWeight: '700', letterSpacing: -0.3 }, dayCompact: { fontSize: 14 },
  activity: { width: 76, color: C.ink, fontSize: 15, fontWeight: '800', letterSpacing: -0.4 }, activityCompact: { width: 64, fontSize: 14 }, recoveryLabel: { color: MUTED, fontWeight: '500' },
  recoveryArt: { alignItems: 'center', justifyContent: 'center' }, summary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 12, paddingHorizontal: 4 },
  count: { flex: 1, color: C.coral, fontSize: 21, fontWeight: '800', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  countIncomplete: { color: C.ink }, countTarget: { color: '#87949D', fontSize: 17, letterSpacing: -0.3 }, countLabel: { color: MUTED, fontSize: 13, fontWeight: '500', letterSpacing: 0 },
  reset: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, resetText: { color: MUTED, fontSize: 13, fontWeight: '600' },
  validation: { color: C.coral, fontSize: 14, textAlign: 'center', marginTop: 4 }, error: { color: C.coral, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 12 },
  skeleton: { justifyContent: 'space-between' }, skeletonLabel: { width: 80, height: 12, borderRadius: 6, backgroundColor: C.track },
  skeletonArt: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.track, marginRight: 44 },
  backdrop: { flex: 1, backgroundColor: 'rgba(8,36,55,0.28)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderCurve: 'continuous', padding: 24, gap: 16 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, sheetTitle: { color: C.ink, fontSize: 28, fontWeight: '800', letterSpacing: -0.8 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, choices: { borderRadius: 24, borderCurve: 'continuous', overflow: 'hidden', borderWidth: 1.5, borderColor: C.border },
  choice: { minHeight: 72, paddingHorizontal: 16, paddingVertical: 10, gap: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border, backgroundColor: SURFACE },
  choiceSelected: { backgroundColor: SURFACE_SELECTED }, choiceLabel: { flex: 1, color: C.ink, fontSize: 17, fontWeight: '800', letterSpacing: -0.4 },
  selectedMark: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.coral, alignItems: 'center', justifyContent: 'center' },
});
