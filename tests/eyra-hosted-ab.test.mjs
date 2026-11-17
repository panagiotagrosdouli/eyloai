import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  validateEyraHostedStagingConfig, runEyraHostedStagingAcceptance,
} from '../scripts/eyra-hosted-ab-core.mjs';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const REF = 'abcdefghijklmnopqrst';
const token = (sub, role = 'authenticated') => [
  Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'),
  Buffer.from(JSON.stringify({ sub, role, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url'),
  'synthetic-signature',
].join('.');
const validEnv = () => ({
  EYLO_STAGING_AB_ACK: 'DISPOSABLE_STAGING_ACCOUNTS_ONLY',
  EYLO_STAGING_SUPABASE_URL: 'https://' + REF + '.supabase.co',
  EYLO_STAGING_PROJECT_REF: REF,
  EYLO_STAGING_PUBLISHABLE_KEY: 'sb_publishable_only_fake_test',
  EYLO_STAGING_ACCESS_JWT_A: token(A),
  EYLO_STAGING_ACCESS_JWT_B: token(B),
});

test('staging guard rejects production even with matching project name and two valid JWTs', () => {
  const env = validEnv();
  env.EYLO_STAGING_SUPABASE_URL = 'https://kbzjngpzxpniaumlupaa.supabase.co';
  env.EYLO_STAGING_PROJECT_REF = 'kbzjngpzxpniaumlupaa';
  assert.throws(() => validateEyraHostedStagingConfig(env), /production project.*forbidden/);
});

test('fail-closed staging config forbids secrets, paths, wrong project, same user and missing acknowledgement', () => {
  const changes = [
    e => { e.EYLO_STAGING_AB_ACK = ''; },
    e => { e.EYLO_STAGING_PUBLISHABLE_KEY = 'sb_secret_no_access'; },
    e => { e.EYLO_STAGING_SUPABASE_URL += '/auth/v1'; },
    e => { e.EYLO_STAGING_SUPABASE_URL += '?x=1'; },
    e => { e.EYLO_STAGING_PROJECT_REF = 'differentprojectrefx'; },
    e => { e.EYLO_STAGING_ACCESS_JWT_B = e.EYLO_STAGING_ACCESS_JWT_A; },
    e => { e.EYLO_STAGING_ACCESS_JWT_B = token(A); },
    e => { e.EYLO_STAGING_ACCESS_JWT_A = token(A, 'service_role'); },
    e => { e.EYLO_STAGING_ACCESS_JWT_B = 'sb_secret_not_a_jwt'; },
  ];
  for (const change of changes) {
    const env = validEnv();
    change(env);
    assert.throws(() => validateEyraHostedStagingConfig(env));
  }
  const parsed = validateEyraHostedStagingConfig(validEnv());
  assert.equal(parsed.ref, REF);
  assert.notEqual(parsed.expectedA, parsed.expectedB);
});

function makeMock({ leak = false, failedCleanup = false } = {}) {
  const table = new Map();
  const messages = new Map();
  const paths = [];
  const respond = (status, data) => new Response(JSON.stringify(data), {
    status, headers: { 'content-type': 'application/json' },
  });
  const fetchImpl = async (urlText, options) => {
    const url = new URL(urlText);
    paths.push({ path: url.pathname, method: options.method });
    assert.equal(url.origin, 'https://' + REF + '.supabase.co');
    assert.equal(options.redirect, 'error');
    const authToken = options.headers.Authorization.slice('Bearer '.length);
    const user = JSON.parse(Buffer.from(authToken.split('.')[1], 'base64url').toString('utf8')).sub;
    const method = options.method;
    const path = url.pathname;
    const body = options.body ? JSON.parse(options.body) : undefined;
    const rowId = url.searchParams.get('id')?.replace(/^eq\./, '');
    const threadId = url.searchParams.get('conversation_id')?.replace(/^eq\./, '');
    if (path === '/auth/v1/user' && method === 'GET') {
      return respond(200, { id: user, is_anonymous: false });
    }
    if (path === '/rest/v1/rpc/save_eyra_conversation_snapshot' && method === 'POST') {
      const prior = table.get(body.p_snapshot_id);
      if (prior) {
        if (prior.user_id !== user || prior.title !== body.p_title) return respond(403, { code: '42501' });
        return respond(200, prior);
      }
      const row = { id: body.p_snapshot_id, user_id: user, title: body.p_title, version: 1 };
      table.set(row.id, row);
      messages.set(row.id, body.p_messages.map((x, i) => ({
        role: x.role, content: { text: x.text }, sources: x.sources, sequence_number: i + 1,
      })));
      return respond(200, row);
    }
    if (path === '/rest/v1/eyra_conversations') {
      if (method === 'GET') {
        if (url.searchParams.has('limit')) return respond(200, []);
        const row = table.get(rowId);
        return respond(200, row && (leak || row.user_id === user) ? [row] : []);
      }
      const row = table.get(rowId);
      if (!row || row.user_id !== user) return respond(200, []);
      if (method === 'PATCH') {
        const version = url.searchParams.get('version')?.replace(/^eq\./, '');
        if (version && Number(version) !== row.version) return respond(200, []);
        row.title = body.title;
        row.version++;
        return respond(200, [row]);
      }
      if (method === 'DELETE') {
        if (failedCleanup) return respond(503, { code: 'TEST_DOWN' });
        const version = url.searchParams.get('version')?.replace(/^eq\./, '');
        if (version && Number(version) !== row.version) return respond(200, []);
        table.delete(rowId);
        messages.delete(rowId);
        return respond(200, [row]);
      }
    }
    if (path === '/rest/v1/eyra_messages') {
      if (method === 'GET') {
        if (url.searchParams.has('limit')) return respond(200, []);
        const row = table.get(threadId);
        return respond(200, row && (leak || row.user_id === user) ? (messages.get(threadId) || []) : []);
      }
      if (method === 'POST') return respond(403, { code: '42501' });
    }
    return respond(404, { code: 'TEST_UNKNOWN_ENDPOINT' });
  };
  return { fetchImpl, paths, table };
}

test('hosted two-user acceptance exercises owner CRUD, idempotency, cross-account denial, and local cleanup', async () => {
  const config = validateEyraHostedStagingConfig(validEnv());
  const mock = makeMock();
  const result = await runEyraHostedStagingAcceptance(config, mock);
  assert.equal(result.decision, 'HOSTED_RLS_TWO_ACCOUNT_ACCEPTANCE_PASSED');
  assert.equal(result.production_release_approved, false);
  assert.equal(result.remote_application_authorized, false);
  assert.equal(result.disposable_snapshots_removed, true);
  assert.equal(mock.table.size, 0);
  assert.equal(mock.paths.filter(x => x.path.includes('/rpc/save_eyra_conversation_snapshot')).length, 4);
  assert.ok(mock.paths.some(x => x.path === '/auth/v1/user'));
  assert.ok(mock.paths.some(x => x.path === '/rest/v1/eyra_messages' && x.method === 'POST'));
});

test('a backend that leaks even one other user row cannot pass the hosted A/B test', async () => {
  const config = validateEyraHostedStagingConfig(validEnv());
  const mock = makeMock({ leak: true });
  await assert.rejects(
    runEyraHostedStagingAcceptance(config, mock),
    /foreign row was exposed/,
  );
  assert.equal(mock.table.size, 0, 'test should clean up its synthetic rows on failure');
});

test('cleanup uncertainty fails closed without exposing token or account data', async () => {
  const config = validateEyraHostedStagingConfig(validEnv());
  const mock = makeMock({ failedCleanup: true });
  await assert.rejects(
    runEyraHostedStagingAcceptance(config, mock),
    /cleanup could not be confirmed/,
  );
});

test('runner refuses hand-built production configuration without any network call', async () => {
  let calls = 0;
  const fakeConfig = {
    ...validateEyraHostedStagingConfig(validEnv()),
    origin: 'https://kbzjngpzxpniaumlupaa.supabase.co',
  };
  await assert.rejects(
    runEyraHostedStagingAcceptance(fakeConfig, { fetchImpl: async () => { calls++; throw new Error('unexpected'); } }),
    /validated, non-production/,
  );
  assert.equal(calls, 0);
});

test('CLI remains manual only and does not inject secrets into process output', () => {
  const cli = readFileSync(new URL('../scripts/eyra-hosted-ab.mjs', import.meta.url), 'utf8');
  assert.match(cli, /validateEyraHostedStagingConfig\(process\.env\)/);
  assert.match(cli, /runEyraHostedStagingAcceptance\(config\)/);
  assert.doesNotMatch(cli, /console\.log\(config\)|console\.log\(process\.env\)/);
});
