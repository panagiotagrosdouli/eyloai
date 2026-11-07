/**
 * A deletion REQUEST is not a deletion operation. Never claim account removal,
 * subscription cancellation or backup purging from this workflow.
 */
export const EYLO_SUPABASE_PROJECT = 'kbzjngpzxpniaumlupaa';
export const ACCOUNT_DELETION_CONFIRMATION = 'REQUEST ACCOUNT DELETION';
const expectedUrl = `https://${EYLO_SUPABASE_PROJECT}.supabase.co`;

export function deletionIntakeEnabled(env = process.env) {
  return env.EYLO_DELETION_REQUESTS_ENABLED === '1'
    && Boolean(env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY)
    && Boolean(env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY)
    && (!env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL === expectedUrl);
}

/**
 * Separate operator switch: owner-scoped inventory is available only after
 * request intake itself has passed staging checks. This never enables erasure.
 */
export function deletionPreflightEnabled(env = process.env) {
  return env.EYLO_DELETION_PREFLIGHT_ENABLED === '1'
    && deletionIntakeEnabled(env);
}

/**
 * A prior terminal request is not a newly recorded pending request.
 * Never label a terminal row as accepted. Reopening requires a separately
 * reviewed lifecycle operation, not an unauthenticated client-side reset.
 */
export const DELETION_OPEN_STATUSES = Object.freeze([
  'pending_review', 'in_review', 'blocked_billing',
]);

export function deletionSubmissionAction(status) {
  if (status === null) return 'create';
  if (DELETION_OPEN_STATUSES.includes(status)) return 'existing';
  if (status === 'completed' || status === 'declined') return 'closed';
  throw new Error('Unknown deletion request status.');
}

export function validDeletionRequestBody(body) {
  return body !== null && typeof body === 'object' && !Array.isArray(body)
    && Object.keys(body).length === 1
    && body.confirmation === ACCOUNT_DELETION_CONFIRMATION;
}

export function validUserId(id) {
  return typeof id === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}
