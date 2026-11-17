import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

test('bucket migration, compression, signed delivery and retention', async t => {
    process.env.DATABASE_URL ||= 'postgresql://test:test@localhost:5432/test';
    process.env.JWT_SECRET ||= 'workout-retention-test-secret';
    process.env.WORKOUT_PHOTO_BUCKET = 'test';
    process.env.WORKOUT_PHOTO_S3_ENDPOINT = 'https://bucket.example.invalid';
    process.env.WORKOUT_PHOTO_S3_ACCESS_KEY_ID = 'test-key';
    process.env.WORKOUT_PHOTO_S3_SECRET_ACCESS_KEY = 'test-secret';
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'photo-retention-'));
    process.env.WORKOUT_PHOTO_STORAGE_DIR = directory;
    t.after(() => fs.rm(directory, { force: true, recursive: true }));
    const storage = await import('./workoutPhotoStorage');
    const { prisma } = await import('../db/prisma');
    const { migrateLegacyWorkoutPhotos, purgeExpiredWorkoutPhotos } = await import('./workoutPhotoMaintenance');
    const objects = new Map<string, Buffer>();
    let failDeletion = false;
    t.mock.method(S3Client.prototype, 'send', async (command: any) => {
        if (command instanceof PutObjectCommand) objects.set(command.input.Key!, command.input.Body as Buffer);
        else if (command instanceof DeleteObjectCommand) {
            if (failDeletion) throw new Error('network failed');
            objects.delete(command.input.Key!);
        } else throw new Error('Unexpected network command');
        return {};
    });
    const capturedAt = new Date();
    const replace = (target: any, method: string, implementation: (...args: any[]) => any) => {
        const original = target[method]; target[method] = implementation;
        t.after(() => { target[method] = original; });
    };
    const row: any = { id: 'test-photo', authorUserId: 'a', dayKey: '2026-11-06', capturedAt,
        expiresAt: storage.photoExpiry(capturedAt), imagesDeletedAt: null,
        selfiePath: path.join(directory, 'selfie.jpg'), surroundingsPath: path.join(directory, 'surroundings.jpg'),
        selfieThumbPath: null, surroundingsThumbPath: null };
    replace(prisma.workoutPhoto, 'findMany', async (query: any) => {
        if (query.where.expiresAt.lte) return !row.imagesDeletedAt && row.expiresAt <= query.where.expiresAt.lte ? [row] : [];
        return row.selfiePath && !row.selfiePath.startsWith('s3:') ? [row] : [];
    });
    replace(prisma.workoutPhoto, 'update', async (query: any) => { Object.assign(row, query.data); return row; });
    replace(prisma.workoutPhoto, 'delete', async () => { throw new Error('Completion history must remain'); });
    const original = await sharp({ create: { width: 1600, height: 1200, channels: 3, background: '#4c847b' } }).jpeg().toBuffer();
    await fs.writeFile(row.selfiePath, original);
    await fs.writeFile(row.surroundingsPath, original);
    await t.test('full images are capped at 800px and thumbnails at 240px', async () => {
        assert.equal((await sharp(await storage.encodePhoto(original)).metadata()).width, 800);
        assert.equal((await sharp(await storage.encodePhoto(original, true)).metadata()).width, 240);
    });
    await t.test('legacy pair migrates to four objects and removes volume copies', async () => {
        assert.equal(await migrateLegacyWorkoutPhotos(), 1);
        assert.equal(objects.size, 4);
        assert.equal((await fs.readdir(directory)).length, 0);
        assert.equal(await migrateLegacyWorkoutPhotos(), 0);
    });
    await t.test('signed URL lasts at most 60 seconds and never past photo expiry', async () => {
        const url = new URL((await storage.photoDownloadUrl(row.selfiePath, row.expiresAt))!);
        assert.equal(url.searchParams.get('X-Amz-Expires'), '60');
        const now = new Date();
        const nearExpiry = new URL((await storage.photoDownloadUrl(row.selfiePath, new Date(now.getTime() + 10000), now))!);
        assert.equal(nearExpiry.searchParams.get('X-Amz-Expires'), '10');
        await assert.rejects(storage.photoDownloadUrl(row.selfiePath, now, now), /expired/);
    });
    await t.test('expiry deletes images and thumbnails but retains completion and capture date', async () => {
        const expiry = row.expiresAt;
        assert.equal(await purgeExpiredWorkoutPhotos(new Date(expiry.getTime() - 1)), 0);
        failDeletion = true;
        assert.equal(await purgeExpiredWorkoutPhotos(expiry), 0);
        assert.equal(row.imagesDeletedAt, null);
        failDeletion = false;
        assert.equal(await purgeExpiredWorkoutPhotos(expiry), 1);
        assert.equal(objects.size, 0);
        assert.equal(row.selfiePath, null);
        assert.equal(row.selfieThumbPath, null);
        assert.equal(row.dayKey, '2026-11-06');
        assert.equal(row.capturedAt, capturedAt);
        assert.equal(await purgeExpiredWorkoutPhotos(expiry), 0);
    });
});
