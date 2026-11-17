import assert from 'node:assert/strict';
import test from 'node:test';

type Row = Record<string, any>;

function matches(row: Row, where: Row = {}): boolean {
    return Object.entries(where).every(([key, condition]) => {
        if (key === 'OR') return (condition as Row[]).some(clause => matches(row, clause));
        if (condition && typeof condition === 'object' && !(condition instanceof Date)) {
            if ('in' in condition) return condition.in.includes(row[key]);
            if ('gte' in condition) return row[key] >= condition.gte;
        }
        return row[key] === condition;
    });
}

test('couple vs couple step challenge API', async t => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.JWT_SECRET = 'couple-challenge-route-tests-secret';
    t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-04T01:00:00Z').getTime() });
    const { prisma } = await import('../db/prisma');
    const { default: router } = await import('./coupleChallenge.routes');
    const { initializeSocket } = await import('../socket');
    const { createServer } = await import('node:http');
    const io = initializeSocket(createServer());
    t.after(() => { io.close(); });
    const liveUpdates: { rooms: string[]; event: string; payload: unknown }[] = [];
    t.mock.method(io, 'to', (rooms: string[]) => ({ emit: (event: string, payload: unknown) => { liveUpdates.push({ rooms, event, payload }); } }));

    const users: Record<string, Row> = {
        a1: { id: 'a1', displayName: 'Alex', timezone: 'Australia/Sydney', partnerId: 'a2' },
        a2: { id: 'a2', displayName: 'Sam', timezone: 'Australia/Sydney', partnerId: 'a1' },
        b1: { id: 'b1', displayName: 'Jo', timezone: 'Australia/Sydney', partnerId: 'b2' },
        b2: { id: 'b2', displayName: 'Kim', timezone: 'Australia/Sydney', partnerId: 'b1' },
        solo: { id: 'solo', displayName: 'Pat', timezone: 'UTC', partnerId: null },
    };
    const couples: Row[] = [];
    const challenges: Row[] = [];
    const steps: Row[] = [];
    const replace = (target: any, method: string, implementation: (...args: any[]) => any) => {
        const original = target[method];
        target[method] = implementation;
        t.after(() => { target[method] = original; });
    };
    const member = (id: string) => ({ id, displayName: users[id].displayName, timezone: users[id].timezone });
    const withMembers = (couple?: Row) => couple && { ...couple, userA: member(couple.userAId), userB: member(couple.userBId) };
    const withCouples = (challenge?: Row) => challenge && {
        ...challenge,
        challengerCouple: withMembers(couples.find(couple => couple.id === challenge.challengerCoupleId)),
        opponentCouple: withMembers(couples.find(couple => couple.id === challenge.opponentCoupleId)),
    };

    replace(prisma.user, 'findUnique', async ({ where }: any) => {
        const user = users[where.id];
        if (!user) return null;
        const partner = user.partnerId ? users[user.partnerId] : null;
        return { ...user, partner: partner ? { id: partner.id, partnerId: partner.partnerId } : null };
    });
    replace(prisma.couple, 'findUnique', async ({ where }: any) => withMembers(couples.find(couple => where.code
        ? couple.code === where.code
        : couple.userAId === where.userAId_userBId.userAId && couple.userBId === where.userAId_userBId.userBId)));
    replace(prisma.couple, 'create', async ({ data }: any) => {
        const couple = { id: `couple-${couples.length + 1}`, ...data };
        couples.push(couple);
        return withMembers(couple);
    });
    replace(prisma.coupleChallenge, 'create', async ({ data }: any) => {
        const challenge = { id: `challenge-${challenges.length + 1}`, status: 'PENDING', isTie: false, winnerCoupleId: null, completedAt: null, acceptedAt: null, startDayKey: null, endDayKey: null, endsAt: null, baselines: null, createdAt: new Date(), ...data };
        challenges.push(challenge);
        return withCouples(challenge);
    });
    replace(prisma.coupleChallenge, 'findMany', async ({ where }: any) => challenges.filter(row => matches(row, where)).map(withCouples));
    replace(prisma.coupleChallenge, 'findUnique', async ({ where }: any) => withCouples(challenges.find(row => row.id === where.id)) ?? null);
    replace(prisma.coupleChallenge, 'findUniqueOrThrow', async ({ where }: any) => withCouples(challenges.find(row => row.id === where.id)));
    replace(prisma.coupleChallenge, 'count', async ({ where }: any) => challenges.filter(row => matches(row, where)).length);
    replace(prisma.coupleChallenge, 'updateMany', async ({ where, data }: any) => {
        const rows = challenges.filter(row => matches(row, where));
        rows.forEach(row => Object.assign(row, data));
        return { count: rows.length };
    });
    replace(prisma.dailyStep, 'findMany', async ({ where }: any) => steps.filter(row => matches(row, where)));
    replace(prisma.dailyStep, 'findUnique', async ({ where }: any) => steps.find(row => row.userId === where.userId_date.userId && row.date.getTime() === where.userId_date.date.getTime()) ?? null);

    const handler = (method: string, path: string) =>
        (router.stack.find((layer: any) => layer.route?.path === path && layer.route.methods[method]) as any).route.stack[0].handle;
    const call = async (method: string, path: string, userId: string, options: { body?: unknown; params?: Row } = {}) => {
        let status = 200;
        let result: any;
        const res = { status(value: number) { status = value; return this; }, json(value: any) { result = value; return this; } };
        await handler(method, path)({ user: { id: userId }, body: options.body, params: options.params ?? {} }, res, (error: unknown) => { throw error; });
        return { status, result };
    };
    const daySteps = (userId: string, dayKey: string, count: number) => {
        const date = new Date(`${dayKey}T00:00:00Z`);
        const existing = steps.find(row => row.userId === userId && row.date.getTime() === date.getTime());
        if (existing) existing.steps = count;
        else steps.push({ userId, date, steps: count });
    };

    let codeA = '';
    let codeB = '';

    await t.test('a two-way linked couple gets one stable code, shared by both partners', async () => {
        const first = await call('get', '/me', 'a1');
        codeA = first.result.couple.code;
        assert.match(codeA, /^[A-Z2-9]{6}$/);
        assert.equal(first.result.couple.name, 'Alex & Sam');
        assert.equal((await call('get', '/me', 'a2')).result.couple.code, codeA);
        codeB = (await call('get', '/me', 'b1')).result.couple.code;
        assert.notEqual(codeA, codeB);
        assert.equal(couples.length, 2);
    });

    await t.test('users without a two-way link have no couple and cannot challenge', async () => {
        assert.equal((await call('get', '/me', 'solo')).result.couple, null);
        users.solo.partnerId = 'a1';
        assert.equal((await call('get', '/me', 'solo')).result.couple, null);
        users.solo.partnerId = null;
        const created = await call('post', '/', 'solo', { body: { opponentCode: codeA, type: 'FIRST_TO_100K', prize: 'dinner' } });
        assert.equal(created.status, 409);
    });

    await t.test('lookup confirms the other couple and rejects your own or unknown codes', async () => {
        assert.equal((await call('get', '/lookup/:code', 'a1', { params: { code: codeB.toLowerCase() } })).result.couple.name, 'Jo & Kim');
        assert.equal((await call('get', '/lookup/:code', 'a1', { params: { code: codeA } })).status, 400);
        assert.equal((await call('get', '/lookup/:code', 'a1', { params: { code: 'ZZZZZZ' } })).status, 404);
        assert.equal((await call('get', '/lookup/:code', 'a1', { params: { code: 'abc' } })).status, 400);
    });

    await t.test('invalid invites are rejected before anything is written', async () => {
        for (const body of [
            { opponentCode: codeB, type: 'FASTEST', prize: 'dinner' },
            { opponentCode: codeB, type: 'FIRST_TO_100K', prize: ' ' },
            { opponentCode: codeB, type: 'FIRST_TO_100K', prize: 'x'.repeat(101) },
            { opponentCode: codeB, type: 'FIRST_TO_100K', prize: 'dinner', challengerCoupleId: 'other' },
        ]) {
            assert.equal((await call('post', '/', 'a1', { body })).status, 400);
        }
        assert.equal((await call('post', '/', 'a1', { body: { opponentCode: codeA, type: 'FIRST_TO_100K', prize: 'dinner' } })).status, 400);
        assert.equal(challenges.length, 0);
    });

    let challengeId = '';
    await t.test('an invite shows as sent for the challengers and incoming for the other couple', async () => {
        liveUpdates.length = 0;
        const created = await call('post', '/', 'a1', { body: { opponentCode: codeB, type: 'FIRST_TO_100K', prize: 'dinner' } });
        assert.equal(created.status, 201);
        assert.deepEqual(liveUpdates, [{ rooms: ['user:a1', 'user:a2', 'user:b1', 'user:b2'], event: 'invitations:changed', payload: { scope: 'couple_challenge' } }]);
        challengeId = created.result.challenge.id;
        assert.equal((await call('post', '/', 'a2', { body: { opponentCode: codeB, type: 'MOST_STEPS_WEEK', prize: 'coffee' } })).status, 409);
        assert.equal((await call('get', '/me', 'a2')).result.sent.length, 1);
        const incoming = (await call('get', '/me', 'b2')).result.incoming;
        assert.equal(incoming.length, 1);
        assert.equal(incoming[0].theirCouple.name, 'Alex & Sam');
        assert.equal(incoming[0].prize, 'dinner');
    });

    await t.test('only the invited couple can accept, and steps count from acceptance', async () => {
        liveUpdates.length = 0;
        assert.equal((await call('post', '/:id/accept', 'a1', { params: { id: challengeId } })).status, 403);
        assert.equal((await call('post', '/:id/accept', 'solo', { params: { id: challengeId } })).status, 409);
        assert.equal(liveUpdates.length, 0);
        daySteps('a1', '2026-11-04', 3_000);
        daySteps('b1', '2026-11-04', 5_000);
        const accepted = await call('post', '/:id/accept', 'b1', { params: { id: challengeId } });
        assert.equal(accepted.result.challenge.status, 'ACTIVE');
        assert.equal(liveUpdates.length, 1);
        assert.equal(accepted.result.challenge.yourCouple.totalSteps, 0);
        assert.equal((await call('post', '/:id/accept', 'b2', { params: { id: challengeId } })).status, 409);

        daySteps('a1', '2026-11-04', 10_000);
        daySteps('a2', '2026-11-04', 4_000);
        daySteps('b1', '2026-11-05', 12_000);
        const active = (await call('get', '/me', 'a1')).result.active;
        assert.equal(active.yourCouple.name, 'Alex & Sam');
        assert.deepEqual(active.yourCouple.members.map((m: Row) => m.steps), [7_000, 4_000]);
        assert.equal(active.yourCouple.totalSteps, 11_000);
        assert.equal(active.theirCouple.totalSteps, 0);
        assert.equal(active.target, 100_000);
    });

    await t.test('reaching 100k completes the challenge once with the right winner for each side', async () => {
        t.mock.timers.setTime(new Date('2026-11-05T05:00:00Z').getTime());
        daySteps('b1', '2026-11-05', 60_000);
        daySteps('b2', '2026-11-05', 41_000);
        const forB = (await call('get', '/me', 'b1')).result;
        assert.equal(forB.active, null);
        assert.equal(forB.latestResult.winner, 'you');
        assert.equal(forB.latestResult.theirCouple.totalSteps, 11_000);
        assert.deepEqual(forB.medals.map((medal: Row) => [medal.prize, medal.opponentName]), [['dinner', 'Alex & Sam']]);
        assert.equal((await call('get', '/me', 'a1')).result.medals.length, 0);
        const forA = (await call('get', '/:id', 'a1', { params: { id: challengeId } })).result.challenge;
        assert.equal(forA.status, 'COMPLETED');
        assert.equal(forA.winner, 'them');
        assert.equal(challenges.filter(row => row.status === 'COMPLETED').length, 1);
    });

    await t.test('the weekly type counts the calendar week it is accepted in and settles after it ends', async () => {
        const created = await call('post', '/', 'b2', { body: { opponentCode: codeA, type: 'MOST_STEPS_WEEK', prize: 'a movie night' } });
        const id = created.result.challenge.id;
        assert.equal((await call('post', '/:id/decline', 'b1', { params: { id } })).status, 403);
        const accepted = (await call('post', '/:id/accept', 'a2', { params: { id } })).result.challenge;
        assert.equal(accepted.startDayKey, '2026-11-02');
        assert.equal(accepted.endDayKey, '2026-11-08');
        t.mock.timers.setTime(new Date('2026-11-09T01:00:00Z').getTime());
        const result = (await call('get', '/:id', 'a1', { params: { id } })).result.challenge;
        assert.equal(result.status, 'COMPLETED');
        assert.equal(result.yourCouple.totalSteps, 14_000);
        assert.equal(result.theirCouple.totalSteps, 106_000);
        assert.equal(result.winner, 'them');
    });

    await t.test('a pending invite can be declined by the invited couple or cancelled by the sender', async () => {
        liveUpdates.length = 0;
        const first = (await call('post', '/', 'a1', { body: { opponentCode: codeB, type: 'FIRST_TO_100K', prize: 'coffee' } })).result.challenge.id;
        assert.equal((await call('delete', '/:id', 'b1', { params: { id: first } })).status, 403);
        assert.equal((await call('post', '/:id/decline', 'b1', { params: { id: first } })).result.ok, true);
        assert.equal((await call('post', '/:id/accept', 'b2', { params: { id: first } })).status, 409);
        const second = (await call('post', '/', 'a1', { body: { opponentCode: codeB, type: 'FIRST_TO_100K', prize: 'coffee' } })).result.challenge.id;
        assert.equal((await call('delete', '/:id', 'a2', { params: { id: second } })).result.ok, true);
        assert.equal((await call('get', '/me', 'b1')).result.incoming.length, 0);
        assert.equal(liveUpdates.length, 4);
    });
});
