const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../components/battle/coupleRigGeometry.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const moduleFixture = { exports: {} };
new Function('exports', 'module', source)(moduleFixture.exports, moduleFixture);
const { rigBreath, rigGrip, rigMatrix, RIG_PIVOT } = moduleFixture.exports;
const close = (a, b) => assert(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('character layers animate through native view styles with degree-valued rotations', () => {
  const rigSource = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../components/battle/CoupleCharacterRig.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const fixture = { exports: {} };
  const mockedRequire = name => {
    if (name === 'react-native') return { View: 'NativeView', StyleSheet: { absoluteFill: {} } };
    if (name === 'react-native-reanimated') return { __esModule: true, default: { View: 'AnimatedNativeView' }, useAnimatedStyle: fn => fn() };
    if (name === 'react-native-svg') return { __esModule: true, default: 'Svg' };
    if (name === 'expo-image') return { Image: 'CachedImage' };
    if (name === './coupleArenaAssets') return { COUPLE_RIG: {} };
    if (name === './coupleRigGeometry') return moduleFixture.exports;
    return require(name);
  };
  new Function('require', 'exports', 'module', rigSource)(mockedRequire, fixture.exports, fixture);
  const { rigGrip, REAR_ARM_PIVOT, FRONT_ARM_PIVOT } = moduleFixture.exports;
  const applyView = (point, style) => {
    const [originX, originY] = style[1].transformOrigin;
    const transforms = style[2].transform;
    const angle = parseFloat(transforms[0].rotate) * Math.PI / 180;
    const yScale = transforms[1]?.scaleY ?? 1;
    const x = point.x - originX;
    const y = (point.y - originY) * yScale;
    return { x: originX + x * Math.cos(angle) - y * Math.sin(angle), y: originY + x * Math.sin(angle) + y * Math.cos(angle) };
  };
  for (const [cycle, opening] of [[0, 0], [0, 1.1], [0, -0.55], [0.125, 0], [0.25, 0], [0.5, 0], [0.75, 0], [1, 0]]) {
    const tree = fixture.exports.default({ identity: 'male', index: 0, phase: { get: () => cycle }, openingPull: { get: () => opening }, scale: 1, left: 0, floor: 414 });
    const [legs, upperBody] = tree.props.children;
    assert.equal(legs.props.part, 'legs');
    assert.equal(upperBody.type, 'AnimatedNativeView');
    const [, head, rearArm, frontArm] = upperBody.props.children;
    for (const layer of [upperBody, head, rearArm, frontArm]) {
      assert.equal(layer.type, 'AnimatedNativeView');
      assert.match(layer.props.style[2].transform[0].rotate, /^-?[\d.e+-]+deg$/);
    }
    assert.deepEqual(rearArm.props.style[1].transformOrigin.slice(0, 2), [REAR_ARM_PIVOT.x, REAR_ARM_PIVOT.y]);
    assert.deepEqual(frontArm.props.style[1].transformOrigin.slice(0, 2), [FRONT_ARM_PIVOT.x, FRONT_ARM_PIVOT.y]);
    const breath = rigBreath(cycle, 0);
    const attachments = rigGrip('male', breath, opening);
    const renderedRear = applyView(applyView({ x: 198, y: 190 }, rearArm.props.style), upperBody.props.style);
    const renderedFront = applyView(applyView({ x: 255, y: 183 }, frontArm.props.style), upperBody.props.style);
    close(renderedRear.x, attachments.rear.x);
    close(renderedRear.y, attachments.rear.y);
    close(renderedFront.x, attachments.front.x);
    close(renderedFront.y, attachments.front.y);
  }
});

test('breathing loops continuously with matching position and velocity at the wrap', () => {
  for (let member = 0; member < 4; member++) {
    close(rigBreath(0, member), 0);
    close(rigBreath(1, member), 0);
    const epsilon = 1e-5;
    const before = (rigBreath(1, member) - rigBreath(1 - epsilon, member)) / epsilon;
    const after = (rigBreath(epsilon, member) - rigBreath(0, member)) / epsilon;
    assert(Math.abs(before - after) < 0.001);
    for (const identity of ['male', 'female']) {
      const positions = new Set();
      let previous;
      for (let frame = 0; frame < 120; frame++) {
        const grip = rigGrip(identity, rigBreath(frame / 120, member));
        positions.add(grip.front.y.toFixed(6));
        if (previous) assert(Math.hypot(grip.front.x - previous.front.x, grip.front.y - previous.front.y) < 0.5);
        previous = grip;
      }
      assert(positions.size > 50, 'hand movement must be continuous rather than a few sprite poses');
    }
  }
});

test('torso transforms stay anchored at the waist and preserve the rest hand positions', () => {
  for (const breath of [-0.8, -0.4, 0, 0.4, 0.8]) {
    const m = rigMatrix(breath);
    close(m.a * RIG_PIVOT.x + m.c * RIG_PIVOT.y + m.tx, RIG_PIVOT.x);
    close(m.b * RIG_PIVOT.x + m.d * RIG_PIVOT.y + m.ty, RIG_PIVOT.y);
  }
  for (const identity of ['male', 'female']) {
    const grip = rigGrip(identity, 0);
    close(grip.rear.x, 198);
    close(grip.front.x, 255);
    close(grip.rear.y, identity === 'male' ? 190 : 193);
    close(grip.front.y, identity === 'male' ? 183 : 187);
  }
});

test('breathing moves the head visibly while its waist anchor stays fixed', () => {
  const heights = [];
  for (let frame = 0; frame < 120; frame++) {
    const m = rigMatrix(rigBreath(frame / 120, 0));
    heights.push((m.b * 135 + m.d * 60 + m.ty) * 0.32);
  }
  const travel = Math.max(...heights) - Math.min(...heights);
  assert(travel >= 4 && travel <= 7, `Head should move 4-7 screen points, got ${travel}`);
});
