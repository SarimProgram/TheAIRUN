// app/hooks/useGoalsData.ts
// Hook to fetch all data needed for the Goals screen

import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../config/api';

interface WeightProgress {
    user: {
        startWeight: number;
        currentWeight: number;
        targetWeight: number;
        lost: number;
    };
    partner: {
        name: string;
        startWeight: number;
        currentWeight: number;
        targetWeight: number;
        lost: number;
    } | null;
    combinedLost: number;
    goal: number;
}

interface MonthlyKm {
    user: {
        km: number;
        currentWeek: number;
    };
    partner: {
        name: string;
        km: number;
    } | null;
}

interface Activity {
    user: {
        todayKm: number;
        todayTarget: number;
        weeklyKm: number;
        weeklyTarget: number;
    };
    partner: {
        name: string;
        todayKm: number;
        todayTarget: number;
        weeklyKm: number;
        weeklyTarget: number;
    } | null;
}

export interface GoalsData {
    weight: WeightProgress;
    monthlyKm: MonthlyKm;
    activity: Activity;
}

interface UseGoalsDataOptions {
    accessToken: string | null;
}

interface UseGoalsDataReturn {
    data: GoalsData | null;
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}

const defaultGoalsData: GoalsData = {
    weight: {
        user: { startWeight: 70, currentWeight: 70, targetWeight: 70, lost: 0 },
        partner: null,
        combinedLost: 0,
        goal: 0
    },
    monthlyKm: {
        user: { km: 0, currentWeek: 1 },
        partner: null
    },
    activity: {
        user: { todayKm: 0, todayTarget: 0, weeklyKm: 0, weeklyTarget: 0 },
        partner: null
    }
};

export function useGoalsData({ accessToken }: UseGoalsDataOptions): UseGoalsDataReturn {
    const [data, setData] = useState<GoalsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchGoalsData = useCallback(async () => {
        if (!accessToken) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const response = await fetch(`${API_BASE_URL}/summary/goals`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch goals data');
            }

            const result = await response.json();
            setData(result);
        } catch (err) {
            console.error('Error fetching goals data:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
            setData(defaultGoalsData);
        } finally {
            setLoading(false);
        }
    }, [accessToken]);

    useEffect(() => {
        fetchGoalsData();
    }, [fetchGoalsData]);

    return {
        data,
        loading,
        error,
        refetch: fetchGoalsData,
    };
}
