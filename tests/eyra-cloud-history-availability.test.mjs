import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { classifyEyraCloudHistoryFailure, safeEyraCloudHistoryError } from '../src/lib/eyra-cloud-history.mjs';

test('only schema/RPC absence codes disable cloud history', () => {
  for (const code of ['PGRST205', '42P01', 'PGRST202', '42883']) {
    assert.equal(classifyEyraCloudHistoryFailure({ code }), 'unavailable');
    assert.equal(safeEyraCloudHistoryError({ code }, 'Try again').code, 'EYRA_CLOUD_HISTORY_UNAVAILABLE');
  }
  for (const code of ['42501', 'PGRST116', 'PGRST301', 'NETWORK_FAILURE']) {
    assert.equal(classifyEyraCloudHistoryFailure({ code }), 'error');
  }
  assert.equal(classifyEyraCloudHistoryFailure(null), 'error');
});

test('schema failures never echo SQL errors or private provider payload', () => {
  const e = safeEyraCloudHistoryError({ code: '42P01', message: 'secret=PRIVATE' }, 'Unavailable');
  assert.doesNotMatch(e.message, /PRIVATE|secret/);
  const other = safeEyraCloudHistoryError({ code: '42501', message: 'email@private.test' }, 'Try again');
  assert.equal(other.message, 'Try again');
});

test('UI waits for per-owner cloud readiness before enabling cloud Save', () => {
  const ui = readFileSync(new URL('../src/components/eyra/EyraCommandCenter.jsx', import.meta.url), 'utf8');
  const api = readFileSync(new URL('../src/lib/eyra-history.js', import.meta.url), 'utf8');
  assert.match(ui, /cloudHistoryState\.ownerId === \(user\?\.id \?\? null\)/);
  assert.match(ui, /if \(!owner \|\| !cloudHistoryReady \|\| loading/);
  assert.match(ui, /disabled=\{!cloudHistoryReady \|\| loading \|\| savingConversation \|\| historyBusy\}/);
  assert.match(ui, /role="status" aria-label="Cloud conversation history"/);
  assert.match(ui, /Cloud conversation saving is not activated here/);
  assert.match(ui, /onClick=\{exportConversation\}/);
  assert.match(ui, /Re-check cloud history/);
  assert.match(api, /safeEyraCloudHistoryError\(error/);
});
