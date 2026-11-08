import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { searchOpenAlexWorks } from '../src/lib/eyra-api.js';

const originalFetch = globalThis.fetch;
after(() => { globalThis.fetch = originalFetch; });

test('aborting an EYRA search cancels the upstream request', async () => {
  const controller = new AbortController();
  let upstreamSignal;
  globalThis.fetch = (_url, options) => new Promise((_resolve, reject) => {
    upstreamSignal = options.signal;
    upstreamSignal.addEventListener('abort', () => reject(upstreamSignal.reason), { once: true });
  });

  const request = searchOpenAlexWorks('robotics', 5, 'relevance', {
    throwOnError: true,
    signal: controller.signal,
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(upstreamSignal instanceof AbortSignal);
  assert.notEqual(upstreamSignal, controller.signal, 'the source timeout remains independently managed');

  controller.abort(new DOMException('Search superseded.', 'AbortError'));
  await assert.rejects(request, { name: 'AbortError' });
});
