import { useColorScheme } from '@/hooks/use-color-scheme';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Switch, Text, TextInput, View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useNavigation, usePreventRemove } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Check, ChevronLeft } from 'lucide-react-native';
import { API_BASE_URL } from '@/config/api';
import { useAuth } from '@/src/auth/authContext';

type Goal = 'weightloss' | 'running' | 'both';
type TrainingStyle = 'walkOnly' | 'walkAndRun' | 'runOnly';
type TimeHorizon = 'RELAXED' | 'STANDARD' | 'AGGRESSIVE' | 'SPECIFIC_DATE';
type Intensity = 'STEADY' | 'ACTIVE' | 'PRO';
type TrainingTime = 'morning' | 'afternoon' | 'evening';
type Draft = {
  goal: Goal | null;
  weight: string;
  targetWeight: string;
  trainingStyle: TrainingStyle;
  timeHorizon: TimeHorizon;
  intensity: Intensity;
  runGoal: string;
  runExperience: string;
  days: number[];
  time: TrainingTime;
};
type Option = { value: string; label: string; detail?: string };
const GOALS: Option[] = [
  { value: 'weightloss', label: 'Lose weight', detail: 'Build a plan around your target weight' },
  { value: 'running', label: 'Improve running', detail: 'Train for a distance or get faster' },
  { value: 'both', label: 'Lose weight and improve running' },
];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TIME_KEY = 'plans_training_time_preference_v1';
const numberFromInput = (value: string) => Number(value.trim().replace(',', '.'));

export default function ResetPlanScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { authFetch, user, isAuthenticated } = useAuth();
  const insets = useSafeAreaInsets();
  const dark = useColorScheme() === 'dark';
  const colors = {
    bg: dark ? '#000000' : '#F2F2F7', surface: dark ? '#1C1C1E' : '#FFFFFF',
    text: dark ? '#F2F2F7' : '#1C1C1E', muted: dark ? '#AEAEB2' : '#636366',
    border: dark ? '#38383A' : '#D1D1D6', accent: dark ? '#FF6B6B' : '#C83C3C',
    onAccent: dark ? '#1C1C1E' : '#FFFFFF',
    selected: dark ? '#382121' : '#FFF0F0', error: dark ? '#FFB4AB' : '#B3261E',
  };
  const [step, setStep] = useState(0);
  const [unit, setUnit] = useState<'kg' | 'lbs'>(user?.units === 'imperial' ? 'lbs' : 'kg');
  const [draft, setDraft] = useState<Draft>({
    goal: null, weight: '', targetWeight: '', trainingStyle: 'walkAndRun',
    timeHorizon: 'STANDARD', intensity: 'ACTIVE', runGoal: '', runExperience: '',
    days: [], time: 'morning',
  });
  const [targetDate, setTargetDate] = useState<Date | null>(null);
  const [raceDate, setRaceDate] = useState<Date | null>(null);
  const [hasRaceDate, setHasRaceDate] = useState(false);
  const [datePicker, setDatePicker] = useState<'target' | 'race' | null>(null);
  const [dirty, setDirty] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const losesWeight = draft.goal === 'weightloss' || draft.goal === 'both';
  const runs = draft.goal === 'running' || draft.goal === 'both';
  const toKg = (value: string) => numberFromInput(value) * (unit === 'lbs' ? 0.45359237 : 1);
  const weightKg = toKg(draft.weight);
  const targetKg = toKg(draft.targetWeight);
  const minimumTargetDate = new Date();
  minimumTargetDate.setDate(minimumTargetDate.getDate() + Math.max(1, Math.ceil((weightKg - targetKg) / 1.5)) * 7);
  minimumTargetDate.setHours(0, 0, 0, 0);

  const update = (values: Partial<Draft>) => {
    setDirty(true);
    setError('');
    setDraft((previous) => ({ ...previous, ...values }));
  };

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(TIME_KEY).then((value) => {
      if (active && (value === 'morning' || value === 'afternoon' || value === 'evening')) {
        setDraft((previous) => ({ ...previous, time: value }));
      }
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (completed) router.dismissTo('/Plans');
  }, [completed, router]);

  usePreventRemove(!completed && (dirty || generating), ({ data }) => {
    if (submitting.current) return;
    Alert.alert('Discard new plan?', 'Your changes to this new plan will be lost.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(data.action) },
    ]);
  });

  const changeStep = (next: number) => {
    Keyboard.dismiss();
    setError('');
    setDatePicker(null);
    setStep(next);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const validate = () => {
    if (step === 0) {
      if (!draft.goal) return 'Choose your goal.';
      if (!Number.isFinite(weightKg) || weightKg <= 0 || weightKg > 500) return 'Enter a valid current weight.';
      if (losesWeight && (!Number.isFinite(targetKg) || targetKg <= 0 || targetKg >= weightKg)) {
        return 'Enter a target weight below your current weight.';
      }
    }
    if (step === 1) {
      if (losesWeight && draft.timeHorizon === 'SPECIFIC_DATE' &&
          (!targetDate || targetDate.getTime() <= Date.now())) return 'Choose a future target date.';
      if (losesWeight && draft.timeHorizon === 'SPECIFIC_DATE' && targetDate && targetDate < minimumTargetDate) {
        return 'Choose a later target date for this weight-loss goal.';
      }
      if (runs && (!draft.runGoal || !draft.runExperience)) return 'Choose your running goal and experience.';
      if (runs && hasRaceDate && (!raceDate || raceDate.getTime() <= Date.now())) return 'Choose a future race date.';
    }
    if (step === 2 && draft.days.length < 3) return 'Choose at least three training days.';
    return '';
  };

  const generate = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setGenerating(true);
    setError('');
    try {
      if (!isAuthenticated) throw new Error('Please sign in again to reset your plan.');
      const response = await authFetch(`${API_BASE_URL}/plan/reset`, {
        method: 'POST',
        body: JSON.stringify({
          goalType: draft.goal, weightKg, targetWeightKg: losesWeight ? targetKg : null,
          timeHorizon: losesWeight ? draft.timeHorizon : undefined,
          targetDate: losesWeight && draft.timeHorizon === 'SPECIFIC_DATE' ? targetDate?.toISOString() : null,
          trainingStyle: draft.trainingStyle, intensityLevel: draft.intensity,
          availableDays: [...draft.days].sort((a, b) => a - b),
          runGoal: runs ? draft.runGoal : null,
          runExperience: runs ? draft.runExperience : null,
          runRaceDate: runs && hasRaceDate ? raceDate?.toISOString() : null,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const fieldError = data?.issues?.[0]?.message;
        throw new Error(fieldError || data?.message || data?.error || 'Unable to generate your new plan. Please try again.');
      }
      await AsyncStorage.setItem(TIME_KEY, draft.time).catch(() => {});
      setCompleted(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to generate your new plan. Please try again.');
    } finally {
      submitting.current = false;
      setGenerating(false);
    }
  };

  const continueFlow = () => {
    const message = validate();
    if (message) { setError(message); return; }
    if (step < 2) { changeStep(step + 1); return; }
    Keyboard.dismiss();
    Alert.alert('Replace your current plan?', 'Your new plan will start at week 1. Your logged activity and partner connection will be kept.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Generate new plan', onPress: () => { void generate(); } },
    ]);
  };

  const options = (label: string, value: string | null, choices: Option[], onChange: (value: string) => void) => (
    <View style={styles.section}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {choices.map((choice, index) => (
          <Pressable
            key={choice.value} accessibilityRole="radio" accessibilityState={{ checked: value === choice.value }}
            aria-checked={value === choice.value}
            onPress={() => onChange(choice.value)}
            style={({ pressed }) => [styles.option, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
              { backgroundColor: value === choice.value ? colors.selected : colors.surface, opacity: pressed ? 0.65 : 1 }]}
          >
            <View style={styles.optionCopy}>
              <Text style={[styles.optionLabel, { color: colors.text }]}>{choice.label}</Text>
              {choice.detail ? <Text style={[styles.hint, { color: colors.muted }]}>{choice.detail}</Text> : null}
            </View>
            {value === choice.value ? <Check size={20} color={colors.accent} /> : null}
          </Pressable>
        ))}
      </View>
    </View>
  );

  const weightInput = (label: string, value: string, onChangeText: (value: string) => void) => (
    <View style={styles.section}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <View style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TextInput accessibilityLabel={`${label} in ${unit}`} value={value} onChangeText={onChangeText}
          placeholder="0.0" placeholderTextColor={colors.muted} keyboardType="decimal-pad" maxLength={7}
          style={[styles.input, { color: colors.text }]} />
        <Text style={{ color: colors.muted }}>{unit}</Text>
      </View>
    </View>
  );

  const dateField = (kind: 'target' | 'race') => {
    const date = kind === 'target' ? targetDate : raceDate;
    const minimum = kind === 'target' ? new Date(minimumTargetDate) : new Date();
    if (kind === 'race') minimum.setDate(minimum.getDate() + 1);
    minimum.setHours(0, 0, 0, 0);
    return (
      <View style={styles.section}>
        <Pressable accessibilityRole="button" onPress={() => setDatePicker(datePicker === kind ? null : kind)}
          style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.optionLabel, { color: colors.text }]}>{kind === 'target' ? 'Target date' : 'Race date'}</Text>
          <Text style={{ color: colors.accent }}>{date ? date.toLocaleDateString() : 'Choose date'}</Text>
        </Pressable>
        {datePicker === kind ? <DateTimePicker value={date && date >= minimum ? date : minimum} minimumDate={minimum}
          mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'}
          themeVariant={dark ? 'dark' : 'light'}
          onChange={(event, selected) => {
            if (Platform.OS !== 'ios') setDatePicker(null);
            if (event.type !== 'dismissed' && selected) {
              setDirty(true);
              setError('');
              if (kind === 'target') setTargetDate(selected); else setRaceDate(selected);
            }
          }} /> : null}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top + 44}>
      <Stack.Screen options={{ title: 'Reset plan', headerStyle: { backgroundColor: colors.surface }, headerTintColor: colors.text,
        gestureEnabled: !generating,
        headerLeft: () => step > 0 ? <Pressable accessibilityRole="button" accessibilityLabel="Previous step"
          disabled={generating} onPress={() => changeStep(step - 1)} style={styles.headerButton}>
          <ChevronLeft size={24} color={colors.accent} />
        </Pressable> : null,
        headerRight: () => <Pressable accessibilityRole="button" disabled={generating} onPress={() => router.back()} style={styles.headerButton}>
          <Text style={{ color: colors.accent, fontSize: 17, opacity: generating ? 0.4 : 1 }}>Cancel</Text>
        </Pressable>,
      }} />
      <ScrollView ref={scrollRef} contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}>
        <Text style={[styles.step, { color: colors.muted }]}>STEP {step + 1} OF 3</Text>
        <Text style={[styles.title, { color: colors.text }]}>{['Your new goal', 'Shape your training', 'Make it fit your week'][step]}</Text>
        <Text style={[styles.intro, { color: colors.muted }]}>
          {step === 0 ? 'Update what matters for your new plan. We’ll use your saved height, age, and gender.'
            : step === 1 ? 'Choose the approach that fits your goal today.' : 'Your new plan starts at week 1 once it’s ready.'}
        </Text>
        <View pointerEvents={generating ? 'none' : 'auto'} accessibilityElementsHidden={generating}>
          {step === 0 ? <>
            {options('What is your goal?', draft.goal, GOALS, (value) => update({ goal: value as Goal,
              trainingStyle: value !== 'weightloss' && draft.trainingStyle === 'walkOnly' ? 'walkAndRun' : draft.trainingStyle }))}
            <View style={styles.unitRow}>
              <Text style={[styles.label, { color: colors.text }]}>Weight unit</Text>
              <View style={styles.units}>
                {(['kg', 'lbs'] as const).map((value) => <Pressable key={value} accessibilityRole="radio"
                  accessibilityState={{ checked: unit === value }} aria-checked={unit === value} onPress={() => {
                    if (unit === value) return;
                    const convert = (input: string) => input && Number.isFinite(numberFromInput(input))
                      ? (numberFromInput(input) * (value === 'lbs' ? 2.20462262 : 0.45359237)).toFixed(1) : input;
                    update({ weight: convert(draft.weight), targetWeight: convert(draft.targetWeight) });
                    setUnit(value);
                  }} style={[styles.unitButton, { backgroundColor: unit === value ? colors.accent : colors.surface }]}>
                  <Text style={{ color: unit === value ? colors.onAccent : colors.text, fontWeight: '600' }}>{value}</Text>
                </Pressable>)}
              </View>
            </View>
            {weightInput('Current weight', draft.weight, (weight) => update({ weight }))}
            {losesWeight ? weightInput('Target weight', draft.targetWeight, (targetWeight) => update({ targetWeight })) : null}
          </> : null}
          {step === 1 ? <>
            {losesWeight ? options('Weight-loss pace', draft.timeHorizon, [
              { value: 'RELAXED', label: 'Slow and steady' }, { value: 'STANDARD', label: 'Standard' },
              { value: 'AGGRESSIVE', label: 'Faster pace' }, { value: 'SPECIFIC_DATE', label: 'Choose a target date' },
            ], (value) => update({ timeHorizon: value as TimeHorizon })) : null}
            {losesWeight && draft.timeHorizon === 'SPECIFIC_DATE' ? dateField('target') : null}
            {options('How would you like to train?', draft.trainingStyle, [
              ...(draft.goal === 'weightloss' ? [{ value: 'walkOnly', label: 'Walking' }] : []),
              { value: 'walkAndRun', label: 'Walking and running' }, { value: 'runOnly', label: 'Running' },
            ], (value) => update({ trainingStyle: value as TrainingStyle }))}
            {runs ? <>
              {options('Running goal', draft.runGoal, [
                { value: '5k', label: 'Run 5K' }, { value: '10k', label: 'Run 10K' },
                { value: 'halfMarathon', label: 'Run a half marathon' }, { value: 'speedImprovement', label: 'Get faster' },
              ], (runGoal) => update({ runGoal }))}
              {options('Running experience', draft.runExperience, [
                { value: 'beginner', label: 'Beginner' }, { value: 'intermediate', label: 'Intermediate' },
                { value: 'advanced', label: 'Advanced' },
              ], (runExperience) => update({ runExperience }))}
              <View style={[styles.inputRow, styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.optionLabel, styles.optionCopy, { color: colors.text }]}>I have a race date</Text>
                <Switch accessibilityLabel="I have a race date" value={hasRaceDate} trackColor={{ true: colors.accent }}
                  onValueChange={(value) => { setDirty(true); setHasRaceDate(value); }} />
              </View>
              {hasRaceDate ? dateField('race') : null}
            </> : null}
            {options('Activity level', draft.intensity, [
              { value: 'STEADY', label: 'Lightly active' }, { value: 'ACTIVE', label: 'Moderately active' },
              { value: 'PRO', label: 'Very active' },
            ], (value) => update({ intensity: value as Intensity }))}
          </> : null}
          {step === 2 ? <>
            <View style={styles.section}>
              <Text style={[styles.label, { color: colors.text }]}>Training days</Text>
              <Text style={[styles.hint, { color: colors.muted }]}>Choose at least 3 days.</Text>
              <View style={styles.days}>
                {DAYS.map((label, day) => {
                  const selected = draft.days.includes(day);
                  return <Pressable key={label} accessibilityRole="checkbox" accessibilityLabel={label}
                    accessibilityState={{ checked: selected }} aria-checked={selected} onPress={() => update({ days: selected
                      ? draft.days.filter((value) => value !== day) : [...draft.days, day] })}
                    style={[styles.day, { borderColor: selected ? colors.accent : colors.border,
                      backgroundColor: selected ? colors.selected : colors.surface }]}>
                    <Text style={{ color: colors.text, fontWeight: selected ? '700' : '400' }}>{label}</Text>
                    {selected ? <Check size={16} color={colors.accent} /> : null}
                  </Pressable>;
                })}
              </View>
            </View>
            {options('Preferred training time', draft.time, [
              { value: 'morning', label: 'Morning' }, { value: 'afternoon', label: 'Afternoon' },
              { value: 'evening', label: 'Evening' },
            ], (value) => update({ time: value as TrainingTime }))}
            <View style={[styles.summary, { backgroundColor: colors.surface }]}>
              <Text style={[styles.label, { color: colors.text }]}>{GOALS.find((goal) => goal.value === draft.goal)?.label}</Text>
              <Text selectable style={[styles.hint, { color: colors.muted }]}>
                {draft.weight} {unit}{losesWeight ? ` → ${draft.targetWeight} ${unit}` : ''}
              </Text>
              <Text style={[styles.hint, { color: colors.muted }]}>Your current plan stays active until your new plan is ready.</Text>
            </View>
          </> : null}
        </View>
      </ScrollView>
      <View style={[styles.footer, { backgroundColor: colors.bg, borderColor: colors.border, paddingBottom: Math.max(insets.bottom, 16) }]}>
        {error ? <Text accessibilityRole="alert" style={[styles.feedback, { color: colors.error }]}>{error}</Text> : null}
        {generating ? <Text accessibilityLiveRegion="polite" style={[styles.feedback, { color: colors.muted }]}>Generating your new plan. This may take a moment.</Text> : null}
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: generating, busy: generating }}
          disabled={generating} onPress={continueFlow}
          style={({ pressed }) => [styles.primary, { backgroundColor: colors.accent, opacity: pressed || generating ? 0.7 : 1 }]}>
          {generating ? <ActivityIndicator color={colors.onAccent} /> : null}
          <Text style={[styles.primaryLabel, { color: colors.onAccent }]}>{generating ? 'Generating plan…' : step === 2 ? 'Generate new plan' : 'Continue'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 20, paddingBottom: 32 },
  headerButton: { minHeight: 44, minWidth: 44, justifyContent: 'center' },
  step: { fontSize: 12, fontWeight: '600', letterSpacing: 1, marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 8 },
  intro: { fontSize: 16, lineHeight: 24, marginBottom: 24 },
  section: { marginBottom: 24, gap: 8 },
  label: { fontSize: 17, fontWeight: '600' },
  hint: { fontSize: 14, lineHeight: 20 },
  group: { borderRadius: 16, borderCurve: 'continuous', overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  option: { minHeight: 52, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  optionCopy: { flex: 1, gap: 4 },
  optionLabel: { fontSize: 16, flexShrink: 1 },
  inputRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    paddingHorizontal: 16, borderRadius: 16, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, minHeight: 56, fontSize: 20, fontVariant: ['tabular-nums'], paddingVertical: 12 },
  unitRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 16 },
  units: { flexDirection: 'row', gap: 4 },
  unitButton: { minWidth: 52, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderCurve: 'continuous' },
  days: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  day: { minWidth: 64, minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    padding: 12, borderWidth: 1, borderRadius: 12, borderCurve: 'continuous' },
  summary: { padding: 16, borderRadius: 16, borderCurve: 'continuous', gap: 8 },
  footer: { padding: 20, gap: 12, borderTopWidth: StyleSheet.hairlineWidth },
  feedback: { fontSize: 14, lineHeight: 20 },
  primary: { minHeight: 52, padding: 16, borderRadius: 16, borderCurve: 'continuous', flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryLabel: { color: '#FFFFFF', fontSize: 17, fontWeight: '600', flexShrink: 1 },
});
