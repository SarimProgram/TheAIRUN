// app/tasks/backgroundStepSync.ts
// Background task for syncing steps when app is closed

import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { getAccessToken } from '../utils/authstorage';
import {
    syncCurrentHealthStepsToBackend,
} from '../lib/step-sync';

export const BACKGROUND_STEP_SYNC_TASK = 'background-step-sync';
let backgroundStepTaskDefined = false;

/**
 * Background task handler - called by the OS when background work fires
 */
async function backgroundStepSyncHandler(): Promise<BackgroundTask.BackgroundTaskResult> {
    const startTime = Date.now();
    console.log('[BackgroundStepSync] Task started at:', new Date().toISOString());

    try {
        // Check platform support
        if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
            console.log('[BackgroundStepSync] Platform not supported');
            return BackgroundTask.BackgroundTaskResult.Success;
        }

        const accessToken = await getAccessToken();
        if (!accessToken) {
            console.log('[BackgroundStepSync] No access token, skipping sync');
            return BackgroundTask.BackgroundTaskResult.Success;
        }

        const result = await syncCurrentHealthStepsToBackend(accessToken);
        console.log('[BackgroundStepSync] Sync result:', result);

        const duration = Date.now() - startTime;
        console.log(`[BackgroundStepSync] Task completed in ${duration}ms`);

        return BackgroundTask.BackgroundTaskResult.Success;
    } catch (error) {
        console.error('[BackgroundStepSync] Task failed:', error);
        return BackgroundTask.BackgroundTaskResult.Failed;
    }
}

function ensureBackgroundStepTaskDefined(): void {
    if (backgroundStepTaskDefined || TaskManager.isTaskDefined(BACKGROUND_STEP_SYNC_TASK)) {
        backgroundStepTaskDefined = true;
        return;
    }

    TaskManager.defineTask(BACKGROUND_STEP_SYNC_TASK, backgroundStepSyncHandler);
    backgroundStepTaskDefined = true;
}

// Define the task at module import time for background launches.
ensureBackgroundStepTaskDefined();

/**
 * Register the background task with the OS
 * Call this from _layout.tsx on app start
 */
export async function registerBackgroundStepSync(): Promise<void> {
    try {
        ensureBackgroundStepTaskDefined();

        // Check if already registered
        const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_STEP_SYNC_TASK);

        if (isRegistered) {
            console.log('[BackgroundStepSync] Task already registered');
            return;
        }

        // Expo background-task uses minutes, not seconds.
        await BackgroundTask.registerTaskAsync(BACKGROUND_STEP_SYNC_TASK, {
            minimumInterval: 15,
        });

        console.log('[BackgroundStepSync] Task registered successfully');
    } catch (error) {
        console.error('[BackgroundStepSync] Failed to register task:', error);
    }
}

/**
 * Unregister the background task (if needed)
 */
export async function unregisterBackgroundStepSync(): Promise<void> {
    try {
        await BackgroundTask.unregisterTaskAsync(BACKGROUND_STEP_SYNC_TASK);
        console.log('[BackgroundStepSync] Task unregistered');
    } catch (error) {
        console.error('[BackgroundStepSync] Failed to unregister task:', error);
    }
}

/**
 * Check the status of the background task service
 */
export async function getBackgroundStepSyncStatus(): Promise<BackgroundTask.BackgroundTaskStatus | null> {
    return BackgroundTask.getStatusAsync();
}
