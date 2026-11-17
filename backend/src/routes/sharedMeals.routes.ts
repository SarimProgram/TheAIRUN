import { Router } from 'express';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { z } from 'zod';
import type { Prisma, SharedMeal } from '@prisma/client';
import { prisma } from '../db/prisma';
import { AuthRequest } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { deliverPartnerChatMessage } from '../socket';
import { buildMealPlateMessage, buildMealReplyMessage } from '../lib/mealPassMessage';
import { plateTotals, senderPortion, type PlateItem } from '../lib/mealSplit';
import { saveRecipientMeal } from '../services/sharedMealLogs';
import { deletePhoto, encodePhoto, photoDownloadUrl, readPhoto, writePhoto } from '../services/workoutPhotoStorage';
import { notifyPartnerFoodWidgets } from '../lib/partnerFoodWidget';

const router = Router();

export const SHARED_MEAL_LIFETIME_MS = 3 * 24 * 60 * 60 * 1000;
const MAX_COPY_SERVING = 3;

const nutrient = z.number().min(0).max(5000).nullable().optional();
const item = z.object({
    foodName: z.string().trim().min(1).max(120),
    calories: z.number().int().min(0).max(10000),
    grams: nutrient, proteinG: nutrient, carbsG: nutrient, fatG: nutrient,
});
const mode = z.enum(['SPLIT', 'COPY']);
const shares = z.array(z.number().finite().min(0).max(MAX_COPY_SERVING)).min(1).max(20);
const createInput = z.object({
    clientId: z.string().uuid(),
    mode,
    mealType: z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK']),
    items: z.array(item).min(1).max(20),
    itemShares: shares,
    senderClientMealId: z.string().min(1).max(100).optional(),
    xPct: z.number().min(0).max(1).default(0.5),
});
const respondInput = z.object({ action: z.enum(['accept', 'decline']), itemShares: shares.optional() });

/** SPLIT shares are fractions of each item; COPY shares are serving sizes. The recipient must get something. */
export function sharesAreValid(kind: 'SPLIT' | 'COPY', items: unknown[], values: number[]) {
    if (values.length !== items.length || !values.some((value) => value > 0)) return false;
    return kind === 'COPY' || values.every((value) => value <= 1);
}

const include = {
    sender: { select: { displayName: true, gender: true } },
    recipient: { select: { displayName: true, gender: true } },
} as const;

async function deleteRecipientMeal(tx: Prisma.TransactionClient, row: Pick<SharedMeal, 'id' | 'recipientUserId'>) {
    const where = { userId: row.recipientUserId, clientMealId: `pass-${row.id}` };
    await tx.mealItem.deleteMany({ where: { meal: where } });
    await tx.mealLog.deleteMany({ where });
}

function present(row: NonNullable<Awaited<ReturnType<typeof findVisible>>>, viewerId: string) {
    return {
        id: row.id, mode: row.mode, mealType: row.mealType, items: row.items, itemShares: row.itemShares,
        status: row.status, createdAt: row.createdAt, respondedAt: row.respondedAt, expiresAt: row.expiresAt,
        senderUserId: row.senderUserId, recipientUserId: row.recipientUserId,
        senderName: row.sender.displayName, senderGender: row.sender.gender,
        recipientName: row.recipient.displayName, recipientGender: row.recipient.gender,
        hasPhoto: !!row.photoPath, hasCutout: !!row.cutoutPath,
        senderClientMealId: row.senderUserId === viewerId ? row.senderClientMealId : null,
    };
}

/** Both links must still exist before sharing or serving anything. */
async function linkedPartner(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { partnerId: true, displayName: true } });
    const partner = user.partnerId
        ? await prisma.user.findFirst({ where: { id: user.partnerId, partnerId: userId }, select: { id: true, displayName: true, gender: true } })
        : null;
    return { displayName: user.displayName, partner };
}

async function findVisible(id: string, userId: string) {
    return prisma.sharedMeal.findFirst({
        where: { id, OR: [{ senderUserId: userId }, { recipientUserId: userId }] },
        include,
    });
}

router.get('/partner', async (req, res, next) => {
    try {
        const { partner } = await linkedPartner((req as AuthRequest).user!.id);
        res.json({ partner: partner ? { id: partner.id, name: partner.displayName, gender: partner.gender } : null });
    } catch (error) { next(error); }
});

router.get('/pending', async (req, res, next) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const { partner } = await linkedPartner(userId);
        if (!partner) return res.json({ meals: [] });
        const rows = await prisma.sharedMeal.findMany({
            where: { recipientUserId: userId, senderUserId: partner.id, status: 'PENDING', expiresAt: { gt: new Date() } },
            orderBy: { createdAt: 'asc' }, take: 10, include,
        });
        // Also backfill plates sent before automatic logging was introduced.
        for (const row of rows) {
            await prisma.$transaction(async tx => {
                // Lock the pending row so a concurrent decline cannot be undone by this backfill.
                const claimed = await tx.sharedMeal.updateMany({ where: { id: row.id, status: 'PENDING' }, data: { status: 'PENDING' } });
                if (claimed.count) await saveRecipientMeal(tx, row, row.itemShares as number[]);
            });
        }
        res.json({ meals: rows.map((row) => present(row, userId)) });
    } catch (error) { next(error); }
});

router.post('/', upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'cutout', maxCount: 1 }]), async (req, res, next) => {
    const paths: string[] = [];
    try {
        const userId = (req as AuthRequest).user!.id;
        const body = createInput.parse(typeof req.body?.payload === 'string' ? JSON.parse(req.body.payload) : req.body);
        if (!sharesAreValid(body.mode, body.items, body.itemShares)) return res.status(400).json({ error: 'Choose a portion for your partner' });
        const existing = await prisma.sharedMeal.findUnique({ where: { senderUserId_clientId: { senderUserId: userId, clientId: body.clientId } }, include });
        if (existing) return res.json({ meal: present(existing, userId) });
        const { displayName, partner } = await linkedPartner(userId);
        if (!partner) return res.status(400).json({ error: 'Connect a partner to pass a plate' });

        const files = req.files as Record<string, Express.Multer.File[]> | undefined;
        const photo = files?.photo?.[0];
        const cutout = files?.cutout?.[0];
        const id = randomUUID();
        // Validate and encode every image before writing anything.
        const encoded: { key: string; bytes: Buffer }[] = [];
        if (photo) encoded.push({ key: `shared-meals/${id}/photo.jpg`, bytes: await encodePhoto(photo.buffer) });
        if (cutout) {
            encoded.push({ key: `shared-meals/${id}/cutout.png`, bytes: await sharp(cutout.buffer, { limitInputPixels: 25_000_000 })
                .resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true }).png({ compressionLevel: 9 }).toBuffer() });
        }
        for (const image of encoded) paths.push(await writePhoto(image.key, image.bytes));

        const row = await prisma.$transaction(async tx => {
            const created = await tx.sharedMeal.create({
                data: {
                    id, senderUserId: userId, recipientUserId: partner.id, clientId: body.clientId,
                    senderClientMealId: body.senderClientMealId ?? null, mode: body.mode, mealType: body.mealType,
                    items: body.items, itemShares: body.itemShares,
                    photoPath: photo ? paths[0] : null, cutoutPath: cutout ? paths[photo ? 1 : 0] : null,
                    expiresAt: new Date(Date.now() + SHARED_MEAL_LIFETIME_MS),
                },
                include,
            });
            await saveRecipientMeal(tx, created, body.itemShares);
            return created;
        });
        paths.length = 0;

        const delivered = await deliverPartnerChatMessage(userId, buildMealPlateMessage(id, body.xPct, body.mealType, displayName));
        if (!delivered.ok) {
            await prisma.$transaction(async tx => {
                await deleteRecipientMeal(tx, row);
                await tx.sharedMeal.delete({ where: { id } });
            });
            await Promise.all([row.photoPath, row.cutoutPath].filter((path): path is string => !!path).map((path) => deletePhoto(path).catch(() => {})));
            return res.status(400).json({ error: delivered.error });
        }
        void notifyPartnerFoodWidgets(partner.id);
        res.status(201).json({ meal: present(row, userId) });
    } catch (error) {
        await Promise.all(paths.map((path) => deletePhoto(path).catch(() => {})));
        next(error);
    }
});

router.get('/:id', async (req, res, next) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const id = z.string().uuid().parse(req.params.id);
        const row = await findVisible(id, userId);
        if (!row) return res.status(404).json({ error: 'Plate not found' });
        res.json({ meal: present(row, userId) });
    } catch (error) { next(error); }
});

router.get('/:id/image/:kind', async (req, res, next) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const params = z.object({ id: z.string().uuid(), kind: z.enum(['photo', 'cutout']) }).parse(req.params);
        const { delivery } = z.object({ delivery: z.enum(['image', 'url']).default('image') }).parse(req.query ?? {});
        const row = await findVisible(params.id, userId);
        const reference = params.kind === 'photo' ? row?.photoPath : row?.cutoutPath;
        if (!row || !reference || row.expiresAt.getTime() <= Date.now()) return res.status(404).json({ error: 'Photo unavailable' });
        res.setHeader('Cache-Control', 'private, no-store');
        const url = await photoDownloadUrl(reference, row.expiresAt);
        if (delivery === 'url') return res.json({ url, expiresAt: row.expiresAt });
        if (url) return res.redirect(302, url);
        const bytes = await readPhoto(reference).catch(() => null);
        if (!bytes) return res.status(404).json({ error: 'Photo unavailable' });
        res.type(params.kind === 'cutout' ? 'png' : 'jpeg').send(bytes);
    } catch (error) { next(error); }
});

router.post('/:id/respond', async (req, res, next) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const id = z.string().uuid().parse(req.params.id);
        const body = respondInput.parse(req.body);
        const row = await prisma.sharedMeal.findFirst({ where: { id, recipientUserId: userId }, include });
        if (!row) return res.status(404).json({ error: 'Plate not found' });
        const status = body.action === 'accept' ? 'ACCEPTED' : 'DECLINED';
        // Retries of the same answer are safe; a different answer after the fact is not.
        if (row.status === status) {
            // Older servers could accept a plate without persisting its meal.
            // A retry repairs that gap while preserving any existing edited log.
            if (status === 'ACCEPTED') {
                await prisma.$transaction(tx => saveRecipientMeal(tx, row, row.itemShares as number[]));
            }
            return res.json({ meal: present(row, userId) });
        }
        if (row.status !== 'PENDING' || row.expiresAt.getTime() <= Date.now()) {
            return res.status(409).json({ error: 'This plate was already answered or has expired' });
        }
        const itemShares = body.action === 'accept' ? body.itemShares ?? (row.itemShares as number[]) : (row.itemShares as number[]);
        if (!sharesAreValid(row.mode, row.items as unknown[], itemShares)) return res.status(400).json({ error: 'Choose a portion to log' });

        const updated = await prisma.$transaction(async (tx) => {
            const claimed = await tx.sharedMeal.updateMany({
                where: { id, recipientUserId: userId, status: 'PENDING' },
                data: { status, itemShares, respondedAt: new Date() },
            });
            if (claimed.count === 0) return null;
            if (status === 'DECLINED') await deleteRecipientMeal(tx, row);
            else await saveRecipientMeal(tx, row, itemShares, true);
            // A changed split also re-portions the sender's already-logged meal.
            if (status === 'ACCEPTED' && row.mode === 'SPLIT' && row.senderClientMealId) {
                const meal = await tx.mealLog.findUnique({
                    where: { userId_clientMealId: { userId: row.senderUserId, clientMealId: row.senderClientMealId } },
                    select: { id: true },
                });
                if (meal) {
                    const portion = senderPortion(row.items as PlateItem[], itemShares, 'SPLIT');
                    const totals = plateTotals(portion);
                    await tx.mealItem.deleteMany({ where: { mealId: meal.id } });
                    await tx.mealLog.update({
                        where: { id: meal.id },
                        data: {
                            totalCalories: totals.calories, totalProteinG: totals.proteinG || null,
                            totalCarbsG: totals.carbsG || null, totalFatG: totals.fatG || null,
                            items: { create: portion.map((part) => ({
                                foodName: part.foodName, calories: part.calories, grams: part.grams ?? null,
                                proteinG: part.proteinG ?? null, carbsG: part.carbsG ?? null, fatG: part.fatG ?? null,
                            })) },
                        },
                    });
                }
            }
            return tx.sharedMeal.findUniqueOrThrow({ where: { id }, include });
        });
        if (!updated) return res.status(409).json({ error: 'This plate was already answered' });

        await deliverPartnerChatMessage(userId, buildMealReplyMessage(id, status === 'ACCEPTED' ? 'accepted' : 'declined'))
            .catch((error) => console.error('[SharedMeal] Reply delivery failed:', error));
        // The answering phone updates its own widget; this reaches the user's other devices.
        void notifyPartnerFoodWidgets(userId);
        res.json({ meal: present(updated, userId) });
    } catch (error) { next(error); }
});

export default router;
