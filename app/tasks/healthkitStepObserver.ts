import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { hasStepPermissionConsent } from '../config/healthPermissions';
import { STEP_COUNT_ID, syncCurrentHealthStepsToBackend } from '../lib/step-sync';
import { getAccessToken } from '../utils/authstorage';

const STEP_ANCHOR_KEY = 'steps.healthkit.anchor.v1';

let observerRegistered = false;
let observerSubscription: { remove: () => void } | null = null;
let observerSyncInFlight: Promise<void> | null = null;
type HealthKitModule = typeof import('@kingstinct/react-native-healthkit');
let healthKitModuleCache: HealthKitModule | null | undefined;

function getHealthKitModule(): HealthKitModule | null {
  if (healthKitModuleCache !== undefined) {
    return healthKitModuleCache;
  }

  if (Platform.OS !== 'ios') {
    healthKitModuleCache = null;
    return healthKitModuleCache;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    healthKitModuleCache = require('@kingstinct/react-native-healthkit') as HealthKitModule;
  } catch {
    healthKitModuleCache = null;
  }

  return healthKitModuleCache;
}

async function advanceStepAnchor(): Promise<boolean> {
  const healthKit = getHealthKitModule();
  if (!healthKit) {
    return false;
  }

  const anchor = await AsyncStorage.getItem(STEP_ANCHOR_KEY);
  const result = await healthKit.queryQuantitySamplesWithAnchor(STEP_COUNT_ID, {
    limit: 0,
    ...(anchor ? { anchor } : {}),
  });

  if (result.newAnchor) {
    await AsyncStorage.setItem(STEP_ANCHOR_KEY, result.newAnchor);
  }

  return result.samples.length > 0 || result.deletedSamples.length > 0;
}

async function syncFromHealthObserver(): Promise<void> {
  if (observerSyncInFlight) {
    return observerSyncInFlight;
  }

  observerSyncInFlight = (async () => {
    const hasConsent = await hasStepPermissionConsent();
    if (!hasConsent) {
      return;
    }

    const accessToken = await getAccessToken();
    if (!accessToken) {
      return;
    }

    const changed = await advanceStepAnchor();
    if (!changed) {
      return;
    }

    await syncCurrentHealthStepsToBackend(accessToken);
  })().finally(() => {
    observerSyncInFlight = null;
  });

  return observerSyncInFlight;
}

export async function registerIOSHealthKitStepObserver(): Promise<void> {
  if (Platform.OS !== 'ios' || observerRegistered) {
    return;
  }

  const healthKit = getHealthKitModule();
  if (!healthKit) {
    return;
  }

  try {
    const hasConsent = await hasStepPermissionConsent();
    if (!hasConsent) {
      return;
    }

    await healthKit.enableBackgroundDelivery(STEP_COUNT_ID, healthKit.UpdateFrequency.immediate);

    observerSubscription = healthKit.subscribeToChanges(STEP_COUNT_ID, ({ errorMessage }) => {
      if (errorMessage) {
        console.error('[HealthKitObserver] Error:', errorMessage);
        return;
      }

      void syncFromHealthObserver();
    });

    observerRegistered = true;
    void syncFromHealthObserver();
  } catch (error) {
    console.error('[HealthKitObserver] Failed to register:', error);
  }
}

export function unregisterIOSHealthKitStepObserver(): void {
  observerSubscription?.remove();
  observerSubscription = null;
  observerRegistered = false;
}
