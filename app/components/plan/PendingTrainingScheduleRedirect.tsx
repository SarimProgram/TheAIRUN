import { useEffect } from 'react';
import { usePathname, useRouter } from 'expo-router';
import { useAuth } from '@/src/auth/authContext';
import { useEntitlement } from '@/src/billing';
import { API_BASE_URL } from '@/config/api';

/** Resume a new user's unfinished post-purchase setup after an app restart. */
export function PendingTrainingScheduleRedirect() {
  const { authFetch, isAuthenticated } = useAuth();
  const { hasAccess, loading } = useEntitlement();
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (!isAuthenticated || loading || !hasAccess || !['/', '/home', '/Plans', '/(tabs)', '/(tabs)/index'].includes(pathname)) return;
    let active = true;
    void authFetch(`${API_BASE_URL}/plan/training-schedule`).then(async response => {
      if (!response.ok) return;
      const { schedule } = await response.json();
      if (active && schedule && !schedule.customizationCompleted) router.replace('/customize-plan?entry=1');
    }).catch(() => {});
    return () => { active = false; };
  }, [authFetch, isAuthenticated, hasAccess, loading, pathname, router]);
  return null;
}
