import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL ||= 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET ||= 'partner-food-widget-test-secret';

test('next midnight follows the user timezone, including DST changes', async () => {
    const { nextMidnightInTimezone } = await import('./partnerFoodWidget');
    // 1:00 PM in Sydney (UTC+11) is 02:00 UTC; midnight is 13:00 UTC.
    assert.equal(nextMidnightInTimezone(new Date('2026-11-13T02:00:00Z'), 'Australia/Sydney').toISOString(), '2026-11-13T13:00:00.000Z');
    assert.equal(nextMidnightInTimezone(new Date('2026-11-13T23:59:00Z'), 'UTC').toISOString(), '2026-11-14T00:00:00.000Z');
    // New York leaves DST on 2026-11-01; the next midnight is still local midnight (05:00 UTC).
    assert.equal(nextMidnightInTimezone(new Date('2026-11-01T12:00:00Z'), 'America/New_York').toISOString(), '2026-11-02T05:00:00.000Z');
});

test('a waiting plate outranks a logged one, and logged plates only show on their day', async () => {
    const { choosePlate } = await import('./partnerFoodWidget');
    const now = new Date('2026-11-13T02:00:00Z');
    const later = new Date('2026-11-16T00:00:00Z');
    const plate = (id: string, status: string, createdAt: string, respondedAt: string | null = null) =>
        ({ id, status, createdAt: new Date(createdAt), respondedAt: respondedAt ? new Date(respondedAt) : null, expiresAt: later });

    const waiting = plate('waiting', 'PENDING', '2026-11-13T00:00:00Z');
    const logged = plate('logged', 'ACCEPTED', '2026-11-13T01:00:00Z', '2026-11-13T01:30:00Z');
    assert.equal(choosePlate([logged, waiting], now, 'Australia/Sydney')?.id, 'waiting');
    assert.equal(choosePlate([logged], now, 'Australia/Sydney')?.id, 'logged');

    const yesterday = plate('old', 'ACCEPTED', '2026-11-12T01:00:00Z', '2026-11-12T01:30:00Z');
    assert.equal(choosePlate([yesterday], now, 'Australia/Sydney'), null);
    assert.equal(choosePlate([{ ...waiting, expiresAt: new Date('2026-11-13T01:00:00Z') }], now, 'UTC'), null);
});

test('feed tokens are random and only their hash is comparable', async () => {
    const { createFeedToken, hashFeedToken } = await import('./partnerFoodWidget');
    const a = createFeedToken();
    const b = createFeedToken();
    assert.notEqual(a, b);
    assert.ok(a.length >= 40);
    assert.equal(hashFeedToken(a), hashFeedToken(a));
    assert.notEqual(hashFeedToken(a), a);
});
