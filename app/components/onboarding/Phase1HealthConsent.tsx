import React, { useEffect, useRef, useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    SafeAreaView,
    Animated,
    Dimensions,
    StatusBar,
    Platform,
    Alert,
    ActivityIndicator,
    Image,
    Keyboard,
} from 'react-native';
import { Lock, CheckCircle2 } from 'lucide-react-native';
import { requestStepPermissions } from '../../lib/requestStepPermissions';

const { height } = Dimensions.get('window');

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
            const granted = await requestStepPermissions();
            if (granted) {
                onNext();
            }
        } catch (err: any) {
            Alert.alert('Permission Error', err?.message || 'Failed to request health permissions.');
        } finally {
            setRequestingPermission(false);
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <SafeAreaView style={{ flex: 1 }}>
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
                            <Text style={styles.buttonText}>Enable Access</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.skipButton} onPress={onNext}>
                        <Text style={styles.skipText}>Maybe later</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    content: { 
        flex: 1, 
        paddingHorizontal: 40, 
        paddingTop: height * 0.08,
        alignItems: 'center'
    },
    imageContainer: {
        width: 140,
        height: 140,
        marginBottom: 48,
        justifyContent: 'center',
        alignItems: 'center',
    },
    healthImage: {
        width: 120,
        height: 120,
        zIndex: 2,
    },
    glowEffect: {
        position: 'absolute',
        width: 160,
        height: 160,
        borderRadius: 80,
        backgroundColor: COLORS.brand,
        opacity: 0.05,
        zIndex: 1,
    },
    header: { 
        alignItems: 'center',
        marginBottom: 40 
    },
    title: {
        fontSize: 32,
        fontWeight: '800',
        color: COLORS.textPrimary,
        letterSpacing: -1,
        marginBottom: 16,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 17,
        color: COLORS.textSecondary,
        lineHeight: 24,
        fontWeight: '400',
        textAlign: 'center',
    },
    benefitsContainer: {
        width: '100%',
        gap: 24,
        marginBottom: 40,
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
        paddingHorizontal: 40, 
        paddingBottom: 40, 
        gap: 12 
    },
    primaryButton: {
        backgroundColor: COLORS.brand,
        height: 60,
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
        fontSize: 18, 
        fontWeight: '700' 
    },
    skipButton: { 
        alignItems: 'center', 
        paddingVertical: 12 
    },
    skipText: { 
        color: COLORS.textSecondary, 
        fontSize: 15, 
        fontWeight: '600' 
    },
});
