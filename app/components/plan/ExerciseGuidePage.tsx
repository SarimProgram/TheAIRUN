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
} from 'lucide-react-native';
import { formatClock, MobilityExercise } from './GuidedMobility';

const COLORS = {
    bg: '#FAFAFA',
    card: '#FFFFFF',
    textMain: '#1A1C1E',
    textSub: '#6C757D',
    line: '#F1F3F5',
};

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
            label: `${seconds} sec`,
            timerSeconds: seconds,
        }));
    }

    const baseReps = exercise.baseReps ?? 10;
    const repValues = [baseReps - 2, baseReps, baseReps + 2].filter((value, index, values) => value > 0 && values.indexOf(value) === index);

    return repValues.map((reps) => ({
        label: exercise.perLeg ? `${reps} each leg` : `${reps} reps`,
        timerSeconds: exercise.perLeg ? reps * 10 : reps * 5,
    }));
}

export function ExerciseGuidePage({ exercise, onBack, onClose }: Props) {
    const repOptions = useMemo(() => getRepOptions(exercise), [exercise]);
    const [selectedOption, setSelectedOption] = useState<RepOption>(repOptions[1] ?? repOptions[0]);
    const [secondsLeft, setSecondsLeft] = useState(selectedOption?.timerSeconds ?? 0);
    const [isActive, setIsActive] = useState(false);

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

    return (
        <View style={styles.container}>
            {/* HEADER */}
            <SafeAreaView style={styles.safeHeader}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                        <ChevronLeft size={22} color={COLORS.textMain} strokeWidth={2.5} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>EXERCISE GUIDE</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <X size={22} color={COLORS.textMain} strokeWidth={2.5} />
                    </TouchableOpacity>
                </View>
            </SafeAreaView>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} bounces={true}>
                {/* HERO IMAGE SECTION */}
                <View style={styles.heroSection}>
                    <View style={[styles.glow, { backgroundColor: '#FFFFFF' }]} />
                    <View style={styles.imageContainer}>
                        {exercise.image ? (
                            <Image source={exercise.image} style={styles.heroImage} resizeMode="contain" />
                        ) : (
                            <Activity size={48} color={exercise.color} />
                        )}
                    </View>
                </View>

                {/* NAME & DESCRIPTION */}
                <View style={styles.infoSection}>
                    <Text style={[styles.exerciseName, { color: exercise.color }]}>{exercise.name}</Text>
                    <View style={styles.labelRow}>
                        <View style={styles.objectiveBadge}>
                            <Text style={styles.objectiveText}>{exercise.objective?.toUpperCase()}</Text>
                        </View>
                        <View style={styles.bodyPartBadge}>
                            <Text style={styles.bodyPartText}>{exercise.bodyPart?.toUpperCase()}</Text>
                        </View>
                    </View>
                    <Text style={styles.descriptionText}>{exercise.description}</Text>
                </View>

                {/* PRACTICE TIMER SECTION */}
                <View style={styles.timerSection}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>PRACTICE TIMER</Text>
                        <Text style={styles.sectionSubtitle}>Select your target to start practicing</Text>
                    </View>
                    
                    <View style={styles.repSelector}>
                        {repOptions.map((option) => {
                            const isSelected = option.label === selectedOption.label;
                            return (
                                <TouchableOpacity
                                    key={option.label}
                                    onPress={() => setSelectedOption(option)}
                                    style={[
                                        styles.repChip,
                                        isSelected && { backgroundColor: exercise.color, borderColor: exercise.color },
                                    ]}
                                >
                                    <Text style={[styles.repChipText, isSelected && styles.repChipTextActive]}>{option.label}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    <View style={styles.timerDisplay}>
                        <View style={styles.timerCircle}>
                            <Text style={styles.timerClock}>{formatClock(secondsLeft)}</Text>
                        </View>
                        <View style={styles.timerControls}>
                            <TouchableOpacity onPress={() => setIsActive((v) => !v)} style={[styles.playBtn, { backgroundColor: exercise.color }]}>
                                {isActive ? <Pause size={24} color="#FFF" fill="#FFF" /> : <Play size={24} color="#FFF" fill="#FFF" />}
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => {
                                    setIsActive(false);
                                    setSecondsLeft(selectedOption.timerSeconds);
                                }}
                                style={styles.refreshBtn}
                            >
                                <RotateCcw size={20} color="#6C757D" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* INSTRUCTIONS */}
                <View style={styles.instructionsSection}>
                    <Text style={styles.sectionTitle}>HOW TO PERFORM</Text>
                    {exercise.instructions.map((step, idx) => (
                        <View key={idx} style={styles.instructionStep}>
                            <View style={[styles.stepNumber, { backgroundColor: `${exercise.color}15` }]}>
                                <Text style={[styles.stepNumberText, { color: exercise.color }]}>{idx + 1}</Text>
                            </View>
                            <Text style={styles.stepContent}>{step}</Text>
                        </View>
                    ))}
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF' },
    safeHeader: { backgroundColor: '#FFF', zIndex: 10 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 12,
        justifyContent: 'space-between',
    },
    headerTitle: {
        fontSize: 12,
        fontWeight: '900',
        color: '#ADB5BD',
        letterSpacing: 2,
    },
    backBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F8F9FA',
    },
    scrollContent: {
        paddingBottom: 60,
    },
    heroSection: {
        height: 280,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    glow: {
        position: 'absolute',
        width: 260,
        height: 260,
        borderRadius: 130,
        opacity: 0.12,
    },
    imageContainer: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    heroImage: {
        width: '85%',
        height: '85%',
    },
    infoSection: {
        paddingHorizontal: 24,
        marginBottom: 32,
    },
    exerciseName: {
        fontSize: 34,
        fontWeight: '900',
        marginBottom: 12,
        letterSpacing: -1,
    },
    labelRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 20,
    },
    objectiveBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: '#F1F3F5',
    },
    objectiveText: {
        fontSize: 10,
        fontWeight: '900',
        color: '#495057',
    },
    bodyPartBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: '#F1F3F5',
    },
    bodyPartText: {
        fontSize: 10,
        fontWeight: '900',
        color: '#495057',
    },
    descriptionText: {
        fontSize: 16,
        lineHeight: 24,
        color: '#6C757D',
        fontWeight: '500',
    },
    timerSection: {
        marginHorizontal: 16,
        backgroundColor: '#F8F9FB',
        borderRadius: 32,
        padding: 24,
        marginBottom: 32,
    },
    sectionHeader: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '900',
        color: '#ADB5BD',
        letterSpacing: 2,
        marginBottom: 4,
    },
    sectionSubtitle: {
        fontSize: 13,
        color: '#6C757D',
        fontWeight: '500',
    },
    repSelector: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 24,
    },
    repChip: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 18,
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: '#E9ECEF',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.02,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
    },
    repChipText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#1A1C1E',
    },
    repChipTextActive: {
        color: '#FFF',
    },
    timerDisplay: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
    },
    timerCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#FFF',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E9ECEF',
        shadowColor: '#000',
        shadowOpacity: 0.03,
        shadowRadius: 15,
        shadowOffset: { width: 0, height: 8 },
    },
    timerClock: {
        fontSize: 22,
        fontWeight: '900',
        color: '#1A1C1E',
        fontVariant: ['tabular-nums'],
    },
    timerControls: {
        gap: 12,
    },
    playBtn: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 5 },
    },
    refreshBtn: {
        width: 56,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: '#E9ECEF',
    },
    instructionsSection: {
        paddingHorizontal: 24,
    },
    instructionStep: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 20,
        alignItems: 'flex-start',
    },
    stepNumber: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepNumberText: {
        fontSize: 14,
        fontWeight: '900',
    },
    stepContent: {
        flex: 1,
        fontSize: 15,
        lineHeight: 22,
        color: '#495057',
        fontWeight: '600',
        paddingTop: 3,
    },
});
