import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';
import { AuthRequest } from '../middleware/auth';
import { dayKeyInTimezone, dayKeyToUtcDate, getCurrentWeekBounds } from '../lib/weekBounds';
import {
    Baselines,
    CHALLENGE_TARGET_STEPS,
    ChallengeType,
    coupleName,
    evaluateChallenge,
    generateCoupleCode,
    isValidCoupleCode,
    memberChallengeSteps,
    normalizeCoupleCode,
} from '../lib/coupleChallenge';
import { sendCoupleChallengePush } from '../lib/pushNotifications';
import { emitInvitationChange } from '../socket';

const router = Router();

const memberSelect = { id: true, displayName: true, timezone: true } as const;
const coupleInclude = { userA: { select: memberSelect }, userB: { select: memberSelect } } as const;
const challengeInclude = {
    challengerCouple: { include: coupleInclude },
    opponentCouple: { include: coupleInclude },
} as const;

type CoupleRecord = Prisma.CoupleGetPayload<{ include: typeof coupleInclude }>;
type ChallengeRecord = Prisma.CoupleChallengeGetPayload<{ include: typeof challengeInclude }>;
type ChallengeRequest = AuthRequest & { params: { id: string } };
type CoupleLookupRequest = AuthRequest & { params: { code: string } };

const TYPE_LABELS: Record<ChallengeType, string> = {
    FIRST_TO_100K: 'First to 100,000 steps',
    MOST_STEPS_WEEK: 'Most steps this week',
};
const RESULT_VISIBLE_MS = 7 * 24 * 60 * 60 * 1000;

const CreateSchema = z.object({
    opponentCode: z.string().trim().min(1).max(20),
    type: z.enum(['FIRST_TO_100K', 'MOST_STEPS_WEEK']),
    prize: z.string().trim().min(1).max(100),
}).strict();

const membersOf = (couple: CoupleRecord) => [couple.userA, couple.userB];
const nameOf = (couple: CoupleRecord) => coupleName(membersOf(couple).map(member => member.displayName));
const notifyChallengeChange = (challenge: ChallengeRecord) => emitInvitationChange(
    [...membersOf(challenge.challengerCouple), ...membersOf(challenge.opponentCouple)].map(member => member.id),
    'couple_challenge',
);

async function findOrCreateCouple(userId: string): Promise<CoupleRecord | null> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { partner: { select: { id: true, partnerId: true } } },
    });
    if (!user?.partner || user.partner.partnerId !== userId) return null;
    const [userAId, userBId] = [userId, user.partner.id].sort();
    const where = { userAId_userBId: { userAId, userBId } };
    const existing = await prisma.couple.findUnique({ where, include: coupleInclude });
    if (existing) return existing;

    for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
            return await prisma.couple.create({ data: { userAId, userBId, code: generateCoupleCode() }, include: coupleInclude });
        } catch (error) {
            if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
            // Either the partner created the couple at the same moment, or the code collided.
            const raced = await prisma.couple.findUnique({ where, include: coupleInclude });
            if (raced) return raced;
        }
    }
    throw new Error('Could not generate a unique couple code');
}

async function memberSteps(challenge: ChallengeRecord, now: Date): Promise<Map<string, number>> {
    const members = [...membersOf(challenge.challengerCouple), ...membersOf(challenge.opponentCouple)];
    const steps = new Map(members.map(member => [member.id, 0]));
    if (!challenge.startDayKey || (challenge.status !== 'ACTIVE' && challenge.status !== 'COMPLETED')) return steps;

    const baselines = (challenge.baselines ?? {}) as Baselines;
    const frozenAt = challenge.completedAt ?? now;
    const windows = members.map(member => ({
        id: member.id,
        startDayKey: baselines[member.id]?.dayKey ?? challenge.startDayKey!,
        endDayKey: challenge.type === 'MOST_STEPS_WEEK' && challenge.endDayKey
            ? challenge.endDayKey
            : dayKeyInTimezone(frozenAt, member.timezone || 'UTC'),
    }));
    const earliest = windows.map(window => window.startDayKey).sort()[0];
    const rows = await prisma.dailyStep.findMany({
        where: { userId: { in: members.map(member => member.id) }, date: { gte: dayKeyToUtcDate(earliest) } },
        select: { userId: true, date: true, steps: true },
    });
    for (const window of windows) {
        const own = rows
            .filter(row => row.userId === window.id)
            .map(row => ({ dayKey: row.date.toISOString().slice(0, 10), steps: row.steps }));
        steps.set(window.id, memberChallengeSteps(own, window, baselines[window.id]));
    }
    return steps;
}

const coupleTotal = (couple: CoupleRecord, steps: Map<string, number>) =>
    membersOf(couple).reduce((sum, member) => sum + (steps.get(member.id) ?? 0), 0);

/** Marks an active challenge complete once it has a result; only the first caller notifies. */
async function settle(challenge: ChallengeRecord, now: Date) {
    const steps = await memberSteps(challenge, now);
    if (challenge.status !== 'ACTIVE') return { challenge, steps };

    const outcome = evaluateChallenge({
        type: challenge.type,
        challengerSteps: coupleTotal(challenge.challengerCouple, steps),
        opponentSteps: coupleTotal(challenge.opponentCouple, steps),
        now,
        endsAt: challenge.endsAt,
    });
    if (!outcome.finished) return { challenge, steps };

    const winnerCoupleId = outcome.winner === 'challenger'
        ? challenge.challengerCoupleId
        : outcome.winner === 'opponent' ? challenge.opponentCoupleId : null;
    const update = await prisma.coupleChallenge.updateMany({
        where: { id: challenge.id, status: 'ACTIVE' },
        data: { status: 'COMPLETED', winnerCoupleId, isTie: outcome.isTie, completedAt: now },
    });
    const settled = { ...challenge, status: 'COMPLETED' as const, winnerCoupleId, isTie: outcome.isTie, completedAt: now };
    if (update.count === 1) {
        const winnerName = winnerCoupleId === challenge.challengerCoupleId ? nameOf(challenge.challengerCouple) : nameOf(challenge.opponentCouple);
        void sendCoupleChallengePush({
            toUserIds: [...membersOf(challenge.challengerCouple), ...membersOf(challenge.opponentCouple)].map(member => member.id),
            kind: 'update',
            title: outcome.isTie ? 'Step challenge ended in a tie' : `${winnerName} won the step challenge`,
            body: outcome.isTie ? `Nobody wins ${challenge.prize} this time.` : `The prize: ${challenge.prize}.`,
            challengeId: challenge.id,
        }).catch(() => {});
    }
    return { challenge: settled, steps };
}

function presentCouple(couple: CoupleRecord, steps?: Map<string, number>) {
    const members = membersOf(couple).map(member => ({ id: member.id, name: member.displayName, steps: steps?.get(member.id) ?? 0 }));
    return { id: couple.id, name: nameOf(couple), members, totalSteps: members.reduce((sum, member) => sum + member.steps, 0) };
}

function presentChallenge(challenge: ChallengeRecord, viewerCoupleId: string, steps?: Map<string, number>) {
    const sent = challenge.challengerCoupleId === viewerCoupleId;
    return {
        id: challenge.id,
        type: challenge.type,
        typeLabel: TYPE_LABELS[challenge.type],
        status: challenge.status,
        prize: challenge.prize,
        target: challenge.type === 'FIRST_TO_100K' ? CHALLENGE_TARGET_STEPS : null,
        direction: sent ? 'sent' : 'received',
        createdAt: challenge.createdAt,
        acceptedAt: challenge.acceptedAt,
        startDayKey: challenge.startDayKey,
        endDayKey: challenge.endDayKey,
        endsAt: challenge.endsAt,
        completedAt: challenge.completedAt,
        isTie: challenge.isTie,
        winner: challenge.winnerCoupleId ? (challenge.winnerCoupleId === viewerCoupleId ? 'you' : 'them') : null,
        yourCouple: presentCouple(sent ? challenge.challengerCouple : challenge.opponentCouple, steps),
        theirCouple: presentCouple(sent ? challenge.opponentCouple : challenge.challengerCouple, steps),
    };
}

async function hasActiveChallenge(coupleIds: string[]) {
    const count = await prisma.coupleChallenge.count({
        where: { status: 'ACTIVE', OR: [{ challengerCoupleId: { in: coupleIds } }, { opponentCoupleId: { in: coupleIds } }] },
    });
    return count > 0;
}

async function loadInvolved(challengeId: string, coupleId: string) {
    const challenge = await prisma.coupleChallenge.findUnique({ where: { id: challengeId }, include: challengeInclude });
    if (!challenge || (challenge.challengerCoupleId !== coupleId && challenge.opponentCoupleId !== coupleId)) return null;
    return challenge;
}

const NOT_LINKED = 'Link your partner before starting a couple challenge.';
const NOT_FOUND = 'Challenge not found.';

router.get('/me', async (req: AuthRequest, res, next) => {
    try {
        const couple = await findOrCreateCouple(req.user!.id);
        if (!couple) return res.json({ couple: null, active: null, latestResult: null, incoming: [], sent: [], medals: [] });

        const now = new Date();
        const challenges = await prisma.coupleChallenge.findMany({
            where: {
                OR: [{ challengerCoupleId: couple.id }, { opponentCoupleId: couple.id }],
                status: { in: ['PENDING', 'ACTIVE', 'COMPLETED'] },
            },
            orderBy: { createdAt: 'desc' },
            take: 20,
            include: challengeInclude,
        });

        let active = null;
        let latestResult = null;
        const running = challenges.find(challenge => challenge.status === 'ACTIVE');
        if (running) {
            const { challenge, steps } = await settle(running, now);
            if (challenge.status === 'ACTIVE') active = presentChallenge(challenge, couple.id, steps);
            else latestResult = presentChallenge(challenge, couple.id, steps);
        }
        if (!active && !latestResult) {
            const completed = challenges
                .filter(challenge => challenge.status === 'COMPLETED' && challenge.completedAt && now.getTime() - challenge.completedAt.getTime() < RESULT_VISIBLE_MS)
                .sort((left, right) => right.completedAt!.getTime() - left.completedAt!.getTime())[0];
            if (completed) latestResult = presentChallenge(completed, couple.id, await memberSteps(completed, now));
        }

        const pending = challenges.filter(challenge => challenge.status === 'PENDING');
        const wins = await prisma.coupleChallenge.findMany({
            where: { status: 'COMPLETED', winnerCoupleId: couple.id },
            orderBy: { completedAt: 'desc' },
            take: 100,
            include: challengeInclude,
        });
        return res.json({
            couple: { ...presentCouple(couple), code: couple.code },
            active,
            latestResult,
            incoming: pending.filter(challenge => challenge.opponentCoupleId === couple.id).map(challenge => presentChallenge(challenge, couple.id)),
            sent: pending.filter(challenge => challenge.challengerCoupleId === couple.id).map(challenge => presentChallenge(challenge, couple.id)),
            medals: wins.map(win => ({
                id: win.id,
                prize: win.prize,
                typeLabel: TYPE_LABELS[win.type],
                opponentName: nameOf(win.challengerCoupleId === couple.id ? win.opponentCouple : win.challengerCouple),
                completedAt: win.completedAt,
            })),
        });
    } catch (error) { next(error); }
});

router.get('/lookup/:code', async (req: CoupleLookupRequest, res, next) => {
    try {
        const code = normalizeCoupleCode(req.params.code);
        if (!isValidCoupleCode(code)) return res.status(400).json({ error: 'Couple codes are 6 letters and numbers.' });
        const couple = await findOrCreateCouple(req.user!.id);
        if (!couple) return res.status(409).json({ error: NOT_LINKED });
        const target = await prisma.couple.findUnique({ where: { code }, include: coupleInclude });
        if (!target) return res.status(404).json({ error: 'No couple has that code. Check it and try again.' });
        if (target.id === couple.id) return res.status(400).json({ error: 'That\'s your own couple code.' });
        return res.json({ couple: presentCouple(target) });
    } catch (error) { next(error); }
});

router.post('/', async (req: AuthRequest, res, next) => {
    try {
        const parsed = CreateSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: 'Choose a couple, a challenge type and a prize.' });
        const couple = await findOrCreateCouple(req.user!.id);
        if (!couple) return res.status(409).json({ error: NOT_LINKED });

        const code = normalizeCoupleCode(parsed.data.opponentCode);
        const opponent = isValidCoupleCode(code)
            ? await prisma.couple.findUnique({ where: { code }, include: coupleInclude })
            : null;
        if (!opponent) return res.status(404).json({ error: 'No couple has that code. Check it and try again.' });
        if (opponent.id === couple.id) return res.status(400).json({ error: 'That\'s your own couple code.' });

        if (await hasActiveChallenge([couple.id, opponent.id])) {
            return res.status(409).json({ error: 'One of your couples already has a challenge running.' });
        }
        const waiting = await prisma.coupleChallenge.count({ where: { challengerCoupleId: couple.id, status: 'PENDING' } });
        if (waiting > 0) return res.status(409).json({ error: 'You already have an invite waiting. Cancel it to send a new one.' });

        const challenge = await prisma.coupleChallenge.create({
            data: {
                challengerCoupleId: couple.id,
                opponentCoupleId: opponent.id,
                type: parsed.data.type,
                prize: parsed.data.prize,
                createdByUserId: req.user!.id,
            },
            include: challengeInclude,
        });
        void sendCoupleChallengePush({
            toUserIds: membersOf(opponent).map(member => member.id),
            kind: 'invite',
            title: `${nameOf(couple)} challenged you to a step battle`,
            body: `${TYPE_LABELS[parsed.data.type]}. Winners get ${parsed.data.prize}.`,
            challengeId: challenge.id,
        }).catch(() => {});
        notifyChallengeChange(challenge);
        return res.status(201).json({ challenge: presentChallenge(challenge, couple.id) });
    } catch (error) { next(error); }
});

router.get('/:id', async (req: ChallengeRequest, res, next) => {
    try {
        const couple = await findOrCreateCouple(req.user!.id);
        if (!couple) return res.status(409).json({ error: NOT_LINKED });
        const found = await loadInvolved(req.params.id, couple.id);
        if (!found) return res.status(404).json({ error: NOT_FOUND });
        const { challenge, steps } = await settle(found, new Date());
        return res.json({ challenge: presentChallenge(challenge, couple.id, steps) });
    } catch (error) { next(error); }
});

router.post('/:id/accept', async (req: ChallengeRequest, res, next) => {
    try {
        const couple = await findOrCreateCouple(req.user!.id);
        if (!couple) return res.status(409).json({ error: NOT_LINKED });
        const challenge = await loadInvolved(req.params.id, couple.id);
        if (!challenge) return res.status(404).json({ error: NOT_FOUND });
        if (challenge.opponentCoupleId !== couple.id) return res.status(403).json({ error: 'Only the invited couple can accept.' });
        if (challenge.status !== 'PENDING') return res.status(409).json({ error: 'This invite is no longer open.' });
        if (await hasActiveChallenge([challenge.challengerCoupleId, challenge.opponentCoupleId])) {
            return res.status(409).json({ error: 'One of your couples already has a challenge running.' });
        }

        const now = new Date();
        const members = [...membersOf(challenge.challengerCouple), ...membersOf(challenge.opponentCouple)];
        let data: Prisma.CoupleChallengeUpdateManyMutationInput;
        if (challenge.type === 'MOST_STEPS_WEEK') {
            const bounds = getCurrentWeekBounds(challenge.challengerCouple.userA.timezone, challenge.opponentCouple.userA.timezone, now);
            data = {
                timezone: bounds.timezone,
                startDayKey: dayKeyInTimezone(bounds.weekStart, bounds.timezone),
                endDayKey: dayKeyInTimezone(bounds.weekEnd, bounds.timezone),
                endsAt: bounds.weekEnd,
            };
        } else {
            const baselines: Baselines = {};
            for (const member of members) {
                const dayKey = dayKeyInTimezone(now, member.timezone || 'UTC');
                const row = await prisma.dailyStep.findUnique({
                    where: { userId_date: { userId: member.id, date: dayKeyToUtcDate(dayKey) } },
                    select: { steps: true },
                });
                baselines[member.id] = { dayKey, steps: row?.steps ?? 0 };
            }
            const timezone = challenge.challengerCouple.userA.timezone || 'UTC';
            data = { timezone, startDayKey: dayKeyInTimezone(now, timezone), baselines };
        }

        const update = await prisma.coupleChallenge.updateMany({
            where: { id: challenge.id, status: 'PENDING' },
            data: { ...data, status: 'ACTIVE', acceptedAt: now },
        });
        if (update.count === 0) return res.status(409).json({ error: 'This invite is no longer open.' });

        const accepted = await prisma.coupleChallenge.findUniqueOrThrow({ where: { id: challenge.id }, include: challengeInclude });
        notifyChallengeChange(accepted);
        void sendCoupleChallengePush({
            toUserIds: members.map(member => member.id).filter(id => id !== req.user!.id),
            kind: 'update',
            title: `${nameOf(challenge.challengerCouple)} vs ${nameOf(challenge.opponentCouple)} is on`,
            body: `${TYPE_LABELS[challenge.type]}. Winners get ${challenge.prize}.`,
            challengeId: challenge.id,
        }).catch(() => {});
        return res.json({ challenge: presentChallenge(accepted, couple.id, await memberSteps(accepted, now)) });
    } catch (error) { next(error); }
});

router.post('/:id/decline', async (req: ChallengeRequest, res, next) => {
    try {
        const couple = await findOrCreateCouple(req.user!.id);
        if (!couple) return res.status(409).json({ error: NOT_LINKED });
        const challenge = await loadInvolved(req.params.id, couple.id);
        if (!challenge) return res.status(404).json({ error: NOT_FOUND });
        if (challenge.opponentCoupleId !== couple.id) return res.status(403).json({ error: 'Only the invited couple can decline.' });
        const update = await prisma.coupleChallenge.updateMany({ where: { id: challenge.id, status: 'PENDING' }, data: { status: 'DECLINED' } });
        if (update.count === 0) return res.status(409).json({ error: 'This invite is no longer open.' });
        notifyChallengeChange(challenge);
        void sendCoupleChallengePush({
            toUserIds: membersOf(challenge.challengerCouple).map(member => member.id),
            kind: 'update',
            title: `${nameOf(couple)} declined your step challenge`,
            body: 'Try challenging another couple.',
            challengeId: challenge.id,
        }).catch(() => {});
        return res.json({ ok: true });
    } catch (error) { next(error); }
});

router.delete('/:id', async (req: ChallengeRequest, res, next) => {
    try {
        const couple = await findOrCreateCouple(req.user!.id);
        if (!couple) return res.status(409).json({ error: NOT_LINKED });
        const challenge = await loadInvolved(req.params.id, couple.id);
        if (!challenge) return res.status(404).json({ error: NOT_FOUND });
        if (challenge.challengerCoupleId !== couple.id) return res.status(403).json({ error: 'Only the couple who sent the invite can cancel it.' });
        const update = await prisma.coupleChallenge.updateMany({ where: { id: challenge.id, status: 'PENDING' }, data: { status: 'CANCELLED' } });
        if (update.count === 0) return res.status(409).json({ error: 'This invite is no longer open.' });
        notifyChallengeChange(challenge);
        return res.json({ ok: true });
    } catch (error) { next(error); }
});

export default router;
