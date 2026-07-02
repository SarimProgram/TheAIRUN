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

const RUNS_KEY = "runs_v1";
let didMigrate = false;

type AuthFetch = (url: string, options?: RequestInit) => Promise<Response>;

function rowToRun(row: LocalRunRow): Run {
  return {
    id: row.id,
    startedAt: row.startedAt,
    endedAt: row.endedAt ?? row.startedAt,
    durationSeconds: row.durationSeconds,
    totalDistanceMeters: row.totalDistanceMeters,
    avgPaceSecPerKm: row.avgPaceSecPerKm ?? null,
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
  const calories = run.calories ?? Math.round(distanceKm * 60);

  return {
    type: "RUN",
    source: "APP_TRACKED",
    title: "Run",
    caloriesBurned: calories,
    distanceKm,
    durationMinutes,
    avgPaceSecPerKm: run.avgPaceSecPerKm ?? null,
    startedAt: run.startedAt,
    endedAt: run.endedAt,
    routeJson: run.route,
  };
}

export async function syncPendingRuns(authFetch: AuthFetch): Promise<void> {
  const pending = await getPendingRunSessions();
  if (pending.length === 0) return;

  const syncedIds: string[] = [];
  for (const row of pending) {
    const run = rowToRun(row);
    try {
      const res = await authFetch(`${API_BASE_URL}/summary/workouts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildWorkoutPayload(run)),
      });
      if (res.ok) syncedIds.push(row.id);
    } catch (err) {
      // Keep unsynced for retry
    }
  }

  if (syncedIds.length > 0) {
    await markRunSessionsSynced(syncedIds);
  }
}

export async function saveRun(run: Run, authFetch?: AuthFetch): Promise<void> {
  await migrateRunsFromAsyncStorageIfNeeded();
  await insertRunSession({
    id: run.id,
    startedAt: run.startedAt,
    endedAt: run.endedAt ?? null,
    durationSeconds: run.durationSeconds,
    totalDistanceMeters: run.totalDistanceMeters,
    avgPaceSecPerKm: run.avgPaceSecPerKm ?? null,
    calories: run.calories ?? Math.round((run.totalDistanceMeters / 1000) * 60),
    routeJson: run.route ? JSON.stringify(run.route) : null,
    createdAt: run.startedAt,
    synced: 0,
  });

  if (authFetch) {
    await syncPendingRuns(authFetch);
  }
}

export async function loadRuns(limit?: number): Promise<Run[]> {
  await migrateRunsFromAsyncStorageIfNeeded();
  const rows = await getRunSessions(limit);
  return rows.map(rowToRun);
}

export async function clearLegacyAsyncStorageRuns(): Promise<void> {
  await AsyncStorage.removeItem(RUNS_KEY);
}
