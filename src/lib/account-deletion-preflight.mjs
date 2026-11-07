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

/**
 * Summarize one server-read billing entitlement without exposing Stripe
 * customer/subscription identifiers or treating a missing local record as
 * evidence that the remote Stripe account has no subscription.
 */
export function billingLinkReview(rows) {
  if (!Array.isArray(rows) || rows.length > 1) {
    throw new Error('The owner billing entitlement is not uniquely readable.');
  }
  if (rows.length === 0) {
    return {
      local_record_found: false,
      local_paid_plan_recorded: false,
      stripe_customer_link_recorded: false,
      stripe_subscription_link_recorded: false,
      requires_independent_stripe_review: true,
      warning: 'No local billing row does not prove there is no Stripe subscription.',
    };
  }
  const [row] = rows;
  if (!row || typeof row !== 'object' || Array.isArray(row)
    || !['free', 'pro', 'founder', 'institution'].includes(row.plan)
    || typeof row.subscription_status !== 'string'
    || !row.subscription_status.trim() || row.subscription_status.length > 100
    || ![null, undefined].includes(row.stripe_customer_id)
      && (typeof row.stripe_customer_id !== 'string' || row.stripe_customer_id.trim().length < 1)
    || ![null, undefined].includes(row.stripe_subscription_id)
      && (typeof row.stripe_subscription_id !== 'string' || row.stripe_subscription_id.trim().length < 1)) {
    throw new Error('The billing entitlement has an invalid or unexpected structure.');
  }
  return {
    local_record_found: true,
    local_paid_plan_recorded: row.plan !== 'free',
    stripe_customer_link_recorded: Boolean(row.stripe_customer_id),
    stripe_subscription_link_recorded: Boolean(row.stripe_subscription_id),
    requires_independent_stripe_review: true,
    warning: 'Local billing links are only signals. Review Stripe itself for ongoing subscriptions, invoices, disputes and retention obligations.',
  };
}

export function deletionReviewReport(rowCounts, requestStatus, billingEvidence) {
  if (!rowCounts || typeof rowCounts !== 'object' || Array.isArray(rowCounts)
    || !['pending_review', 'in_review', 'blocked_billing'].includes(requestStatus)
    || Object.keys(rowCounts).length !== DELETION_OWNER_TABLES.length
    || !DELETION_OWNER_TABLES.every(table => Number.isSafeInteger(rowCounts[table]) && rowCounts[table] >= 0)) {
    throw new Error('Incomplete owner deletion preflight evidence.');
  }
  if (!billingEvidence || typeof billingEvidence !== 'object'
    || billingEvidence.requires_independent_stripe_review !== true
    || typeof billingEvidence.local_record_found !== 'boolean'
    || typeof billingEvidence.local_paid_plan_recorded !== 'boolean'
    || typeof billingEvidence.stripe_customer_link_recorded !== 'boolean'
    || typeof billingEvidence.stripe_subscription_link_recorded !== 'boolean') {
    throw new Error('Billing review evidence must be explicitly provided.');
  }
  const counts = Object.fromEntries(DELETION_OWNER_TABLES.map(table => [table, rowCounts[table]]));
  return {
    stage: 'read_only_inventory',
    request_status: requestStatus,
    account_deleted: false,
    deletion_authorized: false,
    verified_user_row_counts: counts,
    billing_review: billingEvidence,
    unresolved_checks: [...OUT_OF_BAND_REVIEW],
    warning: 'Counts are only a partial inventory for independent review. Storage, Stripe, logs, backups and session invalidation remain unverified. No account or subscription was deleted.',
  };
}
