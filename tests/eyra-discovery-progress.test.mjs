import assert from 'node:assert/strict';
import test from 'node:test';
import { createEyraDiscoveryProgressEmitter } from '../src/lib/eyra-discovery-progress.mjs';

test('cancelled discovery cannot publish stale progress', () => {
  const controller = new AbortController();
  const updates = [];
  const emit = createEyraDiscoveryProgressEmitter(value => updates.push(value), controller.signal);
  assert.equal(emit({ phase: 'papers' }), true);
  controller.abort();
  assert.equal(emit({ phase: 'late-researchers' }), false);
  assert.deepEqual(updates, [{ phase: 'papers' }]);
});

test('an initially aborted request never publishes progress', () => {
  const controller = new AbortController();
  controller.abort();
  const updates = [];
  const emit = createEyraDiscoveryProgressEmitter(value => updates.push(value), controller.signal);
  assert.equal(emit({ phase: 'stale-cache' }), false);
  assert.deepEqual(updates, []);
});

test('independent searches keep independent cancellation state', () => {
  const first = new AbortController();
  const second = new AbortController();
  const updates = [];
  const emitFirst = createEyraDiscoveryProgressEmitter(value => updates.push(value), first.signal);
  const emitSecond = createEyraDiscoveryProgressEmitter(value => updates.push(value), second.signal);
  first.abort();
  assert.equal(emitFirst('old-search'), false);
  assert.equal(emitSecond('current-search'), true);
  assert.deepEqual(updates, ['current-search']);
});
