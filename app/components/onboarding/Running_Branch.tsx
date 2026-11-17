import React, { useState, useRef, useEffect, useLayoutEffect, type ReactNode } from 'react';
import { StyleSheet, View, Text, Platform, Pressable, Modal } from 'react-native';
import { Check } from 'lucide-react-native';
import { RunningOptionArt } from './RunningOptionArt';
import DateTimePicker from '@react-native-community/datetimepicker';
import Animated, { FadeIn, interpolate, interpolateColor, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import { C, EASE_OUT, OnboardingScreen, SURFACE, SURFACE_SELECTED, ScreenTitle, WheelPicker, rise, useCompact } from './OnboardingKit';

const RING = '#D8D9DB';
const SETTLE = { duration: 400, dampingRatio: 0.72 };
const TITLES: Record<string, { lead: string; accent: string }> = {
  trainingGoal: { lead: "I'm training ", accent: 'for...' },
  experience: { lead: 'My running ', accent: 'level' },
  easyBaseline: { lead: 'Find your ', accent: 'starting pace' },
  raceDate: { lead: 'Got a ', accent: 'race day?' },
  dietStrategy: { lead: 'Choose your ', accent: 'food goal' },
  priority: { lead: 'Find your ', accent: 'focus' },
};
const STEPS = [
  {
    id: 'trainingGoal',
    title: "I'm training for...",
    desc: 'Pick your primary running objective.',
    options: [
      { id: '5k', iconLabel: '5K', desc: 'Speed & power' },
      { id: '10k', iconLabel: '10K', desc: 'Balance & pace' },
      { id: 'halfMarathon', iconLabel: 'Half Marathon', desc: 'Stamina & grit' },
      { id: 'speedImprovement', iconLabel: 'PR', desc: 'Speed work' },
    ],
  },
  {
    id: 'experience',
    title: "My running level is...",
    desc: 'Be honest to get the best training plan.',
    options: [
      { id: 'beginner', label: 'Beginner', desc: 'New or starting over' },
      { id: 'intermediate', label: 'Intermediate', desc: 'Consistent weekly runner' },
      { id: 'advanced', label: 'Advanced', desc: 'Experienced competitive athlete' },
    ],
  },
  {
    id: 'easyBaseline',
    title: 'Easy Pace',
    desc: 'What finish time feels comfortable for you?',
    options: [],
  },
  {
    id: 'raceDate',
    title: "Do you have a race day?",
    desc: "We'll shape your plan around your timeline.",
    options: [
      {
        id: 'yes',
        label: 'Yes, I have a date',
        hasDatePicker: true,
        desc: "Pick your event and we'll count down to it",
      },
      {
        id: 'notYet',
        label: 'Not yet',
        desc: 'Train on a flexible schedule for now',
      },
    ],
  },
  {
    id: 'dietStrategy',
    title: "What's your food goal?",
    desc: 'Pick what fits you best.',
    options: [
      { id: 'performance', label: 'Fuel my runs', desc: 'More energy for training' },
      { id: 'weightloss', label: 'Lose a little weight', desc: 'Support steady weight loss' },
    ],
  },
  {
    id: 'priority',
    title: 'Your focus',
    desc: 'Pick what matters most.',
    options: [
      { id: 'faster', label: 'Get faster', desc: 'More speed' },
      { id: 'longer', label: 'Go longer', desc: 'More distance' },
      { id: 'form', label: 'Run smoothly', desc: 'Better form' },
    ],
  },
];

const RUN_BASELINE_CONFIG: Record<string, { label: string; distanceKm: number; defaultMinutes: number }> = {
  '5k': { label: '5K', distanceKm: 5, defaultMinutes: 35 },
  '10k': { label: '10K', distanceKm: 10, defaultMinutes: 70 },
  'halfMarathon': { label: 'Half Marathon', distanceKm: 21.1, defaultMinutes: 150 },
  speedImprovement: { label: 'easy 5K', distanceKm: 5, defaultMinutes: 35 },
};
const MINUTE_OPTIONS = Array.from({ length: 231 }, (_, index) => index + 10);
const SECOND_OPTIONS = Array.from({ length: 12 }, (_, index) => index * 5);

export default function RunningBranch({ onComplete, onBack, skipDietStrategy = false, initialData }: any) {
  const steps = skipDietStrategy
    ? STEPS.filter((step) => step.id !== 'dietStrategy')
    : STEPS;
  const [currentStep, setCurrentStep] = useState(() => initialData ? steps.length - 1 : 0);
  const [selections, setSelections] = useState<Partial<Record<string, string>>>(() => initialData ? {
    trainingGoal: initialData.trainingGoal,
    experience: initialData.experience,
    raceDate: initialData.raceDateSelection ?? (initialData.raceDate ? 'yes' : 'notYet'),
    dietStrategy: initialData.dietStrategy,
    priority: initialData.priority,
  } : {});
  const [raceDate, setRaceDate] = useState<Date | null>(() => initialData?.raceDate ? new Date(initialData.raceDate) : null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [draftRaceDate, setDraftRaceDate] = useState(new Date());
  const [easyMinutes, setEasyMinutes] = useState(initialData?.easyMinutes ?? 35);
  const [easySeconds, setEasySeconds] = useState(initialData?.easySeconds ?? 0);
  const [baselineMode, setBaselineMode] = useState<'estimate' | 'absolute_new'>(initialData?.baselineMode ?? 'absolute_new');

  const shouldInitializeBaselineRef = useRef(!initialData);

  useEffect(() => {
    const baselineConfig = RUN_BASELINE_CONFIG[selections.trainingGoal ?? ''];
    if (baselineConfig && shouldInitializeBaselineRef.current) {
      setEasyMinutes(baselineConfig.defaultMinutes);
      setEasySeconds(0);
    }
    shouldInitializeBaselineRef.current = true;
  }, [selections.trainingGoal]);

  const onDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowCalendar(false);
      if (event.type === 'set' && selectedDate) {
        setRaceDate(selectedDate);
        setSelections({ ...selections, raceDate: 'yes' });
      }
    } else if (selectedDate) {
      setDraftRaceDate(selectedDate);
    }
  };

  const confirmIosDate = () => {
    if (draftRaceDate) {
      setRaceDate(draftRaceDate);
      setSelections({ ...selections, raceDate: 'yes' });
      setShowCalendar(false);
    }
  };

  const handleNext = () => {
    if (transitioning.current || !isButtonActive) return;
    if (currentStep < steps.length - 1) {
      const nextStep = steps[currentStep + 1];
      if (nextStep.id === 'priority' && selections.experience === 'beginner') {
          setSelections(prev => ({ ...prev, priority: prev.priority ?? 'form' }));
      }
      goToStep(currentStep + 1, 1);
    } else {
      const baselineConfig = RUN_BASELINE_CONFIG[selections.trainingGoal ?? '5k'] || RUN_BASELINE_CONFIG['5k'];
      const baselinePaceSecPerKm = baselineMode === 'absolute_new'
        ? 9 * 60
        : Math.round(((easyMinutes * 60) + easySeconds) / baselineConfig.distanceKm);

      onComplete?.({
        ...selections,
        raceDate: selections.raceDate === 'yes' ? raceDate?.toISOString() || null : null,
        raceDateSelection: selections.raceDate,
        easyMinutes,
        easySeconds,
        baselineMode,
        baselinePaceSecPerKm,
        isAbsoluteNewToRunning: baselineMode === 'absolute_new',
      });
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      goToStep(currentStep - 1, -1);
    } else {
      onBack?.();
    }
  };

  const toggleSelection = (id: string, hasDatePicker?: boolean) => {
    Haptics.selectionAsync().catch(() => {});
    if (hasDatePicker) {
      setDraftRaceDate(raceDate || new Date());
      setShowCalendar(true);
      return;
    }
    setSelections({ ...selections, [steps[currentStep].id]: id });
  };

  const stepData = steps[currentStep];
  const selectedOptionId = selections[stepData.id];
  const baselineConfig = RUN_BASELINE_CONFIG[selections.trainingGoal ?? '5k'] || RUN_BASELINE_CONFIG['5k'];
  const baselinePaceSecPerKm = baselineMode === 'absolute_new'
    ? 9 * 60
    : Math.round(((easyMinutes * 60) + easySeconds) / baselineConfig.distanceKm);
  const baselinePaceMinutes = Math.floor(baselinePaceSecPerKm / 60);
  const baselinePaceSeconds = baselinePaceSecPerKm % 60;
  const isButtonActive = stepData.id === 'easyBaseline' ? true : !!selectedOptionId;
  const formatDate = (date: Date) => {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const selectMinute = (value: number) => {
    setBaselineMode('estimate');
    setEasyMinutes(value);
  };

  const selectSecond = (value: number) => {
    setBaselineMode('estimate');
    setEasySeconds(value);
  };

  const compact = useCompact();
  const reducedMotion = useReducedMotion();
  const enter = (delay: number) => reducedMotion ? FadeIn.duration(140) : rise(delay);
  const exit = useSharedValue(0);
  const exitDirection = useSharedValue(1);
  const transitioning = useRef(false);
  useLayoutEffect(() => {
    exit.set(0);
    transitioning.current = false;
  }, [currentStep, exit]);
  const stepStyle = useAnimatedStyle(() => ({
    opacity: 1 - exit.get(),
    transform: [{ translateX: reducedMotion ? 0 : -exitDirection.get() * 28 * exit.get() }],
  }));
  const goToStep = (next: number, direction: 1 | -1) => {
    if (transitioning.current) return;
    transitioning.current = true;
    exitDirection.set(direction);
    exit.set(withTiming(1, { duration: reducedMotion ? 0 : 150, easing: EASE_OUT }, (finished) => {
      if (finished) scheduleOnRN(setCurrentStep, next);
    }));
  };
  const title = TITLES[stepData.id];
  const dense = stepData.options.length > 3;
  const isLastStep = currentStep === steps.length - 1;
  const paceLabel = `${baselinePaceMinutes}:${String(baselinePaceSeconds).padStart(2, '0')}`;
  const baselineOption = (mode: 'absolute_new' | 'estimate', label: string) => (
    <ChoiceCard label={label} selected={baselineMode === mode} multiple={false} compact={compact} dense={false}
      onPress={() => { Haptics.selectionAsync().catch(() => {}); setBaselineMode(mode); }}
      leading={<RunningOptionArt name={mode} size={compact ? 58 : 76} />} />
  );

  return <>
    <OnboardingScreen onBack={handleBack} showBrand scrollable
      ctaLabel={isLastStep ? 'Unlock my plan' : 'Continue'} onCta={handleNext} ctaDisabled={!isButtonActive}>
      <Animated.View style={[styles.step, stepStyle]}>
        <View key={stepData.id}>
          <ScreenTitle lead={title.lead} accent={title.accent} lines={2} style={{ marginTop: compact ? 12 : 20 }} />
          {stepData.id === 'easyBaseline' ? <View style={[styles.stack, { gap: compact ? 12 : 16 }]} accessibilityRole="radiogroup">
            <Animated.View entering={enter(200)}>
              {baselineOption('absolute_new', "I'm new to running")}
            </Animated.View>
            <Animated.View entering={enter(270)}>
              {baselineOption('estimate', 'I know my pace')}
            </Animated.View>
            {baselineMode === 'estimate' && <Animated.View entering={enter(0)} style={styles.pacePanel}>
              <Text style={styles.paceHeading}>My comfortable {baselineConfig.label}</Text>
              <View style={styles.pickerRow}>
                <View style={styles.pickerColumn}>
                  <Text style={styles.pickerLabel}>MINUTES</Text>
                  <WheelPicker values={MINUTE_OPTIONS} initialIndex={Math.max(0, MINUTE_OPTIONS.indexOf(easyMinutes))} onChange={(index) => selectMinute(MINUTE_OPTIONS[index])}
                    virtualized={false} itemHeight={44} fontSize={34} highlightHeight={44} accessibilityLabel="Finishing time minutes" unit="minutes" />
                </View>
                <Text style={styles.timeColon}>:</Text>
                <View style={styles.pickerColumn}>
                  <Text style={styles.pickerLabel}>SECONDS</Text>
                  <WheelPicker values={SECOND_OPTIONS.map((value) => String(value).padStart(2, '0'))} initialIndex={Math.max(0, SECOND_OPTIONS.indexOf(easySeconds))} onChange={(index) => selectSecond(SECOND_OPTIONS[index])}
                    virtualized={false} itemHeight={44} fontSize={34} highlightHeight={44} accessibilityLabel="Finishing time seconds" unit="seconds" />
                </View>
              </View>
            </Animated.View>}
            <Animated.View entering={enter(340)} style={styles.paceSummary} accessibilityLiveRegion="polite">
              <View style={styles.cardBody}>
                <Text style={styles.paceSummaryLabel}>STARTING PACE</Text>
                <Text style={styles.caption}>{baselineMode === 'absolute_new' ? 'A gentle place to begin' : `Based on your ${baselineConfig.label} time`}</Text>
              </View>
              <Text style={styles.paceValue}>{paceLabel}<Text style={styles.paceUnit}> /km</Text></Text>
            </Animated.View>
          </View> : <View style={[styles.stack, { gap: dense ? (compact ? 10 : 14) : (compact ? 12 : 16) }]} accessibilityRole="radiogroup">
            {stepData.options.map((option: any, index: number) => {
              const selected = selectedOptionId === option.id;
              const dateLabel = option.hasDatePicker && selected && raceDate ? formatDate(raceDate) : null;
              const label = option.label ?? (option.id === 'speedImprovement' ? 'A personal best' : option.iconLabel);
              return <Animated.View key={option.id} entering={enter(200 + index * 70)}>
                <ChoiceCard label={dateLabel ?? label} selected={selected} multiple={false} compact={compact} dense={dense} onPress={() => toggleSelection(option.id, option.hasDatePicker)}
                  leading={<RunningOptionArt name={option.id} size={compact ? 58 : dense ? 66 : 76} />} />
              </Animated.View>;
            })}
          </View>}
          {stepData.id === 'priority' && selections.experience === 'beginner' && <Animated.View entering={enter(420)} style={styles.notice}>
            <Text style={styles.noticeText}>New to running? Start with Run smoothly.</Text>
          </Animated.View>}
        </View>
      </Animated.View>
    </OnboardingScreen>
    {Platform.OS === 'ios' && <Modal animationType="fade" transparent visible={showCalendar} onRequestClose={() => setShowCalendar(false)}>
      <Pressable style={styles.modalOverlay} onPress={() => setShowCalendar(false)} accessibilityLabel="Close date picker">
        <Pressable style={styles.modalContent} onPress={() => {}}>
          <View style={styles.modalIcon}><RunningOptionArt name="yes" size={52} /></View>
          <Text style={styles.modalTitle}>Pick your <Text style={styles.coral}>race day</Text></Text>
          <DateTimePicker value={draftRaceDate} mode="date" display="spinner" minimumDate={new Date()} onChange={onDateChange}
            themeVariant="light" textColor={C.ink} style={styles.modalCalendar} />
          <View style={styles.modalActionRow}>
            <Pressable style={({ pressed }) => [styles.modalButton, styles.modalButtonSecondary, pressed && styles.modalButtonPressed]} onPress={() => setShowCalendar(false)} accessibilityRole="button">
              <Text style={[styles.modalButtonText, styles.modalButtonSecondaryText]}>Cancel</Text>
            </Pressable>
            <Pressable style={({ pressed }) => [styles.modalButton, styles.modalButtonPrimary, pressed && styles.modalButtonPressed]} onPress={confirmIosDate} accessibilityRole="button">
              <Text style={styles.modalButtonText}>Confirm</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>}
    {showCalendar && Platform.OS === 'android' && <DateTimePicker value={draftRaceDate} mode="date" minimumDate={new Date()} onChange={onDateChange} />}
  </>;
}

function ChoiceCard({ label, selected, multiple, compact, dense, onPress, leading }: {
  label: string;
  selected: boolean;
  multiple: boolean;
  compact: boolean;
  dense: boolean;
  onPress: () => void;
  leading: ReactNode;
}) {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(selected ? 1 : 0);
  const badge = useSharedValue(selected ? 1 : 0);
  const pressed = useSharedValue(0);

  useEffect(() => {
    progress.set(withTiming(selected ? 1 : 0, { duration: 240, easing: EASE_OUT }));
    badge.set(selected ? reducedMotion ? withTiming(1, { duration: 140 }) : withSpring(1, SETTLE) : withTiming(0, { duration: 140, easing: EASE_OUT }));
  }, [selected, progress, badge, reducedMotion]);

  const cardStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(progress.get(), [0, 1], [C.border, C.coral]),
    backgroundColor: interpolateColor(progress.get(), [0, 1], [SURFACE, SURFACE_SELECTED]),
    transform: [{ scale: reducedMotion ? 1 : interpolate(pressed.get(), [0, 1], [1, 0.97]) }],
  }));
  const leadingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: reducedMotion ? 1 : interpolate(badge.get(), [0, 1], [1, 1.07]) }, { rotate: `${reducedMotion ? 0 : interpolate(badge.get(), [0, 1], [0, -5])}deg` }],
  }));
  const checkStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, badge.get() * 1.6),
    transform: [{ scale: reducedMotion ? 1 : interpolate(badge.get(), [0, 1], [0.55, 1]) }],
  }));
  const ringStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.get() }));

  return <Pressable
    onPress={onPress}
    onPressIn={() => pressed.set(withTiming(1, { duration: 110, easing: EASE_OUT }))}
    onPressOut={() => pressed.set(withTiming(0, { duration: 180, easing: EASE_OUT }))}
    accessibilityRole={multiple ? "checkbox" : "radio"}
    accessibilityState={multiple ? { checked: selected } : { selected }}
    accessibilityLabel={label}
  >
    <Animated.View style={[styles.card, dense && styles.cardDense, compact && (dense ? styles.cardDenseCompact : styles.cardCompact), cardStyle]}>
      <Animated.View style={leadingStyle}>{leading}</Animated.View>
      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, compact && styles.cardTitleCompact]} numberOfLines={2}>{label}</Text>
      </View>
      <View style={styles.radio}>
        <Animated.View style={[styles.radioRing, ringStyle]} />
        <Animated.View style={[styles.radioChecked, checkStyle]}>
          <Check color={C.white} size={18} strokeWidth={3.4} />
        </Animated.View>
      </View>
    </Animated.View>
  </Pressable>;
}


const styles = StyleSheet.create({
  step: { flexShrink: 0 },
  stack: { marginTop: 22 },
  coral: { color: C.coral },
  pacePanel: { padding: 16, borderRadius: 24, borderCurve: 'continuous', backgroundColor: SURFACE, borderWidth: 1.5, borderColor: C.border },
  paceHeading: { color: C.ink, fontSize: 16, lineHeight: 22, fontWeight: '800', textAlign: 'center', marginBottom: 12 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pickerColumn: { flex: 1, gap: 8 },
  pickerLabel: { color: 'rgba(8, 36, 55, 0.5)', fontSize: 11, fontWeight: '800', letterSpacing: 1, textAlign: 'center' },
  paceSummaryLabel: { color: 'rgba(8, 36, 55, 0.5)', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  timeColon: { color: C.ink, fontSize: 28, fontWeight: '900', marginTop: 22 },
  paceSummary: { padding: 16, borderRadius: 16, borderCurve: 'continuous', backgroundColor: SURFACE_SELECTED, flexDirection: 'row', alignItems: 'center', gap: 12 },
  paceValue: { color: C.coral, fontSize: 28, fontWeight: '900', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  paceUnit: { fontSize: 14, fontWeight: '700', letterSpacing: 0 },
  card: { minHeight: 104, borderRadius: 24, borderCurve: 'continuous', borderWidth: 1.5, borderColor: C.border, backgroundColor: SURFACE, flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 18, paddingVertical: 12, gap: 16, boxShadow: '0 6px 18px rgba(8, 36, 55, 0.05)' },
  cardCompact: { minHeight: 88 },
  cardDense: { minHeight: 92, paddingVertical: 10 },
  cardDenseCompact: { minHeight: 78, paddingVertical: 8 },
  cardBody: { flex: 1, gap: 6 },
  cardTitle: { color: C.ink, fontSize: 19, fontWeight: '800', letterSpacing: -0.4, lineHeight: 24 },
  cardTitleCompact: { fontSize: 17, lineHeight: 22 },
  caption: { color: 'rgba(8, 36, 55, 0.5)', fontSize: 14, fontWeight: '600', letterSpacing: -0.1, fontVariant: ['tabular-nums'] },
  captionAccent: { color: C.coral, fontWeight: '700' },
  radio: { width: 28, height: 28 },
  radioRing: { ...StyleSheet.absoluteFillObject, borderRadius: 14, borderWidth: 2, borderColor: RING },
  radioChecked: { ...StyleSheet.absoluteFillObject, borderRadius: 14, backgroundColor: C.coral, alignItems: 'center', justifyContent: 'center' },
  notice: { marginTop: 16, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, borderCurve: 'continuous', backgroundColor: SURFACE_SELECTED, borderWidth: 1, borderColor: 'rgba(255, 69, 72, 0.22)' },
  noticeText: { color: C.coral, fontSize: 13, lineHeight: 19, fontWeight: '700', textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(8, 36, 55, 0.45)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  modalContent: { width: '100%', maxWidth: 480, backgroundColor: C.bg, borderRadius: 24, borderCurve: 'continuous', paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20, alignItems: 'stretch', boxShadow: '0 16px 40px rgba(8, 36, 55, 0.18)' },
  modalIcon: { alignSelf: 'center', width: 52, height: 52, borderRadius: 16, borderCurve: 'continuous', backgroundColor: SURFACE_SELECTED, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  modalTitle: { color: C.ink, fontSize: 24, fontWeight: '900', letterSpacing: -0.8, textAlign: 'center' },
  modalPickerWrap: { alignItems: 'center', justifyContent: 'center', marginVertical: 8 },
  modalCalendar: { width: '100%', height: 200 },
  modalActionRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  modalButton: { flex: 1, height: 52, borderRadius: 999, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  modalButtonPrimary: { backgroundColor: C.coral, boxShadow: '0 8px 20px rgba(255, 69, 72, 0.26)' },
  modalButtonSecondary: { backgroundColor: C.track },
  modalButtonPressed: { transform: [{ scale: 0.97 }] },
  modalButtonText: { color: C.white, fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  modalButtonSecondaryText: { color: C.ink },
});
