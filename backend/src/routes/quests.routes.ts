import { Router, Request, Response } from 'express';
import { PrismaClient, UserQuestStatus } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';
import { requireStringParam } from '../utils/params';

const prisma = new PrismaClient();
const router = Router();

// Type for authenticated request
interface AuthRequest extends Request {
    user?: { id: string };
}

// ==================================================
// GET /quests/available - Get user's available quests (max 2)
// ==================================================
router.get('/available', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // First, expire any quests that are past their expiry time
        await prisma.userQuest.updateMany({
            where: {
                userId,
                status: UserQuestStatus.AVAILABLE,
                expiresAt: { lt: new Date() },
            },
            data: { status: UserQuestStatus.EXPIRED },
        });

        // Get current available quests for user
        let userQuests = await prisma.userQuest.findMany({
            where: {
                userId,
                status: UserQuestStatus.AVAILABLE,
            },
            include: { quest: true },
            orderBy: { assignedAt: 'asc' },
        });

        // If user has less than 2 available quests, assign new ones
        if (userQuests.length < 2) {
            const questsNeeded = 2 - userQuests.length;

            // Get quest IDs already assigned to user (available or completed recently)
            const recentQuestIds = await prisma.userQuest.findMany({
                where: {
                    userId,
                    OR: [
                        { status: UserQuestStatus.AVAILABLE },
                        {
                            status: UserQuestStatus.COMPLETED,
                            completedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
                        }
                    ]
                },
                select: { questId: true },
            });

            const excludedIds = recentQuestIds.map(q => q.questId);

            // Get random quests not already assigned
            const availableQuests = await prisma.quest.findMany({
                where: {
                    isActive: true,
                    id: { notIn: excludedIds },
                },
                take: questsNeeded,
            });

            // Assign new quests to user
            for (const quest of availableQuests) {
                const expiresAt = new Date(Date.now() + quest.durationHours * 60 * 60 * 1000);

                await prisma.userQuest.create({
                    data: {
                        userId,
                        questId: quest.id,
                        status: UserQuestStatus.AVAILABLE,
                        expiresAt,
                    },
                });
            }

            // Re-fetch user quests
            userQuests = await prisma.userQuest.findMany({
                where: {
                    userId,
                    status: UserQuestStatus.AVAILABLE,
                },
                include: { quest: true },
                orderBy: { assignedAt: 'asc' },
            });
        }

        // Format response
        const formattedQuests = userQuests.map(uq => ({
            id: uq.id,
            questId: uq.quest.id,
            title: uq.quest.title,
            description: uq.quest.description,
            type: uq.quest.type,
            difficulty: uq.quest.difficulty,
            targetValue: uq.quest.targetValue,
            timeConstraint: uq.quest.timeConstraint,
            xpReward: uq.quest.xpReward,
            pointsReward: uq.quest.pointsReward,
            currentProgress: uq.currentProgress,
            status: uq.status,
            assignedAt: uq.assignedAt,
            expiresAt: uq.expiresAt,
        }));

        res.json({ quests: formattedQuests });
    } catch (error) {
        console.error('Error fetching available quests:', error);
        res.status(500).json({ error: 'Failed to fetch available quests' });
    }
});

// ==================================================
// GET /quests/all - Get all quest templates (admin/debug)
// ==================================================
router.get('/all', authMiddleware, async (_req: Request, res: Response) => {
    try {
        const quests = await prisma.quest.findMany({
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
        });

        res.json({ quests });
    } catch (error) {
        console.error('Error fetching all quests:', error);
        res.status(500).json({ error: 'Failed to fetch quests' });
    }
});

// ==================================================
// POST /quests/:userQuestId/complete - Complete a quest
// ==================================================
router.post('/:userQuestId/complete', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const userQuestId = requireStringParam(req.params.userQuestId, 'userQuestId');

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const userQuest = await prisma.userQuest.findFirst({
            where: {
                id: userQuestId,
                userId,
                status: UserQuestStatus.AVAILABLE,
            },
            include: { quest: true },
        });

        if (!userQuest) {
            return res.status(404).json({ error: 'Quest not found or not available' });
        }

        // Check if expired
        if (new Date() > userQuest.expiresAt) {
            await prisma.userQuest.update({
                where: { id: userQuestId },
                data: { status: UserQuestStatus.EXPIRED },
            });
            return res.status(400).json({ error: 'Quest has expired' });
        }

        // Complete the quest
        const completedQuest = await prisma.userQuest.update({
            where: { id: userQuestId },
            data: {
                status: UserQuestStatus.COMPLETED,
                completedAt: new Date(),
                currentProgress: userQuest.quest.targetValue,
            },
            include: { quest: true },
        });

        // Award points if configured
        if (userQuest.quest.pointsReward > 0) {
            await prisma.userPoints.upsert({
                where: { userId },
                update: { balance: { increment: userQuest.quest.pointsReward } },
                create: { userId, balance: userQuest.quest.pointsReward },
            });
        }

        res.json({
            message: 'Quest completed!',
            quest: completedQuest,
            rewards: {
                xp: userQuest.quest.xpReward,
                points: userQuest.quest.pointsReward,
            },
        });
    } catch (error) {
        console.error('Error completing quest:', error);
        res.status(500).json({ error: 'Failed to complete quest' });
    }
});

// ==================================================
// PATCH /quests/:userQuestId/progress - Update quest progress
// ==================================================
router.patch('/:userQuestId/progress', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const userQuestId = requireStringParam(req.params.userQuestId, 'userQuestId');
        const { progress } = req.body;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (typeof progress !== 'number') {
            return res.status(400).json({ error: 'Progress must be a number' });
        }

        const userQuest = await prisma.userQuest.findFirst({
            where: {
                id: userQuestId,
                userId,
                status: UserQuestStatus.AVAILABLE,
            },
            include: { quest: true },
        });

        if (!userQuest) {
            return res.status(404).json({ error: 'Quest not found or not available' });
        }

        const updatedQuest = await prisma.userQuest.update({
            where: { id: userQuestId },
            data: { currentProgress: progress },
            include: { quest: true },
        });

        res.json({ quest: updatedQuest });
    } catch (error) {
        console.error('Error updating quest progress:', error);
        res.status(500).json({ error: 'Failed to update quest progress' });
    }
});

// ==================================================
// GET /quests/history - Get user's completed/expired quests
// ==================================================
router.get('/history', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const quests = await prisma.userQuest.findMany({
            where: {
                userId,
                status: { in: [UserQuestStatus.COMPLETED, UserQuestStatus.EXPIRED] },
            },
            include: { quest: true },
            orderBy: { updatedAt: 'desc' },
            take: 20,
        });

        res.json({ quests });
    } catch (error) {
        console.error('Error fetching quest history:', error);
        res.status(500).json({ error: 'Failed to fetch quest history' });
    }
});

export default router;
