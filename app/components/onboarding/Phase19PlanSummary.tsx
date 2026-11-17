import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  cancelAnimation,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Line, LinearGradient as SvgLinearGradient, Path, Stop } from 'react-native-svg';
import { Image } from 'expo-image';
import {
  ArrowRight,
  BellRing,
  Bot,
  CalendarDays,
  Check,
  Dumbbell,
  Flame,
  Footprints,
  Handshake,
  Heart,
  Route,
  Scale,
  Target,
  Trophy,
  type LucideIcon,
} from 'lucide-react-native';
import { APP_NAME } from '@/constants/branding';
import { C, EASE_OUT, OnboardingScreen, SURFACE_SELECTED, Sparkles, pop, rise, useCompact } from './OnboardingKit';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SCREEN_PADDING = 24;
const CARD_PADDING = 18;
const DRAW_EASING = Easing.bezier(0.33, 0, 0.2, 1);
const SUBTLE_INK = 'rgba(8, 36, 55, 0.5)';
const CAPTION_INK = 'rgba(8, 36, 55, 0.42)';
const CHART_PAD = { left: 10, right: 18, top: 14, bottom: 18 };
const ROW_STEP = 70;

const ENTER = {
  pill: 40,
  art: 120,
  titleLead: 160,
  titleDate: 240,
  subtitle: 320,
  chart: 400,
  chartDraw: 700,
  stats: 520,
  info: 680,
  infoItems: 740,
  reach: 1000,
  reachRows: 1060,
  why: 1380,
  whyRows: 1440,
  cta: 1760,
};

const REACH: { icon: LucideIcon; text: string }[] = [
  { icon: Dumbbell, text: 'Exercise plan matched to your level' },
  { icon: Footprints, text: 'Planned runs & walks each week' },
  { icon: Flame, text: 'Daily calorie & protein targets' },
  { icon: Heart, text: 'Partner motivation to keep you on track' },
];

const WHY: { icon: LucideIcon; text: string }[] = [
  { icon: Bot, text: `${APP_NAME} plans tailored to your goals` },
  { icon: Handshake, text: 'Stay accountable with your partner' },
  { icon: Trophy, text: 'Celebrate milestones together' },
  { icon: BellRing, text: 'Smart reminders for workouts and meal logs' },
];

type WeeklyPlanRow = {
  Week?: number;
  'Week name'?: string;
  'Expected weight'?: number;
  'Calories/day'?: number;
  'Protein/day'?: number;
  'Run km/week'?: number;
  'Steps/day target'?: number;
  'Week Dailys'?: {
    trainingSchedule?: { version: number; sessions: unknown[] };
    runDays?: number;
    stepDays?: number;
    recoveryDays?: number;
    runs?: Array<{ runType: string; sessions: number; targetKm?: number | null }>;
  };
};

type Props = {
  mainGoal?: string | null;
  currentWeight?: string | number;
  targetWeight?: string | number;
  weightUnit?: string;
  weeklyPlan?: WeeklyPlanRow[];
  planData?: Record<string, unknown>;
  availableDays?: number[];
  onBack: () => void;
  onContinue: () => void;
};

type Point = { x: number; y: number };

type ChartModel = {
  caption: string;
  line: string;
  area: string;
  pathLength: number;
  start: Point;
  end: Point;
  startLabel: string;
  endLabel: string;
  startCaption: string;
  endCaption: string;
};

const RUN_GOAL_LABELS: Record<string, string> = {
  '5k': '5K',
  '10k': '10K',
  half: 'Half Marathon',
  pr: 'a PR',
};

function parseDate(value: unknown) {
  if (typeof value !== 'string' || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addWeeks(date: Date, weeks: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + weeks * 7);
  return next;
}

// Catmull-Rom spline → cubic bezier for a soft, natural curve
function buildSmoothPath(points: Point[], tension = 0.9) {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  const d: string[] = [`M ${points[0].x} ${points[0].y}`];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    const cp1x = p1.x + ((p2.x - p0.x) / 6) * tension;
    const cp1y = p1.y + ((p2.y - p0.y) / 6) * tension;
    const cp2x = p2.x - ((p3.x - p1.x) / 6) * tension;
    const cp2y = p2.y - ((p3.y - p1.y) / 6) * tension;

    d.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`);
  }
  return d.join(' ');
}

function buildSmoothArea(points: Point[], baseY: number, tension = 0.9) {
  if (points.length === 0) return '';
  const line = buildSmoothPath(points, tension);
  const last = points[points.length - 1];
  const first = points[0];
  return `${line} L ${last.x} ${baseY} L ${first.x} ${baseY} Z`;
}

function approximatePathLength(points: Point[]) {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    length += Math.sqrt(dx * dx + dy * dy);
  }
  return Math.max(length * 1.35, 120);
}

// Add small organic wobble to intermediate points so the curve isn't a straight glide
function withOrganicJitter(values: number[], amplitudeRatio = 0.06): number[] {
  if (values.length < 3) return values;
  const first = values[0];
  const last = values[values.length - 1];
  const totalDelta = Math.abs(last - first) || 1;
  const amp = totalDelta * amplitudeRatio;
  return values.map((v, i) => {
    if (i === 0 || i === values.length - 1) return v;
    // Deterministic pseudo-random wobble that averages to zero
    const wobble = Math.sin(i * 1.7) * amp * 0.6 + Math.cos(i * 0.9) * amp * 0.4;
    return v + wobble;
  });
}

// Realistic weight trend: uneven progress with plateaus and small rebounds
function buildWeightTrendSeries(start: number, end: number, weeklyWeights: number[]): number[] {
  const delta = end - start;
  const magnitude = Math.abs(delta) || 1;
  const pointCount = Math.min(Math.max(weeklyWeights.length + 1, 8), 14);

  let base: number[];
  if (weeklyWeights.length >= 2) {
    base = [start, ...weeklyWeights.slice(0, -1), end];
  } else {
    base = Array.from({ length: pointCount }, (_, i) => {
      const t = i / (pointCount - 1);
      // Faster early change, slower finish — typical body-weight pattern
      const eased = 1 - Math.pow(1 - t, 1.35);
      let value = start + delta * eased;
      if (i > 0 && i < pointCount - 1) {
        const rebound = Math.sin(t * Math.PI * 2.6) * magnitude * 0.05;
        const plateau = Math.sin(t * Math.PI * 0.75 + 0.4) * magnitude * 0.035;
        value += rebound + plateau;
      }
      return value;
    });
  }

  base[0] = start;
  base[base.length - 1] = end;

  return withOrganicJitter(base, 0.14).map((v, i, arr) => {
    if (i === 0) return start;
    if (i === arr.length - 1) return end;
    return v;
  });
}

export default function Phase19PlanSummary({
  mainGoal,
  currentWeight,
  targetWeight,
  weightUnit = 'kg',
  weeklyPlan = [],
  planData,
  availableDays = [],
  onBack,
  onContinue,
}: Props) {
  const compact = useCompact();
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();
  const chartWidth = Math.min(width, 480) - SCREEN_PADDING * 2 - CARD_PADDING * 2;
  const chartHeight = compact ? 104 : 124;

  const normalizedPlan = useMemo(() => {
    return (Array.isArray(weeklyPlan) ? weeklyPlan : [])
      .map((row) => ({
        week: Number(row?.Week),
        weekName: row?.['Week name'] || `Week ${row?.Week ?? ''}`,
        expectedWeight:
          typeof row?.['Expected weight'] === 'number' ? row['Expected weight'] : null,
        calories: typeof row?.['Calories/day'] === 'number' ? row['Calories/day'] : null,
        runKm: typeof row?.['Run km/week'] === 'number' ? row['Run km/week'] : null,
        weekDailys: row?.['Week Dailys'],
      }))
      .filter((row) => Number.isFinite(row.week) && row.week > 0)
      .sort((a, b) => a.week - b.week);
  }, [weeklyPlan]);

  const weekOne = normalizedPlan[0] ?? null;
  const lastWeek = normalizedPlan[normalizedPlan.length - 1] ?? null;
  const totalWeeks = lastWeek?.week ?? normalizedPlan.length ?? 12;

  const startWeight = Number(currentWeight);
  const goalWeight = Number(targetWeight);
  const weightDiff =
    Number.isFinite(startWeight) && Number.isFinite(goalWeight)
      ? Math.abs(startWeight - goalWeight)
      : null;
  const isLoss = Number.isFinite(startWeight) && Number.isFinite(goalWeight) && goalWeight < startWeight;

  const runGoalKey = String(planData?.runGoal || '').toLowerCase();
  const runGoalLabel = RUN_GOAL_LABELS[runGoalKey] || 'your race';

  const endDate =
    parseDate(planData?.targetDate) ??
    parseDate(planData?.runRaceDate) ??
    addWeeks(new Date(), totalWeeks);
  const longEndDate = endDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const shortEndDate = endDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const shortStartDate = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

  const goalMode =
    mainGoal === 'running'
      ? 'running'
      : mainGoal === 'weightloss'
        ? 'weight'
        : mainGoal === 'both'
          ? 'both'
          : normalizedPlan.some((row) => (row.runKm ?? 0) > 0)
            ? 'running'
            : 'weight';

  const [lead, accent] =
    goalMode === 'running'
      ? ['Ready for', runGoalLabel]
      : weightDiff
        ? [isLoss ? 'Lose' : 'Gain', `${weightDiff.toFixed(1)}\u00A0${weightUnit}`]
        : ['Your', `${totalWeeks}-week plan`];

  const chart = useMemo<ChartModel | null>(() => {
    const innerW = chartWidth - CHART_PAD.left - CHART_PAD.right;
    const innerH = chartHeight - CHART_PAD.top - CHART_PAD.bottom;
    const baseY = CHART_PAD.top + innerH;

    const buildFrom = (
      rawValues: number[],
      captions: Pick<ChartModel, 'caption' | 'startCaption' | 'endCaption'>,
      formatValue: (v: number) => string,
      jitterRatio = 0.08,
    ): ChartModel => {
      const values = withOrganicJitter(rawValues, jitterRatio);
      const max = Math.max(...values);
      const min = Math.min(...values);
      const range = Math.max(max - min, 0.5);
      const points = values.map((value, index) => ({
        x: CHART_PAD.left + (index / Math.max(values.length - 1, 1)) * innerW,
        y: CHART_PAD.top + innerH - ((value - min) / range) * innerH,
      }));
      return {
        ...captions,
        line: buildSmoothPath(points, 0.85),
        area: buildSmoothArea(points, baseY, 0.85),
        pathLength: approximatePathLength(points),
        start: points[0],
        end: points[points.length - 1],
        startLabel: formatValue(rawValues[0]),
        endLabel: formatValue(rawValues[rawValues.length - 1]),
      };
    };

    if (goalMode === 'running') {
      const values = normalizedPlan.map((row) => row.runKm ?? 0);
      if (!values.length) return null;
      return buildFrom(
        values,
        { caption: 'Weekly distance', startCaption: 'Week 1', endCaption: 'Final week' },
        (v) => `${v.toFixed(1)} km`,
      );
    }

    const startVal = Number.isFinite(startWeight) ? startWeight : weekOne?.expectedWeight ?? null;
    const weights = normalizedPlan
      .map((row) => row.expectedWeight)
      .filter((value): value is number => typeof value === 'number');
    const endVal =
      (Number.isFinite(goalWeight) ? goalWeight : null) ??
      weights[weights.length - 1] ??
      startVal;

    if (startVal == null || endVal == null) return null;

    const series = buildWeightTrendSeries(startVal, endVal, weights);
    return buildFrom(
      series,
      { caption: 'Weight trend', startCaption: 'Today', endCaption: 'Goal' },
      (v) => `${v.toFixed(1)} ${weightUnit}`,
      0,
    );
  }, [chartWidth, chartHeight, goalMode, goalWeight, normalizedPlan, startWeight, weekOne?.expectedWeight, weightUnit]);

  const weeklySessionCount = useMemo(() => {
    const schedule = weekOne?.weekDailys?.trainingSchedule;
    if (schedule?.version === 1) return schedule.sessions.length;
    const runs = weekOne?.weekDailys?.runs ?? [];
    if (runs.length) {
      return runs.reduce((sum, run) => sum + (run.sessions > 0 ? run.sessions : 0), 0);
    }
    const dailys = weekOne?.weekDailys;
    if (dailys) {
      return (dailys.runDays ?? 0) + (dailys.stepDays ?? 0);
    }
    return (weekOne?.runKm ?? 0) > 0 ? 1 : 0;
  }, [weekOne]);

  const stats: { icon: LucideIcon; value: string; label: string }[] = [
    { icon: Flame, value: weekOne?.calories ? weekOne.calories.toLocaleString() : '—', label: 'Calories' },
    { icon: Footprints, value: String(weeklySessionCount), label: weekOne?.weekDailys?.trainingSchedule ? 'Training days' : 'Runs & walks' },
  ];

  const infoItems: { icon: LucideIcon; label: string; value: string }[] = [
    { icon: Scale, label: 'Start', value: Number.isFinite(startWeight) ? `${startWeight} ${weightUnit}` : '—' },
    { icon: Target, label: 'Goal', value: Number.isFinite(goalWeight) ? `${goalWeight} ${weightUnit}` : '—' },
    { icon: Route, label: 'Plan', value: weekOne?.weekName || 'Personalized plan' },
    { icon: CalendarDays, label: 'Schedule', value: availableDays.length > 0 ? `${availableDays.length} days / week` : 'Flexible' },
  ];

  const artSize = compact ? 64 : 76;

  return (
    <OnboardingScreen onBack={onBack} showBrand scrollable ctaLabel="Start my plan" onCta={onContinue} ctaDelay={ENTER.cta}>
      <Animated.View entering={rise(ENTER.pill)} style={[styles.pill, { marginTop: compact ? 12 : 20 }]}>
        <Text style={styles.pillText}>YOUR TIMELINE</Text>
      </Animated.View>

      <View style={[styles.hero, { paddingLeft: artSize * 0.55 }]}>
        <HeroArt size={artSize} reduced={reduced} />
        <View style={styles.titleBlock} accessible accessibilityRole="header" accessibilityLabel={`${lead} ${accent} by ${longEndDate}`}>
          <Animated.View entering={rise(ENTER.titleLead)} style={styles.titleLine}>
            <Text style={[styles.title, compact && styles.titleCompact]}>{lead}</Text>
            <Text style={[styles.title, styles.titleAccent, compact && styles.titleCompact]}>{accent}</Text>
          </Animated.View>
          <Animated.Text
            entering={rise(ENTER.titleDate)}
            style={[styles.title, compact && styles.titleCompact]}
            numberOfLines={1}
          >
            by {longEndDate}
          </Animated.Text>
          <Sparkles delay={ENTER.titleDate + 260} style={styles.titleSparkles} />
        </View>
      </View>

      <Animated.Text entering={rise(ENTER.subtitle)} style={styles.subtitle}>A clear path to your goal.</Animated.Text>

      {chart && (
        <Animated.View entering={rise(ENTER.chart)} style={[styles.card, { marginTop: compact ? 16 : 24 }]}>
          <TrendChart
            chart={chart}
            width={chartWidth}
            height={chartHeight}
            weeks={totalWeeks}
            startDate={shortStartDate}
            endDate={shortEndDate}
            reduced={reduced}
          />
        </Animated.View>
      )}

      <View style={styles.statRow}>
        {stats.map(({ icon: Icon, value, label }, index) => (
          <Animated.View
            key={label}
            entering={rise(ENTER.stats + index * ROW_STEP)}
            style={[styles.card, styles.statCard]}
            accessible
            accessibilityLabel={`${value} ${label}`}
          >
            <View style={styles.statTile}>
              <Icon color={C.coral} size={24} strokeWidth={2.2} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
              <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
            </View>
          </Animated.View>
        ))}
      </View>

      <Animated.View entering={rise(ENTER.info)} style={[styles.card, styles.sectionCard]}>
        <Text style={styles.cardTitle}>Your info</Text>
        <View style={styles.infoGrid}>
          {infoItems.map(({ icon: Icon, label, value }, index) => (
            <Animated.View
              key={label}
              entering={rise(ENTER.infoItems + index * ROW_STEP)}
              style={[
                styles.infoItem,
                index % 2 === 0 ? styles.infoItemLeft : styles.infoItemRight,
                index < 2 && styles.infoItemTop,
              ]}
              accessible
              accessibilityLabel={`${label}, ${value}`}
            >
              <View style={styles.infoTile}>
                <Icon color={SUBTLE_INK} size={16} strokeWidth={2.2} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.infoLabel}>{label}</Text>
                <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
              </View>
            </Animated.View>
          ))}
        </View>
      </Animated.View>

      <Animated.View entering={rise(ENTER.reach)} style={[styles.card, styles.sectionCard]}>
        <Text style={styles.cardTitle}>How you'll reach your goal</Text>
        <View style={styles.list}>
          {REACH.map(({ icon: Icon, text }, index) => {
            const delay = ENTER.reachRows + index * ROW_STEP;
            return (
              <Animated.View
                key={text}
                entering={rise(delay)}
                style={[styles.listRow, index < REACH.length - 1 && styles.listDivider]}
              >
                <View style={styles.listTile}>
                  <Icon color={C.coral} size={17} strokeWidth={2.2} />
                </View>
                <Text style={styles.listText}>{text}</Text>
                <Animated.View entering={pop(delay + 260)} style={styles.listCheck}>
                  <Check color={C.white} size={14} strokeWidth={3.4} />
                </Animated.View>
              </Animated.View>
            );
          })}
        </View>
      </Animated.View>

      <Animated.View entering={rise(ENTER.why)} style={[styles.card, styles.sectionCard]}>
        <Text style={styles.cardTitle}>Why it works</Text>
        <View style={styles.list}>
          {WHY.map(({ icon: Icon, text }, index) => (
            <Animated.View
              key={text}
              entering={rise(ENTER.whyRows + index * ROW_STEP)}
              style={[styles.listRow, index < WHY.length - 1 && styles.listDivider]}
              accessible
              accessibilityLabel={text}
            >
              <View style={styles.listTile}>
                <Icon color={C.coral} size={17} strokeWidth={2.2} />
              </View>
              <Text style={styles.listText} numberOfLines={1}>
                {text}
              </Text>
            </Animated.View>
          ))}
        </View>
      </Animated.View>
    </OnboardingScreen>
  );
}

function HeroArt({ size, reduced }: { size: number; reduced: boolean }) {
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    const easing = Easing.inOut(Easing.sin);
    t.set(withDelay(600, withRepeat(withSequence(
      withTiming(1, { duration: 1800, easing }),
      withTiming(0, { duration: 1800, easing }),
    ), -1)));
    return () => cancelAnimation(t);
  }, [reduced, t]);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -5 * t.get() }, { rotate: `${-10 + 4 * t.get()}deg` }],
  }));

  return (
    <Animated.View entering={pop(ENTER.art)} style={[styles.heroArt, { width: size, height: size }]} accessible={false}>
      <Animated.View style={floatStyle}>
        <Image source={require('../../assets/plan/plan-calendar.png')} style={{ width: size, height: size }} contentFit="contain" />
      </Animated.View>
    </Animated.View>
  );
}

function TrendChart({ chart, width, height, weeks, startDate, endDate, reduced }: {
  chart: ChartModel;
  width: number;
  height: number;
  weeks: number;
  startDate: string;
  endDate: string;
  reduced: boolean;
}) {
  const draw = useSharedValue(reduced ? 1 : 0);
  const dot = useSharedValue(reduced ? 1 : 0);
  const halo = useSharedValue(0);
  const pathLength = chart.pathLength;

  useEffect(() => {
    if (reduced) return;
    draw.set(withDelay(ENTER.chartDraw, withTiming(1, { duration: 1400, easing: DRAW_EASING })));
    dot.set(withDelay(ENTER.chartDraw + 1200, withTiming(1, { duration: 320, easing: EASE_OUT })));
    halo.set(withDelay(ENTER.chartDraw + 1500, withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1, false)));
    return () => {
      cancelAnimation(draw);
      cancelAnimation(dot);
      cancelAnimation(halo);
    };
  }, [reduced, draw, dot, halo]);

  const lineProps = useAnimatedProps(() => ({ strokeDashoffset: pathLength * (1 - draw.get()) }));
  const areaProps = useAnimatedProps(() => ({
    opacity: interpolate(draw.get(), [0.25, 1], [0, 1], Extrapolation.CLAMP),
  }));
  const dotProps = useAnimatedProps(() => ({ r: 6 * dot.get() }));
  const haloProps = useAnimatedProps(() => ({
    r: 6 + 10 * halo.get(),
    opacity: dot.get() * 0.22 * (1 - halo.get()),
  }));

  const innerH = height - CHART_PAD.top - CHART_PAD.bottom;

  return (
    <View accessible accessibilityLabel={`${chart.caption}: ${chart.startLabel} ${startDate} to ${chart.endLabel} by ${endDate}`}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{chart.caption}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{weeks} weeks</Text>
        </View>
      </View>

      <Svg width={width} height={height}>
        <Defs>
          <SvgLinearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={C.coral} stopOpacity={0.22} />
            <Stop offset="1" stopColor={C.coral} stopOpacity={0.01} />
          </SvgLinearGradient>
        </Defs>
        {[1 / 3, 2 / 3].map((t) => (
          <Line
            key={t}
            x1={CHART_PAD.left}
            x2={width - CHART_PAD.right}
            y1={CHART_PAD.top + innerH * t}
            y2={CHART_PAD.top + innerH * t}
            stroke={C.border}
            strokeWidth={1.5}
            strokeDasharray="4 6"
          />
        ))}
        <AnimatedPath d={chart.area} fill="url(#trendFill)" animatedProps={areaProps} />
        <AnimatedPath
          d={chart.line}
          stroke={C.coral}
          strokeWidth={3.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={`${pathLength} ${pathLength}`}
          animatedProps={lineProps}
        />
        <Circle cx={chart.start.x} cy={chart.start.y} r={5.5} fill={C.white} stroke={C.coral} strokeWidth={2.5} />
        <AnimatedCircle cx={chart.end.x} cy={chart.end.y} fill={C.coral} animatedProps={haloProps} />
        <AnimatedCircle cx={chart.end.x} cy={chart.end.y} fill={C.coral} stroke={C.white} strokeWidth={2.5} animatedProps={dotProps} />
      </Svg>

      <View style={styles.dateRow}>
        <Text style={styles.dateText}>{startDate}</Text>
        <Text style={[styles.dateText, styles.dateEnd]}>{endDate}</Text>
      </View>

      <View style={styles.trendFoot}>
        <View style={styles.flex}>
          <Text style={styles.caption}>{chart.startCaption}</Text>
          <Text style={styles.footValue}>{chart.startLabel}</Text>
        </View>
        <ArrowRight color={CAPTION_INK} size={20} strokeWidth={2.4} />
        <View style={[styles.flex, styles.alignEnd]}>
          <Text style={styles.caption}>{chart.endCaption}</Text>
          <Text style={[styles.footValue, styles.footGoal]}>{chart.endLabel}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  alignEnd: { alignItems: 'flex-end' },

  pill: { alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: SURFACE_SELECTED },
  pillText: { color: C.coral, fontSize: 13, fontWeight: '900', letterSpacing: 1.6 },
  hero: { marginTop: 12, justifyContent: 'center' },
  heroArt: { position: 'absolute', left: -4, top: 2 },
  titleBlock: { alignSelf: 'stretch' },
  titleLine: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'baseline', columnGap: 8 },
  title: { color: C.ink, fontSize: 38, lineHeight: 45, fontWeight: '900', letterSpacing: -1.5, textAlign: 'center' },
  titleCompact: { fontSize: 32, lineHeight: 38 },
  titleAccent: { color: C.coral, letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
  titleSparkles: { right: -10, top: -22 },
  subtitle: { color: SUBTLE_INK, fontSize: 16, fontWeight: '600', textAlign: 'center', marginTop: 8 },

  card: {
    borderRadius: 24,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: 'rgba(255, 255, 255, 0.86)',
    padding: CARD_PADDING,
    boxShadow: '0 6px 18px rgba(8, 36, 55, 0.05)',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  cardTitle: { color: C.ink, fontSize: 17, fontWeight: '800', letterSpacing: -0.4 },
  badge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, backgroundColor: SURFACE_SELECTED },
  badgeText: { color: C.coral, fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  caption: { color: CAPTION_INK, fontSize: 12, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },

  dateRow: { flexDirection: 'row', justifyContent: 'space-between', paddingLeft: CHART_PAD.left, marginTop: 2 },
  dateText: { color: CAPTION_INK, fontSize: 13, fontWeight: '700' },
  dateEnd: { color: C.coral },
  trendFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1.5,
    borderTopColor: C.track,
  },
  footValue: { color: C.ink, fontSize: 22, fontWeight: '900', letterSpacing: -0.8, marginTop: 2, fontVariant: ['tabular-nums'] },
  footGoal: { color: C.coral },

  statRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  statCard: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14 },
  statTile: { width: 48, height: 48, borderRadius: 16, borderCurve: 'continuous', backgroundColor: SURFACE_SELECTED, alignItems: 'center', justifyContent: 'center' },
  statValue: { color: C.ink, fontSize: 24, fontWeight: '900', letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  statLabel: { color: C.ink, fontSize: 14, fontWeight: '700', marginTop: 1 },

  sectionCard: { marginTop: 12, paddingBottom: 6 },
  list: { marginTop: 6 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  listDivider: { borderBottomWidth: 1.5, borderBottomColor: C.track },
  listTile: { width: 34, height: 34, borderRadius: 12, borderCurve: 'continuous', backgroundColor: SURFACE_SELECTED, alignItems: 'center', justifyContent: 'center' },
  listText: { flex: 1, color: C.ink, fontSize: 14, fontWeight: '600', lineHeight: 18 },
  listCheck: { width: 20, height: 20, borderRadius: 10, backgroundColor: C.coral, alignItems: 'center', justifyContent: 'center' },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
  infoItem: { width: '50%', flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
  infoItemLeft: { paddingRight: 10, borderRightWidth: 1.5, borderRightColor: C.track },
  infoItemRight: { paddingLeft: 12 },
  infoItemTop: { borderBottomWidth: 1.5, borderBottomColor: C.track },
  infoTile: { width: 32, height: 32, borderRadius: 12, borderCurve: 'continuous', backgroundColor: C.track, alignItems: 'center', justifyContent: 'center' },
  infoLabel: { color: CAPTION_INK, fontSize: 10, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  infoValue: { color: C.ink, fontSize: 13, fontWeight: '700', lineHeight: 17, marginTop: 1 },
});
