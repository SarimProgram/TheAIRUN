const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../components/plan/partnerSquatMotion.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const api = {};
new Function('exports', compiled)(api);
const motion = api.getPartnerSquatMotion;

test('demonstrates exactly 15 full squat cycles per minute', () => {
  for (let rep = 0; rep < 15; rep++) {
    const poses = Array.from({ length: 8 }, (_, stage) => motion('squat', rep * 4000 + stage * 500));
    assert.deepEqual(poses.map(pose => pose.frame), [4, 5, 6, 7, 8, 9, 10, 11]);
    assert.ok(poses.every(pose => pose.rep === rep + 1));
  }
  assert.equal(motion('squat', 60_000).rep, 15);
});

test('warm-up and cool-down change movement at their instructed times', () => {
  assert.equal(motion('warmup', 0).frame, 0);
  assert.equal(motion('warmup', 600).frame, 1);
  assert.equal(motion('warmup', 60_000).frame, 2);
  assert.equal(motion('warmup', 61_200).frame, 3);
  assert.equal(motion('cooldown', 0).frame, 12);
  assert.equal(motion('cooldown', 800).frame, 13);
  assert.equal(motion('cooldown', 30_000).frame, 14);
  assert.equal(motion('cooldown', 45_000).frame, 15);
});

test('Reduce Motion keeps each movement still while preserving rep progress', () => {
  assert.equal(motion('squat', 0, true).frame, motion('squat', 59_999, true).frame);
  assert.equal(motion('squat', 40_000, true).rep, 11);
  assert.equal(motion('warmup', 0, true).frame, motion('warmup', 59_999, true).frame);
  assert.equal(motion('cooldown', 0, true).frame, motion('cooldown', 29_999, true).frame);
  assert.equal(motion('squat', -100).rep, 1);
});
