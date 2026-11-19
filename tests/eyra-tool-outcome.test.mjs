import assert from 'node:assert/strict';
import test from 'node:test';
import { formatUnverifiedEyraToolAction, hasEyraWriteReceipt } from '../src/lib/eyra-tool-outcome.mjs';

test('missing, pending, and unknown status never claim that a write completed', () => {
  for (const action of [null, {}, { tool: 'project.create' }, { tool: 'project.create', status: 'queued' },
    { tool: 'library.save_paper', status: 'in_progress' },
    { tool: 'project.create', status: 'unknown' }]) {
    const summary = formatUnverifiedEyraToolAction(action);
    assert.match(summary, /Outcome not confirmed/);
    assert.match(summary, /before retrying/);
    assert.doesNotMatch(summary, /created|saved|completed|verified success/i);
  }
});

test('unrecognized succeeded tool does not claim a verified record', () => {
  const summary = formatUnverifiedEyraToolAction({ tool: 'new.experimental_action', status: 'succeeded' });
  assert.match(summary, /reported success/);
  assert.match(summary, /could not be verified/);
  assert.doesNotMatch(summary, /completed\./);
});

test('malformed or untrusted tool identifiers are not echoed as markup', () => {
  const summary = formatUnverifiedEyraToolAction({ tool: '<script>alert(1)</script>', status: 'pending' });
  assert.match(summary, /Workspace action/);
  assert.doesNotMatch(summary, /script|alert/);
});

test('writes require a valid returned persisted record ID before claiming verification', () => {
  const id = '10000000-0000-4000-8000-000000000001';
  for (const tool of ['project.create', 'library.save_paper']) {
    assert.equal(hasEyraWriteReceipt({ tool, status: 'succeeded', result: { id } }), true);
    for (const result of [null, {}, { id: '' }, { id: 'unavailable' }, { id: '<script>' }]) {
      assert.equal(hasEyraWriteReceipt({ tool, status: 'succeeded', result }), false);
    }
    assert.equal(hasEyraWriteReceipt({ tool, status: 'pending', result: { id } }), false);
  }
});
