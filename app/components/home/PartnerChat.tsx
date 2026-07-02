// app/components/home/PartnerChat.tsx
// Floating chat bubble + modal for real-time partner messaging

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Modal,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    Dimensions,
} from 'react-native';
import { MessageCircle, Send, X, Wifi, WifiOff } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
    useAnimatedStyle,
    FadeIn,
    FadeOut,
    SlideInRight,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSocket, ChatMessage } from '../../hooks/useSocket';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Props = {
    isAuthenticated: boolean;
    partnerName: string;
    currentUserId?: string;
};

const MESSAGE_LIFETIME_MS = 60 * 1000; // 60 seconds

/**
 * TimeLeftIndicator - shows a shrinking bar under each message
 */
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
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 1,
        marginTop: 4,
        overflow: 'hidden',
    },
    bar: {
        height: '100%',
        backgroundColor: '#FF6B6B',
        borderRadius: 1,
    },
});

/**
 * MessageBubble - individual chat message
 */
const MessageBubble = ({ msg, isMe }: { msg: ChatMessage; isMe: boolean }) => (
    <Animated.View
        entering={SlideInRight.duration(300)}
        style={[
            bubbleStyles.container,
            isMe ? bubbleStyles.myMsg : bubbleStyles.partnerMsg,
        ]}
    >
        {!isMe && (
            <Text style={bubbleStyles.senderName}>{msg.fromName}</Text>
        )}
        <Text style={[bubbleStyles.text, isMe ? bubbleStyles.myText : bubbleStyles.partnerText]}>
            {msg.content}
        </Text>
        <Text style={bubbleStyles.time}>
            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </Text>
        <TimeLeftIndicator createdAt={msg.createdAt} />
    </Animated.View>
);

const bubbleStyles = StyleSheet.create({
    container: {
        maxWidth: '78%',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 18,
        marginVertical: 3,
    },
    myMsg: {
        alignSelf: 'flex-end',
        backgroundColor: '#FF6B6B',
        borderBottomRightRadius: 4,
    },
    partnerMsg: {
        alignSelf: 'flex-start',
        backgroundColor: '#2A2D3A',
        borderBottomLeftRadius: 4,
    },
    senderName: {
        fontSize: 10,
        fontWeight: '700',
        color: '#A78BFA',
        marginBottom: 2,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    text: {
        fontSize: 15,
        lineHeight: 20,
    },
    myText: {
        color: '#FFFFFF',
    },
    partnerText: {
        color: '#E5E7EB',
    },
    time: {
        fontSize: 9,
        color: 'rgba(255,255,255,0.5)',
        marginTop: 4,
        alignSelf: 'flex-end',
    },
});

export default function PartnerChat({ isAuthenticated, partnerName, currentUserId }: Props) {
    const insets = useSafeAreaInsets();
    const [isOpen, setIsOpen] = useState(false);
    const [text, setText] = useState('');
    const flatListRef = useRef<FlatList>(null);

    const { connected, messages, sendMessage } = useSocket(isAuthenticated);

    // Pulse animation for the floating bubble
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

    // Unread count - messages we haven't seen (chat is closed + from partner)
    const [lastSeenCount, setLastSeenCount] = useState(0);
    const unreadCount = useMemo(() => {
        if (isOpen) return 0;
        const partnerMessages = messages.filter(m => m.fromUserId !== currentUserId);
        return Math.max(0, partnerMessages.length - lastSeenCount);
    }, [messages, isOpen, currentUserId, lastSeenCount]);

    // When opening chat, mark all as seen
    useEffect(() => {
        if (isOpen) {
            const partnerMessages = messages.filter(m => m.fromUserId !== currentUserId);
            setLastSeenCount(partnerMessages.length);
        }
    }, [isOpen, messages, currentUserId]);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        if (isOpen && messages.length > 0) {
            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
        }
    }, [messages.length, isOpen]);

    const handleSend = () => {
        if (!text.trim()) return;
        sendMessage(text);
        setText('');
    };

    return (
        <>
            {/* FLOATING CHAT BUBBLE */}
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
                {/* Connection indicator dot */}
                <View style={[styles.connDot, { backgroundColor: connected ? '#4ADE80' : '#EF4444' }]} />
            </Animated.View>

            {/* CHAT MODAL */}
            <Modal
                visible={isOpen}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setIsOpen(false)}
            >
                <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
                    <LinearGradient
                        colors={['#1A1B2E', '#16172B']}
                        style={styles.chatContainer}
                    >
                        {/* HEADER */}
                        <View style={styles.header}>
                            <View style={styles.headerLeft}>
                                <View style={[styles.headerDot, { backgroundColor: connected ? '#4ADE80' : '#EF4444' }]} />
                                <View>
                                    <Text style={styles.headerTitle}>{partnerName}</Text>
                                    <Text style={styles.headerSub}>
                                        {connected ? 'Connected • Messages expire in 60s' : 'Connecting...'}
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

                        {/* MESSAGES */}
                        <FlatList
                            ref={flatListRef}
                            data={messages}
                            keyExtractor={(item) => item.id}
                            renderItem={({ item }) => (
                                <MessageBubble
                                    msg={item}
                                    isMe={item.fromUserId === currentUserId}
                                />
                            )}
                            contentContainerStyle={styles.messageList}
                            showsVerticalScrollIndicator={false}
                            ListEmptyComponent={
                                <View style={styles.emptyChat}>
                                    <MessageCircle size={40} color="#374151" />
                                    <Text style={styles.emptyChatText}>
                                        Send a message to {partnerName}!
                                    </Text>
                                    <Text style={styles.emptyChatSub}>
                                        Messages disappear after 60 seconds ⏱️
                                    </Text>
                                </View>
                            }
                        />

                        {/* INPUT BAR */}
                        <KeyboardAvoidingView
                            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                            keyboardVerticalOffset={insets.top}
                        >
                            <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Type a message..."
                                    placeholderTextColor="#6B7280"
                                    value={text}
                                    onChangeText={setText}
                                    onSubmitEditing={handleSend}
                                    returnKeyType="send"
                                    multiline={false}
                                    maxLength={500}
                                />
                                <TouchableOpacity
                                    style={[
                                        styles.sendBtn,
                                        (!text.trim() || !connected) && styles.sendBtnDisabled,
                                    ]}
                                    onPress={handleSend}
                                    disabled={!text.trim() || !connected}
                                >
                                    <Send size={18} color="#FFF" />
                                </TouchableOpacity>
                            </View>
                        </KeyboardAvoidingView>
                    </LinearGradient>
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    // -- FAB --
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

    // -- MODAL --
    modalContainer: {
        flex: 1,
        backgroundColor: '#1A1B2E',
    },
    chatContainer: {
        flex: 1,
    },

    // -- HEADER --
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

    // -- MESSAGE LIST --
    messageList: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexGrow: 1,
        justifyContent: 'flex-end',
    },

    // -- EMPTY STATE --
    emptyChat: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyChatText: {
        color: '#6B7280',
        fontSize: 15,
        fontWeight: '600',
        marginTop: 16,
    },
    emptyChatSub: {
        color: '#4B5563',
        fontSize: 12,
        marginTop: 6,
    },

    // -- INPUT --
    inputBar: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingTop: 12,
        gap: 10,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.05)',
        backgroundColor: 'rgba(0,0,0,0.2)',
    },
    input: {
        flex: 1,
        backgroundColor: '#2A2D3A',
        borderRadius: 24,
        paddingHorizontal: 18,
        paddingVertical: 12,
        fontSize: 15,
        color: '#FFFFFF',
        maxHeight: 100,
    },
    sendBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#FF6B6B',
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendBtnDisabled: {
        backgroundColor: '#374151',
        opacity: 0.6,
    },
});
