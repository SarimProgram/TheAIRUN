// src/routes/summary.routes.ts
// Routes for DailySummary and WorkoutSession

import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
import { prisma } from '../db/prisma';

// Helper: Get today's dayKey in YYYY-MM-DD format
// If timezone is provided, calculates "today" in that timezone
function getDayKey(date: Date = new Date(), timezone?: string): string {
    if (timezone) {
        try {
            const localDateStr = date.toLocaleString('en-US', { timeZone: timezone });
            const localDate = new Date(localDateStr);
            const year = localDate.getFullYear();
            const month = String(localDate.getMonth() + 1).padStart(2, '0');
            const day = String(localDate.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        } catch {
            // Fall through to server local time
        }
    }
    // Server local time fallback
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Helper: Get user's timezone from DB
async function getUserTimezone(userId: string): Promise<string> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { timezone: true }
    });
    return user?.timezone || 'UTC';
}

function getWeekStartMonday(date: Date): Date {
    const d = new Date(date);
    const dayOfWeek = d.getDay(); // 0=Sun, 1=Mon, ...
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    d.setDate(d.getDate() + mondayOffset);
    d.setHours(0, 0, 0, 0);
    return d;
}

function parseDayKey(dayKey: string): Date {
    const [y, m, d] = dayKey.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
}

function formatDayKeyUTC(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getWeekStartMondayFromDayKey(dayKey: string): Date {
    const d = parseDayKey(dayKey);
    const dayOfWeek = d.getUTCDay(); // 0=Sun, 1=Mon, ...
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    d.setUTCDate(d.getUTCDate() + mondayOffset);
    return d;
}

async function resolveCurrentWeek(
    userId: string,
    userPlan: any,
    today: Date
): Promise<{ currentWeek: number; weekPlan: any | null }> {
    if (!userPlan) return { currentWeek: 1, weekPlan: null };

    const maxWeek = userPlan.weeklyPlans?.length || 1;
    const planStart = userPlan.weekStartedAt ? new Date(userPlan.weekStartedAt) : today;
    const planStartMonday = getWeekStartMonday(planStart);
    const currentWeekStart = getWeekStartMonday(today);

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

    const weekPlan = userPlan.weeklyPlans?.find((w: any) => w.week === effectiveWeek) || null;
    return { currentWeek: effectiveWeek, weekPlan };
}

// ============================================
// SPECIFIC ROUTES FIRST (before /:dayKey)
// ============================================

/**
 * GET /summary/today
 * Get or create today's daily summary for the authenticated user
 * Uses user's timezone for consistent dayKey
 */
router.get('/today', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const userTimezone = await getUserTimezone(userId);

        // Use client-provided dayKey if available, otherwise fallback to timezone calculation
        let dayKey: string;
        if (req.query.dayKey && typeof req.query.dayKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.dayKey)) {
            dayKey = req.query.dayKey;
            console.log(`[GET /summary/today] Using client provided dayKey: ${dayKey}`);
        } else {
            dayKey = getDayKey(new Date(), userTimezone);
            console.log(`[GET /summary/today] Using server calculated dayKey: ${dayKey} (timezone: ${userTimezone})`);
        }

        // Try to find existing summary
        let summary = await prisma.dailySummary.findUnique({
            where: { userId_dayKey: { userId, dayKey } }
        });

        if (!summary) {
        // Get targets from user's plan if available
        const userPlan = await prisma.userPlan.findUnique({
            where: { userId },
            include: {
                weeklyPlans: {
                    orderBy: { week: 'asc' },
                    include: { dailyTargets: true }
                }
            }
        });

            // Calculate day-of-week from dayKey (already in user's timezone)
            const [year, month, day] = dayKey.split('-').map(Number);
            const localDate = new Date(year, month - 1, day);
            const todayDayOfWeek = localDate.getDay();
            const adjustedDayOfWeek = todayDayOfWeek === 0 ? 6 : todayDayOfWeek - 1;

        // Find the correct week plan based on effective current week
        const { currentWeek, weekPlan } = await resolveCurrentWeek(userId, userPlan, new Date());
        const dailyTarget = weekPlan?.dailyTargets.find(
            (d: any) => d.dayOfWeek === adjustedDayOfWeek
        );

            console.log(`[GET /summary/today] Creating new summary: dayKey=${dayKey}, currentWeek=${currentWeek}, dayOfWeek=${adjustedDayOfWeek}, dailyTarget=${JSON.stringify(dailyTarget)}`);

            // Create new summary with targets snapshot
            // Use || instead of ?? to fallback when value is 0
            summary = await prisma.dailySummary.create({
                data: {
                    userId,
                    dayKey,
                    timezone: userTimezone,
                    calorieTarget: dailyTarget?.calorieTarget || userPlan?.dailyCalorieTarget || 2000,
                    proteinTarget: dailyTarget?.proteinTarget || 100,
                    stepsTarget: dailyTarget?.stepsTarget || 8000,
                    runKmTarget: dailyTarget?.runKm ?? 0,
                    restingCalories: Math.round((userPlan?.weightKg ?? 70) * 24),
                    runStatus: (dailyTarget?.runKm ?? 0) > 0 ? 'PENDING' : 'NOT_SCHEDULED',
                }
            });
        }

        res.json(summary);
    } catch (error) {
        console.error('Error fetching daily summary:', error);
        res.status(500).json({ error: 'Failed to fetch daily summary', details: String(error) });
    }
});

/**
 * PATCH /summary/today
 * Update today's daily summary
 */
router.patch('/today', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const updates = req.body;

        // Use client-provided dayKey if available
        let dayKey: string;
        if (updates.dayKey && /^\d{4}-\d{2}-\d{2}$/.test(updates.dayKey)) {
            dayKey = updates.dayKey;
            console.log(`[PATCH /summary/today] Using client provided dayKey: ${dayKey}`);
        } else {
            dayKey = getDayKey();
            console.log(`[PATCH /summary/today] Using server calculated dayKey: ${dayKey}`);
        }

        const allowedFields = [
            'consumedCalories', 'proteinG', 'carbsG', 'fatG',
            'steps', 'activeCalories', 'exerciseMinutes', 'distanceKm'
        ];

        const filteredUpdates: Record<string, any> = {};
        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                filteredUpdates[field] = updates[field];
            }
        }

        const summary = await prisma.dailySummary.upsert({
            where: { userId_dayKey: { userId, dayKey } },
            update: {
                ...filteredUpdates,
                updatedAt: new Date()
            },
            create: {
                userId,
                dayKey,
                ...filteredUpdates
            }
        });

        // Recalculate derived fields
        const updatedSummary = await prisma.dailySummary.update({
            where: { id: summary.id },
            data: {
                totalBurnedCalories: summary.restingCalories + summary.activeCalories,
                caloriesRemaining: summary.calorieTarget - summary.consumedCalories,
                netCalories: summary.consumedCalories - (summary.restingCalories + summary.activeCalories)
            }
        });

        res.json(updatedSummary);
    } catch (error) {
        console.error('Error updating summary:', error);
        res.status(500).json({ error: 'Failed to update summary' });
    }
});

/**
 * GET /summary/week
 * Get weekly progress (sum of distanceKm for the current week)
 * Uses stored currentWeek from UserPlan and auto-increments if a week has passed
 */
router.get('/week', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;

        // Calculate current week's start (Monday) and end (Sunday)
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ...
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() + mondayOffset);
        weekStart.setHours(0, 0, 0, 0);

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 7);

        // Generate dayKeys for this week
        const dayKeys: string[] = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(weekStart);
            d.setDate(weekStart.getDate() + i);
            dayKeys.push(d.toISOString().split('T')[0]);
        }

        // Get all summaries for this week
        const summaries = await prisma.dailySummary.findMany({
            where: {
                userId,
                dayKey: { in: dayKeys }
            }
        });

        // Calculate totals
        const totalDistanceKm = summaries.reduce((sum, s) => sum + s.distanceKm, 0);
        const totalActiveCalories = summaries.reduce((sum, s) => sum + s.activeCalories, 0);
        const totalSteps = summaries.reduce((sum, s) => sum + s.steps, 0);
        const totalExerciseMinutes = summaries.reduce((sum, s) => sum + s.exerciseMinutes, 0);

        // Get user's plan with current week info
        const userPlan = await prisma.userPlan.findUnique({
            where: { userId },
            include: {
                weeklyPlans: {
                    orderBy: { week: 'asc' }
                }
            }
        });

        // Get target for the effective current week (aligned to Monday)
        const { currentWeek, weekPlan } = await resolveCurrentWeek(userId, userPlan, today);
        const weeklyKmTarget = weekPlan?.runKmPerWeek ?? 35;
        const remaining = Math.max(0, weeklyKmTarget - totalDistanceKm);

        res.json({
            weekStart: dayKeys[0],
            weekEnd: dayKeys[6],
            currentWeek,
            totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
            totalActiveCalories,
            totalSteps,
            totalExerciseMinutes,
            weeklyKmTarget,
            remaining: Math.round(remaining * 10) / 10,
            progressPercent: Math.min(100, Math.round((totalDistanceKm / weeklyKmTarget) * 100))
        });
    } catch (error) {
        console.error('Error fetching weekly progress:', error);
        res.status(500).json({ error: 'Failed to fetch weekly progress' });
    }
});

/**
 * GET /summary/partner/week
 * Get partner's weekly progress with their weekly km target
 */
router.get('/partner/week', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;

        // Get user with partner info
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                partnerId: true,
                partner: {
                    select: {
                        id: true,
                        displayName: true
                    }
                }
            }
        });

        if (!user?.partnerId || !user.partner) {
            return res.json({ hasPartner: false, partner: null });
        }

        const partnerId = user.partnerId;

        // Calculate current week's start (Monday) and end
        const today = new Date();
        const dayOfWeek = today.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() + mondayOffset);
        weekStart.setHours(0, 0, 0, 0);

        // Generate dayKeys for this week
        const dayKeys: string[] = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(weekStart);
            d.setDate(weekStart.getDate() + i);
            dayKeys.push(d.toISOString().split('T')[0]);
        }

        // Get partner's weekly summaries
        const summaries = await prisma.dailySummary.findMany({
            where: {
                userId: partnerId,
                dayKey: { in: dayKeys }
            }
        });

        const totalDistanceKm = summaries.reduce((sum, s) => sum + s.distanceKm, 0);
        const activeDayKeys = new Set(
            summaries
                .filter((s) => (s.steps ?? 0) > 0 || (s.exerciseMinutes ?? 0) > 0 || (s.distanceKm ?? 0) > 0)
                .map((s) => s.dayKey)
        );
        const todayDayKey = new Date().toISOString().split('T')[0];
        let activeStreak = 0;

        for (let index = dayKeys.length - 1; index >= 0; index -= 1) {
            const dayKey = dayKeys[index];
            if (dayKey > todayDayKey) continue;
            if (!activeDayKeys.has(dayKey)) break;
            activeStreak += 1;
        }

        const missedRunDays = summaries.filter((summary) => {
            const target = summary.runKmTarget ?? 0;
            const actual = summary.distanceKm ?? 0;
            return target > 0 && actual < target && summary.dayKey < todayDayKey;
        }).length;

        // Get partner's plan for their weekly km target
        const partnerPlan = await prisma.userPlan.findUnique({
            where: { userId: partnerId },
            include: {
                weeklyPlans: {
                    orderBy: { week: 'asc' }
                }
            }
        });

        const { currentWeek, weekPlan } = await resolveCurrentWeek(partnerId, partnerPlan, today);
        const weeklyKmTarget = weekPlan?.runKmPerWeek ?? 35;
        const remaining = Math.max(0, weeklyKmTarget - totalDistanceKm);

        res.json({
            hasPartner: true,
            partner: {
                id: user.partner.id,
                name: user.partner.displayName,
                weeklyKm: Math.round(totalDistanceKm * 10) / 10,
                weeklyKmTarget,
                remaining: Math.round(remaining * 10) / 10,
                progressPercent: Math.min(100, Math.round((totalDistanceKm / weeklyKmTarget) * 100)),
                activeDays: activeDayKeys.size,
                activeStreak,
                missedRunDays,
            }
        });
    } catch (error) {
        console.error('Error fetching partner weekly progress:', error);
        res.status(500).json({ error: 'Failed to fetch partner weekly progress' });
    }
});


router.post('/recalculate', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const userTimezone = await getUserTimezone(userId);

        // Use client provided dayKey or calculate from server time + user timezone
        let dayKey = req.body.dayKey;
        if (!dayKey) {
            dayKey = getDayKey(new Date(), userTimezone);
        }

        console.log(`[recalculate] userId=${userId}, timezone=${userTimezone}, dayKey=${dayKey}`);

        // We avoid constructing timezone-local Date boundaries via locale string parsing.
        // Instead, query a safe UTC window around the requested day and bucket meals by user-local dayKey.
        const [y, m, d] = dayKey.split('-').map(Number);
        const targetUtcMidnight = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
        const today = new Date(y, m - 1, d);
        const mealQueryStart = new Date(targetUtcMidnight);
        mealQueryStart.setUTCDate(mealQueryStart.getUTCDate() - 1);
        const mealQueryEnd = new Date(targetUtcMidnight);
        mealQueryEnd.setUTCDate(mealQueryEnd.getUTCDate() + 2);

        // For steps - use UTC midnight to match how steps.routes.ts stores them
        // steps.routes.ts uses: new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
        const todayUtc = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));

        // Get today's meals
        const mealCandidates = await prisma.mealLog.findMany({
            where: {
                userId,
                loggedAt: { gte: mealQueryStart, lt: mealQueryEnd }
            },
            include: {
                items: {
                    select: { calories: true, proteinG: true, carbsG: true, fatG: true }
                }
            }
        });
        const meals = mealCandidates.filter((meal) => getDayKey(new Date(meal.loggedAt), userTimezone) === dayKey);

        const consumedCalories = meals.reduce((sum: number, m: any) => {
            if (Array.isArray(m.items) && m.items.length > 0) {
                return sum + m.items.reduce((s: number, it: any) => s + (Number(it?.calories) || 0), 0);
            }
            return sum + (Number(m.totalCalories) || 0);
        }, 0);
        const proteinG = meals.reduce((sum: number, m: any) => {
            if (Array.isArray(m.items) && m.items.length > 0) {
                return sum + m.items.reduce((s: number, it: any) => s + (Number(it?.proteinG) || 0), 0);
            }
            return sum + (Number(m.totalProteinG) || 0);
        }, 0);
        const carbsG = meals.reduce((sum: number, m: any) => {
            if (Array.isArray(m.items) && m.items.length > 0) {
                return sum + m.items.reduce((s: number, it: any) => s + (Number(it?.carbsG) || 0), 0);
            }
            return sum + (Number(m.totalCarbsG) || 0);
        }, 0);
        const fatG = meals.reduce((sum: number, m: any) => {
            if (Array.isArray(m.items) && m.items.length > 0) {
                return sum + m.items.reduce((s: number, it: any) => s + (Number(it?.fatG) || 0), 0);
            }
            return sum + (Number(m.totalFatG) || 0);
        }, 0);

        // Get today's workouts
        const workouts = await prisma.workoutSession.findMany({
            where: { userId, dayKey }
        });

        const workoutCalories = workouts.reduce((sum: number, w: any) => sum + w.caloriesBurned, 0);
        const exerciseMinutes = workouts.reduce((sum: number, w: any) => sum + w.durationMinutes, 0);
        const distanceKm = workouts.reduce((sum: number, w: any) => sum + w.distanceKm, 0);

        // Get steps - use UTC midnight date
        const dailyStep = await prisma.dailyStep.findUnique({
            where: { userId_date: { userId, date: todayUtc } }
        });
        const steps = dailyStep?.steps ?? 0;
        console.log(`[recalculate] dayKey=${dayKey}, todayUtc=${todayUtc.toISOString()}, steps=${steps}`);

        // Calculate step-based calories (approx 0.04 kcal per step)
        const stepCalories = Math.round(steps * 0.04);

        // Total active calories = workout calories + step calories
        const activeCalories = workoutCalories + stepCalories;

        // Get user plan for targets (needed if creating new record)
        const userPlan = await prisma.userPlan.findUnique({
            where: { userId },
            include: {
                weeklyPlans: {
                    orderBy: { week: 'asc' },
                    include: { dailyTargets: true }
                }
            }
        });

        // Calculate day-of-week from dayKey
        const localDate = new Date(y, m - 1, d);
        const todayDayOfWeek = localDate.getDay();
        const adjustedDayOfWeek = todayDayOfWeek === 0 ? 6 : todayDayOfWeek - 1;

        // Find correct week's targets
        const { currentWeek, weekPlan } = await resolveCurrentWeek(userId, userPlan, today);
        const dailyTarget = weekPlan?.dailyTargets.find(
            (dt: any) => dt.dayOfWeek === adjustedDayOfWeek
        );

        // Calculate targets with fallbacks
        const calorieTarget = dailyTarget?.calorieTarget || userPlan?.dailyCalorieTarget || 2000;
        const proteinTarget = dailyTarget?.proteinTarget || 100;
        const stepsTarget = dailyTarget?.stepsTarget || 8000;
        const runKmTarget = dailyTarget?.runKm ?? 0;
        const restingCalories = Math.round((userPlan?.weightKg ?? 70) * 24);

        // Update summary
        const summary = await prisma.dailySummary.upsert({
            where: { userId_dayKey: { userId, dayKey } },
            update: {
                consumedCalories,
                proteinG,
                carbsG,
                fatG,
                steps,
                activeCalories,
                exerciseMinutes,
                distanceKm,
                updatedAt: new Date()
            },
            create: {
                userId,
                dayKey,
                timezone: userTimezone,
                calorieTarget,
                proteinTarget,
                stepsTarget,
                runKmTarget,
                restingCalories,
                consumedCalories,
                proteinG,
                carbsG,
                fatG,
                steps,
                activeCalories,
                exerciseMinutes,
                distanceKm
            }
        });


        // Recalculate derived fields
        const updatedSummary = await prisma.dailySummary.update({
            where: { id: summary.id },
            data: {
                totalBurnedCalories: summary.restingCalories + activeCalories,
                caloriesRemaining: summary.calorieTarget - consumedCalories,
                netCalories: consumedCalories - (summary.restingCalories + activeCalories)
            }
        });

        res.json(updatedSummary);
    } catch (error) {
        console.error('Error recalculating summary:', error);
        res.status(500).json({ error: 'Failed to recalculate summary' });
    }
});

/**
 * GET /summary/partner
 * Get partner's daily summary for today (for TodayGoalHero sync)
 * Uses the REQUESTING user's timezone to determine "today"
 */
router.get('/partner', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;

        // Get user with partner info (including partner's timezone)
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                partnerId: true,
                partner: {
                    select: {
                        id: true,
                        displayName: true,
                        timezone: true  // Need partner's timezone to find their data
                    }
                }
            }
        });

        if (!user?.partnerId || !user.partner) {
            return res.json({ hasPartner: false, partner: null });
        }

        const partnerId = user.partnerId;

        // Use PARTNER's timezone to calculate their "today" dayKey
        // This is correct because partner's data is stored under THEIR timezone's dayKey
        const partnerTimezone = user.partner.timezone || 'UTC';
        const dayKey = getDayKey(new Date(), partnerTimezone);

        // Fetch partner's daily summary using their dayKey
        let partnerSummary = await prisma.dailySummary.findUnique({
            where: {
                userId_dayKey: {
                    userId: partnerId,
                    dayKey
                }
            }
        }) as any;

        // If partner's summary doesn't exist yet (partner hasn't opened their app today),
        // create it on-demand using their plan data — just like GET /summary/today does.
        if (!partnerSummary) {
            console.log(`[GET /summary/partner] Partner ${partnerId} has no summary for ${dayKey}, creating on-demand...`);

            const partnerPlan = await prisma.userPlan.findUnique({
                where: { userId: partnerId },
                include: {
                    weeklyPlans: {
                        orderBy: { week: 'asc' },
                        include: { dailyTargets: true }
                    }
                }
            });

            // Calculate day-of-week from dayKey (in partner's timezone)
            const [year, month, day] = dayKey.split('-').map(Number);
            const localDate = new Date(year, month - 1, day);
            const todayDayOfWeek = localDate.getDay();
            const adjustedDayOfWeek = todayDayOfWeek === 0 ? 6 : todayDayOfWeek - 1;

            // Find the correct week plan
            const { currentWeek, weekPlan } = await resolveCurrentWeek(partnerId, partnerPlan, new Date());
            const dailyTarget = weekPlan?.dailyTargets.find(
                (d: any) => d.dayOfWeek === adjustedDayOfWeek
            );

            const calorieTarget = dailyTarget?.calorieTarget || partnerPlan?.dailyCalorieTarget || 2000;
            const proteinTarget = dailyTarget?.proteinTarget || 100;
            const stepsTarget = dailyTarget?.stepsTarget || 8000;
            const runKmTarget = dailyTarget?.runKm ?? 0;
            const restingCalories = Math.round((partnerPlan?.weightKg ?? 70) * 24);

            partnerSummary = await prisma.dailySummary.create({
                data: {
                    userId: partnerId,
                    dayKey,
                    timezone: partnerTimezone,
                    calorieTarget,
                    proteinTarget,
                    stepsTarget,
                    runKmTarget,
                    restingCalories,
                }
            });

            console.log(`[GET /summary/partner] Created partner summary: calorieTarget=${calorieTarget}, stepsTarget=${stepsTarget}`);
        }

        // Also fetch partner's steps directly from DailyStep table as a fallback/source of truth,
        // since steps are synced to DailyStep independently and the DailySummary may not have them yet
        const [pYear, pMonth, pDay] = dayKey.split('-').map(Number);
        const partnerTodayUtc = new Date(Date.UTC(pYear, pMonth - 1, pDay, 0, 0, 0, 0));
        const dailyStep = await prisma.dailyStep.findUnique({
            where: {
                userId_date: {
                    userId: partnerId,
                    date: partnerTodayUtc
                }
            }
        });
        // Use the higher of DailySummary.steps or DailyStep.steps (they may be out of sync)
        const resolvedSteps = Math.max(partnerSummary?.steps ?? 0, dailyStep?.steps ?? 0);

        res.json({
            hasPartner: true,
            partner: {
                id: user.partner.id,
                name: user.partner.displayName,
                // Map to TodayGoalHero expected format
                goal: partnerSummary.calorieTarget,
                food: partnerSummary.consumedCalories ?? 0,
                exercise: partnerSummary.activeCalories ?? 0,
                exerciseMinutes: partnerSummary.exerciseMinutes ?? 0,
                distanceKm: partnerSummary.distanceKm ?? 0,
                steps: resolvedSteps,
                stepsTarget: partnerSummary.stepsTarget,
                runKmTarget: partnerSummary.runKmTarget ?? 0,
                waterMl: partnerSummary.waterMl ?? 0,
                lastWaterUpdate: partnerSummary.lastWaterAt ? new Date(partnerSummary.lastWaterAt).toISOString() : null
            }
        });
    } catch (error) {
        console.error('Error fetching partner summary:', error);
        res.status(500).json({ error: 'Failed to fetch partner summary' });
    }
});

// ============================================
// WORKOUT SESSION ENDPOINTS (before /:dayKey)
// ============================================

/**
 * GET /summary/workouts/today
 * Get today's workout sessions
 */
router.get('/workouts/today', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const dayKey = getDayKey();

        const workouts = await prisma.workoutSession.findMany({
            where: { userId, dayKey },
            orderBy: { startedAt: 'desc' }
        });

        res.json(workouts);
    } catch (error) {
        console.error('Error fetching workouts:', error);
        res.status(500).json({ error: 'Failed to fetch workouts' });
    }
});

/**
 * POST /summary/workouts
 * Log a new workout session
 */
router.post('/workouts', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const {
            type,
            title,
            caloriesBurned,
            distanceKm,
            durationMinutes,
            avgPaceSecPerKm,
            startedAt,
            endedAt,
            routeJson,
            source = 'MANUAL'
        } = req.body;

        const startDate = new Date(startedAt);
        const dayKey = getDayKey(startDate);

        const workout = await prisma.workoutSession.create({
            data: {
                userId,
                dayKey,
                type,
                source,
                title,
                caloriesBurned: caloriesBurned ?? 0,
                distanceKm: distanceKm ?? 0,
                durationMinutes: durationMinutes ?? 0,
                avgPaceSecPerKm,
                startedAt: startDate,
                endedAt: endedAt ? new Date(endedAt) : null,
                routeJson
            }
        });

        // Update daily summary with new workout data
        await prisma.dailySummary.upsert({
            where: { userId_dayKey: { userId, dayKey } },
            update: {
                activeCalories: { increment: caloriesBurned ?? 0 },
                exerciseMinutes: { increment: durationMinutes ?? 0 },
                distanceKm: { increment: distanceKm ?? 0 }
            },
            create: {
                userId,
                dayKey,
                activeCalories: caloriesBurned ?? 0,
                exerciseMinutes: durationMinutes ?? 0,
                distanceKm: distanceKm ?? 0
            }
        });

        res.status(201).json(workout);
    } catch (error) {
        console.error('Error creating workout:', error);
        res.status(500).json({ error: 'Failed to create workout' });
    }
});

/**
 * DELETE /summary/workouts/:id
 * Delete a workout session
 */
router.delete('/workouts/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;

        const workout = await prisma.workoutSession.findFirst({
            where: { id, userId }
        });

        if (!workout) {
            return res.status(404).json({ error: 'Workout not found' });
        }

        await prisma.workoutSession.delete({ where: { id } });

        // Update daily summary to remove workout data
        await prisma.dailySummary.update({
            where: { userId_dayKey: { userId, dayKey: workout.dayKey } },
            data: {
                activeCalories: { decrement: workout.caloriesBurned },
                exerciseMinutes: { decrement: workout.durationMinutes },
                distanceKm: { decrement: workout.distanceKm }
            }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting workout:', error);
        res.status(500).json({ error: 'Failed to delete workout' });
    }
});

// ============================================
// GOALS SCREEN ENDPOINT (consolidated data)
// ============================================

/**
 * GET /summary/goals
 * Get all data needed for the Goals screen:
 * - Weight progress (user & partner)
 * - Monthly KMs (user & partner)
 * - Activity breakdown (today & weekly for user & partner)
 */
router.get('/goals', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const userTimezone = await getUserTimezone(userId);
        const today = new Date();
        const dayKey = getDayKey(today, userTimezone);

        // Get user with partner info
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                weightKg: true,
                displayName: true,
                partnerId: true,
                partner: {
                    select: {
                        id: true,
                        displayName: true,
                        weightKg: true,
                        timezone: true
                    }
                }
            }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get user's plan with weight info
        const userPlan = await prisma.userPlan.findUnique({
            where: { userId },
            include: {
                weeklyPlans: {
                    orderBy: { week: 'asc' }
                }
            }
        });

        // Get partner's plan if partner exists
        let partnerPlan = null;
        if (user.partnerId) {
            partnerPlan = await prisma.userPlan.findUnique({
                where: { userId: user.partnerId },
                include: {
                    weeklyPlans: {
                        orderBy: { week: 'asc' }
                    }
                }
            });
        }

        // ============================================
        // WEIGHT PROGRESS
        // ============================================
        const userStartWeight = userPlan?.weightKg ?? user.weightKg ?? 70;
        const userCurrentWeight = user.weightKg ?? userStartWeight;
        const userTargetWeight = userPlan?.targetWeightKg ?? userStartWeight;
        const userWeightLost = userStartWeight - userCurrentWeight;

        let partnerWeight = null;
        if (user.partner && partnerPlan) {
            const partnerStartWeight = partnerPlan.weightKg ?? user.partner.weightKg ?? 70;
            const partnerCurrentWeight = user.partner.weightKg ?? partnerStartWeight;
            const partnerTargetWeight = partnerPlan.targetWeightKg ?? partnerStartWeight;
            const partnerWeightLost = partnerStartWeight - partnerCurrentWeight;

            partnerWeight = {
                name: user.partner.displayName,
                startWeight: partnerStartWeight,
                currentWeight: partnerCurrentWeight,
                targetWeight: partnerTargetWeight,
                lost: Math.round(partnerWeightLost * 10) / 10
            };
        }

        const combinedLost = userWeightLost + (partnerWeight?.lost ?? 0);
        const combinedGoal = (userStartWeight - userTargetWeight) +
            (partnerWeight ? (partnerWeight.startWeight - partnerWeight.targetWeight) : 0);

        // ============================================
        // MONTHLY KMS
        // ============================================
        // Use the previous calendar month for the monthly distance comparison.
        const monthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const monthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

        // Generate all dayKeys for the previous month.
        const monthDayKeys: string[] = [];
        const currentDay = new Date(monthStart);
        while (currentDay <= monthEnd) {
            monthDayKeys.push(getDayKey(currentDay, userTimezone));
            currentDay.setDate(currentDay.getDate() + 1);
        }

        // Get user's monthly summaries
        const userMonthlySummaries = await prisma.dailySummary.findMany({
            where: {
                userId,
                dayKey: { in: monthDayKeys }
            }
        });
        const userMonthlyKm = userMonthlySummaries.reduce((sum, s) => sum + s.distanceKm, 0);

        // Get partner's monthly summaries
        let partnerMonthlyKm = 0;
        if (user.partnerId) {
            const partnerTimezone = user.partner?.timezone || 'UTC';
            const partnerMonthDayKeys: string[] = [];
            const pCurrentDay = new Date(monthStart);
            while (pCurrentDay <= monthEnd) {
                partnerMonthDayKeys.push(getDayKey(pCurrentDay, partnerTimezone));
                pCurrentDay.setDate(pCurrentDay.getDate() + 1);
            }

            const partnerMonthlySummaries = await prisma.dailySummary.findMany({
                where: {
                    userId: user.partnerId,
                    dayKey: { in: partnerMonthDayKeys }
                }
            });
            partnerMonthlyKm = partnerMonthlySummaries.reduce((sum, s) => sum + s.distanceKm, 0);
        }

        // ============================================
        // ACTIVITY BREAKDOWN (Today & Weekly)
        // ============================================
        // Get today's summary for user
        const userTodaySummary = await prisma.dailySummary.findUnique({
            where: { userId_dayKey: { userId, dayKey } }
        });

        // Calculate week dayKeys (Monday to Sunday)
        const dayOfWeek = today.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() + mondayOffset);
        weekStart.setHours(0, 0, 0, 0);

        const weekDayKeys: string[] = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(weekStart);
            d.setDate(weekStart.getDate() + i);
            weekDayKeys.push(getDayKey(d, userTimezone));
        }

        // Get user's weekly summaries
        const userWeeklySummaries = await prisma.dailySummary.findMany({
            where: {
                userId,
                dayKey: { in: weekDayKeys }
            }
        });
        const userWeeklyKm = userWeeklySummaries.reduce((sum, s) => sum + s.distanceKm, 0);

        // Get targets from plan
        const { currentWeek, weekPlan } = await resolveCurrentWeek(userId, userPlan, today);
        const userWeeklyTarget = weekPlan?.runKmPerWeek ?? 35;
        const userDailyTarget = userTodaySummary?.runKmTarget ?? (userWeeklyTarget / 5);

        // Partner activity data
        let partnerActivity = null;
        if (user.partnerId && user.partner) {
            const partnerTimezone = user.partner.timezone || 'UTC';
            const partnerDayKey = getDayKey(today, partnerTimezone);

            const partnerTodaySummary = await prisma.dailySummary.findUnique({
                where: { userId_dayKey: { userId: user.partnerId, dayKey: partnerDayKey } }
            });

            // Partner week dayKeys
            const partnerWeekDayKeys: string[] = [];
            for (let i = 0; i < 7; i++) {
                const d = new Date(weekStart);
                d.setDate(weekStart.getDate() + i);
                partnerWeekDayKeys.push(getDayKey(d, partnerTimezone));
            }

            const partnerWeeklySummaries = await prisma.dailySummary.findMany({
                where: {
                    userId: user.partnerId,
                    dayKey: { in: partnerWeekDayKeys }
                }
            });
            const partnerWeeklyKm = partnerWeeklySummaries.reduce((sum, s) => sum + s.distanceKm, 0);

            const { weekPlan: partnerWeekPlan } = await resolveCurrentWeek(user.partnerId, partnerPlan, today);
            const partnerWeeklyTarget = partnerWeekPlan?.runKmPerWeek ?? 35;

            partnerActivity = {
                name: user.partner.displayName,
                todayKm: Math.round((partnerTodaySummary?.distanceKm ?? 0) * 10) / 10,
                todayTarget: partnerTodaySummary?.runKmTarget ?? (partnerWeeklyTarget / 5),
                weeklyKm: Math.round(partnerWeeklyKm * 10) / 10,
                weeklyTarget: partnerWeeklyTarget
            };
        }

        res.json({
            weight: {
                user: {
                    startWeight: userStartWeight,
                    currentWeight: userCurrentWeight,
                    targetWeight: userTargetWeight,
                    lost: Math.round(userWeightLost * 10) / 10
                },
                partner: partnerWeight,
                combinedLost: Math.round(combinedLost * 10) / 10,
                goal: Math.round(combinedGoal * 10) / 10
            },
            monthlyKm: {
                user: {
                    km: Math.round(userMonthlyKm * 10) / 10,
                    currentWeek
                },
                partner: user.partner ? {
                    name: user.partner.displayName,
                    km: Math.round(partnerMonthlyKm * 10) / 10
                } : null
            },
            activity: {
                user: {
                    todayKm: Math.round((userTodaySummary?.distanceKm ?? 0) * 10) / 10,
                    todayTarget: Math.round(userDailyTarget * 10) / 10,
                    weeklyKm: Math.round(userWeeklyKm * 10) / 10,
                    weeklyTarget: userWeeklyTarget
                },
                partner: partnerActivity
            }
        });
    } catch (error) {
        console.error('Error fetching goals data:', error);
        res.status(500).json({ error: 'Failed to fetch goals data' });
    }
});

// ============================================
// RUN STATUS ENDPOINTS
// ============================================

/**
 * GET /summary/run-status/week?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Get run statuses for a date range (typically a week).
 * Cross-references the user's plan daily targets to detect run days
 * even if the app was never opened that day.
 * Auto-creates DailySummary for past run days that have no record (MISSED).
 * Returns: { statuses: { [dayKey]: { runStatus, runKmTarget, distanceKm } } }
 */
router.get('/run-status/week', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const from = req.query.from as string;
        const to = req.query.to as string;

        if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
            return res.status(400).json({ error: 'from and to query params must be YYYY-MM-DD' });
        }

        // Generate all dayKeys in range
        const dayKeys: string[] = [];
        const startDate = new Date(from + 'T00:00:00Z');
        const endDate = new Date(to + 'T00:00:00Z');
        for (let d = new Date(startDate); d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
            const y = d.getUTCFullYear();
            const m = String(d.getUTCMonth() + 1).padStart(2, '0');
            const day = String(d.getUTCDate()).padStart(2, '0');
            dayKeys.push(`${y}-${m}-${day}`);
        }

        // Fetch user's plan with weekly plans + daily targets
        const userPlan = await prisma.userPlan.findUnique({
            where: { userId },
            include: {
                weeklyPlans: {
                    orderBy: { week: 'asc' },
                    include: { dailyTargets: true }
                }
            }
        });

        const userTimezone = await getUserTimezone(userId);
        const todayKey = getDayKey(new Date(), userTimezone);

        // Fetch all existing summaries in range
        const summaries = await prisma.dailySummary.findMany({
            where: { userId, dayKey: { in: dayKeys } },
            select: { dayKey: true, runStatus: true, runKmTarget: true, distanceKm: true }
        });

        const summaryMap = new Map(summaries.map(s => [s.dayKey, s]));

        // Build a lookup: for each dayKey, what was the plan's daily target?
        // We need the plan start date to calculate which week each day falls in
        const planStartMonday = userPlan?.weekStartedAt
            ? getWeekStartMonday(new Date(userPlan.weekStartedAt))
            : null;

        // Helper: get the DailyTarget for a given dayKey from the plan
        function getPlannedTarget(dk: string) {
            if (!userPlan || !planStartMonday) return null;
            const [y, m, day] = dk.split('-').map(Number);
            const date = new Date(y, m - 1, day);
            const dayOfWeek = date.getDay();
            const adjustedDow = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 0=Mon..6=Sun

            // Calculate which week this day falls in
            const dateMonday = getWeekStartMonday(date);
            const weeksSinceStart = Math.max(0,
                Math.floor((dateMonday.getTime() - planStartMonday.getTime()) / (7 * 24 * 60 * 60 * 1000))
            );
            const weekNum = Math.min(1 + weeksSinceStart, userPlan.weeklyPlans?.length || 1);

            const weekPlan = userPlan.weeklyPlans?.find((w: any) => w.week === weekNum);
            if (!weekPlan) return null;

            return weekPlan.dailyTargets.find((dt: any) => dt.dayOfWeek === adjustedDow) || null;
        }

        // For each day in range, determine run status
        const toCreate: { dayKey: string; runKmTarget: number }[] = [];
        const toMarkMissed: string[] = [];

        for (const dk of dayKeys) {
            const existing = summaryMap.get(dk);
            const plannedTarget = getPlannedTarget(dk);
            const isRunDay = plannedTarget && (plannedTarget as any).dayType === 'RUN' && (plannedTarget as any).runKm > 0;
            const isPast = dk < todayKey;

            if (existing) {
                // Summary exists — auto-update status based on data
                if (isPast && existing.runStatus === 'PENDING' && existing.distanceKm === 0) {
                    toMarkMissed.push(dk);
                } else if (existing.runStatus === 'PENDING' && existing.runKmTarget > 0 && existing.distanceKm >= existing.runKmTarget) {
                    await prisma.dailySummary.update({
                        where: { userId_dayKey: { userId, dayKey: dk } },
                        data: { runStatus: 'COMPLETED' }
                    });
                    existing.runStatus = 'COMPLETED';
                } else if (isPast && existing.runStatus === 'PENDING' && existing.distanceKm > 0 && existing.distanceKm < existing.runKmTarget) {
                    await prisma.dailySummary.update({
                        where: { userId_dayKey: { userId, dayKey: dk } },
                        data: { runStatus: 'ATTEMPTED' }
                    });
                    existing.runStatus = 'ATTEMPTED';
                }
            } else if (isRunDay && isPast) {
                // No summary exists but this was a run day in the past → create as MISSED
                toCreate.push({ dayKey: dk, runKmTarget: (plannedTarget as any).runKm });
            }
        }

        // Batch update existing PENDING → MISSED
        if (toMarkMissed.length > 0) {
            await prisma.dailySummary.updateMany({
                where: { userId, dayKey: { in: toMarkMissed } },
                data: { runStatus: 'MISSED' }
            });
            for (const dk of toMarkMissed) {
                const s = summaryMap.get(dk);
                if (s) (s as any).runStatus = 'MISSED';
            }
        }

        // Create missing summaries for past run days
        for (const item of toCreate) {
            const restingCalories = Math.round((userPlan?.weightKg ?? 70) * 24);
            const plannedTarget = getPlannedTarget(item.dayKey);
            const created = await prisma.dailySummary.create({
                data: {
                    userId,
                    dayKey: item.dayKey,
                    timezone: userTimezone,
                    runKmTarget: item.runKmTarget,
                    runStatus: 'MISSED',
                    calorieTarget: (plannedTarget as any)?.calorieTarget || userPlan?.dailyCalorieTarget || 2000,
                    proteinTarget: (plannedTarget as any)?.proteinTarget || 100,
                    stepsTarget: (plannedTarget as any)?.stepsTarget || 8000,
                    restingCalories,
                }
            });
            summaryMap.set(item.dayKey, {
                dayKey: item.dayKey,
                runStatus: 'MISSED',
                runKmTarget: item.runKmTarget,
                distanceKm: 0,
            });
        }

        // Build response — also check the plan for days that have no summary and are not past
        const statuses: Record<string, { runStatus: string; runKmTarget: number; distanceKm: number }> = {};
        for (const dk of dayKeys) {
            const s = summaryMap.get(dk);
            if (s) {
                statuses[dk] = {
                    runStatus: s.runStatus ?? 'NOT_SCHEDULED',
                    runKmTarget: s.runKmTarget ?? 0,
                    distanceKm: s.distanceKm ?? 0,
                };
            } else {
                // No summary — check if plan says it's a run day (future/today)
                const plannedTarget = getPlannedTarget(dk);
                const isRunDay = plannedTarget && (plannedTarget as any).dayType === 'RUN' && (plannedTarget as any).runKm > 0;
                statuses[dk] = {
                    runStatus: isRunDay ? 'PENDING' : 'NOT_SCHEDULED',
                    runKmTarget: isRunDay ? (plannedTarget as any).runKm : 0,
                    distanceKm: 0,
                };
            }
        }

        res.json({ statuses });
    } catch (error) {
        console.error('Error fetching run statuses:', error);
        res.status(500).json({ error: 'Failed to fetch run statuses' });
    }
});

/**
 * PATCH /summary/run-status
 * Update the run status for a specific day.
 * Body: { dayKey: "YYYY-MM-DD", runStatus: "ATTEMPTED" | "COMPLETED" | "MISSED" | "PENDING" }
 */
router.patch('/run-status', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { dayKey, runStatus } = req.body;

        if (!dayKey || !runStatus) {
            return res.status(400).json({ error: 'dayKey and runStatus are required' });
        }

        const validStatuses = ['NOT_SCHEDULED', 'PENDING', 'ATTEMPTED', 'COMPLETED', 'MISSED'];
        if (!validStatuses.includes(runStatus)) {
            return res.status(400).json({ error: `runStatus must be one of: ${validStatuses.join(', ')}` });
        }

        const summary = await prisma.dailySummary.upsert({
            where: { userId_dayKey: { userId, dayKey } },
            update: { runStatus },
            create: { userId, dayKey, runStatus }
        });

        res.json(summary);
    } catch (error) {
        console.error('Error updating run status:', error);
        res.status(500).json({ error: 'Failed to update run status' });
    }
});

/**
 * GET /summary/nutrition-history
 * Get calorie consumption for the current calendar week (Monday to Sunday)
 */
router.get('/nutrition-history', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const userTimezone = await getUserTimezone(userId);

        // Anchor week calculation to the user's local "today" (timezone aware),
        // then iterate using YYYY-MM-DD keys to avoid server-timezone drift.
        const todayKey = getDayKey(new Date(), userTimezone);
        const weekStart = getWeekStartMondayFromDayKey(todayKey);
        const weekEndExclusive = new Date(weekStart);
        weekEndExclusive.setUTCDate(weekStart.getUTCDate() + 7);

        // Query a slightly wider window and bucket by timezone dayKey.
        const queryStart = new Date(weekStart);
        queryStart.setUTCDate(queryStart.getUTCDate() - 1);
        const queryEnd = new Date(weekEndExclusive);
        queryEnd.setUTCDate(queryEnd.getUTCDate() + 1);

        const meals = await prisma.mealLog.findMany({
            where: {
                userId,
                loggedAt: { gte: queryStart, lt: queryEnd }
            },
            select: { loggedAt: true, totalCalories: true }
        });

        const caloriesByDay = new Map<string, number>();
        for (const meal of meals) {
            const dayKey = getDayKey(new Date(meal.loggedAt), userTimezone);
            if (!caloriesByDay.has(dayKey)) caloriesByDay.set(dayKey, 0);
            caloriesByDay.set(dayKey, (caloriesByDay.get(dayKey) || 0) + (meal.totalCalories || 0));
        }

        const history: { day: string; calories: number }[] = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(weekStart);
            date.setUTCDate(weekStart.getUTCDate() + i);
            const dayKey = formatDayKeyUTC(date);

            history.push({
                day: dayKey,
                calories: caloriesByDay.get(dayKey) ?? 0
            });
        }
        
        res.json(history);
    } catch (error) {
        console.error('Error fetching nutrition history:', error);
        res.status(500).json({ error: 'Failed to fetch nutrition history' });
    }
});

// ============================================
// PARAMETERIZED ROUTE LAST
// ============================================

/**
 * GET /summary/:dayKey
 * Get daily summary for a specific date
 */
router.get('/:dayKey', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { dayKey } = req.params;

        const summary = await prisma.dailySummary.findUnique({
            where: { userId_dayKey: { userId, dayKey } }
        });

        if (!summary) {
            return res.status(404).json({ error: 'No summary found for this date' });
        }

        res.json(summary);
    } catch (error) {
        console.error('Error fetching summary:', error);
        res.status(500).json({ error: 'Failed to fetch summary' });
    }
});

export default router;
