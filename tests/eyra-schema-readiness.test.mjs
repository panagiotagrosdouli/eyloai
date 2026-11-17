import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluateEyraSchemaReadiness } from '../src/lib/eyra-schema-readiness.mjs';

const complete = () => ({
  schema_version: 1,
  tables: Object.fromEntries(
    ['eyra_conversations', 'eyra_messages', 'eyra_agent_runs', 'eyra_agent_actions'].map(name => [
      name,
      {
        present: true, rls_enabled: true, anon_access: false,
        authenticated_select: true,
        authenticated_insert: ['eyra_conversations', 'eyra_messages'].includes(name),
        authenticated_update: name === 'eyra_conversations',
        authenticated_delete: name === 'eyra_conversations',
        service_role_write: name.startsWith('eyra_agent_'),
      },
    ]),
  ),
  snapshot_rpc: {
    present: true, security_invoker: true,
    authenticated_execute: true, anon_execute: false,
  },
  recorded_versions: ['20261113090000', '20261113114924', '20261113120556', '20261115233000'],
});

test('missing schema, function or migration records fail closed', () => {
  const current = complete();
  for (const key of Object.keys(current.tables)) current.tables[key].present = false;
  current.snapshot_rpc = null;
  current.recorded_versions = [];
  const result = evaluateEyraSchemaReadiness({ eyra_schema_report: current });
  assert.equal(result.schema_metadata_passed, false);
  assert.equal(result.decision, 'BLOCKED_SCHEMA_OR_GRANTS');
  assert.ok(result.blockers.some(s => s.includes('eyra_conversations')));
  assert.ok(result.blockers.some(s => s.includes('20261113090000')));
  assert.ok(result.blockers.some(s => s.includes('snapshot RPC')));
  assert.equal(result.production_release_approved, false);
  assert.equal(evaluateEyraSchemaReadiness({}).schema_metadata_passed, false);
});

test('unsafe RLS, anonymous grants and agent writes always block', () => {
  for (const mutate of [
    x => { x.tables.eyra_messages.rls_enabled = false; },
    x => { x.tables.eyra_agent_runs.anon_access = true; },
    x => { x.tables.eyra_agent_actions.authenticated_insert = true; },
    x => { x.tables.eyra_agent_actions.service_role_write = false; },
    x => { x.snapshot_rpc.security_invoker = false; },
    x => { x.snapshot_rpc.anon_execute = true; },
    x => { x.snapshot_rpc.authenticated_execute = false; },
    x => { x.recorded_versions.pop(); },
  ]) {
    const input = complete();
    mutate(input);
    assert.equal(evaluateEyraSchemaReadiness(input).schema_metadata_passed, false);
  }
});

test('even perfect schema evidence still requires hosted two-account acceptance', () => {
  const result = evaluateEyraSchemaReadiness(complete());
  assert.equal(result.schema_metadata_passed, true);
  assert.equal(result.decision, 'HOSTED_TWO_ACCOUNT_ACCEPTANCE_REQUIRED');
  assert.equal(result.remote_application_authorized, false);
  assert.equal(result.production_release_approved, false);
  assert.equal(result.blockers.length, 0);
});

test('schema probe is metadata-only inspection, never migration execution', () => {
  const sql = readFileSync(new URL('../scripts/eyra-schema-readiness.sql', import.meta.url), 'utf8');
  assert.match(sql, /FROM pg_proc/);
  assert.match(sql, /FROM supabase_migrations\.schema_migrations/);
  assert.match(sql, /relrowsecurity/);
  assert.match(sql, /has_table_privilege/);
  assert.match(sql, /has_function_privilege/);
  assert.match(sql, /pg_get_function_identity_arguments\(p\.oid\) = 'p_title text, p_messages jsonb, p_snapshot_id uuid'/);
  assert.doesNotMatch(sql, /^\s*(?:INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|GRANT|REVOKE|CALL|DO|TRUNCATE)\b/im);
  assert.match(sql, /SELECT jsonb_build_object/);
});
