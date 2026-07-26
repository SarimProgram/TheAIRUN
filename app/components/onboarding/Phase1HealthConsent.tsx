import React, { useEffect, useRef, useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    SafeAreaView,
    Animated,
    StatusBar,
    Platform,
    Alert,
    ActivityIndicator,
    Image,
    Keyboard,
} from 'react-native';
import { Lock, CheckCircle2 } from 'lucide-react-native';
import { requestStepPermissions } from '../../lib/requestStepPermissions';

const COLORS = {
    brand: '#FF6B6B',
    brandDark: '#EE5253',
    white: '#FFFFFF',
    textPrimary: '#1A1A1A',
    textSecondary: '#666666',
    border: '#F0F0F0',
    background: '#FFFFFF',
};

interface Phase1Props {
    onNext: () => void;
    onBack?: () => void;
}

export default function Phase1HealthConsent({ onNext, onBack }: Phase1Props) {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;
    const keyboardOffset = useRef(new Animated.Value(0)).current;
    const [requestingPermission, setRequestingPermission] = useState(false);

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
            Animated.spring(slideAnim, { toValue: 0, tension: 40, friction: 8, useNativeDriver: true }),
        ]).start();
    }, []);

    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const handleKeyboardShow = (event: any) => {
            Animated.timing(keyboardOffset, {
                toValue: -(event.endCoordinates?.height ? event.endCoordinates.height * 0.35 : 90),
                duration: event.duration ?? 250,
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
    }, [keyboardOffset]);

    const handleEnableAccess = async () => {
        if (requestingPermission) return;

        try {
            setRequestingPermission(true);
            await requestStepPermissions();
        } catch (err: any) {
            // Log but do not block progression. Apple requires that tapping the
            // primary CTA after a custom pre-prompt always proceeds past the screen.
            console.warn('Health permission request error:', err?.message);
        } finally {
            setRequestingPermission(false);
            onNext();
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <SafeAreaView style={styles.safeArea}>
                <Animated.View
                    style={[
                        styles.content,
                        { opacity: fadeAnim, transform: [{ translateY: Animated.add(slideAnim, keyboardOffset) }] }
                    ]}
                >

                    {/* Visual Asset Section */}
                    <View style={styles.imageContainer}>
                        <View style={styles.glowEffect} />
                        <Image 
                            source={require('../../assets/health.png')} 
                            style={styles.healthImage}
                            resizeMode="contain"
                        />
                    </View>

                    {/* Header Section */}
                    <View style={styles.header}>
                        <Text style={styles.title}>Your Body, Your Data</Text>
                        <Text style={styles.subtitle}>
                            We never share your health data with anyone, and you can delete it anytime.
                        </Text>
                    </View>

                    {/* Benefits Section */}
                    <View style={styles.benefitsContainer}>
                        {[
                            { title: 'Step Analysis', desc: 'Use your daily steps to build better plans.' },
                            { title: 'Privacy First', desc: 'We never share your health data, and you can delete it anytime.' }
                        ].map((item, index) => (
                            <View key={index} style={styles.benefitRow}>
                                <CheckCircle2 size={20} color={COLORS.brand} strokeWidth={2.5} />
                                <View style={styles.benefitText}>
                                    <Text style={styles.benefitTitle}>{item.title}</Text>
                                    <Text style={styles.benefitDesc}>{item.desc}</Text>
                                </View>
                            </View>
                        ))}
                    </View>

                    {/* Privacy Footer */}
                    <View style={styles.privacyRow}>
                        <Lock color={COLORS.textSecondary} size={14} />
                        <Text style={styles.privacyText}>Only step data is requested. </Text>
                    </View>
                </Animated.View>

                {/* Footer Actions */}
                <View style={styles.footer}>
                    <TouchableOpacity 
                        activeOpacity={0.8} 
                        style={styles.primaryButton} 
                        onPress={handleEnableAccess} 
                        disabled={requestingPermission}
                    >
                        {requestingPermission ? (
                            <ActivityIndicator color={COLORS.white} />
                        ) : (
                            <Text style={styles.buttonText}>Continue</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    safeArea: {
        flex: 1,
        justifyContent: 'center',
        paddingVertical: 16,
    },
    content: { 
        paddingHorizontal: 24, 
        alignItems: 'center',
    },
    imageContainer: {
        width: 88,
        height: 88,
        marginBottom: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    healthImage: {
        width: 70,
        height: 70,
        zIndex: 2,
    },
    glowEffect: {
        position: 'absolute',
        width: 104,
        height: 104,
        borderRadius: 52,
        backgroundColor: COLORS.brand,
        opacity: 0.05,
        zIndex: 1,
    },
    header: { 
        alignItems: 'center',
        marginBottom: 16 
    },
    title: {
        fontSize: 26,
        fontWeight: '800',
        color: COLORS.textPrimary,
        letterSpacing: -0.5,
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 14,
        color: COLORS.textSecondary,
        lineHeight: 20,
        fontWeight: '400',
        textAlign: 'center',
        paddingHorizontal: 10,
    },
    benefitsContainer: {
        width: '100%',
        gap: 12,
        marginBottom: 14,
    },
    benefitRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 16,
    },
    benefitText: {
        flex: 1,
    },
    benefitTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginBottom: 2,
    },
    benefitDesc: {
        fontSize: 14,
        color: COLORS.textSecondary,
        lineHeight: 20,
    },
    privacyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    privacyText: { 
        color: COLORS.textSecondary, 
        fontSize: 13, 
        fontWeight: '500' 
    },
    footer: { 
        paddingHorizontal: 30, 
        paddingTop: 18,
        gap: 8 
    },
    primaryButton: {
        backgroundColor: COLORS.brand,
        height: 54,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: COLORS.brand,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 5,
    },
    buttonText: { 
        color: COLORS.white, 
        fontSize: 16, 
        fontWeight: '700' 
    },
});
