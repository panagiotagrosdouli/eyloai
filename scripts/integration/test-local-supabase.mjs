import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { collectWorkspaceExport, fetchWorkspaceExportPage } from '../../src/lib/workspace-export.mjs';
import systemHandler from '../../api/system.js';

const baseUrl = process.env.LOCAL_SUPABASE_URL;
const publishableKey = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.LOCAL_SUPABASE_SECRET_KEY;
const dbUrl = process.env.LOCAL_SUPABASE_DB_URL;
if (!baseUrl || !publishableKey || !secretKey || !dbUrl) throw new Error('Local Supabase environment is incomplete.');
const local = new URL(baseUrl);
if (local.protocol !== 'http:' || !['127.0.0.1', 'localhost', '::1'].includes(local.hostname)) {
  throw new Error('Acceptance tests are restricted to loopback Supabase endpoints.');
}
for (const key of ['SUPABASE_ACCESS_TOKEN', 'SUPABASE_PROJECT_REF', 'SUPABASE_DB_PASSWORD']) {
  if (process.env[key]) throw new Error(`Remote Supabase variable ${key} is forbidden in this test.`);
}
const manifest = JSON.parse(await (await import('node:fs/promises')).readFile(`${process.env.LOCAL_SUPABASE_PROJECT_DIR}/reviewed-migration-replay.json`, 'utf8'));
assert.equal(manifest.length, 31, 'reviewed canonical migration count changed');

// API-handler calls use a fake staging-shaped host only so the existing staging guard is exercised.
// All network access, including that alias, is rewritten to the local stack; all other hosts are rejected.
const fakeRef = 'eyloteststagingabcde';
assert.equal(fakeRef.length, 20);
assert.match(fakeRef, /^[a-z]{20}$/);
process.env.EYLO_STAGING_SUPABASE_REF = fakeRef;
process.env.EYLO_STAGING_CONFIRMED_REF = fakeRef;
process.env.VITE_SUPABASE_URL = `https://${fakeRef}.supabase.co`;
process.env.VITE_SUPABASE_ANON_KEY = publishableKey;
process.env.SUPABASE_SERVICE_ROLE_KEY = secretKey;
process.env.EYLO_ENVIRONMENT = 'staging';
process.env.EYLO_PRIVACY_DELETION_ENABLED = 'true';
process.env.EYLO_PRIVACY_WORKER_SECRET = 'local-only-deletion-worker-secret-32-bytes-min';
delete process.env.STRIPE_SECRET_KEY;
delete process.env.STRIPE_WEBHOOK_SECRET;
delete process.env.VERCEL_ENV;

const originalFetch = globalThis.fetch;
let rewrittenApiCalls = 0;
globalThis.fetch = (input, init) => {
  const requestUrl = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  if (requestUrl.hostname === `${fakeRef}.supabase.co`) {
    requestUrl.protocol = 'http:';
    requestUrl.hostname = local.hostname;
    requestUrl.port = local.port;
    rewrittenApiCalls++;
  } else if (requestUrl.protocol !== 'http:' || !['127.0.0.1', 'localhost', '::1'].includes(requestUrl.hostname)) {
    throw new Error(`Blocked non-local network request to ${requestUrl.hostname}.`);
  } else {
    // Preserve the original local Fetch input/Request so native header and body
    // semantics stay identical to the Supabase SDK's successful calls.
    return originalFetch(input, init);
  }
  if (input instanceof Request) return originalFetch(new Request(requestUrl, input), init);
  return originalFetch(requestUrl, init);
};

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(baseUrl, secretKey, clientOptions);
const makeClient = () => createClient(baseUrl, publishableKey, clientOptions);
const userA = makeClient();
const userB = makeClient();
const passA = `Local-A-${randomUUID()}-Aa9!`;
const passB = `Local-B-${randomUUID()}-Bb8!`;
const emailA = `local-a-${randomUUID()}@example.test`;
const emailB = `local-b-${randomUUID()}@example.test`;
let idA;
let idB;
let objectA;
let objectB;

function checkResult(label, result) {
  if (result.error) throw new Error(`${label}: ${result.error.message || result.error.code || 'request failed'}`);
  return result.data;
}
function mockResponse() {
  return {
    code: 200, headers: {}, body: null,
    setHeader(key, value) { this.headers[key.toLowerCase()] = value; },
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
    end() { return this; },
  };
}
async function callDeletion(method, body, accessToken) {
  const response = mockResponse();
  await systemHandler({
    method, query: { endpoint: 'account-deletion' }, body,
    headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
  }, response);
  return response;
}

try {
  // Confirm service wiring is local and the complete stack is reachable.
  const [authHealth, restHealth, storageBuckets] = await Promise.all([
    fetch(`${baseUrl}/auth/v1/health`, { headers: { apikey: publishableKey } }),
    fetch(`${baseUrl}/rest/v1/`, { headers: { apikey: publishableKey } }),
    admin.storage.listBuckets(),
  ]);
  assert.ok(authHealth.ok, `Auth health status ${authHealth.status}`);
  assert.ok(restHealth.ok, `PostgREST status ${restHealth.status}`);
  const buckets = checkResult('Storage API health', storageBuckets);
  assert.ok(buckets.some(bucket => bucket.name === 'eylo-files'), 'Storage API must expose the private application bucket to its service client');
  console.log('PASS: local Supabase Auth, PostgREST and Storage endpoints are live on loopback.');

  const coordinationClients = Array.from({ length: 8 }, () => createClient(baseUrl, secretKey, clientOptions));
  const sharedQuotaHash = createHash('sha256').update(randomUUID()).digest('hex');
  const sharedQuotas = await Promise.all(coordinationClients.map(client => client.rpc('consume_discovery_rate_limit', {
    p_subject_hash: sharedQuotaHash, p_limit: 3, p_window_seconds: 600,
  })));
  const quotaResults = sharedQuotas.map((result, index) => checkResult(`Distributed quota instance ${index + 1}`, result)[0]);
  assert.equal(quotaResults.filter(result => result.allowed).length, 3, 'all simulated instances must share one atomic quota');
  assert.equal(quotaResults.filter(result => !result.allowed).length, 5);

  const distinctCacheKeys = coordinationClients.map((_, index) => createHash('sha256').update(`instance-${index}-${randomUUID()}`).digest('hex'));
  const reservations = await Promise.all(coordinationClients.map((client, index) => client.rpc('reserve_scholarly_provider_slot', {
    p_provider: 'europe_pmc', p_cache_key: distinctCacheKeys[index], p_min_interval_ms: 0, p_max_concurrent: 1, p_lease_seconds: 45,
  })));
  const reservationResults = reservations.map((result, index) => checkResult(`Provider lease instance ${index + 1}`, result)[0]);
  const acquired = reservationResults.filter(result => result.allowed);
  assert.equal(acquired.length, 1, 'independent instances must serialize a provider slot atomically');
  assert.equal(reservationResults.filter(result => result.status === 'concurrency_limited').length, 7);
  checkResult('Provider lease release', await admin.rpc('finish_scholarly_provider_request', {
    p_provider: 'europe_pmc', p_lease_id: acquired[0].lease_id, p_status: 200, p_retry_after_seconds: 0,
  }));
  const dedupeKey = createHash('sha256').update(randomUUID()).digest('hex');
  const leaderLease = checkResult('Provider deduplication leader', await coordinationClients[0].rpc('reserve_scholarly_provider_slot', {
    p_provider: 'arxiv', p_cache_key: dedupeKey, p_min_interval_ms: 0, p_max_concurrent: 1, p_lease_seconds: 45,
  }))[0];
  assert.equal(leaderLease.allowed, true);
  const duplicateLease = checkResult('Provider deduplication follower', await coordinationClients[1].rpc('reserve_scholarly_provider_slot', {
    p_provider: 'arxiv', p_cache_key: dedupeKey, p_min_interval_ms: 0, p_max_concurrent: 1, p_lease_seconds: 45,
  }))[0];
  assert.equal(duplicateLease.allowed, false);
  assert.equal(duplicateLease.status, 'deduplicated');
  checkResult('Deduplicated provider cache write', await admin.rpc('write_scholarly_provider_cache', {
    p_cache_key: dedupeKey, p_provider: 'arxiv', p_body: '<feed/>', p_content_type: 'application/atom+xml', p_ttl_seconds: 60,
  }));
  checkResult('Deduplication leader lease release', await admin.rpc('finish_scholarly_provider_request', {
    p_provider: 'arxiv', p_lease_id: leaderLease.lease_id, p_status: 200, p_retry_after_seconds: 0,
  }));
  const limitedProvider = checkResult('Provider Retry-After lease', await admin.rpc('reserve_scholarly_provider_slot', {
    p_provider: 'crossref', p_cache_key: createHash('sha256').update(randomUUID()).digest('hex'), p_min_interval_ms: 0, p_max_concurrent: 1, p_lease_seconds: 45,
  }))[0];
  assert.equal(limitedProvider.allowed, true);
  checkResult('Provider 429 cooldown', await admin.rpc('finish_scholarly_provider_request', {
    p_provider: 'crossref', p_lease_id: limitedProvider.lease_id, p_status: 429, p_retry_after_seconds: 12,
  }));
  const cooldown = checkResult('Shared Retry-After cooldown read', await coordinationClients[0].rpc('reserve_scholarly_provider_slot', {
    p_provider: 'crossref', p_cache_key: createHash('sha256').update(randomUUID()).digest('hex'), p_min_interval_ms: 0, p_max_concurrent: 1, p_lease_seconds: 45,
  }))[0];
  assert.equal(cooldown.allowed, false);
  assert.equal(cooldown.status, 'cooldown');
  assert.ok(cooldown.retry_after_seconds >= 1 && cooldown.retry_after_seconds <= 12);
  const coordinationCacheKey = createHash('sha256').update(randomUUID()).digest('hex');
  checkResult('Shared provider cache write', await admin.rpc('write_scholarly_provider_cache', {
    p_cache_key: coordinationCacheKey, p_provider: 'europe_pmc', p_body: '{"synthetic":true}',
    p_content_type: 'application/json', p_ttl_seconds: 1,
  }));
  const sharedCache = checkResult('Shared provider cache read', await coordinationClients[0].rpc('read_scholarly_provider_cache', { p_cache_key: coordinationCacheKey }));
  assert.equal(sharedCache[0]?.body, '{"synthetic":true}');
  await new Promise(resolve => setTimeout(resolve, 1_100));
  const expiredCache = checkResult('Shared provider cache expiry', await coordinationClients[1].rpc('read_scholarly_provider_cache', { p_cache_key: coordinationCacheKey }));
  assert.deepEqual(expiredCache, []);
  console.log('PASS: eight independent serverless simulations share atomic quotas, provider leases and expiring cache entries.');

  // Signup creates two genuinely distinct Auth users; confirm them through the local admin API only if local email confirmation is enabled.
  const signupA = checkResult('Account A signup', await userA.auth.signUp({ email: emailA, password: passA }));
  const signupB = checkResult('Account B signup', await userB.auth.signUp({ email: emailB, password: passB }));
  idA = signupA.user?.id;
  idB = signupB.user?.id;
  assert.ok(idA && idB && idA !== idB, 'signup must create two distinct Auth identities');
  for (const signup of [signupA, signupB]) {
    if (!signup.session && signup.user?.id) checkResult('Local email confirmation', await admin.auth.admin.updateUserById(signup.user.id, { email_confirm: true }));
  }
  const loginA = checkResult('Account A login', await userA.auth.signInWithPassword({ email: emailA, password: passA }));
  const loginB = checkResult('Account B login', await userB.auth.signInWithPassword({ email: emailB, password: passB }));
  assert.equal(loginA.user.id, idA);
  assert.equal(loginB.user.id, idB);
  const refreshed = checkResult('Account A token refresh', await userA.auth.refreshSession());
  assert.equal(refreshed.user.id, idA);
  const restored = makeClient();
  checkResult('Restored session', await restored.auth.setSession({
    access_token: refreshed.session.access_token,
    refresh_token: refreshed.session.refresh_token,
  }));
  assert.equal(checkResult('Restored user', await restored.auth.getUser()).user.id, idA);
  checkResult('Account A logout', await restored.auth.signOut({ scope: 'local' }));
  assert.equal(checkResult('Logged-out session', await restored.auth.getSession()).session, null);
  assert.equal(checkResult('Account B remains signed in', await userB.auth.getUser()).user.id, idB);
  console.log('PASS: two-account signup, login, refresh, session restoration, logout and account switching.');

  const requiredTables = [
    'eyra_conversations', 'eyra_messages', 'eyra_agent_runs', 'eyra_agent_actions',
    'grant_applications', 'meeting_participants', 'eylo_directory', 'eylo_teams',
    'eylo_team_invites', 'eylo_team_members', 'eylo_connections', 'eylo_community_posts',
    'eylo_peer_submissions', 'eylo_peer_reviews', 'eylo_feedback', 'eylo_api_tokens',
    'eylo_api_token_events',
  ];
  for (const table of requiredTables) {
    checkResult(`Required owner-visible table ${table}`, await userA.from(table).select('*').limit(0));
  }
  console.log(`PASS: all ${requiredTables.length} required tables are available to an authenticated account through PostgREST.`);

  const projectA = checkResult('Account A project create', await userA.from('projects')
    .insert({ user_id: idA, data: { title: 'Synthetic Account A project', marker: 'only-a' } })
    .select('id,user_id,data').single());
  const projectB = checkResult('Account B project create', await userB.from('projects')
    .insert({ user_id: idB, data: { title: 'Synthetic Account B project', marker: 'only-b' } })
    .select('id,user_id,data').single());
  assert.equal(projectA.user_id, idA);
  assert.equal(projectB.user_id, idB);
  const hiddenProject = checkResult('Cross-account project read', await userB.from('projects').select('id').eq('id', projectA.id));
  assert.deepEqual(hiddenProject, []);
  const hiddenUpdate = checkResult('Cross-account project update', await userB.from('projects').update({ data: { title: 'forged' } }).eq('id', projectA.id).select('id'));
  assert.deepEqual(hiddenUpdate, []);
  const hiddenDelete = checkResult('Cross-account project delete', await userB.from('projects').delete().eq('id', projectA.id).select('id'));
  assert.deepEqual(hiddenDelete, []);
  assert.equal(checkResult('Owner project still persists', await userA.from('projects').select('id').eq('id', projectA.id).single()).id, projectA.id);
  console.log('PASS: PostgREST project persistence and cross-account read/update/delete isolation.');

  const tokenId = randomUUID();
  const tokenHash = createHash('sha256').update(randomUUID()).digest('hex');
  checkResult('Account A personal token creation', await userA.from('eylo_api_tokens').insert({
    id: tokenId, user_id: idA, name: 'Synthetic acceptance token', token_hash: tokenHash,
    project_ids: [projectA.id], expires_at: new Date(Date.now() + 86_400_000).toISOString(),
  }));
  let tokenEvents = checkResult('Account A token creation event', await userA.from('eylo_api_token_events')
    .select('id,token_id,token_name,action').eq('token_id', tokenId));
  assert.equal(tokenEvents.length, 1);
  assert.equal(tokenEvents[0].action, 'created');
  assert.equal(tokenEvents[0].token_name, 'Synthetic acceptance token');
  const foreignEvents = checkResult('Account B token events are private', await userB.from('eylo_api_token_events').select('id').eq('token_id', tokenId));
  assert.deepEqual(foreignEvents, []);
  const forgedEvent = await userB.from('eylo_api_token_events').insert({ user_id: idA, token_id: tokenId, token_name: 'Forged', action: 'created' });
  assert.ok(forgedEvent.error, 'clients cannot forge token audit rows');
  checkResult('Account A token revocation', await userA.from('eylo_api_tokens').update({ revoked_at: new Date().toISOString() }).eq('id', tokenId));
  tokenEvents = checkResult('Account A token revoke event', await userA.from('eylo_api_token_events')
    .select('action').eq('token_id', tokenId).order('created_at'));
  assert.deepEqual(tokenEvents.map(row => row.action), ['created', 'revoked']);
  console.log('PASS: token audit event creation, revocation, owner isolation and client write denial.');

  const conversationId = randomUUID();
  const conversation = checkResult('EYRA conversation persistence', await userA.rpc('save_eyra_conversation_snapshot', {
    p_title: 'Synthetic local acceptance',
    p_messages: [
      { role: 'user', text: 'Synthetic prompt for account A', sources: [] },
      { role: 'assistant', text: 'Synthetic persisted response', sources: [] },
    ],
    p_snapshot_id: conversationId,
  }));
  assert.equal((Array.isArray(conversation) ? conversation[0] : conversation).id, conversationId);
  const messages = checkResult('EYRA message persistence', await userA.from('eyra_messages').select('id,sequence_number,content').eq('conversation_id', conversationId).order('sequence_number'));
  assert.equal(messages.length, 2);
  assert.deepEqual(checkResult('Cross-account conversation read', await userB.from('eyra_conversations').select('id').eq('id', conversationId)), []);
  console.log('PASS: EYRA snapshot RPC persistence, ordered messages and cross-account conversation isolation.');

  objectA = `${idA}/acceptance-${randomUUID()}.txt`;
  objectB = `${idB}/acceptance-${randomUUID()}.txt`;
  checkResult('Account A storage upload', await userA.storage.from('eylo-files').upload(objectA, Buffer.from('synthetic A'), { contentType: 'text/plain' }));
  checkResult('Account B storage upload', await userB.storage.from('eylo-files').upload(objectB, Buffer.from('synthetic B'), { contentType: 'text/plain' }));
  const ownObject = checkResult('Account A storage read', await userA.storage.from('eylo-files').download(objectA));
  assert.equal(await ownObject.text(), 'synthetic A');
  const foreignObject = await userB.storage.from('eylo-files').download(objectA);
  assert.ok(foreignObject.error && !foreignObject.data, 'another account must not read the object');
  const forgedUpload = await userB.storage.from('eylo-files').upload(`${idA}/forged.txt`, Buffer.from('forged'), { contentType: 'text/plain' });
  assert.ok(forgedUpload.error, 'another account must not write under the owner prefix');
  console.log('PASS: real Storage upload/download and cross-account path isolation.');

  const exportA = await collectWorkspaceExport({
    userId: idA, email: emailA,
    fetchPage: (table, options) => fetchWorkspaceExportPage(userA, table, options),
  });
  const exportB = await collectWorkspaceExport({
    userId: idB, email: emailB,
    fetchPage: (table, options) => fetchWorkspaceExportPage(userB, table, options),
  });
  assert.equal(exportA.completeness, 'all-configured-collections-read');
  assert.ok(exportA.collections.projects.some(row => row.id === projectA.id));
  assert.ok(exportA.collections.eyra_conversations.some(row => row.id === conversationId));
  assert.equal(exportA.collections.eylo_api_token_events.filter(row => row.token_id === tokenId).length, 2);
  assert.ok(exportB.collections.projects.some(row => row.id === projectB.id));
  assert.equal(exportB.collections.projects.some(row => row.id === projectA.id), false);
  assert.equal(exportB.collections.eyra_conversations.some(row => row.id === conversationId), false);
  console.log('PASS: application workspace export is complete and remains owner-scoped for both accounts.');

  const deletionStatus = await callDeletion('GET');
  assert.equal(deletionStatus.code, 200);
  assert.equal(deletionStatus.body.available, true);
  const deletionLoginA = checkResult('Account A re-login for privacy deletion', await userA.auth.signInWithPassword({ email: emailA, password: passA }));
  assert.equal(deletionLoginA.user.id, idA);
  const authBeforeDeletion = await fetch(`${baseUrl}/auth/v1/user`, {
    headers: { apikey: publishableKey, authorization: `Bearer ${deletionLoginA.session.access_token}` },
  });
  const authError = authBeforeDeletion.ok ? null : await authBeforeDeletion.json().catch(() => ({}));
  assert.equal(authBeforeDeletion.status, 200, `refreshed account remains authenticated before deletion: ${authBeforeDeletion.status} ${JSON.stringify(authError).slice(0, 300)}`);
  const begin = await callDeletion('POST', { action: 'begin', confirmation: 'DELETE MY EYLO ACCOUNT', password: passA }, deletionLoginA.session.access_token);
  assert.equal(begin.code, 202, `deletion begin status ${begin.code}: ${begin.body?.error || 'unknown'}`);
  let completed = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    completed = await callDeletion('POST', { action: 'resume', receipt_token: begin.body.receipt_token });
    if (completed.code === 200 && completed.body.phase === 'complete') break;
    assert.equal(completed.code, 202, `deletion resume status ${completed.code}: ${completed.body?.error || 'unknown'}`);
  }
  assert.equal(completed?.code, 200);
  assert.equal(completed.body.phase, 'complete');
  const deletedUser = await admin.auth.admin.getUserById(idA);
  assert.ok(deletedUser.error, 'deleted Auth account must be absent');
  assert.deepEqual(checkResult('Deleted account project cleanup', await admin.from('projects').select('id').eq('user_id', idA)), []);
  assert.deepEqual(checkResult('Deleted account conversation cleanup', await admin.from('eyra_conversations').select('id').eq('user_id', idA)), []);
  assert.deepEqual(checkResult('Deleted account token audit cleanup', await admin.from('eylo_api_token_events').select('id').eq('user_id', idA)), []);
  assert.deepEqual(checkResult('Deleted account Storage cleanup', await admin.storage.from('eylo-files').list(idA)), []);
  assert.equal(checkResult('Other Auth account retained', await admin.auth.admin.getUserById(idB)).user.id, idB);
  assert.equal(checkResult('Other account project retained', await userB.from('projects').select('id').eq('id', projectB.id).single()).id, projectB.id);
  const remainingObject = checkResult('Other account Storage retained', await userB.storage.from('eylo-files').download(objectB));
  assert.equal(await remainingObject.text(), 'synthetic B');
  console.log('PASS: application privacy deletion reauthenticates, removes Storage and owner data, and preserves the other account.');
  assert.ok(rewrittenApiCalls >= 6, 'staging-guarded application API must have been forwarded only to the local Supabase stack');
  console.log('PASS: every application API network request was constrained to the local Supabase stack; no hosted project was linked.');
} finally {
  globalThis.fetch = originalFetch;
  await userA.auth.signOut({ scope: 'local' }).catch(() => {});
  await userB.auth.signOut({ scope: 'local' }).catch(() => {});
  if (idA) await admin.auth.admin.deleteUser(idA).catch(() => {});
  if (idB) await admin.auth.admin.deleteUser(idB).catch(() => {});
}
