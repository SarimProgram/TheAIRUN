import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/src/auth/authContext';
import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../config/api';
import { getAccessToken } from '@/utils/authstorage';

export type ChatMessage = {
    id: string;
    fromUserId: string;
    fromName: string;
    toUserId: string;
    content: string;
    createdAt: string;
    optimistic?: boolean;
    viewedAt?: string;
};

interface ChatContextType {
    connected: boolean;
    messages: ChatMessage[];
    sendMessage: (content: string) => void;
    chatError: string | null;
    unreadCount: number;
    latestMessage: ChatMessage | null;
    isViewingChat: boolean;
    setIsViewingChat: (viewing: boolean) => void;
    clearUnread: () => void;
    currentUserId: string | null;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, authFetch } = useAuth();
    const [connected, setConnected] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [chatError, setChatError] = useState<string | null>(null);
    const [unreadCount, setUnreadCount] = useState(0);
    const [latestMessage, setLatestMessage] = useState<ChatMessage | null>(null);
    const [isViewingChat, setIsViewingChat] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    
    const socketRef = useRef<Socket | null>(null);
    const lastNotifiedMsgId = useRef<string | null>(null);
    const cleanupTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const currentUserIdRef = useRef<string | null>(null);
    const isViewingChatRef = useRef(false);

    const markMessagesAsViewed = useCallback((incoming: ChatMessage[], viewerId: string | null) => {
        if (!viewerId) return incoming;

        const viewedAt = new Date().toISOString();
        let changed = false;

        const next = incoming.map((msg) => {
            if (msg.fromUserId === viewerId || msg.viewedAt) {
                return msg;
            }

            changed = true;
            return { ...msg, viewedAt };
        });

        return changed ? next : incoming;
    }, []);

    // Get current user ID properly
    useEffect(() => {
        if (!isAuthenticated) {
            setCurrentUserId(null);
            return;
        }
        
        const fetchProfile = async () => {
            try {
                // Use authFetch to benefit from token handling and ngrok headers
                const res = await authFetch(`${API_BASE_URL}/profile`);
                const data = await res.json();
                if (data.user?.id) {
                    console.log('[ChatContext] currentUserId set:', data.user.id);
                    setCurrentUserId(data.user.id);
                }
            } catch (err) {
                console.error('[ChatContext] Profile fetch error:', err);
            }
        };

        fetchProfile();
    }, [isAuthenticated, authFetch]);

    useEffect(() => {
        currentUserIdRef.current = currentUserId;
    }, [currentUserId]);

    useEffect(() => {
        isViewingChatRef.current = isViewingChat;
    }, [isViewingChat]);

    const cleanExpiredMessages = useCallback(() => {
        const now = Date.now();
        setMessages(prev => prev.filter(msg => {
            const expiryStart = msg.fromUserId === currentUserIdRef.current
                ? new Date(msg.createdAt).getTime()
                : msg.viewedAt
                    ? new Date(msg.viewedAt).getTime()
                    : null;

            if (expiryStart === null) {
                return true;
            }

            return (now - expiryStart) < 60 * 1000;
        }));
    }, []);

    useEffect(() => {
        if (!isAuthenticated) return;

        let cancelled = false;
        const connect = async () => {
            const token = await getAccessToken();
            if (!token || cancelled) return;

            const wsUrl = API_BASE_URL.replace(/\/api$/, '').replace(/\/$/, '');
            const socket = io(wsUrl, {
                auth: { token },
                transports: ['websocket', 'polling'],
            });

            socket.on('connect', () => {
                console.log('[ChatContext] Socket connected');
                setConnected(true);
                socket.emit('chat:history');
            });

            socket.on('disconnect', () => {
                console.log('[ChatContext] Socket disconnected');
                setConnected(false);
            });
            
            socket.on('chat:message', (msg: ChatMessage) => {
                console.log('[ChatContext] Received message:', msg.id);
                setChatError(null);

                const shouldMarkViewed =
                    !!currentUserIdRef.current &&
                    isViewingChatRef.current &&
                    msg.fromUserId !== currentUserIdRef.current;

                const nextMessage = shouldMarkViewed
                    ? { ...msg, viewedAt: new Date().toISOString() }
                    : msg;

                setMessages(prev => {
                    const optimisticIndex = prev.findIndex(m =>
                        m.optimistic &&
                        m.fromUserId === msg.fromUserId &&
                        m.content === msg.content
                    );

                    if (optimisticIndex !== -1) {
                        const next = [...prev];
                        next[optimisticIndex] = nextMessage;
                        return next;
                    }

                    if (prev.some(m => m.id === msg.id)) return prev;
                    return [...prev, nextMessage];
                });
            });

            socket.on('chat:error', (data: { message?: string }) => {
                const message = data?.message || 'Failed to send message';
                console.error('[ChatContext] Chat error:', message);
                setChatError(message);
                setMessages(prev => {
                    const next = [...prev];
                    const optimisticIndex = [...next].reverse().findIndex(m => m.optimistic);
                    if (optimisticIndex === -1) return prev;
                    next.splice(next.length - 1 - optimisticIndex, 1);
                    return next;
                });
            });

            socket.on('chat:history:response', (data: { messages: ChatMessage[] }) => {
                console.log('[ChatContext] History received:', data.messages.length);
                setMessages(markMessagesAsViewed(
                    data.messages,
                    isViewingChatRef.current ? currentUserIdRef.current : null
                ));
            });

            socketRef.current = socket;
        };

        connect();
        cleanupTimerRef.current = setInterval(cleanExpiredMessages, 5000);

        return () => {
            cancelled = true;
            socketRef.current?.disconnect();
            if (cleanupTimerRef.current) clearInterval(cleanupTimerRef.current);
            setConnected(false);
            setMessages([]);
        };
    }, [isAuthenticated, cleanExpiredMessages, markMessagesAsViewed]);

    // Handle incoming message notifications
    useEffect(() => {
        if (messages.length === 0 || !currentUserId) return;
        const latest = messages[messages.length - 1];
        
        // Prevent notifying for self or already notified messages
        if (latest.id !== lastNotifiedMsgId.current && latest.fromUserId !== currentUserId) {
            lastNotifiedMsgId.current = latest.id;
            
            // Only notify if we aren't already looking at the chat
            if (!isViewingChat) {
                console.log('[ChatContext] Notifying for message:', latest.id);
                setUnreadCount(prev => prev + 1);
                setLatestMessage(latest);
            }
        }
    }, [messages, isViewingChat, currentUserId]);

    const sendMessage = useCallback((content: string) => {
        const trimmed = content.trim();
        if (!trimmed || !socketRef.current || !currentUserId) return;

        setChatError(null);
        setMessages(prev => [
            ...prev,
            {
                id: `local-${Date.now()}`,
                fromUserId: currentUserId,
                fromName: 'You',
                toUserId: '',
                content: trimmed,
                createdAt: new Date().toISOString(),
                optimistic: true,
            }
        ]);

        socketRef.current.emit('chat:send', { content: trimmed });
    }, [currentUserId]);

    const clearUnread = useCallback(() => {
        setUnreadCount(0);
        setLatestMessage(null);
    }, []);

    // Also clear unread automatically when viewing chat
    useEffect(() => {
        if (isViewingChat) {
            clearUnread();
        }
    }, [isViewingChat, clearUnread]);

    useEffect(() => {
        if (!isViewingChat || !currentUserId) return;
        setMessages(prev => markMessagesAsViewed(prev, currentUserId));
    }, [currentUserId, isViewingChat, markMessagesAsViewed]);

    return (
        <ChatContext.Provider value={{
            connected,
            messages,
            sendMessage,
            chatError,
            unreadCount,
            latestMessage,
            isViewingChat,
            setIsViewingChat,
            clearUnread,
            currentUserId
        }}>
            {children}
        </ChatContext.Provider>
    );
}

export function useChat() {
    const context = useContext(ChatContext);
    if (context === undefined) {
        throw new Error('useChat must be used within a ChatProvider');
    }
    return context;
}
