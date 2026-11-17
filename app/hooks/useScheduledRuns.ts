import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/src/auth/authContext';
import { API_BASE_URL } from '@/config/api';

export type ScheduledRun = {
  id: string;
  partnerName: string;
  scheduledTime: string;
  distanceKm: number;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  isSender: boolean;
};

export function useScheduledRuns() {
  const { authFetch, user } = useAuth();
  const [scheduledRuns, setScheduledRuns] = useState<{ sent: ScheduledRun[]; received: ScheduledRun[] }>({ sent: [], received: [] });
  const fetchScheduledRuns = useCallback(async (isCurrent: () => boolean = () => true) => {
    try {
      const response = await authFetch(`${API_BASE_URL}/runtogether/active`);
      if (response.ok) {
        const data = await response.json();
        if (isCurrent()) setScheduledRuns(data);
      }
    } catch (error) {
      console.error('Failed to fetch scheduled runs:', error);
    }
  }, [authFetch]);

  useFocusEffect(useCallback(() => {
    let current = true;
    setScheduledRuns({ sent: [], received: [] });
    if (!user?.id) return;
    void fetchScheduledRuns(() => current);
    const interval = setInterval(() => { void fetchScheduledRuns(() => current); }, 30000);
    return () => { current = false; clearInterval(interval); };
  }, [fetchScheduledRuns, user?.id]));

  return { scheduledRuns, fetchScheduledRuns };
}
