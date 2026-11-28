import { randomUUID } from 'node:crypto';
import { validateEyraHostedStagingConfig } from './eyra-hosted-ab-core.mjs';

const check = (value, label) => { if (!value) throw new Error('Files staging check failed: ' + label); };

// The same production/JWT/project guards as EYRA run BEFORE any network call.
// Only new random test records and object paths are ever changed.
export async function runFilesHostedAcceptance(env, { fetchImpl = fetch } = {}) {
  const config = validateEyraHostedStagingConfig(env);
  check(env.EYLO_STAGING_FILES_ACK === 'DISPOSABLE_STAGING_FILES_ONLY', 'explicit file-write acknowledgement');
  const identities = [config.expectedA, config.expectedB];
  const tokens = [config.tokenA, config.tokenB];
  const fixtures = identities.map(userId => {
    const id = randomUUID();
    return { id, userId, probe: `${userId}/${id}/${randomUUID()}-forbidden.txt`, paths: [1, 2].map(v => `${userId}/${id}/${randomUUID()}-v${v}.txt`),
      bytes: [1, 2].map(v => `EYLO disposable staging bytes ${id} version ${v}\n`) };
  });
  const attempted = new Set();
  async function request(who, method, path, body, binary = false) {
    check(/^\/(auth\/v1\/user|rest\/v1\/eylo_files|rest\/v1\/eylo_file_versions|storage\/v1\/object\/)/.test(path), 'endpoint allowlist');
    const response = await fetchImpl(new URL(path, config.origin), {
      method, redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { apikey: config.key, Authorization: 'Bearer ' + tokens[who],
        ...(body === undefined ? {} : { 'Content-Type': binary ? 'text/plain' : 'application/json' }),
        ...(path.startsWith('/rest/') ? { Prefer: 'return=representation' } : {}) },
      ...(body === undefined ? {} : { body: binary ? body : JSON.stringify(body) }),
    });
    const reader = response.body?.getReader();
    let text = ''; let count = 0;
    if (reader) {
      const decoder = new TextDecoder();
      try {
        while (true) {
          const part = await reader.read(); if (part.done) break;
          count += part.value.byteLength;
          check(count <= 65536, 'response budget');
          text += decoder.decode(part.value, { stream: true });
        }
        text += decoder.decode();
      } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
    }
    let data = null;
    if (text && response.headers.get('content-type')?.includes('application/json')) {
      try { data = JSON.parse(text); } catch { throw new Error('Invalid staging response'); }
    }
    return { ok: response.ok, status: response.status, text, data };
  }
  const rows = r => { check(r.ok && Array.isArray(r.data), 'confirmed row response'); return r.data; };
  const one = r => { const values = rows(r); check(values.length === 1, 'one confirmed row'); return values[0]; };
  const hidden = r => {
    if (r.ok) check(Array.isArray(r.data) && r.data.length === 0, 'foreign metadata hidden');
    else check([403, 404].includes(r.status), 'explicit authorization denial');
  };
  const objectPath = path => '/storage/v1/object/eylo-files/' + path;
  const download = path => '/storage/v1/object/authenticated/eylo-files/' + path;
  const fileQuery = id => '/rest/v1/eylo_files?id=eq.' + id + '&select=*';
  const versionQuery = id => '/rest/v1/eylo_file_versions?file_id=eq.' + id + '&select=*';
  let completed = false;
  try {
    for (let who = 0; who < 2; who++) {
      const auth = await request(who, 'GET', '/auth/v1/user');
      check(auth.ok && auth.data?.id === identities[who], 'genuine distinct hosted identity');
    }
    for (let who = 0; who < 2; who++) {
      const f = fixtures[who]; attempted.add(who);
      const owned = one(await request(who, 'POST', '/rest/v1/eylo_files', {
        id: f.id, user_id: f.userId, name: 'Disposable staging acceptance.txt',
        mime_type: 'text/plain', size_bytes: Buffer.byteLength(f.bytes[0]),
      }));
      check(owned.id === f.id && owned.user_id === f.userId, 'owned file receipt');
      for (let version = 0; version < 2; version++) {
        check((await request(who, 'POST', objectPath(f.paths[version]), f.bytes[version], true)).ok, 'upload bytes');
        const receipt = one(await request(who, 'POST', '/rest/v1/eylo_file_versions', {
          id: randomUUID(), file_id: f.id, user_id: f.userId, version_number: version + 1,
          storage_path: f.paths[version], mime_type: 'text/plain', size_bytes: Buffer.byteLength(f.bytes[version]),
        }));
        check(receipt.file_id === f.id && receipt.version_number === version + 1, 'version receipt');
      }
      const renamed = one(await request(who, 'PATCH', fileQuery(f.id), { name: 'Renamed staging acceptance.txt' }));
      check(renamed.name === 'Renamed staging acceptance.txt', 'metadata persistence');
      check(rows(await request(who, 'GET', versionQuery(f.id))).length === 2, 'version reload');
    }
    for (let owner = 0; owner < 2; owner++) {
      const foreign = 1 - owner; const f = fixtures[owner];
      hidden(await request(foreign, 'GET', fileQuery(f.id)));
      hidden(await request(foreign, 'GET', versionQuery(f.id)));
      hidden(await request(foreign, 'PATCH', fileQuery(f.id), { name: 'Forbidden overwrite' }));
      hidden(await request(foreign, 'DELETE', fileQuery(f.id)));
      const forged = await request(foreign, 'POST', '/rest/v1/eylo_file_versions', {
        id: randomUUID(), file_id: f.id, user_id: identities[foreign], version_number: 3,
        storage_path: f.paths[0] + '.forged', mime_type: 'text/plain', size_bytes: 1,
      });
      check(!forged.ok && [403, 409].includes(forged.status), 'foreign-parent version denied');
      const foreignUpload = await request(foreign, 'POST', objectPath(f.probe), 'Forbidden upload', true);
      check(!foreignUpload.ok && (foreignUpload.status === 403 ||
        (foreignUpload.status === 400 && String(foreignUpload.data?.statusCode) === '403')), 'foreign namespace upload denied');
      // Storage can silently ignore unauthorized deletion; verify original bytes afterwards.
      const foreignDelete = await request(foreign, 'DELETE', '/storage/v1/object/eylo-files', { prefixes: f.paths });
      check(foreignDelete.ok || [403, 404].includes(foreignDelete.status), 'foreign delete reached authorization boundary');
      for (let version = 0; version < 2; version++) {
        const denied = await request(foreign, 'GET', download(f.paths[version]));
        check(!denied.ok && [400, 403, 404].includes(denied.status), 'foreign byte download denied');
        const original = await request(owner, 'GET', download(f.paths[version]));
        check(original.ok && original.text === f.bytes[version], 'original bytes preserved exactly');
      }
      const preserved = one(await request(owner, 'GET', fileQuery(f.id)));
      check(preserved.name === 'Renamed staging acceptance.txt', 'metadata preserved after attacks');
      check(rows(await request(owner, 'GET', versionQuery(f.id))).length === 2, 'no injected version');
    }
    completed = true;
  } finally {
    let clean = true;
    for (const who of attempted) {
      const f = fixtures[who];
      try {
        const paths = [...f.paths, f.probe];
        check((await request(who, 'DELETE', '/storage/v1/object/eylo-files', { prefixes: paths })).ok, 'owner object cleanup');
        for (const path of paths) {
          const missing = await request(who, 'GET', download(path));
          check(!missing.ok && [400, 404].includes(missing.status), 'deleted bytes absent');
        }
        await request(who, 'DELETE', fileQuery(f.id));
        check(rows(await request(who, 'GET', fileQuery(f.id))).length === 0, 'file cleanup');
        check(rows(await request(who, 'GET', versionQuery(f.id))).length === 0, 'version cascade cleanup');
      } catch { clean = false; }
    }
    check(clean, 'cleanup incomplete; inspect disposable staging records privately');
  }
  check(completed, 'acceptance completed');
  return { scope: 'authorized-disposable-staging-only', passed: true, accounts: 2,
    versions_per_file: 2, byte_equality_verified: true, bidirectional_foreign_denial: true,
    cleanup_verified: true, production_tested: false };
}
