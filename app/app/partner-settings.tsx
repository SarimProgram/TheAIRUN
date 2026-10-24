import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
    ArrowLeft,
    Heart,
    Mail,
    MessageCircle,
    Unlink,
    User,
} from 'lucide-react-native';
import { useAuth } from '@/src/auth/authContext';
import { useChat } from '@/contexts/ChatContext';
import { API_BASE_URL } from '@/config/api';

type Partner = {
    id: string;
    displayName: string;
    email: string;
};

const COLORS = {
    primary: '#FF6B6B',
    primaryDeep: '#E24C5B',
    bg: '#F8FAFC',
    card: '#FFFFFF',
    text: '#0F172A',
    muted: '#64748B',
    subtle: '#94A3B8',
    border: '#E2E8F0',
    danger: '#EF4444',
    dangerSoft: '#FEF2F2',
};

export default function PartnerSettingsScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { authFetch, isAuthenticated } = useAuth();
    const { connected: isPartnerConnected } = useChat();

    const [loading, setLoading] = useState(true);
    const [disconnecting, setDisconnecting] = useState(false);
    const [partner, setPartner] = useState<Partner | null>(null);
    const [partnerLinkedAt, setPartnerLinkedAt] = useState<string | null>(null);
    const [userName, setUserName] = useState('You');

    const fetchData = useCallback(async () => {
        if (!isAuthenticated) return;
        setLoading(true);
        try {
            const [profileRes, partnerRes] = await Promise.all([
                authFetch(`${API_BASE_URL}/profile`),
                authFetch(`${API_BASE_URL}/partner`),
            ]);
            const profileData = await profileRes.json();
            const partnerData = await partnerRes.json();

            setUserName(profileData.user?.displayName ?? 'You');
            setPartner(partnerData.partner ?? null);
            setPartnerLinkedAt(partnerData.partnerLinkedAt ?? null);

            if (!partnerData.hasPartner) {
                router.replace('/Partner');
            }
        } catch (error) {
            console.log('[PartnerSettings] fetch error:', error);
        } finally {
            setLoading(false);
        }
    }, [authFetch, isAuthenticated, router]);

    useEffect(() => {
        void fetchData();
    }, [fetchData]);

    const daysTogether = useMemo(() => {
        if (!partnerLinkedAt) return 1;
        const start = new Date(partnerLinkedAt);
        if (Number.isNaN(start.getTime())) return 1;
        start.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return Math.max(1, Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    }, [partnerLinkedAt]);

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
            return;
        }
        router.push('/Partner');
    };

    const disconnect = () => {
        if (!partner) return;
        Alert.alert('Disconnect', `Disconnect from ${partner.displayName}?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Disconnect',
                style: 'destructive',
                onPress: async () => {
                    setDisconnecting(true);
                    try {
                        const res = await authFetch(`${API_BASE_URL}/partner/disconnect`, { method: 'POST' });
                        if (!res.ok) throw new Error('Failed to disconnect');
                        router.replace('/Partner');
                    } catch (err: any) {
                        Alert.alert('Error', err?.message ?? 'Failed to disconnect');
                    } finally {
                        setDisconnecting(false);
                    }
                },
            },
        ]);
    };

    const openChat = () => {
        router.push({
            pathname: '/(tabs)',
            params: { openChat: '1', chatJump: String(Date.now()) },
        } as any);
    };

    if (!isAuthenticated) return null;

    return (
        <View style={styles.root}>
            <StatusBar style="dark" />
            <LinearGradient colors={['#FFF5F5', '#F8FAFC']} style={StyleSheet.absoluteFill} />

            <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 24) }]}>
                <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                    <ArrowLeft size={20} color={COLORS.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Partner Settings</Text>
                <View style={styles.headerSpacer} />
            </View>

            {loading ? (
                <View style={styles.loadingState}>
                    <ActivityIndicator color={COLORS.primary} />
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={[
                        styles.scrollContent,
                        { paddingBottom: Math.max(insets.bottom + 32, 48) },
                    ]}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.profileCard}>
                        <View style={styles.avatarRow}>
                            <View style={styles.avatar}>
                                <Text style={styles.avatarText}>
                                    {partner?.displayName?.charAt(0).toUpperCase() ?? '?'}
                                </Text>
                            </View>
                            <View style={styles.profileCopy}>
                                <Text style={styles.profileName}>{partner?.displayName}</Text>
                                <Text style={styles.profileMeta}>{partner?.email}</Text>
                            </View>
                        </View>

                        <View style={styles.statsRow}>
                            <View style={styles.statChip}>
                                <Heart size={14} color={COLORS.primaryDeep} />
                                <Text style={styles.statChipText}>{daysTogether} days together</Text>
                            </View>
                            <View style={styles.statChip}>
                                <User size={14} color="#2563EB" />
                                <Text style={styles.statChipText}>Linked to {userName}</Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>ACTIONS</Text>
                        <View style={styles.sectionCard}>
                            <TouchableOpacity style={styles.row} onPress={openChat} activeOpacity={0.8}>
                                <View style={[styles.rowIcon, { backgroundColor: '#EFF6FF' }]}>
                                    <MessageCircle size={18} color="#2563EB" />
                                </View>
                                <View style={styles.rowCopy}>
                                    <Text style={styles.rowTitle}>Open Chat</Text>
                                    <Text style={styles.rowSubtitle}>
                                        {isPartnerConnected ? 'Send a message to your partner' : 'Chat when partner is online'}
                                    </Text>
                                </View>
                            </TouchableOpacity>

                            <View style={styles.rowDivider} />

                            <View style={styles.row}>
                                <View style={[styles.rowIcon, { backgroundColor: '#F8FAFC' }]}>
                                    <Mail size={18} color={COLORS.subtle} />
                                </View>
                                <View style={styles.rowCopy}>
                                    <Text style={styles.rowTitle}>Partner Email</Text>
                                    <Text style={styles.rowSubtitle}>{partner?.email ?? '—'}</Text>
                                </View>
                            </View>
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>CONNECTION</Text>
                        <TouchableOpacity
                            style={styles.dangerButton}
                            onPress={disconnect}
                            disabled={disconnecting}
                            activeOpacity={0.85}
                        >
                            {disconnecting ? (
                                <ActivityIndicator color={COLORS.danger} />
                            ) : (
                                <>
                                    <Unlink size={18} color={COLORS.danger} />
                                    <Text style={styles.dangerButtonText}>Disconnect Partner</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: COLORS.bg,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 8,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.card,
        alignItems: 'center',
        justifyContent: 'center',
        borderCurve: 'continuous',
        boxShadow: '0 4px 16px rgba(15, 23, 42, 0.08)',
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: COLORS.text,
    },
    headerSpacer: {
        width: 44,
    },
    loadingState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 8,
        gap: 20,
    },
    profileCard: {
        backgroundColor: COLORS.card,
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderCurve: 'continuous',
        gap: 16,
        boxShadow: Platform.select({
            ios: '0 8px 24px rgba(15, 23, 42, 0.06)',
            android: undefined,
            default: '0 8px 24px rgba(15, 23, 42, 0.06)',
        }),
    },
    avatarRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    avatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#FFF1F2',
        alignItems: 'center',
        justifyContent: 'center',
        borderCurve: 'continuous',
    },
    avatarText: {
        fontSize: 22,
        fontWeight: '800',
        color: COLORS.primaryDeep,
    },
    profileCopy: {
        flex: 1,
        gap: 4,
    },
    profileName: {
        fontSize: 20,
        fontWeight: '800',
        color: COLORS.text,
        letterSpacing: -0.4,
    },
    profileMeta: {
        fontSize: 14,
        color: COLORS.muted,
    },
    statsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    statChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#F8FAFC',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        borderCurve: 'continuous',
    },
    statChipText: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.muted,
    },
    section: {
        gap: 10,
    },
    sectionLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: COLORS.subtle,
        letterSpacing: 1.1,
        paddingHorizontal: 4,
    },
    sectionCard: {
        backgroundColor: COLORS.card,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: COLORS.border,
        overflow: 'hidden',
        borderCurve: 'continuous',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 14,
    },
    rowIcon: {
        width: 40,
        height: 40,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderCurve: 'continuous',
    },
    rowCopy: {
        flex: 1,
        gap: 3,
    },
    rowTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.text,
    },
    rowSubtitle: {
        fontSize: 13,
        color: COLORS.muted,
        lineHeight: 18,
    },
    rowDivider: {
        height: 1,
        backgroundColor: '#F1F5F9',
        marginLeft: 70,
    },
    dangerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        backgroundColor: COLORS.dangerSoft,
        borderRadius: 18,
        paddingVertical: 16,
        borderWidth: 1,
        borderColor: '#FECACA',
        borderCurve: 'continuous',
    },
    dangerButtonText: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.danger,
    },
});
