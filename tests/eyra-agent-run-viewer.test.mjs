import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const parent = readFileSync(new URL('../src/components/eyra/EyraCommandCenter.jsx', import.meta.url), 'utf8');
const viewer = readFileSync(new URL('../src/components/eyra/EyraAgentRunHistory.jsx', import.meta.url), 'utf8');

test('run history remains owner-controlled and presentation-only', () => {
  assert.match(parent, /<EyraAgentRunHistory/);
  assert.match(parent, /onRefresh=\{\(\) => void refreshAgentRuns\(\)\}/);
  assert.match(parent, /onInspect=\{id => void inspectAgentRun\(id\)\}/);
  assert.match(parent, /onCancel=\{id => void cancelAgentRun\(id\)\}/);
  assert.match(parent, /onReviewStale=\{id => void markAgentRunForReview\(id\)\}/);
  assert.match(parent, /onDelete=\{id => void removeAgentRun\(id\)\}/);
  assert.match(viewer, /if \(!open\) return null/);
  assert.doesNotMatch(viewer, /getUsableSession|fetch\(|service_role/);
});

test('run viewer does not promise irreversible action cancellation or safe retries', () => {
  assert.match(viewer, /Cancellation is cooperative/);
  assert.match(viewer, /previously initiated external write may still complete/);
  assert.match(viewer, /needs_review/);
  assert.match(viewer, /inspect the saved record before retrying/);
  assert.match(viewer, /Review stale run \(30\+ min\)/);
  assert.match(viewer, /role="alert"/);
});
