import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { estimateTdeeKcal, resolvePlanDuration } from '../src/services/planning/planDuration';

const prisma = new PrismaClient();
const email = process.argv[2] || 'bbznsns@ggg.com';
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Rough estimates for projection (not app logic)
const KCAL_PER_STEP = 0.04; // ~40 kcal per 1000 steps at 70kg
const KCAL_PER_WALK_KM = 55; // brisk walk ~55 kcal/km at 70kg
const WALK_PACE_KMH = 5.5; // power walk pace

function round(n: number, d = 1) {
    const f = 10 ** d;
    return Math.round(n * f) / f;
}

async function main() {
    const user = await prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        include: {
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
        console.log(JSON.stringify({ error: 'not found' }));
        return;
    }

    const plan = user.plan;
    const tdee = estimateTdeeKcal({
        weightKg: plan.weightKg,
        heightCm: plan.heightCm!,
        ageYears: plan.ageYears,
        gender: user.gender,
        intensityLevel: plan.intensityLevel,
    });

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

    const startDate = plan.weekStartedAt ?? new Date();
    const weeks = plan.weeklyPlans.map((w) => {
        const dailies = w.dailyTargets;
        const stepDays = dailies.filter((d) => d.dayType === 'STEP');
        const runDays = dailies.filter((d) => d.dayType === 'RUN');
        const weeklySteps = dailies.reduce((s, d) => s + d.stepsTarget, 0);
        const weeklyWalkKm = dailies.reduce((s, d) => s + d.runKm, 0);
        const walkMinutes = (weeklyWalkKm / WALK_PACE_KMH) * 60;
        const stepKcal = weeklySteps * KCAL_PER_STEP;
        const walkKcal = weeklyWalkKm * KCAL_PER_WALK_KM;
        const activityKcal = stepKcal + walkKcal;
        const foodKcal = w.caloriesPerDay * 7;
        const impliedDeficit = (tdee * 7 + activityKcal) - foodKcal - tdee * 7 + (tdee * 7 - foodKcal);
        // Net weekly deficit from food only vs TDEE at sedentary baseline
        const foodDeficitVsTdee = tdee * 7 - foodKcal;
        // Extra burn above sedentary from planned activity (steps+walks beyond ~5000 steps/day baseline)
        const sedentarySteps = 5000 * 7;
        const extraSteps = Math.max(0, weeklySteps - sedentarySteps);
        const extraActivityKcal = extraSteps * KCAL_PER_STEP + walkKcal;

        const weekStart = new Date(startDate);
        weekStart.setDate(weekStart.getDate() + (w.week - 1) * 7);

        return {
            week: w.week,
            weekName: w.weekName,
            calendarStart: weekStart.toISOString().split('T')[0],
            foodPerDay: w.caloriesPerDay,
            proteinPerDay: w.proteinPerDay,
            stepsPerDayAvg: w.stepsPerDay,
            structuredWalkKm: round(weeklyWalkKm),
            walkSessions: runDays.map((d) => ({
                day: DAY_NAMES[d.dayOfWeek],
                km: d.runKm,
                type: d.runType,
                steps: d.stepsTarget,
            })),
            weeklyTotals: {
                steps: weeklySteps,
                walkKm: round(weeklyWalkKm),
                walkHours: round(walkMinutes / 60, 1),
                foodKcal,
            },
            expectedWeightKg: w.expectedWeight,
            weightChangeFromStart: round(w.expectedWeight - plan.weightKg, 2),
            plannedWeeklyLoss: w.week > 1
                ? round(w.expectedWeight - plan.weeklyPlans[w.week - 2].expectedWeight, 2)
                : round(w.expectedWeight - plan.weightKg, 2),
            estimates: {
                tdeePerDay: tdee,
                foodDeficitVsTdeePerWeek: Math.round(foodDeficitVsTdee),
                extraActivityKcalPerWeek: Math.round(extraActivityKcal),
                totalWeeklyDeficit: Math.round(foodDeficitVsTdee + extraActivityKcal),
                impliedKgLossPerWeek: round((foodDeficitVsTdee + extraActivityKcal) / 7700, 2),
            },
        };
    });

    const last = weeks[weeks.length - 1];
    const totalWalkKm = weeks.reduce((s, w) => s + w.weeklyTotals.walkKm, 0);
    const totalWalkHours = weeks.reduce((s, w) => s + w.weeklyTotals.walkHours, 0);
    const avgFood = weeks.reduce((s, w) => s + w.foodPerDay, 0) / weeks.length;

    console.log(JSON.stringify({
        profile: {
            email: user.email,
            startWeightKg: plan.weightKg,
            goalWeightKg: plan.targetWeightKg,
            trainingStyle: plan.trainingStyle,
            pace: plan.timeHorizon,
            tdeeEstimateKcalPerDay: tdee,
            planStarted: startDate.toISOString().split('T')[0],
            currentWeek: plan.currentWeek,
        },
        ifFollowedExactly: {
            endWeightKg: last.expectedWeightKg,
            totalWeightLostKg: round(plan.weightKg - last.expectedWeightKg, 1),
            hitsGoal: last.expectedWeightKg <= (plan.targetWeightKg ?? 0) + 0.1,
            weeksToGoal: weeks.length,
            avgFoodKcalPerDay: Math.round(avgFood),
            totalStructuredWalkKm: round(totalWalkKm),
            totalStructuredWalkHours: round(totalWalkHours, 1),
            avgStructuredWalkKmPerWeek: round(totalWalkKm / weeks.length),
        },
        weekByWeek: weeks,
        realityCheck: {
            note: 'Expected weight comes from the plan model. Implied kg/week uses ~7700 kcal/kg and rough activity estimates.',
            week8BigDrop: weeks[7]?.plannedWeeklyLoss,
            hardestWeek: weeks.reduce((a, b) =>
                b.weeklyTotals.walkHours + b.foodPerDay < a.foodPerDay + a.weeklyTotals.walkHours ? b : a
            ).week,
        },
    }, null, 2));
}

main().finally(() => prisma.$disconnect());
