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

test('transient quota gateway failure retries once and recovers without skipping the shared RPC', async () => {
  const request = { headers: { 'x-vercel-forwarded-for': '203.0.113.12' } };
  const calls = [];
  const result = await consumeDiscoveryQuota(request, {
    env: vercelEnv,
    fetchImpl: async (url, options) => {
      calls.push({ url, method: options.method });
      return calls.length === 1
        ? new Response('temporary gateway failure', { status: 503 })
        : Response.json([{ allowed: true, remaining: 118, retry_after_seconds: 60 }]);
    },
  });
  assert.equal(result.status, 'available');
  assert.equal(result.allowed, true);
  assert.equal(calls.length, 2);
  assert.ok(calls.every(call => call.url.endsWith('/rpc/consume_discovery_rate_limit') && call.method === 'POST'));
});

test('quota guard never retries auth, missing RPC, rate-limit, malformed output or ambiguous network failures', async () => {
  const request = { headers: { 'x-vercel-forwarded-for': '203.0.113.12' } };
  for (const status of [401, 403, 404, 429]) {
    let calls = 0;
    const result = await consumeDiscoveryQuota(request, {
      env: vercelEnv,
      fetchImpl: async () => { calls++; return new Response('', { status }); },
    });
    assert.deepEqual(result, { status: 'unavailable' });
    assert.equal(calls, 1, `unexpected retry for HTTP ${status}`);
  }
  let calls = 0;
  const result = await consumeDiscoveryQuota(request, {
    env: vercelEnv,
    fetchImpl: async () => { calls++; throw new Error('network unavailable'); },
  });
  assert.deepEqual(result, { status: 'unavailable' });
  assert.equal(calls, 1);
});

test('quota diagnostics classify failures without disclosing request, credentials or upstream content', async () => {
  const request = { headers: { 'x-vercel-forwarded-for': '203.0.113.12' } };
  const privateMessage = 'private upstream body, token and query must never be logged';
  const cases = [
    { env: {}, reason: 'missing_server_configuration' },
    { request: { headers: {} }, reason: 'missing_trusted_client_ip' },
    { fetchImpl: null, reason: 'fetch_unavailable' },
    ...[401, 403, 404, 500, 503].map(status => ({
      fetchImpl: async () => new Response(privateMessage, { status }),
      reason: status === 401 || status === 403 ? 'rpc_access_denied' : status === 404 ? 'rpc_not_found' : 'rpc_http_error',
      httpStatus: status,
    })),
    { fetchImpl: async () => new Response(privateMessage), reason: 'invalid_rpc_response' },
    { fetchImpl: async () => Response.json({ allowed: true, remaining: '119', retry_after_seconds: 0 }), reason: 'invalid_rpc_response' },
    { fetchImpl: async () => { throw new DOMException(privateMessage, 'TimeoutError'); }, reason: 'rpc_timeout' },
    { fetchImpl: async () => { throw new DOMException(privateMessage, 'AbortError'); }, reason: 'rpc_timeout' },
    { fetchImpl: async () => { throw new Error(privateMessage); }, reason: 'rpc_network_error' },
  ];
  for (const entry of cases) {
    const diagnostics = [];
    const result = await consumeDiscoveryQuota(entry.request ?? request, {
      env: entry.env ?? vercelEnv,
      fetchImpl: 'fetchImpl' in entry ? entry.fetchImpl : async () => { throw new Error('must not fetch'); },
      onUnavailable: diagnostic => diagnostics.push(diagnostic),
    });
    assert.deepEqual(result, { status: 'unavailable' });
    assert.deepEqual(diagnostics, [{ reason: entry.reason, http_status: entry.httpStatus ?? null }]);
    for (const secret of [privateMessage, vercelEnv.SUPABASE_SERVICE_ROLE_KEY, vercelEnv.VITE_SUPABASE_URL, '203.0.113.12']) {
      assert.ok(!JSON.stringify(diagnostics).includes(secret));
    }
  }
});

test('diagnostic sink failure cannot bypass quota enforcement and success emits no failure log', async () => {
  const request = { headers: { 'x-vercel-forwarded-for': '203.0.113.12' } };
  assert.deepEqual(await consumeDiscoveryQuota(request, {
    env: {}, onUnavailable: () => { throw new Error('logger failed'); },
  }), { status: 'unavailable' });
  const diagnostics = [];
  for (const allowed of [true, false]) {
    const result = await consumeDiscoveryQuota(request, {
      env: vercelEnv,
      fetchImpl: async () => Response.json([{ allowed, remaining: allowed ? 119 : 0, retry_after_seconds: 37 }]),
      onUnavailable: diagnostic => diagnostics.push(diagnostic),
    });
    assert.equal(result.status, 'available');
    assert.equal(result.allowed, allowed);
  }
  assert.deepEqual(diagnostics, []);
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
  const originalWarn = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args);
  globalThis.fetch = async () => { fetches += 1; throw new Error('must not query source without limiter'); };
  t.after(() => {
    console.warn = originalWarn;
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
  assert.deepEqual(response.payload, { error: 'Scholarly discovery quota service is unavailable.', code: 'DISCOVERY_RATE_LIMIT_UNAVAILABLE' });
  assert.deepEqual(warnings, [['EYLO_DISCOVERY_QUOTA_UNAVAILABLE', { reason: 'missing_server_configuration', http_status: null }]]);
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

test('all scholarly providers can obtain the shared quota with server-only project configuration', async () => {
  let requestedUrl;
  const result = await consumeDiscoveryQuota({ headers: { 'x-vercel-forwarded-for': '203.0.113.12' } }, {
    env: { VERCEL: '1', SUPABASE_URL: 'https://server-only.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_fixture' },
    fetchImpl: async url => { requestedUrl = url; return Response.json([{ allowed: true, remaining: 119, retry_after_seconds: 300 }]); },
  });
  assert.equal(result.status, 'available');
  assert.equal(result.allowed, true);
  assert.equal(requestedUrl, 'https://server-only.supabase.co/rest/v1/rpc/consume_discovery_rate_limit');
});

test('every gateway provider works with standard server configuration while preserving quota enforcement', async t => {
  const keys = ['VERCEL', 'SUPABASE_URL', 'VITE_SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  process.env.VERCEL = '1';
  process.env.SUPABASE_URL = 'https://server-gateway.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_fixture';
  delete process.env.VITE_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  t.after(() => {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  for (const provider of ['openalex_works', 'openalex_authors', 'openalex_institutions', 'arxiv', 'europe_pmc', 'crossref', 'semantic_scholar']) {
    const calls = [];
    globalThis.fetch = async url => {
      calls.push(String(url));
      if (String(url).includes('/rpc/consume_discovery_rate_limit')) return Response.json([{ allowed: true, remaining: 119, retry_after_seconds: 300 }]);
      return new Response(provider === 'arxiv' ? '<feed></feed>' : '{"results":[]}', { headers: { 'content-type': provider === 'arxiv' ? 'application/atom+xml' : 'application/json' } });
    };
    const response = responseRecorder();
    await handler({ method: 'GET', headers: { 'x-vercel-forwarded-for': '203.0.113.12' }, query: { provider, q: 'shared runtime config regression' } }, response);
    assert.equal(response.statusCode, 200, provider);
    assert.match(calls[0], /^https:\/\/server-gateway\.supabase\.co\/rest\/v1\/rpc\/consume_discovery_rate_limit$/);
    assert.equal(calls.length, 2, `${provider} obtains quota before upstream access`);
  }
});
