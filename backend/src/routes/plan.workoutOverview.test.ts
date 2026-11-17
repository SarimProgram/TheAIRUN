import assert from 'node:assert/strict';
import test from 'node:test';

test('workout overview authenticates, isolates partner access and returns separate weekly targets', async t => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.OPENAI_API_KEY = 'test-no-network';
    const { default: prisma } = await import('../db/prisma');
    const { default: router } = await import('./plan.routes');
    const handler = (router.stack.find((layer: any) => layer.route?.path === '/workout-overview') as any).route.stack[0].handle;
    const now = new Date();
    const { dayKeyInTimezone, getWeekStartMondayDayKey } = await import('../lib/weekBounds');
    const today = dayKeyInTimezone(now, 'UTC');
    const start = new Date(`${getWeekStartMondayDayKey(today)}T00:00:00Z`);
    let linked = true;
    let runs = false;
    const queries: any[] = [];
    const mock = (model: any, method: string, fn: any) => {
        const previous = model[method]; model[method] = fn; t.after(() => { model[method] = previous; });
    };
    mock(prisma.user, 'findUniqueOrThrow', async () => ({ id: 'me', partnerId: 'partner', timezone: 'UTC' }));
    mock(prisma.user, 'findFirst', async () => linked ? { id: 'partner', timezone: 'UTC' } : null);
    mock(prisma.userPlan, 'findUnique', async ({ where }: any) => {
        queries.push(where.userId);
        return { id: `plan-${where.userId}`, weekStartedAt: start, availableDays: [], weeklyPlans: [{ id: 'week', week: 1,
            dailyTargets: runs ? [0, 1, 2].map(dayOfWeek => ({ dayOfWeek, dayType: 'RUN', runType: 'Easy Run', runKm: 3 })) : [],
            weekDailys: { runs: [], trainingSchedule: { version: 1, sessions: Array.from({ length: where.userId === 'me' ? 3 : 4 }, (_, i) => ({ dayOfWeek: i,
                activity: runs ? 'RUN' : 'WORKOUT', ...(runs ? {} : { workoutPreference: 'gym' }) })) } } }] };
    });
    mock(prisma.trainingPlan, 'findFirst', async () => runs ? { sessions: [0, 1, 2].map(dayOfWeek => ({ id: `run-${dayOfWeek}`, dayOfWeek, week: 1, runType: 'Easy Run' })) } : null);
    mock(prisma.workoutSession, 'findMany', async () => []);
    mock(prisma.dailySummary, 'findMany', async () => []);
    mock(prisma.workoutPhoto, 'findMany', async ({ where }: any) => {
        if (where.authorUserId === 'partner') assert.equal(where.recipientUserId, 'me');
        return [{ dayKey: today }];
    });
    const call = async (user: any, query: any = { timezone: 'UTC' }) => {
        let status = 200; let data: any; let error: any;
        const res = { status(code: number) { status = code; return res; }, json(value: any) { data = value; return res; } };
        await handler({ user, query }, res, (value: any) => { error = value; }); return { status, data, error };
    };
    assert.equal((await call(null)).status, 401);
    const result = await call({ id: 'me' });
    assert.equal(result.error, undefined);
    assert.equal(result.data.mine.weeklyTarget, 3);
    assert.equal(result.data.partner.weeklyTarget, 4);
    assert.equal(result.data.partnerId, 'partner');
    linked = false; queries.length = 0;
    assert.equal((await call({ id: 'me' })).data.partner, null);
    assert.deepEqual(queries, ['me']);
    runs = true;
    const runResult = await call({ id: 'me' });
    assert.deepEqual(runResult.data.mine.scheduled.map((session: any) => session.sessionId), ['run-0', 'run-1', 'run-2']);
    assert.equal(runResult.data.mine.scheduled[0].distanceKm, 3);
    assert.ok((await call({ id: 'me' }, { timezone: 'invalid' })).error);
});
