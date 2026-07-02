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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
    X,
    Clock,
    Check,
    Activity,
    Play,
    Heart,
    ChevronRight,
} from 'lucide-react-native';
import { GuidedMobility, buildExercisePrescription, buildWorkoutSessionPlan, MobilityExercise } from './GuidedMobility';
import { ExerciseGuidePage } from './ExerciseGuidePage';
import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const COLORS = {
    primary: '#FF6B6B',
    bg: '#FAFAFA',
    card: '#FFFFFF',
    textMain: '#1A1C1E',
    textSub: '#6C757D',
    line: '#F1F3F5',
    success: '#00B894',
    successFade: 'rgba(0, 184, 148, 0.08)',
};

const MOBILITY_EXERCISES: MobilityExercise[] = [
    {
        id: 1,
        name: 'Lunges',
        duration: '3 min',
        reps: '12 per leg',
        description: 'A lower-body strength movement that builds balance, leg drive, and hip stability.',
        instructions: ['Stand tall', 'Step forward', 'Lower with control', 'Drive back up'],
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
        instructions: ['Face the bench', 'Plant your foot', 'Drive up tall', 'Step down slowly'],
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
        instructions: ['Brace your core', 'Push hips back', 'Keep back flat', 'Drive hips forward'],
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
        instructions: ['Chest up', 'Sit down and back', 'Keep heels grounded', 'Stand tall'],
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
        instructions: ['Start in plank', 'Lower chest with control', 'Keep body straight', 'Press back up'],
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
        instructions: ['Set shoulders first', 'Pull with control', 'Squeeze upper back', 'Lower slowly'],
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
        instructions: ['Lie on your back with knees bent', 'Press through your heels', 'Lift hips until body is straight', 'Lower under control'],
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
        instructions: ['Stack shoulders over elbows', 'Keep hips level', 'Brace your core', 'Breathe slowly'],
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
        instructions: ['Lie on your back with knees up', 'Brace your core', 'Extend opposite arm and leg slowly', 'Return and switch sides'],
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
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            <View style={styles.horizontalHeader}>
                <TouchableOpacity onPress={onClose} style={styles.exitBtn}>
                    <X size={20} color={COLORS.textMain} />
                </TouchableOpacity>
                <View style={styles.sessionOverview}>
                    <Text style={styles.sessionLabel}>WEEK {currentWeek}</Text>
                    <Text style={styles.sessionMainTitle}>Mobility Mix</Text>
                </View>
                <View style={{ width: 40 }} /> 
            </View>

            <LinearGradient
                colors={['#FF6B6B', '#FF8E8E']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroPreview}
            >
                <View style={styles.heroHeader}>
                    <View style={styles.heroBadgeRow}>
                        <View style={styles.heroPointsBadge}>
                            <Heart size={12} color="#FF6B6B" fill="#FF6B6B" />
                            <Text style={styles.heroPointsText}>+5 PTS</Text>
                        </View>
                        <View style={styles.heroKcalBox}>
                            <Activity size={12} color="#FFF" />
                            <Text style={styles.heroKcalText}>~{totalKcals} KCAL</Text>
                        </View>
                    </View>
                    
                    <View style={styles.heroToggleWrapper}>
                        <Text style={styles.heroToggleLabel}>HOME BASED</Text>
                        <Switch
                            value={homeBasedOnly}
                            onValueChange={setHomeBasedOnly}
                            trackColor={{ false: 'rgba(0,0,0,0.1)', true: 'rgba(255,255,255,0.4)' }}
                            thumbColor={homeBasedOnly ? '#FFF' : '#F1F3F5'}
                            style={{ transform: [{ scaleX: 0.7 }, { scaleY: 0.7 }] }}
                        />
                    </View>
                </View>

                <View style={styles.heroMainContent}>
                    <View style={styles.heroTextSection}>
                        <Text style={styles.heroUpperTitle}>WEEK {currentWeek}</Text>
                        <Text style={styles.heroMainTitle}>Performance Mix</Text>
                        
                        <View style={styles.heroVerticalList}>
                            {sessionPreview.workoutExercises.map((block) => (
                                <View key={block.exercise.id} style={styles.heroListRow}>
                                    <View style={[styles.miniDot, { backgroundColor: block.exercise.color }]} />
                                    <Text style={styles.heroListText} numberOfLines={1}>{block.exercise.name}</Text>
                                    <Text style={styles.heroListReps}>{block.targetLabel}</Text>
                                </View>
                            ))}
                        </View>
                    </View>

                    <TouchableOpacity onPress={() => setShowWorkout(true)} style={styles.heroBigPlayBtn}>
                        <Play size={24} color="#FF6B6B" fill="#FF6B6B" />
                    </TouchableOpacity>
                </View>

                <View style={styles.heroFooter}>
                    <View style={styles.heroFooterInfo}>
                        <Clock size={12} color="rgba(255,255,255,0.7)" />
                        <Text style={styles.heroFooterText}>approx. 12 mins</Text>
                    </View>
                    <View style={styles.heroFooterDivider} />
                    <View style={styles.heroFooterInfo}>
                        <Activity size={12} color="rgba(255,255,255,0.7)" />
                        <Text style={styles.heroFooterText}>Focused Mobility</Text>
                    </View>
                </View>
            </LinearGradient>

            <View style={styles.libraryHeader}>
                <Text style={styles.libraryTitle}>Form Library</Text>
                <Text style={styles.librarySubtext}>Master individual exercises</Text>
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
                            activeOpacity={0.8}
                        >
                            <View style={styles.listItemImageContainer}>
                                {exercise.image ? (
                                    <View style={styles.listItemImageWrapper}>
                                        <Image source={exercise.image} style={styles.listItemImage} resizeMode="contain" />
                                    </View>
                                ) : (
                                    <View style={[styles.listItemIconWrapper, { backgroundColor: `${exercise.color}10` }]}>
                                        <Activity size={24} color={exercise.color} />
                                    </View>
                                )}
                                <View style={[styles.listItemDot, { backgroundColor: exercise.color }]} />
                            </View>

                            <View style={styles.listItemBody}>
                                <Text style={[styles.listItemName, isComplete && styles.listItemNameComplete]}>{exercise.name}</Text>
                                <View style={styles.listItemMeta}>
                                    <Text style={styles.listItemReps}>{prescription.targetLabel}</Text>
                                    <View style={styles.listItemDivider} />
                                    <Text style={styles.listItemSets}>{prescription.rounds} SETS</Text>
                                </View>
                            </View>

                            {isComplete ? (
                                <View style={styles.listItemCheckMark}>
                                    <Check size={18} color={COLORS.success} strokeWidth={3} />
                                </View>
                            ) : (
                                <View style={styles.listItemArrow}>
                                    <ChevronRight size={18} color={COLORS.textSub} />
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                })}
                <View style={{ height: 40 }} />
            </View>
        </ScrollView>
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
    container: { flex: 1, backgroundColor: COLORS.bg },
    horizontalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 16,
    },
    exitBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.line,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sessionOverview: { alignItems: 'center' },
    sessionLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: COLORS.textSub,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 4,
    },
    sessionMainTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: COLORS.textMain,
    },
    heroPreview: {
        marginHorizontal: 20,
        marginTop: 20,
        borderRadius: 32,
        padding: 24,
        shadowColor: '#FF6B6B',
        shadowOpacity: 0.3,
        shadowRadius: 15,
        shadowOffset: { width: 0, height: 8 },
        elevation: 10,
    },
    heroHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    heroBadgeRow: {
        flexDirection: 'row',
        gap: 8,
    },
    heroPointsBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 14,
        gap: 6,
    },
    heroPointsText: {
        color: '#FF6B6B',
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    heroKcalBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 14,
        gap: 6,
    },
    heroKcalText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '700',
    },
    heroToggleWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.05)',
        paddingLeft: 12,
        paddingRight: 4,
        paddingVertical: 2,
        borderRadius: 20,
        gap: 4,
    },
    heroToggleLabel: {
        fontSize: 8,
        fontWeight: '900',
        color: 'rgba(255,255,255,0.9)',
        letterSpacing: 0.2,
    },
    heroMainContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    heroTextSection: {
        flex: 1,
    },
    heroUpperTitle: {
        fontSize: 10,
        fontWeight: '900',
        color: 'rgba(255,255,255,0.8)',
        letterSpacing: 2,
        marginBottom: 4,
    },
    heroMainTitle: {
        fontSize: 28,
        fontWeight: '900',
        color: '#FFFFFF',
        marginBottom: 12,
        letterSpacing: -0.5,
    },
    heroVerticalList: {
        gap: 8,
    },
    heroListRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 14,
    },
    heroListText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#FFFFFF',
        flex: 1,
    },
    heroListReps: {
        fontSize: 10,
        fontWeight: '700',
        color: 'rgba(255,255,255,0.7)',
    },
    miniDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    heroBigPlayBtn: {
        width: 68,
        height: 68,
        borderRadius: 34,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
    },
    heroFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.2)',
        paddingTop: 16,
        gap: 12,
    },
    heroFooterInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    heroFooterText: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 11,
        fontWeight: '600',
    },
    heroFooterDivider: {
        width: 1,
        height: 12,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    libraryHeader: {
        paddingHorizontal: 28,
        paddingTop: 28,
        paddingBottom: 12,
    },
    libraryTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: COLORS.textMain,
    },
    librarySubtext: {
        fontSize: 13,
        color: COLORS.textSub,
        fontWeight: '600',
        marginTop: 2,
    },
    listContainer: {
        paddingHorizontal: 20,
        gap: 12,
        paddingTop: 8,
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 12,
        gap: 14,
        borderWidth: 1,
        borderColor: COLORS.line,
        shadowColor: '#000',
        shadowOpacity: 0.02,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
    },
    listItemComplete: {
        backgroundColor: '#F8F9FA',
        borderColor: '#E9ECEF',
    },
    listItemImageContainer: {
        position: 'relative',
    },
    listItemImageWrapper: {
        width: 60,
        height: 60,
        borderRadius: 18,
        backgroundColor: '#F8F9FA',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    listItemImage: {
        width: '85%',
        height: '85%',
    },
    listItemIconWrapper: {
        width: 60,
        height: 60,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    listItemDot: {
        position: 'absolute',
        top: -2,
        right: -2,
        width: 8,
        height: 8,
        borderRadius: 4,
        borderWidth: 1.5,
        borderColor: '#FFFFFF',
    },
    listItemBody: {
        flex: 1,
        gap: 4,
    },
    listItemName: {
        fontSize: 16,
        fontWeight: '900',
        color: COLORS.textMain,
    },
    listItemNameComplete: {
        color: COLORS.textSub,
        textDecorationLine: 'line-through',
    },
    listItemMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    listItemReps: {
        fontSize: 12,
        fontWeight: '700',
        color: COLORS.textSub,
    },
    listItemDivider: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#DEE2E6',
    },
    listItemSets: {
        fontSize: 11,
        fontWeight: '800',
        color: COLORS.primary,
        letterSpacing: 0.5,
    },
    listItemArrow: {
        paddingRight: 4,
    },
    listItemCheckMark: {
        paddingRight: 4,
    },
});
