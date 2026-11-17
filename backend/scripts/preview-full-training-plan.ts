import 'dotenv/config';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';

/** Execute the real AI route with an in-memory database and the actual app workout builder. */
async function main() {
    const { default: prisma } = await import('../src/db/prisma');
    const { default: router } = await import('../src/routes/plan.routes');
    const profile = {
        goalType: 'weightloss', weightKg: 85, targetWeightKg: 80, heightCm: 175, ageYears: 35,
        gender: 'male', runExperience: 'beginner', trainingStyle: 'workout, runOnly',
        workoutDaysPerWeek: 3, workoutPreference: 'home', availableDays: [0, 2, 4], timeHorizon: 'STANDARD',
        hasRaceGoal: false,
    };
    const plan: any = {
        ...profile, id: 'local-example-plan', userId: 'local-example-user', weightToLoseKg: 5,
        targetDate: null, runRaceDate: null, runGoal: null, runDietFocus: null, activityPreference: null,
        intensityLevel: 'ACTIVE', dailyCalorieTarget: null, currentWeek: 1, weeklyPlans: [],
        user: { gender: profile.gender, heightFt: null, heightIn: null, goalType: profile.goalType, weightKg: profile.weightKg },
    };
    const weeks: any[] = [];
    const restore: Array<() => void> = [];
    const mock = (target: any, method: string, fn: any) => {
        const original = target[method]; target[method] = fn; restore.push(() => { target[method] = original; });
    };
    mock(prisma.userPlan, 'findUnique', async (query: any) => query.include?.weeklyPlans?.include?.dailyTargets ? null : plan);
    mock(prisma.userPlan, 'update', async ({ data }: any) => Object.assign(plan, data));
    mock(prisma.user, 'findUnique', async () => ({ timezone: 'Australia/Sydney' }));
    mock(prisma.dailySummary, 'findUnique', async () => null);
    mock(prisma, '$transaction', async (fn: any) => fn({
        generatedWeekPlan: {
            deleteMany: async () => { weeks.length = 0; },
            create: async ({ data }: any) => { const week = { id: `example-week-${data.week}`, ...data, dailyTargets: [] }; weeks.push(week); return week; },
        },
        dailyTarget: { createMany: async ({ data }: any) => { weeks.find(week => week.id === data[0].weekPlanId).dailyTargets = data; } },
    }));
    try {
        const layer: any = router.stack.find((layer: any) => Array.isArray(layer.route?.path) && layer.route.path.includes('/generate-weekly'));
        let payload: any; let error: any; let status = 200;
        const res = { status: (value: number) => { status = value; return res; }, json: (value: any) => { payload = value; } };
        await layer.route.stack[0].handle({ user: { id: plan.userId }, path: '/generate-weekly', query: { force: 'true' }, body: {} }, res, (value: any) => { error = value; });
        if (error) throw error;
        if (status !== 200 || !payload?.['Weekly Plan Table']?.length) throw new Error(`Generation failed with status ${status}`);

        // Extract the real data and pure builder with TypeScript's AST; native UI modules are not loaded.
        const library = readFileSync(resolve('../app/components/plan/workoutCatalog.ts'), 'utf8');
        const builder = readFileSync(resolve('../app/components/plan/partnerWorkoutDefinitions.ts'), 'utf8');
        const wanted = new Set(['PARTNER_WORKOUTS', 'findPartnerWorkout', 'makeExercise', 'makeWorkoutCatalog', 'getRecommendedWorkout', 'getWorkoutPlan']);
        const selected: string[] = [];
        for (const source of [library, builder]) {
            const ast = ts.createSourceFile('source.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
            for (const node of ast.statements) {
                const name = ts.isFunctionDeclaration(node) ? node.name?.text
                    : ts.isVariableStatement(node) ? node.declarationList.declarations[0]?.name.getText(ast) : undefined;
                if (name && wanted.has(name)) selected.push(node.getText(ast));
            }
        }
        const compiled = ts.transpileModule(selected.join('\n'), {
            compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
        }).outputText;
        const app: any = {};
        new Function('require', 'exports', compiled)((asset: string) => asset, app);
        const names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const detailedWeeks = weeks.map(week => {
            return {
                week: week.week, expectedWeightKg: week.expectedWeight,
                days: week.dailyTargets.map((day: any) => {
                    const session = week.weekDailys.trainingSchedule.sessions.find((session: any) => session.dayOfWeek === day.dayOfWeek);
                    const recommended = session?.activity === 'WORKOUT' ? app.getRecommendedWorkout('home', week.week, session.workoutId, day.dayOfWeek) : null;
                    const workout = recommended ? app.getWorkoutPlan(recommended, week.week) : null;
                    const recommendation = workout ? {
                        id: recommended.id, title: recommended.title, people: recommended.people, animated: true,
                        optionalRecommendation: true, totalMinutes: workout.totalMinutes,
                        warmupMinutes: workout.warmupMinutes, cooldownMinutes: workout.cooldownMinutes,
                        exercises: workout.workoutExercises.map((block: any) => ({
                            name: block.exercise.name, prescription: block.targetLabel, setDurationSeconds: block.setDurationSeconds,
                            instructions: block.exercise.instructions,
                        })), plannedExerciseBurnKcal: null,
                    } : null;
                    return {
                        day: names[day.dayOfWeek], baseFoodKcal: day.calorieTarget, proteinGrams: day.proteinTarget,
                        steps: day.stepsTarget, waterMl: 2000,
                        activity: !session ? 'Recovery' : session.activity === 'WORKOUT' ? 'Home workout' : day.runType,
                        ...(session?.activity === 'WORKOUT' ? { workout: recommendation } : {}),
                        ...(session && session.activity !== 'WORKOUT' ? { runType: day.runType, distanceKm: day.runKm } : {}),
                    };
                }),
            };
        });
        assert.equal(detailedWeeks[0].days.filter((day: any) => day.activity === 'Home workout').length, 2);
        assert.equal(detailedWeeks[0].days.filter((day: any) => day.distanceKm > 0).length, 1);
        const result = {
            mode: 'Live AI plan generation; database operations replaced with in-memory test storage',
            model: payload.debugAiRequest?.model, input: profile,
            notes: ['Water uses the current app default of 8 glasses of 250 ml.', 'Base food calories exclude activity credits; actual tracked activity is credited separately.'],
            weeklyPlan: payload['Weekly Plan Table'], detailedWeeks,
        };
        const file = resolve('../output/full-training-plan-example.json');
        writeFileSync(file, JSON.stringify(result, null, 2));
        console.log(JSON.stringify({ file, model: result.model, input: profile, weekOne: detailedWeeks[0], weeklyPlan: result.weeklyPlan }, null, 2));
    } finally {
        restore.reverse().forEach(fn => fn());
        await prisma.$disconnect();
    }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
