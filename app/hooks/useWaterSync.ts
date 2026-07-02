// app/hooks/useWaterSync.ts
// Offline-first water tracking: log locally with timestamps, sync to backend

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import * as Crypto from 'expo-crypto';
import { API_BASE_URL } from '../config/api';

import {
    getDatabase,
    insertWaterLog,
    getWaterByTimeBucket,
    getTodayWaterTotal,
    getPendingWaterLogs,
    markWaterLogsSynced,
    getLastWaterLog,
    getTimeBucket,
    TimeBucket,
    clearWaterLogsForDay,
} from '../db/offlineDb';

type UseWaterSyncOptions = {
    accessToken?: string | null;
};

type WaterByPeriod = {
    morning: number;
    afternoon: number;
    evening: number;
    total: number;
};

const SYNC_INTERVAL_MS = 30_000; // Sync every 30s
const GLASS_ML = 250; // 250ml per glass

const waterListeners = new Set<() => void>();

function notifyWaterListeners() {
    waterListeners.forEach((listener) => {
        try {
            listener();
        } catch (e) {
            console.error('[WaterSync] listener error:', e);
        }
    });
}

function subscribeToWaterChanges(listener: () => void) {
    waterListeners.add(listener);
    return () => {
        waterListeners.delete(listener);
    };
}

function dayKeyLocal(d = new Date()): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

/**
 * Sync water total to backend (correct/set absolute value)
 */
async function syncWaterToBackend(
    waterMl: number,
    dayKey: string,
    accessToken: string
): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/hydration/correct`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ waterMl, dayKey }),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Server responded ${res.status}: ${text}`);
    }
}

export function useWaterSync({ accessToken }: UseWaterSyncOptions) {
    const [waterMl, setWaterMl] = useState(0);
    const [waterTarget] = useState(2000); // 8 glasses × 250ml
    const [waterByPeriod, setWaterByPeriod] = useState<WaterByPeriod>({
        morning: 0,
        afternoon: 0,
        evening: 0,
        total: 0,
    });
    const [lastLoggedAt, setLastLoggedAt] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Refs
    const isOnlineRef = useRef(true);
    const syncingRef = useRef(false);
    const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    /**
     * Load water data from SQLite
     */
    const loadFromSQLite = useCallback(async () => {
        try {
            await getDatabase();
            const dk = dayKeyLocal();

            const byPeriod = await getWaterByTimeBucket(dk);
            setWaterByPeriod(byPeriod);
            setWaterMl(byPeriod.total);

            // Get last logged timestamp
            const lastLog = await getLastWaterLog(dk);
            setLastLoggedAt(lastLog?.loggedAt ?? null);
        } catch (e: any) {
            console.error('[WaterSync] loadFromSQLite error:', e?.message);
        }
    }, []);

    /**
     * Log a glass of water (250ml)
     */
    const logWater = useCallback(async (amountMl: number = GLASS_ML) => {
        try {
            await getDatabase();

            const now = new Date();
            const dk = dayKeyLocal(now);
            const bucket = getTimeBucket(now);

            const log = {
                id: Crypto.randomUUID(),
                dayKey: dk,
                timeBucket: bucket,
                amountMl,
                loggedAt: now.toISOString(),
                createdAt: now.toISOString(),
            };

            // Store locally
            await insertWaterLog(log);

            // Update UI immediately
            setWaterMl((prev) => prev + amountMl);
            setWaterByPeriod((prev) => ({
                ...prev,
                [bucket]: prev[bucket] + amountMl,
                total: prev.total + amountMl,
            }));
            setLastLoggedAt(now.toISOString());

            console.log(`[WaterSync] Logged ${amountMl}ml in ${bucket} bucket`);

            // Try immediate sync if online
            if (isOnlineRef.current && accessToken) {
                drainToBackend();
            }

            notifyWaterListeners();
        } catch (e: any) {
            setError(e?.message || 'Failed to log water');
            console.error('[WaterSync] logWater error:', e?.message);
        }
    }, [accessToken]);

    /**
     * Set today's water intake to an exact total.
     * Used by UIs that select a specific glass count instead of only incrementing.
     */
    const setWaterTotal = useCallback(async (targetWaterMl: number) => {
        try {
            await getDatabase();

            const now = new Date();
            const dk = dayKeyLocal(now);
            const bucket = getTimeBucket(now);
            const normalizedTarget = Math.max(0, Math.round(targetWaterMl));
            const syncedIds: string[] = [];

            await clearWaterLogsForDay(dk);

            if (normalizedTarget > 0) {
                const id = Crypto.randomUUID();
                await insertWaterLog({
                    id,
                    dayKey: dk,
                    timeBucket: bucket,
                    amountMl: normalizedTarget,
                    loggedAt: now.toISOString(),
                    createdAt: now.toISOString(),
                });
                syncedIds.push(id);
            }

            setWaterMl(normalizedTarget);
            setWaterByPeriod({
                morning: bucket === 'morning' ? normalizedTarget : 0,
                afternoon: bucket === 'afternoon' ? normalizedTarget : 0,
                evening: bucket === 'evening' ? normalizedTarget : 0,
                total: normalizedTarget,
            });
            setLastLoggedAt(normalizedTarget > 0 ? now.toISOString() : null);

            if (isOnlineRef.current && accessToken) {
                await syncWaterToBackend(normalizedTarget, dk, accessToken);
                if (syncedIds.length > 0) {
                    await markWaterLogsSynced(syncedIds);
                }
            }

            notifyWaterListeners();
        } catch (e: any) {
            setError(e?.message || 'Failed to update water');
            console.error('[WaterSync] setWaterTotal error:', e?.message);
        }
    }, [accessToken]);

    /**
     * Drain pending water logs to backend
     */
    const drainToBackend = useCallback(async () => {
        if (!accessToken) return;
        if (!isOnlineRef.current) return;
        if (syncingRef.current) return;

        syncingRef.current = true;

        try {
            const pending = await getPendingWaterLogs();
            if (pending.length === 0) return;

            console.log(`[WaterSync] Draining ${pending.length} water logs to backend`);

            // Group by dayKey and calculate total for each day
            const byDay = new Map<string, number>();
            for (const log of pending) {
                const current = byDay.get(log.dayKey) || 0;
                byDay.set(log.dayKey, current + log.amountMl);
            }

            const syncedIds: string[] = [];

            for (const [dayKey] of byDay) {
                try {
                    // Get current total for this day from SQLite
                    const total = await getTodayWaterTotal(dayKey);
                    await syncWaterToBackend(total, dayKey, accessToken);

                    // Mark all logs for this day as synced
                    const dayLogs = pending.filter(l => l.dayKey === dayKey);
                    syncedIds.push(...dayLogs.map(l => l.id));
                } catch (e: any) {
                    console.error(`[WaterSync] Failed to sync ${dayKey}:`, e?.message);
                }
            }

            if (syncedIds.length > 0) {
                await markWaterLogsSynced(syncedIds);
                console.log(`[WaterSync] Synced ${syncedIds.length} logs to backend`);
            }
        } catch (e: any) {
            console.error('[WaterSync] drainToBackend error:', e?.message);
        } finally {
            syncingRef.current = false;
        }
    }, [accessToken]);

    // Network listener
    useEffect(() => {
        const unsub = NetInfo.addEventListener((state) => {
            const online = !!state.isConnected && !!state.isInternetReachable;
            isOnlineRef.current = online;

            if (online && accessToken) {
                drainToBackend();
            }
        });

        return () => unsub();
    }, [accessToken, drainToBackend]);

    // Initial load + periodic sync
    useEffect(() => {
        let cancelled = false;

        const init = async () => {
            setLoading(true);
            setError(null);

            try {
                await loadFromSQLite();

                if (isOnlineRef.current && accessToken) {
                    await drainToBackend();
                }
            } catch (e: any) {
                if (!cancelled) setError(e?.message || 'Failed to init');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        init();

        // Periodic sync
        syncIntervalRef.current = setInterval(() => {
            loadFromSQLite();
            if (isOnlineRef.current && accessToken) {
                drainToBackend();
            }
        }, SYNC_INTERVAL_MS);

        return () => {
            cancelled = true;
            if (syncIntervalRef.current) {
                clearInterval(syncIntervalRef.current);
            }
        };
    }, [loadFromSQLite, drainToBackend, accessToken]);

    // App state changes
    useEffect(() => {
        const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
            if (state === 'active') {
                loadFromSQLite();
                if (isOnlineRef.current && accessToken) {
                    drainToBackend();
                }
            }
        });

        return () => sub.remove();
    }, [loadFromSQLite, drainToBackend, accessToken]);

    useEffect(() => {
        const unsubscribe = subscribeToWaterChanges(() => {
            loadFromSQLite();
        });

        return unsubscribe;
    }, [loadFromSQLite]);

    return {
        waterMl,           // Total ml today
        waterTarget,       // Target (2000ml)
        waterByPeriod,     // { morning, afternoon, evening, total }
        glassCount: Math.floor(waterMl / GLASS_ML), // Number of glasses
        logWater,          // (amountMl?) => log water intake
        setWaterTotal,     // (amountMl) => replace today's intake total
        reloadWater: loadFromSQLite,
        lastLoggedAt,      // Most recent intake timestamp
        loading,
        error,
    };
}
