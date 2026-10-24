import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Line,
  Path,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import {
  ArrowRight,
  BellRing,
  Bot,
  Check,
  ChevronLeft,
  Dumbbell,
  Flame,
  Footprints,
  Handshake,
  Heart,
  Scale,
  Sparkles,
  Target,
  Trophy,
  Users,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { APP_NAME } from '@/constants/branding';

const { width: windowWidth } = Dimensions.get('window');
const H_PADDING = 24;
const CHART_WIDTH = Math.min(windowWidth - H_PADDING * 2 - 32, 360);
const CHART_HEIGHT = 160;
const DRAW_EASE = Easing.bezier(0.22, 1, 0.36, 1);

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const COLORS = {
  coral: '#FF6B6B',
  coralDark: '#EE5253',
  coralSoft: '#FFF1F1',
  white: '#FFFFFF',
  black: '#0F172A',
  ink: '#111827',
  muted: '#6B7280',
  subtle: '#94A3B8',
  border: '#EEF0F4',
  hair: '#F3F4F6',
  card: '#FBFBFC',
  success: '#10B981',
  successSoft: '#ECFDF5',
  gridLine: '#EEF0F4',
};

type WeeklyPlanRow = {
  Week?: number;
  'Week name'?: string;
  'Expected weight'?: number;
  'Calories/day'?: number;
  'Protein/day'?: number;
  'Run km/week'?: number;
  'Steps/day target'?: number;
  'Week Dailys'?: {
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

const RUN_GOAL_LABELS: Record<string, string> = {
  '5k': '5K',
  '10k': '10K',
  half: 'Half Marathon',
  pr: 'a PR',
};

function formatTargetDate(dateStr?: string | null) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function addWeeks(date: Date, weeks: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + weeks * 7);
  return next;
}

// Catmull-Rom spline → cubic bezier for a soft, natural curve
function buildSmoothPath(points: Array<{ x: number; y: number }>, tension = 0.9) {
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

function buildSmoothArea(
  points: Array<{ x: number; y: number }>,
  baseY: number,
  tension = 0.9,
) {
  if (points.length === 0) return '';
  const line = buildSmoothPath(points, tension);
  const last = points[points.length - 1];
  const first = points[0];
  return `${line} L ${last.x} ${baseY} L ${first.x} ${baseY} Z`;
}

function approximatePathLength(points: Array<{ x: number; y: number }>) {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    length += Math.sqrt(dx * dx + dy * dy);
  }
  return Math.max(length * 1.35, 120);
}

// Add small organic wobble to intermediate points so the curve isn't a straight glide
function withOrganicJitter(
  values: number[],
  amplitudeRatio = 0.06,
): number[] {
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
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const chartDraw = useRef(new Animated.Value(0)).current;
  const areaOpacity = useRef(new Animated.Value(0)).current;
  const endDotOpacity = useRef(new Animated.Value(0)).current;
  const endDotScale = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 550, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 9, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const normalizedPlan = useMemo(() => {
    return (Array.isArray(weeklyPlan) ? weeklyPlan : [])
      .map((row) => ({
        week: Number(row?.Week),
        weekName: row?.['Week name'] || `Week ${row?.Week ?? ''}`,
        expectedWeight:
          typeof row?.['Expected weight'] === 'number' ? row['Expected weight'] : null,
        calories: typeof row?.['Calories/day'] === 'number' ? row['Calories/day'] : null,
        protein: typeof row?.['Protein/day'] === 'number' ? row['Protein/day'] : null,
        runKm: typeof row?.['Run km/week'] === 'number' ? row['Run km/week'] : null,
        steps: typeof row?.['Steps/day target'] === 'number' ? row['Steps/day target'] : null,
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
  const projectedEndDate = addWeeks(new Date(), totalWeeks);
  const targetDate =
    formatTargetDate((planData?.targetDate as string) || (planData?.runRaceDate as string)) ||
    formatTargetDate(projectedEndDate.toISOString());
  const shortEndDate = projectedEndDate.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
  const shortStartDate = new Date().toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });

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

  const goalPhrase = useMemo(() => {
    if (goalMode === 'running') {
      return `Prep for ${runGoalLabel}`;
    }
    if (weightDiff) {
      return `${isLoss ? 'Lose' : 'Gain'} ${weightDiff.toFixed(1)} ${weightUnit}`;
    }
    return 'Your personalized plan';
  }, [goalMode, runGoalLabel, weightDiff, weightUnit, isLoss]);

  const heroTitle = useMemo(() => {
    if (targetDate) return `${goalPhrase} on track by ${targetDate}`;
    return `${goalPhrase} — ${totalWeeks}-week plan`;
  }, [goalPhrase, targetDate, totalWeeks]);

  const chart = useMemo(() => {
    const padding = { left: 20, right: 20, top: 28, bottom: 30 };
    const innerW = CHART_WIDTH - padding.left - padding.right;
    const innerH = CHART_HEIGHT - padding.top - padding.bottom;
    const baseY = padding.top + innerH;

    const buildFrom = (
      rawValues: number[],
      caption: string,
      formatValue: (v: number) => string,
      jitterRatio = 0.08,
    ) => {
      const values = withOrganicJitter(rawValues, jitterRatio);
      const max = Math.max(...values);
      const min = Math.min(...values);
      const range = Math.max(max - min, 0.5);
      const points = values.map((value, index) => ({
        x: padding.left + (index / Math.max(values.length - 1, 1)) * innerW,
        y: padding.top + innerH - ((value - min) / range) * innerH,
      }));
      return {
        line: buildSmoothPath(points, 0.85),
        area: buildSmoothArea(points, baseY, 0.85),
        pathLength: approximatePathLength(points),
        start: points[0],
        end: points[points.length - 1],
        startLabel: formatValue(rawValues[0]),
        endLabel: formatValue(rawValues[rawValues.length - 1]),
        caption,
      };
    };

    if (goalMode === 'running') {
      const values = normalizedPlan.map((row) => row.runKm ?? 0);
      if (!values.length) return null;
      return buildFrom(values, 'Weekly distance', (v) => `${v.toFixed(1)} km`);
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
    return buildFrom(series, 'Weight trend', (v) => `${v.toFixed(1)} ${weightUnit}`, 0);
  }, [goalMode, goalWeight, normalizedPlan, startWeight, weekOne?.expectedWeight, weightUnit]);

  const chartPathLength = chart?.pathLength ?? 400;
  const chartStrokeDashoffset = chartDraw.interpolate({
    inputRange: [0, 1],
    outputRange: [chartPathLength, 0],
  });
  const endDotRingR = endDotScale.interpolate({
    inputRange: [0.55, 1],
    outputRange: [8, 13],
  });
  const endDotR = endDotScale.interpolate({
    inputRange: [0.55, 1],
    outputRange: [4, 6],
  });

  useEffect(() => {
    if (!chart) return;

    chartDraw.setValue(0);
    areaOpacity.setValue(0);
    endDotOpacity.setValue(0);
    endDotScale.setValue(0.55);

    Animated.parallel([
      Animated.timing(chartDraw, {
        toValue: 1,
        duration: 2400,
        easing: DRAW_EASE,
        useNativeDriver: false,
      }),
      Animated.sequence([
        Animated.delay(500),
        Animated.timing(areaOpacity, {
          toValue: 1,
          duration: 1600,
          easing: DRAW_EASE,
          useNativeDriver: false,
        }),
      ]),
      Animated.sequence([
        Animated.delay(2100),
        Animated.parallel([
          Animated.spring(endDotOpacity, {
            toValue: 1,
            friction: 7,
            tension: 90,
            useNativeDriver: false,
          }),
          Animated.spring(endDotScale, {
            toValue: 1,
            friction: 7,
            tension: 90,
            useNativeDriver: false,
          }),
        ]),
      ]),
    ]).start();
  }, [areaOpacity, chart, chartDraw, endDotOpacity, endDotScale]);

  const weeklySessionCount = useMemo(() => {
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

  const planLabel = weekOne?.weekName || 'Personalized plan';
  const trainingDays =
    availableDays.length > 0 ? `${availableDays.length} days / week` : 'Flexible';

  const reachBullets = [
    { icon: Dumbbell, text: 'Exercise plan matched to your level' },
    { icon: Footprints, text: 'Planned runs & walks each week' },
    { icon: Flame, text: 'Daily calorie & protein targets' },
    { icon: Heart, text: 'Partner motivation to keep you on track' },
  ];

  const whyFeatures = [
    {
      icon: Bot,
      title: `${APP_NAME} plans`,
      desc: 'Training tailored to your goals',
    },
    {
      icon: Handshake,
      title: 'Train together',
      desc: 'Stay accountable with your partner',
    },
    {
      icon: Trophy,
      title: 'Earn rewards',
      desc: 'Celebrate milestones together',
    },
    {
      icon: BellRing,
      title: 'Smart reminders',
      desc: 'Never miss a workout or meal log',
    },
  ];

  const infoItems = [
    {
      icon: Scale,
      label: 'Start',
      value: Number.isFinite(startWeight) ? `${startWeight} ${weightUnit}` : '—',
    },
    {
      icon: Target,
      label: 'Goal',
      value: Number.isFinite(goalWeight) ? `${goalWeight} ${weightUnit}` : '—',
    },
    { icon: Sparkles, label: 'Plan', value: planLabel },
    { icon: Users, label: 'Schedule', value: trainingDays },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.flex}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
            <ChevronLeft color={COLORS.black} size={28} />
          </TouchableOpacity>
        </View>

        <Animated.View
          style={[styles.flex, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
        >
          <ScrollView
            style={styles.flex}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* HERO */}
            <View style={styles.hero}>
              <Text style={styles.heroTitle}>{heroTitle}</Text>
            </View>

            {/* CHART CARD */}
            {chart && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{chart.caption}</Text>
                  <View style={styles.chartBadge}>
                    <Text style={styles.chartBadgeText}>{totalWeeks} weeks</Text>
                  </View>
                </View>

                <View style={styles.chartWrap}>
                  <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
                    <Defs>
                      <SvgLinearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={COLORS.coral} stopOpacity={0.28} />
                        <Stop offset="1" stopColor={COLORS.coral} stopOpacity={0.02} />
                      </SvgLinearGradient>
                    </Defs>

                    {[0.25, 0.5, 0.75].map((t) => (
                      <Line
                        key={t}
                        x1={20}
                        y1={28 + (CHART_HEIGHT - 58) * t}
                        x2={CHART_WIDTH - 20}
                        y2={28 + (CHART_HEIGHT - 58) * t}
                        stroke={COLORS.gridLine}
                        strokeWidth={1}
                        strokeDasharray="3 6"
                      />
                    ))}

                    <AnimatedPath
                      d={chart.area}
                      fill="url(#chartFill)"
                      opacity={areaOpacity}
                    />
                    <AnimatedPath
                      d={chart.line}
                      stroke={COLORS.coral}
                      strokeWidth={3.2}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray={chartPathLength}
                      strokeDashoffset={chartStrokeDashoffset}
                    />

                    {chart.start && (
                      <Circle
                        cx={chart.start.x}
                        cy={chart.start.y}
                        r={5}
                        fill={COLORS.white}
                        stroke={COLORS.coral}
                        strokeWidth={2.5}
                      />
                    )}
                    {chart.end && (
                      <>
                        <AnimatedCircle
                          cx={chart.end.x}
                          cy={chart.end.y}
                          r={endDotRingR}
                          fill={COLORS.coral}
                          opacity={endDotOpacity.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, 0.14],
                          })}
                        />
                        <AnimatedCircle
                          cx={chart.end.x}
                          cy={chart.end.y}
                          r={endDotR}
                          fill={COLORS.coral}
                          stroke={COLORS.white}
                          strokeWidth={2.5}
                          opacity={endDotOpacity}
                        />
                      </>
                    )}

                    {chart.start && (
                      <SvgText
                        x={chart.start.x}
                        y={CHART_HEIGHT - 8}
                        fontSize="10"
                        fontWeight="600"
                        fill={COLORS.subtle}
                        textAnchor="start"
                      >
                        {shortStartDate}
                      </SvgText>
                    )}
                    {chart.end && (
                      <SvgText
                        x={chart.end.x}
                        y={CHART_HEIGHT - 8}
                        fontSize="10"
                        fontWeight="700"
                        fill={COLORS.coral}
                        textAnchor="end"
                      >
                        {shortEndDate}
                      </SvgText>
                    )}
                  </Svg>
                </View>

                <View style={styles.chartFooter}>
                  <View style={styles.chartFootCol}>
                    <Text style={styles.chartFootLabel}>Today</Text>
                    <Text style={styles.chartFootValue}>{chart.startLabel}</Text>
                  </View>
                  <View style={styles.chartArrow}>
                    <ArrowRight size={16} color={COLORS.subtle} strokeWidth={2.5} />
                  </View>
                  <View style={[styles.chartFootCol, { alignItems: 'flex-end' }]}>
                    <Text style={styles.chartFootLabel}>Goal</Text>
                    <Text style={[styles.chartFootValue, { color: COLORS.coral }]}>
                      {chart.endLabel}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* STAT CARDS */}
            <View style={styles.statRow}>
              <View style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: COLORS.coralSoft }]}>
                  <Flame color={COLORS.coral} size={18} strokeWidth={2.4} />
                </View>
                <Text style={styles.statValue}>
                  {weekOne?.calories ? weekOne.calories.toLocaleString() : '—'}
                </Text>
                <Text style={styles.statLabel}>Calories</Text>
              </View>

              <View style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: COLORS.coralSoft }]}>
                  <Footprints color={COLORS.coral} size={18} strokeWidth={2.4} />
                </View>
                <Text style={styles.statValue}>{weeklySessionCount}</Text>
                <Text style={styles.statLabel}>Runs & walks</Text>
              </View>
            </View>

            {/* INFO */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Your info</Text>
              </View>
              <View style={styles.infoGrid}>
                {infoItems.map(({ icon: Icon, label, value }, idx) => (
                  <View
                    key={label}
                    style={[
                      styles.infoItem,
                      idx % 2 === 0 && styles.infoItemDivider,
                      idx < 2 && styles.infoItemRowDivider,
                    ]}
                  >
                    <View style={styles.infoIcon}>
                      <Icon size={14} color={COLORS.muted} strokeWidth={2.2} />
                    </View>
                    <View style={styles.infoText}>
                      <Text style={styles.infoLabel}>{label}</Text>
                      <Text style={styles.infoValue} numberOfLines={1}>
                        {value}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* HOW YOU'LL REACH */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>How you'll reach your goal</Text>
              </View>
              <View style={styles.reachList}>
                {reachBullets.map(({ icon: Icon, text }, idx) => (
                  <View
                    key={text}
                    style={[styles.reachRow, idx < reachBullets.length - 1 && styles.reachDivider]}
                  >
                    <View style={styles.reachIcon}>
                      <Icon size={16} color={COLORS.coral} strokeWidth={2.2} />
                    </View>
                    <Text style={styles.reachText}>{text}</Text>
                    <View style={styles.reachCheck}>
                      <Check size={12} color={COLORS.success} strokeWidth={3.5} />
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* WHY RUNTOGETHER */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Why it works</Text>
              </View>
              <View style={styles.featureList}>
                {whyFeatures.map(({ icon: Icon, title, desc }, idx) => (
                  <View
                    key={title}
                    style={[
                      styles.featureRow,
                      idx < whyFeatures.length - 1 && styles.reachDivider,
                    ]}
                  >
                    <View style={styles.featureIcon}>
                      <Icon size={18} color={COLORS.coral} strokeWidth={2.2} />
                    </View>
                    <View style={styles.featureTextWrap}>
                      <Text style={styles.featureTitle}>{title}</Text>
                      <Text style={styles.featureDesc}>{desc}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>

          {/* FOOTER */}
          <View style={styles.footer}>
            <TouchableOpacity activeOpacity={0.9} onPress={onContinue} style={styles.mainButton}>
              <LinearGradient
                colors={[COLORS.coral, COLORS.coralDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradientButton}
              >
                <Text style={styles.buttonText}>See my timeline</Text>
                <View style={styles.buttonArrow}>
                  <ArrowRight color={COLORS.white} size={18} strokeWidth={3} />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  flex: { flex: 1 },
  topBar: { paddingHorizontal: 12, paddingTop: 4 },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: H_PADDING,
    paddingBottom: 32,
  },

  // Hero
  hero: {
    marginTop: 2,
    marginBottom: 20,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.black,
    letterSpacing: -0.9,
    lineHeight: 34,
  },

  // Unified card
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.black,
    letterSpacing: -0.2,
  },

  // Chart
  chartBadge: {
    backgroundColor: COLORS.coralSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  chartBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.coral,
    letterSpacing: 0.1,
  },
  chartWrap: {
    alignItems: 'center',
    marginBottom: 4,
  },
  chartFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.hair,
  },
  chartFootCol: { flex: 1 },
  chartFootLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.subtle,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  chartFootValue: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.black,
    letterSpacing: -0.4,
  },
  chartArrow: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Stat row
  statRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.black,
    letterSpacing: -0.7,
    lineHeight: 28,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.black,
    marginTop: 2,
    letterSpacing: -0.15,
  },
  statSub: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.muted,
    marginTop: 3,
    lineHeight: 15,
  },

  // Info grid (2x2)
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  infoItem: {
    width: '50%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  infoItemDivider: {
    borderRightWidth: 1,
    borderRightColor: COLORS.hair,
    paddingRight: 12,
  },
  infoItemRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.hair,
  },
  infoIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: { flex: 1 },
  infoLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.subtle,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.black,
    letterSpacing: -0.2,
    marginTop: 2,
  },

  // Reach list (inside card)
  reachList: {},
  reachRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  reachDivider: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.hair,
  },
  reachIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: COLORS.coralSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reachText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.ink,
    lineHeight: 19,
    letterSpacing: -0.1,
  },
  reachCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Features (inside card)
  featureList: {},
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 14,
  },
  featureIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.coralSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTextWrap: { flex: 1, paddingTop: 2 },
  featureTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.black,
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  featureDesc: {
    fontSize: 12,
    fontWeight: '400',
    color: COLORS.muted,
    lineHeight: 17,
  },

  // Footer
  footer: {
    paddingHorizontal: H_PADDING,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 12 : 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.hair,
    backgroundColor: COLORS.white,
  },
  mainButton: {
    height: 58,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: COLORS.coral,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 16,
    elevation: 6,
  },
  gradientButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  buttonArrow: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
