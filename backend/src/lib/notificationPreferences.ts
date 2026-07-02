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

export type RemoteNotificationPreferenceKey =
  | 'partnerChat'
  | 'raceInvite'
  | 'raceUpdates'
  | 'partnerInviteAccepted';

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

export function normalizeNotificationPreferences(raw: unknown): NotificationPreferences {
  const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};

  return {
    partnerChat:
      typeof input.partnerChat === 'boolean' ? input.partnerChat : DEFAULT_NOTIFICATION_PREFERENCES.partnerChat,
    raceInvite:
      typeof input.raceInvite === 'boolean' ? input.raceInvite : DEFAULT_NOTIFICATION_PREFERENCES.raceInvite,
    raceUpdates:
      typeof input.raceUpdates === 'boolean' ? input.raceUpdates : DEFAULT_NOTIFICATION_PREFERENCES.raceUpdates,
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

export function mergeNotificationPreferences(
  current: unknown,
  patch: Partial<NotificationPreferences>
): NotificationPreferences {
  return normalizeNotificationPreferences({
    ...normalizeNotificationPreferences(current),
    ...patch,
  });
}

export function isRemoteNotificationEnabled(
  raw: unknown,
  key: RemoteNotificationPreferenceKey
): boolean {
  return normalizeNotificationPreferences(raw)[key];
}

