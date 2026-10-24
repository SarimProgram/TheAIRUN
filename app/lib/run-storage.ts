// app/lib/run-storage.ts

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Run } from "@/types/run";
import { API_BASE_URL } from "@/config/api";
import {
  insertRunSession,
  getRunSessions,
  getPendingRunSessions,
  markRunSessionsSynced,
  type LocalRunRow,
} from "@/db/offlineDb";
import { estimateDistanceCalories } from "@/lib/calorie-burn";

const RUNS_KEY = "runs_v1";
let didMigrate = false;

type AuthFetch = (url: string, options?: RequestInit) => Promise<Response>;

export type PaceSyncUpdate = {
  mode?: 'running' | 'walking';
  previousBaselinePaceSecPerKm?: number | null;
  baselinePaceSecPerKm?: number | null;
  status?: 'STARTING' | 'LEARNING' | 'PERSONALISED';
  sampleCount?: number;
};

function rowToRun(row: LocalRunRow): Run {
  return {
    id: row.id,
    startedAt: row.startedAt,
    endedAt: row.endedAt ?? row.startedAt,
    durationSeconds: row.durationSeconds,
    totalDistanceMeters: row.totalDistanceMeters,
    avgPaceSecPerKm: row.avgPaceSecPerKm ?? null,
    workoutType: row.workoutType ?? 'RUN',
    title: row.title ?? undefined,
    perceivedEffort: row.perceivedEffort ?? undefined,
    calories: row.calories ?? 0,
    route: row.routeJson ? JSON.parse(row.routeJson) : [],
  };
}

async function migrateRunsFromAsyncStorageIfNeeded() {
  if (didMigrate) return;
  didMigrate = true;

  const existingRows = await getRunSessions(1);
  if (existingRows.length > 0) return;

  const existing = await AsyncStorage.getItem(RUNS_KEY);
  if (!existing) return;

  const runs: Run[] = JSON.parse(existing);
  for (const run of runs) {
    await insertRunSession({
      id: run.id,
      startedAt: run.startedAt,
      endedAt: run.endedAt ?? null,
      durationSeconds: run.durationSeconds,
      totalDistanceMeters: run.totalDistanceMeters,
      avgPaceSecPerKm: run.avgPaceSecPerKm ?? null,
      workoutType: run.workoutType ?? 'RUN',
      title: run.title ?? null,
      perceivedEffort: run.perceivedEffort ?? null,
      calories: run.calories ?? 0,
      routeJson: run.route ? JSON.stringify(run.route) : null,
      createdAt: run.startedAt,
      synced: 0,
    });
  }
}

function buildWorkoutPayload(run: Run) {
  const distanceKm = run.totalDistanceMeters / 1000;
  const durationMinutes = Math.max(1, Math.round(run.durationSeconds / 60));
  const workoutType = (run.workoutType ?? 'RUN') as 'RUN' | 'WALK' | 'INTERVAL';
  const calories = run.calories ?? estimateDistanceCalories(run.totalDistanceMeters, workoutType);

  return {
    source: "APP_TRACKED",
    clientId: run.id,
    caloriesBurned: calories,
    distanceKm,
    durationMinutes,
    avgPaceSecPerKm: run.avgPaceSecPerKm ? Math.round(run.avgPaceSecPerKm) : null,
    startedAt: run.startedAt,
    endedAt: run.endedAt,
    routeJson: run.route,
    type: run.workoutType ?? 'RUN',
    title: run.title ?? (run.workoutType === 'WALK' ? 'Walk' : 'Run'),
    perceivedEffort: run.perceivedEffort ?? null,
  };
}

export async function syncPendingRuns(authFetch: AuthFetch): Promise<PaceSyncUpdate | null> {
  const pending = await getPendingRunSessions();
  if (pending.length === 0) return null;

  const syncedIds: string[] = [];
  let latestPaceUpdate: PaceSyncUpdate | null = null;
  for (const row of pending) {
    const run = rowToRun(row);
    try {
      const res = await authFetch(`${API_BASE_URL}/summary/workouts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildWorkoutPayload(run)),
      });
      if (res.ok) {
        syncedIds.push(row.id);
        const data = await res.json().catch(() => null);
        if (data?.paceUpdate) latestPaceUpdate = data.paceUpdate;
      }
    } catch (err) {
      // Keep unsynced for retry
    }
  }

  if (syncedIds.length > 0) {
    await markRunSessionsSynced(syncedIds);
  }
  return latestPaceUpdate;
}

export async function saveRun(run: Run, authFetch?: AuthFetch): Promise<PaceSyncUpdate | null> {
  await migrateRunsFromAsyncStorageIfNeeded();
  await insertRunSession({
    id: run.id,
    startedAt: run.startedAt,
    endedAt: run.endedAt ?? null,
    durationSeconds: run.durationSeconds,
    totalDistanceMeters: run.totalDistanceMeters,
    avgPaceSecPerKm: run.avgPaceSecPerKm ?? null,
    workoutType: run.workoutType ?? 'RUN',
    title: run.title ?? null,
    perceivedEffort: run.perceivedEffort ?? null,
    calories: run.calories ?? Math.round((run.totalDistanceMeters / 1000) * 60),
    routeJson: run.route ? JSON.stringify(run.route) : null,
    createdAt: run.startedAt,
    synced: 0,
  });

  if (authFetch) {
    return syncPendingRuns(authFetch);
  }
  return null;
}

export async function loadRuns(limit?: number): Promise<Run[]> {
  await migrateRunsFromAsyncStorageIfNeeded();
  const rows = await getRunSessions(limit);
  return rows.map(rowToRun);
}

export async function clearLegacyAsyncStorageRuns(): Promise<void> {
  await AsyncStorage.removeItem(RUNS_KEY);
}
