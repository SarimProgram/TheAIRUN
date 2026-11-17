import { Router } from 'express';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import { AuthRequest } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { dayKeyInTimezone } from '../lib/weekBounds';
import { workoutPhotoProgress, workoutPhotoVisibility } from '../lib/workoutPhotoProgress';

import { deletePhoto, encodePhoto, photoDownloadUrl, photoExpiry, readPhoto, writePhoto } from '../services/workoutPhotoStorage';

const router = Router();

const timezone = z.string().max(100).refine(value => {
    try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; }
}, 'Invalid timezone');
const input = z.object({ clientId: z.string().uuid(), capturedAt: z.string().datetime(), timezone });
const present = (row: { id: string; authorUserId: string; dayKey: string; capturedAt: Date; expiresAt: Date }) => ({
    id: row.id, authorUserId: row.authorUserId, dayKey: row.dayKey, capturedAt: row.capturedAt, expiresAt: row.expiresAt,
});

async function context(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { partnerId: true } });
    // Both links must still exist before serving shared images.
    const partner = user.partnerId ? await prisma.user.findFirst({ where: { id: user.partnerId, partnerId: userId }, select: { id: true } }) : null;
    return partner?.id ?? null;
}

router.get('/', async (req, res, next) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const query = z.object({ timezone, cursor: z.string().uuid().optional() }).parse(req.query);
        const partnerId = await context(userId);
        const where = workoutPhotoVisibility(userId, partnerId);
        const visible = { ...where, expiresAt: { gt: new Date() }, imagesDeletedAt: null };
        const rows = await prisma.workoutPhoto.findMany({ where: visible, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 21,
            ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}) });
        // Include a preview for both players even if one logged more than a full page.
        const previews = query.cursor ? [] : await prisma.workoutPhoto.findMany({
            where: visible, distinct: ['authorUserId'], orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        });
        const page = [...new Map([...rows.slice(0, 20), ...previews].map(row => [row.id, row])).values()]
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id));
        const days = await prisma.workoutPhoto.findMany({ where, distinct: ['authorUserId', 'dayKey'], select: { authorUserId: true, dayKey: true } });
        const today = dayKeyInTimezone(new Date(), query.timezone);
        res.json({ photos: page.map(present), nextCursor: rows.length > 20 ? rows[19].id : null, partnerId,
            mine: workoutPhotoProgress(days.filter(row => row.authorUserId === userId).map(row => row.dayKey), today),
            partner: workoutPhotoProgress(days.filter(row => row.authorUserId === partnerId).map(row => row.dayKey), today) });
    } catch (error) { next(error); }
});

router.post('/', upload.fields([{ name: 'selfie', maxCount: 1 }, { name: 'surroundings', maxCount: 1 }]), async (req, res, next) => {
    const paths: string[] = [];
    try {
        const userId = (req as AuthRequest).user!.id;
        const body = input.parse(req.body);
        const existing = await prisma.workoutPhoto.findUnique({ where: { authorUserId_clientId: { authorUserId: userId, clientId: body.clientId } } });
        if (existing) return res.json({ photo: present(existing) });
        const capturedAt = new Date(body.capturedAt);
        if (capturedAt.getTime() > Date.now() + 300000) return res.status(400).json({ error: 'Capture time is in the future' });
        if (photoExpiry(capturedAt).getTime() <= Date.now()) return res.status(400).json({ error: 'Photos older than 30 days cannot be logged' });
        const files = req.files as Record<string, Express.Multer.File[]> | undefined;
        if (!files?.selfie?.[0] || !files?.surroundings?.[0]) return res.status(400).json({ error: 'Both photos are required' });
        const id = randomUUID();
        // Validate and encode all images before writing anything.
        const encoded = [];
        for (const kind of ['selfie', 'surroundings'] as const) {
            for (const thumb of [false, true]) {
                encoded.push({ key: `workout-photos/${id}/${kind}${thumb ? '-thumb' : ''}.jpg`,
                    bytes: await encodePhoto(files[kind][0].buffer, thumb) });
            }
        }
        for (const image of encoded) paths.push(await writePhoto(image.key, image.bytes));
        const photo = await prisma.workoutPhoto.create({ data: {
            id, authorUserId: userId, recipientUserId: await context(userId), clientId: body.clientId,
            capturedAt, dayKey: dayKeyInTimezone(capturedAt, body.timezone), selfiePath: paths[0], selfieThumbPath: paths[1], surroundingsPath: paths[2], surroundingsThumbPath: paths[3], expiresAt: photoExpiry(capturedAt),
        } });
        paths.length = 0;
        res.status(201).json({ photo: present(photo) });
    } catch (error) {
        await Promise.all(paths.map(file => deletePhoto(file).catch(() => {})));
        if ((error as { code?: string }).code === 'P2002') {
            const existing = await prisma.workoutPhoto.findUnique({ where: { authorUserId_clientId: { authorUserId: (req as AuthRequest).user!.id, clientId: req.body.clientId } } });
            if (existing) return res.json({ photo: present(existing) });
        }
        next(error);
    }
});

router.get('/:id/:kind', async (req, res, next) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const params = z.object({ id: z.string().uuid(), kind: z.enum(['selfie', 'surroundings']) }).parse(req.params);
        const photo = await prisma.workoutPhoto.findFirst({ where: { id: params.id, ...workoutPhotoVisibility(userId, await context(userId)) } });
        if (!photo || photo.imagesDeletedAt || photo.expiresAt.getTime() <= Date.now()) return res.status(404).json({ error: 'Photo expired or unavailable' });
        const query = z.object({ size: z.enum(['full', 'thumb']).default('full'), delivery: z.enum(['image', 'url']).default('image') }).parse(req.query ?? {});
        const full = params.kind === 'selfie' ? photo.selfiePath : photo.surroundingsPath;
        const thumb = params.kind === 'selfie' ? photo.selfieThumbPath : photo.surroundingsThumbPath;
        const reference = query.size === 'thumb' ? thumb || full : full;
        if (!reference) return res.status(404).json({ error: 'Photo unavailable' });
        res.setHeader('Cache-Control', 'private, no-store');
        const url = await photoDownloadUrl(reference, photo.expiresAt);
        if (query.delivery === 'url') return res.json({ url, expiresAt: photo.expiresAt });
        // Compatibility for older clients: redirect directly to the private bucket.
        if (url) return res.redirect(302, url);
        const bytes = await readPhoto(reference).catch(() => null);
        if (!bytes) return res.status(404).json({ error: 'Photo unavailable' });
        res.type('jpeg').send(bytes);
    } catch (error) { next(error); }
});

export default router;
