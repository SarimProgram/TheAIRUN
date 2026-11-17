const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file, mocks = {}, suffix = '') {
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, file), 'utf8') + suffix, {
    fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const fixture = { exports: {} };
  new Function('require', 'exports', 'module', source)(name => {
    if (name in mocks) return mocks[name];
    if (name.endsWith('.png')) return 1;
    return require(name);
  }, fixture.exports, fixture);
  return fixture.exports;
}

const guards = load('../node_modules/react-native-reanimated/src/common/utils/guards.ts');
const { processTransform } = load('../node_modules/react-native-reanimated/src/common/style/processors/transform.ts', {
  '../../errors': { ReanimatedError: Error }, '../../utils': guards,
});
const geometry = load('../components/home/pulleyGeometry.ts');

test('native parser reproduces the reported SVG rotation failure', () => {
  assert.throws(() => processTransform('rotate(1.612465471834519 155 45)'), /Invalid transform property/);
});

test('pulley updates use finite SVG matrices on native and preserve the wheel pivot', () => {
  const updates = [];
  const { PulleyRig } = load('../components/home/CaloriePulleyScene.tsx', {
    'react-native': { Platform: { OS: 'ios', select: values => values.ios }, StyleSheet: { create: value => value } },
    '@react-navigation/native': {},
    'react-native-svg': new Proxy({ __esModule: true, default: 'Svg' }, { get: (target, key) => target[key] ?? key }),
    'react-native-reanimated': { __esModule: true, default: { createAnimatedComponent: value => value }, useDerivedValue: fn => { const value = fn(); return { get: () => value }; }, useAnimatedProps: fn => { const value = fn(); updates.push(value); return value; } },
    './CollapsibleGoal': {}, './nutritionAssets': { NUTRITION_FOOD: { left: 1, right: 2 } },
    './pulleyGeometry': geometry, './PulleyTrophy': { __esModule: true, default: 'Trophy' },
  }, '\nexport { PulleyRig };');
  for (const gender of ['male', 'female']) for (const food of [0, 1800, 2600]) {
    for (let phase = 0; phase < Math.PI * 2; phase += 0.25) {
      updates.length = 0;
      PulleyRig({ right: false, gender, data: { goal: 2000, food }, phase: { get: () => phase }, intro: { get: () => 1 }, id: 'test' });
      assert.equal(updates.length, 5);
      for (const update of updates) {
        assert.equal('transform' in update, false, 'native SVG props must bypass the RN transform parser');
        if (update.matrix) {
          assert.equal(update.matrix.length, 6);
          assert(update.matrix.every(Number.isFinite));
        }
      }
      const [a, b, c, d, tx, ty] = updates[3].matrix;
      const { x, y } = geometry.PULLEY;
      assert(Math.abs(a * x + c * y + tx - x) < 1e-9);
      assert(Math.abs(b * x + d * y + ty - y) < 1e-9);
    }
  }
});

test('pulley intro is finite, pauses behind the summary and respects lifecycle and reduced motion', () => {
  const props = { mine: {}, partner: {}, gender: 'male', partnerGender: 'female', myName: 'You', partnerName: 'Partner' };
  for (const state of [
    { visible: true, focused: true, expanded: true, active: true, reduced: false, runs: true },
    { visible: false, focused: true, expanded: true, active: true, reduced: false, runs: false },
    { visible: true, focused: false, expanded: true, active: true, reduced: false, runs: false },
    { visible: true, focused: true, expanded: false, active: true, reduced: false, runs: false },
    { visible: true, focused: true, expanded: true, active: false, reduced: false, runs: false },
    { visible: true, focused: true, expanded: true, active: true, reduced: true, runs: false },
  ]) {
    let starts = 0;
    let cancellations = 0;
    const cleanups = [];
    const phase = { set() {} };
    const { default: Scene } = load('../components/home/CaloriePulleyScene.tsx', {
      react: { ...require('react'), useId: () => 'test', useState: () => [state.active, () => {}], useEffect: effect => cleanups.push(effect()) },
      'react-native': { AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) }, Platform: { OS: 'ios', select: values => values.ios }, StyleSheet: { create: value => value } },
      '@react-navigation/native': { useIsFocused: () => state.focused },
      'react-native-svg': new Proxy({ __esModule: true, default: 'Svg' }, { get: (target, key) => target[key] ?? key }),
      'react-native-reanimated': {
        __esModule: true, default: { createAnimatedComponent: value => value },
        useSharedValue: () => phase, useReducedMotion: () => state.reduced,
        cancelAnimation: value => { assert.equal(value, phase); cancellations++; },
        Easing: { linear: value => value, out: value => value, back: () => value => value }, withTiming: value => { if (value === Math.PI * 2) starts++; return value; },
      },
      './CollapsibleGoal': { useGoalExpanded: () => state.expanded },
      './nutritionAssets': {}, './pulleyGeometry': geometry, './PulleyTrophy': { __esModule: true, default: 'Trophy' },
    });
    Scene({ ...props, isVisible: state.visible });
    assert.equal(starts, state.runs ? 1 : 0, JSON.stringify(state));
    for (const cleanup of cleanups) cleanup?.();
    assert.equal(cancellations, 4, 'stop the previous loop and intro, and cancel both on unmount');
  }
});
