import { kcalPerStep, REFERENCE_WEIGHT_KG } from "../../lib/activeCalories";
import {
    estimateTdeeKcal,
    KCAL_PER_KG_FAT,
    MAX_SAFE_WEEKLY_LOSS_KG,
} from "./planDuration";

export const BASELINE_STEPS_PER_DAY = 5000;
export const BASE_KCAL_PER_WALK_KM = 55;

export type WeeklyPlanActivityInput = {
    caloriesPerDay: number;
    stepsPerDay: number;
    runKmPerWeek: number;
};

export type ComputeExpectedWeightsInput = {
    startWeightKg: number;
    targetWeightKg: number | null;
    heightCm: number;
    ageYears: number;
    gender?: string | null;
    intensityLevel?: string | null;
    numberOfWeeks: number;
    targetDeadlineWeeks: number | null;
    weeks: WeeklyPlanActivityInput[];
};

function roundToOneDecimal(value: number): number {
    return Number(value.toFixed(1));
}

export function kcalPerWalkKm(weightKg: number): number {
    const weight = weightKg > 0 ? weightKg : REFERENCE_WEIGHT_KG;
    return BASE_KCAL_PER_WALK_KM * (weight / REFERENCE_WEIGHT_KG);
}

export function estimateWeeklyActivityKcal(
    weightKg: number,
    stepsPerDay: number,
    runKmPerWeek: number,
): number {
    const weeklySteps = stepsPerDay * 7;
    const baselineWeeklySteps = BASELINE_STEPS_PER_DAY * 7;
    const extraSteps = Math.max(0, weeklySteps - baselineWeeklySteps);
    const stepKcal = extraSteps * kcalPerStep(weightKg);
    const walkKcal = runKmPerWeek * kcalPerWalkKm(weightKg);
    return stepKcal + walkKcal;
}

export function estimateWeeklyDeficitKcal(
    input: {
        weightKg: number;
        heightCm: number;
        ageYears: number;
        gender?: string | null;
        intensityLevel?: string | null;
    } & WeeklyPlanActivityInput,
): number {
    const tdee = estimateTdeeKcal({
        weightKg: input.weightKg,
        heightCm: input.heightCm,
        ageYears: input.ageYears,
        gender: input.gender,
        intensityLevel: input.intensityLevel,
    });
    const activityKcal = estimateWeeklyActivityKcal(
        input.weightKg,
        input.stepsPerDay,
        input.runKmPerWeek,
    );
    const foodKcal = input.caloriesPerDay * 7;
    return tdee * 7 - foodKcal + activityKcal;
}

export function estimateRawWeeklyLossKg(
    input: {
        weightKg: number;
        heightCm: number;
        ageYears: number;
        gender?: string | null;
        intensityLevel?: string | null;
    } & WeeklyPlanActivityInput,
): number {
    const deficit = estimateWeeklyDeficitKcal(input);
    if (deficit <= 0) return 0;
    return Math.min(MAX_SAFE_WEEKLY_LOSS_KG, deficit / KCAL_PER_KG_FAT);
}

/**
 * Derives end-of-week expected weights from each week's food and activity plan.
 * Uses dynamic TDEE (recalculated as weight drops), then scales weekly losses
 * proportionally so the loss phase reaches targetWeightKg without a last-week snap.
 */
export function computeExpectedWeightsFromWeeklyPlan(
    input: ComputeExpectedWeightsInput,
): number[] {
    const {
        startWeightKg,
        targetWeightKg,
        heightCm,
        ageYears,
        gender,
        intensityLevel,
        numberOfWeeks,
        targetDeadlineWeeks,
        weeks,
    } = input;

    if (numberOfWeeks < 1 || weeks.length === 0) {
        return [];
    }

    const lossWeeks = Math.max(
        1,
        Math.min(targetDeadlineWeeks ?? numberOfWeeks, numberOfWeeks),
    );
    const totalLossNeeded =
        targetWeightKg !== null && targetWeightKg !== undefined
            ? Math.max(0, roundToOneDecimal(startWeightKg - targetWeightKg))
            : null;

    const rawLosses: number[] = [];
    let rollingWeight = startWeightKg;

    for (let index = 0; index < numberOfWeeks; index += 1) {
        const week = index + 1;
        const weekPlan = weeks[index] ?? weeks[weeks.length - 1];

        if (week > lossWeeks || totalLossNeeded === null) {
            rawLosses.push(0);
            continue;
        }

        rawLosses.push(
            estimateRawWeeklyLossKg({
                weightKg: rollingWeight,
                heightCm,
                ageYears,
                gender,
                intensityLevel,
                caloriesPerDay: weekPlan.caloriesPerDay,
                stepsPerDay: weekPlan.stepsPerDay,
                runKmPerWeek: weekPlan.runKmPerWeek,
            }),
        );

        rollingWeight = Math.max(
            targetWeightKg ?? 0,
            roundToOneDecimal(rollingWeight - rawLosses[index]),
        );
    }

    const lossPhaseRawTotal = rawLosses
        .slice(0, lossWeeks)
        .reduce((sum, value) => sum + value, 0);

    const scaleFactor =
        totalLossNeeded !== null && lossPhaseRawTotal > 0
            ? totalLossNeeded / lossPhaseRawTotal
            : 1;

    const expectedWeights: number[] = [];
    let currentWeight = startWeightKg;

    for (let index = 0; index < numberOfWeeks; index += 1) {
        const week = index + 1;

        if (week > lossWeeks) {
            expectedWeights.push(
                roundToOneDecimal(targetWeightKg ?? currentWeight),
            );
            continue;
        }

        const scaledLoss = roundToOneDecimal(rawLosses[index] * scaleFactor);
        currentWeight = roundToOneDecimal(
            Math.max(targetWeightKg ?? 0, currentWeight - scaledLoss),
        );
        expectedWeights.push(currentWeight);
    }

    if (
        totalLossNeeded !== null &&
        lossWeeks > 0 &&
        expectedWeights[lossWeeks - 1] !== roundToOneDecimal(targetWeightKg!)
    ) {
        expectedWeights[lossWeeks - 1] = roundToOneDecimal(targetWeightKg!);
        for (let index = lossWeeks; index < numberOfWeeks; index += 1) {
            expectedWeights[index] = roundToOneDecimal(targetWeightKg!);
        }
    }

    return expectedWeights;
}

export type WeeklyPlanTableRow = {
    Week: number;
    "Calories/day": number;
    "Protein/day": number;
    "Steps/day target": number;
    "Run km/week": number;
    "Expected weight": number;
    "Week name": string;
    "Week Dailys": unknown;
};

export type StoredWeekPlanInput = {
    caloriesPerDay: number;
    stepsPerDay: number;
    runKmPerWeek: number;
};

export function computeExpectedWeightsForStoredWeeks(
    weekPlans: StoredWeekPlanInput[],
    input: Omit<ComputeExpectedWeightsInput, "weeks" | "numberOfWeeks">,
): number[] {
    return computeExpectedWeightsFromWeeklyPlan({
        ...input,
        numberOfWeeks: weekPlans.length,
        weeks: weekPlans.map((weekPlan) => ({
            caloriesPerDay: weekPlan.caloriesPerDay,
            stepsPerDay: weekPlan.stepsPerDay,
            runKmPerWeek: weekPlan.runKmPerWeek,
        })),
    });
}

export function applyComputedExpectedWeightsToTable(
    table: WeeklyPlanTableRow[],
    input: Omit<ComputeExpectedWeightsInput, "weeks">,
): WeeklyPlanTableRow[] {
    if (input.targetWeightKg === null || input.targetWeightKg === undefined) {
        return table;
    }

    const weeks = table.map((row) => ({
        caloriesPerDay: row["Calories/day"],
        stepsPerDay: row["Steps/day target"],
        runKmPerWeek: row["Run km/week"],
    }));

    const expectedWeights = computeExpectedWeightsFromWeeklyPlan({
        ...input,
        weeks,
    });

    return table.map((row, index) => ({
        ...row,
        "Expected weight": expectedWeights[index] ?? row["Expected weight"],
    }));
}
