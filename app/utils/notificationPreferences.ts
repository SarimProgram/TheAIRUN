import AsyncStorage from '@react-native-async-storage/async-storage';

export type NotificationPreferences = {
  partnerChat: boolean;
  raceInvite: boolean;
  raceUpdates: boolean;
  scheduledRunReminder: boolean;
  partnerInviteAccepted: boolean;
  dailyPlanReminder: boolean;
  mealLoggingReminder: boolean;
  stepTargetReminder: boolean;
  weeklyQuestReminder: boolean;
  billingReminder: boolean;
};

export const NOTIFICATION_PREFERENCES_CACHE_KEY = 'notification_preferences_v1';

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  partnerChat: true,
  raceInvite: true,
  raceUpdates: true,
  scheduledRunReminder: true,
  partnerInviteAccepted: true,
  dailyPlanReminder: true,
  mealLoggingReminder: true,
  stepTargetReminder: true,
  weeklyQuestReminder: true,
  billingReminder: true,
};

export type NotificationPreferenceKey = keyof NotificationPreferences;

export function normalizeNotificationPreferences(raw: unknown): NotificationPreferences {
  const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};

  return {
    partnerChat: typeof input.partnerChat === 'boolean' ? input.partnerChat : DEFAULT_NOTIFICATION_PREFERENCES.partnerChat,
    raceInvite: typeof input.raceInvite === 'boolean' ? input.raceInvite : DEFAULT_NOTIFICATION_PREFERENCES.raceInvite,
    raceUpdates: typeof input.raceUpdates === 'boolean' ? input.raceUpdates : DEFAULT_NOTIFICATION_PREFERENCES.raceUpdates,
    scheduledRunReminder:
      typeof input.scheduledRunReminder === 'boolean'
        ? input.scheduledRunReminder
        : DEFAULT_NOTIFICATION_PREFERENCES.scheduledRunReminder,
    partnerInviteAccepted:
      typeof input.partnerInviteAccepted === 'boolean'
        ? input.partnerInviteAccepted
        : DEFAULT_NOTIFICATION_PREFERENCES.partnerInviteAccepted,
    dailyPlanReminder:
      typeof input.dailyPlanReminder === 'boolean'
        ? input.dailyPlanReminder
        : DEFAULT_NOTIFICATION_PREFERENCES.dailyPlanReminder,
    mealLoggingReminder:
      typeof input.mealLoggingReminder === 'boolean'
        ? input.mealLoggingReminder
        : DEFAULT_NOTIFICATION_PREFERENCES.mealLoggingReminder,
    stepTargetReminder:
      typeof input.stepTargetReminder === 'boolean'
        ? input.stepTargetReminder
        : DEFAULT_NOTIFICATION_PREFERENCES.stepTargetReminder,
    weeklyQuestReminder:
      typeof input.weeklyQuestReminder === 'boolean'
        ? input.weeklyQuestReminder
        : DEFAULT_NOTIFICATION_PREFERENCES.weeklyQuestReminder,
    billingReminder:
      typeof input.billingReminder === 'boolean'
        ? input.billingReminder
        : DEFAULT_NOTIFICATION_PREFERENCES.billingReminder,
  };
}

export async function loadCachedNotificationPreferences(): Promise<NotificationPreferences> {
  const rawValue = await AsyncStorage.getItem(NOTIFICATION_PREFERENCES_CACHE_KEY);
  if (!rawValue) {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }

  try {
    return normalizeNotificationPreferences(JSON.parse(rawValue));
  } catch {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
}

export async function cacheNotificationPreferences(preferences: NotificationPreferences): Promise<void> {
  await AsyncStorage.setItem(
    NOTIFICATION_PREFERENCES_CACHE_KEY,
    JSON.stringify(normalizeNotificationPreferences(preferences))
  );
}

export function hasRemoteNotificationsEnabled(preferences: NotificationPreferences): boolean {
  return (
    preferences.partnerChat ||
    preferences.raceInvite ||
    preferences.raceUpdates ||
    preferences.partnerInviteAccepted
  );
}

