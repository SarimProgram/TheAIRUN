const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, imports) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText, { exports, require: name => {
    if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
    return imports[name];
  }, Date, Intl });
  return exports;
}

function harness(deliver) {
  const state = [], refs = [], saved = [], requests = [], recorded = [];
  let cursor = 0, refCursor = 0, uuid = 0;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = index === 0 ? { id: 'partner', name: 'Sam' } : initial;
      return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
    },
    useRef(initial) { const index = refCursor++; return refs[index] ??= { current: initial }; },
    useMemo: fn => fn(), useCallback: fn => fn, useEffect() {},
  };
  const { useMealPassComposer } = load('components/mealpass/useMealPassComposer.ts', {
    react,
    'expo-crypto': { randomUUID: () => `uuid-${++uuid}` },
    '@/lib/meal-pass': load('lib/meal-pass.ts', {}),
    '@/lib/meal-pass-api': {
      createSharedMeal: async (_, request) => { requests.push(request); return deliver(request); },
    },
    '@/lib/meal-pass-store': { useSentPlates: () => [], recordSentPlate: async plate => recorded.push(plate) },
    '@/lib/offline-meals': { saveLocalPortion: async meal => { saved.push(meal); return meal; } },
  });
  const render = () => {
    cursor = 0; refCursor = 0;
    return useMealPassComposer({ authFetch() {}, partnerLinked: true, open: true, userKey: 'you',
      rawItems: [{ foodName: 'Rice', calories: 500 }],
    });
  };
  render().choose('SPLIT');
  return { render, saved, requests, recorded };
}

test('Flicking logs the sender portion and updates the screen before delivery finishes', async () => {
  let finish;
  const delivery = new Promise(resolve => { finish = resolve; });
  const h = harness(() => delivery);
  let refreshed = 0;
  const sending = h.render().throwPlate({ mealType: 'LUNCH', dayKey: '2026-11-13', xPct: 0.5,
    onLogged: () => { refreshed++; },
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.saved.length, 1);
  assert.equal(h.saved[0].items[0].calories, 300);
  assert.equal(refreshed, 1);
  assert.equal(h.render().phase, 'sending');
  assert.equal(h.recorded.length, 0);
  finish({ id: 'shared-meal' });
  assert.equal(await sending, h.saved[0].clientMealId);
  assert.equal(h.render().phase, 'passed');
});

test('Retrying a failed delivery reuses both IDs and keeps one logged portion', async () => {
  let count = 0, refreshed = 0;
  const h = harness(async () => {
    if (++count === 1) throw new Error('Upload failed');
    return { id: 'shared-meal' };
  });
  const params = { mealType: 'LUNCH', dayKey: '2026-11-13', xPct: 0.5, onLogged: () => { refreshed++; } };
  assert.equal(await h.render().throwPlate(params), null);
  assert.match(h.render().error, /Your portion is logged/);
  await h.render().throwPlate(params);
  assert.equal(h.saved.length, 1);
  assert.equal(refreshed, 1);
  assert.equal(h.requests[0].clientId, h.requests[1].clientId);
  assert.equal(h.requests[0].senderClientMealId, h.requests[1].senderClientMealId);
  assert.equal(h.recorded.length, 1);
});
