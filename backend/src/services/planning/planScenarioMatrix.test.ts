import assert from 'node:assert/strict';
import test from 'node:test';
import {
    computeDailyFoodCaloriesByWeek,
    estimateBaseMaintenanceKcal,
    estimateBmrKcal,
    MAX_DAILY_CALORIE_DEFICIT,
    MIN_DAILY_FOOD_CALORIES,
    PlanDurationInput,
    resolvePlanDuration,
} from './planDuration';
import { computeExpectedWeightsFromWeeklyPlan } from './expectedWeight';

type Scenario = PlanDurationInput & {
    id: string;
    expectedWeeks?: number;
    expectedFirstCalories?: number;
    blocked?: boolean;
};

// Use a fixed planning date so calendar-goal tests are repeatable.
const now = new Date('2026-11-05T00:00:00Z');
const scenarios: Scenario[] = [
    { id: 'Male aggressive (Sarim)', gender: 'male', ageYears: 25, heightCm: 178, weightKg: 95, targetWeightKg: 79,
        goalType: 'weightloss', timeHorizon: 'AGGRESSIVE', expectedWeeks: 21, expectedFirstCalories: 1400 },
    { id: 'Female, same measurements', gender: 'female', ageYears: 25, heightCm: 178, weightKg: 95, targetWeightKg: 79,
        goalType: 'weightloss', timeHorizon: 'AGGRESSIVE' },
    { id: 'Male standard', gender: 'male', ageYears: 35, heightCm: 185, weightKg: 90, targetWeightKg: 85,
        goalType: 'weightloss', timeHorizon: 'STANDARD', expectedWeeks: 10, expectedFirstCalories: 1713 },
    { id: 'Female standard', gender: 'female', ageYears: 30, heightCm: 165, weightKg: 80, targetWeightKg: 70,
        goalType: 'weightloss', timeHorizon: 'STANDARD' },
    { id: 'Female smaller weight goal', gender: 'female', ageYears: 35, heightCm: 170, weightKg: 80, targetWeightKg: 76,
        goalType: 'weightloss', timeHorizon: 'STANDARD', expectedWeeks: 11 },
    { id: 'Male relaxed', gender: 'male', ageYears: 50, heightCm: 170, weightKg: 100, targetWeightKg: 85,
        goalType: 'weightloss', timeHorizon: 'RELAXED' },
    { id: 'Female relaxed', gender: 'female', ageYears: 45, heightCm: 160, weightKg: 72, targetWeightKg: 65,
        goalType: 'weightloss', timeHorizon: 'RELAXED' },
    { id: 'Tall male aggressive', gender: 'male', ageYears: 45, heightCm: 200, weightKg: 110, targetWeightKg: 95,
        goalType: 'weightloss', timeHorizon: 'AGGRESSIVE' },
    { id: 'Combined goal, male', gender: 'male', ageYears: 28, heightCm: 180, weightKg: 88, targetWeightKg: 80,
        goalType: 'both', timeHorizon: 'STANDARD', runGoal: '10k', runExperience: 'intermediate' },
    { id: 'Combined goal, female', gender: 'female', ageYears: 40, heightCm: 172, weightKg: 68, targetWeightKg: 63,
        goalType: 'both', timeHorizon: 'RELAXED', runGoal: '5k', runExperience: 'beginner' },
    { id: 'Running 5K, male', gender: 'male', ageYears: 30, heightCm: 180, weightKg: 78, targetWeightKg: null,
        goalType: 'running', runGoal: '5k', runExperience: 'beginner', expectedWeeks: 8, expectedFirstCalories: 2112 },
    { id: 'Running 10K, female', gender: 'female', ageYears: 35, heightCm: 165, weightKg: 60, targetWeightKg: null,
        goalType: 'running', runGoal: '10k', runExperience: 'intermediate', expectedWeeks: 8, expectedFirstCalories: 1554 },
    { id: 'Short calendar goal', gender: 'male', ageYears: 25, heightCm: 178, weightKg: 95, targetWeightKg: 94,
        goalType: 'weightloss', timeHorizon: 'SPECIFIC_DATE', targetDate: new Date('2026-11-29T00:00:00Z') },
    { id: 'Fractional calendar pace', gender: 'male', ageYears: 35, heightCm: 185, weightKg: 90, targetWeightKg: 85,
        goalType: 'weightloss', timeHorizon: 'SPECIFIC_DATE', targetDate: new Date('2027-03-14T00:00:00Z') },
    { id: 'Deadline too short', gender: 'male', ageYears: 25, heightCm: 178, weightKg: 95, targetWeightKg: 79,
        goalType: 'weightloss', timeHorizon: 'SPECIFIC_DATE', targetDate: new Date('2026-11-15T00:00:00Z'), blocked: true },
    { id: 'No deficit available above floor', gender: 'female', ageYears: 65, heightCm: 150, weightKg: 50, targetWeightKg: 45,
        goalType: 'weightloss', timeHorizon: 'AGGRESSIVE', blocked: true },
];

function simulate(scenario: Scenario) {
    const duration = resolvePlanDuration(scenario, now);
    // Match the weekly generation route, including calendar-based loss paces.
    const datePace = duration.targetDeadlineWeeks && duration.derivedWeightToLoseKg
        ? duration.derivedWeightToLoseKg / duration.targetDeadlineWeeks : null;
    const pace = scenario.goalType === 'running' ? 0 : duration.plannedWeeklyLossKg ?? datePace ?? 0.5;
    const scheduleInput = {
        startWeightKg: scenario.weightKg, targetWeightKg: scenario.targetWeightKg ?? null,
        heightCm: scenario.heightCm!, ageYears: scenario.ageYears!, gender: scenario.gender,
        targetWeeklyLossKg: pace, numberOfWeeks: duration.numberOfWeeks, targetDeadlineWeeks: duration.targetDeadlineWeeks,
    };
    const calories = computeDailyFoodCaloriesByWeek(scheduleInput)!;
    const weights = computeExpectedWeightsFromWeeklyPlan({
        ...scheduleInput, heightCm: scenario.heightCm!,
        weeks: calories.map((caloriesPerDay) => ({ caloriesPerDay, stepsPerDay: 8000, runKmPerWeek: 15 })),
    });
    return { duration, calories, weights, scheduleInput };
}

const report: Record<string, unknown>[] = [];
for (const scenario of scenarios) {
    test(`plan matrix: ${scenario.id}`, () => {
        const summary = {
            scenario: scenario.id, gender: scenario.gender, age: scenario.ageYears, heightCm: scenario.heightCm,
            startKg: scenario.weightKg, targetKg: scenario.targetWeightKg, goal: scenario.goalType,
            pace: scenario.timeHorizon ?? scenario.runGoal,
        };
        if (scenario.blocked) {
            assert.throws(() => simulate(scenario), (error: any) => error.status === 400);
            report.push({ ...summary, result: 'BLOCKED AS EXPECTED' });
            return;
        }
        const result = simulate(scenario);
        report.push({ ...summary, weeks: result.duration.numberOfWeeks,
            bmr: estimateBmrKcal({ ...scenario }), baselineMaintenance: estimateBaseMaintenanceKcal({ ...scenario }),
            firstBaseKcal: result.calories[0], lastBaseKcal: result.calories.at(-1),
            finalForecastKg: result.weights.at(-1), result: 'CALCULATED' });
        assert.equal(result.calories.length, result.duration.numberOfWeeks);
        assert.equal(result.weights.length, result.duration.numberOfWeeks);
        assert.ok(result.calories.every((value) => value >= MIN_DAILY_FOOD_CALORIES));
        assert.deepEqual(computeDailyFoodCaloriesByWeek({ ...result.scheduleInput, intensityLevel: 'PRO' }),
            computeDailyFoodCaloriesByWeek({ ...result.scheduleInput, intensityLevel: 'STEADY' }));
        if (scenario.expectedWeeks) assert.equal(result.duration.numberOfWeeks, scenario.expectedWeeks);
        if (scenario.expectedFirstCalories) assert.equal(result.calories[0], scenario.expectedFirstCalories);
        if (scenario.goalType === 'running') {
            assert.ok(result.weights.every((value) => value === scenario.weightKg));
        } else {
            assert.equal(result.weights.at(-1), scenario.targetWeightKg);
        }
        let weight = scenario.weightKg;
        for (let index = 0; index < result.calories.length; index++) {
            const maintenance = estimateBaseMaintenanceKcal({ ...scenario, weightKg: weight });
            const deficit = Math.max(0, maintenance - result.calories[index]);
            assert.ok(deficit <= MAX_DAILY_CALORIE_DEFICIT);
            weight = Math.max(scenario.targetWeightKg ?? 0, weight - deficit * 7 / 7700);
        }
    });
}

test.after(() => {
    if (process.env.PRINT_PLAN_MATRIX === '1') console.log('PLAN_MATRIX_RESULTS=' + JSON.stringify(report));
});
