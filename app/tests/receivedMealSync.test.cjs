const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, imports) {
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText, { exports, require: name => imports[name], Date, Intl });
  return exports;
}

test('Received portions cache once, update serving, and disappear on decline without re-uploading', async () => {
  const meals = new Map(), saves = [], removed = [], requests = [];
  const { cacheReceivedPlate } = load('lib/meal-pass-sync.ts', {
    './meal-pass': load('lib/meal-pass.ts', {}),
    './meal-pass-api': {}, './meal-pass-store': {}, '@/config/api': { API_BASE_URL: 'https://test.local' },
    './partner-food-widget': { async syncPartnerFoodWidget() {} },
    './offline-meals': {
      getLocalMeal: async (_, id) => meals.get(id),
      saveLocalPortion: async meal => { saves.push(meal); meals.set(meal.clientMealId, meal); },
      deleteLocalMeal: async (user, id) => { removed.push([user, id]); meals.delete(id); },
      notifyMealListeners() {},
    },
  });
  const authFetch = async (url, init) => { requests.push({ url, init }); return { ok: true }; };
  const plate = { id: 'plate-1', status: 'PENDING', createdAt: '2026-11-12T15:00:00.000Z', mealType: 'DINNER',
    hasPhoto: true, items: [{ foodName: 'Rice', calories: 500 }], itemShares: [0.4],
  };
  await cacheReceivedPlate(authFetch, plate, 'sam', 'Australia/Sydney');
  await cacheReceivedPlate(authFetch, plate, 'sam', 'Australia/Sydney');
  assert.equal(saves.length, 1);
  assert.equal(saves[0].synced, true);
  assert.equal(saves[0].dayKey, '2026-11-13');
  assert.equal(saves[0].loggedAt, plate.createdAt);
  assert.equal(saves[0].items[0].calories, 200);
  await cacheReceivedPlate(authFetch, { ...plate, status: 'ACCEPTED', itemShares: [0.5] }, 'sam', 'Australia/Sydney');
  assert.equal(meals.get('pass-plate-1').items[0].calories, 250);
  await cacheReceivedPlate(authFetch, { ...plate, status: 'DECLINED' }, 'sam', 'Australia/Sydney');
  assert.equal(meals.size, 0);
  assert.deepEqual(removed, [['sam', 'pass-plate-1']]);
  assert.ok(requests.every(request => request.url.endsWith('/summary/recalculate')));
});
