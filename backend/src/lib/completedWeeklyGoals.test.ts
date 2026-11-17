import assert from 'node:assert/strict';
import test from 'node:test';
import { countCompletedWeeklyGoals } from './completedWeeklyGoals';

test('weekly goals count completed categories once, excluding partial awards and other users', () => {
    const goal = { userId: 'you', dayKey: '2026-11-02', category: 'STEPS', progress: 1, earnedPoints: 30, maxPoints: 30 };
    const records = [
        goal, { ...goal },
        { ...goal, category: 'CALORIES' },
        { ...goal, dayKey: '2026-11-03' },
        { ...goal, dayKey: '2026-11-04', progress: 0.5 },
        { ...goal, dayKey: '2026-11-05', earnedPoints: 15 },
        { ...goal, category: 'HYDRATION', maxPoints: 0, earnedPoints: 0 },
        { ...goal, category: 'UNKNOWN' },
        { ...goal, userId: 'partner' },
    ];
    assert.equal(countCompletedWeeklyGoals(records, 'you'), 3);
    assert.equal(countCompletedWeeklyGoals(records, 'partner'), 1);
    assert.equal(countCompletedWeeklyGoals([], 'you'), 0);
});

test('agreed removals exclude matching categories for both partners from the weekly challenge', () => {
    const records = ['you', 'partner'].flatMap(userId => ['CALORIES', 'STEPS', 'WALK_RUN', 'MOBILITY', 'HYDRATION'].map(category => ({
        userId, category, dayKey: '2026-11-02', progress: 1, earnedPoints: 30, maxPoints: 30,
    })));
    for (const userId of ['you', 'partner']) {
        assert.equal(countCompletedWeeklyGoals(records, userId), 5);
        assert.equal(countCompletedWeeklyGoals(records, userId, ['steps']), 3);
        assert.equal(countCompletedWeeklyGoals(records, userId, ['calories', 'steps', 'workout', 'water']), 0);
    }
});
