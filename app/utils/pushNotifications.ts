import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';

function getPermissionStatus(permission: unknown): Notifications.PermissionStatus {
  const value = permission as { granted?: boolean; status?: string };
  if (value.granted === true || value.status === 'granted') {
    return Notifications.PermissionStatus.GRANTED;
  }
  if (value.status === 'denied') {
    return Notifications.PermissionStatus.DENIED;
  }
  return Notifications.PermissionStatus.UNDETERMINED;
}

export async function getPushPermissionStatus(): Promise<Notifications.PermissionStatus> {
  const permission = await Notifications.getPermissionsAsync();
  return getPermissionStatus(permission);
}

async function configureAndroidNotificationChannelsAsync() {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync('messages', {
    name: 'Messages',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF6B6B',
  });

  await Notifications.setNotificationChannelAsync('reminders', {
    name: 'Reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: '#FF6B6B',
  });
}

export async function ensureNotificationPermissionAsync(): Promise<Notifications.PermissionStatus> {
  const permission = await Notifications.getPermissionsAsync();
  let finalStatus = getPermissionStatus(permission);

  if (finalStatus !== Notifications.PermissionStatus.GRANTED) {
    const request = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    finalStatus = getPermissionStatus(request);
  }

  if (finalStatus === Notifications.PermissionStatus.GRANTED) {
    await configureAndroidNotificationChannelsAsync();
  }

  return finalStatus;
}

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

  if (!projectId) {
    throw new Error('Missing Expo projectId for push notifications');
  }

  const finalStatus = await ensureNotificationPermissionAsync();

  if (finalStatus !== Notifications.PermissionStatus.GRANTED) {
    return null;
  }

  await configureAndroidNotificationChannelsAsync();

  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  return token.data;
}

export async function getNativeDevicePushTokenAsync(): Promise<string | null> {
  if (Platform.OS !== 'ios') {
    return null;
  }

  try {
    const token = await Notifications.getDevicePushTokenAsync();
    const rawToken = typeof token.data === 'string' ? token.data : null;
    return rawToken || null;
  } catch {
    return null;
  }
}
