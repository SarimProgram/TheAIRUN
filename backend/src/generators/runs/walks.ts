// Walking Generators
// For users who prefer walking-based training

import { UIStep, UserContext, RunGenerator } from "../types";

// Power Walk - brisk walking
export const powerWalkGenerator: RunGenerator = (
    targetKm: number,
    _week: number,
    _totalWeeks: number,
    _context: UserContext
): UIStep[] => {
    const warmupKm = 0.3;
    const cooldownKm = 0.2;
    const mainKm = Math.max(0.5, targetKm - warmupKm - cooldownKm);

    return [
        { type: "walk", label: "Warm-up Walk", distanceKm: round(warmupKm), target: { effort: "Easy" } },
        { type: "walk", label: "Power Walk", distanceKm: round(mainKm), target: { effort: "Steady" } },
        { type: "walk", label: "Cool-down Walk", distanceKm: round(cooldownKm), target: { effort: "Easy" } },
    ];
};

// Long Walk - extended easy walk
export const longWalkGenerator: RunGenerator = (
    targetKm: number,
    _week: number,
    _totalWeeks: number,
    _context: UserContext
): UIStep[] => {
    const warmupKm = 0.2;
    const cooldownKm = 0.2;
    const mainKm = Math.max(1.0, targetKm - warmupKm - cooldownKm);

    return [
        { type: "walk", label: "Warm-up", distanceKm: round(warmupKm), target: { effort: "Easy" } },
        { type: "walk", label: "Long Walk", distanceKm: round(mainKm), target: { effort: "Easy" } },
        { type: "walk", label: "Cool-down", distanceKm: round(cooldownKm), target: { effort: "Easy" } },
    ];
};

// Incline Walk - hill training
export const inclineWalkGenerator: RunGenerator = (
    targetKm: number,
    _week: number,
    _totalWeeks: number,
    _context: UserContext
): UIStep[] => {
    const warmupKm = 0.3;
    const cooldownKm = 0.2;
    const mainKm = Math.max(0.5, targetKm - warmupKm - cooldownKm);

    return [
        { type: "walk", label: "Warm-up (flat)", distanceKm: round(warmupKm), target: { effort: "Easy" } },
        { type: "walk", label: "Incline Walk", distanceKm: round(mainKm), target: { effort: "Hard" } },
        { type: "walk", label: "Cool-down (flat)", distanceKm: round(cooldownKm), target: { effort: "Easy" } },
    ];
};

// Recovery Walk - very easy
export const recoveryWalkGenerator: RunGenerator = (
    targetKm: number,
    _week: number,
    _totalWeeks: number,
    _context: UserContext
): UIStep[] => {
    return [
        { type: "walk", label: "Recovery Walk", distanceKm: round(targetKm), target: { effort: "Easy" } },
    ];
};

function round(km: number): number {
    return Math.round(km * 10) / 10;
}
