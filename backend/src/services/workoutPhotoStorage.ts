import fs from 'node:fs/promises';
import path from 'node:path';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';

export const PHOTO_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
export const photoExpiry = (capturedAt: Date) => new Date(capturedAt.getTime() + PHOTO_LIFETIME_MS);
const directory = () => path.resolve(process.env.WORKOUT_PHOTO_STORAGE_DIR || path.join(process.cwd(), 'data', 'workout-photos'));
export const bucketEnabled = () => !!process.env.WORKOUT_PHOTO_BUCKET;
let client: S3Client | undefined;
function s3() {
    if (!client) {
        const endpoint = process.env.WORKOUT_PHOTO_S3_ENDPOINT;
        const accessKeyId = process.env.WORKOUT_PHOTO_S3_ACCESS_KEY_ID;
        const secretAccessKey = process.env.WORKOUT_PHOTO_S3_SECRET_ACCESS_KEY;
        if (!endpoint || !accessKeyId || !secretAccessKey) throw new Error('Workout photo bucket is not configured');
        client = new S3Client({ endpoint, region: process.env.WORKOUT_PHOTO_S3_REGION || 'auto',
            forcePathStyle: true, credentials: { accessKeyId, secretAccessKey } });
    }
    return client;
}
function localPath(reference: string) {
    const resolved = path.resolve(reference);
    if (!resolved.startsWith(directory() + path.sep)) throw new Error('Invalid photo storage path');
    return resolved;
}
export async function encodePhoto(buffer: Buffer, thumbnail = false) {
    return sharp(buffer, { limitInputPixels: 40000000 }).rotate()
        .resize({ width: thumbnail ? 240 : 800, height: thumbnail ? 320 : 1067, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: thumbnail ? 60 : 70, mozjpeg: true }).toBuffer();
}
export async function writePhoto(key: string, bytes: Buffer) {
    if (!/^[a-zA-Z0-9/-]+\.(jpg|png)$/.test(key)) throw new Error('Invalid photo key');
    if (bucketEnabled()) {
        await s3().send(new PutObjectCommand({ Bucket: process.env.WORKOUT_PHOTO_BUCKET, Key: key,
            Body: bytes, ContentType: key.endsWith('.png') ? 'image/png' : 'image/jpeg', CacheControl: 'private, no-store' }));
        return `s3:${key}`;
    }
    const file = localPath(path.join(directory(), key));
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, bytes);
    return file;
}
export async function readPhoto(reference: string) {
    if (!reference.startsWith('s3:')) return fs.readFile(localPath(reference));
    const response = await s3().send(new GetObjectCommand({ Bucket: process.env.WORKOUT_PHOTO_BUCKET, Key: reference.slice(3) }));
    if (!response.Body) throw new Error('Photo unavailable');
    return Buffer.from(await response.Body.transformToByteArray());
}
export async function deletePhoto(reference: string) {
    if (reference.startsWith('s3:')) {
        await s3().send(new DeleteObjectCommand({ Bucket: process.env.WORKOUT_PHOTO_BUCKET, Key: reference.slice(3) }));
    } else {
        await fs.unlink(localPath(reference)).catch(error => { if (error.code !== 'ENOENT') throw error; });
    }
}
export async function photoDownloadUrl(reference: string, expiresAt: Date, now = new Date()) {
    const remaining = Math.floor((expiresAt.getTime() - now.getTime()) / 1000);
    if (remaining < 1) throw new Error('Photo expired');
    if (!reference.startsWith('s3:')) return null;
    return getSignedUrl(s3(), new GetObjectCommand({ Bucket: process.env.WORKOUT_PHOTO_BUCKET, Key: reference.slice(3) }),
        { expiresIn: Math.min(60, remaining) });
}
export type PhotoPaths = { selfiePath: string | null; surroundingsPath: string | null; selfieThumbPath: string | null; surroundingsThumbPath: string | null };
export const photoReferences = (row: PhotoPaths) => [...new Set(Object.values(row).filter((value): value is string => typeof value === 'string'))];
export const pathsOf = (row: PhotoPaths): PhotoPaths => ({ selfiePath: row.selfiePath, surroundingsPath: row.surroundingsPath,
    selfieThumbPath: row.selfieThumbPath, surroundingsThumbPath: row.surroundingsThumbPath });

// Reclaim abandoned uploads/account-deletion leftovers without touching recent in-flight writes.
export async function purgeUnreferencedPhotoObjects(referenced: (paths: string[]) => Promise<Set<string>>) {
    if (!bucketEnabled()) return;
    let token: string | undefined;
    do {
        const page = await s3().send(new ListObjectsV2Command({ Bucket: process.env.WORKOUT_PHOTO_BUCKET,
            Prefix: 'workout-photos/', ContinuationToken: token }));
        const candidates = (page.Contents ?? []).filter(object => object.Key && object.LastModified
            && object.LastModified.getTime() < Date.now() - 24 * 60 * 60 * 1000).map(object => `s3:${object.Key}`);
        if (candidates.length) {
            const kept = await referenced(candidates);
            for (const reference of candidates) if (!kept.has(reference)) await deletePhoto(reference);
        }
        token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
}
