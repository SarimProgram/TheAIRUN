import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  FadeIn,
  FadeOut,
  cancelAnimation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Image, type ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Check } from 'lucide-react-native';
import { C, EASE_OUT, OnboardingScreen, ScreenTitle, pop, rise, useCompact } from './OnboardingKit';
import Phase19PlanSummary from './Phase19PlanSummary';

type WeeklyPlanRow = {
  Week?: number;
  'Week name'?: string;
  'Expected weight'?: number;
};

type Insight = {
  id: string;
  label: string;
  value: string;
  art: ImageSource;
};

const ART = {
  weight: require('../../assets/plan/plan-weight.png'),
  bmi: require('../../assets/plan/plan-bmi.png'),
  goal: require('../../assets/plan/plan-goal.png'),
  plan: require('../../assets/plan/plan-calendar.png'),
};

type StepState = 'done' | 'active' | 'pending';

type Props = {
  onGeneratePlan: () => Promise<WeeklyPlanRow[]>;
  onGenerated: (plan: WeeklyPlanRow[]) => void;
  onBack: () => void;
  currentWeight: number | string;
  weightUnit: string;
  height: number | string;
  heightUnit: string;
  targetWeight?: number | string;
  gender?: string | null;
  mainGoal?: string | null;
  planData?: Record<string, unknown>;
  availableDays?: number[];
  initialWeeklyPlan?: WeeklyPlanRow[];
  devView?: 'setup' | 'summary' | 'auto';
};

const STEP_MS = 1600;
const FILL_EASING = Easing.bezier(0.45, 0, 0.25, 1);
const HOLD_FRACTION = 0.9;
const CREEP_FRACTION = 0.97;
const CREEP_MS = 9000;
const FINISH_MS = 320;
const REVEAL_PAUSE_MS = 520;
const SLIDE_SPRING = { duration: 720, dampingRatio: 0.82 };
const CARD_GRADIENT = ['#FFFFFF', '#FFF8F7', '#FFEDEC'] as const;
const CARD_RADIUS = 30;
const VEIL = '#FFF9F8';
const SUBTLE_INK = 'rgba(8, 36, 55, 0.5)';

const waitMs = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function parseWeightKg(weight: number | string, unit: string) {
  const numericWeight = Number(weight);
  if (!Number.isFinite(numericWeight) || numericWeight <= 0) return null;
  const normalizedUnit = String(unit).trim().toLowerCase();
  return normalizedUnit === 'kg' ? numericWeight : numericWeight * 0.45359237;
}

function parseHeightMeters(height: number | string, unit: string) {
  const normalizedUnit = String(unit).trim().toLowerCase();

  if (normalizedUnit === 'cm') {
    const numericHeight = Number(height);
    if (!Number.isFinite(numericHeight) || numericHeight <= 0) return null;
    return numericHeight / 100;
  }

  const rawHeight = String(height).trim();
  const imperialMatch = rawHeight.match(/(\d+)\s*'\s*(\d+)\s*"?/);
  if (!imperialMatch) return null;

  const feet = Number(imperialMatch[1]);
  const inches = Number(imperialMatch[2]);
  if (!Number.isFinite(feet) || !Number.isFinite(inches)) return null;

  const totalInches = feet * 12 + inches;
  return totalInches * 0.0254;
}

function classifyBmi(bmi: number) {
  if (bmi < 18.5) return 'underweight';
  if (bmi < 25) return 'healthy';
  if (bmi < 30) return 'overweight';
  return 'above healthy range';
}

export default function Phase18PlanSetup({
  onGeneratePlan,
  onGenerated,
  onBack,
  currentWeight,
  weightUnit,
  height: userHeight,
  heightUnit,
  targetWeight,
  mainGoal,
  planData,
  availableDays,
  initialWeeklyPlan,
  devView = 'auto',
}: Props) {
  const forceSetup = devView === 'setup';
  const forceSummary = devView === 'summary';
  const hasInitialPlan =
    !forceSetup &&
    (forceSummary || (devView === 'auto' && Array.isArray(initialWeeklyPlan) && initialWeeklyPlan.length > 0));
  const compact = useCompact();
  const reduced = useReducedMotion();
  const [activeStep, setActiveStep] = useState(0);
  const [awaitingPlan, setAwaitingPlan] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedPlan, setGeneratedPlan] = useState<WeeklyPlanRow[] | null>(
    hasInitialPlan ? (initialWeeklyPlan ?? []) : null,
  );
  const [showSummary, setShowSummary] = useState(hasInitialPlan || forceSummary);

  const progress = useSharedValue(0);
  const slide = useSharedValue(0);
  const hasStartedRef = useRef(false);
  const mountedRef = useRef(true);

  const insights = useMemo<Insight[]>(() => {
    const weightVal = `${currentWeight} ${weightUnit}`;
    const targetVal = targetWeight ? `${targetWeight} ${weightUnit}` : 'Not set';
    const weightKg = parseWeightKg(currentWeight, weightUnit);
    const heightMeters = parseHeightMeters(userHeight, heightUnit);
    const bmi =
      weightKg !== null && heightMeters !== null
        ? weightKg / (heightMeters * heightMeters)
        : null;

    return [
      { id: '1', label: 'Your weight', value: weightVal, art: ART.weight },
      {
        id: '2',
        label: 'Your BMI',
        value: bmi ? `${bmi.toFixed(1)} · ${classifyBmi(bmi)}` : 'Not enough info',
        art: ART.bmi,
      },
      { id: '3', label: 'Your goal', value: targetVal, art: ART.goal },
      { id: '4', label: 'Your plan', value: 'Ready to go', art: ART.plan },
    ];
  }, [currentWeight, weightUnit, targetWeight, userHeight, heightUnit]);

  const lastIndex = insights.length - 1;
  const isReady = activeStep > lastIndex;

  useEffect(() => {
    mountedRef.current = true;
    if (!hasInitialPlan && !forceSummary && !hasStartedRef.current) {
      hasStartedRef.current = true;
      startProcess();
    }
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const target = Math.min(activeStep, lastIndex);
    slide.set(reduced ? withTiming(target, { duration: 200, easing: EASE_OUT }) : withSpring(target, SLIDE_SPRING));
  }, [activeStep, lastIndex, reduced, slide]);

  const fillTo = (value: number, duration: number, easing = FILL_EASING) => {
    progress.set(withTiming(value, { duration, easing }));
    return waitMs(duration);
  };

  const startProcess = async () => {
    setError(null);
    setAwaitingPlan(false);
    setActiveStep(0);
    cancelAnimation(progress);
    progress.set(0);

    try {
      const planPromise = onGeneratePlan();
      planPromise.catch(() => undefined);

      for (let i = 0; i < lastIndex; i++) {
        await fillTo(i + 1, STEP_MS);
        if (!mountedRef.current) return;
        Haptics.selectionAsync().catch(() => {});
        setActiveStep(i + 1);
      }

      await fillTo(lastIndex + HOLD_FRACTION, STEP_MS);
      if (!mountedRef.current) return;
      setAwaitingPlan(true);
      progress.set(withTiming(lastIndex + CREEP_FRACTION, { duration: CREEP_MS, easing: EASE_OUT }));

      const plan = await planPromise;
      if (!mountedRef.current) return;
      if (!Array.isArray(plan) || plan.length === 0) {
        throw new Error('Your plan came back empty. Please try again.');
      }

      setAwaitingPlan(false);
      await fillTo(insights.length, FINISH_MS, EASE_OUT);
      if (!mountedRef.current) return;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setActiveStep(insights.length);

      await waitMs(REVEAL_PAUSE_MS);
      if (!mountedRef.current) return;
      setGeneratedPlan(plan);
      setShowSummary(true);
    } catch (err: any) {
      if (!mountedRef.current) return;
      cancelAnimation(progress);
      setAwaitingPlan(false);
      setError(err?.message || 'Something went wrong. Please try again.');
    }
  };

  if (showSummary && generatedPlan) {
    return (
      <Phase19PlanSummary
        mainGoal={mainGoal}
        currentWeight={currentWeight}
        targetWeight={targetWeight}
        weightUnit={weightUnit}
        weeklyPlan={generatedPlan}
        planData={planData}
        availableDays={availableDays}
        onBack={onBack}
        onContinue={() => onGenerated(generatedPlan)}
      />
    );
  }

  const [lead, accent, trail] = error
    ? ['Something went ', 'wrong', '']
    : isReady
      ? ['Your plan is ', 'ready', '']
      : awaitingPlan
        ? ['Almost ', 'there', '']
        : ['Building your ', 'plan', '…'];

  return (
    <OnboardingScreen onBack={onBack} scrollable ctaLabel={error ? 'Try again' : undefined} onCta={startProcess}>
      <Animated.Text entering={rise(40)} style={[styles.eyebrow, { marginTop: compact ? 8 : 20 }]}>
        YOUR PLAN
      </Animated.Text>

      <View style={[styles.titleSlot, { height: compact ? 46 : 54 }]}>
        <Animated.View key={lead + accent} exiting={FadeOut.duration(160)} style={StyleSheet.absoluteFill}>
          <ScreenTitle lead={lead} accent={accent} trail={trail} delay={80} style={styles.title} />
        </Animated.View>
      </View>

      {error && (
        <Animated.Text entering={rise(0)} style={styles.error}>
          {error}
        </Animated.Text>
      )}

      <CardDeck insights={insights} slide={slide} compact={compact} reduced={reduced} />

      <View style={[styles.timeline, { marginTop: compact ? 8 : 20 }]}>
        {insights.map((item, index) => (
          <TimelineRow
            key={item.id}
            item={item}
            index={index}
            state={activeStep > index ? 'done' : activeStep === index ? 'active' : 'pending'}
            last={index === lastIndex}
            progress={progress}
            halted={!!error || reduced}
            compact={compact}
          />
        ))}
      </View>
    </OnboardingScreen>
  );
}

function CardDeck({ insights, slide, compact, reduced }: {
  insights: Insight[];
  slide: SharedValue<number>;
  compact: boolean;
  reduced: boolean;
}) {
  const cardWidth = compact ? 128 : 150;
  const cardHeight = Math.round(cardWidth * 1.26);
  const pedestalWidth = cardWidth * 2.1;
  const float = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    const easing = Easing.inOut(Easing.sin);
    float.set(withRepeat(withSequence(
      withTiming(1, { duration: 1800, easing }),
      withTiming(0, { duration: 1800, easing }),
    ), -1));
    return () => cancelAnimation(float);
  }, [reduced, float]);

  const floatStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -8 * float.get() }] }));
  const pedestalStyle = useAnimatedStyle(() => ({
    opacity: 0.8 + 0.2 * (1 - float.get()),
    transform: [{ scaleX: 1 - 0.03 * float.get() }],
  }));

  return (
    <Animated.View
      entering={rise(160)}
      style={[styles.stage, { height: cardHeight + (compact ? 70 : 86), marginTop: compact ? 4 : 16 }]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <View style={[styles.glow, { width: cardWidth * 1.6, height: cardWidth * 1.6, borderRadius: cardWidth }]} />
      <Animated.View style={[styles.pedestal, { width: pedestalWidth, height: compact ? 38 : 44 }, pedestalStyle]}>
        <View style={styles.pedestalRing} />
      </Animated.View>
      <Animated.View style={[styles.deck, { width: cardWidth, height: cardHeight, bottom: compact ? 30 : 34 }, floatStyle]}>
        {insights.map((item, index) => (
          <PlanCard key={item.id} item={item} index={index} slide={slide} width={cardWidth} />
        ))}
      </Animated.View>
    </Animated.View>
  );
}

function PlanCard({ item, index, slide, width }: {
  item: Insight;
  index: number;
  slide: SharedValue<number>;
  width: number;
}) {
  const cardStyle = useAnimatedStyle(() => {
    const offset = index - slide.get();
    const distance = Math.abs(offset);
    return {
      opacity: interpolate(offset, [-2, -1, 0, 1, 2], [0, 1, 1, 1, 0], Extrapolation.CLAMP),
      zIndex: Math.round(10 - distance * 3),
      transform: [
        { translateX: interpolate(offset, [-2, -1, 0, 1, 2], [-width * 1.05, -width * 0.56, 0, width * 0.56, width * 1.05], Extrapolation.CLAMP) },
        { translateY: interpolate(distance, [0, 1, 2], [0, 14, 26], Extrapolation.CLAMP) },
        { rotate: `${interpolate(offset, [-2, -1, 0, 1, 2], [-18, -11, 0, 11, 18], Extrapolation.CLAMP)}deg` },
        { scale: interpolate(distance, [0, 1, 2], [1, 0.82, 0.68], Extrapolation.CLAMP) },
      ],
    };
  });

  const artStyle = useAnimatedStyle(() => {
    const distance = Math.abs(index - slide.get());
    return {
      transform: [
        { translateY: interpolate(distance, [0, 1], [-4, 4], Extrapolation.CLAMP) },
        { scale: interpolate(distance, [0, 1], [1, 0.86], Extrapolation.CLAMP) },
      ],
    };
  });

  const veilStyle = useAnimatedStyle(() => ({
    opacity: interpolate(Math.abs(index - slide.get()), [0, 1], [0, 0.55], Extrapolation.CLAMP),
  }));

  const artSize = Math.round(width * 0.66);

  return (
    <Animated.View style={[styles.card, cardStyle]}>
      <LinearGradient colors={CARD_GRADIENT} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={styles.cardFace} />
      <Animated.View style={artStyle}>
        <Image source={item.art} style={{ width: artSize, height: artSize }} contentFit="contain" />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.veil, veilStyle]} />
    </Animated.View>
  );
}

function TimelineRow({ item, index, state, last, progress, halted, compact }: {
  item: Insight;
  index: number;
  state: StepState;
  last: boolean;
  progress: SharedValue<number>;
  halted: boolean;
  compact: boolean;
}) {
  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.get(), [index - 0.12, index], [C.muted, C.ink]),
  }));
  const barStyle = useAnimatedStyle(() => ({
    width: `${interpolate(progress.get() - index, [0, 1], [0, 100], Extrapolation.CLAMP)}%`,
  }));
  const connectorStyle = useAnimatedStyle(() => ({
    height: `${interpolate(progress.get(), [index + 0.8, index + 1], [0, 100], Extrapolation.CLAMP)}%`,
  }));

  const status = state === 'done' ? item.value : state === 'active' ? 'in progress' : 'pending';

  return (
    <Animated.View
      entering={rise(300 + index * 70)}
      style={[styles.row, { height: compact ? 56 : 64 }]}
      accessible
      accessibilityLabel={`${item.label}, ${status}`}
    >
      <View style={styles.rail}>
        <StepNode state={state} halted={halted} />
        {!last && (
          <View style={styles.connector}>
            <Animated.View style={[styles.connectorFill, connectorStyle]} />
          </View>
        )}
      </View>

      <View style={styles.rowCopy}>
        <Animated.Text style={[styles.rowLabel, labelStyle]} numberOfLines={1}>{item.label}</Animated.Text>
        <View style={styles.subline}>
          {state === 'active' && (
            <Animated.View
              key="bar"
              entering={FadeIn.duration(220)}
              exiting={FadeOut.duration(140)}
              style={styles.sublineFill}
              accessibilityRole="progressbar"
            >
              <View style={styles.barTrack}>
                <Animated.View style={[styles.barFill, barStyle]} />
              </View>
            </Animated.View>
          )}
          {state === 'done' && (
            <Animated.Text key="value" entering={FadeIn.duration(260).delay(100)} style={styles.rowValue} numberOfLines={1}>
              {item.value}
            </Animated.Text>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

function StepNode({ state, halted }: { state: StepState; halted: boolean }) {
  return (
    <View style={styles.node}>
      {state === 'done' && (
        <Animated.View key="done" entering={pop(0)} style={[styles.nodeLayer, styles.nodeDone]}>
          <Check color={C.white} size={16} strokeWidth={3.4} />
        </Animated.View>
      )}
      {state === 'active' && (
        <Animated.View key="active" entering={FadeIn.duration(200)} exiting={FadeOut.duration(140)} style={styles.nodeLayer}>
          <Pulse paused={halted} />
          <View style={styles.nodeActive}>
            <View style={styles.nodeDot} />
          </View>
        </Animated.View>
      )}
      {state === 'pending' && (
        <Animated.View key="pending" exiting={FadeOut.duration(140)} style={styles.nodeLayer}>
          <View style={styles.nodePending} />
        </Animated.View>
      )}
    </View>
  );
}

function Pulse({ paused }: { paused: boolean }) {
  const t = useSharedValue(0);

  useEffect(() => {
    if (paused) {
      cancelAnimation(t);
      t.set(withTiming(0, { duration: 200, easing: EASE_OUT }));
      return;
    }
    t.set(withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }), -1, false));
    return () => cancelAnimation(t);
  }, [paused, t]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.35 * (1 - t.get()),
    transform: [{ scale: 1 + 0.75 * t.get() }],
  }));

  return <Animated.View style={[styles.pulse, style]} />;
}

const NODE = 28;

const styles = StyleSheet.create({
  eyebrow: { color: C.coral, fontSize: 14, fontWeight: '900', letterSpacing: 2.4, textAlign: 'center' },
  titleSlot: { marginTop: 6 },
  title: { marginTop: 0 },
  error: { color: SUBTLE_INK, fontSize: 15, fontWeight: '600', textAlign: 'center', marginTop: 8, paddingHorizontal: 16 },

  stage: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'flex-end' },
  glow: { position: 'absolute', top: '18%', backgroundColor: 'rgba(255, 69, 72, 0.06)', boxShadow: '0 0 80px 40px rgba(255, 69, 72, 0.08)' },
  pedestal: {
    position: 'absolute',
    bottom: 8,
    borderRadius: 999,
    backgroundColor: C.white,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 69, 72, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 14px 30px rgba(255, 69, 72, 0.22), inset 0 -6px 12px rgba(255, 69, 72, 0.10)',
  },
  pedestalRing: { width: '72%', height: '52%', borderRadius: 999, borderWidth: 2, borderColor: 'rgba(255, 69, 72, 0.16)' },
  deck: { position: 'absolute' },
  card: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: CARD_RADIUS,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 22px 44px rgba(255, 69, 72, 0.16), 0 3px 8px rgba(255, 69, 72, 0.08)',
  },
  cardFace: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: CARD_RADIUS,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    borderColor: C.white,
    boxShadow: 'inset 0 -10px 24px rgba(255, 69, 72, 0.06)',
  },
  veil: { ...StyleSheet.absoluteFillObject, borderRadius: CARD_RADIUS, borderCurve: 'continuous', backgroundColor: VEIL },

  timeline: { alignSelf: 'center', width: '100%', maxWidth: 320, paddingHorizontal: 24 },
  row: { flexDirection: 'row', gap: 16 },
  rail: { width: NODE, alignItems: 'center' },
  connector: { flex: 1, width: 2, marginVertical: 4, borderRadius: 1, backgroundColor: C.track, overflow: 'hidden' },
  connectorFill: { width: '100%', backgroundColor: C.coral },
  rowCopy: { flex: 1, paddingTop: 2 },
  rowLabel: { fontSize: 18, fontWeight: '800', letterSpacing: -0.4 },
  subline: { height: 22, marginTop: 2 },
  sublineFill: { ...StyleSheet.absoluteFillObject, justifyContent: 'center' },
  barTrack: { height: 6, maxWidth: 200, borderRadius: 3, backgroundColor: C.track, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3, backgroundColor: C.coral },
  rowValue: { position: 'absolute', left: 0, right: 0, color: SUBTLE_INK, fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },

  node: { width: NODE, height: NODE },
  nodeLayer: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  nodeDone: { borderRadius: NODE / 2, backgroundColor: C.coral, boxShadow: '0 4px 10px rgba(255, 69, 72, 0.3)' },
  nodeActive: { width: NODE, height: NODE, borderRadius: NODE / 2, backgroundColor: 'rgba(255, 69, 72, 0.16)', alignItems: 'center', justifyContent: 'center' },
  nodeDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: C.coral },
  nodePending: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: C.border, backgroundColor: C.white },
  pulse: { position: 'absolute', width: NODE, height: NODE, borderRadius: NODE / 2, backgroundColor: C.coral },
});
