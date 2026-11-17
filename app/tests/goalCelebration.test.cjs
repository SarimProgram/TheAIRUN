const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Exercise the real queue with storage and app events, without requiring a native runtime.
function mount(history = []) {
  let queue = [];
  let onReward, onGoal, cleanup;
  const writes = [];
  const user = { id: 'test-user' };
  const react = {
    useState: () => [queue, update => { queue = typeof update === 'function' ? update(queue) : update; }],
    useRef: value => ({ current: value }),
    useCallback: fn => fn,
    useEffect: fn => { cleanup = fn(); },
  };
  const mocks = {
    react,
    '@react-native-async-storage/async-storage': { getItem: async () => JSON.stringify(history), setItem: async (key, value) => writes.push({ key, value: JSON.parse(value) }) },
    '@/src/auth/authContext': { useAuth: () => ({ user }) },
    '@/lib/daily-reward-events': { subscribeToDailyRewards: fn => { onReward = fn; return () => {}; } },
    '@/lib/goal-celebration-events': { subscribeToGoalCompletions: fn => { onGoal = fn; return () => {}; } },
    './GoalCelebration': () => null,
  };
  const source = fs.readFileSync(path.join(__dirname, '../components/home/DailyRewardCelebration.tsx'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(name => {
    assert.ok(name in mocks, `Unexpected import: ${name}`);
    return mocks[name];
  }, module, module.exports);
  module.exports.default();
  return { goal: event => onGoal(event), reward: event => onReward(event), queue: () => queue, writes, cleanup: () => cleanup(), flush: () => new Promise(resolve => setImmediate(resolve)) };
}

test('all four goals queue independently and simultaneous repeats are suppressed', async () => {
  const app = mount();
  for (const goal of ['calories', 'steps', 'workout', 'water']) {
    app.goal({ goal, period: '2026-11-17' });
    app.goal({ goal, period: '2026-11-17' });
  }
  await app.flush();
  assert.equal(app.queue().length, 4);
  assert.equal(new Set(app.queue().map(item => item.id)).size, 4);
  assert.equal(app.writes.length, 4);
});

test('point award enriches completion without replaying its animation', async () => {
  const app = mount();
  app.goal({ goal: 'steps', period: '2026-11-17' });
  await app.flush();
  const id = app.queue()[0].id;
  app.reward({ category: 'STEPS', dayKey: '2026-11-17', points: 25 });
  await app.flush();
  assert.equal(app.queue().length, 1);
  assert.equal(app.queue()[0].id, id);
  assert.equal(app.queue()[0].points, 25);
});

test('persisted achievements do not replay; a new day does', async () => {
  const app = mount(['HYDRATION:2026-11-17']);
  app.goal({ goal: 'water', period: '2026-11-17' });
  app.goal({ goal: 'water', period: '2026-11-18' });
  await app.flush();
  assert.deepEqual(app.queue().map(item => item.key), ['HYDRATION:2026-11-18']);
});

test('weekly workout completion and daily workout points are separate milestones', async () => {
  const app = mount();
  app.goal({ goal: 'workout', period: '2026-11-16' });
  app.reward({ category: 'MOBILITY', dayKey: '2026-11-17', points: 5 });
  await app.flush();
  assert.equal(app.queue().length, 2);
});

test('developer previews can replay and never persist an achievement', async () => {
  const app = mount();
  app.goal({ goal: 'calories', period: 'preview', preview: true });
  app.goal({ goal: 'calories', period: 'preview', preview: true });
  await app.flush();
  assert.equal(app.queue().length, 2);
  assert.ok(app.queue().every(item => item.preview));
  assert.equal(app.writes.length, 0);
});

test('unmount cancels queued events before storage resolves', async () => {
  const app = mount();
  app.goal({ goal: 'steps', period: '2026-11-17' });
  app.cleanup();
  await app.flush();
  assert.equal(app.queue().length, 0);
  assert.equal(app.writes.length, 0);
});
