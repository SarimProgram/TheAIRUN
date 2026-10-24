import { RunGenerator, UIStep, UserContext } from "../types";
import { buildIntervalWalkPaceTargets } from "../../services/intervalPaceTargets";

const BLOCK_BUFFER_SEC = 5;
const MAX_FAST_BLOCK_SEC = 120;
const BASELINE_WARMUP_SEC = 4 * 60;
const BASELINE_COOLDOWN_SEC = 4 * 60;
const MIN_WORK_RECOVERY_KM = 0.2;

type IntervalWalkPaces = {
    recoverySecPerKm: number;
    fastSecPerKm: number;
};

export const intervalWalkGenerator: RunGenerator = (
    targetKm: number,
    _week: number,
    _totalWeeks: number,
    context: UserContext
): UIStep[] => {
    const normalizedTargetKm = Math.max(1, roundDistanceKm(targetKm));
    const paces = buildIntervalWalkPaces(context);
    const { warmupKm, cooldownKm } = getWarmCooldownDistances(normalizedTargetKm, paces);
    const workRecoveryKm = Math.max(normalizedTargetKm - warmupKm - cooldownKm, MIN_WORK_RECOVERY_KM);
    const maxFastDistanceKm = Math.max(
        0.05,
        (MAX_FAST_BLOCK_SEC - BLOCK_BUFFER_SEC) / paces.fastSecPerKm,
    );
    const repeatCount = Math.max(1, Math.ceil((workRecoveryKm / 2) / maxFastDistanceKm));
    const fastDistanceKm = roundDistanceKm(workRecoveryKm / (repeatCount * 2));
    const recoveryDistanceKm = roundDistanceKm(workRecoveryKm / (repeatCount * 2));

    const steps: UIStep[] = [
        buildStep("warmup", "Warm Up Walk", warmupKm, paces.recoverySecPerKm, "Easy"),
    ];

    for (let index = 1; index <= repeatCount; index += 1) {
        steps.push({
            ...buildStep("run", `Fast Walk ${index}`, fastDistanceKm, paces.fastSecPerKm, "Steady"),
            durationSec: Math.min(MAX_FAST_BLOCK_SEC, deriveDurationSec(fastDistanceKm, paces.fastSecPerKm)),
        });
        steps.push(buildStep("recover", `Recovery Walk ${index}`, recoveryDistanceKm, paces.recoverySecPerKm, "Easy"));
    }

    steps.push(buildStep("cooldown", "Cool Down Walk", cooldownKm, paces.recoverySecPerKm, "Easy"));

    return steps;
};

function buildIntervalWalkPaces(context: UserContext): IntervalWalkPaces {
    const walkingBaseline = context.walkingBaselinePaceSecPerKm;
    const { recoverySecPerKm, fastSecPerKm } = buildIntervalWalkPaceTargets(walkingBaseline);
    return { recoverySecPerKm, fastSecPerKm };
}

function getWarmCooldownDistances(targetKm: number, paces: IntervalWalkPaces) {
    const baselineWarmupKm = deriveDistanceKm(BASELINE_WARMUP_SEC, paces.recoverySecPerKm);
    const baselineCooldownKm = deriveDistanceKm(BASELINE_COOLDOWN_SEC, paces.recoverySecPerKm);
    const maxWarmupKm = targetKm * 0.2;
    const maxCooldownKm = targetKm * 0.2;

    let warmupKm = Math.min(baselineWarmupKm, maxWarmupKm);
    let cooldownKm = Math.min(baselineCooldownKm, maxCooldownKm);
    const maxWarmCooldownTotal = Math.max(targetKm - MIN_WORK_RECOVERY_KM, 0);
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

function buildStep(
    type: UIStep["type"],
    label: string,
    distanceKm: number,
    paceSecPerKm: number,
    effort: UIStep["target"]["effort"],
): UIStep {
    const roundedDistanceKm = roundDistanceKm(distanceKm);
    return {
        type,
        label,
        distanceKm: roundedDistanceKm,
        durationSec: deriveDurationSec(roundedDistanceKm, paceSecPerKm),
        target: {
            effort,
            paceSecPerKm,
        },
    };
}

function deriveDistanceKm(durationSec: number, paceSecPerKm: number) {
    if (!durationSec || durationSec <= 0 || !paceSecPerKm || paceSecPerKm <= 0) return 0;
    return durationSec / paceSecPerKm;
}

function deriveDurationSec(distanceKm: number, paceSecPerKm: number) {
    if (!distanceKm || distanceKm <= 0 || !paceSecPerKm || paceSecPerKm <= 0) return 0;
    return Math.max(10, Math.round(distanceKm * paceSecPerKm) + BLOCK_BUFFER_SEC);
}

function roundDistanceKm(distanceKm: number) {
    return Math.max(0.01, Math.round(distanceKm * 1000) / 1000);
}
