import { Router, Response } from 'express';
import { z } from 'zod';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import prisma from '../db/prisma';
import { requireStringParam } from '../utils/params';

const router = Router();
const UNDO_WINDOW_MS = 60 * 60 * 1000;

const ALLOWED_CATEGORIES = ['Romantic', 'Fun', 'Chore', 'Spicy'] as const;

const createItemSchema = z.object({
    title: z.string().trim().min(1).max(80),
    description: z.string().trim().max(240).optional().nullable(),
    cost: z.number().int().positive().max(100000),
    category: z.enum(ALLOWED_CATEGORIES),
    emoji: z.string().trim().min(1).max(8),
});

const updateItemSchema = z.object({
    title: z.string().trim().min(1).max(80).optional(),
    description: z.string().trim().max(240).optional().nullable(),
    cost: z.number().int().positive().max(100000).optional(),
    category: z.enum(ALLOWED_CATEGORIES).optional(),
    emoji: z.string().trim().min(1).max(8).optional(),
    isActive: z.boolean().optional(),
});

const DEFAULT_ITEMS = [
    { title: 'Dinner Date', cost: 5000, category: 'Romantic', emoji: '🍽️', colorFrom: '#FDA4AF', colorTo: '#FB7185', sortOrder: 1 },
    { title: 'Game Night', cost: 2000, category: 'Fun', emoji: '🎮', colorFrom: '#F9A8D4', colorTo: '#F472B6', sortOrder: 2 },
    { title: 'Wash Dishes', cost: 3500, category: 'Chore', emoji: '🧼', colorFrom: '#FDBA74', colorTo: '#FB923C', sortOrder: 3 },
    { title: 'Weekend Trip', cost: 15000, category: 'Romantic', emoji: '✈️', colorFrom: '#FB7185', colorTo: '#E11D48', sortOrder: 4 },
    { title: 'Mystery Box', cost: 1000, category: 'Fun', emoji: '🎁', colorFrom: '#DDD6FE', colorTo: '#C4B5FD', sortOrder: 5 },
    { title: 'Breakfast in Bed', cost: 4000, category: 'Romantic', emoji: '🥞', colorFrom: '#FECACA', colorTo: '#FCA5A5', sortOrder: 6 },
    { title: 'Movie Night Pick', cost: 1500, category: 'Fun', emoji: '🎬', colorFrom: '#A5B4FC', colorTo: '#818CF8', sortOrder: 7 },
    { title: 'Back Massage', cost: 3000, category: 'Spicy', emoji: '💆', colorFrom: '#FBCFE8', colorTo: '#F9A8D4', sortOrder: 8 },
    { title: 'Cook Dinner', cost: 4500, category: 'Chore', emoji: '👨‍🍳', colorFrom: '#FED7AA', colorTo: '#FDBA74', sortOrder: 9 },
    { title: 'Sleep In Day', cost: 2500, category: 'Fun', emoji: '😴', colorFrom: '#E0E7FF', colorTo: '#C7D2FE', sortOrder: 10 },
];

function getPairKey(userId: string, partnerId: string): string {
    return [userId, partnerId].sort((a, b) => a.localeCompare(b)).join(':');
}

function formatMarketplaceItem(item: any, pairKey: string | null) {
    return {
        id: item.id,
        title: item.title,
        description: item.description ?? null,
        cost: item.cost,
        category: item.category,
        emoji: item.emoji,
        color: [item.colorFrom, item.colorTo],
        isCustom: item.isCustom,
        createdByUserId: item.createdByUserId ?? null,
        canManage: Boolean(pairKey && item.pairKey && item.pairKey === pairKey && item.isCustom),
    };
}

async function ensureDefaultItems() {
    const count = await prisma.marketplaceItem.count();
    if (count === 0) {
        await prisma.marketplaceItem.createMany({
            data: DEFAULT_ITEMS.map((item) => ({ ...item, source: 'DEFAULT' })),
        });
    }
}

async function getUserPairKey(userId: string): Promise<string | null> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { partnerId: true },
    });
    if (!user?.partnerId) return null;
    return getPairKey(userId, user.partnerId);
}

function isUndoWindowOpen(createdAt: Date) {
    return (Date.now() - new Date(createdAt).getTime()) <= UNDO_WINDOW_MS;
}

function buyerUserIdForWalletItem(walletItem: { userId: string; redeemedBy: string }, ownerPartnerId: string | null | undefined) {
    if (walletItem.redeemedBy === 'me') return walletItem.userId;
    return ownerPartnerId ?? null;
}

function requesterCanAccessWalletItem(
    requesterId: string,
    requesterPartnerId: string | null | undefined,
    walletOwnerId: string
) {
    return requesterId === walletOwnerId || (!!requesterPartnerId && requesterPartnerId === walletOwnerId);
}

router.get('/items', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        await ensureDefaultItems();
        const pairKey = await getUserPairKey(userId);

        if (pairKey) {
            const pairOnboardingItems = await prisma.marketplaceItem.findMany({
                where: {
                    isActive: true,
                    source: 'ONBOARDING',
                    pairKey,
                },
                orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
            });

            if (pairOnboardingItems.length > 0) {
                return res.json(pairOnboardingItems.map((item) => formatMarketplaceItem(item, pairKey)));
            }
        }

        const userScopedOnboardingItems = await prisma.marketplaceItem.findMany({
            where: {
                isActive: true,
                source: 'ONBOARDING',
                pairKey: null,
                createdByUserId: userId,
            },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        });

        if (userScopedOnboardingItems.length > 0) {
            return res.json(userScopedOnboardingItems.map((item) => formatMarketplaceItem(item, pairKey)));
        }

        const items = await prisma.marketplaceItem.findMany({
            where: {
                isActive: true,
                OR: [
                    { source: 'DEFAULT', pairKey: null },
                    ...(pairKey ? [{ pairKey }] : []),
                ],
            },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        });

        return res.json(items.map((item) => formatMarketplaceItem(item, pairKey)));
    } catch (error) {
        console.error('Error fetching marketplace items:', error);
        res.status(500).json({ error: 'Failed to fetch items' });
    }
});

router.post('/items', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const pairKey = await getUserPairKey(userId);
        if (!pairKey) {
            return res.status(400).json({ error: 'You must have a partner to create shared rewards' });
        }

        const data = createItemSchema.parse(req.body);
        const created = await prisma.marketplaceItem.create({
            data: {
                title: data.title,
                description: data.description ?? null,
                cost: data.cost,
                category: data.category,
                emoji: data.emoji,
                colorFrom: '#DDD6FE',
                colorTo: '#C4B5FD',
                sortOrder: 1000,
                isCustom: true,
                source: 'USER_CUSTOM',
                pairKey,
                createdByUserId: userId,
                isActive: true,
            },
        });

        res.status(201).json(formatMarketplaceItem(created, pairKey));
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.issues[0]?.message || 'Invalid payload' });
        }
        console.error('Error creating marketplace item:', error);
        res.status(500).json({ error: 'Failed to create item' });
    }
});

router.patch('/items/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const pairKey = await getUserPairKey(userId);
        if (!pairKey) {
            return res.status(400).json({ error: 'You must have a partner to manage shared rewards' });
        }

        const itemId = requireStringParam(req.params.id, 'id');
        const payload = updateItemSchema.parse(req.body);
        const item = await prisma.marketplaceItem.findUnique({ where: { id: itemId } });

        if (!item || !item.isCustom || item.pairKey !== pairKey) {
            return res.status(404).json({ error: 'Item not found' });
        }

        const updated = await prisma.marketplaceItem.update({
            where: { id: itemId },
            data: payload,
        });

        res.json(formatMarketplaceItem(updated, pairKey));
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.issues[0]?.message || 'Invalid payload' });
        }
        console.error('Error updating marketplace item:', error);
        res.status(500).json({ error: 'Failed to update item' });
    }
});

router.delete('/items/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const pairKey = await getUserPairKey(userId);
        if (!pairKey) {
            return res.status(400).json({ error: 'You must have a partner to manage shared rewards' });
        }

        const itemId = requireStringParam(req.params.id, 'id');
        const item = await prisma.marketplaceItem.findUnique({ where: { id: itemId } });
        if (!item || !item.isCustom || item.pairKey !== pairKey) {
            return res.status(404).json({ error: 'Item not found' });
        }

        await prisma.marketplaceItem.update({
            where: { id: itemId },
            data: { isActive: false },
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting marketplace item:', error);
        res.status(500).json({ error: 'Failed to delete item' });
    }
});

router.get('/wallet', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { partnerId: true },
        });

        // Backward-compat migration: older redeems stored the obligation on the redeemer.
        // Move active "redeemedBy=me" items to the partner's wallet so the owing partner sees them.
        if (user?.partnerId) {
            const legacyItems = await prisma.walletItem.findMany({
                where: { userId, status: 'ACTIVE', redeemedBy: 'me' },
                select: { id: true },
            });

            if (legacyItems.length > 0) {
                await prisma.walletItem.updateMany({
                    where: { id: { in: legacyItems.map((w) => w.id) } },
                    data: { userId: user.partnerId, redeemedBy: 'partner' },
                });
            }
        }

        const [ownWalletItems, partnerWalletItems] = await Promise.all([
            prisma.walletItem.findMany({
                where: { userId, status: 'ACTIVE' },
                include: { item: true },
                orderBy: { createdAt: 'desc' },
            }),
            user?.partnerId
                ? prisma.walletItem.findMany({
                    where: {
                        userId: user.partnerId,
                        status: 'ACTIVE',
                        // Partner wallet items they owe (show to current user as "Partner owes you")
                        redeemedBy: 'partner',
                    },
                    include: { item: true },
                    orderBy: { createdAt: 'desc' },
                })
                : Promise.resolve([] as any[]),
        ]);

        const ownFormatted = ownWalletItems.map((w) => ({
            id: w.id,
            title: w.item.title,
            by: w.redeemedBy,
            status: w.redeemedBy === 'me' ? 'Partner owes you' : 'You owe this!',
            icon: w.item.emoji,
            canUndo: w.redeemedBy === 'me' && isUndoWindowOpen(w.createdAt),
            undoExpiresAt: new Date(w.createdAt.getTime() + UNDO_WINDOW_MS),
            canComplete: true,
            canDelete: w.redeemedBy === 'me',
            createdAt: w.createdAt,
        }));

        const partnerOwesFormatted = partnerWalletItems.map((w) => ({
            id: w.id,
            title: w.item.title,
            by: 'me', // normalize relative to current user: partner owes me
            status: 'Partner owes you',
            icon: w.item.emoji,
            canUndo: isUndoWindowOpen(w.createdAt),
            undoExpiresAt: new Date(w.createdAt.getTime() + UNDO_WINDOW_MS),
            canComplete: true,
            canDelete: true,
            createdAt: w.createdAt,
        }));

        const formatted = [...ownFormatted, ...partnerOwesFormatted]
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .map(({ createdAt, ...rest }) => rest);

        res.json(formatted);
    } catch (error) {
        console.error('Error fetching wallet:', error);
        res.status(500).json({ error: 'Failed to fetch wallet' });
    }
});

router.post('/redeem', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { itemId } = req.body;

        if (!itemId) {
            return res.status(400).json({ error: 'itemId is required' });
        }

        const [item, pairKey, user] = await Promise.all([
            prisma.marketplaceItem.findUnique({ where: { id: itemId } }),
            getUserPairKey(userId),
            prisma.user.findUnique({ where: { id: userId }, select: { partnerId: true } }),
        ]);

        if (!item || !item.isActive) {
            return res.status(404).json({ error: 'Item not found' });
        }

        if (item.pairKey && item.pairKey !== pairKey) {
            return res.status(403).json({ error: 'You cannot redeem this item' });
        }
        if (!user?.partnerId) {
            return res.status(400).json({ error: 'You must have a partner to redeem shared rewards' });
        }

        const userPoints = await prisma.userPoints.findUnique({
            where: { userId },
        });

        const balance = userPoints?.balance ?? 0;
        if (balance < item.cost) {
            return res.status(400).json({
                error: 'Insufficient points',
                balance,
                required: item.cost,
            });
        }

        const existingActiveForPartner = await prisma.walletItem.count({
            where: { userId: user.partnerId, status: 'ACTIVE' },
        });
        if (existingActiveForPartner > 0) {
            return res.status(400).json({ error: 'Your partner already has an active reward. Only 1 active reward per person is allowed.' });
        }

        const [updatedPoints, walletItem] = await prisma.$transaction([
            prisma.userPoints.update({
                where: { userId },
                data: { balance: balance - item.cost },
            }),
            prisma.walletItem.create({
                data: {
                    userId: user.partnerId,
                    itemId,
                    redeemedBy: 'partner',
                },
                include: { item: true },
            }),
        ]);

        res.json({
            success: true,
            balance: updatedPoints.balance,
            walletItem: {
                id: walletItem.id,
                title: walletItem.item.title,
                by: walletItem.redeemedBy,
                status: 'Assigned to partner',
                icon: walletItem.item.emoji,
            },
        });
    } catch (error) {
        console.error('Error redeeming item:', error);
        res.status(500).json({ error: 'Failed to redeem item' });
    }
});

router.patch('/wallet/:id/complete', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const id = requireStringParam(req.params.id, 'id');
        const requester = await prisma.user.findUnique({
            where: { id: userId },
            select: { partnerId: true },
        });
        const walletItem = await prisma.walletItem.findUnique({
            where: { id },
            include: {
                user: { select: { id: true, partnerId: true } },
            },
        });

        if (!walletItem || walletItem.status !== 'ACTIVE') {
            return res.status(404).json({ error: 'Wallet item not found' });
        }
        if (!requesterCanAccessWalletItem(userId, requester?.partnerId, walletItem.userId)) {
            return res.status(403).json({ error: 'Not allowed to complete this reward' });
        }

        const updated = await prisma.walletItem.update({
            where: { id },
            data: { status: 'COMPLETED' },
        });

        res.json({ success: true, status: updated.status });
    } catch (error) {
        console.error('Error completing wallet item:', error);
        res.status(500).json({ error: 'Failed to complete item' });
    }
});

router.post('/wallet/:id/undo', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const requesterId = req.user!.id;
        const id = requireStringParam(req.params.id, 'id');

        const requester = await prisma.user.findUnique({
            where: { id: requesterId },
            select: { partnerId: true },
        });

        const walletItem = await prisma.walletItem.findUnique({
            where: { id },
            include: {
                item: true,
                user: { select: { id: true, partnerId: true } },
            },
        });

        if (!walletItem || walletItem.status !== 'ACTIVE') {
            return res.status(404).json({ error: 'Wallet item not found' });
        }
        if (!requesterCanAccessWalletItem(requesterId, requester?.partnerId, walletItem.userId)) {
            return res.status(403).json({ error: 'Not allowed to undo this reward' });
        }
        if (!isUndoWindowOpen(walletItem.createdAt)) {
            return res.status(400).json({ error: 'Undo window expired. Use delete instead.' });
        }

        const buyerUserId = buyerUserIdForWalletItem(walletItem, walletItem.user.partnerId);
        if (!buyerUserId || buyerUserId !== requesterId) {
            return res.status(403).json({ error: 'Only the buyer can undo within the first hour' });
        }

        const userPoints = await prisma.userPoints.findUnique({ where: { userId: buyerUserId } });
        const balance = userPoints?.balance ?? 0;

        await prisma.$transaction([
            prisma.userPoints.upsert({
                where: { userId: buyerUserId },
                create: { userId: buyerUserId, balance: walletItem.item.cost },
                update: { balance: balance + walletItem.item.cost },
            }),
            prisma.walletItem.delete({ where: { id } }),
        ]);

        res.json({ success: true, refundedPoints: walletItem.item.cost });
    } catch (error) {
        console.error('Error undoing wallet item:', error);
        res.status(500).json({ error: 'Failed to undo item' });
    }
});

router.delete('/wallet/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const id = requireStringParam(req.params.id, 'id');
        const requester = await prisma.user.findUnique({
            where: { id: userId },
            select: { partnerId: true },
        });
        const walletItem = await prisma.walletItem.findUnique({
            where: { id },
            include: {
                user: { select: { id: true, partnerId: true } },
            },
        });

        if (!walletItem) {
            return res.status(404).json({ error: 'Wallet item not found' });
        }
        if (!requesterCanAccessWalletItem(userId, requester?.partnerId, walletItem.userId)) {
            return res.status(403).json({ error: 'Not allowed to delete this reward' });
        }
        const buyerUserId = buyerUserIdForWalletItem(walletItem, walletItem.user.partnerId);
        if (!buyerUserId || buyerUserId !== userId) {
            return res.status(403).json({ error: 'Only the buyer can delete this reward. The owing partner can only mark it fulfilled.' });
        }

        await prisma.walletItem.delete({ where: { id } });

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting wallet item:', error);
        res.status(500).json({ error: 'Failed to delete item' });
    }
});

router.get('/history', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, displayName: true, partnerId: true, partner: { select: { id: true, displayName: true } } },
        });

        const ids = [userId, user?.partnerId].filter(Boolean) as string[];
        const rows = await prisma.walletItem.findMany({
            where: {
                userId: { in: ids },
                status: { in: ['ACTIVE', 'COMPLETED', 'EXPIRED'] },
            },
            include: {
                item: true,
                user: { select: { id: true, displayName: true, partnerId: true } },
            },
            orderBy: { updatedAt: 'desc' },
            take: 100,
        });

        const history = rows.map((w) => {
            const buyerUserId = buyerUserIdForWalletItem(w, w.user.partnerId);
            const buyerName =
                buyerUserId === user?.id ? (user?.displayName ?? 'You')
                    : buyerUserId === user?.partner?.id ? (user?.partner?.displayName ?? 'Partner')
                        : 'Unknown';
            const owesUserName = w.userId === user?.id ? (user?.displayName ?? 'You')
                : w.userId === user?.partner?.id ? (user?.partner?.displayName ?? 'Partner')
                    : (w.user.displayName ?? 'Partner');

            return {
                id: w.id,
                title: w.item.title,
                icon: w.item.emoji,
                status: w.status,
                boughtByUserId: buyerUserId,
                boughtByName: buyerName,
                owedByUserId: w.userId,
                owedByName: owesUserName,
                boughtAt: w.createdAt,
                fulfilledAt: w.status === 'COMPLETED' ? w.updatedAt : null,
            };
        });

        res.json({ history });
    } catch (error) {
        console.error('Error fetching marketplace history:', error);
        res.status(500).json({ error: 'Failed to fetch marketplace history' });
    }
});

export default router;
