import { useEffect, useRef } from 'react';

import { useAuth } from '@/src/auth/authContext';
import { hasRemoteNotificationsEnabled } from '@/utils/notificationPreferences';
import {
  loadNotificationSettings,
  syncRemotePushTokenForPreferences,
} from '@/utils/notificationRegistration';
import { ensureNotificationPermissionAsync } from '@/utils/pushNotifications';

export default function NotificationPermissionBootstrap() {
  const { authFetch, isAuthenticated } = useAuth();
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) {
      attemptedRef.current = false;
      return;
    }

    if (attemptedRef.current) {
      return;
    }

    attemptedRef.current = true;
    let active = true;

    loadNotificationSettings(authFetch, true)
      .then(async ({ permissionStatus, preferences }) => {
        if (!active || permissionStatus !== 'undetermined') {
          return;
        }

        const latestStatus = await ensureNotificationPermissionAsync();
        if (!active || latestStatus !== 'granted' || !hasRemoteNotificationsEnabled(preferences)) {
          return;
        }

        await syncRemotePushTokenForPreferences(authFetch, preferences, {
          promptForPermission: false,
        });
      })
      .catch((err) => {
        console.log('[NotificationPermissionBootstrap] failed', err);
      });

    return () => {
      active = false;
    };
  }, [authFetch, isAuthenticated]);

  return null;
}
