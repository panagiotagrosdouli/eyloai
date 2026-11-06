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

export function validDeletionRequestBody(body) {
  return body !== null && typeof body === 'object' && !Array.isArray(body)
    && Object.keys(body).length === 1
    && body.confirmation === ACCOUNT_DELETION_CONFIRMATION;
}

export function validUserId(id) {
  return typeof id === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}
