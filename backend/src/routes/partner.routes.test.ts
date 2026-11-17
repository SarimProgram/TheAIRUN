import assert from 'node:assert/strict';
import test from 'node:test';

test('sent invitations include basic partner state without loading premium details', async (t) => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.JWT_SECRET = 'partner-invite-regression-test';
    const { prisma } = await import('../db/prisma');
    const { default: router } = await import('./partner.routes');
    const route = router.stack.find((layer: any) => layer.route?.path === '/invites/sent');
    const handler = (route as any).route.stack[0].handle;
    let partner: { id: string; displayName: string; email: string } | null = null;
    const originalFindUser = prisma.user.findUnique;
    const originalFindInvites = prisma.partnerInvite.findMany;
    t.after(() => {
        prisma.user.findUnique = originalFindUser;
        prisma.partnerInvite.findMany = originalFindInvites;
    });
    prisma.user.findUnique = (async (query: any) => {
        assert.deepEqual(query, {
            where: { id: 'sender' },
            select: { partner: { select: { id: true, displayName: true, email: true } } },
        });
        return { partner } as any;
    }) as any;
    prisma.partnerInvite.findMany = (async (query: any) => {
        assert.deepEqual(query.where, { fromUserId: 'sender' });
        return [{ id: 'abcdef12-0000-0000-0000-000000000000', status: 'PENDING' }] as any;
    }) as any;

    for (const connected of [false, true]) {
        partner = connected ? { id: 'partner', displayName: 'Sam', email: 'sam@example.com' } : null;
        let body: any;
        await handler(
            { user: { id: 'sender' } },
            { json(value: any) { body = value; return this; } },
            (error: unknown) => { throw error; },
        );
        assert.equal(body.hasPartner, connected);
        assert.deepEqual(body.partner, partner);
        assert.equal(body.invites[0].code, 'ABCDEF12');
        assert.equal(body.invites[0].status, 'PENDING');
    }
});

test('guest lookup explains pending setup and resolves the same code after claim', async (t) => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.JWT_SECRET = 'partner-invite-regression-test';
    const { prisma } = await import('../db/prisma');
    const { publicPartnerRouter } = await import('./partner.routes');
    const route = publicPartnerRouter.stack.find((layer: any) => layer.route?.path === '/invites/lookup');
    const handler = (route as any).route.stack[0].handle;
    const originalInvite = prisma.partnerInvite.findFirst;
    const originalGuest = prisma.guestPartnerInvite.findFirst;
    t.after(() => { prisma.partnerInvite.findFirst = originalInvite; prisma.guestPartnerInvite.findFirst = originalGuest; });
    let claimed = false;
    prisma.partnerInvite.findFirst = (async () => claimed ? {
        id: 'abcdef12-0000-0000-0000-000000000000', toEmail: null,
        fromUser: { id: 'owner', displayName: 'Sam', partnerId: null },
    } : null) as any;
    prisma.guestPartnerInvite.findFirst = (async (query: any) => {
        assert.equal(query.where.claimedByUserId, null);
        assert.ok(query.where.expiresAt.gt instanceof Date);
        return { displayName: 'Sam' };
    }) as any;
    let status = 200;
    let body: any;
    const response = { status(value: number) { status = value; return this; }, json(value: any) { body = value; return this; } };
    await handler({ body: { code: 'ABCDEF12' } }, response, (err: unknown) => { throw err; });
    assert.equal(status, 409);
    assert.equal(body.code, 'INVITER_SETUP_PENDING');
    assert.match(body.error, /Sam/);
    claimed = true; status = 200;
    await handler({ body: { code: 'ABCDEF12' } }, response, (err: unknown) => { throw err; });
    assert.equal(status, 200);
    assert.equal(body.invite.code, 'ABCDEF12');
    assert.equal(body.invite.fromUser.id, 'owner');
});

test('recipient-free codes are created once, reused, and never emailed', async (t) => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.JWT_SECRET = 'partner-invite-regression-test';
    const { prisma } = await import('../db/prisma');
    const { default: router } = await import('./partner.routes');
    const { partnerInvitationEmailService } = await import('../services/email/partnerInvitationEmail');
    const route = router.stack.find((layer: any) => layer.route?.path === '/invite/code');
    const handler = (route as any).route.stack[0].handle;
    let existing: any = null;
    let creates = 0;
    let connected = false;
    const originalFindUser = prisma.user.findUnique;
    prisma.user.findUnique = (async () => ({ partnerId: connected ? 'partner' : null })) as any;
    const emailMock = t.mock.method(partnerInvitationEmailService, 'sendInvitation', async () => { throw new Error('Must not email a code-only invite'); });
    const transactionMock = t.mock.method(prisma, '$transaction', async (callback: any) => callback({
        $queryRaw: async () => [],
        partnerInvite: {
            findFirst: async (query: any) => {
                assert.deepEqual(query.where, { fromUserId: 'sender', toEmail: null, status: 'PENDING' });
                return existing;
            },
            create: async ({ data }: any) => {
                creates++;
                assert.equal(data.toEmail, null);
                existing = { ...data, id: 'abcdef12-0000-0000-0000-000000000000' };
                return existing;
            },
        },
    }));
    t.after(() => { prisma.user.findUnique = originalFindUser; emailMock.mock.restore(); transactionMock.mock.restore(); });
    for (let attempt = 0; attempt < 2; attempt++) {
        let result: any;
        await handler({ user: { id: 'sender' }, body: {} }, { json: (body: any) => { result = body; } }, (err: unknown) => { throw err; });
        assert.equal(result.invite.code, 'ABCDEF12');
        assert.equal(result.invite.toEmail, null);
    }
    assert.equal(creates, 1);
    assert.equal(emailMock.mock.callCount(), 0);
    connected = true;
    let status = 200;
    await handler({ user: { id: 'sender' } }, { status: (code: number) => { status = code; return { json: () => {} }; } }, (err: unknown) => { throw err; });
    assert.equal(status, 400);
    assert.equal(transactionMock.mock.callCount(), 2);
});

test('replayed partner acceptance preserves the existing connection', async (t) => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.JWT_SECRET = 'partner-invite-regression-test';
    const { prisma } = await import('../db/prisma');
    const { default: router } = await import('./partner.routes');
    const route = router.stack.find((layer: any) =>
        layer.route?.path === '/invites/:id/accept' && layer.route.methods.post,
    );
    assert.ok(route);
    const handler = (route as any).route.stack[0].handle;

    const originalFindUser = prisma.user.findUnique;
    const originalFindInvite = prisma.partnerInvite.findFirst;
    t.after(() => {
        prisma.user.findUnique = originalFindUser;
        prisma.partnerInvite.findFirst = originalFindInvite;
    });
    prisma.user.findUnique = (async () => ({
        email: 'recipient@example.com', partnerId: 'partner-1',
    })) as any;
    const transaction = t.mock.method(prisma, '$transaction', async () => {
        assert.fail('An existing connection must not be modified');
    });

    for (const scenario of [
        { name: 'same accepted invite', reciprocal: true, found: true, status: 200 },
        { name: 'different or unprocessed invite', reciprocal: true, found: false, status: 400 },
        { name: 'nonreciprocal connection', reciprocal: false, found: true, status: 400 },
    ]) {
        await t.test(scenario.name, async () => {
            prisma.partnerInvite.findFirst = (async (query: any) => {
                assert.deepEqual(query.where, {
                    id: 'invite-1', status: 'ACCEPTED',
                    toUserId: 'recipient-1', fromUserId: 'partner-1',
                });
                return scenario.found ? {
                    fromUser: {
                        partnerId: scenario.reciprocal ? 'recipient-1' : 'someone-else',
                        displayName: 'Partner',
                    },
                } : null;
            }) as any;
            let status = 200;
            let body: any;
            const response = {
                status(value: number) { status = value; return this; },
                json(value: any) { body = value; return this; },
            };
            await handler(
                { user: { id: 'recipient-1' }, params: { id: 'invite-1' } },
                response,
                (error: unknown) => { throw error; },
            );
            assert.equal(status, scenario.status);
            if (status === 200) {
                assert.deepEqual(body, { success: true, partnerId: 'partner-1', partnerName: 'Partner' });
            } else {
                assert.equal(body.code, 'PARTNER_ALREADY_CONNECTED');
            }
        });
    }
    assert.equal(transaction.mock.callCount(), 0);
});
