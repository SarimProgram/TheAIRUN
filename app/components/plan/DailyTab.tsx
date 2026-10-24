import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import {
  Footprints,
  Flame,
  Zap,
  Sun,
  Sunset,
  Moon,
  Check,
  Activity,
  AlertCircle,
  ChevronRight,
} from 'lucide-react-native';
import {
  DAILY_WATER_GLASS_TARGET,
  getWaterProgressForPeriod,
  splitWaterGlassesAcrossPeriods,
  WaterGlassesRow,
} from './WaterGlassesRow';
import { getPlanSessionStartLabel } from '../../constants/runDetails';

type DayType = 'RUN' | 'STEP' | 'RECOVERY';
export type DailyTargetFromAPI = {
  dayOfWeek: number;
  dayName: string;
  dayType: DayType;
  calorieTarget: number;
  proteinTarget: number;
  stepsTarget: number;
  runKm: number;
  runType: string | null;
};
export type StepSlots = { morning: number; afternoon: number; evening: number };
export type StepTargetSlots = { morning: number; afternoon: number; evening: number };
type SchedulePeriodKey = 'morning' | 'afternoon' | 'evening';

type ScheduleMetric = {
  key: string;
  icon: React.ReactNode;
  label: string;
  value: number;
  target: number;
  unit: string;
  isComplete: boolean;
  onPress?: () => void;
  isHydration?: boolean;
  hydrationStart?: number;
};

type SchedulePeriod = {
  key: SchedulePeriodKey;
  label: string;
  time: string;
  icon: React.ReactNode;
  color: string;
  metrics: ScheduleMetric[];
  phase: 'past' | 'current' | 'future';
};

export type DailyTabProps = {
  selectedDate: Date;
  loadingDaily: boolean;
  dailyTargets: DailyTargetFromAPI[];
  todayTarget?: DailyTargetFromAPI | null;
  todayIndex: number;
  currentSteps: number;
  currentCalories: number;
  calorieTarget: number;
  waterIntake: number;
  onSetWaterGlasses?: (glasses: number) => void;
  stepSlots: StepSlots;
  stepTargets: StepTargetSlots;
  exerciseCompleted: boolean;
  trainingTimePreference: 'morning' | 'afternoon' | 'evening' | 'night';
  onStartRun: (distanceKm: number) => void;
  showNightWalkRecoveryPrompt?: boolean;
  nightWalkRecoverySteps?: number;
  nightWalkRecoveryKm?: number;
  onConvertNightStepsToWalk?: () => void;
  onLogFood: (period: SchedulePeriodKey) => void;
  onOpenMobility: () => void;
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PAGE_WIDTH = SCREEN_WIDTH;

const COLORS = {
  primary: '#FF4757',
  primaryFade: 'rgba(255, 71, 87, 0.08)',
  secondary: '#1A1C1E',
  textMain: '#1A1C1E',
  textSub: '#64748B',
  line: '#ECEEF1',
  success: '#22C55E',
  successFade: 'rgba(34, 197, 94, 0.08)',
  afternoon: '#F59E0B',
  evening: '#6366F1',
  inactive: '#F4F6F8',
};

function clampProgress(value: number, target: number) {
  if (target <= 0) return 0;
  return Math.min(1, value / target);
}

function MetricRow({
  metric,
  accentColor,
  isLast,
  onSetWaterGlasses,
}: {
  metric: ScheduleMetric;
  accentColor: string;
  isLast: boolean;
  onSetWaterGlasses?: (glasses: number) => void;
}) {
  const progress = clampProgress(metric.value, metric.target);
  const fillColor = metric.isComplete ? COLORS.success : accentColor;

  if (metric.isHydration) {
    return (
      <View style={[styles.metricRow, !isLast && styles.metricRowBorder]}>
        <View style={styles.metricRowTop}>
          <Text style={[styles.metricLabel, metric.isComplete && styles.metricLabelDone]}>
            {metric.label}
          </Text>
          <Text style={styles.metricValue}>
            {metric.value}
            <Text style={styles.metricTarget}>
              {' / '}
              {metric.target} {metric.unit}
            </Text>
          </Text>
        </View>
        <WaterGlassesRow
          filledCount={metric.value}
          totalGlasses={metric.target}
          color={fillColor}
          onPressGlass={
            onSetWaterGlasses
              ? (glassInPeriod) =>
                  onSetWaterGlasses((metric.hydrationStart ?? 0) + glassInPeriod)
              : undefined
          }
        />
      </View>
    );
  }

  const row = (
    <View style={[styles.metricRow, !isLast && styles.metricRowBorder]}>
      <View style={styles.metricRowTop}>
        <View style={styles.metricLabelGroup}>
          {React.cloneElement(metric.icon as React.ReactElement<{ size?: number; color?: string }>, {
            size: 16,
            color: fillColor,
          })}
          <Text style={[styles.metricLabel, metric.isComplete && styles.metricLabelDone]}>
            {metric.label}
          </Text>
          {metric.isComplete ? (
            <View style={styles.metricCheck}>
              <Check size={10} color={COLORS.success} strokeWidth={3} />
            </View>
          ) : null}
        </View>
        <Text style={styles.metricValue}>
          {metric.value.toLocaleString()}
          <Text style={styles.metricTarget}>
            {' / '}
            {metric.target.toLocaleString()} {metric.unit}
          </Text>
        </Text>
      </View>
      <View style={styles.metricTrack}>
        <View style={[styles.metricFill, { width: `${Math.round(progress * 100)}%`, backgroundColor: fillColor }]} />
      </View>
      {metric.onPress ? (
        <View style={styles.metricTapHint}>
          <Text style={styles.metricTapHintText}>Tap to log</Text>
          <ChevronRight size={12} color={COLORS.textSub} />
        </View>
      ) : null}
    </View>
  );

  if (!metric.onPress) return row;

  return (
    <TouchableOpacity activeOpacity={0.75} onPress={metric.onPress}>
      {row}
    </TouchableOpacity>
  );
}

function SessionPanel({
  period,
  showRecoveryPrompt,
  nightWalkRecoverySteps,
  nightWalkRecoveryKm,
  onConvertNightStepsToWalk,
  showTraining,
  isRunDay,
  runKmTarget,
  runStartCtaLabel,
  exerciseCompleted,
  onStartRun,
  onOpenMobility,
  onSetWaterGlasses,
}: {
  period: SchedulePeriod;
  showRecoveryPrompt: boolean;
  nightWalkRecoverySteps: number;
  nightWalkRecoveryKm: number;
  onConvertNightStepsToWalk?: () => void;
  showTraining: boolean;
  isRunDay: boolean;
  runKmTarget: number;
  runStartCtaLabel: string;
  exerciseCompleted: boolean;
  onStartRun: (distanceKm: number) => void;
  onOpenMobility: () => void;
  onSetWaterGlasses?: (glasses: number) => void;
}) {
  const completedCount = period.metrics.filter((m) => m.isComplete).length;
  const totalCount = period.metrics.length;
  const allDone = completedCount === totalCount && totalCount > 0;
  const isCurrent = period.phase === 'current';

  return (
    <View style={styles.page}>
      <View style={[styles.sessionHeader, { backgroundColor: `${period.color}10` }]}>
        <View style={styles.sessionHeaderMain}>
          <View style={[styles.sessionIcon, { backgroundColor: `${period.color}18` }]}>
            {React.cloneElement(period.icon as React.ReactElement<{ size?: number; color?: string }>, {
              size: 20,
              color: period.color,
            })}
          </View>
          <View style={styles.sessionHeaderText}>
            <Text style={styles.sessionTitle}>{period.label}</Text>
            <Text style={styles.sessionTime}>{period.time}</Text>
          </View>
        </View>

        {isCurrent ? (
          <View style={[styles.sessionBadge, { backgroundColor: period.color }]}>
            <Text style={styles.sessionBadgeText}>Now</Text>
          </View>
        ) : allDone ? (
          <View style={[styles.sessionBadge, styles.sessionBadgeDone]}>
            <Check size={11} color={COLORS.success} strokeWidth={3} />
            <Text style={[styles.sessionBadgeText, styles.sessionBadgeTextDone]}>Complete</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.sessionContent}>
        <View style={styles.goalsSummary}>
          <Text style={styles.goalsSummaryText}>
            {completedCount} of {totalCount} goals complete
          </Text>
        </View>

        <View style={styles.metricsList}>
          {period.metrics.map((metric, index) => (
            <MetricRow
              key={metric.key}
              metric={metric}
              accentColor={period.color}
              isLast={index === period.metrics.length - 1}
              onSetWaterGlasses={onSetWaterGlasses}
            />
          ))}
        </View>

        {period.key === 'evening' && showRecoveryPrompt ? (
          <TouchableOpacity
            style={styles.recoveryBanner}
            onPress={onConvertNightStepsToWalk}
            activeOpacity={0.8}
          >
            <AlertCircle size={14} color="#D97706" />
            <View style={styles.recoveryBannerText}>
              <Text style={styles.recoveryTitle}>Missed earlier step targets</Text>
              <Text style={styles.recoveryBody}>
                {nightWalkRecoverySteps.toLocaleString()} steps left — convert to a{' '}
                {nightWalkRecoveryKm.toFixed(1)} km walk
              </Text>
            </View>
            <ChevronRight size={14} color="#D97706" />
          </TouchableOpacity>
        ) : null}

        {showTraining ? (
          <View style={styles.ctaGroup}>
            {isRunDay ? (
              <TouchableOpacity style={styles.primaryCta} onPress={() => onStartRun(runKmTarget)}>
                <Zap size={16} color="#FFF" fill="#FFF" />
                <Text style={styles.primaryCtaText}>{runStartCtaLabel}</Text>
              </TouchableOpacity>
            ) : null}
            {!exerciseCompleted ? (
              <TouchableOpacity style={styles.secondaryCta} onPress={onOpenMobility}>
                <Activity size={16} color="#FFF" />
                <Text style={styles.secondaryCtaText}>Start Exercise Session</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function DailyTab({
  selectedDate,
  loadingDaily,
  todayTarget,
  calorieTarget,
  waterIntake,
  stepSlots,
  stepTargets,
  exerciseCompleted,
  trainingTimePreference,
  onStartRun,
  showNightWalkRecoveryPrompt = false,
  nightWalkRecoverySteps = 0,
  nightWalkRecoveryKm = 0,
  onConvertNightStepsToWalk,
  onLogFood,
  onOpenMobility,
  onSetWaterGlasses,
  currentCalories,
}: DailyTabProps) {
  const scrollRef = useRef<ScrollView>(null);
  const scheduleTitle = useMemo(
    () => `${selectedDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'long' })} Schedule`,
    [selectedDate]
  );
  const currentHour = new Date().getHours();
  const totalTarget = todayTarget?.stepsTarget || 1;
  const morningStepsTarget = Math.max(0, stepTargets.morning || Math.round(totalTarget * 0.4));
  const afternoonStepsTarget = Math.max(0, stepTargets.afternoon || Math.round(totalTarget * 0.35));
  const eveningStepsTarget = Math.max(
    0,
    stepTargets.evening || totalTarget - morningStepsTarget - afternoonStepsTarget
  );

  const totalCalTarget = calorieTarget || 2200;
  const morningCalTarget = Math.round(totalCalTarget * 0.4);
  const afternoonCalTarget = Math.round(totalCalTarget * 0.35);
  const eveningCalTarget = totalCalTarget - morningCalTarget - afternoonCalTarget;

  const currentPeriod: SchedulePeriodKey =
    currentHour < 12 ? 'morning' : currentHour < 18 ? 'afternoon' : 'evening';
  const periodOrder: SchedulePeriodKey[] = ['morning', 'afternoon', 'evening'];
  const currentIndex = periodOrder.indexOf(currentPeriod);
  const [activeIndex, setActiveIndex] = useState(currentIndex);

  const morningCalActual =
    currentPeriod === 'morning' ? currentCalories : Math.round(currentCalories * 0.4);
  const afternoonCalActual =
    currentPeriod === 'morning'
      ? 0
      : currentPeriod === 'afternoon'
        ? currentCalories - morningCalActual
        : Math.round(currentCalories * 0.35);
  const eveningCalActual =
    currentPeriod === 'evening' ? currentCalories - morningCalActual - afternoonCalActual : 0;

  const preferredSchedulePeriod: SchedulePeriodKey =
    trainingTimePreference === 'morning'
      ? 'morning'
      : trainingTimePreference === 'afternoon'
        ? 'afternoon'
        : 'evening';

  const runKmTarget = Number(todayTarget?.runKm || 0);
  const runStartCtaLabel = getPlanSessionStartLabel(todayTarget?.runType, runKmTarget);
  const isRunDay = todayTarget?.dayType === 'RUN';
  const waterTargets = splitWaterGlassesAcrossPeriods(DAILY_WATER_GLASS_TARGET);

  const buildHydrationMetric = (period: SchedulePeriodKey): ScheduleMetric => {
    const { value, target, startGlass } = getWaterProgressForPeriod(
      waterIntake,
      period,
      waterTargets,
    );

    return {
      key: 'hydration',
      icon: <Flame />,
      label: 'Hydration',
      value,
      target,
      unit: 'glasses',
      isComplete: value >= target,
      isHydration: true,
      hydrationStart: startGlass,
    };
  };

  const buildMetrics = (period: SchedulePeriodKey): ScheduleMetric[] => {
    if (period === 'morning') {
      return [
        {
          key: 'steps',
          icon: <Footprints />,
          label: 'Steps',
          value: stepSlots.morning,
          target: morningStepsTarget,
          unit: 'steps',
          isComplete: stepSlots.morning >= morningStepsTarget,
        },
        {
          key: 'kcals',
          icon: <Flame />,
          label: 'Kcals',
          value: morningCalActual,
          target: morningCalTarget,
          unit: 'kcal',
          isComplete: morningCalActual >= morningCalTarget,
          onPress: () => onLogFood('morning'),
        },
        buildHydrationMetric('morning'),
      ];
    }

    if (period === 'afternoon') {
      return [
        {
          key: 'steps',
          icon: <Footprints />,
          label: 'Steps',
          value: stepSlots.afternoon,
          target: afternoonStepsTarget,
          unit: 'steps',
          isComplete: stepSlots.afternoon >= afternoonStepsTarget,
        },
        {
          key: 'kcals',
          icon: <Flame />,
          label: 'Kcals',
          value: afternoonCalActual,
          target: afternoonCalTarget,
          unit: 'kcal',
          isComplete: afternoonCalActual >= afternoonCalTarget,
          onPress: () => onLogFood('afternoon'),
        },
        buildHydrationMetric('afternoon'),
      ];
    }

    return [
      {
        key: 'steps',
        icon: <Footprints />,
        label: 'Steps',
        value: stepSlots.evening,
        target: eveningStepsTarget,
        unit: 'steps',
        isComplete: stepSlots.evening >= eveningStepsTarget,
      },
      {
        key: 'kcals',
        icon: <Flame />,
        label: 'Kcals',
        value: eveningCalActual,
        target: eveningCalTarget,
        unit: 'kcal',
        isComplete: eveningCalActual >= eveningCalTarget,
        onPress: () => onLogFood('evening'),
      },
      buildHydrationMetric('evening'),
    ];
  };

  const scheduleData = useMemo<SchedulePeriod[]>(
    () =>
      [
        {
          key: 'morning' as const,
          label: 'Morning Session',
          time: '6:00 – 12:00',
          icon: <Sun size={18} />,
          color: COLORS.primary,
        },
        {
          key: 'afternoon' as const,
          label: 'Afternoon Session',
          time: '12:00 – 6:00',
          icon: <Sunset size={18} />,
          color: COLORS.afternoon,
        },
        {
          key: 'evening' as const,
          label: 'Evening Session',
          time: '6:00 – 10:00',
          icon: <Moon size={18} />,
          color: COLORS.evening,
        },
      ].map((period, index) => ({
        ...period,
        metrics: buildMetrics(period.key),
        phase:
          index < currentIndex ? 'past' : index === currentIndex ? 'current' : ('future' as const),
      })),
    [
      currentIndex,
      stepSlots,
      waterIntake,
      currentCalories,
      morningStepsTarget,
      morningCalTarget,
      morningCalActual,
      afternoonStepsTarget,
      afternoonCalTarget,
      afternoonCalActual,
      eveningStepsTarget,
      eveningCalTarget,
      eveningCalActual,
      onLogFood,
    ]
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ x: currentIndex * PAGE_WIDTH, animated: false });
    setActiveIndex(currentIndex);
  }, [currentIndex]);

  const scrollToPeriod = (index: number) => {
    scrollRef.current?.scrollTo({ x: index * PAGE_WIDTH, animated: true });
    setActiveIndex(index);
  };

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = event.nativeEvent.contentOffset.x;
    const index = Math.round(offset / PAGE_WIDTH);
    setActiveIndex(Math.max(0, Math.min(scheduleData.length - 1, index)));
  };

  if (loadingDaily && !todayTarget) {
    return <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />;
  }
  if (!todayTarget) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>{scheduleTitle}</Text>

      <View style={styles.segmentBar}>
        {scheduleData.map((period, index) => {
          const isActive = activeIndex === index;
          const completed = period.metrics.every((m) => m.isComplete);
          return (
            <TouchableOpacity
              key={period.key}
              activeOpacity={0.85}
              onPress={() => scrollToPeriod(index)}
              style={[styles.segment, isActive && styles.segmentActive]}
            >
              <Text
                style={[
                  styles.segmentLabel,
                  isActive && { color: period.color },
                  completed && !isActive && styles.segmentLabelDone,
                ]}
                numberOfLines={1}
              >
                {period.label.replace(' Session', '')}
              </Text>
              {isActive ? (
                <View style={[styles.segmentIndicator, { backgroundColor: period.color }]} />
              ) : completed ? (
                <Check size={12} color={COLORS.success} strokeWidth={3} style={styles.segmentCheck} />
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        onMomentumScrollEnd={handleScrollEnd}
        style={styles.pager}
        contentContainerStyle={styles.pagerContent}
      >
        {scheduleData.map((period) => (
          <SessionPanel
            key={period.key}
            period={period}
            showRecoveryPrompt={period.key === 'evening' && showNightWalkRecoveryPrompt}
            nightWalkRecoverySteps={nightWalkRecoverySteps}
            nightWalkRecoveryKm={nightWalkRecoveryKm}
            onConvertNightStepsToWalk={onConvertNightStepsToWalk}
            showTraining={preferredSchedulePeriod === period.key}
            isRunDay={isRunDay}
            runKmTarget={runKmTarget}
            runStartCtaLabel={runStartCtaLabel}
            exerciseCompleted={exerciseCompleted}
            onStartRun={onStartRun}
            onOpenMobility={onOpenMobility}
            onSetWaterGlasses={onSetWaterGlasses}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const CONTENT_PAD = 24;

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    paddingBottom: 40,
    paddingTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textMain,
    marginBottom: 16,
  },
  segmentBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
    marginBottom: 0,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    position: 'relative',
  },
  segmentActive: {},
  segmentLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSub,
  },
  segmentLabelDone: {
    color: COLORS.success,
  },
  segmentIndicator: {
    position: 'absolute',
    bottom: 0,
    left: CONTENT_PAD / 2,
    right: CONTENT_PAD / 2,
    height: 3,
    borderRadius: 2,
    borderCurve: 'continuous',
  },
  segmentCheck: {
    position: 'absolute',
    bottom: 10,
  },
  pager: {
    marginHorizontal: -CONTENT_PAD,
  },
  pagerContent: {},
  page: {
    width: PAGE_WIDTH,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: CONTENT_PAD,
    paddingVertical: 18,
    gap: 12,
  },
  sessionHeaderMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  sessionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderCurve: 'continuous',
  },
  sessionHeaderText: {
    flex: 1,
  },
  sessionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textMain,
    letterSpacing: -0.3,
  },
  sessionTime: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSub,
    marginTop: 2,
  },
  sessionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderCurve: 'continuous',
  },
  sessionBadgeDone: {
    backgroundColor: COLORS.successFade,
  },
  sessionBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  sessionBadgeTextDone: {
    color: COLORS.success,
    textTransform: 'none',
  },
  sessionContent: {
    paddingHorizontal: CONTENT_PAD,
    paddingTop: 4,
    paddingBottom: 8,
    gap: 4,
  },
  goalsSummary: {
    paddingVertical: 10,
  },
  goalsSummaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSub,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  metricsList: {
    marginBottom: 8,
  },
  metricRow: {
    paddingVertical: 14,
    gap: 10,
  },
  metricRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.line,
  },
  metricRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  metricLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  metricLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  metricLabelDone: {
    color: COLORS.textSub,
  },
  metricCheck: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.successFade,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textMain,
    fontVariant: ['tabular-nums'],
  },
  metricTarget: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSub,
  },
  metricTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.inactive,
    overflow: 'hidden',
  },
  metricFill: {
    height: '100%',
    borderRadius: 3,
  },
  metricTapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  metricTapHintText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSub,
  },
  recoveryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderCurve: 'continuous',
    marginTop: 8,
    marginBottom: 4,
  },
  recoveryBannerText: {
    flex: 1,
    gap: 2,
  },
  recoveryTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#D97706',
  },
  recoveryBody: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    color: '#B45309',
  },
  ctaGroup: {
    gap: 10,
    marginTop: 12,
  },
  primaryCta: {
    backgroundColor: COLORS.primary,
    paddingVertical: 15,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderCurve: 'continuous',
  },
  primaryCtaText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 15,
  },
  secondaryCta: {
    backgroundColor: COLORS.secondary,
    paddingVertical: 15,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderCurve: 'continuous',
  },
  secondaryCtaText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 15,
  },
});
