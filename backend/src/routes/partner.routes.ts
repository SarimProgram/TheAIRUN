// src/routes/partner.routes.ts
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import {
    beginPartnerSharedGraceForPair,
    getOrCreateBillingProfile,
    getPartnerPlanSummary,
    syncPartnerSharedAccessForPair,
} from '../services/billing';
import { promoteToPairOnboardingRewards } from '../services/onboardingRewards';
import { sendPartnerInviteAcceptedPush } from '../lib/pushNotifications';
import { pushPartnerSurfaceUpdateForChangedUser } from '../lib/partnerSurface';
import {
    normalizeRecipientEmail,
    partnerInvitationEmailService,
} from '../services/email/partnerInvitationEmail';
import {
    normalizeInviteCode,
    toInviteCode,
} from '../services/partnerInvites';
import partnerMemoriesRouter from './partnerMemories.routes';

const publicPartnerRouter = Router();

const LookupInviteCodeSchema = z.object({
    code: z.string().trim().min(1).transform(normalizeInviteCode),
});

const router = Router();

// All routes require authentication
router.use(authMiddleware);

router.use('/memories', partnerMemoriesRouter);

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

type PartnerWeightTimelineEntry = {
    id: string;
    weightKg: number;
    loggedAt: Date;
};

function displayWeightToKg(weight: number, usesImperial: boolean) {
    return usesImperial ? weight / 2.20462 : weight;
}

function resolvePartnerWeightTimelineEntries(
    partner: {
        id: string;
        units: string | null;
        createdAt: Date;
        updatedAt: Date;
    },
    partnerJourney: ReturnType<typeof getPartnerJourneySnapshot>,
    storedEntries: PartnerWeightTimelineEntry[],
): PartnerWeightTimelineEntry[] {
    if (storedEntries.length > 0) {
        return storedEntries;
    }

    const { weightLost, startWeight, currentWeight } = partnerJourney;
    if (
        weightLost == null ||
        weightLost < 0.05 ||
        startWeight == null ||
        currentWeight == null
    ) {
        return storedEntries;
    }

    const usesImperial = partner.units === 'imperial';
    const startKg = displayWeightToKg(startWeight, usesImperial);
    const currentKg = displayWeightToKg(currentWeight, usesImperial);
    if (startKg - currentKg < 0.05) {
        return storedEntries;
    }

    return [
        {
            id: `journey-start-${partner.id}`,
            weightKg: startKg,
            loggedAt: partner.createdAt,
        },
        {
            id: `journey-current-${partner.id}`,
            weightKg: currentKg,
            loggedAt: partner.updatedAt,
        },
    ];
}

function presentPartnerWeightHistory(entries: PartnerWeightTimelineEntry[]) {
    return entries.map((entry) => ({
        id: entry.id,
        weightKg: entry.weightKg,
        loggedAt: entry.loggedAt.toISOString(),
    }));
}

const PARTNER_POINTS_CATEGORY_LABELS: Record<string, string> = {
    WALK_RUN: 'Walk / Run',
    STEPS: 'Steps',
    CALORIES: 'Nutrition',
    MOBILITY: 'Mobility',
    HYDRATION: 'Hydration',
};

/**
 * POST /partner/invite
 * Send a partner invitation by email
 */
const InviteSchema = z.object({
    email: z.string().trim().email().transform(normalizeRecipientEmail),
});

async function deliverPartnerInvitationEmail(invite: {
    id: string;
    toEmail: string;
}, inviterDisplayName: string) {
    return partnerInvitationEmailService.sendInvitation({
        invitationId: invite.id,
        toEmail: invite.toEmail,
        inviterDisplayName,
        invitationCode: toInviteCode(invite.id),
    });
}

const ReportChatSchema = z.object({
    messageId: z.string().uuid().optional(),
    reason: z.string().trim().min(1).max(80).optional(),
    details: z.string().trim().min(1).max(500).optional(),
});

const BlockPartnerSchema = z.object({
    reason: z.string().trim().min(1).max(120).optional(),
});

async function findBlockRelationship(userId: string, otherUserId: string) {
    return prisma.userBlock.findFirst({
        where: {
            OR: [
                { blockerId: userId, blockedId: otherUserId },
                { blockerId: otherUserId, blockedId: userId },
            ],
        },
        select: {
            id: true,
            blockerId: true,
            blockedId: true,
        },
    });
}

router.post('/invite', async (req, res, next) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const { email } = InviteSchema.parse(req.body);

        // Get current user
        const currentUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { email: true, displayName: true, partnerId: true },
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
        const targetUser = await prisma.user.findFirst({
            where: { email: { equals: email, mode: 'insensitive' } },
            select: { id: true, partnerId: true },
        });

        // If target already has a partner
        if (targetUser?.partnerId) {
            return res.status(400).json({ error: 'This user already has a partner' });
        }

        if (targetUser?.id) {
            const blockRelationship = await findBlockRelationship(userId, targetUser.id);
            if (blockRelationship) {
                return res.status(403).json({ error: 'Partner invites are not available for this user' });
            }
        }

        // Check for existing pending invite from the other person first
        if (targetUser?.id) {
            const reverseInvite = await prisma.partnerInvite.findFirst({
                where: {
                    fromUserId: targetUser.id,
                    toEmail: { equals: normalizeRecipientEmail(currentUser.email), mode: 'insensitive' },
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
                toEmail: { equals: email, mode: 'insensitive' },
            },
        });

        if (existingInvite) {
            if (existingInvite.status === 'PENDING') {
                const emailDelivery = await deliverPartnerInvitationEmail(
                    existingInvite,
                    currentUser.displayName
                );
                return res.status(200).json({
                    success: true,
                    emailDelivery,
                    invite: {
                        id: existingInvite.id,
                        code: toInviteCode(existingInvite.id),
                        toEmail: existingInvite.toEmail,
                        status: existingInvite.status,
                        createdAt: existingInvite.createdAt,
                    },
                });
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

            const emailDelivery = await deliverPartnerInvitationEmail(
                invite,
                currentUser.displayName
            );

            return res.status(200).json({
                success: true,
                emailDelivery,
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

        const emailDelivery = await deliverPartnerInvitationEmail(
            invite,
            currentUser.displayName
        );

        res.status(201).json({
            success: true,
            emailDelivery,
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

        const invitesWithPlanSummary = await Promise.all(
            invites.map(async (invite) => {
                let planSummary = null;
                if (invite.fromUser?.id) {
                    const billingProfile = await getOrCreateBillingProfile(invite.fromUser.id);
                    planSummary = getPartnerPlanSummary(billingProfile);
                }

                return {
                    ...invite,
                    code: toInviteCode(invite.id),
                    fromUser: invite.fromUser
                        ? {
                            id: invite.fromUser.id,
                            displayName: invite.fromUser.displayName,
                            email: invite.fromUser.email,
                            journey: getPartnerJourneySnapshot(invite.fromUser),
                            planSummary,
                        }
                        : null,
                };
            })
        );

        res.json({ invites: invitesWithPlanSummary });
    } catch (err) {
        next(err);
    }
});

const lookupInviteFromUserSelect = {
    id: true,
    displayName: true,
    partnerId: true,
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
                orderBy: { week: 'asc' as const },
                take: 1,
            },
        },
    },
} as const;

/**
 * POST /partner/invites/lookup
 * Resolve a pending invite from its 8-character code (no auth required)
 */
publicPartnerRouter.post('/invites/lookup', async (req, res, next) => {
    try {
        const { code } = LookupInviteCodeSchema.parse(req.body);

        if (code.length !== 8) {
            return res.status(400).json({ error: 'Codes must be 8 characters.' });
        }

        const invite = await prisma.partnerInvite.findFirst({
            where: {
                id: { startsWith: code.toLowerCase() },
                status: 'PENDING',
            },
            include: {
                fromUser: {
                    select: lookupInviteFromUserSelect,
                },
            },
        });

        if (!invite) {
            return res.status(404).json({ error: 'No invite found for this code.' });
        }

        if (invite.fromUser?.partnerId) {
            return res.status(400).json({ error: 'This partner invite is no longer available.' });
        }

        res.json({
            invite: {
                id: invite.id,
                code: toInviteCode(invite.id),
                toEmail: invite.toEmail,
                fromUser: invite.fromUser
                    ? {
                        id: invite.fromUser.id,
                        displayName: invite.fromUser.displayName,
                        journey: getPartnerJourneySnapshot(invite.fromUser),
                    }
                    : null,
            },
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
            },
            include: {
                fromUser: { select: { id: true, partnerId: true, displayName: true } },
            },
        });

        if (!invite) {
            return res.status(404).json({ error: 'Invite not found or already processed' });
        }

        if (invite.fromUserId === userId) {
            return res.status(400).json({ error: 'You cannot accept your own invite' });
        }

        if (invite.fromUser.partnerId) {
            // The sender already has a partner (maybe from another invite)
            await prisma.partnerInvite.update({
                where: { id: inviteId },
                data: { status: 'DECLINED' },
            });
            return res.status(400).json({ error: 'The inviter already has a partner' });
        }

        const blockRelationship = await findBlockRelationship(userId, invite.fromUserId);
        if (blockRelationship) {
            await prisma.partnerInvite.update({
                where: { id: inviteId },
                data: { status: 'DECLINED' },
            });
            return res.status(403).json({ error: 'You cannot accept an invite from this user' });
        }

        const linkedAt = new Date();

        // Accept: link both users as partners and sync shared premium metadata.
        await prisma.$transaction(async (tx) => {
            await tx.partnerInvite.update({
                where: { id: inviteId },
                data: {
                    status: 'ACCEPTED',
                    toUserId: userId,
                },
            });

            await tx.user.update({
                where: { id: userId },
                data: {
                    partnerId: invite.fromUserId,
                    partnerLinkedAt: linkedAt,
                },
            });

            await tx.user.update({
                where: { id: invite.fromUserId },
                data: {
                    partnerId: userId,
                    partnerLinkedAt: linkedAt,
                },
            });

            await tx.partnerInvite.updateMany({
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
            });

            await syncPartnerSharedAccessForPair(userId, invite.fromUserId, tx);
        });

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

        sendPartnerInviteAcceptedPush({
            toUserId: invite.fromUserId,
            partnerName: invite.fromUser.displayName,
        }).catch((pushErr) => {
            console.error('[Partner] Invite accepted push error:', pushErr);
        });

        res.json({
            success: true,
            partnerId: invite.fromUserId,
            partnerName: invite.fromUser.displayName,
        });

        void Promise.allSettled([
            pushPartnerSurfaceUpdateForChangedUser(userId, 'partner_connected'),
            pushPartnerSurfaceUpdateForChangedUser(invite.fromUserId, 'partner_connected'),
        ]);
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
            select: {
                partnerLinkedAt: true,
                partner: {
                    select: {
                        id: true,
                        displayName: true,
                        gender: true,
                        email: true,
                        units: true,
                        createdAt: true,
                        updatedAt: true,
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
                        points: {
                            select: {
                                balance: true,
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
        const partnerBillingProfile = await getOrCreateBillingProfile(user.partner.id);
        const partnerPlanSummary = getPartnerPlanSummary(partnerBillingProfile);
        const partnerWeightHistory = resolvePartnerWeightTimelineEntries(
            user.partner,
            partnerJourney,
            await prisma.weightHistory.findMany({
                where: { userId: user.partner.id },
                orderBy: { loggedAt: 'desc' },
                take: 60,
            }),
        );

        res.json({
            hasPartner: true,
            partnerLinkedAt: user.partnerLinkedAt?.toISOString() ?? null,
            partner: {
                id: user.partner.id,
                displayName: user.partner.displayName,
                gender: user.partner.gender,
                email: user.partner.email,
                currentWeight: partnerJourney.currentWeight,
                weightUnit: partnerJourney.unit,
                weightLost: partnerJourney.weightLost,
                startWeight: partnerJourney.startWeight,
                primaryGoal: partnerJourney.primaryGoal,
                points: user.partner.points?.balance ?? 0,
                pointsBalance: user.partner.points?.balance ?? 0,
                planSummary: partnerPlanSummary,
            },
            partnerWeightHistory: presentPartnerWeightHistory(partnerWeightHistory),
            partnerHasOnboardingRewards,
        });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /partner/points-history
 * Get recent points ledger entries for the current user's partner
 */
router.get('/points-history', async (req, res, next) => {
    try {
        const userId = (req as AuthRequest).user!.id;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                partner: {
                    select: {
                        id: true,
                        displayName: true,
                    },
                },
            },
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!user.partner) {
            return res.json({
                partnerId: null,
                partnerDisplayName: null,
                entries: [],
            });
        }

        const entries = await prisma.dailyPointsLedger.findMany({
            where: { userId: user.partner.id },
            orderBy: [{ awardedAt: 'desc' }, { dayKey: 'desc' }],
        });

        res.json({
            partnerId: user.partner.id,
            partnerDisplayName: user.partner.displayName,
            entries: entries.map((entry) => ({
                dayKey: entry.dayKey,
                awardedAt: entry.awardedAt,
                category: entry.category,
                categoryLabel: PARTNER_POINTS_CATEGORY_LABELS[entry.category] ?? entry.category,
                earnedPoints: entry.earnedPoints,
                maxPoints: entry.maxPoints,
                progress: entry.progress,
            })),
        });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /partner/weight-history
 * Get recent weight history entries for the current user's partner
 */
router.get('/weight-history', async (req, res, next) => {
    try {
        const userId = (req as AuthRequest).user!.id;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                partner: {
                    select: {
                        id: true,
                        displayName: true,
                        units: true,
                        createdAt: true,
                        updatedAt: true,
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
            return res.json({
                partnerId: null,
                partnerDisplayName: null,
                entries: [],
            });
        }

        const partnerJourney = getPartnerJourneySnapshot(user.partner);
        const entries = resolvePartnerWeightTimelineEntries(
            user.partner,
            partnerJourney,
            await prisma.weightHistory.findMany({
                where: { userId: user.partner.id },
                orderBy: { loggedAt: 'desc' },
                take: 60,
            }),
        );

        res.json({
            partnerId: user.partner.id,
            partnerDisplayName: user.partner.displayName,
            entries: presentPartnerWeightHistory(entries),
        });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /partner/chat/report
 * Report the current partner chat for moderation review
 */
router.post('/chat/report', async (req, res, next) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const { messageId, reason, details } = ReportChatSchema.parse(req.body);

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { partnerId: true },
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!user.partnerId) {
            return res.status(400).json({ error: 'You do not have a partner to report' });
        }

        if (messageId) {
            const message = await prisma.chatMessage.findFirst({
                where: {
                    id: messageId,
                    OR: [
                        { fromUserId: userId, toUserId: user.partnerId },
                        { fromUserId: user.partnerId, toUserId: userId },
                    ],
                },
                select: { id: true },
            });

            if (!message) {
                return res.status(404).json({ error: 'Message not found for this partner chat' });
            }
        }

        await prisma.chatReport.create({
            data: {
                reporterId: userId,
                reportedUserId: user.partnerId,
                messageId: messageId ?? null,
                reason: reason ?? 'partner_chat_report',
                details: details
                    ? {
                        source: 'partner_chat_header',
                        text: details,
                    }
                    : {
                        source: 'partner_chat_header',
                    },
            },
        });

        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /partner/chat/block
 * Block the current partner and immediately disconnect the relationship
 */
router.post('/chat/block', async (req, res, next) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const { reason } = BlockPartnerSchema.parse(req.body);

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                email: true,
                partnerId: true,
                partner: {
                    select: {
                        email: true,
                    },
                },
            },
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!user.partnerId || !user.partner?.email) {
            return res.status(400).json({ error: 'You do not have a partner to block' });
        }

        const partnerId = user.partnerId;
        const userEmail = user.email.toLowerCase();
        const partnerEmail = user.partner.email.toLowerCase();

        await prisma.$transaction(async (tx) => {
            await beginPartnerSharedGraceForPair(userId, partnerId, tx);

            await tx.userBlock.upsert({
                where: {
                    blockerId_blockedId: {
                        blockerId: userId,
                        blockedId: partnerId,
                    },
                },
                create: {
                    blockerId: userId,
                    blockedId: partnerId,
                    reason: reason ?? 'partner_chat_blocked',
                },
                update: {
                    reason: reason ?? 'partner_chat_blocked',
                },
            });

            await tx.user.update({
                where: { id: userId },
                data: { partnerId: null, partnerLinkedAt: null },
            });

            await tx.user.update({
                where: { id: partnerId },
                data: { partnerId: null, partnerLinkedAt: null },
            });

            await tx.partnerInvite.updateMany({
                where: {
                    status: 'PENDING',
                    OR: [
                        { fromUserId: userId, toUserId: partnerId },
                        { fromUserId: partnerId, toUserId: userId },
                        { fromUserId: userId, toEmail: partnerEmail },
                        { fromUserId: partnerId, toEmail: userEmail },
                    ],
                },
                data: { status: 'DECLINED' },
            });
        });

        res.json({ success: true, blockedUserId: partnerId });
        void Promise.allSettled([
            pushPartnerSurfaceUpdateForChangedUser(userId, 'partner_blocked'),
            pushPartnerSurfaceUpdateForChangedUser(partnerId, 'partner_blocked'),
        ]);
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

        await prisma.$transaction(async (tx) => {
            await beginPartnerSharedGraceForPair(userId, partnerId, tx);

            await tx.user.update({
                where: { id: userId },
                data: { partnerId: null, partnerLinkedAt: null },
            });

            await tx.user.update({
                where: { id: partnerId },
                data: { partnerId: null, partnerLinkedAt: null },
            });
        });

        res.json({ success: true });
        void Promise.allSettled([
            pushPartnerSurfaceUpdateForChangedUser(userId, 'partner_disconnected'),
            pushPartnerSurfaceUpdateForChangedUser(partnerId, 'partner_disconnected'),
        ]);
    } catch (err) {
        next(err);
    }
});

export { publicPartnerRouter };
export default router;
