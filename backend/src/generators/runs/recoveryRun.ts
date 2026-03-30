// Recovery Run Generator
// Very easy effort with minimal structure

import { UIStep, UserContext, RunGenerator } from "../types";
import { WARMUP_COOLDOWN_DEFAULTS, PACE_MULTIPLIERS } from "../config";

export const recoveryRunGenerator: RunGenerator = (
    targetKm: number,
    _week: number,
    _totalWeeks: number,
    context: UserContext
): UIStep[] => {
    const defaults = WARMUP_COOLDOWN_DEFAULTS["Recovery Run"];

    const warmupKm = Math.min(defaults.warmupKm, targetKm * 0.15);
    const cooldownKm = Math.min(defaults.cooldownKm, targetKm * 0.1);
    const mainKm = Math.max(0.5, targetKm - warmupKm - cooldownKm);

    // Recovery runs are extra slow
    const easyPace = context.baselinePaceSecPerKm
        ? Math.round(context.baselinePaceSecPerKm * 1.2) // 20% slower than easy
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
            label: "Recovery Run",
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
