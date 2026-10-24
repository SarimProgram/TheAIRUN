import assert from 'node:assert/strict';
import test from 'node:test';
import {
    BASE_KCAL_PER_STEP,
    computeActiveCalories,
    estimateWorkoutCalories,
    estimateWorkoutStepsCovered,
    kcalPerStep,
    REFERENCE_WEIGHT_KG,
    STEPS_PER_KM,
} from './activeCalories';

const profile70 = {
    weightKg: 70,
    heightCm: 175,
    ageYears: 30,
    gender: 'male',
};

const profile90 = {
    ...profile70,
    weightKg: 90,
};

test('kcalPerStep scales with body weight', () => {
    assert.equal(kcalPerStep(REFERENCE_WEIGHT_KG), BASE_KCAL_PER_STEP);
    assert.ok(kcalPerStep(90) > kcalPerStep(70));
});

test('run calories scale with weight and distance', () => {
    const lighter = estimateWorkoutCalories(
        { type: 'RUN', caloriesBurned: 0, distanceKm: 5, durationMinutes: 30 },
        70,
    );
    const heavier = estimateWorkoutCalories(
        { type: 'RUN', caloriesBurned: 0, distanceKm: 5, durationMinutes: 30 },
        90,
    );
    assert.equal(lighter, 350);
    assert.equal(heavier, 450);
});

test('workout-first logic subtracts run steps before step burn', () => {
    const withoutRun = computeActiveCalories({
        totalSteps: 8000,
        workouts: [],
        profile: profile70,
    });
    assert.equal(withoutRun.stepCalories, Math.round(8000 * BASE_KCAL_PER_STEP));

    const withRun = computeActiveCalories({
        totalSteps: 8000,
        workouts: [
            {
                type: 'RUN',
                caloriesBurned: 0,
                distanceKm: 5,
                durationMinutes: 30,
            },
        ],
        profile: profile70,
    });

    const coveredSteps = Math.round(5 * STEPS_PER_KM);
    assert.equal(withRun.stepsCoveredByWorkouts, coveredSteps);
    assert.equal(withRun.remainingSteps, 8000 - coveredSteps);
    assert.equal(withRun.workoutCalories, 350);
    assert.ok(withRun.activeCalories < withoutRun.activeCalories + withRun.workoutCalories);
    assert.equal(
        withRun.activeCalories,
        withRun.workoutCalories + withRun.stepCalories,
    );
});

test('gym workouts do not subtract steps', () => {
    const result = computeActiveCalories({
        totalSteps: 6000,
        workouts: [
            {
                type: 'GYM',
                caloriesBurned: 0,
                distanceKm: 0,
                durationMinutes: 45,
            },
        ],
        profile: profile90,
    });

    assert.equal(result.stepsCoveredByWorkouts, 0);
    assert.equal(result.remainingSteps, 6000);
    assert.ok(result.workoutCalories > 0);
});
