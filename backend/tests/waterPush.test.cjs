const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function harness({ token = 'start-token', enabled = true, reject = false, skipped = false } = {}) {
  const root = process.env.WATER_SERVER_ROOT || path.resolve(__dirname, '..');
  const source = fs.readFileSync(path.join(root, 'src/lib/pushNotifications.ts'), 'utf8');
  const starts = [], notifications = [], updates = [];
  const exports = {};
  const user = { liveActivityStartToken: token, expoPushToken: 'ExpoPushToken[test]', notificationPreferences: {} };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText, {
    exports, console: { error() {} },
    fetch: async (_url, options) => {
      notifications.push(JSON.parse(options.body));
      return { ok: true, json: async () => ({ data: { status: 'ok' } }) };
    },
    require: (id) => {
      if (id === '../db/prisma') return { prisma: { user: {
        findUnique: async () => user, update: async (args) => { updates.push(args); },
      } } };
      if (id === './notificationPreferences') return { isRemoteNotificationEnabled: () => enabled };
      if (id === './mealPassMessage') {
        const mealExports = {};
        const mealSource = fs.readFileSync(path.join(root, 'src/lib/mealPassMessage.ts'), 'utf8');
        vm.runInNewContext(ts.transpileModule(mealSource, { compilerOptions: {
          module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
        } }).outputText, { exports: mealExports });
        return mealExports;
      }
      if (id === './apns') return { startLiveActivity: async (args) => {
        starts.push(args);
        if (reject) throw Error('APNs liveactivity push failed: 410 Unregistered');
        return { status: skipped ? 0 : 200, skipped };
      } };
      throw Error(`Unexpected dependency ${id}`);
    },
  });
  return { send: exports.sendChatMessagePush, starts, notifications, updates };
}

const bottle = { toUserId: 'receiver', fromName: 'Jess', content: '[WATER:bottle:50] Catch!',
  messageId: 'message1', createdAt: '2026-11-10T00:00:00Z' };

test('A bottle starts the named water activity with its message identity', async () => {
  const h = harness(); await h.send(bottle);
  assert.equal(h.starts.length, 1);
  assert.equal(h.starts[0].name, 'BottleLiveActivity');
  assert.equal(h.starts[0].pushToStartToken, 'start-token');
  assert.equal(h.starts[0].payload.messageId, bottle.messageId);
  assert.equal(h.starts[0].payload.sentAt, bottle.createdAt);
  assert.equal(h.notifications.length, 0);
});

for (const options of [{ token: null }, { reject: true }, { skipped: true }]) {
  test(`Unavailable water push-start falls back to a recoverable bottle notification: ${JSON.stringify(options)}`, async () => {
    const h = harness(options); await h.send(bottle);
    assert.equal(h.notifications.length, 1);
    assert.equal(h.notifications[0].data.kind, 'water_bottle');
    assert.equal(h.notifications[0].data.messageId, bottle.messageId);
    assert.equal(h.notifications[0].data.content, bottle.content);
    if (options.reject) assert.equal(h.updates[0].data.liveActivityStartToken, null);
  });
}

test('Disabled partner notifications do not start an activity or send a fallback', async () => {
  const h = harness({ enabled: false }); await h.send(bottle);
  assert.equal(h.starts.length, 0); assert.equal(h.notifications.length, 0);
});

test('A passed plate notifies with the meal and never shows its protocol tag', async () => {
  const h = harness();
  await h.send({ ...bottle, fromName: 'Alex',
    content: '[MEAL:plate:0b9c6d2e-8a51-4f6e-9b1c-3d2a7e4f5a60:40:dinner] Alex passed you dinner' });
  assert.equal(h.starts.length, 0);
  assert.equal(h.notifications[0].title, 'Alex passed you dinner');
  assert.equal(h.notifications[0].data.kind, 'meal_pass');
  assert(!h.notifications[0].body.includes('[MEAL'));
});

test('Plate replies tell the sender the outcome', async () => {
  const h = harness();
  await h.send({ ...bottle, fromName: 'Sam', content: '[MEAL:reply:0b9c6d2e-8a51-4f6e-9b1c-3d2a7e4f5a60:accepted]' });
  await h.send({ ...bottle, fromName: 'Sam', content: '[MEAL:reply:0b9c6d2e-8a51-4f6e-9b1c-3d2a7e4f5a60:declined]' });
  assert.deepEqual(h.notifications.map((n) => n.title), ['Sam accepted your plate', 'Sam passed on your plate']);
  assert(h.notifications.every((n) => n.data.kind === 'meal_pass_reply'));
});

test('Ordinary messages remain ordinary notifications', async () => {
  const h = harness(); await h.send({ ...bottle, content: 'Hello' });
  assert.equal(h.starts.length, 0); assert.equal(h.notifications[0].body, 'Hello');
});
