import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    Platform,
    LayoutAnimation,
    UIManager,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
    ArrowRight,
    ChevronLeft,
    Heart,
    Link2,
    CheckCircle2,
    Target,
    Users,
} from 'lucide-react-native';
import { API_BASE_URL, getDefaultHeaders } from '../../config/api';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: windowWidth } = Dimensions.get('window');
const width = Math.min(windowWidth, 480);

const COLORS = {
    paper: '#FAFAF8',
    coral: '#FF5A5F',
    coralSoft: '#FF8A8E',
    peach: '#F4F4F2',
    ink: '#1A1A1A',
    inkMuted: '#666666',
    white: '#FFFFFF',
    accent: 'rgba(255, 90, 95, 0.08)',
};

export type PartnerLookupInvite = {
    id: string;
    code?: string;
    toEmail: string;
    status?: string;
    fromUser?: {
        id: string;
        displayName: string;
        journey?: {
            currentWeight: number | null;
            targetWeight: number | null;
            weightToLose: number | null;
            unit: string;
            goalType: string | null;
            primaryGoal?: string | null;
        } | null;
    } | null;
};

interface Props {
    onBack: () => void;
    onConnect: (invite: PartnerLookupInvite) => void;
    onLoginWithInvite: (invite: PartnerLookupInvite) => void;
}

function maskEmail(email: string) {
    const [local, domain] = email.split('@');
    if (!local || !domain) return email;
    if (local.length <= 2) return `${local[0] ?? ''}•••@${domain}`;
    return `${local.slice(0, 2)}•••@${domain}`;
}

const WatercolourBleed = ({ style, delay = 0, size = 400 }: { style?: any; delay?: number; size?: number }) => {
    const anim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.delay(delay),
                Animated.timing(anim, {
                    toValue: 1,
                    duration: 12000,
                    useNativeDriver: true,
                }),
                Animated.timing(anim, {
                    toValue: 0,
                    duration: 12000,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, []);

    const scale = anim.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 1.25],
    });

    const rotate = anim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '25deg'],
    });

    const opacity = anim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0.04, 0.08, 0.04],
    });

    return (
        <Animated.View
            style={[
                styles.bleed,
                style,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    opacity,
                    transform: [{ scale }, { rotate }],
                },
            ]}
        />
    );
};

export default function Phase4PartnerCode({ onBack, onConnect, onLoginWithInvite }: Props) {
    const [code, setCode] = useState('');
    const [matchLoading, setMatchLoading] = useState(false);
    const [matchedInvite, setMatchedInvite] = useState<PartnerLookupInvite | null>(null);
    const [errorMessage, setErrorMessage] = useState('');

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(20)).current;
    const progressWidth = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
            Animated.spring(slideAnim, { toValue: 0, friction: 8, useNativeDriver: true }),
            Animated.timing(progressWidth, { toValue: 1, duration: 1200, delay: 500, useNativeDriver: false }),
        ]).start();
    }, []);

    const normalizedCode = useMemo(
        () => code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8),
        [code]
    );

    const partnerName = matchedInvite?.fromUser?.displayName || 'Partner';
    const partnerJourney = matchedInvite?.fromUser?.journey;
    const partnerGoal =
        (partnerJourney?.primaryGoal ?? partnerJourney?.goalType)
            ?.replace(/[_-]/g, ' ')
            .replace(/\b\w/g, (char) => char.toUpperCase()) || 'Weight Loss';
    const invitedEmail = matchedInvite?.toEmail ?? '';

    const handleFindCode = async () => {
        if (normalizedCode.length !== 8) {
            setErrorMessage('Codes must be 8 characters.');
            return;
        }

        setErrorMessage('');
        setMatchLoading(true);

        try {
            const res = await fetch(`${API_BASE_URL}/partner/invites/lookup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getDefaultHeaders(API_BASE_URL),
                },
                body: JSON.stringify({ code: normalizedCode }),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data?.error || data?.message || 'Verification failed.');
            }

            const invite = data?.invite as PartnerLookupInvite | undefined;
            if (!invite?.id) {
                setErrorMessage('No invite found for this code.');
                return;
            }

            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setMatchedInvite(invite);
        } catch (err: any) {
            setErrorMessage(err?.message || 'Server connection error.');
        } finally {
            setMatchLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />
            
            {/* Ambient Watercolour Elements */}
            <View style={StyleSheet.absoluteFill}>
                <LinearGradient colors={[COLORS.paper, COLORS.peach]} style={StyleSheet.absoluteFill} />
                <WatercolourBleed style={{ top: -80, right: -60 }} size={550} delay={0} />
                <WatercolourBleed style={{ bottom: -100, left: -80 }} size={500} delay={3000} />
            </View>

            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onBack} style={styles.backButton}>
                        <ChevronLeft color={COLORS.ink} size={24} />
                    </TouchableOpacity>
                    
                    <View style={styles.progressSection}>
                        <View style={styles.track}>
                            <Animated.View 
                                style={[
                                    styles.thumb, 
                                    { width: progressWidth.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }
                                ]} 
                            />
                        </View>
                    </View>
                    
                    <View style={{ width: 44 }} />
                </View>

                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    bounces={false}
                >
                    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
                        <View style={styles.hero}>
                            <Users color={COLORS.coral} size={32} strokeWidth={2.5} />
                            <Text style={styles.mainTitle}>Add your partner</Text>
                            <Text style={styles.mainSubtitle}>
                                Got a code? Pop it in here and link up with the person who invited you.
                            </Text>
                        </View>
                    </Animated.View>

                    <View style={styles.card}>
                        {!matchedInvite ? (
                            <View>
                                <View style={styles.inputWrapper}>
                                    <View style={styles.labelBox}>
                                        <Link2 color={COLORS.coral} size={14} />
                                        <Text style={styles.label}>ENTER CODE</Text>
                                    </View>
                                    <TextInput
                                        value={normalizedCode}
                                        onChangeText={setCode}
                                        autoCapitalize="characters"
                                        placeholder="ABC12345"
                                        placeholderTextColor="rgba(26, 26, 26, 0.2)"
                                        style={styles.input}
                                        maxLength={8}
                                        selectionColor={COLORS.coral}
                                    />
                                    {!!errorMessage && <Text style={styles.error}>{errorMessage}</Text>}
                                </View>

                                <TouchableOpacity
                                    style={[styles.actionBtn, matchLoading && styles.dimmed]}
                                    onPress={handleFindCode}
                                    disabled={matchLoading}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.actionBtnText}>
                                        {matchLoading ? 'Checking code...' : 'Find my partner'}
                                    </Text>
                                    <ArrowRight color={COLORS.white} size={20} strokeWidth={2.5} />
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <Animated.View style={styles.successView}>
                                <View style={styles.statusHeader}>
                                    <View style={styles.iconCircle}>
                                        <CheckCircle2 color={COLORS.coral} size={32} />
                                    </View>
                                    <View>
                                        <Text style={styles.successTitle}>Partner found</Text>
                                        <Text style={styles.partnerNameText}>{partnerName}</Text>
                                    </View>
                                </View>

                                <View style={styles.lightDivider} />

                                <View style={styles.metadataGrid}>
                                    <View style={styles.metaBox}>
                                        <Target color={COLORS.inkMuted} size={16} />
                                        <Text style={styles.metaValue}>{partnerGoal}</Text>
                                        <Text style={styles.metaLabel}>GOAL</Text>
                                    </View>
                                    <View style={styles.metaBox}>
                                        <Heart color={COLORS.coral} size={16} fill={COLORS.coral} />
                                        <Text style={styles.metaValue}>Ready</Text>
                                        <Text style={styles.metaLabel}>STATUS</Text>
                                    </View>
                                </View>

                                {!!invitedEmail && (
                                    <Text style={styles.inviteEmailNote}>
                                        You&apos;ll sign up with {maskEmail(invitedEmail)} to connect.
                                    </Text>
                                )}

                                <TouchableOpacity
                                    style={styles.confirmBtn}
                                    onPress={() => onConnect(matchedInvite)}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.confirmBtnText}>
                                        Connect with {partnerName}
                                    </Text>
                                    <ArrowRight color={COLORS.white} size={20} strokeWidth={2.5} />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => onLoginWithInvite(matchedInvite)}
                                    style={styles.secondaryAction}
                                >
                                    <Text style={styles.secondaryActionText}>Already have an account? Log in</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => setMatchedInvite(null)}
                                    style={styles.wrongLabel}
                                >
                                    <Text style={styles.wrongLabelText}>Not the right person? Try again</Text>
                                </TouchableOpacity>
                            </Animated.View>
                        )}
                    </View>
                    
                    <View style={styles.footer}>
                        <Text style={styles.footerText}>
                            We only share this with the person you choose.
                        </Text>
                    </View>
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.paper,
    },
    bleed: {
        position: 'absolute',
        backgroundColor: COLORS.coral,
    },
    safeArea: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 10,
        justifyContent: 'space-between',
    },
    backButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
    },
    progressSection: {
        alignItems: 'center',
        flex: 1,
    },
    track: {
        width: 80,
        height: 3,
        backgroundColor: 'rgba(26, 26, 26, 0.05)',
        borderRadius: 1.5,
        overflow: 'hidden',
        marginBottom: 6,
    },
    thumb: {
        height: '100%',
        backgroundColor: COLORS.coral,
    },
    phaseLabel: {
        fontSize: 9,
        fontWeight: '900',
        color: COLORS.inkMuted,
        letterSpacing: 1.5,
    },
    scrollContent: {
        paddingHorizontal: 28,
        paddingTop: 30,
        paddingBottom: 60,
    },
    hero: {
        marginBottom: 35,
    },
    mainTitle: {
        fontSize: 34,
        fontWeight: '900',
        color: COLORS.ink,
        letterSpacing: -1,
        marginTop: 16,
        marginBottom: 12,
    },
    mainSubtitle: {
        fontSize: 16,
        lineHeight: 24,
        color: COLORS.inkMuted,
        fontWeight: '500',
    },
    card: {
        backgroundColor: COLORS.white,
        borderRadius: 30,
        padding: 26,
        shadowColor: COLORS.ink,
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.08,
        shadowRadius: 35,
        elevation: 12,
    },
    inputWrapper: {
        marginBottom: 26,
    },
    labelBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 14,
    },
    label: {
        fontSize: 11,
        fontWeight: '900',
        color: COLORS.inkMuted,
        letterSpacing: 1.2,
    },
    input: {
        fontSize: 28,
        fontWeight: '900',
        color: COLORS.ink,
        letterSpacing: 6,
        textAlign: 'center',
        height: 75,
        backgroundColor: COLORS.peach,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: 'rgba(255, 90, 95, 0.08)',
    },
    error: {
        color: COLORS.coral,
        fontSize: 13,
        fontWeight: '600',
        textAlign: 'center',
        marginTop: 14,
    },
    actionBtn: {
        height: 64,
        backgroundColor: COLORS.ink,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
    },
    actionBtnText: {
        color: COLORS.white,
        fontSize: 18,
        fontWeight: '800',
    },
    successView: {
        paddingVertical: 4,
    },
    statusHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 18,
        marginBottom: 28,
    },
    iconCircle: {
        width: 60,
        height: 54,
        borderRadius: 22,
        backgroundColor: COLORS.accent,
        justifyContent: 'center',
        alignItems: 'center',
    },
    successTitle: {
        fontSize: 10,
        fontWeight: '900',
        color: COLORS.coral,
        letterSpacing: 2,
        textTransform: 'uppercase',
    },
    partnerNameText: {
        fontSize: 26,
        fontWeight: '900',
        color: COLORS.ink,
    },
    lightDivider: {
        height: 1,
        backgroundColor: '#F3F0F0',
        marginBottom: 28,
    },
    metadataGrid: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 20,
    },
    inviteEmailNote: {
        fontSize: 14,
        lineHeight: 20,
        color: COLORS.inkMuted,
        textAlign: 'center',
        marginBottom: 22,
        fontWeight: '500',
    },
    metaBox: {
        flex: 1,
        backgroundColor: COLORS.paper,
        borderRadius: 22,
        padding: 18,
        borderWidth: 1,
        borderColor: '#F3F0F0',
    },
    metaValue: {
        fontSize: 20,
        fontWeight: '900',
        color: COLORS.ink,
        marginVertical: 6,
    },
    metaSubText: {
        fontSize: 13,
        color: COLORS.inkMuted,
        fontWeight: '600',
    },
    metaLabel: {
        fontSize: 10,
        fontWeight: '800',
        color: COLORS.inkMuted,
        letterSpacing: 1,
    },
    confirmBtn: {
        height: 68,
        backgroundColor: COLORS.coral,
        borderRadius: 22,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        shadowColor: COLORS.coral,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
    },
    confirmBtnText: {
        color: COLORS.white,
        fontSize: 18,
        fontWeight: '900',
    },
    secondaryAction: {
        marginTop: 18,
        alignSelf: 'center',
    },
    secondaryActionText: {
        fontSize: 14,
        color: COLORS.ink,
        fontWeight: '700',
        textDecorationLine: 'underline',
    },
    wrongLabel: {
        marginTop: 14,
        alignSelf: 'center',
    },
    wrongLabelText: {
        fontSize: 13,
        color: COLORS.inkMuted,
        fontWeight: '600',
    },
    dimmed: {
        opacity: 0.7,
    },
    footer: {
        marginTop: 40,
        paddingHorizontal: 15,
    },
    footerText: {
        fontSize: 13,
        color: COLORS.inkMuted,
        textAlign: 'center',
        lineHeight: 20,
        fontWeight: '500',
    },
});
