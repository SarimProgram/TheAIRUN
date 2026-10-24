import React, { useCallback, useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    ActivityIndicator,
    RefreshControl,
    Share,
    Modal,
} from 'react-native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
    Defs,
    LinearGradient as SvgGradient,
    RadialGradient as SvgRadial,
    Path,
    Circle,
    Stop,
} from 'react-native-svg';
import Animated, {
    Easing,
    FadeIn,
    useAnimatedProps,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withSpring,
    withTiming,
    runOnJS,
    useAnimatedReaction,
} from 'react-native-reanimated';
import {
    ArrowLeft,
    Calendar,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Crown,
    Flame,
    Footprints,
    Route,
    Scale,
    Share2,
    Star,
    X,
} from 'lucide-react-native';
import { useAuth } from '@/src/auth/authContext';
import { API_BASE_URL } from '@/config/api';
import { normalizeGender } from '@/utils/genderMascot';

const FEMALE_HERO = require('../assets/imagechat-female.png');
const MALE_HERO = require('../assets/imagechat-male.png');

// Ultra-clean, spacious light theme
const COLORS = {
    bg: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceAlt: '#F1F5F9',
    
    text: '#0F172A',
    textDim: '#334155',
    muted: '#64748B',
    subtle: '#94A3B8',

    mint: '#0D9488',
    mintSoft: '#CCFBF1',

    blue: '#2563EB',
    blueSoft: '#DBEAFE',

    purple: '#7C3AED',
    purpleSoft: '#EDE9FE',

    orange: '#EA580C',
    orangeSoft: '#FFEDD5',

    yellow: '#CA8A04',
    yellowSoft: '#FEF9C3',

    pink: '#DB2777',
    pinkSoft: '#FCE7F3',

    coral: '#FF6B6B',
    coralDeep: '#E24C5B',
    coralSoft: '#FFF1F2',
    partnerTeal: '#2EC4B6',

    statInk: '#0F172A',
    statMuted: '#64748B',
    statBorder: '#E2E8F0',
};

const SHADOW = '0 12px 32px rgba(148, 163, 184, 0.12)';
const ENTRANCE = Easing.bezier(0.23, 1, 0.32, 1);
const MAX_WRAP_WEEK_OFFSET = 11;
const AnimatedPath = Animated.createAnimatedComponent(Path);

type WrapParticipant = {
    id: string;
    displayName: string;
    totalSteps: number;
    totalDistanceKm: number;
    totalPoints: number;
    weightLostKg: number | null;
    workoutsCompleted?: number;
    activeCalories?: number;
    exerciseMinutes?: number;
};

type WrapDay = {
    dayKey: string;
    dayLabel: string;
    youSteps: number;
    partnerSteps: number;
    combinedSteps: number;
    combinedDistanceKm: number;
    combinedActiveMinutes?: number;
};

type WrapData = {
    hasPartner: boolean;
    weekStart: string;
    weekEnd: string;
    weekOffset?: number;
    canGoOlder?: boolean;
    canGoNewer?: boolean;
    winner: 'YOU' | 'PARTNER' | 'TIE';
    you: WrapParticipant;
    partner: WrapParticipant;
    days: WrapDay[];
    combined: {
        totalSteps: number;
        totalDistanceKm: number;
        totalPoints: number;
        weightLostKg: number | null;
        workoutsCompleted?: number;
        activeCalories?: number;
        exerciseMinutes?: number;
        daysActiveTogether?: number;
        activeMinutesGoal?: number;
    };
};

function formatWeekRange(weekStart: string, weekEnd: string) {
    const start = new Date(`${weekStart}T12:00:00`);
    const end = new Date(`${weekEnd}T12:00:00`);
    const year = end.getFullYear();
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}, ${year}`;
}

function getLocalDayKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function parseDayKeyUtc(dayKey: string) {
    const [y, m, d] = dayKey.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
}

function formatDayKeyUtc(date: Date) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getWeekStartMondayFromDayKey(dayKey: string) {
    const date = parseDayKeyUtc(dayKey);
    const dayOfWeek = date.getUTCDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    date.setUTCDate(date.getUTCDate() + mondayOffset);
    return date;
}

function getLastCompletedWeekMonday() {
    const thisWeekMonday = getWeekStartMondayFromDayKey(getLocalDayKey());
    const lastWeekMonday = new Date(thisWeekMonday);
    lastWeekMonday.setUTCDate(thisWeekMonday.getUTCDate() - 7);
    return lastWeekMonday;
}

function buildWrapWeekOptions() {
    const lastCompletedMonday = getLastCompletedWeekMonday();
    return Array.from({ length: MAX_WRAP_WEEK_OFFSET + 1 }, (_, offset) => {
        const weekMonday = new Date(lastCompletedMonday);
        weekMonday.setUTCDate(lastCompletedMonday.getUTCDate() - offset * 7);
        const weekEnd = new Date(weekMonday);
        weekEnd.setUTCDate(weekMonday.getUTCDate() + 6);
        const weekStart = formatDayKeyUtc(weekMonday);
        const weekEndKey = formatDayKeyUtc(weekEnd);
        return {
            offset,
            weekStart,
            weekEnd: weekEndKey,
            label: formatWeekRange(weekStart, weekEndKey),
        };
    });
}

function normalizeWrapPayload(data: Record<string, unknown>): WrapData {
    const you = (data.you ?? {}) as WrapParticipant;
    const partner = (data.partner ?? {}) as WrapParticipant;
    const days = Array.isArray(data.days) ? (data.days as WrapDay[]) : [];

    const fallbackWorkouts =
        (you.workoutsCompleted ?? 0) + (partner.workoutsCompleted ?? 0) ||
        days.filter((d) => d.combinedDistanceKm > 0).length;
    const fallbackCalories =
        (you.activeCalories ?? 0) + (partner.activeCalories ?? 0) ||
        Math.round((you.totalSteps ?? 0) + (partner.totalSteps ?? 0)) * 0.04;
    const fallbackMinutes =
        (you.exerciseMinutes ?? 0) + (partner.exerciseMinutes ?? 0) ||
        days.reduce((sum, d) => sum + (d.combinedActiveMinutes ?? 0), 0);
    const combined = (data.combined ?? {}) as WrapData['combined'];

    return {
        ...(data as WrapData),
        days,
        combined: {
            totalSteps: (you.totalSteps ?? 0) + (partner.totalSteps ?? 0),
            totalDistanceKm:
                Math.round(((you.totalDistanceKm ?? 0) + (partner.totalDistanceKm ?? 0)) * 10) / 10,
            totalPoints: (you.totalPoints ?? 0) + (partner.totalPoints ?? 0),
            weightLostKg:
                combined?.weightLostKg ??
                (() => {
                    const total = (you.weightLostKg ?? 0) + (partner.weightLostKg ?? 0);
                    return total > 0 ? Math.round(total * 10) / 10 : null;
                })(),
            workoutsCompleted: combined?.workoutsCompleted ?? fallbackWorkouts,
            activeCalories: combined?.activeCalories ?? Math.round(fallbackCalories),
            exerciseMinutes: combined?.exerciseMinutes ?? fallbackMinutes,
            daysActiveTogether:
                combined?.daysActiveTogether ??
                days.filter((d) => d.combinedSteps >= 1000).length,
            activeMinutesGoal: combined?.activeMinutesGoal ?? 300,
        },
    };
}

function formatSteps(value: number) {
    return value.toLocaleString();
}

function formatAxisSteps(value: number) {
    if (value >= 1000) return `${Math.round(value / 1000)}k`;
    return String(value);
}

function formatCompact(value: number) {
    if (value >= 10000) return `${(value / 1000).toFixed(0)}k`;
    return value.toLocaleString();
}

function getChartY(value: number, max: number, height: number, padding: number) {
    return height - padding - (value / max) * (height - padding * 2);
}

function useAnimatedCount(target: number, delay = 0, enabled = true) {
    const progress = useSharedValue(0);
    const [display, setDisplay] = useState(0);
    const reduceMotion = useReducedMotion();

    useEffect(() => {
        if (!enabled) return;
        if (reduceMotion) {
            setDisplay(target);
            return;
        }
        progress.value = 0;
        progress.value = withDelay(delay, withTiming(1, { duration: 900, easing: ENTRANCE }));
    }, [delay, enabled, progress, reduceMotion, target]);

    useAnimatedReaction(
        () => progress.value,
        (value) => runOnJS(setDisplay)(Math.round(value * target)),
        [target],
    );

    return display;
}

function buildSmoothLinePath(
    values: number[],
    width: number,
    height: number,
    padding: number,
    scaleMax?: number,
): string {
    if (values.length === 0) return '';
    const max = scaleMax ?? Math.max(...values, 1);
    const stepX = values.length > 1 ? (width - padding * 2) / (values.length - 1) : 0;

    const points = values.map((value, i) => ({
        x: padding + i * stepX,
        y: height - padding - (value / max) * (height - padding * 2),
    }));

    if (points.length < 2) return `M ${points[0].x} ${points[0].y}`;

    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];
        const cpX = (p0.x + p1.x) / 2;
        d += ` C ${cpX} ${p0.y}, ${cpX} ${p1.y}, ${p1.x} ${p1.y}`;
    }
    return d;
}

function getChartPoints(
    values: number[],
    width: number,
    height: number,
    padding: number,
    scaleMax?: number,
) {
    const max = scaleMax ?? Math.max(...values, 1);
    const stepX = values.length > 1 ? (width - padding * 2) / (values.length - 1) : 0;

    return values.map((value, i) => ({
        x: padding + i * stepX,
        y: height - padding - (value / max) * (height - padding * 2),
        value,
    }));
}

function buildAreaFromLine(
    line: string,
    height: number,
    padding: number,
    firstX: number,
    lastX: number,
): string {
    if (!line) return '';
    return `${line} L ${lastX} ${height - padding} L ${firstX} ${height - padding} Z`;
}

function getHeroAvatarSource(gender?: string | null) {
    return normalizeGender(gender) === 'male' ? MALE_HERO : FEMALE_HERO;
}

function HeroCloud({ side }: { side: 'left' | 'right' }) {
    const isLeft = side === 'left';
    const color = isLeft ? '#FF6B6B' : '#2EC4B6';
    const soft = isLeft ? 'rgba(255, 107, 107, 0.14)' : 'rgba(46, 196, 182, 0.14)';

    return (
        <View style={styles.heroCloudWrap} pointerEvents="none">
            <View style={[styles.cloudBlob, styles.cloudBlobMain, { backgroundColor: soft }]} />
            <View
                style={[
                    styles.cloudBlob,
                    styles.cloudBlobSecondary,
                    isLeft ? styles.cloudBlobSecondaryLeft : styles.cloudBlobSecondaryRight,
                    { backgroundColor: color, opacity: 0.12 },
                ]}
            />
            <View
                style={[
                    styles.cloudBlob,
                    styles.cloudBlobTertiary,
                    isLeft ? styles.cloudBlobTertiaryLeft : styles.cloudBlobTertiaryRight,
                    { backgroundColor: color, opacity: 0.08 },
                ]}
            />
        </View>
    );
}

function CroppedHeroAvatar({
    side,
    revealed,
    gender,
}: {
    side: 'left' | 'right';
    revealed: boolean;
    gender?: string | null;
}) {
    const reduceMotion = useReducedMotion();
    const scale = useSharedValue(reduceMotion ? 1 : 0.9);

    useEffect(() => {
        if (!revealed) return;
        scale.value = withDelay(
            side === 'left' ? 80 : 140,
            withSpring(1, { damping: 14, stiffness: 140 }),
        );
    }, [revealed, reduceMotion, scale, side]);

    const animStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const isLeft = side === 'left';
    const frameW = 96;
    const frameH = 112;
    const glowSize = 72;
    const accentGlow = isLeft ? 'rgba(255, 107, 107, 0.22)' : 'rgba(46, 196, 182, 0.22)';

    return (
        <Animated.View style={[styles.heroAvatarCol, animStyle]}>
            <View style={styles.heroAvatarBackdrop} pointerEvents="none">
                <HeroCloud side={side} />
                <View
                    style={[
                        styles.heroAvatarGlow,
                        {
                            width: glowSize,
                            height: glowSize,
                            borderRadius: glowSize / 2,
                            backgroundColor: accentGlow,
                        },
                    ]}
                />
            </View>
            <View style={styles.heroAvatarFrame}>
                <View style={isLeft ? undefined : styles.heroAvatarMirror}>
                    <Image
                        source={getHeroAvatarSource(gender)}
                        style={{
                            width: frameW,
                            height: frameH,
                        }}
                        contentFit="contain"
                        contentPosition="bottom"
                        backgroundColor="transparent"
                    />
                </View>
            </View>
        </Animated.View>
    );
}

function HeroCopy() {
    return (
        <View style={styles.heroCenter}>
            <View style={styles.heroTitleBlock}>
                <Text style={styles.heroTitlePrimary}>Weekly</Text>
                <Text style={styles.heroTitleAccent}>Wrap</Text>
            </View>
        </View>
    );
}

function SummaryStatItem({
    icon,
    value,
    label,
    badge,
}: {
    icon: React.ReactNode;
    value: string;
    label: string;
    badge?: string;
}) {
    return (
        <View style={styles.summaryStat}>
            <View style={styles.summaryStatIcon}>{icon}</View>
            <Text selectable style={styles.summaryStatValue}>
                {value}
            </Text>
            <Text style={styles.summaryStatLabel}>{label}</Text>
            {badge ? <Text style={styles.summaryStatBadge}>{badge}</Text> : null}
        </View>
    );
}

function formatDistanceKm(value: number) {
    return `${(Math.round(value * 10) / 10).toFixed(1)} km`;
}

function formatWeightLost(value: number | null | undefined) {
    if (value == null || !Number.isFinite(value) || value <= 0) return '—';
    return `${value.toFixed(1)} kg`;
}

function WeeklySummaryStrip({
    distanceKm,
    steps,
    calories,
    weightLost,
    daysActive,
    streakBadge,
}: {
    distanceKm: string;
    steps: string;
    calories: string;
    weightLost: string;
    daysActive: number;
    streakBadge: string | null;
}) {
    const topRow = [
        {
            key: 'distance',
            icon: <Route size={16} color={COLORS.statMuted} strokeWidth={2} />,
            value: distanceKm,
            label: 'Run/walk km',
        },
        {
            key: 'steps',
            icon: <Footprints size={16} color={COLORS.statMuted} strokeWidth={2} />,
            value: steps,
            label: 'Steps',
        },
        {
            key: 'calories',
            icon: <Flame size={16} color={COLORS.statMuted} strokeWidth={2} />,
            value: calories,
            label: 'Calories',
        },
    ];

    const bottomRow = [
        {
            key: 'weight',
            icon: <Scale size={16} color={COLORS.statMuted} strokeWidth={2} />,
            value: weightLost,
            label: 'Lost weight',
        },
        {
            key: 'days',
            icon: <Star size={16} color={COLORS.statMuted} strokeWidth={2} />,
            value: `${daysActive}`,
            label: 'Days active',
            badge: streakBadge ?? undefined,
        },
    ];

    return (
        <View style={styles.summaryGrid}>
            <View style={styles.summaryGridRow}>
                {topRow.map((item) => (
                    <SummaryStatItem
                        key={item.key}
                        icon={item.icon}
                        value={item.value}
                        label={item.label}
                    />
                ))}
            </View>
            <View style={styles.summaryGridRow}>
                {bottomRow.map((item) => (
                    <SummaryStatItem
                        key={item.key}
                        icon={item.icon}
                        value={item.value}
                        label={item.label}
                        badge={item.badge}
                    />
                ))}
            </View>
        </View>
    );
}

function ActivityChart({
    days,
    youName,
    partnerName,
    revealed,
}: {
    days: WrapDay[];
    youName: string;
    partnerName: string;
    revealed: boolean;
}) {
    const chartHeight = 150;
    const padding = 16;
    const yAxisWidth = 36;
    const reduceMotion = useReducedMotion();
    const drawProgress = useSharedValue(reduceMotion ? 1 : 0);
    const [plotWidth, setPlotWidth] = useState(0);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

    const youStepsValues = days.map((d) => d.youSteps);
    const partnerStepsValues = days.map((d) => d.partnerSteps);
    const stepsMax = Math.max(...youStepsValues, ...partnerStepsValues, 1);
    const yTicks = Array.from(
        new Set([
            stepsMax,
            Math.round(stepsMax * 0.75),
            Math.round(stepsMax * 0.5),
            Math.round(stepsMax * 0.25),
            0,
        ]),
    ).sort((a, b) => b - a);

    const youPath =
        plotWidth > 0
            ? buildSmoothLinePath(youStepsValues, plotWidth, chartHeight, padding, stepsMax)
            : '';
    const partnerPath =
        plotWidth > 0
            ? buildSmoothLinePath(partnerStepsValues, plotWidth, chartHeight, padding, stepsMax)
            : '';
    const youPoints =
        plotWidth > 0
            ? getChartPoints(youStepsValues, plotWidth, chartHeight, padding, stepsMax)
            : [];
    const partnerPoints =
        plotWidth > 0
            ? getChartPoints(partnerStepsValues, plotWidth, chartHeight, padding, stepsMax)
            : [];

    const peakIndex = youStepsValues.reduce(
        (maxI, v, i, arr) => (v + partnerStepsValues[i] > arr[maxI] + partnerStepsValues[maxI] ? i : maxI),
        0,
    );

    useEffect(() => {
        if (!revealed) return;
        drawProgress.value = withDelay(500, withTiming(1, { duration: 1100, easing: ENTRANCE }));
    }, [drawProgress, revealed, reduceMotion]);

    const animatedProps = useAnimatedProps(() => ({
        strokeDashoffset: (1 - drawProgress.value) * 600,
    }));

    const youLabel = youName?.trim().split(/\s+/)[0] || 'You';
    const partnerLabel = partnerName?.trim().split(/\s+/)[0] || 'Partner';
    const firstPointX = youPoints[0]?.x ?? padding;
    const lastPointX = youPoints[youPoints.length - 1]?.x ?? (plotWidth > 0 ? plotWidth - padding : padding);
    const selectedPointX = selectedIndex != null ? youPoints[selectedIndex]?.x ?? 0 : 0;
    const selectedDay = selectedIndex != null ? days[selectedIndex] : null;

    const handleSelectDay = (index: number) => {
        setSelectedIndex((current) => (current === index ? null : index));
    };

    return (
        <View style={styles.chartCard}>
            <View style={styles.chartHeader}>
                <View>
                    <Text style={styles.cardEyebrow}>LAST WEEK</Text>
                    <Text style={styles.cardTitle}>Steps</Text>
                </View>
                <View style={styles.chartLegend}>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: COLORS.coral }]} />
                        <Text style={styles.legendText}>{youLabel}</Text>
                    </View>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: COLORS.partnerTeal }]} />
                        <Text style={styles.legendText}>{partnerLabel}</Text>
                    </View>
                </View>
            </View>

            <View style={styles.chartPlotRow}>
                <View style={[styles.chartYAxis, { width: yAxisWidth, height: chartHeight }]}>
                    {yTicks.map((value, index) => (
                        <Text
                            key={`${value}-${index}`}
                            style={[
                                styles.chartYLabel,
                                { top: getChartY(value, stepsMax, chartHeight, padding) - 6 },
                            ]}
                        >
                            {formatAxisSteps(value)}
                        </Text>
                    ))}
                </View>

                <View
                    style={styles.chartPlotInner}
                    onLayout={(event) => {
                        const nextWidth = Math.round(event.nativeEvent.layout.width);
                        if (nextWidth > 0 && nextWidth !== plotWidth) {
                            setPlotWidth(nextWidth);
                        }
                    }}
                >
                {plotWidth > 0 ? (
                    <>
                        {selectedDay ? (
                            <View style={styles.chartTooltip}>
                                <Text style={styles.chartTooltipDay}>{selectedDay.dayLabel}</Text>
                                <View style={styles.chartTooltipRow}>
                                    <View style={[styles.chartTooltipDot, { backgroundColor: COLORS.coral }]} />
                                    <Text style={styles.chartTooltipLabel}>{youLabel}</Text>
                                    <Text style={styles.chartTooltipValue}>{formatSteps(selectedDay.youSteps)}</Text>
                                </View>
                                <View style={styles.chartTooltipRow}>
                                    <View style={[styles.chartTooltipDot, { backgroundColor: COLORS.partnerTeal }]} />
                                    <Text style={styles.chartTooltipLabel}>{partnerLabel}</Text>
                                    <Text style={styles.chartTooltipValue}>{formatSteps(selectedDay.partnerSteps)}</Text>
                                </View>
                            </View>
                        ) : null}

                        <View style={[styles.chartSvgWrap, { height: chartHeight }]}>
                            <Svg width={plotWidth} height={chartHeight}>
                                <Defs>
                                    <SvgGradient id="youStepsFill" x1="0" y1="0" x2="0" y2="1">
                                        <Stop offset="0" stopColor={COLORS.coral} stopOpacity="0.12" />
                                        <Stop offset="1" stopColor={COLORS.coral} stopOpacity="0" />
                                    </SvgGradient>
                                </Defs>
                                {[0.25, 0.5, 0.75].map((t) => (
                                    <Path
                                        key={t}
                                        d={`M ${firstPointX} ${padding + (chartHeight - padding * 2) * t} L ${lastPointX} ${padding + (chartHeight - padding * 2) * t}`}
                                        stroke={COLORS.surfaceAlt}
                                        strokeWidth={1.5}
                                    />
                                ))}
                                {selectedIndex != null ? (
                                    <Path
                                        d={`M ${selectedPointX} ${padding} L ${selectedPointX} ${chartHeight - padding}`}
                                        stroke={COLORS.subtle}
                                        strokeWidth={1}
                                        strokeDasharray="4 4"
                                    />
                                ) : null}
                                {youPath ? (
                                    <Path
                                        d={buildAreaFromLine(youPath, chartHeight, padding, firstPointX, lastPointX)}
                                        fill="url(#youStepsFill)"
                                    />
                                ) : null}
                                {youPath ? (
                                    <AnimatedPath
                                        d={youPath}
                                        stroke={COLORS.coral}
                                        strokeWidth={3}
                                        fill="none"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeDasharray={600}
                                        animatedProps={animatedProps}
                                    />
                                ) : null}
                                {partnerPath ? (
                                    <AnimatedPath
                                        d={partnerPath}
                                        stroke={COLORS.partnerTeal}
                                        strokeWidth={3}
                                        fill="none"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeDasharray={600}
                                        animatedProps={animatedProps}
                                    />
                                ) : null}
                                {youPoints.map((point, index) => {
                                    const isSelected = selectedIndex === index;
                                    return (
                                        <Circle
                                            key={`you-${days[index]?.dayKey ?? index}`}
                                            cx={point.x}
                                            cy={point.y}
                                            r={isSelected ? 6 : 4}
                                            fill={COLORS.surface}
                                            stroke={COLORS.coral}
                                            strokeWidth={isSelected ? 3 : 2.5}
                                            onPress={() => handleSelectDay(index)}
                                        />
                                    );
                                })}
                                {partnerPoints.map((point, index) => {
                                    const isSelected = selectedIndex === index;
                                    return (
                                        <Circle
                                            key={`partner-${days[index]?.dayKey ?? index}`}
                                            cx={point.x}
                                            cy={point.y}
                                            r={isSelected ? 6 : 4}
                                            fill={COLORS.surface}
                                            stroke={COLORS.partnerTeal}
                                            strokeWidth={isSelected ? 3 : 2.5}
                                            onPress={() => handleSelectDay(index)}
                                        />
                                    );
                                })}
                            </Svg>

                            {days.map((day, index) => {
                                const x = youPoints[index]?.x ?? 0;
                                return (
                                    <Pressable
                                        key={`hit-${day.dayKey}`}
                                        style={[
                                            styles.chartTouchColumn,
                                            {
                                                left: x - 18,
                                                width: 36,
                                                height: chartHeight,
                                            },
                                        ]}
                                        onPress={() => handleSelectDay(index)}
                                        accessibilityRole="button"
                                        accessibilityLabel={`${day.dayLabel}, ${youLabel} ${formatSteps(day.youSteps)} steps, ${partnerLabel} ${formatSteps(day.partnerSteps)} steps`}
                                    />
                                );
                            })}
                        </View>

                        <View style={styles.chartDays}>
                            {days.map((day, i) => (
                                <Pressable
                                    key={day.dayKey}
                                    onPress={() => handleSelectDay(i)}
                                    style={[
                                        styles.chartDayHit,
                                        {
                                            left: youPoints[i]?.x ?? 0,
                                            transform: [{ translateX: -18 }],
                                        },
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.chartDayLabel,
                                            (i === peakIndex || selectedIndex === i) && styles.chartDayLabelActive,
                                        ]}
                                    >
                                        {day.dayLabel}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                    </>
                ) : null}
                </View>
            </View>
        </View>
    );
}

function AnimatedWinnerCrown({ revealed }: { revealed: boolean }) {
    const reduceMotion = useReducedMotion();
    const floatY = useSharedValue(0);
    const scale = useSharedValue(reduceMotion ? 1 : 0.5);
    const rotate = useSharedValue(reduceMotion ? 0 : -10);

    useEffect(() => {
        if (!revealed) return;
        if (reduceMotion) return;

        scale.value = withDelay(280, withSpring(1, { damping: 11, stiffness: 170 }));
        rotate.value = withDelay(280, withSpring(0, { damping: 12, stiffness: 160 }));
        floatY.value = withDelay(
            520,
            withRepeat(
                withSequence(
                    withTiming(-5, { duration: 1300, easing: Easing.inOut(Easing.sin) }),
                    withTiming(0, { duration: 1300, easing: Easing.inOut(Easing.sin) }),
                ),
                -1,
                true,
            ),
        );
    }, [floatY, reduceMotion, revealed, rotate, scale]);

    const crownStyle = useAnimatedStyle(() => ({
        transform: [
            { translateY: floatY.value },
            { scale: scale.value },
            { rotate: `${rotate.value}deg` },
        ],
    }));

    return (
        <Animated.View style={[styles.winnerCrownWrap, crownStyle]}>
            <View style={styles.winnerCrownGlow} />
            <Crown size={34} color={COLORS.yellow} fill={COLORS.yellow} strokeWidth={0} />
        </Animated.View>
    );
}

function WeeklyWinnerRow({
    youName,
    partnerName,
    youPoints,
    partnerPoints,
    revealed,
}: {
    youName: string;
    partnerName: string;
    youPoints: number;
    partnerPoints: number;
    revealed: boolean;
}) {
    const reduceMotion = useReducedMotion();
    const youLabel = youName?.trim().split(/\s+/)[0] || 'You';
    const partnerLabel = partnerName?.trim().split(/\s+/)[0] || 'Partner';
    const isTie = youPoints === partnerPoints;
    const youWon = !isTie && youPoints > partnerPoints;
    const winnerFirstName = isTie ? 'Tie' : youWon ? youLabel : partnerLabel;

    const nameOpacity = useSharedValue(reduceMotion ? 1 : 0);
    const nameY = useSharedValue(reduceMotion ? 0 : 12);

    useEffect(() => {
        if (!revealed) return;
        if (reduceMotion) return;
        nameOpacity.value = withDelay(360, withTiming(1, { duration: 420, easing: ENTRANCE }));
        nameY.value = withDelay(360, withSpring(0, { damping: 14, stiffness: 160 }));
    }, [nameOpacity, nameY, reduceMotion, revealed]);

    const nameStyle = useAnimatedStyle(() => ({
        opacity: nameOpacity.value,
        transform: [{ translateY: nameY.value }],
    }));

    return (
        <Animated.View
            entering={reduceMotion ? undefined : FadeIn.delay(380).duration(360).easing(ENTRANCE)}
            style={styles.winnerCard}
        >
            <View style={styles.winnerLeft}>
                <Text style={styles.cardEyebrow}>POINTS</Text>
                <View style={styles.winnerPointsList}>
                    <View style={[styles.winnerPointsRow, youWon && styles.winnerPointsRowActive]}>
                        <View style={[styles.winnerPointsDot, { backgroundColor: COLORS.coral }]} />
                        <Text style={styles.winnerPointsName} numberOfLines={1}>
                            {youLabel}
                        </Text>
                        <Text style={[styles.winnerPointsValue, youWon && styles.winnerPointsValueActive]}>
                            {youPoints.toLocaleString()}
                        </Text>
                    </View>
                    <View style={[styles.winnerPointsRow, !isTie && !youWon && styles.winnerPointsRowActive]}>
                        <View style={[styles.winnerPointsDot, { backgroundColor: COLORS.partnerTeal }]} />
                        <Text style={styles.winnerPointsName} numberOfLines={1}>
                            {partnerLabel}
                        </Text>
                        <Text
                            style={[
                                styles.winnerPointsValue,
                                !isTie && !youWon && styles.winnerPointsValueActive,
                            ]}
                        >
                            {partnerPoints.toLocaleString()}
                        </Text>
                    </View>
                </View>
            </View>

            <View style={styles.winnerRight}>
                {!isTie ? <AnimatedWinnerCrown revealed={revealed} /> : null}
                <Animated.Text style={[styles.winnerName, nameStyle]} numberOfLines={2}>
                    {winnerFirstName}
                </Animated.Text>
                <Animated.Text style={[styles.winnerNameFull, nameStyle]} numberOfLines={2}>
                    {isTie ? `${youLabel} & ${partnerLabel}` : 'Winner'}
                </Animated.Text>
            </View>
        </Animated.View>
    );
}

export default function PartnerWrapScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { authFetch, isAuthenticated, user } = useAuth();
    const reduceMotion = useReducedMotion();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [wrap, setWrap] = useState<WrapData | null>(null);
    const [revealed, setRevealed] = useState(false);
    const [weekOffset, setWeekOffset] = useState(0);
    const [weekPickerOpen, setWeekPickerOpen] = useState(false);

    const weekOptions = React.useMemo(() => buildWrapWeekOptions(), []);

    const userGender = user?.gender ?? null;
    const partnerGender =
        normalizeGender(userGender) === 'female' ? 'male' : userGender ? 'female' : 'male';

    const fetchWrap = useCallback(
        async (isRefresh = false, offset = weekOffset) => {
            if (!isAuthenticated) return;
            if (isRefresh) setRefreshing(true);
            else {
                setLoading(true);
                setRevealed(false);
            }

            try {
                const res = await authFetch(
                    `${API_BASE_URL}/summary/partner/wrap?weekOffset=${offset}`,
                );
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error ?? 'Failed to load wrap');

                if (!data.hasPartner) {
                    router.replace('/Partner');
                    return;
                }

                setWrap(normalizeWrapPayload(data));
            } catch (error) {
                console.log('[PartnerWrap] fetch error:', error);
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        },
        [authFetch, isAuthenticated, router, weekOffset],
    );

    useEffect(() => {
        void fetchWrap(false, weekOffset);
    }, [fetchWrap, weekOffset]);

    useEffect(() => {
        if (!wrap || loading) return;
        const timer = setTimeout(() => setRevealed(true), reduceMotion ? 0 : 120);
        return () => clearTimeout(timer);
    }, [loading, reduceMotion, wrap]);

    const handleBack = () => {
        if (router.canGoBack()) router.back();
        else router.push('/Partner');
    };

    const handleShare = async () => {
        if (!wrap) return;
        await Share.share({
            message: [
                `Weekly Wrap (${formatWeekRange(wrap.weekStart, wrap.weekEnd)})`,
                `Together: ${formatSteps(wrap.combined.totalSteps)} steps`,
                `${formatDistanceKm(wrap.combined.totalDistanceKm ?? 0)} run/walk · ${formatWeightLost(wrap.combined.weightLostKg)} lost`,
            ].join('\n'),
        });
    };

    const canGoOlder = wrap?.canGoOlder ?? weekOffset < MAX_WRAP_WEEK_OFFSET;
    const canGoNewer = wrap?.canGoNewer ?? weekOffset > 0;

    const goOlderWeek = () => {
        if (!canGoOlder) return;
        setWeekOffset((current) => current + 1);
    };

    const goNewerWeek = () => {
        if (!canGoNewer) return;
        setWeekOffset((current) => Math.max(0, current - 1));
    };

    const selectWeekOffset = (offset: number) => {
        setWeekPickerOpen(false);
        setWeekOffset(offset);
    };

    const distanceKmTenths = useAnimatedCount(
        Math.round((wrap?.combined.totalDistanceKm ?? 0) * 10),
        200,
        revealed,
    );
    const steps = useAnimatedCount(wrap?.combined.totalSteps ?? 0, 260, revealed);
    const calories = useAnimatedCount(wrap?.combined.activeCalories ?? 0, 320, revealed);
    const weightLostTenths = useAnimatedCount(
        Math.round(Math.max(0, wrap?.combined.weightLostKg ?? 0) * 10),
        380,
        revealed,
    );
    const daysActive = useAnimatedCount(wrap?.combined.daysActiveTogether ?? 0, 440, revealed);

    const distanceKmLabel = (distanceKmTenths / 10).toFixed(1);
    const weightLostLabel =
        wrap?.combined.weightLostKg == null || wrap.combined.weightLostKg <= 0
            ? '—'
            : `${(weightLostTenths / 10).toFixed(1)} kg`;

    const streakBadge =
        (wrap?.combined.daysActiveTogether ?? 0) >= 5
            ? 'ON FIRE'
            : (wrap?.combined.daysActiveTogether ?? 0) >= 3
              ? 'STRONG'
              : null;

    if (!isAuthenticated) return null;

    return (
        <View style={styles.root}>
            <StatusBar style="dark" />

            <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 24) }]}>
                <Pressable onPress={handleBack} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
                    <ArrowLeft size={22} color={COLORS.text} strokeWidth={1.8} />
                </Pressable>

                {wrap ? (
                    <View style={styles.dateNavRow}>
                        <Pressable
                            onPress={goOlderWeek}
                            disabled={!canGoOlder}
                            style={({ pressed }) => [
                                styles.weekNavBtn,
                                !canGoOlder && styles.weekNavBtnDisabled,
                                pressed && canGoOlder && styles.pressed,
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel="Previous week"
                        >
                            <ChevronLeft
                                size={18}
                                color={canGoOlder ? COLORS.text : COLORS.subtle}
                                strokeWidth={2.2}
                            />
                        </Pressable>

                        <Pressable
                            onPress={() => setWeekPickerOpen(true)}
                            style={({ pressed }) => [styles.datePill, pressed && styles.pressed]}
                        >
                            <Calendar size={14} color={COLORS.muted} strokeWidth={2} />
                            <Text style={styles.datePillText} numberOfLines={1}>
                                {formatWeekRange(wrap.weekStart, wrap.weekEnd)}
                            </Text>
                            <ChevronDown size={14} color={COLORS.muted} strokeWidth={2} />
                        </Pressable>

                        <Pressable
                            onPress={goNewerWeek}
                            disabled={!canGoNewer}
                            style={({ pressed }) => [
                                styles.weekNavBtn,
                                !canGoNewer && styles.weekNavBtnDisabled,
                                pressed && canGoNewer && styles.pressed,
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel="Next week"
                        >
                            <ChevronRight
                                size={18}
                                color={canGoNewer ? COLORS.text : COLORS.subtle}
                                strokeWidth={2.2}
                            />
                        </Pressable>
                    </View>
                ) : (
                    <View style={styles.datePillPlaceholder} />
                )}

                <Pressable
                    onPress={handleShare}
                    disabled={!wrap}
                    style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed, !wrap && styles.disabled]}
                >
                    <Share2 size={20} color={COLORS.text} strokeWidth={1.8} />
                </Pressable>
            </View>

            {loading ? (
                <View style={styles.loadingWrap}>
                    <ActivityIndicator color={COLORS.mint} />
                </View>
            ) : wrap ? (
                <ScrollView
                    contentContainerStyle={[
                        styles.scroll,
                        { paddingBottom: Math.max(insets.bottom + 32, 48) },
                    ]}
                    showsVerticalScrollIndicator={false}
                    contentInsetAdjustmentBehavior="automatic"
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => fetchWrap(true)}
                            tintColor={COLORS.mint}
                        />
                    }
                >
                    <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(300).easing(ENTRANCE)} style={styles.pageStack}>
                        
                        <View style={styles.heroSummaryBlock}>
                            <View style={styles.heroPanel}>
                                <View style={styles.heroSection}>
                                    <CroppedHeroAvatar side="left" revealed={revealed} gender={userGender} />
                                    <HeroCopy />
                                    <CroppedHeroAvatar side="right" revealed={revealed} gender={partnerGender} />
                                </View>

                                <View style={styles.summaryDivider} />

                                <WeeklySummaryStrip
                                    distanceKm={distanceKmLabel}
                                    steps={formatCompact(steps)}
                                    calories={formatCompact(calories)}
                                    weightLost={weightLostLabel}
                                    daysActive={daysActive}
                                    streakBadge={streakBadge}
                                />
                            </View>
                        </View>

                        <ActivityChart
                            days={wrap.days}
                            youName={wrap.you.displayName}
                            partnerName={wrap.partner.displayName}
                            revealed={revealed}
                        />

                        <WeeklyWinnerRow
                            youName={wrap.you.displayName}
                            partnerName={wrap.partner.displayName}
                            youPoints={wrap.you.totalPoints ?? 0}
                            partnerPoints={wrap.partner.totalPoints ?? 0}
                            revealed={revealed}
                        />

                    </Animated.View>
                </ScrollView>
            ) : (
                <View style={styles.loadingWrap}>
                    <Text style={styles.emptyText}>Could not load wrap. Pull to refresh.</Text>
                </View>
            )}

            <Modal
                visible={weekPickerOpen}
                animationType="slide"
                transparent
                onRequestClose={() => setWeekPickerOpen(false)}
            >
                <View style={styles.weekPickerBackdrop}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={() => setWeekPickerOpen(false)} />
                    <View style={[styles.weekPickerSheet, { paddingBottom: Math.max(insets.bottom + 16, 24) }]}>
                        <View style={styles.weekPickerHeader}>
                            <Text style={styles.weekPickerTitle}>Choose week</Text>
                            <Pressable
                                onPress={() => setWeekPickerOpen(false)}
                                style={({ pressed }) => [styles.weekPickerCloseBtn, pressed && styles.pressed]}
                            >
                                <X size={18} color={COLORS.muted} strokeWidth={2.2} />
                            </Pressable>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            {weekOptions.map((option) => {
                                const selected = option.offset === weekOffset;
                                return (
                                    <Pressable
                                        key={option.offset}
                                        onPress={() => selectWeekOffset(option.offset)}
                                        style={({ pressed }) => [
                                            styles.weekPickerOption,
                                            selected && styles.weekPickerOptionSelected,
                                            pressed && styles.pressed,
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.weekPickerOptionText,
                                                selected && styles.weekPickerOptionTextSelected,
                                            ]}
                                        >
                                            {option.label}
                                        </Text>
                                        {option.offset === 0 ? (
                                            <Text style={styles.weekPickerOptionMeta}>Latest</Text>
                                        ) : null}
                                    </Pressable>
                                );
                            })}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: COLORS.bg },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 12,
        gap: 12,
    },
    iconBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.surface,
        alignItems: 'center',
        justifyContent: 'center',
        borderCurve: 'continuous',
        boxShadow: SHADOW,
    },
    pressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
    disabled: { opacity: 0.45 },
    dateNavRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        minWidth: 0,
    },
    weekNavBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.surfaceAlt,
    },
    weekNavBtnDisabled: {
        opacity: 0.45,
    },
    datePill: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        minWidth: 0,
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 999,
        borderCurve: 'continuous',
        backgroundColor: COLORS.surface,
        boxShadow: SHADOW,
    },
    datePillPlaceholder: { flex: 1, height: 44 },
    datePillText: {
        flexShrink: 1,
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.text,
        fontVariant: ['tabular-nums'],
    },
    weekPickerBackdrop: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(15, 23, 42, 0.35)',
    },
    weekPickerSheet: {
        maxHeight: '70%',
        backgroundColor: COLORS.surface,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingHorizontal: 20,
        paddingTop: 16,
    },
    weekPickerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    weekPickerTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: COLORS.text,
    },
    weekPickerCloseBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.surfaceAlt,
    },
    weekPickerOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 14,
        borderRadius: 16,
        marginBottom: 8,
        backgroundColor: COLORS.surfaceAlt,
    },
    weekPickerOptionSelected: {
        backgroundColor: COLORS.mintSoft,
        borderWidth: 1,
        borderColor: 'rgba(13, 148, 136, 0.25)',
    },
    weekPickerOptionText: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.text,
        flex: 1,
    },
    weekPickerOptionTextSelected: {
        color: COLORS.mint,
    },
    weekPickerOptionMeta: {
        fontSize: 11,
        fontWeight: '800',
        color: COLORS.muted,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
    },

    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    emptyText: { color: COLORS.muted, fontSize: 15 },
    scroll: { paddingHorizontal: 20, paddingTop: 0 },
    pageStack: { gap: 20 },
    heroSummaryBlock: {
        overflow: 'visible',
        marginTop: -6,
    },
    heroPanel: {
        backgroundColor: COLORS.surface,
        borderRadius: 28,
        paddingTop: 4,
        paddingBottom: 20,
        paddingHorizontal: 16,
        borderCurve: 'continuous',
        boxShadow: SHADOW,
    },

    // Hero
    heroSection: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        paddingTop: 0,
        paddingBottom: 0,
        gap: 0,
        overflow: 'hidden',
    },
    heroAvatarCol: {
        width: 100,
        height: 112,
        alignItems: 'center',
        justifyContent: 'flex-end',
        overflow: 'hidden',
    },
    heroAvatarBackdrop: {
        position: 'absolute',
        bottom: 0,
        width: 118,
        height: 112,
        alignItems: 'center',
        justifyContent: 'flex-end',
        zIndex: 0,
        overflow: 'hidden',
    },
    heroAvatarGlow: {
        position: 'absolute',
        bottom: 0,
        alignSelf: 'center',
    },
    heroCloudWrap: {
        position: 'absolute',
        bottom: 6,
        width: 108,
        height: 92,
        alignSelf: 'center',
    },
    cloudBlob: {
        position: 'absolute',
        borderCurve: 'continuous',
    },
    cloudBlobMain: {
        width: 108,
        height: 88,
        borderRadius: 54,
        bottom: 4,
        left: 5,
        transform: [{ scaleX: 1.15 }],
    },
    cloudBlobSecondary: {
        width: 72,
        height: 58,
        borderRadius: 36,
        bottom: 28,
    },
    cloudBlobSecondaryLeft: {
        left: 2,
    },
    cloudBlobSecondaryRight: {
        right: 2,
    },
    cloudBlobTertiary: {
        width: 52,
        height: 44,
        borderRadius: 26,
        bottom: 8,
    },
    cloudBlobTertiaryLeft: {
        right: 4,
    },
    cloudBlobTertiaryRight: {
        left: 4,
    },
    heroAvatarFrame: {
        width: 96,
        height: 112,
        alignItems: 'center',
        justifyContent: 'flex-end',
        zIndex: 2,
    },
    heroAvatarMirror: {
        transform: [{ scaleX: -1 }],
    },
    heroCenter: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingBottom: 28,
        paddingHorizontal: 4,
        zIndex: 1,
    },
    heroTitleBlock: {
        alignItems: 'center',
    },
    heroTitlePrimary: {
        fontSize: 24,
        fontWeight: '900',
        color: COLORS.text,
        letterSpacing: -1.1,
        lineHeight: 26,
        textAlign: 'center',
    },
    heroTitleAccent: {
        fontSize: 24,
        fontWeight: '900',
        color: COLORS.coralDeep,
        letterSpacing: -1.1,
        lineHeight: 26,
        textAlign: 'center',
        marginTop: -2,
    },

    // Summary stats
    summaryDivider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: COLORS.statBorder,
        marginTop: 0,
        marginBottom: 18,
    },
    summaryGrid: {
        gap: 20,
    },
    summaryGridRow: {
        flexDirection: 'row',
        gap: 12,
    },
    summaryStat: {
        flex: 1,
        minWidth: 0,
        alignItems: 'center',
        gap: 6,
    },
    summaryStatIcon: {
        opacity: 0.9,
    },
    summaryStatValue: {
        fontSize: 28,
        fontWeight: '900',
        color: COLORS.statInk,
        fontVariant: ['tabular-nums'],
        letterSpacing: -1.2,
        lineHeight: 30,
        textAlign: 'center',
    },
    summaryStatLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.statMuted,
        lineHeight: 15,
        textAlign: 'center',
    },
    summaryStatBadge: {
        marginTop: -2,
        fontSize: 9,
        fontWeight: '800',
        color: COLORS.coralDeep,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        textAlign: 'center',
    },

    // Chart
    chartCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 28,
        padding: 24,
        gap: 20,
        borderCurve: 'continuous',
        boxShadow: SHADOW,
    },
    chartHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
    },
    cardEyebrow: {
        fontSize: 11,
        fontWeight: '800',
        color: COLORS.muted,
        letterSpacing: 1.4,
        marginBottom: 4,
    },
    cardTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: COLORS.text,
        letterSpacing: -0.4,
    },
    chartLegend: { flexDirection: 'row', gap: 12, alignItems: 'center' },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { fontSize: 11, fontWeight: '700', color: COLORS.textDim, letterSpacing: 0.2 },
    chartPlotRow: { flexDirection: 'row', alignItems: 'flex-start' },
    chartYAxis: { position: 'relative' },
    chartYLabel: {
        position: 'absolute',
        right: 0,
        width: 32,
        fontSize: 10,
        fontWeight: '600',
        color: COLORS.subtle,
        textAlign: 'right',
    },
    chartPlotInner: { flex: 1, position: 'relative', gap: 10 },
    chartSvgWrap: {
        position: 'relative',
        width: '100%',
    },
    chartTouchColumn: {
        position: 'absolute',
        top: 0,
    },
    chartTooltip: {
        backgroundColor: COLORS.text,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 6,
        borderCurve: 'continuous',
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.18)',
    },
    chartTooltipDay: {
        fontSize: 11,
        fontWeight: '800',
        color: 'rgba(255,255,255,0.72)',
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    chartTooltipRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    chartTooltipDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
    },
    chartTooltipLabel: {
        flex: 1,
        fontSize: 12,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.82)',
    },
    chartTooltipValue: {
        fontSize: 12,
        fontWeight: '800',
        color: '#FFFFFF',
        fontVariant: ['tabular-nums'],
    },
    chartDays: {
        position: 'relative',
        height: 24,
        marginTop: 4,
    },
    chartDayHit: {
        position: 'absolute',
        width: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    chartDayLabel: {
        width: 28,
        fontSize: 11,
        fontWeight: '700',
        color: COLORS.subtle,
        letterSpacing: 0.2,
        textAlign: 'center',
    },
    chartDayLabelActive: { color: COLORS.coral },

    winnerCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 28,
        padding: 24,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 20,
        borderCurve: 'continuous',
        boxShadow: SHADOW,
    },
    winnerLeft: {
        flex: 1,
        gap: 12,
    },
    winnerPointsList: {
        gap: 10,
    },
    winnerPointsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 14,
        backgroundColor: COLORS.surfaceAlt,
        borderCurve: 'continuous',
    },
    winnerPointsRowActive: {
        backgroundColor: COLORS.yellowSoft,
    },
    winnerPointsDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    winnerPointsName: {
        flex: 1,
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.textDim,
    },
    winnerPointsValue: {
        fontSize: 15,
        fontWeight: '800',
        color: COLORS.text,
        fontVariant: ['tabular-nums'],
    },
    winnerPointsValueActive: {
        color: COLORS.coralDeep,
    },
    winnerRight: {
        width: 132,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
    },
    winnerCrownWrap: {
        width: 56,
        height: 56,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
    },
    winnerCrownGlow: {
        position: 'absolute',
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: COLORS.yellowSoft,
    },
    winnerName: {
        fontSize: 34,
        fontWeight: '900',
        color: COLORS.text,
        letterSpacing: -1.2,
        textAlign: 'center',
        lineHeight: 36,
    },
    winnerNameFull: {
        fontSize: 12,
        fontWeight: '700',
        color: COLORS.muted,
        textAlign: 'center',
        letterSpacing: 0.2,
    },
});
