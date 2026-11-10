import { createClient } from '@supabase/supabase-js';
import { environment } from '@/lib/config/env';

export const isSupabaseConfigured = environment.ok;
export const AUTH_REQUIRED_EVENT = 'eylo:auth-required';

export class AuthenticationRequiredError extends Error {
  constructor(message = 'Your secure session expired. Sign in again to continue.', cause) {
    super(message, cause ? { cause } : undefined);
    this.name = 'AuthenticationRequiredError';
    this.code = 'AUTHENTICATION_REQUIRED';
    this.status = 401;
  }
}

// Use the configured Supabase project directly for authentication and data.
// The historical /supabase Vercel rewrite is hard-coded to one project and may
// silently send credentials to the wrong tenant if environment settings change.
// A matching-project gateway may still be used by explicitly configuring it.
const gatewayProjectUrl = 'https://kbzjngpzxpniaumlupaa.supabase.co';
const allowGateway = import.meta.env.PROD
  && typeof window !== 'undefined'
  && environment.values.VITE_SUPABASE_URL === gatewayProjectUrl
  && import.meta.env.VITE_SUPABASE_USE_PROXY === 'true';

const supabaseUrl = allowGateway
  ? `${window.location.origin}/supabase`
  : environment.values.VITE_SUPABASE_URL;

const SUPABASE_REQUEST_TIMEOUT_MS = 15_000;

async function fetchWithTimeout(input, init = {}) {
  const controller = new AbortController();
  const requestSignal = init.signal
    || (typeof Request !== 'undefined' && input instanceof Request ? input.signal : undefined);
  const abortFromRequest = () => controller.abort(requestSignal?.reason);
  if (requestSignal?.aborted) {
    abortFromRequest();
  } else {
    requestSignal?.addEventListener('abort', abortFromRequest, { once: true });
  }
  const timeoutId = setTimeout(() => controller.abort(), SUPABASE_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
    requestSignal?.removeEventListener('abort', abortFromRequest);
  }
}

const gatewayFetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input.url;
  if (!allowGateway || !url.startsWith(`${window.location.origin}/supabase/`)) {
    return fetchWithTimeout(input, init);
  }
  const directUrl = url.replace(
    `${window.location.origin}/supabase/`,
    `${environment.values.VITE_SUPABASE_URL}/`,
  );
  try {
    const response = await fetchWithTimeout(input, init);
    const type = response.headers.get('content-type') || '';
    if ([404, 502, 503, 504].includes(response.status) && !type.includes('application/json')) {
      return fetchWithTimeout(directUrl, init);
    }
    return response;
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    return fetchWithTimeout(directUrl, init);
  }
};

export const supabase = isSupabaseConfigured
  ? createClient(
      supabaseUrl,
      environment.values.VITE_SUPABASE_ANON_KEY,
      {
        global: { fetch: gatewayFetch },
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      },
    )
  : null;

export function requireSupabase() {
  if (!supabase) {
    throw Object.assign(
      new Error('Authentication service is not configured.'),
      { code: 'SUPABASE_CONFIGURATION_ERROR' },
    );
  }

  return supabase;
}

function expiresSoon(session) {
  return Boolean(
    session?.expires_at
    && session.expires_at <= Math.floor(Date.now() / 1000) + 60,
  );
}

function notifyAuthenticationRequired() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT));
  }
}

async function authenticationFailure(client, required, cause) {
  // No session is an expected anonymous state. A supplied cause means the
  // server rejected an existing credential, which must be cleared locally.
  if (!required && !cause) return null;

  try {
    await client.auth.signOut({ scope: 'local' });
  } catch {
    // The in-memory AuthContext is still invalidated by the event below.
  }

  notifyAuthenticationRequired();
  if (!required) return null;
  throw new AuthenticationRequiredError(undefined, cause);
}

function isTransientAuthError(error) {
  const status = Number(error?.status || 0);
  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '').toLowerCase();
  return status === 429
    || status >= 500
    || !status
    || code === 'over_request_rate_limit'
    || message.includes('fetch')
    || message.includes('network');
}

/**
 * Return a non-expired Supabase session and optionally verify it with the
 * authentication server. All protected features share this renewal path so a
 * stale browser token cannot leave one tool working while another is blocked.
 */
export async function getUsableSession({
  forceRefresh = false,
  required = true,
  validate = false,
} = {}) {
  const client = requireSupabase();

  let result = forceRefresh
    ? await client.auth.refreshSession()
    : await client.auth.getSession();
  let session = result.data?.session ?? null;

  // An anonymous visitor has no refresh token. Do not attempt to refresh
  // an absent session: a missing session is normal, not an auth outage.
  if (!forceRefresh && session && (result.error || expiresSoon(session))) {
    result = await client.auth.refreshSession();
    session = result.data?.session ?? null;
  }

  if (result.error) {
    // A server outage or fetch error must never erase the user's local session.
    // Only a confirmed missing/invalid session should trigger sign-out.
    if (isTransientAuthError(result.error)) throw result.error;
    return authenticationFailure(client, required, result.error);
  }
  if (!session?.access_token) {
    return authenticationFailure(client, required);
  }

  if (validate) {
    const verified = await client.auth.getUser(session.access_token);
    if (verified.error || !verified.data?.user) {
      if (verified.error && isTransientAuthError(verified.error)) throw verified.error;
      if (!forceRefresh) {
        const refreshed = await getUsableSession({ forceRefresh: true, required, validate: true });
        if (refreshed) return refreshed;
      }
      return authenticationFailure(
        client,
        required,
        verified.error || new Error('Supabase did not return a verified user.'),
      );
    }
    session = { ...session, user: verified.data.user };
  }

  return session;
}

/**
 * Invalidate a token rejected by a protected server endpoint and notify the
 * router to send the user through a clean sign-in flow.
 */
export async function invalidateAuthentication(cause) {
  const client = requireSupabase();
  try {
    await client.auth.signOut({ scope: 'local' });
  } catch {
    // The AuthContext event below is the source of truth for the UI state.
  }
  notifyAuthenticationRequired();
  return new AuthenticationRequiredError(undefined, cause);
}
