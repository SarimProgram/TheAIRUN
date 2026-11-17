import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Extrapolation, interpolate, interpolateColor, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import { Image, type ImageSource } from 'expo-image';
import DateTimePicker from '@react-native-community/datetimepicker';
import Slider from '@react-native-community/slider';
import { ArrowRight, CalendarHeart, ChartSpline, Check, Flag, Flame, type LucideIcon } from 'lucide-react-native';
import { C, EASE_OUT, OnboardingScreen, SURFACE_SELECTED, ScreenTitle, rise, useCompact } from './OnboardingKit';

const SURFACE = 'rgba(255,255,255,0.78)';
const TILE = '#FFF0EF';
const RING = '#D8D9DB';
const METER_IDLE = '#FFC2BE';
const SETTLE = { duration: 400, dampingRatio: 0.72 };
const MAX_WEEKLY_LOSS_KG = 1.5;

function addWeeks(date: Date, weeks: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + weeks * 7);
  next.setHours(0, 0, 0, 0);
  return next;
}

function getMinWeeksForSafePace(weightDiff: number) {
  if (weightDiff <= 0) return 1;
  return Math.ceil(weightDiff / MAX_WEEKLY_LOSS_KG);
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function formatWeightAmount(value: number, unit?: string) {
  const normalizedUnit = unit?.toLowerCase() === 'lbs' ? 'lbs' : 'kg';
  const amount = Number.isInteger(value) ? value : Number(value.toFixed(1));
  return `${amount} ${normalizedUnit}`;
}

function formatMaxWeeklyLoss(unit?: string) {
  const normalizedUnit = unit?.toLowerCase() === 'lbs' ? 'lbs' : 'kg';
  const amount = normalizedUnit === 'lbs'
    ? MAX_WEEKLY_LOSS_KG * 2.20462
    : MAX_WEEKLY_LOSS_KG;
  return `${amount.toFixed(1)} ${normalizedUnit}`;
}

const formatShortDate = (date: Date) => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

type StepId = 'timeline' | 'trainingStyle' | 'workoutDaysPerWeek' | 'workoutPreference' | 'raceTraining';
type Option = { id: string; label: string; caption?: string; image?: ImageSource; Icon?: LucideIcon };
type Step = { id: StepId; lead: string; accent: string; trail?: string; lines: 1 | 2; sparkles?: boolean; options: Option[] };

const STEPS: Step[] = [
  {
    id: 'timeline',
    lead: 'Choose your ',
    accent: 'weight loss',
    trail: ' pace',
    lines: 2,
    options: [
      { id: 'moderate', label: 'Slow & steady', Icon: ChartSpline },
      { id: 'aggressive', label: 'Faster pace', Icon: Flame },
      { id: 'custom', label: 'Target date', Icon: CalendarHeart },
    ],
  },
  {
    id: 'trainingStyle',
    lead: 'Choose your ',
    accent: 'workout?',
    lines: 2,
    sparkles: true,
    options: [
      { id: 'workout', label: 'Workout', caption: 'Strength, gym or home', image: require('../../assets/goals/goal-weight-and-run.png') },
      { id: 'runOnly', label: 'Running', caption: 'Run-focused plan', image: require('../../assets/goals/goal-stronger-runner.png') },
      { id: 'walkOnly', label: 'Walking', caption: 'Low impact, step based', image: require('../../assets/goals/goal-walking.png') },
    ],
  },
  {
    id: 'workoutDaysPerWeek',
    lead: 'How many ',
    accent: 'days a week?',
    lines: 2,
    options: [],
  },
  {
    id: 'workoutPreference',
    lead: 'Your preferred ',
    accent: 'workout?',
    lines: 2,
    options: [
      { id: 'strength', label: 'Strength', caption: 'Build muscle', image: require('../../assets/goals/workout-strength.png') },
      { id: 'gym', label: 'Gym', caption: 'Use gym equipment', image: require('../../assets/goals/workout-gym.png') },
      { id: 'home', label: 'Home', caption: 'Train in your space', image: require('../../assets/goals/workout-home.png') },
    ],
  },
  {
    id: 'raceTraining',
    lead: 'Got a ',
    accent: 'race?',
    lines: 1,
    sparkles: true,
    options: [
      { id: 'yes', label: 'Yes, I have a race', caption: "We'll build toward race day", image: require('../../assets/goals/goal-race-medal.png') },
      { id: 'no', label: 'No, just weight loss', caption: 'Focus on fat loss', image: require('../../assets/goals/goal-lose-weight.png') },
    ],
  },
];

interface Props {
  onComplete?: (data: Record<string, unknown>) => void;
  onBack?: () => void;
  currentWeight: number | string;
  targetWeight: number | string;
  unit?: string;
  gender?: string | null;
}

export default function WeightBranch({ onComplete, onBack, currentWeight, targetWeight, unit }: Props) {
  const compact = useCompact();
  const reducedMotion = useReducedMotion();
  const [currentStep, setCurrentStep] = useState(0);
  const [selections, setSelections] = useState<Record<string, string>>({ workoutDaysPerWeek: '3' });
  const [trainingStyles, setTrainingStyles] = useState<string[]>([]);
  const [targetDate, setTargetDate] = useState<Date | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calculatedWeeks, setCalculatedWeeks] = useState<number | null>(null);
  const [isViable, setIsViable] = useState(true);
  const [showMinDateBlockedHint, setShowMinDateBlockedHint] = useState(false);

  const weightDiff = useMemo(
    () => Math.max(0, Math.abs(Number(currentWeight) - Number(targetWeight))),
    [currentWeight, targetWeight]
  );
  const minWeeksRequired = useMemo(() => getMinWeeksForSafePace(weightDiff), [weightDiff]);
  const minimumTargetDate = useMemo(() => addWeeks(new Date(), minWeeksRequired), [minWeeksRequired]);
  const minimumDateReason = useMemo(() => {
    if (weightDiff <= 0) {
      return 'Pick the day you want to hit your goal.';
    }

    return `Losing ${formatWeightAmount(weightDiff, unit)} safely needs at least ${minWeeksRequired} weeks. We cap progress at ${formatMaxWeeklyLoss(unit)}/week, so earlier dates are blocked.`;
  }, [minWeeksRequired, unit, weightDiff]);
  const minimumDateBlockedMessage = useMemo(() => {
    if (weightDiff <= 0) return '';

    return `That date is too soon. ${formatWeightAmount(weightDiff, unit)} in less than ${minWeeksRequired} weeks would be faster than ${formatMaxWeeklyLoss(unit)}/week. Earliest date: ${minimumTargetDate.toLocaleDateString()}.`;
  }, [minWeeksRequired, minimumTargetDate, unit, weightDiff]);
  const lastPickerDateRef = useRef<Date | null>(null);
  const pickerMoveCountRef = useRef(0);

  const exit = useSharedValue(0);
  const exitDirection = useSharedValue(1);
  const transitioning = useRef(false);

  useLayoutEffect(() => {
    exit.set(0);
    transitioning.current = false;
  }, [currentStep, exit]);

  const stepStyle = useAnimatedStyle(() => ({
    opacity: 1 - exit.get(),
    transform: [{ translateX: -exitDirection.get() * 28 * exit.get() }],
  }));

  const goToStep = (next: number, direction: 1 | -1) => {
    if (transitioning.current) return;
    transitioning.current = true;
    exitDirection.set(direction);
    exit.set(withTiming(1, { duration: reducedMotion ? 0 : 150, easing: EASE_OUT }, (finished) => {
      if (finished) scheduleOnRN(setCurrentStep, next);
    }));
  };

  const calculateWeeksFromDate = (date: Date) => {
    const diff = date.getTime() - new Date().getTime();
    const weeks = Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24 * 7)));
    setCalculatedWeeks(weeks);
    setIsViable(weeks >= minWeeksRequired || weightDiff <= 0);
    return weeks;
  };

  const applySelectedDate = (selectedDate: Date, options?: { keepBlockedHint?: boolean }) => {
    const picked = startOfDay(selectedDate);
    const minimum = startOfDay(minimumTargetDate);

    if (picked < minimum) {
      setShowMinDateBlockedHint(true);
      setTargetDate(minimum);
      calculateWeeksFromDate(minimum);
      lastPickerDateRef.current = minimum;
      return minimum;
    }

    if (!options?.keepBlockedHint) {
      setShowMinDateBlockedHint(false);
    }
    setTargetDate(picked);
    calculateWeeksFromDate(picked);
    lastPickerDateRef.current = picked;
    return picked;
  };

  const selectCustomTimeline = () => {
    Haptics.selectionAsync().catch(() => {});
    setSelections((prev) => ({ ...prev, timeline: 'custom' }));
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowCalendar(false);
      if (selectedDate) {
        applySelectedDate(selectedDate);
        selectCustomTimeline();
      }
      return;
    }

    if (!selectedDate) return;

    pickerMoveCountRef.current += 1;

    const minimum = startOfDay(minimumTargetDate);
    const picked = startOfDay(selectedDate);
    const lastPicked = lastPickerDateRef.current ? startOfDay(lastPickerDateRef.current) : null;
    const blockedAtMinimum =
      picked.getTime() === minimum.getTime() &&
      lastPicked?.getTime() === minimum.getTime() &&
      pickerMoveCountRef.current > 1 &&
      event?.type === 'set';

    applySelectedDate(selectedDate, { keepBlockedHint: blockedAtMinimum });
    if (blockedAtMinimum) {
      setShowMinDateBlockedHint(true);
    }
  };

  const confirmIosDate = () => {
    const resolvedDate = targetDate
      ? applySelectedDate(targetDate)
      : applySelectedDate(minimumTargetDate);

    selectCustomTimeline();
    setTargetDate(resolvedDate);
    setShowCalendar(false);
  };

  const openCustomDatePicker = () => {
    setShowMinDateBlockedHint(false);
    pickerMoveCountRef.current = 0;
    const initialDate =
      targetDate && startOfDay(targetDate) >= startOfDay(minimumTargetDate)
        ? startOfDay(targetDate)
        : startOfDay(minimumTargetDate);

    setTargetDate(initialDate);
    calculateWeeksFromDate(initialDate);
    lastPickerDateRef.current = initialDate;
    setShowCalendar(true);
  };

  const includesWorkout = trainingStyles.includes('workout');
  const includesRunning = trainingStyles.includes('runOnly');
  const steps = STEPS.filter((step) =>
    (step.id !== 'workoutPreference' || includesWorkout) &&
    (step.id !== 'raceTraining' || includesRunning)
  );
  const stepData = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  const handleNext = () => {
    if (transitioning.current || !hasSelection) return;
    if (!isLastStep) {
      goToStep(currentStep + 1, 1);
      return;
    }

    onComplete?.({
      timeline: selections.timeline,
      trainingStyle: trainingStyles.join(', '),
      workoutDaysPerWeek: Number(selections.workoutDaysPerWeek),
      workoutPreference: includesWorkout ? selections.workoutPreference : null,
      ...(includesRunning ? { raceTraining: selections.raceTraining } : {}),
      targetDate,
      calculatedWeeks,
    });
  };

  const handleBack = () => {
    if (currentStep > 0) {
      goToStep(currentStep - 1, -1);
    } else {
      onBack?.();
    }
  };

  const toggleSelection = (id: string) => {
    if (transitioning.current) return;
    if (id === 'custom') {
      openCustomDatePicker();
      return;
    }

    if (id === 'moderate') {
      setCalculatedWeeks(Math.ceil(weightDiff / 0.5));
      setIsViable(true);
      setTargetDate(null);
      setShowMinDateBlockedHint(false);
    } else if (id === 'aggressive') {
      setCalculatedWeeks(Math.ceil(weightDiff / 1.0));
      setIsViable(true);
      setTargetDate(null);
      setShowMinDateBlockedHint(false);
    }

    const stepId = stepData.id;
    if (stepId === 'trainingStyle') {
      Haptics.selectionAsync().catch(() => {});
      setTrainingStyles((prev) => prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]);
      return;
    }
    if (selections[stepId] === id) return;
    Haptics.selectionAsync().catch(() => {});
    setSelections((prev) => ({ ...prev, [stepId]: id }));
  };

  const isMultiSelect = stepData.id === 'trainingStyle';
  const selectedOptionId = selections[stepData.id];
  const hasSelection = isMultiSelect ? trainingStyles.length > 0 : !!selectedOptionId;
  const dense = stepData.options.length > 3;
  const unitLabel = unit?.toLowerCase() === 'lbs' ? 'lb' : 'kg';
  const showAggressiveDateWarning =
    stepData.id === 'timeline' &&
    selections.timeline === 'custom' &&
    !!targetDate &&
    calculatedWeeks !== null &&
    !isViable;

  const renderMeta = (option: Option, selected: boolean): ReactNode => {
    if (option.caption) return <Text style={styles.caption} numberOfLines={1}>{option.caption}</Text>;
    if (weightDiff <= 0 && option.id !== 'custom') return null;

    if (option.id === 'moderate') return <PaceMeter level={1} selected={selected} label={`~${Math.ceil(weightDiff / 0.5)} weeks`} />;
    if (option.id === 'aggressive') return <PaceMeter level={3} selected={selected} label={`~${Math.ceil(weightDiff / 1.0)} weeks`} />;
    if (selected && targetDate && calculatedWeeks !== null) {
      return <Text style={[styles.caption, styles.captionAccent]} numberOfLines={1}>
        {`By ${formatShortDate(targetDate)} · ${calculatedWeeks} wk`}
      </Text>;
    }
    return <DateTrail />;
  };

  return (
    <>
      <OnboardingScreen
        key={stepData.id}
        onBack={handleBack}
        showBrand
        scrollable
        ctaLabel={isLastStep ? 'Unlock my plan' : 'Continue'}
        onCta={handleNext}
        ctaDisabled={!hasSelection}
      >
        <Animated.View style={stepStyle}>
          <View key={stepData.id}>
            <ScreenTitle
              lead={stepData.lead}
              accent={stepData.accent}
              trail={stepData.trail}
              lines={stepData.lines}
              sparkles={stepData.sparkles}
              style={{ marginTop: compact ? 12 : 20 }}
            />

            {stepData.id === 'timeline' && (
              <Animated.View
                entering={rise(140)}
                style={[styles.summary, { marginTop: compact ? 12 : 18 }]}
                accessible
                accessibilityLabel={`From ${currentWeight} ${unitLabel} to ${targetWeight} ${unitLabel}`}
              >
                <View style={styles.summarySide}>
                  <Text style={styles.summaryValue}>{currentWeight}<Text style={styles.summaryUnit}> {unitLabel}</Text></Text>
                </View>
                <ArrowRight color={C.muted} size={20} strokeWidth={2.4} />
                <View style={[styles.summarySide, styles.summaryTarget]}>
                  <Text style={[styles.summaryValue, styles.coral]}>{targetWeight}<Text style={[styles.summaryUnit, styles.coral]}> {unitLabel}</Text></Text>
                </View>
              </Animated.View>
            )}

            {isMultiSelect && <Text style={styles.selectionHint}>Choose all that apply.</Text>}

            {stepData.id === 'workoutDaysPerWeek' ? (
              <Animated.View entering={rise(200)} style={styles.frequency}>
                <View style={styles.frequencyValue} accessible accessibilityLabel={`${selections.workoutDaysPerWeek} ${selections.workoutDaysPerWeek === '1' ? 'day' : 'days'} per week`}>
                  <Text style={styles.frequencyNumber}>{selections.workoutDaysPerWeek}</Text>
                  <Text style={styles.frequencyUnit}>{selections.workoutDaysPerWeek === '1' ? 'day' : 'days'} per week</Text>
                </View>
                <Text style={styles.frequencyHint}>Choose a routine that fits your week.</Text>
                <Slider
                  style={styles.frequencySlider}
                  minimumValue={1}
                  maximumValue={7}
                  step={1}
                  tapToSeek
                  value={Number(selections.workoutDaysPerWeek)}
                  minimumTrackTintColor={C.coral}
                  maximumTrackTintColor={RING}
                  thumbTintColor={C.coral}
                  accessibilityLabel="Workout days per week"
                  accessibilityValue={{ min: 1, max: 7, now: Number(selections.workoutDaysPerWeek), text: `${selections.workoutDaysPerWeek} days per week` }}
                  onValueChange={(value) => setSelections((prev) => ({ ...prev, workoutDaysPerWeek: String(Math.round(value)) }))}
                  onSlidingComplete={() => { Haptics.selectionAsync().catch(() => {}); }}
                />
                <View style={styles.frequencyTicks} importantForAccessibility="no-hide-descendants" aria-hidden>
                  {[1, 2, 3, 4, 5, 6, 7].map((day) => <Text key={day} style={[styles.frequencyTick, Number(selections.workoutDaysPerWeek) === day && styles.frequencyTickSelected]}>{day}</Text>)}
                </View>
              </Animated.View>
            ) : <View
              style={{ marginTop: compact ? 14 : 22, gap: dense ? (compact ? 10 : 14) : (compact ? 12 : 16) }}
              accessibilityRole={isMultiSelect ? undefined : "radiogroup"}
            >
              {stepData.options.map((option, index) => {
                const selected = isMultiSelect ? trainingStyles.includes(option.id) : selectedOptionId === option.id;
                return (
                  <Animated.View key={option.id} entering={rise(200 + index * 70)}>
                    <ChoiceCard
                      label={option.label}
                      selected={selected}
                      multiple={isMultiSelect}
                      compact={compact}
                      dense={dense}
                      onPress={() => toggleSelection(option.id)}
                      leading={option.image
                        ? <View style={[styles.art, dense && styles.artDense, compact && styles.artCompact]}>
                          <Image source={option.image} contentFit="contain" style={styles.artImage} accessible={false} />
                        </View>
                        : option.Icon && <View style={[styles.tile, compact && styles.tileCompact]}>
                          <option.Icon color={C.coral} size={compact ? 24 : 27} strokeWidth={2.4} />
                        </View>}
                      meta={renderMeta(option, selected)}
                    />
                  </Animated.View>
                );
              })}
            </View>}

            {showAggressiveDateWarning && (
              <Animated.View entering={rise(0)} style={styles.notice}>
                <Text style={styles.noticeText}>{minimumDateBlockedMessage}</Text>
              </Animated.View>
            )}
          </View>
        </Animated.View>
      </OnboardingScreen>

      {Platform.OS === 'ios' && (
        <Modal animationType="fade" transparent visible={showCalendar} onRequestClose={() => setShowCalendar(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setShowCalendar(false)} accessibilityLabel="Close date picker">
            <Pressable style={styles.modalContent} onPress={() => {}}>
              <View style={styles.modalIcon}>
                <CalendarHeart color={C.coral} size={26} strokeWidth={2.4} />
              </View>
              <Text style={styles.modalTitle}>Pick your <Text style={styles.coral}>target date</Text></Text>
              <Text style={styles.modalSubtitle}>{minimumDateReason}</Text>

              {showMinDateBlockedHint ? (
                <View style={styles.notice}>
                  <Text style={styles.noticeText}>{minimumDateBlockedMessage}</Text>
                </View>
              ) : null}

              <View style={styles.modalPickerWrap}>
                <DateTimePicker
                  value={targetDate && targetDate >= minimumTargetDate ? targetDate : minimumTargetDate}
                  mode="date"
                  display="spinner"
                  minimumDate={minimumTargetDate}
                  onChange={onDateChange}
                  themeVariant="light"
                  style={styles.modalCalendar}
                  textColor={C.ink}
                />
              </View>

              <View style={styles.modalActionRow}>
                <Pressable
                  style={({ pressed }) => [styles.modalButton, styles.modalButtonSecondary, pressed && styles.modalButtonPressed]}
                  onPress={() => setShowCalendar(false)}
                  accessibilityRole="button"
                >
                  <Text style={[styles.modalButtonText, styles.modalButtonSecondaryText]}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.modalButton, styles.modalButtonPrimary, pressed && styles.modalButtonPressed]}
                  onPress={confirmIosDate}
                  accessibilityRole="button"
                >
                  <Text style={styles.modalButtonText}>Confirm</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {showCalendar && Platform.OS === 'android' && (
        <DateTimePicker
          value={targetDate && targetDate >= minimumTargetDate ? targetDate : minimumTargetDate}
          mode="date"
          minimumDate={minimumTargetDate}
          onChange={onDateChange}
        />
      )}
    </>
  );
}

function ChoiceCard({ label, selected, multiple, compact, dense, onPress, leading, meta }: {
  label: string;
  selected: boolean;
  multiple: boolean;
  compact: boolean;
  dense: boolean;
  onPress: () => void;
  leading: ReactNode;
  meta: ReactNode;
}) {
  const progress = useSharedValue(selected ? 1 : 0);
  const badge = useSharedValue(selected ? 1 : 0);
  const pressed = useSharedValue(0);

  useEffect(() => {
    progress.set(withTiming(selected ? 1 : 0, { duration: 240, easing: EASE_OUT }));
    badge.set(selected ? withSpring(1, SETTLE) : withTiming(0, { duration: 140, easing: EASE_OUT }));
  }, [selected, progress, badge]);

  const cardStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(progress.get(), [0, 1], [C.border, C.coral]),
    backgroundColor: interpolateColor(progress.get(), [0, 1], [SURFACE, SURFACE_SELECTED]),
    transform: [{ scale: interpolate(pressed.get(), [0, 1], [1, 0.97]) }],
  }));
  const leadingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(badge.get(), [0, 1], [1, 1.07]) }, { rotate: `${interpolate(badge.get(), [0, 1], [0, -5])}deg` }],
  }));
  const checkStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, badge.get() * 1.6),
    transform: [{ scale: interpolate(badge.get(), [0, 1], [0.55, 1]) }],
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
        {meta}
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

function PaceMeter({ level, selected, label }: { level: number; selected: boolean; label: string }) {
  const fill = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    fill.set(withTiming(selected ? 1 : 0, { duration: 460, easing: EASE_OUT }));
  }, [selected, fill]);

  return <View style={styles.metaRow}>
    <View style={styles.meter}>
      {[0, 1, 2].map((i) => <MeterBar key={i} index={i} active={i < level} fill={fill} />)}
    </View>
    <Text style={styles.caption}>{label}</Text>
  </View>;
}

function MeterBar({ index, active, fill }: { index: number; active: boolean; fill: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const t = interpolate(fill.get(), [index * 0.22, index * 0.22 + 0.56], [0, 1], Extrapolation.CLAMP);
    return { backgroundColor: active ? interpolateColor(t, [0, 1], [METER_IDLE, C.coral]) : C.track };
  });
  return <Animated.View style={[styles.meterBar, style]} />;
}

function DateTrail() {
  return <View style={styles.metaRow} accessible={false}>
    <View style={styles.trailStart} />
    <View style={styles.trailDots}>
      {Array.from({ length: 9 }, (_, i) => <View key={i} style={styles.trailDot} />)}
    </View>
    <Flag color={C.coral} fill={C.coral} size={15} strokeWidth={2.4} />
  </View>;
}

const styles = StyleSheet.create({
  frequency: { marginTop: 40, paddingHorizontal: 8, gap: 12 },
  frequencyValue: { alignItems: 'center' },
  frequencyNumber: { color: C.coral, fontSize: 88, lineHeight: 104, fontWeight: '800', fontVariant: ['tabular-nums'] },
  frequencyUnit: { color: C.ink, fontSize: 20, fontWeight: '600' },
  frequencyHint: { color: C.ink, opacity: 0.6, fontSize: 15, textAlign: 'center', marginBottom: 20 },
  frequencySlider: { width: '100%', height: 48 },
  frequencyTicks: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12 },
  frequencyTick: { color: '#6E7B85', fontSize: 16, fontWeight: '500', textAlign: 'center', minWidth: 16, fontVariant: ['tabular-nums'] },
  frequencyTickSelected: { color: C.coral, fontWeight: '800' },
  selectionHint: { color: C.ink, opacity: 0.6, fontSize: 15, textAlign: 'center', marginTop: 12 },
  coral: { color: C.coral },
  summary: { height: 60, padding: 5, gap: 8, borderRadius: 999, borderCurve: 'continuous', backgroundColor: 'rgba(241,241,243,0.85)', flexDirection: 'row', alignItems: 'center', alignSelf: 'center', minWidth: 240 },
  summarySide: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', borderRadius: 999, borderCurve: 'continuous', paddingHorizontal: 14 },
  summaryTarget: { backgroundColor: SURFACE_SELECTED, borderWidth: 1.5, borderColor: 'rgba(255, 69, 72, 0.22)' },
  summaryValue: { color: C.ink, fontSize: 22, fontWeight: '900', letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
  summaryUnit: { color: 'rgba(8, 36, 55, 0.45)', fontSize: 15, fontWeight: '700', letterSpacing: 0 },
  card: { minHeight: 104, borderRadius: 24, borderCurve: 'continuous', borderWidth: 1.5, borderColor: C.border, backgroundColor: SURFACE, flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 18, paddingVertical: 12, gap: 16, boxShadow: '0 6px 18px rgba(8, 36, 55, 0.05)' },
  cardCompact: { minHeight: 88 },
  cardDense: { minHeight: 92, paddingVertical: 10 },
  cardDenseCompact: { minHeight: 78, paddingVertical: 8 },
  cardBody: { flex: 1, gap: 6 },
  cardTitle: { color: C.ink, fontSize: 19, fontWeight: '800', letterSpacing: -0.4, lineHeight: 24 },
  cardTitleCompact: { fontSize: 17, lineHeight: 22 },
  caption: { color: 'rgba(8, 36, 55, 0.5)', fontSize: 14, fontWeight: '600', letterSpacing: -0.1, fontVariant: ['tabular-nums'] },
  captionAccent: { color: C.coral, fontWeight: '700' },
  art: { width: 84, height: 76, alignItems: 'center', justifyContent: 'center' },
  artDense: { width: 74, height: 66 },
  artCompact: { width: 64, height: 58 },
  artImage: { width: '100%', height: '100%' },
  tile: { width: 60, height: 60, borderRadius: 16, borderCurve: 'continuous', backgroundColor: TILE, alignItems: 'center', justifyContent: 'center' },
  tileCompact: { width: 52, height: 52 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  meter: { flexDirection: 'row', gap: 4 },
  meterBar: { width: 22, height: 7, borderRadius: 4 },
  trailStart: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: C.coral },
  trailDots: { flexDirection: 'row', gap: 5, marginLeft: -4, marginRight: -4 },
  trailDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: C.muted },
  radio: { width: 28, height: 28 },
  radioRing: { ...StyleSheet.absoluteFillObject, borderRadius: 14, borderWidth: 2, borderColor: RING },
  radioChecked: { ...StyleSheet.absoluteFillObject, borderRadius: 14, backgroundColor: C.coral, alignItems: 'center', justifyContent: 'center' },
  notice: { marginTop: 16, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, borderCurve: 'continuous', backgroundColor: SURFACE_SELECTED, borderWidth: 1, borderColor: 'rgba(255, 69, 72, 0.22)' },
  noticeText: { color: C.coral, fontSize: 13, lineHeight: 19, fontWeight: '700', textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(8, 36, 55, 0.45)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  modalContent: { width: '100%', maxWidth: 480, backgroundColor: C.bg, borderRadius: 24, borderCurve: 'continuous', paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20, alignItems: 'stretch', boxShadow: '0 16px 40px rgba(8, 36, 55, 0.18)' },
  modalIcon: { alignSelf: 'center', width: 52, height: 52, borderRadius: 16, borderCurve: 'continuous', backgroundColor: TILE, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  modalTitle: { color: C.ink, fontSize: 24, fontWeight: '900', letterSpacing: -0.8, textAlign: 'center' },
  modalSubtitle: { color: 'rgba(8, 36, 55, 0.55)', fontSize: 14, lineHeight: 20, fontWeight: '600', textAlign: 'center', marginTop: 8, paddingHorizontal: 4 },
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
