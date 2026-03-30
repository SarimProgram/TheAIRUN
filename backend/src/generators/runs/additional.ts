// Additional Run Generators
// Steady Run, Fartlek, Hill Run, Progression Run, Time Trial

import { UIStep, UserContext, RunGenerator } from "../types";
import { WARMUP_COOLDOWN_DEFAULTS, PACE_MULTIPLIERS } from "../config";

// Steady Run - consistent moderate effort
export const steadyRunGenerator: RunGenerator = (
    targetKm: number,
    _week: number,
    _totalWeeks: number,
    context: UserContext
): UIStep[] => {
    const warmupKm = 0.5;
    const cooldownKm = 0.3;
    const mainKm = Math.max(1.0, targetKm - warmupKm - cooldownKm);

    const easyPace = context.baselinePaceSecPerKm
        ? Math.round(context.baselinePaceSecPerKm * PACE_MULTIPLIERS.Easy)
        : undefined;
    const steadyPace = context.baselinePaceSecPerKm
        ? Math.round(context.baselinePaceSecPerKm * PACE_MULTIPLIERS.Steady)
        : undefined;

    return [
        { type: "warmup", label: "Warm-up", distanceKm: round(warmupKm), target: { effort: "Easy", paceSecPerKm: easyPace } },
        { type: "run", label: "Steady Run", distanceKm: round(mainKm), target: { effort: "Steady", paceSecPerKm: steadyPace } },
        { type: "cooldown", label: "Cool-down", distanceKm: round(cooldownKm), target: { effort: "Easy", paceSecPerKm: easyPace } },
    ];
};

// Fartlek Run - unstructured speed play
export const fartlekRunGenerator: RunGenerator = (
    targetKm: number,
    _week: number,
    _totalWeeks: number,
    context: UserContext
): UIStep[] => {
    const warmupKm = 0.5;
    const cooldownKm = 0.3;
    const mainKm = Math.max(1.0, targetKm - warmupKm - cooldownKm);

    const easyPace = context.baselinePaceSecPerKm
        ? Math.round(context.baselinePaceSecPerKm * PACE_MULTIPLIERS.Easy)
        : undefined;

    return [
        { type: "warmup", label: "Warm-up", distanceKm: round(warmupKm), target: { effort: "Easy", paceSecPerKm: easyPace } },
        { type: "run", label: "Fartlek (vary pace naturally)", distanceKm: round(mainKm), target: { effort: "Steady" } },
        { type: "cooldown", label: "Cool-down", distanceKm: round(cooldownKm), target: { effort: "Easy", paceSecPerKm: easyPace } },
    ];
};

// Hill Run - includes hill repeats
export const hillRunGenerator: RunGenerator = (
    targetKm: number,
    _week: number,
    _totalWeeks: number,
    context: UserContext
): UIStep[] => {
    const warmupKm = 0.6;
    const cooldownKm = 0.4;
    const workKm = Math.max(0.8, targetKm - warmupKm - cooldownKm);

    const hillDistKm = 0.15;
    const hillRepeatCount = Math.max(2, Math.floor(workKm / (hillDistKm * 2)));

    const easyPace = context.baselinePaceSecPerKm
        ? Math.round(context.baselinePaceSecPerKm * PACE_MULTIPLIERS.Easy)
        : undefined;

    const steps: UIStep[] = [
        { type: "warmup", label: "Warm-up", distanceKm: round(warmupKm), target: { effort: "Easy", paceSecPerKm: easyPace } },
    ];

    for (let i = 1; i <= hillRepeatCount; i++) {
        steps.push({ type: "run", label: `Hill ${i} (uphill)`, distanceKm: round(hillDistKm), target: { effort: "Hard" } });
        steps.push({ type: "recover", label: `Jog down ${i}`, distanceKm: round(hillDistKm), target: { effort: "Easy" } });
    }

    steps.push({ type: "cooldown", label: "Cool-down", distanceKm: round(cooldownKm), target: { effort: "Easy", paceSecPerKm: easyPace } });

    return steps;
};

// Progression Run - starts easy, finishes fast
export const progressionRunGenerator: RunGenerator = (
    targetKm: number,
    _week: number,
    _totalWeeks: number,
    context: UserContext
): UIStep[] => {
    const warmupKm = 0.5;
    const cooldownKm = 0.3;
    const mainKm = Math.max(1.5, targetKm - warmupKm - cooldownKm);

    const easyPace = context.baselinePaceSecPerKm
        ? Math.round(context.baselinePaceSecPerKm * PACE_MULTIPLIERS.Easy)
        : undefined;
    const steadyPace = context.baselinePaceSecPerKm
        ? Math.round(context.baselinePaceSecPerKm * PACE_MULTIPLIERS.Steady)
        : undefined;
    const hardPace = context.baselinePaceSecPerKm
        ? Math.round(context.baselinePaceSecPerKm * PACE_MULTIPLIERS.Hard)
        : undefined;

    const segmentKm = round(mainKm / 3);

    return [
        { type: "warmup", label: "Warm-up", distanceKm: round(warmupKm), target: { effort: "Easy", paceSecPerKm: easyPace } },
        { type: "run", label: "Easy segment", distanceKm: segmentKm, target: { effort: "Easy", paceSecPerKm: easyPace } },
        { type: "run", label: "Steady segment", distanceKm: segmentKm, target: { effort: "Steady", paceSecPerKm: steadyPace } },
        { type: "run", label: "Fast segment", distanceKm: segmentKm, target: { effort: "Hard", paceSecPerKm: hardPace } },
        { type: "cooldown", label: "Cool-down", distanceKm: round(cooldownKm), target: { effort: "Easy", paceSecPerKm: easyPace } },
    ];
};

// Time Trial - race simulation
export const timeTrialGenerator: RunGenerator = (
    targetKm: number,
    _week: number,
    _totalWeeks: number,
    context: UserContext
): UIStep[] => {
    const warmupKm = 0.8;
    const cooldownKm = 0.5;
    const raceKm = Math.max(1.0, targetKm - warmupKm - cooldownKm);

    const easyPace = context.baselinePaceSecPerKm
        ? Math.round(context.baselinePaceSecPerKm * PACE_MULTIPLIERS.Easy)
        : undefined;

    return [
        { type: "warmup", label: "Warm-up", distanceKm: round(warmupKm), target: { effort: "Easy", paceSecPerKm: easyPace } },
        { type: "run", label: "Time Trial - Go all out!", distanceKm: round(raceKm), target: { effort: "Hard" } },
        { type: "cooldown", label: "Cool-down", distanceKm: round(cooldownKm), target: { effort: "Easy", paceSecPerKm: easyPace } },
    ];
};

function round(km: number): number {
    return Math.round(km * 10) / 10;
}
