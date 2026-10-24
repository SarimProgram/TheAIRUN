import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    TouchableOpacity,
    Platform,
    Image,
    ScrollView,
} from 'react-native';
import {
    X,
    Pause,
    Play,
    ChevronRight,
    RotateCcw,
    Check,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Circle } from 'react-native-svg';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { InstructionsPanel } from './InstructionsPanel';

const COLORS = {
    bg: '#F7F8FA',
    card: '#FFFFFF',
    textMain: '#1A1C1E',
    textSub: '#6C757D',
    textMuted: '#ADB5BD',
    line: '#EEF0F3',
    success: '#00B894',
};

const TIMER_SIZE = 140;
const TOTAL_TIMER_SIZE = 44;
const STROKE_WIDTH = 6;
const RADIUS = (TIMER_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const TOTAL_RADIUS = (TOTAL_TIMER_SIZE - STROKE_WIDTH) / 2;
const TOTAL_CIRCUMFERENCE = 2 * Math.PI * TOTAL_RADIUS;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export type MobilityExercise = {
    id: number;
    name: string;
    duration: string;
    reps: string;
    description: string;
    instructions: string[];
    benefits: string[];
    imagePlaceholder: string;
    image?: any;
    color: string;
    objective: 'Weight Loss' | 'Better Running';
    kcals: number;
    bodyPart: 'Lower Body' | 'Upper Body' | 'Full Body' | 'Core';
    selectionRole: 'lower' | 'upper' | 'posterior' | 'core';
    homeBased: boolean;
    baseReps?: number;
    perLeg?: boolean;
    timedSeconds?: number;
};

type WorkoutExercisePlan = {
    exercise: MobilityExercise;
    rounds: number;
    targetLabel: string;
    setLabel: string;
    setDurationSeconds: number;
};

type SessionPhase = {
    key: string;
    type: 'warmup' | 'exercise' | 'cooldown';
    title: string;
    subtitle: string;
    instruction: string;
    durationSeconds: number;
    targetLabel?: string;
    roundNumber?: number;
    roundTotal?: number;
    exercise?: MobilityExercise;
};

type WorkoutSessionPlan = {
    week: number;
    warmupMinutes: number;
    cooldownMinutes: number;
    workoutExercises: WorkoutExercisePlan[];
    totalMinutes: number;
    phases: SessionPhase[];
};

type Props = {
    exercises: MobilityExercise[];
    currentWeek: number;
    onClose: () => void;
    onComplete: () => void;
};

const WARMUP_INSTRUCTIONS = [
    'Do some light movements to get your body ready for exercise.',
];

const COOLDOWN_INSTRUCTIONS = [
    'Move your feet slowly. Relax your arms and shoulders. Take slow breaths. Stop when your breathing feels normal.',
];

function clampWeek(week: number) {
    if (!Number.isFinite(week)) return 1;
    return Math.max(1, Math.min(12, Math.floor(week)));
}

function hexToRgba(hex: string, alpha: number) {
    const normalized = hex.replace('#', '');
    const value =
        normalized.length === 3
            ? normalized
                  .split('')
                  .map((char) => char + char)
                  .join('')
            : normalized;
    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getPhaseColor(phase: SessionPhase) {
    if (phase.exercise?.color) return phase.exercise.color;
    if (phase.type === 'warmup') return '#339AF0';
    if (phase.type === 'cooldown') return COLORS.success;
    return '#6366F1';
}

function getPhaseTypeLabel(type: SessionPhase['type']) {
    if (type === 'warmup') return 'Warm up';
    if (type === 'cooldown') return 'Cool down';
    return 'Exercise';
}

function getSetBlockState(
    setNumber: number,
    roundNumber: number,
    status: 'completed' | 'current' | 'upcoming',
) {
    if (status === 'completed') {
        return setNumber <= roundNumber ? 'done' : 'empty';
    }
    if (status === 'current') {
        if (setNumber < roundNumber) return 'done';
        if (setNumber === roundNumber) return 'active';
        return 'empty';
    }
    if (setNumber < roundNumber) return 'done';
    return 'empty';
}

export function formatClock(totalSeconds: number) {
    const safeSeconds = Math.max(0, totalSeconds);
    const minutes = Math.floor(safeSeconds / 60);
    const seconds = safeSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function buildExercisePrescription(exercise: MobilityExercise, currentWeek: number) {
    const week = clampWeek(currentWeek);
    const rounds = Math.min(3 + Math.floor((week - 1) / 4), 5);

    if (exercise.timedSeconds) {
        const seconds = Math.min(exercise.timedSeconds + (Math.floor((week - 1) / 4) * 10), exercise.timedSeconds + 30);
        return {
            rounds,
            targetLabel: `${rounds} x ${seconds} sec`,
            setLabel: `${seconds} sec`,
            setDurationSeconds: seconds,
        };
    }

    const baseReps = exercise.baseReps ?? 10;
    const reps = baseReps + (Math.floor((week - 1) / 3) * 2);
    const repLabel = exercise.perLeg ? `${reps} reps each leg` : `${reps} reps`;

    return {
        rounds,
        targetLabel: `${rounds} x ${repLabel}`,
        setLabel: repLabel,
        setDurationSeconds: Math.min(75 + (Math.floor((week - 1) / 3) * 10), 105),
    };
}

function rotatePick(exercises: MobilityExercise[], week: number, role: MobilityExercise['selectionRole']) {
    const candidates = exercises.filter((exercise) => exercise.selectionRole === role);
    if (!candidates.length) return null;
    return candidates[(week - 1) % candidates.length];
}

export function buildWorkoutSessionPlan(exercises: MobilityExercise[], currentWeek: number): WorkoutSessionPlan {
    const week = clampWeek(currentWeek);
    const warmupMinutes = Math.min(4 + Math.floor((week - 1) / 6), 6);
    const cooldownMinutes = Math.min(2 + Math.floor((week - 1) / 6), 4);

    const selectedExercises = [
        rotatePick(exercises, week, 'lower'),
        rotatePick(exercises, week + 1, 'upper'),
        rotatePick(exercises, week + 2, 'posterior'),
        rotatePick(exercises, week + 3, 'core'),
    ].filter((exercise): exercise is MobilityExercise => Boolean(exercise));

    const workoutExercises = selectedExercises.map((exercise) => {
        const prescription = buildExercisePrescription(exercise, week);
        return {
            exercise,
            rounds: prescription.rounds,
            targetLabel: prescription.targetLabel,
            setLabel: prescription.setLabel,
            setDurationSeconds: prescription.setDurationSeconds,
        };
    });

    const phases: SessionPhase[] = [
        {
            key: 'warmup',
            type: 'warmup',
            title: 'Warm Up',
            subtitle: `${warmupMinutes} min prep`,
            instruction: WARMUP_INSTRUCTIONS[(week - 1) % WARMUP_INSTRUCTIONS.length],
            durationSeconds: warmupMinutes * 60,
        },
    ];

    workoutExercises.forEach((block) => {
        for (let round = 1; round <= block.rounds; round += 1) {
            phases.push({
                key: `${block.exercise.id}-${round}`,
                type: 'exercise',
                title: block.exercise.name,
                subtitle: `Set ${round} of ${block.rounds} · ${block.setLabel}`,
                instruction: block.exercise.instructions.join(' '),
                durationSeconds: block.setDurationSeconds,
                targetLabel: block.targetLabel,
                roundNumber: round,
                roundTotal: block.rounds,
                exercise: block.exercise,
            });
        }
    });

    phases.push({
        key: 'cooldown',
        type: 'cooldown',
        title: 'Cool Down',
        subtitle: `${cooldownMinutes} min reset`,
        instruction: COOLDOWN_INSTRUCTIONS[(week - 1) % COOLDOWN_INSTRUCTIONS.length],
        durationSeconds: cooldownMinutes * 60,
    });

    const totalSeconds = phases.reduce((sum, phase) => sum + phase.durationSeconds, 0);

    return {
        week,
        warmupMinutes,
        cooldownMinutes,
        workoutExercises,
        totalMinutes: Math.ceil(totalSeconds / 60),
        phases,
    };
}

export function GuidedMobility({ exercises, currentWeek, onClose, onComplete }: Props) {
    const insets = useSafeAreaInsets();
    const sessionPlan = useMemo(() => buildWorkoutSessionPlan(exercises, currentWeek), [exercises, currentWeek]);

    const [phaseIndex, setPhaseIndex] = useState(0);
    const currentPhase = sessionPlan.phases[phaseIndex];

    const activeExercise = currentPhase.exercise ?? sessionPlan.workoutExercises[0]?.exercise ?? exercises[0];
    const accentColor = getPhaseColor(currentPhase);
    const accentSoft = hexToRgba(accentColor, 0.12);
    const accentBorder = hexToRgba(accentColor, 0.22);

    const [isActive, setIsActive] = useState(true);
    const [phaseSecondsLeft, setPhaseSecondsLeft] = useState(sessionPlan.phases[0]?.durationSeconds ?? 0);
    const [totalSecondsLeft, setTotalSecondsLeft] = useState(
        sessionPlan.phases.reduce((sum, phase) => sum + phase.durationSeconds, 0),
    );

    const phaseAnim = useRef(new Animated.Value(1)).current;
    const totalAnim = useRef(new Animated.Value(1)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const totalDurationSeconds = sessionPlan.phases.reduce((sum, phase) => sum + phase.durationSeconds, 0);
    const sessionProgress = totalDurationSeconds > 0 ? 1 - totalSecondsLeft / totalDurationSeconds : 0;

    useEffect(() => {
        setPhaseIndex(0);
        setIsActive(true);
        setPhaseSecondsLeft(sessionPlan.phases[0]?.durationSeconds ?? 0);
        setTotalSecondsLeft(totalDurationSeconds);
        phaseAnim.setValue(1);
        totalAnim.setValue(1);
        Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
    }, [sessionPlan, totalDurationSeconds, phaseAnim, totalAnim, fadeAnim]);

    useEffect(() => {
        if (!currentPhase) return;
        let interval: ReturnType<typeof setInterval> | null = null;

        if (isActive && phaseSecondsLeft > 0 && totalSecondsLeft > 0) {
            interval = setInterval(() => {
                setPhaseSecondsLeft((seconds) => Math.max(0, seconds - 1));
                setTotalSecondsLeft((seconds) => Math.max(0, seconds - 1));
            }, 1000);
        } else if (phaseSecondsLeft === 0) {
            handleAdvancePhase();
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isActive, phaseSecondsLeft, totalSecondsLeft, currentPhase]);

    useEffect(() => {
        if (!currentPhase) return;
        Animated.timing(phaseAnim, {
            toValue: currentPhase.durationSeconds > 0 ? phaseSecondsLeft / currentPhase.durationSeconds : 0,
            duration: 250,
            useNativeDriver: true,
        }).start();
    }, [phaseSecondsLeft, currentPhase, phaseAnim]);

    useEffect(() => {
        Animated.timing(totalAnim, {
            toValue: totalDurationSeconds > 0 ? totalSecondsLeft / totalDurationSeconds : 0,
            duration: 250,
            useNativeDriver: true,
        }).start();
    }, [totalSecondsLeft, totalDurationSeconds, totalAnim]);

    const handleAdvancePhase = () => {
        if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }

        if (phaseIndex < sessionPlan.phases.length - 1) {
            const nextPhase = sessionPlan.phases[phaseIndex + 1];
            setPhaseIndex((index) => index + 1);
            setPhaseSecondsLeft(nextPhase.durationSeconds);
            return;
        }

        onComplete();
        onClose();
    };

    const handleRestart = () => {
        Haptics.selectionAsync();
        setPhaseIndex(0);
        setIsActive(true);
        setPhaseSecondsLeft(sessionPlan.phases[0]?.durationSeconds ?? 0);
        setTotalSecondsLeft(totalDurationSeconds);
    };

    const handleToggleActive = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setIsActive((value) => !value);
    };

    const phaseStrokeDashoffset = phaseAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [CIRCUMFERENCE, 0],
    });

    const totalStrokeDashoffset = totalAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [TOTAL_CIRCUMFERENCE, 0],
    });

    if (!currentPhase || !activeExercise) return null;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onClose} style={styles.headerBtn} activeOpacity={0.7}>
                    <X color={COLORS.textMain} size={20} strokeWidth={2.5} />
                </TouchableOpacity>
                <View style={styles.headerInfo}>
                    <Text style={styles.headerTitle}>Exercise Session</Text>
                    <Text style={styles.headerSub}>
                        Week {sessionPlan.week} · {sessionPlan.totalMinutes} min
                    </Text>
                </View>
                <View style={styles.progressionCircle}>
                    <Svg width={TOTAL_TIMER_SIZE} height={TOTAL_TIMER_SIZE}>
                        <Circle
                            cx={TOTAL_TIMER_SIZE / 2}
                            cy={TOTAL_TIMER_SIZE / 2}
                            r={TOTAL_RADIUS}
                            stroke={COLORS.line}
                            strokeWidth={STROKE_WIDTH - 1}
                            fill="transparent"
                        />
                        <AnimatedCircle
                            cx={TOTAL_TIMER_SIZE / 2}
                            cy={TOTAL_TIMER_SIZE / 2}
                            r={TOTAL_RADIUS}
                            stroke={accentColor}
                            strokeWidth={STROKE_WIDTH - 1}
                            fill="transparent"
                            strokeDasharray={TOTAL_CIRCUMFERENCE}
                            strokeDashoffset={totalStrokeDashoffset}
                            strokeLinecap="round"
                            rotation="-90"
                            origin={`${TOTAL_TIMER_SIZE / 2}, ${TOTAL_TIMER_SIZE / 2}`}
                        />
                    </Svg>
                    <Text style={styles.progressPctText}>{Math.round(sessionProgress * 100)}%</Text>
                </View>
            </View>

            <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${sessionProgress * 100}%`, backgroundColor: accentColor }]} />
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {sessionPlan.phases.map((phase, index) => {
                    const isCompleted = index < phaseIndex;
                    const isCurrent = index === phaseIndex;
                    const isUpcoming = index > phaseIndex;
                    const phaseColor = getPhaseColor(phase);
                    const phaseSoft = hexToRgba(phaseColor, 0.12);
                    const phaseBorder = hexToRgba(phaseColor, 0.22);
                    const phaseStatus = isCompleted ? 'completed' : isCurrent ? 'current' : 'upcoming';

                    return (
                        <View key={phase.key} style={styles.timelineRow}>
                            <View style={styles.indicatorCol}>
                                <View
                                    style={[
                                        styles.verticalLine,
                                        index === 0 && { top: '50%' },
                                        index === sessionPlan.phases.length - 1 && { height: '50%' },
                                        isCompleted && { backgroundColor: phaseColor },
                                    ]}
                                />
                                <View
                                    style={[
                                        styles.dot,
                                        isCompleted && { backgroundColor: phaseColor, borderColor: phaseColor },
                                        isCurrent && { backgroundColor: COLORS.card, borderColor: phaseColor, transform: [{ scale: 1.15 }] },
                                        isUpcoming && { backgroundColor: COLORS.bg, borderColor: COLORS.line },
                                    ]}
                                >
                                    {isCompleted && <Check size={11} color="#FFF" strokeWidth={3} />}
                                    {isCurrent && <View style={[styles.activeCore, { backgroundColor: phaseColor }]} />}
                                </View>
                            </View>

                            <View
                                style={[
                                    styles.contentCol,
                                    isCurrent && styles.activeCard,
                                    isCompleted && styles.completedRow,
                                ]}
                            >
                                <View style={styles.phaseHeader}>
                                    <View style={styles.phaseHeaderText}>
                                        <View style={[styles.phaseTypePill, { backgroundColor: phaseSoft, borderColor: phaseBorder }]}>
                                            <Text style={[styles.phaseTypeText, { color: phaseColor }]}>
                                                {getPhaseTypeLabel(phase.type)}
                                            </Text>
                                        </View>
                                        <Text
                                            style={[
                                                styles.phaseTitle,
                                                isCompleted && styles.dimmedText,
                                                isCurrent && { color: COLORS.textMain },
                                            ]}
                                        >
                                            {phase.title}
                                        </Text>
                                        <Text style={[styles.phaseTarget, isCompleted && styles.dimmedText]}>
                                            {phase.subtitle}
                                        </Text>
                                        {phase.roundTotal && phase.roundNumber && phase.roundTotal > 1 ? (
                                            <View style={styles.setBlocksRow}>
                                                {Array.from({ length: phase.roundTotal }, (_, blockIndex) => {
                                                    const setNumber = blockIndex + 1;
                                                    const blockState = getSetBlockState(
                                                        setNumber,
                                                        phase.roundNumber!,
                                                        phaseStatus,
                                                    );
                                                    return (
                                                        <View
                                                            key={setNumber}
                                                            style={[
                                                                styles.setBlock,
                                                                blockState === 'done' && {
                                                                    backgroundColor: phaseColor,
                                                                    borderColor: phaseColor,
                                                                },
                                                                blockState === 'active' && {
                                                                    backgroundColor: phaseSoft,
                                                                    borderColor: phaseColor,
                                                                },
                                                                blockState === 'empty' && styles.setBlockEmpty,
                                                            ]}
                                                        />
                                                    );
                                                })}
                                            </View>
                                        ) : null}
                                    </View>
                                    {isCurrent && (
                                        <View style={[styles.timeBadge, { backgroundColor: phaseColor }]}>
                                            <Text style={styles.timeBadgeText}>{formatClock(phaseSecondsLeft)}</Text>
                                        </View>
                                    )}
                                </View>

                                {isCurrent && (
                                    <Animated.View style={[styles.expandedContent, { opacity: fadeAnim }]}>
                                        {phase.exercise ? (
                                            <InstructionsPanel
                                                key={phase.key}
                                                embedded
                                                instructions={phase.exercise.instructions}
                                                accentColor={phaseColor}
                                                borderColor={phaseBorder}
                                            />
                                        ) : (
                                            <InstructionsPanel
                                                key={phase.key}
                                                embedded
                                                title="Instructions"
                                                singleInstruction={phase.instruction}
                                                accentColor={phaseColor}
                                                borderColor={phaseBorder}
                                            />
                                        )}

                                        {phase.exercise && (
                                            <View style={styles.mediaSection}>
                                                <View style={[styles.mediaCard, { borderColor: phaseBorder }]}>
                                                    <Image
                                                        source={phase.exercise.image || require('../../assets/t.png')}
                                                        style={styles.mediaImage}
                                                        resizeMode="contain"
                                                    />
                                                </View>
                                            </View>
                                        )}

                                        <View style={styles.phaseTimerWrapper}>
                                            <Svg width={TIMER_SIZE} height={TIMER_SIZE}>
                                                <Circle
                                                    cx={TIMER_SIZE / 2}
                                                    cy={TIMER_SIZE / 2}
                                                    r={RADIUS}
                                                    stroke={COLORS.line}
                                                    strokeWidth={STROKE_WIDTH}
                                                    fill="transparent"
                                                />
                                                <AnimatedCircle
                                                    cx={TIMER_SIZE / 2}
                                                    cy={TIMER_SIZE / 2}
                                                    r={RADIUS}
                                                    stroke={phaseColor}
                                                    strokeWidth={STROKE_WIDTH}
                                                    fill="transparent"
                                                    strokeDasharray={CIRCUMFERENCE}
                                                    strokeDashoffset={phaseStrokeDashoffset}
                                                    strokeLinecap="round"
                                                    rotation="-90"
                                                    origin={`${TIMER_SIZE / 2}, ${TIMER_SIZE / 2}`}
                                                />
                                            </Svg>
                                            <View style={styles.bigTimerTextContainer}>
                                                <Text style={styles.bigTimerText}>{formatClock(phaseSecondsLeft)}</Text>
                                                <Text style={styles.bigTimerLabel}>
                                                    {isActive ? 'Running' : 'Paused'}
                                                </Text>
                                            </View>
                                        </View>
                                    </Animated.View>
                                )}
                            </View>
                        </View>
                    );
                })}
            </ScrollView>

            <View style={[styles.stickyFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>
                <TouchableOpacity onPress={handleRestart} style={styles.controlIconBtn} activeOpacity={0.7}>
                    <RotateCcw size={20} color={COLORS.textSub} />
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={handleToggleActive}
                    style={[styles.playBtn, { backgroundColor: accentColor }]}
                    activeOpacity={0.85}
                >
                    {isActive ? (
                        <Pause size={28} color="#FFF" fill="#FFF" />
                    ) : (
                        <Play size={28} color="#FFF" fill="#FFF" />
                    )}
                </TouchableOpacity>

                <TouchableOpacity onPress={handleAdvancePhase} style={styles.nextBtn} activeOpacity={0.85}>
                    <Text style={styles.nextText}>
                        {phaseIndex === sessionPlan.phases.length - 1 ? 'Finish' : 'Next step'}
                    </Text>
                    <ChevronRight size={18} color="#FFF" strokeWidth={2.5} />
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.bg,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 12,
        backgroundColor: COLORS.bg,
    },
    headerBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderCurve: 'continuous',
        backgroundColor: COLORS.card,
        borderWidth: 1,
        borderColor: COLORS.line,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerInfo: {
        flex: 1,
        marginLeft: 14,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '800',
        color: COLORS.textMain,
        letterSpacing: -0.3,
    },
    headerSub: {
        fontSize: 13,
        color: COLORS.textSub,
        fontWeight: '600',
        marginTop: 2,
    },
    progressionCircle: {
        width: TOTAL_TIMER_SIZE,
        height: TOTAL_TIMER_SIZE,
        justifyContent: 'center',
        alignItems: 'center',
    },
    progressPctText: {
        position: 'absolute',
        fontSize: 10,
        fontWeight: '900',
        color: COLORS.textMain,
        fontVariant: ['tabular-nums'],
    },
    progressTrack: {
        height: 3,
        marginHorizontal: 20,
        marginBottom: 8,
        backgroundColor: COLORS.line,
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 2,
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        paddingTop: 16,
        paddingBottom: 140,
    },
    timelineRow: {
        flexDirection: 'row',
        paddingHorizontal: 20,
    },
    indicatorCol: {
        width: 36,
        alignItems: 'center',
    },
    verticalLine: {
        position: 'absolute',
        width: 2,
        top: 0,
        bottom: 0,
        backgroundColor: COLORS.line,
    },
    dot: {
        width: 26,
        height: 26,
        borderRadius: 13,
        borderCurve: 'continuous',
        backgroundColor: COLORS.card,
        borderWidth: 2,
        borderColor: COLORS.line,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 4,
        zIndex: 2,
    },
    activeCore: {
        width: 10,
        height: 10,
        borderRadius: 5,
        borderCurve: 'continuous',
    },
    contentCol: {
        flex: 1,
        marginLeft: 12,
        paddingBottom: 24,
    },
    activeCard: {
        backgroundColor: COLORS.card,
        borderRadius: 24,
        borderCurve: 'continuous',
        padding: 20,
        marginLeft: 4,
        borderWidth: 1,
        borderColor: COLORS.line,
        shadowColor: '#1A1C1E',
        shadowOpacity: 0.05,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 3,
    },
    completedRow: {
        opacity: 0.55,
    },
    phaseHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 12,
    },
    phaseHeaderText: {
        flex: 1,
        gap: 6,
    },
    phaseTypePill: {
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
        borderCurve: 'continuous',
        borderWidth: 1,
    },
    phaseTypeText: {
        fontSize: 11,
        fontWeight: '700',
    },
    phaseTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: COLORS.textSub,
        letterSpacing: -0.3,
    },
    phaseTarget: {
        fontSize: 13,
        color: COLORS.textSub,
        fontWeight: '600',
    },
    setBlocksRow: {
        flexDirection: 'row',
        gap: 6,
        marginTop: 10,
    },
    setBlock: {
        flex: 1,
        height: 6,
        borderRadius: 3,
        borderWidth: 1,
    },
    setBlockEmpty: {
        backgroundColor: COLORS.line,
        borderColor: COLORS.line,
    },
    dimmedText: {
        color: COLORS.textMuted,
    },
    timeBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        borderCurve: 'continuous',
    },
    timeBadgeText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '800',
        fontVariant: ['tabular-nums'],
    },
    expandedContent: {
        marginTop: 16,
    },
    mediaSection: {
        alignItems: 'center',
        marginBottom: 24,
    },
    mediaCard: {
        width: 160,
        height: 160,
        borderRadius: 28,
        borderCurve: 'continuous',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        shadowColor: '#1A1C1E',
        shadowOpacity: 0.06,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 3,
    },
    mediaImage: {
        width: '88%',
        height: '88%',
    },
    phaseTimerWrapper: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 4,
    },
    bigTimerTextContainer: {
        position: 'absolute',
        alignItems: 'center',
    },
    bigTimerText: {
        fontSize: 28,
        fontWeight: '900',
        color: COLORS.textMain,
        fontVariant: ['tabular-nums'],
        letterSpacing: -0.5,
    },
    bigTimerLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: COLORS.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        marginTop: 2,
    },
    stickyFooter: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(255,255,255,0.96)',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 14,
        borderTopWidth: 1,
        borderTopColor: COLORS.line,
        gap: 12,
    },
    controlIconBtn: {
        width: 52,
        height: 52,
        borderRadius: 26,
        borderCurve: 'continuous',
        backgroundColor: COLORS.bg,
        borderWidth: 1,
        borderColor: COLORS.line,
        justifyContent: 'center',
        alignItems: 'center',
    },
    playBtn: {
        flex: 1,
        height: 56,
        borderRadius: 28,
        borderCurve: 'continuous',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 4,
    },
    nextBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.textMain,
        height: 52,
        paddingHorizontal: 18,
        borderRadius: 26,
        borderCurve: 'continuous',
        gap: 4,
    },
    nextText: {
        color: '#FFF',
        fontWeight: '800',
        fontSize: 14,
    },
});
