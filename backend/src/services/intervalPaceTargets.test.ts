import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIntervalRunPaceTargets, buildIntervalWalkPaceTargets } from './intervalPaceTargets';

test('buildIntervalRunPaceTargets uses PaceProfile easy warmup and hard baseline factor', () => {
  const targets = buildIntervalRunPaceTargets(540);
  assert.equal(targets.easySecPerKm, 612);
  assert.equal(targets.hardSecPerKm, 486);
});

test('buildIntervalWalkPaceTargets uses long-walk warmup and power-walk fast pace', () => {
  const targets = buildIntervalWalkPaceTargets(810);
  assert.equal(targets.recoverySecPerKm, 980);
  assert.equal(targets.fastSecPerKm, 810);
});
