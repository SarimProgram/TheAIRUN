// app/hooks/useWeeklyProgress.ts
// Hook to fetch weekly progress data for the race component

import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../config/api';
import { loadRuns } from '../lib/run-storage';

export interface WeeklyProgress {
    weekStart: string;
    weekEnd: string;
    currentWeek: number;
    totalDistanceKm: number;
    totalActiveCalories: number;
    totalSteps: number;
    totalExerciseMinutes: number;
    weeklyKmTarget: number;
    remaining: number;
    progressPercent: number;
}

export interface PartnerWeeklyProgress {
    id: string;
    name: string;
    weeklyKm: number;
    weeklyKmTarget: number;
    remaining: number;
    progressPercent: number;
}

interface UseWeeklyProgressOptions {
    accessToken: string | null;
}

interface UseWeeklyProgressReturn {
    progress: WeeklyProgress | null;
    partnerProgress: PartnerWeeklyProgress | null;
    hasPartner: boolean;
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}

export function useWeeklyProgress({ accessToken }: UseWeeklyProgressOptions): UseWeeklyProgressReturn {
    const [progress, setProgress] = useState<WeeklyProgress | null>(null);
    const [partnerProgress, setPartnerProgress] = useState<PartnerWeeklyProgress | null>(null);
    const [hasPartner, setHasPartner] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchProgress = useCallback(async () => {
        if (!accessToken) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            // Fetch both user and partner weekly progress in parallel
            const [userResponse, partnerResponse] = await Promise.all([
                fetch(`${API_BASE_URL}/summary/week`, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                }),
                fetch(`${API_BASE_URL}/summary/partner/week`, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                }),
            ]);

            if (!userResponse.ok) {
                throw new Error('Failed to fetch weekly progress');
            }

            const userData = await userResponse.json();

            const weeklyKmTarget = userData.weeklyKmTarget ?? 0;
            let totalDistanceKm = userData.totalDistanceKm ?? 0;

            // Use local recorded run history for weekly total km
            try {
                const runs = await loadRuns();
                const now = new Date();
                const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
                const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
                const weekStart = new Date(now);
                weekStart.setDate(now.getDate() + mondayOffset);
                weekStart.setHours(0, 0, 0, 0);
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekStart.getDate() + 7);

                const weekKm = runs.reduce((sum: number, run: any) => {
                    const startedAt = new Date(run.startedAt);
                    if (startedAt >= weekStart && startedAt < weekEnd) {
                        return sum + (run.totalDistanceMeters || 0) / 1000;
                    }
                    return sum;
                }, 0);

                totalDistanceKm = Math.round(weekKm * 10) / 10;
            } catch (err) {
                console.warn('Failed to compute weekly km from local history', err);
            }

            const remaining = Math.max(0, (weeklyKmTarget || 0) - (totalDistanceKm || 0));
            const progressPercent = weeklyKmTarget > 0
                ? Math.min(100, Math.round((totalDistanceKm / weeklyKmTarget) * 100))
                : 0;

            setProgress({
                ...userData,
                totalDistanceKm,
                weeklyKmTarget,
                remaining: Math.round(remaining * 10) / 10,
                progressPercent
            });

            // Handle partner data
            if (partnerResponse.ok) {
                const partnerData = await partnerResponse.json();
                setHasPartner(partnerData.hasPartner);
                setPartnerProgress(partnerData.partner || null);
            }
        } catch (err) {
            console.error('Error fetching weekly progress:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, [accessToken]);

    useEffect(() => {
        fetchProgress();
    }, [fetchProgress]);

    return {
        progress,
        partnerProgress,
        hasPartner,
        loading,
        error,
        refetch: fetchProgress,
    };
}
