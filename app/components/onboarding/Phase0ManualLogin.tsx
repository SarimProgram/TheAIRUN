import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ActivityIndicator,
    SafeAreaView,
    Dimensions,
    Animated,
    StatusBar,
    Platform,
    KeyboardAvoidingView,
    ScrollView,
} from 'react-native';
import { ChevronLeft, ArrowRight, Mail, Lock } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { height: windowHeight } = Dimensions.get('window');
const height = Math.min(windowHeight, 800);

const COLORS = {
    brand: '#FF6B6B',
    ink: '#0F172A',
    muted: '#94A3B8',
    white: '#FFFFFF',
    bg: '#FFFFFF',
    border: '#F1F5F9',
    soft: '#F8FAFC',
    iconBg: '#FFF0F0',
};

type Props = {
    onBack: () => void;
    onSuccess: () => void;
    onLogin: (email: string, password: string) => Promise<void>;
};

export default function Phase0ManualLogin({ onBack, onSuccess, onLogin }: Props) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(20)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
            Animated.spring(slideAnim, { toValue: 0, friction: 8, useNativeDriver: true }),
        ]).start();
    }, []);

    const handleSubmit = async () => {
        if (!email.trim() || !password) {
            Alert.alert('Missing fields', 'Please enter your email and password to continue.');
            return;
        }

        try {
            setLoading(true);
            await onLogin(email.trim(), password);
            onSuccess();
        } catch (err: any) {
            Alert.alert('Hold on', err?.message || 'Unable to sign you in right now.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <View style={styles.header}>
                    <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
                        <View style={styles.backCircle}>
                            <ChevronLeft color={COLORS.ink} size={24} />
                        </View>
                    </TouchableOpacity>
                </View>

                <Animated.View
                    style={[
                        styles.content,
                        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
                    ]}
                >
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.scrollContent}
                        keyboardShouldPersistTaps="handled"
                    >
                        <View style={styles.textGroup}>
                            <Text style={styles.mainTitle}>Welcome<Text style={{ color: COLORS.brand }}> back.</Text></Text>
                            <Text style={styles.subtitle}>Log in to continue tracking progress with your partner.</Text>
                        </View>

                        <View style={styles.form}>
                            <View style={styles.inputWrapper}>
                                <View style={styles.iconBox}>
                                    <Mail size={20} color={COLORS.brand} />
                                </View>
                                <TextInput
                                    placeholder="Your email address"
                                    placeholderTextColor={COLORS.muted}
                                    value={email}
                                    onChangeText={setEmail}
                                    style={styles.input}
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                />
                            </View>

                            <View style={styles.inputWrapper}>
                                <View style={styles.iconBox}>
                                    <Lock size={20} color={COLORS.brand} />
                                </View>
                                <TextInput
                                    placeholder="Your password"
                                    placeholderTextColor={COLORS.muted}
                                    value={password}
                                    onChangeText={setPassword}
                                    style={styles.input}
                                    secureTextEntry
                                />
                            </View>
                        </View>

                        <Text style={styles.encryptionNote}>Your data is private and encrypted</Text>
                    </ScrollView>

                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={styles.cta}
                            onPress={handleSubmit}
                            disabled={loading}
                            activeOpacity={0.9}
                        >
                            <LinearGradient
                                colors={['#FF6B6B', '#F43F5E']}
                                style={styles.ctaGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            >
                                {loading ? (
                                    <ActivityIndicator color={COLORS.white} />
                                ) : (
                                    <>
                                        <Text style={styles.ctaText}>Log In</Text>
                                        <ArrowRight color={COLORS.white} size={20} strokeWidth={3} />
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.bg,
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: 10,
        height: 54,
        justifyContent: 'center',
    },
    backBtn: {
        width: 44,
        height: 44,
    },
    backCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.white,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    content: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingTop: 10,
        paddingBottom: 20,
        justifyContent: 'center',
    },
    textGroup: {
        marginBottom: 25,
    },
    mainTitle: {
        fontSize: 38,
        fontWeight: '900',
        color: COLORS.ink,
        letterSpacing: -1.5,
        lineHeight: 44,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 15,
        color: COLORS.muted,
        fontWeight: '500',
        lineHeight: 20,
    },
    form: {
        gap: 10,
    },
    inputWrapper: {
        height: 54,
        borderRadius: 16,
        backgroundColor: COLORS.soft,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    iconBox: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: COLORS.iconBg,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: COLORS.ink,
        fontWeight: '600',
    },
    encryptionNote: {
        marginTop: 20,
        fontSize: 12,
        color: COLORS.muted,
        fontWeight: '600',
        textAlign: 'center',
    },
    footer: {
        paddingHorizontal: 24,
        paddingBottom: Platform.OS === 'ios' ? 20 : 15,
        paddingTop: 10,
    },
    cta: {
        height: 54,
        borderRadius: 27,
        overflow: 'hidden',
        shadowColor: COLORS.brand,
        shadowOpacity: 0.3,
        shadowRadius: 15,
        elevation: 8,
    },
    ctaGradient: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    ctaText: {
        color: COLORS.white,
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
});
