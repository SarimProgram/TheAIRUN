import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    Platform,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    ScrollView,
    Image,
    Keyboard,
} from 'react-native';
import { ArrowRight, ChevronLeft } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width: windowWidth, height: windowHeight } = Dimensions.get('window');
const width = Math.min(windowWidth, 480);
const height = Math.min(windowHeight, 800);

const COLORS = {
    brand: '#FF3B3B', // Vibrant high-energy red
    brandDark: '#D62F2F',
    ink: '#121212',
    white: '#FFFFFF',
    offWhite: '#F5F5F7',
    muted: '#999999',
    line: '#F0F0F0',
    border: '#F0F0F0',
};

export default function Phase2Goals({ onNext, onBack, prefilledName }: any) {
    const trimmedPrefilled = typeof prefilledName === 'string' ? prefilledName.trim() : '';
    const hasPrefilledName = trimmedPrefilled.length > 0;
    const [name, setName] = useState(trimmedPrefilled);
    const [gender, setGender] = useState<string | null>(null);
    const genderOptions = [
        { label: 'Male', value: 'male' },
        { label: 'Female', value: 'female' },
    ];
    
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(40)).current;
    const progressAnim = useRef(new Animated.Value(0)).current;
    const keyboardOffset = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
            Animated.spring(slideAnim, { toValue: 0, tension: 20, useNativeDriver: true }),
            Animated.timing(progressAnim, { toValue: 0.25, duration: 1000, useNativeDriver: false }), // Progress for Phase 2
        ]).start();
    }, []);

    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const handleKeyboardShow = (event: any) => {
            Animated.timing(keyboardOffset, {
                toValue: -(event.endCoordinates?.height ? event.endCoordinates.height * 0.3 : 100),
                duration: event?.duration ?? 250,
                useNativeDriver: true,
            }).start();
        };

        const handleKeyboardHide = (event: any) => {
            Animated.timing(keyboardOffset, {
                toValue: 0,
                duration: event?.duration ?? 250,
                useNativeDriver: true,
            }).start();
        };

        const showSubscription = Keyboard.addListener(showEvent, handleKeyboardShow);
        const hideSubscription = Keyboard.addListener(hideEvent, handleKeyboardHide);

        return () => {
            showSubscription.remove();
            hideSubscription.remove();
        };
    }, []);

    const canContinue = name.trim().length > 0 && !!gender;

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            
            {/* 1. High-End Branding Hero Header */}
            <LinearGradient colors={[COLORS.brand, COLORS.brandDark]} style={styles.hero}>
                <View style={styles.statusBarCover} />
                <View style={styles.progressContainer}>
                    <Animated.View 
                        style={[
                            styles.progressBar, 
                            { width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }
                        ]} 
                    />
                </View>

                <SafeAreaView style={styles.heroSafeSpace}>
                    <View style={styles.heroHeader}>
                        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                            <ChevronLeft color={COLORS.white} size={28} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.heroMainContent}>
                        <View style={styles.brandingBox}>
                            <Image 
                                source={require('../../assets/logo.png')} 
                                style={styles.logoImage}
                                resizeMode="contain"
                            />
                            <Text style={styles.heroLabel}>LET’S MAKE IT YOURS</Text>
                        </View>
                    </View>
                </SafeAreaView>
            </LinearGradient>

            {/* 2. Floating Content Section */}
            <Animated.View 
                style={[
                    styles.content, 
                    { 
                        opacity: fadeAnim, 
                        transform: [
                            { translateY: Animated.add(slideAnim, keyboardOffset) }
                        ] 
                    }
                ]}
            >
                <ScrollView 
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                >
                    <View style={styles.textGroup}>
                        <Text style={styles.welcomeText}>Let’s get started!</Text>
                        <Text style={styles.mainTitle}>Tell us about you</Text>
                    </View>

                    <View style={styles.formArea}>
                        {!hasPrefilledName && (
                            <View style={styles.inputGroup}>
                                <Text style={styles.fieldLabel}>YOUR NAME</Text>
                                <TextInput
                                    style={styles.mainInput}
                                    placeholder="Enter your name"
                                    placeholderTextColor={COLORS.muted}
                                    value={name}
                                    onChangeText={setName}
                                    selectionColor={COLORS.brand}
                                />
                                <View style={styles.underline} />
                            </View>
                        )}

                        <View style={styles.inputGroup}>
                            <Text style={styles.fieldLabel}>CHOOSE ONE</Text>
                            <View style={styles.genderRow}>
                                {genderOptions.map((opt) => (
                                    <TouchableOpacity
                                        key={opt.value}
                                        onPress={() => setGender(opt.value)}
                                        style={[
                                            styles.pill,
                                            gender === opt.value && styles.pillActive
                                        ]}
                                    >
                                        <Text style={[
                                            styles.pillText,
                                            gender === opt.value && styles.pillTextActive
                                        ]}>{opt.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* 3. Action Button */}
                        <View style={styles.footer}>
                            <TouchableOpacity 
                                disabled={!canContinue}
                                onPress={() => onNext(name, gender)}
                                style={[styles.nextBtn, !canContinue && styles.nextBtnDisabled]}
                                activeOpacity={0.9}
                            >
                                <Text style={styles.nextBtnText}>Let’s go</Text>
                                <View style={styles.nextIconWrap}>
                                    <ArrowRight color={COLORS.white} size={20} strokeWidth={3} />
                                </View>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.white,
    },
    hero: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: height * 0.4,
        overflow: 'hidden',
    },
    statusBarCover: {
        height: Platform.OS === 'ios' ? 44 : 24,
    },
    progressContainer: {
        height: 3,
        width: '100%',
        backgroundColor: 'rgba(255,255,255,0.15)',
    },
    progressBar: {
        height: '100%',
        backgroundColor: COLORS.white,
        shadowColor: COLORS.white,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 4,
    },
    heroSafeSpace: {
        flex: 1,
    },
    heroHeader: {
        paddingHorizontal: 25,
        marginTop: 10,
    },
    backBtn: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroMainContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingBottom: height * 0.08,
    },
    brandingBox: {
        alignItems: 'center',
        gap: 16,
    },
    logoImage: {
        width: 80,
        height: 80,
        opacity: 0.95,
    },
    heroLabel: {
        color: COLORS.white,
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 2,
        opacity: 0.7,
    },
    content: {
        flex: 1,
        marginTop: height * 0.25, 
        backgroundColor: COLORS.white,
        borderTopLeftRadius: 40,
        borderTopRightRadius: 40,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.05,
        shadowRadius: 20,
        elevation: 10,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
        paddingTop: 30,
        paddingBottom: 30,
    },
    textGroup: {
        width: '100%',
        marginBottom: 25,
    },
    welcomeText: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.brand,
        marginBottom: 4,
    },
    mainTitle: {
        fontSize: 30,
        fontWeight: '900',
        color: COLORS.ink,
        letterSpacing: -1,
    },
    formArea: {
        width: '100%',
    },
    inputGroup: {
        width: '100%',
        marginBottom: 25,
    },
    fieldLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: COLORS.muted,
        letterSpacing: 1.5,
        marginBottom: 10,
    },
    mainInput: {
        width: '100%',
        fontSize: 20,
        fontWeight: '600',
        color: COLORS.ink,
        paddingVertical: 8,
    },
    underline: {
        width: '100%',
        height: 1.5,
        backgroundColor: COLORS.line,
        marginTop: 5,
    },
    genderRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    pill: {
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 16,
        backgroundColor: '#FAFAFA',
        borderWidth: 1.5,
        borderColor: '#F0F0F0',
    },
    pillActive: {
        backgroundColor: '#FFF0F0',
        borderColor: COLORS.brand,
    },
    pillText: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.muted,
    },
    pillTextActive: {
        color: COLORS.brand,
    },
    footer: {
        width: '100%',
        marginTop: 20,
    },
    nextBtn: {
        backgroundColor: COLORS.ink,
        height: 54,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        shadowColor: COLORS.ink,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 15,
        elevation: 5,
    },
    nextBtnDisabled: {
        backgroundColor: COLORS.offWhite,
        shadowOpacity: 0,
        elevation: 0,
    },
    nextBtnText: {
        color: COLORS.white,
        fontSize: 16,
        fontWeight: '700',
    },
    nextIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: COLORS.brand,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
