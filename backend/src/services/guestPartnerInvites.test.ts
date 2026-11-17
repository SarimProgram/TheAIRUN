import assert from 'node:assert/strict';
import test from 'node:test';

test('guest creation is repeatable and never stores the ownership secret', async (t) => {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
  const { prisma } = await import('../db/prisma');
  const { createGuestPartnerInvite } = await import('./guestPartnerInvites');
  const original = prisma.guestPartnerInvite.upsert;
  t.after(() => { prisma.guestPartnerInvite.upsert = original; });
  let record: any;
  prisma.guestPartnerInvite.upsert = (async (query: any) => {
    assert.notEqual(query.where.ownerTokenHash, 'a'.repeat(64));
    assert.equal(query.where.ownerTokenHash.length, 64);
    assert.equal('ownerToken' in query.create, false);
    record ??= { ...query.create, id: 'abcd1234-0000-0000-0000-000000000000', createdAt: new Date(), claimedByUserId: null };
    return record;
  }) as any;
  const first = await createGuestPartnerInvite('a'.repeat(64), 'Sam');
  const second = await createGuestPartnerInvite('a'.repeat(64), 'Sam');
  assert.equal(first.code, 'ABCD1234');
  assert.equal(first.id, second.id);
  assert.equal('ownerTokenHash' in first, false);
  assert.equal(first.toEmail, null);
  record.expiresAt = new Date(0);
  await assert.rejects(createGuestPartnerInvite('a'.repeat(64), 'Sam'), { status: 410 });
  record.claimedByUserId = 'someone';
  await assert.rejects(createGuestPartnerInvite('a'.repeat(64), 'Sam'), { status: 409 });
});

test('claim preserves the shared code, enforces ownership and safely retries', async (t) => {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
  const { prisma } = await import('../db/prisma');
  const { claimGuestPartnerInvite } = await import('./guestPartnerInvites');
  let guest: any;
  let partnerId: string | null = null;
  let created: any[] = [];
  const transaction = t.mock.method(prisma, '$transaction', async (callback: any) => callback({
    $queryRaw: async () => [],
    guestPartnerInvite: {
      findUnique: async () => guest,
      update: async ({ data }: any) => { guest = { ...guest, ...data }; return guest; },
    },
    user: { findUnique: async () => ({ partnerId }) },
    partnerInvite: { create: async ({ data }: any) => { created.push(data); return data; } },
  }));
  t.after(() => transaction.mock.restore());
  const fresh = () => ({ id: 'abcd1234-0000-0000-0000-000000000000', expiresAt: new Date(Date.now() + 60000), claimedByUserId: null });
  await t.test('missing ownership secret cannot claim an invite', async () => {
    guest = null;
    await assert.rejects(claimGuestPartnerInvite('b'.repeat(64), 'owner'), { status: 404 });
  });
  await t.test('expired invites cannot be claimed', async () => {
    guest = { ...fresh(), expiresAt: new Date(0) };
    await assert.rejects(claimGuestPartnerInvite('a'.repeat(64), 'owner'), { status: 410 });
  });
  await t.test('another account cannot take an already claimed code', async () => {
    guest = { ...fresh(), claimedByUserId: 'other' };
    await assert.rejects(claimGuestPartnerInvite('a'.repeat(64), 'owner'), { status: 403 });
  });
  await t.test('an existing couple is preserved', async () => {
    guest = fresh(); partnerId = 'partner';
    await assert.rejects(claimGuestPartnerInvite('a'.repeat(64), 'owner'), { status: 409 });
    assert.equal(created.length, 0); partnerId = null;
  });
  await t.test('claim and retry create one real invite with the original code', async () => {
    guest = fresh(); created = [];
    const result = await claimGuestPartnerInvite('a'.repeat(64), 'owner');
    const retry = await claimGuestPartnerInvite('a'.repeat(64), 'owner');
    assert.deepEqual(result, retry);
    assert.equal(result.code, 'ABCD1234');
    assert.equal(created.length, 1);
    assert.equal(created[0].id, guest.id);
    assert.equal(created[0].fromUserId, 'owner');
    assert.equal(created[0].toEmail, null);
  });
});
