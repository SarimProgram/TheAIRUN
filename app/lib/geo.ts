// app/lib/geo.ts

import type { RunPoint } from "@/types/run";

const R = 6371000; // Earth radius in meters

// Coordinate type that only requires lat/lon (more flexible than RunPoint)
type Coordinate = { lat: number; lon: number };

export function haversineDistanceMeters(a: Coordinate, b: Coordinate): number {
  const toRad = (v: number) => (v * Math.PI) / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);

  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);

  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;

  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

  return R * c;
}
