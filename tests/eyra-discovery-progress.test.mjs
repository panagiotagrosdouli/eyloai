import assert from 'node:assert/strict';
import test from 'node:test';
import { createDiscoveryProgressEmitter } from '../src/lib/eyra-discovery-progress.mjs';

test('EYLO/EYRA discovery stops reporting results after cancellation', () => {
  const controller = new AbortController();
  const seen = [];
  const emit = createDiscoveryProgressEmitter(value => seen.push(value), controller.signal);
  assert.equal(emit({ status: 'loading' }), true);
  controller.abort(new DOMException('Superseded search', 'AbortError'));
  assert.equal(emit({ status: 'complete', papers: ['stale paper'] }), false);
  assert.deepEqual(seen, [{ status: 'loading' }]);
});

test('already aborted requests and absent progress listeners do not emit', () => {
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  const emit = createDiscoveryProgressEmitter(() => { calls++; }, controller.signal);
  assert.equal(emit({ status: 'loading' }), false);
  assert.equal(calls, 0);
  assert.equal(createDiscoveryProgressEmitter(undefined)({ status: 'loading' }), false);
});

test('independent requests can continue after an earlier search is cancelled', () => {
  const oldController = new AbortController();
  const newController = new AbortController();
  const oldResults = [];
  const newResults = [];
  const oldProgress = createDiscoveryProgressEmitter(value => oldResults.push(value), oldController.signal);
  const newProgress = createDiscoveryProgressEmitter(value => newResults.push(value), newController.signal);
  oldProgress('old started');
  newProgress('new started');
  oldController.abort();
  oldProgress('old late result');
  newProgress('new final result');
  assert.deepEqual(oldResults, ['old started']);
  assert.deepEqual(newResults, ['new started', 'new final result']);
});
