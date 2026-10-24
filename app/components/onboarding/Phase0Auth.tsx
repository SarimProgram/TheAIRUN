import React, { useEffect, useRef } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    Animated,
    SafeAreaView,
    StatusBar,
    Dimensions,
    Platform,
    Linking,
    Alert,
} from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { PRIVACY_POLICY_URL } from '../../config/legal';
import SocialAuthRow from './SocialAuthRow';

const { width: windowWidth, height: windowHeight } = Dimensions.get('window');
const width = Math.min(windowWidth, 480);
const height = Math.min(windowHeight, 800);

const COLORS = {
    brand: '#FF6B6B', 
    ink: '#0F172A',
    muted: '#94A3B8',
    white: '#FFFFFF',
    bg: '#FFFFFF',
    border: '#F1F5F9',
};

interface Props {
    onNext: () => void;
    onBack: () => void;
    onApplePress?: () => void;
    onManualPress?: () => void;
    onLoginPress?: () => void;
    socialLoading?: 'google' | 'apple' | null;
    disabled?: boolean;
    userName?: string;
    subtitle?: string;
}

export default function Phase0Expanded({
    onNext,
    onBack,
    onApplePress,
    onManualPress,
    onLoginPress,
    socialLoading = null,
    disabled = false,
    userName = '',
    subtitle,
}: Props) {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    const openLegalLink = async (url: string, label: string) => {
        const supported = await Linking.canOpenURL(url);
        if (!supported) {
            Alert.alert('Unavailable', `Unable to open ${label.toLowerCase()} right now.`);
            return;
        }
        await Linking.openURL(url);
    };

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
            Animated.spring(slideAnim, { toValue: 0, friction: 8, useNativeDriver: true }),
        ]).start();
    }, []);

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />

            <View style={styles.imageSection}>
                <Image
                    source={require('../../assets/widee.png')}
                    style={styles.heroImage}
                    contentFit="cover"
                />
                
                <LinearGradient
                    colors={[
                        'rgba(255, 107, 107, 0)',   
                        'rgba(255, 107, 107, 0.3)', 
                        '#FF6B6B'                   
                    ]}
                    style={styles.gradientOverlay}
                />

                <SafeAreaView style={styles.backBtnWrapper}>
                    <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                        <View style={styles.backCircle}>
                           <ChevronLeft color={COLORS.ink} size={28} />
                        </View>
                    </TouchableOpacity>
                </SafeAreaView>
            </View>

            <Animated.View style={[
                styles.bottomSection,
                { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
            ]}>
                <View style={styles.textGroup}>
                    <Text style={styles.mainAction}>Create account</Text>
                    <Text style={styles.subtitle}>
                        {subtitle ?? 'Save your progress. Invite your partner anytime.'}
                    </Text>
                </View>

                <View style={styles.authContainer}>
                    <SocialAuthRow
                        onSuccess={onNext}
                        onApplePress={onApplePress}
                        socialLoading={socialLoading}
                        disabled={disabled}
                        userName={userName}
                    />

                    <TouchableOpacity
                        style={styles.manualButton}
                        onPress={onManualPress || onNext}
                        disabled={disabled}
                    >
                        <Text style={styles.manualText}>Email</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.footer}>
                    <Text style={styles.authPrompt}>
                        Have an account?{' '}
                        <Text
                            style={styles.authPromptLink}
                            onPress={onLoginPress}
                        >
                            Log in
                        </Text>
                    </Text>

                    <Text style={styles.footerText}>
                        By signing up, you agree to our{' '}
                        <Text
                            style={styles.link}
                            onPress={() => openLegalLink(PRIVACY_POLICY_URL, 'Privacy Policy')}
                        >
                            Privacy Policy
                        </Text>
                    </Text>
                </View>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.bg,
    },
    imageSection: {
        flex: 1,
        width: '100%',
        position: 'relative',
        minHeight: height * 0.35,
    },
    heroImage: {
        width: '100%',
        height: '100%',
    },
    gradientOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 100,
    },
    backBtnWrapper: {
        position: 'absolute',
        top: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
        left: 0,
    },
    backBtn: {
        padding: 20,
    },
    backCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: COLORS.white,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 4,
    },
    bottomSection: {
        paddingHorizontal: 30,
        paddingTop: 30,
        backgroundColor: COLORS.bg,
        justifyContent: 'flex-start',
    },
    textGroup: {
        marginBottom: 30,
    },
    mainAction: {
        fontSize: 44,
        fontWeight: '900',
        color: COLORS.ink,
        letterSpacing: -1.5,
        lineHeight: 48,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: COLORS.muted,
        lineHeight: 20,
        fontWeight: '500',
    },
    authContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 30,
    },
    manualButton: {
        flex: 1,
        height: 58,
        backgroundColor: COLORS.white,
        borderRadius: 29,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    manualText: {
        color: COLORS.ink,
        fontSize: 16,
        fontWeight: '700',
    },
    footer: {
        marginBottom: Platform.OS === 'ios' ? 20 : 15,
        alignItems: 'center',
    },
    authPrompt: {
        fontSize: 14,
        color: COLORS.muted,
        textAlign: 'center',
        marginBottom: 14,
    },
    authPromptLink: {
        color: COLORS.ink,
        fontWeight: '700',
    },
    footerText: {
        fontSize: 12,
        color: COLORS.muted,
        textAlign: 'center',
        lineHeight: 18,
    },
    link: {
        color: COLORS.ink,
        fontWeight: '700',
    }
});
