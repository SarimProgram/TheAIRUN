// app/hooks/useRealtimePartner.ts
// Real-time partner step updates via Socket.IO

import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { AppState, AppStateStatus } from 'react-native';
import { API_BASE_URL } from '../config/api';
import { refreshPartnerSurfaceFromServer } from '../lib/partner-surface';

interface PartnerInfo {
    partnerId: string;
    partnerName: string;
    steps: number;
}

interface StepUpdate {
    partnerId: string;
    partnerName: string;
    steps: number;
    timestamp: string;
}

interface UseRealtimePartnerOptions {
    accessToken: string | null | undefined;
}

interface UseRealtimePartnerReturn {
    partnerSteps: number;
    partnerName: string;
    partnerId: string | null;
    isConnected: boolean;
    lastUpdated: Date | null;
    reconnect: () => void;
}

/**
 * Hook for real-time partner step updates via Socket.IO
 * Connects to backend websocket and listens for stepUpdate events
 */
export function useRealtimePartner({
    accessToken
}: UseRealtimePartnerOptions): UseRealtimePartnerReturn {
    const [partnerSteps, setPartnerSteps] = useState(0);
    const [partnerName, setPartnerName] = useState('PARTNER');
    const [partnerId, setPartnerId] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const socketRef = useRef<Socket | null>(null);
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const isFetchingRef = useRef(false);

    // Get WebSocket URL from API base URL
    const getSocketUrl = useCallback(() => {
        // Convert API URL to WebSocket URL
        // e.g., http://localhost:4000/api -> http://localhost:4000
        return API_BASE_URL.replace(/\/api\/?$/, '');
    }, []);

    const fetchPartnerSummary = useCallback(async () => {
        if (!accessToken || isFetchingRef.current) return;
        isFetchingRef.current = true;
        try {
            const response = await fetch(`${API_BASE_URL}/summary/partner`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch partner summary (${response.status})`);
            }

            const data = await response.json();
            if (data?.hasPartner && data.partner) {
                setPartnerId(data.partner.id ?? null);
                setPartnerName(data.partner.name ?? 'PARTNER');
                setPartnerSteps(data.partner.steps ?? 0);
                setLastUpdated(new Date());
                void refreshPartnerSurfaceFromServer(accessToken).catch(() => {});
            }
        } catch (err) {
            console.error('[PartnerSummary] Error:', err);
        } finally {
            isFetchingRef.current = false;
        }
    }, [accessToken]);

    const connect = useCallback(() => {
        if (!accessToken) {
            console.log('[Socket] No access token, skipping connection');
            return;
        }

        // Disconnect existing socket if any
        if (socketRef.current?.connected) {
            socketRef.current.disconnect();
        }

        const socketUrl = getSocketUrl();
        console.log('[Socket] Connecting to:', socketUrl);

        const socket = io(socketUrl, {
            auth: { token: accessToken },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 10000,
        });

        socket.on('connect', () => {
            console.log('[Socket] Connected successfully');
            setIsConnected(true);
        });

        socket.on('disconnect', (reason) => {
            console.log('[Socket] Disconnected:', reason);
            setIsConnected(false);
        });

        socket.on('connect_error', (error) => {
            console.error('[Socket] Connection error:', error.message);
            setIsConnected(false);
        });

        // Receive initial partner info on connection
        socket.on('partnerInfo', (data: PartnerInfo) => {
            console.log('[Socket] Received partnerInfo:', data);
            setPartnerId(data.partnerId);
            setPartnerName(data.partnerName);
            setPartnerSteps(data.steps);
            setLastUpdated(new Date());
            void refreshPartnerSurfaceFromServer(accessToken).catch(() => {});
        });

        // Receive real-time step updates
        socket.on('stepUpdate', (data: StepUpdate) => {
            console.log('[Socket] Received stepUpdate:', data);
            setPartnerSteps(data.steps);
            setPartnerName(data.partnerName);
            setPartnerId(data.partnerId);
            setLastUpdated(new Date());
            void refreshPartnerSurfaceFromServer(accessToken).catch(() => {});
        });

        socketRef.current = socket;
    }, [accessToken, getSocketUrl]);

    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
        }

        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
        }

        setIsConnected(false);
    }, []);

    const reconnect = useCallback(() => {
        disconnect();
        // Small delay before reconnecting
        reconnectTimeoutRef.current = setTimeout(() => {
            connect();
        }, 500);
    }, [connect, disconnect]);

    // Connect on mount / when token changes
    useEffect(() => {
        if (accessToken) {
            connect();
            fetchPartnerSummary();
            pollingIntervalRef.current = setInterval(fetchPartnerSummary, 60 * 1000);
        }

        return () => {
            disconnect();
        };
    }, [accessToken, connect, disconnect, fetchPartnerSummary]);

    // Handle app state changes - reconnect when app becomes active
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
            if (state === 'active' && accessToken && !socketRef.current?.connected) {
                console.log('[Socket] App became active, reconnecting...');
                connect();
                fetchPartnerSummary();
            } else if (state === 'background' || state === 'inactive') {
                // Optionally disconnect in background to save battery
                // disconnect();
            }
        });

        return () => {
            subscription.remove();
        };
    }, [accessToken, connect]);

    return {
        partnerSteps,
        partnerName,
        partnerId,
        isConnected,
        lastUpdated,
        reconnect,
    };
}
