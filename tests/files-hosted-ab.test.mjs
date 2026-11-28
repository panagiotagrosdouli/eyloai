import test from 'node:test';
import assert from 'node:assert/strict';
import { runFilesHostedAcceptance } from '../scripts/files-hosted-ab-core.mjs';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const token = sub => ['e30', Buffer.from(JSON.stringify({ sub, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url'), 'test-signature'].join('.');
const environment = () => ({
  EYLO_STAGING_AB_ACK: 'DISPOSABLE_STAGING_ACCOUNTS_ONLY',
  EYLO_STAGING_FILES_ACK: 'DISPOSABLE_STAGING_FILES_ONLY',
  EYLO_STAGING_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co',
  EYLO_STAGING_PROJECT_REF: 'abcdefghijklmnopqrst',
  EYLO_STAGING_PUBLISHABLE_KEY: 'sb_publishable_synthetic_only',
  EYLO_STAGING_ACCESS_JWT_A: token(A), EYLO_STAGING_ACCESS_JWT_B: token(B),
});

// Synthetic service transport tests the runner, not hosted Supabase behavior.
function service({ corruptBytes = false, foreignStatus = 404, retainObjects = false, wrongIdentity = false, foreignDeleteError = false, allowForeignUpload = false } = {}) {
  const files = new Map(), versions = new Map(), objects = new Map();
  let writes = 0;
  const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
  async function fetchImpl(raw, options) {
    const url = new URL(raw), path = url.pathname;
    assert.equal(options.redirect, 'error');
    assert.equal(url.origin, environment().EYLO_STAGING_SUPABASE_URL);
    const user = JSON.parse(Buffer.from(options.headers.Authorization.split('.')[1], 'base64url').toString()).sub;
    const method = options.method;
    if (method !== 'GET') writes++;
    if (path === '/auth/v1/user') return json({ id: wrongIdentity ? B : user });
    if (path.startsWith('/storage/v1/object/')) {
      if (method === 'DELETE') {
        if (foreignDeleteError && JSON.parse(options.body).prefixes.some(p => !p.startsWith(user + '/'))) return json({}, 500);
        for (const p of JSON.parse(options.body).prefixes) if (!retainObjects && p.startsWith(user + '/')) objects.delete(p);
        return json([]);
      }
      const p = path.replace(/^\/storage\/v1\/object\/(?:authenticated\/)?eylo-files\//, '');
      if (method === 'POST') {
        if (!allowForeignUpload && !p.startsWith(user + '/')) return json({}, 403);
        objects.set(p, options.body); return json({ Key: p });
      }
      if (!p.startsWith(user + '/') || !objects.has(p)) return json({ error: 'not found' }, p.startsWith(user + '/') ? 404 : foreignStatus);
      return new Response(corruptBytes ? 'wrong bytes' : objects.get(p), { headers: { 'Content-Type': 'text/plain' } });
    }
    const isVersion = path.endsWith('eylo_file_versions');
    const data = options.body ? JSON.parse(options.body) : null;
    if (method === 'POST') {
      if (isVersion && files.get(data.file_id)?.user_id !== user) return json({}, 403);
      (isVersion ? versions : files).set(data.id, data);
      return json([data], 201);
    }
    const id = (url.searchParams.get(isVersion ? 'file_id' : 'id') || '').replace('eq.', '');
    const values = [...(isVersion ? versions : files).values()].filter(row => (isVersion ? row.file_id : row.id) === id && row.user_id === user);
    if (method === 'PATCH') for (const row of values) Object.assign(row, data);
    if (method === 'DELETE') for (const row of values) {
      files.delete(row.id);
      for (const [key, version] of versions) if (version.file_id === row.id) versions.delete(key);
    }
    return json(values);
  }
  return { fetchImpl, files, versions, objects, writes: () => writes };
}

test('Files staging guards refuse production and missing consent before any network', async () => {
  let calls = 0;
  const fetchImpl = () => { calls++; throw new Error('must not run'); };
  const env = environment();
  env.EYLO_STAGING_SUPABASE_URL = 'https://kbzjngpzxpniaumlupaa.supabase.co';
  env.EYLO_STAGING_PROJECT_REF = 'kbzjngpzxpniaumlupaa';
  await assert.rejects(runFilesHostedAcceptance(env, { fetchImpl }), /production/);
  const missing = environment(); delete missing.EYLO_STAGING_FILES_ACK;
  await assert.rejects(runFilesHostedAcceptance(missing, { fetchImpl }), /acknowledgement/);
  assert.equal(calls, 0);
});

test('Files runner requires both real identity responses before writes', async () => {
  const fixture = service({ wrongIdentity: true });
  await assert.rejects(runFilesHostedAcceptance(environment(), fixture), /hosted identity/);
  assert.equal(fixture.writes(), 0);
});

test('Files runner exercises two versions, exact bytes, both-owner denial and confirmed cleanup', async () => {
  const fixture = service();
  const result = await runFilesHostedAcceptance(environment(), fixture);
  assert.equal(result.passed, true);
  assert.equal(result.production_tested, false);
  assert.equal(fixture.files.size + fixture.versions.size + fixture.objects.size, 0);
});

test('Corrupted bytes fail acceptance and still clean up generated records', async () => {
  const fixture = service({ corruptBytes: true });
  await assert.rejects(runFilesHostedAcceptance(environment(), fixture), /bytes preserved/);
  assert.equal(fixture.files.size + fixture.versions.size + fixture.objects.size, 0);
});

test('A backend500 cannot count as foreign-access denial', async () => {
  const fixture = service({ foreignStatus: 500 });
  await assert.rejects(runFilesHostedAcceptance(environment(), fixture), /download denied/);
  assert.equal(fixture.files.size + fixture.versions.size + fixture.objects.size, 0);
});

test('Successful delete status without deleted bytes fails cleanup acceptance', async () => {
  const fixture = service({ retainObjects: true });
  await assert.rejects(runFilesHostedAcceptance(environment(), fixture), /cleanup incomplete/);
  assert.ok(fixture.objects.size > 0);
});

test('A foreign Storage delete500 is not mistaken for authorization success', async () => {
  const fixture = service({ foreignDeleteError: true });
  await assert.rejects(runFilesHostedAcceptance(environment(), fixture), /authorization boundary/);
  assert.equal(fixture.files.size + fixture.versions.size + fixture.objects.size, 0);
});

test('Foreign namespace uploads fail acceptance and the generated probe is cleaned', async () => {
  const fixture = service({ allowForeignUpload: true });
  await assert.rejects(runFilesHostedAcceptance(environment(), fixture), /namespace upload denied/);
  assert.equal(fixture.files.size + fixture.versions.size + fixture.objects.size, 0);
});
