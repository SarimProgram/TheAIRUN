import type { Prisma, PrismaClient } from '@prisma/client';
import prisma from '../db/prisma';
import { estimateBmrKcal } from '../services/planning/planDuration';

export const REFERENCE_WEIGHT_KG = 70;
/** ~40 kcal per 1,000 steps at 70 kg */
export const BASE_KCAL_PER_STEP = 0.04;
/** Average stride estimate for subtracting workout-covered steps */
export const STEPS_PER_KM = 1300;

export type UserBurnProfile = {
    weightKg: number;
    heightCm: number | null;
    ageYears: number | null;
    gender: string | null;
};

export type WorkoutForBurn = {
    type: string;
    caloriesBurned: number;
    distanceKm: number;
    durationMinutes: number;
};

export type ActiveCaloriesBreakdown = {
    activeCalories: number;
    workoutCalories: number;
    stepCalories: number;
    stepsCoveredByWorkouts: number;
    remainingSteps: number;
};

type PrismaLike = PrismaClient | Prisma.TransactionClient;

export function resolveWeightKg(profile: Pick<UserBurnProfile, 'weightKg'>): number {
    return profile.weightKg > 0 ? profile.weightKg : REFERENCE_WEIGHT_KG;
}

export function kcalPerStep(weightKg: number): number {
    const weight = weightKg > 0 ? weightKg : REFERENCE_WEIGHT_KG;
    return BASE_KCAL_PER_STEP * (weight / REFERENCE_WEIGHT_KG);
}

function isWalkType(type: string): boolean {
    return type === 'WALK';
}

function distanceCalorieFactor(type: string): number {
    if (isWalkType(type)) return 0.5;
    if (type === 'CYCLING') return 0.35;
    if (type === 'SWIMMING') return 1.1;
    return 1.0;
}

function metForType(type: string): number {
    switch (type) {
        case 'WALK':
            return 3.5;
        case 'RUN':
        case 'INTERVAL':
            return 9.0;
        case 'CYCLING':
            return 7.5;
        case 'SWIMMING':
            return 8.0;
        case 'GYM':
            return 5.0;
        default:
            return 4.0;
    }
}

export function estimateWorkoutStepsCovered(workout: WorkoutForBurn): number {
    if (workout.distanceKm > 0) {
        return Math.round(workout.distanceKm * STEPS_PER_KM);
    }

    // Strength / gym sessions: workout calories stand alone; do not subtract steps.
    if (workout.type === 'GYM' || workout.type === 'OTHER') {
        return 0;
    }

    if (workout.durationMinutes > 0) {
        const stepsPerMinute = isWalkType(workout.type) ? 100 : 130;
        return workout.durationMinutes * stepsPerMinute;
    }

    return 0;
}

export function estimateWorkoutCalories(workout: WorkoutForBurn, weightKg: number): number {
    const weight = resolveWeightKg({ weightKg });

    if (workout.distanceKm > 0) {
        return Math.round(weight * workout.distanceKm * distanceCalorieFactor(workout.type));
    }

    if (workout.durationMinutes > 0) {
        const hours = workout.durationMinutes / 60;
        return Math.round(metForType(workout.type) * weight * hours);
    }

    if (workout.caloriesBurned > 0) {
        return Math.round(workout.caloriesBurned * (weight / REFERENCE_WEIGHT_KG));
    }

    return 0;
}

export function computeActiveCalories(input: {
    totalSteps: number;
    workouts: WorkoutForBurn[];
    profile: UserBurnProfile;
}): ActiveCaloriesBreakdown {
    const weightKg = resolveWeightKg(input.profile);
    const workoutCalories = input.workouts.reduce(
        (sum, workout) => sum + estimateWorkoutCalories(workout, weightKg),
        0,
    );
    const stepsCoveredByWorkouts = input.workouts.reduce(
        (sum, workout) => sum + estimateWorkoutStepsCovered(workout),
        0,
    );
    const remainingSteps = Math.max(0, Math.round(input.totalSteps) - stepsCoveredByWorkouts);
    const stepCalories = Math.round(remainingSteps * kcalPerStep(weightKg));

    return {
        activeCalories: workoutCalories + stepCalories,
        workoutCalories,
        stepCalories,
        stepsCoveredByWorkouts,
        remainingSteps,
    };
}

export function estimateRestingCalories(profile: UserBurnProfile): number {
    return estimateBmrKcal({
        weightKg: resolveWeightKg(profile),
        heightCm: profile.heightCm,
        ageYears: profile.ageYears,
        gender: profile.gender,
    });
}

export async function loadUserBurnProfile(userId: string, db: PrismaLike = prisma): Promise<UserBurnProfile> {
    const user = await db.user.findUnique({
        where: { id: userId },
        select: {
            weightKg: true,
            gender: true,
            plan: {
                select: {
                    weightKg: true,
                    heightCm: true,
                    ageYears: true,
                },
            },
        },
    });

    const planWeight = user?.plan?.weightKg ?? null;
    const liveWeight = user?.weightKg ?? null;

    return {
        weightKg: liveWeight ?? planWeight ?? REFERENCE_WEIGHT_KG,
        heightCm: user?.plan?.heightCm ?? null,
        ageYears: user?.plan?.ageYears ?? null,
        gender: user?.gender ?? null,
    };
}

export async function refreshDailyActiveCalories(
    userId: string,
    dayKey: string,
    db: PrismaLike = prisma,
): Promise<ActiveCaloriesBreakdown | null> {
    const profile = await loadUserBurnProfile(userId, db);

    const [y, m, d] = dayKey.split('-').map(Number);
    const stepDate = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));

    const [dailyStep, workouts] = await Promise.all([
        db.dailyStep.findUnique({
            where: { userId_date: { userId, date: stepDate } },
        }),
        db.workoutSession.findMany({
            where: { userId, dayKey },
        }),
    ]);

    const breakdown = computeActiveCalories({
        totalSteps: dailyStep?.steps ?? 0,
        workouts: workouts.map((workout) => ({
            type: workout.type,
            caloriesBurned: workout.caloriesBurned,
            distanceKm: workout.distanceKm,
            durationMinutes: workout.durationMinutes,
        })),
        profile,
    });

    const exerciseMinutes = workouts.reduce((sum, workout) => sum + workout.durationMinutes, 0);
    const distanceKm = workouts.reduce((sum, workout) => sum + workout.distanceKm, 0);
    const restingCalories = estimateRestingCalories(profile);
    const steps = dailyStep?.steps ?? 0;

    await db.dailySummary.upsert({
        where: { userId_dayKey: { userId, dayKey } },
        update: {
            steps,
            activeCalories: breakdown.activeCalories,
            exerciseMinutes,
            distanceKm,
            restingCalories,
            totalBurnedCalories: restingCalories + breakdown.activeCalories,
        },
        create: {
            userId,
            dayKey,
            steps,
            activeCalories: breakdown.activeCalories,
            exerciseMinutes,
            distanceKm,
            restingCalories,
            totalBurnedCalories: restingCalories + breakdown.activeCalories,
        },
    });

    const summary = await db.dailySummary.findUnique({
        where: { userId_dayKey: { userId, dayKey } },
    });

    if (summary) {
        await db.dailySummary.update({
            where: { id: summary.id },
            data: {
                netCalories: summary.consumedCalories - (restingCalories + breakdown.activeCalories),
            },
        });
    }

    return breakdown;
}
