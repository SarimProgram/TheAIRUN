import { haversineDistanceMeters } from "@/lib/geo";

export type LoopPoint = { latitude: number; longitude: number };

export type GeneratedLoopRoute = {
  coordinates: LoopPoint[];
  estimatedDistanceMeters: number;
};

type OsrmRouteResponse = {
  code?: string;
  routes?: Array<{
    distance?: number;
    geometry?: {
      coordinates?: number[][];
      type?: string;
    };
  }>;
};

const METERS_PER_DEG_LAT = 111_111;
const MIN_TARGET_METERS = 1_000;
const MAX_TARGET_METERS = 50_000;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function metersToLatLon(
  anchor: { lat: number; lon: number },
  eastMeters: number,
  northMeters: number
): LoopPoint {
  const latRad = (anchor.lat * Math.PI) / 180;
  const metersPerDegLon = Math.max(1, METERS_PER_DEG_LAT * Math.cos(latRad));
  const latitude = anchor.lat + northMeters / METERS_PER_DEG_LAT;
  const longitude = anchor.lon + eastMeters / metersPerDegLon;
  return { latitude, longitude };
}

function estimateDistanceMeters(coords: LoopPoint[]): number {
  if (coords.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += haversineDistanceMeters(
      { lat: coords[i - 1].latitude, lon: coords[i - 1].longitude },
      { lat: coords[i].latitude, lon: coords[i].longitude }
    );
  }
  return total;
}

function buildLoop(
  anchor: { lat: number; lon: number },
  baseRadiusMeters: number
): LoopPoint[] {
  // Slightly varied radii make the loop feel less artificial than a perfect circle.
  const shape = [
    { angleDeg: 0, radiusMult: 1.0 },
    { angleDeg: 45, radiusMult: 0.92 },
    { angleDeg: 90, radiusMult: 1.06 },
    { angleDeg: 135, radiusMult: 0.9 },
    { angleDeg: 180, radiusMult: 1.02 },
    { angleDeg: 225, radiusMult: 0.94 },
    { angleDeg: 270, radiusMult: 1.08 },
    { angleDeg: 315, radiusMult: 0.9 },
  ];

  const points = shape.map(({ angleDeg, radiusMult }) => {
    const angle = (angleDeg * Math.PI) / 180;
    const radius = baseRadiusMeters * radiusMult;
    const east = Math.cos(angle) * radius;
    const north = Math.sin(angle) * radius;
    return metersToLatLon(anchor, east, north);
  });

  if (points.length > 0) {
    points.push({ ...points[0] });
  }

  return points;
}

export function generateApproxLoopRoute(
  anchor: { lat: number; lon: number },
  targetDistanceMeters: number
): GeneratedLoopRoute {
  const safeTarget = clamp(targetDistanceMeters || 0, MIN_TARGET_METERS, MAX_TARGET_METERS);

  // First approximation uses circular perimeter L = 2*pi*r.
  let radius = safeTarget / (2 * Math.PI);
  let coordinates = buildLoop(anchor, radius);
  let estimatedDistanceMeters = estimateDistanceMeters(coordinates);

  // Scale a few times to tighten the estimate.
  for (let i = 0; i < 3; i++) {
    if (!estimatedDistanceMeters || !Number.isFinite(estimatedDistanceMeters)) break;
    const scale = safeTarget / estimatedDistanceMeters;
    if (!Number.isFinite(scale) || scale <= 0) break;
    radius *= scale;
    coordinates = buildLoop(anchor, radius);
    estimatedDistanceMeters = estimateDistanceMeters(coordinates);
  }

  const hasInvalidCoord = coordinates.some(
    (p) => !Number.isFinite(p.latitude) || !Number.isFinite(p.longitude)
  );
  if (hasInvalidCoord || !Number.isFinite(estimatedDistanceMeters)) {
    const fallback = buildLoop(anchor, safeTarget / (2 * Math.PI));
    return {
      coordinates: fallback,
      estimatedDistanceMeters: estimateDistanceMeters(fallback),
    };
  }

  return { coordinates, estimatedDistanceMeters };
}

function toCoordString(coords: LoopPoint[]): string {
  return coords.map((p) => `${p.longitude},${p.latitude}`).join(";");
}

function ensureClosed(coords: LoopPoint[]): LoopPoint[] {
  if (coords.length < 2) return coords;
  const first = coords[0];
  const last = coords[coords.length - 1];
  const gap = haversineDistanceMeters(
    { lat: first.latitude, lon: first.longitude },
    { lat: last.latitude, lon: last.longitude }
  );
  if (gap <= 8) return coords;
  return [...coords, { ...first }];
}

function pickRoadWaypoints(anchor: { lat: number; lon: number }, targetDistanceMeters: number): LoopPoint[] {
  const approx = generateApproxLoopRoute(anchor, targetDistanceMeters).coordinates;
  const start = { latitude: anchor.lat, longitude: anchor.lon };
  // Use a reduced set of loop-shaping points, but force the route to start/end at current position.
  const selected = [
    start,
    approx[0],
    approx[2],
    approx[4],
    approx[6],
    start,
  ].filter(Boolean) as LoopPoint[];

  if (selected.length >= 2) return selected;
  return ensureClosed([start, ...approx, start]);
}

function pickRoadWaypointSets(anchor: { lat: number; lon: number }, targetDistanceMeters: number): LoopPoint[][] {
  const approx = generateApproxLoopRoute(anchor, targetDistanceMeters).coordinates;
  const start = { latitude: anchor.lat, longitude: anchor.lon };
  const patterns = [
    [1, 3, 5],
    [0, 2, 5],
    [1, 4, 6],
  ];

  const waypointSets = patterns
    .map((pattern) => [
      start,
      ...pattern
        .map((idx) => approx[idx])
        .filter((point): point is LoopPoint => Boolean(point)),
      start,
    ])
    .filter((set) => set.length >= 4);

  return waypointSets.length > 0 ? waypointSets : [pickRoadWaypoints(anchor, targetDistanceMeters)];
}

function estimateRepeatPenalty(coords: LoopPoint[]): number {
  if (coords.length < 12) return 0;

  const step = Math.max(1, Math.floor(coords.length / 60));
  const seen = new Map<string, number>();
  let penalty = 0;

  for (let i = 1; i < coords.length - 1; i += step) {
    const point = coords[i];
    const key = `${point.latitude.toFixed(4)}:${point.longitude.toFixed(4)}`;
    const previousIndex = seen.get(key);

    if (previousIndex !== undefined && i - previousIndex > step * 2) {
      penalty += 120;
    } else if (previousIndex === undefined) {
      seen.set(key, i);
    }
  }

  return penalty;
}

function scoreRoadLoopCandidate(candidate: GeneratedLoopRoute, targetDistanceMeters: number): number {
  const distanceError = Math.abs(candidate.estimatedDistanceMeters - targetDistanceMeters);
  const overshootPenalty = Math.max(0, candidate.estimatedDistanceMeters - targetDistanceMeters) * 1.75;
  const repeatPenalty = estimateRepeatPenalty(candidate.coordinates);
  return distanceError + overshootPenalty + repeatPenalty;
}

async function fetchOsrmRoute(
  baseUrl: string,
  profile: "foot" | "driving" | "cycling",
  waypoints: LoopPoint[]
): Promise<GeneratedLoopRoute> {
  const url = `${baseUrl}/route/v1/${profile}/${toCoordString(waypoints)}?overview=full&geometries=geojson&steps=false&continue_straight=false`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);

  const data = (await res.json()) as OsrmRouteResponse;
  if (data.code !== "Ok" || !data.routes?.length) {
    throw new Error(`OSRM route error: ${data.code || "unknown"}`);
  }

  const best = data.routes[0];
  const rawCoords = best.geometry?.coordinates || [];
  const coordinates = ensureClosed(
    rawCoords
      .filter((c) => Array.isArray(c) && c.length >= 2)
      .map((c) => ({ longitude: c[0], latitude: c[1] }))
      .filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
  );

  if (coordinates.length < 2) {
    throw new Error("OSRM returned an empty geometry");
  }

  const estimatedDistanceMeters = Number.isFinite(best.distance)
    ? Number(best.distance)
    : estimateDistanceMeters(coordinates);

  return { coordinates, estimatedDistanceMeters };
}

export async function generateRoadLoopRoute(
  anchor: { lat: number; lon: number },
  targetDistanceMeters: number,
  options?: {
    osrmBaseUrl?: string;
    profile?: "foot" | "driving" | "cycling";
  }
): Promise<GeneratedLoopRoute> {
  const baseUrl = (options?.osrmBaseUrl || "https://router.project-osrm.org").replace(/\/$/, "");
  const target = clamp(targetDistanceMeters || 0, MIN_TARGET_METERS, MAX_TARGET_METERS);

  const profiles: Array<"foot" | "driving" | "cycling"> = [];
  if (options?.profile) profiles.push(options.profile);
  profiles.push("foot", "cycling", "driving");

  let lastError: unknown = null;

  for (const profile of [...new Set(profiles)]) {
    try {
      let waypointTargetMeters = target;
      let bestCandidate: GeneratedLoopRoute | null = null;
      let bestScore = Number.POSITIVE_INFINITY;
      let bestUnderCandidate: GeneratedLoopRoute | null = null;
      let bestUnderError = Number.POSITIVE_INFINITY;

      for (let i = 0; i < 5; i++) {
        const waypointSets = pickRoadWaypointSets(anchor, waypointTargetMeters);
        let bestIterationCandidate: GeneratedLoopRoute | null = null;
        let bestIterationScore = Number.POSITIVE_INFINITY;

        for (const waypoints of waypointSets) {
          try {
            const candidate = await fetchOsrmRoute(baseUrl, profile, waypoints);
            const error = Math.abs(candidate.estimatedDistanceMeters - target);
            const score = scoreRoadLoopCandidate(candidate, target);

            if (!bestCandidate || score < bestScore) {
              bestCandidate = candidate;
              bestScore = score;
            }

            const withinPreferredCeiling = candidate.estimatedDistanceMeters <= target * 1.05;
            if (withinPreferredCeiling && error < bestUnderError) {
              bestUnderCandidate = candidate;
              bestUnderError = error;
            }

            if (!bestIterationCandidate || score < bestIterationScore) {
              bestIterationCandidate = candidate;
              bestIterationScore = score;
            }
          } catch (err) {
            lastError = err;
          }
        }

        if (!bestIterationCandidate) continue;

        const iterationDistance = bestIterationCandidate.estimatedDistanceMeters;
        const withinTolerance =
          iterationDistance >= target * 0.9
          && iterationDistance <= target * 1.05;
        if (withinTolerance) break;

        const ratio = target / Math.max(1, iterationDistance);
        const adjustment = iterationDistance > target
          ? clamp(ratio * 0.88, 0.4, 0.9)
          : clamp(ratio, 0.72, 1.2);
        waypointTargetMeters = clamp(waypointTargetMeters * adjustment, MIN_TARGET_METERS, MAX_TARGET_METERS);
      }

      if (bestUnderCandidate) {
        return bestUnderCandidate;
      }

      if (bestCandidate) {
        return bestCandidate;
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("Failed to generate road loop route");
}
