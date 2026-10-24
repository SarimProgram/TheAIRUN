import assert from "node:assert/strict";
import test from "node:test";
import {
    computeDailyFoodCalorieTarget,
    computeDailyFoodCaloriesByWeek,
    computeExpectedWeightsByWeek,
    resolvePlanDuration,
} from "./planDuration";

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

test("computes pace-based daily food calories from TDEE minus deficit", () => {
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
