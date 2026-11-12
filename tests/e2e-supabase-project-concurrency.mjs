#!/usr/bin/env node
/**
 * REAL two-session Supabase acceptance. Opt-in and staging-only.
 * Requires two independent sessions of the same test owner, a second distinct
 * test account for RLS denial, and explicit approval for temporary row writes.
 * Never call this against live EYLOAI, and never use service-role keys.
 */
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const env = process.env;
const urlText = env.EYLO_STAGING_SUPABASE_URL;
const ref = env.EYLO_STAGING_SUPABASE_REF;
const expected = ref ? `https://${ref}.supabase.co` : '';
if (env.EYLO_STAGING_ALLOW_EPHEMERAL_WRITES !== 'YES'
  || !urlText || !ref || urlText.replace(/\/$/, '') !== expected
  || ref === 'kbzjngpzxpniaumlupaa'
  || !/^[a-z]{20}$/.test(ref)
  || !env.EYLO_STAGING_SUPABASE_ANON_KEY
  || !env.EYLO_STAGING_TEST_OWNER_EMAIL || !env.EYLO_STAGING_TEST_OWNER_PASSWORD
  || !env.EYLO_STAGING_TEST_OUTSIDER_EMAIL || !env.EYLO_STAGING_TEST_OUTSIDER_PASSWORD) {
  throw new Error('Refusing concurrency writes. Provide a separately authorized Supabase STAGING ref, exact matching URL, anon key, disposable test accounts, and EYLO_STAGING_ALLOW_EPHEMERAL_WRITES=YES.');
}

const create = () => createClient(expected, env.EYLO_STAGING_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const ownerA = create(), ownerB = create(), outsider = create();

async function login(client, email, password) {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data?.user?.id) throw new Error('Staging account login failed.');
  return data.user.id;
}
function good(result, label) {
  if (result.error) throw new Error(label + ': ' + result.error.code);
  return result.data;
}
async function get(client, id) {
  return good(await client.from('projects').select('id,user_id,data,updated_date').eq('id', id).maybeSingle(), 'read');
}
async function write(client, row, data) {
  const result = await client.from('projects').update({ data })
    .eq('id', row.id).eq('user_id', row.user_id)
    .eq('updated_date', row.updated_date)
    .select('id,user_id,data,updated_date').maybeSingle();
  if (result.error) throw new Error('conditional update failed: ' + result.error.code);
  return result.data;
}

let createdId;
try {
  const a = await login(ownerA, env.EYLO_STAGING_TEST_OWNER_EMAIL, env.EYLO_STAGING_TEST_OWNER_PASSWORD);
  const b = await login(ownerB, env.EYLO_STAGING_TEST_OWNER_EMAIL, env.EYLO_STAGING_TEST_OWNER_PASSWORD);
  const other = await login(outsider, env.EYLO_STAGING_TEST_OUTSIDER_EMAIL, env.EYLO_STAGING_TEST_OUTSIDER_PASSWORD);
  assert.equal(a, b, 'Independent sessions must belong to same disposable owner');
  assert.notEqual(a, other, 'Outsider must be a different disposable account');

  const marker = 'eylo-concurrency-acceptance-' + crypto.randomUUID();
  const created = good(await ownerA.from('projects')
    .insert({ user_id: a, data: { title: marker, tasks: '- [ ] initial task', evidence_matrix: { annotations: {} } } })
    .select('id,user_id,data,updated_date').single(), 'create');
  createdId = created.id;

  assert.equal(await get(outsider, createdId), null, 'RLS must hide owner record from outsider');
  const forbidden = await outsider.from('projects').update({ data: { title: 'unauthorized' } })
    .eq('id', createdId).eq('user_id', a).select('id').maybeSingle();
  assert.equal(forbidden.data, null, 'RLS must prevent cross-user updates');
  assert.equal(await get(ownerA, createdId).then(r => r.data.title), marker);

  const initialA = await get(ownerA, createdId);
  const initialB = await get(ownerB, createdId);
  assert.equal(initialA.updated_date, initialB.updated_date);

  // Two tabs: A wins a task update, B must not overwrite it with stale evidence.
  const taskSave = await write(ownerA, initialA, { ...initialA.data, tasks: '- [x] initial task' });
  assert.ok(taskSave, 'First session task update should commit');
  assert.notEqual(taskSave.updated_date, initialA.updated_date,
    'projects.updated_date trigger must advance on a committed update');
  const staleEvidence = await write(ownerB, initialB, { ...initialB.data, evidence_matrix: { annotations: { result:'stale' } } });
  assert.equal(staleEvidence, null, 'A stale evidence update must NOT silently overwrite task changes');

  // Human-initiated reload/retry preserves newer task updates.
  const refreshed = await get(ownerB, createdId);
  assert.equal(refreshed.data.tasks, '- [x] initial task');
  const evidenceSave = await write(ownerB, refreshed, {
    ...refreshed.data, evidence_matrix: { annotations: { result: 'reviewed' } },
  });
  assert.ok(evidenceSave);
  assert.equal(evidenceSave.data.tasks, '- [x] initial task');

  // Slow EYRA started from an earlier version; a concurrent human edit wins.
  const analysisStart = await get(ownerA, createdId);
  const humanStart = await get(ownerB, createdId);
  const humanSave = await write(ownerB, humanStart, { ...humanStart.data, notes:'Human revised the protocol' });
  assert.ok(humanSave);
  const staleEyra = await write(ownerA, analysisStart, { ...analysisStart.data, eyra_analysis:'Simulated outdated AI output' });
  assert.equal(staleEyra, null, 'Late AI analysis cannot overwrite a human edit');
  const final = await get(ownerA, createdId);
  assert.equal(final.data.notes, 'Human revised the protocol');
  assert.equal(final.data.eyra_analysis, undefined);

  // Simulate an in-flight network failure without mutating data; retry from
  // the latest version as a separate explicit user action.
  let first = true;
  const flakyClient = createClient(expected, env.EYLO_STAGING_SUPABASE_ANON_KEY, {
    auth: { persistSession:false, autoRefreshToken:false, detectSessionInUrl:false },
    global: { fetch: async (input, init) => {
      if (first && init?.method === 'PATCH') { first = false; throw new Error('Simulated network interruption'); }
      return fetch(input, init);
    } },
  });
  await login(flakyClient, env.EYLO_STAGING_TEST_OWNER_EMAIL, env.EYLO_STAGING_TEST_OWNER_PASSWORD);
  const beforeFailure = await get(flakyClient, createdId);
  const failed = await flakyClient.from('projects').update({
    data: { ...beforeFailure.data, notes: 'Will retry' },
  }).eq('id', createdId).eq('user_id', a).eq('updated_date', beforeFailure.updated_date)
    .select('id').maybeSingle();
  assert.ok(failed.error, 'Injected network error must be observable');
  assert.equal((await get(ownerB, createdId)).data.notes, 'Human revised the protocol');
  const latest = await get(ownerB, createdId);
  const retried = await write(ownerB, latest, { ...latest.data, notes:'Will retry' });
  assert.ok(retried);
  assert.equal((await get(ownerA, createdId)).data.notes, 'Will retry');

  console.log('PASS: staging two-session CAS, updated_date trigger, task/evidence, late EYRA, RLS, network failure and retry.');
} finally {
  if (createdId) {
    const { data, error } = await ownerA.from('projects').delete()
      .eq('id', createdId).select('id').maybeSingle();
    if (error || data?.id !== createdId) {
      console.error('STAGING CLEANUP REQUIRED: disposable project could not be deleted (ID omitted).');
    }
  }
  await Promise.allSettled([ownerA.auth.signOut(), ownerB.auth.signOut(), outsider.auth.signOut()]);
}
