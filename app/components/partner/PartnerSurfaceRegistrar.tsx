import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';

import { clearPartnerSurface, refreshPartnerSurfaceFromServer } from '@/lib/partner-surface';
import { useAuth } from '@/src/auth/authContext';

function shouldRefreshPartnerSurface(data: Record<string, unknown> | undefined) {
  const type = typeof data?.type === 'string' ? data.type : null;
  return type === 'partner_live_state_changed' || type === 'partner_invite_accepted';
}

export default function PartnerSurfaceRegistrar() {
  const { accessToken, isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!isAuthenticated) {
      clearPartnerSurface().catch(() => {});
      return;
    }

    if (!accessToken) {
      return;
    }

    refreshPartnerSurfaceFromServer(accessToken).catch(() => {});
  }, [accessToken, isAuthenticated, loading]);

  useEffect(() => {
    const appStateSubscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active' && accessToken) {
        refreshPartnerSurfaceFromServer(accessToken).catch(() => {});
      }
    });

    const notificationSubscription = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as Record<string, unknown> | undefined;
      if (accessToken && shouldRefreshPartnerSurface(data)) {
        refreshPartnerSurfaceFromServer(accessToken).catch(() => {});
      }
    });

    return () => {
      appStateSubscription.remove();
      notificationSubscription.remove();
    };
  }, [accessToken]);

  return null;
}
