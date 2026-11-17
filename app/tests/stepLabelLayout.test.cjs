const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../components/battle/stepLabelLayout.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const api = { exports: {} };
new Function('exports', 'module', compiled)(api.exports, api);
test('step labels clear the center divider throughout lead changes at phone widths', () => {
  for (const arenaWidth of [240, 272, 320, 337, 382, 430]) {
    const avatarWidth = arenaWidth * 0.36;
    const leftX = arenaWidth * 0.08;
    const rightX = arenaWidth - leftX - avatarWidth;
    for (const labelWidth of [arenaWidth / 2 - 20, arenaWidth * 0.15]) {
      for (let shift = -arenaWidth / 2; shift <= arenaWidth / 2; shift += 0.5) {
        const result = api.exports.stepLabelLayout(arenaWidth, avatarWidth, leftX, rightX, shift, labelWidth, 48);
        assert(result.left >= 6);
        assert(result.left + labelWidth <= arenaWidth / 2 - 12);
        assert(result.right >= arenaWidth / 2 + 12);
        assert(result.right + labelWidth <= arenaWidth - 6);
      }
    }
  }
});
