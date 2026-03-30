// Easy Run Generator
// Simple warmup → steady easy run → cooldown

import { UIStep, UserContext, RunGenerator } from "../types";
import { WARMUP_COOLDOWN_DEFAULTS, PACE_MULTIPLIERS } from "../config";

export const easyRunGenerator: RunGenerator = (
    targetKm: number,
    _week: number,
    _totalWeeks: number,
    context: UserContext
): UIStep[] => {
    const defaults = WARMUP_COOLDOWN_DEFAULTS["Easy Run"];

    // Adjust warmup/cooldown based on total distance
    const warmupKm = Math.min(defaults.warmupKm, targetKm * 0.15);
    const cooldownKm = Math.min(defaults.cooldownKm, targetKm * 0.1);
    const mainKm = Math.max(0.5, targetKm - warmupKm - cooldownKm);

    // Calculate pace target if baseline available
    const paceSecPerKm = context.baselinePaceSecPerKm
        ? Math.round(context.baselinePaceSecPerKm * PACE_MULTIPLIERS.Easy)
        : undefined;

    const steps: UIStep[] = [
        {
            type: "warmup",
            label: "Warm-up",
            distanceKm: round(warmupKm),
            target: { effort: "Easy", paceSecPerKm },
        },
        {
            type: "run",
            label: "Easy Run",
            distanceKm: round(mainKm),
            target: { effort: "Easy", paceSecPerKm },
        },
        {
            type: "cooldown",
            label: "Cool-down",
            distanceKm: round(cooldownKm),
            target: { effort: "Easy", paceSecPerKm },
        },
    ];

    return steps;
};

function round(km: number): number {
    return Math.round(km * 10) / 10;
}
