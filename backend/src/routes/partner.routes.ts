// src/routes/partner.routes.ts
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { promoteToPairOnboardingRewards } from '../services/onboardingRewards';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

function toInviteCode(inviteId: string) {
    return inviteId.replace(/-/g, '').slice(0, 8).toUpperCase();
}

function getPartnerJourneySnapshot(user: {
    units: string | null;
    weightKg: number | null;
    weightLbs: number | null;
    goalTarget: number | null;
    goalTargetLbs: number | null;
    goalStart: number | null;
    goalStartLbs: number | null;
    goalType: string | null;
    plan?: {
        weightKg: number | null;
        targetWeightKg: number | null;
        weightToLoseKg: number | null;
        goalType: string;
        weeklyPlans?: Array<{
            expectedWeight: number;
            week: number;
        }>;
    } | null;
}) {
    const usesImperial = user.units === 'imperial';
    const unit = usesImperial ? 'lbs' : 'kg';
    const currentWeight = usesImperial ? user.weightLbs : user.weightKg;
    const startWeightFromProfile = usesImperial ? user.goalStartLbs : user.goalStart;
    const startWeightFromPlan =
        user.plan?.weightKg != null
            ? usesImperial
                ? Number((user.plan.weightKg * 2.20462).toFixed(1))
                : user.plan.weightKg
            : null;
    const startWeight = startWeightFromProfile ?? startWeightFromPlan ?? currentWeight ?? null;

    const targetWeightFromProfile = usesImperial ? user.goalTargetLbs : user.goalTarget;
    const targetWeightFromPlan =
        user.plan?.targetWeightKg != null
            ? usesImperial
                ? Number((user.plan.targetWeightKg * 2.20462).toFixed(1))
                : user.plan.targetWeightKg
            : null;
    const targetWeight = targetWeightFromProfile ?? targetWeightFromPlan ?? null;

    const weightToLose =
        currentWeight != null && targetWeight != null
            ? Number(Math.max(currentWeight - targetWeight, 0).toFixed(1))
            : user.plan?.weightToLoseKg != null
                ? usesImperial
                    ? Number((user.plan.weightToLoseKg * 2.20462).toFixed(1))
                    : user.plan.weightToLoseKg
                : null;
    const weightLost =
        startWeight != null && currentWeight != null
            ? Number((startWeight - currentWeight).toFixed(1))
            : null;

    const expectedWeek = user.plan?.weeklyPlans?.[0] ?? null;
    const expectedOutcome =
        expectedWeek?.expectedWeight != null
            ? {
                expectedWeight: usesImperial
                    ? Number((expectedWeek.expectedWeight * 2.20462).toFixed(1))
                    : expectedWeek.expectedWeight,
                unit,
                timeframeLabel: `by week ${expectedWeek.week}`,
            }
            : null;

    return {
        currentWeight,
        startWeight,
        targetWeight,
        weightToLose,
        weightLost,
        unit,
        primaryGoal: user.plan?.goalType ?? user.goalType ?? null,
        expectedOutcome,
    };
}

/**
 * POST /partner/invite
 * Send a partner invitation by email
 */
const InviteSchema = z.object({
    email: z.string().email().toLowerCase(),
});

router.post('/invite', async (req, res, next) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const { email } = InviteSchema.parse(req.body);

        // Get current user
        const currentUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { email: true, partnerId: true },
        });

        if (!currentUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Can't invite yourself
        if (currentUser.email.toLowerCase() === email) {
            return res.status(400).json({ error: 'You cannot invite yourself' });
        }

        // Can't invite if already has a partner
        if (currentUser.partnerId) {
            return res.status(400).json({ error: 'You already have a partner. Disconnect first.' });
        }

        // Check if target user exists
        const targetUser = await prisma.user.findUnique({
            where: { email },
            select: { id: true, partnerId: true },
        });

        // If target already has a partner
        if (targetUser?.partnerId) {
            return res.status(400).json({ error: 'This user already has a partner' });
        }

        // Check for existing pending invite from the other person first
        if (targetUser?.id) {
            const reverseInvite = await prisma.partnerInvite.findFirst({
                where: {
                    fromUserId: targetUser.id,
                    toEmail: currentUser.email.toLowerCase(),
                    status: 'PENDING',
                },
            });

            if (reverseInvite) {
                return res.status(400).json({ error: 'This person already invited you. Accept their invite instead.' });
            }
        }

        // Check for an existing invite from the current user to this email
        const existingInvite = await prisma.partnerInvite.findFirst({
            where: {
                fromUserId: userId,
                toEmail: email,
            },
        });

        if (existingInvite) {
            if (existingInvite.status === 'PENDING') {
                return res.status(400).json({ error: 'A pending invite already exists between you two' });
            }

            const invite = await prisma.partnerInvite.update({
                where: { id: existingInvite.id },
                data: {
                    toUserId: targetUser?.id ?? null,
                    status: 'PENDING',
                },
                include: {
                    fromUser: { select: { id: true, displayName: true, email: true } },
                },
            });

            return res.status(200).json({
                success: true,
                invite: {
                    id: invite.id,
                    code: toInviteCode(invite.id),
                    toEmail: invite.toEmail,
                    status: invite.status,
                    createdAt: invite.createdAt,
                },
            });
        }

        // Create the invite
        const invite = await prisma.partnerInvite.create({
            data: {
                fromUserId: userId,
                toEmail: email,
                toUserId: targetUser?.id ?? null, // Link if user exists
                status: 'PENDING',
            },
            include: {
                fromUser: { select: { id: true, displayName: true, email: true } },
            },
        });

        res.status(201).json({
            success: true,
            invite: {
                id: invite.id,
                code: toInviteCode(invite.id),
                toEmail: invite.toEmail,
                status: invite.status,
                createdAt: invite.createdAt,
            },
        });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /partner/invites/pending
 * List pending invitations received by the current user
 */
router.get('/invites/pending', async (req, res, next) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { email: true },
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Find invites where this user's email matches toEmail OR toUserId matches
        const invites = await prisma.partnerInvite.findMany({
            where: {
                OR: [
                    { toUserId: userId, status: 'PENDING' },
                    { toEmail: user.email.toLowerCase(), status: 'PENDING' },
                ],
            },
            include: {
                fromUser: {
                    select: {
                        id: true,
                        displayName: true,
                        email: true,
                        units: true,
                        weightKg: true,
                        weightLbs: true,
                        goalTarget: true,
                        goalTargetLbs: true,
                        goalStart: true,
                        goalStartLbs: true,
                        goalType: true,
                        plan: {
                            select: {
                                weightKg: true,
                                targetWeightKg: true,
                                weightToLoseKg: true,
                                goalType: true,
                                weeklyPlans: {
                                    select: {
                                        expectedWeight: true,
                                        week: true,
                                    },
                                    orderBy: { week: 'asc' },
                                    take: 1,
                                },
                            },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        res.json({
            invites: invites.map((invite) => ({
                ...invite,
                code: toInviteCode(invite.id),
                fromUser: invite.fromUser
                    ? {
                        id: invite.fromUser.id,
                        displayName: invite.fromUser.displayName,
                        email: invite.fromUser.email,
                        journey: getPartnerJourneySnapshot(invite.fromUser),
                    }
                    : null,
            })),
        });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /partner/invites/sent
 * List invitations sent by the current user
 */
router.get('/invites/sent', async (req, res, next) => {
    try {
        const userId = (req as AuthRequest).user!.id;

        const invites = await prisma.partnerInvite.findMany({
            where: { fromUserId: userId },
            include: {
                toUser: { select: { id: true, displayName: true, email: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        res.json({
            invites: invites.map((invite) => ({
                ...invite,
                code: toInviteCode(invite.id),
            })),
        });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /partner/invites/:id/accept
 * Accept a partner invitation
 */
router.post('/invites/:id/accept', async (req, res, next) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const inviteId = req.params.id;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { email: true, partnerId: true },
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.partnerId) {
            return res.status(400).json({ error: 'You already have a partner' });
        }

        // Find the invite
        const invite = await prisma.partnerInvite.findFirst({
            where: {
                id: inviteId,
                status: 'PENDING',
                OR: [
                    { toUserId: userId },
                    { toEmail: user.email.toLowerCase() },
                ],
            },
            include: {
                fromUser: { select: { id: true, partnerId: true, displayName: true } },
            },
        });

        if (!invite) {
            return res.status(404).json({ error: 'Invite not found or already processed' });
        }

        if (invite.fromUser.partnerId) {
            // The sender already has a partner (maybe from another invite)
            await prisma.partnerInvite.update({
                where: { id: inviteId },
                data: { status: 'DECLINED' },
            });
            return res.status(400).json({ error: 'The inviter already has a partner' });
        }

        // Accept: link both users as partners
        await prisma.$transaction([
            // Update invite status and link toUserId if not set
            prisma.partnerInvite.update({
                where: { id: inviteId },
                data: {
                    status: 'ACCEPTED',
                    toUserId: userId,
                },
            }),
            // Set partner on current user
            prisma.user.update({
                where: { id: userId },
                data: { partnerId: invite.fromUserId },
            }),
            // Set partner on inviter
            prisma.user.update({
                where: { id: invite.fromUserId },
                data: { partnerId: userId },
            }),
            // Decline any other pending invites for both users
            prisma.partnerInvite.updateMany({
                where: {
                    id: { not: inviteId },
                    status: 'PENDING',
                    OR: [
                        { fromUserId: userId },
                        { fromUserId: invite.fromUserId },
                        { toUserId: userId },
                        { toUserId: invite.fromUserId },
                        { toEmail: user.email.toLowerCase() },
                    ],
                },
                data: { status: 'DECLINED' },
            }),
        ]);

        const [accepterPref, inviterPref] = await Promise.all([
            prisma.onboardingRewardPreference.findUnique({
                where: { userId },
            }),
            prisma.onboardingRewardPreference.findUnique({
                where: { userId: invite.fromUserId },
            }),
        ]);

        const hasConfiguredRewards = (pref: any) =>
            !!pref &&
            !pref.skipped &&
            !!(pref.week1RewardId || pref.week2RewardId || pref.week3RewardId);

        const ownerPref = hasConfiguredRewards(accepterPref)
            ? { ...accepterPref, ownerUserId: userId }
            : hasConfiguredRewards(inviterPref)
                ? { ...inviterPref, ownerUserId: invite.fromUserId }
                : null;

        if (ownerPref) {
            await promoteToPairOnboardingRewards(userId, invite.fromUserId, {
                ownerUserId: ownerPref.ownerUserId,
                week1RewardId: ownerPref.week1RewardId,
                week2RewardId: ownerPref.week2RewardId,
                week3RewardId: ownerPref.week3RewardId,
                skipped: ownerPref.skipped,
            });
        }

        res.json({
            success: true,
            partnerId: invite.fromUserId,
            partnerName: invite.fromUser.displayName,
        });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /partner/invites/:id/decline
 * Decline a partner invitation
 */
router.post('/invites/:id/decline', async (req, res, next) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const inviteId = req.params.id;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { email: true },
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const invite = await prisma.partnerInvite.findFirst({
            where: {
                id: inviteId,
                status: 'PENDING',
                OR: [
                    { toUserId: userId },
                    { toEmail: user.email.toLowerCase() },
                ],
            },
        });

        if (!invite) {
            return res.status(404).json({ error: 'Invite not found or already processed' });
        }

        await prisma.partnerInvite.update({
            where: { id: inviteId },
            data: { status: 'DECLINED' },
        });

        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

/**
 * DELETE /partner/invites/:id
 * Cancel a sent partner invitation
 */
router.delete('/invites/:id', async (req, res, next) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const inviteId = req.params.id;

        const invite = await prisma.partnerInvite.findFirst({
            where: {
                id: inviteId,
                fromUserId: userId,
                status: 'PENDING',
            },
        });

        if (!invite) {
            return res.status(404).json({ error: 'Invite not found or already processed' });
        }

        await prisma.partnerInvite.delete({
            where: { id: inviteId },
        });

        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /partner
 * Get current partner info (basic info for now, kcal data later)
 */
router.get('/', async (req, res, next) => {
    try {
        const userId = (req as AuthRequest).user!.id;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                partner: {
                    select: {
                        id: true,
                        displayName: true,
                        email: true,
                        units: true,
                        weightKg: true,
                        weightLbs: true,
                        goalTarget: true,
                        goalTargetLbs: true,
                        goalStart: true,
                        goalStartLbs: true,
                        goalType: true,
                        plan: {
                            select: {
                                weightKg: true,
                                targetWeightKg: true,
                                weightToLoseKg: true,
                                goalType: true,
                                weeklyPlans: {
                                    select: {
                                        expectedWeight: true,
                                        week: true,
                                    },
                                    orderBy: {
                                        week: 'asc',
                                    },
                                    take: 1,
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!user.partner) {
            return res.json({ hasPartner: false, partner: null, partnerHasOnboardingRewards: false });
        }

        const partnerRewardPreference = await prisma.onboardingRewardPreference.findUnique({
            where: { userId: user.partner.id },
            select: {
                week1RewardId: true,
                week2RewardId: true,
                week3RewardId: true,
                skipped: true,
            },
        });

        const partnerHasOnboardingRewards = !!(
            partnerRewardPreference &&
            !partnerRewardPreference.skipped &&
            (
                partnerRewardPreference.week1RewardId ||
                partnerRewardPreference.week2RewardId ||
                partnerRewardPreference.week3RewardId
            )
        );

        const partnerJourney = getPartnerJourneySnapshot(user.partner);

        res.json({
            hasPartner: true,
            partner: {
                id: user.partner.id,
                displayName: user.partner.displayName,
                email: user.partner.email,
                currentWeight: partnerJourney.currentWeight,
                weightUnit: partnerJourney.unit,
                weightLost: partnerJourney.weightLost,
                primaryGoal: partnerJourney.primaryGoal,
            },
            partnerHasOnboardingRewards,
        });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /partner/disconnect
 * Disconnect from current partner
 */
router.post('/disconnect', async (req, res, next) => {
    try {
        const userId = (req as AuthRequest).user!.id;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { partnerId: true },
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!user.partnerId) {
            return res.status(400).json({ error: 'You do not have a partner' });
        }

        const partnerId = user.partnerId;

        // Clear partnerId on both users
        await prisma.$transaction([
            prisma.user.update({
                where: { id: userId },
                data: { partnerId: null },
            }),
            prisma.user.update({
                where: { id: partnerId },
                data: { partnerId: null },
            }),
        ]);

        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

export default router;
