/* eslint-disable react/no-unescaped-entities */
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { ArrowRight, ChevronLeft, Plus, Users } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/src/auth/authContext';
import { useEntitlement } from '@/src/billing';
import { API_BASE_URL } from '../../config/api';
import {
    getPartnerPlanStatusMessage,
    type PartnerPlanSummary,
} from '@/utils/partnerPlanStatus';

const { width: windowWidth, height: windowHeight } = Dimensions.get('window');
const height = Math.min(windowHeight, 800);

const COLORS = {
    brand: '#FF3B3B',
    brandDark: '#D62F2F',
    brandSoft: '#FFF5F5',
    ink: '#121212',
    white: '#FFFFFF',
    border: '#E8ECF0',
    surface: '#F8FAFC',
    muted: '#64748B',
    success: '#10B981',
    successSoft: '#ECFDF5',
};

type PendingInvite = {
    id: string;
    code?: string;
    toEmail: string;
    status: string;
    fromUser?: {
        id: string;
        displayName: string;
        email: string;
        planSummary?: PartnerPlanSummary | null;
    } | null;
};

type Props = {
    userName: string;
    onBack: () => void;
    onHaveCode: () => void;
    onFirstTime: () => void;
    onJoinedPartner: () => void;
};

export default function Phase3Profile({ userName, onBack, onHaveCode, onFirstTime, onJoinedPartner }: Props) {
    const { authFetch } = useAuth();
    const { refreshAccess } = useEntitlement();

    const [checkingInvite, setCheckingInvite] = useState(true);
    const [accepting, setAccepting] = useState(false);
    const [pendingInvite, setPendingInvite] = useState<PendingInvite | null>(null);

    const partnerName = pendingInvite?.fromUser?.displayName || 'Your partner';
    const partnerInitial = partnerName.charAt(0).toUpperCase();
    const partnerPlanSummary = pendingInvite?.fromUser?.planSummary ?? null;

    const partnerStatusMessage = getPartnerPlanStatusMessage({
        partnerName,
        partnerPlan: partnerPlanSummary,
        hasLinkedPartner: false,
    });

    const fetchPendingInvite = useCallback(async () => {
        try {
            const res = await authFetch(`${API_BASE_URL}/partner/invites/pending`);
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || 'Could not check invites');

            const invites: PendingInvite[] = Array.isArray(data?.invites) ? data.invites : [];
            setPendingInvite(invites[0] ?? null);
        } catch {
            setPendingInvite(null);
        } finally {
            setCheckingInvite(false);
        }
    }, [authFetch]);

    useEffect(() => {
        fetchPendingInvite();
    }, [fetchPendingInvite]);

    const handleAcceptInvite = async () => {
        if (!pendingInvite) return;

        setAccepting(true);
        try {
            const res = await authFetch(`${API_BASE_URL}/partner/invites/${pendingInvite.id}/accept`, {
                method: 'POST',
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error || 'Unable to accept invite');
            }
            await refreshAccess().catch(() => {});
            onJoinedPartner();
        } catch (err: any) {
            Alert.alert('Connection failed', err?.message || 'Please try again.');
        } finally {
            setAccepting(false);
        }
    };

    const hasInvite = !!pendingInvite;

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            <LinearGradient colors={[COLORS.brand, COLORS.brandDark]} style={styles.hero}>
                <SafeAreaView>
                    <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                        <ChevronLeft color={COLORS.white} size={28} />
                    </TouchableOpacity>
                </SafeAreaView>
            </LinearGradient>

            <View style={styles.content}>
                <View style={styles.textGroup}>
                    <Text style={styles.welcomeText}>Hi {userName || 'Runner'}</Text>
                    <Text style={styles.mainTitle}>
                        {hasInvite ? "You've been invited" : "Let's run together"}
                    </Text>
                    <Text style={styles.subTitle}>
                        {hasInvite
                            ? 'Accept the invitation below to train together.'
                            : 'Choose how you would like to get started.'}
                    </Text>
                </View>

                {checkingInvite ? (
                    <View style={styles.loadingWrap}>
                        <ActivityIndicator size="small" color={COLORS.brand} />
                        <Text style={styles.loadingText}>Checking for partner invites...</Text>
                    </View>
                ) : hasInvite ? (
                    <View style={styles.inviteSection}>
                        <View style={styles.inviteCard}>
                            <View style={styles.inviteCardHeader}>
                                <Text style={styles.inviteEyebrow}>Partner invitation</Text>
                                <View style={styles.inviteStatusPill}>
                                    <View style={styles.inviteStatusDot} />
                                    <Text style={styles.inviteStatusText}>Pending</Text>
                                </View>
                            </View>

                            <View style={styles.inviteBody}>
                                <View style={styles.inviteAvatar}>
                                    <Text style={styles.inviteAvatarText}>{partnerInitial}</Text>
                                </View>

                                <View style={styles.inviteCopy}>
                                    <Text style={styles.invitePartnerName}>{partnerName}</Text>
                                    <Text style={styles.inviteMessage}>
                                        invited you to join their fitness journey.
                                    </Text>
                                </View>
                            </View>

                            {partnerStatusMessage ? (
                                <View
                                    style={[
                                        styles.planStatusBox,
                                        partnerStatusMessage.tone === 'success' && styles.planStatusBoxSuccess,
                                        partnerStatusMessage.tone === 'info' && styles.planStatusBoxInfo,
                                    ]}
                                >
                                    <Text style={styles.planStatusTitle}>{partnerStatusMessage.title}</Text>
                                    <Text style={styles.planStatusSubtitle}>{partnerStatusMessage.subtitle}</Text>
                                </View>
                            ) : (
                                <View style={styles.perksRow}>
                                    <View style={styles.perkChip}>
                                        <Text style={styles.perkChipText}>Shared progress</Text>
                                    </View>
                                    <View style={styles.perkChip}>
                                        <Text style={styles.perkChipText}>Run together</Text>
                                    </View>
                                    <View style={styles.perkChip}>
                                        <Text style={styles.perkChipText}>Stay accountable</Text>
                                    </View>
                                </View>
                            )}
                        </View>

                        <TouchableOpacity
                            onPress={handleAcceptInvite}
                            activeOpacity={0.9}
                            disabled={accepting}
                            style={[styles.acceptBtn, accepting && styles.btnDisabled]}
                        >
                            {accepting ? (
                                <ActivityIndicator color={COLORS.white} />
                            ) : (
                                <>
                                    <Text style={styles.acceptBtnText}>Accept invitation</Text>
                                    <ArrowRight color={COLORS.white} size={18} strokeWidth={2.5} />
                                </>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={onFirstTime}
                            activeOpacity={0.8}
                            style={styles.soloLink}
                            disabled={accepting}
                        >
                            <Text style={styles.soloLinkText}>Continue on my own</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.buttonStack}>
                        <TouchableOpacity onPress={onFirstTime} activeOpacity={0.8} style={styles.primaryBtn}>
                            <View style={styles.btnIconWrap}>
                                <Plus color={COLORS.brand} size={22} strokeWidth={2.2} />
                            </View>
                            <View style={styles.btnTextWrap}>
                                <Text style={styles.primaryBtnTitle}>I&apos;m starting on my own</Text>
                                <Text style={styles.primaryBtnSub}>Add my partner anytime</Text>
                            </View>
                            <ArrowRight color={COLORS.brand} size={18} strokeWidth={2.2} />
                        </TouchableOpacity>

                        <TouchableOpacity onPress={onHaveCode} activeOpacity={0.9} style={styles.primaryBtn}>
                            <View style={styles.btnIconWrap}>
                                <Users color={COLORS.brand} size={22} strokeWidth={2.2} />
                            </View>
                            <View style={styles.btnTextWrap}>
                                <Text style={styles.primaryBtnTitle}>My partner invited me</Text>
                                <Text style={styles.primaryBtnSub}>Connect with your partner</Text>
                            </View>
                            <ArrowRight color={COLORS.brand} size={18} strokeWidth={2.2} />
                        </TouchableOpacity>
                    </View>
                )}
            </View>
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
        paddingHorizontal: 25,
    },
    backBtn: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 22,
        marginTop: 10,
    },
    content: {
        flex: 1,
        marginTop: height * 0.20,
        backgroundColor: COLORS.white,
        borderTopLeftRadius: 40,
        borderTopRightRadius: 40,
        paddingHorizontal: 24,
        paddingTop: 30,
        justifyContent: 'center',
        paddingBottom: height * 0.16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.05,
        shadowRadius: 20,
        elevation: 10,
    },
    textGroup: {
        marginBottom: 28,
        alignItems: 'center',
    },
    welcomeText: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.brand,
        letterSpacing: 0.3,
        marginBottom: 6,
        textTransform: 'uppercase',
    },
    mainTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: COLORS.ink,
        letterSpacing: -0.8,
        textAlign: 'center',
    },
    subTitle: {
        fontSize: 15,
        color: COLORS.muted,
        marginTop: 8,
        lineHeight: 22,
        textAlign: 'center',
        paddingHorizontal: 8,
    },
    loadingWrap: {
        alignItems: 'center',
        gap: 12,
        paddingVertical: 40,
    },
    loadingText: {
        fontSize: 14,
        color: COLORS.muted,
        fontWeight: '500',
    },
    inviteSection: {
        gap: 14,
    },
    inviteCard: {
        backgroundColor: COLORS.white,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: 18,
        gap: 16,
    },
    inviteCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    inviteEyebrow: {
        fontSize: 11,
        fontWeight: '800',
        color: COLORS.muted,
        letterSpacing: 1.1,
        textTransform: 'uppercase',
    },
    inviteStatusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: COLORS.surface,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    inviteStatusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: COLORS.brand,
    },
    inviteStatusText: {
        fontSize: 11,
        fontWeight: '700',
        color: COLORS.ink,
    },
    inviteBody: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 14,
    },
    inviteAvatar: {
        width: 52,
        height: 52,
        borderRadius: 16,
        backgroundColor: COLORS.brandSoft,
        borderWidth: 1,
        borderColor: 'rgba(255, 59, 59, 0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    inviteAvatarText: {
        fontSize: 22,
        fontWeight: '800',
        color: COLORS.brand,
    },
    inviteCopy: {
        flex: 1,
        paddingTop: 2,
    },
    invitePartnerName: {
        fontSize: 18,
        fontWeight: '800',
        color: COLORS.ink,
        letterSpacing: -0.3,
        marginBottom: 4,
    },
    inviteMessage: {
        fontSize: 14,
        fontWeight: '500',
        color: COLORS.muted,
        lineHeight: 20,
    },
    planStatusBox: {
        backgroundColor: COLORS.surface,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingHorizontal: 14,
        paddingVertical: 12,
        gap: 4,
    },
    planStatusBoxSuccess: {
        backgroundColor: COLORS.successSoft,
        borderColor: 'rgba(16, 185, 129, 0.2)',
    },
    planStatusBoxInfo: {
        backgroundColor: COLORS.brandSoft,
        borderColor: 'rgba(255, 59, 59, 0.12)',
    },
    planStatusTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: COLORS.ink,
        lineHeight: 18,
    },
    planStatusSubtitle: {
        fontSize: 12,
        fontWeight: '500',
        color: COLORS.muted,
        lineHeight: 17,
    },
    perksRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    perkChip: {
        backgroundColor: COLORS.surface,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    perkChipText: {
        fontSize: 11,
        fontWeight: '700',
        color: COLORS.ink,
    },
    acceptBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: COLORS.brand,
        borderRadius: 16,
        paddingVertical: 16,
        paddingHorizontal: 20,
    },
    acceptBtnText: {
        fontSize: 16,
        fontWeight: '800',
        color: COLORS.white,
    },
    btnDisabled: {
        opacity: 0.7,
    },
    soloLink: {
        alignItems: 'center',
        paddingVertical: 10,
    },
    soloLinkText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.muted,
    },
    buttonStack: {
        gap: 12,
    },
    primaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.white,
        padding: 16,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    secondaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.white,
        padding: 16,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    btnIconWrap: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: COLORS.brandSoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    btnIconWrapMuted: {
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    btnTextWrap: {
        flex: 1,
        marginLeft: 12,
    },
    primaryBtnTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: COLORS.brand,
    },
    primaryBtnSub: {
        fontSize: 13,
        color: COLORS.muted,
        fontWeight: '500',
        marginTop: 2,
    },
    secondaryBtnTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.brand,
    },
    secondaryBtnSub: {
        fontSize: 13,
        color: COLORS.muted,
        marginTop: 2,
    },
});
