import 'dotenv/config';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import prisma from '../src/db/prisma';
import { generateDailyTargets } from '../src/routes/plan.routes';
import { applyTrainingSchedule, buildTrainingSchedule, readTrainingSchedule } from '../src/services/planning/trainingSchedule';
import { syncTodayDailySummaryTargets } from '../src/lib/dailySummaryTargets';

/** Preview by default. --apply updates only the explicitly named user's current and future schedule. */
async function main() {
    const email = process.argv[2];
    if (!email || !email.includes('@')) throw new Error('Usage: npx tsx scripts/update-user-training-schedule.ts <email> [--apply]');
    const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: {
        id: true, email: true, plan: { include: { weeklyPlans: { orderBy: { week: 'asc' }, include: { dailyTargets: true } } } },
    } });
    if (!user?.plan || !user.plan.weeklyPlans.length) throw new Error('User or saved weekly plan not found');
    const plan = user.plan;
    const verifyIndex = process.argv.indexOf('--verify');
    if (verifyIndex >= 0) {
        const backup = JSON.parse(readFileSync(process.argv[verifyIndex + 1], 'utf8'));
        assert.equal(backup.userId, user.id);
        assert.equal(plan.weekStartedAt.toISOString(), backup.plan.weekStartedAt);
        assert.equal(plan.weeklyPlans.length, backup.plan.weeklyPlans.length);
        for (const week of plan.weeklyPlans) {
            const before = backup.plan.weeklyPlans.find((previous: any) => previous.id === week.id);
            for (const field of ['caloriesPerDay', 'proteinPerDay', 'stepsPerDay', 'expectedWeight'] as const) assert.equal(week[field], before[field]);
            for (const day of week.dailyTargets) {
                const previous = before.dailyTargets.find((target: any) => target.dayOfWeek === day.dayOfWeek);
                if (previous) for (const field of ['id', 'calorieTarget', 'proteinTarget'] as const) assert.equal(day[field], previous[field]);
            }
            if (week.week < plan.currentWeek) continue;
            const saved = readTrainingSchedule(week.weekDailys);
            assert.ok(saved);
            assert.equal(saved.sessions.length, plan.workoutDaysPerWeek);
            assert.ok(saved.sessions.filter(session => session.activity === 'WORKOUT').every(session => session.workoutPreference === 'gym' || !!session.workoutId));
        }
        console.log(JSON.stringify({ verified: true, email: user.email, weeks: plan.weeklyPlans.length,
            nutritionTargetsPreserved: true, projectedWeightsPreserved: true, dailyTargetIdsPreserved: true,
            currentSchedule: readTrainingSchedule(plan.weeklyPlans.find(week => week.week === plan.currentWeek)?.weekDailys),
        }, null, 2));
        return;
    }
    const schedule = buildTrainingSchedule(plan);
    schedule.customizationCompleted = readTrainingSchedule(plan.weeklyPlans.find(week => week.week >= plan.currentWeek)?.weekDailys)?.customizationCompleted ?? true;
    const updated = plan.weeklyPlans.filter(week => week.week >= plan.currentWeek).map(week => {
        const row = applyTrainingSchedule({ Week: week.week, 'Run km/week': week.runKmPerWeek, 'Week Dailys': week.weekDailys }, schedule);
        const targets = generateDailyTargets({ ...week, runKmPerWeek: row['Run km/week'] }, row['Week Dailys'], schedule.sessions.map(session => session.dayOfWeek));
        return { week, row, targets: targets.map(target => {
            const previous = week.dailyTargets.find(day => day.dayOfWeek === target.dayOfWeek);
            return { ...target, calorieTarget: previous?.calorieTarget ?? target.calorieTarget,
                proteinTarget: previous?.proteinTarget ?? target.proteinTarget };
        }) };
    });
    if (!updated.length) throw new Error('No current or future weeks found');
    const report = {
        email: user.email, mode: process.argv.includes('--apply') ? 'apply' : 'preview', currentWeek: plan.currentWeek,
        preferences: { trainingStyle: plan.trainingStyle, daysPerWeek: plan.workoutDaysPerWeek, workoutPreference: plan.workoutPreference },
        weeks: updated.map(({ week, row }) => ({ week: week.week, caloriesPerDay: week.caloriesPerDay, proteinPerDay: week.proteinPerDay,
            stepsPerDay: week.stepsPerDay, cardioKm: row['Run km/week'], trainingSchedule: row['Week Dailys'].trainingSchedule })),
    };
    if (!process.argv.includes('--apply')) { console.log(JSON.stringify(report, null, 2)); return; }
    const output = resolve('../output');
    mkdirSync(output, { recursive: true });
    const backup = resolve(output, `training-schedule-backup-${user.id}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    writeFileSync(backup, JSON.stringify({ userId: user.id, email: user.email, plan }, null, 2));
    await prisma.$transaction(async tx => {
        const guarded = await tx.userPlan.updateMany({ where: { id: plan.id, updatedAt: plan.updatedAt }, data: {
            availableDays: schedule.sessions.map(session => session.dayOfWeek),
        } });
        if (guarded.count !== 1) throw new Error('Plan changed during preparation; no update applied. Run the preview again.');
        for (const { week, row, targets } of updated) {
            const changed = await tx.generatedWeekPlan.updateMany({ where: { id: week.id, updatedAt: week.updatedAt }, data: {
                runKmPerWeek: row['Run km/week'], weekDailys: row['Week Dailys'],
            } });
            if (changed.count !== 1) throw new Error('A weekly plan changed during preparation; transaction rolled back.');
            for (const target of targets) await tx.dailyTarget.upsert({
                where: { weekPlanId_dayOfWeek: { weekPlanId: week.id, dayOfWeek: target.dayOfWeek } },
                create: target, update: target,
            });
        }
    }, { timeout: 60000 });
    await syncTodayDailySummaryTargets(user.id);
    console.log(JSON.stringify({ ...report, backup, updated: true }, null, 2));
}

main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
