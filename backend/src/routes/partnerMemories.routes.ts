import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import { AuthRequest } from '../middleware/auth';
import { upload } from '../middleware/upload';
import {
    buildPartnerPairKey,
    getPartnerMemoryExpiryDate,
    presentPartnerMemory,
    purgeExpiredPartnerMemories,
    readPartnerMemoryImage,
    savePartnerMemoryImage,
    tryPurgePartnerMemoryImage,
} from '../services/partnerMemories';
import { sendPartnerMemoryPush } from '../lib/pushNotifications';

const router = Router();

const captionSchema = z.object({
    caption: z.string().trim().max(500).optional(),
});

async function getPartnerContext(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            displayName: true,
            partnerId: true,
            partner: {
                select: {
                    id: true,
                    displayName: true,
                },
            },
        },
    });

    if (!user?.partnerId || !user.partner) {
        return null;
    }

    return {
        userId: user.id,
        displayName: user.displayName,
        partnerId: user.partner.id,
        partnerName: user.partner.displayName,
        pairKey: buildPartnerPairKey(user.id, user.partner.id),
    };
}

function memoryInclude() {
    return {
        syncs: {
            select: {
                userId: true,
                ackedAt: true,
                downloadedAt: true,
            },
        },
    } as const;
}

/**
 * GET /partner/memories
 * List shared memories for the current partner pair.
 */
router.get('/', async (req, res, next) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const context = await getPartnerContext(userId);
        if (!context) {
            return res.status(400).json({ error: 'You do not have a partner' });
        }

        await purgeExpiredPartnerMemories();

        const memories = await prisma.partnerMemory.findMany({
            where: {
                pairKey: context.pairKey,
                deletedAt: null,
            },
            orderBy: { createdAt: 'desc' },
            take: 100,
            include: memoryInclude(),
        });

        res.json({
            memories: memories.map((memory) => presentPartnerMemory(memory, userId)),
        });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /partner/memories
 * Upload a photo memory for your partner.
 */
router.post('/', upload.single('image'), async (req, res, next) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const context = await getPartnerContext(userId);
        if (!context) {
            return res.status(400).json({ error: 'You do not have a partner' });
        }

        const file = req.file;
        if (!file) {
            return res.status(400).json({ error: 'Image is required' });
        }

        if (!/^image\/(jpeg|jpg|png|webp|heic|heif)$/i.test(file.mimetype)) {
            return res.status(400).json({ error: 'Unsupported image type (use jpg/png/webp)' });
        }

        const { caption } = captionSchema.parse(req.body ?? {});
        const memoryId = crypto.randomUUID();
        let savedImage;
        try {
            savedImage = await savePartnerMemoryImage(memoryId, file.buffer);
        } catch (imageError) {
            console.error('[partner-memories] image processing failed:', imageError);
            return res.status(400).json({ error: 'Could not process image' });
        }
        const now = new Date();

        let memory;
        try {
            memory = await prisma.partnerMemory.create({
                data: {
                    id: memoryId,
                    pairKey: context.pairKey,
                    authorUserId: context.userId,
                    recipientUserId: context.partnerId,
                    caption: caption || null,
                    imageMime: savedImage.imageMime,
                    imagePath: savedImage.imagePath,
                    imageSizeBytes: savedImage.imageSizeBytes,
                    imageExpiresAt: getPartnerMemoryExpiryDate(),
                    syncs: {
                        create: [
                            {
                                userId: context.userId,
                                ackedAt: now,
                                downloadedAt: now,
                            },
                            {
                                userId: context.partnerId,
                            },
                        ],
                    },
                },
                include: memoryInclude(),
            });
        } catch (dbError) {
            console.error('[partner-memories] database create failed:', dbError);
            return res.status(503).json({
                error: 'Partner memories are not available on the server yet. Run database migrations and redeploy.',
            });
        }

        void sendPartnerMemoryPush({
            toUserId: context.partnerId,
            fromName: context.displayName,
            memoryId: memory.id,
        }).catch((error) => {
            console.error('[partner-memories] push failed:', error);
        });

        res.status(201).json({
            memory: presentPartnerMemory(memory, userId),
        });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /partner/memories/:id/image
 * Download the temporary image for a shared memory.
 */
router.get('/:id/image', async (req, res, next) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const context = await getPartnerContext(userId);
        if (!context) {
            return res.status(400).json({ error: 'You do not have a partner' });
        }

        const memory = await prisma.partnerMemory.findFirst({
            where: {
                id: req.params.id,
                pairKey: context.pairKey,
                deletedAt: null,
            },
            select: {
                id: true,
                imagePath: true,
                imageDeletedAt: true,
                imageExpiresAt: true,
                imageMime: true,
            },
        });

        if (!memory || memory.imageDeletedAt || !memory.imagePath) {
            return res.status(404).json({ error: 'Image not available' });
        }

        if (memory.imageExpiresAt && memory.imageExpiresAt.getTime() <= Date.now()) {
            await tryPurgePartnerMemoryImage(memory.id);
            return res.status(404).json({ error: 'Image expired' });
        }

        const bytes = await readPartnerMemoryImage(memory.id);
        if (!bytes) {
            return res.status(404).json({ error: 'Image not available' });
        }

        await prisma.partnerMemorySync.updateMany({
            where: {
                memoryId: memory.id,
                userId,
            },
            data: {
                downloadedAt: new Date(),
            },
        });

        res.setHeader('Content-Type', memory.imageMime);
        res.setHeader('Cache-Control', 'private, max-age=3600');
        res.send(bytes);
    } catch (err) {
        next(err);
    }
});

/**
 * POST /partner/memories/:id/ack
 * Confirm the image is saved locally so the server can purge temp storage.
 */
router.post('/:id/ack', async (req, res, next) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const context = await getPartnerContext(userId);
        if (!context) {
            return res.status(400).json({ error: 'You do not have a partner' });
        }

        const memory = await prisma.partnerMemory.findFirst({
            where: {
                id: req.params.id,
                pairKey: context.pairKey,
                deletedAt: null,
            },
            select: { id: true },
        });

        if (!memory) {
            return res.status(404).json({ error: 'Memory not found' });
        }

        const now = new Date();
        await prisma.partnerMemorySync.updateMany({
            where: {
                memoryId: memory.id,
                userId,
            },
            data: {
                ackedAt: now,
                downloadedAt: now,
            },
        });

        await tryPurgePartnerMemoryImage(memory.id);

        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

/**
 * DELETE /partner/memories/:id
 * Soft-delete a memory (author only).
 */
router.delete('/:id', async (req, res, next) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const context = await getPartnerContext(userId);
        if (!context) {
            return res.status(400).json({ error: 'You do not have a partner' });
        }

        const memory = await prisma.partnerMemory.findFirst({
            where: {
                id: req.params.id,
                pairKey: context.pairKey,
                authorUserId: userId,
                deletedAt: null,
            },
            select: { id: true },
        });

        if (!memory) {
            return res.status(404).json({ error: 'Memory not found' });
        }

        await prisma.partnerMemory.update({
            where: { id: memory.id },
            data: { deletedAt: new Date() },
        });

        await tryPurgePartnerMemoryImage(memory.id);

        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

export default router;
