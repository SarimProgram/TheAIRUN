import assert from 'node:assert/strict';
import test from 'node:test';

test('home goal ordering and partner-approved weekly removals', async t => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.JWT_SECRET = 'home-goals-route-tests-secret';
    const { prisma } = await import('../db/prisma');
    const { default: router } = await import('./homeGoals.routes');
    t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-15T01:00:00Z').getTime() });
    const replace = (target: any, method: string, implementation: (...args: any[]) => any) => {
        const original = target[method];
        target[method] = implementation;
        t.after(() => { target[method] = original; });
    };
    let linked = true;
    let reciprocal = true;
    const rows: any[] = [];
    const orders = new Map<string, string[]>();
    const zones: Record<string, string> = { a: 'Australia/Sydney', b: 'America/Los_Angeles' };
    replace(prisma.user, 'findUniqueOrThrow', async ({ where }: any) => ({
        timezone: zones[where.id] ?? 'UTC', partner: linked && where.id !== 'stranger' ? {
            id: where.id === 'a' ? 'b' : 'a', partnerId: reciprocal ? where.id : 'stranger', timezone: zones[where.id === 'a' ? 'b' : 'a'],
        } : null,
    }) as any);
    const matches = (row: any, where: any) => Object.entries(where).every(([key, value]) => row[key] === value);
    replace(prisma.homeGoalLayout, 'findUnique', async ({ where }: any) => orders.has(where.userId) ? { userId: where.userId, order: orders.get(where.userId) } as any : null);
    replace(prisma.homeGoalLayout, 'upsert', async ({ create }: any) => { orders.set(create.userId, create.order); return create; });
    replace(prisma.weeklyGoalRemoval, 'findMany', async ({ where }: any) => rows.filter(row => matches(row, where)));
    replace(prisma.weeklyGoalRemoval, 'upsert', async ({ where, create }: any) => {
        const found = rows.find(row => matches(row, where.userAId_userBId_weekStart_goal));
        if (found) return found;
        const row = { ...create, id: `00000000-0000-4000-8000-${String(rows.length + 1).padStart(12, '0')}`, acceptedAt: null };
        rows.push(row); return row;
    });
    replace(prisma.weeklyGoalRemoval, 'updateMany', async ({ where, data }: any) => {
        const row = rows.find(row => matches(row, where));
        if (row) Object.assign(row, data);
        return { count: row ? 1 : 0 };
    });
    replace(prisma.weeklyGoalRemoval, 'deleteMany', async ({ where }: any) => {
        const index = rows.findIndex(row => matches(row, where));
        if (index >= 0) rows.splice(index, 1);
        return { count: index >= 0 ? 1 : 0 };
    });
    const call = async (method: string, path: string, userId: string, body?: any, params = {}) => {
        const layer = router.stack.find((entry: any) => entry.route?.path === path && entry.route.methods[method]) as any;
        let status = 200; let result: any; let error: any;
        const response = { status(value: number) { status = value; return this; }, json(value: any) { result = value; return this; } };
        await layer.route.stack[0].handle({ user: { id: userId }, body, params }, response, (e: any) => { error = e; });
        return { status, result, error };
    };
    const weekStart = '2026-11-09';
    await t.test('order is validated, persisted and personal', async () => {
        const order = ['water', 'steps', 'workout', 'calories'];
        assert.equal((await call('put', '/order', 'a', { order })).status, 200);
        assert.deepEqual((await call('get', '/', 'a')).result.order, order);
        assert.deepEqual((await call('get', '/', 'b')).result.order, ['calories', 'steps', 'workout', 'water']);
        assert.ok((await call('put', '/order', 'a', { order: ['water', 'water', 'water', 'water'] })).error);
        assert.ok((await call('put', '/order', 'a', { order: ['unknown'] })).error);
    });
    await t.test('a request stays pending and duplicates cannot approve or replace it', async () => {
        await call('post', '/removals', 'a', { goal: 'steps', weekStart });
        await call('post', '/removals', 'b', { goal: 'steps', weekStart });
        assert.equal(rows.length, 1);
        assert.equal(rows[0].requestedById, 'a');
        assert.equal((await call('get', '/', 'a')).result.removals[0].accepted, false);
        assert.equal((await call('get', '/', 'b')).result.removals[0].requestedByYou, false);
    });
    await t.test('only the current linked partner can approve, and accepted requests cannot be declined', async () => {
        const params = { id: rows[0].id };
        assert.equal((await call('post', '/removals/:id/respond', 'a', { accept: true, weekStart }, params)).status, 409);
        assert.equal((await call('post', '/removals/:id/respond', 'stranger', { accept: true, weekStart }, params)).status, 409);
        linked = false;
        assert.equal((await call('post', '/removals/:id/respond', 'b', { accept: true, weekStart }, params)).status, 409);
        linked = true; reciprocal = false;
        assert.equal((await call('post', '/removals/:id/respond', 'b', { accept: true, weekStart }, params)).status, 409);
        reciprocal = true;
        assert.equal((await call('post', '/removals/:id/respond', 'b', { accept: true, weekStart }, params)).status, 200);
        assert.equal((await call('get', '/', 'a')).result.removals[0].accepted, true);
        assert.equal((await call('get', '/', 'b')).result.removals[0].accepted, true);
        assert.equal((await call('post', '/removals/:id/respond', 'b', { accept: false, weekStart }, params)).status, 409);
    });
    await t.test('declining keeps a goal and permits a fresh request', async () => {
        await call('post', '/removals', 'a', { goal: 'water', weekStart });
        const params = { id: rows[1].id };
        assert.equal((await call('post', '/removals/:id/respond', 'b', { accept: false, weekStart }, params)).status, 200);
        assert.equal(rows.length, 1);
        await call('post', '/removals', 'a', { goal: 'water', weekStart });
        assert.equal(rows.length, 2);
        assert.equal(rows[1].acceptedAt, null);
    });
    await t.test('solo removals and stale weeks are rejected; next week restores every goal', async () => {
        linked = false;
        assert.equal((await call('post', '/removals', 'a', { goal: 'calories', weekStart })).status, 409);
        linked = true;
        assert.equal((await call('post', '/removals', 'a', { goal: 'calories', weekStart: '2026-11-02' })).status, 409);
        t.mock.timers.tick(7 * 86400000);
        assert.deepEqual((await call('get', '/', 'a')).result.removals, []);
        assert.equal((await call('post', '/removals/:id/respond', 'b', { accept: true, weekStart }, { id: rows[1].id })).status, 409);
    });
    await t.test('partners in different timezones still share a week at the Monday boundary', async () => {
        // Monday in Sydney, still Sunday in Los Angeles.
        t.mock.timers.setTime(new Date('2026-11-15T14:00:00Z').getTime());
        assert.equal((await call('get', '/', 'a')).result.weekStart, '2026-11-16');
        assert.equal((await call('get', '/', 'b')).result.weekStart, '2026-11-16');
    });
});
