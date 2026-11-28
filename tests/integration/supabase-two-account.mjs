import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { WORKSPACE_EXPORT_TABLES } from '../../src/lib/workspace-export.mjs';
import systemHandler from '../../api/system.js';
import eyraHandler from '../../api/eyra.js';

const url = process.env.SUPABASE_URL;
const publicKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
assert.ok(url && publicKey && serviceKey, 'isolated local Supabase configuration required');
assert.match(url, /^http:\/\/127\.0\.0\.1:54321$/, 'refuse any non-local Supabase target');

const authOptions = { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } };
const admin = createClient(url, serviceKey, authOptions);
const createdUserIds = [];
const objects = new Set();
const quotaSubjects = new Set();
const clients = new Map();

for (const name of [
  'OPENAI_API_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRO_PRICE_ID', 'STRIPE_FOUNDER_PRICE_ID', 'LIVEKIT_API_SECRET',
]) delete process.env[name];

function userClient() {
  return createClient(url, publicKey, authOptions);
}

function responseRecorder() {
  return {
    headers: {},
    statusCode: 200,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
    end() { this.writableEnded = true; return this; },
  };
}

async function createDisposableAccount() {
  const email = `eylo-ci-${randomUUID()}@example.invalid`;
  const password = `A9!${randomUUID()}z`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  assert.ifError(error);
  assert.ok(data.user?.id, 'Auth service must create a disposable account');
  createdUserIds.push(data.user.id);
  const client = userClient();
  const signedIn = await client.auth.signInWithPassword({ email, password });
  assert.ifError(signedIn.error);
  assert.equal(signedIn.data.user?.id, data.user.id, 'password sign-in must resolve the created Auth identity');
  assert.ok(signedIn.data.session?.access_token, 'Auth service must issue an access token');
  return { client, id: data.user.id, email, password };
}

try {
  const { data: buckets, error: bucketsError } = await admin.storage.listBuckets();
  assert.ifError(bucketsError);
  assert.ok(buckets.some(bucket => bucket.id === 'eylo-files' && bucket.public === false), 'private EYLO bucket must exist in the live Storage service');

  const accountA = await createDisposableAccount();
  const accountB = await createDisposableAccount();
  clients.set(accountA.id, accountA.client);
  clients.set(accountB.id, accountB.client);
  assert.notEqual(accountA.id, accountB.id, 'Auth must issue distinct account identities');

  const capabilityResponse = responseRecorder();
  await systemHandler({ method: 'GET', query: { endpoint: 'capabilities' }, headers: {} }, capabilityResponse);
  assert.equal(capabilityResponse.statusCode, 200);
  assert.equal(capabilityResponse.payload?.ai, false, 'provider availability must report AI unavailable without an approved key');
  const session = await accountA.client.auth.getSession();
  assert.ifError(session.error);
  const eyraResponse = responseRecorder();
  await eyraHandler({
    method: 'POST',
    headers: { authorization: `Bearer ${session.data.session.access_token}` },
    body: { prompt: 'Disposable provider availability check; do not generate an answer.' },
  }, eyraResponse);
  assert.equal(eyraResponse.statusCode, 503, 'EYRA must fail closed when its AI provider credential is absent');
  assert.equal(eyraResponse.payload?.code, 'OPENAI_NOT_CONFIGURED');
  assert.equal(eyraResponse.payload?.text, undefined, 'EYRA must never return a fabricated answer');

  // This table is the app's canonical JSON workspace persistence boundary.
  const projectData = { title: 'Disposable integration project', workflow_marker: `ci-${randomUUID()}` };
  const projectInsert = await accountA.client.from('projects')
    .insert({ user_id: accountA.id, data: projectData }).select('id,data').single();
  assert.ifError(projectInsert.error);
  const projectId = projectInsert.data.id;
  const projectB = await accountB.client.from('projects')
    .insert({ user_id: accountB.id, data: { title: 'Second disposable account project' } }).select('id').single();
  assert.ifError(projectB.error);

  const evidenceInsert = await accountA.client.from('saved_papers')
    .insert({ user_id: accountA.id, data: { title: 'CI evidence fixture; not a publication', source_id: `test-${randomUUID()}` } })
    .select('id,data').single();
  assert.ifError(evidenceInsert.error);
  const evidenceId = evidenceInsert.data.id;

  const filePath = `${accountA.id}/${randomUUID()}.txt`;
  const markerText = 'EYLO disposable Storage integration marker';
  const byteSize = Buffer.byteLength(markerText);
  const fileInsert = await accountA.client.from('eylo_files').insert({
    user_id: accountA.id,
    project_id: projectId,
    name: 'disposable-evidence.txt',
    description: 'CI-only metadata; not research evidence',
    mime_type: 'text/plain',
    size_bytes: byteSize,
  }).select('id').single();
  assert.ifError(fileInsert.error);
  const fileVersionInsert = await accountA.client.from('eylo_file_versions').insert({
    file_id: fileInsert.data.id,
    user_id: accountA.id,
    version_number: 1,
    storage_path: filePath,
    mime_type: 'text/plain',
    size_bytes: byteSize,
  }).select('id').single();
  assert.ifError(fileVersionInsert.error);

  // Persist a user-authored turn, without creating or claiming an AI response.
  const conversationInsert = await accountA.client.from('eyra_conversations')
    .insert({ user_id: accountA.id, title: 'Disposable acceptance conversation' }).select('id').single();
  assert.ifError(conversationInsert.error);
  const conversationId = conversationInsert.data.id;
  const messageInsert = await accountA.client.from('eyra_messages')
    .insert({
      user_id: accountA.id,
      conversation_id: conversationId,
      sequence_number: 1,
      role: 'user',
      content: { text: 'Disposable test prompt for persistence only.' },
    }).select('id').single();
  assert.ifError(messageInsert.error);

  const projectReadA = await accountA.client.from('projects').select('id,data').eq('id', projectId);
  assert.ifError(projectReadA.error);
  assert.equal(projectReadA.data.length, 1, 'owner must read the persisted project');
  assert.deepEqual(projectReadA.data[0].data, projectData);

  const projectReadB = await accountB.client.from('projects').select('id').eq('id', projectId);
  assert.ifError(projectReadB.error);
  assert.deepEqual(projectReadB.data, [], 'foreign account must not read the project');
  const ownerReadB = await accountB.client.from('projects').select('id').eq('id', projectB.data.id);
  assert.ifError(ownerReadB.error);
  assert.equal(ownerReadB.data.length, 1, 'second account must read its own project');
  const foreignReadBProject = await accountA.client.from('projects').select('id').eq('id', projectB.data.id);
  assert.ifError(foreignReadBProject.error);
  assert.deepEqual(foreignReadBProject.data, [], 'first account must not read the second account project');

  const forgedInsert = await accountB.client.from('projects')
    .insert({ user_id: accountA.id, data: { title: 'forged owner attempt' } }).select('id');
  assert.ok(forgedInsert.error, 'foreign owner assignment must be rejected by RLS');

  const foreignUpdate = await accountB.client.from('projects')
    .update({ data: { title: 'unauthorized update' } }).eq('id', projectId).select('id');
  assert.ifError(foreignUpdate.error);
  assert.deepEqual(foreignUpdate.data, [], 'foreign account must not update the project');
  const foreignDelete = await accountB.client.from('projects').delete().eq('id', projectId).select('id');
  assert.ifError(foreignDelete.error);
  assert.deepEqual(foreignDelete.data, [], 'foreign account must not delete the project');

  const foreignEvidence = await accountB.client.from('saved_papers').select('id').eq('id', evidenceId);
  assert.ifError(foreignEvidence.error);
  assert.deepEqual(foreignEvidence.data, [], 'foreign account must not read another account evidence');
  const foreignConversation = await accountB.client.from('eyra_conversations').select('id').eq('id', conversationId);
  assert.ifError(foreignConversation.error);
  assert.deepEqual(foreignConversation.data, [], 'foreign account must not read another account EYRA history');
  const foreignMessage = await accountB.client.from('eyra_messages').select('id').eq('id', messageInsert.data.id);
  assert.ifError(foreignMessage.error);
  assert.deepEqual(foreignMessage.data, [], 'foreign account must not read another account EYRA messages');
  const foreignFile = await accountB.client.from('eylo_files').select('id').eq('id', fileInsert.data.id);
  assert.ifError(foreignFile.error);
  assert.deepEqual(foreignFile.data, [], 'foreign account must not read another account file metadata');
  const foreignFileVersion = await accountB.client.from('eylo_file_versions').select('id').eq('id', fileVersionInsert.data.id);
  assert.ifError(foreignFileVersion.error);
  assert.deepEqual(foreignFileVersion.data, [], 'foreign account must not read another account file versions');

  const objectPath = filePath;
  objects.add(objectPath);
  const fileBytes = new Blob([markerText], { type: 'text/plain' });
  const upload = await accountA.client.storage.from('eylo-files').upload(objectPath, fileBytes, {
    contentType: 'text/plain',
    upsert: false,
  });
  assert.ifError(upload.error);
  const ownerDownload = await accountA.client.storage.from('eylo-files').download(objectPath);
  assert.ifError(ownerDownload.error);
  assert.match(await ownerDownload.data.text(), /disposable Storage integration marker/);
  const foreignDownload = await accountB.client.storage.from('eylo-files').download(objectPath);
  assert.ok(foreignDownload.error, 'foreign account must not download another account Storage object');
  await accountB.client.storage.from('eylo-files').remove([objectPath]);
  const afterForeignDelete = await accountA.client.storage.from('eylo-files').download(objectPath);
  assert.ifError(afterForeignDelete.error);

  // Ensure every table consumed by the workspace export has a real PostgREST
  // relation and authenticated read grant in this freshly migrated stack.
  for (const table of WORKSPACE_EXPORT_TABLES) {
    const { error } = await accountA.client.from(table).select('user_id', { head: true, count: 'exact' }).limit(1);
    assert.ifError(error, `workspace table must exist and be queryable: ${table}`);
  }
  for (const [table, column] of [['profiles', 'user_id'], ['meeting_participants', 'id'], ['eyra_agent_runs', 'id'], ['eyra_agent_actions', 'id']]) {
    const { error } = await accountA.client.from(table).select(column, { head: true, count: 'exact' }).limit(1);
    assert.ifError(error, `authenticated application table must exist: ${table}`);
  }
  for (const [table, column] of [['billing_entitlements', 'user_id'], ['stripe_webhook_events', 'event_id'], ['eyra_usage_actions', 'action_id']]) {
    const { error } = await admin.from(table).select(column, { head: true, count: 'exact' }).limit(1);
    assert.ifError(error, `server-only application table must exist: ${table}`);
  }
  const quotaSubject = createHash('sha256').update(`eylo-disposable-${randomUUID()}`).digest('hex');
  quotaSubjects.add(quotaSubject);
  const firstQuota = await admin.rpc('consume_discovery_rate_limit', {
    p_subject_hash: quotaSubject, p_limit: 1, p_window_seconds: 600,
  });
  assert.ifError(firstQuota.error);
  assert.equal(firstQuota.data?.[0]?.allowed, true, 'first shared provider quota request must be allowed');
  const secondQuota = await admin.rpc('consume_discovery_rate_limit', {
    p_subject_hash: quotaSubject, p_limit: 1, p_window_seconds: 600,
  });
  assert.ifError(secondQuota.error);
  assert.equal(secondQuota.data?.[0]?.allowed, false, 'atomic quota must reject the next request at its configured limit');

  // Simulate a fresh browser session and verify durable workspace/evidence/EYRA
  // state from Auth and PostgREST rather than in-memory or mocked responses.
  await accountA.client.auth.signOut();
  const freshSession = userClient();
  const signedInAgain = await freshSession.auth.signInWithPassword({ email: accountA.email, password: accountA.password });
  assert.ifError(signedInAgain.error);
  assert.equal(signedInAgain.data.user?.id, accountA.id, 'fresh Auth session must restore the same account identity');
  const restoredProject = await freshSession.from('projects').select('id,data').eq('id', projectId).single();
  assert.ifError(restoredProject.error);
  assert.deepEqual(restoredProject.data.data, projectData, 'project must survive a fresh Auth session');
  const restoredEvidence = await freshSession.from('saved_papers').select('id').eq('id', evidenceId).single();
  assert.ifError(restoredEvidence.error);
  const restoredConversation = await freshSession.from('eyra_conversations').select('id').eq('id', conversationId).single();
  assert.ifError(restoredConversation.error);
  const restoredMessage = await freshSession.from('eyra_messages').select('id').eq('id', messageInsert.data.id).single();
  assert.ifError(restoredMessage.error);
  const restoredFile = await freshSession.from('eylo_files').select('id,size_bytes').eq('id', fileInsert.data.id).single();
  assert.ifError(restoredFile.error);
  assert.equal(restoredFile.data.size_bytes, byteSize, 'file metadata must be durable and match the uploaded object bytes');
  const restoredFileVersion = await freshSession.from('eylo_file_versions').select('id,storage_path,size_bytes')
    .eq('id', fileVersionInsert.data.id).single();
  assert.ifError(restoredFileVersion.error);
  assert.equal(restoredFileVersion.data.storage_path, filePath);
  assert.equal(restoredFileVersion.data.size_bytes, byteSize);
  const restoredBytes = await freshSession.storage.from('eylo-files').download(filePath);
  assert.ifError(restoredBytes.error);
  assert.equal(await restoredBytes.data.text(), markerText, 'uploaded Storage bytes must survive a fresh Auth session');
  const ownerDelete = await freshSession.storage.from('eylo-files').remove([objectPath]);
  assert.ifError(ownerDelete.error);
  objects.delete(objectPath);
  await freshSession.auth.signOut();

  console.log(`PASS: local Supabase Auth issued two accounts; PostgREST verified ${WORKSPACE_EXPORT_TABLES.length} workspace tables; owner-only project/evidence/EYRA persistence and Storage upload/download/delete passed.`);
} finally {
  for (const subject of quotaSubjects) await admin.from('discovery_rate_limits').delete().eq('subject_hash', subject);
  for (const [ownerId, client] of clients) {
    const paths = [...objects].filter(path => path.startsWith(`${ownerId}/`));
    if (paths.length) await client.storage.from('eylo-files').remove(paths);
    await client.auth.signOut().catch(() => {});
  }
  for (const id of createdUserIds) await admin.auth.admin.deleteUser(id).catch(() => {});
}
