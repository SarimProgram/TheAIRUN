import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Scale,
  Activity,
  Target,
  ClipboardList,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getGenderMascotSource } from '../../utils/genderMascot';
import Phase19PlanSummary from './Phase19PlanSummary';

const { height: windowHeight } = Dimensions.get('window');
const screenHeight = Math.min(windowHeight, 800);

const COLORS = {
  coral: '#FF6B6B',
  coralDark: '#EE5253',
  coralLight: '#FFF5F5',
  white: '#FFFFFF',
  black: '#1F2937',
  muted: '#6B7280',
};

type WeeklyPlanRow = {
  Week?: number;
  'Week name'?: string;
  'Expected weight'?: number;
};

type Insight = {
  id: string;
  label: string;
  value: string;
  icon: typeof Scale;
};

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

const MANDATORY_STEP_MS = 1600;
const HOLDING_PROGRESS_PERCENT = 99;
const COMPLETION_PROGRESS_PERCENT = 100;

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
  gender,
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
  const isCompact = screenHeight < 820;
  const [activeStep, setActiveStep] = useState(0);
  const [isDone, setIsDone] = useState(hasInitialPlan);
  const [awaitingPlan, setAwaitingPlan] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressPercent, setProgressPercent] = useState(hasInitialPlan ? 100 : 0);
  const [generatedPlan, setGeneratedPlan] = useState<WeeklyPlanRow[] | null>(
    hasInitialPlan ? (initialWeeklyPlan ?? []) : null,
  );
  const [showSummary, setShowSummary] = useState(hasInitialPlan || forceSummary);

  const mascotScale = useRef(new Animated.Value(1)).current;
  const progressWidth = useRef(new Animated.Value(0)).current;
  const hasStartedRef = useRef(false);

  const insights = useMemo<Insight[]>(() => {
    const weightVal = `${currentWeight} ${weightUnit}`;
    const targetVal = targetWeight ? `${targetWeight} ${weightUnit}` : 'Not set';
    const weightKg = parseWeightKg(currentWeight, weightUnit);
    const heightMeters = parseHeightMeters(userHeight, heightUnit);
    const bmi =
      weightKg !== null && heightMeters !== null
        ? weightKg / (heightMeters * heightMeters)
        : null;
    const bmiVal = bmi ? `${bmi.toFixed(1)} · ${classifyBmi(bmi)}` : 'Not enough info';

    return [
      { id: '1', label: 'Your weight', value: weightVal, icon: Scale },
      { id: '2', label: 'Your BMI', value: bmiVal, icon: Activity },
      { id: '3', label: 'Your goal', value: targetVal, icon: Target },
      { id: '4', label: 'Your plan', value: 'Ready to go', icon: ClipboardList },
    ];
  }, [currentWeight, weightUnit, targetWeight, userHeight, heightUnit]);

  const mascotSource = useMemo(() => getGenderMascotSource(gender), [gender]);

  useEffect(() => {
    if (hasInitialPlan || forceSummary || hasStartedRef.current) return;
    hasStartedRef.current = true;

    Animated.loop(
      Animated.sequence([
        Animated.timing(mascotScale, { toValue: 1.04, duration: 1600, useNativeDriver: true }),
        Animated.timing(mascotScale, { toValue: 1, duration: 1600, useNativeDriver: true }),
      ]),
    ).start();

    startProcess();
  }, []);

  useEffect(() => {
    const listenerId = progressWidth.addListener(({ value }) => {
      setProgressPercent(Math.round(value));
    });

    return () => {
      progressWidth.removeListener(listenerId);
    };
  }, [progressWidth]);

  const animateProgressTo = (value: number, duration: number) =>
    new Promise<void>((resolve) => {
      Animated.timing(progressWidth, {
        toValue: value,
        duration,
        useNativeDriver: false,
      }).start(() => resolve());
    });

  const startProcess = async () => {
    setError(null);
    setIsDone(false);
    setAwaitingPlan(false);
    setActiveStep(0);
    progressWidth.setValue(0);

    try {
      const planPromise = onGeneratePlan();
      const perStepProgress = HOLDING_PROGRESS_PERCENT / insights.length;

      for (let i = 0; i < insights.length; i++) {
        setActiveStep(i);
        const targetProgress =
          i === insights.length - 1
            ? HOLDING_PROGRESS_PERCENT
            : Math.round((i + 1) * perStepProgress);
        await Promise.all([
          animateProgressTo(targetProgress, MANDATORY_STEP_MS),
          waitMs(MANDATORY_STEP_MS),
        ]);
      }

      setAwaitingPlan(true);
      const plan = await planPromise;
      if (!Array.isArray(plan) || plan.length === 0) {
        throw new Error('Your plan came back empty. Please try again.');
      }
      setAwaitingPlan(false);
      await animateProgressTo(COMPLETION_PROGRESS_PERCENT, 300);
      setActiveStep(insights.length);
      setIsDone(true);
      setGeneratedPlan(plan);
      setShowSummary(true);
    } catch (err: any) {
      setAwaitingPlan(false);
      setError(err?.message || 'Something went wrong. Please try again.');
    }
  };

  const title = error
    ? 'That didn\'t work'
    : isDone
      ? 'Your plan is ready'
      : awaitingPlan
        ? 'Almost there'
        : 'Building your plan';
  const subtitle = error
    ? 'Tap below to try again.'
    : isDone
      ? 'Here is your personalized roadmap.'
      : awaitingPlan
        ? 'Finishing up your plan.'
        : 'This only takes a moment.';

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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <LinearGradient
        colors={['#FFFFFF', '#FDFCFB', '#FEF9F9']}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.flex}>
        <View style={styles.content}>
          <View style={styles.topNav}>
            <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
              <ChevronLeft color={COLORS.black} size={22} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              isCompact && styles.scrollContentCompact,
            ]}
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.hero, isCompact && styles.heroCompact]}>
              <Animated.View
                style={[
                  styles.mascotWrap,
                  isCompact && styles.mascotWrapCompact,
                  { transform: [{ scale: mascotScale }] },
                ]}
              >
                <View style={[styles.mascotGlow, isCompact && styles.mascotGlowCompact]} />
                <Image
                  source={mascotSource}
                  style={[styles.mascot, isCompact && styles.mascotCompact]}
                  contentFit="contain"
                />
              </Animated.View>

              <View style={styles.miniTag}>
                <ClipboardList size={13} color={COLORS.coral} />
                <Text style={styles.miniTagText}>YOUR PLAN</Text>
              </View>
              <Text style={[styles.title, isCompact && styles.titleCompact]}>{title}</Text>
              <Text style={[styles.subtitle, isCompact && styles.subtitleCompact]}>{subtitle}</Text>
            </View>

            <View style={styles.stepList}>
              {insights.map((step, index) => {
                const isPending = activeStep < index;
                const isActive = activeStep === index;
                const isCompleted = activeStep > index;
                const Icon = step.icon;

                return (
                  <View
                    key={step.id}
                    style={[
                      styles.stepRow,
                      isActive && styles.stepRowActive,
                      isCompleted && styles.stepRowDone,
                    ]}
                  >
                    <View
                      style={[
                        styles.iconTile,
                        isActive && styles.iconTileActive,
                        isCompleted && styles.iconTileDone,
                      ]}
                    >
                      {isCompleted ? (
                        <Check color={COLORS.white} size={18} strokeWidth={3} />
                      ) : isActive ? (
                        <ActivityIndicator size="small" color={COLORS.coral} />
                      ) : (
                        <Icon color={COLORS.muted} size={20} strokeWidth={2.4} />
                      )}
                    </View>

                    <View style={styles.stepCopy}>
                      <Text
                        style={[
                          styles.stepLabel,
                          (isActive || isCompleted) && styles.stepLabelActive,
                        ]}
                      >
                        {step.label}
                      </Text>
                      {!isPending && <Text style={styles.stepValue}>{step.value}</Text>}
                    </View>
                  </View>
                );
              })}
            </View>

            {error && (
              <TouchableOpacity
                style={styles.retryBtn}
                activeOpacity={0.85}
                onPress={startProcess}
              >
                <LinearGradient
                  colors={[COLORS.coral, COLORS.coralDark]}
                  style={styles.retryGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.retryText}>Try again</Text>
                  <View style={styles.retryArrow}>
                    <ChevronRight color={COLORS.coral} size={18} strokeWidth={3} />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>
                {error ? 'Stopped' : isDone ? 'Done' : awaitingPlan ? 'Almost done' : 'Working on it'}
              </Text>
              <Text style={styles.progressPercent}>{progressPercent}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    width: progressWidth.interpolate({
                      inputRange: [0, 100],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            </View>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  flex: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 12 : 4,
    paddingBottom: Platform.OS === 'ios' ? 8 : 16,
  },

  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },

  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  scrollContentCompact: {
    paddingBottom: 16,
  },

  hero: {
    alignItems: 'flex-start',
    marginBottom: 28,
  },
  heroCompact: {
    marginBottom: 20,
  },
  mascotWrap: {
    alignSelf: 'center',
    width: 148,
    height: 148,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  mascotWrapCompact: {
    width: 120,
    height: 120,
    marginBottom: 14,
  },
  mascotGlow: {
    position: 'absolute',
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
  },
  mascotGlowCompact: {
    width: 108,
    height: 108,
    borderRadius: 54,
  },
  mascot: {
    width: 112,
    height: 112,
  },
  mascotCompact: {
    width: 92,
    height: 92,
  },
  miniTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  miniTagText: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.coral,
    letterSpacing: 1.2,
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    color: COLORS.black,
    lineHeight: 34,
    letterSpacing: -1,
  },
  titleCompact: {
    fontSize: 26,
    lineHeight: 30,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.muted,
    lineHeight: 22,
    marginTop: 8,
    maxWidth: 320,
  },
  subtitleCompact: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },

  stepList: {
    gap: 12,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  stepRowActive: {
    backgroundColor: COLORS.coralLight,
    shadowColor: COLORS.coral,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  stepRowDone: {
    opacity: 0.92,
  },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconTileActive: {
    backgroundColor: COLORS.white,
  },
  iconTileDone: {
    backgroundColor: COLORS.coral,
  },
  stepCopy: {
    flex: 1,
    gap: 2,
  },
  stepLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.muted,
  },
  stepLabelActive: {
    color: COLORS.black,
    fontWeight: '800',
  },
  stepValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.coral,
  },

  retryBtn: {
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    marginTop: 24,
    shadowColor: COLORS.coral,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 6,
  },
  retryGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 26,
    paddingRight: 8,
  },
  retryText: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  retryArrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
  },

  footer: {
    paddingTop: 16,
    gap: 10,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.black,
  },
  progressPercent: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.coral,
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.coral,
    borderRadius: 3,
  },
});
