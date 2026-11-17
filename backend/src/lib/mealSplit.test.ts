import test from 'node:test';
import assert from 'node:assert/strict';
import { plateTotals, recipientPortion, senderPortion } from './mealSplit';

const plate = [
    { foodName: 'Grilled chicken', calories: 333, grams: 180, proteinG: 55.3, carbsG: 0, fatG: 11.1 },
    { foodName: 'Rice', calories: 261, grams: 200, proteinG: 5.4, carbsG: 56.7, fatG: null },
];

test('split portions always add back up to the scanned plate', () => {
    for (const share of [0.05, 0.33, 0.4, 0.5, 0.95]) {
        const shares = [share, share];
        const total = plateTotals(plate);
        const theirs = plateTotals(recipientPortion(plate, shares));
        const mine = plateTotals(senderPortion(plate, shares, 'SPLIT'));
        assert.equal(theirs.calories + mine.calories, total.calories);
        assert.ok(Math.abs(theirs.proteinG + mine.proteinG - total.proteinG) < 0.11);
    }
});

test('per-food shares let one partner take all of an item', () => {
    const shares = [1, 0];
    assert.deepEqual(recipientPortion(plate, shares).map((item) => item.foodName), ['Grilled chicken']);
    assert.deepEqual(senderPortion(plate, shares, 'SPLIT').map((item) => item.foodName), ['Rice']);
});

test('unknown macros stay unknown instead of becoming zero', () => {
    const [, rice] = recipientPortion(plate, [0.5, 0.5]);
    assert.equal(rice.fatG, null);
});

test('a copied plate leaves the sender whole and scales only the recipient serving', () => {
    assert.equal(plateTotals(senderPortion(plate, [0.5, 0.5], 'COPY')).calories, 594);
    assert.equal(plateTotals(recipientPortion(plate, [1.5, 1.5])).calories, 500 + 392);
});
