const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText, { exports, require: () => { throw Error('Unexpected import'); }, console, Date, Intl });
  return exports;
}

const pass = load('lib/meal-pass.ts');
const signals = load('utils/mealPassMessage.ts');
const plate = [
  { foodName: 'Salmon', calories: 413, grams: 180, proteinG: 39.6, carbsG: 0, fatG: 27.1 },
  { foodName: 'Rice', calories: 260, grams: 200, proteinG: 5.4, carbsG: 56.4, fatG: null },
];

test('A split always adds back up to the scanned plate', () => {
  for (const shares of [[0.4, 0.4], [0.35, 0.8], [0.05, 0.95], [1, 0]]) {
    const hers = pass.plateTotals(pass.recipientPortion(plate, shares));
    const his = pass.plateTotals(pass.senderPortion(plate, shares, 'SPLIT'));
    assert.equal(hers.calories + his.calories, 673);
    assert.ok(Math.abs(hers.proteinG + his.proteinG - 45) < 0.11);
  }
  assert.deepEqual(pass.senderPortion(plate, [1, 0], 'SPLIT').map((item) => item.foodName), ['Rice']);
  assert.deepEqual(pass.recipientPortion(plate, [1, 0]).map((item) => item.foodName), ['Salmon']);
});

test('A copied plate leaves the sender whole while she picks her own serving', () => {
  assert.equal(pass.plateTotals(pass.senderPortion(plate, [1.5, 1.5], 'COPY')).calories, 673);
  assert.equal(pass.plateTotals(pass.recipientPortion(plate, [1.5, 1.5])).calories, 620 + 390);
});

test('The headline percentage is weighted by calories and snaps to the slider step', () => {
  assert.ok(Math.abs(pass.overallShare(plate, [0.4, 0.4]) - 0.4) < 1e-9);
  assert.ok(Math.abs(pass.overallShare(plate, [0, 1]) - 260 / 673) < 1e-9);
  assert.equal(pass.snapShare(0.43), 0.45);
  assert.equal(pass.snapShare(0.99), 0.95);
  assert.equal(pass.snapShare(0.6, 0.25, 2), 0.6);
});

test('The sender sees the answer in plain words', () => {
  const base = { mode: 'SPLIT', partnerShare: 0.4, partnerName: 'Sam Lee', partnerGender: 'female' };
  assert.equal(pass.sentPlateLabel({ ...base, status: 'PENDING' }), 'Waiting for her');
  assert.equal(pass.sentPlateLabel({ ...base, status: 'ACCEPTED' }), 'She accepted \u00b7 You 60%, her 40%');
  assert.equal(pass.sentPlateLabel({ ...base, status: 'ACCEPTED', mode: 'COPY' }), 'She accepted \u00b7 her own serving');
  assert.equal(pass.sentPlateLabel({ ...base, status: 'PENDING', partnerGender: null }), 'Waiting for Sam');
  assert.equal(pass.sentPlateLabel({ ...base, status: 'DECLINED', partnerGender: 'male' }), 'He passed on this one \u00b7 Yours is still logged');
});

test('Plate signals parse, and anything else is left for chat', () => {
  const id = '3f2b1c9e-8a7d-4e6f-9b0a-1c2d3e4f5a6b';
  assert.deepEqual({ ...signals.parseMealPlateMessage(`[MEAL:plate:${id}:62:DINNER] Alex passed you dinner`) }, { sharedMealId: id, xPct: 0.62 });
  assert.deepEqual({ ...signals.parseMealReplyMessage(`[MEAL:reply:${id}:declined]`) }, { sharedMealId: id, accepted: false });
  assert.equal(signals.isMealPassMessage(`[MEAL:reply:${id}:accepted]`), true);
  assert.equal(signals.isMealPassMessage('Dinner was great [MEAL]'), false);
  assert.equal(signals.parseMealPlateMessage('[WATER:bottle:50]'), null);
});

test('A passed plate logs on her local day', () => {
  const lateUtc = new Date('2026-11-13T23:30:00Z');
  assert.equal(pass.dayKeyInZone(lateUtc, 'Australia/Sydney'), '2026-11-14');
  assert.equal(pass.dayKeyInZone(lateUtc, 'America/New_York'), '2026-11-13');
});
