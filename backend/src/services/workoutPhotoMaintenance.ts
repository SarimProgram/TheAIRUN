import { prisma } from '../db/prisma';
import { randomUUID } from 'node:crypto';
import { bucketEnabled, deletePhoto, encodePhoto, pathsOf, photoReferences, purgeUnreferencedPhotoObjects, readPhoto, writePhoto } from './workoutPhotoStorage';

// Retain records: these are the source of workout completion counts and streaks.
export async function purgeExpiredWorkoutPhotos(now = new Date()) {
    const rows = await prisma.workoutPhoto.findMany({ where: { expiresAt: { lte: now }, imagesDeletedAt: null }, take: 100 });
    let removed = 0;
    for (const row of rows) {
        try {
            for (const reference of photoReferences(pathsOf(row))) await deletePhoto(reference);
            await prisma.workoutPhoto.update({ where: { id: row.id }, data: { selfiePath: null, surroundingsPath: null,
                selfieThumbPath: null, surroundingsThumbPath: null, imagesDeletedAt: now } });
            removed++;
        } catch (error) { console.error('[workout-photos] expiry cleanup failed', row.id, error instanceof Error ? error.name : 'Error'); }
    }
    return removed;
}

// Rerunnable migration. A record switches only after all four objects are written.
export async function migrateLegacyWorkoutPhotos() {
    if (!bucketEnabled()) return 0;
    const rows = await prisma.workoutPhoto.findMany({ where: { expiresAt: { gt: new Date() }, imagesDeletedAt: null,
        selfiePath: { not: { startsWith: 's3:' } } }, take: 100 });
    let migrated = 0;
    for (const row of rows) {
        const written: string[] = [];
        const originals = photoReferences(pathsOf(row));
        try {
            if (!row.selfiePath || !row.surroundingsPath) continue;
            const prefix = `workout-photos/${row.id}/${randomUUID()}`;
            const next = { ...pathsOf(row) };
            for (const kind of ['selfie', 'surroundings'] as const) {
                const original = await readPhoto(row[`${kind}Path`]!);
                for (const thumb of [false, true]) {
                    const reference = await writePhoto(`${prefix}/${kind}${thumb ? '-thumb' : ''}.jpg`, await encodePhoto(original, thumb));
                    written.push(reference);
                    const field = (thumb ? `${kind}ThumbPath` : `${kind}Path`) as keyof typeof next;
                    next[field] = reference;
                }
            }
            await prisma.workoutPhoto.update({ where: { id: row.id }, data: next });
            written.length = 0;
            for (const reference of originals) await deletePhoto(reference);
            migrated++;
        } catch (error) {
            await Promise.all(written.map(reference => deletePhoto(reference).catch(() => {})));
            console.error('[workout-photos] migration failed', row.id, error instanceof Error ? error.name : 'Error');
        }
    }
    return migrated;
}

let running = false;
let lastOrphanSweep = 0;
export function startWorkoutPhotoMaintenance() {
    const run = async () => {
        if (running) return;
        running = true;
        try {
            await purgeExpiredWorkoutPhotos(); await migrateLegacyWorkoutPhotos();
            if (Date.now() - lastOrphanSweep > 24 * 60 * 60 * 1000) {
                await purgeUnreferencedPhotoObjects(async paths => {
                    const rows = await prisma.workoutPhoto.findMany({ where: { OR: [
                        { selfiePath: { in: paths } }, { surroundingsPath: { in: paths } },
                        { selfieThumbPath: { in: paths } }, { surroundingsThumbPath: { in: paths } },
                    ] } });
                    return new Set(rows.flatMap(row => photoReferences(pathsOf(row))));
                });
                lastOrphanSweep = Date.now();
            }
        }
        catch (error) { console.error('[workout-photos] maintenance failed', error instanceof Error ? error.name : 'Error'); }
        finally { running = false; }
    };
    void run();
    const timer = setInterval(() => { void run(); }, 15 * 60 * 1000);
    timer.unref();
    return () => clearInterval(timer);
}
