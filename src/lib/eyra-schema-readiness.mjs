// Pure, fail-closed interpretation of a read-only PostgreSQL catalog probe.
// Passing metadata is NEVER production approval or proof of two-user isolation.
const REQUIREMENTS = Object.freeze({
  eyra_conversations: { insert: true, update: true, delete: true, serviceWrite: false },
  eyra_messages: { insert: true, update: false, delete: false, serviceWrite: false },
  eyra_agent_runs: { insert: false, update: false, delete: false, serviceWrite: true },
  eyra_agent_actions: { insert: false, update: false, delete: false, serviceWrite: true },
});
const VERSIONS = Object.freeze([
  '20261113090000', '20261113114924', '20261113120556', '20261115233000',
]);

export function evaluateEyraSchemaReadiness(rawReport) {
  const report = rawReport?.eyra_schema_report ?? rawReport;
  const blockers = [];
  if (!report || report.schema_version !== 1
    || !report.tables || typeof report.tables !== 'object'
    || Array.isArray(report.tables)) {
    blockers.push('Missing or malformed versioned schema inspection report.');
  }
  for (const [name, expected] of Object.entries(REQUIREMENTS)) {
    const table = report?.tables?.[name];
    if (table?.present !== true) {
      blockers.push(name + ': table not verified.');
      continue;
    }
    if (table.rls_enabled !== true) blockers.push(name + ': RLS not enabled.');
    if (table.anon_access !== false) blockers.push(name + ': anonymous access not excluded.');
    if (table.authenticated_select !== true) blockers.push(name + ': authenticated SELECT grant missing.');
    for (const [verb, allowed] of Object.entries({
      insert: expected.insert, update: expected.update, delete: expected.delete,
    })) {
      if (table['authenticated_' + verb] !== allowed) {
        blockers.push(name + ': unexpected authenticated ' + verb.toUpperCase() + ' grant.');
      }
    }
    if (expected.serviceWrite && table.service_role_write !== true) {
      blockers.push(name + ': service-only mutation grants missing.');
    }
  }
  const rpc = report?.snapshot_rpc;
  if (rpc?.present !== true) blockers.push('Idempotent three-argument snapshot RPC not verified.');
  else {
    if (rpc.security_invoker !== true) blockers.push('Snapshot RPC must be SECURITY INVOKER.');
    if (rpc.authenticated_execute !== true) blockers.push('Authenticated snapshot EXECUTE grant missing.');
    if (rpc.anon_execute !== false) blockers.push('Anonymous snapshot EXECUTE must be denied.');
  }
  const recorded = Array.isArray(report?.recorded_versions) ? report.recorded_versions : [];
  for (const version of VERSIONS) {
    if (!recorded.includes(version)) blockers.push('Migration registry missing: ' + version);
  }
  const schemaMetadataPassed = blockers.length === 0;
  return {
    schema_metadata_passed: schemaMetadataPassed,
    decision: schemaMetadataPassed ? 'HOSTED_TWO_ACCOUNT_ACCEPTANCE_REQUIRED' : 'BLOCKED_SCHEMA_OR_GRANTS',
    remote_application_authorized: false,
    production_release_approved: false,
    blockers,
    note: 'Catalog metadata cannot prove RLS isolation, SMTP, EYRA provider health, or safe remote migration history. Complete authorized staged JWT A/B and backup/rollback review before any release.',
  };
}
