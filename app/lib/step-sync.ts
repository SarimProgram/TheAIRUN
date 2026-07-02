import { PermissionsAndroid, Platform } from 'react-native';
import Healthkit, {
  queryQuantitySamples,
  type QuantityTypeIdentifier,
} from '@kingstinct/react-native-healthkit';
import GoogleFit from 'react-native-google-fit';

import { API_BASE_URL } from '../config/api';
import { refreshPartnerSurfaceFromServer } from './partner-surface';

export const STEP_COUNT_ID: QuantityTypeIdentifier = 'HKQuantityTypeIdentifierStepCount';

export async function ensureAndroidActivityRecognitionPermission(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  if (Platform.Version < 29) {
    return;
  }

  const permission = PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION;
  const alreadyGranted = await PermissionsAndroid.check(permission);

  if (alreadyGranted) {
    return;
  }

  throw new Error('Activity recognition permission denied');
}

export function dayKeyLocal(d = new Date()): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getHealthKitSteps(): Promise<number> {
  const now = new Date();
  const startOfDay = startOfToday();

  const samples = await queryQuantitySamples(STEP_COUNT_ID, {
    limit: 0,
    ascending: false,
    filter: {
      date: {
        startDate: startOfDay,
        endDate: now,
      },
    },
  });

  const totalSteps = samples.reduce((sum, sample) => sum + (sample.quantity || 0), 0);
  return Math.max(0, Math.round(totalSteps));
}

export async function getGoogleFitSteps(): Promise<number> {
  await ensureAndroidActivityRecognitionPermission();

  if (!GoogleFit) {
    throw new Error('GoogleFit module is undefined');
  }

  if (typeof GoogleFit.authorize !== 'function') {
    throw new Error('GoogleFit.authorize is not a function');
  }

  await GoogleFit.checkIsAuthorized();
  if (!GoogleFit.isAuthorized) {
    throw new Error('Google Fit step access not authorized');
  }

  const startDate = startOfToday().toISOString();
  const endDate = new Date().toISOString();
  const res = await GoogleFit.getDailyStepCountSamples({
    startDate,
    endDate,
  });

  const source = res?.find((entry: any) => entry.source === 'com.google.android.gms:estimated_steps') ?? res?.[0];

  if (!source?.steps || source.steps.length === 0) {
    return 0;
  }

  const total = source.steps.reduce((sum: number, item: any) => sum + (item.value ?? 0), 0);
  return Math.max(0, Math.round(total));
}

export async function getHealthSteps(): Promise<number> {
  if (Platform.OS === 'ios') {
    if (__DEV__) {
      console.log('[StepSync] Healthkit module available:', !!Healthkit);
    }
    return getHealthKitSteps();
  }

  if (Platform.OS === 'android') {
    return getGoogleFitSteps();
  }

  return 0;
}

export async function fetchTodayStepsFromServer(
  accessToken: string,
  dayKey = dayKeyLocal(),
): Promise<number> {
  const res = await fetch(`${API_BASE_URL}/activity/steps/today?dayKey=${dayKey}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Server responded ${res.status}`);
  }

  const data = await res.json();
  return data.steps ?? 0;
}

export async function correctServerSteps(
  steps: number,
  dayKey: string,
  accessToken: string,
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/activity/steps/correct`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ steps, dayKey }),
  });

  if (!res.ok) {
    throw new Error(`Correct failed: ${res.status}`);
  }
}

export async function syncCurrentHealthStepsToBackend(accessToken: string): Promise<{
  changed: boolean;
  dayKey: string;
  healthSteps: number;
  serverSteps: number | null;
}> {
  const dayKey = dayKeyLocal();
  const healthSteps = await getHealthSteps();

  let serverSteps: number | null = null;
  try {
    serverSteps = await fetchTodayStepsFromServer(accessToken, dayKey);
  } catch {
    serverSteps = null;
  }

  if (serverSteps === healthSteps) {
    return {
      changed: false,
      dayKey,
      healthSteps,
      serverSteps,
    };
  }

  await correctServerSteps(healthSteps, dayKey, accessToken);
  await refreshPartnerSurfaceFromServer(accessToken).catch(() => {});

  return {
    changed: true,
    dayKey,
    healthSteps,
    serverSteps,
  };
}
