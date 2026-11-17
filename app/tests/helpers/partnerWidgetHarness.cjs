const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('@babel/core');
const generate = require('@babel/generator').default;
function compileLayout(engine, isDev, widgetName = 'PartnerKcalsWidget', viewName = `${widgetName}View`) {
  const filename = path.resolve(__dirname, `../../widgets/${widgetName}.tsx`);
  const source = fs.readFileSync(filename, 'utf8');
  const transformed = babel.transformSync(source, {
    filename, configFile: false, babelrc: false, ast: true,
    presets: [[require.resolve('babel-preset-expo'), { platform: 'ios' }]],
    caller: { name: 'metro', platform: 'ios', engine, isDev, isServer: false, isReactServer: false, supportsStaticESM: true },
  });
  let template;
  babel.traverse(transformed.ast, {
    VariableDeclarator(p) {
      if (p.node.id.name === viewName) template = p.node.init;
    },
  });
  assert.equal(template?.type, 'TemplateLiteral', 'Expo must serialize the layout');
  // Evaluate the literal first, just as the app does, then evaluate the resulting
  // function in a separate context, as WidgetKit does. Esbuild-only tests miss
  // lost regex escapes and Babel helpers captured outside the serialized function.
  const layout = vm.runInNewContext(generate(template).code);
  const globals = {};
  for (const name of ['Button', 'HStack', 'VStack', 'ZStack', 'Image', 'Rectangle', 'Spacer', 'Text']) globals[name] = name;
  for (const name of [
    'accessibilityLabel', 'aspectRatio', 'background', 'clipShape', 'clipped', 'containerRelativeFrame', 'font',
    'foregroundStyle', 'frame', 'ignoreSafeArea', 'lineLimit', 'monospacedDigit',
    'padding', 'resizable', 'scaleEffect', 'offset', 'widgetURL', 'buttonStyle', 'rotationEffect', 'shadow',
  ]) globals[name] = (...args) => ({ name, args });
  globals.shapes = { roundedRectangle: (args) => args, capsule: (args) => args };
  const jsx = (type, props) => ({ type, props });
  Object.assign(globals, { _jsx: jsx, _jsxs: jsx, _jsxDEV: jsx, _jsxFileName: 'widget' });
  return vm.runInNewContext(`(${layout})`, globals);
}

module.exports = { compileLayout };
