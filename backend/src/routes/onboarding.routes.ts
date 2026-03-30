import { Router } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';
import prisma from '../db/prisma';
import { syncUserScopedOnboardingRewards } from '../services/onboardingRewards';

const router = Router();

const rewardPreferenceSchema = z.object({
  week1RewardId: z.string().min(1).max(50).optional().nullable(),
  week2RewardId: z.string().min(1).max(50).optional().nullable(),
  week3RewardId: z.string().min(1).max(50).optional().nullable(),
  skipped: z.boolean().optional(),
});

router.post('/rewards/preferences', async (req: AuthRequest, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const body = rewardPreferenceSchema.parse(req.body);
    const week1RewardId = body.week1RewardId ?? null;
    const week2RewardId = body.week2RewardId ?? null;
    const week3RewardId = body.week3RewardId ?? null;
    const skipped = body.skipped ?? false;

    const preference = await prisma.onboardingRewardPreference.upsert({
      where: { userId: req.user.id },
      update: { week1RewardId, week2RewardId, week3RewardId, skipped },
      create: { userId: req.user.id, week1RewardId, week2RewardId, week3RewardId, skipped },
    });

    await syncUserScopedOnboardingRewards(req.user.id, {
      week1RewardId,
      week2RewardId,
      week3RewardId,
      skipped,
    });

    return res.json({ success: true, preference });
  } catch (err) {
    return next(err);
  }
});

export default router;

