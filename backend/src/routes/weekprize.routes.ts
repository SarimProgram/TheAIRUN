import { Router } from 'express';
import { Prisma, type WeekPrize } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import { AuthRequest } from '../middleware/auth';
import { countCompletedWeeklyGoals } from '../lib/completedWeeklyGoals';
import { sendWeekPrizePush } from '../lib/pushNotifications';
import { emitInvitationChange } from '../socket';
import { dayKeyInTimezone, getCurrentWeekBounds, getWeekDayKeysForRange } from '../lib/weekBounds';

const router = Router();
const PrizeSchema = z.object({ weekprize: z.string().trim().min(1).max(100) }).strict();
const SignatureSchema = z.object({
    paths: z.array(z.string().max(6000).regex(/^[MLl0-9. -]+$/)).max(60)
        .refine(paths => paths.join('').length <= 60_000),
}).strict();

async function context(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            timezone: true, partnerId: true, displayName: true,
            partner: { select: { id: true, partnerId: true, displayName: true, timezone: true } },
        },
    });
    const partner = user?.partner?.partnerId === userId ? user.partner : null;
    const now = new Date();
    const [userAId, userBId] = [userId, partner?.id ?? userId].sort();
    // The canonical first partner defines the calendar, so both requests use
    // the same week even when one partner is already on Monday.
    const timezone = userId === userAId ? user?.timezone : partner?.timezone;
    const bounds = getCurrentWeekBounds(timezone, timezone, now);
    const pairWeek = { userAId, userBId, weekStart: dayKeyInTimezone(bounds.weekStart, bounds.timezone) };
    return { user, partner, bounds, pairWeek, now };
}

const signaturePaths = (value: unknown) =>
    Array.isArray(value) && value.length && value.every(path => typeof path === 'string') ? value as string[] : null;

function prizeView(prize: WeekPrize | null, userId: string) {
    const isUserA = prize?.userAId === userId;
    return {
        weekprize: prize?.weekprize ?? null,
        proposedByYou: prize?.proposedById ? prize.proposedById === userId : null,
        accepted: !!prize && (!prize.proposedById || !!prize.acceptedAt),
        yourSignature: signaturePaths(isUserA ? prize?.signatureA : prize?.signatureB),
        partnerSignature: signaturePaths(isUserA ? prize?.signatureB : prize?.signatureA),
    };
}

const weekFields = (bounds: ReturnType<typeof getCurrentWeekBounds>) =>
    ({ weekStart: bounds.weekStart, weekEnd: bounds.weekEnd, weekTimezone: bounds.timezone });

function notifyPartner(partnerId: string, fromName: string | null | undefined, kind: 'proposed' | 'accepted' | 'signed', weekprize: string) {
    sendWeekPrizePush({ toUserId: partnerId, fromName: fromName || 'Your partner', kind, weekprize })
        .catch(error => console.error('[weekprize] push failed:', error));
}

router.get('/', async (req: AuthRequest, res, next) => {
    try {
        const userId = req.user!.id;
        const { user, partner, bounds, pairWeek, now } = await context(userId);
        if (!user) return res.status(404).json({ error: 'Account not found' });
        const yourToday = dayKeyInTimezone(now, user.timezone || 'UTC');
        const partnerToday = partner ? dayKeyInTimezone(now, partner.timezone || 'UTC') : yourToday;
        const weekDays = getWeekDayKeysForRange(bounds.weekStart, bounds.weekEnd, bounds.timezone);
        const yourDays = weekDays.filter(day => day <= yourToday);
        const partnerDays = partner ? weekDays.filter(day => day <= partnerToday) : [];
        const previous = getCurrentWeekBounds(bounds.timezone, bounds.timezone, new Date(bounds.weekStart.getTime() - 1));
        const previousDays = getWeekDayKeysForRange(previous.weekStart, previous.weekEnd, bounds.timezone);
        const lastWeek = partner ? await (async () => {
            const [lastPrize, lastGoals, lastRemovals] = await Promise.all([
                prisma.weekPrize.findUnique({ where: { userAId_userBId_weekStart: { ...pairWeek, weekStart: previousDays[0] } } }),
                prisma.dailyPointsLedger.findMany({
                    where: { OR: [userId, partner.id].map(id => ({ userId: id, dayKey: { in: previousDays } })) },
                    select: { userId: true, dayKey: true, category: true, progress: true, earnedPoints: true, maxPoints: true },
                }),
                prisma.weeklyGoalRemoval.findMany({ where: { ...pairWeek, weekStart: previousDays[0], acceptedAt: { not: null } }, select: { goal: true } }),
            ]);
            if (!lastPrize && lastGoals.length === 0) return null;
            const removed = lastRemovals.map(row => row.goal);
            const yours = countCompletedWeeklyGoals(lastGoals, userId, removed);
            const theirs = countCompletedWeeklyGoals(lastGoals, partner.id, removed);
            return {
                id: `${pairWeek.userAId}:${pairWeek.userBId}:${previousDays[0]}`,
                weekStart: previous.weekStart, weekEnd: previous.weekEnd,
                weekprize: lastPrize?.weekprize ?? null,
                yourGoalsCompleted: yours, partnerGoalsCompleted: theirs,
                winner: yours === theirs ? 'tie' : yours > theirs ? 'you' : 'partner',
            };
        })() : null;
        const [prize, goals, removals] = await Promise.all([
            partner ? prisma.weekPrize.findUnique({ where: { userAId_userBId_weekStart: pairWeek } }) : null,
            prisma.dailyPointsLedger.findMany({
                where: { OR: [
                    { userId, dayKey: { in: yourDays } },
                    ...(partner ? [{ userId: partner.id, dayKey: { in: partnerDays } }] : []),
                ] },
                select: { userId: true, dayKey: true, category: true, progress: true, earnedPoints: true, maxPoints: true },
            }),
            partner ? prisma.weeklyGoalRemoval.findMany({ where: { ...pairWeek, acceptedAt: { not: null } }, select: { goal: true } }) : [],
        ]);
        return res.json({
            ...prizeView(prize, userId),
            ...weekFields(bounds),
            hasPartner: !!partner, partnerName: partner?.displayName ?? null,
            yourGoalsCompleted: countCompletedWeeklyGoals(goals, userId, removals.map(row => row.goal)),
            partnerGoalsCompleted: partner ? countCompletedWeeklyGoals(goals, partner.id, removals.map(row => row.goal)) : null,
            lastWeek,
        });
    } catch (error) { next(error); }
});

router.put('/', async (req: AuthRequest, res, next) => {
    try {
        const parsed = PrizeSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: 'Choose a prize between 1 and 100 characters.' });
        const userId = req.user!.id;
        const { user, partner, bounds, pairWeek } = await context(userId);
        if (!user) return res.status(404).json({ error: 'Account not found' });
        if (!partner) return res.status(409).json({ error: 'Link your partner before choosing a weekly prize.' });
        const where = { userAId_userBId_weekStart: pairWeek };
        const existing = await prisma.weekPrize.findUnique({ where });
        if (existing?.weekprize === parsed.data.weekprize) return res.json({ ...prizeView(existing, userId), ...weekFields(bounds) });
        // A changed prize is a new proposal, so the previous agreement and signatures no longer apply.
        const prize = await prisma.weekPrize.upsert({
            where,
            create: { ...pairWeek, weekprize: parsed.data.weekprize, proposedById: userId },
            update: {
                weekprize: parsed.data.weekprize, proposedById: userId, acceptedAt: null,
                signatureA: Prisma.DbNull, signatureB: Prisma.DbNull,
            },
        });
        notifyPartner(partner.id, user.displayName, 'proposed', prize.weekprize);
        emitInvitationChange([userId, partner.id], 'weekly_prize');
        return res.json({ ...prizeView(prize, userId), ...weekFields(bounds) });
    } catch (error) { next(error); }
});

router.post('/accept', async (req: AuthRequest, res, next) => {
    try {
        const userId = req.user!.id;
        const { user, partner, bounds, pairWeek } = await context(userId);
        if (!user) return res.status(404).json({ error: 'Account not found' });
        if (!partner) return res.status(409).json({ error: 'Link your partner before accepting a weekly prize.' });
        const where = { userAId_userBId_weekStart: pairWeek };
        const existing = await prisma.weekPrize.findUnique({ where });
        if (!existing) return res.status(404).json({ error: 'There is no prize to accept this week.' });
        if (existing.proposedById === userId && !existing.acceptedAt) {
            return res.status(409).json({ error: 'Your partner needs to accept this prize.' });
        }
        if (existing.acceptedAt || !existing.proposedById) return res.json({ ...prizeView(existing, userId), ...weekFields(bounds) });
        const prize = await prisma.weekPrize.update({ where, data: { acceptedAt: new Date() } });
        notifyPartner(partner.id, user.displayName, 'accepted', prize.weekprize);
        emitInvitationChange([userId, partner.id], 'weekly_prize');
        return res.json({ ...prizeView(prize, userId), ...weekFields(bounds) });
    } catch (error) { next(error); }
});

router.post('/decline', async (req: AuthRequest, res, next) => {
    try {
        const userId = req.user!.id;
        const { user, partner, bounds, pairWeek } = await context(userId);
        if (!user) return res.status(404).json({ error: 'Account not found' });
        if (!partner) return res.status(409).json({ error: 'Link your partner before responding to a weekly prize.' });
        // Only the recipient can deny a pending proposal. A conditional delete
        // also protects an agreement accepted or changed by another request.
        const result = await prisma.weekPrize.deleteMany({ where: {
            ...pairWeek, proposedById: partner.id, acceptedAt: null,
        } });
        if (!result.count) return res.status(409).json({ error: 'This prize is no longer waiting for your response.' });
        emitInvitationChange([userId, partner.id], 'weekly_prize');
        return res.json({ ...prizeView(null, userId), ...weekFields(bounds) });
    } catch (error) { next(error); }
});

router.put('/signature', async (req: AuthRequest, res, next) => {
    try {
        const parsed = SignatureSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: 'That doodle could not be saved.' });
        const userId = req.user!.id;
        const { user, partner, bounds, pairWeek } = await context(userId);
        if (!user) return res.status(404).json({ error: 'Account not found' });
        if (!partner) return res.status(409).json({ error: 'Link your partner before signing a weekly prize.' });
        const where = { userAId_userBId_weekStart: pairWeek };
        const existing = await prisma.weekPrize.findUnique({ where });
        if (!existing) return res.status(404).json({ error: 'There is no prize to sign this week.' });
        const before = prizeView(existing, userId);
        const signing = parsed.data.paths.length > 0;
        const paths = signing ? parsed.data.paths : Prisma.DbNull;
        // Signing your partner's proposal is the same as accepting it.
        const accepting = signing && !before.accepted && before.proposedByYou === false;
        const prize = await prisma.weekPrize.update({
            where,
            data: {
                ...(userId === pairWeek.userAId ? { signatureA: paths } : { signatureB: paths }),
                ...(accepting ? { acceptedAt: new Date() } : {}),
            },
        });
        if (signing && !before.yourSignature) notifyPartner(partner.id, user.displayName, 'signed', prize.weekprize);
        emitInvitationChange([userId, partner.id], 'weekly_prize');
        return res.json({ ...prizeView(prize, userId), ...weekFields(bounds) });
    } catch (error) { next(error); }
});

export default router;
