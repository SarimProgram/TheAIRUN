const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const flush = () => new Promise(resolve => setImmediate(resolve));
const response = data => ({ ok: true, json: async () => data });
const portion = {
  clientMealId: 'pass-plate', mealType: 'DINNER', loggedAt: new Date().toISOString(),
  items: [{ id: 'rice', foodName: 'Rice', calories: 250 }],
};

// Render the real route with native views stubbed; exercise its focus and meal-change effects.
function harness({ authFetch, pending = async () => [] }) {
  const states = [], effects = [], listeners = new Set();
  let local = [], onFocus;
  const react = {
    createElement: () => null,
    useState(initial) {
      const index = states.length;
      states.push(initial);
      return [initial, value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
    },
    useRef: current => ({ current }), useCallback: fn => fn, useMemo: fn => fn(),
    useEffect: fn => effects.push(fn),
  };
  const noop = () => {};
  const imports = {
    react,
    'react-native': { Platform: { OS: 'ios' }, Keyboard: { dismiss: noop }, UIManager: {}, StyleSheet: { create: value => value } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    'expo-camera': { useCameraPermissions: () => [{ granted: true }, noop] },
    'expo-router': { useRouter: () => ({}), useLocalSearchParams: () => ({}) },
    '@react-navigation/native': { useFocusEffect: fn => { onFocus = fn; } },
    '@react-native-community/netinfo': { fetch: async () => ({ isConnected: false }), addEventListener: () => noop },
    '../../config/api': { API_BASE_URL: 'https://test.local' },
    '@/src/auth/authContext': { useAuth: () => ({ authFetch, isAuthenticated: true, user: { id: 'sam', timezone: 'Australia/Sydney' } }) },
    '../../hooks/usePoints': { usePoints: () => ({ balance: 0, refetch: noop }) },
    '../../hooks/useWeightLog': { useWeightLog: () => ({ weightHistory: [] }) },
    '@/lib/run-storage': { loadRuns: async () => [] },
    '@/lib/home-avatar': { homeAvatarKey: () => 'sam-you' },
    '@/lib/offline-meals': {
      getLocalMealsForDay: async () => local,
      getPendingLocalMeals: pending,
      replaceSyncedLocalMealsForDay: async (_, __, rows) => { local = rows; },
      subscribeToMealChanges: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    },
    '@/lib/meal-pass-sync': { refreshPendingSentPlates: async () => {} },
    '@/utils/genderMascot': { normalizeGender: () => 'male' },
    '@/components/home/nutritionAssets': { nutritionCharacterSource: noop },
    '@/components/home/nutritionReaction': { nutritionReaction: noop },
  };
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '../app/(tabs)/activity.tsx'), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React,
    esModuleInterop: true,
  } }).outputText, { exports, require: name => imports[name] ?? {}, Date, Intl, console });
  exports.default();
  for (const effect of effects) effect();
  return {
    focus: () => onFocus(),
    accept() { local = [portion]; listeners.forEach(listener => listener()); },
    dinner: () => states.find(value => value && Array.isArray(value.DINNER)).DINNER,
    cached: () => local,
  };
}

test('accepting a partner portion shows it while pending meal uploads are blocked', async () => {
  const h = harness({ authFetch: async () => response({}), pending: () => new Promise(() => {}) });
  h.accept();
  await flush();
  assert.equal(h.dinner().length, 1);
  assert.equal(h.dinner()[0].name, 'Rice');
  assert.equal(h.dinner()[0].calories, 250);
});

test('a pre-accept response cannot erase the accepted portion from Activity', async () => {
  let finish;
  const oldMeals = new Promise(resolve => { finish = resolve; });
  const h = harness({
    authFetch: async url => url.endsWith('/meals/today') ? oldMeals : response({}),
    pending: () => new Promise(() => {}),
  });
  h.focus();
  await flush();
  h.accept();
  await flush();
  finish(response({ meals: [] }));
  await flush();
  assert.equal(h.cached().length, 1);
  assert.equal(h.dinner()[0].calories, 250);
});

test('a failed history request does not prevent received food loading from the server', async () => {
  const h = harness({ authFetch: async url => {
    if (url.endsWith('/nutrition-history')) throw new Error('History unavailable');
    return response(url.endsWith('/meals/today') ? { meals: [portion] } : {});
  } });
  h.focus();
  await flush();
  assert.equal(h.dinner().length, 1);
  assert.equal(h.dinner()[0].calories, 250);
});
