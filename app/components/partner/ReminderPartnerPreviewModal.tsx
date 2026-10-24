import React, { useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ActivityIndicator,
    useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Send, X } from 'lucide-react-native';
import { ReminderPartnerCardPreview } from '@/components/partner/ReminderPartnerCardPreview';
import type { PartnerReminderOption } from '@/components/partner/ReminderPartner';

type ReminderPartnerPreviewModalProps = {
    visible: boolean;
    option: PartnerReminderOption | null;
    messagePreview: string;
    partnerName: string;
    busy?: boolean;
    canSend?: boolean;
    onClose: () => void;
    onSend: () => void;
};

export function ReminderPartnerPreviewModal({
    visible,
    option,
    messagePreview,
    partnerName,
    busy = false,
    canSend = true,
    onClose,
    onSend,
}: ReminderPartnerPreviewModalProps) {
    const insets = useSafeAreaInsets();
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();

    const frameSize = useMemo(() => {
        const maxWidth = windowWidth - 48;
        const maxHeight = windowHeight - insets.top - insets.bottom - 200;
        let width = Math.min(maxWidth, 300);
        let height = width * (16 / 9);
        if (height > maxHeight) {
            height = maxHeight;
            width = height * (9 / 16);
        }
        return { width: Math.round(width), height: Math.round(height) };
    }, [insets.bottom, insets.top, windowHeight, windowWidth]);

    if (!option) {
        return null;
    }

    const isFullscreen = option.delivery === 'fullscreen' && !!option.mode;
    const previewHint = isFullscreen
        ? 'Send to open fullscreen on their home screen and surprise your partner.'
        : option.delivery === 'notification-card'
          ? 'Send this loving nudge as a chat note from you.'
          : 'Send to drop this as a chat note from you.';

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={onClose}
        >
            <StatusBar style="dark" />
            <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 12 }]}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Preview</Text>
                    <TouchableOpacity
                        onPress={onClose}
                        style={styles.closeButton}
                        hitSlop={12}
                        activeOpacity={0.7}
                    >
                        <X size={20} color="#0F172A" strokeWidth={2.2} />
                    </TouchableOpacity>
                </View>

                <View style={styles.copyBlock}>
                    <Text style={styles.subtitle}>What {partnerName} will see</Text>
                    <Text style={styles.hint}>{previewHint}</Text>
                </View>

                <View style={styles.frameStage}>
                    <View
                        style={[
                            styles.phoneFrame,
                            { width: frameSize.width, height: frameSize.height },
                        ]}
                    >
                        <ReminderPartnerCardPreview
                            option={option}
                            messagePreview={messagePreview}
                            variant="large"
                            fillFrame
                        />
                    </View>
                    <Text style={styles.ratioLabel}>9:16</Text>
                </View>

                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[
                            styles.sendButton,
                            (!canSend || busy) && styles.sendButtonDisabled,
                        ]}
                        onPress={onSend}
                        disabled={!canSend || busy}
                        activeOpacity={0.85}
                    >
                        {busy ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                            <>
                                <Send size={16} color="#FFFFFF" strokeWidth={2.4} />
                                <Text style={styles.sendButtonText}>Send to {partnerName}</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 4,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#0F172A',
        letterSpacing: -0.4,
    },
    closeButton: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    copyBlock: {
        paddingHorizontal: 20,
        gap: 6,
        marginBottom: 20,
    },
    subtitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#0F172A',
        letterSpacing: -0.2,
    },
    hint: {
        fontSize: 14,
        lineHeight: 20,
        color: '#64748B',
    },
    frameStage: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
        gap: 10,
    },
    phoneFrame: {
        borderRadius: 20,
        overflow: 'hidden',
        backgroundColor: '#0F172A',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.18,
        shadowRadius: 24,
        elevation: 8,
    },
    ratioLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#94A3B8',
        letterSpacing: 0.4,
    },
    footer: {
        paddingHorizontal: 20,
        paddingTop: 12,
    },
    sendButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#FF6B6B',
        borderRadius: 14,
        paddingVertical: 15,
    },
    sendButtonDisabled: {
        opacity: 0.45,
    },
    sendButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});
