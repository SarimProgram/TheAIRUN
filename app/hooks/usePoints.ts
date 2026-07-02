// app/hooks/usePoints.ts
// Hook to fetch and manage user points for marketplace

import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../config/api';
import { parseApiError } from '../utils/premiumErrors';

interface UsePointsOptions {
    accessToken: string | null;
}

interface UsePointsReturn {
    balance: number;
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
    spend: (amount: number, item?: string) => Promise<boolean>;
    earn: (amount: number, reason?: string) => Promise<boolean>;
}

export function usePoints({ accessToken }: UsePointsOptions): UsePointsReturn {
    const [balance, setBalance] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchPoints = useCallback(async () => {
        if (!accessToken) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const response = await fetch(`${API_BASE_URL}/points`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw await parseApiError(response, 'Failed to fetch points');
            }

            const data = await response.json();
            setBalance(data.balance);
        } catch (err) {
            console.error('[usePoints] Error fetching points:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, [accessToken]);

    const spend = useCallback(async (amount: number, item?: string): Promise<boolean> => {
        if (!accessToken) return false;

        try {
            const response = await fetch(`${API_BASE_URL}/points/spend`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ amount, item }),
            });

            if (!response.ok) {
                throw await parseApiError(response, 'Failed to spend points');
            }

            const data = await response.json();
            setBalance(data.balance);
            return true;
        } catch (err) {
            console.error('[usePoints] Error spending points:', err);
            return false;
        }
    }, [accessToken]);

    const earn = useCallback(async (amount: number, reason?: string): Promise<boolean> => {
        if (!accessToken) return false;

        try {
            const response = await fetch(`${API_BASE_URL}/points/earn`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ amount, reason }),
            });

            if (!response.ok) {
                throw await parseApiError(response, 'Failed to earn points');
            }

            const data = await response.json();
            setBalance(data.balance);
            return true;
        } catch (err) {
            console.error('[usePoints] Error earning points:', err);
            return false;
        }
    }, [accessToken]);

    useEffect(() => {
        fetchPoints();
    }, [fetchPoints]);

    return {
        balance,
        loading,
        error,
        refetch: fetchPoints,
        spend,
        earn,
    };
}
