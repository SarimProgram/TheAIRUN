import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

test('workout photo API saves pairs atomically, retries once, and revokes partner access', async t => {
    t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-01-02T01:00:00Z').getTime() });
    const storage = await fs.mkdtemp(path.join(os.tmpdir(), 'workout-photo-test-'));
    process.env.WORKOUT_PHOTO_STORAGE_DIR = storage;
    process.env.DATABASE_URL ||= 'postgresql://test:test@localhost:5432/test';
    process.env.JWT_SECRET ||= 'workout-photo-route-test-secret';
    const { prisma } = await import('../db/prisma');
    const { default: router } = await import('./workoutPhotos.routes');
    const rows: any[] = [];
    let linked = true;
    let failWrite = false;
    const replace = (target: any, method: string, implementation: (...args: any[]) => any) => {
        const original = target[method]; target[method] = implementation;
        t.after(() => { target[method] = original; });
    };
    replace(prisma.user, 'findUniqueOrThrow', async ({ where }: any) => ({ partnerId: linked ? where.id === 'a' ? 'b' : 'a' : null }));
    replace(prisma.user, 'findFirst', async ({ where }: any) => linked ? { id: where.id } : null);
    replace(prisma.workoutPhoto, 'findUnique', async ({ where }: any) => rows.find(row => row.authorUserId === where.authorUserId_clientId.authorUserId && row.clientId === where.authorUserId_clientId.clientId));
    replace(prisma.workoutPhoto, 'create', async ({ data }: any) => {
        if (failWrite) throw new Error('database unavailable');
        rows.push(data); return data;
    });
    replace(prisma.workoutPhoto, 'findFirst', async ({ where }: any) => rows.find(row => row.id === where.id && where.OR.some((clause: any) => Object.entries(clause).every(([key, value]) => row[key] === value))));
    // Any accidental workout/summary write makes the test fail.
    replace(prisma.workoutSession, 'create', async () => { throw new Error('Photo must not create a workout session'); });
    replace(prisma.dailySummary, 'upsert', async () => { throw new Error('Photo must not change run status'); });
    t.after(async () => { await fs.rm(storage, { recursive: true, force: true }); });
    const call = async (method: string, route: string, request: any) => {
        const layer = router.stack.find((entry: any) => entry.route?.path === route && entry.route.methods[method]) as any;
        const handler = layer.route.stack.at(-1).handle;
        let status = 200; let result: any; let error: any;
        const res = { status(value: number) { status = value; return this; }, json(value: any) { result = value; return this; }, setHeader() {}, type() { return this; }, send(value: any) { result = value; return this; } };
        await handler(request, res, (value: any) => { error = value; });
        return { status, result, error };
    };
    const image = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#123456' } }).jpeg().toBuffer();
    const body = { clientId: 'a40cd1ea-b12f-43ad-b8c5-149f151905ab', capturedAt: '2026-01-01T13:00:00.000Z', timezone: 'Australia/Sydney' };
    const request = { user: { id: 'a' }, body, files: { selfie: [{ buffer: image }], surroundings: [{ buffer: image }] } };
    await t.test('missing second photo leaves no record or files', async () => {
        const response = await call('post', '/', { ...request, files: { selfie: [{ buffer: image }] } });
        assert.equal(response.status, 400); assert.equal(rows.length, 0); assert.equal((await fs.readdir(storage, { recursive: true })).filter(name => name.endsWith('.jpg')).length, 0);
    });
    await t.test('invalid image cleans partial files', async () => {
        const response = await call('post', '/', { ...request, files: { selfie: [{ buffer: image }], surroundings: [{ buffer: Buffer.from('invalid') }] } });
        assert.ok(response.error); assert.equal((await fs.readdir(storage, { recursive: true })).filter(name => name.endsWith('.jpg')).length, 0);
    });
    await t.test('database failure cleans both files and can be retried', async () => {
        failWrite = true;
        assert.ok((await call('post', '/', request)).error);
        assert.equal((await fs.readdir(storage, { recursive: true })).filter(name => name.endsWith('.jpg')).length, 0);
        failWrite = false;
        const response = await call('post', '/', request);
        assert.equal(response.status, 201); assert.equal(rows.length, 1);
        assert.equal(response.result.photo.dayKey, '2026-01-02');
        assert.equal((await fs.readdir(storage, { recursive: true })).filter(name => name.endsWith('.jpg')).length, 4);
    });
    await t.test('lost-response retry returns same record without extra files', async () => {
        const response = await call('post', '/', request);
        assert.equal(response.status, 200); assert.equal(response.result.photo.id, rows[0].id);
        assert.equal(rows.length, 1); assert.equal((await fs.readdir(storage, { recursive: true })).filter(name => name.endsWith('.jpg')).length, 4);
    });
    await t.test('expired photos cannot be served, including URL delivery', async () => {
        const original = rows[0].expiresAt;
        rows[0].expiresAt = new Date(Date.now());
        const result = await call('get', '/:id/:kind', { user: { id: 'a' }, params: { id: rows[0].id, kind: 'selfie' }, query: { delivery: 'url' } });
        assert.equal(result.status, 404);
        rows[0].expiresAt = original;
    });
    await t.test('partner may read, unrelated user may not, unlink revokes access', async () => {
        const params = { id: rows[0].id, kind: 'selfie' };
        assert.equal((await call('get', '/:id/:kind', { user: { id: 'b' }, params })).status, 200);
        assert.equal((await call('get', '/:id/:kind', { user: { id: 'stranger' }, params })).status, 404);
        linked = false;
        assert.equal((await call('get', '/:id/:kind', { user: { id: 'b' }, params })).status, 404);
        assert.equal((await call('get', '/:id/:kind', { user: { id: 'a' }, params })).status, 200);
    });
});
