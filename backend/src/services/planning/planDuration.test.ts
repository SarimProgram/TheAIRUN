import assert from "node:assert/strict";
import test from "node:test";
import {
    computeDailyFoodCalorieTarget,
    computeDailyFoodCaloriesByWeek,
    computeExpectedWeightsByWeek,
    resolvePlanDuration,
    estimateBaseMaintenanceKcal,
} from "./planDuration";
import { computeExpectedWeightsFromWeeklyPlan } from './expectedWeight';

const basePlan = {
    goalType: "weightloss",
    weightKg: 90,
    targetDate: null,
    runRaceDate: null,
};

test("keeps eight weeks as a floor for a short standard weight-loss plan", () => {
    const result = resolvePlanDuration({ ...basePlan, targetWeightKg: 87, timeHorizon: "STANDARD" });
    assert.equal(result.numberOfWeeks, 8);
});

test("extends a standard plan using current and target weight", () => {
    const result = resolvePlanDuration({ ...basePlan, targetWeightKg: 80, timeHorizon: "STANDARD" });
    assert.equal(result.derivedWeightToLoseKg, 10);
    assert.equal(result.plannedWeeklyLossKg, 0.5);
    assert.equal(result.numberOfWeeks, 20);
});

test("uses the selected aggressive pace without forcing the result to eight", () => {
    const result = resolvePlanDuration({ ...basePlan, targetWeightKg: 80, timeHorizon: "AGGRESSIVE" });
    assert.equal(result.numberOfWeeks, 10);
});

test("uses the target date before pace-based duration", () => {
    const now = new Date("2026-08-04T00:00:00.000Z");
    const result = resolvePlanDuration(
        {
            ...basePlan,
            targetWeightKg: 70,
            timeHorizon: "SPECIFIC_DATE",
            targetDate: new Date("2026-10-26T00:00:00.000Z"),
        },
        now
    );
    assert.equal(result.targetDeadlineWeeks, 13);
    assert.equal(result.numberOfWeeks, 13);
});

test("ignores a stale target date when pace preference is not specific date", () => {
    const now = new Date("2026-08-04T00:00:00.000Z");
    const result = resolvePlanDuration(
        {
            ...basePlan,
            targetWeightKg: 80,
            timeHorizon: "AGGRESSIVE",
            targetDate: new Date("2026-10-26T00:00:00.000Z"),
        },
        now
    );

    assert.equal(result.targetDeadlineWeeks, null);
    assert.equal(result.numberOfWeeks, 10);
    assert.equal(result.plannedWeeklyLossKg, 1);
});

test("preserves running-goal minimums", () => {
    const result = resolvePlanDuration({
        ...basePlan,
        goalType: "running",
        runGoal: "halfMarathon",
        runExperience: "beginner",
        targetWeightKg: null,
    });
    assert.equal(result.numberOfWeeks, 14);
});

test("computes a linear expected-weight curve to the target", () => {
    const weights = computeExpectedWeightsByWeek({
        startWeightKg: 95,
        targetWeightKg: 80,
        numberOfWeeks: 15,
        targetDeadlineWeeks: null,
    });

    assert.equal(weights.length, 15);
    assert.equal(weights[0], 94);
    assert.equal(weights[14], 80);
});

test("holds target weight during maintenance weeks after the deadline", () => {
    const weights = computeExpectedWeightsByWeek({
        startWeightKg: 90,
        targetWeightKg: 80,
        numberOfWeeks: 15,
        targetDeadlineWeeks: 13,
    });

    assert.equal(weights[12], 80);
    assert.equal(weights[13], 80);
    assert.equal(weights[14], 80);
});

test("computes pace-based daily food calories from base maintenance minus deficit", () => {
    const calories = computeDailyFoodCalorieTarget({
        weightKg: 95,
        heightCm: 180,
        ageYears: 35,
        gender: "male",
        intensityLevel: "ACTIVE",
        targetWeeklyLossKg: 1,
    });

    assert.ok(calories < 2200);
    assert.ok(calories >= 1400);
});

test('base food target excludes the training multiplier for the reported 95 kg profile', () => {
    const body = { weightKg: 95, heightCm: 178, ageYears: 25, gender: 'male' };
    assert.equal(estimateBaseMaintenanceKcal(body), 2332);
    for (const intensityLevel of ['STEADY', 'ACTIVE', 'PRO']) {
        assert.equal(computeDailyFoodCalorieTarget({ ...body, intensityLevel, targetWeeklyLossKg: 0.8 }), 1452);
        assert.equal(computeDailyFoodCalorieTarget({ ...body, intensityLevel, targetWeeklyLossKg: 0 }), 2332);
    }
});

test('stored calorie overrides cannot inflate the base or bypass the existing calorie floor', () => {
    const body = { weightKg: 95, heightCm: 178, ageYears: 25, gender: 'male', targetWeeklyLossKg: 0.8 };
    assert.equal(computeDailyFoodCalorieTarget({ ...body, dailyCalorieTarget: 2300 }), 1452);
    assert.equal(computeDailyFoodCalorieTarget({ ...body, dailyCalorieTarget: 900 }), 1400);
});

test('weekly base schedule is independent of intensity and accounts for calorie safeguards', () => {
    const body = { startWeightKg: 95, targetWeightKg: 78, heightCm: 178, ageYears: 25, gender: 'male',
        targetWeeklyLossKg: 1, numberOfWeeks: 17, targetDeadlineWeeks: null };
    const light = computeDailyFoodCaloriesByWeek({ ...body, intensityLevel: 'STEADY' });
    const pro = computeDailyFoodCaloriesByWeek({ ...body, intensityLevel: 'PRO' });
    assert.deepEqual(light, pro);
    assert.equal(pro?.[0], 1400);
    assert.ok(pro?.every((calories) => calories >= 1400));
});

test("prefers the stricter of stored dailyCalorieTarget and pace-based food target", () => {
    const paceBased = computeDailyFoodCalorieTarget({
        weightKg: 95,
        heightCm: 180,
        ageYears: 35,
        gender: "male",
        intensityLevel: "ACTIVE",
        dailyCalorieTarget: 2100,
        targetWeeklyLossKg: 1,
    });

    assert.ok(paceBased < 2100);
});

test("uses maintenance calories after the weight-loss deadline", () => {
    const caloriesByWeek = computeDailyFoodCaloriesByWeek({
        startWeightKg: 90,
        targetWeightKg: 80,
        heightCm: 175,
        ageYears: 40,
        gender: "female",
        intensityLevel: "ACTIVE",
        targetWeeklyLossKg: 0.5,
        numberOfWeeks: 15,
        targetDeadlineWeeks: 13,
    });

    assert.equal(caloriesByWeek?.length, 15);
    assert.ok(caloriesByWeek![0] < caloriesByWeek![13]);
    assert.equal(caloriesByWeek![13], caloriesByWeek![14]);
});

const savedBody = { goalType: 'weightloss', weightKg: 95, targetWeightKg: 79,
    heightCm: 178, ageYears: 25, gender: 'male', timeHorizon: 'AGGRESSIVE' };

test('duration for 95 to 79 kg extends to 21 weeks using the same calorie floor as generation', () => {
    const duration = resolvePlanDuration(savedBody);
    assert.equal(duration.numberOfWeeks, 21);
    const calories = computeDailyFoodCaloriesByWeek({ ...savedBody, startWeightKg: 95,
        numberOfWeeks: duration.numberOfWeeks, targetWeeklyLossKg: duration.plannedWeeklyLossKg, targetDeadlineWeeks: null })!;
    const weights = computeExpectedWeightsFromWeeklyPlan({ ...savedBody, startWeightKg: 95,
        numberOfWeeks: duration.numberOfWeeks, targetDeadlineWeeks: null,
        weeks: calories.map((caloriesPerDay) => ({ caloriesPerDay, stepsPerDay: 0, runKmPerWeek: 0 })) });
    assert.ok(calories.every((value) => value >= 1400));
    assert.equal(weights.at(-1), 79);
    assert.ok(weights.at(-2)! > 79, 'Do not add unnecessary extra weeks');
});

test('duration accounts for falling maintenance rather than dividing by the initial achievable loss', () => {
    const firstWeek = (2332 - 1400) * 7 / 7700;
    assert.ok(resolvePlanDuration(savedBody).numberOfWeeks > Math.ceil(16 / firstWeek));
});

test('duration honors the daily deficit cap when the calorie floor is not limiting', () => {
    const duration = resolvePlanDuration({ ...savedBody, weightKg: 100, targetWeightKg: 90, heightCm: 200 });
    assert.equal(duration.numberOfWeeks, 11);
});

test('weight-to-lose inputs also use the achievable duration', () => {
    assert.equal(resolvePlanDuration({ ...savedBody, targetWeightKg: null, weightToLoseKg: 16 }).numberOfWeeks, 21);
});

test('an unreachable goal fails with a validation error instead of looping or lowering the calorie floor', () => {
    assert.throws(() => resolvePlanDuration({ ...savedBody, weightKg: 50, targetWeightKg: 45,
        heightCm: 150, gender: 'female' }), (error: any) => error.status === 400 && /calorie safeguards/.test(error.message));
});

test('explicit dates that cannot support the goal request a later date', () => {
    assert.throws(() => resolvePlanDuration({ ...savedBody, timeHorizon: 'SPECIFIC_DATE',
        targetDate: new Date('2026-11-15T00:00:00Z') }, new Date('2026-11-05T00:00:00Z')),
    (error: any) => error.status === 400 && /target date is too soon/.test(error.message));
});
