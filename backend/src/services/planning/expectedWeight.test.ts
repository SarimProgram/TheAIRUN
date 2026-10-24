import assert from "node:assert/strict";
import test from "node:test";
import {
    computeExpectedWeightsFromWeeklyPlan,
    estimateRawWeeklyLossKg,
    estimateWeeklyActivityKcal,
} from "./expectedWeight";

const sarimWeeks = [
    { caloriesPerDay: 2100, stepsPerDay: 7000, runKmPerWeek: 10.5 },
    { caloriesPerDay: 2050, stepsPerDay: 7500, runKmPerWeek: 11.0 },
    { caloriesPerDay: 2000, stepsPerDay: 7800, runKmPerWeek: 11.5 },
    { caloriesPerDay: 1950, stepsPerDay: 8000, runKmPerWeek: 12.0 },
    { caloriesPerDay: 1900, stepsPerDay: 8200, runKmPerWeek: 12.5 },
    { caloriesPerDay: 1850, stepsPerDay: 8500, runKmPerWeek: 13.0 },
    { caloriesPerDay: 1800, stepsPerDay: 8500, runKmPerWeek: 13.5 },
    { caloriesPerDay: 1750, stepsPerDay: 8800, runKmPerWeek: 14.0 },
    { caloriesPerDay: 1700, stepsPerDay: 9000, runKmPerWeek: 14.5 },
    { caloriesPerDay: 1680, stepsPerDay: 9200, runKmPerWeek: 15.0 },
    { caloriesPerDay: 1660, stepsPerDay: 9300, runKmPerWeek: 15.5 },
    { caloriesPerDay: 1640, stepsPerDay: 9500, runKmPerWeek: 16.0 },
    { caloriesPerDay: 1625, stepsPerDay: 9500, runKmPerWeek: 16.5 },
    { caloriesPerDay: 1610, stepsPerDay: 9700, runKmPerWeek: 17.0 },
    { caloriesPerDay: 1600, stepsPerDay: 9800, runKmPerWeek: 17.5 },
    { caloriesPerDay: 1590, stepsPerDay: 9800, runKmPerWeek: 18.0 },
    { caloriesPerDay: 1600, stepsPerDay: 9000, runKmPerWeek: 14.0 },
];

const sarimProfile = {
    startWeightKg: 95,
    targetWeightKg: 78,
    heightCm: 180,
    ageYears: 25,
    gender: "male",
    intensityLevel: "ACTIVE",
    numberOfWeeks: 17,
    targetDeadlineWeeks: null,
};

test("week 1 raw loss is lower than later weeks when calories are higher", () => {
    const weekOneLoss = estimateRawWeeklyLossKg({
        weightKg: 95,
        heightCm: 180,
        ageYears: 25,
        gender: "male",
        intensityLevel: "ACTIVE",
        ...sarimWeeks[0],
    });
    const weekEightLoss = estimateRawWeeklyLossKg({
        weightKg: 88,
        heightCm: 180,
        ageYears: 25,
        gender: "male",
        intensityLevel: "ACTIVE",
        ...sarimWeeks[7],
    });

    assert.ok(weekOneLoss < weekEightLoss);
    assert.ok(weekOneLoss < 0.8);
});

test("computed curve reaches the goal weight on the final loss week", () => {
    const weights = computeExpectedWeightsFromWeeklyPlan({
        ...sarimProfile,
        weeks: sarimWeeks,
    });

    assert.equal(weights.length, 17);
    assert.equal(weights[0], 94.3);
    assert.equal(weights[16], 78);
    assert.equal(weights[15], 79.1);
});

test("weekly loss increases as food calories tighten", () => {
    const weights = computeExpectedWeightsFromWeeklyPlan({
        ...sarimProfile,
        weeks: sarimWeeks,
    });

    const weekOneLoss = 95 - weights[0];
    const weekEightLoss = weights[6] - weights[7];

    assert.ok(weekEightLoss > weekOneLoss);
});

test("activity calories rise with steps and walk volume", () => {
    const low = estimateWeeklyActivityKcal(95, 7000, 10.5);
    const high = estimateWeeklyActivityKcal(95, 9000, 15);

    assert.ok(high > low);
});
