import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';

import { hasStepPermissionConsent } from '@/config/healthPermissions';
import { refreshPartnerSurfaceFromServer } from '@/lib/partner-surface';
import { syncCurrentHealthStepsToBackend } from '@/lib/step-sync';
import { getAccessToken } from '@/utils/authstorage';

export const BACKGROUND_PARTNER_SURFACE_NOTIFICATION_TASK =
  'background-partner-surface-notification';

let backgroundNotificationTaskDefined = false;

function getNotificationData(
  payload: Notifications.NotificationTaskPayload,
): Record<string, unknown> | null {
  if ('actionIdentifier' in payload) {
    const contentData = payload.notification.request.content.data as
      | Record<string, unknown>
      | undefined;
    return contentData ?? null;
  }

  if (payload.data && typeof payload.data === 'object') {
    if (typeof payload.data.dataString === 'string') {
      try {
        const parsed = JSON.parse(payload.data.dataString);
        if (parsed && typeof parsed === 'object') {
          return parsed as Record<string, unknown>;
        }
      } catch {
        // Fall back to the raw data object below.
      }
    }

    return payload.data as Record<string, unknown>;
  }

  return null;
}

function getNotificationType(data: Record<string, unknown> | null): string | null {
  return typeof data?.type === 'string' ? data.type : null;
}

function shouldRefreshPartnerSurface(type: string | null): boolean {
  return type === 'partner_live_state_changed' || type === 'partner_invite_accepted';
}

function shouldSyncSteps(type: string | null): boolean {
  return type === 'steps_refresh_request';
}

async function handleStepsRefreshRequest(
  accessToken: string,
): Promise<Notifications.BackgroundNotificationTaskResult> {
  try {
    const hasConsent = await hasStepPermissionConsent();
    if (!hasConsent) {
      return Notifications.BackgroundNotificationTaskResult.NoData;
    }

    const result = await syncCurrentHealthStepsToBackend(accessToken);
    return result.changed
      ? Notifications.BackgroundNotificationTaskResult.NewData
      : Notifications.BackgroundNotificationTaskResult.NoData;
  } catch (error) {
    console.error('[BackgroundNotificationTask] Steps sync failed:', error);
    return Notifications.BackgroundNotificationTaskResult.Failed;
  }
}

async function backgroundPartnerSurfaceNotificationHandler({
  data,
}: {
  data: Notifications.NotificationTaskPayload;
}): Promise<Notifications.BackgroundNotificationTaskResult> {
  try {
    const notificationData = getNotificationData(data);
    const type = getNotificationType(notificationData);

    const accessToken = await getAccessToken();
    if (!accessToken) {
      return Notifications.BackgroundNotificationTaskResult.NoData;
    }

    if (shouldSyncSteps(type)) {
      return handleStepsRefreshRequest(accessToken);
    }

    if (shouldRefreshPartnerSurface(type)) {
      await refreshPartnerSurfaceFromServer(accessToken);
      return Notifications.BackgroundNotificationTaskResult.NewData;
    }

    return Notifications.BackgroundNotificationTaskResult.NoData;
  } catch (error) {
    console.error('[PartnerSurfaceNotificationTask] Failed:', error);
    return Notifications.BackgroundNotificationTaskResult.Failed;
  }
}

function ensureBackgroundNotificationTaskDefined(): void {
  if (
    backgroundNotificationTaskDefined ||
    TaskManager.isTaskDefined(BACKGROUND_PARTNER_SURFACE_NOTIFICATION_TASK)
  ) {
    backgroundNotificationTaskDefined = true;
    return;
  }

  TaskManager.defineTask<Notifications.NotificationTaskPayload>(
    BACKGROUND_PARTNER_SURFACE_NOTIFICATION_TASK,
    backgroundPartnerSurfaceNotificationHandler,
  );
  backgroundNotificationTaskDefined = true;
}

ensureBackgroundNotificationTaskDefined();

export async function registerBackgroundPartnerSurfaceNotificationTask(): Promise<void> {
  try {
    ensureBackgroundNotificationTaskDefined();
    const isRegistered = await TaskManager.isTaskRegisteredAsync(
      BACKGROUND_PARTNER_SURFACE_NOTIFICATION_TASK,
    );
    if (isRegistered) {
      return;
    }
    await Notifications.registerTaskAsync(
      BACKGROUND_PARTNER_SURFACE_NOTIFICATION_TASK,
    );
  } catch (error) {
    console.error(
      '[PartnerSurfaceNotificationTask] Failed to register background notification task:',
      error,
    );
  }
}
