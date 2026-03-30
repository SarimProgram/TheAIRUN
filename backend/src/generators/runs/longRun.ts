// Long Run Generator
// Warmup → sustained easy-steady effort → cooldown

import { UIStep, UserContext, RunGenerator } from "../types";
import { WARMUP_COOLDOWN_DEFAULTS, PACE_MULTIPLIERS } from "../config";

export const longRunGenerator: RunGenerator = (
    targetKm: number,
    _week: number,
    _totalWeeks: number,
    context: UserContext
): UIStep[] => {
    const defaults = WARMUP_COOLDOWN_DEFAULTS["Long Run"];

    const warmupKm = Math.min(defaults.warmupKm, targetKm * 0.08);
    const cooldownKm = Math.min(defaults.cooldownKm, targetKm * 0.05);
    const mainKm = Math.max(1.0, targetKm - warmupKm - cooldownKm);

    const easyPace = context.baselinePaceSecPerKm
        ? Math.round(context.baselinePaceSecPerKm * PACE_MULTIPLIERS.Easy)
        : undefined;

    const steps: UIStep[] = [
        {
            type: "warmup",
            label: "Warm-up",
            distanceKm: round(warmupKm),
            target: { effort: "Easy", paceSecPerKm: easyPace },
        },
        {
            type: "run",
            label: "Long Run",
            distanceKm: round(mainKm),
            target: { effort: "Easy", paceSecPerKm: easyPace },
        },
        {
            type: "cooldown",
            label: "Cool-down",
            distanceKm: round(cooldownKm),
            target: { effort: "Easy", paceSecPerKm: easyPace },
        },
    ];

    return steps;
};

function round(km: number): number {
    return Math.round(km * 10) / 10;
}
