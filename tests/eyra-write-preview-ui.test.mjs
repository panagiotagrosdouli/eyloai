import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ui = readFileSync(new URL('../src/components/eyra/EyraCommandCenter.jsx', import.meta.url), 'utf8');
const review = readFileSync(new URL('../src/components/eyra/EyraWriteIntentReview.jsx', import.meta.url), 'utf8');
const client = readFileSync(new URL('../src/lib/eyra-intelligence.js', import.meta.url), 'utf8');

test('UI submits authenticated, explicitly read-only write preview without a write confirmation', () => {
  assert.match(ui, /preview_write_actions: true/);
  assert.match(ui, /enable_project_tools: true/);
  assert.match(ui, /latest_user_request: review\.content/);
  assert.match(ui, /result\?\.preview_only !== true/);
  assert.match(ui, /No workspace record was changed/);
  assert.match(ui, /onPreview=\{\(\) => void previewPendingWrite\(\)\}/);
  assert.match(ui, /writePreview\?\.ownerId === user\?\.id/);
  assert.match(client, /preview_write_actions: true/);
  assert.match(client, /preview_only: result\.preview_only === true/);
});

test('write preview shows model-proposed fields only as a non-binding draft', () => {
  assert.match(review, /Preview fields \(no save\)/);
  assert.match(review, /Exact fields proposed by EYRA — draft only/);
  assert.match(review, /not a saved record/);
  assert.match(review, /verified durable ledger/);
  assert.match(review, /this preview cannot be confirmed here/);
  assert.match(review, /Object\.entries\(proposal\.fields\)/);
  assert.match(review, /role="status" aria-label="EYRA proposed record fields"/);
});

test('account switching and request cancellation clear stale proposals', () => {
  assert.match(ui, /activeRequestRef\.current\?\.abort\(\)/);
  assert.match(ui, /setPendingWriteReview\(null\); setWritePreview\(null\)/);
  assert.match(ui, /if \(ownerRef\.current !== owner\) return/);
  assert.match(ui, /if \(controller\.signal\.aborted \|\| ownerRef\.current !== owner\) return/);
});
