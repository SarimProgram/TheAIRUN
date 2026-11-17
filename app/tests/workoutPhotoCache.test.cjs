const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = ts.transpileModule(fs.readFileSync(require.resolve('../utils/workoutPhotoCache.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

function fixture() {
  const files = new Map();
  let now = Date.now();
  let downloads = 0;
  let wait;
  const fileSystem = {
    cacheDirectory: 'cache/',
    makeDirectoryAsync: async () => {},
    readDirectoryAsync: async directory => [...new Set([...files.keys()].filter(key => key.startsWith(directory)).map(key => key.slice(directory.length).split('/')[0]))],
    deleteAsync: async target => { for (const file of files.keys()) if (file === target || file.startsWith(target.endsWith('/') ? target : `${target}/`)) files.delete(file); },
    getInfoAsync: async file => ({ exists: files.has(file) }),
    downloadAsync: async (_, file) => { downloads++; if (wait) await wait; files.set(file, 'image'); return { status: 200 }; },
    moveAsync: async ({ from, to }) => { files.set(to, files.get(from)); files.delete(from); },
  };
  class Clock extends Date { static now() { return now; } }
  const exports = {};
  vm.runInNewContext(source, { exports, require: () => fileSystem, Date: Clock, Map, Set, Promise, encodeURIComponent });
  return { api: exports, files, downloads: () => downloads, expiry: () => new Date(now + 1000).toISOString(),
    advance: () => { now += 1001; }, hold: promise => { wait = promise; } };
}

test('cached thumbnails reuse downloads, and full photos use a separate cache entry', async () => {
  const f = fixture();
  await f.api.activateWorkoutPhotoCache('a:b');
  const resolve = async () => ({ url: 'https://bucket.example/photo' });
  const uri = await f.api.cachedWorkoutPhoto('a:b', 'photo', 'selfie-thumb', f.expiry(), resolve);
  assert.equal(await f.api.cachedWorkoutPhoto('a:b', 'photo', 'selfie-thumb', f.expiry(), resolve), uri);
  assert.equal(f.downloads(), 1);
  await f.api.cachedWorkoutPhoto('a:b', 'photo', 'selfie-full', f.expiry(), resolve);
  assert.equal(f.downloads(), 2);
});
test('expired cache is removed and cannot be served again', async () => {
  const f = fixture(); const expiry = f.expiry();
  await f.api.activateWorkoutPhotoCache('a:b');
  await f.api.cachedWorkoutPhoto('a:b', 'photo', 'thumb', expiry, async () => ({ url: 'photo' }));
  f.advance(); await f.api.purgeExpiredWorkoutPhotoCache();
  assert.equal(f.files.size, 0);
  await assert.rejects(f.api.cachedWorkoutPhoto('a:b', 'photo', 'thumb', expiry, async () => ({ url: 'photo' })), /expired/);
});
test('partner/account switches delete previous caches, while same-scope activation retains them', async () => {
  const f = fixture();
  await f.api.activateWorkoutPhotoCache('a:b');
  await f.api.cachedWorkoutPhoto('a:b', 'photo', 'thumb', f.expiry(), async () => ({ url: 'photo' }));
  await f.api.activateWorkoutPhotoCache('a:b'); assert.equal(f.files.size, 1);
  await f.api.activateWorkoutPhotoCache('a:c'); assert.equal(f.files.size, 0);
});
test('sign-out during download cannot restore files after cache deletion', async () => {
  const f = fixture();
  await f.api.activateWorkoutPhotoCache('a:b');
  let release;
  f.hold(new Promise(resolve => { release = resolve; }));
  const request = f.api.cachedWorkoutPhoto('a:b', 'photo', 'thumb', f.expiry(), async () => ({ url: 'photo' }));
  while (!f.downloads()) await new Promise(resolve => setImmediate(resolve));
  await f.api.clearWorkoutPhotoCache(); release();
  await assert.rejects(request, /unavailable/);
  assert.equal(f.files.size, 0);
});
