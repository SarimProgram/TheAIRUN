import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import Constants from 'expo-constants';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/auth/authContext';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_DISCOVERY = {
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

const COLORS = {
    brand: '#FF6B6B',
    ink: '#0F172A',
    white: '#FFFFFF',
    border: '#F1F5F9',
};

type Props = {
    onSuccess: () => void;
    onApplePress?: () => void;
    socialLoading?: 'google' | 'apple' | null;
    disabled?: boolean;
    userName?: string;
};

export default function SocialAuthRow({
    onSuccess,
    onApplePress,
    socialLoading = null,
    disabled = false,
    userName = '',
}: Props) {
    const { socialLogin } = useAuth();
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
                onSuccess();
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
        onSuccess,
        socialLogin,
        userName,
    ]);

    const handleGoogleAuth = async () => {
        if (disabled || googleLoading || socialLoading) return;

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

    const isGoogleLoading = googleLoading || socialLoading === 'google';
    const isAppleLoading = socialLoading === 'apple';

    return (
        <View style={styles.row}>
            <TouchableOpacity
                style={[styles.socialButton, styles.whiteButton]}
                onPress={handleGoogleAuth}
                disabled={disabled || isGoogleLoading || isAppleLoading}
                activeOpacity={0.8}
            >
                {isGoogleLoading ? (
                    <ActivityIndicator color={COLORS.brand} />
                ) : (
                    <Image
                        source={require('../../assets/google.png')}
                        style={styles.socialIconImage}
                        contentFit="contain"
                    />
                )}
            </TouchableOpacity>

            {Platform.OS === 'ios' ? (
                <AppleAuthentication.AppleAuthenticationButton
                    buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                    buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                    cornerRadius={29}
                    style={styles.appleNativeButton}
                    onPress={() => {
                        if (disabled || isGoogleLoading || isAppleLoading) return;
                        onApplePress?.();
                    }}
                />
            ) : (
                <TouchableOpacity
                    style={[styles.socialButton, styles.appleButton]}
                    onPress={() => {
                        if (disabled || isGoogleLoading || isAppleLoading) return;
                        onApplePress?.();
                    }}
                    disabled={disabled || isGoogleLoading || isAppleLoading}
                    activeOpacity={0.8}
                >
                    {isAppleLoading ? (
                        <ActivityIndicator color={COLORS.white} />
                    ) : (
                        <Ionicons name="logo-apple" size={26} color={COLORS.white} />
                    )}
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    socialButton: {
        width: 58,
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
        backgroundColor: COLORS.ink,
    },
    appleNativeButton: {
        width: 58,
        height: 58,
    },
    socialIconImage: {
        width: 24,
        height: 24,
    },
});
