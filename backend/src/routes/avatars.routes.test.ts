import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { createAvatarRouter } from './avatars.routes';
import { AvatarError } from '../services/avatarGeneration';

const photo = 'data:image/jpeg;base64,YWJj';

test('avatar API validates photos, protects generation, and returns only the compressed sprite', async t => {
    let time = 1000;
    let calls = 0;
    let fail = false;
    let providerFailure: unknown;
    let unblock: (() => void) | undefined;
    const app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => { if (req.headers['x-test-user']) req.user = { id: req.headers['x-test-user'] }; next(); });
    app.use('/avatars', createAvatarRouter(async (received, accent, id) => {
        calls++;
        assert.equal(received, photo); assert.equal(accent, 'teal'); assert.ok(id);
        if (fail) throw new AvatarError('Please choose a valid photo.', 400);
        if (providerFailure) throw providerFailure;
        if (id === 'concurrent') await new Promise<void>(resolve => { unblock = resolve; });
        return 'data:image/jpeg;base64,c3ByaXRl';
    }, () => time));
    const server = app.listen(0, '127.0.0.1');
    t.after(() => server.close());
    await new Promise<void>(resolve => server.once('listening', resolve));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/avatars/generate`;
    const send = (user = 'a', body: unknown = { photo, accent: 'teal' }) => fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(user ? { 'x-test-user': user } : {}) }, body: JSON.stringify(body),
    });
    assert.equal((await send('')).status, 401);
    assert.equal((await send('a', { photo: 'https://someone.invalid/photo.jpg', accent: 'teal' })).status, 400);
    assert.equal(calls, 0);
    const result = await send();
    assert.equal(result.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await result.json(), { uri: 'data:image/jpeg;base64,c3ByaXRl', layout: 'home-v1', columns: 3, rows: 4 });
    await send(); await send();
    assert.equal((await send()).status, 429);
    assert.equal(calls, 3);
    assert.equal((await send('b')).status, 200);
    time += 3_600_001;
    assert.equal((await send()).status, 200);
    fail = true;
    assert.equal((await send('failed')).status, 400);
    fail = false;
    assert.equal((await send('failed')).status, 200);
    providerFailure = { status: 401, message: 'private provider credentials' };
    const unavailable = await send('provider-failure');
    assert.equal(unavailable.status, 503);
    assert.equal((await unavailable.json()).message, 'Character creation is not available right now. You can still use your photo.');
    providerFailure = undefined;
    const pending = send('concurrent');
    while (!unblock) await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal((await send('concurrent')).status, 409);
    unblock();
    assert.equal((await pending).status, 200);
});
