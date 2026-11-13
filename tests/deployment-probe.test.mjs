import test from 'node:test';
import assert from 'node:assert/strict';
import { probeReleaseTarget } from '../src/lib/deployment-probe.mjs';
const commit = 'a'.repeat(40);
const flags = { ai: true, contact: true, billing: true, scheduled_monitoring: false, institution_analytics: false };
function fetcher(overrides = {}) {
  return async (url, options) => {
    assert.equal(options.method, undefined, 'probe only performs public GET requests');
    assert.equal(options.headers.authorization, undefined);
    if (overrides[url.pathname]) return overrides[url.pathname]();
    return Response.json(url.pathname === '/release.json' ? { git_commit: commit } : url.pathname === '/api/deployment-status' ? { deployment_sha: commit, provenance_verified: true, environment: 'preview' } : flags);
  };
}
test('matching public provenance only passes a read-only probe, never market readiness or production authorization', async () => {
  const result = await probeReleaseTarget({ baseUrl: 'https://preview.example.org', expectedCommit: commit, fetcher: fetcher() });
  assert.equal(result.decision, 'PROBE_PASSED');
  assert.equal(result.market_readiness_proven, false);
  assert.equal(result.production_authorized, false);
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
