import { Router } from 'express';
import { z } from 'zod';
import prisma from '../db/prisma';
import { AuthRequest } from '../middleware/auth';
import { presentUser } from './presenters';
import { mergeNotificationPreferences, normalizeNotificationPreferences } from '../lib/notificationPreferences';

const router = Router();

const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  age: z.coerce.number().int().positive().max(120).optional(),
  gender: z.enum(['male', 'female']).optional(),
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
const devicePushTokenSchema = z.object({
  devicePushToken: z.string().min(1).max(255).nullable(),
});
const liveActivityTokenSchema = z.object({
  activityType: z.string().min(1).max(64),
  pushToken: z.string().min(1).max(512),
  activityInstanceId: z.string().min(1).max(255).optional().nullable(),
  partnerId: z.string().uuid().optional().nullable(),
});
const deleteLiveActivityTokenSchema = z.object({
  activityType: z.string().min(1).max(64).optional(),
  pushToken: z.string().min(1).max(512).optional(),
  activityInstanceId: z.string().min(1).max(255).optional(),
}).partial();

const notificationPreferencesSchema = z.object({
  preferences: z.object({
    partnerChat: z.boolean().optional(),
    raceInvite: z.boolean().optional(),
    raceUpdates: z.boolean().optional(),
    scheduledRunReminder: z.boolean().optional(),
    partnerInviteAccepted: z.boolean().optional(),
    dailyPlanReminder: z.boolean().optional(),
    mealLoggingReminder: z.boolean().optional(),
    stepTargetReminder: z.boolean().optional(),
    weeklyQuestReminder: z.boolean().optional(),
    billingReminder: z.boolean().optional(),
  }),
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

router.post('/device-push-token', async (req: AuthRequest, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const { devicePushToken } = devicePushTokenSchema.parse(req.body);

    await (prisma as any).user.update({
      where: { id: req.user.id },
      data: {
        apnsDeviceToken: devicePushToken,
        apnsDeviceTokenUpdatedAt: devicePushToken ? new Date() : null,
      },
    });

    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

router.delete('/device-push-token', async (req: AuthRequest, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    await (prisma as any).user.update({
      where: { id: req.user.id },
      data: {
        apnsDeviceToken: null,
        apnsDeviceTokenUpdatedAt: null,
      },
    });

    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

router.post('/live-activity-token', async (req: AuthRequest, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const { activityType, pushToken, activityInstanceId, partnerId } = liveActivityTokenSchema.parse(req.body);

    await (prisma as any).liveActivitySession.upsert({
      where: { pushToken },
      update: {
        userId: req.user.id,
        activityType,
        activityInstanceId: activityInstanceId ?? null,
        partnerId: partnerId ?? null,
        endedAt: null,
      },
      create: {
        userId: req.user.id,
        activityType,
        activityInstanceId: activityInstanceId ?? null,
        partnerId: partnerId ?? null,
        pushToken,
      },
    });

    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

router.delete('/live-activity-token', async (req: AuthRequest, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const body = deleteLiveActivityTokenSchema.safeParse(req.body ?? {});
    const filters = body.success ? body.data : {};

    await (prisma as any).liveActivitySession.updateMany({
      where: {
        userId: req.user.id,
        ...(filters.activityType ? { activityType: filters.activityType } : {}),
        ...(filters.pushToken ? { pushToken: filters.pushToken } : {}),
        ...(filters.activityInstanceId ? { activityInstanceId: filters.activityInstanceId } : {}),
        endedAt: null,
      },
      data: {
        endedAt: new Date(),
      },
    });

    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

router.post('/notification-preferences', async (req: AuthRequest, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const { preferences } = notificationPreferencesSchema.parse(req.body);
    const existingUser = await (prisma as any).user.findUnique({
      where: { id: req.user.id },
      select: { notificationPreferences: true },
    });

    const mergedPreferences = mergeNotificationPreferences(existingUser?.notificationPreferences, preferences);

    const user = await (prisma as any).user.update({
      where: { id: req.user.id },
      data: { notificationPreferences: mergedPreferences },
      include: { billingProfile: true },
    });

    return res.json({
      ok: true,
      preferences: normalizeNotificationPreferences(user.notificationPreferences),
      user: presentUser(user),
    });
  } catch (err) {
    return next(err);
  }
});

router.delete('/', async (req: AuthRequest, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    await prisma.$transaction(async (rawTx) => {
      const tx = rawTx as any;
      const userId = req.user!.id;

      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, partnerId: true },
      });

      if (!user) {
        throw Object.assign(new Error('User not found'), { status: 404 });
      }

      const mealLogs = await tx.mealLog.findMany({
        where: { userId },
        select: { id: true },
      });

      const usersToUnlink = [user.partnerId, userId].filter(Boolean);

      if (usersToUnlink.length > 0) {
        await tx.user.updateMany({
          where: {
            OR: [
              { id: { in: usersToUnlink } },
              { partnerId: userId },
            ],
          },
          data: { partnerId: null },
        });
      }

      await tx.chatMessage.deleteMany({
        where: {
          OR: [{ fromUserId: userId }, { toUserId: userId }],
        },
      });

      await tx.partnerInvite.deleteMany({
        where: {
          OR: [{ fromUserId: userId }, { toUserId: userId }],
        },
      });

      await tx.dailyStep.deleteMany({ where: { userId } });
      await tx.stepSyncEvent.deleteMany({ where: { userId } });

      if (mealLogs.length > 0) {
        const mealIds = mealLogs.map((meal: { id: string }) => meal.id);
        await tx.mealItem.deleteMany({
          where: { mealId: { in: mealIds } },
        });
      }

      await tx.mealLog.deleteMany({ where: { userId } });
      await tx.userPlan.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });
    });

    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

export default router;
