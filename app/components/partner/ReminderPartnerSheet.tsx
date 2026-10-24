import React, { useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    Pressable,
    TouchableOpacity,
    ScrollView,
} from 'react-native';
import Reanimated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    Easing as ReanimatedEasing,
    runOnJS,
} from 'react-native-reanimated';
import { Heart, X } from 'lucide-react-native';
import {
    DevPartnerPreviewToggle,
    PARTNER_REMINDER_CATEGORIES,
    ReminderPartnerOptions,
    type ReminderPartnerOptionsProps,
} from '@/components/partner/ReminderPartner';

const COLORS = {
    text: '#0F172A',
    muted: '#64748B',
    fill: '#F4F4F5',
    accent: '#FF6B6B',
};

const STEPS_CATEGORY = PARTNER_REMINDER_CATEGORIES.filter((category) => category.id === 'steps');

type ReminderPartnerSheetProps = ReminderPartnerOptionsProps & {
    visible: boolean;
    onClose: () => void;
    bottomInset?: number;
};

function SheetShell({
    visible,
    onClose,
    bottomInset,
    children,
}: {
    visible: boolean;
    onClose: () => void;
    bottomInset: number;
    children: React.ReactNode;
}) {
    const [mounted, setMounted] = useState(false);
    const translateY = useSharedValue(520);
    const backdrop = useSharedValue(0);

    useEffect(() => {
        if (visible) {
            setMounted(true);
            translateY.value = 520;
            backdrop.value = 0;
            backdrop.value = withTiming(1, {
                duration: 260,
                easing: ReanimatedEasing.out(ReanimatedEasing.cubic),
            });
            translateY.value = withTiming(0, {
                duration: 380,
                easing: ReanimatedEasing.out(ReanimatedEasing.cubic),
            });
            return undefined;
        }

        backdrop.value = withTiming(0, {
            duration: 220,
            easing: ReanimatedEasing.in(ReanimatedEasing.cubic),
        });
        translateY.value = withTiming(
            520,
            {
                duration: 300,
                easing: ReanimatedEasing.in(ReanimatedEasing.cubic),
            },
            (finished) => {
                if (finished) {
                    runOnJS(setMounted)(false);
                }
            },
        );

        return undefined;
    }, [visible, backdrop, translateY]);

    const backdropStyle = useAnimatedStyle(() => ({
        opacity: backdrop.value * 0.42,
    }));

    const sheetStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    if (!mounted) {
        return null;
    }

    return (
        <Modal visible transparent animationType="none" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <Reanimated.View pointerEvents="none" style={[styles.backdrop, backdropStyle]} />
                <Pressable style={styles.dismiss} onPress={onClose} accessibilityRole="button" />
                <Reanimated.View
                    style={[
                        styles.panel,
                        { paddingBottom: Math.max(bottomInset, 20) },
                        sheetStyle,
                    ]}
                >
                    <View style={styles.handle} />
                    {children}
                </Reanimated.View>
            </View>
        </Modal>
    );
}

export function ReminderPartnerSheet({
    visible,
    onClose,
    bottomInset = 0,
    partnerName,
    pointsBalance = 0,
    pointsLoading = false,
    chatConnected = true,
    onSendReminder,
    onSendPremiumReminder,
    onAfterSend,
    categories = STEPS_CATEGORY,
}: ReminderPartnerSheetProps) {
    const [devPartnerPreviewEnabled, setDevPartnerPreviewEnabled] = useState(false);
    const headerPoints = useMemo(() => {
        if (pointsLoading) return '—';
        return pointsBalance.toLocaleString();
    }, [pointsBalance, pointsLoading]);

    return (
        <SheetShell visible={visible} onClose={onClose} bottomInset={bottomInset}>
            <View style={styles.header}>
                <Text style={styles.title}>Reminders</Text>
                <View style={styles.headerRight}>
                    <View style={styles.pointsPill}>
                        <Heart size={12} color={COLORS.accent} fill={COLORS.accent} />
                        <Text style={styles.headerPointsText}>{headerPoints}</Text>
                    </View>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={10}>
                        <X size={18} color={COLORS.muted} strokeWidth={2.2} />
                    </TouchableOpacity>
                </View>
            </View>

            <Text style={styles.subtitle}>Send a nudge to {partnerName}</Text>

            <DevPartnerPreviewToggle
                enabled={devPartnerPreviewEnabled}
                onToggle={() => setDevPartnerPreviewEnabled((current) => !current)}
                style={{ marginHorizontal: 0, marginBottom: 12 }}
            />

            <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.scrollContent}
                removeClippedSubviews={false}
            >
                <ReminderPartnerOptions
                    partnerName={partnerName}
                    categories={categories}
                    pointsBalance={pointsBalance}
                    pointsLoading={pointsLoading}
                    chatConnected={chatConnected}
                    devPartnerPreviewEnabled={devPartnerPreviewEnabled}
                    onSendReminder={onSendReminder}
                    onSendPremiumReminder={onSendPremiumReminder}
                    onAfterSend={(label) => {
                        onAfterSend?.(label);
                        onClose();
                    }}
                />
            </ScrollView>
        </SheetShell>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#020617',
    },
    dismiss: {
        ...StyleSheet.absoluteFillObject,
    },
    panel: {
        maxHeight: '88%',
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        paddingHorizontal: 20,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: -12 },
        shadowOpacity: 0.16,
        shadowRadius: 32,
        elevation: 28,
    },
    handle: {
        alignSelf: 'center',
        width: 44,
        height: 5,
        borderRadius: 999,
        backgroundColor: '#CBD5E1',
        marginTop: 10,
        marginBottom: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    title: {
        flex: 1,
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.text,
        letterSpacing: -0.4,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    pointsPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: COLORS.fill,
    },
    headerPointsText: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.text,
        fontVariant: ['tabular-nums'],
    },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: COLORS.fill,
        alignItems: 'center',
        justifyContent: 'center',
    },
    subtitle: {
        marginBottom: 12,
        fontSize: 14,
        color: COLORS.muted,
    },
    scrollContent: {
        gap: 20,
        paddingBottom: 12,
        overflow: 'visible',
    },
});
