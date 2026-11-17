const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../components/home/goalWeek.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const result = { exports: {} };
new Function('exports', 'module', compiled)(result.exports, result);
const { calendarWeek, weeklyStreak } = result.exports;

test('calendar week stays Monday to Sunday across month/year boundaries', () => {
  assert.deepEqual(calendarWeek('2027-01-03'), ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03']);
});
test('streak includes completed today and stops at the first missed day', () => {
  const days = calendarWeek('2026-11-06');
  const complete = new Set(['2026-11-02', '2026-11-04', '2026-11-05', '2026-11-06']);
  assert.equal(weeklyStreak(days, '2026-11-06', day => complete.has(day)), 3);
});
test('unfinished today preserves yesterday streak, future days do not count', () => {
  const days = calendarWeek('2026-11-06');
  const complete = new Set(['2026-11-04', '2026-11-05', '2026-11-07', '2026-11-08']);
  assert.equal(weeklyStreak(days, '2026-11-06', day => complete.has(day)), 2);
});
test('Monday reset is explicitly a weekly streak', () => {
  const days = calendarWeek('2026-11-02');
  assert.equal(weeklyStreak(days, '2026-11-02', () => false), 0);
  assert.equal(weeklyStreak(days, '2026-11-02', () => true), 1);
});
