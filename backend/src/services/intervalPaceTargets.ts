import { calculateTargetRanges, DEFAULT_WALKING_PACE } from './pacePersonalisation';

const DEFAULT_RUNNING_PACE = 540;
const WARMUP_PACE_FACTOR = 1.12;
const INTERVAL_HARD_FACTOR = 0.9;

function midpoint(range: { minPaceSecPerKm: number; maxPaceSecPerKm: number }) {
  return Math.round((range.minPaceSecPerKm + range.maxPaceSecPerKm) / 2);
}

export function buildIntervalRunPaceTargets(runningBaselineSecPerKm?: number | null) {
  const baseline = runningBaselineSecPerKm ?? DEFAULT_RUNNING_PACE;
  const ranges = calculateTargetRanges(baseline, DEFAULT_WALKING_PACE);
  const easyMid = midpoint(ranges.EASY_RUN);

  return {
    easySecPerKm: Math.round(easyMid * WARMUP_PACE_FACTOR),
    hardSecPerKm: Math.round(baseline * INTERVAL_HARD_FACTOR),
    runningBaselineSecPerKm: baseline,
  };
}

export function buildIntervalWalkPaceTargets(walkingBaselineSecPerKm?: number | null) {
  const baseline = walkingBaselineSecPerKm ?? DEFAULT_WALKING_PACE;
  const ranges = calculateTargetRanges(DEFAULT_RUNNING_PACE, baseline);
  const longMid = midpoint(ranges.LONG_WALK);

  return {
    recoverySecPerKm: Math.round(longMid * WARMUP_PACE_FACTOR),
    fastSecPerKm: midpoint(ranges.POWER_WALK),
    walkingBaselineSecPerKm: baseline,
  };
}
