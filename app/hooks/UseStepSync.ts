// app/hooks/useStepSync.ts
// Simplified step sync: Health → Backend (source of truth) + Pedometer for UI

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { Pedometer } from 'expo-sensors';
import { hasStepPermissionConsent } from '../config/healthPermissions';
import {
  correctServerSteps,
  dayKeyLocal,
  ensureAndroidActivityRecognitionPermission,
  getHealthSteps,
} from '../lib/step-sync';
import { refreshPartnerSurfaceFromServer } from '../lib/partner-surface';

type UseStepSyncOptions = {
  accessToken?: string | null;
  permissionEnabledOverride?: boolean;
};

const SYNC_INTERVAL_MS = 30_000; // Sync to backend every 30s
const PENDING_PEDOMETER_WINDOW_MS = 10 * 60_000;

// ============ Main Hook ============

export function useStepSync({ accessToken, permissionEnabledOverride }: UseStepSyncOptions) {
  const [healthSteps, setHealthSteps] = useState(0);
  // confirmedHealthSteps = last health total accepted by the local UI reconciler
  const [confirmedHealthSteps, setConfirmedHealthSteps] = useState(0);
  // baseSteps = from backend (source of truth for synced data)
  const [baseSteps, setBaseSteps] = useState(0);
  // pendingPedometerDelta = UI-only optimistic steps waiting for health to catch up
  const [pendingPedometerDelta, setPendingPedometerDelta] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionEnabled, setPermissionEnabled] = useState(false);

  // Refs
  const subscriptionRef = useRef<any>(null);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingExpiryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeDayKeyRef = useRef(dayKeyLocal());
  const confirmedHealthStepsRef = useRef(0);
  const pedometerFloorRef = useRef<number | null>(null);
  const latestPedometerStepsRef = useRef<number | null>(null);
  const lastPedometerStepAtRef = useRef<number | null>(null);

  // UI is local/offline-first: health is authoritative, pedometer is a temporary UI overlay.
  const steps = confirmedHealthSteps + pendingPedometerDelta;

  const clearPendingExpiryTimeout = useCallback(() => {
    if (pendingExpiryTimeoutRef.current) {
      clearTimeout(pendingExpiryTimeoutRef.current);
      pendingExpiryTimeoutRef.current = null;
    }
  }, []);

  const applyPendingPedometerDelta = useCallback(() => {
    const latest = latestPedometerStepsRef.current;
    const floor = pedometerFloorRef.current;
    const lastStepAt = lastPedometerStepAtRef.current;

    const withinWindow = typeof lastStepAt === 'number'
      && (Date.now() - lastStepAt) <= PENDING_PEDOMETER_WINDOW_MS;
    if (!withinWindow && latest !== null) {
      // Expired optimistic steps are dropped permanently from the UI shadow.
      pedometerFloorRef.current = latest;
    }
    const nextPendingDelta = withinWindow && latest !== null && floor !== null
      ? Math.max(0, latest - floor)
      : 0;

    setPendingPedometerDelta(nextPendingDelta);
    return nextPendingDelta;
  }, []);

  const schedulePendingExpiry = useCallback(() => {
    clearPendingExpiryTimeout();

    const lastStepAt = lastPedometerStepAtRef.current;
    if (typeof lastStepAt !== 'number') {
      return;
    }

    const remainingMs = (lastStepAt + PENDING_PEDOMETER_WINDOW_MS) - Date.now();
    if (remainingMs <= 0) {
      applyPendingPedometerDelta();
      return;
    }

    pendingExpiryTimeoutRef.current = setTimeout(() => {
      applyPendingPedometerDelta();
    }, remainingMs + 50);
  }, [applyPendingPedometerDelta, clearPendingExpiryTimeout]);

  const resetPendingUiState = useCallback((sensorSteps: number | null = null) => {
    latestPedometerStepsRef.current = sensorSteps;
    pedometerFloorRef.current = sensorSteps;
    lastPedometerStepAtRef.current = null;
    setPendingPedometerDelta(0);
    clearPendingExpiryTimeout();
  }, [clearPendingExpiryTimeout]);

  const resetForNewDay = useCallback((nextDayKey: string, nextHealthSteps = 0) => {
    activeDayKeyRef.current = nextDayKey;
    confirmedHealthStepsRef.current = nextHealthSteps;
    setHealthSteps(nextHealthSteps);
    setConfirmedHealthSteps(nextHealthSteps);
    resetPendingUiState();
  }, [resetPendingUiState]);

  const reconcileHealthSteps = useCallback((nextHealthSteps: number) => {
    const nextDayKey = dayKeyLocal();
    if (nextDayKey !== activeDayKeyRef.current) {
      resetForNewDay(nextDayKey, nextHealthSteps);
      return nextHealthSteps;
    }

    setHealthSteps(nextHealthSteps);

    const prevConfirmed = confirmedHealthStepsRef.current;
    const currentPending = applyPendingPedometerDelta();
    const optimisticUiTotal = prevConfirmed + currentPending;

    // Health caught up fully. Confirm everything and clear the UI-only shadow.
    if (nextHealthSteps >= optimisticUiTotal) {
      confirmedHealthStepsRef.current = nextHealthSteps;
      setConfirmedHealthSteps(nextHealthSteps);
      resetPendingUiState(latestPedometerStepsRef.current);
      return nextHealthSteps;
    }

    // Health progressed, but not enough to fully confirm the pedometer shadow yet.
    if (nextHealthSteps > prevConfirmed) {
      const confirmedPortion = nextHealthSteps - prevConfirmed;
      confirmedHealthStepsRef.current = nextHealthSteps;
      setConfirmedHealthSteps(nextHealthSteps);

      if (pedometerFloorRef.current !== null) {
        const latest = latestPedometerStepsRef.current ?? pedometerFloorRef.current;
        pedometerFloorRef.current = Math.min(latest, pedometerFloorRef.current + confirmedPortion);
      }

      applyPendingPedometerDelta();
      schedulePendingExpiry();
      return nextHealthSteps;
    }

    // Health reads can lag by minutes. Keep the local shadow delta instead of snapping backwards.
    schedulePendingExpiry();
    return prevConfirmed;
  }, [applyPendingPedometerDelta, resetForNewDay, resetPendingUiState, schedulePendingExpiry]);

  /**
   * Fetch steps directly from Health API (no backend needed)
   */
  const fetchHealthSteps = useCallback(async () => {
    // Check for Expo Go
    // We can infer Expo Go if Constants.appOwnership is 'expo' or similar, but let's just use try-catch flow
    // or better, check if native module is missing which we did.

    // Actually, let's keep it simple. If checking keys revealed empty object, likely Expo Go.

    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return 0;

    try {
      const steps = await getHealthSteps();
      reconcileHealthSteps(steps);
      return steps;
    } catch (e: any) {
      const errMsg = e?.message ?? 'Health fetch failed';
      setError(errMsg);
      return 0;
    }
  }, [reconcileHealthSteps]);

  /**
   * Sync health steps to backend
   */
  const syncToBackend = useCallback(async (stepsToSync: number) => {
    if (!accessToken) {
      return;
    }

    try {
      const dayKey = dayKeyLocal();
      await correctServerSteps(stepsToSync, dayKey, accessToken);
      setBaseSteps(stepsToSync);
      await refreshPartnerSurfaceFromServer(accessToken).catch(() => {});
    } catch {
      // Don't fail - just use health steps directly
    }
  }, [accessToken]);

  /**
   * Full refresh
   */
  const refresh = useCallback(async () => {
    if (!permissionEnabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const healthResult = await fetchHealthSteps();
      await syncToBackend(healthResult);
    } catch (e: any) {
      setError(e?.message ?? 'Refresh failed');
    } finally {
      setLoading(false);
    }
  }, [fetchHealthSteps, permissionEnabled, syncToBackend]);

  // ============ Effects ============

  useEffect(() => {
    let cancelled = false;

    if (typeof permissionEnabledOverride === 'boolean') {
      setPermissionEnabled(permissionEnabledOverride);
      if (!permissionEnabledOverride) {
        setLoading(false);
      }
      return () => {
        cancelled = true;
      };
    }

    const loadConsent = async () => {
      const hasConsent = await hasStepPermissionConsent();
      if (cancelled) return;

      setPermissionEnabled(hasConsent);
      if (!hasConsent) {
        setLoading(false);
      }
    };

    loadConsent();

    return () => {
      cancelled = true;
    };
  }, [permissionEnabledOverride]);

  // Initial load - only after onboarding granted step access
  useEffect(() => {
    if (!permissionEnabled) {
      return;
    }

    let cancelled = false;

    const init = async () => {
      setLoading(true);

      try {
        // Always try to get health data
        const healthResult = await fetchHealthSteps();

        if (cancelled) return;

        // Try to sync to backend if we have token
        if (accessToken) {
          await syncToBackend(healthResult);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? 'Init failed');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    init();

    // Set up periodic sync (every 30s)
    syncIntervalRef.current = setInterval(() => {
      fetchHealthSteps().then(steps => {
        if (accessToken) {
          syncToBackend(steps);
        }
      }).catch(() => { });
    }, SYNC_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [accessToken, fetchHealthSteps, permissionEnabled, syncToBackend]);

  // App state changes - refresh when app becomes active
  useEffect(() => {
    if (!permissionEnabled) {
      return;
    }

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        refresh().catch(() => { });
      }
    });

    return () => sub.remove();
  }, [permissionEnabled, refresh]);

  // Pedometer watch for real-time UI updates
  useEffect(() => {
    if (!permissionEnabled) {
      return;
    }

    if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
      return;
    }

    let cancelled = false;

    const startWatch = async () => {
      try {
        if (Platform.OS === 'android') {
          await ensureAndroidActivityRecognitionPermission();
        }

        const available = await Pedometer.isAvailableAsync();
        if (!available) {
          console.log('[StepSync] Pedometer not available');
          return;
        }

        // Watch for live step updates
        subscriptionRef.current = Pedometer.watchStepCount((result) => {
          if (cancelled) return;

          const nextDayKey = dayKeyLocal();
          if (nextDayKey !== activeDayKeyRef.current) {
            resetForNewDay(nextDayKey);
            resetPendingUiState(result.steps);
            return;
          }

          const sensorSteps = result.steps;
          const previousSensorSteps = latestPedometerStepsRef.current;
          latestPedometerStepsRef.current = sensorSteps;

          if (pedometerFloorRef.current === null || previousSensorSteps === null) {
            // First reading after subscribing or reset: if the UI is still at zero,
            // surface the sensor reading immediately instead of waiting for another tick.
            pedometerFloorRef.current = sensorSteps;
            if (confirmedHealthStepsRef.current === 0 && sensorSteps > 0) {
              lastPedometerStepAtRef.current = Date.now();
              setPendingPedometerDelta(sensorSteps);
              schedulePendingExpiry();
            } else {
              setPendingPedometerDelta(0);
            }
            return;
          }

          if (sensorSteps < pedometerFloorRef.current) {
            // Defensive reset if the sensor stream restarts unexpectedly.
            resetPendingUiState(sensorSteps);
            return;
          }

          if (sensorSteps > previousSensorSteps) {
            const lastStepAt = lastPedometerStepAtRef.current;
            if (typeof lastStepAt === 'number' && (Date.now() - lastStepAt) > PENDING_PEDOMETER_WINDOW_MS) {
              // Drop stale shadow steps before starting a fresh optimistic window.
              pedometerFloorRef.current = previousSensorSteps;
            }
            lastPedometerStepAtRef.current = Date.now();
            applyPendingPedometerDelta();
            schedulePendingExpiry();
          }
        });

        console.log('[StepSync] Pedometer watching started');
      } catch (e: any) {
        console.error('[StepSync] Pedometer error:', e?.message);
      }
    };

    startWatch();

    return () => {
      cancelled = true;
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
        subscriptionRef.current = null;
      }
      clearPendingExpiryTimeout();
      resetPendingUiState();
    };
  }, [applyPendingPedometerDelta, clearPendingExpiryTimeout, permissionEnabled, resetForNewDay, resetPendingUiState, schedulePendingExpiry]);

  return {
    steps,                 // UI-only: confirmed health + pending pedometer shadow
    healthSteps,           // Latest raw health read
    confirmedHealthSteps,  // Last health total accepted by the reconciler
    baseSteps,             // Backend sync result (not used for local UI reconciliation)
    pedometerDelta: pendingPedometerDelta,  // UI-only shadow delta, expires after 10 min
    loading,
    error,
    refresh,
  };
}
