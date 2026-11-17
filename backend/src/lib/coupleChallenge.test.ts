import assert from 'node:assert/strict';
import test from 'node:test';
import {
    COUPLE_CODE_ALPHABET,
    coupleName,
    evaluateChallenge,
    generateCoupleCode,
    isValidCoupleCode,
    memberChallengeSteps,
    normalizeCoupleCode,
} from './coupleChallenge';

test('couple codes are 6 unambiguous characters and normalise user input', () => {
    const code = generateCoupleCode();
    assert.equal(code.length, 6);
    assert.ok(isValidCoupleCode(code));
    assert.ok(![...'O0I1'].some(char => COUPLE_CODE_ALPHABET.includes(char)));
    assert.equal(normalizeCoupleCode(' k7q-2mx '), 'K7Q2MX');
    assert.equal(isValidCoupleCode('K7Q2M0'), false);
    assert.equal(isValidCoupleCode('K7Q2M'), false);
});

test('couple names use first names joined with an ampersand', () => {
    assert.equal(coupleName(['Alex Smith', 'Sam']), 'Alex & Sam');
    assert.equal(coupleName(['', 'Sam']), 'Partner & Sam');
});

test('member steps stay inside the window and subtract the start-day baseline', () => {
    const rows = [
        { dayKey: '2026-11-01', steps: 9_000 },
        { dayKey: '2026-11-02', steps: 6_000 },
        { dayKey: '2026-11-03', steps: 8_000 },
        { dayKey: '2026-11-09', steps: 7_000 },
    ];
    const window = { startDayKey: '2026-11-02', endDayKey: '2026-11-08' };
    assert.equal(memberChallengeSteps(rows, window), 14_000);
    assert.equal(memberChallengeSteps(rows, window, { dayKey: '2026-11-02', steps: 4_000 }), 10_000);
    assert.equal(memberChallengeSteps(rows, window, { dayKey: '2026-11-02', steps: 7_000 }), 8_000);
});

test('first to 100k finishes when either couple reaches the target', () => {
    const now = new Date();
    assert.deepEqual(evaluateChallenge({ type: 'FIRST_TO_100K', challengerSteps: 99_999, opponentSteps: 50_000, now }), { finished: false });
    assert.deepEqual(evaluateChallenge({ type: 'FIRST_TO_100K', challengerSteps: 80_000, opponentSteps: 100_000, now }), { finished: true, winner: 'opponent', isTie: false });
    assert.deepEqual(evaluateChallenge({ type: 'FIRST_TO_100K', challengerSteps: 100_500, opponentSteps: 100_500, now }), { finished: true, winner: null, isTie: true });
});

test('most steps this week finishes only after the week ends', () => {
    const endsAt = new Date('2026-11-08T12:59:59.999Z');
    const before = new Date('2026-11-08T12:00:00Z');
    const after = new Date('2026-11-08T13:00:00Z');
    assert.deepEqual(evaluateChallenge({ type: 'MOST_STEPS_WEEK', challengerSteps: 300_000, opponentSteps: 1, now: before, endsAt }), { finished: false });
    assert.deepEqual(evaluateChallenge({ type: 'MOST_STEPS_WEEK', challengerSteps: 70_000, opponentSteps: 60_000, now: after, endsAt }), { finished: true, winner: 'challenger', isTie: false });
    assert.deepEqual(evaluateChallenge({ type: 'MOST_STEPS_WEEK', challengerSteps: 5, opponentSteps: 5, now: after, endsAt }), { finished: true, winner: null, isTie: true });
});
