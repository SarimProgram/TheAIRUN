import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { API_BASE_URL } from '@/config/api';

export type PartnerSurfaceStatus = 'connected' | 'no_partner' | 'stale';

export type PartnerLivePayload = {
  userName: string;
  userKcal: number;
  userGoal: number;
  userSteps: number;
  partnerName: string;
  partnerKcal: number;
  partnerGoal: number;
  partnerSteps: number;
  updatedAt: string;
  status?: PartnerSurfaceStatus;
  staleReason?: string | null;
};

type PartnerLiveResponse =
  | { hasPartner: true; payload: PartnerLivePayload }
  | { hasPartner: false; payload?: PartnerLivePayload | null };

const LAST_PARTNER_SURFACE_KEY = 'partner.surface.payload.v1';
const DEFAULT_USER_NAME = 'You';
const DEFAULT_PARTNER_NAME = 'Partner';
const LIVE_ACTIVITY_TYPE = 'partner_surface';
type PartnerKcalsWidgetSnapshot = {
  title: string;
  subtitle: string;
  primaryLine: string;
  secondaryLine: string;
  status: string;
  staleReason: string;
};
type PartnerKcalsWidgetController = {
  reload: () => void;
  updateSnapshot: (payload: PartnerKcalsWidgetSnapshot) => void;
};
type PartnerLiveActivityInstance = {
  addPushTokenListener: (listener: (event: { activityId?: string | null; pushToken?: string | null }) => void) => void;
  end: (dismissalPolicy: string, payload: PartnerLivePayload, staleDate: Date) => Promise<unknown>;
  getPushToken: () => Promise<string | null>;
  update: (payload: PartnerLivePayload) => Promise<unknown>;
};
type PartnerLiveActivityController = {
  getInstances: () => PartnerLiveActivityInstance[];
  start: (payload: PartnerLivePayload, url?: string) => PartnerLiveActivityInstance;
};
type ApplyPartnerSurfaceOptions = {
  accessToken?: string | null;
  replaceExisting?: boolean;
};

let partnerKcalsWidgetController: PartnerKcalsWidgetController | null | undefined;
let partnerLiveActivityController: PartnerLiveActivityController | null | undefined;

function getPartnerKcalsWidgetController(): PartnerKcalsWidgetController | null {
  if (partnerKcalsWidgetController !== undefined) {
    return partnerKcalsWidgetController;
  }

  if (Platform.OS !== 'ios') {
    partnerKcalsWidgetController = null;
    return partnerKcalsWidgetController;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@/widgets/PartnerKcalsWidget') as {
      PartnerKcalsWidget?: PartnerKcalsWidgetController;
      default?: PartnerKcalsWidgetController;
    };
    partnerKcalsWidgetController = mod.PartnerKcalsWidget ?? mod.default ?? null;
  } catch {
    partnerKcalsWidgetController = null;
  }

  return partnerKcalsWidgetController;
}

function getPartnerLiveActivityController(): PartnerLiveActivityController | null {
  if (partnerLiveActivityController !== undefined) {
    return partnerLiveActivityController;
  }

  if (Platform.OS !== 'ios') {
    partnerLiveActivityController = null;
    return partnerLiveActivityController;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@/widgets/PartnerLiveActivity') as {
      PartnerLiveActivity?: PartnerLiveActivityController;
      default?: PartnerLiveActivityController;
    };
    partnerLiveActivityController = mod.PartnerLiveActivity ?? mod.default ?? null;
  } catch {
    partnerLiveActivityController = null;
  }

  return partnerLiveActivityController;
}

function clampInt(value: number | null | undefined): number {
  return Math.max(0, Math.round(Number(value) || 0));
}

function shouldPreferCurrentValue(currentValue: number, nextValue: number): boolean {
  return currentValue > 0 && nextValue <= 0;
}

function formatUpdatedAt(updatedAt: string): string {
  const parsed = new Date(updatedAt);
  if (Number.isNaN(parsed.getTime())) {
    return 'Syncing';
  }

  return parsed.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatWidgetLine(name: string, kcal: number, goal: number, steps: number): string {
  const safeName = name.trim() || 'User';
  return `${safeName}: ${kcal}/${goal} kcal, ${steps} steps`;
}

export function buildPartnerLivePayload(
  payload: Partial<PartnerLivePayload> & {
    updatedAt?: string;
  },
): PartnerLivePayload {
  return {
    userName: payload.userName?.trim() || DEFAULT_USER_NAME,
    userKcal: clampInt(payload.userKcal),
    userGoal: clampInt(payload.userGoal),
    userSteps: clampInt(payload.userSteps),
    partnerName: payload.partnerName?.trim() || DEFAULT_PARTNER_NAME,
    partnerKcal: clampInt(payload.partnerKcal),
    partnerGoal: clampInt(payload.partnerGoal),
    partnerSteps: clampInt(payload.partnerSteps),
    updatedAt: payload.updatedAt || new Date().toISOString(),
    status: payload.status ?? 'connected',
    staleReason: payload.staleReason ?? null,
  };
}

function mergePartnerLivePayload(
  current: PartnerLivePayload | null,
  next: PartnerLivePayload,
): PartnerLivePayload {
  if (!current) {
    return next;
  }

  return {
    ...next,
    userKcal: shouldPreferCurrentValue(current.userKcal, next.userKcal) ? current.userKcal : next.userKcal,
    userGoal: shouldPreferCurrentValue(current.userGoal, next.userGoal) ? current.userGoal : next.userGoal,
    userSteps: shouldPreferCurrentValue(current.userSteps, next.userSteps) ? current.userSteps : next.userSteps,
    partnerKcal: shouldPreferCurrentValue(current.partnerKcal, next.partnerKcal) ? current.partnerKcal : next.partnerKcal,
    partnerGoal: shouldPreferCurrentValue(current.partnerGoal, next.partnerGoal) ? current.partnerGoal : next.partnerGoal,
    partnerSteps: shouldPreferCurrentValue(current.partnerSteps, next.partnerSteps) ? current.partnerSteps : next.partnerSteps,
    userName: next.userName?.trim() ? next.userName : current.userName,
    partnerName: next.partnerName?.trim() ? next.partnerName : current.partnerName,
    updatedAt: next.updatedAt || current.updatedAt,
    status: next.status ?? current.status,
    staleReason: next.staleReason ?? current.staleReason ?? null,
  };
}

function toWidgetSnapshot(payload: PartnerLivePayload): PartnerKcalsWidgetSnapshot {
  return {
    title: 'Partner Kcals',
    subtitle: `Updated ${formatUpdatedAt(payload.updatedAt)}`,
    primaryLine: formatWidgetLine(payload.userName, payload.userKcal, payload.userGoal, payload.userSteps),
    secondaryLine: formatWidgetLine(payload.partnerName, payload.partnerKcal, payload.partnerGoal, payload.partnerSteps),
    status: payload.status ?? 'connected',
    staleReason: payload.staleReason ?? '',
  };
}

async function cachePayload(payload: PartnerLivePayload) {
  try {
    await AsyncStorage.setItem(LAST_PARTNER_SURFACE_KEY, JSON.stringify(payload));
  } catch {}
}

async function syncLiveActivityToken(
  accessToken: string,
  pushToken: string,
  activityInstanceId?: string | null,
) {
  await fetch(`${API_BASE_URL}/profile/live-activity-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      activityType: LIVE_ACTIVITY_TYPE,
      pushToken,
      activityInstanceId: activityInstanceId ?? null,
    }),
  }).catch(() => {});
}

async function clearLiveActivityTokens(accessToken?: string | null) {
  if (!accessToken) {
    return;
  }

  await fetch(`${API_BASE_URL}/profile/live-activity-token`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  }).catch(() => {});
}

async function syncLiveActivityInstance(
  instance: PartnerLiveActivityInstance,
  payload: PartnerLivePayload,
  accessToken?: string | null,
  subscribeForFutureToken = false,
) {
  await instance.update(payload);

  if (!accessToken) {
    return;
  }

  const immediateToken = await instance.getPushToken().catch(() => null);
  if (immediateToken) {
    await syncLiveActivityToken(accessToken, immediateToken);
  }

  if (!subscribeForFutureToken) {
    return;
  }

  instance.addPushTokenListener((event) => {
    if (!event?.pushToken) {
      return;
    }

    void syncLiveActivityToken(accessToken, event.pushToken, event.activityId);
  });
}

async function upsertLiveActivity(
  payload: PartnerLivePayload,
  accessToken?: string | null,
) {
  const liveActivity = getPartnerLiveActivityController();
  if (!liveActivity) {
    return;
  }

  const instances = liveActivity.getInstances();

  if (payload.status !== 'connected') {
    await Promise.allSettled(
      instances.map((instance) => instance.end('immediate', payload, new Date(payload.updatedAt))),
    );
    await clearLiveActivityTokens(accessToken);
    return;
  }

  if (instances.length === 0) {
    const started = liveActivity.start(payload, 'app://kcals');
    await syncLiveActivityInstance(started, payload, accessToken, true);
    return;
  }

  await Promise.allSettled(
    instances.map((instance) => syncLiveActivityInstance(instance, payload, accessToken)),
  );
}

export async function applyPartnerSurfacePayload(
  payload: PartnerLivePayload,
  options?: ApplyPartnerSurfaceOptions,
) {
  const current = await loadCachedPartnerSurface();
  const normalized = options?.replaceExisting
    ? buildPartnerLivePayload(payload)
    : mergePartnerLivePayload(current, buildPartnerLivePayload(payload));
  const widget = getPartnerKcalsWidgetController();
  const widgetSnapshot = toWidgetSnapshot(normalized);

  try {
    widget?.updateSnapshot(widgetSnapshot);
    widget?.reload();
  } catch (error) {
    console.warn('[PartnerSurface] Failed to update widget snapshot:', error);
  }
  await cachePayload(normalized);
  await upsertLiveActivity(normalized, options?.accessToken);
}

export async function clearPartnerSurface(accessToken?: string | null) {
  const payload = buildPartnerLivePayload({
    userName: DEFAULT_USER_NAME,
    partnerName: DEFAULT_PARTNER_NAME,
    updatedAt: new Date().toISOString(),
    status: 'no_partner',
    staleReason: 'not_authenticated',
  });

  await applyPartnerSurfacePayload(payload, { accessToken, replaceExisting: true });
}

export async function fetchPartnerSurfacePayload(
  accessToken: string,
): Promise<PartnerLivePayload | null> {
  const response = await fetch(`${API_BASE_URL}/summary/partner-live`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Partner live fetch failed: ${response.status}`);
  }

  const data = (await response.json()) as PartnerLiveResponse;

  if (!data?.hasPartner) {
    return buildPartnerLivePayload({
      userName: DEFAULT_USER_NAME,
      partnerName: DEFAULT_PARTNER_NAME,
      updatedAt: new Date().toISOString(),
      status: 'no_partner',
      staleReason: 'no_partner',
    });
  }

  return buildPartnerLivePayload(data.payload);
}

export async function refreshPartnerSurfaceFromServer(
  accessToken?: string | null,
): Promise<PartnerLivePayload | null> {
  if (!accessToken) {
    return null;
  }

  const payload = await fetchPartnerSurfacePayload(accessToken);
  if (!payload) {
    return null;
  }

  await applyPartnerSurfacePayload(payload, { accessToken });
  return payload;
}

export async function loadCachedPartnerSurface(): Promise<PartnerLivePayload | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_PARTNER_SURFACE_KEY);
    if (!raw) {
      return null;
    }
    return buildPartnerLivePayload(JSON.parse(raw));
  } catch {
    return null;
  }
}
