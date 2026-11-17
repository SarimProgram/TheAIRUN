import assert from 'node:assert/strict';
import test from 'node:test';

test('plan API stores, returns, and validates onboarding workout answers', async (t) => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.OPENAI_API_KEY = 'test-only-no-network';
    const { default: prisma } = await import('../db/prisma');
    const { default: router } = await import('./plan.routes');
    const handler = (router.stack.find((layer: any) => layer.route?.path === '/' && layer.route.methods.post) as any).route.stack[0].handle;
    let written: any;
    const originalUpsert = prisma.userPlan.upsert;
    t.after(() => { prisma.userPlan.upsert = originalUpsert; });
    prisma.userPlan.upsert = (async (query: any) => {
        written = query;
        return { id: 'plan-1', ...query.update, createdAt: new Date(0), updatedAt: new Date(1) };
    }) as any;
    const base = { weightKg: 80, heightCm: 170, ageYears: 30, goalType: 'weightloss', trainingStyle: 'workout, runOnly' };
    const send = async (body: any) => {
        let response: any;
        let error: any;
        const res = { status: () => res, json: (value: any) => { response = value; } };
        await handler({ user: { id: 'user-1' }, body }, res, (value: any) => { error = value; });
        return { response, error };
    };
    for (const preference of ['strength', 'gym', 'home']) {
        const { response, error } = await send({ ...base, workoutDaysPerWeek: 3, workoutPreference: preference });
        assert.equal(error, undefined);
        for (const data of [written.create, written.update, response.plan]) {
            assert.equal(data.workoutDaysPerWeek, 3);
            assert.equal(data.workoutPreference, preference);
        }
    }
    const { response, error } = await send({ ...base, trainingStyle: 'walkOnly', workoutDaysPerWeek: 2, workoutPreference: null });
    assert.equal(error, undefined);
    assert.equal(written.update.workoutPreference, null);
    assert.equal(response.plan.workoutDaysPerWeek, 2);
    assert.equal(response.plan.workoutPreference, null);
    for (const invalid of [{ workoutDaysPerWeek: 0 }, { workoutDaysPerWeek: 8 }, { workoutDaysPerWeek: 2.5 }, { workoutPreference: 'invalid' }]) {
        const previous = written;
        assert.ok((await send({ ...base, ...invalid })).error);
        assert.equal(written, previous, 'invalid answers must not reach the database');
    }
    const legacy = await send(base);
    assert.equal(legacy.error, undefined);
    assert.equal(legacy.response.plan.workoutDaysPerWeek, null);
    assert.equal(legacy.response.plan.workoutPreference, null);
});
