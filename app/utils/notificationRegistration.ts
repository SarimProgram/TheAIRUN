import type { PermissionStatus } from 'expo-notifications';

import { API_BASE_URL } from '@/config/api';
import {
  ensureNotificationPermissionAsync,
  getPushPermissionStatus,
  registerForPushNotificationsAsync,
} from '@/utils/pushNotifications';
import {
  cacheNotificationPreferences,
  hasRemoteNotificationsEnabled,
  loadCachedNotificationPreferences,
  normalizeNotificationPreferences,
  type NotificationPreferences,
} from '@/utils/notificationPreferences';

type AuthFetch = (url: string, options?: RequestInit) => Promise<Response>;

export async function loadNotificationSettings(
  authFetch?: AuthFetch,
  isAuthenticated = false
): Promise<{
  permissionStatus: PermissionStatus;
  preferences: NotificationPreferences;
}> {
  const [cachedPreferences, permissionStatus] = await Promise.all([
    loadCachedNotificationPreferences(),
    getPushPermissionStatus(),
  ]);

  if (!isAuthenticated || !authFetch) {
    return {
      permissionStatus,
      preferences: cachedPreferences,
    };
  }

  try {
    const profileResponse = await authFetch(`${API_BASE_URL}/profile`);
    if (!profileResponse.ok) {
      return {
        permissionStatus,
        preferences: cachedPreferences,
      };
    }

    const profileJson = await profileResponse.json();
    const preferences = normalizeNotificationPreferences(profileJson?.user?.notificationPreferences);
    await cacheNotificationPreferences(preferences);

    return {
      permissionStatus,
      preferences,
    };
  } catch {
    return {
      permissionStatus,
      preferences: cachedPreferences,
    };
  }
}

export async function syncRemotePushTokenForPreferences(
  authFetch: AuthFetch,
  preferences: NotificationPreferences,
  options: {
    promptForPermission?: boolean;
  } = {}
): Promise<PermissionStatus> {
  if (!hasRemoteNotificationsEnabled(preferences)) {
    const response = await authFetch(`${API_BASE_URL}/profile/push-token`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Unable to disable notifications right now.');
    }

    return await getPushPermissionStatus();
  }

  const permissionStatus = options.promptForPermission
    ? await ensureNotificationPermissionAsync()
    : await getPushPermissionStatus();

  if (permissionStatus !== 'granted') {
    return permissionStatus;
  }

  const pushToken = await registerForPushNotificationsAsync();
  const latestPermissionStatus = await getPushPermissionStatus();

  if (!pushToken) {
    return latestPermissionStatus;
  }

  const response = await authFetch(`${API_BASE_URL}/profile/push-token`, {
    method: 'POST',
    body: JSON.stringify({ pushToken }),
  });

  if (!response.ok) {
    throw new Error('Unable to enable notifications right now.');
  }

  return latestPermissionStatus;
}
