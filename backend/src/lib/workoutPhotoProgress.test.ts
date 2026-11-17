import test from 'node:test';
import assert from 'node:assert/strict';
import { workoutPhotoProgress, workoutPhotoVisibility } from './workoutPhotoProgress';
import { dayKeyInTimezone } from './weekBounds';

test('multiple pairs count once, Monday starts a new week, future dates do not count', () => {
    assert.deepEqual(workoutPhotoProgress(['2026-11-01', '2026-11-02', '2026-11-02', '2026-11-03', '2026-11-05'], '2026-11-03'),
        { weeklyCount: 2, streak: 3, todayCompleted: true, completedDays: ['2026-11-02', '2026-11-03'] });
});
test('streak survives an unfinished today but breaks after a missed day', () => {
    assert.equal(workoutPhotoProgress(['2026-11-01', '2026-11-02'], '2026-11-03').streak, 2);
    assert.equal(workoutPhotoProgress(['2026-11-01', '2026-11-02'], '2026-11-04').streak, 0);
    assert.deepEqual(workoutPhotoProgress([], '2026-11-04'), { weeklyCount: 0, streak: 0, todayCompleted: false, completedDays: [] });
});
test('local midnight assigns the capture day across daylight saving offsets', () => {
    assert.equal(dayKeyInTimezone(new Date('2026-11-01T13:00:00Z'), 'Australia/Sydney'), '2026-11-02');
    assert.equal(dayKeyInTimezone(new Date('2026-11-01T12:59:59Z'), 'Australia/Sydney'), '2026-11-01');
});
test('only author and currently linked recipient can read a pair', () => {
    assert.deepEqual(workoutPhotoVisibility('a', null), { OR: [{ authorUserId: 'a' }] });
    assert.deepEqual(workoutPhotoVisibility('a', 'b'), { OR: [{ authorUserId: 'a' }, { authorUserId: 'b', recipientUserId: 'a' }] });
});
