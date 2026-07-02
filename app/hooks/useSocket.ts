// app/hooks/useSocket.ts
// Socket.IO hook for real-time partner chat

import { useEffect, useRef, useState, useCallback } from 'react';
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
};

/**
 * useSocket - manages Socket.IO connection with JWT auth
 * Provides chat functionality: send messages, receive messages, load history
 * Messages older than 60 seconds are automatically filtered out
 */
export function useSocket(isAuthenticated: boolean) {
    const socketRef = useRef<Socket | null>(null);
    const [connected, setConnected] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const cleanupTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Clean up expired messages (older than 60s)
    const cleanExpiredMessages = useCallback(() => {
        const now = Date.now();
        setMessages(prev => prev.filter(msg => {
            const msgTime = new Date(msg.createdAt).getTime();
            return (now - msgTime) < 60 * 1000;
        }));
    }, []);

    // Connect to socket
    useEffect(() => {
        if (!isAuthenticated) return;

        let cancelled = false;

        const connect = async () => {
            const token = await getAccessToken();
            if (!token || cancelled) return;

            // Extract the base URL (strip path, keep protocol + host)
            const wsUrl = API_BASE_URL.replace(/\/api$/, '').replace(/\/$/, '');

            const socket = io(wsUrl, {
                auth: { token },
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionAttempts: 10,
                reconnectionDelay: 2000,
            });

            socket.on('connect', () => {
                console.log('[Socket] Connected for chat');
                setConnected(true);
                // Request chat history on connect
                socket.emit('chat:history');
            });

            socket.on('disconnect', (reason) => {
                console.log('[Socket] Disconnected:', reason);
                setConnected(false);
            });

            socket.on('connect_error', (err) => {
                console.log('[Socket] Connection error:', err.message);
                setConnected(false);
            });

            // Receive chat messages (both sent confirmation and incoming)
            socket.on('chat:message', (msg: ChatMessage) => {
                setMessages(prev => {
                    // Avoid duplicates
                    if (prev.some(m => m.id === msg.id)) return prev;
                    return [...prev, msg];
                });
            });

            // Receive chat history
            socket.on('chat:history:response', (data: { messages: ChatMessage[] }) => {
                setMessages(data.messages);
            });

            socket.on('chat:error', (data: { message: string }) => {
                console.warn('[Chat] Error:', data.message);
            });

            socketRef.current = socket;
        };

        connect();

        // Start cleanup interval (every 5 seconds, remove expired messages)
        cleanupTimerRef.current = setInterval(cleanExpiredMessages, 5000);

        return () => {
            cancelled = true;
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
            if (cleanupTimerRef.current) {
                clearInterval(cleanupTimerRef.current);
                cleanupTimerRef.current = null;
            }
            setConnected(false);
            setMessages([]);
        };
    }, [isAuthenticated, cleanExpiredMessages]);

    // Send a chat message
    const sendMessage = useCallback((content: string) => {
        if (!socketRef.current?.connected) {
            console.warn('[Chat] Cannot send - not connected');
            return;
        }
        if (!content.trim()) return;

        socketRef.current.emit('chat:send', { content: content.trim() });
    }, []);

    return {
        connected,
        messages,
        sendMessage,
    };
}
