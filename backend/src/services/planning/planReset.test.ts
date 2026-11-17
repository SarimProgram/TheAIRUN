import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPlanResetData, resetPlanSchema } from './planReset';

const input = {
    goalType: 'weightloss', weightKg: 80, targetWeightKg: 70, timeHorizon: 'STANDARD',
    trainingStyle: 'walkOnly', intensityLevel: 'ACTIVE', availableDays: [0, 2, 4],
};

test('reset needs no height, gender, or age and strips incoming profile overrides', () => {
    const parsed = resetPlanSchema.parse({ ...input, heightCm: 190, gender: 'male', ageYears: 99 });
    const data = buildPlanResetData(parsed);
    assert.equal(data.weightToLoseKg, 10);
    assert.equal(data.activityPreference, 'MOSTLY_WALKING');
    assert.equal('heightCm' in data, false);
    assert.equal('ageYears' in data, false);
    assert.equal('gender' in data, false);
});

test('running reset clears stale weight targets, deadlines, and generated calorie overrides', () => {
    const data = buildPlanResetData(resetPlanSchema.parse({
        ...input, goalType: 'running', trainingStyle: 'runOnly', runGoal: '10k', runExperience: 'beginner',
        targetDate: '2099-01-01T00:00:00.000Z',
    }));
    assert.equal(data.targetWeightKg, null);
    assert.equal(data.weightToLoseKg, null);
    assert.equal(data.targetDate, null);
    assert.equal(data.timeHorizon, null);
    assert.equal(data.runDietFocus, 'performance');
    assert.equal(data.dailyCalorieTarget, null);
});

test('weight-loss reset clears stale running goals and race dates', () => {
    const data = buildPlanResetData(resetPlanSchema.parse({
        ...input, runGoal: 'halfMarathon', runExperience: 'advanced', runRaceDate: '2099-01-01T00:00:00.000Z',
    }));
    assert.equal(data.runGoal, null);
    assert.equal(data.runExperience, null);
    assert.equal(data.runRaceDate, null);
    assert.equal(data.hasRaceGoal, false);
});

test('combined goal retains weight and running inputs', () => {
    const data = buildPlanResetData(resetPlanSchema.parse({
        ...input, goalType: 'both', trainingStyle: 'walkAndRun', runGoal: '5k', runExperience: 'intermediate',
    }));
    assert.equal(data.targetWeightKg, 70);
    assert.equal(data.runGoal, '5k');
    assert.equal(data.runDietFocus, 'weightloss');
});

test('reset rejects missing conditional answers and invalid training schedules', () => {
    for (const override of [
        { weightKg: 0 }, { weightKg: NaN }, { targetWeightKg: null }, { targetWeightKg: 81 },
        { timeHorizon: undefined }, { availableDays: [0, 0, 0] }, { availableDays: [0, 2] },
        { availableDays: [0, 2, 7] }, { timeHorizon: 'SPECIFIC_DATE', targetDate: null },
        { timeHorizon: 'SPECIFIC_DATE', targetDate: '2000-01-01T00:00:00.000Z' },
        { timeHorizon: 'SPECIFIC_DATE', targetDate: new Date(Date.now() + 86400000).toISOString() },
        { goalType: 'running', trainingStyle: 'runOnly' },
        { goalType: 'both', trainingStyle: 'walkOnly', runGoal: '5k', runExperience: 'beginner' },
    ]) {
        assert.equal(resetPlanSchema.safeParse({ ...input, ...override }).success, false, JSON.stringify(override));
    }
});
