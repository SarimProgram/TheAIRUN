// app/components/home/PartnerChat.tsx
// Floating compose bubble + annotation sheet for partner messaging

import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Modal,
    KeyboardAvoidingView,
    Platform,
    Alert,
} from 'react-native';
import { MessageCircle, X, PenLine } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
    useAnimatedStyle,
    FadeIn,
    FadeInDown,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSocket, ChatMessage } from '../../hooks/useSocket';
import PartnerNoteCompose from '../chat/PartnerNoteCompose';
import NoteDrawingPreview from '../chat/NoteDrawingPreview';
import {
    MESSAGE_LIFETIME_MS,
    getDisplayContent,
} from '../chat/partnerNoteShared';

type Props = {
    isAuthenticated: boolean;
    partnerName: string;
    currentUserId?: string;
};

const TimeLeftIndicator = ({ createdAt }: { createdAt: string }) => {
    const [fraction, setFraction] = useState(1);

    useEffect(() => {
        const msgTime = new Date(createdAt).getTime();
        const interval = setInterval(() => {
            const elapsed = Date.now() - msgTime;
            const remaining = Math.max(0, 1 - elapsed / MESSAGE_LIFETIME_MS);
            setFraction(remaining);
            if (remaining <= 0) clearInterval(interval);
        }, 500);
        return () => clearInterval(interval);
    }, [createdAt]);

    return (
        <View style={timeStyles.container}>
            <View style={[timeStyles.bar, { width: `${fraction * 100}%` }]} />
        </View>
    );
};

const timeStyles = StyleSheet.create({
    container: {
        height: 2,
        backgroundColor: 'rgba(92, 64, 51, 0.15)',
        borderRadius: 1,
        marginTop: 8,
        overflow: 'hidden',
    },
    bar: {
        height: '100%',
        backgroundColor: '#5C4033',
        borderRadius: 1,
    },
});

const PartnerNote = ({ msg, isMe }: { msg: ChatMessage; isMe?: boolean }) => {
    const isDrawing = msg.content.startsWith('[DRAW]');
    const displayContent = getDisplayContent(msg.content);

    return (
        <Animated.View entering={FadeInDown.duration(280)} style={[noteStyles.wrap, isMe && noteStyles.wrapMe]}>
            <View style={[noteStyles.tape, isMe && noteStyles.tapeMe]} />
            <View style={[noteStyles.note, isMe ? noteStyles.noteMe : noteStyles.notePartner]}>
                <Text style={noteStyles.sender}>{isMe ? 'You' : msg.fromName}</Text>
                {isDrawing ? (
                    <>
                        <Text style={noteStyles.drawLabel}>Drawing</Text>
                        <NoteDrawingPreview content={msg.content} height={72} />
                    </>
                ) : (
                    <Text style={noteStyles.text}>{displayContent}</Text>
                )}
                <Text style={noteStyles.time}>
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                <TimeLeftIndicator createdAt={msg.createdAt} />
            </View>
        </Animated.View>
    );
};

const noteStyles = StyleSheet.create({
    wrap: { marginBottom: 12, alignSelf: 'flex-start', maxWidth: '92%' },
    wrapMe: { alignSelf: 'flex-end' },
    tape: {
        position: 'absolute',
        top: -4,
        left: 20,
        width: 44,
        height: 12,
        backgroundColor: 'rgba(255, 220, 150, 0.65)',
        borderRadius: 1,
        zIndex: 2,
    },
    tapeMe: { left: undefined, right: 20 },
    note: {
        borderRadius: 4,
        borderWidth: 1,
        borderStyle: 'dashed',
        paddingHorizontal: 16,
        paddingVertical: 14,
        paddingTop: 18,
    },
    notePartner: {
        backgroundColor: '#F0EDE4',
        borderColor: '#DDD8CB',
    },
    noteMe: {
        backgroundColor: '#FFF8DC',
        borderColor: '#F5E6B8',
    },
    sender: {
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        fontSize: 9,
        fontWeight: '800',
        color: '#5C4033',
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: 1.2,
    },
    drawLabel: {
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        fontSize: 9,
        fontWeight: '800',
        color: '#5C4033',
        marginBottom: 4,
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    text: {
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        fontSize: 14,
        lineHeight: 20,
        color: '#2C1810',
        fontWeight: '600',
    },
    time: {
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        fontSize: 9,
        color: '#5C4033',
        marginTop: 8,
        alignSelf: 'flex-end',
    },
});

export default function PartnerChat({ isAuthenticated, partnerName, currentUserId }: Props) {
    const insets = useSafeAreaInsets();
    const [isOpen, setIsOpen] = useState(false);
    const [lastSent, setLastSent] = useState<string | null>(null);

    const { connected, messages, sendMessage } = useSocket(isAuthenticated);

    const pulse = useSharedValue(1);
    useEffect(() => {
        pulse.value = withRepeat(
            withSequence(
                withTiming(1.1, { duration: 1000 }),
                withTiming(1, { duration: 1000 })
            ),
            -1,
            true
        );
    }, []);

    const pulseStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulse.value }],
    }));

    const partnerMessages = useMemo(
        () =>
            messages
                .filter((m) => m.fromUserId !== currentUserId)
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
        [messages, currentUserId]
    );

    const latestPartnerMessage = partnerMessages[0] ?? null;

    const latestOwnMessage = useMemo(
        () =>
            messages
                .filter((m) => m.fromUserId === currentUserId)
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null,
        [messages, currentUserId]
    );

    const hasVisibleNotes = !!latestPartnerMessage || !!latestOwnMessage;

    const [lastSeenCount, setLastSeenCount] = useState(0);
    const unreadCount = useMemo(() => {
        if (isOpen) return 0;
        return Math.max(0, partnerMessages.length - lastSeenCount);
    }, [partnerMessages.length, isOpen, lastSeenCount]);

    useEffect(() => {
        if (isOpen) {
            setLastSeenCount(partnerMessages.length);
        }
    }, [isOpen, partnerMessages.length]);

    useEffect(() => {
        if (!lastSent) return;
        const timer = setTimeout(() => setLastSent(null), 3000);
        return () => clearTimeout(timer);
    }, [lastSent]);

    const deliverMessage = (content: string, preview?: string) => {
        sendMessage(content);
        setLastSent(preview ?? content);
    };

    const handleComposeSend = (content: string) => {
        if (!connected) {
            Alert.alert('Chat unavailable', 'Live partner chat is not available right now.');
            return;
        }
        const preview = content.startsWith('[DRAW]') ? 'Drawing sent' : content;
        deliverMessage(content, preview);
    };

    return (
        <>
            <Animated.View style={[styles.fabContainer, pulseStyle]}>
                <TouchableOpacity
                    style={styles.fab}
                    onPress={() => setIsOpen(true)}
                    activeOpacity={0.8}
                >
                    <LinearGradient
                        colors={['#FF6B6B', '#FF8E8E']}
                        style={styles.fabGradient}
                    >
                        <MessageCircle size={24} color="#FFF" fill="#FFF" />
                        {unreadCount > 0 && (
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>{unreadCount}</Text>
                            </View>
                        )}
                    </LinearGradient>
                </TouchableOpacity>
                <View style={[styles.connDot, { backgroundColor: connected ? '#4ADE80' : '#EF4444' }]} />
            </Animated.View>

            <Modal
                visible={isOpen}
                animationType="slide"
                transparent
                onRequestClose={() => setIsOpen(false)}
            >
                <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
                    <LinearGradient
                        colors={['#1A1B2E', '#16172B']}
                        style={styles.sheetContainer}
                    >
                        <View style={styles.header}>
                            <View style={styles.headerLeft}>
                                <View style={[styles.headerDot, { backgroundColor: connected ? '#4ADE80' : '#EF4444' }]} />
                                <View>
                                    <Text style={styles.headerTitle}>Note to {partnerName}</Text>
                                    <Text style={styles.headerSub}>
                                        {connected ? 'Write a note • disappears in 60s' : 'Connecting...'}
                                    </Text>
                                </View>
                            </View>
                            <TouchableOpacity
                                style={styles.closeBtn}
                                onPress={() => setIsOpen(false)}
                            >
                                <X size={20} color="#9CA3AF" />
                            </TouchableOpacity>
                        </View>

                        <KeyboardAvoidingView
                            style={styles.body}
                            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                            keyboardVerticalOffset={insets.top}
                        >
                            <View style={styles.notesArea}>
                                {hasVisibleNotes ? (
                                    <View style={styles.notesStack}>
                                        {latestPartnerMessage && (
                                            <PartnerNote msg={latestPartnerMessage} />
                                        )}
                                        {latestOwnMessage && (
                                            <PartnerNote msg={latestOwnMessage} isMe />
                                        )}
                                    </View>
                                ) : (
                                    <Animated.View entering={FadeIn.duration(200)} style={styles.emptyNote}>
                                        <PenLine size={28} color="#4B5563" />
                                        <Text style={styles.emptyNoteTitle}>Send a quick note</Text>
                                        <Text style={styles.emptyNoteSub}>
                                            Use the note box below. Notes expire after 60 seconds.
                                        </Text>
                                    </Animated.View>
                                )}
                            </View>

                            <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
                                <PartnerNoteCompose
                                    partnerName={partnerName}
                                    disabled={!connected}
                                    onSend={handleComposeSend}
                                />
                            </View>
                        </KeyboardAvoidingView>
                    </LinearGradient>
                </View>
            </Modal>

            {lastSent && !isOpen && (
                <Animated.View
                    entering={FadeIn.duration(200)}
                    style={[styles.sentBanner, { bottom: insets.bottom + 100 }]}
                >
                    <Text style={styles.sentBannerLabel}>Sent to {partnerName}</Text>
                    <Text style={styles.sentBannerText} numberOfLines={2}>{lastSent}</Text>
                </Animated.View>
            )}
        </>
    );
}

const styles = StyleSheet.create({
    fabContainer: {
        position: 'absolute',
        bottom: 100,
        right: 20,
        zIndex: 999,
    },
    fab: {
        width: 56,
        height: 56,
        borderRadius: 28,
        elevation: 8,
        shadowColor: '#FF6B6B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
    },
    fabGradient: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
    },
    badge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: '#6366F1',
        width: 22,
        height: 22,
        borderRadius: 11,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#1A1B2E',
    },
    badgeText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: '800',
    },
    connDot: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#FFF',
    },

    modalContainer: {
        flex: 1,
        backgroundColor: '#1A1B2E',
    },
    sheetContainer: {
        flex: 1,
    },

    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    headerDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    headerSub: {
        fontSize: 11,
        color: '#6B7280',
        marginTop: 2,
    },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },

    body: {
        flex: 1,
        justifyContent: 'space-between',
    },
    notesArea: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    notesStack: { gap: 4 },
    footer: {
        paddingHorizontal: 20,
        paddingTop: 8,
        gap: 8,
    },

    emptyNote: {
        alignItems: 'center',
        paddingVertical: 24,
        marginBottom: 8,
    },
    emptyNoteTitle: {
        color: '#E5E7EB',
        fontSize: 16,
        fontWeight: '700',
        marginTop: 12,
    },
    emptyNoteSub: {
        color: '#6B7280',
        fontSize: 13,
        textAlign: 'center',
        marginTop: 6,
        lineHeight: 18,
        paddingHorizontal: 12,
    },

    sentBanner: {
        position: 'absolute',
        left: 20,
        right: 20,
        backgroundColor: 'rgba(26, 27, 46, 0.95)',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        zIndex: 998,
    },
    sentBannerLabel: {
        color: '#A78BFA',
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 4,
    },
    sentBannerText: {
        color: '#E5E7EB',
        fontSize: 13,
        lineHeight: 18,
    },
});
