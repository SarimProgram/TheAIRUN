const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../lib/partner-widget-portraits.ts'), 'utf8');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: exportsObject });
const { normalizeWidgetGender, selectPartnerWidgetPortraits } = exportsObject;

test('each participant gets their own saved gender, independently of side', () => {
  const artwork = { male: 'male.png', female: 'female.png' };
  for (const mine of ['male', 'female']) {
    for (const partner of ['male', 'female']) {
      const result = selectPartnerWidgetPortraits({ userGender: mine, partnerGender: partner }, artwork);
      assert.equal(result.userPortraitUri, artwork[mine]);
      assert.equal(result.partnerPortraitUri, artwork[partner]);
    }
  }
  const normalized = selectPartnerWidgetPortraits({ userGender: ' FEMALE ', partnerGender: 'Male' }, artwork);
  assert.equal(normalized.userPortraitUri, artwork.female);
  assert.equal(normalized.partnerPortraitUri, artwork.male);
});

test('missing or unset gender never guesses the other participant gender', () => {
  for (const value of [undefined, null, '', 'unspecified', 'other']) {
    const result = selectPartnerWidgetPortraits({ userGender: value, partnerGender: 'female' }, { male: 'male.png', female: 'female.png' });
    assert.equal(result.userPortraitUri, undefined);
    assert.equal(result.partnerPortraitUri, 'female.png');
  }
  assert.equal(normalizeWidgetGender(undefined), undefined, 'Partial updates must preserve a cached gender');
  assert.equal(normalizeWidgetGender(null), null, 'Explicit unset must clear a cached gender');
});

test('profile genders survive cache refreshes and select the correct native widget assets', async () => {
  const values = new Map();
  const snapshots = [];
  const storage = { getItem: async (key) => values.get(key) ?? null, setItem: async (key, value) => values.set(key, value) };
  const nativeWidget = { updateSnapshot: (snapshot) => snapshots.push(snapshot), reload() {} };
  class SharedFile {
    constructor(directory, name) { this.uri = `${directory}/${name}`; this.exists = true; }
  }
  const surfaceExports = {};
  const surfaceSource = fs.readFileSync(path.join(__dirname, '../lib/partner-surface.ts'), 'utf8');
  const compiled = ts.transpileModule(surfaceSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(compiled, {
    exports: surfaceExports, console,
    require(name) {
      if (name === '@react-native-async-storage/async-storage') return storage;
      if (name === 'react-native') return { Platform: { OS: 'ios' } };
      if (name === 'expo-asset') return {};
      if (name === 'expo-file-system') return { File: SharedFile, Paths: { appleSharedContainers: { 'group.au.com.msarim.theaicoach.widgets': 'file:///shared' } } };
      if (name === './partner-widget-portraits') return exportsObject;
      if (name === '@/config/api') return { API_BASE_URL: 'http://test' };
      if (name === '@/widgets/PartnerKcalsWidget') return { PartnerKcalsWidget: nativeWidget };
      if (name.endsWith('.png')) return name;
      if (name === '@/widgets/PartnerLiveActivity') return {};
      throw new Error(`Unexpected dependency ${name}`);
    },
  });
  const { buildPartnerLivePayload, applyPartnerSurfacePayload } = surfaceExports;
  await applyPartnerSurfacePayload(buildPartnerLivePayload({ userGender: 'female', partnerGender: 'male' }));
  let latest = snapshots.at(-1);
  assert(latest.userPortraitUri.endsWith('partner-kcals-woman-v2.png'));
  assert(latest.partnerPortraitUri.endsWith('partner-kcals-man-v2.png'));

  await applyPartnerSurfacePayload(buildPartnerLivePayload({ userKcal: 650, partnerKcal: 700 }));
  latest = snapshots.at(-1);
  assert.equal(latest.userGender, 'female', 'Partial calorie refresh must keep saved gender');
  assert(latest.userPortraitUri.endsWith('partner-kcals-woman-v2.png'));
  assert(latest.partnerPortraitUri.endsWith('partner-kcals-man-v2.png'));

  await applyPartnerSurfacePayload(buildPartnerLivePayload({ userGender: null }));
  latest = snapshots.at(-1);
  assert.equal(latest.userPortraitUri, undefined, 'Removing gender must remove the previous cutout');
  assert(latest.partnerPortraitUri.endsWith('partner-kcals-man-v2.png'));
});
