import React, { useEffect, useRef } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    SafeAreaView,
    Animated,
    Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import {
    ArrowRight,
    Activity,
    Heart,
    Trophy,
    Gamepad2,
    Camera,
} from 'lucide-react-native';

const { height: windowHeight } = Dimensions.get('window');
const height = Math.min(windowHeight, 800);

const COLORS = {
    coral: '#FF6B6B',
    white: '#FFFFFF',
    textMain: '#1F2937', // Dark Grey
    textSub: '#6B7280',  // Light Grey
    iconBg: '#FFF0F0',   // Light Coral Wash
};

interface Phase0Props {
    onNext: () => void;
}

export default function Phase0Welcome({ onNext }: Phase0Props) {
    // Animation Values for welcome screen
    const fadeHello = useRef(new Animated.Value(0)).current;
    const moveHello = useRef(new Animated.Value(20)).current;
    const fadeList = useRef(new Animated.Value(0)).current;
    const moveList = useRef(new Animated.Value(30)).current;
    const fadeButton = useRef(new Animated.Value(0)).current;
    const scaleButton = useRef(new Animated.Value(0.95)).current;

    useEffect(() => {
        Animated.stagger(100, [
            Animated.parallel([
                Animated.timing(fadeHello, { toValue: 1, duration: 700, useNativeDriver: true }),
                Animated.spring(moveHello, { toValue: 0, friction: 6, useNativeDriver: true }),
            ]),
            Animated.parallel([
                Animated.timing(fadeList, { toValue: 1, duration: 700, useNativeDriver: true }),
                Animated.spring(moveList, { toValue: 0, friction: 7, useNativeDriver: true }),
            ]),
            Animated.parallel([
                Animated.timing(fadeButton, { toValue: 1, duration: 500, useNativeDriver: true }),
                Animated.spring(scaleButton, { toValue: 1, friction: 5, useNativeDriver: true })
            ])
        ]).start();
    }, []);

    const FeatureRow = ({ icon, text }: { icon: React.ReactNode; text: string }) => (
        <View style={styles.featureRow}>
            <View style={styles.iconBox}>
                {icon}
            </View>
            <Text style={styles.featureText}>{text}</Text>
        </View>
    );

    return (
        <View style={{ flex: 1, width: '100%', backgroundColor: COLORS.white }}>
            <SafeAreaView style={{ flex: 1 }}>
                <View style={styles.welcomeContainer}>
                    {/* Header Section */}
                    <Animated.View style={[styles.headerSection, { opacity: fadeHello, transform: [{ translateY: moveHello }] }]}>
                        <Text style={styles.appTitle}>
                            Run<Text style={{ color: COLORS.coral }}>Together</Text>
                        </Text>
                        <Text style={styles.appSubtitle}>Couple Fitness App</Text>
                    </Animated.View>

                    {/* Image Section - Flexes to fill space */}
                    <Animated.View style={styles.imageSection}>
                        <Image
                            source={require('../../assets/onboard.png')}
                            style={styles.heroImage}
                            contentFit="contain"
                            transition={0}
                        />
                    </Animated.View>

                    {/* Feature List Section - Compact */}
                    <Animated.View style={[styles.featureSection, { opacity: fadeList, transform: [{ translateY: moveList }] }]}>
                        <FeatureRow
                            icon={<Activity size={18} color={COLORS.coral} />}
                            text="Weight loss & running plans"
                        />
                        <FeatureRow
                            icon={<Heart size={18} color={COLORS.coral} />}
                            text="Couple races & shared workouts"
                        />
                        <FeatureRow
                            icon={<Trophy size={18} color={COLORS.coral} />}
                            text="Points, rewards & marketplace"
                        />
                        <FeatureRow
                            icon={<Gamepad2 size={18} color={COLORS.coral} />}
                            text="Quests, wagers & challenges"
                        />
                        <FeatureRow
                            icon={<Camera size={18} color={COLORS.coral} />}
                            text="Camera-based calorie tracking"
                        />
                    </Animated.View>

                    {/* Button Section */}
                    <Animated.View style={[styles.buttonSection, { opacity: fadeButton, transform: [{ scale: scaleButton }] }]}>
                        <TouchableOpacity
                            style={styles.primaryButton}
                            activeOpacity={0.8}
                            onPress={onNext}
                        >
                            <Text style={styles.buttonText}>Get Started</Text>
                            <ArrowRight color="white" size={20} strokeWidth={3} />
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    welcomeContainer: {
        flex: 1,
        width: '100%',
        paddingHorizontal: 28,
        paddingBottom: 20,
        justifyContent: 'space-between',
        backgroundColor: 'transparent',
    },
    headerSection: {
        marginTop: 20,
        alignItems: 'center',
    },
    appTitle: {
        fontSize: 32,
        fontWeight: '900',
        color: COLORS.textMain,
        letterSpacing: -1,
    },
    appSubtitle: {
        fontSize: 16,
        color: COLORS.textSub,
        fontWeight: '500',
        marginTop: 4,
    },
    imageSection: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        maxHeight: height * 0.35,
        marginVertical: 10,
    },
    heroImage: {
        width: '100%',
        height: '100%',
    },
    featureSection: {
        gap: 16,
        marginBottom: 30,
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconBox: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: COLORS.iconBg,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    featureText: {
        fontSize: 15,
        color: COLORS.textMain,
        fontWeight: '600',
        flex: 1,
    },
    buttonSection: {
        width: '100%',
    },
    primaryButton: {
        backgroundColor: COLORS.coral,
        height: 54,
        borderRadius: 18,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        shadowColor: COLORS.coral,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
        elevation: 8,
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
});
