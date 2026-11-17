import assert from 'node:assert/strict';
import test from 'node:test';
import { Completions } from 'openai/resources/chat/completions';
import type { ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions';
import sharp from 'sharp';

test('meal scanner uses Terra low and preserves the portion review contract', async t => {
  process.env.OPENAI_API_KEY ||= 'test-no-network';
  process.env.DATABASE_URL ||= 'postgresql://test:test@localhost:5432/test';
  process.env.JWT_SECRET ||= 'nutrition-route-tests-secret';

  const requests: ChatCompletionCreateParamsNonStreaming[] = [];
  const meal = {
    mealType: 'BREAKFAST',
    items: [{ foodName: 'Toast', servingQty: 2, servingUnit: 'slice', grams: 80, calories: 200, proteinG: 8, carbsG: 36, fatG: 3, confidence: 0.6 }],
    totals: { calories: 200, proteinG: 8, carbsG: 36, fatG: 3 },
    confidence: 0.6,
  };
  const estimate = {
    mealType: 'BREAKFAST',
    items: [{
      foodName: 'Toast', preparation: 'Toasted', servingQty: 2, servingUnit: 'slice',
      gramsLow: 70, grams: 80, gramsHigh: 90,
      nutritionPer100g: { calories: 250, proteinG: 10, carbsG: 45, fatG: 3.75 },
      nutritionSource: 'model_estimate', identificationConfidence: 'high', portionConfidence: 'medium',
      uncertaintyNote: 'Slice thickness is estimated.', clarificationQuestion: null,
    }],
  };
  let completion: any = { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(estimate), refusal: null } }] };
  t.mock.method(Completions.prototype, 'create', async (params: ChatCompletionCreateParamsNonStreaming) => {
    requests.push(params);
    return completion;
  });
  const { default: router } = await import('./nutrition.routes');
  const layer = router.stack.find((entry: any) => entry.route?.path === '/meals/analyze' && entry.route.methods.post) as any;
  const handler = layer.route.stack.at(-1).handle;
  const analyze = async (text?: string, file?: { mimetype: string; buffer: Buffer }) => {
    let status = 200;
    let result: any;
    let error: unknown;
    const response = { status(value: number) { status = value; return this; }, json(value: unknown) { result = value; return this; } };
    await handler({ body: { mealType: 'BREAKFAST', text }, file }, response, (value: unknown) => { error = value; });
    return { status, result, error };
  };

  await t.test('text analysis preserves exact quantities and returns editable per-item servings', async () => {
    const description = '2 slices of toast, 80 g total; ate both slices';
    const response = await analyze(description);
    assert.equal(response.error, undefined);
    assert.equal(response.status, 200);
    assert.deepEqual(response.result, meal);
    const request = requests.at(-1)!;
    assert.equal(request.model, 'gpt-6.1-terra');
    assert.equal(request.reasoning_effort, 'low');
    assert.equal(request.messages[0].role, 'developer');
    assert.equal(request.messages[1].role, 'user');
    const parts = request.messages[1].content as { type: string; text: string }[];
    assert.equal(parts.length, 1);
    assert.deepEqual(JSON.parse(parts[0].text), { mealType: 'BREAKFAST', description });
    assert.equal(request.response_format?.type, 'json_schema');
    if (request.response_format?.type === 'json_schema') {
      assert.equal(request.response_format.json_schema.strict, true);
      const schema = request.response_format.json_schema.schema as any;
      for (const field of ['servingQty', 'servingUnit', 'gramsLow', 'grams', 'gramsHigh', 'nutritionPer100g', 'portionConfidence']) {
        assert.ok(schema.properties.items.items.required.includes(field));
      }
      assert.equal('totals' in schema.properties, false);
    }
    assert.equal('temperature' in request, false);
  });

  await t.test('photo analysis sends a high-detail image with the original meal description', async () => {
    const buffer = await sharp({ create: { width: 40, height: 30, channels: 3, background: '#FFFFFF' } }).png().toBuffer();
    const response = await analyze('Half this bowl of cooked rice', { mimetype: 'image/png', buffer });
    assert.equal(response.error, undefined);
    assert.equal(response.status, 200);
    const parts = requests.at(-1)!.messages[1].content as any[];
    assert.equal(parts.length, 2);
    assert.equal(JSON.parse(parts[0].text).description, 'Half this bowl of cooked rice');
    assert.equal(parts[1].type, 'image_url');
    assert.equal(parts[1].image_url.detail, 'high');
    assert.match(parts[1].image_url.url, /^data:image\/jpeg;base64,/);
    const image = Buffer.from(parts[1].image_url.url.split(',')[1], 'base64');
    assert.equal((await sharp(image).metadata()).width, 40);
  });

  await t.test('unsupported uploads are rejected before any model request', async () => {
    const count = requests.length;
    const response = await analyze(undefined, { mimetype: 'image/gif', buffer: Buffer.from('invalid') });
    assert.equal(response.status, 400);
    assert.equal(requests.length, count);
  });

  await t.test('refused, missing, and truncated answers cannot become empty successful scans', async () => {
    for (const value of [
      { choices: [] },
      { choices: [{ finish_reason: 'length', message: { content: '{"items":[' } }] },
      { choices: [{ finish_reason: 'stop', message: { content: null, refusal: 'Unable to analyze' } }] },
    ]) {
      completion = value;
      const response = await analyze('Toast');
      assert.equal(response.status, 502);
      assert.equal(response.result.items, undefined);
      assert.equal(response.error, undefined);
    }
  });

  await t.test('invalid portion estimates return a retry error without exposing a new response shape', async () => {
    for (const value of [
      { ...estimate, mealType: 'DINNER' },
      { ...estimate, items: [{ ...estimate.items[0], gramsLow: 100 }] },
      { ...estimate, items: [{ ...estimate.items[0], nutritionPer100g: { calories: -10, proteinG: 1, carbsG: 1, fatG: 1 } }] },
      { ...estimate, items: [{ ...estimate.items[0], grams: null }] },
    ]) {
      completion = { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(value), refusal: null } }] };
      const response = await analyze('Toast');
      assert.equal(response.status, 502);
      assert.equal(response.result.items, undefined);
      assert.equal(response.error, undefined);
    }
  });
});
