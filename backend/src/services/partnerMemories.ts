import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { prisma } from '../db/prisma';

const MEMORY_IMAGE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MEMORY_STORAGE_DIR =
    process.env.PARTNER_MEMORY_STORAGE_DIR ??
    path.join(process.cwd(), 'tmp', 'partner-memories');

export function buildPartnerPairKey(userIdA: string, userIdB: string) {
    return [userIdA, userIdB].sort().join(':');
}

function memoryImagePath(memoryId: string) {
    return path.join(MEMORY_STORAGE_DIR, `${memoryId}.jpg`);
}

async function ensureStorageDir() {
    await fs.mkdir(MEMORY_STORAGE_DIR, { recursive: true });
}

export async function savePartnerMemoryImage(memoryId: string, buffer: Buffer) {
    await ensureStorageDir();
    const resized = await sharp(buffer)
        .rotate()
        .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toBuffer();

    const imagePath = memoryImagePath(memoryId);
    await fs.writeFile(imagePath, resized);
    return {
        imagePath,
        imageSizeBytes: resized.length,
        imageMime: 'image/jpeg',
    };
}

export async function readPartnerMemoryImage(memoryId: string) {
    const imagePath = memoryImagePath(memoryId);
    try {
        return await fs.readFile(imagePath);
    } catch {
        return null;
    }
}

async function deletePartnerMemoryImageFile(memoryId: string) {
    const imagePath = memoryImagePath(memoryId);
    try {
        await fs.unlink(imagePath);
    } catch {
        // File may already be gone.
    }
}

export async function tryPurgePartnerMemoryImage(memoryId: string) {
    const memory = await prisma.partnerMemory.findUnique({
        where: { id: memoryId },
        include: {
            syncs: {
                select: {
                    userId: true,
                    ackedAt: true,
                },
            },
        },
    });

    if (!memory || memory.imageDeletedAt || !memory.imagePath) {
        return;
    }

    const allAcked = memory.syncs.length >= 2 && memory.syncs.every((sync) => sync.ackedAt != null);
    const expired = memory.imageExpiresAt != null && memory.imageExpiresAt.getTime() <= Date.now();

    if (!allAcked && !expired) {
        return;
    }

    await deletePartnerMemoryImageFile(memoryId);
    await prisma.partnerMemory.update({
        where: { id: memoryId },
        data: {
            imageDeletedAt: new Date(),
            imagePath: null,
        },
    });
}

export async function purgeExpiredPartnerMemories() {
    const expired = await prisma.partnerMemory.findMany({
        where: {
            imageDeletedAt: null,
            imagePath: { not: null },
            imageExpiresAt: { lte: new Date() },
        },
        select: { id: true },
        take: 50,
    });

    await Promise.all(expired.map((memory) => tryPurgePartnerMemoryImage(memory.id)));
}

export function getPartnerMemoryExpiryDate() {
    return new Date(Date.now() + MEMORY_IMAGE_MAX_AGE_MS);
}

export function presentPartnerMemory(
    memory: {
        id: string;
        authorUserId: string;
        recipientUserId: string;
        caption: string | null;
        createdAt: Date;
        imageDeletedAt: Date | null;
        imagePath: string | null;
        imageExpiresAt: Date | null;
        syncs: Array<{
            userId: string;
            ackedAt: Date | null;
            downloadedAt: Date | null;
        }>;
    },
    viewerUserId: string,
) {
    const mySync = memory.syncs.find((sync) => sync.userId === viewerUserId);
    const imageAvailable =
        memory.imagePath != null &&
        memory.imageDeletedAt == null &&
        (memory.imageExpiresAt == null || memory.imageExpiresAt.getTime() > Date.now());

    return {
        id: memory.id,
        authorUserId: memory.authorUserId,
        recipientUserId: memory.recipientUserId,
        caption: memory.caption,
        createdAt: memory.createdAt.toISOString(),
        imageAvailable,
        myAckedAt: mySync?.ackedAt?.toISOString() ?? null,
        myDownloadedAt: mySync?.downloadedAt?.toISOString() ?? null,
    };
}
