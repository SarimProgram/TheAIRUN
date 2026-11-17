const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function compile(file, dependencies, globals = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function('require', 'exports', 'module', ...Object.keys(globals), compiled)(name => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency ${name}`);
    return dependencies[name];
  }, module.exports, module, ...Object.values(globals));
  return module.exports;
}

const category = (key, extra = {}) => ({ key, isAvailable: true, isAwarded: false, progress: 1, ...extra });
const flush = () => new Promise(resolve => setImmediate(resolve));

function automaticHarness() {
  const timers = new Set();
  const cleanups = [];
  const { useAutomaticDailyRewards } = compile('hooks/useAutomaticDailyRewards.ts', {
    react: { useRef: value => ({ current: value }), useEffect: effect => { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); } },
  }, { setInterval: callback => { timers.add(callback); return callback; }, clearInterval: timer => timers.delete(timer) });
  return {
    mount: args => useAutomaticDailyRewards({ accessToken: 'user-token', dayKey: '2026-11-13', enabled: true, ...args }),
    retry: () => { for (const callback of timers) callback(); },
    stop: () => cleanups.forEach(cleanup => cleanup()),
  };
}

test('automatically collects only available, complete, unawarded categories', async () => {
  const h = automaticHarness();
  const calls = [];
  h.mount({ categories: [category('STEPS'), category('CALORIES', { progress: 0.75, claimable: true }), category('HYDRATION', { progress: 0.5 }), category('MOBILITY', { isAwarded: true }), category('WALK_RUN', { isAvailable: false })], claimPoints: async key => { calls.push(key); return true; } });
  await flush();
  assert.deepEqual(calls, ['STEPS', 'CALORIES']);
  h.stop();
});

test('does not award while disabled, unauthenticated, or without a day', async () => {
  const h = automaticHarness();
  let calls = 0;
  const args = { categories: [category('STEPS')], claimPoints: async () => { calls++; return true; } };
  h.mount({ ...args, enabled: false });
  h.mount({ ...args, accessToken: null });
  h.mount({ ...args, dayKey: '' });
  await flush();
  assert.equal(calls, 0);
  h.stop();
});

test('concurrent Home and Plan submissions share one in-flight award', async () => {
  const h = automaticHarness();
  let release;
  let calls = 0;
  const request = new Promise(resolve => { release = resolve; });
  const args = { categories: [category('STEPS')], claimPoints: async () => { calls++; await request; return true; } };
  h.mount(args);
  h.mount(args);
  assert.equal(calls, 1);
  release();
  await flush();
  h.stop();
});

test('failed awards retry automatically and stop retrying after unmount', async () => {
  const h = automaticHarness();
  let calls = 0;
  h.mount({ categories: [category('STEPS')], claimPoints: async () => { calls++; return false; } });
  await flush();
  h.retry();
  await flush();
  assert.equal(calls, 2);
  h.stop();
  h.retry();
  assert.equal(calls, 2);
});

function pointsHarness(response) {
  const states = [];
  const notifications = [];
  let cursor = 0;
  const react = {
    useState: initial => { const index = cursor++; states[index] ??= initial; return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }]; },
    useRef: initial => { const index = cursor++; states[index] ??= { current: initial }; return states[index]; },
    useCallback: callback => callback,
    useMemo: factory => factory(),
    useEffect: () => {},
  };
  const { useDailyPoints } = compile('hooks/useDailyPoints.ts', {
    react,
    '../config/api': { API_BASE_URL: 'https://example.test' },
    '../lib/daily-reward-events': { notifyDailyReward: event => notifications.push(event) },
  }, { fetch: async () => ({ ok: response.ok !== false, json: async () => response }) });
  const render = () => {
    cursor = 0;
    return useDailyPoints({ accessToken: 'token', dayKey: '2026-11-13', config: { isRunDay: false, hasMobility: true, hasHydration: true, stepsProgress: 1, caloriesProgress: 0, mobilityProgress: 0, hydrationProgress: 0, walkRunProgress: 0 } });
  };
  return { render, notifications };
}

test('new server awards update the ledger and trigger the celebration once', async () => {
  const h = pointsHarness({ alreadyAwarded: false, earnedPoints: 45, maxPoints: 45, progress: 1 });
  assert.equal(await h.render().claimPoints('STEPS'), true);
  assert.equal(h.render().categories.find(item => item.key === 'STEPS').isAwarded, true);
  assert.deepEqual(h.notifications, [{ category: 'STEPS', points: 45 }]);
  assert.equal(await h.render().claimPoints('STEPS'), false);
  assert.equal(h.notifications.length, 1);
});

test('an existing server award reconciles locally without replaying the celebration', async () => {
  const h = pointsHarness({ alreadyAwarded: true, earnedPoints: 45, maxPoints: 45, progress: 1 });
  await h.render().claimPoints('STEPS');
  assert.equal(h.render().categories.find(item => item.key === 'STEPS').isAwarded, true);
  assert.deepEqual(h.notifications, []);
});

test('failed server awards never update the ledger or celebrate', async () => {
  const h = pointsHarness({ ok: false, error: 'Offline' });
  assert.equal(await h.render().claimPoints('STEPS'), false);
  assert.equal(h.render().categories.find(item => item.key === 'STEPS').isAwarded, false);
  assert.deepEqual(h.notifications, []);
});
