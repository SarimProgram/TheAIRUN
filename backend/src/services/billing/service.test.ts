import assert from 'node:assert/strict';
import test from 'node:test';
import { syncPartnerSharedAccessForPair } from './service';

function profile(userId: string, overrides: Record<string, unknown> = {}) {
  return {
    id: `profile-${userId}`,
    userId,
    revenueCatAppUserId: `user_${userId}`,
    premiumAccessStatus: 'NONE',
    premiumEntitlementActive: false,
    premiumIsLifetime: false,
    premiumExpiresAt: null,
    gracePeriodEndsAt: null,
    trialEndsAt: null,
    trialConsumed: false,
    manualAccessOverride: false,
    manualOverrideEndsAt: null,
    sharedAccessSourceUserId: null,
    sharedAccessStartedAt: null,
    sharedAccessEndsAt: null,
    sharedAccessRevokedAt: null,
    ...overrides,
  };
}

function fakeClient(initialProfiles: Record<string, any>) {
  const users: Record<string, any> = {
    a: { id: 'a', displayName: 'Alex', partnerId: 'b' },
    b: { id: 'b', displayName: 'Blair', partnerId: 'a' },
  };
  const profiles = { ...initialProfiles };

  return {
    profiles,
    client: {
      user: {
        async findUnique({ where }: any) {
          return users[where.id] ?? null;
        },
      },
      billingProfile: {
        async findUnique({ where }: any) {
          return profiles[where.userId] ?? null;
        },
        async create({ data }: any) {
          const created = profile(data.userId, data);
          profiles[data.userId] = created;
          return created;
        },
        async update({ where, data }: any) {
          const current = Object.values(profiles).find((item: any) => item.id === where.id) as any;
          assert.ok(current);
          Object.assign(current, data);
          return current;
        },
      },
    },
  };
}

test('TRIAL_ACTIVE shares access with a linked partner', async () => {
  const now = new Date('2026-07-31T00:00:00.000Z');
  const fake = fakeClient({
    a: profile('a', {
      trialConsumed: true,
      trialEndsAt: new Date('2026-08-02T00:00:00.000Z'),
      premiumAccessStatus: 'TRIAL_ACTIVE',
    }),
    b: profile('b'),
  });

  await syncPartnerSharedAccessForPair('a', 'b', fake.client, now);
  assert.equal(fake.profiles.b.sharedAccessSourceUserId, 'a');
  assert.equal(fake.profiles.b.sharedAccessEndsAt, null);
  assert.equal(fake.profiles.b.sharedAccessRevokedAt, null);
});

test('source expiry starts one fixed three-day partner grace window', async () => {
  const now = new Date('2026-07-31T00:00:00.000Z');
  const fake = fakeClient({
    a: profile('a', {
      trialConsumed: true,
      trialEndsAt: new Date('2026-07-30T00:00:00.000Z'),
      premiumAccessStatus: 'TRIAL_ACTIVE',
    }),
    b: profile('b', {
      sharedAccessSourceUserId: 'a',
      sharedAccessStartedAt: new Date('2026-07-20T00:00:00.000Z'),
    }),
  });

  await syncPartnerSharedAccessForPair('a', 'b', fake.client, now);
  assert.equal(fake.profiles.b.sharedAccessEndsAt.toISOString(), '2026-08-03T00:00:00.000Z');
  assert.equal(fake.profiles.b.sharedAccessRevokedAt.toISOString(), now.toISOString());

  await syncPartnerSharedAccessForPair('a', 'b', fake.client, new Date('2026-08-01T00:00:00.000Z'));
  assert.equal(fake.profiles.b.sharedAccessEndsAt.toISOString(), '2026-08-03T00:00:00.000Z');
});

test('a source purchase restores active shared access and clears grace', async () => {
  const now = new Date('2026-07-31T00:00:00.000Z');
  const fake = fakeClient({
    a: profile('a', {
      premiumEntitlementActive: true,
      premiumExpiresAt: new Date('2026-09-01T00:00:00.000Z'),
      premiumAccessStatus: 'PREMIUM_ACTIVE',
    }),
    b: profile('b', {
      sharedAccessSourceUserId: 'a',
      sharedAccessStartedAt: new Date('2026-07-20T00:00:00.000Z'),
      sharedAccessEndsAt: new Date('2026-08-02T00:00:00.000Z'),
      sharedAccessRevokedAt: new Date('2026-07-30T00:00:00.000Z'),
    }),
  });

  await syncPartnerSharedAccessForPair('a', 'b', fake.client, now);
  assert.equal(fake.profiles.b.sharedAccessSourceUserId, 'a');
  assert.equal(fake.profiles.b.sharedAccessEndsAt, null);
  assert.equal(fake.profiles.b.sharedAccessRevokedAt, null);
});

test('getPartnerPlanSummary marks shareable partner plans as covering', async () => {
  const { getPartnerPlanSummary } = await import('./service');

  const trialSummary = getPartnerPlanSummary(
    profile('a', {
      premiumAccessStatus: 'TRIAL_ACTIVE',
      trialEndsAt: new Date('2026-12-31T00:00:00.000Z'),
      trialConsumed: true,
    })
  );
  assert.equal(trialSummary.accessStatus, 'TRIAL_ACTIVE');
  assert.equal(trialSummary.hasActivePlan, true);
  assert.equal(trialSummary.coversPartner, true);

  const noneSummary = getPartnerPlanSummary(profile('b'));
  assert.equal(noneSummary.accessStatus, 'NONE');
  assert.equal(noneSummary.hasActivePlan, false);
  assert.equal(noneSummary.coversPartner, false);
});
