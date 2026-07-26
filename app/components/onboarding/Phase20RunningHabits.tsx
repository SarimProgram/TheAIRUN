import React, { useState, useRef } from 'react';
import {
    StyleSheet,
    View,
    Text,
    SafeAreaView,
    TouchableOpacity,
    Animated,
    StatusBar,
    Dimensions,
} from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import {
    Calendar, CalendarDays, CalendarRange,
    XCircle, Frown, BatteryLow, CalendarX,
    Clock, Timer, Hourglass,
    ChevronRight
} from 'lucide-react-native';

const { width: windowWidth } = Dimensions.get('window');
const width = Math.min(windowWidth, 480);

const COLORS = {
    bg: '#FFFFFF',
    coral: '#FF6B6B',
    coralGrad: '#FF8E8E',
    textMain: '#1A1A1A',
    textSub: '#707070',
    cardBg: '#FFFFFF',
    selection: '#FFF8F8',
    white: '#FFFFFF',
    disabledBtn: '#F2F2F2',
    disabledText: '#A0A0A0',
};

const STEPS = [
    {
        id: 'daysPerWeek',
        tag: 'FREQUENCY',
        title: 'Weekly Commitment',
        subtitle: 'How many days per week feels realistic right now?',
        options: [
            { id: '2days', label: '2 days', icon: Calendar },
            { id: '3days', label: '3 days', icon: CalendarDays },
            { id: '4days', label: '4 days', icon: CalendarRange },
        ],
    },
    {
        id: 'streakBreaker',
        tag: 'CHALLENGES',
        title: 'Streak Breakers',
        subtitle: 'What usually breaks your streak?',
        options: [
            { id: 'missingOneDay', label: 'Missing one day', icon: XCircle },
            { id: 'feelingSore', label: 'Feeling sore', icon: Frown },
            { id: 'losingMotivation', label: 'Losing motivation', icon: BatteryLow },
            { id: 'scheduleDisruption', label: 'Schedule disruption', icon: CalendarX },
        ],
    },
    {
        id: 'minRunTime',
        tag: 'PREFERENCES',
        title: 'Minimum Effort',
        subtitle: 'How short is "too short" for a run to feel worth it?',
        options: [
            { id: '5min', label: '5 minutes', icon: Clock },
            { id: '10min', label: '10 minutes', icon: Timer },
            { id: '15min', label: '15 minutes', icon: Hourglass },
        ],
    },
];

export default function Phase20RunningHabits({ onComplete }: any) {
    const [currentStep, setCurrentStep] = useState(0);
    const [selections, setSelections] = useState<Record<string, string>>({});

    const fadeAnim = useRef(new Animated.Value(1)).current;
    const slideAnim = useRef(new Animated.Value(0)).current;

    const stepData = STEPS[currentStep];
    const selectedOptionId = selections[stepData.id];
    const isButtonActive = !!selectedOptionId;

    const handleNext = () => {
        if (currentStep < STEPS.length - 1) {
            // Animate out
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
                Animated.timing(slideAnim, { toValue: -10, duration: 200, useNativeDriver: true })
            ]).start(() => {
                setCurrentStep(currentStep + 1);
                // Animate in
                slideAnim.setValue(20);
                Animated.parallel([
                    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
                    Animated.spring(slideAnim, { toValue: 0, tension: 20, friction: 7, useNativeDriver: true })
                ]).start();
            });
        } else {
            onComplete?.(selections);
        }
    };

    const toggleSelection = (id: string) => {
        setSelections({ ...selections, [stepData.id]: id });
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />

            {/* Modern Top Wave Gradient */}
            <View style={styles.svgWrapper}>
                <Svg height="160" width={width} viewBox="0 0 1440 320" preserveAspectRatio="none">
                    <Defs>
                        <LinearGradient id="grad" x1="0" y1="0" x2="1" y2="0">
                            <Stop offset="0" stopColor={COLORS.coral} stopOpacity="1" />
                            <Stop offset="1" stopColor={COLORS.coralGrad} stopOpacity="1" />
                        </LinearGradient>
                    </Defs>
                    <Path
                        fill="url(#grad)"
                        d="M0,160L60,170.7C120,181,240,203,360,186.7C480,171,600,117,720,112C840,107,960,149,1080,154.7C1200,160,1320,128,1380,112L1440,96L1440,0L1380,0C1320,0,1200,0,1080,0C960,0,840,0,720,0C600,0,480,0,360,0C240,0,120,0,60,0L0,0Z"
                    />
                </Svg>
            </View>

            <SafeAreaView style={styles.safeArea}>
                <Animated.View style={[
                    styles.content,
                    { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
                ]}>

                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.stepTitle}>{stepData.tag}</Text>
                        <Text style={styles.title}>{stepData.title}</Text>
                        <Text style={styles.subtitle}>{stepData.subtitle}</Text>
                    </View>

                    {/* List */}
                    <View style={styles.list}>
                        {stepData.options.map((item) => {
                            const isSelected = selectedOptionId === item.id;
                            const Icon = item.icon;
                            return (
                                <TouchableOpacity
                                    key={item.id}
                                    activeOpacity={0.8}
                                    onPress={() => toggleSelection(item.id)}
                                    style={[styles.card, isSelected && styles.cardSelected]}
                                >
                                    <View style={[styles.iconBox, isSelected && styles.iconBoxSelected]}>
                                        <Icon color={isSelected ? COLORS.white : COLORS.coral} size={22} strokeWidth={2.5} />
                                    </View>
                                    <Text style={[styles.cardText, isSelected && styles.cardTextSelected]}>
                                        {item.label}
                                    </Text>
                                    <View style={[styles.indicator, isSelected && styles.indicatorActive]} />
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* Button */}
                    <TouchableOpacity
                        style={[styles.button, !isButtonActive && styles.buttonDisabled]}
                        onPress={handleNext}
                        disabled={!isButtonActive}
                    >
                        <Text style={[styles.buttonText, !isButtonActive && styles.buttonTextDisabled]}>
                            {currentStep === STEPS.length - 1 ? 'Finish Setup' : 'Confirm & Continue'}
                        </Text>
                        <ChevronRight
                            color={isButtonActive ? COLORS.white : COLORS.disabledText}
                            size={24}
                            strokeWidth={3}
                        />
                    </TouchableOpacity>
                </Animated.View>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.bg,
    },
    svgWrapper: {
        position: 'absolute',
        top: 0,
    },
    safeArea: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        width: width * 0.88,
        alignItems: 'center',
    },
    header: {
        alignItems: 'center',
        marginBottom: 30,
    },
    stepTitle: {
        fontSize: 11,
        fontWeight: '900',
        color: COLORS.coral,
        letterSpacing: 2.5,
        marginBottom: 8,
    },
    title: {
        fontSize: 32,
        fontWeight: '800',
        color: COLORS.textMain,
        letterSpacing: -1,
    },
    subtitle: {
        fontSize: 15,
        color: COLORS.textSub,
        textAlign: 'center',
        marginTop: 10,
        lineHeight: 22,
        paddingHorizontal: 15,
    },
    list: {
        width: '100%',
        marginBottom: 30,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.white,
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderRadius: 22,
        marginBottom: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
        elevation: 3,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.02)',
    },
    cardSelected: {
        backgroundColor: COLORS.selection,
        borderColor: 'rgba(255, 107, 107, 0.2)',
    },
    iconBox: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: '#FFF5F5',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    iconBoxSelected: {
        backgroundColor: COLORS.coral,
    },
    cardText: {
        flex: 1,
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.textMain,
    },
    cardTextSelected: {
        color: COLORS.coral,
    },
    indicator: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#EAEAEA',
    },
    indicatorActive: {
        backgroundColor: COLORS.coral,
        transform: [{ scale: 1.2 }],
    },
    button: {
        width: '100%',
        backgroundColor: COLORS.coral,
        height: 68,
        borderRadius: 24,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 25,
        shadowColor: COLORS.coral,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 5,
    },
    buttonDisabled: {
        backgroundColor: COLORS.disabledBtn,
        shadowOpacity: 0,
        elevation: 0,
    },
    buttonText: {
        color: COLORS.white,
        fontSize: 16,
        fontWeight: '800',
    },
    buttonTextDisabled: {
        color: COLORS.disabledText,
    },
});
