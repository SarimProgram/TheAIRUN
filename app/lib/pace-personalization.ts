export type PaceMode = 'running' | 'walking';
export type PaceStatus = 'STARTING' | 'LEARNING' | 'PERSONALISED';
export type PaceTargetKey =
  | 'EASY_RUN'
  | 'LONG_RUN'
  | 'GOAL_PRACTICE'
  | 'BRISK_WALK'
  | 'POWER_WALK'
  | 'LONG_WALK';
export type PerceivedEffort = 'TOO_EASY' | 'ABOUT_RIGHT' | 'TOO_HARD';

export type PaceRange = {
  minPaceSecPerKm: number;
  maxPaceSecPerKm: number;
};

export type PaceModeState = {
  baselinePaceSecPerKm: number | null;
  previousBaselinePaceSecPerKm?: number | null;
  status: PaceStatus;
  sampleCount: number;
  updatedAt?: string | null;
  targetRanges: Partial<Record<PaceTargetKey, PaceRange>>;
};

export type PaceProfile = {
  running: PaceModeState;
  walking: PaceModeState;
  autoAdjust: boolean;
};

export function getPaceTargetKey(value: string | null | undefined): PaceTargetKey | null {
  const normalized = String(value ?? '').trim().toLowerCase().replace(/_/g, ' ');
  if (normalized === 'easy' || normalized === 'easy run') return 'EASY_RUN';
  if (normalized === 'long' || normalized === 'long run') return 'LONG_RUN';
  if (normalized.includes('goal practice')) return 'GOAL_PRACTICE';
  if (normalized === 'walk' || normalized === 'brisk walk') return 'BRISK_WALK';
  if (normalized === 'power walk') return 'POWER_WALK';
  if (normalized === 'long walk') return 'LONG_WALK';
  if (normalized === 'free run' || normalized === 'freeform') return 'EASY_RUN';
  return null;
}

export function getPaceModeForTarget(target: PaceTargetKey | null): PaceMode | null {
  if (target === 'EASY_RUN' || target === 'LONG_RUN' || target === 'GOAL_PRACTICE') return 'running';
  if (target === 'BRISK_WALK' || target === 'POWER_WALK' || target === 'LONG_WALK') return 'walking';
  return null;
}

export function getPaceRange(profile: PaceProfile | null, value: string | null | undefined): PaceRange | null {
  const target = getPaceTargetKey(value);
  const mode = getPaceModeForTarget(target);
  if (!profile || !target || !mode) return null;
  return profile[mode]?.targetRanges?.[target] ?? null;
}

export function formatPace(secPerKm: number | null | undefined): string {
  if (typeof secPerKm !== 'number' || !Number.isFinite(secPerKm) || secPerKm <= 0) return 'Not ready';
  const rounded = Math.round(secPerKm);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')} /km`;
}

export function formatPaceRange(range: PaceRange | null | undefined): string {
  if (!range) return 'Not ready';
  return `${formatPace(range.minPaceSecPerKm).replace(' /km', '')} to ${formatPace(range.maxPaceSecPerKm)}`;
}

export function getPaceStatusText(state: PaceModeState | null | undefined): string {
  if (!state || state.status === 'STARTING') return '';
  if (state.status === 'LEARNING') return `Learning · ${Math.min(3, Math.max(0, state.sampleCount))} of 3 workouts`;
  return 'Personalised from recent workouts';
}

export function getPaceStateForWorkout(profile: PaceProfile | null, value: string | null | undefined): PaceModeState | null {
  const mode = getPaceModeForTarget(getPaceTargetKey(value));
  return mode && profile ? profile[mode] : null;
}

export function getPaceGuidance(currentPaceSecPerKm: number, range: PaceRange | null): string {
  if (!range || !Number.isFinite(currentPaceSecPerKm) || currentPaceSecPerKm <= 0) return 'Find a comfortable rhythm';
  if (currentPaceSecPerKm < range.minPaceSecPerKm) return 'Ease back';
  if (currentPaceSecPerKm > range.maxPaceSecPerKm) return 'Pick it up slightly';
  return 'On pace';
}
