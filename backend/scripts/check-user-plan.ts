import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { resolvePlanDuration, usesSpecificTargetDate } from '../src/services/planning/planDuration';

const prisma = new PrismaClient();
const email = process.argv[2] || 'bbznsns@ggg.com';

async function main() {
    const user = await prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: {
            id: true,
            email: true,
            gender: true,
            goalType: true,
            plan: {
                include: {
                    weeklyPlans: {
                        orderBy: { week: 'asc' },
                        include: { dailyTargets: { orderBy: { dayOfWeek: 'asc' } } },
                    },
                },
            },
        },
    });

    if (!user?.plan) {
        console.log(JSON.stringify({ error: 'USER_OR_PLAN_NOT_FOUND', email }, null, 2));
        return;
    }

    const plan = user.plan;
    const duration = resolvePlanDuration({
        goalType: plan.goalType,
        runGoal: plan.runGoal,
        runExperience: plan.runExperience,
        runRaceDate: plan.runRaceDate,
        targetDate: plan.targetDate,
        timeHorizon: plan.timeHorizon,
        weightKg: plan.weightKg,
        targetWeightKg: plan.targetWeightKg,
        weightToLoseKg: plan.weightToLoseKg,
    });

    const hasSpecificTargetDate = usesSpecificTargetDate({
        timeHorizon: plan.timeHorizon,
        targetDate: plan.targetDate,
    });

    const today = new Date();
    const dayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const dayOfWeek = (today.getDay() + 6) % 7;
    const currentWeekPlan = plan.weeklyPlans.find((w) => w.week === (plan.currentWeek ?? 1)) ?? plan.weeklyPlans[0];
    const todayDailyTarget = currentWeekPlan?.dailyTargets.find((d) => d.dayOfWeek === dayOfWeek);
    const summary = await prisma.dailySummary.findFirst({
        where: { userId: user.id, dayKey },
    });

    const weeklySample = plan.weeklyPlans.map((w) => ({
        week: w.week,
        weekName: w.weekName,
        caloriesPerDay: w.caloriesPerDay,
        stepsPerDay: w.stepsPerDay,
        runKmPerWeek: w.runKmPerWeek,
        expectedWeight: w.expectedWeight,
        prevExpectedWeight: plan.weeklyPlans[w.week - 2]?.expectedWeight ?? null,
        weeklyWeightChange: w.week > 1
            ? Number((w.expectedWeight - plan.weeklyPlans[w.week - 2].expectedWeight).toFixed(2))
            : null,
        calorieChangeFromPrev: w.week > 1
            ? w.caloriesPerDay - plan.weeklyPlans[w.week - 2].caloriesPerDay
            : null,
    }));

    const issues: string[] = [];
    if (!hasSpecificTargetDate && plan.targetDate) {
        issues.push('Stale targetDate stored while timeHorizon is not SPECIFIC_DATE');
    }
    if (summary && todayDailyTarget && summary.calorieTarget !== todayDailyTarget.calorieTarget) {
        issues.push(`Today's summary calorieTarget (${summary.calorieTarget}) != plan daily target (${todayDailyTarget.calorieTarget})`);
    }
    if (plan.targetWeightKg !== null && plan.weeklyPlans.length > 0) {
        const lastWeek = plan.weeklyPlans[plan.weeklyPlans.length - 1];
        if (Math.abs(lastWeek.expectedWeight - plan.targetWeightKg) > 0.5) {
            issues.push(`Final week expected weight (${lastWeek.expectedWeight}) far from target (${plan.targetWeightKg})`);
        }
    }
    const flatWeightWithCalorieDrop = weeklySample.filter((w, i) =>
        i > 0 && w.calorieChangeFromPrev !== null && w.calorieChangeFromPrev < -50 && (w.weeklyWeightChange ?? 0) >= 0
    );
    if (flatWeightWithCalorieDrop.length > 0) {
        issues.push('Some weeks tighten calories but expected weight does not drop');
    }

    console.log(JSON.stringify({
        user: { id: user.id, email: user.email, gender: user.gender, goalType: user.goalType },
        plan: {
            weightKg: plan.weightKg,
            heightCm: plan.heightCm,
            ageYears: plan.ageYears,
            targetWeightKg: plan.targetWeightKg,
            timeHorizon: plan.timeHorizon,
            trainingStyle: plan.trainingStyle,
            targetDate: plan.targetDate,
            hasSpecificTargetDate,
            dailyCalorieTarget: plan.dailyCalorieTarget,
            currentWeek: plan.currentWeek,
            weekStartedAt: plan.weekStartedAt,
            weeklyPlanCount: plan.weeklyPlans.length,
        },
        duration,
        today: {
            dayKey,
            dailyTargetCalories: todayDailyTarget?.calorieTarget ?? null,
            summaryCalorieTarget: summary?.calorieTarget ?? null,
        },
        weeklySample,
        issues,
        looksAlright: issues.length === 0,
    }, null, 2));
}

main()
    .catch((error) => {
        console.error(error);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
