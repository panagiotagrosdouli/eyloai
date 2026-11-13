/** Evidence compatibility gate. It does not run tests, attest to reports, deploy,
 * migrate databases, enable payments or authorize a production release. */
const SHA = /^[a-f0-9]{40}$/i;
const REF = /^[a-z]{20}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FORBIDDEN_REFS = new Set(['kbzjngpzxpniaumlupaa', 'umzrggayitzfgrrofjnw']);
/** @type {ReadonlyArray<readonly [string, string, readonly string[]]>} */
export const RELEASE_CHECKS = Object.freeze([
  ['ci', 'ci', ['imports_types_lint_tests_build', 'all_required_workflows']],
  ['auth', 'hosted-staging', ['registration_login_logout', 'password_recovery', 'session_expiry']],
  ['isolation', 'hosted-staging', ['foreign_read_denied', 'foreign_update_denied', 'foreign_delete_denied', 'persistence_after_login', 'account_switch_clears_private_ui']],
  ['files', 'hosted-staging', ['upload_download_versions', 'foreign_storage_access_denied', 'metadata_and_bytes_consistent']],
  ['projects', 'hosted-staging', ['workplans_persist', 'stale_writes_rejected', 'exact_project_scope']],
  ['eyra', 'hosted-staging', ['authenticated_responses_api', 'stream_completion_and_cancel', 'private_history_and_export', 'explicit_write_permission', 'destructive_confirmation', 'provider_failures_and_budgets']],
  ['research', 'live-and-human', ['real_sources_only', 'partial_source_disclosure', 'human_relevance_review']],
  ['funding', 'hosted-staging', ['official_source_fidelity', 'project_scoped_drafts']],
  ['stripe', 'hosted-staging', ['test_checkout_webhook_entitlements', 'renewal_cancel_failed_payment', 'duplicate_event_safety']],
  ['livekit', 'hosted-staging', ['two_user_media', 'unauthorized_join_denied', 'reconnection_and_leave']],
  ['privacy', 'hosted-staging', ['owner_export', 'reauthenticated_deletion', 'sessions_revoked', 'records_and_storage_removed', 'other_account_unchanged']],
  ['ux', 'hosted-staging', ['desktop_mobile', 'keyboard_accessibility', 'navigation_loading_empty_error_states']],
  ['operations', 'hosted-staging', ['backup_restore', 'alerts_and_support_delivery', 'incident_runbook_review']],
  ['legal_pilot', 'human-review', ['controller_identified', 'terms_privacy_retention_reviewed', 'external_pilot_feedback']],
]);

function recent(date, now) {
  const time = typeof date === 'string' ? Date.parse(date) : NaN;
  return Number.isFinite(time) && time <= now + 5 * 60_000 && time >= now - 7 * 86400_000;
}
function evidenceReference(value) {
  if (typeof value !== 'string') return false;
  return /^docs\/release\/evidence\/[a-zA-Z0-9_.-]+\.(?:json|md|txt)$/.test(value)
    || /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/actions\/runs\/\d+$/.test(value);
}
export function evaluateReleaseReadiness(input, { expectedCommit, now = Date.now() } = {}) {
  const issues = [];
  const target = input?.target || {};
  if (input?.schema_version !== 1) issues.push('Unsupported or missing evidence schema.');
  if (!SHA.test(expectedCommit || '') || input?.commit !== expectedCommit) issues.push('Evidence must identify the exact reviewed source commit.');
  if (input?.scope !== 'research-workspace-v1') issues.push('The first release scope must be explicit.');
  if (target.environment !== 'staging' || !REF.test(target.supabase_ref || '') || FORBIDDEN_REFS.has(target.supabase_ref)) issues.push('A separate authorized staging database is required; live and unrelated refs are forbidden.');
  if (target.owner_confirmed !== true || target.connector_verified !== true) issues.push('Owner confirmation and independent connector identity verification are required.');
  if (!/^team_[\w]+$/.test(target.vercel_team_id || '') || !/^prj_[\w]+$/.test(target.vercel_project_id || '')) issues.push('Exact Vercel team and project identities are missing.');
  if (target.deployment_environment !== 'preview' || target.deployment_sha !== expectedCommit || target.manifest_sha !== expectedCommit) issues.push('Preview deployment, server provenance and browser manifest must match the reviewed commit.');
  const checks = RELEASE_CHECKS.map(([id, scope, requiredAssertions]) => {
    const report = input?.checks?.[id];
    const reasons = [];
    if (!report || report.status !== 'PASS') reasons.push('Successful acceptance evidence not recorded.');
    if (report?.scope !== scope) reasons.push(`Required scope is ${scope}; local fixtures cannot replace hosted or human evidence.`);
    if (report?.commit !== expectedCommit) reasons.push('Report belongs to another source commit.');
    if (!recent(report?.executed_at, now)) reasons.push('Report is missing, stale or dated in the future.');
    if (!evidenceReference(report?.evidence)) reasons.push('A sanitized acceptance artifact or exact CI run reference is required.');
    if (typeof report?.reviewed_by !== 'string' || !report.reviewed_by.trim()) reasons.push('An accountable reviewer must inspect the evidence.');
    for (const assertion of requiredAssertions) if (report?.assertions?.[assertion] !== true) reasons.push(`Unverified: ${assertion}.`);
    if (scope === 'hosted-staging' && (report?.supabase_ref !== target.supabase_ref || report?.vercel_project_id !== target.vercel_project_id)) reasons.push('Hosted report targets different or unspecified infrastructure.');
    if (id === 'isolation' || id === 'livekit' || id === 'privacy') {
      const actors = report?.test_user_ids;
      if (!Array.isArray(actors) || actors.length !== 2 || actors.some(actor => typeof actor !== 'string' || !UUID.test(actor)) || actors[0] === actors[1]) reasons.push('Two distinct disposable test-account identities are required.');
    }
    if (id === 'research') {
      const metrics = report?.metrics;
      if (!Number.isSafeInteger(metrics?.queries) || metrics.queries < 5 || metrics.covered_queries !== metrics.queries || !Number.isSafeInteger(metrics.human_reviewed_queries) || metrics.human_reviewed_queries < metrics.queries) reasons.push('All five or more research queries require sufficient source coverage and independent human relevance review.');
    }
    if (id === 'stripe' && (report?.test_mode !== true || report?.livemode !== false)) reasons.push('Stripe acceptance must use test mode; live payments are not authorized by this gate.');
    return { id, required_scope: scope, status: reasons.length ? 'BLOCKED' : 'VERIFIED', reasons };
  });
  const ready = issues.length === 0 && checks.every(check => check.status === 'VERIFIED');
  return { schema_version: 1, scope: input?.scope || null, commit: expectedCommit || null, evaluated_at: new Date(now).toISOString(),
    decision: ready ? 'READY_FOR_OWNER_REVIEW' : 'NO-GO', production_authorized: false,
    note: 'Report compatibility is not independent proof of execution. Review the referenced artifacts. Production promotion and live payments require separate explicit owner authorization.',
    identity_issues: issues, checks };
}
