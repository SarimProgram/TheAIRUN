import { prisma } from '../db/prisma';
import { sendBackgroundWakePush, sendLiveActivityState } from './apns';

export type PartnerLivePayload = {
  userName: string;
  userKcal: number;
  userGoal: number;
  userSteps: number;
  partnerName: string;
  partnerKcal: number;
  partnerGoal: number;
  partnerSteps: number;
  updatedAt: string;
  status?: 'connected' | 'no_partner' | 'stale';
  staleReason?: string | null;
};

const DEFAULT_CALORIE_TARGET = 2000;

function getDayKey(date: Date = new Date(), timezone?: string): string {
  if (timezone) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);

    const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
    const month = parts.find((part) => part.type === 'month')?.value ?? '01';
    const day = parts.find((part) => part.type === 'day')?.value ?? '01';
    return `${year}-${month}-${day}`;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dayKeyToUtcDate(dayKey: string) {
  const [year, month, day] = dayKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

function firstPositiveInt(...values: Array<number | null | undefined>) {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.round(parsed);
    }
  }

  return 0;
}

async function loadParticipantState(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      displayName: true,
      timezone: true,
      plan: {
        select: {
          dailyCalorieTarget: true,
        },
      },
    },
  });

  if (!user) {
    return null;
  }

  const timezone = user.timezone || 'UTC';
  const dayKey = getDayKey(new Date(), timezone);
  const [summary, dailyStep] = await Promise.all([
    prisma.dailySummary.findUnique({
      where: {
        userId_dayKey: {
          userId,
          dayKey,
        },
      },
      select: {
        calorieTarget: true,
        consumedCalories: true,
        steps: true,
      },
    }),
    prisma.dailyStep.findUnique({
      where: {
        userId_date: {
          userId,
          date: dayKeyToUtcDate(dayKey),
        },
      },
      select: {
        steps: true,
      },
    }),
  ]);

  return {
    id: user.id,
    displayName: user.displayName,
    calorieTarget: firstPositiveInt(
      summary?.calorieTarget,
      user.plan?.dailyCalorieTarget,
      DEFAULT_CALORIE_TARGET,
    ),
    consumedCalories: summary?.consumedCalories ?? 0,
    steps: Math.max(summary?.steps ?? 0, dailyStep?.steps ?? 0),
  };
}

export async function buildPartnerLivePayloadForUser(userId: string): Promise<PartnerLivePayload | null> {
  const viewer = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      displayName: true,
      partnerId: true,
      partner: {
        select: {
          id: true,
          displayName: true,
        },
      },
    },
  });

  if (!viewer) {
    return null;
  }

  const viewerState = await loadParticipantState(viewer.id);
  if (!viewerState) {
    return null;
  }

  if (!viewer.partnerId || !viewer.partner) {
    return {
      userName: viewerState.displayName || 'You',
      userKcal: viewerState.consumedCalories,
      userGoal: viewerState.calorieTarget,
      userSteps: viewerState.steps,
      partnerName: 'Partner',
      partnerKcal: 0,
      partnerGoal: 0,
      partnerSteps: 0,
      updatedAt: new Date().toISOString(),
      status: 'no_partner',
      staleReason: 'no_partner',
    };
  }

  const partnerState = await loadParticipantState(viewer.partner.id);
  if (!partnerState) {
    return {
      userName: viewerState.displayName || 'You',
      userKcal: viewerState.consumedCalories,
      userGoal: viewerState.calorieTarget,
      userSteps: viewerState.steps,
      partnerName: viewer.partner.displayName || 'Partner',
      partnerKcal: 0,
      partnerGoal: 0,
      partnerSteps: 0,
      updatedAt: new Date().toISOString(),
      status: 'stale',
      staleReason: 'partner_missing_state',
    };
  }

  return {
    userName: viewerState.displayName || 'You',
    userKcal: viewerState.consumedCalories,
    userGoal: viewerState.calorieTarget,
    userSteps: viewerState.steps,
    partnerName: partnerState.displayName || 'Partner',
    partnerKcal: partnerState.consumedCalories,
    partnerGoal: partnerState.calorieTarget,
    partnerSteps: partnerState.steps,
    updatedAt: new Date().toISOString(),
    status: 'connected',
    staleReason: null,
  };
}

function isApnsTokenExpired(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('BadDeviceToken') ||
    message.includes('Unregistered') ||
    message.includes('410') ||
    message.includes('ExpiredProviderToken')
  );
}

async function pushPartnerSurfaceUpdateForViewer(userId: string, reason: string) {
  const payload = await buildPartnerLivePayloadForUser(userId);
  if (!payload) {
    return;
  }

  const [user, sessions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        apnsDeviceToken: true,
      },
    }),
    prisma.liveActivitySession.findMany({
      where: {
        userId,
        activityType: 'partner_surface',
        endedAt: null,
      },
      select: {
        id: true,
        pushToken: true,
      },
    }),
  ]);

  if (payload.status === 'connected') {
    await Promise.allSettled(
      sessions.map(async (session) => {
        try {
          await sendLiveActivityState({
            pushToken: session.pushToken,
            payload,
            event: 'update',
          });
        } catch (error) {
          if (isApnsTokenExpired(error)) {
            await prisma.liveActivitySession.update({
              where: { id: session.id },
              data: { endedAt: new Date() },
            });
          }
        }
      }),
    );
  } else if (sessions.length > 0) {
    await Promise.allSettled(
      sessions.map(async (session) => {
        try {
          await sendLiveActivityState({
            pushToken: session.pushToken,
            payload,
            event: 'end',
          });
        } finally {
          await prisma.liveActivitySession.update({
            where: { id: session.id },
            data: { endedAt: new Date() },
          });
        }
      }),
    );
  }

  if (user?.apnsDeviceToken) {
    try {
      await sendBackgroundWakePush({
        deviceToken: user.apnsDeviceToken,
        data: {
          type: 'partner_live_state_changed',
          reason,
        },
      });
    } catch (error) {
      if (isApnsTokenExpired(error)) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            apnsDeviceToken: null,
            apnsDeviceTokenUpdatedAt: null,
          },
        });
      }
    }
  }
}

export async function pushPartnerSurfaceUpdateForChangedUser(userId: string, reason = 'state_changed') {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      partnerId: true,
    },
  });

  const affectedUserIds = [userId, user?.partnerId].filter((value): value is string => Boolean(value));
  await Promise.allSettled(
    [...new Set(affectedUserIds)].map((targetUserId) =>
      pushPartnerSurfaceUpdateForViewer(targetUserId, reason),
    ),
  );
}
