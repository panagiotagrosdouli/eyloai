import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/discovery.js';
import { consumeDiscoveryQuota, getTrustedDiscoveryClientIp, makeDiscoveryRateLimitSubject } from '../server/discovery-rate-limit.mjs';

function responseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    payload: null,
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    json(body) { this.payload = body; return this; },
    send(body) { this.payload = body; return this; },
  };
}

const vercelEnv = {
  VERCEL: '1',
  VITE_SUPABASE_URL: 'https://eylo-rate-limit.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'fixture-only-service-role-key',
};

test('trusts Vercel forwarded client IP and ignores caller-forged XFF ahead of it', () => {
  assert.equal(getTrustedDiscoveryClientIp({ headers: {
    'x-vercel-forwarded-for': '203.0.113.12',
    'x-forwarded-for': '198.51.100.89',
  } }, vercelEnv), '203.0.113.12');
});

test('outside Vercel uses socket peer rather than an untrusted forwarded header', () => {
  assert.equal(getTrustedDiscoveryClientIp({
    headers: { 'x-forwarded-for': '198.51.100.89' },
    socket: { remoteAddress: '::ffff:192.0.2.7' },
  }, {}), '192.0.2.7');
});

test('stores only a keyed stable hash and separates IPs and key rotations', () => {
  const first = makeDiscoveryRateLimitSubject('203.0.113.12', 'secret-a');
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(makeDiscoveryRateLimitSubject('203.0.113.12', 'secret-a'), first);
  assert.notEqual(makeDiscoveryRateLimitSubject('203.0.113.13', 'secret-a'), first);
  assert.notEqual(makeDiscoveryRateLimitSubject('203.0.113.12', 'secret-b'), first);
  assert.notEqual(first, '203.0.113.12');
});

test('fails closed without the durable server-side rate-limit configuration', async () => {
  let fetches = 0;
  const result = await consumeDiscoveryQuota({ headers: { 'x-vercel-forwarded-for': '203.0.113.12' } }, {
    env: { VERCEL: '1' },
    fetchImpl: async () => { fetches += 1; },
  });
  assert.deepEqual(result, { status: 'unavailable' });
  assert.equal(fetches, 0);
});

test('fails closed on database error or malformed RPC output', async () => {
  const request = { headers: { 'x-vercel-forwarded-for': '203.0.113.12' } };
  const serverError = await consumeDiscoveryQuota(request, {
    env: vercelEnv,
    fetchImpl: async () => new Response('database unavailable', { status: 503 }),
  });
  const malformed = await consumeDiscoveryQuota(request, {
    env: vercelEnv,
    fetchImpl: async () => Response.json([{ allowed: true, remaining: '119', retry_after_seconds: 80 }]),
  });
  assert.deepEqual(serverError, { status: 'unavailable' });
  assert.deepEqual(malformed, { status: 'unavailable' });
});

test('uses shared RPC before provider access and returns Retry-After when exhausted', async (t) => {
  const oldEnv = Object.fromEntries(['VERCEL', 'VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].map(key => [key, process.env[key]]));
  process.env.VERCEL = '1';
  process.env.VITE_SUPABASE_URL = vercelEnv.VITE_SUPABASE_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = vercelEnv.SUPABASE_SERVICE_ROLE_KEY;
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push(String(url));
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.authorization, `Bearer ${vercelEnv.SUPABASE_SERVICE_ROLE_KEY}`);
    return Response.json([{ allowed: false, remaining: 0, retry_after_seconds: 37 }]);
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(oldEnv)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });

  const response = responseRecorder();
  await handler({
    method: 'GET',
    headers: { 'x-vercel-forwarded-for': '203.0.113.12' },
    query: { provider: 'openalex_works', q: 'reproducible science' },
  }, response);

  assert.equal(response.statusCode, 429);
  assert.equal(response.headers['retry-after'], '37');
  assert.equal(response.headers['x-ratelimit-remaining'], '0');
  assert.equal(response.payload.code, 'DISCOVERY_RATE_LIMITED');
  assert.deepEqual(requests, [`${vercelEnv.VITE_SUPABASE_URL}/rest/v1/rpc/consume_discovery_rate_limit`],
    'rate-limited requests must not reach external scholarly providers');
});

test('Vercel fails closed before provider access when server credentials are missing', async (t) => {
  const originalVercel = process.env.VERCEL;
  const originalUrl = process.env.VITE_SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.VERCEL = '1';
  process.env.VITE_SUPABASE_URL = vercelEnv.VITE_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  let fetches = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { fetches += 1; throw new Error('must not query source without limiter'); };
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalVercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = originalVercel;
    if (originalUrl === undefined) delete process.env.VITE_SUPABASE_URL; else process.env.VITE_SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  });

  const response = responseRecorder();
  await handler({ method: 'GET', headers: { 'x-vercel-forwarded-for': '203.0.113.12' },
    query: { provider: 'openalex_works', q: 'reproducible science' } }, response);
  assert.equal(response.statusCode, 503);
  assert.equal(response.payload.code, 'DISCOVERY_RATE_LIMIT_UNAVAILABLE');
  assert.equal(fetches, 0);
});

test('allowed Vercel request receives shared quota before provider response', async (t) => {
  const oldEnv = Object.fromEntries(['VERCEL', 'VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].map(key => [key, process.env[key]]));
  process.env.VERCEL = '1';
  process.env.VITE_SUPABASE_URL = vercelEnv.VITE_SUPABASE_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = vercelEnv.SUPABASE_SERVICE_ROLE_KEY;
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url) => {
    requests.push(String(url));
    if (String(url).includes('/rpc/consume_discovery_rate_limit')) {
      return Response.json([{ allowed: true, remaining: 119, retry_after_seconds: 300 }]);
    }
    return new Response(JSON.stringify({ results: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(oldEnv)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });

  const response = responseRecorder();
  await handler({ method: 'GET', headers: { 'x-vercel-forwarded-for': '203.0.113.12' },
    query: { provider: 'openalex_works', q: 'reproducible science' } }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['x-ratelimit-limit'], undefined);
  assert.equal(response.headers['x-ratelimit-remaining'], undefined,
    'shared successful provider responses must not cache one client’s quota metadata');
  assert.equal(requests.length, 2);
  assert.match(requests[0], /rpc\/consume_discovery_rate_limit$/);
  assert.match(requests[1], /^https:\/\/api\.openalex\.org\/works\?/);
});
