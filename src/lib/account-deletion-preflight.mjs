/**
 * Owner-scoped, read-only inventory of table rows before ANY deletion
 * implementation is considered. These are counts, NOT proof of complete
 * erasure eligibility or a complete inventory of external processors.
 *
 * Names must be reviewed against the actual linked Supabase schema before
 * enabling. All tables below have a user_id column in repository migrations.
 */
export const DELETION_OWNER_TABLES = Object.freeze([
  'profiles',
  'projects',
  'ideas',
  'meetings',
  'saved_papers',
  'saved_researchers',
  'saved_opportunities',
  'search_history',
  'watchlists',
  'monitoring_discoveries',
  'notifications',
  'eyra_usage_actions',
  'institution_memberships',
  'billing_entitlements',
]);

export const OUT_OF_BAND_REVIEW = Object.freeze([
  'supabase_storage_objects',
  'external_stripe_subscription_and_payment_retention',
  'application_and_ai_provider_logs',
  'backups_and_subprocessor_retention',
  'institution_ownership_transfer',
  'active_sessions_and_unexpired_jwts',
  'schema_migrations_and_rls_validation',
]);

export function exactPostgrestCount(response) {
  if (!response?.ok) throw new Error('An owner-scoped data table is not available for read-only counting.');
  const value = response.headers?.get?.('content-range');
  const match = typeof value === 'string' && /^([0-9]+-[0-9]+|\*)\/([0-9]+)$/.exec(value.trim());
  if (!match) throw new Error('Owner-scoped count was not confirmed by an exact PostgREST range.');
  const count = Number(match[2]);
  if (!Number.isSafeInteger(count) || count < 0) throw new Error('Owner-scoped count is outside the safe range.');
  return count;
}

export function deletionReviewReport(rowCounts, requestStatus) {
  if (!rowCounts || typeof rowCounts !== 'object' || Array.isArray(rowCounts)
    || !['pending_review', 'in_review', 'blocked_billing'].includes(requestStatus)
    || Object.keys(rowCounts).length !== DELETION_OWNER_TABLES.length
    || !DELETION_OWNER_TABLES.every(table => Number.isSafeInteger(rowCounts[table]) && rowCounts[table] >= 0)) {
    throw new Error('Incomplete owner deletion preflight evidence.');
  }
  const counts = Object.fromEntries(DELETION_OWNER_TABLES.map(table => [table, rowCounts[table]]));
  return {
    stage: 'read_only_inventory',
    request_status: requestStatus,
    account_deleted: false,
    deletion_authorized: false,
    verified_user_row_counts: counts,
    unresolved_checks: [...OUT_OF_BAND_REVIEW],
    warning: 'Counts are only a partial inventory for independent review. Storage, Stripe, logs, backups and session invalidation remain unverified. No account or subscription was deleted.',
  };
}
