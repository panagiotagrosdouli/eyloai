/**
 * Release evidence inventory for EYLO. This is an offline configuration
 * preflight, NOT verification of security, payments or scientific accuracy.
 * Never accept a list of environment-variable NAMES as proof that values
 * target the correct workspace or that a third-party live check succeeded.
 */
export const EYLO_PRODUCTION_SUPABASE_REF = 'kbzjngpzxpniaumlupaa';

const REQUIRED_PRODUCTION_KEYS = Object.freeze([
  'OPENAI_API_KEY', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY',
  'SUPABASE_SECRET_KEY', 'CRON_SECRET',
  'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRO_PRICE_ID', 'STRIPE_FOUNDER_PRICE_ID',
]);

export const LIVE_LAUNCH_GATES = Object.freeze([
  'supabase_identity_verified',
  'two_user_rls_passed',
  'analytics_rpc_and_migrations_verified',
  'research_quality_human_accepted',
  'stripe_sandbox_end_to_end_passed',
  'subscription_and_quota_acceptance_passed',
  'data_export_and_account_deletion_accepted',
  'privacy_legal_retention_reviewed',
  'backup_incident_recovery_verified',
  'mobile_accessibility_accepted',
  'release_owner_signed_off',
]);

function nonemptyString(s) { return typeof s === 'string' && Boolean(s.trim()); }
function uniqueStrings(arr) {
  return Array.isArray(arr) && arr.every(nonemptyString) && new Set(arr).size === arr.length;
}
export function assessEyloRelease(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new TypeError('Release snapshot must be a structured object.');
  }
  const {
    main_sha: mainSha, production_sha: productionSha, release_candidate_sha: candidateSha,
    intended_supabase_ref: intendedRef, connected_supabase_refs: connectedRefs,
    production_env_keys: envKeys, accepted_gate_evidence: evidence,
  } = snapshot;
  if (![mainSha, productionSha, candidateSha, intendedRef].every(nonemptyString)
    || !uniqueStrings(connectedRefs) || !uniqueStrings(envKeys)
    || !evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
    throw new TypeError('Snapshot must include immutable commit IDs, Supabase refs, key NAMES and evidence map.');
  }
  const names = new Set(envKeys);
  const connected = new Set(connectedRefs);
  const blockers = [];
  const missingEnvironmentKeys = REQUIRED_PRODUCTION_KEYS.filter(key => !names.has(key));
  if (missingEnvironmentKeys.length) {
    blockers.push({ category: 'deployment_configuration', missing_keys: missingEnvironmentKeys });
  }
  const expectedRef = EYLO_PRODUCTION_SUPABASE_REF;
  if (intendedRef !== expectedRef || !connected.has(expectedRef)) {
    blockers.push({
      category: 'unverified_supabase_connection',
      intended_project_ref_matches_repository: intendedRef === expectedRef,
      correct_project_accessible: connected.has(expectedRef),
    });
  }
  if (productionSha !== candidateSha) {
    blockers.push({
      category: 'release_candidate_not_in_production',
      production_sha: productionSha, candidate_sha: candidateSha,
    });
  }
  if (mainSha !== candidateSha) blockers.push({ category: 'release_candidate_unmerged' });
  const pendingLiveGates = LIVE_LAUNCH_GATES.filter(gate => {
    const record = evidence[gate];
    return !record || record.status !== 'accepted'
      || !nonemptyString(record.reviewer)
      || !nonemptyString(record.evidence_uri)
      || !nonemptyString(record.review_date);
  });
  if (pendingLiveGates.length) {
    blockers.push({ category: 'unverified_live_acceptance', pending: pendingLiveGates });
  }
  // Documentation is self-asserted; even zero blockers means an operator must
  // inspect artifact provenance and confirm no live changes happened meanwhile.
  return {
    decision: blockers.length ? 'NO-GO' : 'REQUIRES_INDEPENDENT_FINAL_SIGNOFF',
    checks: {
      environment_variable_names_present: missingEnvironmentKeys.length === 0,
      intended_supabase_accessible: intendedRef === expectedRef && connected.has(expectedRef),
      candidate_equals_main: mainSha === candidateSha,
      candidate_equals_production: productionSha === candidateSha,
      declared_live_evidence_complete: pendingLiveGates.length === 0,
    },
    blockers,
    caveat: 'Environment variable names do not validate their values. Declared evidence is not audited proof. Never auto-deploy, bill users or migrate a database from this output.',
  };
}
