const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const babel = require('@babel/core');

test('native compiler keeps rope calculations inside UI worklets', () => {
  const filename = path.resolve(__dirname, '../components/battle/CoupleChallengeArena.tsx');
  const result = babel.transformFileSync(filename, {
    configFile: false, babelrc: false, ast: true,
    presets: [require.resolve('babel-preset-expo')],
    caller: { name: 'metro', bundler: 'metro', platform: 'ios', engine: 'hermes', isDev: true, supportsReactCompiler: true },
  });
  const serialized = [];
  babel.traverse(result.ast, { ObjectProperty(p) {
    if (p.node.key.name === 'code' && p.node.value.type === 'StringLiteral') serialized.push(p.node.value.value);
  } });
  const ropes = serialized.filter(code => code.includes('stageGrip') || code.includes('segments'));
  assert.equal(ropes.length, 2, 'both grip and SVG path worklets must be serialized');
  for (const code of ropes) {
    assert.doesNotMatch(code, /\b_temp\d*\b/, 'must not capture a compiler-hoisted JS callback');
    assert.doesNotMatch(code, /\.(?:map|flatMap)\(/, 'rope worklets use loops instead of nested callbacks');
  }
});

