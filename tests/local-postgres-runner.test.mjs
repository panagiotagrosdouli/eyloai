import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

test('disposable PostgreSQL runner reports a missing Docker runtime without a cleanup traceback', () => {
  const python = spawnSync('which', ['python3'], { encoding: 'utf8' });
  assert.equal(python.status, 0, 'Python 3 is required for the PostgreSQL runner');
  const pythonPath = python.stdout.trim();
  const isolatedPath = mkdtempSync(resolve(process.cwd(), '.tmp-eylo-no-docker-'));
  try {
    const result = spawnSync(pythonPath, [resolve('scripts/integration/test-local-postgres.py')], {
      cwd: process.cwd(),
      env: { ...process.env, PATH: isolatedPath },
      encoding: 'utf8',
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Disposable PostgreSQL tests require Docker; no database was started\./);
    assert.doesNotMatch(result.stderr, /Traceback/);
  } finally {
    rmSync(isolatedPath, { recursive: true, force: true });
  }
});
