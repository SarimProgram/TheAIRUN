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
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  Flame,
  Calendar,
  ChevronRight,
  Sunrise,
  Sun,
  Sunset,
  RefreshCw,
  Pencil,
  Scale,
  Plus,
  Lock,
  CheckCircle2,
  X,
} from 'lucide-react-native';
import { useAuth } from '@/src/auth/authContext';
import { useWeightLog } from '../../hooks/useWeightLog';
import { getMappedDays, getWeekLoggedWeightKg } from '../../utils/planProjection';
import { Fonts } from '../../constants/theme';
import { getSessionActivityKind, PlanSessionIcon } from './PlanSessionIcon';

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
    const resultColor = comparison.beatTarget ? COLORS.success : COLORS.danger;
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

  loading?: boolean;
  onRegeneratePlan?: () => void;
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
};

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
  loading,
  onRegeneratePlan,
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

  const scrollToCurrentWeek = React.useCallback(() => {
    const offset = weekOffsetsRef.current[planWeekToday];
    if (offset == null) return;
    requestAnimationFrame(() => {
      pageScrollRef.current?.scrollTo({ y: Math.max(0, offset - 16), animated: false });
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
      if (exists && prev.length <= 3) return prev;
      return exists ? prev.filter((item) => item !== day) : [...prev, day].sort((a, b) => a - b);
    });
  };

  const handleSaveScheduleAndTime = async () => {
    if (draftAvailableDays.length < 3) return;
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
  const canSaveScheduleAndTime = draftAvailableDays.length >= 3 && !sheetBusy;
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

  const heroTitle = showWeightGoalLayout
    ? goalType === 'both'
      ? 'Train & Transform'
      : 'Weight Loss Journey'
    : 'Running Journey';

  const currentWeekPlan = weeklyPlan.find((week) => week.Week === planWeekToday) ?? null;

  const headerCaption = React.useMemo(() => {
    if (totalWeeks === 0) return 'Generate your plan to see each week ahead.';

    if (showWeightGoalLayout && typeof startingWeightKg === 'number') {
      const parts = [formatWeightValue(startingWeightKg, usesImperial)];
      if (typeof journeyEndWeightKg === 'number') {
        parts.push(formatWeightValue(journeyEndWeightKg, usesImperial));
      }
      if (journeyStats.totalLossKg != null && journeyStats.totalLossKg > 0) {
        return `${parts.join(' → ')} · ${formatWeightLoss(journeyStats.totalLossKg, usesImperial)} total`;
      }
      return parts.join(' → ');
    }

    if (currentWeekPlan) {
      return `${currentWeekPlan['Week name']} · ${currentWeekPlan['Run km/week']} km this week`;
    }

    return heroTitle;
  }, [
    currentWeekPlan,
    heroTitle,
    journeyEndWeightKg,
    journeyStats.totalLossKg,
    showWeightGoalLayout,
    startingWeightKg,
    totalWeeks,
    usesImperial,
  ]);

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

  const renderGlassBackdrop = (isLocked: boolean, isActive: boolean, isCompleted: boolean) => {
    const accentColors = isLocked
      ? (['#F4F5F7', '#ECEFF3'] as const)
      : isActive
        ? (['rgba(255, 107, 107, 0.18)', 'rgba(255, 107, 107, 0.06)'] as const)
        : isCompleted
          ? (['rgba(255, 107, 107, 0.1)', 'rgba(255, 255, 255, 0.72)'] as const)
          : (['rgba(255, 255, 255, 0.94)', 'rgba(248, 249, 250, 0.9)'] as const);

    return (
      <>
        <LinearGradient
          colors={accentColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {Platform.OS === 'ios' ? (
          <BlurView intensity={isLocked ? 12 : 28} tint="light" style={StyleSheet.absoluteFill} />
        ) : null}
        <LinearGradient
          colors={['rgba(255,255,255,0.8)', 'rgba(255,255,255,0.45)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </>
    );
  };

  const renderWeekStatusChip = (isActive: boolean, isCompleted: boolean, isLocked: boolean) => {
    if (isActive) {
      return (
        <View style={styles.weekStatusChipActive}>
          <Text style={styles.weekStatusChipActiveText}>Current</Text>
        </View>
      );
    }
    if (isCompleted) {
      return (
        <View style={styles.weekStatusChipDone}>
          <CheckCircle2 size={12} color={COLORS.primary} />
          <Text style={styles.weekStatusChipDoneText}>Done</Text>
        </View>
      );
    }
    if (isLocked) {
      return (
        <View style={styles.weekStatusChipLocked}>
          <Lock size={11} color={COLORS.locked} />
          <Text style={styles.weekStatusChipLockedText}>Locked</Text>
        </View>
      );
    }
    return null;
  };

  const selectedWeekLoggedWeightKg = React.useMemo(() => {
    if (!selectedWeek) return null;
    return getWeekLoggedWeightKg(weightHistory, planStartDate, selectedWeek.Week);
  }, [selectedWeek, weightHistory, planStartDate]);

  const renderWeekCard = (week: WeekPlan) => {
    const isActive = week.Week === planWeekToday;
    const isCompleted = week.Week < planWeekToday;
    const isLocked = week.Week > planWeekToday + 1;
    const runs = getMappedDays(week, availableDays).filter((day) => day.type === 'RUN');
    const recoveryDays = getMappedDays(week, availableDays).filter((day) => day.type === 'RECOVERY');
    const projectionLead = `By Week ${week.Week},`;
    const weekLoggedWeightKg = getWeekLoggedWeightKg(weightHistory, planStartDate, week.Week);
    const compareLoggedWeight = weekLoggedWeightKg !== null;

    return (
      <TouchableOpacity
        key={week.Week}
        style={[
          styles.weekCardTouchable,
          isActive && styles.weekCardTouchableActive,
          isLocked && styles.weekCardTouchableLocked,
        ]}
        onPress={() => !isLocked && onSelectWeek(week)}
        onLayout={(event) => {
          weekOffsetsRef.current[week.Week] = weekListTopRef.current + event.nativeEvent.layout.y;
          if (week.Week === planWeekToday) {
            scrollToCurrentWeek();
          }
        }}
        activeOpacity={isLocked ? 1 : 0.84}
      >
        <View style={styles.glassShell}>
          {renderGlassBackdrop(isLocked, isActive, isCompleted)}

          <View style={styles.glassInner}>
            <View style={styles.weekCardTitleRow}>
              <Text style={[styles.weekCardName, isLocked && styles.weightTextMuted]} numberOfLines={1}>
                {week['Week name']}
              </Text>
              {renderWeekStatusChip(isActive, isCompleted, isLocked)}
            </View>

            <View style={styles.weightProjectionBlock}>
              <Text style={[styles.weightProjectionLead, isLocked && styles.weightTextMuted]}>
                {projectionLead}
              </Text>
              {showWeightGoalLayout ? (
                <>
                  <WeightProjectionContent
                    week={week}
                    startingWeightKg={startingWeightKg}
                    usesImperial={usesImperial}
                    loggedWeightKg={weekLoggedWeightKg}
                    compareLoggedWeight={compareLoggedWeight}
                    isLocked={isLocked}
                  />
                  {isActive ? (
                    <TouchableOpacity
                      style={styles.weekCardLogWeightBtn}
                      onPress={openWeightModal}
                      disabled={loggingWeight}
                      activeOpacity={0.85}
                    >
                      {loggingWeight ? (
                        <ActivityIndicator size="small" color={COLORS.primary} />
                      ) : (
                        <>
                          <Plus size={14} color={COLORS.primary} strokeWidth={2.5} />
                          <Text style={styles.weekCardLogWeightBtnText}>Log weight</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  ) : null}
                </>
              ) : (
                <>
                  <Text style={[styles.weightProjectionAction, isLocked && styles.weightTextMuted]}>
                    you&apos;ll run
                  </Text>
                  <Text style={[styles.weightProjectionValue, isLocked && styles.weightProjectionValueLocked]}>
                    {week['Run km/week']} km
                  </Text>
                  <Text style={[styles.weightProjectionSub, isLocked && styles.weightTextMuted]}>
                    {week['Steps/day target'].toLocaleString()} steps/day · {recoveryDays.length} recovery days
                  </Text>
                </>
              )}
            </View>

            {runs.length > 0 ? (
              <View style={styles.weightRunsSection}>
                <Text style={styles.weightRunsSectionLabel}>This week&apos;s runs</Text>
                {runs.map((run, runIndex) => (
                  <View
                    key={`${week.Week}-${run.dayIdx}-${run.runType ?? 'run'}-${runIndex}`}
                    style={styles.weightRunRow}
                  >
                    <View style={styles.weightRunIconWrap}>
                      <PlanSessionIcon
                        kind={getSessionActivityKind(run.runType, 'RUN')}
                        size={17}
                        color={isLocked ? COLORS.locked : COLORS.primary}
                      />
                    </View>
                    <View style={styles.weightRunCopy}>
                      <Text style={[styles.weightRunName, isLocked && styles.weightTextMuted]} numberOfLines={1}>
                        {run.runType}
                      </Text>
                      <Text style={[styles.weightRunDay, isLocked && styles.weightTextMuted]}>
                        {run.name}
                      </Text>
                    </View>
                    <Text style={[styles.weightRunKm, isLocked && styles.weightTextMuted]}>
                      {run.targetKm} km
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.weightCardFooter}>
              <View style={styles.weekMetaGroup}>
                <View style={styles.weekMetaPill}>
                  <Flame size={12} color={isLocked ? COLORS.locked : COLORS.primary} />
                  <Text style={[styles.weekMetaText, isLocked && styles.weightTextMuted]}>
                    {week['Calories/day']} kcal
                  </Text>
                </View>
                <View style={styles.weekMetaPill}>
                  <Ionicons
                    name="trail-sign-outline"
                    size={13}
                    color={isLocked ? COLORS.locked : COLORS.primary}
                  />
                  <Text style={[styles.weekMetaText, isLocked && styles.weightTextMuted]}>
                    {week['Run km/week']} km/wk
                  </Text>
                </View>
              </View>
              <ChevronRight size={16} color={COLORS.locked} />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.pageRoot}>
      <View style={styles.pageHeader}>
        <View style={styles.pageHeaderRow}>
          {onClose ? (
            <TouchableOpacity onPress={onClose} style={styles.pageHeaderIconBtn} activeOpacity={0.85}>
              <X size={20} color={COLORS.textMain} />
            </TouchableOpacity>
          ) : (
            <View style={styles.pageHeaderIconSpacer} />
          )}

          <View style={styles.pageHeaderTitleWrap}>
            <Text style={styles.pageHeaderTitle}>Weekly Plan</Text>
            {totalWeeks > 0 ? (
              <Text style={styles.pageHeaderSubtitle}>
                Week {planWeekToday} of {totalWeeks}
              </Text>
            ) : null}
          </View>

          {weeklyPlan.length > 0 ? (
            <TouchableOpacity
              onPress={openEditPlanSheet}
              style={styles.pageHeaderIconBtn}
              disabled={sheetBusy}
              activeOpacity={0.85}
            >
              <Pencil size={18} color={COLORS.primary} />
            </TouchableOpacity>
          ) : (
            <View style={styles.pageHeaderIconSpacer} />
          )}
        </View>

        {totalWeeks > 0 ? (
          <View style={styles.pageHeaderSummary}>
            <View style={styles.pageHeaderMetaRow}>
              <Text style={styles.pageHeaderCaption} numberOfLines={2}>
                {headerCaption}
              </Text>
              <Text style={styles.pageHeaderPercent}>{Math.round(journeyStats.progress * 100)}%</Text>
            </View>
            <View style={styles.pageHeaderProgressTrack}>
              <View
                style={[
                  styles.pageHeaderProgressFill,
                  { width: `${Math.max(4, journeyStats.progress * 100)}%` },
                ]}
              />
            </View>
          </View>
        ) : null}
      </View>

      <ScrollView
        ref={pageScrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.pageScrollContent}
      >
        <View style={styles.pageBody}>
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
                  <View style={styles.sectionHeadingRow}>
                    <Text style={styles.sectionHeading}>Your weeks</Text>
                    <Text style={styles.sectionHeadingMeta}>{totalWeeks} total</Text>
                  </View>
                  <View
                    style={styles.weekList}
                    onLayout={(event) => {
                      weekListTopRef.current = event.nativeEvent.layout.y;
                      scrollToCurrentWeek();
                    }}
                  >
                    {weeklyPlan.map((week) => renderWeekCard(week))}
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
      </ScrollView>

      {selectedWeek ? (
        <View style={styles.sheetOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => onSelectWeek(null)}
          />
          <View style={styles.detailSheet}>
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
              {renderGlassBackdrop(false, true, false)}
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
                <Text style={styles.detailStatLabel}>Run vol</Text>
                <Text style={styles.detailStatValue}>{selectedWeek['Run km/week']}k</Text>
              </View>
            </View>

            <Text style={styles.sessionHeader}>Schedule</Text>
            <ScrollView showsVerticalScrollIndicator={false} style={styles.detailScheduleScroll}>
              {getMappedDays(selectedWeek, availableDays)
                .filter((day) => day.type !== 'STEP')
                .map((day) => (
                  <TouchableOpacity
                    key={day.dayIdx}
                    style={[
                      styles.sessionCard,
                      day.type === 'RUN' ? styles.sessionRunCard : styles.sessionRecCard,
                    ]}
                    onPress={() => {
                      if (day.type === 'RUN') {
                        onSelectSessionDay?.(selectedWeek.Week, day.dayIdx);
                      }
                    }}
                    activeOpacity={day.type === 'RUN' && onSelectSessionDay ? 0.75 : 1}
                    disabled={day.type !== 'RUN' || !onSelectSessionDay}
                  >
                    <View style={styles.sessionCardIconWrap}>
                      <PlanSessionIcon
                        kind={getSessionActivityKind(day.runType, day.type)}
                        size={18}
                        color={COLORS.primary}
                      />
                    </View>
                    <View style={styles.sessionCardHeader}>
                      <Text style={styles.sessionDay}>{day.name.toUpperCase()}</Text>
                      <Text style={styles.sessionType}>
                        {day.runType || (day.type === 'RECOVERY' ? 'Recovery' : 'Active')}
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
          </View>
        </View>
      ) : null}

      {showEditPlanSheet ? (
        <View style={styles.sheetOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => !sheetBusy && setShowEditPlanSheet(false)}
          />
          <View style={styles.editPlanModalCard}>
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

              <Text style={styles.editPlanSectionTitle}>Run days</Text>
              <Text style={styles.editPlanSectionHint}>Pick at least 3 days you can train.</Text>
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
            </ScrollView>
          </View>
        </View>
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
  pageRoot: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  pageHeader: {
    paddingHorizontal: 20,
    paddingTop: 2,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F5',
  },
  pageHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 40,
  },
  pageHeaderIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F6F8',
  },
  pageHeaderIconSpacer: {
    width: 40,
    height: 40,
  },
  weekCardLogWeightBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: COLORS.primaryFade,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.18)',
  },
  weekCardLogWeightBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
  },
  pageHeaderTitleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  pageHeaderTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textMain,
    letterSpacing: -0.2,
  },
  pageHeaderSubtitle: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSub,
  },
  pageHeaderSummary: {
    marginTop: 10,
    gap: 8,
  },
  pageHeaderMetaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  pageHeaderCaption: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: COLORS.textSub,
  },
  pageHeaderPercent: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.primary,
    fontVariant: ['tabular-nums'],
  },
  pageHeaderProgressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: '#EEF1F4',
    overflow: 'hidden',
  },
  pageHeaderProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: COLORS.primary,
  },
  pageScrollContent: {
    paddingBottom: 40,
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
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 10,
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
  weekList: {
    gap: 12,
  },

  weekCardTouchable: {
    borderRadius: 24,
    borderCurve: 'continuous',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.72)',
    boxShadow: '0 10px 28px rgba(45, 52, 54, 0.08)',
  },
  weekCardTouchableActive: {
    borderColor: 'rgba(255, 107, 107, 0.45)',
    boxShadow: '0 14px 34px rgba(255, 107, 107, 0.18)',
  },
  weekCardTouchableLocked: {
    opacity: 0.72,
    boxShadow: '0 6px 16px rgba(45, 52, 54, 0.05)',
  },
  glassShell: {
    overflow: 'hidden',
    borderRadius: 24,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  glassInner: {
    padding: 14,
  },
  weekCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 8,
  },
  weekStatusChipActive: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.primaryFade,
  },
  weekStatusChipActiveText: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  weekStatusChipDone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.primaryFade,
  },
  weekStatusChipDoneText: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.primary,
    textTransform: 'uppercase',
  },
  weekStatusChipLocked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(178, 190, 195, 0.16)',
  },
  weekStatusChipLockedText: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.locked,
    textTransform: 'uppercase',
  },
  weekCardName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textSub,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  weightProjectionBlock: {
    marginBottom: 12,
    gap: 0,
  },
  weightProjectionLead: {
    fontFamily: Fonts.serif,
    fontSize: 20,
    lineHeight: 26,
    color: COLORS.textMain,
    letterSpacing: -0.3,
  },
  weightProjectionAction: {
    fontFamily: Fonts.serif,
    fontSize: 24,
    lineHeight: 30,
    color: COLORS.textSub,
    fontStyle: 'italic',
    letterSpacing: -0.4,
  },
  weightProjectionValue: {
    fontFamily: Fonts.serif,
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
  weightRunsSection: {
    gap: 8,
    paddingTop: 10,
    marginBottom: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(45, 52, 54, 0.08)',
  },
  weightRunsSectionLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.textSub,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  weightRunRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  weightRunIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
  },
  weightRunCopy: {
    flex: 1,
    gap: 2,
  },
  weightRunName: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textMain,
  },
  weightRunDay: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSub,
  },
  weightRunKm: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.primary,
    fontVariant: ['tabular-nums'],
  },
  weightCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(45, 52, 54, 0.08)',
  },
  weekMetaGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    flex: 1,
  },
  weekMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.62)',
  },
  weekMetaText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSub,
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
    fontFamily: Fonts.serif,
    fontSize: 18,
    color: COLORS.textMain,
  },
  detailHeroAction: {
    fontFamily: Fonts.serif,
    fontSize: 22,
    color: COLORS.textSub,
    fontStyle: 'italic',
  },
  detailHeroValue: {
    fontFamily: Fonts.serif,
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
