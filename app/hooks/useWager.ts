// app/hooks/useWager.ts
// Hook to manage weekly partner wagers

import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../config/api';
import { useAuth } from '../src/auth/authContext';

export interface WagerData {
    id: string;
    title: string;
    status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'DECLINED';
    weekStart: string;
    weekEnd: string;
    weekTimezone: string;
    partnerName: string;
    isSender: boolean;
    createdAt: string;
}

export interface WagerLeaderData {
    winner: 'YOU' | 'PARTNER' | 'TIE';
    loser: 'YOU' | 'PARTNER' | 'BOTH' | 'NONE';
    statusLabel: string;
    partnerName: string;
    yourWeek: {
        totalDistanceKm: number;
        weeklyKmTarget: number;
        remainingKm: number;
        progressPercent: number;
        completed: boolean;
    };
    partnerWeek: {
        totalDistanceKm: number;
        weeklyKmTarget: number;
        remainingKm: number;
        progressPercent: number;
        completed: boolean;
        partnerName: string;
    };
}

export interface WagerOverviewData {
    currentWager: WagerData | null;
    lastWager: WagerData | null;
    currentLeader: WagerLeaderData | null;
    lastOutcome: WagerLeaderData | null;
}

export function useWager() {
    const { authFetch, isAuthenticated, loading: authLoading } = useAuth();
    const [wager, setWager] = useState<WagerData | null>(null);
    const [overview, setOverview] = useState<WagerOverviewData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchActiveWager = useCallback(async () => {
        try {
            if (authLoading) {
                setLoading(true);
                return;
            }

            if (!isAuthenticated) {
                setOverview(null);
                setWager(null);
                setError(null);
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);
            const res = await authFetch(`${API_BASE_URL}/wager/overview`);
            if (!res.ok) {
                const text = await res.text();
                let message = `Failed to fetch wager (${res.status})`;

                try {
                    const data = JSON.parse(text);
                    message = data?.message || data?.error || data?.code || message;
                    if (data?.code && data.code !== message) {
                        message = `${message} (${data.code})`;
                    }
                } catch {
                    if (text) {
                        message = `${message}: ${text.slice(0, 200)}`;
                    }
                }

                throw new Error(message);
            }
            const data = await res.json();
            setOverview(data || null);
            setWager(data?.currentWager || null);
        } catch (err) {
            console.error('Error fetching wager:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, [authFetch, authLoading, isAuthenticated]);

    const createWager = useCallback(async (title: string) => {
        try {
            const res = await authFetch(`${API_BASE_URL}/wager/create`, {
                method: 'POST',
                body: JSON.stringify({ title }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to create wager');
            }
            const data = await res.json();
            await fetchActiveWager();
            return data.wager;
        } catch (err) {
            console.error('Error creating wager:', err);
            throw err;
        }
    }, [authFetch, fetchActiveWager]);

    const acceptWager = useCallback(async (wagerId: string) => {
        try {
            const res = await authFetch(`${API_BASE_URL}/wager/${wagerId}/accept`, {
                method: 'POST',
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to accept wager');
            }
            const data = await res.json();
            await fetchActiveWager();
            return data.wager;
        } catch (err) {
            console.error('Error accepting wager:', err);
            throw err;
        }
    }, [authFetch, fetchActiveWager]);

    const declineWager = useCallback(async (wagerId: string) => {
        try {
            const res = await authFetch(`${API_BASE_URL}/wager/${wagerId}/decline`, {
                method: 'POST',
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to decline wager');
            }
            await fetchActiveWager();
        } catch (err) {
            console.error('Error declining wager:', err);
            throw err;
        }
    }, [authFetch, fetchActiveWager]);

    const removeWager = useCallback(async (wagerId: string) => {
        try {
            const res = await authFetch(`${API_BASE_URL}/wager/${wagerId}`, {
                method: 'DELETE',
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to remove wager');
            }
            await fetchActiveWager();
        } catch (err) {
            console.error('Error removing wager:', err);
            throw err;
        }
    }, [authFetch, fetchActiveWager]);

    useEffect(() => {
        fetchActiveWager();
    }, [fetchActiveWager]);

    return {
        wager,
        overview,
        loading: loading,
        error,
        createWager,
        acceptWager,
        declineWager,
        removeWager,
        refetch: fetchActiveWager,
    };
}
