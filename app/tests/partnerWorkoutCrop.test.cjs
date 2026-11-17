const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(name) {
  const source = fs.readFileSync(path.join(__dirname, '../components/plan', name + '.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  new Function('require', 'exports', compiled)(() => 1, exports);
  return exports;
}
const { getPartnerWorkoutCrop: crop } = load('partnerWorkoutCrop');
const { PARTNER_WORKOUT_SHEETS: sheets } = load('partnerWorkoutAssets');

test('wall-sit crops include complete bodies and exclude neighboring exercise rows', () => {
  const sheet = sheets['wall-sit-challenge'];
  // Measured opaque silhouette bounds in this source PNG, not equal grid rows.
  const silhouettes = [[591, 847], [886, 1109]];
  for (let frame = 0; frame < 8; frame++) {
    const result = crop(sheet, sheet.firstFrame + frame, 228);
    const scale = result.imageHeight / sheet.pixelHeight;
    const top = -result.imageTop / scale;
    const bottom = top + result.viewportHeight / scale;
    const [head, feet] = silhouettes[Math.floor(frame / 4)];
    assert.ok(top <= head && bottom > feet, 'head and feet must fit');
    assert.ok(frame < 4 ? top > 567 && bottom < 886 : top > 847 && bottom < 1177, 'no previous or next photo');
    assert.ok(result.viewportWidth <= 228 && result.viewportHeight <= 228);
  }
});

test('unequal row crops preserve image proportions at thumbnail and hero sizes', () => {
  for (const size of [64, 200, 260]) {
    const result = crop(sheets['wall-sit-challenge'], 11, size);
    assert.ok(Math.abs(result.imageWidth / result.imageHeight - 1024 / 1536) < 1e-9);
    assert.ok(result.viewportWidth <= size && result.viewportHeight <= size);
  }
});

test('regular atlases keep the original square-cell cropping', () => {
  const result = crop(sheets['partner-squats'], 7, 200);
  assert.equal(result.viewportWidth, 200);
  assert.equal(result.viewportHeight, 200);
  assert.equal(result.imageWidth, 800);
  assert.equal(result.imageHeight, 800);
  assert.equal(result.imageLeft, -600);
  assert.equal(result.imageTop, -200);
});
