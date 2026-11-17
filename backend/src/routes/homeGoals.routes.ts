import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import { AuthRequest } from '../middleware/auth';
import { dayKeyInTimezone, getCurrentWeekBounds } from '../lib/weekBounds';
import { emitInvitationChange } from '../socket';

const router = Router();
const goal = z.enum(['calories', 'steps', 'workout', 'water']);
const defaultOrder = goal.options;
const week = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

async function context(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: {
        timezone: true, partner: { select: { id: true, partnerId: true, timezone: true } },
    } });
    const partner = user.partner?.partnerId === userId ? user.partner : null;
    const [userAId, userBId] = [userId, partner?.id ?? userId].sort();
    const timezone = userId === userAId ? user.timezone : partner?.timezone;
    const bounds = getCurrentWeekBounds(timezone, timezone);
    return { partner, weekEnd: bounds.weekEnd, pairWeek: {
        userAId, userBId, weekStart: dayKeyInTimezone(bounds.weekStart, bounds.timezone),
    } };
}

router.get('/', async (req: AuthRequest, res, next) => {
    try {
        const userId = req.user!.id;
        const { partner, pairWeek, weekEnd } = await context(userId);
        const [layout, removals] = await Promise.all([
            prisma.homeGoalLayout.findUnique({ where: { userId } }),
            partner ? prisma.weeklyGoalRemoval.findMany({ where: pairWeek }) : [],
        ]);
        res.json({ order: layout?.order ?? defaultOrder, weekStart: pairWeek.weekStart, weekEnd,
            partnerId: partner?.id ?? null,
            removals: removals.map(row => ({ id: row.id, goal: row.goal,
                requestedByYou: row.requestedById === userId, accepted: !!row.acceptedAt })) });
    } catch (error) { next(error); }
});

router.put('/order', async (req: AuthRequest, res, next) => {
    try {
        const userId = req.user!.id;
        const { order } = z.object({ order: z.array(goal).length(4).refine(values => new Set(values).size === 4) }).strict().parse(req.body);
        await prisma.homeGoalLayout.upsert({ where: { userId }, create: { userId, order }, update: { order } });
        res.json({ order });
    } catch (error) { next(error); }
});

router.post('/removals', async (req: AuthRequest, res, next) => {
    try {
        const userId = req.user!.id;
        const body = z.object({ goal, weekStart: week }).strict().parse(req.body);
        const { partner, pairWeek } = await context(userId);
        if (!partner) return res.status(409).json({ error: 'Connect a partner to approve goal removals.' });
        if (body.weekStart !== pairWeek.weekStart) return res.status(409).json({ error: 'A new week has started. Refresh your goals.' });
        // A duplicate request never approves or replaces the existing request.
        await prisma.weeklyGoalRemoval.upsert({
            where: { userAId_userBId_weekStart_goal: { ...pairWeek, goal: body.goal } },
            create: { ...pairWeek, goal: body.goal, requestedById: userId }, update: {},
        });
        emitInvitationChange([userId, partner.id], 'home_goals');
        res.status(201).json({ ok: true });
    } catch (error) { next(error); }
});

router.post('/removals/:id/respond', async (req: AuthRequest, res, next) => {
    try {
        const userId = req.user!.id;
        const { accept, weekStart } = z.object({ accept: z.boolean(), weekStart: week }).strict().parse(req.body);
        const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
        const { partner, pairWeek } = await context(userId);
        if (!partner || weekStart !== pairWeek.weekStart) return res.status(409).json({ error: 'This request is no longer available.' });
        // Conditional writes prevent self-approval, stale responses and access after unlinking.
        const where = { id, ...pairWeek, requestedById: partner.id, acceptedAt: null };
        const result = accept
            ? await prisma.weeklyGoalRemoval.updateMany({ where, data: { acceptedAt: new Date() } })
            : await prisma.weeklyGoalRemoval.deleteMany({ where });
        if (!result.count) return res.status(409).json({ error: 'This request is no longer waiting for your response.' });
        emitInvitationChange([userId, partner.id], 'home_goals');
        if (accept) emitInvitationChange([userId, partner.id], 'weekly_prize');
        res.json({ ok: true });
    } catch (error) { next(error); }
});

export default router;
