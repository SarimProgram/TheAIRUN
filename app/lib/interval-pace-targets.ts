import type { PaceProfile } from '@/lib/pace-personalization';
import { buildPhasePaceTarget, resolveMainPaceRange } from '@/lib/run-pace-targets';
import { getRunTemplate } from '@/lib/run-templates';
import type { IntervalWorkoutStep } from '@/lib/interval-workout';

const DEFAULT_RUNNING_BASELINE_SEC_PER_KM = 540;
const DEFAULT_WALKING_BASELINE_SEC_PER_KM = 810;
const INTERVAL_HARD_FACTOR = 0.9;
const INTERVAL_WALK_BUFFER_SEC = 5;

export interface IntervalRunPaceTargets {
  easySecPerKm: number;
  hardSecPerKm: number;
  runningBaselineSecPerKm: number;
}

export interface IntervalWalkPaceTargets {
  recoverySecPerKm: number;
  fastSecPerKm: number;
  walkingBaselineSecPerKm: number;
}

function midpoint(minPaceSecPerKm: number, maxPaceSecPerKm: number) {
  return Math.round((minPaceSecPerKm + maxPaceSecPerKm) / 2);
}

function runningBaseline(profile: PaceProfile | null | undefined) {
  return profile?.running?.baselinePaceSecPerKm ?? DEFAULT_RUNNING_BASELINE_SEC_PER_KM;
}

function walkingBaseline(profile: PaceProfile | null | undefined) {
  return profile?.walking?.baselinePaceSecPerKm ?? DEFAULT_WALKING_BASELINE_SEC_PER_KM;
}

export function buildIntervalRunPaceTargets(profile: PaceProfile | null | undefined): IntervalRunPaceTargets {
  const template = getRunTemplate('interval');
  const easyRange = resolveMainPaceRange(profile, 'EASY_RUN', template);
  const baseline = runningBaseline(profile);

  return {
    easySecPerKm: buildPhasePaceTarget(easyRange, 'warmup').targetPaceSecPerKm,
    hardSecPerKm: Math.round(baseline * INTERVAL_HARD_FACTOR),
    runningBaselineSecPerKm: baseline,
  };
}

export function buildIntervalWalkPaceTargets(profile: PaceProfile | null | undefined): IntervalWalkPaceTargets {
  const template = getRunTemplate('interval_walk');
  const longRange = resolveMainPaceRange(profile, 'LONG_WALK', template);
  const powerRange = resolveMainPaceRange(profile, 'POWER_WALK', template);
  const baseline = walkingBaseline(profile);

  return {
    recoverySecPerKm: buildPhasePaceTarget(longRange, 'warmup').targetPaceSecPerKm,
    fastSecPerKm: midpoint(powerRange.minPaceSecPerKm, powerRange.maxPaceSecPerKm),
    walkingBaselineSecPerKm: baseline,
  };
}

function isHardIntervalStep(step: IntervalWorkoutStep) {
  return step.type === 'run';
}

function isFastWalkStep(step: IntervalWorkoutStep) {
  if (step.type === 'run') return true;
  const label = (step.label || '').trim().toLowerCase();
  return label.includes('fast') || label.includes('brisk') || label.includes('work') || label.includes('interval');
}

function deriveDurationSec(distanceKm: number, paceSecPerKm: number) {
  if (!distanceKm || distanceKm <= 0 || !paceSecPerKm || paceSecPerKm <= 0) return undefined;
  return Math.max(10, Math.round(distanceKm * paceSecPerKm) + INTERVAL_WALK_BUFFER_SEC);
}

export function applyIntervalRunTargetsToSteps(
  steps: IntervalWorkoutStep[],
  targets: IntervalRunPaceTargets,
): IntervalWorkoutStep[] {
  return steps.map((step) => {
    const paceSecPerKm = isHardIntervalStep(step) ? targets.hardSecPerKm : targets.easySecPerKm;
    const distanceKm = step.distanceKm > 0 ? step.distanceKm : 0;

    return {
      ...step,
      distanceKm,
      durationSec: distanceKm > 0
        ? deriveDurationSec(distanceKm, paceSecPerKm) ?? step.durationSec
        : step.durationSec,
      target: {
        effort: step.target?.effort ?? (isHardIntervalStep(step) ? 'Hard' : 'Easy'),
        paceSecPerKm,
      },
    };
  });
}

export function applyIntervalWalkTargetsToSteps(
  steps: IntervalWorkoutStep[],
  targets: IntervalWalkPaceTargets,
): IntervalWorkoutStep[] {
  return steps.map((step) => {
    const paceSecPerKm = isFastWalkStep(step) ? targets.fastSecPerKm : targets.recoverySecPerKm;
    const distanceKm = step.distanceKm > 0
      ? step.distanceKm
      : step.durationSec
        ? Math.max(0.01, Math.round((step.durationSec / paceSecPerKm) * 1000) / 1000)
        : 0;

    return {
      ...step,
      distanceKm,
      durationSec: distanceKm > 0
        ? deriveDurationSec(distanceKm, paceSecPerKm) ?? step.durationSec
        : step.durationSec,
      target: {
        effort: step.target?.effort ?? (isFastWalkStep(step) ? 'Steady' : 'Easy'),
        paceSecPerKm,
      },
    };
  });
}
