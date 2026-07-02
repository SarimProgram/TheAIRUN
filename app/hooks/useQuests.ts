// app/hooks/useQuests.ts
// Hook to fetch and manage user quests

import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../config/api';
import { parseApiError } from '../utils/premiumErrors';

export interface Quest {
    id: string;
    questId: string;
    title: string;
    description: string;
    type: 'DISTANCE' | 'TIME' | 'CALORIES' | 'STREAK' | 'PACE';
    difficulty: 'EASY' | 'MEDIUM' | 'HARD';
    targetValue: number;
    timeConstraint: string | null;
    xpReward: number;
    pointsReward: number;
    currentProgress: number;
    status: 'AVAILABLE' | 'COMPLETED' | 'EXPIRED' | 'ABANDONED';
    assignedAt: string;
    expiresAt: string;
}

interface UseQuestsOptions {
    accessToken: string | null;
}

interface UseQuestsReturn {
    quests: Quest[];
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
    completeQuest: (userQuestId: string) => Promise<{ success: boolean; rewards?: { xp: number; points: number }; error?: string }>;
    updateProgress: (userQuestId: string, progress: number) => Promise<boolean>;
}

export function useQuests({ accessToken }: UseQuestsOptions): UseQuestsReturn {
    const [quests, setQuests] = useState<Quest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchQuests = useCallback(async () => {
        if (!accessToken) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const response = await fetch(`${API_BASE_URL}/quests/available`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) throw await parseApiError(response, 'Failed to fetch quests');

            const data = await response.json();
            setQuests(data.quests || []);
            setError(null);
        } catch (err) {
            console.error('[useQuests] Error fetching quests:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, [accessToken]);

    const completeQuest = useCallback(async (userQuestId: string) => {
        if (!accessToken) return { success: false, error: 'Not authenticated' };

        try {
            const response = await fetch(`${API_BASE_URL}/quests/${userQuestId}/complete`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();

            if (!response.ok) {
                return { success: false, error: data.error || data.message || 'Failed to complete quest' };
            }

            // Refresh quests after completion
            await fetchQuests();
            return { success: true, rewards: data.rewards };
        } catch (err) {
            console.error('[useQuests] Error completing quest:', err);
            return { success: false, error: 'Failed to complete quest' };
        }
    }, [accessToken, fetchQuests]);

    const updateProgress = useCallback(async (userQuestId: string, progress: number) => {
        if (!accessToken) return false;

        try {
            const response = await fetch(`${API_BASE_URL}/quests/${userQuestId}/progress`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ progress }),
            });

            if (!response.ok) {
                const err = await parseApiError(response, 'Failed to update quest progress');
                console.error('[useQuests] Error updating progress:', err);
                return false;
            }

            // Update local state
            setQuests(prev => prev.map(q =>
                q.id === userQuestId ? { ...q, currentProgress: progress } : q
            ));
            return true;
        } catch (err) {
            console.error('[useQuests] Error updating progress:', err);
            return false;
        }
    }, [accessToken]);

    useEffect(() => {
        fetchQuests();
    }, [fetchQuests]);

    return {
        quests,
        loading,
        error,
        refetch: fetchQuests,
        completeQuest,
        updateProgress,
    };
}

// Helper to format time remaining
export function formatTimeRemaining(expiresAt: string): string {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diffMs = expiry.getTime() - now.getTime();

    if (diffMs <= 0) return 'Expired';

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
        return `${hours}h ${minutes}m left`;
    }
    return `${minutes}m left`;
}

// Helper to get progress percentage
export function getQuestProgress(quest: Quest): number {
    if (quest.targetValue === 0) return 0;
    return Math.min((quest.currentProgress / quest.targetValue) * 100, 100);
}
