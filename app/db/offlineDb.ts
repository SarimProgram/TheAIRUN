// app/db/offlineDb.ts
// Offline-first SQLite database for local step data storage

import * as SQLite from 'expo-sqlite';

const DB_NAME = 'aicoach_offline.db';

let dbInstance: SQLite.SQLiteDatabase | null = null;

/**
 * Get or create the SQLite database instance
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
    if (!dbInstance) {
        dbInstance = await SQLite.openDatabaseAsync(DB_NAME);
        await runMigrations(dbInstance);
    }
    return dbInstance;
}

/**
 * Run database migrations
 */
async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
    // Create migrations table
    await db.execAsync(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      appliedAt TEXT NOT NULL
    );
  `);

    // Check and apply migrations
    const appliedMigrations = await db.getAllAsync<{ name: string }>(
        'SELECT name FROM migrations'
    );
    const appliedNames = new Set(appliedMigrations.map(m => m.name));

    for (const migration of MIGRATIONS) {
        if (!appliedNames.has(migration.name)) {
            console.log(`[OfflineDB] Applying migration: ${migration.name}`);
            await db.execAsync(migration.sql);
            await db.runAsync(
                'INSERT INTO migrations (name, appliedAt) VALUES (?, ?)',
                migration.name,
                new Date().toISOString()
            );
        }
    }
}

const MIGRATIONS = [
    {
        name: '001_step_samples',
        sql: `
      CREATE TABLE IF NOT EXISTS step_samples (
        id TEXT PRIMARY KEY,
        dayKey TEXT NOT NULL,
        timeBucket TEXT NOT NULL,
        steps INTEGER NOT NULL,
        startDate TEXT NOT NULL,
        endDate TEXT NOT NULL,
        source TEXT NOT NULL,
        createdAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_step_samples_dayKey ON step_samples(dayKey);
      CREATE INDEX IF NOT EXISTS idx_step_samples_timeBucket ON step_samples(dayKey, timeBucket);
    `,
    },
    {
        name: '002_daily_steps_queue',
        sql: `
      CREATE TABLE IF NOT EXISTS daily_steps_queue (
        id TEXT PRIMARY KEY,
        dayKey TEXT NOT NULL,
        steps INTEGER NOT NULL,
        source TEXT NOT NULL,
        synced INTEGER DEFAULT 0,
        createdAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_daily_steps_queue_synced ON daily_steps_queue(synced);
    `,
    },
    {
        name: '003_water_logs',
        sql: `
      CREATE TABLE IF NOT EXISTS water_logs (
        id TEXT PRIMARY KEY,
        dayKey TEXT NOT NULL,
        timeBucket TEXT NOT NULL,
        amountMl INTEGER NOT NULL,
        loggedAt TEXT NOT NULL,
        synced INTEGER DEFAULT 0,
        createdAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_water_logs_dayKey ON water_logs(dayKey);
      CREATE INDEX IF NOT EXISTS idx_water_logs_synced ON water_logs(synced);
    `,
    },
    {
        name: '004_run_sessions',
        sql: `
      CREATE TABLE IF NOT EXISTS run_sessions (
        id TEXT PRIMARY KEY,
        startedAt TEXT NOT NULL,
        endedAt TEXT,
        durationSeconds INTEGER NOT NULL,
        totalDistanceMeters REAL NOT NULL,
        avgPaceSecPerKm REAL,
        calories INTEGER DEFAULT 0,
        routeJson TEXT,
        synced INTEGER DEFAULT 0,
        createdAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_run_sessions_startedAt ON run_sessions(startedAt);
      CREATE INDEX IF NOT EXISTS idx_run_sessions_synced ON run_sessions(synced);
    `,
    },
    {
        name: '005_training_profile',
        sql: `
      CREATE TABLE IF NOT EXISTS training_profile (
        profileKey TEXT PRIMARY KEY,
        runExperience TEXT,
        baselinePaceSecPerKm INTEGER,
        updatedAt TEXT NOT NULL
      );
    `,
    },
];

// ============ Step Samples (Local Only) ============

export type TimeBucket = 'morning' | 'afternoon' | 'evening';

export type StepSample = {
    id: string;
    dayKey: string;
    timeBucket: TimeBucket;
    steps: number;
    startDate: string;
    endDate: string;
    source: 'healthkit' | 'googlefit';
    createdAt: string;
};

/**
 * Determine which time bucket a date falls into
 * Morning: 4am - 12pm
 * Afternoon: 12pm - 6pm
 * Evening: 6pm - 4am (next day)
 */
export function getTimeBucket(date: Date): TimeBucket {
    const hours = date.getHours();
    if (hours >= 4 && hours < 12) return 'morning';
    if (hours >= 12 && hours < 18) return 'afternoon';
    return 'evening';
}

/**
 * Insert multiple step samples (upsert by id)
 */
export async function insertStepSamples(samples: StepSample[]): Promise<void> {
    if (samples.length === 0) return;

    const db = await getDatabase();

    for (const sample of samples) {
        await db.runAsync(
            `INSERT OR REPLACE INTO step_samples 
       (id, dayKey, timeBucket, steps, startDate, endDate, source, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            sample.id,
            sample.dayKey,
            sample.timeBucket,
            sample.steps,
            sample.startDate,
            sample.endDate,
            sample.source,
            sample.createdAt
        );
    }
}

/**
 * Get step samples for a specific day, grouped by time bucket
 */
export async function getStepsByTimeBucket(dayKey: string): Promise<{
    morning: number;
    afternoon: number;
    evening: number;
    total: number;
}> {
    const db = await getDatabase();

    const results = await db.getAllAsync<{ timeBucket: TimeBucket; total: number }>(
        `SELECT timeBucket, SUM(steps) as total 
     FROM step_samples 
     WHERE dayKey = ? 
     GROUP BY timeBucket`,
        dayKey
    );

    const buckets = { morning: 0, afternoon: 0, evening: 0 };
    for (const row of results) {
        buckets[row.timeBucket] = row.total;
    }

    return {
        ...buckets,
        total: buckets.morning + buckets.afternoon + buckets.evening,
    };
}

// ============ Daily Steps Queue (Syncs to Backend) ============

export type DailyStepsQueueItem = {
    id: string;
    dayKey: string;
    steps: number;
    source: 'healthkit' | 'googlefit';
    synced: boolean;
    createdAt: string;
};

/**
 * Queue a daily step total for backend sync
 */
export async function queueDailySteps(item: Omit<DailyStepsQueueItem, 'synced'>): Promise<void> {
    const db = await getDatabase();

    await db.runAsync(
        `INSERT OR REPLACE INTO daily_steps_queue 
     (id, dayKey, steps, source, synced, createdAt)
     VALUES (?, ?, ?, ?, 0, ?)`,
        item.id,
        item.dayKey,
        item.steps,
        item.source,
        item.createdAt
    );
}

/**
 * Get all pending (unsynced) daily step items
 */
export async function getPendingDailySteps(): Promise<DailyStepsQueueItem[]> {
    const db = await getDatabase();

    const results = await db.getAllAsync<{
        id: string;
        dayKey: string;
        steps: number;
        source: string;
        synced: number;
        createdAt: string;
    }>('SELECT * FROM daily_steps_queue WHERE synced = 0');

    return results.map(row => ({
        ...row,
        source: row.source as 'healthkit' | 'googlefit',
        synced: row.synced === 1,
    }));
}

/**
 * Mark daily step items as synced
 */
export async function markDailyStepsSynced(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    const db = await getDatabase();
    const placeholders = ids.map(() => '?').join(',');

    await db.runAsync(
        `UPDATE daily_steps_queue SET synced = 1 WHERE id IN (${placeholders})`,
        ...ids
    );
}

/**
 * Get the latest daily total for a specific day (for display)
 */
export async function getLatestDailyTotal(dayKey: string): Promise<number> {
    const db = await getDatabase();

    const result = await db.getFirstAsync<{ steps: number }>(
        'SELECT steps FROM daily_steps_queue WHERE dayKey = ? ORDER BY createdAt DESC LIMIT 1',
        dayKey
    );

    return result?.steps ?? 0;
}

/**
 * Store the last health fetch timestamp
 */
export async function setLastHealthFetch(timestamp: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
        `INSERT OR REPLACE INTO migrations (id, name, appliedAt) VALUES (-1, 'lastHealthFetch', ?)`,
        timestamp
    );
}

/**
 * Get the last health fetch timestamp
 */
export async function getLastHealthFetch(): Promise<string | null> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<{ appliedAt: string }>(
        `SELECT appliedAt FROM migrations WHERE name = 'lastHealthFetch'`
    );
    return result?.appliedAt ?? null;
}

// ============ Water Logs (Local + Sync to Backend) ============

export type WaterLog = {
    id: string;
    dayKey: string;
    timeBucket: TimeBucket;
    amountMl: number;
    loggedAt: string;
    synced: boolean;
    createdAt: string;
};

/**
 * Insert a water log entry
 */
export async function insertWaterLog(log: Omit<WaterLog, 'synced'>): Promise<void> {
    const db = await getDatabase();

    await db.runAsync(
        `INSERT INTO water_logs (id, dayKey, timeBucket, amountMl, loggedAt, synced, createdAt)
         VALUES (?, ?, ?, ?, ?, 0, ?)`,
        log.id,
        log.dayKey,
        log.timeBucket,
        log.amountMl,
        log.loggedAt,
        log.createdAt
    );
}

/**
 * Get water intake for a specific day, grouped by time bucket
 */
export async function getWaterByTimeBucket(dayKey: string): Promise<{
    morning: number;
    afternoon: number;
    evening: number;
    total: number;
}> {
    const db = await getDatabase();

    const results = await db.getAllAsync<{ timeBucket: TimeBucket; total: number }>(
        `SELECT timeBucket, SUM(amountMl) as total 
         FROM water_logs 
         WHERE dayKey = ? 
         GROUP BY timeBucket`,
        dayKey
    );

    const buckets = { morning: 0, afternoon: 0, evening: 0 };
    for (const row of results) {
        buckets[row.timeBucket] = row.total;
    }

    return {
        ...buckets,
        total: buckets.morning + buckets.afternoon + buckets.evening,
    };
}

/**
 * Get today's total water intake
 */
export async function getTodayWaterTotal(dayKey: string): Promise<number> {
    const db = await getDatabase();

    const result = await db.getFirstAsync<{ total: number }>(
        'SELECT SUM(amountMl) as total FROM water_logs WHERE dayKey = ?',
        dayKey
    );

    return result?.total ?? 0;
}

/**
 * Get all pending (unsynced) water logs
 */
export async function getPendingWaterLogs(): Promise<WaterLog[]> {
    const db = await getDatabase();

    const results = await db.getAllAsync<{
        id: string;
        dayKey: string;
        timeBucket: string;
        amountMl: number;
        loggedAt: string;
        synced: number;
        createdAt: string;
    }>('SELECT * FROM water_logs WHERE synced = 0');

    return results.map(row => ({
        ...row,
        timeBucket: row.timeBucket as TimeBucket,
        synced: row.synced === 1,
    }));
}

/**
 * Get the most recent water log for today
 */
export async function getLastWaterLog(dayKey: string): Promise<WaterLog | null> {
    const db = await getDatabase();

    const result = await db.getFirstAsync<{
        id: string;
        dayKey: string;
        timeBucket: string;
        amountMl: number;
        loggedAt: string;
        synced: number;
        createdAt: string;
    }>(
        'SELECT * FROM water_logs WHERE dayKey = ? ORDER BY loggedAt DESC LIMIT 1',
        dayKey
    );

    if (!result) return null;

    return {
        ...result,
        timeBucket: result.timeBucket as TimeBucket,
        synced: result.synced === 1,
    };
}

/**
 * Delete all water logs for a specific day
 */
export async function clearWaterLogsForDay(dayKey: string): Promise<void> {
    const db = await getDatabase();

    await db.runAsync(
        'DELETE FROM water_logs WHERE dayKey = ?',
        dayKey
    );
}

/**
 * Mark water logs as synced
 */
export async function markWaterLogsSynced(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    const db = await getDatabase();
    const placeholders = ids.map(() => '?').join(',');

    await db.runAsync(
        `UPDATE water_logs SET synced = 1 WHERE id IN (${placeholders})`,
        ...ids
    );
}

// ============ Run Sessions (Local + Sync to Backend) ============

export type LocalRunRow = {
    id: string;
    startedAt: string;
    endedAt: string | null;
    durationSeconds: number;
    totalDistanceMeters: number;
    avgPaceSecPerKm: number | null;
    calories: number;
    routeJson: string | null;
    synced: number;
    createdAt: string;
};

export async function insertRunSession(row: Omit<LocalRunRow, 'synced'> & { synced?: number }): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
        `INSERT OR REPLACE INTO run_sessions 
     (id, startedAt, endedAt, durationSeconds, totalDistanceMeters, avgPaceSecPerKm, calories, routeJson, synced, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        row.id,
        row.startedAt,
        row.endedAt ?? null,
        row.durationSeconds,
        row.totalDistanceMeters,
        row.avgPaceSecPerKm ?? null,
        row.calories ?? 0,
        row.routeJson ?? null,
        row.synced ?? 0,
        row.createdAt
    );
}

export async function getRunSessions(limit?: number): Promise<LocalRunRow[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<LocalRunRow>(
        `SELECT * FROM run_sessions ORDER BY startedAt DESC ${limit ? 'LIMIT ?' : ''}`,
        ...(limit ? [limit] : [])
    );
    return rows;
}

export async function getPendingRunSessions(): Promise<LocalRunRow[]> {
    const db = await getDatabase();
    return db.getAllAsync<LocalRunRow>('SELECT * FROM run_sessions WHERE synced = 0 ORDER BY startedAt DESC');
}

export async function markRunSessionsSynced(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const db = await getDatabase();
    const placeholders = ids.map(() => '?').join(',');
    await db.runAsync(
        `UPDATE run_sessions SET synced = 1 WHERE id IN (${placeholders})`,
        ...ids
    );
}

// ============ Training Profile (Local Cache) ============

export type LocalTrainingProfile = {
    profileKey: string;
    runExperience: string | null;
    baselinePaceSecPerKm: number | null;
    updatedAt: string;
};

export async function upsertTrainingProfile(
    profile: Omit<LocalTrainingProfile, 'updatedAt'> & { updatedAt?: string }
): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
        `INSERT OR REPLACE INTO training_profile
     (profileKey, runExperience, baselinePaceSecPerKm, updatedAt)
     VALUES (?, ?, ?, ?)`,
        profile.profileKey,
        profile.runExperience ?? null,
        profile.baselinePaceSecPerKm ?? null,
        profile.updatedAt ?? new Date().toISOString()
    );
}

export async function getTrainingProfile(profileKey: string): Promise<LocalTrainingProfile | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<LocalTrainingProfile>(
        'SELECT * FROM training_profile WHERE profileKey = ?',
        profileKey
    );
    return row ?? null;
}

