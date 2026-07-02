// app/hooks/useRaceTracker.ts
// GPS tracking hook optimized for real-time racing with partner

import { useEffect, useRef, useState, useCallback } from 'react';
import * as Location from 'expo-location';
import { KalmanGPSFilter } from '@/lib/kalman-gps-filter';

// --- RACE-OPTIMIZED CONFIGURATION ---
// Tuned for faster response while maintaining accuracy
const RACE_GPS_CONFIG = {
    // Accept readings with slightly worse accuracy for speed
    MIN_ACCURACY: 40,

    // Lower threshold - racing involves quick starts/stops
    STATIONARY_SPEED_THRESHOLD: 0.3,

    // Keep race distance responsive. At a normal pace, 1s GPS samples are often
    // only 2-4m apart, so a 5m threshold undercounts badly while the map still moves.
    MIN_DISPLACEMENT_FOR_DISTANCE: 2,

    // Higher process noise = more responsive to movement
    // (Run.tsx uses 0.5, we use 2 for faster reaction)
    KALMAN_PROCESS_NOISE: 2,

    // Faster updates for real-time racing feel
    MIN_UPDATE_INTERVAL_MS: 800,

    // Only require 1 consecutive reading for racing responsiveness
    CONSECUTIVE_MOVEMENT_REQUIRED: 1,
};

export interface RacePosition {
    latitude: number;
    longitude: number;
    distanceCovered: number;
    speed: number;
    accuracy: number;
    timestamp: number;
}

interface UseRaceTrackerResult {
    isTracking: boolean;
    currentPosition: RacePosition | null;
    distanceM: number;
    speedMps: number;
    elapsedSec: number;
    hasPermission: boolean | null;

    startTracking: () => Promise<boolean>;
    stopTracking: () => void;
    resetTracker: () => void;
}

/**
 * Haversine distance calculation in meters
 */
function haversineDistanceMeters(
    p1: { lat: number; lon: number },
    p2: { lat: number; lon: number }
): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (p1.lat * Math.PI) / 180;
    const φ2 = (p2.lat * Math.PI) / 180;
    const Δφ = ((p2.lat - p1.lat) * Math.PI) / 180;
    const Δλ = ((p2.lon - p1.lon) * Math.PI) / 180;

    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

export function useRaceTracker(): UseRaceTrackerResult {
    // --- STATE ---
    const [isTracking, setIsTracking] = useState(false);
    const [currentPosition, setCurrentPosition] = useState<RacePosition | null>(null);
    const [distanceM, setDistanceM] = useState(0);
    const [speedMps, setSpeedMps] = useState(0);
    const [elapsedSec, setElapsedSec] = useState(0);
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);

    // --- REFS ---
    const locationSubRef = useRef<Location.LocationSubscription | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const startTimeRef = useRef<number | null>(null);

    // Last processed position for speed estimation.
    const lastPositionRef = useRef<{ lat: number; lon: number } | null>(null);

    // Last position that actually contributed to distance. This keeps small
    // valid movements from being discarded one GPS update at a time.
    const lastDistancePositionRef = useRef<{ lat: number; lon: number } | null>(null);
    const lastUpdateTimeRef = useRef<number>(0);

    // Kalman filter with race-tuned process noise
    const kalmanFilterRef = useRef(new KalmanGPSFilter(RACE_GPS_CONFIG.KALMAN_PROCESS_NOISE));

    // Consecutive movement counter
    const consecutiveMovementRef = useRef<number>(0);

    // Running distance accumulator ref for atomic updates
    const distanceRef = useRef<number>(0);

    // --- LOCATION PROCESSING ---
    const processLocationUpdate = useCallback((loc: Location.LocationObject) => {
        const { latitude, longitude, accuracy, speed } = loc.coords;
        const now = Date.now();
        const previousPosition = lastPositionRef.current;
        const previousDistancePosition = lastDistancePositionRef.current;
        const previousTimestamp = lastUpdateTimeRef.current;

        // 1. ACCURACY FILTER - Reject poor GPS readings
        if (accuracy && accuracy > RACE_GPS_CONFIG.MIN_ACCURACY) {
            return;
        }

        // 2. TIME THROTTLE - Avoid processing too frequently
        const timeSinceLastUpdate = previousTimestamp > 0 ? now - previousTimestamp : Number.POSITIVE_INFINITY;
        if (previousTimestamp > 0 && timeSinceLastUpdate < RACE_GPS_CONFIG.MIN_UPDATE_INTERVAL_MS) {
            return;
        }

        // 3. KALMAN FILTER - Smooth the GPS coordinates
        const effectiveAccuracy = accuracy ?? 15;
        const filtered = kalmanFilterRef.current.filter(latitude, longitude, effectiveAccuracy);
        const filteredPos = { lat: filtered.lat, lon: filtered.lon };

        // 4. MOTION ESTIMATION
        let segmentDistance = 0;
        let derivedSpeed = 0;
        if (previousPosition && previousTimestamp > 0) {
            segmentDistance = haversineDistanceMeters(previousPosition, filteredPos);
            const elapsedSeconds = Math.max(timeSinceLastUpdate / 1000, 0.001);
            derivedSpeed = segmentDistance / elapsedSeconds;
        }

        const reportedSpeed = typeof speed === 'number' && Number.isFinite(speed) ? Math.max(speed, 0) : 0;
        const effectiveSpeed = Math.max(reportedSpeed, derivedSpeed);
        const isStationary = effectiveSpeed < RACE_GPS_CONFIG.STATIONARY_SPEED_THRESHOLD;

        // 5. DISTANCE ACCUMULATION
        if (!previousDistancePosition) {
            lastDistancePositionRef.current = filteredPos;
        } else {
            const distanceSinceLastCountedPoint = haversineDistanceMeters(previousDistancePosition, filteredPos);

            // Only accumulate if moving and distance is significant
            if (!isStationary && distanceSinceLastCountedPoint > RACE_GPS_CONFIG.MIN_DISPLACEMENT_FOR_DISTANCE) {
                consecutiveMovementRef.current++;

                if (consecutiveMovementRef.current >= RACE_GPS_CONFIG.CONSECUTIVE_MOVEMENT_REQUIRED) {
                    distanceRef.current += distanceSinceLastCountedPoint;
                    setDistanceM(distanceRef.current);
                    lastDistancePositionRef.current = filteredPos;
                    consecutiveMovementRef.current = 0;
                }
            } else {
                consecutiveMovementRef.current = 0;
            }
        }

        // Use the latest accepted filtered coordinate as the next baseline.
        lastPositionRef.current = filteredPos;

        // 6. UPDATE CURRENT POSITION (for UI and sending to partner)
        const position: RacePosition = {
            latitude: filtered.lat,
            longitude: filtered.lon,
            distanceCovered: distanceRef.current,
            speed: effectiveSpeed,
            accuracy: effectiveAccuracy,
            timestamp: now,
        };

        setCurrentPosition(position);
        setSpeedMps(effectiveSpeed);
        lastUpdateTimeRef.current = now;

    }, []);

    // --- ACTIONS ---

    const startTracking = useCallback(async (): Promise<boolean> => {
        // Request permission
        const { status } = await Location.requestForegroundPermissionsAsync();
        const granted = status === 'granted';
        setHasPermission(granted);

        if (!granted) {
            return false;
        }

        // Reset state
        setDistanceM(0);
        setElapsedSec(0);
        setSpeedMps(0);
        setCurrentPosition(null);
        distanceRef.current = 0;
        lastPositionRef.current = null;
        lastDistancePositionRef.current = null;
        lastUpdateTimeRef.current = 0;
        consecutiveMovementRef.current = 0;
        kalmanFilterRef.current.reset();

        startTimeRef.current = Date.now();
        setIsTracking(true);

        // Start timer
        timerRef.current = setInterval(() => {
            if (startTimeRef.current) {
                setElapsedSec(Math.floor((Date.now() - startTimeRef.current) / 1000));
            }
        }, 1000);

        // Start location watcher with race-optimized settings
        locationSubRef.current = await Location.watchPositionAsync(
            {
                accuracy: Location.Accuracy.High, // High but not BestForNavigation (too noisy)
                timeInterval: 1000,               // Check every 1 second
                distanceInterval: 1,              // Allow short race segments to register in progress
            },
            processLocationUpdate
        );

        // Get initial position
        try {
            const initial = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
            });
            processLocationUpdate(initial);
        } catch (e) {
            console.log('[RaceTracker] Initial position fetch failed:', e);
        }

        return true;
    }, [processLocationUpdate]);

    const stopTracking = useCallback(() => {
        setIsTracking(false);

        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        if (locationSubRef.current) {
            locationSubRef.current.remove();
            locationSubRef.current = null;
        }
    }, []);

    const resetTracker = useCallback(() => {
        stopTracking();
        setDistanceM(0);
        setElapsedSec(0);
        setSpeedMps(0);
        setCurrentPosition(null);
        distanceRef.current = 0;
        lastPositionRef.current = null;
        lastDistancePositionRef.current = null;
        lastUpdateTimeRef.current = 0;
        consecutiveMovementRef.current = 0;
        kalmanFilterRef.current.reset();
        startTimeRef.current = null;
    }, [stopTracking]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (locationSubRef.current) locationSubRef.current.remove();
        };
    }, []);

    return {
        isTracking,
        currentPosition,
        distanceM,
        speedMps,
        elapsedSec,
        hasPermission,
        startTracking,
        stopTracking,
        resetTracker,
    };
}
