import { API_BASE_URL } from '@/config/api';
import { getRunMeta } from '@/constants/runDetails';

export type IntervalWorkoutKind = 'interval_run' | 'interval_walk';
export type IntervalWorkoutRoute = '/runs/interval-run' | '/runs/interval-walk';
export type IntervalWorkoutStepType = 'run' | 'recover' | 'walk' | 'warmup' | 'cooldown';
export type IntervalWorkoutEffort = 'Easy' | 'Steady' | 'Hard';

export interface IntervalWorkoutStep {
    type: IntervalWorkoutStepType;
    label: string;
    distanceKm: number;
    durationSec?: number;
    target?: {
        effort: IntervalWorkoutEffort;
        paceSecPerKm?: number;
    };
}

export interface IntervalWalkPaceTargets {
    recoverySecPerKm: number;
    fastSecPerKm: number;
    ageYears: number | null;
    bmi: number | null;
    personalized: boolean;
}

type AuthFetch = (input: string, init?: RequestInit) => Promise<Response>;

const BASELINE_RECOVERY_SEC_PER_KM = 14 * 60;
const BASELINE_FAST_SEC_PER_KM = 9 * 60;
const MAX_RECOVERY_SEC_PER_KM = 18 * 60;
const MAX_FAST_SEC_PER_KM = 12 * 60;
const INTERVAL_WALK_BUFFER_SEC = 5;
const INTERVAL_WALK_MAX_FAST_BLOCK_SEC = 120;
const INTERVAL_WALK_BASELINE_WARMUP_SEC = 4 * 60;
const INTERVAL_WALK_BASELINE_COOLDOWN_SEC = 4 * 60;
const INTERVAL_WALK_MIN_WORK_RECOVERY_KM = 0.2;

function roundDistanceKm(distanceKm: number) {
    return Math.max(0.01, Math.round(distanceKm * 1000) / 1000);
}

function deriveDistanceKm(durationSec: number, paceSecPerKm: number) {
    if (!durationSec || durationSec <= 0 || !paceSecPerKm || paceSecPerKm <= 0) return 0;
    return roundDistanceKm(durationSec / paceSecPerKm);
}

function deriveDurationSec(distanceKm: number, paceSecPerKm: number, extraSec = INTERVAL_WALK_BUFFER_SEC) {
    if (!distanceKm || distanceKm <= 0 || !paceSecPerKm || paceSecPerKm <= 0) return 0;
    return Math.max(10, Math.round(distanceKm * paceSecPerKm) + extraSec);
}

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function normalize(text: string | null | undefined) {
    return (text || '').trim().toLowerCase();
}

function parseFiniteNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return null;
}

function calculateBmi(heightCm: number | null, weightKg: number | null) {
    if (!heightCm || !weightKg || heightCm <= 0 || weightKg <= 0) return null;
    const heightM = heightCm / 100;
    return weightKg / (heightM * heightM);
}

export function getIntervalWorkoutRoute(runType: string | null | undefined): IntervalWorkoutRoute {
    const runMeta = getRunMeta(runType);
    return getIntervalWorkoutRouteFromTemplateId(runMeta.templateId);
}

export function getIntervalWorkoutRouteFromTemplateId(templateId: string | null | undefined): IntervalWorkoutRoute {
    return templateId === 'interval_walk' ? '/runs/interval-walk' : '/runs/interval-run';
}

export async function loadIntervalWalkPaceTargets(authFetch: AuthFetch): Promise<IntervalWalkPaceTargets> {
    let ageYears: number | null = null;
    let heightCm: number | null = null;
    let weightKg: number | null = null;

    try {
        const [profileResult, weightResult] = await Promise.allSettled([
            authFetch(`${API_BASE_URL}/profile`),
            authFetch(`${API_BASE_URL}/weight`),
        ]);

        if (profileResult.status === 'fulfilled' && profileResult.value.ok) {
            const profileJson = await profileResult.value.json();
            const user = profileJson?.user ?? {};
            ageYears = parseFiniteNumber(user.ageYears);
            heightCm = parseFiniteNumber(user.heightCm);
            weightKg = parseFiniteNumber(user.weightKg);
        }

        if (weightResult.status === 'fulfilled' && weightResult.value.ok) {
            const weightJson = await weightResult.value.json();
            weightKg = parseFiniteNumber(weightJson?.currentWeight) ?? weightKg;
        }
    } catch {
        // Fall back to the baseline defaults below.
    }

    return buildIntervalWalkPaceTargets({
        ageYears,
        heightCm,
        weightKg,
    });
}

export function buildIntervalWalkPaceTargets(profile: {
    ageYears?: number | null;
    heightCm?: number | null;
    weightKg?: number | null;
}): IntervalWalkPaceTargets {
    const ageYears = parseFiniteNumber(profile.ageYears) ?? null;
    const heightCm = parseFiniteNumber(profile.heightCm) ?? null;
    const weightKg = parseFiniteNumber(profile.weightKg) ?? null;
    const bmi = calculateBmi(heightCm, weightKg);

    let adjustmentSec = 0;

    if (typeof bmi === 'number') {
        if (bmi < 18.5) adjustmentSec += 30;
        else if (bmi >= 30) adjustmentSec += 90;
        else if (bmi >= 25) adjustmentSec += 45;
    }

    if (typeof ageYears === 'number' && ageYears >= 60) {
        adjustmentSec += ageYears >= 70 ? 90 : 45;
    }

    const personalized = typeof bmi === 'number' || typeof ageYears === 'number';

    return {
        recoverySecPerKm: clamp(BASELINE_RECOVERY_SEC_PER_KM + adjustmentSec, BASELINE_RECOVERY_SEC_PER_KM, MAX_RECOVERY_SEC_PER_KM),
        fastSecPerKm: clamp(BASELINE_FAST_SEC_PER_KM + adjustmentSec, BASELINE_FAST_SEC_PER_KM, MAX_FAST_SEC_PER_KM),
        ageYears,
        bmi,
        personalized,
    };
}

export function buildIntervalWalkQuickSteps(paces: IntervalWalkPaceTargets): IntervalWorkoutStep[] {
    const warmupDurationSec = 4 * 60;
    const workDurationSec = 2 * 60;
    const recoveryDurationSec = 2 * 60;
    const cooldownDurationSec = 4 * 60;
    const repeatCount = 4;

    const steps: IntervalWorkoutStep[] = [
        {
            type: 'warmup',
            label: 'Warm Up Walk',
            durationSec: warmupDurationSec,
            distanceKm: deriveDistanceKm(warmupDurationSec, paces.recoverySecPerKm),
            target: {
                effort: 'Easy',
                paceSecPerKm: paces.recoverySecPerKm,
            },
        },
    ];

    for (let index = 1; index <= repeatCount; index += 1) {
        steps.push({
            type: 'run',
            label: `Fast Walk ${index}`,
            durationSec: workDurationSec,
            distanceKm: deriveDistanceKm(workDurationSec, paces.fastSecPerKm),
            target: {
                effort: 'Steady',
                paceSecPerKm: paces.fastSecPerKm,
            },
        });

        steps.push({
            type: 'recover',
            label: `Recovery Walk ${index}`,
            durationSec: recoveryDurationSec,
            distanceKm: deriveDistanceKm(recoveryDurationSec, paces.recoverySecPerKm),
            target: {
                effort: 'Easy',
                paceSecPerKm: paces.recoverySecPerKm,
            },
        });
    }

    steps.push({
        type: 'cooldown',
        label: 'Cool Down Walk',
        durationSec: cooldownDurationSec,
        distanceKm: deriveDistanceKm(cooldownDurationSec, paces.recoverySecPerKm),
        target: {
            effort: 'Easy',
            paceSecPerKm: paces.recoverySecPerKm,
        },
    });

    return steps;
}

function getIntervalWalkWarmCooldownDistanceKm(targetKm: number, paces: IntervalWalkPaceTargets) {
    const baselineWarmupKm = deriveDistanceKm(INTERVAL_WALK_BASELINE_WARMUP_SEC, paces.recoverySecPerKm);
    const baselineCooldownKm = deriveDistanceKm(INTERVAL_WALK_BASELINE_COOLDOWN_SEC, paces.recoverySecPerKm);
    const maxWarmupKm = targetKm * 0.2;
    const maxCooldownKm = targetKm * 0.2;

    let warmupKm = Math.min(baselineWarmupKm, maxWarmupKm);
    let cooldownKm = Math.min(baselineCooldownKm, maxCooldownKm);
    const maxWarmCooldownTotal = Math.max(targetKm - INTERVAL_WALK_MIN_WORK_RECOVERY_KM, 0);
    const plannedWarmCooldownTotal = warmupKm + cooldownKm;

    if (plannedWarmCooldownTotal > maxWarmCooldownTotal && plannedWarmCooldownTotal > 0) {
        const scale = maxWarmCooldownTotal / plannedWarmCooldownTotal;
        warmupKm *= scale;
        cooldownKm *= scale;
    }

    return {
        warmupKm: roundDistanceKm(warmupKm),
        cooldownKm: roundDistanceKm(cooldownKm),
    };
}

export function buildIntervalWalkDistanceSteps(targetKm: number, paces: IntervalWalkPaceTargets): IntervalWorkoutStep[] {
    const normalizedTargetKm = Math.max(1, Math.round(targetKm * 1000) / 1000);
    const { warmupKm, cooldownKm } = getIntervalWalkWarmCooldownDistanceKm(normalizedTargetKm, paces);
    const workRecoveryKm = Math.max(normalizedTargetKm - warmupKm - cooldownKm, INTERVAL_WALK_MIN_WORK_RECOVERY_KM);
    const maxFastDistanceKm = Math.max(
        0.05,
        (INTERVAL_WALK_MAX_FAST_BLOCK_SEC - INTERVAL_WALK_BUFFER_SEC) / paces.fastSecPerKm,
    );
    const repeatCount = Math.max(1, Math.ceil((workRecoveryKm / 2) / maxFastDistanceKm));
    const fastDistanceKm = workRecoveryKm / (repeatCount * 2);
    const recoveryDistanceKm = workRecoveryKm / (repeatCount * 2);

    const steps: IntervalWorkoutStep[] = [
        {
            type: 'warmup',
            label: 'Warm Up Walk',
            distanceKm: warmupKm,
            durationSec: deriveDurationSec(warmupKm, paces.recoverySecPerKm),
            target: {
                effort: 'Easy',
                paceSecPerKm: paces.recoverySecPerKm,
            },
        },
    ];

    for (let index = 1; index <= repeatCount; index += 1) {
        const roundedFastDistanceKm = roundDistanceKm(fastDistanceKm);
        const roundedRecoveryDistanceKm = roundDistanceKm(recoveryDistanceKm);

        steps.push({
            type: 'run',
            label: `Fast Walk ${index}`,
            distanceKm: roundedFastDistanceKm,
            durationSec: Math.min(
                INTERVAL_WALK_MAX_FAST_BLOCK_SEC,
                deriveDurationSec(roundedFastDistanceKm, paces.fastSecPerKm),
            ),
            target: {
                effort: 'Steady',
                paceSecPerKm: paces.fastSecPerKm,
            },
        });

        steps.push({
            type: 'recover',
            label: `Recovery Walk ${index}`,
            distanceKm: roundedRecoveryDistanceKm,
            durationSec: deriveDurationSec(roundedRecoveryDistanceKm, paces.recoverySecPerKm),
            target: {
                effort: 'Easy',
                paceSecPerKm: paces.recoverySecPerKm,
            },
        });
    }

    steps.push({
        type: 'cooldown',
        label: 'Cool Down Walk',
        distanceKm: cooldownKm,
        durationSec: deriveDurationSec(cooldownKm, paces.recoverySecPerKm),
        target: {
            effort: 'Easy',
            paceSecPerKm: paces.recoverySecPerKm,
        },
    });

    return steps;
}

function isFastWalkStep(step: IntervalWorkoutStep) {
    if (step.type === 'run') return true;
    const label = normalize(step.label);
    return label.includes('fast') || label.includes('brisk') || label.includes('work') || label.includes('interval');
}

function getWalkStepTargetPace(step: IntervalWorkoutStep, paces: IntervalWalkPaceTargets) {
    return isFastWalkStep(step) ? paces.fastSecPerKm : paces.recoverySecPerKm;
}

export function applyIntervalWalkTargetsToSteps(
    steps: IntervalWorkoutStep[],
    paces: IntervalWalkPaceTargets,
): IntervalWorkoutStep[] {
    return steps.map((step) => {
        const targetPaceSecPerKm = step.target?.paceSecPerKm ?? getWalkStepTargetPace(step, paces);
        const nextDistanceKm = step.distanceKm > 0
            ? step.distanceKm
            : step.durationSec
                ? deriveDistanceKm(step.durationSec, targetPaceSecPerKm)
                : 0;

        return {
            ...step,
            distanceKm: nextDistanceKm,
            target: {
                effort: step.target?.effort ?? (isFastWalkStep(step) ? 'Steady' : 'Easy'),
                paceSecPerKm: targetPaceSecPerKm,
            },
        };
    });
}
