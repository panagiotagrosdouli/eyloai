import assert from 'node:assert/strict';
import test from 'node:test';
import handler from '../api/discovery.js';
import { createScholarlyProviderCoordinator, scholarlyCacheKey, scholarlyProviderGroup } from '../server/scholarly-provider-coordination.mjs';
import { scholarlyResilience } from '../server/scholarly-resilience.mjs';

function response() {
  return {
    statusCode: 200, headers: {}, payload: undefined,
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[String(name).toLowerCase()] = value; },
    json(value) { this.payload = value; return this; },
    send(value) { this.payload = value; return this; },
  };
}

function env() {
  return {
    VERCEL: '1',
    VITE_SUPABASE_URL: 'https://eylotest.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'local-service-role-test-key',
  };
}

function rpcName(input) { return new URL(typeof input === 'string' ? input : input.url).pathname.split('/').at(-1); }

test('provider coordination keys are opaque and OpenAlex endpoints share a provider group', () => {
  const first = scholarlyCacheKey('provider-result', ['openalex_works', 'private topic A']);
  const second = scholarlyCacheKey('provider-result', ['openalex_works', 'private topic B']);
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.notEqual(first, second);
  assert.equal(first.includes('private'), false);
  assert.equal(scholarlyProviderGroup('openalex_authors'), 'openalex');
  assert.equal(scholarlyProviderGroup('semantic_scholar'), 'semantic_scholar');
});

test('coordinator uses server credentials, bounds cache values and validates shared RPC results', async () => {
  const calls = [];
  const coordinator = createScholarlyProviderCoordinator({
    env: env(),
    fetchImpl: async (url, options) => {
      calls.push({ name: rpcName(url), options });
      if (rpcName(url) === 'read_scholarly_provider_cache') return Response.json([]);
      if (rpcName(url) === 'reserve_scholarly_provider_slot') return Response.json([{ allowed: true, status: 'acquired', retry_after_seconds: 0, lease_id: '00000000-0000-4000-8000-000000000001' }]);
      if (rpcName(url) === 'finish_scholarly_provider_request') return Response.json(true);
      if (rpcName(url) === 'write_scholarly_provider_cache') return Response.json(true);
      throw new Error('unexpected RPC');
    },
  });
  const key = 'a'.repeat(64);
  assert.equal(await coordinator.readCache(key), null);
  assert.equal((await coordinator.reserve({ provider: 'arxiv', cacheKey: key, minIntervalMs: 3000 })).allowed, true);
  assert.equal(await coordinator.finish({ provider: 'arxiv', leaseId: '00000000-0000-4000-8000-000000000001', status: 200 }), true);
  assert.equal(await coordinator.writeCache({ cacheKey: key, provider: 'arxiv', body: '<feed/>', contentType: 'application/atom+xml', ttlSeconds: 60 }), true);
  assert.ok(calls.every(call => call.options.headers.apikey === 'local-service-role-test-key'));
  assert.ok(calls.every(call => !JSON.stringify(call.options.body).includes('private')));
  await assert.rejects(coordinator.writeCache({ cacheKey: key, provider: 'arxiv', body: 'x'.repeat(2_097_153), contentType: 'application/atom+xml', ttlSeconds: 60 }), /unavailable/i);
});

test('Vercel discovery coordinates cache, quota, lease and successful provider result through shared RPCs', async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { VERCEL: process.env.VERCEL, VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY };
  const calls = [];
  Object.assign(process.env, env());
  scholarlyResilience.reset();
  globalThis.fetch = async (input, options) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    if (url.hostname === 'api.openalex.org') {
      calls.push({ name: 'provider', options });
      return Response.json({ results: [{ id: 'https://openalex.org/W1', title: 'Synthetic verified source' }] });
    }
    const name = rpcName(input);
    calls.push({ name, options });
    if (name === 'consume_discovery_rate_limit') return Response.json([{ allowed: true, remaining: 9, retry_after_seconds: 0 }]);
    if (name === 'read_scholarly_provider_cache') return Response.json([]);
    if (name === 'reserve_scholarly_provider_slot') return Response.json([{ allowed: true, status: 'acquired', retry_after_seconds: 0, lease_id: '00000000-0000-4000-8000-000000000001' }]);
    if (name === 'write_scholarly_provider_cache' || name === 'finish_scholarly_provider_request') return Response.json(true);
    throw new Error(`unexpected request ${url.pathname}`);
  };
  try {
    const res = response();
    await handler({ method: 'GET', headers: { 'x-vercel-forwarded-for': '198.51.100.7' }, query: { provider: 'openalex_works', q: 'synthetic topic' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['x-eylo-cache'], 'MISS');
    assert.deepEqual(calls.map(call => call.name), [
      'consume_discovery_rate_limit', 'read_scholarly_provider_cache',
      'reserve_scholarly_provider_slot', 'provider',
      'write_scholarly_provider_cache', 'finish_scholarly_provider_request',
    ]);
    assert.ok(calls.filter(call => call.name !== 'provider').every(call => call.options.headers.apikey === env().SUPABASE_SERVICE_ROLE_KEY));
    assert.ok(!JSON.stringify(calls.filter(call => call.name !== 'provider').map(call => call.options.body)).includes('synthetic topic'));
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(originalEnv)) value === undefined ? delete process.env[key] : process.env[key] = value;
  }
});

test('Vercel discovery serves a shared cached result without acquiring a provider lease', async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { VERCEL: process.env.VERCEL, VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY };
  const calls = [];
  Object.assign(process.env, env());
  scholarlyResilience.reset();
  globalThis.fetch = async input => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    const name = rpcName(input);
    calls.push(name);
    if (name === 'consume_discovery_rate_limit') return Response.json([{ allowed: true, remaining: 8, retry_after_seconds: 0 }]);
    if (name === 'read_scholarly_provider_cache') return Response.json([{ body: '{"results":[{"id":"https://openalex.org/W2","title":"Shared cached paper"}]}', content_type: 'application/json' }]);
    if (url.hostname === 'api.openalex.org') throw new Error('provider must not be contacted for shared hit');
    throw new Error(`unexpected request ${url.pathname}`);
  };
  try {
    const res = response();
    await handler({ method: 'GET', headers: { 'x-vercel-forwarded-for': '198.51.100.8' }, query: { provider: 'openalex_works', q: 'shared cache topic' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['x-eylo-cache'], 'SHARED_HIT');
    assert.deepEqual(calls, ['consume_discovery_rate_limit', 'read_scholarly_provider_cache']);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(originalEnv)) value === undefined ? delete process.env[key] : process.env[key] = value;
  }
});

test('Vercel duplicate requests wait briefly for the shared result instead of contacting the provider again', async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { VERCEL: process.env.VERCEL, VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY };
  const calls = [];
  Object.assign(process.env, env());
  scholarlyResilience.reset();
  globalThis.fetch = async input => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    const name = rpcName(input);
    calls.push(name);
    if (name === 'consume_discovery_rate_limit') return Response.json([{ allowed: true, remaining: 8, retry_after_seconds: 0 }]);
    if (name === 'reserve_scholarly_provider_slot') return Response.json([{ allowed: false, status: 'deduplicated', retry_after_seconds: 1, lease_id: null }]);
    if (name === 'read_scholarly_provider_cache') {
      const reads = calls.filter(call => call === name).length;
      return reads < 3 ? Response.json([]) : Response.json([{ body: '{"results":[{"id":"https://openalex.org/W3","title":"Deduplicated paper"}]}', content_type: 'application/json' }]);
    }
    if (url.hostname === 'api.openalex.org') throw new Error('duplicate request must not call the provider');
    throw new Error(`unexpected request ${url.pathname}`);
  };
  try {
    const res = response();
    await handler({ method: 'GET', headers: { 'x-vercel-forwarded-for': '198.51.100.9' }, query: { provider: 'openalex_works', q: 'deduplication topic' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['x-eylo-cache'], 'SHARED_HIT');
    assert.deepEqual(calls, [
      'consume_discovery_rate_limit', 'read_scholarly_provider_cache',
      'reserve_scholarly_provider_slot', 'read_scholarly_provider_cache', 'read_scholarly_provider_cache',
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(originalEnv)) value === undefined ? delete process.env[key] : process.env[key] = value;
  }
});


test('hosted provider lease performs one upstream attempt and publishes normalized cooldown', async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { VERCEL: process.env.VERCEL, VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY };
  Object.assign(process.env, env());
  scholarlyResilience.reset();
  let upstreamCalls = 0;
  let completion;
  globalThis.fetch = async (input, options) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    if (url.hostname === 'api.openalex.org') {
      upstreamCalls++;
      return new Response('{}', { status: 429, headers: { 'Retry-After': '0.5' } });
    }
    const name = rpcName(input);
    if (name === 'consume_discovery_rate_limit') return Response.json([{ allowed: true, remaining: 9, retry_after_seconds: 0 }]);
    if (name === 'read_scholarly_provider_cache') return Response.json([]);
    if (name === 'reserve_scholarly_provider_slot') return Response.json([{ allowed: true, status: 'acquired', retry_after_seconds: 0, lease_id: '00000000-0000-4000-8000-000000000001' }]);
    if (name === 'finish_scholarly_provider_request') { completion = JSON.parse(options.body); return Response.json(true); }
    throw new Error('unexpected request ' + name);
  };
  try {
    const res = response();
    await handler({ method: 'GET', headers: { 'x-vercel-forwarded-for': '198.51.100.10' }, query: { provider: 'openalex_works', q: 'synthetic cooldown regression' } }, res);
    assert.equal(upstreamCalls, 1);
    assert.equal(res.statusCode, 429);
    assert.equal(res.headers['retry-after'], '1');
    assert.equal(completion.p_status, 429);
    assert.equal(completion.p_retry_after_seconds, 1);
  } finally {
    globalThis.fetch = originalFetch;
    scholarlyResilience.reset();
    for (const [key, value] of Object.entries(originalEnv)) value === undefined ? delete process.env[key] : process.env[key] = value;
  }
});
