const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(relativePath) {
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('require', 'exports', compiled)(id => {
    if (id === '@/constants/runDetails') return load('constants/runMetaData.ts');
    if (id === '@/config/api') return { API_BASE_URL: '' };
    if (id === '@/lib/interval-pace-targets') return {};
    throw new Error(`Unexpected import ${id}`);
  }, exports);
  return exports;
}
const { getRunMeta } = load('constants/runMetaData.ts');
const { buildRunWalkQuickSteps, getIntervalWorkoutRouteFromTemplateId } = load('lib/interval-workout.ts');

test('every run–walk spelling opens alternating segments rather than Easy Run', () => {
  for (const label of ['Run–Walk', 'Run-Walk', 'Run Walk', 'Run/Walk', 'Run and Walk']) {
    const meta = getRunMeta(label);
    assert.equal(meta.details.title, 'Run–Walk');
    assert.equal(meta.launchMode, 'interval');
    assert.equal(getIntervalWorkoutRouteFromTemplateId(meta.templateId), '/runs/interval-run');
  }
});

test('walking and running labels preserve their correct tracker and specific variants', () => {
  for (const label of ['Walk', 'Walking', 'Recovery Walk', 'Incline Walk']) assert.equal(getRunMeta(label).templateId, 'walk');
  assert.equal(getRunMeta('Power Walk').templateId, 'power_walk');
  assert.equal(getRunMeta('Long Walk').templateId, 'long_walk');
  assert.equal(getIntervalWorkoutRouteFromTemplateId(getRunMeta('Interval Walk').templateId), '/runs/interval-walk');
  assert.equal(getRunMeta('Easy Run').launchMode, 'standard');
  assert.equal(getRunMeta('Long Run').templateId, 'long');
  assert.equal(getRunMeta('Goal Practice Run').templateId, 'goal_practice');
});

test('legacy run–walk fallback keeps the exact scheduled distance with comfortable alternating blocks', () => {
  for (const distance of [0.3, 1, 2.5, 4, 10]) {
    const steps = buildRunWalkQuickSteps(distance);
    assert.equal(steps[0].type, 'warmup');
    assert.equal(steps.at(-1).type, 'cooldown');
    assert(Math.abs(steps.reduce((total, step) => total + step.distanceKm, 0) - distance) < 0.00001);
    const blocks = steps.slice(1, -1);
    assert(blocks.length >= 2);
    blocks.forEach((block, index) => { assert.equal(block.type, index % 2 ? 'walk' : 'run'); assert.equal(block.target.effort, 'Easy'); });
  }
});
