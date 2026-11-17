const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../components/battle/coupleBreathingSprite.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const sprite = { exports: {} };
new Function('require', 'exports', 'module', source)(() => 'breathing.png', sprite.exports, sprite);
const { breathingFrame, breathingGrip, BREATHING_SPRITES, BREATHING_FRAME_WIDTH, BREATHING_FRAME_HEIGHT, BREATHING_WAIST } = sprite.exports;

test('body and rope use the same discrete pose without translucent frame blending', () => {
  for (const phase of [-1, 0, 0.49, 0.5, 1.8, 3.4, 4.8, 5, 6]) {
    const frame = breathingFrame(phase);
    assert(Number.isInteger(frame) && frame >= 0 && frame <= 5);
    for (const identity of ['male', 'female']) {
      assert.deepEqual(breathingGrip(identity, frame), BREATHING_SPRITES[identity].frames[frame]);
    }
  }
});

test('grip coordinates stay inside the upper body and clamp at loop endpoints', () => {
  for (const identity of ['male', 'female']) {
    const { frames, baseline } = BREATHING_SPRITES[identity];
    assert.equal(frames.length, 6);
    assert(BREATHING_WAIST < baseline && baseline < BREATHING_FRAME_HEIGHT);
    assert.deepEqual(breathingGrip(identity, -1), frames[0]);
    assert.deepEqual(breathingGrip(identity, 6), frames[5]);
    for (let i = 0; i < 5; i++) {
      const half = breathingGrip(identity, i + 0.5);
      for (const hand of ['front', 'rear']) {
        for (const axis of ['x', 'y']) {
          assert.equal(half[hand][axis], (frames[i][hand][axis] + frames[i + 1][hand][axis]) / 2);
        }
        assert(half[hand].x > 0 && half[hand].x < BREATHING_FRAME_WIDTH);
        assert(half[hand].y > 0 && half[hand].y < BREATHING_WAIST);
      }
    }
  }
});
