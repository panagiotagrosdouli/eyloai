import { randomUUID } from 'node:crypto';

// Explicitly protect the production project. The host is restricted further
// to a canonical Supabase staging URL: no redirects, custom domains or paths.
const PRODUCTION_REF = 'kbzjngpzxpniaumlupaa';
const ACCEPTANCE_ACK = 'DISPOSABLE_STAGING_ACCOUNTS_ONLY';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HOST = /^([a-z0-9]{20})\.supabase\.co$/;

function requireValue(env, name) {
  const value = env[name];
  if (typeof value !== 'string' || !value.trim()) throw new Error(name + ' is required for manual staging acceptance.');
  return value.trim();
}

function tokenClaims(token) {
  // This is a pre-network safety filter, NOT token verification. Only Auth
  // GET /user establishes that both JWTs belong to genuine hosted users.
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Two authenticated user access JWTs are required, never API keys.');
  let claims;
  try { claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')); }
  catch { throw new Error('User access tokens must be well-formed JWTs.'); }
  if (claims.role !== 'authenticated' || !UUID.test(claims.sub || '')
    || typeof claims.exp !== 'number' || claims.exp < Math.floor(Date.now() / 1000) + 180) {
    throw new Error('Both staging tokens must be unexpired authenticated user sessions.');
  }
  if (claims.is_anonymous === true) throw new Error('Use two genuine, non-anonymous staging accounts.');
  return claims;
}

export function validateEyraHostedStagingConfig(env) {
  if (requireValue(env, 'EYLO_STAGING_AB_ACK') !== ACCEPTANCE_ACK) {
    throw new Error('Explicit disposable staging acceptance acknowledgement is required.');
  }
  const raw = requireValue(env, 'EYLO_STAGING_SUPABASE_URL');
  let url;
  try { url = new URL(raw); } catch { throw new Error('A canonical staging Supabase URL is required.'); }
  const ref = url.hostname.match(HOST)?.[1];
  if (url.protocol !== 'https:' || !ref || url.origin !== raw.replace(/\/$/, '')
    || url.pathname !== '/' || url.search || url.hash || url.username || url.password || url.port) {
    throw new Error('Only a canonical https://<staging-ref>.supabase.co URL is permitted.');
  }
  if (ref === PRODUCTION_REF) throw new Error('The EYLO production project is permanently forbidden for this tool.');
  if (requireValue(env, 'EYLO_STAGING_PROJECT_REF') !== ref) {
    throw new Error('Expected staging project reference does not match the URL.');
  }
  const key = requireValue(env, 'EYLO_STAGING_PUBLISHABLE_KEY');
  if (key.startsWith('sb_secret_') || !(
    key.startsWith('sb_publishable_') || (() => {
      try { return JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8')).role === 'anon'; }
      catch { return false; }
    })()
  )) throw new Error('Use a staging publishable/anon key, never a service-role or secret key.');
  const tokenA = requireValue(env, 'EYLO_STAGING_ACCESS_JWT_A');
  const tokenB = requireValue(env, 'EYLO_STAGING_ACCESS_JWT_B');
  if (tokenA === tokenB) throw new Error('Two distinct staging users are mandatory.');
  const a = tokenClaims(tokenA), b = tokenClaims(tokenB);
  if (a.sub === b.sub) throw new Error('The staging JWTs must belong to different accounts.');
  return { origin: url.origin, ref, key, tokenA, tokenB, expectedA: a.sub, expectedB: b.sub };
}

const pass = (okay, what) => {
  if (!okay) throw new Error('Hosted EYRA staging acceptance failed: ' + what);
};

function client(config, fetchImpl, jwt, label) {
  return async (method, path, body, { returnRows = false } = {}) => {
    const url = new URL(path, config.origin);
    pass(url.origin === config.origin && /^\/(?:rest\/v1\/|auth\/v1\/user)/.test(url.pathname), 'unexpected endpoint');
    const headers = { apikey: config.key, Authorization: 'Bearer ' + jwt, Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (returnRows) headers.Prefer = 'return=representation';
    let response;
    try {
      response = await fetchImpl(url.toString(), {
        method, headers, body: body === undefined ? undefined : JSON.stringify(body),
        redirect: 'error', signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new Error('Staging request failed at ' + label + '. Check the network and session privately.');
    }
    let result = null;
    if (response.status !== 204) {
      try {
        const text = await response.text();
        pass(text.length <= 200000, 'staging response exceeded safety limit');
        result = text ? JSON.parse(text) : null;
      } catch {
        // Never surface raw Supabase errors: they can contain private content.
        throw new Error('Staging request returned an invalid response at ' + label + '.');
      }
    }
    return { ok: response.ok, status: response.status, data: result };
  };
}

function rows(result, what) {
  pass(result.ok && Array.isArray(result.data), what + ' must return a successful row array');
  return result.data;
}

function returnedOne(result, what) {
  const data = Array.isArray(result.data) ? result.data : [result.data];
  pass(result.ok && data.length === 1 && data[0] && typeof data[0] === 'object',
    what + ' must return a single confirmed row');
  return data[0];
}

function denied(result, what) {
  // Hidden by RLS => 200 [] or a 401/403/404. Other failures do not pass.
  if (result.ok) pass(Array.isArray(result.data) && result.data.length === 0, what + ': foreign row was exposed');
  else pass([401, 403, 404].includes(result.status), what + ': unexpected backend error');
}

export async function runEyraHostedStagingAcceptance(config, { fetchImpl = fetch } = {}) {
  // Caller MUST run validateEyraHostedStagingConfig first. Defend the boundary
  // again here to prevent accidental invocation with a hand-built config.
  let actualRef;
  try { actualRef = new URL(config?.origin).hostname.match(HOST)?.[1]; }
  catch { actualRef = null; }
  if (!actualRef || actualRef === PRODUCTION_REF || actualRef !== config?.ref
    || config.origin !== 'https://' + actualRef + '.supabase.co'
    || !config?.tokenA || !config?.tokenB || !config?.key) {
    throw new Error('A validated, non-production Supabase staging configuration is required.');
  }
  const a = client(config, fetchImpl, config.tokenA, 'user A');
  const b = client(config, fetchImpl, config.tokenB, 'user B');
  const idA = randomUUID(), idB = randomUUID();
  const sample = [{ role: 'user', text: 'Disposable EYLO A/B staging acceptance', sources: [] }];
  const titleA = 'EYLO disposable staging check A', titleB = 'EYLO disposable staging check B';
  const endpoint = id => '/rest/v1/eyra_conversations?id=eq.' + id + '&select=id,user_id,title,version';
  const messages = id => '/rest/v1/eyra_messages?conversation_id=eq.' + id + '&select=role,content,sources,sequence_number&order=sequence_number.asc';
  const dataA = { p_title: titleA, p_messages: sample, p_snapshot_id: idA };
  const dataB = { p_title: titleB, p_messages: sample, p_snapshot_id: idB };
  let attemptedA = false, attemptedB = false, completed = false, cleanupFailed = false;
  try {
    // Verify the user identities against hosted Auth, not untrusted local JWT claims.
    const identityA = await a('GET', '/auth/v1/user');
    const identityB = await b('GET', '/auth/v1/user');
    pass(identityA.ok && identityB.ok && UUID.test(identityA.data?.id || '')
      && UUID.test(identityB.data?.id || '')
      && identityA.data.id === config.expectedA && identityB.data.id === config.expectedB
      && identityA.data.id !== identityB.data.id
      && !identityA.data.is_anonymous && !identityB.data.is_anonymous,
      'two distinct, verified non-anonymous staging identities');
    for (const call of [a, b]) {
      rows(await call('GET', '/rest/v1/eyra_conversations?select=id&limit=0'), 'conversation schema probe');
      rows(await call('GET', '/rest/v1/eyra_messages?select=id&limit=0'), 'message schema probe');
    }
    attemptedA = true;
    let created = returnedOne(await a('POST', '/rest/v1/rpc/save_eyra_conversation_snapshot', dataA), 'A snapshot');
    pass(created.id === idA && created.user_id === identityA.data.id && created.version === 1, 'A owned snapshot identity');
    let retried = returnedOne(await a('POST', '/rest/v1/rpc/save_eyra_conversation_snapshot', dataA), 'A retry');
    pass(retried.id === idA, 'retry identity is stable');
    pass(rows(await a('GET', messages(idA)), 'A messages').length === 1, 'snapshot retry created duplicate messages');
    attemptedB = true;
    const createdB = returnedOne(await b('POST', '/rest/v1/rpc/save_eyra_conversation_snapshot', dataB), 'B snapshot');
    pass(createdB.id === idB && createdB.user_id === identityB.data.id, 'B owned snapshot identity');

    denied(await b('GET', endpoint(idA)), 'B reading A thread');
    denied(await b('GET', messages(idA)), 'B reading A messages');
    denied(await a('GET', endpoint(idB)), 'A reading B thread');
    denied(await a('GET', messages(idB)), 'A reading B messages');

    denied(await b('PATCH', endpoint(idA), { title: 'Unauthorized overwrite' }, { returnRows: true }), 'B updating A thread');
    denied(await b('DELETE', endpoint(idA), undefined, { returnRows: true }), 'B deleting A thread');
    const insertion = await b('POST', '/rest/v1/eyra_messages', [{
      conversation_id: idA, user_id: identityA.data.id,
      sequence_number: 2, role: 'user', content: { text: 'Forbidden injection' },
    }], { returnRows: true });
    pass(!insertion.ok && [400, 401, 403, 409].includes(insertion.status), 'B appending A message was accepted');
    const foreignRetry = await b('POST', '/rest/v1/rpc/save_eyra_conversation_snapshot', dataA);
    pass(!foreignRetry.ok && [400, 401, 403, 409].includes(foreignRetry.status), 'B reused A snapshot identity');

    const after = rows(await a('GET', endpoint(idA)), 'A original after attacks');
    pass(after.length === 1 && after[0].title === titleA, 'A thread changed after foreign write attempts');
    pass(rows(await a('GET', messages(idA)), 'A original messages').length === 1,
      'A messages changed after foreign write attempts');

    const renamed = rows(await a('PATCH', '/rest/v1/eyra_conversations?id=eq.' + idA
      + '&version=eq.1&select=id,title,version', { title: titleA + ' renamed' }, { returnRows: true }), 'A rename');
    pass(renamed.length === 1 && renamed[0].version === 2, 'owner optimistic rename not versioned');
    const stale = rows(await a('PATCH', '/rest/v1/eyra_conversations?id=eq.' + idA
      + '&version=eq.1&select=id', { title: 'Stale update' }, { returnRows: true }), 'stale A rename');
    pass(stale.length === 0, 'stale revision overwrote existing data');

    const deletedA = rows(await a('DELETE', '/rest/v1/eyra_conversations?id=eq.' + idA
      + '&version=eq.2&select=id', undefined, { returnRows: true }), 'A delete');
    pass(deletedA.length === 1 && deletedA[0].id === idA, 'owner snapshot delete not confirmed');
    pass(rows(await a('GET', messages(idA)), 'post-deletion cascade').length === 0, 'messages did not cascade-delete');
    const deletedB = rows(await b('DELETE', '/rest/v1/eyra_conversations?id=eq.' + idB
      + '&select=id', undefined, { returnRows: true }), 'B delete');
    pass(deletedB.length === 1 && deletedB[0].id === idB, 'B cleanup deletion not confirmed');
    completed = true;
    return {
      decision: 'HOSTED_RLS_TWO_ACCOUNT_ACCEPTANCE_PASSED',
      schema_metadata_passed: null,
      remote_application_authorized: false,
      production_release_approved: false,
      disposable_snapshots_removed: true,
      note: 'Staging JWT A/B evidence only; still requires migration review, SMTP, provider health and explicit human release approval.',
    };
  } finally {
    // Safety cleanup tries only the two generated UUIDs, with the OWNER JWT.
    // Do not use admin credentials or touch any other rows.
    for (const [attempted, call, id] of [[attemptedA, a, idA], [attemptedB, b, idB]]) {
      if (!attempted) continue;
      try {
        const result = await call('DELETE', '/rest/v1/eyra_conversations?id=eq.' + id + '&select=id',
          undefined, { returnRows: true });
        if (!result.ok) cleanupFailed = true;
      } catch { cleanupFailed = true; }
    }
    if (cleanupFailed) {
      // Make cleanup uncertainty impossible to mistake for complete success.
      throw new Error('EYRA staging A/B cleanup could not be confirmed; inspect only disposable test UUIDs privately.');
    }
    if (!completed) { /* The original sanitized test failure propagates. */ }
  }
}
