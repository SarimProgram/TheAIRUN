const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(name) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(require.resolve(`../utils/${name}.ts`), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, { exports, require: name => load(name.replace('./', '')), Date, Map, Set, Array });
  return exports;
}
const { getMappedDays } = load('planProjection');

test('daily and full-plan projection keep workouts separate and honor exact cardio weekdays and distances', () => {
  const row = { 'Run km/week': 7, 'Week Dailys': { runDays: 2, recoveryDays: 4,
    runs: [{ runType: 'Easy Run', sessions: 1, targetKm: 4 }, { runType: 'Walk', sessions: 1, targetKm: 3 }],
    trainingSchedule: { version: 1, customizationCompleted: true, sessions: [
      { dayOfWeek: 0, activity: 'WORKOUT', workoutPreference: 'gym' },
      { dayOfWeek: 2, activity: 'WALK' }, { dayOfWeek: 5, activity: 'RUN' },
    ] },
  } };
  const days = getMappedDays(row, [0, 1, 2, 3, 4, 5, 6]);
  assert.equal(days.filter(day => day.type === 'RUN' || day.workoutPreference).length, 3);
  assert.equal(days[0].workoutPreference, 'gym');
  assert.equal(days[0].runType, null);
  assert.equal(days[2].runType, 'Walk');
  assert.equal(days[2].targetKm, 3);
  assert.equal(days[5].runType, 'Easy Run');
  assert.equal(days[5].targetKm, 4);
  assert.equal(days.filter(day => day.type === 'RECOVERY').length, 4);
});

test('gym-only plans show exactly the prescribed gym days, without cardio', () => {
  const days = getMappedDays({ 'Run km/week': 0, 'Week Dailys': { runs: [], trainingSchedule: { version: 1,
    sessions: [0, 2, 4].map(dayOfWeek => ({ dayOfWeek, activity: 'WORKOUT', workoutPreference: 'gym' })) } } });
  assert.equal(days.filter(day => day.workoutPreference === 'gym').length, 3);
  assert.equal(days.filter(day => day.type === 'RUN').length, 0);
  assert.equal(days.filter(day => day.type === 'RECOVERY').length, 4);
});

test('legacy weekly plans continue to use the original availability projection', () => {
  const row = { 'Run km/week': 6, 'Week Dailys': { runDays: 3, recoveryDays: 1, runs: [{ runType: 'Easy Run', sessions: 3, targetKm: 2 }] } };
  const days = getMappedDays(row, [0, 2, 4]);
  assert.equal(days.filter(day => day.type === 'RUN').length, 3);
  assert.ok(days.filter(day => day.type === 'RUN').every(day => [0, 2, 4].includes(day.dayIdx)));
  assert.ok(days.every(day => !day.workoutPreference));
});
