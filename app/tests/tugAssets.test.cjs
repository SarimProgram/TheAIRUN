const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function fixture() {
  let count = 0;
  let fail = false;
  const result = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../components/battle/tugAssets.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const requireMock = id => {
    if (id === 'react-native') return { Image: {
      resolveAssetSource: asset => ({ uri: asset }),
      prefetch: async () => { count++; if (fail) throw new Error('Offline'); return true; },
    } };
    const filename = path.resolve(__dirname, '../components/battle', id);
    assert(fs.existsSync(filename));
    return filename;
  };
  new Function('require', 'exports', 'module', source)(requireMock, result.exports, result);
  return { api: result.exports, count: () => count, fail: value => { fail = value; } };
}

test('native atlas prefetch is shared across concurrent calls and subsequent expansions', async () => {
  const f = fixture();
  await Promise.all([f.api.preloadTugArtwork(), f.api.preloadTugArtwork()]);
  await f.api.preloadTugArtwork();
  assert.equal(f.count(), 1);
});

test('failed native prefetch can retry and never rejects into homepage startup', async () => {
  const f = fixture();
  f.fail(true);
  await f.api.preloadTugArtwork();
  f.fail(false);
  await f.api.preloadTugArtwork();
  await f.api.preloadTugArtwork();
  assert.equal(f.count(), 2);
});
