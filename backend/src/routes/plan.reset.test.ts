import assert from 'node:assert/strict';
import test from 'node:test';

test('full reset generates before replacing the active plan', async (t) => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.JWT_SECRET = 'plan-reset-regression-test';
    process.env.OPENAI_API_KEY = 'test-only-no-network';
    let output: unknown[] | null = [];
    let prompt = '';
    t.mock.method(globalThis, 'fetch', async (_url: unknown, init: any) => {
        const body = JSON.parse(init.body);
        prompt = body.input[0].content[0].text;
        const rows = output ?? Array.from({ length: Number(prompt.match(/Number of weeks to generate: (\d+)/)?.[1]) }, (_, index) => ({
            Week: index + 1, 'Calories/day': 1800, 'Protein/day': 100, 'Steps/day target': 8000,
            'Run km/week': 6, 'Expected weight': 80 - index * 0.5, 'Week name': 'Build consistency',
            'Week Dailys': { stepDays: 2, runDays: 3, recoveryDays: 2, runs: [{ runType: 'Walk', sessions: 3, targetKm: 2 }] },
        }));
        return Response.json({ output_text: JSON.stringify({ 'Weekly Plan Table': rows }) });
    });
    const { prisma } = await import('../db/prisma');
    const { default: router } = await import('./plan.routes');
    const route = router.stack.find((layer: any) =>
        Array.isArray(layer.route?.path) && layer.route.path.includes('/reset'),
    );
    assert.ok(route);
    const handler = (route as any).route.stack[0].handle;
    const savedPlan = {
        id: 'plan-1', userId: 'user-1', weightKg: 90, heightCm: 170, ageYears: 35,
        goalType: 'running', targetWeightKg: null, weightToLoseKg: null, timeHorizon: null,
        targetDate: null, runRaceDate: null, runGoal: 'halfMarathon', runExperience: 'advanced',
        runDietFocus: 'performance', trainingStyle: 'runOnly', activityPreference: 'MOSTLY_RUNNING',
        intensityLevel: 'PRO', dailyCalorieTarget: 3500, availableDays: [0, 1, 2, 3, 4],
        currentWeek: 6, weeklyPlans: [{ week: 1 }],
        user: { gender: 'female', heightFt: null, heightIn: null, goalType: 'running', weightKg: 90 },
    };
    const originalFindPlan = prisma.userPlan.findUnique;
    const originalFindUser = prisma.user.findUnique;
    const originalFindSummary = prisma.dailySummary.findUnique;
    t.after(() => {
        prisma.userPlan.findUnique = originalFindPlan;
        prisma.user.findUnique = originalFindUser;
        prisma.dailySummary.findUnique = originalFindSummary;
    });
    prisma.userPlan.findUnique = (async (query: any) =>
        query.include?.weeklyPlans?.include?.dailyTargets ? null : savedPlan) as any;
    prisma.user.findUnique = (async () => ({ timezone: 'UTC' })) as any;
    // No daily summary exists yet, so synchronization has nothing to update.
    prisma.dailySummary.findUnique = (async () => null) as any;
    const writes: Array<{ model: string; data?: any }> = [];
    const transaction = t.mock.method(prisma, '$transaction', async (callback: any) => callback({
        userPlan: { update: async ({ data }: any) => { writes.push({ model: 'plan', data }); } },
        user: { update: async ({ data }: any) => { writes.push({ model: 'user', data }); } },
        weightHistory: { create: async ({ data }: any) => { writes.push({ model: 'weight', data }); } },
        generatedWeekPlan: {
            deleteMany: async () => { writes.push({ model: 'deleteWeeks' }); },
            create: async ({ data }: any) => { writes.push({ model: 'week', data }); return { id: `week-${data.week}`, ...data }; },
        },
        dailyTarget: { createMany: async ({ data }: any) => { writes.push({ model: 'days', data }); } },
    }));
    const request = {
        path: '/reset', query: {}, user: { id: 'user-1' },
        body: { goalType: 'weightloss', weightKg: 80, targetWeightKg: 76, timeHorizon: 'STANDARD',
            trainingStyle: 'walkOnly', intensityLevel: 'ACTIVE', availableDays: [0, 2, 4] },
    };
    let response: any;
    let failure: unknown;
    const res = { json: (value: any) => { response = value; }, status: () => res };
    const next = (error: unknown) => { failure = error; };

    await t.test('incomplete AI output leaves the old plan untouched', async () => {
        await handler(request, res, next);
        assert.match(String(failure), /complete weekly plan/);
        assert.equal(transaction.mock.callCount(), 0);
        assert.equal(writes.length, 0);
        assert.equal(savedPlan.currentWeek, 6);
    });

    await t.test('complete output replaces inputs and all weeks together, reusing saved demographics', async () => {
        failure = undefined;
        output = null;
        await handler(request, res, next);
        assert.equal(failure, undefined);
        assert.equal(response['Weekly Plan Table'].length, 11);
        assert.equal(response['Weekly Plan Table'].at(-1)['Expected weight'], 76);
        assert.equal(response.debugAiRequest.resolvedValues.gender, 'female');
        assert.equal(response.debugAiRequest.resolvedValues.height, '170 cm');
        assert.equal(response.debugAiRequest.resolvedValues.ageYears, 35);
        const baseTargets = response.debugAiRequest.resolvedValues.baseFoodCaloriesByWeek;
        assert.equal(response.debugAiRequest.resolvedValues.calorieAccounting, 'base-plus-actual-activity-v1');
        assert.notEqual(baseTargets[0], 1800, 'AI calorie values must be replaced');
        assert.deepEqual(response['Weekly Plan Table'].map((week: any) => week['Calories/day']), baseTargets);
        assert.deepEqual(writes.filter((write) => write.model === 'week').map((write) => write.data.caloriesPerDay), baseTargets);
        assert.ok(writes.filter((write) => write.model === 'days').every((write, index) =>
            write.data.every((day: any) => day.calorieTarget === baseTargets[index])));
        assert.match(prompt, /Training style: walkOnly/);
        assert.doesNotMatch(prompt, /This is a running-specific plan/);
        const planWrite = writes.find((write) => write.model === 'plan')!.data;
        assert.equal(planWrite.goalType, 'weightloss');
        assert.equal(planWrite.currentWeek, 1);
        assert.ok(planWrite.weekStartedAt instanceof Date);
        assert.equal(planWrite.runGoal, null);
        assert.equal('heightCm' in planWrite, false);
        assert.equal('ageYears' in planWrite, false);
        assert.equal(writes.filter((write) => write.model === 'week').length, 11);
        assert.equal(writes.filter((write) => write.model === 'days').length, 11);
        assert.equal(writes.find((write) => write.model === 'user')!.data.goalTarget, 76);
        assert.equal(writes.find((write) => write.model === 'weight')!.data.weightKg, 80);
    });

    await t.test('running-only generation keeps a maintenance base without pre-crediting workouts', async () => {
        failure = undefined;
        const runningRequest = { ...request, body: { ...request.body,
            goalType: 'running', targetWeightKg: null, trainingStyle: 'runOnly', intensityLevel: 'PRO',
            runGoal: '5k', runExperience: 'beginner',
        } };
        await handler(runningRequest, res, next);
        assert.equal(failure, undefined);
        assert.equal(response.debugAiRequest.resolvedValues.targetWeeklyLossKg, 0);
        const expectedBase = response.debugAiRequest.resolvedValues.baselineMaintenanceCalories;
        assert.ok(response['Weekly Plan Table'].every((week: any) =>
            week['Calories/day'] === expectedBase && week['Expected weight'] === 80));
    });

    await t.test('calendar goals retain fractional pace precision through generation', async () => {
        failure = undefined;
        const targetDate = new Date(Date.now() + 18 * 7 * 86400000).toISOString();
        await handler({ ...request, body: { ...request.body,
            targetWeightKg: 75, timeHorizon: 'SPECIFIC_DATE', targetDate,
        } }, res, next);
        assert.equal(failure, undefined);
        assert.equal(response.debugAiRequest.resolvedValues.targetDeadlineWeeks, 19);
        assert.equal(response.debugAiRequest.resolvedValues.targetWeeklyLossKg, 5 / 19);
        assert.equal(response['Weekly Plan Table'].at(-1)['Expected weight'], 75);
    });
});
