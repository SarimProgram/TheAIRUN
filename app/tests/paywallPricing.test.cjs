const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../components/paywall/paywallPricing.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const result = { exports: {} };
new Function('exports', 'module', compiled)(result.exports, result);
const p = result.exports;
const weekly = (introPrice) => ({ identifier: 'weekly', packageType: 'WEEKLY', product: { price: 7.99, priceString: '$7.99', currencyCode: 'USD', introPrice } });
const yearly = { identifier: 'yearly', packageType: 'ANNUAL', product: { price: 69.99, priceString: '$69.99', currencyCode: 'USD' } };

test('does not invent free trials for absent, incomplete, or paid introductory offers', () => {
  for (const intro of [null, undefined, {}, { price: null, period: 'P1W' }, { price: 1.99, period: 'P1W' }, { price: 0 }]) {
    assert.equal(p.packageHasFreeTrial(weekly(intro)), false);
  }
});
test('reads actual free offer durations across SDK period formats', () => {
  assert.equal(p.getTrialLengthLabel(weekly({ price: 0, periodUnit: 'DAY', periodNumberOfUnits: 7, cycles: 1 })), '7 days');
  assert.equal(p.getTrialLengthLabel(weekly({ price: 0, period: 'P2W' })), '14 days');
  assert.equal(p.getTrialLengthLabel(weekly({ price: 0, periodUnit: 'MONTH', periodNumberOfUnits: 1, cycles: 2 })), '2 months');
});
test('supports storeProduct and string subscription periods', () => {
  const pkg = { storeProduct: { price: 20, priceString: '20,00 EUR', currencyCode: 'EUR', subscriptionPeriod: 'P1M' } };
  assert.equal(p.getPackagePeriodLabel(pkg), 'month');
  assert.equal(p.getPackagePrice(pkg), '20,00 EUR');
  assert.equal(p.getZeroTodayLabel(pkg), new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' }).format(0));
});
test('calculates yearly savings from store prices and avoids cross-currency comparisons', () => {
  assert.equal(p.getSavingsLabel(yearly, weekly()), 'Save 83%');
  assert.equal(p.getSavingsLabel({ ...yearly, product: { ...yearly.product, currencyCode: 'AUD' } }, weekly()), null);
  assert.equal(p.getSavingsLabel(yearly, undefined), null);
});
test('shows yearly total and derives weekly equivalent without replacing the billed total', () => {
  assert.equal(p.getPackagePrice(yearly), '$69.99');
  assert.equal(p.formatWeeklyEquivalentLabel(yearly), `About ${new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(69.99 / 52)}/week`);
});
test('deduplicates packages from current and fallback offerings', () => {
  const w = weekly();
  assert.deepEqual(p.getAllPackages({ current: { availablePackages: [w, yearly] }, all: { default: { availablePackages: [w] } } }).map(x => x.identifier), ['weekly', 'yearly']);
});
