import { prisma } from '../db/prisma';
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

export async function sendChatMessagePush(params: {
  toUserId: string;
  fromName: string;
  content: string;
}) {
  const { toUserId, fromName, content } = params;
  await sendNotificationToUser({
    userId: toUserId,
    preferenceKey: 'partnerChat',
    title: `New message from ${fromName}`,
    body: content,
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

export { isExpoPushToken };
