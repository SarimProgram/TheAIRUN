import assert from 'node:assert/strict';
import test from 'node:test';

test('new plan generation, daily targets and customization use the same separate-session schedule', async t => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.OPENAI_API_KEY = 'test-no-network';
    let prompt = '';
    let aiRequest: any;
    let aiCalls = 0;
    let incompleteOutput = false;
    t.mock.method(globalThis, 'fetch', async (_url: unknown, init: any) => {
        aiCalls++;
        aiRequest = JSON.parse(init.body);
        prompt = aiRequest.input[0].content[0].text;
        const count = Number(prompt.match(/Number of weeks to generate: (\d+)/)?.[1]);
        return Response.json({ output_text: JSON.stringify({ 'Weekly Plan Table': Array.from({ length: incompleteOutput ? 0 : count }, (_, index) => ({
            Week: index + 1, 'Calories/day': 1800, 'Protein/day': 100, 'Steps/day target': 8000,
            'Run km/week': 14, 'Expected weight': 85 - index * 0.2, 'Week name': 'Build consistency',
            // Deliberately over-schedule: the server must enforce onboarding instead of trusting the model.
            'Week Dailys': { stepDays: 0, runDays: 7, recoveryDays: 0, runs: [{ runType: 'Goal Practice Run', sessions: 7, targetKm: 2 }] },
        })) }) });
    });
    const { default: prisma } = await import('../db/prisma');
    const { default: router } = await import('./plan.routes');
    const handler = (path: string, method: string) => (router.stack.find((layer: any) =>
        (layer.route?.path === path || (Array.isArray(layer.route?.path) && layer.route.path.includes(path))) && layer.route.methods[method]) as any).route.stack[0].handle;
    const call = async (path: string, method: string, body = {}, params = {}, query = {}) => {
        let status = 200; let json: any; let error: any;
        const res = { status: (value: number) => { status = value; return res; }, json: (value: any) => { json = value; } };
        await handler(path, method)({ user: { id: 'user' }, path, query, body, params }, res, (err: any) => { error = err; });
        return { status, json, error };
    };
    let plan: any = {
        id: 'plan', userId: 'user', weightKg: 85, heightCm: 175, ageYears: 35,
        goalType: 'weightloss', targetWeightKg: 80, weightToLoseKg: 5, timeHorizon: 'STANDARD', targetDate: null,
        runRaceDate: null, runGoal: '5k', hasRaceGoal: false, runExperience: 'beginner', runDietFocus: null, trainingStyle: 'workout, runOnly',
        workoutDaysPerWeek: 3, workoutPreference: 'gym', activityPreference: null, intensityLevel: 'ACTIVE',
        dailyCalorieTarget: null, availableDays: [0, 2, 4], currentWeek: 1, weeklyPlans: [],
        user: { gender: 'male', heightFt: null, heightIn: null, goalType: 'weightloss', weightKg: 85 },
    };
    let writes = 0;
    const weeks: any[] = [];
    const mockMethod = (model: any, method: string, implementation: any) => {
        const original = model[method];
        model[method] = implementation;
        t.after(() => { model[method] = original; });
    };
    mockMethod(prisma.userPlan, 'findUnique', async (query: any) => {
        if (query.include?.weeklyPlans?.include?.dailyTargets && !query.include.weeklyPlans.where) return null; // summary synchronization needs no DB
        return plan;
    });
    mockMethod(prisma.user, 'findUnique', async () => ({ timezone: 'UTC' }));
    mockMethod(prisma.dailySummary, 'findUnique', async () => null);
    mockMethod(prisma.userPlan, 'update', async ({ data }: any) => { writes++; Object.assign(plan, data); return plan; });
    t.mock.method(prisma, '$transaction', async (fn: any) => fn({
        userPlan: { update: async ({ data }: any) => { writes++; Object.assign(plan, data); return plan; } },
        generatedWeekPlan: {
            deleteMany: async () => { writes++; weeks.length = 0; },
            create: async ({ data }: any) => { writes++; const week = { id: `week-${data.week}`, ...data, dailyTargets: [] }; weeks.push(week); return week; },
            update: async ({ where, data }: any) => { writes++; const week = weeks.find(week => week.id === where.id); Object.assign(week, data); return week; },
        },
        dailyTarget: {
            deleteMany: async ({ where }: any) => { writes++; weeks.find(week => week.id === where.weekPlanId).dailyTargets = []; },
            createMany: async ({ data }: any) => { writes++; weeks.find(week => week.id === data[0].weekPlanId).dailyTargets = data; },
        },
    }));

    const generated = await call('/generate-weekly', 'post');
    assert.equal(generated.error, undefined);
    assert.equal(aiRequest.model, 'gpt-6.1-terra');
    assert.equal(aiRequest.reasoning.effort, 'low');
    assert.equal(aiRequest.text.format.strict, true);
    assert.equal(generated.json.debugAiRequest.model, aiRequest.model);
    assert.deepEqual(generated.json.debugAiRequest.reasoning, aiRequest.reasoning);
    assert.match(prompt, /exactly 3 total training days/);
    assert.match(prompt, /Return exactly 1 walking\/running sessions/);
    assert.match(prompt, /Race goal explicitly selected: no/);
    assert.match(prompt, /Goal Practice Run is forbidden in every week/);
    assert.ok(generated.json['Weekly Plan Table'].every((week: any) => week['Week Dailys'].runs.every((run: any) => run.runType !== 'Goal Practice Run')));
    assert.ok(weeks.length >= 8);
    for (const week of weeks) {
        assert.equal(week.weekDailys.workoutDays, 2);
        assert.equal(week.dailyTargets.filter((day: any) => day.dayType === 'RUN').length, 1);
        assert.equal(week.dailyTargets.filter((day: any) => day.dayType === 'RECOVERY').length, 4);
        assert.ok(week.dailyTargets.every((day: any) => day.stepsTarget === 8000 && day.proteinTarget === 100));
        assert.ok(week.weekDailys.runs.every((run: any) => run.runType !== 'Goal Practice Run'));
        assert.ok(week.dailyTargets.every((day: any) => day.runType !== 'Goal Practice Run'));
    }
    plan.weeklyPlans = weeks;
    assert.equal((await call('/training-schedule', 'get')).json.schedule.customizationCompleted, false);

    const sessions = [{ dayOfWeek: 1, activity: 'RUN' }, { dayOfWeek: 3, activity: 'WORKOUT', workoutPreference: 'home' }, { dayOfWeek: 5, activity: 'RUN' }];
    const customized = await call('/training-schedule', 'patch', { sessions });
    assert.equal(customized.error, undefined);
    assert.equal(customized.json.schedule.customizationCompleted, true);
    assert.deepEqual(plan.availableDays, [1, 3, 5]);
    assert.ok(weeks.every(week => week.dailyTargets.filter((day: any) => day.dayType === 'RUN').length === 2));
    assert.ok(weeks.every(week => week.weekDailys.trainingSchedule.sessions.find((session: any) => session.dayOfWeek === 3).workoutPreference === 'home'));
    const daily = await call('/daily/:weekNumber', 'get', {}, { weekNumber: '1' });
    assert.equal(daily.error, undefined);
    assert.equal(daily.json.days[3].trainingSession.workoutPreference, 'home');
    assert.equal(daily.json.days[3].runKm, 0);
    assert.equal(daily.json.days[0].dayType, 'RECOVERY');
    assert.equal(daily.json.days[0].stepsTarget, 8000);

    const past = JSON.stringify(weeks[0]);
    plan.currentWeek = 2;
    const moved = sessions.map(session => ({ ...session, dayOfWeek: session.dayOfWeek - 1 }));
    assert.equal((await call('/training-schedule', 'patch', { sessions: moved })).error, undefined);
    assert.equal(JSON.stringify(weeks[0]), past, 'editing later must preserve earlier weeks');
    assert.deepEqual((await call('/training-schedule', 'get')).json.schedule.sessions.map(({ workoutId, ...session }: any) => session), moved);

    for (const invalid of [sessions.slice(0, 2), [...sessions.slice(0, 2), sessions[0]], [...sessions.slice(0, 2), { dayOfWeek: 5, activity: 'WALK' }]]) {
        const before = writes;
        const result = await call('/training-schedule', 'patch', { sessions: invalid });
        assert.ok(result.error || result.status === 400);
        assert.equal(writes, before);
    }
    const before = writes;
    plan = { ...plan, weeklyPlans: [{ week: 1, weekDailys: { runDays: 3, runs: [] } }] };
    assert.equal((await call('/training-schedule', 'get')).json.schedule, null);
    assert.equal((await call('/training-schedule', 'patch', { sessions })).status, 409);
    assert.equal(writes, before, 'existing user plans must not be changed');

    // Reproduce the tester account: an existing home-only plan requests four days but stores only three weekdays.
    plan = { ...plan, currentWeek: 1, trainingStyle: 'workout', workoutPreference: 'home', workoutDaysPerWeek: 4,
        availableDays: [0, 2, 4], weeklyPlans: weeks.map(week => ({ ...week, weekDailys: {
            stepDays: 2, runDays: 1, recoveryDays: 4, runs: [{ runType: 'Power Walk', sessions: 1, targetKm: 4 }],
        } })) };
    const originalLegacyPlan = JSON.stringify(plan);
    const cachedWrites = writes;
    const cachedAiCalls = aiCalls;
    const cached = await call('/generate-weekly', 'post');
    assert.equal(cached.error, undefined);
    assert.equal(cached.json.cached, true);
    assert.equal(writes, cachedWrites);
    assert.equal(aiCalls, cachedAiCalls);
    assert.equal(JSON.stringify(plan), originalLegacyPlan);

    incompleteOutput = true;
    assert.ok((await call('/generate-weekly', 'post', {}, {}, { force: 'true' })).error);
    assert.equal(writes, cachedWrites, 'failed regeneration must preserve the existing plan');
    assert.equal(JSON.stringify(plan), originalLegacyPlan);

    incompleteOutput = false;
    const regenerated = await call('/generate-weekly', 'post', {}, {}, { force: 'true' });
    assert.equal(regenerated.error, undefined);
    assert.equal(regenerated.json.cached, false);
    assert.equal(aiCalls, cachedAiCalls + 2);
    assert.equal(plan.availableDays.length, 4);
    for (const week of weeks) {
        const schedule = week.weekDailys.trainingSchedule;
        assert.equal(schedule.version, 1);
        assert.equal(schedule.sessions.length, 4);
        assert.ok(schedule.sessions.every((session: any) => session.activity === 'WORKOUT' && session.workoutPreference === 'home'));
        assert.ok(schedule.sessions.every((session: any) => typeof session.workoutId === 'string' && session.workoutId !== 'weekly'));
        assert.equal(week.runKmPerWeek, 0);
        assert.deepEqual(week.weekDailys.runs, []);
        assert.equal(week.dailyTargets.filter((day: any) => day.dayType === 'RECOVERY').length, 3);
    }
});
