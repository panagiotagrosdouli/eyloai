import { deletionPreflightEnabled, EYLO_SUPABASE_PROJECT } from '../src/lib/account-deletion-request-policy.mjs';
import {
  DELETION_OWNER_TABLES, exactPostgrestCount, deletionReviewReport, billingLinkReview,
} from '../src/lib/account-deletion-preflight.mjs';
import {
  verifiedUser, existingRequest, serverHeaders,
} from './account-deletion-request.js';

const SUPABASE_URL = `https://${EYLO_SUPABASE_PROJECT}.supabase.co`;

async function countOwnedRecords(table, userId) {
  const query = new URLSearchParams({
    user_id: `eq.${userId}`,
    select: 'user_id',
    limit: '1',
  });
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: 'HEAD',
    headers: { ...serverHeaders(), Prefer: 'count=exact' },
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });
  // Do not accept HEAD responses with missing/unknown totals or errors.
  return exactPostgrestCount(response);
}

async function readOwnedBillingLinks(userId) {
  // Server-only, owner-scoped read. No raw Stripe identifiers are ever
  // returned to the browser or persisted by this request.
  const query = new URLSearchParams({
    user_id: `eq.${userId}`,
    select: 'plan,subscription_status,stripe_customer_id,stripe_subscription_id',
    limit: '1',
  });
  const response = await fetch(`${SUPABASE_URL}/rest/v1/billing_entitlements?${query}`, {
    method: 'GET',
    headers: serverHeaders(),
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error('Owner billing links could not be verified.');
  const rows = await response.json();
  return billingLinkReview(rows);
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'private, no-store');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed.' });
  }
  if (!deletionPreflightEnabled()) {
    return response.status(503).json({
      code: 'DELETION_PREFLIGHT_UNAVAILABLE',
      error: 'Read-only deletion inventory requires verified staging database and review.',
    });
  }

  const authorization = request.headers?.authorization;
  if (typeof authorization !== 'string' || !/^Bearer [A-Za-z0-9._~-]+$/.test(authorization)) {
    return response.status(401).json({ error: 'Authentication required.' });
  }

  try {
    const userId = await verifiedUser(authorization);
    if (!userId) return response.status(401).json({ error: 'Authentication required.' });
    const entry = await existingRequest(userId);
    if (!entry || !['pending_review', 'in_review', 'blocked_billing'].includes(entry.status)) {
      return response.status(409).json({
        code: 'NO_OPEN_DELETION_REQUEST',
        error: 'Read-only inventory is available only for a verified pending deletion request.',
      });
    }

    const counts = {};
    // Bound concurrency to protect PostgREST from unnecessary bursts.
    // A missing/denied table aborts the response; never report it as zero.
    for (let i = 0; i < DELETION_OWNER_TABLES.length; i += 4) {
      const batch = DELETION_OWNER_TABLES.slice(i, i + 4);
      const numbers = await Promise.all(batch.map(table => countOwnedRecords(table, userId)));
      for (let j = 0; j < batch.length; j++) counts[batch[j]] = numbers[j];
    }
    const billingReview = await readOwnedBillingLinks(userId);
    return response.status(200).json(deletionReviewReport(counts, entry.status, billingReview));
  } catch (error) {
    console.error('Owner deletion preflight failed', {
      type: error?.name === 'TimeoutError' ? 'upstream_timeout' : 'unverified_schema_or_count',
    });
    return response.status(error?.name === 'TimeoutError' ? 504 : 502).json({
      code: 'DELETION_INVENTORY_UNVERIFIED',
      error: 'Read-only deletion inventory is incomplete or unavailable. No data was deleted.',
    });
  }
}
