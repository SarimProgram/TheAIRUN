import * as fs from 'node:fs';
import * as http2 from 'node:http2';

import jwt from 'jsonwebtoken';

import { env } from '../config/env';

type ApnsPushType = 'background' | 'liveactivity';

type ApnsResult = {
  skipped?: boolean;
  status: number;
  body: string;
};

const APNS_REQUEST_TIMEOUT_MS = 15_000;

let cachedProviderToken: { token: string; expiresAt: number } | null = null;

function getApnsKey(): string | null {
  if (env.APNS_AUTH_KEY?.trim()) {
    return env.APNS_AUTH_KEY.replace(/\\n/g, '\n');
  }

  if (env.APNS_AUTH_KEY_PATH?.trim()) {
    return fs.readFileSync(env.APNS_AUTH_KEY_PATH, 'utf8');
  }

  return null;
}

function isApnsConfigured(): boolean {
  return Boolean(
    env.APNS_KEY_ID &&
      env.APNS_TEAM_ID &&
      env.APNS_BUNDLE_ID &&
      getApnsKey(),
  );
}

function getProviderToken(): string {
  const now = Math.floor(Date.now() / 1000);

  if (cachedProviderToken && cachedProviderToken.expiresAt > now + 60) {
    return cachedProviderToken.token;
  }

  const privateKey = getApnsKey();
  if (!privateKey || !env.APNS_KEY_ID || !env.APNS_TEAM_ID) {
    throw new Error('APNs auth key is not configured');
  }

  const token = jwt.sign({}, privateKey, {
    algorithm: 'ES256',
    issuer: env.APNS_TEAM_ID,
    header: {
      alg: 'ES256',
      kid: env.APNS_KEY_ID,
    },
    expiresIn: '50m',
  });

  cachedProviderToken = {
    token,
    expiresAt: now + 50 * 60,
  };

  return token;
}

function apnsBaseUrl() {
  return env.APNS_USE_SANDBOX ? 'https://api.sandbox.push.apple.com' : 'https://api.push.apple.com';
}

async function sendApnsRequest(params: {
  deviceToken: string;
  pushType: ApnsPushType;
  topic: string;
  priority: '5' | '10';
  payload: Record<string, unknown>;
}): Promise<ApnsResult> {
  if (!isApnsConfigured()) {
    return { skipped: true, status: 0, body: 'APNs not configured' };
  }

  const providerToken = getProviderToken();
  const client = http2.connect(apnsBaseUrl());

  return await new Promise<ApnsResult>((resolve, reject) => {
    let settled = false;

    const succeed = (result: ApnsResult) => {
      if (settled) return;
      settled = true;
      client.setTimeout(0);
      client.close();
      resolve(result);
    };

    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      client.setTimeout(0);
      client.destroy();
      reject(error instanceof Error ? error : new Error(String(error)));
    };

    // Connection failures are emitted by the session, not necessarily by the
    // request stream. Without this listener, a transient APNs/Railway network
    // failure becomes an uncaught event and terminates the Node process.
    client.once('error', fail);
    client.setTimeout(APNS_REQUEST_TIMEOUT_MS, () => {
      fail(new Error(`APNs ${params.pushType} push timed out after ${APNS_REQUEST_TIMEOUT_MS}ms`));
    });

    let request: http2.ClientHttp2Stream;
    try {
      request = client.request({
        ':method': 'POST',
        ':path': `/3/device/${params.deviceToken}`,
        authorization: `bearer ${providerToken}`,
        'apns-push-type': params.pushType,
        'apns-topic': params.topic,
        'apns-priority': params.priority,
      });
    } catch (error) {
      fail(error);
      return;
    }

    let responseBody = '';
    let status = 0;

    request.setEncoding('utf8');
    request.on('response', (headers) => {
      status = Number(headers[':status'] || 0);
    });
    request.on('data', (chunk) => {
      responseBody += chunk;
    });
    request.on('end', () => {
      if (status >= 200 && status < 300) {
        succeed({ status, body: responseBody });
        return;
      }

      fail(new Error(`APNs ${params.pushType} push failed: ${status} ${responseBody}`));
    });
    request.on('error', fail);

    request.end(JSON.stringify(params.payload));
  });
}

export async function sendBackgroundWakePush(params: {
  deviceToken: string;
  data?: Record<string, string | number | boolean | null>;
}) {
  if (!env.APNS_BUNDLE_ID) {
    return { skipped: true, status: 0, body: 'Missing bundle id' };
  }

  return sendApnsRequest({
    deviceToken: params.deviceToken,
    pushType: 'background',
    topic: env.APNS_BUNDLE_ID,
    priority: '5',
    payload: {
      aps: {
        'content-available': 1,
      },
      ...(params.data || {}),
    },
  });
}

export async function sendLiveActivityState(params: {
  pushToken: string;
  payload: Record<string, unknown>;
  event: 'update' | 'end';
}) {
  if (!env.APNS_BUNDLE_ID) {
    return { skipped: true, status: 0, body: 'Missing bundle id' };
  }

  return sendApnsRequest({
    deviceToken: params.pushToken,
    pushType: 'liveactivity',
    topic: `${env.APNS_BUNDLE_ID}.push-type.liveactivity`,
    priority: '10',
    payload: {
      aps: {
        timestamp: Math.floor(Date.now() / 1000),
        event: params.event,
        'content-state': params.payload,
      },
    },
  });
}
