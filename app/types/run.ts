// app/types/run.ts

export const RUN_ACTIVITY_TYPES = [
  'Easy Run',
  'Recovery Run',
  'Long Run',
  'Interval Run',
  'Power Walk',
  'Long Walk',
] as const;

export type RunActivityType = typeof RUN_ACTIVITY_TYPES[number];

export type RunPoint = {
  timestamp: string; // ISO string
  lat: number;
  lon: number;
  altitude?: number;
  accuracy?: number;
};

export type Run = {
  id: string;
  startedAt: string; // ISO
  endedAt: string;   // ISO
  durationSeconds: number;

  totalDistanceMeters: number;
  avgPaceSecPerKm: number | null;

  route: RunPoint[];

  // Optional future fields
  notes?: string;
  calories?: number;
};
