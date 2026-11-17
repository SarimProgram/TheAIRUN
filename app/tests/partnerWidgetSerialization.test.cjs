const assert = require('node:assert/strict');
const { test } = require('node:test');
const { compileLayout } = require('./helpers/partnerWidgetHarness.cjs');

const base = {
  title: 'Partner Kcals', subtitle: 'Updated 9:41', status: 'connected',
  userGender: 'male', partnerGender: 'female', userName: 'Sarim', userKcal: 571, userGoal: 2000,
  partnerName: 'Amnay', partnerKcal: 550, partnerGoal: 2000,
  artworkUri: 'file:///shared/art.jpg',
  userPortraitUri: 'file:///shared/man.png', partnerPortraitUri: 'file:///shared/woman.png',
};

function textOf(node) {
  if (!node) return '';
  // WidgetsDynamicView.updateChildren accepts only dictionary children at this
  // level. Unlike React, it drops a nested array produced by a map among siblings.
  if (Array.isArray(node)) return node.filter((child) => !Array.isArray(child)).map(textOf).join(' ');
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  return textOf(node.props?.children);
}

for (const engine of ['hermes', 'default']) {
  for (const isDev of [true, false]) {
    test(`Partner widget survives Expo serialization: ${engine}, ${isDev ? 'development' : 'production'}`, () => {
      const render = compileLayout(engine, isDev);
      const states = [
        [base, ['Sarim', '1429', 'Amnay', '1450']],
        [{ ...base, userGender: 'female', partnerGender: 'male', userPortraitUri: base.partnerPortraitUri, partnerPortraitUri: base.userPortraitUri }, ['1429', '1450']],
        [{ ...base, userGender: 'female', partnerGender: 'female', userPortraitUri: base.partnerPortraitUri }, ['1429', '1450']],
        [{ ...base, userGender: 'male', partnerGender: 'male', partnerPortraitUri: base.userPortraitUri }, ['1429', '1450']],
        [{}, ['You', 'Partner', 'sync']],
        [{ ...base, status: 'no_partner' }, ['sync']],
        [{ ...base, status: 'stale' }, ['1429']],
        [{ ...base, userKcal: 2200 }, ['200', 'kcal over']],
        [{ ...base, userKcal: 2000 }, ['0', 'kcal left']],
        [{ ...base, userGoal: 0, partnerGoal: undefined }, ['sync in app']],
        [{ ...base, userName: 'Alexandria Catherine', partnerName: 'Muhammad Alexander', userGoal: 99999, userKcal: 0 }, ['99999']],
        [{ ...base, artworkUri: undefined }, ['1429', '1450']],
        [{ ...base, title: 'Water Reminder', motivationEyebrow: 'HYDRATION', motivationTitle: 'Have some water', motivationVariant: 'water' }, ['Sarim', '1429', 'Amnay', '1450']],
        [{ ...base, motivationTitle: 'Keep going', motivationVariant: 'default' }, ['Sarim', '1429', 'Amnay', '1450']],
        [{ status: 'connected', primaryLine: 'Sarim: 571/2000 kcal, 123 steps', secondaryLine: 'Amnay: 550/2000 kcal, 456 steps' }, ['Sarim', '1429', 'Amnay', '1450']],
      ];
      for (const widgetFamily of ['systemSmall', 'systemMedium', 'accessoryRectangular']) {
        for (const colorScheme of ['light', 'dark']) {
          for (const [props, expected] of states) {
            const node = render(props, { widgetFamily, colorScheme });
            assert(node?.type, `${widgetFamily} ${colorScheme} must render a root`);
            assert.doesNotThrow(() => JSON.stringify(node));
            const text = textOf(node).toLowerCase();
            for (const value of expected) assert(text.includes(value.toLowerCase()), `Missing ${value}: ${text}`);
            assert(!text.includes('have some water'), 'Saved hydration reminders must not replace calories');
            assert(!text.includes('hydration'), 'Saved hydration headings must not replace calories');
            assert(!text.includes('keep going'), 'Saved motivation messages must not replace calories');
            assert(!text.includes('partner kcals'), 'Widget title must not use space reserved for cutouts');
            assert(!text.includes('updated'), 'Update time must not appear');
            const pending = [node];
            while (pending.length) {
              const current = pending.pop();
              const children = current.props?.children;
              const participant = current.props?.modifiers?.some((m) => m.name === 'accessibilityLabel' && m.args[0].includes(', '));
              if (participant) {
                assert.equal(current.type, 'HStack', 'Each person must have text beside the portrait');
                const siblings = children.filter((child) => child && typeof child === 'object');
                assert(siblings.some((child) => child.type === 'VStack' && child.props.children?.type === 'Image'), 'Portrait lane must be a horizontal sibling');
                assert(siblings.some((child) => child.type === 'VStack'), 'Calorie text must be a horizontal sibling');
              }
              if (Array.isArray(children)) {
                assert(!children.some(Array.isArray), 'Native renderer drops nested child arrays');
                pending.push(...children.filter((child) => child && typeof child === 'object'));
              } else if (children && typeof children === 'object') pending.push(children);
              for (const modifier of current.props?.modifiers || []) {
                assert.notEqual(modifier.name, 'containerRelativeFrame', 'Widget content must use its allocated card width');
                if (modifier.name === 'frame') {
                  const f = modifier.args[0];
                  assert(!(f.height && f.maxWidth), 'Expo ignores maxWidth when height is set in the same frame');
                }
              }
              if (current.type === 'Image' && current.props.uiImage) {
                assert.notEqual(current.props.uiImage, base.artworkUri, 'Old full background must never render');
                const bounds = current.props.modifiers.find((m) => m.name === 'frame')?.args[0];
                assert(bounds?.width <= 68 && bounds?.height <= 128, 'Cutouts need fixed widget-safe bounds');
                assert(bounds?.width >= (widgetFamily === 'systemSmall' ? 46 : 68), 'Portrait viewport must use the enlarged dimensions');
                const bottomOffset = current.props.modifiers.find((m) => m.name === 'offset')?.args[0]?.y;
                assert.equal(bottomOffset, widgetFamily === 'systemSmall' ? 6 : 10, 'Artwork must extend past the bottom edge');
              }
            }
          }
        }
      }
    });
  }
}
