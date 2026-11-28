import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectOpenAiLimit, outputText, outputRefusal, normalizeEyraSchema } from '../server/eyra-provider-contract.mjs';

test('provider quota detection uses machine-readable fields, never free text', async () => {
  const quota = await inspectOpenAiLimit(new Response(JSON.stringify({
    error: { code: 'insufficient_quota', message: 'private prompt content should remain private' },
  }), { status: 429, headers: { 'retry-after': '420' } }));
  assert.deepEqual(quota, { quotaExhausted: true, retryAfter: 300 });
  const transient = await inspectOpenAiLimit(new Response(JSON.stringify({
    error: { code: 'rate_limit_exceeded', message: 'private details' },
  }), { status: 429, headers: { 'retry-after': 'invalid' } }));
  assert.deepEqual(transient, { quotaExhausted: false, retryAfter: null });
  const mixedSignals = await inspectOpenAiLimit(new Response(JSON.stringify({
    error: { code: 'rate_limit_exceeded', type: 'insufficient_quota' },
  }), { status: 429, headers: { 'retry-after': '1' } }));
  assert.deepEqual(mixedSignals, { quotaExhausted: true, retryAfter: 1 });
  const typeOnly = await inspectOpenAiLimit(new Response(JSON.stringify({
    error: { type: 'billing_hard_limit_reached' },
  }), { status: 429 }));
  assert.deepEqual(typeOnly, { quotaExhausted: true, retryAfter: null });
  const bad = await inspectOpenAiLimit(new Response('invalid', { status: 429 }));
  assert.equal(bad.quotaExhausted, false);
});

test('extracts only output text and explicit refusal', () => {
  const result = { output: [
    { content: [{ type: 'output_text', text: 'first' }, { type: 'other', text: 'ignore' }] },
    { content: [{ type: 'output_text', text: 'second' }, { type: 'refusal', refusal: 'No.' }] },
  ] };
  assert.equal(outputText(result), 'first\nsecond');
  assert.equal(outputRefusal(result), 'No.');
  assert.equal(outputText({ output: [] }), '');
});

test('ignores malformed provider output envelopes and non-text content', () => {
  const malformed = [
    null,
    {},
    { output: null },
    { output: 'not an array' },
    { output: [null, {}, { content: 'not an array' }] },
  ];
  for (const payload of malformed) {
    assert.equal(outputText(payload), '');
    assert.equal(outputRefusal(payload), undefined);
  }

  const mixed = {
    output: [
      null,
      { content: [
        null,
        { type: 'output_text', text: { unsafe: 'object' } },
        { type: 'output_text', text: 'Verified text' },
        { type: 'refusal', refusal: 404 },
      ] },
      { content: [{ type: 'refusal', refusal: 'Cannot comply.' }] },
    ],
  };
  assert.equal(outputText(mixed), 'Verified text');
  assert.equal(outputRefusal(mixed), 'Cannot comply.');
});

test('normalizes nested strict response schema with all object fields required', () => {
  const schema = normalizeEyraSchema({
    type: 'object', properties: {
      topic: { type: 'string' },
      evidence: { type: 'array', items: { type: 'object', properties: { doi: { type: 'string' } } } },
    },
  });
  assert.deepEqual(schema.required, ['topic', 'evidence']);
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.properties.evidence.items.required, ['doi']);
  assert.throws(() => normalizeEyraSchema(null), /Invalid response schema/);
  let nested = { type: 'string' };
  for (let i = 0; i < 10; i++) nested = { type: 'array', items: nested };
  assert.throws(() => normalizeEyraSchema(nested), /too deeply nested/);
});
