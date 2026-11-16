import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ui = readFileSync(new URL('../src/components/eyra/EyraCommandCenter.jsx', import.meta.url), 'utf8');
const client = readFileSync(new URL('../src/lib/eyra-run-history.js', import.meta.url), 'utf8');
const server = readFileSync(new URL('../api/eyra-runs.js', import.meta.url), 'utf8');

test('EYRA exposes operator run history, details, cancellation and deletion controls', () => {
  assert.match(ui, /aria-label="EYRA agent runs"/);
  assert.match(ui, /Agent run history/);
  assert.match(ui, /Agent runs/);
  assert.match(ui, /loadEyraAgentRun\(id\)/);
  assert.match(ui, /cancelEyraAgentRun\(id\)/);
  assert.match(ui, /deleteEyraAgentRun\(id\)/);
  assert.match(ui, /window\.confirm\('Request cancellation/);
  assert.match(ui, /window\.confirm\('Permanently delete this completed agent run/);
  assert.match(ui, /inspect the saved record before retrying/);
});

test('run UI does not silently claim in-flight action cancellation is atomic', () => {
  assert.match(ui, /Cancellation is cooperative/);
  assert.match(server, /cancellation: 'best_effort'/);
  assert.match(server, /status: 'eq\.running'/);
  assert.match(server, /user_id: 'eq\.' \+ owner/);
});

test('run history uses verified auth, bounded result sets and rejects disabled feature', () => {
  assert.match(client, /getUsableSession\(\{ required: true, validate: true \}\)/);
  assert.match(client, /authorization: 'Bearer ' \+ session\.access_token/);
  assert.match(client, /Run history is not activated in this environment/);
  assert.match(client, /result\.runs\.length > 20/);
  assert.match(client, /result\.actions\.length > 8/);
  assert.doesNotMatch(client, /SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY/);
});
