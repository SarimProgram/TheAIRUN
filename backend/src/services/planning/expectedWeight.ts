import { kcalPerStep, REFERENCE_WEIGHT_KG } from "../../lib/activeCalories";
import {
    estimateBaseMaintenanceKcal,
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
    const maintenance = estimateBaseMaintenanceKcal({
        weightKg: input.weightKg,
        heightCm: input.heightCm,
        ageYears: input.ageYears,
        gender: input.gender,
    });
    const foodKcal = input.caloriesPerDay * 7;
    // Logged activity increases the food allowance by the same amount, once.
    return maintenance * 7 - foodKcal;
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
 * Uses baseline maintenance recalculated as weight drops. Planned exercise is
 * not an extra deficit when its calories are credited back to the food allowance.
 * Never force a target weight that the calculated deficit does not support.
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
    const expectedWeights: number[] = [];
    let rollingWeight = startWeightKg;

    for (let index = 0; index < numberOfWeeks; index += 1) {
        const week = index + 1;
        const weekPlan = weeks[index] ?? weeks[weeks.length - 1];

        if (week > lossWeeks) {
            expectedWeights.push(roundToOneDecimal(rollingWeight));
            continue;
        }

        const lossKg = estimateRawWeeklyLossKg({
            weightKg: rollingWeight,
            heightCm,
            ageYears,
            gender,
            intensityLevel,
            caloriesPerDay: weekPlan.caloriesPerDay,
            stepsPerDay: weekPlan.stepsPerDay,
            runKmPerWeek: weekPlan.runKmPerWeek,
        });

        rollingWeight = Math.max(
            targetWeightKg ?? 0,
            rollingWeight - lossKg,
        );
        expectedWeights.push(roundToOneDecimal(rollingWeight));
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
