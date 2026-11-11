import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { searchOpenAlexWorks, searchAllPapersWithStatus } from '../src/lib/eyra-api.js';

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


test('stopping EYRA research aborts every active scholarly provider request', async () => {
  const controller = new AbortController();
  const signals = [];
  globalThis.fetch = (_url, options) => new Promise((_resolve, reject) => {
    signals.push(options.signal);
    const abort = () => reject(options.signal.reason || new DOMException('Stopped', 'AbortError'));
    if (options.signal.aborted) abort();
    else options.signal.addEventListener('abort', abort, { once: true });
  });
  try {
    const pending = searchAllPapersWithStatus('evidence synthesis', { limit: 8, signal: controller.signal });
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(signals.length >= 4, 'multiple scholarly sources must begin concurrently');
    controller.abort(new DOMException('Researcher stopped generation', 'AbortError'));
    const response = await pending;
    assert.equal(signals.every(signal => signal.aborted), true);
    assert.equal(response.available_source_count, 0);
    assert.equal(response.papers.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
