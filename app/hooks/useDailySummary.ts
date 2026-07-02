// app/hooks/useDailySummary.ts
// Hook to fetch and manage daily summary data for dashboard

import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../config/api';
import { parseApiError } from '../utils/premiumErrors';

export interface DailySummary {
    id: string;
    userId: string;
    dayKey: string;
    timezone?: string;

    // Targets
    calorieTarget: number;
    proteinTarget: number;
    stepsTarget: number;
    runKmTarget: number;

    // Intake
    consumedCalories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;

    // Activity
    steps: number;
    activeCalories: number;
    exerciseMinutes: number;
    distanceKm: number;

    // Energy math
    restingCalories: number;
    totalBurnedCalories: number;
    caloriesRemaining: number;
    // ---- HYDRATION ----
    waterMl: number;
    waterTarget: number;
}

interface UseDailySummaryOptions {
    accessToken: string | null;
    dayKey?: string; // Optional: YYYY-MM-DD format. If not provided, fetches today's summary
}

// Helper to get local date string YYYY-MM-DD
function getLocalDayKey(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

interface UseDailySummaryReturn {
    summary: DailySummary | null;
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
    updateSummary: (updates: Partial<DailySummary>) => Promise<void>;
    recalculate: () => Promise<void>;
}

interface TodayMealsResponse {
    totalCalories?: number;
    meals?: Array<{
        totalCalories?: number;
    }>;
}

export function useDailySummary({ accessToken, dayKey }: UseDailySummaryOptions): UseDailySummaryReturn {
    const [summary, setSummary] = useState<DailySummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const mergeTodayMealCalories = useCallback(async (base: DailySummary): Promise<DailySummary> => {
        // Only patch "today" summaries. Historical summaries use /summary/:dayKey and shouldn't call /nutrition/meals/today.
        if (!accessToken || dayKey) return base;

        try {
            const mealsResp = await fetch(`${API_BASE_URL}/nutrition/meals/today`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });
            if (!mealsResp.ok) return base;

            const mealsData: TodayMealsResponse = await mealsResp.json();
            const totalFromMeals = typeof mealsData.totalCalories === 'number'
                ? mealsData.totalCalories
                : (Array.isArray(mealsData.meals)
                    ? mealsData.meals.reduce((sum, m) => sum + (Number(m?.totalCalories) || 0), 0)
                    : null);

            if (typeof totalFromMeals !== 'number') return base;

            return {
                ...base,
                consumedCalories: totalFromMeals,
                caloriesRemaining: (base.calorieTarget ?? 0) - totalFromMeals,
            };
        } catch {
            return base;
        }
    }, [accessToken, dayKey]);

    const fetchSummary = useCallback(async () => {
        if (!accessToken) {
            setLoading(false);
            return;
        }

        try {
            if (!summary) {
                setLoading(true);
            }
            setError(null);

            // Use dayKey endpoint if provided, otherwise fetch today with local date param
            const endpoint = dayKey
                ? `${API_BASE_URL}/summary/${dayKey}`
                : `${API_BASE_URL}/summary/today?dayKey=${getLocalDayKey()}`;

            const response = await fetch(endpoint, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                // For specific dates, 404 means no data for that day (not an error)
                if (response.status === 404 && dayKey) {
                    setSummary(null);
                    return;
                }
                throw await parseApiError(response, 'Failed to fetch daily summary');
            }

            const data = await response.json();
            const merged = await mergeTodayMealCalories(data);
            setSummary(merged);
        } catch (err) {
            console.error('Error fetching daily summary:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, [accessToken, dayKey, mergeTodayMealCalories]);

    const updateSummary = useCallback(async (updates: Partial<DailySummary>) => {
        if (!accessToken) return;

        try {
            const response = await fetch(`${API_BASE_URL}/summary/today`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...updates,
                    dayKey: dayKey || getLocalDayKey() // Explicitly send dayKey
                }),
            });

            if (!response.ok) {
                throw await parseApiError(response, 'Failed to update summary');
            }

            const data = await response.json();
            setSummary(data);
        } catch (err) {
            console.error('Error updating summary:', err);
            throw err;
        }
    }, [accessToken]);

    const recalculate = useCallback(async (dateOverride?: string) => {
        if (!accessToken) return;

        try {
            const validDateOverride = typeof dateOverride === 'string' ? dateOverride : undefined;

            // Determine dayKey to send (Client's Local Date)
            // 1. Explicit override
            // 2. Hook prop dayKey
            // 3. Current local date
            let bodyDayKey = validDateOverride || dayKey;

            if (!bodyDayKey) {
                const now = new Date();
                const y = now.getFullYear();
                const m = String(now.getMonth() + 1).padStart(2, '0');
                const d = String(now.getDate()).padStart(2, '0');
                bodyDayKey = `${y}-${m}-${d}`;
            }

            console.log('[useDailySummary] Calling recalculate with dayKey:', bodyDayKey);

            const response = await fetch(`${API_BASE_URL}/summary/recalculate`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ dayKey: bodyDayKey })
            });

            if (!response.ok) {
                throw await parseApiError(response, 'Failed to recalculate summary');
            }

            const data = await response.json();
            const merged = await mergeTodayMealCalories(data);
            console.log('[useDailySummary] Recalculate response:', merged);
            setError(null); // Clear any previous error
            setSummary(merged);

            // Follow with a fresh fetch to avoid stale UI when recalc response lags behind
            // meal delete/save mutations or when server returns a partial/old snapshot.
            await fetchSummary();
        } catch (err) {
            console.error('Error recalculating summary:', err);
            throw err;
        }
    }, [accessToken, dayKey, mergeTodayMealCalories, fetchSummary]);

    useEffect(() => {
        fetchSummary();
    }, [fetchSummary]);

    return {
        summary,
        loading,
        error,
        refetch: fetchSummary,
        updateSummary,
        recalculate,
    };
}

// Helper to derive display values
export function getDashboardData(summary: DailySummary | null) {
    if (!summary) {
        return {
            food: 0,
            exercise: 0,
            goal: 2000,
            remaining: 2000,
            steps: 0,
            stepsTarget: 8000,
        };
    }

    return {
        food: summary.consumedCalories,
        exercise: summary.activeCalories,
        goal: summary.calorieTarget,
        remaining: summary.caloriesRemaining,
        steps: summary.steps,
        stepsTarget: summary.stepsTarget,
    };
}
