import { useEffect, useState, useCallback, useRef } from "react";
import { Platform } from "react-native";
import {
  queryQuantitySamples,
  QuantityTypeIdentifier,
} from "@kingstinct/react-native-healthkit";
import GoogleFit, { BucketUnit } from "react-native-google-fit";
import {
  insertStepSamples,
  getStepsByTimeBucket,
  StepSample,
  getTimeBucket
} from "../db/offlineDb";
import { hasStepPermissionConsent } from "../config/healthPermissions";

// Helper to get start of day
function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

type UseHealthStepsArgs = {
  enabled?: boolean;
  accessToken?: string | null;
};

// Define explicit identifier string for steps
const HK_STEP_COUNT = 'HKQuantityTypeIdentifierStepCount' as QuantityTypeIdentifier;

/**
 * Hook to sync health data to local DB + backfill past days to backend
 */
export function useHealthSync({ enabled = true, accessToken }: UseHealthStepsArgs = {}) {
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasConsent, setHasConsent] = useState(false);
  const backfillDoneRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const loadConsent = async () => {
      const consentGranted = await hasStepPermissionConsent();
      if (cancelled) return;

      setHasConsent(consentGranted);
      if (!consentGranted) {
        setIsAuthorized(false);
      }
    };

    loadConsent();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!enabled || !hasConsent) return;

    let cancelled = false;

    async function sync() {
      try {
        if (Platform.OS === 'ios') {
          if (!cancelled) setIsAuthorized(true);

          // Fetch samples for today
          const startDate = startOfToday();
          const endDate = new Date();

          // We fetch samples to get granular data for bucketing
          const samples = await queryQuantitySamples(
            HK_STEP_COUNT,
            {
              limit: 0, // Fetch all samples
              unit: 'count', 
              filter: {
                date: {
                  startDate,
                  endDate
                }
              }
            }
          );

          // Transform to DB format
          
          if (samples && samples.length > 0) {
            const dbSamples: StepSample[] = samples.map(s => {
              const sDate = new Date(s.startDate);
              const eDate = new Date(s.endDate);
              const uuid = s.metadata?.HKExternalUUID as string;
              const validId = uuid || (s as any).uuid || `${sDate.getTime()}-${eDate.getTime()}-${s.quantity}`;

              return {
                id: validId,
                dayKey: formatDayKey(sDate),
                timeBucket: getTimeBucket(sDate),
                steps: s.quantity,
                startDate: sDate.toISOString(),
                endDate: eDate.toISOString(),
                source: 'healthkit',
                createdAt: new Date().toISOString()
              };
            });
            
            await insertStepSamples(dbSamples);
          }

          // --- Backfill past 7 days to backend ---
          if (accessToken && !backfillDoneRef.current) {
            backfillDoneRef.current = true;
            try {
              await backfillPastDays('ios', accessToken);
            } catch (e) {
              console.error('Backfill error:', e);
            }
          }

        } else if (Platform.OS === 'android') {
          await GoogleFit.checkIsAuthorized();
          if (!GoogleFit.isAuthorized) {
            if (!cancelled) {
              setIsAuthorized(false);
              setError("Google Fit authorization failed");
            }
            return;
          }

          if (!cancelled) setIsAuthorized(true);

          // Fetch daily samples
          const startDate = startOfToday().toISOString();
          const endDate = new Date().toISOString();
          
          // Use getDailyStepCountSamples with MINUTE buckets for granularity
          const res = await GoogleFit.getDailyStepCountSamples({
              startDate,
              endDate,
              bucketUnit: BucketUnit.MINUTE, 
              bucketInterval: 15, // 15 min buckets
          });

          // Google Fit structure
          const source = res.find((s: any) => s.source === "com.google.android.gms:estimated_steps") ?? res[0];
          
           // If we have raw steps from the steps array
           const stepsData = source?.steps || [];
           
           if (stepsData.length > 0) {
              const dbSamples: StepSample[] = stepsData.map((s: any) => {
                  const sDate = new Date(s.date || s.startDate); 
                  
                  return {
                      id: `gf-${sDate.getTime()}-${Math.random()}`,
                      dayKey: formatDayKey(sDate),
                      timeBucket: getTimeBucket(sDate),
                      steps: s.value,
                      startDate: sDate.toISOString(),
                      endDate: sDate.toISOString(), // Approximating end if not provided
                      source: 'googlefit',
                      createdAt: new Date().toISOString()
                  };
              });
              await insertStepSamples(dbSamples);
           }

          // --- Backfill past 7 days to backend ---
          if (accessToken && !backfillDoneRef.current) {
            backfillDoneRef.current = true;
            try {
              await backfillPastDays('android', accessToken);
            } catch (e) {
              console.error('Backfill error:', e);
            }
          }
        }
      } catch (e: any) {
        if (!cancelled) {
            // Only set error if not already authorized (avoid spamming)
            if (!isAuthorized) setError(e?.message ?? "Health sync failed");
        }
        console.error("Health sync error", e);
      }
    }

    sync();
    // Poll every minute
    const interval = setInterval(sync, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [enabled, hasConsent, accessToken, isAuthorized]);

  return { isAuthorized, error };
}

/**
 * Backfill past 7 days of step data from health APIs to the backend.
 * This runs once per app session to ensure step history is captured
 * even if the app wasn't opened on those days.
 */
async function backfillPastDays(platform: 'ios' | 'android', accessToken: string) {
  const days: { dayKey: string; steps: number }[] = [];

  for (let i = 1; i <= 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    try {
      let daySteps = 0;

      if (platform === 'ios') {
        const samples = await queryQuantitySamples(
          HK_STEP_COUNT,
          {
            limit: 0,
            unit: 'count',
            filter: {
              date: { startDate: dayStart, endDate: dayEnd }
            }
          }
        );
        daySteps = samples.reduce((sum, s) => sum + (s.quantity || 0), 0);
      } else if (platform === 'android') {
        const res = await GoogleFit.getDailyStepCountSamples({
          startDate: dayStart.toISOString(),
          endDate: dayEnd.toISOString(),
        });
        const source = res?.find((s: any) => s.source === 'com.google.android.gms:estimated_steps') ?? res?.[0];
        daySteps = (source?.steps || []).reduce((sum: number, x: any) => sum + (x.value ?? 0), 0);
      }

      if (daySteps > 0) {
        days.push({ dayKey: formatDayKey(dayStart), steps: Math.round(daySteps) });
      }
    } catch (e) {
      // Skip individual day errors
      console.warn(`[Backfill] Failed for day -${i}:`, e);
    }
  }

  if (days.length > 0) {
    console.log(`[Backfill] Sending ${days.length} days to backend`);
    const API_BASE_URL_IMPORT = require('../config/api').API_BASE_URL;
    await fetch(`${API_BASE_URL_IMPORT}/activity/steps/backfill`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ days }),
    });
  }
}

/**
 * Hook to read bucketed steps from local DB
 */
export function useLocalDailySteps(selectedDate: Date = new Date(), accessToken?: string | null) {
  const [data, setData] = useState({
    morning: 0,
    afternoon: 0,
    evening: 0,
    total: 0
  });

  const dayKey = formatDayKey(selectedDate);
  useHealthSync({ enabled: true, accessToken }); // Ensure sync is running + backfill once consent exists

  const fetchData = useCallback(async () => {
      try {
          const result = await getStepsByTimeBucket(dayKey);
          setData(result);
      } catch (e) {
          console.error("Error fetching local steps", e);
      }
  }, [dayKey]);

  useEffect(() => {
    fetchData();
    // Poll local DB for updates every 5s? 
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return data;
}
