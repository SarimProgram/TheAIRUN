import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Platform,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Image,
  Pressable,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Path, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowDown,
  Flame,
  Calendar,
  CalendarDays,
  ChartLine,
  Check,
  Footprints,
  Route,
  Sunrise,
  Sun,
  Sunset,
  RefreshCw,
  Pencil,
  ChevronLeft,
  Scale,
  Plus,
  CheckCircle2,
  Target,
  X,
  Dumbbell,
} from 'lucide-react-native';
import { useAuth } from '@/src/auth/authContext';
import { getGenderMascotSource, getWeeklyAvatarSource } from '@/utils/genderMascot';
import { useWeightLog } from '../../hooks/useWeightLog';
import { getMappedDays, getPlanWeekDateRange, getWeekLoggedWeightKg } from '../../utils/planProjection';
import { getSessionActivityKind, PlanSessionIcon } from './PlanSessionIcon';
import { getWeightJourneyStage, WeightJourneyCharacter } from './WeightJourneyCharacter';
import { CoachBrushStroke } from './PlanCoachArt';
import { usePlanColors } from './PlanVisuals';
import { type TrainingSchedule, workoutLabel } from '../../utils/trainingSchedule';
import { findPartnerWorkout } from './partnerWorkoutDefinitions';

type PlanGoalType = 'weightloss' | 'running' | 'both' | string | null;

function formatWeightValue(weightKg: number, usesImperial: boolean) {
  if (usesImperial) {
    return `${(weightKg * 2.20462).toFixed(1)} lbs`;
  }
  return `${weightKg.toFixed(1)} kg`;
}

function formatWeightLoss(lossKg: number, usesImperial: boolean) {
  const amount = usesImperial ? lossKg * 2.20462 : lossKg;
  const unit = usesImperial ? 'lbs' : 'kg';
  return `${amount.toFixed(1)} ${unit}`;
}

const WEIGHT_CHANGE_THRESHOLD_KG = 0.05;

type WeightProjectionDisplay = {
  action: string;
  value: string;
  showExpectedWeightSubtext: boolean;
};

function getWeightProjectionDisplay(
  week: WeekPlan,
  startingWeightKg: number | null | undefined,
  usesImperial: boolean,
): WeightProjectionDisplay | null {
  if (typeof startingWeightKg !== 'number' || !Number.isFinite(startingWeightKg)) return null;

  const expectedWeight = week['Expected weight'];
  if (typeof expectedWeight !== 'number' || !Number.isFinite(expectedWeight)) return null;

  const changeKg = startingWeightKg - expectedWeight;

  if (changeKg > WEIGHT_CHANGE_THRESHOLD_KG) {
    return {
      action: "you'll lose",
      value: formatWeightLoss(Number(changeKg.toFixed(1)), usesImperial),
      showExpectedWeightSubtext: true,
    };
  }

  if (changeKg < -WEIGHT_CHANGE_THRESHOLD_KG) {
    return {
      action: "you'll gain",
      value: formatWeightLoss(Number(Math.abs(changeKg).toFixed(1)), usesImperial),
      showExpectedWeightSubtext: true,
    };
  }

  return {
    action: "you'll weigh",
    value: formatWeightValue(expectedWeight, usesImperial),
    showExpectedWeightSubtext: false,
  };
}

type WeightWeekComparison = {
  hasLoggedWeight: boolean;
  expectedLossKg: number;
  actualLossKg: number;
  beatTarget: boolean;
};

function getWeightWeekComparison(
  startingWeightKg: number | null | undefined,
  expectedWeight: number,
  loggedWeightKg: number | null | undefined,
): WeightWeekComparison | null {
  if (typeof startingWeightKg !== 'number' || !Number.isFinite(startingWeightKg)) return null;
  if (typeof expectedWeight !== 'number' || !Number.isFinite(expectedWeight)) return null;
  if (typeof loggedWeightKg !== 'number' || !Number.isFinite(loggedWeightKg)) return null;

  const expectedLossKg = Number(Math.max(0, startingWeightKg - expectedWeight).toFixed(1));
  const actualLossKg = Number((startingWeightKg - loggedWeightKg).toFixed(1));

  return {
    hasLoggedWeight: true,
    expectedLossKg,
    actualLossKg,
    beatTarget: actualLossKg >= expectedLossKg,
  };
}

function parseWeightInputToKg(value: string, usesImperial: boolean) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return usesImperial ? parsed / 2.20462 : parsed;
}

function formatWeightInputValue(weightKg: number | null | undefined, usesImperial: boolean) {
  if (typeof weightKg !== 'number' || !Number.isFinite(weightKg)) return '';
  if (usesImperial) {
    return (weightKg * 2.20462).toFixed(1);
  }
  return weightKg.toFixed(1);
}

type WeightProjectionContentProps = {
  week: WeekPlan;
  startingWeightKg?: number | null;
  usesImperial: boolean;
  loggedWeightKg?: number | null;
  compareLoggedWeight: boolean;
  isLocked: boolean;
  variant?: 'card' | 'detail';
};

function WeightProjectionContent({
  week,
  startingWeightKg,
  usesImperial,
  loggedWeightKg,
  compareLoggedWeight,
  isLocked,
  variant = 'card',
}: WeightProjectionContentProps) {
  const c = usePlanColors();
  const expectedWeight = week['Expected weight'];
  const comparison =
    compareLoggedWeight &&
    typeof expectedWeight === 'number' &&
    Number.isFinite(expectedWeight)
      ? getWeightWeekComparison(startingWeightKg, expectedWeight, loggedWeightKg)
      : null;
  const projection = getWeightProjectionDisplay(week, startingWeightKg, usesImperial);
  const actionStyle = variant === 'detail' ? styles.detailHeroAction : styles.weightProjectionAction;
  const valueStyle = variant === 'detail' ? styles.detailHeroValue : styles.weightProjectionValue;
  const subStyle = variant === 'detail' ? styles.detailHeroSub : styles.weightProjectionSub;

  if (comparison?.hasLoggedWeight && comparison.expectedLossKg > WEIGHT_CHANGE_THRESHOLD_KG) {
    const actualIsGain = comparison.actualLossKg < -WEIGHT_CHANGE_THRESHOLD_KG;
    const resultColor = comparison.beatTarget ? (c.isFemale ? c.secondary : COLORS.success) : COLORS.danger;
    const ResultIcon = comparison.beatTarget ? CheckCircle2 : X;

    return (
      <>
        <Text style={[actionStyle, isLocked && styles.weightTextMuted]}>expected</Text>
        <Text
          style={[
            valueStyle,
            styles.weightExpectedStruck,
            isLocked && styles.weightProjectionValueLocked,
          ]}
        >
          {formatWeightLoss(comparison.expectedLossKg, usesImperial)}
        </Text>
        <Text style={[actionStyle, isLocked && styles.weightTextMuted]}>
          {actualIsGain ? 'gained' : 'lost'}
        </Text>
        <View style={styles.weightActualRow}>
          <ResultIcon size={variant === 'detail' ? 20 : 22} color={resultColor} strokeWidth={2.5} />
          <Text style={[valueStyle, { color: resultColor }]}>
            {formatWeightLoss(Math.abs(comparison.actualLossKg), usesImperial)}
          </Text>
        </View>
        <Text style={[subStyle, isLocked && styles.weightTextMuted]}>
          Weighing {formatWeightValue(loggedWeightKg as number, usesImperial)}
        </Text>
      </>
    );
  }

  return (
    <>
      <Text style={[actionStyle, isLocked && styles.weightTextMuted]}>
        {projection?.action ?? "you'll lose"}
      </Text>
      <Text style={[valueStyle, isLocked && styles.weightProjectionValueLocked]}>
        {projection?.value ?? '—'}
      </Text>
      {projection?.showExpectedWeightSubtext &&
      typeof expectedWeight === 'number' &&
      Number.isFinite(expectedWeight) ? (
        <Text style={[subStyle, isLocked && styles.weightTextMuted]}>
          Weighing about {formatWeightValue(expectedWeight, usesImperial)}
        </Text>
      ) : null}
    </>
  );
}

function isWeightFocusedGoal(goalType?: PlanGoalType) {
  return goalType === 'weightloss' || goalType === 'both';
}

type WeekDailys = {
  trainingSchedule?: TrainingSchedule;
  workoutDays?: number;
  stepDays: number;
  runDays: number;
  recoveryDays: number;
  runs: Array<{ runType: string; sessions: number; targetKm?: number }>;
};

export type WeekPlan = {
  Week: number;
  "Calories/day": number;
  "Protein/day": number;
  "Steps/day target": number;
  "Run km/week": number;
  "Expected weight": number;
  "Week name": string;
  "Week Dailys": WeekDailys;
};

type TrainingTimePreference = 'morning' | 'afternoon' | 'evening';
type LegacyTrainingTimePreference = TrainingTimePreference | 'night';
type ManualAdjustDirection =
  | 'easier'
  | 'harder'
  | 'less_food_less_move'
  | 'more_food_more_move';

export type { ManualAdjustDirection };

export type PlanWeeklyTabProps = {
  weeklyPlan: WeekPlan[];
  planWeekToday: number;
  planStartDate?: Date | null;

  selectedWeek: WeekPlan | null;
  onSelectWeek: (week: WeekPlan | null) => void;

  goalType?: PlanGoalType;
  startingWeightKg?: number | null;
  targetWeightKg?: number | null;
  usesImperial?: boolean;
  gender?: string | null;

  loading?: boolean;
  onRegeneratePlan?: () => void;
  onResetPlan?: () => void;
  devPrompt?: string | null;
  regenerating?: boolean;
  availableDays?: number[];
  onChangeScheduleDays?: (days: number[]) => void | Promise<void>;
  scheduleUpdating?: boolean;
  trainingTimePreference?: 'morning' | 'afternoon' | 'evening' | 'night';
  onChangeTrainingTimePreference?: (time: 'morning' | 'afternoon' | 'evening') => void;
  onAdjustPlanManually?: (direction: ManualAdjustDirection) => Promise<void>;
  adjusting?: boolean;
  onClose?: () => void;
  onSelectSessionDay?: (weekNumber: number, dayIdx: number) => void;
};

const PLAN_FEEL_OPTIONS: Array<{
  id: ManualAdjustDirection;
  title: string;
  description: string;
}> = [
  {
    id: 'easier',
    title: 'Plan feels too hard',
    description: 'Lower calories and ease training volume',
  },
  {
    id: 'harder',
    title: 'I can handle more',
    description: 'Raise calories and add more activity',
  },
  {
    id: 'less_food_less_move',
    title: 'Eat less, move less',
    description: 'Lower calories and steps together — same weight-loss pace',
  },
  {
    id: 'more_food_more_move',
    title: 'Eat more, move more',
    description: 'Raise calories and steps together — same weight-loss pace',
  },
];

const DAY_OPTIONS = [
  { id: 0, label: 'Mon' },
  { id: 1, label: 'Tue' },
  { id: 2, label: 'Wed' },
  { id: 3, label: 'Thu' },
  { id: 4, label: 'Fri' },
  { id: 5, label: 'Sat' },
  { id: 6, label: 'Sun' },
];

const TIME_OPTIONS = [
  { id: 'morning', label: 'Morning', icon: Sunrise },
  { id: 'afternoon', label: 'Afternoon', icon: Sun },
  { id: 'evening', label: 'Evening', icon: Sunset },
] as const;

const COLORS = {
  primary: '#FF6B6B',
  primaryFade: 'rgba(255, 107, 107, 0.08)',
  primarySoft: 'rgba(255, 107, 107, 0.14)',
  bg: '#FAFAFA',
  textMain: '#2D3436',
  textSub: '#636E72',
  line: '#E0E0E0',
  locked: '#B2BEC3',
  success: '#16A34A',
  danger: '#DC2626',
  rail: '#DDE4E1',
  teal: '#25887F',
  blob: '#FFF0ED',
  card: '#FFFFFF',
  ink: '#1F2427',
};

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const HERO_VISIBLE_UNTIL_WEEK = 3;
const PAGE_BG = '#F6F7F5';
const HERO_TOP = '#FFFFFF';
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const WEEK_ART = [
  require('../../assets/plan/week-sneaker.png'),
  require('../../assets/plan/week-dumbbell.png'),
  require('../../assets/plan/week-salad.png'),
  require('../../assets/plan/week-bottle.png'),
];
const WEEK_ART_FINAL = require('../../assets/plan/week-trophy.png');

function getWeekArt(weekNumber: number, totalWeeks: number) {
  if (weekNumber === totalWeeks) return WEEK_ART_FINAL;
  return WEEK_ART[(weekNumber - 1) % WEEK_ART.length];
}

function formatWeeklyChange(changeKg: number, usesImperial: boolean) {
  if (usesImperial) return `${(changeKg * 2.20462).toFixed(1)} lbs`;
  return `${Number(changeKg.toFixed(2))} kg`;
}

function getWeeklyWeightDelta(
  week: WeekPlan,
  previousWeek: WeekPlan | undefined,
  startingWeightKg: number | null | undefined,
) {
  const expected = week['Expected weight'];
  const previous = previousWeek?.['Expected weight'] ?? startingWeightKg;
  if (typeof expected !== 'number' || !Number.isFinite(expected)) return null;
  if (typeof previous !== 'number' || !Number.isFinite(previous)) return null;
  return previous - expected;
}

function PressableScale({
  children,
  style,
  disabled,
  onPress,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => scale.set(withTiming(0.97, { duration: 120, easing: EASE_OUT }))}
      onPressOut={() => scale.set(withSpring(1, { duration: 400, dampingRatio: 1 }))}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}

type WeekState = 'completed' | 'current' | 'upcoming' | 'locked';

function TimelineNode({ state }: { state: WeekState }) {
  const styles = useWeeklyStyles();
  if (state === 'completed') {
    return (
      <View style={[styles.nodeBase, styles.nodeCompleted]}>
        <Check size={16} color="#FFF" strokeWidth={3.25} />
      </View>
    );
  }
  if (state === 'current') {
    return (
      <View style={styles.nodeCurrentWrap}>
        <View style={[styles.nodeBase, styles.nodeCurrent]}>
          <View style={styles.nodeCurrentDot} />
        </View>
      </View>
    );
  }
  if (state === 'locked') {
    return (
      <View style={[styles.nodeBase, styles.nodeLocked]} />
    );
  }
  return <View style={[styles.nodeBase, styles.nodeUpcoming]} />;
}

function HeroMascot({ gender, stage }: { gender?: string | null; stage?: number }) {
  return (
    <View pointerEvents="none" style={styles.heroMascotWrap}>
      {stage == null ? <CoachBrushStroke gender={gender} /> : null}
      {stage != null ? (
        <WeightJourneyCharacter gender={gender} stage={stage} pose="standing" width={156} height={218} />
      ) : (
        <Image source={getGenderMascotSource(gender)} style={styles.heroMascot} resizeMode="contain" />
      )}
    </View>
  );
}

function CurrentWeekMascot({ gender, compact, stage }: { gender?: string | null; compact: boolean; stage?: number }) {
  return (
    <View pointerEvents="none" style={[styles.cardMascotWrap, compact && styles.cardMascotWrapCompact]}>
      {stage == null ? <CoachBrushStroke gender={gender} /> : null}
      {stage != null ? (
        <WeightJourneyCharacter gender={gender} stage={stage} width={compact ? 64 : 78} height={96} />
      ) : (
        <Image source={getWeeklyAvatarSource(gender)} style={[styles.cardMascot, compact && styles.cardMascotCompact]} resizeMode="contain" />
      )}
    </View>
  );
}

const CHART_HEIGHT = 108;
const CHART_PAD_X = 8;
const CHART_PAD_Y = 10;

function buildSmoothPath(points: { x: number; y: number }[]) {
  if (points.length === 0) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const point = points[i];
    const midX = (prev.x + point.x) / 2;
    d += ` C ${midX} ${prev.y}, ${midX} ${point.y}, ${point.x} ${point.y}`;
  }
  return d;
}

function JourneyChart({
  values,
  currentIndex,
}: {
  values: number[];
  currentIndex: number;
}) {
  const [width, setWidth] = React.useState(0);
  const reveal = useSharedValue(0);

  React.useEffect(() => {
    if (width === 0) return;
    reveal.set(withDelay(300, withTiming(width, { duration: 1100, easing: EASE_OUT })));
  }, [reveal, width]);

  const revealStyle = useAnimatedStyle(() => ({ width: reveal.get() }));

  const points = React.useMemo(() => {
    if (width === 0 || values.length < 2) return [];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const innerW = width - CHART_PAD_X * 2;
    const innerH = CHART_HEIGHT - CHART_PAD_Y * 2;
    return values.map((value, index) => ({
      x: CHART_PAD_X + (index / (values.length - 1)) * innerW,
      y: CHART_PAD_Y + (1 - (value - min) / range) * innerH,
    }));
  }, [values, width]);

  const linePath = buildSmoothPath(points);
  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x} ${CHART_HEIGHT} L ${points[0].x} ${CHART_HEIGHT} Z`
      : '';
  const currentPoint = currentIndex < 0 ? null : points[Math.min(currentIndex, points.length - 1)];

  return (
    <View style={styles.chartCanvas} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {points.length > 0 ? (
        <>
          <Animated.View style={[styles.chartReveal, revealStyle]}>
            <Svg width={width} height={CHART_HEIGHT}>
              <Defs>
                <SvgLinearGradient id="journeyArea" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={COLORS.primary} stopOpacity={0.2} />
                  <Stop offset="1" stopColor={COLORS.primary} stopOpacity={0} />
                </SvgLinearGradient>
              </Defs>
              <Path d={areaPath} fill="url(#journeyArea)" />
              <Path d={linePath} stroke={COLORS.primary} strokeWidth={2.5} fill="none" strokeLinecap="round" />
              {points.map((point, index) => {
                const reached = index <= currentIndex;
                return (
                  <Circle
                    key={index}
                    cx={point.x}
                    cy={point.y}
                    r={index === currentIndex ? 0 : 3}
                    fill={reached ? COLORS.primary : '#FFF'}
                    stroke={COLORS.primary}
                    strokeWidth={reached ? 0 : 1.5}
                  />
                );
              })}
            </Svg>
          </Animated.View>
          {currentPoint ? (
            <Animated.View
              entering={FadeIn.duration(300).delay(1100)}
              pointerEvents="none"
              style={[styles.chartCurrentDot, { left: currentPoint.x - 15, top: currentPoint.y - 15 }]}
            >
              <View style={styles.chartCurrentDotInner} />
            </Animated.View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

export function PlanWeeklyTab({
  weeklyPlan,
  planWeekToday,
  planStartDate = null,
  selectedWeek,
  onSelectWeek,
  goalType,
  startingWeightKg,
  targetWeightKg,
  usesImperial = false,
  gender,
  loading,
  onRegeneratePlan,
  onResetPlan,
  devPrompt,
  regenerating,
  availableDays = [],
  onChangeScheduleDays,
  scheduleUpdating,
  trainingTimePreference = 'morning',
  onChangeTrainingTimePreference,
  onAdjustPlanManually,
  adjusting,
  onClose,
  onSelectSessionDay,
}: PlanWeeklyTabProps) {
  const c = usePlanColors(gender);
  const styles = useWeeklyStyles(gender);
  const { authFetch, isAuthenticated } = useAuth();
  const {
    currentWeightKg,
    weightHistory,
    logging: loggingWeight,
    logWeight,
  } = useWeightLog({ authFetch, isAuthenticated });
  const normalizeTrainingTimePreference = React.useCallback((time: LegacyTrainingTimePreference): TrainingTimePreference => {
    if (time === 'morning' || time === 'afternoon' || time === 'evening') return time;
    return 'evening';
  }, []);
  const [showEditPlanSheet, setShowEditPlanSheet] = React.useState(false);
  const [showDevPrompt, setShowDevPrompt] = React.useState(false);
  const [selectedAdjustment, setSelectedAdjustment] = React.useState<ManualAdjustDirection | null>(null);
  const [draftAvailableDays, setDraftAvailableDays] = React.useState<number[]>(availableDays);
  const [draftTrainingTimePreference, setDraftTrainingTimePreference] = React.useState<TrainingTimePreference>(
    normalizeTrainingTimePreference(trainingTimePreference)
  );
  const [weightModalOpen, setWeightModalOpen] = React.useState(false);
  const [weightInput, setWeightInput] = React.useState('');
  const pageScrollRef = React.useRef<ScrollView>(null);
  const weekListTopRef = React.useRef(0);
  const weekOffsetsRef = React.useRef<Record<number, number>>({});
  const viewportHeightRef = React.useRef(0);
  const pageBodyTopRef = React.useRef(0);

  const scrollToCurrentWeek = React.useCallback(() => {
    if (planWeekToday <= HERO_VISIBLE_UNTIL_WEEK) return;
    const rowY = weekOffsetsRef.current[planWeekToday];
    if (rowY == null) return;
    const offset = pageBodyTopRef.current + weekListTopRef.current + rowY;
    requestAnimationFrame(() => {
      pageScrollRef.current?.scrollTo({
        y: Math.max(0, offset - viewportHeightRef.current * 0.3),
        animated: false,
      });
    });
  }, [planWeekToday]);

  React.useEffect(() => {
    if (weeklyPlan.length === 0) return;
    scrollToCurrentWeek();
  }, [weeklyPlan.length, scrollToCurrentWeek]);

  React.useEffect(() => {
    setDraftAvailableDays(availableDays);
  }, [availableDays]);

  React.useEffect(() => {
    setDraftTrainingTimePreference(normalizeTrainingTimePreference(trainingTimePreference));
  }, [trainingTimePreference, normalizeTrainingTimePreference]);

  const toggleDay = (day: number) => {
    setDraftAvailableDays((prev) => {
      const exists = prev.includes(day);
      if (exists && prev.length <= (weeklyPlan[0]?.['Week Dailys'].trainingSchedule ? 1 : 3)) return prev;
      return exists ? prev.filter((item) => item !== day) : [...prev, day].sort((a, b) => a - b);
    });
  };

  const handleSaveScheduleAndTime = async () => {
    const required = weeklyPlan[0]?.['Week Dailys'].trainingSchedule?.sessions.length;
    if (required ? draftAvailableDays.length !== required : draftAvailableDays.length < 3) return;
    await onChangeScheduleDays?.(draftAvailableDays);
    onChangeTrainingTimePreference?.(draftTrainingTimePreference);
    setShowEditPlanSheet(false);
  };

  const handleApplyPlanChanges = async () => {
    if (!selectedAdjustment || !onAdjustPlanManually) return;
    try {
      await onAdjustPlanManually(selectedAdjustment);
      setSelectedAdjustment(null);
      setShowEditPlanSheet(false);
    } catch {
      // Parent shows alert on failure.
    }
  };

  const openEditPlanSheet = () => {
    setDraftAvailableDays(availableDays);
    setDraftTrainingTimePreference(normalizeTrainingTimePreference(trainingTimePreference));
    setSelectedAdjustment(null);
    setShowEditPlanSheet(true);
  };

  const sheetBusy = !!scheduleUpdating || !!adjusting || !!regenerating;
  const requiredTrainingDays = weeklyPlan[0]?.['Week Dailys'].trainingSchedule?.sessions.length;
  const canSaveScheduleAndTime = (requiredTrainingDays ? draftAvailableDays.length === requiredTrainingDays : draftAvailableDays.length >= 3) && !sheetBusy;
  const canApplyPlanChanges = !!selectedAdjustment && !!onAdjustPlanManually && !sheetBusy;

  const getTimeLabel = (time: LegacyTrainingTimePreference) => {
    const normalizedTime = normalizeTrainingTimePreference(time);
    if (normalizedTime === 'afternoon') return 'Afternoon';
    if (normalizedTime === 'evening') return 'Evening';
    return 'Morning';
  };

  const getTimeAccent = (_time: LegacyTrainingTimePreference) => COLORS.primary;

  const normalizedTrainingTimePreference = normalizeTrainingTimePreference(trainingTimePreference);
  const TimeIcon = TIME_OPTIONS.find((option) => option.id === normalizedTrainingTimePreference)?.icon ?? Sunrise;
  const showWeightGoalLayout = isWeightFocusedGoal(goalType);
  const totalWeeks = weeklyPlan.length;
  const lastWeek = weeklyPlan[totalWeeks - 1];
  const journeyEndWeightKg = targetWeightKg ?? lastWeek?.['Expected weight'] ?? null;

  const journeyStats = React.useMemo(() => {
    const totalLossKg =
      typeof startingWeightKg === 'number' &&
      typeof journeyEndWeightKg === 'number' &&
      Number.isFinite(startingWeightKg) &&
      Number.isFinite(journeyEndWeightKg)
        ? Math.max(0, Number((startingWeightKg - journeyEndWeightKg).toFixed(1)))
        : null;
    const progress =
      totalWeeks > 1
        ? Math.min(1, Math.max(0, (planWeekToday - 1) / (totalWeeks - 1)))
        : totalWeeks === 1
          ? 1
          : 0;

    return { totalLossKg, progress };
  }, [planWeekToday, journeyEndWeightKg, startingWeightKg, totalWeeks]);

  const currentWeekPlan = weeklyPlan.find((week) => week.Week === planWeekToday) ?? null;
  const hasWeightNumbers =
    showWeightGoalLayout && typeof startingWeightKg === 'number' && Number.isFinite(startingWeightKg);

  const weekCharacterStages = React.useMemo(() => {
    let previousStage = -1;
    return weeklyPlan.map((week, index) => {
      const stage = getWeightJourneyStage(startingWeightKg, journeyEndWeightKg, week['Expected weight']);
      const hasCharacter = (index < weeklyPlan.length - 1 || index === 0) && (index % 4 === 0 || index % 4 === 3);
      if (!hasCharacter) return stage;
      // Nearby projections can round to the same sprite; vary the next pose by one stage.
      const artStage = stage === previousStage ? (stage < 9 ? stage + 1 : 8) : stage;
      previousStage = artStage;
      return artStage;
    });
  }, [journeyEndWeightKg, startingWeightKg, weeklyPlan]);

  const heroStats = React.useMemo(() => {
    if (hasWeightNumbers) {
      return [
        {
          key: 'start',
          label: 'Start',
          value: formatWeightValue(startingWeightKg as number, usesImperial),
          Icon: Scale,
        },
        {
          key: 'target',
          label: 'Target',
          value: typeof journeyEndWeightKg === 'number' ? formatWeightValue(journeyEndWeightKg, usesImperial) : '—',
          Icon: Target,
        },
        {
          key: 'loss',
          label: 'Total Loss',
          value: journeyStats.totalLossKg != null ? formatWeightLoss(journeyStats.totalLossKg, usesImperial) : '—',
          Icon: ArrowDown,
        },
      ];
    }
    const totalKm = weeklyPlan.reduce((sum, week) => sum + (Number(week['Run km/week']) || 0), 0);
    return [
      {
        key: 'week',
        label: 'This week',
        value: currentWeekPlan ? `${currentWeekPlan['Run km/week']} km` : '—',
        Icon: Footprints,
      },
      { key: 'total', label: 'Total', value: `${Math.round(totalKm)} km`, Icon: Route },
      {
        key: 'left',
        label: 'Weeks left',
        value: `${Math.max(0, totalWeeks - planWeekToday)}`,
        Icon: CalendarDays,
      },
    ];
  }, [
    currentWeekPlan,
    hasWeightNumbers,
    journeyEndWeightKg,
    journeyStats.totalLossKg,
    planWeekToday,
    startingWeightKg,
    totalWeeks,
    usesImperial,
    weeklyPlan,
  ]);

  const chartValues = React.useMemo(() => {
    if (hasWeightNumbers) {
      return [startingWeightKg as number, ...weeklyPlan.map((week) => week['Expected weight'])].filter(
        (value) => typeof value === 'number' && Number.isFinite(value),
      );
    }
    return weeklyPlan.map((week) => Number(week['Run km/week']) || 0);
  }, [hasWeightNumbers, startingWeightKg, weeklyPlan]);

  const { width: windowWidth } = useWindowDimensions();
  const compact = windowWidth < 360;
  const insets = useSafeAreaInsets();
  const heroSubtitle =
    goalType === 'both'
      ? `${totalWeeks}-week run & weight journey`
      : showWeightGoalLayout
        ? `${totalWeeks}-week weight loss journey`
        : `${totalWeeks}-week running journey`;
  const chartCurrentIndex = hasWeightNumbers ? -1 : planWeekToday - 1;
  const chartSummary = hasWeightNumbers
    ? `${formatWeightInputValue(startingWeightKg, usesImperial)} → ${
        typeof journeyEndWeightKg === 'number' ? formatWeightValue(journeyEndWeightKg, usesImperial) : '—'
      }`
    : `${chartValues[0] ?? 0} → ${chartValues[chartValues.length - 1] ?? 0} km/wk`;

  const openWeightModal = React.useCallback(() => {
    setWeightInput(formatWeightInputValue(currentWeightKg, usesImperial));
    setWeightModalOpen(true);
  }, [currentWeightKg, usesImperial]);

  const handleLogWeight = React.useCallback(async () => {
    const weightKg = parseWeightInputToKg(weightInput, usesImperial);
    if (weightKg == null) {
      Alert.alert('Invalid weight', 'Enter a valid weight to continue.');
      return;
    }

    try {
      await logWeight(weightKg);
      setWeightModalOpen(false);
    } catch {
      Alert.alert('Error', 'Failed to log weight');
    }
  }, [logWeight, usesImperial, weightInput]);

  const selectedWeekLoggedWeightKg = React.useMemo(() => {
    if (!selectedWeek) return null;
    return getWeekLoggedWeightKg(weightHistory, planStartDate, selectedWeek.Week);
  }, [selectedWeek, weightHistory, planStartDate]);

  const renderWeekCard = (week: WeekPlan, index: number) => {
    const isActive = week.Week === planWeekToday;
    const isCompleted = week.Week < planWeekToday;
    const isLocked = week.Week > planWeekToday + 1;
    const state: WeekState = isActive ? 'current' : isCompleted ? 'completed' : isLocked ? 'locked' : 'upcoming';
    const isFirst = index === 0;
    const isLast = index === weeklyPlan.length - 1;
    // One opening character, then alternate pairs of icons and characters.
    const showJourneyCharacter = hasWeightNumbers && (!isLast || isFirst) && (index % 4 === 0 || index % 4 === 3);
    const iconIndex = Math.floor(index / 4) * 2 + (index % 4) - 1;
    const weekArt = hasWeightNumbers && !isLast
      ? WEEK_ART[Math.max(0, iconIndex) % WEEK_ART.length]
      : getWeekArt(week.Week, totalWeeks);
    const runCount = getMappedDays(week, availableDays).filter((day) => day.type === 'RUN').length;
    const weekLoggedWeightKg = getWeekLoggedWeightKg(weightHistory, planStartDate, week.Week);

    let headline = `Run ${week['Run km/week']} km`;
    let subLabel = `${runCount} ${runCount === 1 ? 'run' : 'runs'} · `;
    let subValue = `${week['Steps/day target'].toLocaleString()} steps/day`;
    if (hasWeightNumbers) {
      const delta = getWeeklyWeightDelta(week, weeklyPlan[index - 1], startingWeightKg);
      if (delta != null && delta > WEIGHT_CHANGE_THRESHOLD_KG) {
        headline = `Lose ${formatWeeklyChange(delta, usesImperial)}`;
      } else if (delta != null && delta < -WEIGHT_CHANGE_THRESHOLD_KG) {
        headline = `Gain ${formatWeeklyChange(Math.abs(delta), usesImperial)}`;
      } else {
        headline = 'Hold steady';
      }
      subLabel = compact ? 'Projected: ' : 'Projected weight: ';
      subValue = formatWeightValue(week['Expected weight'], usesImperial);
    }

    const loggedResult =
      hasWeightNumbers && weekLoggedWeightKg != null
        ? {
            onTrack: weekLoggedWeightKg <= week['Expected weight'] + WEIGHT_CHANGE_THRESHOLD_KG,
            logged: formatWeightValue(weekLoggedWeightKg, usesImperial),
            gap: formatWeightLoss(Math.abs(weekLoggedWeightKg - week['Expected weight']), usesImperial),
          }
        : null;

    const weekStart = planStartDate ? getPlanWeekDateRange(planStartDate, week.Week).start : null;
    const baselineLog = weekStart ? weightHistory
      .filter((point) => Number.isFinite(point.weightKg) && new Date(point.loggedAt) < weekStart)
      .sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime())[0] : null;
    const baseline = baselineLog?.weightKg ?? (index === 0 ? startingWeightKg : null);
    const targetLoss = getWeeklyWeightDelta(week, weeklyPlan[index - 1], startingWeightKg);
    const weeklyProgress = typeof baseline === 'number' && weekLoggedWeightKg != null && targetLoss != null && targetLoss > 0
      ? Math.min(1, Math.max(0, (baseline - weekLoggedWeightKg) / targetLoss)) : 0;

    return (
      <Animated.View
        key={week.Week}
        entering={FadeInDown.duration(420)
          .delay(220 + Math.min(index, 8) * 55)
          .easing(EASE_OUT)}
        style={styles.timelineRow}
        onLayout={(event) => {
          weekOffsetsRef.current[week.Week] = event.nativeEvent.layout.y;
          if (week.Week === planWeekToday) {
            scrollToCurrentWeek();
          }
        }}
      >
        <View style={styles.timelineRail}>
          <View
            style={[
              styles.railSegment,
              isFirst && styles.railSegmentHidden,
              week.Week <= planWeekToday && styles.railSegmentReached,
            ]}
          />
          <TimelineNode state={state} />
          <View
            style={[
              styles.railSegment,
              isLast && styles.railSegmentHidden,
              week.Week < planWeekToday && styles.railSegmentReached,
            ]}
          />
        </View>

        <PressableScale
          disabled={isLocked}
          accessibilityLabel={`Week ${week.Week}, ${headline}${isLocked ? ', locked' : ''}`}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            onSelectWeek(week);
          }}
          style={[styles.weekCard, isActive && styles.weekCardActive, isLocked && styles.weekCardLocked]}
        >
          {isActive ? <Text style={styles.currentBadge}>Current</Text> : null}
          <View style={styles.weekCardTop}>
            <View style={styles.weekCardCopy}>
              <View style={[styles.weekPill, isActive && styles.weekPillActive]}>
                <Text style={[styles.weekPillText, isActive && styles.weekPillTextActive]}>Week {week.Week}</Text>
              </View>
              <Text
                style={[styles.weekHeadline, isActive && styles.weekHeadlineActive, compact && styles.weekHeadlineCompact]}
                numberOfLines={1}
              >
                {headline}
              </Text>
              {hasWeightNumbers ? (
                <View style={styles.projectedWeightBlock}>
                  <Text style={styles.projectedWeightLabel}>Projected weight</Text>
                  <Text selectable style={[styles.projectedWeightValue, isActive && styles.projectedWeightValueActive]}>{subValue}</Text>
                </View>
              ) : (
                <Text style={styles.weekSub}>{subLabel}<Text style={styles.weekSubStrong}>{subValue}</Text></Text>
              )}

            </View>

            {isActive && (!hasWeightNumbers || showJourneyCharacter) ? (
              <CurrentWeekMascot gender={gender} compact={compact} stage={hasWeightNumbers ? weekCharacterStages[index] : undefined} />
            ) : showJourneyCharacter ? (
              <WeightJourneyCharacter gender={gender} stage={weekCharacterStages[index]} width={70} height={92} />
            ) : (
              <Image source={weekArt} style={styles.weekArt} resizeMode="contain" />
            )}
          </View>

          {isActive && hasWeightNumbers ? (
            <View style={styles.weekProgressRow}>
              <Text style={styles.weekProgressLabel}>Progress</Text>
              <View accessibilityRole="progressbar" accessibilityLabel="Weekly weight progress" accessibilityValue={{ min: 0, max: 100, now: Math.round(weeklyProgress * 100) }} style={styles.weekProgressTrack}><View style={[styles.weekProgressFill, { width: `${weeklyProgress * 100}%` }]} /></View>
              <Text style={styles.weekProgressValue}>{Math.round(weeklyProgress * 100)}%</Text>
            </View>
          ) : null}
          {isActive && hasWeightNumbers && (weekLoggedWeightKg == null || baseline == null) ? <Text style={styles.weekProgressHint}>{weekLoggedWeightKg == null ? 'Log your weight in week details to track progress' : 'A previous weigh-in is needed to measure weekly change'}</Text> : null}

          {loggedResult ? (
            <View style={[styles.loggedChip, loggedResult.onTrack ? styles.loggedChipGood : styles.loggedChipBad]}>
              {loggedResult.onTrack ? (
                <CheckCircle2 size={14} color={c.isFemale ? c.secondary : COLORS.success} strokeWidth={2.5} />
              ) : (
                <X size={14} color={COLORS.danger} strokeWidth={2.5} />
              )}
              <Text style={[styles.loggedChipText, { color: loggedResult.onTrack ? (c.isFemale ? c.secondary : COLORS.success) : COLORS.danger }]}>
                {loggedResult.onTrack
                  ? `On track · logged ${loggedResult.logged}`
                  : `${loggedResult.gap} above plan · logged ${loggedResult.logged}`}
              </Text>
            </View>
          ) : null}
        </PressableScale>
      </Animated.View>
    );
  };

  return (
    <View style={styles.pageRoot}>
      <View style={styles.pageHeader}>
        <View style={styles.pageHeaderRow}>
          {onClose ? (
            <TouchableOpacity
              onPress={onClose}
              style={styles.pageHeaderIconBtn}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <ChevronLeft size={24} color={COLORS.ink} />
            </TouchableOpacity>
          ) : (
            <View style={styles.pageHeaderIconSpacer} />
          )}

          <View style={styles.pageHeaderTitleWrap}>
            <Text style={styles.pageHeaderTitle}>Weekly Plan</Text>
          </View>

          {weeklyPlan.length > 0 ? (
            <TouchableOpacity
              onPress={openEditPlanSheet}
              style={styles.pageHeaderIconBtn}
              disabled={sheetBusy}
              activeOpacity={0.85}
              accessibilityLabel="Edit plan"
            >
              <Pencil size={18} color={COLORS.textMain} />
            </TouchableOpacity>
          ) : (
            <View style={styles.pageHeaderIconSpacer} />
          )}
        </View>
      </View>

      <ScrollView
        ref={pageScrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.pageScrollContent, { paddingBottom: Math.max(insets.bottom, 24) }]}
        onLayout={(event) => {
          viewportHeightRef.current = event.nativeEvent.layout.height;
        }}
      >
        {!loading && totalWeeks > 0 ? (
          <>
            <View style={styles.hero}>
              <LinearGradient
                colors={c.isFemale ? [HERO_TOP, '#FFFAFB', '#FFF8F9'] : [HERO_TOP, '#FAFBFA', PAGE_BG]}
                locations={[0, 0.5, 1]}
                style={StyleSheet.absoluteFill}
              />
              <HeroMascot gender={gender} stage={hasWeightNumbers ? getWeightJourneyStage(startingWeightKg, journeyEndWeightKg, currentWeightKg ?? startingWeightKg) : undefined} />
              <Animated.View entering={FadeInDown.duration(500).easing(EASE_OUT)} style={styles.heroCopy}>
                <Text style={styles.durationPill}>{totalWeeks}-Week</Text>
                <Text style={[styles.heroTitle, compact && { fontSize: 25, lineHeight: 29 }]}>{showWeightGoalLayout ? 'Weight Loss Plan' : 'Your Running Plan'}</Text>
                <Text style={styles.heroSubtitle} numberOfLines={2}>
                  {hasWeightNumbers && journeyStats.totalLossKg != null ? `Lose ${formatWeeklyChange(journeyStats.totalLossKg / Math.max(1, totalWeeks), usesImperial)} / week on average` : heroSubtitle}
                </Text>
              </Animated.View>
            </View>

            <Animated.View
              entering={FadeInDown.duration(480).delay(120).easing(EASE_OUT)}
              style={styles.statsCard}
            >
              {heroStats.map((stat, statIndex) => (
                <React.Fragment key={stat.key}>
                  {statIndex > 0 ? <View style={styles.statsDivider} /> : null}
                  <View style={styles.statItemNew}>
                    <View style={styles.statLabelRow}>
                      {!compact ? <stat.Icon size={13} color={COLORS.textSub} strokeWidth={2.25} /> : null}
                      <Text style={[styles.statLabelNew, compact && styles.statLabelCompact]} numberOfLines={1}>
                        {stat.label}
                      </Text>
                    </View>
                    <Text
                      style={[styles.statValueNew, compact && styles.statValueCompact]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >
                      {stat.value}
                    </Text>
                  </View>
                </React.Fragment>
              ))}
            </Animated.View>
          </>
        ) : null}

        <View
          style={styles.pageBody}
          onLayout={(event) => {
            pageBodyTopRef.current = event.nativeEvent.layout.y;
            scrollToCurrentWeek();
          }}
        >
          {loading ? (
            <View style={styles.loadingBlock}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.loadingText}>Loading your plan...</Text>
            </View>
          ) : (
            <>
              {weeklyPlan.length === 0 ? (
                <View style={styles.emptyPlanCard}>
                  <View style={styles.emptyPlanIcon}>
                    <Calendar size={24} color={COLORS.primary} />
                  </View>
                  <Text style={styles.emptyPlanTitle}>No weekly plan yet</Text>
                  <Text style={styles.emptyPlanText}>
                    Generate your plan to see each week, projected progress, and every run laid out ahead.
                  </Text>
                  {onRegeneratePlan ? (
                    <TouchableOpacity
                      style={styles.emptyPlanButton}
                      onPress={onRegeneratePlan}
                      disabled={regenerating || scheduleUpdating}
                      activeOpacity={0.85}
                    >
                      {regenerating ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <>
                          <RefreshCw size={16} color="#FFF" />
                          <Text style={styles.emptyPlanButtonText}>Generate Weekly Plan</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : (
                <>
                  <View
                    style={styles.weekList}
                    onLayout={(event) => {
                      weekListTopRef.current = event.nativeEvent.layout.y;
                      scrollToCurrentWeek();
                    }}
                  >
                    {weeklyPlan.map((week, index) => renderWeekCard(week, index))}
                  </View>
                </>

              )}

              {__DEV__ && onRegeneratePlan ? (
                <View style={styles.devActionRow}>
                  <View style={styles.devActionStack}>
                    <TouchableOpacity
                      style={styles.devRegenBtn}
                      onPress={onRegeneratePlan}
                      disabled={regenerating || scheduleUpdating}
                      activeOpacity={0.8}
                    >
                      {regenerating ? (
                        <ActivityIndicator size="small" color={COLORS.primary} />
                      ) : (
                        <>
                          <RefreshCw size={12} color={COLORS.primary} />
                          <Text style={styles.devRegenText}>Dev: Regenerate Plan</Text>
                        </>
                      )}
                    </TouchableOpacity>

                    {devPrompt ? (
                      <TouchableOpacity
                        style={styles.devPromptToggle}
                        onPress={() => setShowDevPrompt((prev) => !prev)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.devPromptToggleText}>
                          {showDevPrompt ? 'Hide Prompt' : 'Show Prompt'}
                        </Text>
                      </TouchableOpacity>
                    ) : null}

                    {showDevPrompt && devPrompt ? (
                      <View style={styles.devPromptCard}>
                        <Text style={styles.devPromptLabel}>Latest Plan Prompt</Text>
                        <ScrollView
                          style={styles.devPromptScroll}
                          contentContainerStyle={styles.devPromptScrollContent}
                          nestedScrollEnabled
                        >
                          <Text style={styles.devPromptText}>{devPrompt}</Text>
                        </ScrollView>
                      </View>
                    ) : null}
                  </View>
                </View>
              ) : null}
            </>
          )}
        </View>
        {!loading && chartValues.length > 1 ? (
          <Animated.View
            entering={FadeInDown.duration(500).delay(260).easing(EASE_OUT)}
            style={styles.journeySection}
          >
            <View style={styles.chartCard}>
              <View style={styles.chartHeader}>
                <View style={styles.chartTitleRow}>
                  <ChartLine size={18} color={COLORS.primary} strokeWidth={2.25} />
                  <Text style={styles.chartTitle}>Your Journey</Text>
                </View>
                <Text style={styles.chartSummary}>{chartSummary}</Text>
              </View>
              <JourneyChart values={chartValues} currentIndex={chartCurrentIndex} />
              <View style={styles.chartAxis}><Text style={styles.chartAxisText}>Start</Text><Text style={styles.chartAxisText}>Week {totalWeeks}</Text></View>
              <Text style={styles.chartAxisText}>{hasWeightNumbers ? 'Projected weight' : 'Planned weekly distance'}</Text>
            </View>
          </Animated.View>
        ) : null}

      </ScrollView>

      {selectedWeek ? (
        <Animated.View
          style={styles.sheetOverlay}
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(180)}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => onSelectWeek(null)}
          />
          <Animated.View
            style={styles.detailSheet}
            entering={SlideInDown.duration(340).easing(EASE_OUT)}
            exiting={SlideOutDown.duration(220)}
          >
            <View style={styles.modalDragHandle} />
            <View style={styles.detailHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailEyebrow}>WEEK {selectedWeek.Week}</Text>
                <Text style={styles.detailTitle}>{selectedWeek['Week name']}</Text>
              </View>
              <TouchableOpacity onPress={() => onSelectWeek(null)} style={styles.detailCloseBtn}>
                <X size={18} color={COLORS.textSub} />
              </TouchableOpacity>
            </View>

            <View style={styles.detailHeroGlass}>
              <LinearGradient
                colors={c.isFemale ? ['#FFF0F2', '#FFFAFB'] : ['#F2F7F5', '#FAFBFA']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.detailHeroInner}>
                {showWeightGoalLayout ? (
                  <>
                    <Text style={styles.detailHeroLead}>By Week {selectedWeek.Week},</Text>
                    <WeightProjectionContent
                      week={selectedWeek}
                      startingWeightKg={startingWeightKg}
                      usesImperial={usesImperial}
                      loggedWeightKg={selectedWeekLoggedWeightKg}
                      compareLoggedWeight={selectedWeekLoggedWeightKg !== null}
                      isLocked={false}
                      variant="detail"
                    />
                  </>
                ) : (
                  <>
                    <Text style={styles.detailHeroLead}>By Week {selectedWeek.Week},</Text>
                    <Text style={styles.detailHeroAction}>you&apos;ll run</Text>
                    <Text style={styles.detailHeroValue}>{selectedWeek['Run km/week']} km</Text>
                  </>
                )}
              </View>
            </View>

            <View style={styles.detailStatsRow}>
              <View style={styles.detailStatCard}>
                <Flame size={15} color={COLORS.primary} />
                <Text style={styles.detailStatLabel}>Calories</Text>
                <Text style={styles.detailStatValue}>{selectedWeek['Calories/day']}</Text>
              </View>
              <View style={styles.detailStatCard}>
                <Ionicons name="nutrition-outline" size={16} color={COLORS.primary} />
                <Text style={styles.detailStatLabel}>Protein</Text>
                <Text style={styles.detailStatValue}>{selectedWeek['Protein/day']}g</Text>
              </View>
              <View style={styles.detailStatCard}>
                <Ionicons name="trail-sign-outline" size={16} color={COLORS.primary} />
                <Text style={styles.detailStatLabel}>{selectedWeek['Week Dailys'].trainingSchedule ? 'Training' : 'Run vol'}</Text>
                <Text style={styles.detailStatValue}>{selectedWeek['Week Dailys'].trainingSchedule ? `${selectedWeek['Week Dailys'].trainingSchedule.sessions.length} days` : `${selectedWeek['Run km/week']}k`}</Text>
              </View>
            </View>

            <Text style={styles.sessionHeader}>Schedule</Text>
            <ScrollView showsVerticalScrollIndicator={false} style={styles.detailScheduleScroll}>
              {getMappedDays(selectedWeek, availableDays)
                .filter((day) => day.type !== 'STEP' || !!day.workoutPreference)
                .map((day) => (
                  <TouchableOpacity
                    key={day.dayIdx}
                    style={[
                      styles.sessionCard,
                      day.type === 'RUN' ? styles.sessionRunCard : styles.sessionRecCard,
                    ]}
                    onPress={() => {
                      if (day.type === 'RUN' || day.workoutPreference) {
                        onSelectSessionDay?.(selectedWeek.Week, day.dayIdx);
                      }
                    }}
                    activeOpacity={(day.type === 'RUN' || day.workoutPreference) && onSelectSessionDay ? 0.75 : 1}
                    disabled={(day.type !== 'RUN' && !day.workoutPreference) || !onSelectSessionDay}
                  >
                    <View style={styles.sessionCardIconWrap}>
                      {day.workoutPreference ? <Dumbbell size={18} color={COLORS.primary} /> : <PlanSessionIcon
                        kind={getSessionActivityKind(day.runType, day.type)}
                        size={18}
                        color={COLORS.primary}
                      />}
                    </View>
                    <View style={styles.sessionCardHeader}>
                      <Text style={styles.sessionDay}>{day.name.toUpperCase()}</Text>
                      <Text style={styles.sessionType}>
                        {day.workoutPreference ? findPartnerWorkout(day.workoutId)?.name ?? workoutLabel(day.workoutPreference) : day.runType || (day.type === 'RECOVERY' ? 'Recovery' : 'Active')}
                      </Text>
                    </View>
                    <View style={[styles.sessionTimePill, { backgroundColor: `${getTimeAccent(trainingTimePreference)}14` }]}>
                      <TimeIcon size={12} color={getTimeAccent(trainingTimePreference)} />
                      <Text style={[styles.sessionTimeText, { color: getTimeAccent(trainingTimePreference) }]}>
                        {getTimeLabel(trainingTimePreference)}
                      </Text>
                    </View>
                    {day.type === 'RUN' ? (
                      <Text style={styles.sessionKm}>{day.targetKm} km</Text>
                    ) : null}
                  </TouchableOpacity>
                ))}
            </ScrollView>

            {showWeightGoalLayout ? (
              <>
                {selectedWeek.Week === planWeekToday ? (
                  <TouchableOpacity
                    style={styles.detailLogWeightBtn}
                    onPress={openWeightModal}
                    disabled={loggingWeight}
                    activeOpacity={0.85}
                  >
                    {loggingWeight ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <>
                        <Plus size={16} color="#FFF" strokeWidth={2.5} />
                        <Text style={styles.detailLogWeightBtnText}>Log weight</Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : null}
                <View style={styles.expectedWeightCard}>
                  <Scale size={22} color={COLORS.primary} />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={styles.expectedWeightLabel}>Estimated end weight</Text>
                    <Text style={styles.expectedWeightValue}>
                      {formatWeightValue(selectedWeek['Expected weight'], usesImperial)}
                    </Text>
                  </View>
                </View>
              </>
            ) : null}
          </Animated.View>
        </Animated.View>
      ) : null}

      {showEditPlanSheet ? (
        <Animated.View
          style={styles.sheetOverlay}
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(180)}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => !sheetBusy && setShowEditPlanSheet(false)}
          />
          <Animated.View
            style={styles.editPlanModalCard}
            entering={SlideInDown.duration(340).easing(EASE_OUT)}
            exiting={SlideOutDown.duration(220)}
          >
            <View style={styles.modalDragHandle} />
            <View style={styles.modalContentHeader}>
              <Text style={styles.modalWeek}>EDIT PLAN</Text>
              <TouchableOpacity onPress={() => setShowEditPlanSheet(false)}>
                <X size={20} color={COLORS.textSub} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.editPlanScrollContent}>
              <Text style={styles.editPlanIntro}>
                Change when you train, or adjust how hard the plan feels.
              </Text>

              <Text style={styles.editPlanSectionTitle}>{requiredTrainingDays ? 'Training days' : 'Run days'}</Text>
              <Text style={styles.editPlanSectionHint}>{requiredTrainingDays ? `Pick exactly ${requiredTrainingDays} training ${requiredTrainingDays === 1 ? 'day' : 'days'}.` : 'Pick at least 3 days you can train.'}</Text>
              <View style={styles.scheduleGrid}>
                {DAY_OPTIONS.map((day) => {
                  const selected = draftAvailableDays.includes(day.id);
                  return (
                    <TouchableOpacity
                      key={day.id}
                      style={[styles.scheduleDayChip, selected && styles.scheduleDayChipActive]}
                      onPress={() => toggleDay(day.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.scheduleDayChipText, selected && styles.scheduleDayChipTextActive]}>
                        {day.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.editPlanSectionTitle, styles.editPlanSectionTitleSpaced]}>Training time</Text>
              <Text style={styles.editPlanSectionHint}>When you prefer runs and workouts.</Text>
              <View style={styles.timeOptionStack}>
                {TIME_OPTIONS.map((option) => {
                  const selected = option.id === draftTrainingTimePreference;
                  const Icon = option.icon;
                  return (
                    <TouchableOpacity
                      key={option.id}
                      style={[styles.timeOptionCard, selected && styles.timeOptionCardActive]}
                      onPress={() => setDraftTrainingTimePreference(option.id)}
                      activeOpacity={0.85}
                    >
                      <View style={[styles.timeOptionIconWrap, selected && styles.timeOptionIconWrapActive]}>
                        <Icon size={18} color={selected ? '#FFF' : getTimeAccent(option.id)} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.timeOptionTitle}>{option.label}</Text>
                      </View>
                      {selected ? <CheckCircle2 size={18} color={COLORS.primary} /> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[styles.secondaryActionBtn, !canSaveScheduleAndTime && styles.disabledPrimaryBtn]}
                onPress={handleSaveScheduleAndTime}
                disabled={!canSaveScheduleAndTime}
              >
                {scheduleUpdating ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <Text style={styles.secondaryActionBtnText}>Save days & time</Text>
                )}
              </TouchableOpacity>

              <View style={styles.editPlanDivider} />

              <Text style={[styles.editPlanSectionTitle, styles.editPlanSectionTitleSpaced]}>Plan intensity</Text>
              <Text style={styles.editPlanSectionHint}>
                Updates calories and training from this week onward.
              </Text>
              <View style={styles.feelOptionStack}>
                {PLAN_FEEL_OPTIONS.map((option) => {
                  const selected = selectedAdjustment === option.id;
                  return (
                    <TouchableOpacity
                      key={option.id}
                      style={[styles.feelOptionCard, selected && styles.feelOptionCardActive]}
                      onPress={() => setSelectedAdjustment(option.id)}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.feelOptionTitle, selected && styles.feelOptionTitleActive]}>
                        {option.title}
                      </Text>
                      <Text style={[styles.feelOptionDescription, selected && styles.feelOptionDescriptionActive]}>
                        {option.description}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[styles.regenerateBtn, !canApplyPlanChanges && styles.disabledPrimaryBtn]}
                onPress={handleApplyPlanChanges}
                disabled={!canApplyPlanChanges}
              >
                {adjusting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.regenerateBtnText}>Update plan</Text>
                )}
              </TouchableOpacity>

              {!selectedAdjustment ? (
                <Text style={styles.applyHelperText}>Choose an intensity option above first.</Text>
              ) : null}

              {onResetPlan ? (
                <>
                  <View style={styles.editPlanDivider} />
                  <Text style={styles.editPlanSectionTitle}>Start a new plan</Text>
                  <Text style={styles.editPlanSectionHint}>
                    Set a new goal, update your weight, and rebuild your plan from week 1.
                  </Text>
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={[styles.secondaryActionBtn, sheetBusy && styles.disabledPrimaryBtn]}
                    disabled={sheetBusy}
                    onPress={() => {
                      setShowEditPlanSheet(false);
                      onResetPlan();
                    }}
                  >
                    <RefreshCw size={18} color={COLORS.primary} />
                    <Text style={styles.secondaryActionBtnText}>Full reset plan</Text>
                  </TouchableOpacity>
                </>
              ) : null}
            </ScrollView>
          </Animated.View>
        </Animated.View>
      ) : null}

      <Modal visible={weightModalOpen} animationType="fade" transparent onRequestClose={() => setWeightModalOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
          style={styles.weightModalRoot}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.weightModalBackdrop}>
              <View style={styles.weightModalCard}>
                <View style={styles.modalDragHandle} />
                <View style={styles.weightModalHeader}>
                  <View>
                    <Text style={styles.weightModalEyebrow}>VITALS</Text>
                    <Text style={styles.weightModalTitle}>Log weight</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setWeightModalOpen(false)}
                    style={styles.detailCloseBtn}
                  >
                    <X size={18} color={COLORS.textSub} />
                  </TouchableOpacity>
                </View>
                <View style={styles.weightEntryArea}>
                  <TextInput
                    style={styles.bigWeightInput}
                    value={weightInput}
                    onChangeText={setWeightInput}
                    keyboardType="decimal-pad"
                    autoFocus
                  />
                  <Text style={styles.weightUnitLabel}>
                    {usesImperial ? 'Pounds' : 'Kilograms'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.weightSaveBtn}
                  onPress={handleLogWeight}
                  disabled={loggingWeight}
                  activeOpacity={0.85}
                >
                  {loggingWeight ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.weightSaveBtnText}>Save weight</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  durationPill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: '#ECEFEC', color: COLORS.textSub, fontWeight: '800', fontSize: 12 },
  currentBadge: { position: 'absolute', top: 10, right: 12, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, backgroundColor: '#E4F2ED', color: '#24786F', fontSize: 10, fontWeight: '800', zIndex: 1 },
  weekProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  weekProgressLabel: { fontSize: 12, fontWeight: '600', color: COLORS.ink },
  weekProgressTrack: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: '#E4E8E4' },
  weekProgressFill: { height: '100%', borderRadius: 4, backgroundColor: '#11AF8A' },
  weekProgressValue: { minWidth: 32, textAlign: 'right', fontSize: 12, fontWeight: '800', color: COLORS.ink, fontVariant: ['tabular-nums'] },
  weekProgressHint: { fontSize: 10, lineHeight: 14, color: COLORS.textSub, marginTop: 6 },
  chartAxis: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  chartAxisText: { fontSize: 10, color: COLORS.textSub },
  projectedWeightBlock: { marginTop: 8, gap: 2 },
  projectedWeightLabel: { fontSize: 11, lineHeight: 15, fontWeight: '600', color: COLORS.textSub },
  projectedWeightValue: { fontSize: 25, lineHeight: 30, fontWeight: '900', color: COLORS.ink, letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
  projectedWeightValueActive: { fontSize: 29, lineHeight: 34 },
  pageRoot: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  pageHeader: {
    paddingHorizontal: 18, paddingTop: 4, paddingBottom: 6, backgroundColor: HERO_TOP,
  },
  pageHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 44,
  },
  pageHeaderIconBtn: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', boxShadow: '0 6px 20px rgba(54, 27, 31, 0.04)',
  },
  pageHeaderIconSpacer: {
    width: 44,
    height: 44,
  },
  pageHeaderTitleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  pageHeaderTitle: {
    fontSize: 22, fontWeight: '900', color: COLORS.ink, letterSpacing: -0.7,
  },
  pageScrollContent: {
    paddingBottom: 24,
  },

  hero: {
    minHeight: 176, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 50, overflow: 'hidden',
  },
  heroWave: {
    position: 'absolute',
    left: 0,
    bottom: 0,
  },
  heroMascotWrap: {
    position: 'absolute', right: -12, top: 0, width: 168, height: 260,
  },
  heroMascot: {
    width: 168, height: 260,
  },
  heroCopy: {
    maxWidth: '60%', gap: 8,
  },
  heroTitle: {
    fontSize: 29, lineHeight: 33, fontWeight: '800', color: COLORS.ink, letterSpacing: -1,
  },
  heroSubtitle: {
    fontSize: 13, lineHeight: 18, fontWeight: '600', color: COLORS.textMain,
  },

  statsCard: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 14, marginTop: -20, borderRadius: 16, borderCurve: 'continuous', backgroundColor: COLORS.card, paddingHorizontal: 12, paddingVertical: 10, boxShadow: '0 6px 20px rgba(28, 43, 38, 0.03)',
  },
  statsDivider: {
    width: 1, alignSelf: 'stretch', backgroundColor: '#E5E9E5', marginHorizontal: 10,
  },
  statItemNew: {
    flex: 1, alignItems: 'center', gap: 3,
  },
  statLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statLabelNew: {
    flexShrink: 1, fontSize: 10, fontWeight: '600', color: COLORS.textSub,
  },
  statValueNew: {
    fontSize: 17, fontWeight: '800', color: COLORS.ink, letterSpacing: -0.3, fontVariant: ['tabular-nums'],
  },
  statValueCompact: {
    fontSize: 15,
  },
  statLabelCompact: {
    fontSize: 10,
  },

  journeySection: {
    paddingHorizontal: 14, marginTop: 16,
  },
  chartCard: {
    borderRadius: 22, borderCurve: 'continuous', backgroundColor: COLORS.card, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14, boxShadow: '0 8px 28px rgba(28, 43, 38, 0.04)',
  },
  chartHeader: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 8,
  },
  chartTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chartTitle: {
    fontSize: 18, fontWeight: '900', color: COLORS.ink,
  },
  chartSummary: {
    fontSize: 14, fontWeight: '800', color: COLORS.ink, fontVariant: ['tabular-nums'],
  },
  chartCanvas: {
    height: CHART_HEIGHT,
  },
  chartReveal: {
    height: CHART_HEIGHT,
    overflow: 'hidden',
  },
  chartCurrentDot: {
    position: 'absolute',
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartCurrentDotInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFF',
    borderWidth: 3,
    borderColor: COLORS.primary,
  },
  loadingBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSub,
  },
  pageBody: {
    paddingHorizontal: 14, paddingTop: 14,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.textMain,
    letterSpacing: -0.3,
  },
  sectionHeadingMeta: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSub,
  },
  weekList: {},

  timelineRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  timelineRail: {
    width: 32, alignItems: 'center',
  },
  railSegment: {
    flex: 1, width: 2, backgroundColor: '#DDE4E1',
  },
  railSegmentHidden: {
    opacity: 0,
  },
  railSegmentReached: {
    backgroundColor: COLORS.teal,
  },
  nodeBase: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeCompleted: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.teal,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  nodeCurrentWrap: {
    width: 28, height: 28, alignItems: 'center', justifyContent: 'center',
  },
  nodeCurrent: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.teal, borderWidth: 3, borderColor: '#FFFFFF',
  },
  nodeCurrentDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
  },
  nodeUpcoming: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#C7D3CD',
  },
  nodeLocked: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#C7D3CD',
  },

  weekCard: {
    flex: 1, marginVertical: 5, minHeight: 92, borderRadius: 16, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: COLORS.card, borderWidth: 1, borderColor: '#E8ECE8', paddingLeft: 16, paddingRight: 10, paddingVertical: 12, justifyContent: 'center', boxShadow: '0 4px 14px rgba(28, 43, 38, 0.04)',
  },
  weekCardActive: {
    minHeight: 164, borderWidth: 1, borderColor: '#A9CEC3', paddingTop: 14, paddingBottom: 12, boxShadow: '0 6px 18px rgba(28, 43, 38, 0.04)',
  },
  weekCardLocked: {
    backgroundColor: '#FFFFFF',
  },
  weekCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  weekCardCopy: {
    flex: 1,
    alignItems: 'flex-start',
    gap: 2,
  },
  weekPill: {
    paddingHorizontal: 9, paddingVertical: 2, borderRadius: 999, backgroundColor: '#F0F2EF', marginBottom: 4,
  },
  weekPillActive: {
    backgroundColor: '#E4F2ED',
  },
  weekPillText: {
    fontSize: 12, fontWeight: '800', color: '#59635F', fontVariant: ['tabular-nums'],
  },
  weekPillTextActive: {
    color: '#24786F',
  },
  weekHeadline: {
    fontSize: 20, fontWeight: '800', color: COLORS.ink, letterSpacing: -0.4, fontVariant: ['tabular-nums'],
  },
  weekHeadlineActive: {
    fontSize: 22,
  },
  weekHeadlineCompact: {
    fontSize: 18,
  },
  weekSub: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSub,
  },
  weekSubStrong: {
    fontWeight: '800',
    color: COLORS.textMain,
    fontVariant: ['tabular-nums'],
  },
  weekArt: {
    width: 70, height: 64,
  },
  cardMascotWrap: {
    width: 78, height: 98, marginTop: 24, alignItems: 'center', justifyContent: 'flex-end',
  },
  cardMascot: {
    width: 70, height: 96,
  },
  cardMascotWrapCompact: {
    width: 64,
  },
  cardMascotCompact: {
    width: 54, height: 96, marginBottom: 0,
  },
  loggedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  loggedChipGood: {
    backgroundColor: 'rgba(22, 163, 74, 0.08)',
  },
  loggedChipBad: {
    backgroundColor: 'rgba(220, 38, 38, 0.07)',
  },
  loggedChipText: {
    fontSize: 11.5,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  logWeightBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    minHeight: 30,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
    boxShadow: '0 4px 10px rgba(255, 107, 107, 0.35)',
  },
  logWeightBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFF',
  },
  weightProjectionAction: {
    fontSize: 24,
    lineHeight: 30,
    color: COLORS.textSub,
    letterSpacing: -0.4,
  },
  weightProjectionValue: {
    fontSize: 38,
    lineHeight: 40,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: -1.2,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  weightProjectionValueLocked: {
    color: COLORS.locked,
  },
  weightExpectedStruck: {
    color: COLORS.textSub,
    textDecorationLine: 'line-through',
    textDecorationColor: COLORS.textSub,
  },
  weightActualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  weightProjectionSub: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: COLORS.textSub,
    marginTop: 4,
  },
  weightTextMuted: {
    color: COLORS.locked,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    elevation: 2,
  },
  cardActive: { borderColor: COLORS.primary, borderWidth: 2 },
  cardDefault: {},
  cardLocked: { backgroundColor: '#F5F5F5', opacity: 0.6 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  weekLabel: { fontSize: 10, fontWeight: '800', color: COLORS.textSub },
  activeLabelBadge: { backgroundColor: COLORS.primaryFade, paddingHorizontal: 4, borderRadius: 3 },
  activeLabelText: { fontSize: 8, fontWeight: '900', color: COLORS.primary },
  cardTitle: { fontSize: 16, fontWeight: '900', color: COLORS.textMain, marginBottom: 8 },
  optimizedStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    borderRadius: 10,
    padding: 8,
    gap: 10,
  },
  optStatItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  optStatText: { fontSize: 12, fontWeight: '700' },
  optStatDivider: { width: 1, height: 12, backgroundColor: '#DDD' },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  footerTarget: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerTargetText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  timePrefPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
  },
  timePrefText: {
    fontSize: 11,
    fontWeight: '800',
  },

  // Weekly Runs Summary (on main card)
  runsSummary: {
    marginTop: 12,
    marginBottom: 8,
    gap: 4,
  },
  runSummaryLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  runSummaryName: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMain,
    flex: 1,
    marginRight: 8,
  },
  runSummaryKm: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
  },

  // Mini Map (Weekly Grid Summary)
  miniMapContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    marginTop: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F1F3F5',
  },
  miniMapDay: {
    width: 32,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  miniMapRun: { backgroundColor: '#FFF5F5', borderColor: '#FFE3E3', borderWidth: 1 },
  miniMapRec: { backgroundColor: '#FFF5F5', borderColor: '#FFE3E3', borderWidth: 1 },
  miniMapRest: { backgroundColor: '#F8F9FA' },
  miniMapDayText: { fontSize: 10, fontWeight: '700', color: COLORS.textSub },
  miniMapDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: COLORS.primary },

  // Card Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  detailSheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderCurve: 'continuous',
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 28,
    maxHeight: '88%',
    boxShadow: '0 -12px 40px rgba(15, 23, 42, 0.18)',
  },
  detailHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  detailEyebrow: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: 1,
    marginBottom: 4,
  },
  detailTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.textMain,
    letterSpacing: -0.5,
  },
  detailCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F6F8',
  },
  detailHeroGlass: {
    borderRadius: 22,
    borderCurve: 'continuous',
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.16)',
  },
  detailHeroInner: {
    padding: 18,
  },
  detailHeroLead: {
    fontSize: 18,
    color: COLORS.textMain,
  },
  detailHeroAction: {
    fontSize: 22,
    color: COLORS.textSub,
  },
  detailHeroValue: {
    fontSize: 34,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: 4,
    letterSpacing: -1,
  },
  detailHeroSub: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: COLORS.textSub,
    marginTop: 6,
  },
  detailStatsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  detailStatCard: {
    flex: 1,
    borderRadius: 16,
    borderCurve: 'continuous',
    backgroundColor: '#F8FAFB',
    borderWidth: 1,
    borderColor: '#EEF2F6',
    padding: 12,
    gap: 4,
  },
  detailStatLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textSub,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  detailStatValue: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.textMain,
    fontVariant: ['tabular-nums'],
  },
  detailScheduleScroll: {
    maxHeight: 260,
    marginBottom: 12,
  },
  modalCard: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    minHeight: 500,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
  },
  modalDragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E9ECEF',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalContentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalWeek: { fontSize: 13, fontWeight: '800', color: COLORS.primary, letterSpacing: 0.5 },
  modalTitle: { fontSize: 28, fontWeight: '900', color: COLORS.textMain, marginBottom: 20 },
  modalStatsGrid: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 14,
    borderRadius: 16,
    gap: 10,
  },
  statLabel: { fontSize: 9, fontWeight: '800', color: COLORS.textSub },
  statValue: { fontSize: 15, fontWeight: '900', color: COLORS.textMain },

  sessionHeader: { fontSize: 13, fontWeight: '800', color: COLORS.textSub, marginBottom: 12, letterSpacing: 0.5 },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#FFF',
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F1F3F5',
  },
  sessionRunCard: { backgroundColor: '#FFFAFA', borderColor: '#FFE5E5' },
  sessionRecCard: { backgroundColor: '#FFFAFA', borderColor: '#FFE5E5' },
  sessionCardIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryFade,
    marginRight: 10,
  },
  sessionCardHeader: { flex: 1 },
  sessionDay: { fontSize: 9, fontWeight: '800', color: COLORS.textSub, marginBottom: 2 },
  sessionType: { fontSize: 15, fontWeight: '800', color: COLORS.textMain },
  sessionTimePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 999,
  },
  sessionTimeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  sessionKm: { fontSize: 14, fontWeight: '900', color: COLORS.primary },

  expectedWeightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 20,
    marginTop: 10,
  },
  expectedWeightLabel: { fontSize: 10, fontWeight: '800', color: COLORS.textSub },
  expectedWeightValue: { fontSize: 22, fontWeight: '900', color: COLORS.primary },
  detailLogWeightBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    paddingVertical: 14,
    marginBottom: 10,
  },
  detailLogWeightBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  weightModalRoot: {
    flex: 1,
  },
  weightModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  weightModalCard: {
    backgroundColor: '#FFF',
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 22,
  },
  weightModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  weightModalEyebrow: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: 1,
    marginBottom: 4,
  },
  weightModalTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.textMain,
  },
  weightEntryArea: {
    alignItems: 'center',
    paddingVertical: 28,
  },
  bigWeightInput: {
    fontSize: 56,
    fontWeight: '900',
    color: COLORS.textMain,
    minWidth: 120,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  weightUnitLabel: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textSub,
    marginTop: 4,
  },
  weightSaveBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    paddingVertical: 16,
    minHeight: 52,
  },
  weightSaveBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },

  regenerateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 18,
    borderRadius: 20,
    marginTop: 20,
    marginBottom: 60,
    gap: 12,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  regenerateBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  headerCloseRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 10,
  },
  headerCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F3F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topActionsRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  editPlanBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#F1F3F5',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  editPlanBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textMain,
    letterSpacing: 0.2,
  },
  emptyPlanCard: {
    alignItems: 'center',
    backgroundColor: '#FFF7F7',
    borderWidth: 1,
    borderColor: '#FFD9D9',
    borderRadius: 24,
    padding: 22,
    marginBottom: 16,
  },
  emptyPlanIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyPlanTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.textMain,
    marginBottom: 6,
  },
  emptyPlanText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    color: COLORS.textSub,
    textAlign: 'center',
  },
  emptyPlanButton: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 18,
  },
  emptyPlanButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
  },
  devActionRow: {
    alignItems: 'stretch',
    marginBottom: 12,
  },
  devActionStack: {
    alignItems: 'flex-end',
    gap: 8,
  },
  devRegenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FFD9D9',
  },
  devRegenText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
  },
  devPromptToggle: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  devPromptToggleText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSub,
  },
  devPromptCard: {
    alignSelf: 'stretch',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#FFD9D9',
    borderRadius: 16,
    padding: 12,
  },
  devPromptLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  devPromptScroll: {
    maxHeight: 180,
  },
  devPromptScrollContent: {
    paddingBottom: 4,
  },
  devPromptText: {
    fontSize: 11,
    lineHeight: 17,
    color: COLORS.textMain,
    fontWeight: '600',
  },
  preferenceBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#FFF7F1',
    borderWidth: 1,
    borderColor: '#FFE8D6',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },
  preferenceIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  preferenceTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.textMain,
    marginBottom: 4,
  },
  preferenceText: {
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.textSub,
    fontWeight: '600',
  },
  secondaryActionBtn: {
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  secondaryActionBtnText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '800',
  },
  disabledPrimaryBtn: {
    opacity: 0.45,
  },
  editPlanModalCard: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
    maxHeight: '92%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
  },
  editPlanScrollContent: {
    paddingBottom: 12,
  },
  editPlanIntro: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: COLORS.textSub,
    marginBottom: 16,
  },
  editPlanSectionTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.textMain,
    marginBottom: 4,
  },
  editPlanSectionHint: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    color: COLORS.textSub,
    marginBottom: 12,
  },
  editPlanSectionTitleSpaced: {
    marginTop: 4,
  },
  editPlanDivider: {
    height: 1,
    backgroundColor: '#ECECEC',
    marginVertical: 20,
  },
  feelOptionStack: {
    gap: 10,
    marginBottom: 20,
  },
  feelOptionCard: {
    borderWidth: 1.5,
    borderColor: '#EAEAEA',
    borderRadius: 16,
    padding: 14,
    backgroundColor: '#FAFAFA',
  },
  feelOptionCardActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryFade,
  },
  feelOptionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textMain,
    marginBottom: 4,
  },
  feelOptionTitleActive: {
    color: COLORS.primary,
  },
  feelOptionDescription: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: COLORS.textSub,
  },
  feelOptionDescriptionActive: {
    color: COLORS.textMain,
  },
  applyHelperText: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    color: COLORS.textSub,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  scheduleModalCard: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    minHeight: 360,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
  },
  scheduleHelperText: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textSub,
    marginBottom: 20,
  },
  scheduleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  scheduleDayChip: {
    width: '22%',
    minWidth: 64,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EAEAEA',
  },
  scheduleDayChipActive: {
    backgroundColor: COLORS.primaryFade,
    borderColor: COLORS.primary,
  },
  scheduleDayChipText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textSub,
  },
  scheduleDayChipTextActive: {
    color: COLORS.primary,
  },
  preferenceSummaryCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 18,
    padding: 16,
    marginBottom: 18,
  },
  preferenceSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  preferenceSummaryLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSub,
  },
  preferenceSummaryValue: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.textMain,
  },
  preferenceSummaryDivider: {
    height: 1,
    backgroundColor: '#E9ECEF',
    marginVertical: 12,
  },
  timeOptionStack: {
    gap: 10,
    marginBottom: 6,
  },
  timeOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#FFF',
  },
  timeOptionCardActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#FFF7F7',
  },
  timeOptionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeOptionIconWrapActive: {
    backgroundColor: COLORS.primary,
  },
  timeOptionTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.textMain,
    marginBottom: 2,
  },
  timeOptionDescription: {
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.textSub,
    fontWeight: '600',
  },
});


function useWeeklyStyles(gender?: string | null) {
  const { isFemale, secondary, secondarySoft } = usePlanColors(gender);
  return React.useMemo(() => isFemale ? {
    ...styles,
    pageRoot: { ...styles.pageRoot, backgroundColor: '#FFF8F9' },
    statsDivider: { ...styles.statsDivider, backgroundColor: '#F0EDF1' },
    durationPill: { ...styles.durationPill, backgroundColor: '#F0EDF1' },
    currentBadge: { ...styles.currentBadge, backgroundColor: secondarySoft, color: secondary },
    weekProgressTrack: { ...styles.weekProgressTrack, backgroundColor: '#FFE0E4' },
    weekProgressFill: { ...styles.weekProgressFill, backgroundColor: '#FF6069' },
    railSegment: { ...styles.railSegment, backgroundColor: '#EADCE0' },
    railSegmentReached: { ...styles.railSegmentReached, backgroundColor: secondary },
    nodeCompleted: { ...styles.nodeCompleted, backgroundColor: secondary },
    nodeCurrent: { ...styles.nodeCurrent, backgroundColor: secondary },
    nodeUpcoming: { ...styles.nodeUpcoming, borderColor: '#DFC7CD' },
    nodeLocked: { ...styles.nodeLocked, borderColor: '#DFC7CD' },
    weekCard: { ...styles.weekCard, borderColor: '#F0EDF1' },
    weekCardActive: { ...styles.weekCardActive, borderColor: '#F5AAB2' },
    weekPill: { ...styles.weekPill, backgroundColor: '#F0EDF1' },
    weekPillText: { ...styles.weekPillText, color: '#63606A' },
    weekPillActive: { ...styles.weekPillActive, backgroundColor: secondarySoft },
    weekPillTextActive: { ...styles.weekPillTextActive, color: secondary },
    loggedChipGood: { ...styles.loggedChipGood, backgroundColor: secondarySoft },
  } : styles, [isFemale, secondary, secondarySoft]);
}
