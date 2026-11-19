import assert from 'node:assert/strict';
import test from 'node:test';
import { formatUnverifiedEyraToolAction } from '../src/lib/eyra-tool-outcome.mjs';

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
