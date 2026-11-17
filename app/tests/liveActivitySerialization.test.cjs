const { test } = require('node:test');
const assert = require('node:assert/strict');
const { compileLayout } = require('./helpers/partnerWidgetHarness.cjs');

function textOf(node) {
  if (node == null) return '';
  if (Array.isArray(node)) return node.map(textOf).join(' ');
  if (typeof node !== 'object') return String(node);
  return textOf(node.props?.children);
}

for (const isDev of [true, false]) {
  test(`Partner Live Activity survives isolated Hermes ${isDev ? 'development' : 'production'} rendering`, () => {
    const render = compileLayout('hermes', isDev, 'PartnerLiveActivity');
    const props = { userName: 'Jess', userKcal: 500, userGoal: 2000, userSteps: 1234,
      partnerName: 'Alex', partnerKcal: 700, partnerGoal: 2100, partnerSteps: 2345, status: 'connected' };
    const result = render(props, {});
    const text = textOf(result.banner);
    for (const value of ['JESS', 'ALEX', '500/2000', '700/2100']) assert(text.includes(value));
    assert.doesNotThrow(() => JSON.stringify(result));
    const pending = [result.banner];
    while (pending.length) {
      const node = pending.pop();
      if (!node || typeof node !== 'object') continue;
      assert.equal(typeof node.type, 'string', 'Only native Expo UI elements may reach the renderer');
      const children = node.props?.children;
      pending.push(...(Array.isArray(children) ? children : [children]));
    }
  });

  test(`Bottle Live Activity renders all action states in Hermes ${isDev ? 'development' : 'production'}`, () => {
    const render = compileLayout('hermes', isDev, 'BottleLiveActivity');
    for (const [lastAction, expected] of [[undefined, 'Drink +250 ml'], ['end:drink:test', 'Caught!'], ['end:throwback:test', 'Thrown back!']]) {
      const result = render({ fromName: 'Jess Smith', count: 2, messageId: 'test', lastAction }, {});
      assert(textOf(result.banner).includes(expected));
      assert(textOf(result.banner).includes('JESS THREW YOU WATER'));
      assert.doesNotThrow(() => JSON.stringify(result));
    }
  });
}
