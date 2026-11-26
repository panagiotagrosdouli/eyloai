import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

// This is a release *negative* test. CI must not convert its own successful
// build into production acceptance while hosted evidence is still NOT_RUN.
test('npm run release:readiness fails closed on the shipped unverified evidence', () => {
  const runner = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(runner, ['run', 'release:readiness'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 30_000,
    env: { ...process.env, NO_COLOR: '1' },
  });
  assert.equal(result.error, undefined, 'Release gate process itself must start');
  assert.equal(result.status, 1, 'Missing hosted and human evidence must result in a nonzero status');
  assert.match(result.stdout, /"decision": "NO-GO"/);
  assert.match(result.stdout, /"production_authorized": false/);
  assert.match(result.stdout, /A separate authorized staging database is required/);
});
