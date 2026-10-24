import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL } from '@/config/api';
import { useAuth } from '@/src/auth/authContext';
import { isWalkingGoalPlan } from '@/utils/planProjection';

export function useWalkingGoalPlan(refreshKey?: string) {
  const { authFetch, isAuthenticated } = useAuth();
  const [isWalkOnly, setIsWalkOnly] = useState(false);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setIsWalkOnly(false);
      return;
    }

    try {
      const response = await authFetch(`${API_BASE_URL}/plan`);
      if (!response.ok) return;

      const data = await response.json();
      setIsWalkOnly(isWalkingGoalPlan(data?.plan));
    } catch {
      // Keep the last known label if the plan fetch fails.
    }
  }, [authFetch, isAuthenticated]);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  return isWalkOnly;
}
