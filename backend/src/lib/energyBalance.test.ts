import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateCaloriesRemaining } from './energyBalance';
import { computeActiveCalories } from './activeCalories';

test('remaining food credits actual activity once, including rest days and overspending', () => {
    assert.equal(calculateCaloriesRemaining(1900, 400, 2000), 300);
    assert.equal(calculateCaloriesRemaining(1900, 0, 2000), -100);
    assert.equal(calculateCaloriesRemaining(1900, 600, 2000), 500);
    assert.equal(calculateCaloriesRemaining(1900, 400, 0), 2300);
});

test('workout-covered steps do not earn a second food credit', () => {
    const burn = computeActiveCalories({
        totalSteps: 6500,
        workouts: [{ type: 'RUN', distanceKm: 5, caloriesBurned: 0, durationMinutes: 30 }],
        profile: { weightKg: 70, heightCm: 175, ageYears: 30, gender: 'male' },
    });
    assert.equal(burn.stepCalories, 0);
    assert.equal(burn.activeCalories, 350);
    assert.equal(calculateCaloriesRemaining(1900, burn.activeCalories, 2000), 250);
});
