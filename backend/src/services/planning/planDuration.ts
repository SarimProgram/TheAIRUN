export type PlanDurationInput = {
    goalType: string;
    runGoal?: string | null;
    runExperience?: string | null;
    runRaceDate?: Date | null;
    targetDate?: Date | null;
    timeHorizon?: string | null;
    weightKg: number;
    targetWeightKg?: number | null;
    weightToLoseKg?: number | null;
};

export type PlanDurationResult = {
    numberOfWeeks: number;
    targetDeadlineWeeks: number | null;
    derivedWeightToLoseKg: number | null;
    plannedWeeklyLossKg: number | null;
};

export const MAX_SAFE_WEEKLY_LOSS_KG = 1.5;
export const MIN_DAILY_FOOD_CALORIES = 1400;
export const MAX_DAILY_CALORIE_DEFICIT = 1000;
export const KCAL_PER_KG_FAT = 7700;

function roundToOneDecimal(value: number): number {
    return Number(value.toFixed(1));
}

export function computeExpectedWeightsByWeek(input: {
    startWeightKg: number;
    targetWeightKg: number;
    numberOfWeeks: number;
    targetDeadlineWeeks: number | null;
}): number[] {
    const { startWeightKg, targetWeightKg, numberOfWeeks, targetDeadlineWeeks } = input;
    const totalLoss = Math.max(0, roundToOneDecimal(startWeightKg - targetWeightKg));

    if (totalLoss <= 0 || numberOfWeeks < 1) {
        return Array.from({ length: numberOfWeeks }, () => roundToOneDecimal(startWeightKg));
    }

    const lossWeeks = Math.max(1, Math.min(targetDeadlineWeeks ?? numberOfWeeks, numberOfWeeks));

    return Array.from({ length: numberOfWeeks }, (_, index) => {
        const week = index + 1;
        if (week > lossWeeks) {
            return roundToOneDecimal(targetWeightKg);
        }

        const progress = week / lossWeeks;
        const weight = startWeightKg - totalLoss * progress;
        return roundToOneDecimal(Math.max(targetWeightKg, weight));
    });
}

export function estimateBmrKcal(input: {
    weightKg: number;
    heightCm?: number | null;
    ageYears?: number | null;
    gender?: string | null;
}): number {
    if (input.heightCm && input.ageYears) {
        const genderOffset = input.gender?.trim().toLowerCase() === "female" ? -161 : 5;
        return Math.round(
            10 * input.weightKg + 6.25 * input.heightCm - 5 * input.ageYears + genderOffset,
        );
    }

    return Math.round(input.weightKg * 24);
}

export function estimateTdeeKcal(input: {
    weightKg: number;
    heightCm: number;
    ageYears: number;
    gender?: string | null;
    intensityLevel?: string | null;
}): number {
    const bmr = estimateBmrKcal(input);
    const multipliers: Record<string, number> = {
        STEADY: 1.2,
        ACTIVE: 1.375,
        PRO: 1.55,
    };
    const multiplier = multipliers[input.intensityLevel || "ACTIVE"] ?? 1.375;
    return Math.max(MIN_DAILY_FOOD_CALORIES, Math.round(bmr * multiplier));
}

export function computeDailyFoodCalorieTarget(input: {
    weightKg: number;
    heightCm: number | null;
    ageYears: number;
    gender?: string | null;
    intensityLevel?: string | null;
    dailyCalorieTarget?: number | null;
    targetWeeklyLossKg?: number | null;
}): number {
    if (
        input.dailyCalorieTarget !== null &&
        input.dailyCalorieTarget !== undefined &&
        input.dailyCalorieTarget > 0 &&
        (!input.heightCm || !input.ageYears)
    ) {
        return Math.round(input.dailyCalorieTarget);
    }

    if (!input.heightCm || !input.ageYears) {
        return Math.max(MIN_DAILY_FOOD_CALORIES, Math.round(input.dailyCalorieTarget ?? 2000));
    }

    const tdee = estimateTdeeKcal({
        weightKg: input.weightKg,
        heightCm: input.heightCm,
        ageYears: input.ageYears,
        gender: input.gender,
        intensityLevel: input.intensityLevel,
    });
    const weeklyLossKg = input.targetWeeklyLossKg ?? 0.5;
    const dailyDeficit = Math.min(
        MAX_DAILY_CALORIE_DEFICIT,
        (weeklyLossKg * KCAL_PER_KG_FAT) / 7
    );

    const paceBasedTarget = Math.max(MIN_DAILY_FOOD_CALORIES, Math.round(tdee - dailyDeficit));
    if (
        input.dailyCalorieTarget !== null &&
        input.dailyCalorieTarget !== undefined &&
        input.dailyCalorieTarget > 0
    ) {
        return Math.min(Math.round(input.dailyCalorieTarget), paceBasedTarget);
    }

    return paceBasedTarget;
}

export function computeDailyFoodCaloriesByWeek(input: {
    startWeightKg: number;
    targetWeightKg: number | null;
    heightCm: number | null;
    ageYears: number;
    gender?: string | null;
    intensityLevel?: string | null;
    dailyCalorieTarget?: number | null;
    targetWeeklyLossKg?: number | null;
    numberOfWeeks: number;
    targetDeadlineWeeks: number | null;
}): number[] | null {
    if (!input.heightCm || !input.ageYears || input.numberOfWeeks < 1) {
        return null;
    }

    const lossWeeks = Math.max(1, Math.min(input.targetDeadlineWeeks ?? input.numberOfWeeks, input.numberOfWeeks));
    const lossPhaseCalories = computeDailyFoodCalorieTarget({
        weightKg: input.startWeightKg,
        heightCm: input.heightCm,
        ageYears: input.ageYears,
        gender: input.gender,
        intensityLevel: input.intensityLevel,
        dailyCalorieTarget: input.dailyCalorieTarget,
        targetWeeklyLossKg: input.targetWeeklyLossKg,
    });
    const maintenanceWeightKg = input.targetWeightKg ?? input.startWeightKg;
    const maintenanceCalories = estimateTdeeKcal({
        weightKg: maintenanceWeightKg,
        heightCm: input.heightCm,
        ageYears: input.ageYears,
        gender: input.gender,
        intensityLevel: input.intensityLevel,
    });

    return Array.from({ length: input.numberOfWeeks }, (_, index) => {
        const week = index + 1;
        return week > lossWeeks ? maintenanceCalories : lossPhaseCalories;
    });
}

export function usesSpecificTargetDate(input: {
    timeHorizon?: string | null;
    targetDate?: Date | null;
}): boolean {
    if (input.timeHorizon !== "SPECIFIC_DATE" || !input.targetDate) {
        return false;
    }

    const date = input.targetDate instanceof Date ? input.targetDate : new Date(input.targetDate);
    return !Number.isNaN(date.getTime());
}

export function getRecommendedRunningWeeks(
    runGoal: string | null | undefined,
    runExperience: string | null | undefined
): number {
    const goal = runGoal || "5k";
    const experience = runExperience || "beginner";
    const baseWeeksByGoal: Record<string, number> = {
        "5k": 6,
        "10k": 8,
        halfMarathon: 12,
        speedImprovement: 6,
    };
    const experienceAdjustment: Record<string, number> = {
        beginner: 2,
        intermediate: 0,
        advanced: -1,
    };

    return Math.max(4, (baseWeeksByGoal[goal] ?? 8) + (experienceAdjustment[experience] ?? 0));
}

function inclusiveWeekCountToTarget(targetDate: Date, now: Date): number {
    if (targetDate.getTime() <= now.getTime()) return 1;

    const targetWeekEnd = new Date(targetDate);
    const dayFromMonday = (targetWeekEnd.getDay() + 6) % 7;
    targetWeekEnd.setDate(targetWeekEnd.getDate() - dayFromMonday + 6);
    targetWeekEnd.setHours(23, 59, 59, 999);

    return Math.max(1, Math.ceil((targetWeekEnd.getTime() - now.getTime()) / (7 * 24 * 60 * 60 * 1000)));
}

export function resolvePlanDuration(input: PlanDurationInput, now = new Date()): PlanDurationResult {
    const isRunningOnlyPlan = input.goalType === "running";
    const minWeeks = isRunningOnlyPlan
        ? getRecommendedRunningWeeks(input.runGoal, input.runExperience)
        : 8;
    const derivedWeightToLoseKg = input.targetWeightKg !== null && input.targetWeightKg !== undefined
        ? Math.max(0, Number((input.weightKg - input.targetWeightKg).toFixed(1)))
        : input.weightToLoseKg !== null && input.weightToLoseKg !== undefined
            ? input.weightToLoseKg
            : null;

    let numberOfWeeks = minWeeks;
    let targetDeadlineWeeks: number | null = null;
    let plannedWeeklyLossKg: number | null = null;

    if (isRunningOnlyPlan && input.runRaceDate) {
        targetDeadlineWeeks = inclusiveWeekCountToTarget(input.runRaceDate, now);
        numberOfWeeks = Math.max(minWeeks, targetDeadlineWeeks);
    } else if (usesSpecificTargetDate({ timeHorizon: input.timeHorizon, targetDate: input.targetDate })) {
        targetDeadlineWeeks = inclusiveWeekCountToTarget(input.targetDate!, now);
        numberOfWeeks = Math.max(minWeeks, targetDeadlineWeeks);
    } else if (!isRunningOnlyPlan && derivedWeightToLoseKg !== null && derivedWeightToLoseKg > 0) {
        const weeklyLossByHorizon: Record<string, number> = {
            RELAXED: 0.25,
            STANDARD: 0.5,
            AGGRESSIVE: 1,
            SPECIFIC_DATE: 0.5,
        };
        plannedWeeklyLossKg = weeklyLossByHorizon[input.timeHorizon || "STANDARD"] ?? 0.5;
        numberOfWeeks = Math.max(minWeeks, Math.ceil(derivedWeightToLoseKg / plannedWeeklyLossKg));
    } else if (input.timeHorizon) {
        const horizonWeeks: Record<string, number> = {
            RELAXED: isRunningOnlyPlan ? minWeeks + 4 : 12,
            STANDARD: isRunningOnlyPlan ? minWeeks + 2 : 8,
            AGGRESSIVE: isRunningOnlyPlan ? minWeeks : 6,
        };
        numberOfWeeks = Math.max(minWeeks, horizonWeeks[input.timeHorizon] || minWeeks);
    }

    return { numberOfWeeks, targetDeadlineWeeks, derivedWeightToLoseKg, plannedWeeklyLossKg };
}
