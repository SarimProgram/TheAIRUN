import { Router } from 'express';
import { prisma } from '../db/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

function dayKeyLocal(d = new Date()): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

// GET /hydration/today
// Returns today's water intake and target
router.get('/today', authMiddleware, async (req, res, next) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const dayKeyParam = req.query.dayKey as string | undefined;

        const dayKey = dayKeyParam && /^\d{4}-\d{2}-\d{2}$/.test(dayKeyParam)
            ? dayKeyParam
            : dayKeyLocal();

        const summary = await prisma.dailySummary.findUnique({
            where: { userId_dayKey: { userId, dayKey } },
            select: { waterMl: true, waterTarget: true },
        });

        res.json({
            dayKey,
            waterMl: summary?.waterMl ?? 0,
            waterTarget: summary?.waterTarget ?? 2000,
        });
    } catch (err) {
        next(err);
    }
});

// POST /hydration/log
// body: { amountMl: number, dayKey?: string, eventId: string }
router.post('/log', authMiddleware, async (req, res, next) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const { amountMl, dayKey: dayKeyParam, eventId } = req.body;

        const amount = Number(amountMl) || 250; // Default to 250ml (1 glass)
        if (amount <= 0) {
            return res.status(400).json({ error: 'amountMl must be > 0' });
        }

        const dayKey = dayKeyParam && /^\d{4}-\d{2}-\d{2}$/.test(dayKeyParam)
            ? dayKeyParam
            : dayKeyLocal();

        // Get user's timezone to set default target
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { timezone: true },
        });

        // Upsert DailySummary and increment water
        const summary = await prisma.dailySummary.upsert({
            where: { userId_dayKey: { userId, dayKey } },
            create: {
                userId,
                dayKey,
                timezone: user?.timezone || 'UTC',
                waterMl: amount,
                waterTarget: 2000,
            },
            update: {
                waterMl: { increment: amount },
                lastWaterAt: new Date()
            },
        });

        console.log(`[Hydration] User ${userId} logged ${amount}ml, total: ${summary.waterMl}ml`);

        res.json({
            dayKey,
            waterMl: summary.waterMl,
            waterTarget: summary.waterTarget,
            added: amount,
        });
    } catch (err) {
        next(err);
    }
});

// PUT /hydration/correct
// body: { waterMl: number, dayKey?: string }
// Sets absolute value (for sync correction)
router.put('/correct', authMiddleware, async (req, res, next) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const { waterMl, dayKey: dayKeyParam } = req.body;

        const amount = Number(waterMl);
        if (!Number.isFinite(amount) || amount < 0) {
            return res.status(400).json({ error: 'waterMl must be a non-negative number' });
        }

        const dayKey = dayKeyParam && /^\d{4}-\d{2}-\d{2}$/.test(dayKeyParam)
            ? dayKeyParam
            : dayKeyLocal();

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { timezone: true },
        });

        const summary = await prisma.dailySummary.upsert({
            where: { userId_dayKey: { userId, dayKey } },
            create: {
                userId,
                dayKey,
                timezone: user?.timezone || 'UTC',
                waterMl: amount,
                waterTarget: 2000,
            },
            update: {
                waterMl: amount,
                lastWaterAt: new Date()
            },
        });

        console.log(`[Hydration] User ${userId} corrected to ${amount}ml`);

        res.json({
            dayKey,
            waterMl: summary.waterMl,
            waterTarget: summary.waterTarget,
        });
    } catch (err) {
        next(err);
    }
});

export default router;
