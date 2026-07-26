import React, { useEffect, useRef, useState } from 'react';
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
    Alert,
    Linking,
} from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import Constants from 'expo-constants';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import { PRIVACY_POLICY_URL } from '../../config/legal';
import { useAuth } from '@/src/auth/authContext';

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

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_DISCOVERY = {
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

interface Props {
    onNext: () => void;
    onBack: () => void;
    onGooglePress?: () => void | Promise<void>;
    onApplePress?: () => void;
    onManualPress?: () => void;
    onLoginPress?: () => void;
    socialLoading?: 'google' | 'apple' | null;
    disabled?: boolean;
    userName?: string;
}

export default function Phase0Expanded({
    onNext,
    onBack,
    onGooglePress,
    onApplePress,
    onManualPress,
    onLoginPress,
    socialLoading = null,
    disabled = false,
    userName = '',
}: Props) {
    const { socialLogin } = useAuth();
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;
    const lastHandledGoogleResponseRef = useRef<string | null>(null);
    const [googleLoading, setGoogleLoading] = useState(false);
    const extra: any = Constants.expoConfig?.extra ?? (Constants as any).manifest2?.extra ?? {};
    const oauth = extra.oauth ?? {};
    const googleOAuth = oauth.google ?? {};
    const [googleRequest, googleResponse, promptGoogleAuth] = Google.useAuthRequest({
        clientId: googleOAuth.expoClientId,
        iosClientId: googleOAuth.iosClientId,
        androidClientId: googleOAuth.androidClientId,
        webClientId: googleOAuth.webClientId,
        responseType: 'code',
        shouldAutoExchangeCode: true,
        scopes: ['openid', 'profile', 'email'],
        selectAccount: true,
    });

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

    useEffect(() => {
        const run = async () => {
            if (!googleResponse) return;

            const responseKey = JSON.stringify({
                type: googleResponse.type,
                code: (googleResponse as any)?.params?.code ?? null,
                idToken:
                    (googleResponse as any)?.authentication?.idToken ??
                    (googleResponse as any)?.authentication?.id_token ??
                    null,
            });

            if (lastHandledGoogleResponseRef.current === responseKey) return;

            if (googleResponse.type !== 'success') {
                lastHandledGoogleResponseRef.current = responseKey;
                setGoogleLoading(false);
                return;
            }

            lastHandledGoogleResponseRef.current = responseKey;

            const autoIdToken =
                (googleResponse.authentication as any)?.idToken ||
                (googleResponse.authentication as any)?.id_token;
            const authCode = (googleResponse.params as any)?.code;
            const codeVerifier = (googleRequest as any)?.codeVerifier;
            const redirectUri = (googleRequest as any)?.redirectUri;
            const clientId =
                (googleRequest as any)?.clientId ||
                (Platform.OS === 'ios'
                    ? googleOAuth.iosClientId
                    : Platform.OS === 'android'
                        ? googleOAuth.androidClientId
                        : googleOAuth.webClientId) ||
                googleOAuth.expoClientId;

            if (!autoIdToken && (!authCode || !codeVerifier || !redirectUri || !clientId)) {
                setGoogleLoading(false);
                Alert.alert('Google Login Failed', 'Missing Google auth code or PKCE values.');
                return;
            }

            try {
                let idToken = autoIdToken;
                if (!idToken) {
                    const tokenRes: any = await AuthSession.exchangeCodeAsync(
                        {
                            clientId,
                            code: authCode!,
                            redirectUri,
                            extraParams: { code_verifier: codeVerifier! },
                        } as any,
                        GOOGLE_DISCOVERY as any
                    );

                    idToken = tokenRes?.idToken || tokenRes?.id_token || tokenRes?.params?.id_token;
                }

                if (!idToken) throw new Error('Google token exchange did not return an ID token.');

                await socialLogin('google', idToken, userName.trim() || undefined);
                onNext();
            } catch (err: any) {
                Alert.alert('Google Login Failed', err?.message || 'Unable to continue with Google.');
            } finally {
                setGoogleLoading(false);
            }
        };

        run();
    }, [
        googleOAuth.androidClientId,
        googleOAuth.expoClientId,
        googleOAuth.iosClientId,
        googleOAuth.webClientId,
        googleRequest,
        googleResponse,
        onNext,
        socialLogin,
        userName,
    ]);

    const handleGoogleAuth = async () => {
        if (disabled || googleLoading) return;

        const hasGoogleClientId =
            !!googleOAuth.expoClientId ||
            !!googleOAuth.iosClientId ||
            !!googleOAuth.androidClientId ||
            !!googleOAuth.webClientId;

        if (!hasGoogleClientId) {
            Alert.alert(
                'Google Auth Not Configured',
                'Add Google OAuth client IDs to app.json > expo.extra.oauth.google before using Google sign-in.'
            );
            return;
        }

        try {
            setGoogleLoading(true);
            const result = await promptGoogleAuth();
            if (result.type !== 'success') {
                setGoogleLoading(false);
            }
        } catch (err: any) {
            setGoogleLoading(false);
            Alert.alert('Google Login Failed', err?.message || 'Unable to start Google sign-in.');
        }
    };

    const SocialButton = ({ title, onPress, variant = 'white' }: any) => {
        const isLoading = (title === 'Google' && (googleLoading || socialLoading === 'google')) ||
                          (socialLoading === 'apple' && title === 'Apple');

        return (
            <TouchableOpacity
                style={[
                    styles.socialButton,
                    variant === 'apple' ? styles.appleButton : styles.whiteButton,
                ]}
                onPress={onPress}
                disabled={disabled || isLoading}
                activeOpacity={0.8}
            >
                <View style={styles.iconContent}>
                    {isLoading ? (
                         <Animated.View style={styles.loadingIndicator} />
                    ) : (
                        title === 'Google' ? (
                            <Image
                                source={require('../../assets/google.png')}
                                style={styles.socialIconImage}
                                contentFit="contain"
                            />
                        ) : (
                            <Image
                                source={require('../../assets/721335.png')}
                                style={styles.socialIconImage}
                                contentFit="contain"
                            />
                        )
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />

            {/* Top Image - Now slightly smaller to give bottom more space */}
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

            {/* Bottom Section */}
            <Animated.View style={[
                styles.bottomSection,
                { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
            ]}>
                <View style={styles.textGroup}>
                    <Text style={styles.title}>Welcome,</Text>
                    <Text style={styles.mainAction}>Get Started</Text>
                    <Text style={styles.subtitle}>Create an account to share your progress with your partner.</Text>
                </View>

                <View style={styles.authContainer}>
                    <SocialButton title="Google" variant="google" onPress={onGooglePress || handleGoogleAuth} />

                    {Platform.OS === 'ios' ? (
                        <AppleAuthentication.AppleAuthenticationButton
                            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                            cornerRadius={29}
                            style={styles.appleNativeButton}
                            onPress={() => {
                                if (disabled || socialLoading) return;
                                onApplePress?.();
                            }}
                        />
                    ) : (
                        <SocialButton title="Apple" variant="apple" onPress={onApplePress || onNext} />
                    )}

                    <TouchableOpacity
                        style={styles.manualButton}
                        onPress={onManualPress || onNext}
                        disabled={disabled}
                    >
                        <Text style={styles.manualText}>Use Email</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.footer}>
                    <Text style={styles.authPrompt}>
                        Already have an account?{' '}
                        <Text
                            style={styles.authPromptLink}
                            onPress={onLoginPress}
                        >
                            Log in
                        </Text>
                    </Text>

                    <Text style={styles.footerText}>
                        By continuing, review our{' '}
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
        flex: 1, // Let image section take remaining space
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
        height: 100, // Fixed height for a controlled coral transition
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
        paddingHorizontal: 30, // Reduced from 40
        paddingTop: 30, // Reduced from 40
        backgroundColor: COLORS.bg,
        justifyContent: 'flex-start',
    },
    textGroup: {
        marginBottom: 30, // Reduced from 45
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.muted,
        marginBottom: 6,
        letterSpacing: 0.5,
    },
    mainAction: {
        fontSize: 44, // Reduced from 54
        fontWeight: '900',
        color: COLORS.ink,
        letterSpacing: -1.5,
        lineHeight: 48,
        marginBottom: 8, // Reduced from 12
    },
    subtitle: {
        fontSize: 14, // Reduced from 15
        color: COLORS.muted,
        lineHeight: 20,
        fontWeight: '500',
    },
    authContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12, // Reduced from 15
        marginBottom: 30, // Reduced from 40
    },
    socialButton: {
        width: 58, // Reduced from 68
        height: 58,
        borderRadius: 29,
        alignItems: 'center',
        justifyContent: 'center',
    },
    whiteButton: {
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    appleButton: {
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    appleNativeButton: {
        width: 58,
        height: 58,
    },
    iconContent: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    socialIconImage: {
        width: 24, // Reduced from 26
        height: 24,
    },
    manualButton: {
        flex: 1,
        height: 58, // Reduced from 68
        backgroundColor: COLORS.white,
        borderRadius: 29,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    manualText: {
        color: COLORS.ink,
        fontSize: 16, // Reduced from 17
        fontWeight: '700',
    },
    loadingIndicator: {
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: COLORS.brand,
    },
    footer: {
        marginBottom: Platform.OS === 'ios' ? 20 : 15, // Reduced from 40/30
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
