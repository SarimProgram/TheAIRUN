const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function fixture() {
  const calls = [];
  let fail = false;
  const modules = new Map();
  function load(filename) {
    if (modules.has(filename)) return modules.get(filename);
    const result = { exports: {} };
    modules.set(filename, result.exports);
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    const requireLocal = id => {
      if (id === 'react-native') return { Image: { resolveAssetSource: source => ({ uri: source }) } };
      if (id === 'expo-image') return { Image: { prefetch: async (uri, policy) => { calls.push({ uri, policy }); return !fail; } } };
      const resolved = path.resolve(path.dirname(filename), id);
      if (id.endsWith('.png')) { assert(fs.existsSync(resolved)); return resolved; }
      return load(`${resolved}.ts`);
    };
    new Function('require', 'exports', 'module', code)(requireLocal, result.exports, result);
    return result.exports;
  }
  return { api: load(path.resolve(__dirname, '../components/home/nutritionAssets.ts')), calls, fail: value => { fail = value; } };
}

const selection = {
  mine: { goal: 2000, food: 1800, exercise: 0 },
  partner: { goal: 1800, food: 2000, exercise: 0 },
  gender: 'male', partnerGender: 'female',
};

test('preloads only current poses and visible food, deduplicating concurrent requests', async () => {
  const f = fixture();
  await Promise.all([f.api.preloadNutritionArtwork(selection), f.api.preloadNutritionArtwork(selection)]);
  assert.deepEqual(f.calls.map(call => path.basename(call.uri)).sort(),
    ['female-over-target.png', 'food-left.png', 'food-right.png', 'male-winning.png']);
  assert(f.calls.every(call => call.policy === 'memory-disk'));
  await f.api.preloadNutritionArtwork(selection);
  assert.equal(f.calls.length, 4);
});

test('empty pans do not preload food; a pose change loads only the newly needed image', async () => {
  const f = fixture();
  const empty = { ...selection, mine: { goal: 2000, food: 0 }, partner: { goal: 1800, food: 0 } };
  await f.api.preloadNutritionArtwork(empty);
  assert.deepEqual(f.calls.map(call => path.basename(call.uri)).sort(), ['female-idle.png', 'male-idle.png']);
  await f.api.preloadNutritionArtwork({ ...empty, mine: { goal: 2000, food: 1000 } });
  assert.deepEqual(f.calls.slice(2).map(call => path.basename(call.uri)).sort(), ['food-left.png', 'male-progress.png']);
});

test('failed prefetch can retry instead of poisoning the cache', async () => {
  const f = fixture();
  f.fail(true);
  await f.api.preloadNutritionArtwork(selection);
  f.fail(false);
  await f.api.preloadNutritionArtwork(selection);
  assert.equal(f.calls.length, 8);
  await f.api.preloadNutritionArtwork(selection);
  assert.equal(f.calls.length, 8);
});
