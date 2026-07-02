// app/hooks/usePartnerSummary.ts
// Hook to fetch partner's daily summary for TodayGoalHero

import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../config/api';

export interface PartnerSummaryData {
    id: string;
    name: string;
    goal: number;      // calorieTarget
    food: number;      // consumedCalories
    exercise: number;  // activeCalories
    steps: number;
    stepsTarget: number;
    waterMl: number;
    lastWaterUpdate: string | null;
}

interface UsePartnerSummaryOptions {
    accessToken: string | null;
}

interface UsePartnerSummaryReturn {
    partnerData: PartnerSummaryData | null;
    hasPartner: boolean;
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}

export function usePartnerSummary({ accessToken }: UsePartnerSummaryOptions): UsePartnerSummaryReturn {
    const [partnerData, setPartnerData] = useState<PartnerSummaryData | null>(null);
    const [hasPartner, setHasPartner] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchPartnerSummary = useCallback(async () => {
        if (!accessToken) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const response = await fetch(`${API_BASE_URL}/summary/partner`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch partner summary');
            }

            const data = await response.json();

            setHasPartner(data.hasPartner);
            if (data.hasPartner && data.partner) {
                setPartnerData(data.partner);
            } else {
                setPartnerData(null);
            }
        } catch (err) {
            console.error('[usePartnerSummary] Error:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
            setHasPartner(false);
            setPartnerData(null);
        } finally {
            setLoading(false);
        }
    }, [accessToken]);

    useEffect(() => {
        fetchPartnerSummary();
    }, [fetchPartnerSummary]);

    return {
        partnerData,
        hasPartner,
        loading,
        error,
        refetch: fetchPartnerSummary,
    };
}
