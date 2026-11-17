const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../components/race/raceCourseGeometry.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const result = { exports: {} };
new Function('exports', 'module', compiled)(result.exports, result);
const { getCourseLayout, METRES_PER_MARKER } = result.exports;

test('5 km has five times the running distance of 1 km, rather than compressed labels', () => {
  for (const width of [320, 390, 430, 768]) {
    const short = getCourseLayout(width, 1000);
    const long = getCourseLayout(width, 5000);
    assert.equal(long.travel, short.travel * 5);
    for (const course of [short, long]) {
      assert.equal(course.travel / course.distance * METRES_PER_MARKER, 140);
      assert.ok(Math.abs(course.startY - course.travel - course.finishY) < 1e-9);
      assert.ok(Math.abs(course.height - course.startY - 56) < 1e-9);
    }
  }
});

test('invalid distances produce a finite, usable course', () => {
  for (const distance of [0, -1, NaN, Infinity]) {
    const course = getCourseLayout(390, distance);
    assert.equal(course.distance, 1000);
    assert.ok(Number.isFinite(course.height));
  }
});
