import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { generateAvatar, encodeHomePoseSheet } from './avatarGeneration';

test('photo editing preserves exact Home pose references and compresses a static 3x4 sheet', async t => {
    const previous = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'test-only-no-network';
    t.after(() => { if (previous === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previous; });
    const source = await sharp({ create: { width: 512, height: 512, channels: 3, background: '#ffaa88' } }).jpeg().toBuffer();
    const output = await sharp({ create: { width: 1024, height: 1536, channels: 3, background: '#ffeecc' } }).png().toBuffer();
    let calls = 0;
    const originalFetch = globalThis.fetch;
    t.mock.method(globalThis, 'fetch', async (_url: string | URL | Request, init: RequestInit) => {
        // The SDK probes the local data: URL to detect the Response constructor.
        if (_url === 'data:,') return originalFetch(_url);
        calls++;
        const body = init.body as FormData;
        const model = process.env.OPENAI_AVATAR_MODEL || 'gpt-image-2.6-flare';
        assert.equal(body.get('model'), model);
        assert.equal(body.get('quality'), 'low');
        assert.equal(body.get('complexity'), model.startsWith('gpt-image-2.6-') ? 'low' : null);
        assert.equal(body.getAll('image[]').length, 2);
        assert.match(String(body.get('prompt')), /SAME person/);
        assert.match(String(body.get('prompt')), /No chibi/);
        assert.match(String(body.get('prompt')), /THREE columns by FOUR rows/);
        assert.match(String(body.get('prompt')), /exactly/);
        assert.equal(body.get('size'), '1024x1536');
        assert.equal(body.get('output_format'), 'png');
        assert.notEqual(body.get('safety_identifier'), 'private-user-id');
        assert.equal(String(body.get('safety_identifier')).length, 64);
        return new Response(JSON.stringify({ data: [{ b64_json: output.toString('base64') }] }), { headers: { 'Content-Type': 'application/json' } });
    });
    const result = await generateAvatar(`data:image/jpeg;base64,${source.toString('base64')}`, 'coral', 'private-user-id');
    const sprite = Buffer.from(result.split(',')[1], 'base64');
    const metadata = await sharp(sprite).metadata();
    assert.equal(metadata.width, 512); assert.equal(metadata.height, 768);
    assert.equal(metadata.format, 'png'); assert.ok(sprite.byteLength < 100_000);
    assert.equal(calls, 1);
    await assert.rejects(generateAvatar('data:image/jpeg;base64,YWJj', 'teal', 'private-user-id'), /valid JPG/);
    assert.equal(calls, 1);
});

test('Home cutouts remove the backdrop while keeping white details and skin opaque', async () => {
    const fixture = await sharp({ create: { width: 512, height: 768, channels: 3, background: '#ff00ff' } })
        .composite([{ input: await sharp({ create: { width: 40, height: 40, channels: 3, background: '#ffffff' } }).png().toBuffer(), left: 10, top: 10 },
            { input: await sharp({ create: { width: 40, height: 40, channels: 3, background: '#f3b38b' } }).png().toBuffer(), left: 80, top: 80 }]).png().toBuffer();
    const result = await encodeHomePoseSheet(fixture);
    const { data } = await sharp(result).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(data[3], 0);
    assert.equal(data[(20 * 512 + 20) * 4 + 3], 255);
    assert.equal(data[(90 * 512 + 90) * 4 + 3], 255);
});
