// Compiles a widget/Live Activity file the way Metro does, captures the layout string handed to
// createWidget/createLiveActivity, and evaluates it against stubbed SwiftUI globals. Errors here show up
// on device as a blank widget/Live Activity (expo-widgets swallows layout exceptions).
// Usage: node scripts/debug-live-activity-layout.js widgets/BottleLiveActivity.tsx '{"fromName":"Alex"}'
const path = require('path');
const babel = require('@babel/core');

const file = path.resolve(process.argv[2]);
const rawProps = process.argv[3] || '{}';
const props = JSON.parse(rawProps.startsWith('@') ? require('fs').readFileSync(rawProps.slice(1), 'utf8') : rawProps);

const { code } = babel.transformFileSync(file, {
  cwd: path.resolve(__dirname, '..'),
  filename: file,
  presets: ['babel-preset-expo'],
  caller: { name: 'metro', bundler: 'metro', platform: 'ios', isDev: false },
});

const captured = [];
const anyModule = new Proxy({}, { get: (_t, name) => (name === '__esModule' ? true : () => ({})) });
const fakeRequire = (id) => {
  if (id === 'expo-widgets') {
    const capture = (name, layout) => {
      captured.push({ name, layout });
      return {};
    };
    return { createLiveActivity: capture, createWidget: capture };
  }
  return anyModule;
};
const moduleObj = { exports: {} };
// eslint-disable-next-line no-new-func
new Function('require', 'module', 'exports', code)(fakeRequire, moduleObj, moduleObj.exports);

const element = (type) => (componentProps) => ({ type, props: componentProps ?? {} });
const sandbox = new Proxy(
  {
    _jsx: (type, p) => (typeof type === 'function' ? type(p) : { type, props: p }),
    _jsxs: (type, p) => (typeof type === 'function' ? type(p) : { type, props: p }),
    shapes: new Proxy({}, { get: (_t, name) => (...args) => ({ shape: name, args }) }),
    Animation: new Proxy({}, { get: (_t, name) => (...args) => ({ animation: name, args }) }),
  },
  {
    has: (target, name) => typeof name === 'string' && (name in target || !(name in globalThis)),
    get: (target, name) => {
      if (name in target) return target[name];
      if (name === Symbol.unscopables) return undefined;
      return /^[A-Z]/.test(String(name)) ? element(String(name)) : (...args) => ({ modifier: String(name), args });
    },
  },
);

const bundlePath = path.resolve(__dirname, '../node_modules/expo-widgets/bundle/build/ExpoWidgets.bundle');
if (process.argv.includes('--real')) {
  // Mirrors WidgetContext.swift: evaluate ExpoWidgets.bundle, then the layout, then __expoWidgetRender.
  // Build the bundle first with: node node_modules/expo-widgets/scripts/build-bundle.mjs .
  const vm = require('vm');
  for (const { name, layout } of captured) {
    console.log(`--- ${name} (real bundle) ---`);
    const context = vm.createContext({ console });
    vm.runInContext(require('fs').readFileSync(bundlePath, 'utf8'), context);
    context.__expoWidgetLayout = vm.runInContext(`(${layout})`, context);
    const result = context.__expoWidgetRender(props, { colorScheme: 'dark', timestamp: Date.now() });
    console.log(JSON.stringify(result, null, 1).slice(0, 4000));
  }
  process.exit(0);
}

for (const { name, layout } of captured) {
  console.log(`--- ${name} ---`);
  // eslint-disable-next-line no-new-func
  const fn = new Function('sandbox', `with (sandbox) { return (${layout}); }`)(sandbox);
  const result = fn(props, { colorScheme: 'dark', date: new Date(), widgetFamily: 'systemMedium' });
  const text = [];
  JSON.stringify(result, (key, value) => {
    if (key === 'children' && (typeof value === 'string' || typeof value === 'number')) text.push(String(value));
    return value;
  });
  console.log('sections:', Object.keys(result).join(', '));
  console.log('text:', text.join(' | '));
}
