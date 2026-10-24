import prisma from "../db/prisma";
import type { DailyTarget } from "@prisma/client";
import { estimateRestingCalories, loadUserBurnProfile } from "./activeCalories";

export type ResolvedPlanDayTargets = {
    calorieTarget: number;
    proteinTarget: number;
    stepsTarget: number;
    runKmTarget: number;
    restingCalories: number;
    runStatus: "PENDING" | "NOT_SCHEDULED";
};

function getWeekStartMonday(date: Date): Date {
    const d = new Date(date);
    const dayOfWeek = d.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    d.setDate(d.getDate() + mondayOffset);
    d.setHours(0, 0, 0, 0);
    return d;
}

function dayOfWeekFromDayKey(dayKey: string): number {
    const [year, month, day] = dayKey.split("-").map(Number);
    const localDate = new Date(year, month - 1, day);
    const todayDayOfWeek = localDate.getDay();
    return todayDayOfWeek === 0 ? 6 : todayDayOfWeek - 1;
}

function formatDayKeyInTimezone(date: Date, timezone?: string): string {
    if (timezone) {
        try {
            const localDateStr = date.toLocaleString("en-US", { timeZone: timezone });
            const localDate = new Date(localDateStr);
            const year = localDate.getFullYear();
            const month = String(localDate.getMonth() + 1).padStart(2, "0");
            const day = String(localDate.getDate()).padStart(2, "0");
            return `${year}-${month}-${day}`;
        } catch {
            // Fall through to server local time.
        }
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

export async function resolveCurrentWeek(
    userId: string,
    userPlan: {
        currentWeek: number;
        weekStartedAt: Date | null;
        weeklyPlans?: Array<{ week: number }> | null;
    } | null,
    referenceDate: Date
): Promise<{ currentWeek: number; weekPlan: any | null }> {
    if (!userPlan) return { currentWeek: 1, weekPlan: null };

    const maxWeek = userPlan.weeklyPlans?.length || 1;
    const planStart = userPlan.weekStartedAt ? new Date(userPlan.weekStartedAt) : referenceDate;
    const planStartMonday = getWeekStartMonday(planStart);
    const currentWeekStart = getWeekStartMonday(referenceDate);

    const weeksSinceStart = Math.max(
        0,
        Math.floor((currentWeekStart.getTime() - planStartMonday.getTime()) / (7 * 24 * 60 * 60 * 1000))
    );

    const effectiveWeek = Math.min(1 + weeksSinceStart, maxWeek);

    if (userPlan.currentWeek !== effectiveWeek) {
        await prisma.userPlan.update({
            where: { userId },
            data: { currentWeek: effectiveWeek },
        });
    }

    const weekPlan = userPlan.weeklyPlans?.find((week) => week.week === effectiveWeek) || null;
    return { currentWeek: effectiveWeek, weekPlan };
}

export async function resolvePlanTargetsForDayKey(
    userId: string,
    dayKey: string
): Promise<ResolvedPlanDayTargets | null> {
    const userPlan = await prisma.userPlan.findUnique({
        where: { userId },
        include: {
            weeklyPlans: {
                orderBy: { week: "asc" },
                include: { dailyTargets: true },
            },
        },
    });

    if (!userPlan) return null;

    const [year, month, day] = dayKey.split("-").map(Number);
    const referenceDate = new Date(year, month - 1, day);
    const { weekPlan } = await resolveCurrentWeek(userId, userPlan, referenceDate);
    const adjustedDayOfWeek = dayOfWeekFromDayKey(dayKey);
    const dailyTargets = (weekPlan?.dailyTargets ?? []) as DailyTarget[];
    const dailyTarget = dailyTargets.find(
        (target) => target.dayOfWeek === adjustedDayOfWeek
    );

    const calorieTarget = dailyTarget?.calorieTarget || userPlan.dailyCalorieTarget || 2000;
    const proteinTarget = dailyTarget?.proteinTarget || 100;
    const stepsTarget = dailyTarget?.stepsTarget || 8000;
    const runKmTarget = dailyTarget?.runKm ?? 0;
    const burnProfile = await loadUserBurnProfile(userId);

    return {
        calorieTarget,
        proteinTarget,
        stepsTarget,
        runKmTarget,
        restingCalories: estimateRestingCalories(burnProfile),
        runStatus: runKmTarget > 0 ? "PENDING" : "NOT_SCHEDULED",
    };
}

export async function syncDailySummaryTargetsFromPlan(userId: string, dayKey: string) {
    const targets = await resolvePlanTargetsForDayKey(userId, dayKey);
    if (!targets) return null;

    const existing = await prisma.dailySummary.findUnique({
        where: { userId_dayKey: { userId, dayKey } },
    });

    if (!existing) return null;

    const targetFieldsChanged =
        existing.calorieTarget !== targets.calorieTarget
        || existing.proteinTarget !== targets.proteinTarget
        || existing.stepsTarget !== targets.stepsTarget
        || existing.runKmTarget !== targets.runKmTarget
        || existing.runStatus !== targets.runStatus;

    if (!targetFieldsChanged) {
        return existing;
    }

    return prisma.dailySummary.update({
        where: { id: existing.id },
        data: {
            calorieTarget: targets.calorieTarget,
            proteinTarget: targets.proteinTarget,
            stepsTarget: targets.stepsTarget,
            runKmTarget: targets.runKmTarget,
            runStatus: targets.runStatus,
            caloriesRemaining: targets.calorieTarget - existing.consumedCalories,
        },
    });
}

export async function syncTodayDailySummaryTargets(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { timezone: true },
    });
    const dayKey = formatDayKeyInTimezone(new Date(), user?.timezone || "UTC");
    return syncDailySummaryTargetsFromPlan(userId, dayKey);
}
