import test from 'node:test';
import assert from 'node:assert/strict';
import { probeReleaseTarget } from '../src/lib/deployment-probe.mjs';
const commit = 'a'.repeat(40);
const flags = { ai: true, contact: true, billing: true, scheduled_monitoring: false, institution_analytics: false };

test('explicit non-billing scope excludes only billing and does not certify launch', async () => {
  const transport = fetcher({ '/api/capabilities': () => Response.json({ ...flags, billing: false }) });
  const result = await probeReleaseTarget({ baseUrl: 'https://preview.example.org', expectedCommit: commit,
    billingRequired: false, fetcher: transport });
  assert.equal(result.decision, 'PROBE_PASSED');
  assert.deepEqual(result.required_capabilities, ['ai', 'contact']);
  assert.deepEqual(result.excluded_capabilities, ['billing']);
  assert.equal(result.configured_capabilities.billing, false);
  assert.equal(result.market_readiness_proven, false);
  assert.equal(result.production_authorized, false);
  const strict = await probeReleaseTarget({ baseUrl: 'https://preview.example.org', expectedCommit: commit, fetcher: transport });
  assert.equal(strict.decision, 'PROBE_FAILED', 'billing remains required by default');
});

test('non-billing scope cannot waive contact, AI or the boolean capability contract', async () => {
  for (const missing of ['ai', 'contact', 'billing']) {
    const capabilities = { ...flags, billing: false, [missing]: missing === 'billing' ? 'false' : false };
    const result = await probeReleaseTarget({ baseUrl: 'https://preview.example.org', expectedCommit: commit,
      billingRequired: false, fetcher: fetcher({ '/api/capabilities': () => Response.json(capabilities) }) });
    assert.equal(result.decision, 'PROBE_FAILED');
  }
  await assert.rejects(probeReleaseTarget({ baseUrl: 'https://preview.example.org', expectedCommit: commit,
    billingRequired: 'false', fetcher: fetcher() }), /explicit boolean/);
});
function fetcher(overrides = {}) {
  return async (url, options) => {
    assert.equal(options.method, undefined, 'probe only performs public GET requests');
    assert.equal(options.headers.authorization, undefined);
    if (overrides[url.pathname]) return overrides[url.pathname]();
    if (url.pathname === '/api/discovery') {
      assert.equal(url.searchParams.get('provider'), 'openalex_works');
      assert.equal(url.searchParams.get('limit'), '1');
      return Response.json({ results: [{ id: 'https://openalex.org/W123', title: 'Climate adaptation' }] });
    }
    return Response.json(url.pathname === '/release.json' ? { git_commit: commit } : url.pathname === '/api/deployment-status' ? { deployment_sha: commit, provenance_verified: true, environment: 'preview' } : flags);
  };
}
test('matching public provenance only passes a read-only probe, never market readiness or production authorization', async () => {
  const result = await probeReleaseTarget({ baseUrl: 'https://preview.example.org', expectedCommit: commit, fetcher: fetcher() });
  assert.equal(result.decision, 'PROBE_PASSED');
  assert.equal(result.market_readiness_proven, false);
  assert.equal(result.production_authorized, false);
});

test('green provenance and capability flags cannot hide a discovery quota outage', async () => {
  const result = await probeReleaseTarget({ baseUrl: 'https://preview.example.org', expectedCommit: commit,
    fetcher: fetcher({ '/api/discovery': () => Response.json({ code: 'DISCOVERY_RATE_LIMIT_UNAVAILABLE', error: 'never reflect internal provider detail' }, { status: 503 }) }) });
  assert.equal(result.identity_verified, true);
  assert.equal(result.discovery_available, false);
  assert.equal(result.decision, 'PROBE_FAILED');
  assert.ok(result.issues.some(issue => issue.includes('DISCOVERY_RATE_LIMIT_UNAVAILABLE')));
  assert.ok(!JSON.stringify(result).includes('never reflect'));
});

test('public smoke identifies a safe scholarly provider rate-limit code without retaining its body', async () => {
  const result = await probeReleaseTarget({ baseUrl: 'https://preview.example.org', expectedCommit: commit,
    fetcher: fetcher({ '/api/discovery': () => Response.json({ code: 'SOURCE_RATE_LIMITED', error: 'private provider detail' }, { status: 429 }) }) });
  const discovery = result.endpoints.find(endpoint => endpoint.path.startsWith('/api/discovery'));
  assert.equal(discovery.status, 429);
  assert.match(discovery.error, /SOURCE_RATE_LIMITED/);
  assert.doesNotMatch(JSON.stringify(result), /private provider detail/);
});

test('discovery HTTP200 error, empty results and SPA fallback cannot satisfy smoke retrieval', async () => {
  for (const response of [Response.json({ error: 'unavailable' }), Response.json({ results: [] }), new Response('<html>fallback</html>')]) {
    const result = await probeReleaseTarget({ baseUrl: 'https://preview.example.org', expectedCommit: commit,
      fetcher: fetcher({ '/api/discovery': () => response }) });
    assert.equal(result.discovery_available, false);
    assert.equal(result.decision, 'PROBE_FAILED');
  }
});
test('HTTP200 HTML SPA fallback is an API failure, not evidence of a working backend', async () => {
  const result = await probeReleaseTarget({ baseUrl: 'https://preview.example.org', expectedCommit: commit,
    fetcher: fetcher({ '/api/deployment-status': () => new Response('<html>SPA fallback</html>', { headers: { 'content-type': 'text/html' } }) }) });
  assert.equal(result.decision, 'PROBE_FAILED');
  assert.ok(result.issues.some(issue => issue.includes('Expected JSON')));
  assert.equal(result.identity_verified, false);
  assert.equal(result.endpoints.find(endpoint => endpoint.path === '/api/deployment-status').status, 200);
});
test('an old manifest and disabled billing cannot be promoted to source/provider acceptance', async () => {
  const result = await probeReleaseTarget({ baseUrl: 'https://preview.example.org', expectedCommit: commit,
    fetcher: fetcher({ '/release.json': () => Response.json({ release: 'old label only' }), '/api/capabilities': () => Response.json({ ...flags, billing: false }) }) });
  assert.equal(result.decision, 'PROBE_FAILED');
  assert.equal(result.observed_manifest_sha, null);
  assert.equal(result.configured_capabilities.billing, false);
});
test('public probes reject embedded credentials and cap JSON responses instead of logging untrusted bodies', async () => {
  await assert.rejects(probeReleaseTarget({ baseUrl: 'https://user:password@preview.example.org', expectedCommit: commit, fetcher: fetcher() }), /without credentials/);
  const result = await probeReleaseTarget({ baseUrl: 'https://preview.example.org', expectedCommit: commit,
    fetcher: fetcher({ '/release.json': () => Response.json({ raw: 'x'.repeat(70000) }) }) });
  assert.equal(result.decision, 'PROBE_FAILED');
  assert.ok(result.issues.some(issue => issue.includes('budget')));
  assert.ok(JSON.stringify(result).length < 5000, 'raw response bodies are not retained in the report');
});
