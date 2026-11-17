import assert from 'node:assert/strict';
import test from 'node:test';
import { toLegacyMealAnalysis } from './mealAnalysis';

const toast = {
  foodName: 'Toast', preparation: 'Toasted', servingQty: 2, servingUnit: 'slice',
  gramsLow: 70, grams: 80, gramsHigh: 90,
  nutritionPer100g: { calories: 250, proteinG: 10, carbsG: 45, fatG: 3.75 },
  nutritionSource: 'model_estimate', identificationConfidence: 'high', portionConfidence: 'medium',
  uncertaintyNote: 'Slice thickness varies.', clarificationQuestion: null,
};
const convert = (items: unknown[]) => toLegacyMealAnalysis({ mealType: 'BREAKFAST', items }, 'BREAKFAST');

test('conversion uses total grams once, retaining the exact legacy fields', () => {
  const response = convert([toast]);
  assert.deepEqual(response, {
    mealType: 'BREAKFAST',
    items: [{ foodName: 'Toast', servingQty: 2, servingUnit: 'slice', grams: 80, calories: 200, proteinG: 8, carbsG: 36, fatG: 3, confidence: 0.6 }],
    totals: { calories: 200, proteinG: 8, carbsG: 36, fatG: 3 },
    confidence: 0.6,
  });
});

test('totals sum displayed item nutrition with consistent rounding', () => {
  const portion = { ...toast, gramsLow: 33, grams: 33, gramsHigh: 33 };
  const response = convert([portion, portion, portion]);
  assert.deepEqual(response.totals, { calories: 249, proteinG: 9.9, carbsG: 44.7, fatG: 3.6 });
});

test('unknown macros remain null while known values and zero values are retained', () => {
  const response = convert([toast, {
    ...toast,
    nutritionPer100g: { calories: 200, proteinG: null, carbsG: 0, fatG: null },
  }]);
  assert.deepEqual(response.totals, { calories: 360, proteinG: null, carbsG: 36, fatG: null });
  assert.equal(response.items[1].carbsG, 0);
});

test('ambiguous portion confidence cannot become high confidence from food recognition', () => {
  assert.equal(convert([{ ...toast, portionConfidence: 'low' }]).items[0].confidence, 0.3);
  assert.equal(convert([toast, { ...toast, portionConfidence: 'low' }]).confidence, 0.3);
});

test('no food returns the existing empty-result shape', () => {
  assert.deepEqual(convert([]), {
    mealType: 'BREAKFAST', items: [],
    totals: { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }, confidence: 0,
  });
});

test('rejects reversed bounds, negative nutrition, mismatched meal types, and overflow', () => {
  assert.throws(() => convert([{ ...toast, gramsHigh: 50 }]));
  assert.throws(() => convert([{ ...toast, servingQty: -1 }]));
  assert.throws(() => convert([{ ...toast, nutritionPer100g: { ...toast.nutritionPer100g, proteinG: -1 } }]));
  assert.throws(() => toLegacyMealAnalysis({ mealType: 'DINNER', items: [] }, 'BREAKFAST'));
  assert.throws(() => convert([{ ...toast, gramsLow: 1e308, grams: 1e308, gramsHigh: 1e308, nutritionPer100g: { ...toast.nutritionPer100g, calories: 1e308 } }]));
});
