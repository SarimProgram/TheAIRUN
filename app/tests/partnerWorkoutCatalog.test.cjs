const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const loaded = new Map();
const weeklySentinel = { weekly: true };
function load(name) {
  if (loaded.has(name)) return loaded.get(name);
  const source = fs.readFileSync(path.join(__dirname, '../components/plan', name + '.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  new Function('require', 'exports', compiled)(id => id === './GuidedMobility' ? { buildWorkoutSessionPlan: () => weeklySentinel } : load(id.replace('./', '')), exports);
  loaded.set(name, exports);
  return exports;
}
const { makeWorkoutCatalog, getWorkoutPlan, getRecommendedWorkout, matchesWorkoutSearch } = load('workoutCatalog');
const { PARTNER_WORKOUTS } = load('partnerWorkoutDefinitions');
const { getPartnerWorkoutMotion: motion } = load('partnerWorkoutMotion');

test('Home and Strength recommend only current animated library entries', () => {
  const ids = new Set(PARTNER_WORKOUTS.map(workout => workout.id));
  for (const preference of ['home', 'strength']) {
    for (let week = 1; week <= 52; week++) for (let day = 0; day < 7; day++) {
      const workout = getRecommendedWorkout(preference, week, undefined, day);
      assert.ok(ids.has(workout.id));
      assert.equal(workout.couple, true);
      assert.equal(workout.people, 2);
      assert.notEqual(getWorkoutPlan(workout, week), weeklySentinel, 'never fall back to the old solo builder');
      if (preference === 'strength') assert.equal(workout.category, 'Strength');
    }
  }
  assert.equal(getRecommendedWorkout('home', 1, 'jumping-jacks-together').id, 'jumping-jacks-together');
  assert.ok(ids.has(getRecommendedWorkout('home', 1, 'weekly').id));
  assert.throws(() => getWorkoutPlan({ id: 'weekly', couple: false, exercises: [] }, 1), /no longer available/);
});

test('every backend recommendation ID resolves to a current animated workout', () => {
  const source = fs.readFileSync(path.join(__dirname, '../../backend/src/services/planning/workoutRecommendations.ts'), 'utf8');
  const exports = {};
  new Function('exports', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(exports);
  const ids = new Set(makeWorkoutCatalog().map(workout => workout.id));
  for (const id of exports.ANIMATED_WORKOUT_IDS) assert.ok(ids.has(id), id);
  for (const preference of ['home', 'strength']) for (let week = 1; week <= 52; week++) {
    const id = exports.recommendedWorkoutId(preference, week, 0, 3);
    assert.equal(getRecommendedWorkout(preference, week, id).id, id);
  }
});

test('workout search matches muscles, categories and words across fields', () => {
  const catalog = makeWorkoutCatalog();
  const squats = catalog.find(workout => workout.id === 'partner-squats');
  const plank = catalog.find(workout => workout.id === 'plank-high-fives');
  for (const query of ['', '  ', 'CORE strength', '  glutes   squat ', 'HOME partner', 'squát']) {
    assert.equal(matchesWorkoutSearch(squats, query), true, query);
  }
  assert.equal(matchesWorkoutSearch(plank, 'high fives'), true);
  assert.equal(matchesWorkoutSearch(plank, 'high-fives shoulders'), true);
  assert.equal(matchesWorkoutSearch(squats, 'core cardio'), false);
  assert.equal(matchesWorkoutSearch(squats, 'unknown movement'), false);
});

test('all ten workouts have complete sessions with their individual prescriptions', () => {
  const catalog = makeWorkoutCatalog();
  assert.equal(catalog.length, 10);
  assert.equal(new Set(catalog.map(workout => workout.id)).size, 10);
  catalog.forEach(workout => {
    const definition = PARTNER_WORKOUTS.find(item => item.id === workout.id);
    const plan = getWorkoutPlan(workout, 1);
    const active = plan.phases.filter(phase => phase.type === 'exercise');
    assert.equal(active.length, workout.id === 'couple-dance-cardio' ? 1 : 3);
    assert.ok(active.every(phase => phase.durationSeconds === definition.seconds));
    assert.equal(plan.workoutExercises[0].targetLabel, definition.prescription);
    assert.equal(plan.phases[0].type, 'warmup');
    assert.equal(plan.phases.at(-1).type, 'cooldown');
    assert.equal(new Set(plan.phases.map(phase => phase.key)).size, plan.phases.length);
    assert.equal(plan.totalMinutes, Math.ceil(plan.phases.reduce((sum, phase) => sum + phase.durationSeconds, 0) / 60));
  });
});

test('dance duration can be five or ten minutes without adding extra rounds', () => {
  const dance = makeWorkoutCatalog().find(workout => workout.id === 'couple-dance-cardio');
  for (const minutes of [5, 10]) {
    const plan = getWorkoutPlan({ ...dance, durationMinutes: minutes }, 1);
    assert.equal(plan.phases.filter(phase => phase.type === 'exercise').length, 1);
    assert.equal(plan.workoutExercises[0].setDurationSeconds, minutes * 60);
    assert.equal(plan.totalMinutes, minutes + 3);
  }
});

test('tap and per-leg cues match the demonstration pace, and timed workouts have no invented reps', () => {
  assert.equal(motion('plank-high-fives', 'squat', 2999).rep, 1);
  assert.equal(motion('plank-high-fives', 'squat', 3000).rep, 2);
  assert.equal(motion('plank-high-fives', 'squat', 59_999).rep, 20);
  assert.match(motion('synchronized-lunges', 'squat', 0).cue, /Left leg/);
  assert.match(motion('synchronized-lunges', 'squat', 4000).cue, /Right leg/);
  assert.match(motion('synchronized-lunges', 'squat', 79_999).cue, /Right leg.*10 of 10/);
  for (const id of ['wall-sit-challenge', 'mountain-climber-race', 'jumping-jacks-together', 'couple-dance-cardio']) {
    assert.equal(motion(id, 'squat', 10_000).rep, null);
  }
});

test('all workout frames stay inside their eight-cell sequence and reuse warm-up/cool-down', () => {
  for (const definition of PARTNER_WORKOUTS) {
    for (let elapsed = 0; elapsed < definition.seconds * 1000; elapsed += 250) {
      const pose = motion(definition.id, 'squat', elapsed);
      const first = definition.id === 'partner-squats' ? 4 : 0;
      assert.ok(pose.frame >= first && pose.frame < first + 8);
    }
    assert.equal(motion(definition.id, 'warmup', 1000).sourceId, 'partner-squats');
    assert.equal(motion(definition.id, 'cooldown', 45_000).sourceId, 'partner-squats');
    assert.equal(motion(definition.id, 'squat', 0, true).frame, motion(definition.id, 'squat', 20_000, true).frame);
  }
  assert.ok(motion('wall-sit-challenge', 'squat', 10_000).frame >= 4);
});
