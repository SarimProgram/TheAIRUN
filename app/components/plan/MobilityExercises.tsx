import React, { useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Modal,
    ScrollView,
    Image,
    Switch,
    SafeAreaView,
} from 'react-native';
import {
    X,
    Clock,
    Check,
    Activity,
    Play,
    ChevronRight,
    Home,
} from 'lucide-react-native';
import { GuidedMobility, buildExercisePrescription, buildWorkoutSessionPlan, MobilityExercise } from './GuidedMobility';
import { ExerciseGuidePage } from './ExerciseGuidePage';

const COLORS = {
    primary: '#FF6B6B',
    primarySoft: '#FFF0F0',
    bg: '#F7F8FA',
    card: '#FFFFFF',
    textMain: '#1A1C1E',
    textSub: '#6C757D',
    textMuted: '#ADB5BD',
    line: '#EEF0F3',
    lineStrong: '#E5E7EB',
    success: '#00B894',
    successFade: 'rgba(0, 184, 148, 0.1)',
};

const POINTS_REWARD = 5;

const MOBILITY_EXERCISES: MobilityExercise[] = [
    {
        id: 1,
        name: 'Lunges',
        duration: '3 min',
        reps: '12 per leg',
        description: 'A lower-body strength movement that builds balance, leg drive, and hip stability.',
        instructions: [
            'Stand straight with your feet a little apart.',
            'Take one big step forward.',
            'Bend both knees and move your body down.',
            'Stand up and do the same with the other leg.',
        ],
        benefits: ['Strength', 'Balance'],
        imagePlaceholder: 'lunges',
        image: require('../../assets/exercise/Lunges.png'),
        color: '#FF6B6B',
        objective: 'Better Running',
        kcals: 45,
        bodyPart: 'Lower Body',
        selectionRole: 'lower',
        homeBased: true,
        baseReps: 10,
        perLeg: true,
    },
    {
        id: 2,
        name: 'Step-ups',
        duration: '3 min',
        reps: '10 per leg',
        description: 'Develops leg strength and coordination with a simple single-leg drive pattern.',
        instructions: [
            'Stand close to the step or bench.',
            'Put one foot on top of the step.',
            'Push with that foot and move your body up.',
            'Step down slowly and change to the other foot.',
        ],
        benefits: ['Power', 'Coordination'],
        imagePlaceholder: 'step_ups',
        image: require('../../assets/exercise/stepup.png'),
        color: '#6366F1',
        objective: 'Better Running',
        kcals: 38,
        bodyPart: 'Lower Body',
        selectionRole: 'lower',
        homeBased: true,
        baseReps: 10,
        perLeg: true,
    },
    {
        id: 3,
        name: 'Deadlifts',
        duration: '4 min',
        reps: '10 reps',
        description: 'A hinge exercise that strengthens the back side of the body and improves force production.',
        instructions: [
            'Stand straight and hold the weight in both hands.',
            'Bend your knees a little and move your hips back.',
            'Lower the weight while keeping your back straight.',
            'Push your feet down and stand up again.',
        ],
        benefits: ['Posterior chain', 'Hip hinge'],
        imagePlaceholder: 'deadlifts',
        image: require('../../assets/exercise/deadlift.png'),
        color: '#F59E0B',
        objective: 'Weight Loss',
        kcals: 65,
        bodyPart: 'Full Body',
        selectionRole: 'posterior',
        homeBased: false,
        baseReps: 10,
    },
    {
        id: 4,
        name: 'Squats',
        duration: '3 min',
        reps: '12 reps',
        description: 'A lower-body foundation movement for legs, glutes, and body control.',
        instructions: [
            'Stand with your feet a little wider apart.',
            'Move your hips back and bend your knees.',
            'Move your body down as far as you can.',
            'Push through your feet and stand up again.',
        ],
        benefits: ['Strength', 'Control'],
        imagePlaceholder: 'squats',
        image: require('../../assets/exercise/squats.png'),
        color: '#1F938A',
        objective: 'Weight Loss',
        kcals: 52,
        bodyPart: 'Lower Body',
        selectionRole: 'lower',
        homeBased: true,
        baseReps: 12,
    },
    {
        id: 5,
        name: 'Push-ups',
        duration: '3 min',
        reps: '10 reps',
        description: 'A simple upper-body press that also challenges core tension and body alignment.',
        instructions: [
            'Put your hands on the floor under your shoulders.',
            'Keep your body straight from head to feet.',
            'Bend your arms and move your chest down.',
            'Push with your hands to move back up.',
        ],
        benefits: ['Push strength', 'Core'],
        imagePlaceholder: 'pushups',
        image: require('../../assets/exercise/pushups.png'),
        color: '#8B5CF6',
        objective: 'Better Running',
        kcals: 24,
        bodyPart: 'Upper Body',
        selectionRole: 'upper',
        homeBased: true,
        baseReps: 10,
    },
    {
        id: 6,
        name: 'Rows or Pull-ups',
        duration: '3 min',
        reps: '8-10 reps',
        description: 'Upper-body pulling work for back strength, posture, and shoulder balance.',
        instructions: [
            'Hold the weights or bar with both hands.',
            'Pull your hands toward your body.',
            'Keep your body still while you pull.',
            'Slowly return to the start.',
        ],
        benefits: ['Pull strength', 'Posture'],
        imagePlaceholder: 'rows_or_pull_ups',
        image: require('../../assets/exercise/pullups.png'),
        color: '#EC4899',
        objective: 'Better Running',
        kcals: 28,
        bodyPart: 'Upper Body',
        selectionRole: 'upper',
        homeBased: false,
        baseReps: 8,
    },
    {
        id: 8,
        name: 'Glute Bridges',
        duration: '3 min',
        reps: '12 reps',
        description: 'A posterior-chain exercise that strengthens glutes and helps support hip drive.',
        instructions: [
            'Lie on your back and bend your knees.',
            'Keep both feet flat on the floor.',
            'Push through your feet and lift your hips.',
            'Slowly lower your hips to the floor.',
        ],
        benefits: ['Glute strength', 'Hip stability'],
        imagePlaceholder: 'glute_bridges',
        image: require('../../assets/exercise/glute_bridge.png'),
        color: '#F97316',
        objective: 'Better Running',
        kcals: 30,
        bodyPart: 'Lower Body',
        selectionRole: 'posterior',
        homeBased: true,
        baseReps: 12,
    },
    {
        id: 7,
        name: 'Plank',
        duration: '30 sec',
        reps: '30 seconds',
        description: 'A static core hold that builds stiffness, posture, and control through the trunk.',
        instructions: [
            'Place your elbows on the floor under your shoulders.',
            'Keep your body straight from head to feet.',
            'Hold your body still in this position.',
            'Keep breathing slowly while you hold.',
        ],
        benefits: ['Core stability', 'Posture'],
        imagePlaceholder: 'plank',
        image: require('../../assets/exercise/Plank.png'),
        color: '#0EA5E9',
        objective: 'Better Running',
        kcals: 18,
        bodyPart: 'Core',
        selectionRole: 'core',
        homeBased: true,
        timedSeconds: 30,
    },
    {
        id: 9,
        name: 'Dead Bug',
        duration: '2 min',
        reps: '10 reps each side',
        description: 'A core-control drill that improves trunk stability and coordination.',
        instructions: [
            'Lie on your back and lift your arms.',
            'Bend your knees and lift your feet.',
            'Lower one arm and the other-side leg.',
            'Bring them back and change sides.',
        ],
        benefits: ['Core control', 'Coordination'],
        imagePlaceholder: 'dead_bug',
        image: require('../../assets/exercise/Dead_bug.png'),
        color: '#14B8A6',
        objective: 'Better Running',
        kcals: 16,
        bodyPart: 'Core',
        selectionRole: 'core',
        homeBased: true,
        baseReps: 10,
    },
];

type Props = {
    visible: boolean;
    onClose: () => void;
    currentWeek: number;
    onMixedSessionComplete?: () => void;
};

export function MobilityExercises({ visible, onClose, currentWeek, onMixedSessionComplete }: Props) {
    const [selectedExercise, setSelectedExercise] = useState<MobilityExercise | null>(null);
    const [showWorkout, setShowWorkout] = useState(false);
    const [completedExercises, setCompletedExercises] = useState<number[]>([]);
    const [homeBasedOnly, setHomeBasedOnly] = useState(false);

    const availableExercises = useMemo(
        () => homeBasedOnly ? MOBILITY_EXERCISES.filter((exercise) => exercise.homeBased) : MOBILITY_EXERCISES,
        [homeBasedOnly]
    );

    const sessionPreview = useMemo(() => buildWorkoutSessionPlan(availableExercises, currentWeek), [availableExercises, currentWeek]);

    const totalKcals = useMemo(() => {
        return sessionPreview.workoutExercises.reduce((sum, block) => sum + block.exercise.kcals, 0);
    }, [sessionPreview]);

    useEffect(() => {
        if (!visible) {
            setSelectedExercise(null);
            setShowWorkout(false);
        }
    }, [visible]);

    const handleWorkoutComplete = () => {
        setCompletedExercises((prev) => {
            const next = [...prev];
            sessionPreview.workoutExercises.forEach((block) => {
                if (!next.includes(block.exercise.id)) {
                    next.push(block.exercise.id);
                }
            });
            return next;
        });
        onMixedSessionComplete?.();
    };

    const renderExerciseList = () => (
        <View style={styles.screen}>
            <SafeAreaView style={styles.safeHeader}>
                <View style={styles.horizontalHeader}>
                    <TouchableOpacity onPress={onClose} style={styles.exitBtn} activeOpacity={0.7}>
                        <X size={20} color={COLORS.textMain} strokeWidth={2.5} />
                    </TouchableOpacity>
                    <View style={styles.sessionOverview}>
                        <Text style={styles.sessionMainTitle}>Exercises</Text>
                        <View style={styles.weekBadge}>
                            <Text style={styles.weekBadgeText}>Week {currentWeek}</Text>
                        </View>
                    </View>
                    <View style={styles.headerSpacer} />
                </View>
            </SafeAreaView>

            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.heroCard}>
                    <View style={styles.heroTitleBlock}>
                        <Text style={styles.heroTitle}>Today's Exercise Session</Text>
                        <View style={styles.heroMetaChips}>
                            <View style={styles.heroMetaChip}>
                                <Clock size={12} color={COLORS.textSub} />
                                <Text style={styles.heroMetaChipText}>~12 min</Text>
                            </View>
                            <View style={styles.heroMetaChipDot} />
                            <View style={styles.heroMetaChip}>
                                <Text style={styles.heroMetaChipText}>{totalKcals} kcal</Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.heroVisualRow}>
                        {sessionPreview.workoutExercises.map((block, index) => (
                            <View
                                key={block.exercise.id}
                                style={[
                                    styles.heroVisualItem,
                                    index > 0 && styles.heroVisualItemOverlap,
                                ]}
                            >
                                {block.exercise.image ? (
                                    <Image
                                        source={block.exercise.image}
                                        style={styles.heroVisualImage}
                                        resizeMode="contain"
                                    />
                                ) : (
                                    <Activity size={22} color={block.exercise.color} />
                                )}
                            </View>
                        ))}
                    </View>

                    <View style={styles.heroRewardRow}>
                        <View style={styles.heroRewardBlock}>
                            <Text style={styles.heroRewardValue}>+{POINTS_REWARD}</Text>
                            <Text style={styles.heroRewardUnit}>pts to earn</Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => setShowWorkout(true)}
                            style={styles.heroCta}
                            activeOpacity={0.9}
                        >
                            <Play size={16} color="#FFFFFF" fill="#FFFFFF" />
                            <Text style={styles.heroCtaText}>Start</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.heroExerciseList}>
                        {sessionPreview.workoutExercises.map((block) => (
                            <View key={block.exercise.id} style={styles.heroExerciseRow}>
                                <View style={styles.heroExerciseThumb}>
                                    {block.exercise.image ? (
                                        <Image
                                            source={block.exercise.image}
                                            style={styles.heroExerciseThumbImage}
                                            resizeMode="contain"
                                        />
                                    ) : (
                                        <Activity size={16} color={block.exercise.color} />
                                    )}
                                </View>
                                <Text style={styles.heroExerciseName} numberOfLines={1}>
                                    {block.exercise.name}
                                </Text>
                                <Text style={styles.heroExerciseMeta}>{block.targetLabel}</Text>
                            </View>
                        ))}
                    </View>

                    <View style={styles.heroHomeToggle}>
                        <Home size={14} color={homeBasedOnly ? COLORS.primary : COLORS.textSub} />
                        <Text style={[styles.heroHomeToggleLabel, homeBasedOnly && styles.heroHomeToggleLabelActive]}>
                            Home based exercise only
                        </Text>
                        <Switch
                            value={homeBasedOnly}
                            onValueChange={setHomeBasedOnly}
                            trackColor={{ false: COLORS.lineStrong, true: COLORS.primary }}
                            thumbColor="#FFFFFF"
                            ios_backgroundColor={COLORS.lineStrong}
                        />
                    </View>
                </View>

                <View style={styles.libraryHeader}>
                    <Text style={styles.libraryTitle}>All exercises</Text>
                    <View style={styles.libraryCountBadge}>
                        <Text style={styles.libraryCountText}>{availableExercises.length}</Text>
                    </View>
                </View>

                <View style={styles.listContainer}>
                    {availableExercises.map((exercise) => {
                        const isComplete = completedExercises.includes(exercise.id);
                        const prescription = buildExercisePrescription(exercise, currentWeek);
                        return (
                            <TouchableOpacity
                                key={exercise.id}
                                style={[styles.listItem, isComplete && styles.listItemComplete]}
                                onPress={() => setSelectedExercise(exercise)}
                                activeOpacity={0.75}
                            >
                                <View style={styles.listItemImageContainer}>
                                    {exercise.image ? (
                                        <View style={styles.listItemImageWrapper}>
                                            <Image source={exercise.image} style={styles.listItemImage} resizeMode="contain" />
                                        </View>
                                    ) : (
                                        <View style={styles.listItemIconWrapper}>
                                            <Activity size={28} color={exercise.color} />
                                        </View>
                                    )}
                                    <View style={[styles.listItemAccent, { backgroundColor: exercise.color }]} />
                                </View>

                                <View style={styles.listItemBody}>
                                    <Text style={[styles.listItemName, isComplete && styles.listItemNameComplete]} numberOfLines={1}>
                                        {exercise.name}
                                    </Text>
                                    <Text style={styles.listItemReps}>{prescription.targetLabel}</Text>
                                </View>

                                {isComplete ? (
                                    <View style={styles.listItemCompleteBadge}>
                                        <Check size={14} color={COLORS.success} strokeWidth={3} />
                                    </View>
                                ) : (
                                    <ChevronRight size={18} color={COLORS.textMuted} strokeWidth={2} />
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </ScrollView>
        </View>
    );

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            {showWorkout ? (
                <GuidedMobility
                    exercises={availableExercises}
                    currentWeek={currentWeek}
                    onClose={() => setShowWorkout(false)}
                    onComplete={handleWorkoutComplete}
                />
            ) : selectedExercise ? (
                <ExerciseGuidePage
                    exercise={selectedExercise}
                    onBack={() => setSelectedExercise(null)}
                    onClose={onClose}
                />
            ) : (
                renderExerciseList()
            )}
        </Modal>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: COLORS.bg,
    },
    safeHeader: {
        backgroundColor: COLORS.bg,
    },
    container: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 48,
    },
    horizontalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingTop: 8,
        paddingBottom: 4,
    },
    headerSpacer: {
        width: 44,
    },
    exitBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.card,
        borderWidth: 1,
        borderColor: COLORS.line,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sessionOverview: {
        alignItems: 'center',
        gap: 6,
    },
    sessionMainTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: COLORS.textMain,
        letterSpacing: -0.4,
    },
    weekBadge: {
        backgroundColor: COLORS.line,
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 10,
    },
    weekBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: COLORS.textSub,
    },
    heroCard: {
        marginHorizontal: 20,
        marginTop: 16,
        backgroundColor: COLORS.card,
        borderRadius: 24,
        padding: 22,
        borderWidth: 1,
        borderColor: COLORS.line,
        shadowColor: '#1A1C1E',
        shadowOpacity: 0.04,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 2,
    },
    heroTitleBlock: {
        alignItems: 'center',
        gap: 8,
        marginBottom: 18,
    },
    heroTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: COLORS.textMain,
        letterSpacing: -0.4,
        textAlign: 'center',
    },
    heroMetaChips: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    heroMetaChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    heroMetaChipDot: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: COLORS.textMuted,
    },
    heroMetaChipText: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.textSub,
    },
    heroVisualRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 18,
    },
    heroVisualItem: {
        width: 60,
        height: 60,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        borderWidth: 2,
        borderColor: COLORS.line,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    heroVisualItemOverlap: {
        marginLeft: -14,
    },
    heroVisualImage: {
        width: '85%',
        height: '85%',
    },
    heroRewardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    heroRewardBlock: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 6,
    },
    heroRewardValue: {
        fontSize: 40,
        fontWeight: '900',
        color: COLORS.primary,
        letterSpacing: -1.5,
        lineHeight: 44,
    },
    heroRewardUnit: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.textSub,
    },
    heroExerciseList: {
        gap: 4,
        marginBottom: 18,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: COLORS.line,
    },
    heroExerciseRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 6,
    },
    heroExerciseThumb: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: COLORS.line,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    heroExerciseThumbImage: {
        width: '85%',
        height: '85%',
    },
    heroExerciseName: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.textMain,
    },
    heroExerciseMeta: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.textSub,
    },
    heroHomeToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 10,
        paddingHorizontal: 14,
        backgroundColor: '#FAFBFC',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.line,
    },
    heroHomeToggleLabel: {
        flex: 1,
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.textSub,
    },
    heroHomeToggleLabelActive: {
        color: COLORS.textMain,
    },
    heroCta: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: COLORS.primary,
        paddingVertical: 12,
        paddingHorizontal: 22,
        borderRadius: 14,
        shadowColor: COLORS.primary,
        shadowOpacity: 0.3,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
    },
    heroCtaText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '800',
    },
    libraryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingTop: 28,
        paddingBottom: 12,
    },
    libraryTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: COLORS.textMain,
        letterSpacing: -0.3,
    },
    libraryCountBadge: {
        minWidth: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: COLORS.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 10,
    },
    libraryCountText: {
        fontSize: 14,
        fontWeight: '800',
        color: COLORS.primary,
    },
    listContainer: {
        paddingHorizontal: 24,
        gap: 14,
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.card,
        borderRadius: 22,
        padding: 16,
        gap: 16,
        borderWidth: 1,
        borderColor: COLORS.line,
        shadowColor: '#1A1C1E',
        shadowOpacity: 0.04,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
    },
    listItemComplete: {
        backgroundColor: COLORS.successFade,
        borderColor: 'rgba(0, 184, 148, 0.18)',
    },
    listItemImageContainer: {
        position: 'relative',
    },
    listItemImageWrapper: {
        width: 64,
        height: 64,
        borderRadius: 18,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: COLORS.line,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    listItemImage: {
        width: '90%',
        height: '90%',
    },
    listItemIconWrapper: {
        width: 64,
        height: 64,
        borderRadius: 18,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: COLORS.line,
        alignItems: 'center',
        justifyContent: 'center',
    },
    listItemAccent: {
        position: 'absolute',
        left: 0,
        top: 12,
        bottom: 12,
        width: 3,
        borderTopRightRadius: 2,
        borderBottomRightRadius: 2,
    },
    listItemBody: {
        flex: 1,
        gap: 4,
        minWidth: 0,
    },
    listItemName: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.textMain,
        letterSpacing: -0.2,
    },
    listItemNameComplete: {
        color: COLORS.textSub,
    },
    listItemCompleteBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: COLORS.successFade,
        alignItems: 'center',
        justifyContent: 'center',
    },
    listItemReps: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.textSub,
    },
});
