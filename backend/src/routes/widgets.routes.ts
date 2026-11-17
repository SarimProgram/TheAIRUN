import { Router, type Request } from 'express';
import { z } from 'zod';

import { prisma } from '../db/prisma';
import { buildPartnerFoodFeed, hashFeedToken, PARTNER_FOOD_WIDGET_KIND } from '../lib/partnerFoodWidget';
import { photoDownloadUrl, readPhoto } from '../services/workoutPhotoStorage';

/** Called by the widget extension, which only holds its read-only feed token, never the user's session. */
const router = Router();

async function deviceFor(req: Request) {
    const header = req.get('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) return null;
    return prisma.widgetPushDevice.findUnique({ where: { feedTokenHash: hashFeedToken(token) } });
}

router.get('/partner-food', async (req, res, next) => {
    try {
        const device = await deviceFor(req);
        if (!device || device.kind !== PARTNER_FOOD_WIDGET_KIND) return res.status(401).json({ error: 'Unknown widget' });
        res.setHeader('Cache-Control', 'private, no-store');
        res.json(await buildPartnerFoodFeed(device.userId));
    } catch (error) { next(error); }
});

router.get('/partner-food/image/:id/:kind', async (req, res, next) => {
    try {
        const device = await deviceFor(req);
        if (!device || device.kind !== PARTNER_FOOD_WIDGET_KIND) return res.status(401).json({ error: 'Unknown widget' });
        const params = z.object({ id: z.string().uuid(), kind: z.enum(['photo', 'cutout']) }).parse(req.params);
        const row = await prisma.sharedMeal.findFirst({ where: { id: params.id, recipientUserId: device.userId } });
        const reference = params.kind === 'photo' ? row?.photoPath : row?.cutoutPath;
        if (!row || !reference || row.expiresAt.getTime() <= Date.now()) return res.status(404).json({ error: 'Photo unavailable' });
        res.setHeader('Cache-Control', 'private, no-store');
        const url = await photoDownloadUrl(reference, row.expiresAt);
        if (url) return res.redirect(302, url);
        const bytes = await readPhoto(reference).catch(() => null);
        if (!bytes) return res.status(404).json({ error: 'Photo unavailable' });
        res.type(params.kind === 'cutout' ? 'png' : 'jpeg').send(bytes);
    } catch (error) { next(error); }
});

/** WidgetKit rotated the push token while the app was closed. */
router.post('/push-token', async (req, res, next) => {
    try {
        const device = await deviceFor(req);
        if (!device) return res.status(401).json({ error: 'Unknown widget' });
        const { pushToken } = z.object({ pushToken: z.string().regex(/^[0-9a-f]{16,200}$/i) }).parse(req.body);
        if (pushToken !== device.pushToken) {
            await prisma.widgetPushDevice.deleteMany({ where: { pushToken, NOT: { id: device.id } } });
            await prisma.widgetPushDevice.update({ where: { id: device.id }, data: { pushToken } });
        }
        res.json({ ok: true });
    } catch (error) { next(error); }
});

export default router;
