// src/routes/runtogether.routes.ts
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
const SCHEDULE_RUN_HISTORY_CUTOFF_MS = 2 * 60 * 60 * 1000;

async function expireStaleScheduledRunsForUser(userId: string) {
    const cutoff = new Date(Date.now() - SCHEDULE_RUN_HISTORY_CUTOFF_MS);
    await prisma.runTogether.updateMany({
        where: {
            status: { in: ['PENDING', 'ACCEPTED'] },
            scheduledTime: { lt: cutoff },
            OR: [{ fromUserId: userId }, { toUserId: userId }],
        },
        data: { status: 'EXPIRED' },
    });
    return cutoff;
}

// All routes require authentication
router.use(authMiddleware);

/**
 * POST /runtogether/schedule
 * Create a scheduled run invite for your partner
 */
const ScheduleSchema = z.object({
    scheduledTime: z.string().transform((str) => new Date(str)),
    distanceKm: z.number().positive(),
});

router.post('/schedule', async (req, res, next) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        console.log('[runtogether/schedule] incoming', {
            userId,
            body: req.body,
        });
        const { scheduledTime, distanceKm } = ScheduleSchema.parse(req.body);

        // Get user and check they have a partner
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { partnerId: true, displayName: true },
        });

        if (!user?.partnerId) {
            return res.status(400).json({ error: 'You must have a partner to schedule a run' });
        }

        // Create the scheduled run
        const scheduledRun = await prisma.runTogether.create({
            data: {
                fromUserId: userId,
                toUserId: user.partnerId,
                scheduledTime,
                distanceKm,
                status: 'PENDING',
            },
            include: {
                toUser: { select: { displayName: true } },
            },
        });

        console.log('[runtogether/schedule] created', {
            id: scheduledRun.id,
            scheduledTime: scheduledRun.scheduledTime,
            distanceKm: scheduledRun.distanceKm,
            toUserId: scheduledRun.toUserId,
        });

        res.json({
            success: true,
            scheduledRun: {
                id: scheduledRun.id,
                scheduledTime: scheduledRun.scheduledTime,
                distanceKm: scheduledRun.distanceKm,
                status: scheduledRun.status,
                partnerName: scheduledRun.toUser.displayName,
                createdAt: scheduledRun.createdAt,
            },
        });
    } catch (err) {
        console.error('[runtogether/schedule] error', err);
        next(err);
    }
});

/**
 * GET /runtogether/pending
 * Get pending scheduled runs received by current user
 */
router.get('/pending', async (req, res, next) => {
    try {
        const userId = (req as AuthRequest).user!.id;

        const pendingRuns = await prisma.runTogether.findMany({
            where: {
                toUserId: userId,
                status: 'PENDING',
            },
            include: {
                fromUser: { select: { displayName: true } },
            },
            orderBy: { scheduledTime: 'asc' },
        });

        res.json({
            runs: pendingRuns.map((run) => ({
                id: run.id,
                fromName: run.fromUser.displayName,
                scheduledTime: run.scheduledTime,
                distanceKm: run.distanceKm,
                status: run.status,
                createdAt: run.createdAt,
            })),
        });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /runtogether/sent
 * Get scheduled runs sent by current user
 */
router.get('/sent', async (req, res, next) => {
    try {
        const userId = (req as AuthRequest).user!.id;

        const sentRuns = await prisma.runTogether.findMany({
            where: {
                fromUserId: userId,
            },
            include: {
                toUser: { select: { displayName: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        res.json({
            runs: sentRuns.map((run) => ({
                id: run.id,
                toName: run.toUser.displayName,
                scheduledTime: run.scheduledTime,
                distanceKm: run.distanceKm,
                status: run.status,
                createdAt: run.createdAt,
            })),
        });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /runtogether/active
 * Get all active (pending or accepted) scheduled runs for both sent and received
 */
router.get('/active', async (req, res, next) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        await expireStaleScheduledRunsForUser(userId);

        const [sentRuns, receivedRuns] = await Promise.all([
            prisma.runTogether.findMany({
                where: {
                    fromUserId: userId,
                    status: { in: ['PENDING', 'ACCEPTED'] },
                },
                include: {
                    toUser: { select: { displayName: true } },
                },
                orderBy: { scheduledTime: 'asc' },
            }),
            prisma.runTogether.findMany({
                where: {
                    toUserId: userId,
                    status: { in: ['PENDING', 'ACCEPTED'] },
                },
                include: {
                    fromUser: { select: { displayName: true } },
                },
                orderBy: { scheduledTime: 'asc' },
            }),
        ]);

        res.json({
            sent: sentRuns.map((run) => ({
                id: run.id,
                partnerName: run.toUser.displayName,
                scheduledTime: run.scheduledTime,
                distanceKm: run.distanceKm,
                status: run.status,
                isSender: true,
            })),
            received: receivedRuns.map((run) => ({
                id: run.id,
                partnerName: run.fromUser.displayName,
                scheduledTime: run.scheduledTime,
                distanceKm: run.distanceKm,
                status: run.status,
                isSender: false,
            })),
        });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /runtogether/:id/accept
 * Accept a scheduled run
 */
router.post('/:id/accept', async (req, res, next) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const runId = req.params.id;

        const run = await prisma.runTogether.findUnique({
            where: { id: runId },
            include: { fromUser: { select: { displayName: true } } },
        });

        if (!run) {
            return res.status(404).json({ error: 'Scheduled run not found' });
        }

        if (run.toUserId !== userId) {
            return res.status(403).json({ error: 'You can only accept runs sent to you' });
        }

        if (run.status !== 'PENDING') {
            return res.status(400).json({ error: 'This run has already been responded to' });
        }

        const updatedRun = await prisma.runTogether.update({
            where: { id: runId },
            data: { status: 'ACCEPTED' },
        });

        res.json({
            success: true,
            run: {
                id: updatedRun.id,
                scheduledTime: updatedRun.scheduledTime,
                distanceKm: updatedRun.distanceKm,
                status: updatedRun.status,
                partnerName: run.fromUser.displayName,
            },
        });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /runtogether/:id/decline
 * Decline a scheduled run
 */
router.post('/:id/decline', async (req, res, next) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const runId = req.params.id;

        const run = await prisma.runTogether.findUnique({
            where: { id: runId },
        });

        if (!run) {
            return res.status(404).json({ error: 'Scheduled run not found' });
        }

        if (run.toUserId !== userId) {
            return res.status(403).json({ error: 'You can only decline runs sent to you' });
        }

        if (run.status !== 'PENDING') {
            return res.status(400).json({ error: 'This run has already been responded to' });
        }

        await prisma.runTogether.update({
            where: { id: runId },
            data: { status: 'DECLINED' },
        });

        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /runtogether/history
 * Returns expired/declined scheduled runs and completed race results + win stats
 */
router.get('/history', async (req, res, next) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        await expireStaleScheduledRunsForUser(userId);

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                displayName: true,
                partnerId: true,
                partner: { select: { id: true, displayName: true } },
            },
        });

        const [sentHistory, receivedHistory, raceResults] = await Promise.all([
            prisma.runTogether.findMany({
                where: {
                    fromUserId: userId,
                    status: { in: ['DECLINED', 'EXPIRED'] },
                },
                include: { toUser: { select: { displayName: true } } },
                orderBy: { scheduledTime: 'desc' },
                take: 50,
            }),
            prisma.runTogether.findMany({
                where: {
                    toUserId: userId,
                    status: { in: ['DECLINED', 'EXPIRED'] },
                },
                include: { fromUser: { select: { displayName: true } } },
                orderBy: { scheduledTime: 'desc' },
                take: 50,
            }),
            prisma.raceResult.findMany({
                where: {
                    OR: [{ userAId: userId }, { userBId: userId }],
                },
                include: {
                    userA: { select: { id: true, displayName: true } },
                    userB: { select: { id: true, displayName: true } },
                    winnerUser: { select: { id: true, displayName: true } },
                },
                orderBy: { finishedAt: 'desc' },
                take: 100,
            }),
        ]);

        const scheduled = [
            ...sentHistory.map((run) => ({
                id: run.id,
                partnerName: run.toUser.displayName,
                scheduledTime: run.scheduledTime,
                distanceKm: run.distanceKm,
                status: run.status,
                isSender: true,
                createdAt: run.createdAt,
                updatedAt: run.updatedAt,
            })),
            ...receivedHistory.map((run) => ({
                id: run.id,
                partnerName: run.fromUser.displayName,
                scheduledTime: run.scheduledTime,
                distanceKm: run.distanceKm,
                status: run.status,
                isSender: false,
                createdAt: run.createdAt,
                updatedAt: run.updatedAt,
            })),
        ].sort((a, b) => new Date(b.scheduledTime).getTime() - new Date(a.scheduledTime).getTime());

        const races = raceResults.map((r) => {
            const opponent = r.userAId === userId ? r.userB : r.userA;
            return {
                id: r.id,
                finishedAt: r.finishedAt,
                distanceKm: r.distanceKm,
                durationMs: r.durationMs,
                winnerUserId: r.winnerUserId,
                winnerName: r.winnerName || r.winnerUser.displayName,
                didYouWin: r.winnerUserId === userId,
                opponent: {
                    id: opponent.id,
                    displayName: opponent.displayName,
                },
            };
        });

        const partnerId = user?.partnerId || null;
        const pairRaces = partnerId
            ? raceResults.filter((r) =>
                (r.userAId === userId && r.userBId === partnerId) ||
                (r.userAId === partnerId && r.userBId === userId)
            )
            : raceResults;

        const stats = {
            totalRaces: pairRaces.length,
            youWins: pairRaces.filter((r) => r.winnerUserId === userId).length,
            partnerWins: partnerId ? pairRaces.filter((r) => r.winnerUserId === partnerId).length : 0,
            youName: user?.displayName ?? 'You',
            partnerName: user?.partner?.displayName ?? 'Partner',
        };

        res.json({ stats, races, scheduled });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /runtogether/:id/cancel
 * Cancel a scheduled run (sender only)
 */
router.post('/:id/cancel', async (req, res, next) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const runId = req.params.id;

        const run = await prisma.runTogether.findUnique({
            where: { id: runId },
        });

        if (!run) {
            return res.status(404).json({ error: 'Scheduled run not found' });
        }

        if (run.fromUserId !== userId) {
            return res.status(403).json({ error: 'You can only cancel runs you created' });
        }

        if (run.status === 'DECLINED') {
            return res.status(400).json({ error: 'This run has already been cancelled' });
        }

        await prisma.runTogether.update({
            where: { id: runId },
            data: { status: 'DECLINED' },
        });

        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

export default router;
