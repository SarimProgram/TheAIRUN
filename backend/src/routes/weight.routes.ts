// src/routes/weight.routes.ts
import { Router } from 'express';
import { z } from 'zod';
import prisma from '../db/prisma';
import { AuthRequest } from '../middleware/auth';

const router = Router();

const logWeightSchema = z.object({
    weightKg: z.number().positive().max(500),
});

/**
 * GET /weight
 * Get current weight and recent history
 */
router.get('/', async (req: AuthRequest, res, next) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { weightKg: true },
        });

        const history = await prisma.weightHistory.findMany({
            where: { userId: req.user.id },
            orderBy: { loggedAt: 'desc' },
            take: 30, // Last 30 entries
        });

        return res.json({
            currentWeight: user?.weightKg ?? null,
            history: history.map((h) => ({
                id: h.id,
                weightKg: h.weightKg,
                loggedAt: h.loggedAt.toISOString(),
            })),
        });
    } catch (err) {
        return next(err);
    }
});

/**
 * POST /weight
 * Log a new weight entry
 */
router.post('/', async (req: AuthRequest, res, next) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

        const { weightKg } = logWeightSchema.parse(req.body);

        // Update User.weightKg and create WeightHistory in a transaction
        const [updatedUser, historyEntry] = await prisma.$transaction([
            prisma.user.update({
                where: { id: req.user.id },
                data: { weightKg },
            }),
            prisma.weightHistory.create({
                data: {
                    userId: req.user.id,
                    weightKg,
                },
            }),
        ]);

        return res.status(201).json({
            currentWeight: updatedUser.weightKg,
            entry: {
                id: historyEntry.id,
                weightKg: historyEntry.weightKg,
                loggedAt: historyEntry.loggedAt.toISOString(),
            },
        });
    } catch (err) {
        return next(err);
    }
});

export default router;
