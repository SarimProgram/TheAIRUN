import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL } from '../config/api';

export type WeightHistoryPoint = {
  id?: string;
  weightKg: number;
  loggedAt: string;
};

type AuthFetch = (url: string, options?: RequestInit) => Promise<Response>;

const weightUpdateListeners = new Set<() => void>();

export function notifyWeightUpdated() {
  weightUpdateListeners.forEach((listener) => listener());
}

function subscribeWeightUpdates(listener: () => void) {
  weightUpdateListeners.add(listener);
  return () => {
    weightUpdateListeners.delete(listener);
  };
}

type UseWeightLogOptions = {
  authFetch: AuthFetch;
  isAuthenticated: boolean;
};

export function useWeightLog({ authFetch, isAuthenticated }: UseWeightLogOptions) {
  const [currentWeightKg, setCurrentWeightKg] = useState<number | null>(null);
  const [weightHistory, setWeightHistory] = useState<WeightHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [logging, setLogging] = useState(false);

  const refetch = useCallback(async () => {
    if (!isAuthenticated) {
      setCurrentWeightKg(null);
      setWeightHistory([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await authFetch(`${API_BASE_URL}/weight`);
      if (!response.ok) {
        throw new Error(`Failed to fetch weight: ${response.status}`);
      }

      const json = await response.json();
      setCurrentWeightKg(
        typeof json?.currentWeight === 'number' && Number.isFinite(json.currentWeight)
          ? json.currentWeight
          : null,
      );
      setWeightHistory(Array.isArray(json?.history) ? json.history : []);
    } catch (error) {
      console.error('[useWeightLog] fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, [authFetch, isAuthenticated]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => subscribeWeightUpdates(refetch), [refetch]);

  const logWeight = useCallback(
    async (weightKg: number) => {
      if (!isAuthenticated || !Number.isFinite(weightKg) || weightKg <= 0) {
        throw new Error('Invalid weight');
      }

      setLogging(true);
      try {
        const response = await authFetch(`${API_BASE_URL}/weight`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ weightKg }),
        });

        if (!response.ok) {
          throw new Error(`Failed to log weight: ${response.status}`);
        }

        const json = await response.json();
        if (typeof json?.currentWeight === 'number' && Number.isFinite(json.currentWeight)) {
          setCurrentWeightKg(json.currentWeight);
        }

        notifyWeightUpdated();
        await refetch();
        return json;
      } finally {
        setLogging(false);
      }
    },
    [authFetch, isAuthenticated, refetch],
  );

  return {
    currentWeightKg,
    weightHistory,
    loading,
    logging,
    refetch,
    logWeight,
  };
}
