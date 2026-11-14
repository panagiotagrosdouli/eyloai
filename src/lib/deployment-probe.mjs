// Public GET probes only: identity/configuration evidence, never authorization
// for hosted writes, migrations, live payments or a production release.
const SHA = /^[a-f0-9]{40}$/i;
const CAPABILITIES = ['ai', 'contact', 'billing', 'scheduled_monitoring', 'institution_analytics'];
const DISCOVERY_PATH = '/api/discovery?provider=openalex_works&q=climate%20adaptation&limit=1';
const DISCOVERY_ERROR_CODES = new Set(['DISCOVERY_RATE_LIMIT_UNAVAILABLE', 'DISCOVERY_RATE_LIMITED', 'SOURCE_RESPONSE_TOO_LARGE']);
async function jsonBody(response) {
  if (!/application\/json\b/i.test(response.headers.get('content-type') || '')) {
    await response.body?.cancel().catch(() => {});
    throw new Error('Expected JSON; a successful HTML SPA fallback is not an API response.');
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Response body unavailable.');
  const decoder = new TextDecoder(); let size = 0; let text = '';
  try {
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 65536) throw new Error('Public probe response exceeds the 64 KiB budget.');
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    let value;
    try { value = JSON.parse(text); } catch { throw new Error('Server did not return valid JSON.'); }
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a JSON object.');
    return value;
  } finally { await reader.cancel().catch(() => {}); }
}
export async function probeReleaseTarget({ baseUrl, expectedCommit, fetcher = fetch }) {
  const base = new URL(baseUrl);
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || (base.pathname !== '/' && base.pathname !== '')) throw new Error('Use a public HTTPS origin without credentials, paths or query parameters.');
  if (!SHA.test(expectedCommit || '')) throw new Error('An exact reviewed commit is required.');
  const paths = ['/release.json', '/api/deployment-status', '/api/capabilities', DISCOVERY_PATH];
  const reads = await Promise.all(paths.map(async path => {
    let status = null;
    try {
      const response = await fetcher(new URL(path, base), { headers: { accept: 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(15000) });
      status = response.status;
      if (response.url && new URL(response.url).origin !== base.origin) throw new Error('Cross-origin redirect cannot establish target identity.');
      if (!response.ok) {
        let code = '';
        if (path === DISCOVERY_PATH) {
          try { const body = await jsonBody(response); if (DISCOVERY_ERROR_CODES.has(body.code)) code = ` (${body.code})`; }
          catch { /* Do not reflect raw provider errors or HTML in reports. */ }
        } else await response.body?.cancel().catch(() => {});
        throw new Error(`Public endpoint HTTP ${response.status}${code}.`);
      }
      return { path, status: response.status, value: await jsonBody(response), error: null };
    } catch (error) { return { path, status, value: null, error: error?.name === 'TimeoutError' ? 'Public probe timed out.' : String(error?.message || 'Public endpoint unavailable.') }; }
  }));
  const [manifest, deployment, capabilities, discovery] = reads;
  const issues = reads.filter(read => read.error).map(read => `${read.path}: ${read.error}`);
  const manifestSha = typeof manifest.value?.git_commit === 'string' && SHA.test(manifest.value.git_commit) ? manifest.value.git_commit : null;
  const deploymentSha = typeof deployment.value?.deployment_sha === 'string' && SHA.test(deployment.value.deployment_sha) ? deployment.value.deployment_sha : null;
  const identityVerified = manifestSha === expectedCommit && deploymentSha === expectedCommit && deployment.value?.provenance_verified === true;
  if (!identityVerified) issues.push('Browser manifest and server deployment provenance do not establish the reviewed commit.');
  const flags = Object.fromEntries(CAPABILITIES.map(key => [key, typeof capabilities.value?.[key] === 'boolean' ? capabilities.value[key] : null]));
  if (Object.values(flags).some(value => value === null)) issues.push('Capabilities response does not match the public boolean contract.');
  for (const key of ['ai', 'contact', 'billing']) if (flags[key] !== true) issues.push(`${key} is not reported configured; real provider acceptance is still required even when configured.`);
  const discoveryAvailable = !discovery.error && Array.isArray(discovery.value?.results)
    && discovery.value.results.some(record => typeof record?.id === 'string' && record.id.length > 0
      && typeof record.title === 'string' && record.title.trim().length > 0);
  if (!discoveryAvailable && !discovery.error) issues.push('Discovery did not return a scholarly record for the public smoke query.');
  return { schema_version: 1, scope: 'public-readonly', target_origin: base.origin, expected_commit: expectedCommit, observed_manifest_sha: manifestSha, observed_deployment_sha: deploymentSha,
    identity_verified: identityVerified, configured_capabilities: flags, discovery_available: discoveryAvailable, decision: issues.length ? 'PROBE_FAILED' : 'PROBE_PASSED',
    market_readiness_proven: false, production_authorized: false,
    note: 'Public GET identity/configuration and one scholarly smoke query only. The query consumes normal discovery quota. This does not verify project ownership, Auth, RLS, Storage, scientific relevance, legal acceptance or authorize any write.',
    endpoints: reads.map(({ path, status, error }) => ({ path, status, error })), issues };
}
