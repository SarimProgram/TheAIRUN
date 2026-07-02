// app/hooks/useRaceSocket.ts
// Hook for managing Socket.IO connection for real-time racing

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/src/auth/authContext';
import { API_BASE_URL } from '../config/api';

export type RaceState =
    | 'idle'
    | 'inviting'
    | 'invited'
    | 'selectDistance'
    | 'countdown'
    | 'racing'
    | 'finished';

export interface PartnerPosition {
    odId: string;
    partnerName: string;
    latitude: number;
    longitude: number;
    distanceCovered: number;
    speed: number;
    timestamp: number;
}

interface RaceInvite {
    fromUserId: string;
    fromName: string;
    distance: number;
}

export interface UseRaceSocketResult {
    isConnected: boolean;
    raceState: RaceState;
    inviteFrom: RaceInvite | null;
    raceDistance: number;
    countdown: number | null;
    partnerPosition: PartnerPosition | null;
    winner: { odId: string; winnerName: string; duration: number; finalDistance?: number } | null;
    raceStartTime: number | null;

    // Actions
    sendInvite: (distance: number) => void;
    acceptInvite: () => void;
    declineInvite: () => void;
    hydrateInvite: (invite: RaceInvite) => void;
    setDistance: (meters: number) => void;
    sendPosition: (data: { latitude: number; longitude: number; distanceCovered: number; speed: number }) => void;
    finishRace: (data: { finalDistance: number; duration: number }) => void;
    cancelRace: () => void;
    resetRace: () => void;
}

export function useRaceSocket(): UseRaceSocketResult {
    const { accessToken, isAuthenticated } = useAuth();
    const socketRef = useRef<Socket | null>(null);

    const [isConnected, setIsConnected] = useState(false);
    const [raceState, setRaceState] = useState<RaceState>('idle');
    const [inviteFrom, setInviteFrom] = useState<RaceInvite | null>(null);
    const [raceDistance, setRaceDistance] = useState(1000);
    const [countdown, setCountdown] = useState<number | null>(null);
    const [partnerPosition, setPartnerPosition] = useState<PartnerPosition | null>(null);
    const [winner, setWinner] = useState<{ odId: string; winnerName: string; duration: number; finalDistance?: number } | null>(null);
    const [raceStartTime, setRaceStartTime] = useState<number | null>(null);

    // Extract base URL without /api
    const wsUrl = API_BASE_URL.replace('/api', '').replace('http', 'ws').replace('ws', 'http');

    useEffect(() => {
        if (!isAuthenticated || !accessToken) return;

        const socket = io(wsUrl, {
            auth: { token: accessToken },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('[RaceSocket] Connected');
            setIsConnected(true);
        });

        socket.on('disconnect', () => {
            console.log('[RaceSocket] Disconnected');
            setIsConnected(false);
        });

        // Race events
        socket.on('race:invited', (data: RaceInvite) => {
            console.log('[RaceSocket] Received invite from:', data.fromName, 'for', data.distance, 'm');
            setInviteFrom(data);
            setRaceDistance(data.distance);
            setRaceState('invited');
        });

        socket.on('race:accepted', () => {
            console.log('[RaceSocket] Race accepted');
            setRaceState('selectDistance');
            setInviteFrom(null);
        });

        socket.on('race:declined', () => {
            console.log('[RaceSocket] Race declined');
            setRaceState('idle');
        });

        socket.on('race:distanceSet', (data: { distance: number }) => {
            console.log('[RaceSocket] Distance set:', data.distance);
            setRaceDistance(data.distance);
        });

        socket.on('race:countdown', (data: { count: number }) => {
            console.log('[RaceSocket] Countdown:', data.count);
            setCountdown(data.count);
            setRaceState('countdown');
        });

        socket.on('race:start', (data: { startTime: number; distance: number }) => {
            console.log('[RaceSocket] Race started!');
            setRaceStartTime(data.startTime);
            setRaceDistance(data.distance);
            setCountdown(null);
            setRaceState('racing');
        });

        socket.on('race:partnerPosition', (data: PartnerPosition) => {
            console.log('[RaceSocket] Partner position update:', data.distanceCovered, 'm');
            setPartnerPosition(data);
        });

        socket.on('race:winner', (data: { odId: string; winnerName: string; duration: number; finalDistance?: number }) => {
            console.log('[RaceSocket] Winner:', data.winnerName);
            setWinner(data);
            setRaceState('finished');
        });

        socket.on('race:cancelled', () => {
            console.log('[RaceSocket] Race cancelled');
            setRaceState('idle');
            setInviteFrom(null);
            setPartnerPosition(null);
        });

        socket.on('race:error', (data: { message: string }) => {
            console.error('[RaceSocket] Error:', data.message);
            setRaceState('idle');
        });

        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
    }, [isAuthenticated, accessToken, wsUrl]);

    const sendInvite = useCallback((distance: number) => {
        if (socketRef.current) {
            // Send invite with proposed distance so partner knows the challenge
            socketRef.current.emit('race:invite', { distance });
            setRaceDistance(distance);
            setRaceState('inviting');
        }
    }, []);

    const acceptInvite = useCallback(() => {
        if (socketRef.current && inviteFrom) {
            // Pass distance along so backend knows the race parameters
            socketRef.current.emit('race:accept', {
                initiatorId: inviteFrom.fromUserId,
                distance: inviteFrom.distance
            });
        }
    }, [inviteFrom]);

    const declineInvite = useCallback(() => {
        if (socketRef.current && inviteFrom) {
            socketRef.current.emit('race:decline', { initiatorId: inviteFrom.fromUserId });
            setRaceState('idle');
            setInviteFrom(null);
        }
    }, [inviteFrom]);

    const hydrateInvite = useCallback((invite: RaceInvite) => {
        if (!invite?.fromUserId || !invite?.fromName || !Number.isFinite(invite.distance) || invite.distance <= 0) {
            return;
        }

        setInviteFrom(invite);
        setRaceDistance(invite.distance);
        setRaceState((current) => {
            if (current === 'racing' || current === 'countdown' || current === 'finished') {
                return current;
            }
            return 'invited';
        });
    }, []);

    const setDistance = useCallback((meters: number) => {
        if (socketRef.current) {
            socketRef.current.emit('race:setDistance', { distance: meters });
        }
    }, []);

    const sendPosition = useCallback((data: {
        latitude: number;
        longitude: number;
        distanceCovered: number;
        speed: number
    }) => {
        if (socketRef.current) {
            console.log('[RaceSocket] Sending position:', data.distanceCovered, 'm');
            socketRef.current.emit('race:position', data);
        }
    }, []);

    const finishRace = useCallback((data: { finalDistance: number; duration: number }) => {
        if (socketRef.current) {
            socketRef.current.emit('race:finish', {
                ...data,
                finishTime: Date.now()
            });
        }
    }, []);

    const cancelRace = useCallback(() => {
        if (socketRef.current) {
            socketRef.current.emit('race:cancel');
        }
        setRaceState('idle');
        setPartnerPosition(null);
        setInviteFrom(null);
    }, []);

    const resetRace = useCallback(() => {
        setRaceState('idle');
        setInviteFrom(null);
        setPartnerPosition(null);
        setWinner(null);
        setRaceStartTime(null);
        setCountdown(null);
    }, []);

    return {
        isConnected,
        raceState,
        inviteFrom,
        raceDistance,
        countdown,
        partnerPosition,
        winner,
        raceStartTime,
        sendInvite,
        acceptInvite,
        declineInvite,
        hydrateInvite,
        setDistance,
        sendPosition,
        finishRace,
        cancelRace,
        resetRace,
    };
}
