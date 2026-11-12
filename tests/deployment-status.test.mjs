import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/deployment-status.js';

function reply() {
  return {
    code: 200, payload: null, headers: {},
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; return this; },
    status(code) { this.code = code; return this; },
    json(value) { this.payload = value; return this; },
  };
}

test('release identity reports an explicit deployed SHA but no secrets', () => {
  const prevSha = process.env.VERCEL_GIT_COMMIT_SHA;
  const prevEnv = process.env.VERCEL_ENV;
  process.env.VERCEL_GIT_COMMIT_SHA = 'a'.repeat(40);
  process.env.VERCEL_ENV = 'production';
  try {
    const res = reply();
    handler({ method: 'GET', headers: {} }, res);
    assert.equal(res.code, 200);
    assert.equal(res.payload.deployment_sha, 'a'.repeat(40));
    assert.equal(res.payload.environment, 'production');
    assert.equal(res.payload.provenance_verified, true);
    assert.equal(JSON.stringify(res.payload).includes('secret'), false);
    assert.equal(res.headers['cache-control'], 'no-store');
    assert.equal(res.headers['content-type'], 'application/json; charset=utf-8');
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.deepEqual(Object.keys(res.payload).sort(), ['deployment_sha', 'environment', 'note', 'provenance_verified']);
  } finally {
    if (prevSha === undefined) delete process.env.VERCEL_GIT_COMMIT_SHA;
    else process.env.VERCEL_GIT_COMMIT_SHA = prevSha;
    if (prevEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = prevEnv;
  }
});

test('release identity is explicit about missing or malformed SHA', () => {
  const prevSha = process.env.VERCEL_GIT_COMMIT_SHA;
  const prevEnv = process.env.VERCEL_ENV;
  process.env.VERCEL_GIT_COMMIT_SHA = 'not-a-commit';
  process.env.VERCEL_ENV = 'untrusted';
  try {
    const res = reply();
    handler({ method: 'GET', headers: {} }, res);
    assert.equal(res.code, 200);
    assert.equal(res.payload.deployment_sha, null);
    assert.equal(res.payload.environment, 'unknown');
    assert.equal(res.payload.provenance_verified, false);
    assert.equal(res.headers['content-type'], 'application/json; charset=utf-8');
  } finally {
    if (prevSha === undefined) delete process.env.VERCEL_GIT_COMMIT_SHA;
    else process.env.VERCEL_GIT_COMMIT_SHA = prevSha;
    if (prevEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = prevEnv;
  }
});

test('deployment provenance is read-only', () => {
  const res = reply();
  handler({ method: 'POST', headers: {} }, res);
  assert.equal(res.code, 405);
  assert.equal(res.headers.allow, 'GET');
});
