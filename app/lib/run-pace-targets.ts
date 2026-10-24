import type { RunTemplate, RunType } from '@/types/RunTemplate';
import {
  getPaceModeForTarget,
  getPaceTargetKey,
  type PaceProfile,
  type PaceRange,
  type PaceTargetKey,
} from '@/lib/pace-personalization';

export type PhaseKind = 'warmup' | 'main' | 'cooldown';

export interface RunPhaseDefinition {
  label: string;
  color: string;
  durationPercent: number;
  distanceKm: number;
  kind: PhaseKind;
}

export interface PhasePaceTarget {
  targetPaceSecPerKm: number;
  minPaceSecPerKm: number;
  maxPaceSecPerKm: number;
  displayLabel: string;
}

export interface PhaseWithPace extends RunPhaseDefinition {
  pace: PhasePaceTarget;
  durationSec: number;
  startSec: number;
  endSec: number;
}

export interface RunPhasePlan {
  phases: PhaseWithPace[];
  totalDurationSec: number;
  estimatedDistanceKm: number;
  mainRange: PaceRange;
}

export interface RunPhaseProgress {
  currentPhase: PhaseWithPace;
  currentPhaseIndex: number;
  progressInPhase: number;
  timeRemainingSec: number;
  nextPhase: PhaseWithPace | null;
  totalPhases: number;
  distanceProgressPercent: number;
}

const WARMUP_PACE_FACTOR = 1.12;
const COOLDOWN_PACE_FACTOR = 1.08;
const PHASE_TOLERANCE = 0.05;

const DEFAULT_PHASES = [
  { label: 'WARM UP', color: '#F59E0B', durationPercent: 15 },
  { label: 'RUN', color: '#2DD4BF', durationPercent: 70 },
  { label: 'COOL DOWN', color: '#22C55E', durationPercent: 15 },
];

function formatPaceLabel(secPerKm: number): string {
  const rounded = Math.round(secPerKm);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')} / km`;
}

function formatRangeLabel(range: PaceRange): string {
  return `${formatPaceLabel(range.minPaceSecPerKm).replace(' / km', '')}–${formatPaceLabel(range.maxPaceSecPerKm).replace(' / km', '')}`;
}

function midpoint(range: PaceRange): number {
  return Math.round((range.minPaceSecPerKm + range.maxPaceSecPerKm) / 2);
}

export function getPaceTargetKeyForTemplate(templateId: RunType, runType?: string): PaceTargetKey | null {
  const fromRunType = getPaceTargetKey(runType);
  if (fromRunType) return fromRunType;

  const map: Partial<Record<RunType, PaceTargetKey>> = {
    easy: 'EASY_RUN',
    long: 'LONG_RUN',
    walk: 'BRISK_WALK',
    power_walk: 'POWER_WALK',
    long_walk: 'LONG_WALK',
    freeform: 'EASY_RUN',
    goal_practice: 'GOAL_PRACTICE',
  };

  return map[templateId] ?? null;
}

export function supportsPersonalizedPace(templateId: RunType): boolean {
  return getPaceTargetKeyForTemplate(templateId) !== null;
}

export function classifyPhaseKind(label: string, index: number, total: number): PhaseKind {
  const normalized = label.trim().toLowerCase();
  if (normalized.includes('warm') || normalized === 'start') return 'warmup';
  if (normalized.includes('cool') || normalized.includes('slow down')) return 'cooldown';
  if (total === 1) return 'main';
  if (index === 0) return 'warmup';
  if (index === total - 1) return 'cooldown';
  return 'main';
}

export function fallbackMainRange(template: RunTemplate): PaceRange {
  const zone = template.paceZones[template.targetZoneIndex] ?? template.paceZones[0];
  if (!zone) {
    return { minPaceSecPerKm: 360, maxPaceSecPerKm: 420 };
  }

  return {
    minPaceSecPerKm: zone.minPaceSecPerKm,
    maxPaceSecPerKm: zone.maxPaceSecPerKm,
  };
}

export function resolveMainPaceRange(
  profile: PaceProfile | null,
  paceKey: PaceTargetKey | null,
  template: RunTemplate,
): PaceRange {
  if (profile && paceKey) {
    const mode = getPaceModeForTarget(paceKey);
    const range = mode ? profile[mode]?.targetRanges?.[paceKey] : null;
    if (range) return range;
  }

  return fallbackMainRange(template);
}

export function buildPhasePaceTarget(mainRange: PaceRange, kind: PhaseKind): PhasePaceTarget {
  const mid = midpoint(mainRange);

  if (kind === 'main') {
    return {
      targetPaceSecPerKm: mid,
      minPaceSecPerKm: mainRange.minPaceSecPerKm,
      maxPaceSecPerKm: mainRange.maxPaceSecPerKm,
      displayLabel: formatRangeLabel(mainRange),
    };
  }

  const factor = kind === 'warmup' ? WARMUP_PACE_FACTOR : COOLDOWN_PACE_FACTOR;
  const target = Math.round(mid * factor);
  const spread = Math.max(15, Math.round(target * PHASE_TOLERANCE));

  return {
    targetPaceSecPerKm: target,
    minPaceSecPerKm: target - spread,
    maxPaceSecPerKm: target + spread,
    displayLabel: formatPaceLabel(target),
  };
}

export function buildEasyRunPhases(targetDistanceKm: number, primaryColor: string): RunPhaseDefinition[] {
  const warmupKm = Math.min(0.5, targetDistanceKm * 0.15);
  const cooldownKm = Math.min(0.3, targetDistanceKm * 0.1);
  const mainKm = Math.max(0.5, targetDistanceKm - warmupKm - cooldownKm);
  const totalKm = warmupKm + mainKm + cooldownKm;

  return [
    {
      label: 'WARM UP',
      color: '#F59E0B',
      durationPercent: (warmupKm / totalKm) * 100,
      distanceKm: warmupKm,
      kind: 'warmup',
    },
    {
      label: 'RUN',
      color: primaryColor,
      durationPercent: (mainKm / totalKm) * 100,
      distanceKm: mainKm,
      kind: 'main',
    },
    {
      label: 'COOL DOWN',
      color: '#22C55E',
      durationPercent: (cooldownKm / totalKm) * 100,
      distanceKm: cooldownKm,
      kind: 'cooldown',
    },
  ];
}

function buildStandardPhases(
  phases: { label: string; color: string; durationPercent: number }[],
  targetDistanceKm: number,
): RunPhaseDefinition[] {
  return phases.map((phase, index) => ({
    ...phase,
    distanceKm: (phase.durationPercent / 100) * targetDistanceKm,
    kind: classifyPhaseKind(phase.label, index, phases.length),
  }));
}

export function buildRunPhasePlan(
  profile: PaceProfile | null,
  template: RunTemplate,
  templateId: RunType,
  targetDistanceKm: number,
  runType?: string,
): RunPhasePlan {
  const paceKey = getPaceTargetKeyForTemplate(templateId, runType);
  const mainRange = resolveMainPaceRange(profile, paceKey, template);

  const templatePhases = template.phases ?? DEFAULT_PHASES.map((phase) => ({
    ...phase,
    color: phase.label === 'RUN' ? template.primaryColor : phase.color,
  }));

  const basePhases = templateId === 'easy'
    ? buildEasyRunPhases(targetDistanceKm, template.primaryColor)
    : buildStandardPhases(templatePhases, targetDistanceKm);

  let cumulative = 0;
  const phases: PhaseWithPace[] = basePhases.map((phase) => {
    const pace = buildPhasePaceTarget(mainRange, phase.kind);
    const durationSec = Math.max(1, Math.round(phase.distanceKm * pace.targetPaceSecPerKm));
    const startSec = cumulative;
    cumulative += durationSec;

    return {
      ...phase,
      pace,
      durationSec,
      startSec,
      endSec: cumulative,
    };
  });

  const estimatedDistanceKm = templateId === 'easy'
    ? basePhases.reduce((sum, phase) => sum + phase.distanceKm, 0)
    : targetDistanceKm;

  return {
    phases,
    totalDurationSec: cumulative,
    estimatedDistanceKm,
    mainRange,
  };
}

export function getPhaseProgressFromPlan(
  plan: RunPhasePlan,
  elapsedSec: number,
  distanceProgressPercent: number,
): RunPhaseProgress {
  const { phases } = plan;

  for (let index = 0; index < phases.length; index += 1) {
    const phase = phases[index];
    const isLast = index === phases.length - 1;

    if (elapsedSec < phase.endSec && !isLast) {
      const progressInPhase = Math.min(
        1,
        Math.max(0, (elapsedSec - phase.startSec) / phase.durationSec),
      );

      return {
        currentPhase: phase,
        currentPhaseIndex: index,
        progressInPhase,
        timeRemainingSec: Math.max(0, Math.round(phase.endSec - elapsedSec)),
        nextPhase: phases[index + 1] ?? null,
        totalPhases: phases.length,
        distanceProgressPercent,
      };
    }

    if (isLast) {
      const progressInPhase = Math.min(
        1,
        Math.max(0, (elapsedSec - phase.startSec) / phase.durationSec),
      );

      return {
        currentPhase: phase,
        currentPhaseIndex: index,
        progressInPhase,
        timeRemainingSec: Math.max(0, Math.round(phase.endSec - elapsedSec)),
        nextPhase: null,
        totalPhases: phases.length,
        distanceProgressPercent,
      };
    }
  }

  const lastPhase = phases[phases.length - 1];
  return {
    currentPhase: lastPhase,
    currentPhaseIndex: phases.length - 1,
    progressInPhase: 1,
    timeRemainingSec: 0,
    nextPhase: null,
    totalPhases: phases.length,
    distanceProgressPercent,
  };
}

export interface PaceBarZone {
  label: string;
  minPaceSecPerKm: number;
  maxPaceSecPerKm: number;
  color: string;
}

export function buildPaceBarZones(mainRange: PaceRange, template: RunTemplate): PaceBarZone[] {
  const { minPaceSecPerKm: min, maxPaceSecPerKm: max } = mainRange;
  const templateZones = template.paceZones;
  const slowColor = templateZones[0]?.color ?? '#94A3B8';
  const targetColor = templateZones[template.targetZoneIndex]?.color ?? template.primaryColor;
  const fastColor = templateZones[templateZones.length - 1]?.color ?? '#F472B6';

  return [
    {
      label: 'SLOW',
      minPaceSecPerKm: max,
      maxPaceSecPerKm: Math.round(max * 1.15),
      color: slowColor,
    },
    {
      label: 'TARGET',
      minPaceSecPerKm: min,
      maxPaceSecPerKm: max,
      color: targetColor,
    },
    {
      label: 'FAST',
      minPaceSecPerKm: Math.round(min * 0.85),
      maxPaceSecPerKm: min,
      color: fastColor,
    },
  ];
}

export function getPaceBarEdges(zones: PaceBarZone[]) {
  if (zones.length === 0) {
    return { slowEdge: 600, fastEdge: 300 };
  }

  return {
    slowEdge: zones[0].maxPaceSecPerKm,
    fastEdge: zones[zones.length - 1].minPaceSecPerKm,
  };
}

export function getPaceBarPosition(
  paceSecPerKm: number | null | undefined,
  zones: PaceBarZone[],
): number {
  const { slowEdge, fastEdge } = getPaceBarEdges(zones);
  const range = slowEdge - fastEdge;
  if (range <= 0) return 0;

  if (typeof paceSecPerKm !== 'number' || !Number.isFinite(paceSecPerKm) || paceSecPerKm <= 0) {
    return 2;
  }

  const position = ((slowEdge - paceSecPerKm) / range) * 100;
  return Math.max(2, Math.min(98, position));
}
