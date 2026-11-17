import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { classifyEyraCloudHistoryFailure, safeEyraCloudHistoryError } from '../src/lib/eyra-cloud-history.mjs';

const read = path => readFileSync(new URL('../src/' + path, import.meta.url), 'utf8');

test('only explicit database schema or RPC absence disables cloud history', () => {
  for (const code of ['PGRST205', '42P01', 'PGRST202', '42883']) {
    assert.equal(classifyEyraCloudHistoryFailure({ code }), 'unavailable');
    assert.equal(safeEyraCloudHistoryError({ code }, 'Try again').code, 'EYRA_CLOUD_HISTORY_UNAVAILABLE');
  }
  for (const code of ['42501', 'PGRST116', 'NETWORK_FAILURE', 'PGRST301']) {
    assert.equal(classifyEyraCloudHistoryFailure({ code }), 'error');
  }
  assert.equal(classifyEyraCloudHistoryFailure(null), 'error');
});

test('cloud history failures never reveal SQL details, tokens or user content', () => {
  const error = safeEyraCloudHistoryError({ code: '42P01', message: 'password=PRIVATE_SQL_SECRET' }, 'Generic');
  assert.match(error.message, /not activated/);
  assert.doesNotMatch(error.message, /PRIVATE_SQL_SECRET|password/);
  const blocked = safeEyraCloudHistoryError({ code: '42501', message: 'user@example.org' }, 'Saved conversations could not be checked.');
  assert.equal(blocked.code, 'EYRA_CLOUD_HISTORY_ERROR');
  assert.doesNotMatch(blocked.message, /user@example.org/);
});

test('EYRA disables cloud save by owner and preserves local export independently', () => {
  const ui = read('components/eyra/EyraCommandCenter.jsx');
  const api = read('lib/eyra-history.js');
  assert.match(ui, /cloudHistoryState.ownerId === \(user\?\.id \?\? null\)/);
  assert.match(ui, /setCloudHistoryState\(\{ ownerId: user\?\.id \?\? null, status: 'checking' \}\)/);
  assert.match(ui, /setCloudHistoryState\(\{ ownerId, status: 'available' \}\)/);
  assert.match(ui, /if \(!owner \|\| !cloudHistoryReady \|\| loading/);
  assert.match(ui, /disabled=\{!cloudHistoryReady \|\| loading \|\| savingConversation \|\| historyBusy\}/);
  assert.match(ui, /role="status" aria-label="Cloud conversation history"/);
  assert.match(ui, /use Export conversation to keep a file/);
  assert.match(ui, /const exportConversation = \(\) =>/);
  assert.match(api, /throw safeEyraCloudHistoryError\(error/);
});

test('synthetic mobile browser verifies absent cloud storage without simulated saves', () => {
  const e2e = readFileSync(new URL('./e2e-learning-integration.mjs', import.meta.url), 'utf8');
  assert.match(e2e, /missing EYRA cloud history disables false cloud saves/);
  assert.match(e2e, /getByRole\('button', \{ name: 'Export conversation', exact: true \}\)\.click\(\)/);
  assert.match(e2e, /code: 'PGRST205'/);
});
