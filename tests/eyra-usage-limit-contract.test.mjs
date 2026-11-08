import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FREE_MONTHLY_AI_ACTIONS } from '../src/lib/eyra-usage-policy.mjs';

test('free and early-access monthly AI quota is shared by browser and server', () => {
  assert.equal(FREE_MONTHLY_AI_ACTIONS, 5);
  const api = readFileSync(new URL('../api/eyra.js', import.meta.url), 'utf8');
  const billing = readFileSync(new URL('../src/lib/billing.js', import.meta.url), 'utf8');
  assert.match(api, /free: FREE_MONTHLY_AI_ACTIONS/);
  assert.match(billing, /ai_actions: FREE_MONTHLY_AI_ACTIONS/);
});
