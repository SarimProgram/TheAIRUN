import { useCallback, useEffect, useRef } from 'react';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { AppState } from 'react-native';

import { API_BASE_URL } from '@/config/api';
import { useRaceSocketContext } from '@/contexts/RaceSocketContext';
import { useAuth } from '@/src/auth/authContext';
import {
  getNativeDevicePushTokenAsync,
  getPushPermissionStatus,
  registerForPushNotificationsAsync,
} from '@/utils/pushNotifications';
import { refreshPartnerSurfaceFromServer } from '@/lib/partner-surface';
import { registerBackgroundPartnerSurfaceNotificationTask } from '@/tasks/backgroundPartnerSurfaceNotification';
import {
  cacheNotificationPreferences,
  hasRemoteNotificationsEnabled,
  loadCachedNotificationPreferences,
  normalizeNotificationPreferences,
} from '@/utils/notificationPreferences';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function PushNotificationRegistrar() {
  const { isAuthenticated, accessToken, authFetch } = useAuth();
  const { hydrateInvite } = useRaceSocketContext();
  const lastRegisteredTokenRef = useRef<string | null>(null);
  const lastRegisteredDeviceTokenRef = useRef<string | null>(null);
  const lastHandledNotificationIdRef = useRef<string | null>(null);

  const hydrateRaceInviteFromNotification = useCallback((notification: Notifications.Notification) => {
    const data = notification.request.content.data as Record<string, unknown>;
    if (data?.type !== 'race_invite') {
      return false;
    }

    const fromUserId = typeof data.fromUserId === 'string' ? data.fromUserId : '';
    const fromName = typeof data.fromName === 'string' ? data.fromName : '';
    const rawDistance = data.distance;
    const distance =
      typeof rawDistance === 'number'
        ? rawDistance
        : typeof rawDistance === 'string'
          ? Number(rawDistance)
          : NaN;

    if (!fromUserId || !fromName || !Number.isFinite(distance) || distance <= 0) {
      return false;
    }

    hydrateInvite({
      fromUserId,
      fromName,
      distance,
    });

    return true;
  }, [hydrateInvite]);

  useEffect(() => {
    registerBackgroundPartnerSurfaceNotificationTask().catch(() => {});
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      lastRegisteredTokenRef.current = null;
      lastRegisteredDeviceTokenRef.current = null;
      return;
    }

    let active = true;

    const syncPushRegistration = () => {
      loadCachedNotificationPreferences()
        .then(async (preferences) => {
          if (!active) return;

          const profileResponse = await authFetch(`${API_BASE_URL}/profile`);
          if (!active) return;

          if (profileResponse.ok) {
            const profileJson = await profileResponse.json();
            preferences = normalizeNotificationPreferences(profileJson?.user?.notificationPreferences);
            await cacheNotificationPreferences(preferences);
          }

          if (!hasRemoteNotificationsEnabled(preferences)) {
            lastRegisteredTokenRef.current = null;
            const response = await authFetch(`${API_BASE_URL}/profile/push-token`, {
              method: 'DELETE',
            });

            if (!response.ok) {
              const errorText = await response.text();
              console.log('[PushNotificationRegistrar] Push disable sync failed', {
                status: response.status,
                body: errorText,
              });
            }
          }

          const registeredDeviceToken = await getNativeDevicePushTokenAsync();
          if (!active) {
            return;
          }

          if (!active || !registeredDeviceToken || registeredDeviceToken === lastRegisteredDeviceTokenRef.current) {
            if (!hasRemoteNotificationsEnabled(preferences)) {
              return;
            }
          } else {
            const deviceResponse = await authFetch(`${API_BASE_URL}/profile/device-push-token`, {
              method: 'POST',
              body: JSON.stringify({ devicePushToken: registeredDeviceToken }),
            });

            if (deviceResponse.ok) {
              lastRegisteredDeviceTokenRef.current = registeredDeviceToken;
            } else {
              const deviceErrorText = await deviceResponse.text();
              console.log('[PushNotificationRegistrar] Device push token sync failed', {
                status: deviceResponse.status,
                body: deviceErrorText,
              });
            }
          }

          if (!hasRemoteNotificationsEnabled(preferences)) {
            return;
          }

          const permissionStatus = await getPushPermissionStatus();
          if (permissionStatus !== 'granted') {
            return;
          }

          const registeredPushToken = await registerForPushNotificationsAsync();
          if (active && registeredPushToken && registeredPushToken !== lastRegisteredTokenRef.current) {
            const response = await authFetch(`${API_BASE_URL}/profile/push-token`, {
              method: 'POST',
              body: JSON.stringify({ pushToken: registeredPushToken }),
            });

            if (response.ok) {
              lastRegisteredTokenRef.current = registeredPushToken;
              console.log('[PushNotificationRegistrar] Push token synced to backend');
            } else {
              const errorText = await response.text();
              console.log('[PushNotificationRegistrar] Push token sync failed', {
                status: response.status,
                body: errorText,
              });
            }
          } else if (!registeredPushToken) {
            console.log('[PushNotificationRegistrar] No push token to sync');
          }
        })
        .catch((err) => {
          console.log('[PushNotificationRegistrar] registration failed', err);
        });
    };

    syncPushRegistration();

    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        syncPushRegistration();
      }
    });

    return () => {
      active = false;
      appStateSubscription.remove();
    };
  }, [authFetch, isAuthenticated]);

  useEffect(() => {
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!response) {
          return;
        }

        const identifier = response.notification.request.identifier;
        if (lastHandledNotificationIdRef.current === identifier) {
          return;
        }

        if (hydrateRaceInviteFromNotification(response.notification)) {
          lastHandledNotificationIdRef.current = identifier;
        }
      })
      .catch(() => {});

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      lastHandledNotificationIdRef.current = response.notification.request.identifier;
      hydrateRaceInviteFromNotification(response.notification);

      const data = response.notification.request.content.data as Record<string, unknown>;
      if (data?.type === 'chat_message' || data?.openChat === '1') {
        router.push({
          pathname: '/(tabs)',
          params: {
            openChat: '1',
            chatJump: String(Date.now()),
          },
        });
        return;
      }

      if (data?.type === 'race_invite' || data?.type === 'race_update' || data?.type === 'scheduled_run_reminder') {
        router.push('/(tabs)/Race');
        return;
      }

      if (data?.type === 'partner_invite_accepted') {
        if (accessToken) {
          refreshPartnerSurfaceFromServer(accessToken).catch(() => {});
        }
        router.push('/(tabs)/Partner');
        return;
      }

      if (data?.type === 'partner_live_state_changed') {
        if (accessToken) {
          refreshPartnerSurfaceFromServer(accessToken).catch(() => {});
        }
        return;
      }

      if (data?.type === 'daily_plan_reminder') {
        router.push('/(tabs)/Plans');
        return;
      }

      if (data?.type === 'meal_logging_reminder') {
        router.push('/(tabs)/activity');
        return;
      }

      if (data?.type === 'step_target_reminder') {
        router.push('/(tabs)');
        return;
      }

      if (data?.type === 'weekly_quest_reminder') {
        router.push('/(tabs)/quest');
        return;
      }

      if (data?.type === 'billing_reminder') {
        router.push('/(tabs)/Login');
      }
    });

    return () => {
      subscription.remove();
    };
  }, [accessToken, hydrateRaceInviteFromNotification]);

  return null;
}
