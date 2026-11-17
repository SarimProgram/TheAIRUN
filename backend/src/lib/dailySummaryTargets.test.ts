import assert from 'node:assert/strict';
import test from 'node:test';

test('reading an unchanged target repairs stale remaining calories with activity credit', async (t) => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.JWT_SECRET = 'daily-energy-balance-regression';
    const { prisma } = await import('../db/prisma');
    const { syncDailySummaryTargetsFromPlan } = await import('./dailySummaryTargets');
    const existing = {
        id: 'summary-1', calorieTarget: 1900, proteinTarget: 100, stepsTarget: 8000, runKmTarget: 0,
        runStatus: 'NOT_SCHEDULED', consumedCalories: 2000, activeCalories: 400, caloriesRemaining: -100,
    };
    const target = { dayOfWeek: 0, calorieTarget: 1900, proteinTarget: 100, stepsTarget: 8000, runKm: 0 };
    const originals = [prisma.userPlan.findUnique, prisma.user.findUnique, prisma.dailySummary.findUnique, prisma.dailySummary.update];
    t.after(() => {
        [prisma.userPlan.findUnique, prisma.user.findUnique, prisma.dailySummary.findUnique, prisma.dailySummary.update] = originals as any;
    });
    prisma.userPlan.findUnique = (async () => ({
        currentWeek: 1, weekStartedAt: new Date('2026-11-02T12:00:00Z'),
        weeklyPlans: [{ week: 1, dailyTargets: [target] }],
    })) as any;
    prisma.user.findUnique = (async () => ({ weightKg: 95, gender: 'male', plan: { heightCm: 178, ageYears: 25, weightKg: 95 } })) as any;
    prisma.dailySummary.findUnique = (async () => existing) as any;
    let writes = 0;
    prisma.dailySummary.update = (async ({ data }: any) => {
        writes++;
        assert.equal(data.caloriesRemaining, 300);
        return { ...existing, ...data };
    }) as any;
    const result = await syncDailySummaryTargetsFromPlan('user-1', '2026-11-02');
    assert.equal(result?.caloriesRemaining, 300);
    assert.equal(writes, 1);
});
