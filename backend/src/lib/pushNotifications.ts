import { prisma } from '../db/prisma';
import { startLiveActivity } from './apns';
import { MEAL_PLATE_PATTERN, MEAL_REPLY_PATTERN, mealLabel } from './mealPassMessage';
import {
  isRemoteNotificationEnabled,
  type RemoteNotificationPreferenceKey,
} from './notificationPreferences';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

type PushDataValue = string | number | boolean | null;
type PushData = Record<string, PushDataValue>;

function isExpoPushToken(token?: string | null): token is string {
  return !!token && /^(ExponentPushToken|ExpoPushToken)\[.+\]$/.test(token);
}

async function sendExpoPush(params: {
  to: string;
  title: string;
  body: string;
  data: PushData;
  channelId?: string;
}) {
  const { to, title, body, data, channelId = 'messages' } = params;

  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to,
      sound: 'default',
      title,
      body,
      data,
      channelId,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Expo push failed: ${response.status} ${errorText}`);
  }

  const result = await response.json();
  if (Array.isArray(result?.data) && result.data.some((item: any) => item.status === 'error')) {
    throw new Error(`Expo push rejected token: ${JSON.stringify(result.data)}`);
  }
}

export async function sendNotificationToUser(params: {
  userId: string;
  preferenceKey: RemoteNotificationPreferenceKey;
  title: string;
  body: string;
  data: PushData;
  channelId?: string;
}) {
  const { userId, preferenceKey, title, body, data, channelId } = params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      expoPushToken: true,
      notificationPreferences: true,
    },
  });

  if (!user || !isRemoteNotificationEnabled(user.notificationPreferences, preferenceKey)) {
    return;
  }

  if (!isExpoPushToken(user.expoPushToken)) {
    return;
  }

  await sendExpoPush({
    to: user.expoPushToken,
    title,
    body,
    data,
    channelId,
  });
}

function formatChatPushBody(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) return 'New partner message';

  if (trimmed.startsWith('[CUSTOM:v1]')) {
    try {
      const payload = JSON.parse(trimmed.slice('[CUSTOM:v1]'.length));
      const text = typeof payload.text === 'string' ? payload.text.trim() : '';
      const title = typeof payload.title === 'string' ? payload.title.trim() : '';
      return text || title || 'New partner reminder';
    } catch {
      return 'New partner reminder';
    }
  }

  const stripped = trimmed.replace(
    /^\[(?:STEPS|KCAL|WATER)\s*:\s*(?:hearts|angry|cat|bottle(?:\s*:\s*\d+)?|photo\s*:[\w-]+)\]\s*/i,
    '',
  );
  if (stripped !== trimmed) {
    return stripped.trim() || 'New partner reminder';
  }

  const plain = trimmed.replace(/^\[(?:STEPS|KCAL|WATER)\]\s*/i, '');
  return plain.trim() || trimmed;
}

const BOTTLE_THROW_PATTERN = /^\[WATER\s*:\s*bottle(?:\s*:\s*\d{1,3})?\]/i;
/** Must match `createLiveActivity('BottleLiveActivity', ...)` in the app. */
const BOTTLE_LIVE_ACTIVITY_NAME = 'BottleLiveActivity';
const BOTTLE_LIVE_ACTIVITY_STALE_SECONDS = 8 * 60 * 60;

async function startBottleLiveActivity(params: {
  toUserId: string;
  fromName: string;
  messageId: string;
  createdAt: string;
}): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: params.toUserId },
    select: { liveActivityStartToken: true, notificationPreferences: true },
  });

  if (!user?.liveActivityStartToken || !isRemoteNotificationEnabled(user.notificationPreferences, 'partnerChat')) {
    return false;
  }

  try {
    const result = await startLiveActivity({
      pushToStartToken: user.liveActivityStartToken,
      name: BOTTLE_LIVE_ACTIVITY_NAME,
      payload: {
        fromName: params.fromName,
        count: 1,
        messageId: params.messageId,
        sentAt: params.createdAt,
      },
      alert: {
        title: `${params.fromName} threw you a water bottle 💧`,
        body: 'Tap to catch it, then drink a glass.',
      },
      staleAfterSeconds: BOTTLE_LIVE_ACTIVITY_STALE_SECONDS,
    });
    return !result.skipped;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/BadDeviceToken|Unregistered|\b410\b/.test(message)) {
      await prisma.user.update({
        where: { id: params.toUserId },
        data: { liveActivityStartToken: null, liveActivityStartTokenUpdatedAt: null },
      });
    }
    console.error('[Push] Bottle Live Activity start failed, falling back to a notification:', message);
    return false;
  }
}

export async function sendChatMessagePush(params: {
  toUserId: string;
  fromName: string;
  content: string;
  messageId: string;
  createdAt: string;
}) {
  const { toUserId, fromName, content, messageId, createdAt } = params;

  if (/^\[STEPS:tug:[a-z0-9-]{8,80}\]/.test(content.trim())) {
    await sendNotificationToUser({
      userId: toUserId,
      preferenceKey: 'partnerChat',
      title: `${fromName} wants to play tug of war`,
      body: 'Put your phones side by side. Your steps pull the rope!',
      data: { type: 'chat_message', kind: 'step_tug', toUserId, messageId, createdAt, fromName, content },
    });
    return;
  }

  if (BOTTLE_THROW_PATTERN.test(content.trim())) {
    // iOS 17.2+: the bottle lands on the lock screen as a Live Activity, which also lights the screen.
    // Opening the app recovers the bottle from unviewed chat history, so the plain push is only a fallback.
    if (await startBottleLiveActivity({ toUserId, fromName, messageId, createdAt })) {
      return;
    }

    // The app rebuilds the landed bottle from this data when it was closed during the throw.
    await sendNotificationToUser({
      userId: toUserId,
      preferenceKey: 'partnerChat',
      title: `${fromName} threw you a water bottle 💧`,
      body: 'Open to catch it, then drink a glass.',
      data: {
        type: 'chat_message',
        kind: 'water_bottle',
        screen: '/(tabs)',
        messageId,
        createdAt,
        fromName,
        content,
      },
    });
    return;
  }

  const plate = content.trim().match(MEAL_PLATE_PATTERN);
  if (plate) {
    await sendNotificationToUser({
      userId: toUserId,
      preferenceKey: 'partnerChat',
      title: `${fromName} passed you ${mealLabel(plate[3])}`,
      body: 'Open to see the plate and choose your portion.',
      data: { type: 'chat_message', kind: 'meal_pass', screen: '/(tabs)', messageId, createdAt, fromName, content },
    });
    return;
  }

  const reply = content.trim().match(MEAL_REPLY_PATTERN);
  if (reply) {
    const accepted = reply[2].toLowerCase() === 'accepted';
    await sendNotificationToUser({
      userId: toUserId,
      preferenceKey: 'partnerChat',
      title: accepted ? `${fromName} accepted your plate` : `${fromName} passed on your plate`,
      body: accepted ? 'Your portions are logged.' : 'Your portion stays as you logged it.',
      data: { type: 'chat_message', kind: 'meal_pass_reply', screen: '/(tabs)', messageId, createdAt, fromName, content },
    });
    return;
  }

  const body = formatChatPushBody(content);
  await sendNotificationToUser({
    userId: toUserId,
    preferenceKey: 'partnerChat',
    title: `New message from ${fromName}`,
    body,
    data: {
      type: 'chat_message',
      openChat: '1',
      screen: '/(tabs)',
    },
  });
}

export async function sendRaceInvitePush(params: {
  toUserId: string;
  fromUserId: string;
  fromName: string;
  distance: number;
}) {
  const { toUserId, fromUserId, fromName, distance } = params;
  await sendNotificationToUser({
    userId: toUserId,
    preferenceKey: 'raceInvite',
    title: `${fromName} invited you to race`,
    body: `Race distance: ${(distance / 1000).toFixed(1)} km`,
    data: {
      type: 'race_invite',
      screen: '/(tabs)/Race',
      fromUserId,
      fromName,
      distance,
    },
  });
}

export async function sendRaceUpdatePush(params: {
  toUserId: string;
  actorName: string;
  updateType: 'accepted' | 'declined' | 'winner';
  distance?: number;
}) {
  const { toUserId, actorName, updateType, distance } = params;

  const title =
    updateType === 'accepted'
      ? 'Race accepted'
      : updateType === 'declined'
        ? 'Race declined'
        : 'Race finished';

  const body =
    updateType === 'accepted'
      ? `${actorName} accepted your race challenge.`
      : updateType === 'declined'
        ? `${actorName} declined your race challenge.`
        : `${actorName} won the race.`;

  await sendNotificationToUser({
    userId: toUserId,
    preferenceKey: 'raceUpdates',
    title,
    body,
    data: {
      type: 'race_update',
      screen: '/(tabs)/Race',
      updateType,
      distance: distance ?? null,
    },
  });
}

export async function sendPartnerInviteAcceptedPush(params: {
  toUserId: string;
  partnerName: string;
}) {
  const { toUserId, partnerName } = params;
  await sendNotificationToUser({
    userId: toUserId,
    preferenceKey: 'partnerInviteAccepted',
    title: 'Partner invite accepted',
    body: `${partnerName} accepted your partner invite.`,
    data: {
      type: 'partner_invite_accepted',
      screen: '/Partner',
    },
  });
}

export async function sendPartnerMemoryPush(params: {
  toUserId: string;
  fromName: string;
  memoryId: string;
}) {
  const { toUserId, fromName, memoryId } = params;
  await sendNotificationToUser({
    userId: toUserId,
    preferenceKey: 'partnerChat',
    title: `${fromName} shared a memory`,
    body: 'Open your partner timeline to view the photo.',
    data: {
      type: 'partner_memory',
      memoryId,
      screen: '/Partner',
    },
  });
}

export async function sendWeekPrizePush(params: {
  toUserId: string;
  fromName: string;
  kind: 'proposed' | 'accepted' | 'signed';
  weekprize: string;
}) {
  const { toUserId, fromName, kind, weekprize } = params;
  const content = {
    proposed: { title: `${fromName} set this week's stakes`, body: `Winner gets ${weekprize}. Tap to accept or counter.` },
    accepted: { title: `${fromName} accepted the stakes`, body: `Winner gets ${weekprize}. Sign to make it official.` },
    signed: { title: `${fromName} signed this week's stakes`, body: `Winner gets ${weekprize}. Game on!` },
  }[kind];
  await sendNotificationToUser({
    userId: toUserId,
    preferenceKey: 'partnerChat',
    ...content,
    data: { type: 'weekly_prize', kind, screen: '/(tabs)' },
  });
}

export async function sendCoupleChallengePush(params: {
  toUserIds: string[];
  kind: 'invite' | 'update';
  title: string;
  body: string;
  challengeId: string;
}) {
  const { toUserIds, kind, title, body, challengeId } = params;
  await Promise.allSettled(toUserIds.map(userId => sendNotificationToUser({
    userId,
    preferenceKey: kind === 'invite' ? 'raceInvite' : 'raceUpdates',
    title,
    body,
    data: {
      type: 'couple_challenge',
      challengeId,
      screen: '/race/couple-steps',
    },
  })));
}

export { isExpoPushToken };
