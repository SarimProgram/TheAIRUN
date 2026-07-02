
import { useEffect, useRef, useState, useCallback } from "react";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import type { RunPoint } from "@/types/run";
import { haversineDistanceMeters } from "@/lib/geo";
import { KalmanGPSFilter } from "@/lib/kalman-gps-filter";

// --- BACKGROUND TASK NAME ---
const BACKGROUND_LOCATION_TASK = "background-location-task";

// --- CONFIGURATION ---
const GPS_CONFIG = {
  // Reject points with accuracy worse than this (in meters)
  MIN_ACCURACY: 65,

  // Speed below which we consider the user "stationary" (m/s)
  STATIONARY_SPEED_THRESHOLD: 0.5,

  // Keep the live marker responsive during a run.
  MIN_DISPLACEMENT_FOR_MARKER: 1.5,


  // Commit route points a bit sooner so the trail does not visibly lag.
  MIN_DISPLACEMENT_FOR_ROUTE: 2,


  KALMAN_PROCESS_NOISE: 0.5,

  MIN_UPDATE_INTERVAL_MS: 500,

  MIN_HEADING_UPDATE_INTERVAL_MS: 80,

  MIN_HEADING_DELTA_DEG: 1.5,

  MIN_COMPASS_ACCURACY: 1,

  // Number of consecutive readings showing movement required before updating
  CONSECUTIVE_MOVEMENT_REQUIRED: 1,
};

type RunState = "idle" | "running" | "paused" | "finished";
type SmoothedLocation = { lat: number; lon: number; heading: number | null };

// --- GLOBAL STATE FOR BACKGROUND TASK ---
// Background tasks run outside React, so we need global mutable state
let globalIsTracking = false;
let globalLastRoutePoint: RunPoint | null = null;
let globalKalmanFilter = new KalmanGPSFilter(GPS_CONFIG.KALMAN_PROCESS_NOISE);
let globalAccumulatedDistance = 0;
let globalRoutePoints: RunPoint[] = [];
let globalLastMarker: { lat: number; lon: number } | null = null;
let globalLastHeading: number | null = null;
let globalLastHeadingUpdateTime = 0;
let globalConsecutiveMovement = 0;
let globalLastMarkerUpdateTime = 0;

// Callbacks to update React state (set by the hook)
let onLocationUpdate: ((location: SmoothedLocation) => void) | null = null;
let onRouteUpdate: ((points: RunPoint[]) => void) | null = null;
let onDistanceUpdate: ((distance: number) => void) | null = null;

function normalizeHeading(heading: number): number {
  return ((heading % 360) + 360) % 360;
}

function shortestHeadingDelta(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

function smoothHeading(previous: number | null, next: number, responsiveness = 0.35): number {
  if (previous === null) {
    return normalizeHeading(next);
  }

  return normalizeHeading(previous + shortestHeadingDelta(previous, next) * responsiveness);
}

function calculateBearing(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number }
): number {
  const fromLat = (from.lat * Math.PI) / 180;
  const toLat = (to.lat * Math.PI) / 180;
  const deltaLon = ((to.lon - from.lon) * Math.PI) / 180;

  const y = Math.sin(deltaLon) * Math.cos(toLat);
  const x =
    Math.cos(fromLat) * Math.sin(toLat) -
    Math.sin(fromLat) * Math.cos(toLat) * Math.cos(deltaLon);

  return normalizeHeading((Math.atan2(y, x) * 180) / Math.PI);
}

function getReliableReportedHeading(
  heading: number | null | undefined,
  speed: number | null | undefined
): number | null {
  if (typeof heading !== "number" || !Number.isFinite(heading) || heading < 0) {
    return null;
  }

  if (typeof speed === "number" && Number.isFinite(speed) && speed < GPS_CONFIG.STATIONARY_SPEED_THRESHOLD) {
    return null;
  }

  return normalizeHeading(heading);
}

function resolveHeading(
  currentPos: { lat: number; lon: number },
  previousPos: { lat: number; lon: number } | null,
  reportedHeading: number | null | undefined,
  speed: number | null | undefined
): number | null {
  const sensorHeading = getReliableReportedHeading(reportedHeading, speed);
  if (sensorHeading !== null) {
    return sensorHeading;
  }

  if (!previousPos) {
    return null;
  }

  const displacement = haversineDistanceMeters(previousPos, currentPos);
  if (displacement < GPS_CONFIG.MIN_DISPLACEMENT_FOR_MARKER) {
    return null;
  }

  return calculateBearing(previousPos, currentPos);
}

function updateStoredHeading(nextHeading: number, responsiveness: number): number {
  globalLastHeading = smoothHeading(globalLastHeading, nextHeading, responsiveness);
  globalLastHeadingUpdateTime = Date.now();
  return globalLastHeading;
}

function getCompassHeadingSample(heading: Location.LocationHeadingObject): number | null {
  if (typeof heading.accuracy === "number" && heading.accuracy < GPS_CONFIG.MIN_COMPASS_ACCURACY) {
    return null;
  }

  const preferredHeading =
    typeof heading.trueHeading === "number" && Number.isFinite(heading.trueHeading) && heading.trueHeading >= 0
      ? heading.trueHeading
      : heading.magHeading;

  if (typeof preferredHeading !== "number" || !Number.isFinite(preferredHeading) || preferredHeading < 0) {
    return null;
  }

  return normalizeHeading(preferredHeading);
}

// --- DEFINE BACKGROUND TASK ---
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error("Background location error:", error);
    return;
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };

    for (const loc of locations) {
      processBackgroundLocation(loc);
    }
  }
});

function processBackgroundLocation(loc: Location.LocationObject) {
  const { latitude, longitude, accuracy, speed, altitude, heading } = loc.coords;
  const now = Date.now();

  // 1. HARD FILTER: Accuracy
  if (accuracy && accuracy > GPS_CONFIG.MIN_ACCURACY) {
    return;
  }

  // 2. KALMAN FILTER: Smooth the GPS coordinates
  const effectiveAccuracy = accuracy ?? 15;
  const filtered = globalKalmanFilter.filter(latitude, longitude, effectiveAccuracy);

  const currentPos = { lat: filtered.lat, lon: filtered.lon };
  const previousHeadingReference =
    globalLastMarker ?? (globalLastRoutePoint ? { lat: globalLastRoutePoint.lat, lon: globalLastRoutePoint.lon } : null);
  const resolvedHeading = resolveHeading(currentPos, previousHeadingReference, heading, speed);
  const currentPoint: RunPoint = {
    timestamp: new Date().toISOString(),
    lat: filtered.lat,
    lon: filtered.lon,
    altitude: altitude ?? undefined,
    accuracy: accuracy ?? undefined,
  };

  // 3. STATIONARY DETECTION
  // Some devices frequently report null/negative speed; treat that as "unknown"
  // and derive speed from coordinate displacement instead of forcing stationary.
  let distanceFromLastRoutePoint = 0;
  let derivedSpeed = 0;
  if (globalLastRoutePoint) {
    distanceFromLastRoutePoint = haversineDistanceMeters(globalLastRoutePoint, currentPoint);
    const previousTimestamp = new Date(globalLastRoutePoint.timestamp).getTime();
    const elapsedSeconds = Number.isFinite(previousTimestamp)
      ? Math.max((now - previousTimestamp) / 1000, 0.001)
      : 0.001;
    derivedSpeed = distanceFromLastRoutePoint / elapsedSeconds;
  }

  const reportedSpeed =
    typeof speed === "number" && Number.isFinite(speed) && speed >= 0
      ? speed
      : 0;
  const effectiveSpeed = Math.max(reportedSpeed, derivedSpeed);
  const isStationary = effectiveSpeed < GPS_CONFIG.STATIONARY_SPEED_THRESHOLD;

  // --- VISUAL MARKER LOGIC ---
  let shouldUpdateMarker = false;

  if (!globalLastMarker) {
    shouldUpdateMarker = true;
    globalConsecutiveMovement = 0;
  } else {
    const distFromLastMarker = haversineDistanceMeters(globalLastMarker, currentPos);
    const timeSinceLastUpdate = now - globalLastMarkerUpdateTime;

    const movedEnough = distFromLastMarker > GPS_CONFIG.MIN_DISPLACEMENT_FOR_MARKER;
    const timeOk = timeSinceLastUpdate >= GPS_CONFIG.MIN_UPDATE_INTERVAL_MS;

    if (!isStationary && movedEnough && timeOk) {
      globalConsecutiveMovement++;
      if (globalConsecutiveMovement >= GPS_CONFIG.CONSECUTIVE_MOVEMENT_REQUIRED) {
        shouldUpdateMarker = true;
        globalConsecutiveMovement = 0;
      }
    } else if (isStationary || !movedEnough) {
      globalConsecutiveMovement = 0;
    }
  }

  if (shouldUpdateMarker) {
    globalLastMarker = currentPos;
    globalLastMarkerUpdateTime = now;
    if (resolvedHeading !== null) {
      updateStoredHeading(resolvedHeading, 0.7);
    }
    onLocationUpdate?.({ ...currentPos, heading: globalLastHeading });
  }

  // --- ROUTE & DISTANCE LOGIC ---
  if (globalIsTracking) {
    let shouldAddRoutePoint = false;

    if (!globalLastRoutePoint) {
      shouldAddRoutePoint = true;
    } else {
      if (!isStationary && distanceFromLastRoutePoint > GPS_CONFIG.MIN_DISPLACEMENT_FOR_ROUTE) {
        shouldAddRoutePoint = true;
        globalAccumulatedDistance += distanceFromLastRoutePoint;
        onDistanceUpdate?.(globalAccumulatedDistance);
      }
    }

    if (shouldAddRoutePoint) {
      globalRoutePoints.push(currentPoint);
      globalLastRoutePoint = currentPoint;
      onRouteUpdate?.([...globalRoutePoints]);
    }
  }
}

export function useRunTracker() {
  // --- STATE ---
  const [state, setState] = useState<RunState>("idle");
  const [route, setRoute] = useState<RunPoint[]>([]);

  // "smoothedLocation" is what the UI sees. We lock this when stationary.
  const [smoothedLocation, setSmoothedLocation] = useState<SmoothedLocation | null>(null);

  const [startTime, setStartTime] = useState<Date | null>(null);
  const [pausedAccumulatedTime, setPausedAccumulatedTime] = useState(0); // Time accumulated before pause
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [distanceM, setDistanceM] = useState(0);

  // --- REFS ---
  const isTrackingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runStartTimeRef = useRef<Date | null>(null); // Tracks when the current running segment started
  const foregroundLocationSubRef = useRef<Location.LocationSubscription | null>(null);
  const foregroundHeadingSubRef = useRef<Location.LocationSubscription | null>(null);

  // Derived metrics
  const paceSecPerKm = distanceM > 10 ? elapsedSec / (distanceM / 1000) : 0;

  // --- REGISTER CALLBACKS FOR BACKGROUND TASK ---
  useEffect(() => {
    onLocationUpdate = (loc) => setSmoothedLocation(loc);
    onRouteUpdate = (points) => setRoute(points);
    onDistanceUpdate = (dist) => setDistanceM(dist);

    return () => {
      onLocationUpdate = null;
      onRouteUpdate = null;
      onDistanceUpdate = null;
    };
  }, []);

  // --- TIMER: Calculate elapsed time from Date difference ---
  // This approach works correctly even when the app is backgrounded
  useEffect(() => {
    if (state === "running" && runStartTimeRef.current) {
      timerRef.current = setInterval(() => {
        const now = new Date();
        const runningTime = Math.floor((now.getTime() - runStartTimeRef.current!.getTime()) / 1000);
        setElapsedSec(pausedAccumulatedTime + runningTime);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [state, pausedAccumulatedTime]);

  const stopForegroundWatch = useCallback(() => {
    if (foregroundLocationSubRef.current) {
      foregroundLocationSubRef.current.remove();
      foregroundLocationSubRef.current = null;
    }
  }, []);

  const stopForegroundHeadingWatch = useCallback(() => {
    if (foregroundHeadingSubRef.current) {
      foregroundHeadingSubRef.current.remove();
      foregroundHeadingSubRef.current = null;
    }
  }, []);

  const applyCompassHeading = useCallback((headingSample: Location.LocationHeadingObject) => {
    const nextHeading = getCompassHeadingSample(headingSample);
    if (nextHeading === null) {
      return;
    }

    const now = Date.now();
    const headingDelta =
      globalLastHeading === null ? 180 : Math.abs(shortestHeadingDelta(globalLastHeading, nextHeading));
    const timeSinceLastHeading = now - globalLastHeadingUpdateTime;

    if (
      headingDelta < GPS_CONFIG.MIN_HEADING_DELTA_DEG &&
      timeSinceLastHeading < GPS_CONFIG.MIN_HEADING_UPDATE_INTERVAL_MS * 2
    ) {
      return;
    }

    if (
      timeSinceLastHeading < GPS_CONFIG.MIN_HEADING_UPDATE_INTERVAL_MS &&
      headingDelta < GPS_CONFIG.MIN_HEADING_DELTA_DEG * 3
    ) {
      return;
    }

    const updatedHeading = updateStoredHeading(nextHeading, 0.82);
    setSmoothedLocation((prev) => {
      if (prev) {
        return { ...prev, heading: updatedHeading };
      }

      if (globalLastMarker) {
        return { ...globalLastMarker, heading: updatedHeading };
      }

      return prev;
    });
  }, []);

  const startForegroundWatch = useCallback(async () => {
    stopForegroundWatch();
    try {
      foregroundLocationSubRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 750,
          distanceInterval: 1,
        },
        (loc) => processBackgroundLocation(loc)
      );
    } catch (e) {
      console.warn("Failed to start foreground location watch:", e);
    }
  }, [stopForegroundWatch]);

  const startForegroundHeadingWatch = useCallback(async () => {
    stopForegroundHeadingWatch();
    try {
      foregroundHeadingSubRef.current = await Location.watchHeadingAsync(
        (headingSample) => applyCompassHeading(headingSample)
      );
    } catch (e) {
      console.warn("Failed to start foreground heading watch:", e);
    }
  }, [applyCompassHeading, stopForegroundHeadingWatch]);

  // --- ACTIONS ---

  async function ensureLocationPermission() {
    // Request foreground permission first
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') {
      console.warn("Foreground permission denied");
      return false;
    }

    // Request background permission for tracking when app is backgrounded
    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    if (backgroundStatus !== 'granted') {
      console.warn("Background permission denied - tracking may stop when app is in background");
      // Continue anyway - foreground will still work
    }

    return true;
  }

  async function startRun() {
    // 1. Permissions
    const hasPermission = await ensureLocationPermission();
    if (!hasPermission) {
      alert("Location permission is required to track your run.");
      return false;
    }

    // 2. Reset global state
    globalIsTracking = true;
    globalLastRoutePoint = null;
    globalAccumulatedDistance = 0;
    globalRoutePoints = [];
    globalLastMarker = null;
    globalLastHeading = null;
    globalLastHeadingUpdateTime = 0;
    globalConsecutiveMovement = 0;
    globalLastMarkerUpdateTime = 0;
    globalKalmanFilter.reset();

    // 3. State Reset
    setRoute([]);
    setDistanceM(0);
    setElapsedSec(0);
    setPausedAccumulatedTime(0);
    const now = new Date();
    setStartTime(now);
    runStartTimeRef.current = now;
    setEndTime(null);
    setState("running");
    isTrackingRef.current = true;

    // 4. Get Initial Fix (Non-blocking)
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation })
      .then((initialLoc) => {
        if (initialLoc) {
          const { latitude, longitude, heading, speed } = initialLoc.coords;
          const pos = { lat: latitude, lon: longitude };
          const initialHeading = resolveHeading(pos, null, heading, speed);
          if (initialHeading !== null) {
            updateStoredHeading(initialHeading, 1);
          }
          setSmoothedLocation((prev) => prev || { ...pos, heading: initialHeading });
          if (!globalLastMarker) globalLastMarker = pos;
        }
      })
      .catch((e) => console.log("Initial fetch failed", e));

    // 5. Start foreground updates for immediate tracking reliability.
    // Background task is still started below for background continuity.
    await startForegroundWatch();
    await startForegroundHeadingWatch();

    // 6. Start Background Location Updates
    // This continues running even when the app is backgrounded
    try {
      const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
      if (isTaskRegistered) {
        await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      }

      await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
        accuracy: Location.Accuracy.High,
        timeInterval: 1500,
        distanceInterval: 5,
        activityType: Location.ActivityType.Fitness,
        showsBackgroundLocationIndicator: true, // iOS: shows blue bar when tracking in background
        foregroundService: {
          notificationTitle: "Run Tracking Active",
          notificationBody: "Your run is being tracked in the background",
          notificationColor: "#EF4444",
        },
        pausesUpdatesAutomatically: false,
      });
    } catch (e) {
      console.error("Failed to start background location updates:", e);
      // Fallback: the foreground updates should still work
    }

    return true;
  }

  function pauseRun() {
    setState("paused");
    isTrackingRef.current = false;
    globalIsTracking = false;

    // Save current elapsed time
    if (runStartTimeRef.current) {
      const now = new Date();
      const runningTime = Math.floor((now.getTime() - runStartTimeRef.current.getTime()) / 1000);
      setPausedAccumulatedTime(prev => prev + runningTime);
    }
    runStartTimeRef.current = null;
    stopForegroundWatch();
    stopForegroundHeadingWatch();
  }

  async function resumeRun() {
    setState("running");
    isTrackingRef.current = true;
    globalIsTracking = true;
    runStartTimeRef.current = new Date();
    await startForegroundWatch();
    await startForegroundHeadingWatch();
  }

  async function finishRun() {
    setState("finished");
    isTrackingRef.current = false;
    globalIsTracking = false;
    setEndTime(new Date());
    stopForegroundWatch();
    stopForegroundHeadingWatch();

    // Stop background location updates
    try {
      const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
      if (isTaskRegistered) {
        await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      }
    } catch (e) {
      console.error("Failed to stop background location updates:", e);
    }
  }

  async function resetRun() {
    await finishRun();
    setState("idle");
    setRoute([]);
    setDistanceM(0);
    setElapsedSec(0);
    setPausedAccumulatedTime(0);
    setSmoothedLocation(null);
    runStartTimeRef.current = null;
    stopForegroundWatch();
    stopForegroundHeadingWatch();

    // Reset global state
    globalLastRoutePoint = null;
    globalAccumulatedDistance = 0;
    globalRoutePoints = [];
    globalLastMarker = null;
    globalLastHeading = null;
    globalLastHeadingUpdateTime = 0;
    globalKalmanFilter.reset();
  }

  // --- CLEANUP ---
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      stopForegroundWatch();
      stopForegroundHeadingWatch();
      // Stop background location on unmount
      TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK).then((isRegistered) => {
        if (isRegistered) {
          Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
        }
      });
    };
  }, [stopForegroundHeadingWatch, stopForegroundWatch]);

  return {
    state,
    route,
    smoothedLocation,
    startTime,
    endTime,
    elapsedSec,
    distanceM,
    paceSecPerKm,
    startRun,
    pauseRun,
    resumeRun,
    finishRun,
    resetRun,
  };
}
