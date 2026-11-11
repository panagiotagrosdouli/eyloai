import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('read-only RLS probe refuses to run without authorized credentials and expected project', () => {
  const result = spawnSync(process.execPath, ['scripts/verify-rls-two-accounts.mjs'], {
    env: { PATH: process.env.PATH || '' },
    encoding: 'utf8',
    timeout: 5000,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /RLS verification blocked/);
});
