import { Router } from 'express';
import { z } from 'zod';
import prisma from '../db/prisma';
import { AuthRequest } from '../middleware/auth';
import { presentUser } from './presenters';

const router = Router();

const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  age: z.coerce.number().int().positive().max(120).optional(),
  gender: z.string().min(1).max(50).optional(),
  heightCm: z.coerce.number().positive().max(300).optional(),
  weightKg: z.coerce.number().positive().max(500).optional(),
  timezone: z.string().min(1).max(100).optional(),
  units: z.enum(['metric', 'imperial']).optional(),
  partnerId: z.string().uuid().optional().nullable(),

  // New and goal fields
  goalType: z.string().optional(),
  goalTarget: z.coerce.number().optional(),
  heightFt: z.coerce.number().int().optional(),
  heightIn: z.coerce.number().int().optional(),
  weightLbs: z.coerce.number().optional(),
  goalTargetLbs: z.coerce.number().optional(),
  goalStartLbs: z.coerce.number().optional(),
});

const pushTokenSchema = z.object({
  pushToken: z.string().min(1).max(255).nullable(),
});

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const user = await (prisma as any).user.findUnique({
      where: { id: req.user.id },
      include: { billingProfile: true },
    });
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json({ user: presentUser(user) });
  } catch (err) {
    return next(err);
  }
});

router.post('/', async (req: AuthRequest, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const body = updateProfileSchema.parse(req.body);

    const user = await (prisma as any).user.update({
      where: { id: req.user.id },
      data: body,
      include: { billingProfile: true },
    });

    if (body.timezone) {
      // Update timezone in all daily summaries for this user to keep it consistent
      await prisma.dailySummary.updateMany({
        where: { userId: req.user.id },
        data: { timezone: body.timezone }
      });
    }

    return res.json({ user: presentUser(user) });
  } catch (err) {
    return next(err);
  }
});

router.post('/push-token', async (req: AuthRequest, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const { pushToken } = pushTokenSchema.parse(req.body);

    await (prisma as any).user.update({
      where: { id: req.user.id },
      data: {
        expoPushToken: pushToken,
        expoPushTokenUpdatedAt: pushToken ? new Date() : null,
      },
    });

    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

router.delete('/push-token', async (req: AuthRequest, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    await (prisma as any).user.update({
      where: { id: req.user.id },
      data: {
        expoPushToken: null,
        expoPushTokenUpdatedAt: null,
      },
    });

    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

export default router;
