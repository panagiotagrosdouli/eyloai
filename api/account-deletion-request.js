import {
  deletionIntakeEnabled, deletionPreflightEnabled, validDeletionRequestBody, validUserId,
} from '../src/lib/account-deletion-request-policy.mjs';

const SUPABASE_URL = 'https://kbzjngpzxpniaumlupaa.supabase.co';
const SUPPORTED_METHODS = 'GET, POST';
const REQUEST_TABLE = 'account_deletion_requests';
const NOTICE = 'This records a request for review only. Your account and data have NOT been deleted, and any Stripe subscription remains unchanged.';

function publicKey() {
  return process.env.SUPABASE_PUBLISHABLE_KEY
    || process.env.SUPABASE_ANON_KEY
    || process.env.VITE_SUPABASE_ANON_KEY;
}

export function serverHeaders() {
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const headers = { apikey: key, accept: 'application/json' };
  if (!key.startsWith('sb_')) headers.authorization = `Bearer ${key}`;
  return headers;
}

export async function verifiedUser(authorization) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: publicKey(), authorization },
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) return null;
    throw new Error('Supabase authentication verification unavailable.');
  }
  const body = await response.json();
  if (!validUserId(body?.id)) throw new Error('Supabase returned an invalid authenticated identity.');
  return body.id;
}

export async function existingRequest(userId) {
  const path = `${REQUEST_TABLE}?user_id=eq.${encodeURIComponent(userId)}&select=status,requested_at&limit=1`;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: serverHeaders(),
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error('Account deletion intake status query failed.');
  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length > 1 || (rows[0] && (
    !['pending_review', 'in_review', 'blocked_billing', 'completed', 'declined'].includes(rows[0].status)
    || typeof rows[0].requested_at !== 'string'
  ))) throw new Error('Account deletion intake has invalid database schema or status.');
  return rows[0] || null;
}

async function createRequest(userId) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${REQUEST_TABLE}`, {
    method: 'POST',
    headers: {
      ...serverHeaders(),
      'content-type': 'application/json',
      Prefer: 'resolution=ignore-duplicates,return=minimal',
    },
    body: JSON.stringify({ user_id: userId }),
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });
  // In concurrent requests, a database primary-key conflict means another
  // request won the race. Its row must still be verified by the next read.
  if (!response.ok && response.status !== 409) {
    throw new Error('Account deletion intake insert failed.');
  }
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'private, no-store');
  if (!['GET', 'POST'].includes(request.method)) {
    response.setHeader('Allow', SUPPORTED_METHODS);
    return response.status(405).json({ error: 'Method not allowed.' });
  }
  if (!deletionIntakeEnabled()) {
    return response.status(503).json({
      code: 'DELETION_REQUESTS_UNAVAILABLE',
      error: 'Account deletion requests cannot be recorded until verified database setup and privacy review.',
    });
  }
  const auth = request.headers?.authorization;
  if (typeof auth !== 'string' || !/^Bearer [A-Za-z0-9._~-]+$/.test(auth)) {
    return response.status(401).json({ error: 'Authentication required.' });
  }
  if (request.method === 'POST' && !validDeletionRequestBody(request.body)) {
    return response.status(400).json({
      error: 'Explicit confirmation is required. Only the signed-in account can submit its own request.',
    });
  }

  try {
    const userId = await verifiedUser(auth);
    if (!userId) return response.status(401).json({ error: 'Authentication required.' });

    let entry = await existingRequest(userId);
    if (request.method === 'POST' && !entry) {
      await createRequest(userId);
      entry = await existingRequest(userId);
      if (!entry) throw new Error('Account deletion request could not be verified after submission.');
    }

    return response.status(request.method === 'POST' ? 202 : 200).json({
      enabled: true,
      preflight_available: deletionPreflightEnabled(),
      request_status: entry?.status || 'not_requested',
      requested_at: entry?.requested_at || null,
      notice: NOTICE,
    });
  } catch (error) {
    console.error('Deletion request intake failed', {
      type: error?.name === 'TimeoutError' ? 'upstream_timeout' : 'verification_or_write_failure',
    });
    return response.status(error?.name === 'TimeoutError' ? 504 : 502).json({
      error: 'Account deletion request status is temporarily unavailable. No deletion has been performed.',
      code: 'DELETION_REQUEST_UNVERIFIED',
    });
  }
}
