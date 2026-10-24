import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL } from '@/config/api';
import { useAuth } from '@/src/auth/authContext';
import type { PaceProfile } from '@/lib/pace-personalization';

export function usePaceProfile(enabled = true) {
  const { authFetch, isAuthenticated } = useAuth();
  const [profile, setProfile] = useState<PaceProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled || !isAuthenticated) return null;
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch(`${API_BASE_URL}/profile/pace`);
      if (!response.ok) throw new Error('Pace could not be loaded');
      const data = await response.json();
      setProfile(data);
      return data as PaceProfile;
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Pace could not be loaded');
      return null;
    } finally {
      setLoading(false);
    }
  }, [authFetch, enabled, isAuthenticated]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { profile, setProfile, loading, error, refresh };
}
