import assert from 'node:assert/strict';
import test from 'node:test';
import { getCurrentWeekBounds, getWeekDayKeysForRange } from './weekBounds';

test('partner order does not change the shared week across timezones', () => {
    const now = new Date('2026-11-06T01:00:00Z');
    const a = getCurrentWeekBounds('Australia/Sydney', 'America/Los_Angeles', now);
    const b = getCurrentWeekBounds('America/Los_Angeles', 'Australia/Sydney', now);
    assert.deepEqual(a, b);
    assert.deepEqual(getWeekDayKeysForRange(a.weekStart, a.weekEnd, a.timezone), [
        '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08',
    ]);
});

test('a Sydney daylight saving week still includes exactly Monday through Sunday', () => {
    const bounds = getCurrentWeekBounds('Australia/Sydney', 'Australia/Sydney', new Date('2026-10-03T12:00:00Z'));
    const days = getWeekDayKeysForRange(bounds.weekStart, bounds.weekEnd, bounds.timezone);
    assert.equal(days.length, 7);
    assert.equal(days[0], '2026-09-28');
    assert.equal(days[6], '2026-10-04');
    assert.equal(bounds.weekEnd.getTime() - bounds.weekStart.getTime() + 1, 167 * 60 * 60 * 1000);
});
