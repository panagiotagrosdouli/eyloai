#!/usr/bin/env node
/**
 * Direct PostgREST RLS acceptance check using ONLY disposable user sessions.
 * Default: offline preflight. --live: read-only scope checks.
 * --live --write-test-fixtures: creates disposable rows, exercises cross-user
 * SELECT/PATCH/DELETE, and cleans up; explicit opt-in is mandatory.
 * Does not use the Supabase service role and never logs tokens or user data.
 */
import { randomUUID } from 'node:crypto';
import { auditPlan, USER_OWNED_TABLES } from '../src/lib/rls-audit-guards.mjs';

const args = process.argv.slice(2);
const plan = auditPlan(process.env, args);

if (plan.mode === 'preflight') {
  console.log('EYLO Supabase RLS audit: OFFLINE PREFLIGHT ONLY — no network or database changes.');
  console.log('Supported private tables:', USER_OWNED_TABLES.join(', '));
  console.log('A live audit requires the manually confirmed production ref/URL,');
  console.log('two disposable-account tokens, a public key and explicit --live opt-in.');
  console.log('For cross-account mutation tests, --write-test-fixtures requires a separate confirmation flag.');
} else {
  const failures = [];
  const key = plan.publicKey;
  const base = plan.origin;
  const request = async (token, path, options = {}) => {
    const headers = { apikey: key, accept: 'application/json', ...(options.body ? { 'content-type': 'application/json' } : {}) };
    if (token) headers.authorization = `Bearer ${token}`;
    if (options.prefer) headers.Prefer = options.prefer;
    const res = await fetch(`${base}${path}`, {
      method: options.method || 'GET', headers,
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
      signal: AbortSignal.timeout(15000),
      cache: 'no-store',
    });
    const content = await res.text();
    let data = null;
    if (content) { try { data = JSON.parse(content); } catch { /* No user data is logged. */ } }
    return { status: res.status, ok: res.ok, rows: Array.isArray(data) ? data : [] };
  };

  const currentIdentity = async token => {
    const response = await request(token, '/auth/v1/user');
    if (!response.ok) throw new Error('A disposable account session failed authentication.');
    // Auth user endpoint returns a user object, not an array.
    const res = await fetch(`${base}/auth/v1/user`, {
      headers: { apikey: key, authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000), cache: 'no-store',
    });
    if (!res.ok) throw new Error('Could not validate disposable user session.');
    const user = await res.json();
    if (!/^[0-9a-f-]{36}$/i.test(String(user.id || ''))) throw new Error('Invalid test account identifier.');
    return user.id;
  };

  const accounts = [
    { token: plan.tokenA, id: await currentIdentity(plan.tokenA) },
    { token: plan.tokenB, id: await currentIdentity(plan.tokenB) },
  ];
  if (accounts[0].id === accounts[1].id) throw new Error('Both sessions belong to the same account.');

  const path = (table, id = null) => {
    const params = new URLSearchParams({ select: 'id,user_id,data' });
    if (id) params.set('id', `eq.${id}`);
    else params.set('limit', '30');
    return `/rest/v1/${table}?${params}`;
  };
  // Read-only pass fails if either account can list any other account's rows.
  for (const table of plan.tables) {
    let healthy = true;
    for (const account of accounts) {
      const res = await request(account.token, path(table));
      if (!res.ok) { failures.push(`${table}: authenticated read failed (HTTP ${res.status})`); healthy = false; continue; }
      if (res.rows.some(row => row.user_id !== account.id)) {
        failures.push(`${table}: cross-account visibility detected`); healthy = false;
      }
    }
    console.log(`${table}: ${healthy ? 'READ-ONLY SCOPE CHECK OK' : 'READ-ONLY SCOPE CHECK FAILED'}`);
  }

  // A read-only check with no known foreign fixture is NEVER proof of RLS.
  if (!plan.writes) {
    console.log('NOT CERTIFIED: a read-only scope check cannot establish cross-account RLS isolation.');
    console.log('Run the separate disposable-fixture test after verifying the correct project and test accounts.');
  } else if (!failures.length) {
    const readExact = (account, table, id) => request(account.token, path(table, id));
    const mutate = (account, table, id, method, marker) => request(account.token, path(table, id), {
      method,
      prefer: 'return=representation',
      ...(method === 'PATCH' ? { body: { data: { audit_marker: marker, tampered_by_other_user: true } } } : {}),
    });
    const createdIds = [];
    try {
      for (const table of plan.tables) {
        for (let i = 0; i < accounts.length; i++) {
          const owner = accounts[i];
          const stranger = accounts[1 - i];
          const marker = `eylo-rls-disposable-${randomUUID()}`;
          const created = await request(owner.token, `/rest/v1/${table}?select=id,user_id,data`, {
            method: 'POST', prefer: 'return=representation',
            body: { user_id: owner.id, data: { audit_marker: marker, title: 'DISPOSABLE RLS CHECK — DELETE' } },
          });
          if (!created.ok || created.rows.length !== 1 || created.rows[0].user_id !== owner.id) {
            failures.push(`${table}: test fixture creation failed (HTTP ${created.status})`);
            continue;
          }
          const id = created.rows[0].id;
          createdIds.push({ owner, table, id });
          const own = await readExact(owner, table, id);
          if (!own.ok || own.rows.length !== 1 || own.rows[0].data?.audit_marker !== marker) {
            failures.push(`${table}: owner cannot read newly created fixture`);
            continue;
          }
          const foreignRead = await readExact(stranger, table, id);
          if (foreignRead.ok && foreignRead.rows.length) failures.push(`${table}: another user can SELECT owner's fixture`);
          const anonRead = await request(null, path(table, id));
          if (anonRead.ok && anonRead.rows.length) failures.push(`${table}: anonymous client can SELECT private fixture`);
          const attemptPatch = await mutate(stranger, table, id, 'PATCH', marker);
          if (attemptPatch.ok && attemptPatch.rows.length) failures.push(`${table}: another user can PATCH owner's fixture`);
          const afterPatch = await readExact(owner, table, id);
          if (!afterPatch.ok || afterPatch.rows.length !== 1 ||
              afterPatch.rows[0].data?.audit_marker !== marker ||
              afterPatch.rows[0].data?.tampered_by_other_user) {
            failures.push(`${table}: unauthorized PATCH changed owner data`);
          }
          const attemptDelete = await mutate(stranger, table, id, 'DELETE', marker);
          if (attemptDelete.ok && attemptDelete.rows.length) failures.push(`${table}: another user can DELETE owner's fixture`);
          const afterDelete = await readExact(owner, table, id);
          if (!afterDelete.ok || afterDelete.rows.length !== 1) {
            failures.push(`${table}: unauthorized DELETE removed owner data`);
          }
        }
        console.log(`${table}: disposal-fixture cross-account checks completed`);
      }
    } finally {
      for (const { owner, table, id } of createdIds.reverse()) {
        try {
          const cleanup = await request(owner.token, path(table, id), { method: 'DELETE', prefer: 'return=representation' });
          if (!cleanup.ok) failures.push(`${table}: cleanup failed (HTTP ${cleanup.status})`);
        } catch {
          failures.push(`${table}: cleanup failed; inspect disposable test account records`);
        }
      }
    }
  }

  if (failures.length) {
    for (const message of failures) console.error('FAIL:', message);
    process.exitCode = 1;
  } else if (plan.writes) {
    console.log('PASS: disposable-fixture account-isolation checks passed for the selected tables.');
    console.log('This does not verify all database grants, RPCs, application workflows or privacy requirements.');
  } else {
    console.log('PASS: limited read-only scope checks; comprehensive RLS verification is still outstanding.');
  }
}
