// src/routes/points.routes.ts
// Routes for user points management

import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { requireStringParam } from '../utils/params';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /points
 * Get current user's point balance
 */
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;

        // Find or create points record
        let userPoints = await prisma.userPoints.findUnique({
            where: { userId }
        });

        if (!userPoints) {
            // Initialize with 0 points for new users
            userPoints = await prisma.userPoints.create({
                data: {
                    userId,
                    balance: 0
                }
            });
        }

        res.json({ balance: userPoints.balance });
    } catch (error) {
        console.error('Error fetching points:', error);
        res.status(500).json({ error: 'Failed to fetch points' });
    }
});

/**
 * POST /points/spend
 * Deduct points for marketplace purchases
 * Body: { amount: number, item?: string }
 */
router.post('/spend', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { amount, item } = req.body;

        if (!amount || typeof amount !== 'number' || amount <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }

        // Get current balance
        let userPoints = await prisma.userPoints.findUnique({
            where: { userId }
        });

        if (!userPoints) {
            userPoints = await prisma.userPoints.create({
                data: { userId, balance: 0 }
            });
        }

        if (userPoints.balance < amount) {
            return res.status(400).json({
                error: 'Insufficient points',
                balance: userPoints.balance,
                required: amount
            });
        }

        // Deduct points
        const updated = await prisma.userPoints.update({
            where: { userId },
            data: { balance: userPoints.balance - amount }
        });

        console.log(`[Points] User ${userId} spent ${amount} on ${item || 'unknown item'}. New balance: ${updated.balance}`);

        res.json({
            success: true,
            balance: updated.balance,
            spent: amount,
            item: item || null
        });
    } catch (error) {
        console.error('Error spending points:', error);
        res.status(500).json({ error: 'Failed to spend points' });
    }
});

/**
 * POST /points/earn
 * Add points for completing activities
 * Body: { amount: number, reason?: string }
 */
router.post('/earn', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { amount, reason } = req.body;

        if (!amount || typeof amount !== 'number' || amount <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }

        // Upsert points record
        const updated = await prisma.userPoints.upsert({
            where: { userId },
            create: { userId, balance: amount },
            update: { balance: { increment: amount } }
        });

        console.log(`[Points] User ${userId} earned ${amount} for ${reason || 'activity'}. New balance: ${updated.balance}`);

        res.json({
            success: true,
            balance: updated.balance,
            earned: amount,
            reason: reason || null
        });
    } catch (error) {
        console.error('Error earning points:', error);
        res.status(500).json({ error: 'Failed to earn points' });
    }
});

/**
 * POST /points/earn-daily
 * Award points for a specific category on a specific day (idempotent - prevents duplicates)
 * Body: { dayKey: string, category: string, earnedPoints: number, maxPoints: number, progress: number }
 */
router.post('/earn-daily', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { dayKey, category, earnedPoints, maxPoints, progress } = req.body;

        // Validate required fields
        if (!dayKey || !category || typeof earnedPoints !== 'number') {
            return res.status(400).json({ error: 'Missing required fields: dayKey, category, earnedPoints' });
        }

        // Valid categories
        const validCategories = ['WALK_RUN', 'STEPS', 'CALORIES', 'MOBILITY', 'HYDRATION'];
        if (!validCategories.includes(category)) {
            return res.status(400).json({ error: `Invalid category. Must be one of: ${validCategories.join(', ')}` });
        }

        // Check if already awarded for this day + category
        const existing = await prisma.dailyPointsLedger.findUnique({
            where: {
                userId_dayKey_category: { userId, dayKey, category }
            }
        });

        if (existing) {
            // Already awarded - return existing without adding more points
            const userPoints = await prisma.userPoints.findUnique({ where: { userId } });
            console.log(`[Points] User ${userId} already earned ${existing.earnedPoints} for ${category} on ${dayKey}. No duplicate award.`);

            return res.json({
                alreadyAwarded: true,
                earnedPoints: existing.earnedPoints,
                maxPoints: existing.maxPoints,
                progress: existing.progress,
                balance: userPoints?.balance || 0
            });
        }

        // Award points atomically using transaction
        const [ledgerEntry, updatedPoints] = await prisma.$transaction([
            prisma.dailyPointsLedger.create({
                data: {
                    userId,
                    dayKey,
                    category,
                    earnedPoints,
                    maxPoints: maxPoints || earnedPoints,
                    progress: progress || 1.0
                }
            }),
            prisma.userPoints.upsert({
                where: { userId },
                create: { userId, balance: earnedPoints },
                update: { balance: { increment: earnedPoints } }
            })
        ]);

        console.log(`[Points] User ${userId} earned ${earnedPoints} for ${category} on ${dayKey}. New balance: ${updatedPoints.balance}`);

        res.json({
            success: true,
            alreadyAwarded: false,
            earnedPoints: ledgerEntry.earnedPoints,
            maxPoints: ledgerEntry.maxPoints,
            progress: ledgerEntry.progress,
            balance: updatedPoints.balance
        });
    } catch (error) {
        console.error('Error earning daily points:', error);
        res.status(500).json({ error: 'Failed to earn daily points' });
    }
});

/**
 * GET /points/daily/:dayKey
 * Get all points earned for a specific day
 */
router.get('/daily/:dayKey', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const dayKey = requireStringParam(req.params.dayKey, 'dayKey');

        const entries = await prisma.dailyPointsLedger.findMany({
            where: { userId, dayKey },
            orderBy: { awardedAt: 'asc' }
        });

        // Calculate total points earned this day
        const totalEarned = entries.reduce((sum: number, entry) => sum + entry.earnedPoints, 0);
        const totalMax = entries.reduce((sum: number, entry) => sum + entry.maxPoints, 0);

        res.json({
            dayKey,
            entries,
            totalEarned,
            totalMax,
            categoriesAwarded: entries.map(e => e.category)
        });
    } catch (error) {
        console.error('Error fetching daily points:', error);
        res.status(500).json({ error: 'Failed to fetch daily points' });
    }
});

export default router;
