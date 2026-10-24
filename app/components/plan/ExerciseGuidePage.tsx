import React, { useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Image,
    SafeAreaView,
} from 'react-native';
import {
    X,
    ChevronLeft,
    Play,
    Pause,
    RotateCcw,
    Activity,
    Clock,
    Flame,
    Target,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Circle } from 'react-native-svg';
import { formatClock, MobilityExercise } from './GuidedMobility';
import { InstructionsPanel } from './InstructionsPanel';

const COLORS = {
    bg: '#F7F8FA',
    card: '#FFFFFF',
    textMain: '#1A1C1E',
    textSub: '#6C757D',
    textMuted: '#ADB5BD',
    line: '#EEF0F3',
};

const TIMER_SIZE = 148;
const STROKE_WIDTH = 7;
const RADIUS = (TIMER_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

type RepOption = {
    label: string;
    timerSeconds: number;
};

type Props = {
    exercise: MobilityExercise;
    onBack: () => void;
    onClose: () => void;
};

function getRepOptions(exercise: MobilityExercise): RepOption[] {
    if (exercise.timedSeconds) {
        return [30, 45, 60].map((seconds) => ({
            label: `${seconds}s`,
            timerSeconds: seconds,
        }));
    }

    const baseReps = exercise.baseReps ?? 10;
    const repValues = [baseReps - 2, baseReps, baseReps + 2].filter(
        (value, index, values) => value > 0 && values.indexOf(value) === index,
    );

    return repValues.map((reps) => ({
        label: exercise.perLeg ? `${reps}/leg` : `${reps}`,
        timerSeconds: exercise.perLeg ? reps * 10 : reps * 5,
    }));
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

export function ExerciseGuidePage({ exercise, onBack, onClose }: Props) {
    const repOptions = useMemo(() => getRepOptions(exercise), [exercise]);
    const [selectedOption, setSelectedOption] = useState<RepOption>(repOptions[1] ?? repOptions[0]);
    const [secondsLeft, setSecondsLeft] = useState(selectedOption?.timerSeconds ?? 0);
    const [isActive, setIsActive] = useState(false);

    const accentSoft = hexToRgba(exercise.color, 0.12);
    const accentBorder = hexToRgba(exercise.color, 0.22);
    const isComplete = secondsLeft === 0 && selectedOption.timerSeconds > 0;
    const progress =
        selectedOption.timerSeconds > 0 ? 1 - secondsLeft / selectedOption.timerSeconds : 0;
    const strokeDashoffset = CIRCUMFERENCE * (1 - progress);

    useEffect(() => {
        const nextOption = repOptions[1] ?? repOptions[0];
        setSelectedOption(nextOption);
        setSecondsLeft(nextOption?.timerSeconds ?? 0);
        setIsActive(false);
    }, [repOptions]);

    useEffect(() => {
        setSecondsLeft(selectedOption.timerSeconds);
        setIsActive(false);
    }, [selectedOption]);

    useEffect(() => {
        if (!isActive || secondsLeft <= 0) return;

        const interval = setInterval(() => {
            setSecondsLeft((seconds) => Math.max(0, seconds - 1));
        }, 1000);

        return () => clearInterval(interval);
    }, [isActive, secondsLeft]);

    useEffect(() => {
        if (secondsLeft === 0) {
            setIsActive(false);
        }
    }, [secondsLeft]);

    const handleSelectOption = (option: RepOption) => {
        if (option.label === selectedOption.label) return;
        Haptics.selectionAsync();
        setSelectedOption(option);
    };

    const handleToggleTimer = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setIsActive((value) => !value);
    };

    const handleResetTimer = () => {
        Haptics.selectionAsync();
        setIsActive(false);
        setSecondsLeft(selectedOption.timerSeconds);
    };

    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.safeHeader}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onBack} style={styles.headerBtn} activeOpacity={0.7}>
                        <ChevronLeft size={22} color={COLORS.textMain} strokeWidth={2.5} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Exercise Guide</Text>
                    <TouchableOpacity onPress={onClose} style={styles.headerBtn} activeOpacity={0.7}>
                        <X size={20} color={COLORS.textMain} strokeWidth={2.5} />
                    </TouchableOpacity>
                </View>
            </SafeAreaView>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                bounces
            >
                {/* Hero */}
                <View style={styles.heroSection}>
                    <View style={[styles.heroImageCard, { borderColor: accentBorder }]}>
                        {exercise.image ? (
                            <Image source={exercise.image} style={styles.heroImage} resizeMode="contain" />
                        ) : (
                            <View style={styles.heroPlaceholder}>
                                <Activity size={44} color={exercise.color} />
                            </View>
                        )}
                    </View>
                </View>

                {/* Title & meta */}
                <View style={styles.infoSection}>
                    <Text style={styles.exerciseName}>{exercise.name}</Text>

                    <View style={styles.metaRow}>
                        <View style={[styles.metaChip, { backgroundColor: accentSoft }]}>
                            <Target size={12} color={exercise.color} strokeWidth={2.5} />
                            <Text style={[styles.metaChipText, { color: exercise.color }]}>
                                {exercise.objective}
                            </Text>
                        </View>
                        <View style={styles.metaChip}>
                            <Text style={styles.metaChipTextMuted}>{exercise.bodyPart}</Text>
                        </View>
                    </View>

                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Clock size={14} color={COLORS.textSub} strokeWidth={2.5} />
                            <Text style={styles.statText}>{exercise.duration}</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statText}>{exercise.reps}</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Flame size={14} color={COLORS.textSub} strokeWidth={2.5} />
                            <Text style={styles.statText}>{exercise.kcals} kcal</Text>
                        </View>
                    </View>

                    <Text style={styles.descriptionText}>{exercise.description}</Text>

                    {exercise.benefits.length > 0 && (
                        <View style={styles.benefitsRow}>
                            {exercise.benefits.map((benefit) => (
                                <View key={benefit} style={[styles.benefitPill, { borderColor: accentBorder }]}>
                                    <Text style={[styles.benefitText, { color: exercise.color }]}>{benefit}</Text>
                                </View>
                            ))}
                        </View>
                    )}
                </View>

                {/* Practice timer */}
                <View style={styles.timerCard}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Practice Timer</Text>
                        <Text style={styles.sectionSubtitle}>Pick a target, then start when you're ready</Text>
                    </View>

                    <View style={styles.repSelector}>
                        {repOptions.map((option) => {
                            const isSelected = option.label === selectedOption.label;
                            return (
                                <TouchableOpacity
                                    key={option.label}
                                    onPress={() => handleSelectOption(option)}
                                    style={[
                                        styles.repChip,
                                        isSelected && {
                                            backgroundColor: exercise.color,
                                            borderColor: exercise.color,
                                        },
                                    ]}
                                    activeOpacity={0.8}
                                >
                                    <Text style={[styles.repChipText, isSelected && styles.repChipTextActive]}>
                                        {option.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    <View style={styles.timerDisplay}>
                        <View style={styles.timerRingWrapper}>
                            <Svg width={TIMER_SIZE} height={TIMER_SIZE}>
                                <Circle
                                    cx={TIMER_SIZE / 2}
                                    cy={TIMER_SIZE / 2}
                                    r={RADIUS}
                                    stroke={COLORS.line}
                                    strokeWidth={STROKE_WIDTH}
                                    fill="transparent"
                                />
                                <Circle
                                    cx={TIMER_SIZE / 2}
                                    cy={TIMER_SIZE / 2}
                                    r={RADIUS}
                                    stroke={isComplete ? '#00B894' : exercise.color}
                                    strokeWidth={STROKE_WIDTH}
                                    fill="transparent"
                                    strokeDasharray={CIRCUMFERENCE}
                                    strokeDashoffset={strokeDashoffset}
                                    strokeLinecap="round"
                                    rotation="-90"
                                    origin={`${TIMER_SIZE / 2}, ${TIMER_SIZE / 2}`}
                                />
                            </Svg>
                            <View style={styles.timerCenter}>
                                <Text style={styles.timerClock}>{formatClock(secondsLeft)}</Text>
                                <Text style={styles.timerLabel}>
                                    {isComplete ? 'Complete' : isActive ? 'Running' : 'Ready'}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.timerControls}>
                            <TouchableOpacity
                                onPress={handleToggleTimer}
                                style={[styles.playBtn, { backgroundColor: exercise.color }]}
                                activeOpacity={0.85}
                            >
                                {isActive ? (
                                    <Pause size={26} color="#FFF" fill="#FFF" />
                                ) : (
                                    <Play size={26} color="#FFF" fill="#FFF" />
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleResetTimer}
                                style={styles.refreshBtn}
                                activeOpacity={0.7}
                            >
                                <RotateCcw size={18} color={COLORS.textSub} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                <InstructionsPanel
                    instructions={exercise.instructions}
                    accentColor={exercise.color}
                    borderColor={accentBorder}
                />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.bg,
    },
    safeHeader: {
        backgroundColor: COLORS.bg,
        zIndex: 10,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 8,
        justifyContent: 'space-between',
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: COLORS.textMain,
        letterSpacing: -0.3,
    },
    headerBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderCurve: 'continuous',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.card,
        borderWidth: 1,
        borderColor: COLORS.line,
    },
    scrollContent: {
        paddingBottom: 48,
    },
    heroSection: {
        alignItems: 'center',
        paddingTop: 8,
        paddingBottom: 4,
        position: 'relative',
    },
    heroImageCard: {
        width: 200,
        height: 200,
        borderRadius: 32,
        borderCurve: 'continuous',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#1A1C1E',
        shadowOpacity: 0.06,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 10 },
        elevation: 3,
        overflow: 'hidden',
    },
    heroImage: {
        width: '88%',
        height: '88%',
    },
    heroPlaceholder: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
    },
    infoSection: {
        paddingHorizontal: 24,
        marginTop: 20,
        marginBottom: 20,
    },
    exerciseName: {
        fontSize: 28,
        fontWeight: '900',
        color: COLORS.textMain,
        letterSpacing: -0.8,
        marginBottom: 12,
    },
    metaRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 16,
    },
    metaChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        borderCurve: 'continuous',
        backgroundColor: COLORS.card,
        borderWidth: 1,
        borderColor: COLORS.line,
    },
    metaChipText: {
        fontSize: 12,
        fontWeight: '700',
    },
    metaChipTextMuted: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.textSub,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: COLORS.card,
        borderRadius: 16,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: COLORS.line,
    },
    statItem: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
    },
    statDivider: {
        width: 1,
        height: 16,
        backgroundColor: COLORS.line,
    },
    statText: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.textSub,
    },
    descriptionText: {
        fontSize: 15,
        lineHeight: 23,
        color: COLORS.textSub,
        fontWeight: '500',
    },
    benefitsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 16,
    },
    benefitPill: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        borderCurve: 'continuous',
        backgroundColor: COLORS.card,
        borderWidth: 1,
    },
    benefitText: {
        fontSize: 12,
        fontWeight: '700',
    },
    timerCard: {
        marginHorizontal: 20,
        backgroundColor: COLORS.card,
        borderRadius: 24,
        borderCurve: 'continuous',
        padding: 22,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: COLORS.line,
        shadowColor: '#1A1C1E',
        shadowOpacity: 0.04,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 2,
    },
    sectionHeader: {
        marginBottom: 18,
    },
    sectionTitle: {
        fontSize: 17,
        fontWeight: '800',
        color: COLORS.textMain,
        letterSpacing: -0.3,
        marginBottom: 4,
    },
    sectionSubtitle: {
        fontSize: 13,
        color: COLORS.textSub,
        fontWeight: '500',
    },
    repSelector: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 24,
        padding: 4,
        backgroundColor: COLORS.bg,
        borderRadius: 16,
        borderCurve: 'continuous',
    },
    repChip: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        borderCurve: 'continuous',
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
    },
    repChipText: {
        fontSize: 14,
        fontWeight: '800',
        color: COLORS.textSub,
    },
    repChipTextActive: {
        color: '#FFF',
    },
    timerDisplay: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
    },
    timerRingWrapper: {
        width: TIMER_SIZE,
        height: TIMER_SIZE,
        alignItems: 'center',
        justifyContent: 'center',
    },
    timerCenter: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
    },
    timerClock: {
        fontSize: 26,
        fontWeight: '900',
        color: COLORS.textMain,
        fontVariant: ['tabular-nums'],
        letterSpacing: -0.5,
    },
    timerLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: COLORS.textMuted,
        marginTop: 2,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
    },
    timerControls: {
        alignItems: 'center',
        gap: 12,
    },
    playBtn: {
        width: 60,
        height: 60,
        borderRadius: 30,
        borderCurve: 'continuous',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 4,
    },
    refreshBtn: {
        width: 48,
        height: 48,
        borderRadius: 24,
        borderCurve: 'continuous',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.bg,
        borderWidth: 1,
        borderColor: COLORS.line,
    },
});
