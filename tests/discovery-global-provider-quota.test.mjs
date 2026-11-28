import test from 'node:test';
import assert from 'node:assert/strict';
import { consumeSharedProviderQuota, makeDiscoveryProviderSubject } from '../server/discovery-rate-limit.mjs';
import { providerSharedQuota } from '../server/scholarly-resilience.mjs';

const env = {
  VERCEL: '1',
  VITE_SUPABASE_URL: 'https://eylo-staging.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'fixture-only-service-role-key',
};

test('shared provider quotas enforce conservative provider-specific windows', () => {
  assert.deepEqual(providerSharedQuota('semantic_scholar'), { limit: 1, windowSeconds: 1 });
  assert.deepEqual(providerSharedQuota('arxiv'), { limit: 1, windowSeconds: 3 });
  assert.deepEqual(providerSharedQuota('europe_pmc'), { limit: 10, windowSeconds: 1 });
  assert.deepEqual(providerSharedQuota('crossref', '', {}), { limit: 1, windowSeconds: 1 });
  assert.deepEqual(providerSharedQuota('crossref', '', { RESEARCH_CONTACT_EMAIL: 'research@example.org' }), { limit: 3, windowSeconds: 1 });
  assert.deepEqual(providerSharedQuota('openalex_works', 'ordinary query'), { limit: 10, windowSeconds: 1 });
  assert.deepEqual(providerSharedQuota('openalex_works', 'a AND b AND c AND d AND e AND f AND g'), { limit: 1, windowSeconds: 1 });
  assert.equal(providerSharedQuota('unknown'), null);
});

test('provider scopes are stable, opaque and distinct from client IP quota scopes', () => {
  const first = makeDiscoveryProviderSubject('semantic_scholar', env.SUPABASE_SERVICE_ROLE_KEY);
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(makeDiscoveryProviderSubject('semantic_scholar', env.SUPABASE_SERVICE_ROLE_KEY), first);
  assert.notEqual(makeDiscoveryProviderSubject('openalex_works', env.SUPABASE_SERVICE_ROLE_KEY), first);
  assert.equal(makeDiscoveryProviderSubject('openalex_authors', env.SUPABASE_SERVICE_ROLE_KEY), makeDiscoveryProviderSubject('openalex_works', env.SUPABASE_SERVICE_ROLE_KEY),
    'OpenAlex API surfaces share one upstream quota scope');
  assert.notEqual(first, 'semantic_scholar');
  assert.notEqual(first, '203.0.113.1');
  assert.equal(makeDiscoveryProviderSubject('../invalid', env.SUPABASE_SERVICE_ROLE_KEY), '');
});

test('provider quota uses the shared RPC with its opaque provider scope and bounded policy', async () => {
  let call;
  const result = await consumeSharedProviderQuota('semantic_scholar', { headers: {} }, {
    env,
    limit: 1,
    windowSeconds: 1,
    fetchImpl: async (url, options) => {
      call = { url, body: JSON.parse(options.body) };
      return Response.json([{ allowed: true, remaining: 0, retry_after_seconds: 1 }]);
    },
  });
  assert.equal(result.status, 'available');
  assert.equal(result.allowed, true);
  assert.equal(call.url, 'https://eylo-staging.supabase.co/rest/v1/rpc/consume_discovery_rate_limit');
  assert.equal(call.body.p_subject_hash, makeDiscoveryProviderSubject('semantic_scholar', env.SUPABASE_SERVICE_ROLE_KEY));
  assert.equal(call.body.p_limit, 1);
  assert.equal(call.body.p_window_seconds, 1);
});

test('provider quota returns a retry delay from the shared counter and never retries a 429', async () => {
  let calls = 0;
  const result = await consumeSharedProviderQuota('semantic_scholar', { headers: {} }, {
    env,
    limit: 1,
    windowSeconds: 1,
    fetchImpl: async () => {
      calls++;
      return Response.json([{ allowed: false, remaining: 0, retry_after_seconds: 1 }]);
    },
  });
  assert.equal(result.status, 'available');
  assert.equal(result.allowed, false);
  assert.equal(result.retryAfterSeconds, 1);
  assert.equal(calls, 1);
});
