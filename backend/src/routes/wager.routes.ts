// src/routes/wager.routes.ts
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// --- Helpers ---

function parseDayKey(dayKey: string): { year: number; month: number; day: number } {
    const [year, month, day] = dayKey.split('-').map(Number);
    return { year, month, day };
}

function dayKeyToUtcDate(dayKey: string): Date {
    const { year, month, day } = parseDayKey(dayKey);
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

function utcDateToDayKey(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function dayKeyInTimezone(date: Date, timezone: string): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);

    const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
    const month = parts.find((part) => part.type === 'month')?.value ?? '01';
    const day = parts.find((part) => part.type === 'day')?.value ?? '01';
    return `${year}-${month}-${day}`;
}

function addDaysToDayKey(dayKey: string, delta: number): string {
    const date = dayKeyToUtcDate(dayKey);
    date.setUTCDate(date.getUTCDate() + delta);
    return utcDateToDayKey(date);
}

function getWeekStartMondayDayKey(dayKey: string): string {
    const date = dayKeyToUtcDate(dayKey);
    const dayOfWeek = date.getUTCDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    date.setUTCDate(date.getUTCDate() + mondayOffset);
    return utcDateToDayKey(date);
}

function offsetMinutesForTimezone(date: Date, timezone: string): number {
    try {
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            timeZoneName: 'shortOffset',
            hour: '2-digit',
        }).formatToParts(date);

        const offsetPart = parts.find((part) => part.type === 'timeZoneName')?.value ?? 'GMT+0';
        const match = offsetPart.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
        if (!match) return 0;

        const sign = match[1] === '-' ? -1 : 1;
        const hours = Number(match[2] || 0);
        const minutes = Number(match[3] || 0);
        return sign * (hours * 60 + minutes);
    } catch {
        return 0;
    }
}

function getLocalMidnightUtc(dayKey: string, timezone: string): Date {
    const { year, month, day } = parseDayKey(dayKey);
    const baseUtc = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    const offsetMinutes = offsetMinutesForTimezone(baseUtc, timezone);
    return new Date(baseUtc.getTime() - offsetMinutes * 60_000);
}

function getNextMidnightUtc(timezone: string, now: Date): Date {
    const todayKey = dayKeyInTimezone(now, timezone);
    const tomorrowKey = addDaysToDayKey(todayKey, 1);
    return getLocalMidnightUtc(tomorrowKey, timezone);
}

function getLaterEndingTimezone(timezoneA?: string | null, timezoneB?: string | null, now: Date = new Date()): string {
    const left = timezoneA || 'UTC';
    const right = timezoneB || 'UTC';
    const leftDayEnd = getNextMidnightUtc(left, now).getTime();
    const rightDayEnd = getNextMidnightUtc(right, now).getTime();
    return leftDayEnd >= rightDayEnd ? left : right;
}

function getCurrentWeekBounds(timezoneA?: string | null, timezoneB?: string | null, now: Date = new Date()): { weekStart: Date; weekEnd: Date; timezone: string } {
    const timezone = getLaterEndingTimezone(timezoneA, timezoneB, now);
    const todayKey = dayKeyInTimezone(now, timezone);
    const weekStartKey = getWeekStartMondayDayKey(todayKey);
    const nextWeekStartKey = addDaysToDayKey(weekStartKey, 7);
    const weekStart = getLocalMidnightUtc(weekStartKey, timezone);
    const weekEnd = new Date(getLocalMidnightUtc(nextWeekStartKey, timezone).getTime() - 1);

    return { weekStart, weekEnd, timezone };
}

function getEffectiveWagerBounds(
    wager: any,
    fallbackTimezoneA?: string | null,
    fallbackTimezoneB?: string | null
): { weekStart: Date; weekEnd: Date; timezone: string } {
    return getCurrentWeekBounds(
        wager.fromUser?.timezone ?? fallbackTimezoneA,
        wager.toUser?.timezone ?? fallbackTimezoneB,
        new Date(wager.createdAt ?? wager.weekStart ?? wager.weekEnd ?? new Date())
    );
}

function isWagerCurrent(
    wager: any,
    now: Date,
    fallbackTimezoneA?: string | null,
    fallbackTimezoneB?: string | null
): boolean {
    if (!['PENDING', 'ACTIVE'].includes(wager.status)) return false;

    const effective = getEffectiveWagerBounds(wager, fallbackTimezoneA, fallbackTimezoneB);
    return effective.weekStart.getTime() <= now.getTime() && effective.weekEnd.getTime() >= now.getTime();
}

function compareWagersByEffectiveEnd(
    left: any,
    right: any,
    fallbackTimezoneA?: string | null,
    fallbackTimezoneB?: string | null
): number {
    const leftBounds = getEffectiveWagerBounds(left, fallbackTimezoneA, fallbackTimezoneB);
    const rightBounds = getEffectiveWagerBounds(right, fallbackTimezoneA, fallbackTimezoneB);
    const byEnd = rightBounds.weekEnd.getTime() - leftBounds.weekEnd.getTime();
    if (byEnd !== 0) return byEnd;
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
}

function getWeekDayKeysForRange(weekStart: Date, weekEnd: Date, timezone: string): string[] {
    const startDayKey = dayKeyInTimezone(weekStart, timezone);
    const endDayKey = dayKeyInTimezone(weekEnd, timezone);
    const dayKeys: string[] = [];
    let cursor = startDayKey;

    while (cursor <= endDayKey) {
        dayKeys.push(cursor);
        cursor = addDaysToDayKey(cursor, 1);
    }

    return dayKeys;
}

function getPlanWeekNumber(userPlan: any, targetWeekStart?: Date, timezone: string = 'UTC') {
    const currentWeek = userPlan?.currentWeek ?? 1;
    if (!targetWeekStart || !userPlan?.weekStartedAt) return currentWeek;

    const currentWeekStartDayKey = getWeekStartMondayDayKey(dayKeyInTimezone(new Date(userPlan.weekStartedAt), timezone));
    const desiredWeekStartDayKey = getWeekStartMondayDayKey(dayKeyInTimezone(targetWeekStart, timezone));
    const currentWeekStart = dayKeyToUtcDate(currentWeekStartDayKey);
    const desiredWeekStart = dayKeyToUtcDate(desiredWeekStartDayKey);
    const diffWeeks = Math.round((desiredWeekStart.getTime() - currentWeekStart.getTime()) / (1000 * 60 * 60 * 24 * 7));

    return Math.max(1, currentWeek + diffWeeks);
}

async function getWeeklyRunProgress(userId: string, weekStart: Date, weekEnd: Date, timezone: string) {
    const dayKeys = getWeekDayKeysForRange(weekStart, weekEnd, timezone);
    const [summaries, userPlan] = await Promise.all([
        prisma.dailySummary.findMany({
            where: {
                userId,
                dayKey: { in: dayKeys },
            },
            select: {
                distanceKm: true,
            },
        }),
        prisma.userPlan.findUnique({
            where: { userId },
            include: {
                weeklyPlans: {
                    orderBy: { week: 'asc' },
                },
            },
        }),
    ]);

    const totalDistanceKm = summaries.reduce((sum, summary) => sum + (summary.distanceKm ?? 0), 0);
    const targetWeek = getPlanWeekNumber(userPlan, weekStart, timezone);
    const fallbackWeek = userPlan?.currentWeek ?? 1;
    const targetWeekPlan =
        userPlan?.weeklyPlans?.find((weekPlan) => weekPlan.week === targetWeek) ??
        userPlan?.weeklyPlans?.find((weekPlan) => weekPlan.week === fallbackWeek) ??
        null;
    const weeklyKmTarget = targetWeekPlan?.runKmPerWeek ?? 35;
    const remainingKm = Math.max(0, weeklyKmTarget - totalDistanceKm);
    const progressPercent = weeklyKmTarget > 0 ? Math.min(100, Math.round((totalDistanceKm / weeklyKmTarget) * 100)) : 0;

    return {
        totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
        weeklyKmTarget,
        remainingKm: Math.round(remainingKm * 10) / 10,
        progressPercent,
        completed: totalDistanceKm >= weeklyKmTarget,
    };
}

function buildWagerLeader(partnerName: string, yourWeek: any, partnerWeek: any, options?: { settled?: boolean; pending?: boolean }) {
    const settled = options?.settled ?? false;
    const pending = options?.pending ?? false;

    let winner: 'YOU' | 'PARTNER' | 'TIE' = 'TIE';
    let loser: 'YOU' | 'PARTNER' | 'BOTH' | 'NONE' = 'NONE';
    let statusLabel = settled ? 'Nobody lost' : 'No loser yet';

    if (pending) {
        statusLabel = 'Waiting for wager acceptance';
    } else if (yourWeek.completed && !partnerWeek.completed) {
        winner = 'YOU';
        loser = 'PARTNER';
        statusLabel = `${partnerName} loses`;
    } else if (!yourWeek.completed && partnerWeek.completed) {
        winner = 'PARTNER';
        loser = 'YOU';
        statusLabel = 'You lose';
    } else if (yourWeek.completed && partnerWeek.completed) {
        statusLabel = settled ? 'Nobody lost' : 'Both completed the goal';
    } else if (settled) {
        loser = 'BOTH';
        statusLabel = 'Both lost';
    }

    return {
        winner,
        loser,
        statusLabel,
        partnerName,
        yourWeek,
        partnerWeek: {
            ...partnerWeek,
            partnerName,
        },
    };
}

function serializeWager(wager: any, userId: string) {
    const isSender = wager.fromUserId === userId;
    const effective = getEffectiveWagerBounds(wager);
    return {
        id: wager.id,
        title: wager.title,
        status: wager.status,
        weekStart: effective.weekStart,
        weekEnd: effective.weekEnd,
        weekTimezone: effective.timezone,
        partnerName: isSender ? wager.toUser.displayName : wager.fromUser.displayName,
        isSender,
        createdAt: wager.createdAt,
    };
}

// --- Schemas ---

const CreateWagerSchema = z.object({
    title: z.string().min(1).max(100),
});

/**
 * POST /wager/create
 * Create a new wager for the current week → sends to partner as PENDING
 */
router.post('/create', async (req, res, next) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const { title } = CreateWagerSchema.parse(req.body);

        // Get user and check partner
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                partnerId: true,
                displayName: true,
                timezone: true,
                partner: {
                    select: {
                        timezone: true,
                    },
                },
            },
        });

        if (!user?.partnerId) {
            return res.status(400).json({ error: 'You must have a partner to create a wager' });
        }

        const { weekStart, weekEnd } = getCurrentWeekBounds(user.timezone, user.partner?.timezone);

        // Check if there's already an active or pending wager this week between these partners
        const existingWagers = await prisma.wager.findMany({
            where: {
                OR: [
                    { fromUserId: userId, toUserId: user.partnerId },
                    { fromUserId: user.partnerId, toUserId: userId },
                ],
                status: { in: ['PENDING', 'ACTIVE'] },
            },
            include: {
                fromUser: { select: { timezone: true } },
                toUser: { select: { timezone: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 20,
        });

        const existingWager = existingWagers.find((candidate) => {
            const effective = getEffectiveWagerBounds(candidate, user.timezone, user.partner?.timezone);
            return effective.weekStart.getTime() <= weekEnd.getTime() && effective.weekEnd.getTime() >= weekStart.getTime();
        });

        if (existingWager) {
            return res.status(400).json({ error: 'A wager already exists for this week' });
        }

        const wager = await prisma.wager.create({
            data: {
                fromUserId: userId,
                toUserId: user.partnerId,
                title,
                status: 'PENDING',
                weekStart,
                weekEnd,
            },
            include: {
                toUser: { select: { displayName: true, timezone: true } },
            },
        });

        res.json({
            success: true,
            wager: {
                id: wager.id,
                title: wager.title,
                status: wager.status,
                weekStart,
                weekEnd,
                weekTimezone: getLaterEndingTimezone(user.timezone, user.partner?.timezone, wager.createdAt),
                partnerName: wager.toUser.displayName,
                isSender: true,
                createdAt: wager.createdAt,
            },
        });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /wager/active
 * Get the current week's active or pending wager for this user
 */
router.get('/active', async (req, res, next) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const now = new Date();

        const wagers = await prisma.wager.findMany({
            where: {
                OR: [
                    { fromUserId: userId },
                    { toUserId: userId },
                ],
                status: { in: ['PENDING', 'ACTIVE'] },
            },
            include: {
                fromUser: { select: { displayName: true, timezone: true } },
                toUser: { select: { displayName: true, timezone: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 20,
        });

        const wager = wagers.find((candidate) => isWagerCurrent(candidate, now));

        if (!wager) {
            return res.json({ wager: null });
        }

        res.json({
            wager: serializeWager(wager, userId),
        });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /wager/overview
 * Returns the current wager, the previous week's/latest wager, and current weekly run-goal wager status.
 */
router.get('/overview', async (req, res, next) => {
    try {
        const userId = (req as AuthRequest).user!.id;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                timezone: true,
                partnerId: true,
                partner: {
                    select: {
                        id: true,
                        displayName: true,
                        timezone: true,
                    }
                }
            }
        });

        if (!user?.partnerId || !user.partner) {
            return res.json({
                currentWager: null,
                lastWager: null,
                currentLeader: null,
                lastOutcome: null,
            });
        }

        const partner = user.partner;
        const now = new Date();
        const { weekStart, weekEnd } = getCurrentWeekBounds(user.timezone, partner.timezone, now);
        const pairWhere = {
            OR: [
                { fromUserId: userId, toUserId: user.partnerId },
                { fromUserId: user.partnerId, toUserId: userId },
            ],
        };

        const wagers = await prisma.wager.findMany({
            where: pairWhere,
            include: {
                fromUser: { select: { displayName: true, timezone: true } },
                toUser: { select: { displayName: true, timezone: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 20,
        });

        const currentWager = wagers.find((candidate) => isWagerCurrent(candidate, now, user.timezone, partner.timezone)) ?? null;
        const lastWager = wagers
            .filter((candidate) => {
                const effective = getEffectiveWagerBounds(candidate, user.timezone, partner.timezone);
                return effective.weekEnd.getTime() < now.getTime() && !['PENDING', 'DECLINED'].includes(candidate.status);
            })
            .sort((left, right) => compareWagersByEffectiveEnd(left, right, user.timezone, partner.timezone))[0] ?? null;

        const activeEffectiveBounds = currentWager
            ? getEffectiveWagerBounds(currentWager, user.timezone, partner.timezone)
            : { weekStart, weekEnd, timezone: getLaterEndingTimezone(user.timezone, partner.timezone, now) };

        const [yourWeek, partnerWeek] = await Promise.all([
            getWeeklyRunProgress(userId, activeEffectiveBounds.weekStart, activeEffectiveBounds.weekEnd, user.timezone || 'UTC'),
            getWeeklyRunProgress(user.partnerId, activeEffectiveBounds.weekStart, activeEffectiveBounds.weekEnd, partner.timezone || 'UTC'),
        ]);

        let currentLeader = null;

        if (currentWager?.status === 'ACTIVE') {
            currentLeader = buildWagerLeader(user.partner.displayName, yourWeek, partnerWeek);
        } else if (currentWager?.status === 'PENDING') {
            currentLeader = buildWagerLeader(user.partner.displayName, yourWeek, partnerWeek, { pending: true });
        } else {
            currentLeader = {
                winner: 'TIE' as const,
                loser: 'NONE' as const,
                statusLabel: 'No active wager',
                partnerName: user.partner.displayName,
                yourWeek,
                partnerWeek: {
                    ...partnerWeek,
                    partnerName: user.partner.displayName,
                },
            };
        }

        let lastOutcome = null;

        if (lastWager) {
            const lastEffectiveBounds = getEffectiveWagerBounds(lastWager, user.timezone, user.partner.timezone);
            const [yourLastWeek, partnerLastWeek] = await Promise.all([
                getWeeklyRunProgress(userId, lastEffectiveBounds.weekStart, lastEffectiveBounds.weekEnd, user.timezone || 'UTC'),
                getWeeklyRunProgress(user.partnerId, lastEffectiveBounds.weekStart, lastEffectiveBounds.weekEnd, user.partner.timezone || 'UTC'),
            ]);

            lastOutcome = buildWagerLeader(user.partner.displayName, yourLastWeek, partnerLastWeek, { settled: true });
        }

        res.json({
            currentWager: currentWager ? serializeWager(currentWager, userId) : null,
            lastWager: lastWager ? serializeWager(lastWager, userId) : null,
            currentLeader,
            lastOutcome,
        });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /wager/:id/accept
 * Accept a pending wager → becomes ACTIVE
 */
router.post('/:id/accept', async (req, res, next) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const wagerId = req.params.id;

        const wager = await prisma.wager.findUnique({
            where: { id: wagerId },
            include: {
                fromUser: { select: { displayName: true, timezone: true } },
                toUser: { select: { timezone: true } },
            },
        });

        if (!wager) {
            return res.status(404).json({ error: 'Wager not found' });
        }

        if (wager.toUserId !== userId) {
            return res.status(403).json({ error: 'You can only accept wagers sent to you' });
        }

        if (wager.status !== 'PENDING') {
            return res.status(400).json({ error: 'This wager has already been responded to' });
        }

        const updatedWager = await prisma.wager.update({
            where: { id: wagerId },
            data: { status: 'ACTIVE' },
        });

        res.json({
            success: true,
            wager: serializeWager({
                ...updatedWager,
                fromUser: wager.fromUser,
                toUser: wager.toUser,
            }, userId),
        });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /wager/:id/decline
 * Decline a pending wager
 */
router.post('/:id/decline', async (req, res, next) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const wagerId = req.params.id;

        const wager = await prisma.wager.findUnique({
            where: { id: wagerId },
        });

        if (!wager) {
            return res.status(404).json({ error: 'Wager not found' });
        }

        if (wager.toUserId !== userId) {
            return res.status(403).json({ error: 'You can only decline wagers sent to you' });
        }

        if (wager.status !== 'PENDING') {
            return res.status(400).json({ error: 'This wager has already been responded to' });
        }

        await prisma.wager.update({
            where: { id: wagerId },
            data: { status: 'DECLINED' },
        });

        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

/**
 * DELETE /wager/:id
 * Remove/Cancel a wager (only by the sender if pending, or if active)
 */
router.delete('/:id', async (req, res, next) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const wagerId = req.params.id;

        const wager = await prisma.wager.findUnique({
            where: { id: wagerId },
        });

        if (!wager) {
            return res.status(404).json({ error: 'Wager not found' });
        }

        // Only allow sender or receiver to delete
        if (wager.fromUserId !== userId && wager.toUserId !== userId) {
            return res.status(403).json({ error: 'Unauthorized to delete this wager' });
        }

        await prisma.wager.delete({
            where: { id: wagerId },
        });

        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

export default router;
