const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function isExpoPushToken(token?: string | null): token is string {
  return !!token && /^(ExponentPushToken|ExpoPushToken)\[.+\]$/.test(token);
}

export async function sendChatMessagePush(params: {
  to?: string | null;
  fromName: string;
  content: string;
}) {
  const { to, fromName, content } = params;

  if (!isExpoPushToken(to)) {
    const tokenPreview = to == null ? null : `${String(to).slice(0, 20)}...`;
    console.log('[Push] Skipping chat push: invalid or missing Expo token', {
      hasToken: !!to,
      tokenPreview,
    });
    return;
  }

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
      title: `New message from ${fromName}`,
      body: content,
      data: {
        type: 'chat_message',
        openChat: '1',
        screen: '/(tabs)',
      },
      channelId: 'messages',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Expo push failed: ${response.status} ${errorText}`);
  }

  const result = await response.json();
  console.log('[Push] Expo push API response', {
    tokenPreview: `${to.slice(0, 20)}...`,
    result,
  });
  if (Array.isArray(result?.data) && result.data.some((item: any) => item.status === 'error')) {
    throw new Error(`Expo push rejected token: ${JSON.stringify(result.data)}`);
  }
}

export { isExpoPushToken };
