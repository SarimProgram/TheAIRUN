import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  assessPaceWorkout,
  buildPaceUpdate,
  calculateTargetRanges,
  DEFAULT_WALKING_PACE,
  getWorkoutKind,
  nextPersonalisedBaseline,
  statusForSamples,
} from './pacePersonalisation';

test('creates distinct ranges for each workout kind', () => {
  const ranges = calculateTargetRanges(540, 900);
  assert.deepEqual(ranges.EASY_RUN, { minPaceSecPerKm: 524, maxPaceSecPerKm: 567 });
  assert.deepEqual(ranges.LONG_RUN, { minPaceSecPerKm: 540, maxPaceSecPerKm: 594 });
  assert.deepEqual(ranges.GOAL_PRACTICE, { minPaceSecPerKm: 513, maxPaceSecPerKm: 551 });
  assert.deepEqual(ranges.BRISK_WALK, { minPaceSecPerKm: 972, maxPaceSecPerKm: 1062 });
  assert.deepEqual(ranges.POWER_WALK, { minPaceSecPerKm: 864, maxPaceSecPerKm: 936 });
  assert.deepEqual(ranges.LONG_WALK, { minPaceSecPerKm: 936, maxPaceSecPerKm: 1008 });
});

test('keeps running and walking workout kinds separate', () => {
  assert.equal(getWorkoutKind({ type: 'RUN', title: 'Easy Run' }), 'EASY_RUN');
  assert.equal(getWorkoutKind({ type: 'RUN', title: 'Long Run' }), 'LONG_RUN');
  assert.equal(getWorkoutKind({ type: 'RUN', title: 'Goal Practice Run' }), 'GOAL_PRACTICE');
  assert.equal(getWorkoutKind({ type: 'WALK', title: 'Long Walk' }), 'LONG_WALK');
  assert.equal(getWorkoutKind({ type: 'WALK', title: 'Walk' }), 'BRISK_WALK');
  assert.equal(getWorkoutKind({ type: 'RUN', title: 'Power Walk' }), null);
  assert.equal(getWorkoutKind({ type: 'WALK', title: 'Easy Run' }), null);
  assert.equal(getWorkoutKind({ type: 'WALK', title: 'Interval Walk' }), null);
});

test('moves through starting learning and personalised states', () => {
  assert.equal(statusForSamples(0), 'STARTING');
  assert.equal(statusForSamples(2), 'LEARNING');
  assert.equal(statusForSamples(3), 'PERSONALISED');
});

test('accepts a valid tracked workout', () => {
  const result = assessPaceWorkout({
    type: 'RUN',
    title: 'Easy Run',
    source: 'APP_TRACKED',
    distanceKm: 5,
    durationMinutes: 44,
    avgPaceSecPerKm: 528,
    endedAt: new Date(),
    perceivedEffort: 'ABOUT_RIGHT',
  }, 540);
  assert.equal(result.accepted, true);
  if (result.accepted) assert.equal(result.mode, 'RUNNING');
});

test('ignores manual invalid and outlier workouts', () => {
  const base = {
    type: 'RUN', title: 'Easy Run', distanceKm: 5, durationMinutes: 45,
    avgPaceSecPerKm: 540, endedAt: new Date(),
  };
  assert.equal(assessPaceWorkout({ ...base, source: 'MANUAL' }, 540).accepted, false);
  assert.equal(assessPaceWorkout({ ...base, source: 'APP_TRACKED', avgPaceSecPerKm: 300 }, 540).accepted, false);
  assert.equal(assessPaceWorkout({ ...base, source: 'APP_TRACKED', endedAt: null }, 540).accepted, false);
});

test('caps later adjustments at three percent', () => {
  assert.equal(nextPersonalisedBaseline(600, [480, 480, 480], true), 582);
  assert.equal(nextPersonalisedBaseline(600, [720, 720, 720], true), 618);
});

test('caps first personalisation at three percent and uses a fixed walking start', () => {
  assert.equal(nextPersonalisedBaseline(600, [480, 480, 480], false), 582);
  assert.equal(nextPersonalisedBaseline(600, [720, 720, 720], false), 618);
  assert.equal(DEFAULT_WALKING_PACE, 810);
});

test('learns from a materially slower beginner before personalisation', () => {
  const workout = {
    type: 'RUN',
    title: 'Easy Run',
    source: 'APP_TRACKED',
    distanceKm: 5,
    durationMinutes: 67.5,
    avgPaceSecPerKm: 810,
    endedAt: new Date(),
  };
  assert.equal(assessPaceWorkout(workout, 540).accepted, true);
  assert.equal(assessPaceWorkout(workout, 540, true).accepted, false);
});

test('reports progress for accepted samples without claiming a pace change', () => {
  assert.deepEqual(buildPaceUpdate('RUNNING', 540, 540, 'LEARNING', 2), {
    mode: 'RUNNING',
    baselinePaceSecPerKm: 540,
    status: 'LEARNING',
    sampleCount: 2,
    changed: false,
  });
});

test('includes the previous pace when an accepted sample changes the baseline', () => {
  assert.deepEqual(buildPaceUpdate('WALKING', 900, 882, 'PERSONALISED', 3), {
    mode: 'WALKING',
    previousBaselinePaceSecPerKm: 900,
    baselinePaceSecPerKm: 882,
    status: 'PERSONALISED',
    sampleCount: 3,
    changed: true,
  });
});

test('migration preserves Prisma identifier casing', () => {
  const sql = readFileSync(
    resolve(process.cwd(), 'prisma/migrations/20260903140000_add_adaptive_pace/migration.sql'),
    'utf8',
  );
  const quote = String.fromCharCode(34);
  assert.ok(sql.includes('CREATE TYPE ' + quote + 'PaceStatus' + quote));
  assert.ok(sql.includes('CREATE TABLE ' + quote + 'PaceProfile' + quote));
  assert.ok(sql.includes('ALTER TABLE ' + quote + 'WorkoutSession' + quote));
  assert.ok(sql.includes('REFERENCES ' + quote + 'User' + quote + '(' + quote + 'id' + quote + ')'));
  assert.ok(sql.includes('FROM ' + quote + 'User' + quote));
  assert.doesNotMatch(sql, /\b(?:CREATE TYPE|CREATE TABLE|ALTER TABLE|REFERENCES|FROM) (?:Pace|Workout|User)/);
});
