// Run-Walk Generator
// Alternating run and walk segments for beginners

import { UIStep, UserContext, RunGenerator } from "../types";
import { PACE_MULTIPLIERS } from "../config";

export const runWalkGenerator: RunGenerator = (
    targetKm: number,
    week: number,
    totalWeeks: number,
    context: UserContext
): UIStep[] => {
    const warmupKm = 0.3;
    const cooldownKm = 0.2;
    const workKm = Math.max(0.5, targetKm - warmupKm - cooldownKm);

    // Progressive run/walk ratio based on week
    const progress = week / totalWeeks;
    const runSegmentKm = 0.2 + progress * 0.2; // 0.2km → 0.4km
    const walkSegmentKm = 0.2 - progress * 0.1; // 0.2km → 0.1km
    const setDistance = runSegmentKm + walkSegmentKm;
    const segmentCount = Math.max(2, Math.floor(workKm / setDistance));

    const easyPace = context.baselinePaceSecPerKm
        ? Math.round(context.baselinePaceSecPerKm * PACE_MULTIPLIERS.Easy)
        : undefined;

    const steps: UIStep[] = [
        {
            type: "warmup",
            label: "Warm-up Walk",
            distanceKm: round(warmupKm),
            target: { effort: "Easy" },
        },
    ];

    for (let i = 1; i <= segmentCount; i++) {
        steps.push({
            type: "run",
            label: `Run ${i}`,
            distanceKm: round(runSegmentKm),
            target: { effort: "Easy", paceSecPerKm: easyPace },
        });
        steps.push({
            type: "walk",
            label: `Walk ${i}`,
            distanceKm: round(walkSegmentKm),
            target: { effort: "Easy" },
        });
    }

    steps.push({
        type: "cooldown",
        label: "Cool-down Walk",
        distanceKm: round(cooldownKm),
        target: { effort: "Easy" },
    });

    return steps;
};

function round(km: number): number {
    return Math.round(km * 10) / 10;
}
