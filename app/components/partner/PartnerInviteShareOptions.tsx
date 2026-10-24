import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { MessageCircle, Share2 } from 'lucide-react-native';
import {
    sharePartnerInviteVia,
    type PartnerInviteShareChannel,
} from '@/utils/partnerInviteShare';

type ShareOption = {
    channel: PartnerInviteShareChannel;
    label: string;
    icon: React.ReactNode;
    iconBackground: string;
};

type Props = {
    message: string;
    disabled?: boolean;
};

const SECONDARY_OPTIONS: ShareOption[] = [
    {
        channel: 'sms',
        label: 'Messages',
        icon: <MessageCircle size={20} color="#2563EB" strokeWidth={2.2} />,
        iconBackground: '#EFF6FF',
    },
    {
        channel: 'telegram',
        label: 'Telegram',
        icon: <Ionicons name="paper-plane-outline" size={19} color="#0088CC" />,
        iconBackground: '#F0F9FF',
    },
    {
        channel: 'native',
        label: 'More',
        icon: <Share2 size={20} color="#111827" strokeWidth={2.2} />,
        iconBackground: '#F8FAFC',
    },
];

export function PartnerInviteShareOptions({ message, disabled = false }: Props) {
    const [activeChannel, setActiveChannel] = useState<PartnerInviteShareChannel | null>(null);
    const isBusy = disabled || !!activeChannel || !message.trim();

    const handleShare = useCallback(async (channel: PartnerInviteShareChannel) => {
        if (!message.trim() || disabled || activeChannel) return;

        setActiveChannel(channel);
        try {
            await sharePartnerInviteVia(channel, message);
        } finally {
            setActiveChannel(null);
        }
    }, [activeChannel, disabled, message]);

    const whatsAppLoading = activeChannel === 'whatsapp';

    return (
        <View style={styles.container}>
            <Text style={styles.sectionLabel}>Share via</Text>

            <TouchableOpacity
                style={[styles.primaryButton, isBusy && !whatsAppLoading && styles.optionDisabled]}
                onPress={() => handleShare('whatsapp')}
                disabled={isBusy}
                activeOpacity={0.9}
            >
                <LinearGradient
                    colors={['#25D366', '#128C7E']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.primaryGradient}
                >
                    {whatsAppLoading ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                        <>
                            <Ionicons name="logo-whatsapp" size={22} color="#FFFFFF" />
                            <Text style={styles.primaryText}>WhatsApp</Text>
                        </>
                    )}
                </LinearGradient>
            </TouchableOpacity>

            <View style={styles.secondaryRow}>
                {SECONDARY_OPTIONS.map((option) => {
                    const isLoading = activeChannel === option.channel;

                    return (
                        <TouchableOpacity
                            key={option.channel}
                            style={[styles.secondaryTile, isBusy && styles.optionDisabled]}
                            onPress={() => handleShare(option.channel)}
                            disabled={isBusy}
                            activeOpacity={0.85}
                        >
                            <View style={[styles.secondaryIconShell, { backgroundColor: option.iconBackground }]}>
                                {isLoading ? (
                                    <ActivityIndicator size="small" color="#64748B" />
                                ) : (
                                    option.icon
                                )}
                            </View>
                            <Text style={styles.secondaryLabel}>{option.label}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        gap: 12,
    },
    sectionLabel: {
        fontSize: 12,
        fontWeight: '800',
        color: '#94A3B8',
        textTransform: 'uppercase',
        letterSpacing: 1,
        textAlign: 'center',
    },
    primaryButton: {
        borderRadius: 18,
        borderCurve: 'continuous',
        overflow: 'hidden',
        shadowColor: '#128C7E',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 14,
        elevation: 4,
    },
    primaryGradient: {
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingHorizontal: 20,
    },
    primaryText: {
        fontSize: 16,
        fontWeight: '800',
        color: '#FFFFFF',
        letterSpacing: -0.2,
    },
    secondaryRow: {
        flexDirection: 'row',
        gap: 10,
    },
    secondaryTile: {
        flex: 1,
        alignItems: 'center',
        gap: 8,
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderRadius: 18,
        borderCurve: 'continuous',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    secondaryIconShell: {
        width: 44,
        height: 44,
        borderRadius: 14,
        borderCurve: 'continuous',
        alignItems: 'center',
        justifyContent: 'center',
    },
    secondaryLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#475569',
        textAlign: 'center',
    },
    optionDisabled: {
        opacity: 0.6,
    },
});
