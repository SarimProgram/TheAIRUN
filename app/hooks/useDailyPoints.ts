// app/hooks/useDailyPoints.ts
// Hook to calculate weighted daily points with normalization and backend duplicate prevention

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { API_BASE_URL } from '../config/api';
import { notifyDailyReward } from '../lib/daily-reward-events';

// Point category keys
export type PointCategoryKey = 'WALK_RUN' | 'STEPS' | 'CALORIES' | 'MOBILITY' | 'HYDRATION';

// Base weights for each category (sum = 100)
const BASE_WEIGHTS: Record<PointCategoryKey, number> = {
    WALK_RUN: 25,
    STEPS: 25,
    CALORIES: 20,
    MOBILITY: 25,
    HYDRATION: 5,
};

// Priority order for weight redistribution (highest to lowest)
const PRIORITY_ORDER: PointCategoryKey[] = ['WALK_RUN', 'STEPS', 'CALORIES', 'MOBILITY', 'HYDRATION'];

// Category display info
const CATEGORY_INFO: Record<PointCategoryKey, { label: string; info: string }> = {
    WALK_RUN: {
        label: 'Walk/Run',
        info: 'Earn points by completing your daily walk or run. Walk/Run contributes 25% of daily points, equal to Exercise.',
    },
    STEPS: {
        label: 'Steps',
        info: 'Track your daily steps to earn points. Walking throughout the day contributes 25% of your daily points.',
    },
    CALORIES: {
        label: 'Calories',
        info: 'Meet your calorie goals to earn points. Balanced nutrition contributes 20% of your daily points.',
    },
    MOBILITY: {
        label: 'Exercise',
        info: 'Complete your daily exercises to earn these points. Exercise contributes 25% of daily points, equal to Walk/Run.',
    },
    HYDRATION: {
        label: 'Hydration',
        info: 'Stay hydrated throughout the day. Drinking enough water contributes 5% of your daily points.',
    },
};

export interface PointCategory {
    key: PointCategoryKey;
    label: string;
    baseWeight: number;
    maxPoints: number;      // After normalization
    earnedPoints: number;   // Calculated or from ledger
    progress: number;       // 0-1
    isAwarded: boolean;     // Already claimed from backend
    isAvailable: boolean;   // Category is active for today
    info: string;           // Description for card flip
    claimable?: boolean;
    metricText?: string;
    statusText?: string;
}

export interface DailyPointsConfig {
    isRunDay: boolean;
    hasMobility: boolean;
    hasHydration: boolean;
    // Current progress values
    stepsProgress: number;      // 0-1
    caloriesProgress: number;   // 0-1
    mobilityProgress: number;   // 0-1
    hydrationProgress: number;  // 0-1
    walkRunProgress: number;    // 0-1 (run distance or walk goal)
}

interface LedgerEntry {
    category: string;
    earnedPoints: number;
    maxPoints: number;
    progress: number;
}

interface UseDailyPointsOptions {
    accessToken: string | null;
    dayKey: string;
    config: DailyPointsConfig;
}

interface UseDailyPointsReturn {
    categories: PointCategory[];
    totalMaxPoints: number;
    totalEarnedPoints: number;
    loading: boolean;
    error: string | null;
    claimPoints: (categoryKey: PointCategoryKey) => Promise<boolean>;
    refetch: () => Promise<void>;
}

/**
 * Calculate normalized weights when categories are missing
 * Missing weight is redistributed proportionally down the priority chain
 */
function calculateNormalizedWeights(availableCategories: PointCategoryKey[]): Record<PointCategoryKey, number> {
    const weights: Record<PointCategoryKey, number> = { ...BASE_WEIGHTS };

    // Zero out unavailable categories
    for (const key of PRIORITY_ORDER) {
        if (!availableCategories.includes(key)) {
            weights[key] = 0;
        }
    }

    // Calculate total of available weights
    const totalAvailable = Object.values(weights).reduce((sum, w) => sum + w, 0);

    if (totalAvailable === 0) {
        return weights; // No categories available
    }

    // Normalize to 100
    const normalizationFactor = 100 / totalAvailable;
    for (const key of availableCategories) {
        weights[key] = Math.round(weights[key] * normalizationFactor);
    }

    // Adjust for rounding errors (ensure total = 100)
    const currentTotal = Object.values(weights).reduce((sum, w) => sum + w, 0);
    if (currentTotal !== 100 && availableCategories.length > 0) {
        // Add/subtract difference from highest priority available category
        const adjustKey = availableCategories[0];
        weights[adjustKey] += (100 - currentTotal);
    }

    return weights;
}

export function useDailyPoints({ accessToken, dayKey, config }: UseDailyPointsOptions): UseDailyPointsReturn {
    const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const scope = `${accessToken}:${dayKey}`;
    const currentScope = useRef(scope);
    currentScope.current = scope;
    const [loadedScope, setLoadedScope] = useState<string | null>(null);
    const ledgerVersion = useRef(0);

    // Determine which categories are available today
    const availableCategories = useMemo((): PointCategoryKey[] => {
        const available: PointCategoryKey[] = [];

        if (config.isRunDay) available.push('WALK_RUN');
        available.push('STEPS');   // Always available
        available.push('CALORIES'); // Always available
        if (config.hasMobility) available.push('MOBILITY');
        if (config.hasHydration) available.push('HYDRATION');

        return available;
    }, [config.isRunDay, config.hasMobility, config.hasHydration]);

    // Calculate normalized weights
    const normalizedWeights = useMemo(() => {
        return calculateNormalizedWeights(availableCategories);
    }, [availableCategories]);

    // Map category key to progress value
    const getProgressForCategory = useCallback((key: PointCategoryKey): number => {
        switch (key) {
            case 'WALK_RUN': return config.walkRunProgress;
            case 'STEPS': return config.stepsProgress;
            case 'CALORIES': return config.caloriesProgress;
            case 'MOBILITY': return config.mobilityProgress;
            case 'HYDRATION': return config.hydrationProgress;
            default: return 0;
        }
    }, [config]);

    // Build category objects
    const categories = useMemo((): PointCategory[] => {
        return PRIORITY_ORDER.map((key) => {
            const isAvailable = availableCategories.includes(key);
            const maxPoints = normalizedWeights[key];
            const ledgerEntry = ledgerEntries.find(e => e.category === key);
            const isAwarded = !!ledgerEntry;

            // If awarded, use ledger data; otherwise calculate from progress
            const progress = isAwarded ? ledgerEntry.progress : getProgressForCategory(key);
            const earnedPoints = isAwarded
                ? ledgerEntry.earnedPoints
                : Math.round(progress * maxPoints);

            return {
                key,
                label: CATEGORY_INFO[key].label,
                baseWeight: BASE_WEIGHTS[key],
                maxPoints,
                earnedPoints,
                progress,
                isAwarded,
                isAvailable,
                info: CATEGORY_INFO[key].info,
                claimable: !isAwarded && progress >= 1,
            };
        }).filter(cat => cat.isAvailable); // Only return available categories
    }, [availableCategories, normalizedWeights, ledgerEntries, getProgressForCategory]);

    // Calculate totals
    const totalMaxPoints = useMemo(() => {
        return categories.reduce((sum, cat) => sum + cat.maxPoints, 0);
    }, [categories]);

    const totalEarnedPoints = useMemo(() => {
        return categories.reduce((sum, cat) => sum + cat.earnedPoints, 0);
    }, [categories]);

    // Fetch existing ledger entries for the day
    const fetchLedger = useCallback(async () => {
        const requestScope = `${accessToken}:${dayKey}`;
        const version = ++ledgerVersion.current;
        if (!accessToken || !dayKey) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const response = await fetch(`${API_BASE_URL}/points/daily/${dayKey}`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });
            if (currentScope.current !== requestScope || version !== ledgerVersion.current) return;

            if (!response.ok) {
                // 404 means no points earned yet - not an error
                if (response.status === 404) {
                    setLedgerEntries([]);
                    return;
                }
                throw new Error('Failed to fetch daily points');
            }

            const data = await response.json();
            if (currentScope.current !== requestScope || version !== ledgerVersion.current) return;
            setLedgerEntries(data.entries || []);
        } catch (err) {
            console.error('[useDailyPoints] Error fetching ledger:', err);
            if (currentScope.current === requestScope && version === ledgerVersion.current) setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            if (currentScope.current === requestScope && version === ledgerVersion.current) {
                setLoading(false);
                setLoadedScope(requestScope);
            }
        }
    }, [accessToken, dayKey]);

    // Claim points for a category
    const claimPoints = useCallback(async (categoryKey: PointCategoryKey): Promise<boolean> => {
        if (!accessToken || !dayKey) return false;

        const category = categories.find(c => c.key === categoryKey);
        if (!category || category.isAwarded) {
            console.log(`[useDailyPoints] Category ${categoryKey} already awarded or not found`);
            return false;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/points/earn-daily`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    dayKey,
                    category: categoryKey,
                    earnedPoints: category.earnedPoints,
                    maxPoints: category.maxPoints,
                    progress: category.progress,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to claim points');
            }

            const data = await response.json();
            if (currentScope.current !== `${accessToken}:${dayKey}`) return false;
            ledgerVersion.current += 1;
            setLoading(false);
            setLoadedScope(`${accessToken}:${dayKey}`);
            // Reconcile existing awards too, so another mounted screen cannot keep retrying them.
            setLedgerEntries(prev => [
                    ...prev.filter(entry => entry.category !== categoryKey),
                    {
                        category: categoryKey,
                        earnedPoints: data.earnedPoints,
                        maxPoints: data.maxPoints,
                        progress: data.progress,
                    }
                ]);
            if (!data.alreadyAwarded) notifyDailyReward({ category: categoryKey, points: data.earnedPoints, dayKey });

            return true;
        } catch (err) {
            console.error('[useDailyPoints] Error claiming points:', err);
            return false;
        }
    }, [accessToken, dayKey, categories]);

    // Initial fetch
    useEffect(() => {
        fetchLedger();
    }, [fetchLedger]);

    useEffect(() => {
        if (!error || !accessToken || !dayKey) return;
        const retry = setTimeout(() => { void fetchLedger(); }, 15_000);
        return () => clearTimeout(retry);
    }, [error, accessToken, dayKey, fetchLedger]);

    return {
        categories,
        totalMaxPoints,
        totalEarnedPoints,
        loading: loading || (!!accessToken && !!dayKey && loadedScope !== scope),
        error,
        claimPoints,
        refetch: fetchLedger,
    };
}
