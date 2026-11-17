const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, requireMock = () => { throw Error('Unexpected import'); }) {
  const source = fs.readFileSync(path.join(__dirname, '../lib', file), 'utf8');
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText, { exports, require: requireMock, console, Date });
  return exports;
}

const { applyBottleCardTap } = load('bottle-card-actions.ts');
const tap = { action: 'drink', messageId: 'bottle1', source: 'activity1', target: 'end:drink:bottle1', at: 123 };

for (const failure of ['logDrink', 'queueReply', 'markHandled', null]) {
  test(`A water action is acknowledged only after durable effects: ${failure || 'success'}`, async () => {
    const calls = [];
    const effects = Object.fromEntries(['logDrink', 'queueReply', 'markHandled', 'acknowledge'].map((name) => [name,
      () => { calls.push(name); if (name === failure) throw Error('Storage unavailable'); }]));
    if (failure) {
      await assert.rejects(applyBottleCardTap(tap, effects), /Storage unavailable/);
      assert(!calls.includes('acknowledge'));
    } else {
      await applyBottleCardTap(tap, effects);
      assert.deepEqual(calls, ['logDrink', 'queueReply', 'markHandled', 'acknowledge']);
    }
  });
}

test('Throw back persists its reply before acknowledgement and never logs water', async () => {
  const calls = [];
  await applyBottleCardTap({ ...tap, action: 'throwback' }, {
    logDrink: async () => { throw Error('Must not log water'); },
    queueReply: async () => { calls.push('reply'); },
    markHandled: async () => { calls.push('handled'); },
    acknowledge: () => { calls.push('ack'); },
  });
  assert.deepEqual(calls, ['reply', 'handled', 'ack']);
});

test('Startup preserves remote cards; explicit completion ends them', async () => {
  let ended = 0;
  const instance = { end: async () => { ended++; } };
  const lib = load('bottle-live-activity.ts', (id) => {
    if (id === 'react-native') return { Platform: { OS: 'ios' } };
    if (id === 'expo') return { requireOptionalNativeModule: () => ({}) };
    if (id === '@/widgets/BottleLiveActivity') return { BottleLiveActivity: { getInstances: () => [instance] } };
    throw Error(id);
  });
  await lib.syncBottleLiveActivity([]);
  assert.equal(ended, 0);
  await lib.syncBottleLiveActivity([], { endWhenEmpty: true });
  assert.equal(ended, 1);
});

test('Reading native taps is non-destructive until explicit acknowledgement', () => {
  let items = [{ source: tap.source, target: tap.target, timestamp: tap.at }];
  const native = {
    getPendingLiveActivityInteractions: () => items,
    acknowledgeLiveActivityInteraction: (source, target, timestamp) => {
      assert.equal(source, tap.source); assert.equal(target, tap.target); assert.equal(timestamp, tap.at);
      items = [];
    },
  };
  const lib = load('bottle-live-activity.ts', (id) => id === 'react-native'
    ? { Platform: { OS: 'ios' } } : { requireOptionalNativeModule: () => native });
  assert.equal(lib.getPendingBottleCardTaps().length, 1);
  assert.equal(lib.getPendingBottleCardTaps().length, 1);
  lib.acknowledgeBottleCardTap(lib.getPendingBottleCardTaps()[0]);
  assert.equal(lib.getPendingBottleCardTaps().length, 0);
});

test('Water retries ignore only duplicate IDs and propagate actual database errors', async () => {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE water_logs (id TEXT PRIMARY KEY, dayKey TEXT NOT NULL, timeBucket TEXT,
    amountMl INTEGER, loggedAt TEXT, synced INTEGER, createdAt TEXT)`);
  const source = fs.readFileSync(path.join(__dirname, '../db/offlineDb.ts'), 'utf8');
  const ast = ts.createSourceFile('offlineDb.ts', source, ts.ScriptTarget.Latest, true);
  const declaration = ast.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === 'insertWaterLog');
  const exports = {};
  vm.runInNewContext(ts.transpileModule(declaration.getText(ast), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText, { exports, getDatabase: async () => ({ runAsync: async (sql, ...args) => db.prepare(sql).run(...args) }) });
  const log = { id: 'bottle-test', dayKey: '2026-11-10', timeBucket: 'morning', amountMl: 250,
    loggedAt: '2026-11-10T00:00:00Z', createdAt: '2026-11-10T00:00:00Z' };
  try {
    await exports.insertWaterLog(log, { ignoreDuplicate: true });
    await exports.insertWaterLog(log, { ignoreDuplicate: true });
    assert.equal(db.prepare('SELECT SUM(amountMl) AS total FROM water_logs').get().total, 250);
    await assert.rejects(exports.insertWaterLog(log), /UNIQUE/);
    await assert.rejects(exports.insertWaterLog({ ...log, id: 'bad', dayKey: null }, { ignoreDuplicate: true }), /NOT NULL/);
  } finally { db.close(); }
});
