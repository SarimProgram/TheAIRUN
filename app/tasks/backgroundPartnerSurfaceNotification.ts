import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';

import { refreshPartnerSurfaceFromServer } from '@/lib/partner-surface';
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

function shouldRefreshPartnerSurface(data: Record<string, unknown> | null): boolean {
  const type = typeof data?.type === 'string' ? data.type : null;
  return type === 'partner_live_state_changed' || type === 'partner_invite_accepted';
}

async function backgroundPartnerSurfaceNotificationHandler({
  data,
}: {
  data: Notifications.NotificationTaskPayload;
}): Promise<Notifications.BackgroundNotificationTaskResult> {
  try {
    const notificationData = getNotificationData(data);
    if (!shouldRefreshPartnerSurface(notificationData)) {
      return Notifications.BackgroundNotificationTaskResult.NoData;
    }

    const accessToken = await getAccessToken();
    if (!accessToken) {
      return Notifications.BackgroundNotificationTaskResult.NoData;
    }

    await refreshPartnerSurfaceFromServer(accessToken);
    return Notifications.BackgroundNotificationTaskResult.NewData;
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
