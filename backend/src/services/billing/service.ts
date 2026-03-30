import { env } from '../../config/env';
import prisma from '../../db/prisma';

type BillingProfileRecord = any;
type BillingSnapshot = {
  accessStatus: string;
  hasAccess: boolean;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  premiumEntitlementActive: boolean;
  premiumIsLifetime: boolean;
  premiumExpiresAt: string | null;
  lastSyncedAt: string | null;
  paywallReason?: string | null;
  revenueCatAppUserId?: string | null;
};

export class BillingError extends Error {
  status: number;
  code: string;
  paywallReason?: string;

  constructor(message: string, opts: { status?: number; code?: string; paywallReason?: string } = {}) {
    super(message);
    this.name = 'BillingError';
    this.status = opts.status ?? 400;
    this.code = opts.code ?? 'BILLING_ERROR';
    this.paywallReason = opts.paywallReason;
  }
}

const db = prisma as any;

function toDate(value: unknown): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function toIso(value: unknown): string | null {
  const d = toDate(value);
  return d ? d.toISOString() : null;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function getRevenueCatAppUserId(userId: string) {
  return `user_${userId}`;
}

export function resolveUserIdFromRevenueCatAppUserId(appUserId?: string | null): string | null {
  if (!appUserId) return null;
  return appUserId.startsWith('user_') ? appUserId.slice(5) : null;
}

function mapStoreToPlatform(store?: string | null): 'IOS' | 'ANDROID' | 'UNKNOWN' | null {
  if (!store) return null;
  const s = store.toLowerCase();
  if (s.includes('app_store') || s.includes('ios')) return 'IOS';
  if (s.includes('play_store') || s.includes('android')) return 'ANDROID';
  return 'UNKNOWN';
}

function getCachedOrComputedPremiumStatus(
  profile: BillingProfileRecord | null,
  now: Date
): { accessStatus: string; hasAccess: boolean; paywallReason: string | null } {
  if (!env.PAYWALL_ENABLED) {
    return { accessStatus: 'MANUAL_OVERRIDE', hasAccess: true, paywallReason: null };
  }

  if (!profile) {
    return { accessStatus: 'NONE', hasAccess: false, paywallReason: 'trial_not_started' };
  }

  const manualOverrideEndsAt = toDate(profile.manualOverrideEndsAt);
  const manualOverrideActive =
    !!profile.manualAccessOverride && (!manualOverrideEndsAt || manualOverrideEndsAt > now);
  if (manualOverrideActive) {
    return { accessStatus: 'MANUAL_OVERRIDE', hasAccess: true, paywallReason: null };
  }

  const premiumExpiresAt = toDate(profile.premiumExpiresAt);
  const gracePeriodEndsAt = toDate(profile.gracePeriodEndsAt);
  const trialEndsAt = toDate(profile.trialEndsAt);

  const premiumActive =
    !!profile.premiumEntitlementActive &&
    (!!profile.premiumIsLifetime || !premiumExpiresAt || premiumExpiresAt > now);
  if (premiumActive) {
    return { accessStatus: 'PREMIUM_ACTIVE', hasAccess: true, paywallReason: null };
  }

  if (gracePeriodEndsAt && gracePeriodEndsAt > now) {
    return { accessStatus: 'PREMIUM_GRACE', hasAccess: true, paywallReason: null };
  }

  if (trialEndsAt && trialEndsAt > now) {
    return { accessStatus: 'TRIAL_ACTIVE', hasAccess: true, paywallReason: null };
  }

  if (profile.trialConsumed && trialEndsAt && trialEndsAt <= now) {
    return { accessStatus: 'TRIAL_EXPIRED', hasAccess: false, paywallReason: 'trial_expired' };
  }

  if (premiumExpiresAt && premiumExpiresAt <= now) {
    return { accessStatus: 'NONE', hasAccess: false, paywallReason: 'subscription_expired' };
  }

  return { accessStatus: 'NONE', hasAccess: false, paywallReason: 'trial_not_started' };
}

export function presentBillingSnapshot(profile?: BillingProfileRecord | null): BillingSnapshot {
  const now = new Date();
  const computed = getCachedOrComputedPremiumStatus(profile ?? null, now);
  return {
    accessStatus: computed.accessStatus,
    hasAccess: computed.hasAccess,
    trialStartedAt: toIso(profile?.trialStartedAt),
    trialEndsAt: toIso(profile?.trialEndsAt),
    premiumEntitlementActive: !!profile?.premiumEntitlementActive,
    premiumIsLifetime: !!profile?.premiumIsLifetime,
    premiumExpiresAt: toIso(profile?.premiumExpiresAt),
    lastSyncedAt: toIso(profile?.lastSyncedAt),
  };
}

async function persistComputedStatus(profile: BillingProfileRecord) {
  const computed = getCachedOrComputedPremiumStatus(profile, new Date());
  if (profile.premiumAccessStatus !== computed.accessStatus) {
    await db.billingProfile.update({
      where: { id: profile.id },
      data: { premiumAccessStatus: computed.accessStatus },
    });
  }
  return computed;
}

export async function getOrCreateBillingProfile(userId: string): Promise<BillingProfileRecord> {
  let profile = await db.billingProfile.findUnique({ where: { userId } });
  if (profile) return profile;

  return db.billingProfile.create({
    data: {
      userId,
      revenueCatAppUserId: getRevenueCatAppUserId(userId),
      premiumAccessStatus: 'NONE',
    },
  });
}

export async function getBillingAccessForUser(userId: string): Promise<{ profile: BillingProfileRecord; billing: BillingSnapshot }> {
  const profile = await getOrCreateBillingProfile(userId);
  const computed = await persistComputedStatus(profile);
  return {
    profile,
    billing: {
      ...presentBillingSnapshot(profile),
      accessStatus: computed.accessStatus,
      hasAccess: computed.hasAccess,
      paywallReason: computed.paywallReason,
      revenueCatAppUserId: profile.revenueCatAppUserId,
    },
  };
}

export async function startTrial(profile: BillingProfileRecord, now = new Date(), days = env.PAYWALL_TRIAL_DAYS) {
  const current = getCachedOrComputedPremiumStatus(profile, now);
  if (current.accessStatus === 'TRIAL_ACTIVE') {
    return profile;
  }

  const trialEndsAt = toDate(profile.trialEndsAt);
  if (profile.trialConsumed && trialEndsAt && trialEndsAt <= now) {
    throw new BillingError('Trial already used', {
      status: 409,
      code: 'TRIAL_ALREADY_CONSUMED',
      paywallReason: 'trial_expired',
    });
  }

  return db.billingProfile.update({
    where: { id: profile.id },
    data: {
      trialStartedAt: profile.trialStartedAt ?? now,
      trialEndsAt: trialEndsAt && trialEndsAt > now ? trialEndsAt : addDays(now, days),
      trialConsumed: true,
      premiumAccessStatus: 'TRIAL_ACTIVE',
    },
  });
}

async function fetchRevenueCatCustomer(appUserId: string) {
  if (!env.REVENUECAT_SECRET_API_KEY) {
    throw new BillingError('RevenueCat is not configured', {
      status: 503,
      code: 'REVENUECAT_NOT_CONFIGURED',
    });
  }

  const url = `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${env.REVENUECAT_SECRET_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    await res.text();
    throw new BillingError(`RevenueCat sync failed (${res.status})`, {
      status: 502,
      code: 'REVENUECAT_SYNC_FAILED',
    });
  }

  return res.json();
}

function pickLatestNonSubscriptionRecord(records: any): any | null {
  if (!Array.isArray(records) || records.length === 0) return null;
  return [...records].sort((a, b) => {
    const at = new Date(a?.purchase_date || 0).getTime();
    const bt = new Date(b?.purchase_date || 0).getTime();
    return bt - at;
  })[0];
}

function normalizeEntitlementKey(value: string) {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function pickPreferredEntitlement(subscriber: any) {
  const entitlements = subscriber?.entitlements ?? {};
  const configuredId = env.REVENUECAT_ENTITLEMENT_ID;

  if (configuredId && entitlements?.[configuredId]) {
    return entitlements[configuredId];
  }

  const normalizedConfigured = normalizeEntitlementKey(configuredId || '');
  const entries = Object.entries(entitlements) as Array<[string, any]>;

  if (normalizedConfigured) {
    const normalizedMatch = entries.find(([key]) => normalizeEntitlementKey(key) === normalizedConfigured);
    if (normalizedMatch) return normalizedMatch[1];
  }

  const activeEntries = entries.filter(([, value]) => !!value);
  if (activeEntries.length === 1) return activeEntries[0][1];

  const aliasMatch = activeEntries.find(([key]) => {
    const normalized = normalizeEntitlementKey(key);
    return normalized === 'runtogetherpro' || normalized === 'premium';
  });
  if (aliasMatch) return aliasMatch[1];

  return null;
}

function normalizeRevenueCatPremiumState(customerInfo: any) {
  const subscriber = customerInfo?.subscriber ?? {};
  const ent = pickPreferredEntitlement(subscriber);
  const productId = ent?.product_identifier ?? null;
  const subscriptions = subscriber?.subscriptions ?? {};
  const sub = productId ? subscriptions?.[productId] ?? null : null;
  const nonSubs = subscriber?.non_subscriptions ?? {};
  const latestNonSub = productId ? pickLatestNonSubscriptionRecord(nonSubs?.[productId]) : null;

  const premiumExpiresAt = toDate(ent?.expires_date ?? sub?.expires_date);
  const gracePeriodEndsAt = toDate(ent?.grace_period_expires_date ?? sub?.grace_period_expires_date);
  const now = new Date();
  const premiumIsLifetime = !!ent?.product_identifier && !premiumExpiresAt;
  const premiumEntitlementActive =
    !!ent &&
    (premiumIsLifetime ||
      !!gracePeriodEndsAt && gracePeriodEndsAt > now ||
      !!premiumExpiresAt && premiumExpiresAt > now);

  const premiumPurchasedAt = toDate(ent?.purchase_date ?? sub?.purchase_date ?? latestNonSub?.purchase_date);
  const premiumWillRenew =
    typeof sub?.will_renew === 'boolean'
      ? sub.will_renew
      : (typeof ent?.will_renew === 'boolean' ? ent.will_renew : null);

  const premiumPlatform = mapStoreToPlatform(ent?.store ?? sub?.store ?? latestNonSub?.store);

  return {
    premiumEntitlementActive,
    premiumProductId: productId,
    premiumPlatform,
    premiumPurchasedAt,
    premiumExpiresAt,
    premiumWillRenew,
    premiumIsLifetime,
    gracePeriodEndsAt,
  };
}

async function applyRevenueCatStateToProfile(profile: BillingProfileRecord, customerInfo: any, sourceEventId?: string | null) {
  const normalized = normalizeRevenueCatPremiumState(customerInfo);
  const tempProfile = {
    ...profile,
    ...normalized,
    lastSyncedAt: new Date(),
    lastRevenueCatEventId: sourceEventId ?? profile.lastRevenueCatEventId,
  };
  const computed = getCachedOrComputedPremiumStatus(tempProfile, new Date());

  const updated = await db.billingProfile.update({
    where: { id: profile.id },
    data: {
      premiumEntitlementActive: normalized.premiumEntitlementActive,
      premiumProductId: normalized.premiumProductId ?? null,
      premiumPlatform: normalized.premiumPlatform ?? null,
      premiumPurchasedAt: normalized.premiumPurchasedAt ?? null,
      premiumExpiresAt: normalized.premiumExpiresAt ?? null,
      premiumWillRenew: normalized.premiumWillRenew,
      premiumIsLifetime: normalized.premiumIsLifetime,
      gracePeriodEndsAt: normalized.gracePeriodEndsAt ?? null,
      lastSyncedAt: new Date(),
      premiumAccessStatus: computed.accessStatus,
      ...(sourceEventId ? { lastRevenueCatEventId: sourceEventId, lastRevenueCatEventAt: new Date() } : {}),
    },
  });

  return { profile: updated, billing: { ...presentBillingSnapshot(updated), paywallReason: computed.paywallReason } };
}

export async function syncFromRevenueCat(userId: string) {
  const profile = await getOrCreateBillingProfile(userId);
  const customerInfo = await fetchRevenueCatCustomer(profile.revenueCatAppUserId);
  return applyRevenueCatStateToProfile(profile, customerInfo);
}

async function getOrCreateBillingProfileByAppUserId(appUserId: string): Promise<BillingProfileRecord | null> {
  let profile = await db.billingProfile.findUnique({ where: { revenueCatAppUserId: appUserId } });
  if (profile) return profile;

  const userId = resolveUserIdFromRevenueCatAppUserId(appUserId);
  if (!userId) return null;

  return db.billingProfile.create({
    data: {
      userId,
      revenueCatAppUserId: appUserId,
      premiumAccessStatus: 'NONE',
    },
  });
}

function getWebhookEventCore(payload: any) {
  const event = payload?.event ?? payload;
  const appUserId = event?.app_user_id ?? payload?.app_user_id ?? null;
  const type = event?.type ?? payload?.type ?? 'unknown';
  const externalEventId =
    String(event?.id ?? payload?.id ?? `${type}:${event?.event_timestamp_ms ?? Date.now()}:${appUserId ?? 'unknown'}`);

  return {
    event,
    appUserId: appUserId ? String(appUserId) : null,
    type: String(type),
    externalEventId,
  };
}

export async function applyRevenueCatWebhook(payload: any) {
  const { appUserId, type, externalEventId } = getWebhookEventCore(payload);
  const userId = resolveUserIdFromRevenueCatAppUserId(appUserId);

  let log: any;
  try {
    log = await db.billingWebhookEvent.create({
      data: {
        provider: 'revenuecat',
        externalEventId,
        eventType: type,
        appUserId,
        userId,
        payload,
      },
    });
  } catch (err: any) {
    if (String(err?.code) === 'P2002') {
      return { duplicate: true, externalEventId };
    }
    throw err;
  }

  try {
    const profile = appUserId ? await getOrCreateBillingProfileByAppUserId(appUserId) : null;
    if (profile && env.REVENUECAT_SECRET_API_KEY) {
      const customerInfo = await fetchRevenueCatCustomer(profile.revenueCatAppUserId);
      await applyRevenueCatStateToProfile(profile, customerInfo, externalEventId);
    } else if (profile) {
      const computed = getCachedOrComputedPremiumStatus(profile, new Date());
      await db.billingProfile.update({
        where: { id: profile.id },
        data: {
          lastRevenueCatEventId: externalEventId,
          lastRevenueCatEventAt: new Date(),
          premiumAccessStatus: computed.accessStatus,
        },
      });
    }

    await db.billingWebhookEvent.update({
      where: { id: log.id },
      data: {
        processed: true,
        processedAt: new Date(),
        processingError: null,
      },
    });

    return { processed: true, externalEventId };
  } catch (err: any) {
    await db.billingWebhookEvent.update({
      where: { id: log.id },
      data: {
        processed: false,
        processedAt: new Date(),
        processingError: err instanceof Error ? err.message.slice(0, 500) : 'Unknown error',
      },
    });
    throw err;
  }
}

export function validateRevenueCatWebhookSecret(headers: Record<string, unknown>) {
  const expected = env.REVENUECAT_WEBHOOK_AUTH_SECRET;
  if (!expected) return true;

  const auth = String(headers.authorization ?? '');
  const xSecret = String(headers['x-webhook-secret'] ?? '');
  const xRcSecret = String(headers['x-revenuecat-webhook-secret'] ?? '');
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : '';

  return bearer === expected || xSecret === expected || xRcSecret === expected;
}

export function getPaywallProductsConfig() {
  return {
    paywallEnabled: env.PAYWALL_ENABLED,
    trialDays: env.PAYWALL_TRIAL_DAYS,
    entitlementId: env.REVENUECAT_ENTITLEMENT_ID,
    offerings: {
      defaultOfferingId: 'default',
      expectedPackages: ['monthly', 'annual', 'lifetime'],
    },
    legal: {
      termsUrl: 'https://example.com/terms',
      privacyUrl: 'https://example.com/privacy',
    },
  };
}
