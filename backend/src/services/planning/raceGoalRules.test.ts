import assert from 'node:assert/strict';
import test from 'node:test';
import { canIncludeGoalPracticeRuns, enforceRaceGoalRules } from './raceGoalRules';

const table = [{ Week: 8, 'Calories/day': 1537, 'Run km/week': 6.5, 'Week Dailys': {
    runDays: 2, recoveryDays: 4, workoutDays: 1,
    runs: [{ runType: 'Goal Practice Run', sessions: 1, targetKm: 4 }, { runType: 'Easy Run', sessions: 1, targetKm: 2.5 }],
} }];

test('a distance goal or missing race answer does not authorize a race rehearsal', () => {
    for (const hasRaceGoal of [false, null, undefined]) {
        const plan = { hasRaceGoal, runGoal: '5k', trainingStyle: 'workout, runOnly' };
        assert.equal(canIncludeGoalPracticeRuns(plan), false);
        const output = enforceRaceGoalRules(table, plan);
        assert.deepEqual(output[0]['Week Dailys'].runs, [
            { runType: 'Easy Run', sessions: 1, targetKm: 4 }, { runType: 'Easy Run', sessions: 1, targetKm: 2.5 },
        ]);
        assert.equal(output[0]['Calories/day'], 1537);
        assert.equal(output[0]['Run km/week'], 6.5);
        assert.equal(output[0]['Week Dailys'].runDays, 2);
        assert.equal(output[0]['Week Dailys'].workoutDays, 1);
        assert.equal(output[0]['Week Dailys'].recoveryDays, 4);
    }
    assert.equal(table[0]['Week Dailys'].runs[0].runType, 'Goal Practice Run', 'the original input must remain intact');
});

test('explicit race goals with a supported distance retain race preparation', () => {
    for (const runGoal of ['5k', '10k', 'halfMarathon']) {
        const plan = { hasRaceGoal: true, runGoal };
        assert.equal(canIncludeGoalPracticeRuns(plan), true);
        assert.equal(enforceRaceGoalRules(table, plan), table);
    }
});

test('a race answer without a supported race distance does not authorize race preparation', () => {
    for (const runGoal of [null, undefined, 'speedImprovement']) {
        assert.equal(canIncludeGoalPracticeRuns({ hasRaceGoal: true, runGoal }), false);
        assert.equal(enforceRaceGoalRules(table, { hasRaceGoal: true, runGoal })[0]['Week Dailys'].runs[0].runType, 'Easy Run');
    }
});

test('walk-only fallback stays walking', () => {
    const output = enforceRaceGoalRules(table, { hasRaceGoal: false, trainingStyle: 'walkOnly' });
    assert.equal(output[0]['Week Dailys'].runs[0].runType, 'Walk');
});
