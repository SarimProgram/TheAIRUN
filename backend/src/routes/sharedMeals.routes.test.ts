import test from 'node:test';
import assert from 'node:assert/strict';

test('shared meals log received portions and keep responses idempotent', async t => {
    process.env.DATABASE_URL ||= 'postgresql://test:test@localhost:5432/test';
    process.env.JWT_SECRET ||= 'shared-meal-route-test-secret';
    const { prisma } = await import('../db/prisma');
    const { default: router, sharesAreValid } = await import('./sharedMeals.routes');

    const items = [
        { foodName: 'Chicken', calories: 300, grams: 150, proteinG: 50, carbsG: 0, fatG: 10 },
        { foodName: 'Rice', calories: 200, grams: 150, proteinG: 4, carbsG: 44, fatG: 0 },
    ];
    const row: any = {
        id: '0b9c6d2e-8a51-4f6e-9b1c-3d2a7e4f5a60', senderUserId: 'alex', recipientUserId: 'sam', mode: 'SPLIT',
        mealType: 'DINNER', items, itemShares: [0.4, 0.4], status: 'PENDING', senderClientMealId: 'alex-meal',
        photoPath: null, cutoutPath: null, createdAt: new Date(), respondedAt: null, expiresAt: new Date(Date.now() + 60_000),
        sender: { displayName: 'Alex', gender: 'male' }, recipient: { displayName: 'Sam', gender: 'female' },
    };
    const senderItems: any[] = [];
    const recipientLogs = new Map<string, any>();
    const delivered: string[] = [];
    const replace = (target: any, method: string, implementation: (...args: any[]) => any) => {
        const original = target[method]; target[method] = implementation;
        t.after(() => { target[method] = original; });
    };
    const tx = {
        sharedMeal: {
            updateMany: async ({ where, data }: any) => {
                if (row.status !== where.status) return { count: 0 };
                Object.assign(row, data); return { count: 1 };
            },
            findUniqueOrThrow: async () => row,
            create: async ({ data }: any) => ({ ...row, ...data }),
            delete: async () => ({}),
        },
        mealLog: {
            findUnique: async ({ where }: any) => where.userId_clientMealId.clientMealId === 'alex-meal' ? { id: 'meal1' } : null,
            update: async ({ data }: any) => { senderItems.splice(0, senderItems.length, ...data.items.create); return {}; },
            upsert: async ({ where, create, update }: any) => {
                const key = where.userId_clientMealId.clientMealId;
                const saved = recipientLogs.has(key) ? { ...recipientLogs.get(key), ...update } : create;
                recipientLogs.set(key, saved);
                return saved;
            },
            deleteMany: async ({ where }: any) => {
                const existing = recipientLogs.get(where.clientMealId);
                if (existing?.userId === where.userId) recipientLogs.delete(where.clientMealId);
                return { count: existing ? 1 : 0 };
            },
        },
        mealItem: { deleteMany: async () => ({ count: 2 }) },
    };
    replace(prisma.sharedMeal, 'findFirst', async ({ where }: any) => where.recipientUserId === row.recipientUserId ? row : null);
    replace(prisma, '$transaction', async (fn: any) => fn(tx));
    // The reply travels through the real partner chat pipeline; only its storage is stubbed.
    replace(prisma.user, 'findUnique', async () => ({ partnerId: 'alex', displayName: 'Sam' }));
    replace(prisma.userBlock, 'findFirst', async () => null);
    const widgetPushes: string[] = [];
    replace(prisma.widgetPushDevice, 'findMany', async ({ where }: any) => { widgetPushes.push(where.userId); return []; });
    replace(prisma.chatMessage, 'create', async ({ data }: any) => {
        const plateId = /^\[MEAL:plate:([^:]+):/.exec(data.content)?.[1];
        if (plateId) assert.ok(recipientLogs.has(`pass-${plateId}`), 'Recipient meal exists before delivery');
        delivered.push(data.content);
        return { id: `message${delivered.length}`, content: data.content, createdAt: new Date(), viewedAt: null };
    });

    const call = async (route: string, request: any) => {
        const layer = router.stack.find((entry: any) => entry.route?.path === route && entry.route.methods.post) as any;
        let status = 200; let result: any; let error: any;
        const res = { status(value: number) { status = value; return this; }, json(value: any) { result = value; return this; } };
        await layer.route.stack.at(-1).handle(request, res, (value: any) => { error = value; });
        return { status, result, error };
    };
    const respond = (user: string, body: any) => call('/:id/respond', { user: { id: user }, params: { id: row.id }, body });

    await t.test('only the recipient can answer', async () => {
        assert.equal((await respond('alex', { action: 'accept' })).status, 404);
    });
    await t.test('an empty portion is rejected', async () => {
        assert.equal((await respond('sam', { action: 'accept', itemShares: [0, 0] })).status, 400);
        assert.equal(row.status, 'PENDING');
    });
    await t.test('accepting a changed split re-portions the sender and signals once', async () => {
        const response = await respond('sam', { action: 'accept', itemShares: [0.5, 0.25] });
        assert.equal(response.status, 200);
        assert.equal(row.status, 'ACCEPTED');
        assert.deepEqual(senderItems.map((item) => item.calories), [150, 150]);
        assert.equal(recipientLogs.get(`pass-${row.id}`).totalCalories, 200);
        assert.deepEqual(delivered, [`[MEAL:reply:${row.id}:accepted]`]);
    });
    await t.test('a retried accept is idempotent; a late decline conflicts', async () => {
        assert.equal((await respond('sam', { action: 'accept' })).status, 200);
        assert.equal((await respond('sam', { action: 'decline' })).status, 409);
        assert.equal(delivered.length, 1);
    });

    await t.test('retrying an older accepted plate restores its missing recipient meal once', async () => {
        recipientLogs.delete(`pass-${row.id}`);
        assert.equal((await respond('sam', { action: 'accept' })).status, 200);
        assert.equal(recipientLogs.get(`pass-${row.id}`).totalCalories, 200);
        const restored = recipientLogs.get(`pass-${row.id}`);
        assert.equal((await respond('sam', { action: 'accept' })).status, 200);
        assert.deepEqual(recipientLogs.get(`pass-${row.id}`), restored);
        assert.equal(delivered.length, 1);
    });

    await t.test('declining removes the automatically logged recipient portion and preserves the sender', async () => {
        row.status = 'PENDING';
        const response = await respond('sam', { action: 'decline' });
        assert.equal(response.status, 200);
        assert.equal(row.status, 'DECLINED');
        assert.equal(recipientLogs.has(`pass-${row.id}`), false);
        assert.deepEqual(senderItems.map(item => item.calories), [150, 150]);
        assert.equal((await respond('sam', { action: 'decline' })).status, 200);
        assert.equal((await respond('sam', { action: 'accept' })).status, 409);
    });

    await t.test('sending a plate logs the recipient portion before delivery', async () => {
        replace(prisma.sharedMeal, 'findUnique', async () => null);
        replace(prisma.user, 'findUniqueOrThrow', async () => ({ partnerId: 'sam', displayName: 'Alex' }));
        replace(prisma.user, 'findUnique', async () => ({ partnerId: 'sam', displayName: 'Alex' }));
        replace(prisma.user, 'findFirst', async () => ({ id: 'sam', displayName: 'Sam', gender: 'female' }));
        const response = await call('/', { user: { id: 'alex' }, body: {
            clientId: '7b9c6d2e-8a51-4f6e-9b1c-3d2a7e4f5a60', mode: 'SPLIT', mealType: 'DINNER',
            items, itemShares: [0.4, 0.4], xPct: 0.5,
        } });
        assert.ifError(response.error);
        assert.equal(response.status, 201);
        const logged = recipientLogs.get(`pass-${response.result.meal.id}`);
        assert.equal(logged.userId, 'sam');
        assert.equal(logged.totalCalories, 200);
        assert.deepEqual(logged.items.create.map((part: any) => part.calories), [120, 80]);
        assert.equal(logged.loggedAt, row.createdAt);
        await new Promise((resolve) => setImmediate(resolve));
        assert.equal(widgetPushes.at(-1), 'sam');
    });

    await t.test('a rejected delivery removes the automatically logged portion', async () => {
        replace(prisma.userBlock, 'findFirst', async () => ({ id: 'blocked' }));
        const countBefore = recipientLogs.size;
        const response = await call('/', { user: { id: 'alex' }, body: {
            clientId: '8b9c6d2e-8a51-4f6e-9b1c-3d2a7e4f5a60', mode: 'COPY', mealType: 'DINNER',
            items, itemShares: [1, 1], xPct: 0.5,
        } });
        assert.ifError(response.error);
        assert.equal(response.status, 400);
        assert.equal(recipientLogs.size, countBefore);
    });

    await t.test('a stale upload cannot recreate a declined plate', async () => {
        process.env.OPENAI_API_KEY ||= 'test-shared-meal-key';
        const { default: nutrition } = await import('./nutrition.routes');
        replace(prisma.sharedMeal, 'findFirst', async () => null);
        replace(prisma.mealLog, 'upsert', async () => { throw new Error('Declined meal must not be written'); });
        const layer = nutrition.stack.find((entry: any) => entry.route?.path === '/meals' && entry.route.methods.post) as any;
        let status = 200, error: unknown;
        const res = { status(code: number) { status = code; return this; }, json() { return this; } };
        await layer.route.stack.at(-1).handle({ user: { id: 'sam' }, body: {
            clientMealId: `pass-${row.id}`, mealType: 'DINNER', items,
        } }, res, (value: unknown) => { error = value; });
        assert.ifError(error);
        assert.equal(status, 409);
    });

    assert.equal(sharesAreValid('SPLIT', items, [1.2, 0.5]), false);
    assert.equal(sharesAreValid('COPY', items, [1.5, 1.5]), true);
    assert.equal(sharesAreValid('SPLIT', items, [0.5]), false);
});
