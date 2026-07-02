import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    Dimensions,
    TouchableOpacity,
    Vibration,
    Platform,
    Image,
    SafeAreaView,
    ScrollView,
} from 'react-native';
import {
    X,
    Pause,
    Play,
    ChevronRight,
    RotateCcw,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TIMER_SIZE = 90;
const TOTAL_TIMER_SIZE = 60;
const STROKE_WIDTH = 5;
const RADIUS = (TIMER_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const TOTAL_RADIUS = (TOTAL_TIMER_SIZE - STROKE_WIDTH) / 2;
const TOTAL_CIRCUMFERENCE = 2 * Math.PI * TOTAL_RADIUS;

const TIMELINE_HEIGHT = 4;

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
    'Warm up with easy dynamic movement, deep breathing, and controlled range of motion.',
    'Prepare hips, ankles, shoulders, and core before the work sets begin.',
    'Ease into the session and make the first minutes smooth, not rushed.',
];

const COOLDOWN_INSTRUCTIONS = [
    'Slow down, shake out tension, and bring your breathing back under control.',
    'Finish with light movement and let your heart rate settle.',
    'End tall and relaxed so the session feels complete, not abrupt.',
];

function clampWeek(week: number) {
    if (!Number.isFinite(week)) return 1;
    return Math.max(1, Math.min(12, Math.floor(week)));
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
            setDurationSeconds: seconds,
        };
    }

    const baseReps = exercise.baseReps ?? 10;
    const reps = baseReps + (Math.floor((week - 1) / 3) * 2);
    const repLabel = exercise.perLeg ? `${reps} reps each leg` : `${reps} reps`;

    return {
        rounds,
        targetLabel: `${rounds} x ${repLabel}`,
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
                title: `${block.exercise.name} Set ${round}`,
                subtitle: `${block.targetLabel}`,
                instruction: block.exercise.instructions[(round - 1) % block.exercise.instructions.length],
                durationSeconds: block.setDurationSeconds,
                targetLabel: block.targetLabel,
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
    const sessionPlan = useMemo(() => buildWorkoutSessionPlan(exercises, currentWeek), [exercises, currentWeek]);
    
    const [phaseIndex, setPhaseIndex] = useState(0);
    const currentPhase = sessionPlan.phases[phaseIndex];
    
    // Dynamic context based on current phase
    const activeExercise = currentPhase.exercise ?? sessionPlan.workoutExercises[0]?.exercise ?? exercises[0];
    const accentColor = activeExercise.color;
    const displayImage = activeExercise.image || require('../../assets/t.png');

    const [isActive, setIsActive] = useState(true);
    const [phaseSecondsLeft, setPhaseSecondsLeft] = useState(sessionPlan.phases[0]?.durationSeconds ?? 0);
    const [totalSecondsLeft, setTotalSecondsLeft] = useState(sessionPlan.phases.reduce((sum, phase) => sum + phase.durationSeconds, 0));

    const phaseAnim = useRef(new Animated.Value(1)).current;
    const totalAnim = useRef(new Animated.Value(1)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const totalDurationSeconds = sessionPlan.phases.reduce((sum, phase) => sum + phase.durationSeconds, 0);

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
        if (Platform.OS !== 'web') Vibration.vibrate(250);

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
        setPhaseIndex(0);
        setIsActive(true);
        setPhaseSecondsLeft(sessionPlan.phases[0]?.durationSeconds ?? 0);
        setTotalSecondsLeft(totalDurationSeconds);
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
        <SafeAreaView style={styles.container}>
            {/* COMPACT TOP HEADER */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                    <X color="#1A1C1E" size={24} />
                </TouchableOpacity>
                <View style={styles.headerInfo}>
                    <Text style={styles.headerTitle}>Daily Mobility Mix</Text>
                    <Text style={styles.headerSub}>Week {sessionPlan.week} • {sessionPlan.totalMinutes}m Session</Text>
                </View>
                <View style={styles.progressionCircle}>
                    <Svg width={36} height={36}>
                        <Circle
                            cx={18}
                            cy={18}
                            r={15}
                            stroke="#F1F3F5"
                            strokeWidth={3}
                            fill="transparent"
                        />
                        <AnimatedCircle
                            cx={18}
                            cy={18}
                            r={15}
                            stroke="#1A1C1E"
                            strokeWidth={3}
                            fill="transparent"
                            strokeDasharray={2 * Math.PI * 15}
                            strokeDashoffset={totalStrokeDashoffset.interpolate({
                                inputRange: [0, 1],
                                outputRange: [2 * Math.PI * 15, 0]
                            })}
                            strokeLinecap="round"
                        />
                    </Svg>
                    <Text style={styles.progressPctText}>{Math.round((1 - totalSecondsLeft / totalDurationSeconds) * 100)}%</Text>
                </View>
            </View>

            <ScrollView 
                style={styles.scroll} 
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {sessionPlan.phases.map((phase, index) => {
                    const isCompleted = index < phaseIndex;
                    const isActive = index === phaseIndex;
                    const isUpcoming = index > phaseIndex;
                    const phaseColor = phase.exercise?.color || '#339AF0';

                    return (
                        <View key={phase.key} style={styles.timelineRow}>
                            {/* LEFT LINE SYSTEM */}
                            <View style={styles.indicatorCol}>
                                <View 
                                    style={[
                                        styles.verticalLine, 
                                        index === 0 && { top: '50%' },
                                        index === sessionPlan.phases.length - 1 && { height: '50%' },
                                        isCompleted && { backgroundColor: '#1A1C1E' }
                                    ]} 
                                />
                                <View 
                                    style={[
                                        styles.dot, 
                                        isCompleted && { backgroundColor: '#1A1C1E', borderColor: '#1A1C1E' },
                                        isActive && { backgroundColor: '#FFF', borderColor: phaseColor, transform: [{ scale: 1.2 }] },
                                        isUpcoming && { backgroundColor: '#F1F3F5', borderColor: '#DEE2E6' }
                                    ]}
                                >
                                    {isCompleted && <Play size={10} color="#FFF" fill="#FFF" />}
                                    {isActive && <View style={[styles.activeCore, { backgroundColor: phaseColor }]} />}
                                </View>
                            </View>

                            {/* RIGHT CONTENT */}
                            <TouchableOpacity 
                                activeOpacity={0.9}
                                disabled={!isUpcoming} // Allow tapping ahead if we wanted skip logic
                                style={[
                                    styles.contentCol,
                                    isActive && styles.activeCard,
                                    isCompleted && styles.completedRow
                                ]}
                            >
                                <View style={styles.phaseHeader}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[
                                            styles.phaseTitle,
                                            isCompleted && styles.dimmedText,
                                            isActive && { color: phaseColor }
                                        ]}>
                                            {phase.title}
                                        </Text>
                                        <Text style={[
                                            styles.phaseTarget,
                                            isCompleted && styles.dimmedText
                                        ]}>
                                            {phase.subtitle}
                                        </Text>
                                    </View>
                                    {isActive && (
                                        <View style={styles.timeBadge}>
                                            <Text style={styles.timeBadgeText}>{formatClock(phaseSecondsLeft)}</Text>
                                        </View>
                                    )}
                                </View>

                                {isActive && (
                                    <Animated.View style={[styles.expandedContent, { opacity: fadeAnim }]}>
                                        <View style={styles.instructionBox}>
                                            <Text style={styles.instructionText}>{phase.instruction}</Text>
                                        </View>
                                        
                                        {phase.exercise && (
                                            <View style={styles.mediaContainer}>
                                                <Image 
                                                    source={phase.exercise.image || require('../../assets/t.png')} 
                                                    style={styles.mediaImage}
                                                    resizeMode="contain"
                                                />
                                                <View style={[styles.imageGlow, { backgroundColor: '#FFFFFF' }]} />
                                            </View>
                                        )}

                                        <View style={styles.phaseTimerWrapper}>
                                            <Svg width={120} height={120} style={styles.bigTimerSvg}>
                                                <Circle
                                                    cx={60}
                                                    cy={60}
                                                    r={54}
                                                    stroke="#F1F3F5"
                                                    strokeWidth={6}
                                                    fill="transparent"
                                                />
                                                <AnimatedCircle
                                                    cx={60}
                                                    cy={60}
                                                    r={54}
                                                    stroke={phaseColor}
                                                    strokeWidth={6}
                                                    fill="transparent"
                                                    strokeDasharray={2 * Math.PI * 54}
                                                    strokeDashoffset={phaseStrokeDashoffset.interpolate({
                                                        inputRange: [0, 1],
                                                        outputRange: [2 * Math.PI * 54, 0]
                                                    })}
                                                    strokeLinecap="round"
                                                />
                                            </Svg>
                                            <View style={styles.bigTimerTextContainer}>
                                                <Text style={styles.bigTimerText}>{formatClock(phaseSecondsLeft)}</Text>
                                                <Text style={styles.bigTimerLabel}>remains</Text>
                                            </View>
                                        </View>
                                    </Animated.View>
                                )}
                            </TouchableOpacity>
                        </View>
                    );
                })}
            </ScrollView>

            {/* STICKY FOOTER CONTROLS */}
            <View style={styles.stickyFooter}>
                <TouchableOpacity onPress={handleRestart} style={styles.controlIconBtn}>
                    <RotateCcw size={22} color="#495057" />
                </TouchableOpacity>

                <TouchableOpacity 
                    onPress={() => setIsActive(!isActive)} 
                    style={[styles.playBtn, { backgroundColor: accentColor }]}
                >
                    {isActive ? <Pause size={28} color="#FFF" fill="#FFF" /> : <Play size={28} color="#FFF" fill="#FFF" />}
                </TouchableOpacity>

                <TouchableOpacity onPress={handleAdvancePhase} style={styles.nextBtn}>
                    <Text style={styles.nextText}>
                        {phaseIndex === sessionPlan.phases.length - 1 ? 'Finish' : 'Next Step'}
                    </Text>
                    <ChevronRight size={20} color="#1A1C1E" />
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F3F5',
        backgroundColor: '#FFF',
    },
    closeBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F8F9FA',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerInfo: {
        flex: 1,
        marginLeft: 16,
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: '#1A1C1E',
    },
    headerSub: {
        fontSize: 12,
        color: '#6C757D',
        fontWeight: '600',
        marginTop: 1,
    },
    progressionCircle: {
        width: 36,
        height: 36,
        justifyContent: 'center',
        alignItems: 'center',
    },
    progressPctText: {
        position: 'absolute',
        fontSize: 9,
        fontWeight: '900',
        color: '#1A1C1E',
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        paddingTop: 24,
        paddingBottom: 120, // Space for sticky footer
    },
    timelineRow: {
        flexDirection: 'row',
        paddingHorizontal: 20,
    },
    indicatorCol: {
        width: 40,
        alignItems: 'center',
    },
    verticalLine: {
        position: 'absolute',
        width: 2,
        top: 0,
        bottom: 0,
        backgroundColor: '#F1F3F5',
    },
    dot: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#FFF',
        borderWidth: 2,
        borderColor: '#DEE2E6',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 4,
        zIndex: 2,
    },
    activeCore: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    contentCol: {
        flex: 1,
        marginLeft: 12,
        paddingBottom: 32,
    },
    activeCard: {
        backgroundColor: '#F8F9FA',
        borderRadius: 24,
        padding: 20,
        marginLeft: 4,
        borderWidth: 1,
        borderColor: '#F1F3F5',
        shadowColor: '#000',
        shadowOpacity: 0.03,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
    },
    completedRow: {
        opacity: 0.5,
    },
    phaseHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    phaseTitle: {
        fontSize: 14,
        fontWeight: '900',
        color: '#495057',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    phaseTarget: {
        fontSize: 14,
        color: '#1A1C1E',
        fontWeight: '800',
        marginTop: 2,
    },
    dimmedText: {
        color: '#ADB5BD',
    },
    timeBadge: {
        backgroundColor: '#1A1C1E',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    timeBadgeText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '900',
        fontVariant: ['tabular-nums'],
    },
    expandedContent: {
        marginTop: 16,
    },
    instructionBox: {
        backgroundColor: '#FFF',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#F1F3F5',
        marginBottom: 20,
    },
    instructionText: {
        fontSize: 18,
        lineHeight: 26,
        fontWeight: '800',
        color: '#1A1C1E',
    },
    mediaContainer: {
        width: '100%',
        height: 180,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    mediaImage: {
        width: '100%',
        height: '100%',
        zIndex: 2,
    },
    imageGlow: {
        position: 'absolute',
        width: 120,
        height: 120,
        borderRadius: 60,
        opacity: 0.1,
        ...Platform.select({ web: { filter: 'blur(30px)' }, default: {} }),
    },
    phaseTimerWrapper: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
    },
    bigTimerSvg: {
        transform: [{ rotateZ: '-90deg' }],
    },
    bigTimerTextContainer: {
        position: 'absolute',
        alignItems: 'center',
    },
    bigTimerText: {
        fontSize: 28,
        fontWeight: '900',
        color: '#1A1C1E',
        fontVariant: ['tabular-nums'],
    },
    bigTimerLabel: {
        fontSize: 10,
        fontWeight: '800',
        color: '#ADB5BD',
        textTransform: 'uppercase',
        marginTop: -2,
    },
    stickyFooter: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(255,255,255,0.95)',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 34,
        borderTopWidth: 1,
        borderTopColor: '#F1F3F5',
        gap: 16,
    },
    controlIconBtn: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: '#F8F9FA',
        justifyContent: 'center',
        alignItems: 'center',
    },
    playBtn: {
        flex: 1,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 5 },
        elevation: 4,
    },
    nextBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1A1C1E',
        height: 52,
        paddingHorizontal: 20,
        borderRadius: 26,
        gap: 6,
    },
    nextText: {
        color: '#FFF',
        fontWeight: '900',
        fontSize: 14,
    },
});
