const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { compileLayout } = require('./helpers/partnerWidgetHarness.cjs');

function load(file, imports) {
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText, { exports, require: name => imports[name], Date, Intl, console });
  return exports;
}

function textOf(node) {
  if (!node) return '';
  if (Array.isArray(node)) return node.filter((child) => !Array.isArray(child)).map(textOf).join(' ');
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  return textOf(node.props?.children);
}

const plate = {
  mealId: 'plate-1', senderName: 'Amnay', mealType: 'DINNER', foods: 'Grilled chicken, Rice +1', kcal: 312,
  status: 'PENDING', sentAt: '2026-11-13T08:42:00.000Z', expiresAt: '2026-11-13T20:42:00.000Z',
};
const now = new Date('2026-11-13T09:00:00.000Z');

for (const engine of ['hermes', 'default']) {
  for (const isDev of [true, false]) {
    test(`Partner food widget survives Expo serialization: ${engine}, ${isDev ? 'development' : 'production'}`, () => {
      const render = compileLayout(engine, isDev, 'PlaceholderWidgets', 'PartnerFoodWidgetView');
      const art = { imageUri: 'file:///shared/partner-food-plate-1.jpg', portraitUri: 'file:///shared/partner-kcals-woman-v2.png' };
      const states = [
        [plate, { systemSmall: ['Amnay', 'Passed you dinner', '312 kcal', 'Tap to review'], systemMedium: ['From Amnay', '312 kcal', 'Grilled chicken', 'Tap to review'] }, []],
        [{ ...plate, ...art }, { systemSmall: ['Amnay', '312 kcal'], systemMedium: ['From Amnay', '312 kcal'] }, [], [art.imageUri, art.portraitUri]],
        [{ ...plate, ...art, imageIsCutout: true }, { systemSmall: ['312 kcal'], systemMedium: ['312 kcal'] }, [], [art.imageUri]],
        [{ ...plate, status: 'ACCEPTED' }, { systemSmall: ['Dinner logged', 'Grilled chicken'], systemMedium: ['Dinner logged', 'In your log'] }, ['Tap to review']],
        [{ ...plate, status: 'DECLINED' }, ['Partner food'], ['312']],
        [{ ...plate, expiresAt: '2026-11-13T08:59:00.000Z' }, ['Partner food'], ['312']],
        [{}, ['Partner food', 'passes you a plate'], ['kcal']],
      ];
      for (const widgetFamily of ['systemSmall', 'systemMedium']) {
        for (const colorScheme of ['light', 'dark']) {
          for (const [props, wanted, absent, images = []] of states) {
            const node = render(props, { widgetFamily, colorScheme, date: now });
            assert(node?.type, `${widgetFamily} ${colorScheme} must render a root`);
            const json = JSON.stringify(node);
            const text = textOf(node).toLowerCase();
            const expected = Array.isArray(wanted) ? wanted : wanted[widgetFamily];
            for (const value of expected) assert(text.includes(value.toLowerCase()), `Missing ${value}: ${text}`);
            for (const value of absent) assert(!text.includes(value.toLowerCase()), `Unexpected ${value}: ${text}`);
            for (const uri of images) assert(json.includes(`"uiImage":"${uri}"`), `${widgetFamily} must draw ${uri}`);
            const pending = [node];
            while (pending.length) {
              const current = pending.pop();
              const children = current.props?.children;
              if (Array.isArray(children)) {
                assert(!children.some(Array.isArray), 'Native renderer drops nested child arrays');
                pending.push(...children.filter((child) => child && typeof child === 'object'));
              } else if (children && typeof children === 'object') pending.push(children);
              for (const modifier of current.props?.modifiers || []) {
                if (modifier.name === 'frame') {
                  const f = modifier.args[0];
                  assert(!(f.height && f.maxWidth), 'Expo ignores maxWidth when height is set in the same frame');
                }
              }
            }
          }
        }
      }
    });
  }
}

test('Widget timeline shows the partner plate, then clears it', () => {
  const lib = load('lib/partner-food-widget.ts', {
    'react-native': { Platform: { OS: 'ios' } },
    './meal-pass': load('lib/meal-pass.ts', {}),
    'expo-file-system': {}, 'expo-image-manipulator': {}, './meal-pass-api': {}, './partner-surface': {},
    '@react-native-async-storage/async-storage': { default: {} }, expo: {}, '@/config/api': { API_BASE_URL: '' },
    './partner-widget-portraits': load('lib/partner-widget-portraits.ts', {}),
  });
  const meal = {
    id: 'plate-1', mode: 'SPLIT', mealType: 'DINNER', status: 'PENDING', senderName: 'Amnay',
    createdAt: plate.sentAt, expiresAt: plate.expiresAt,
    items: [{ foodName: 'Grilled chicken', calories: 420 }, { foodName: 'Rice', calories: 300 }, { foodName: 'Greens', calories: 60 }],
    itemShares: [0.4, 0.4, 0],
  };

  const [shownEntry, cleared] = lib.partnerFoodEntries(meal, now);
  assert.equal(shownEntry.props.kcal, 288);
  assert.equal(shownEntry.props.foods, 'Grilled chicken, Rice');
  assert.equal(shownEntry.props.senderName, 'Amnay');
  assert.equal(shownEntry.props.imageUri, '');
  const withArt = lib.partnerFoodEntries(meal, now, { imageUri: 'file:///a.png', imageIsCutout: true, portraitUri: 'file:///p.png' })[0].props;
  assert.equal(withArt.imageIsCutout, true);
  assert.equal(withArt.portraitUri, 'file:///p.png');
  assert.equal(cleared.date.toISOString(), plate.expiresAt);
  assert.equal(cleared.props.mealId, '');

  const logged = lib.partnerFoodEntries({ ...meal, status: 'ACCEPTED', itemShares: [1, 1, 1] }, now);
  assert.equal(logged[0].props.foods, 'Grilled chicken, Rice +1');
  assert.equal(logged[0].props.kcal, 780);
  assert(logged[1].date > now, 'Logged plates clear at the next midnight');

  const declined = lib.partnerFoodEntries({ ...meal, status: 'DECLINED' }, now);
  assert.equal(declined.length, 1);
  assert.equal(declined[0].props.mealId, '');

  const waiting = { id: 'a', status: 'PENDING', createdAt: '2026-11-13T08:00:00.000Z' };
  assert.equal(lib.shouldReplaceShown(waiting, { id: 'b', status: 'ACCEPTED', createdAt: '2026-11-13T09:00:00.000Z' }), false);
  assert.equal(lib.shouldReplaceShown(waiting, { id: 'b', status: 'PENDING', createdAt: '2026-11-13T07:00:00.000Z' }), false);
  assert.equal(lib.shouldReplaceShown(waiting, { id: 'b', status: 'PENDING', createdAt: '2026-11-13T09:00:00.000Z' }), true);
  assert.equal(lib.shouldReplaceShown(waiting, { id: 'a', status: 'ACCEPTED', createdAt: waiting.createdAt }), true);
});
