import assert from 'node:assert/strict';
import test from 'node:test';

test('weekly prize API shares selection only with the linked partner and scopes scores to this week', async t => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.JWT_SECRET = 'week-prize-route-tests-secret';
    t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-06T01:00:00Z').getTime() });
    const { prisma } = await import('../db/prisma');
    const { default: router } = await import('./weekprize.routes');
    const { initializeSocket } = await import('../socket');
    const { createServer } = await import('node:http');
    const io = initializeSocket(createServer());
    t.after(() => { io.close(); });
    const liveUpdates: { rooms: string[]; event: string; payload: unknown }[] = [];
    t.mock.method(io, 'to', (rooms: string[]) => ({ emit: (event: string, payload: unknown) => { liveUpdates.push({ rooms, event, payload }); } }));
    const handler = (method: string, path: string) => (router.stack.find((layer: any) => layer.route?.path === path && layer.route.methods[method]) as any).route.stack[0].handle;
    const rows = new Map<string, any>();
    let linked = true;
    let reciprocal = true;
    const timezones: Record<string, string> = { a: 'Australia/Sydney', b: 'Australia/Sydney' };
    let previousGoals: any[] = [];
    let removedGoals: string[] = [];
    const replace = (target: any, method: string, implementation: (...args: any[]) => any) => {
        const original = target[method];
        target[method] = implementation;
        t.after(() => { target[method] = original; });
    };
    replace(prisma.weeklyGoalRemoval, 'findMany', async ({ where }: any) => {
        assert.deepEqual(where.acceptedAt, { not: null });
        return removedGoals.map(goal => ({ goal }));
    });
    const pushes: any[] = [];
    replace(globalThis, 'fetch', async (_url: string, init: any) => {
        pushes.push(JSON.parse(init.body));
        return { ok: true, json: async () => ({ data: [{ status: 'ok' }] }) };
    });
    const flushPushes = () => new Promise(resolve => setImmediate(resolve));
    replace(prisma.user, 'findUnique', async ({ where }: any) => ({
        displayName: where.id.toUpperCase(), expoPushToken: `ExponentPushToken[${where.id}]`, notificationPreferences: null,
        timezone: timezones[where.id], partnerId: linked ? (where.id === 'a' ? 'b' : 'a') : null,
        partner: linked ? { id: where.id === 'a' ? 'b' : 'a', partnerId: reciprocal ? where.id : 'stranger', displayName: 'Partner', timezone: timezones[where.id === 'a' ? 'b' : 'a'] } : null,
    }));
    const key = (pair: any) => JSON.stringify(pair);
    let lookupCount = 0;
    let writeCount = 0;
    replace(prisma.weekPrize, 'findUnique', async ({ where }: any) => {
        lookupCount += 1;
        return rows.get(key(where.userAId_userBId_weekStart)) ?? null;
    });
    replace(prisma.weekPrize, 'upsert', async ({ where, create, update }: any) => {
        writeCount += 1;
        const id = key(where.userAId_userBId_weekStart);
        const row = rows.has(id) ? { ...rows.get(id), ...update } : create;
        rows.set(id, row);
        return row;
    });
    replace(prisma.weekPrize, 'update', async ({ where, data }: any) => {
        writeCount += 1;
        const id = key(where.userAId_userBId_weekStart);
        const row = { ...rows.get(id), ...data };
        rows.set(id, row);
        return row;
    });
    replace(prisma.weekPrize, 'deleteMany', async ({ where }: any) => {
        const { proposedById, acceptedAt, ...pair } = where;
        const id = key(pair);
        const row = rows.get(id);
        if (!row || row.proposedById !== proposedById || (row.acceptedAt ?? null) !== acceptedAt) return { count: 0 };
        rows.delete(id);
        return { count: 1 };
    });
    replace(prisma.dailyPointsLedger, 'findMany', async ({ where }: any) => {
        if (where.OR[0].dayKey.in.length === 7) {
            assert.equal(where.OR.length, 2);
            for (const clause of where.OR) {
                assert.ok(['a', 'b'].includes(clause.userId));
                if (clause.dayKey.in[0] === '2026-10-26') {
                    assert.deepEqual(clause.dayKey.in, ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']);
                } else {
                    assert.deepEqual(clause.dayKey.in, ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']);
                }
            }
            return previousGoals;
        }
        for (const clause of where.OR) {
            assert.ok(['a', 'b'].includes(clause.userId));
            if (clause.dayKey.in[0] === '2026-11-09') {
                assert.deepEqual(clause.dayKey.in, ['2026-11-09']);
            } else {
                assert.equal(clause.dayKey.in.length, 5);
                assert.equal(clause.dayKey.in[0], '2026-11-02');
                assert.equal(clause.dayKey.in[4], '2026-11-06');
            }
        }
        return [
            { userId: 'a', dayKey: '2026-11-02', category: 'STEPS', progress: 1, earnedPoints: 30, maxPoints: 30 },
            { userId: 'a', dayKey: '2026-11-03', category: 'STEPS', progress: 0.5, earnedPoints: 15, maxPoints: 30 },
            { userId: 'b', dayKey: '2026-11-02', category: 'CALORIES', progress: 1, earnedPoints: 40, maxPoints: 40 },
        ];
    });
    const call = async (method: string, userId: string, body?: unknown, path = '/') => {
        let status = 200;
        let result: any;
        const res = { status(value: number) { status = value; return this; }, json(value: any) { result = value; return this; } };
        await handler(method, path)({ user: { id: userId }, body }, res, (error: unknown) => { throw error; });
        return { status, result };
    };

    await t.test('no prize starts empty with real completed goal counts', async () => {
        const { result } = await call('get', 'a');
        assert.equal(result.weekprize, null);
        assert.equal(result.yourGoalsCompleted, 1);
        assert.equal(result.partnerGoalsCompleted, 1);
        assert.equal(result.lastWeek, null);
    });
    await t.test('previous week winner is relative to the viewer and handles ties', async () => {
        previousGoals = [{ userId: 'a', dayKey: '2026-10-26', category: 'STEPS', progress: 1, earnedPoints: 30, maxPoints: 30 }];
        const a = (await call('get', 'a')).result.lastWeek;
        const b = (await call('get', 'b')).result.lastWeek;
        assert.equal(a.winner, 'you');
        assert.equal(b.winner, 'partner');
        assert.equal(a.id, b.id);
        assert.equal(a.yourGoalsCompleted, 1);
        assert.equal(a.partnerGoalsCompleted, 0);
        previousGoals.push({ userId: 'b', dayKey: '2026-10-27', category: 'CALORIES', progress: 1, earnedPoints: 40, maxPoints: 40 });
        assert.equal((await call('get', 'a')).result.lastWeek.winner, 'tie');
        previousGoals = [];
    });
    await t.test('agreed goal removals affect current scores and archived winners for both partners', async () => {
        removedGoals = ['steps', 'calories'];
        previousGoals = [{ userId: 'a', dayKey: '2026-10-26', category: 'STEPS', progress: 1, earnedPoints: 30, maxPoints: 30 }];
        const result = (await call('get', 'a')).result;
        assert.equal(result.yourGoalsCompleted, 0);
        assert.equal(result.partnerGoalsCompleted, 0);
        assert.equal(result.lastWeek.yourGoalsCompleted, 0);
        assert.equal(result.lastWeek.winner, 'tie');
        removedGoals = [];
        previousGoals = [];
    });
    await t.test('either partner can select or change the same shared prize', async () => {
        assert.equal((await call('put', 'a', { weekprize: '  a massage  ' })).result.weekprize, 'a massage');
        assert.equal((await call('get', 'b')).result.weekprize, 'a massage');
        await call('put', 'b', { weekprize: 'a picnic' });
        assert.equal((await call('get', 'a')).result.weekprize, 'a picnic');
        assert.equal(rows.size, 1);
    });
    await t.test('invalid prizes and supplied partner IDs cannot write a record', async () => {
        const before = writeCount;
        for (const body of [{ weekprize: ' ' }, { weekprize: 'x'.repeat(101) }, { weekprize: 1 }, { weekprize: 'coffee', userBId: 'stranger' }]) {
            assert.equal((await call('put', 'a', body)).status, 400);
        }
        assert.equal(writeCount, before);
    });
    await t.test('missing or one-sided partner links cannot read or change a shared prize', async () => {
        for (const hasLink of [false, true]) {
            linked = hasLink;
            reciprocal = false;
            const beforeRead = lookupCount;
            const beforeWrite = writeCount;
            const { result } = await call('get', 'a');
            assert.equal(result.hasPartner, false);
            assert.equal(result.weekprize, null);
            assert.equal(result.partnerGoalsCompleted, null);
            assert.equal(result.lastWeek, null);
            assert.equal((await call('put', 'a', { weekprize: 'coffee' })).status, 409);
            assert.equal(lookupCount, beforeRead);
            assert.equal(writeCount, beforeWrite);
        }
    });
    await t.test('a new calendar week gets a separate prize without overwriting history', async () => {
        linked = true; reciprocal = true;
        t.mock.timers.setTime(new Date('2026-11-09T01:00:00Z').getTime());
        await call('put', 'a', { weekprize: 'breakfast' });
        assert.equal(rows.size, 2);
        assert.deepEqual([...rows.values()].map(row => row.weekStart), ['2026-11-02', '2026-11-09']);
        const result = (await call('get', 'a')).result;
        assert.equal(result.weekprize, 'breakfast');
        assert.equal(result.lastWeek.weekprize, 'a picnic');
        assert.equal(result.lastWeek.winner, 'tie');
        assert.equal(new Date(result.lastWeek.weekEnd).getTime() + 1, new Date(result.weekStart).getTime());
    });
    await t.test('partners on different calendar days still edit the same weekly prize', async () => {
        timezones.b = 'America/Los_Angeles';
        t.mock.timers.setTime(new Date('2026-11-08T18:00:00Z').getTime());
        const a = await call('put', 'a', { weekprize: 'coffee' });
        const b = await call('put', 'b', { weekprize: 'dinner' });
        assert.deepEqual(a.result.weekStart, b.result.weekStart);
        assert.deepEqual(a.result.weekEnd, b.result.weekEnd);
        assert.equal(rows.size, 2);
        assert.equal(rows.get(key({ userAId: 'a', userBId: 'b', weekStart: '2026-11-09' })).weekprize, 'dinner');
    });
    await t.test('a proposal is accepted by the partner signing it, and each step notifies the other partner', async () => {
        timezones.b = 'Australia/Sydney';
        t.mock.timers.setTime(new Date('2026-11-06T01:00:00Z').getTime());
        await flushPushes();
        pushes.length = 0;
        const proposal = (await call('put', 'a', { weekprize: 'a beach day' })).result;
        assert.equal(proposal.proposedByYou, true);
        assert.equal(proposal.accepted, false);
        const partnerView = (await call('get', 'b')).result;
        assert.equal(partnerView.proposedByYou, false);
        assert.equal(partnerView.accepted, false);
        assert.equal((await call('post', 'a', undefined, '/accept')).status, 409);

        const proposerSigned = (await call('put', 'a', { paths: ['M1 1 L2 2'] }, '/signature')).result;
        assert.deepEqual(proposerSigned.yourSignature, ['M1 1 L2 2']);
        assert.equal(proposerSigned.accepted, false);
        assert.equal((await call('put', 'b', { paths: ['M5 5 l0.1 0'] }, '/signature')).result.accepted, true);
        await call('put', 'a', { paths: ['M1 1 L3 3'] }, '/signature');
        assert.equal((await call('post', 'b', undefined, '/accept')).result.accepted, true);
        assert.equal((await call('put', 'a', { weekprize: 'a beach day' })).result.accepted, true);
        await flushPushes();
        assert.deepEqual(pushes.map(push => [push.to, push.data.kind]), [
            ['ExponentPushToken[b]', 'proposed'], ['ExponentPushToken[b]', 'signed'], ['ExponentPushToken[a]', 'signed'],
        ]);
        assert.equal(pushes[0].title, "A set this week's stakes");
        assert.equal(pushes[0].data.type, 'weekly_prize');
        await call('put', 'a', { paths: ['M1 1 L2 2'] }, '/signature');
        const signed = (await call('get', 'a')).result;
        assert.deepEqual(signed.yourSignature, ['M1 1 L2 2']);
        assert.deepEqual(signed.partnerSignature, ['M5 5 l0.1 0']);

        for (const body of [{ paths: ['<script>'] }, { paths: 'M1 1' }, { paths: Array(61).fill('M1 1') }]) {
            assert.equal((await call('put', 'a', body, '/signature')).status, 400);
        }
        const changed = (await call('put', 'b', { weekprize: 'coffee' })).result;
        assert.equal(changed.accepted, false);
        assert.equal(changed.yourSignature, null);
        assert.equal(changed.partnerSignature, null);
        await flushPushes();
        pushes.length = 0;
        assert.equal((await call('post', 'a', undefined, '/accept')).result.accepted, true);
        await flushPushes();
        assert.deepEqual(pushes.map(push => [push.to, push.data.kind, push.body]), [
            ['ExponentPushToken[b]', 'accepted', 'Winner gets coffee. Sign to make it official.'],
        ]);
    });
    await t.test('prizes saved before proposals existed count as agreed', async () => {
        const id = key({ userAId: 'a', userBId: 'b', weekStart: '2026-11-02' });
        rows.set(id, { ...rows.get(id), proposedById: null, acceptedAt: null });
        const result = (await call('get', 'b')).result;
        assert.equal(result.accepted, true);
        assert.equal(result.proposedByYou, null);
    });
    await t.test('only the recipient can deny a pending proposal; agreed rewards are protected', async () => {
        liveUpdates.length = 0;
        await call('put', 'a', { weekprize: 'a massage' });
        assert.deepEqual(liveUpdates, [{ rooms: ['user:a', 'user:b'], event: 'invitations:changed', payload: { scope: 'weekly_prize' } }]);
        assert.equal((await call('post', 'a', undefined, '/decline')).status, 409);
        assert.equal(liveUpdates.length, 1);
        assert.equal((await call('post', 'b', undefined, '/decline')).result.weekprize, null);
        assert.equal(liveUpdates.length, 2);
        assert.equal((await call('get', 'a')).result.weekprize, null);
        assert.equal((await call('post', 'b', undefined, '/decline')).status, 409);
        await call('put', 'a', { weekprize: 'a massage' });
        await call('post', 'b', undefined, '/accept');
        assert.equal(liveUpdates.length, 4);
        assert.equal((await call('post', 'b', undefined, '/decline')).status, 409);
        assert.equal((await call('get', 'a')).result.accepted, true);
        linked = false;
        assert.equal((await call('post', 'b', undefined, '/decline')).status, 409);
        linked = true;
    });
});
