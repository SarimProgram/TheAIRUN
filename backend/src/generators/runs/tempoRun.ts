// Tempo Run Generator
// Warmup → steady tempo effort → cooldown

import { UIStep, UserContext, RunGenerator } from "../types";
import { WARMUP_COOLDOWN_DEFAULTS, PACE_MULTIPLIERS } from "../config";

export const tempoRunGenerator: RunGenerator = (
    targetKm: number,
    _week: number,
    _totalWeeks: number,
    context: UserContext
): UIStep[] => {
    const defaults = WARMUP_COOLDOWN_DEFAULTS["Tempo Run"];

    const warmupKm = Math.min(defaults.warmupKm, targetKm * 0.15);
    const cooldownKm = Math.min(defaults.cooldownKm, targetKm * 0.1);
    const mainKm = Math.max(1.0, targetKm - warmupKm - cooldownKm);

    const easyPace = context.baselinePaceSecPerKm
        ? Math.round(context.baselinePaceSecPerKm * PACE_MULTIPLIERS.Easy)
        : undefined;
    const steadyPace = context.baselinePaceSecPerKm
        ? Math.round(context.baselinePaceSecPerKm * PACE_MULTIPLIERS.Steady)
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
            label: "Tempo Run",
            distanceKm: round(mainKm),
            target: { effort: "Steady", paceSecPerKm: steadyPace },
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
