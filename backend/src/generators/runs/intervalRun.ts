// Interval Run Generator
// Absolute beginners:
// - Weeks 1-33%: distance-based blocks with no durationSec
// Everyone else:
// - Pace-based blocks with durationSec computed from pace + distance + 10s

import { UIStep, UserContext, RunGenerator, IntervalMode } from "../types";
import { WARMUP_COOLDOWN_DEFAULTS, PACE_MULTIPLIERS, BEGINNER_INTERVAL_PROGRESSION } from "../config";

const DEFAULT_BASELINE_PACE_SEC_PER_KM = 6 * 60;
const DURATION_MARGIN_SEC = 10;
const MAX_HARD_BLOCK_SEC = 120;
const MIN_REPEAT_COUNT = 2;
const MIN_BLOCK_DISTANCE_KM = 0.1;

export const intervalRunGenerator: RunGenerator = (
    targetKm: number,
    week: number,
    totalWeeks: number,
    context: UserContext
): UIStep[] => {
    const mode = getIntervalMode(week, totalWeeks, context.isAbsoluteBeginner);
    const defaults = WARMUP_COOLDOWN_DEFAULTS["Interval Run"];
    const warmupKm = roundDistance(defaults.warmupKm);
    const cooldownKm = roundDistance(defaults.cooldownKm);
    const workRecoveryKm = Math.max(0.4, targetKm - warmupKm - cooldownKm);
    const baselinePaceSecPerKm = context.baselinePaceSecPerKm ?? DEFAULT_BASELINE_PACE_SEC_PER_KM;
    const easyPace = Math.round(baselinePaceSecPerKm * PACE_MULTIPLIERS.Easy);
    const hardPace = Math.round(baselinePaceSecPerKm * PACE_MULTIPLIERS.Hard);
    const repeatCount = getRepeatCount(workRecoveryKm, hardPace);
    const pairDistanceKm = workRecoveryKm / repeatCount;
    const workDistanceKm = roundDistance(pairDistanceKm / 2);
    const recoveryDistanceKm = roundDistance(pairDistanceKm / 2);
    const recoveryRemainderKm = roundDistance(workRecoveryKm - ((workDistanceKm + recoveryDistanceKm) * repeatCount));

    const steps: UIStep[] = [
        buildStep("warmup", "Warm-up", warmupKm, "Easy", easyPace, mode === "PACE_BASED"),
    ];

    for (let index = 1; index <= repeatCount; index += 1) {
        const recoveryDistanceForStep = index === repeatCount
            ? roundDistance(recoveryDistanceKm + recoveryRemainderKm)
            : recoveryDistanceKm;

        steps.push(buildStep("run", `Interval ${index}`, workDistanceKm, "Hard", hardPace, mode === "PACE_BASED", true));
        steps.push(buildStep("recover", `Recovery ${index}`, recoveryDistanceForStep, "Easy", easyPace, mode === "PACE_BASED"));
    }

    steps.push(buildStep("cooldown", "Cool-down", cooldownKm, "Easy", easyPace, mode === "PACE_BASED"));

    return steps;
};

function getIntervalMode(week: number, totalWeeks: number, isAbsoluteBeginner: boolean): IntervalMode {
    if (!isAbsoluteBeginner) {
        return "PACE_BASED";
    }

    const progress = totalWeeks > 0 ? week / totalWeeks : 1;
    return progress <= BEGINNER_INTERVAL_PROGRESSION.timeBasedEnd
        ? "DISTANCE_BASED_BEGINNER"
        : "PACE_BASED";
}

function getRepeatCount(workRecoveryKm: number, hardPaceSecPerKm: number) {
    const maxWorkDistanceKm = Math.max(
        MIN_BLOCK_DISTANCE_KM,
        (MAX_HARD_BLOCK_SEC - DURATION_MARGIN_SEC) / hardPaceSecPerKm,
    );
    return Math.max(MIN_REPEAT_COUNT, Math.ceil((workRecoveryKm / 2) / maxWorkDistanceKm));
}

function buildStep(
    type: UIStep["type"],
    label: string,
    distanceKm: number,
    effort: UIStep["target"]["effort"],
    paceSecPerKm: number,
    includeDuration: boolean,
    capAtTwoMinutes = false,
): UIStep {
    const roundedDistanceKm = roundDistance(distanceKm);
    const durationSec = includeDuration
        ? deriveDurationSec(roundedDistanceKm, paceSecPerKm, capAtTwoMinutes)
        : undefined;

    return {
        type,
        label,
        distanceKm: roundedDistanceKm,
        ...(typeof durationSec === "number" ? { durationSec } : {}),
        target: {
            effort,
            paceSecPerKm,
        },
    };
}

function deriveDurationSec(distanceKm: number, paceSecPerKm: number, capAtTwoMinutes = false) {
    const rawDurationSec = Math.max(10, Math.round(distanceKm * paceSecPerKm) + DURATION_MARGIN_SEC);
    return capAtTwoMinutes ? Math.min(MAX_HARD_BLOCK_SEC, rawDurationSec) : rawDurationSec;
}

function roundDistance(km: number) {
    return Math.max(0.01, Math.round(km * 1000) / 1000);
}
