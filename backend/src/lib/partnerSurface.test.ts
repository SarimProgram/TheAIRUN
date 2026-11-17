import assert from 'node:assert/strict';
import test from 'node:test';

test('partner live payload keeps profile gender attached to the correct participant', async (t) => {
  process.env.DATABASE_URL ||= 'postgresql://test:test@localhost:5432/test';
  const { prisma } = await import('../db/prisma');
  const { buildPartnerLivePayloadForUser } = await import('./partnerSurface');
  const originals = [prisma.user.findUnique, prisma.dailySummary.findUnique, prisma.dailyStep.findUnique];
  t.after(() => {
    [prisma.user.findUnique, prisma.dailySummary.findUnique, prisma.dailyStep.findUnique] = originals as any;
  });
  for (const [mine, partner] of [['male', 'female'], ['female', 'male'], ['male', 'male'], ['female', 'female'], [null, 'female']]) {
    prisma.user.findUnique = (async (query: any) => {
      if (query.select.partner) {
        assert.equal(query.select.partner.select.gender, true);
        return { id: 'viewer', displayName: 'You', partnerId: 'partner', partner: { id: 'partner', displayName: 'Partner', gender: partner } };
      }
      assert.equal(query.select.gender, true);
      return { id: query.where.id, displayName: query.where.id, gender: query.where.id === 'viewer' ? mine : partner, timezone: 'UTC', plan: { dailyCalorieTarget: 2000 } };
    }) as any;
    prisma.dailySummary.findUnique = (async () => ({ calorieTarget: 2000, consumedCalories: 500, steps: 100 })) as any;
    prisma.dailyStep.findUnique = (async () => ({ steps: 100 })) as any;
    const result = await buildPartnerLivePayloadForUser('viewer');
    assert.equal(result?.userGender, mine);
    assert.equal(result?.partnerGender, partner);
    assert.equal(result?.status, 'connected');
  }
});
