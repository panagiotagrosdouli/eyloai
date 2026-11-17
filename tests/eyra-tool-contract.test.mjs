import test from 'node:test';
import assert from 'node:assert/strict';
import { validatedEyraToolArguments, boundedJsonResponse } from '../server/eyra-tool-contract.mjs';

test('unknown tools and malformed argument shapes fail before any database write', () => {
  assert.throws(() => validatedEyraToolArguments('project.delete', '{}'), /Unsupported/);
  assert.throws(() => validatedEyraToolArguments('project.create', '{}'), /allowlisted schema/);
  assert.throws(() => validatedEyraToolArguments('project.list', '{"user_id":"other"}'), /allowlisted schema/);
  assert.throws(() => validatedEyraToolArguments('project.list', '[]'), /JSON object/);
  assert.throws(() => validatedEyraToolArguments('notes.search', '{"query":42}'), /Invalid field/);
  assert.throws(() => validatedEyraToolArguments('notes.search', '{"query":"'+ 'x'.repeat(181) +'"}'), /Invalid field/);
  assert.deepEqual(validatedEyraToolArguments('project.list', '{}'), {});
});

test('tool response reader rejects oversized and malformed data', async () => {
  const over = new Response('{"ok":true}', { headers: { 'content-length': '9999999' } });
  await assert.rejects(() => boundedJsonResponse(over, 100), /safety budget/);
  await assert.rejects(() => boundedJsonResponse(new Response('invalid')), /invalid JSON/);
  assert.deepEqual(await boundedJsonResponse(new Response('{"items":[]}')), { items: [] });
});

test('streaming response hard limit applies even with missing length header', async () => {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('a'.repeat(120)));
      controller.close();
    },
  });
  await assert.rejects(() => boundedJsonResponse(new Response(stream), 100), /safety budget/);
});
