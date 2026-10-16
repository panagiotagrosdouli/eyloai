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

// In deployed builds, route Supabase HTTP traffic through the EYLO domain.
// This keeps authentication and database requests working in browsers or
// networks that block direct navigation to *.supabase.co.
const supabaseUrl = typeof window !== 'undefined' && import.meta.env.PROD
  ? `${window.location.origin}/supabase`
  : environment.values.VITE_SUPABASE_URL;

// Prefer the same-origin gateway in production, with direct-provider fallback
// only when the gateway is unreachable or returns a non-JSON gateway error.
// Do not retry legitimate Supabase API errors (including failed signup).
const gatewayFetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input.url;
  const sameOriginGateway = typeof window !== 'undefined'
    && import.meta.env.PROD
    && url.startsWith(`${window.location.origin}/supabase/`);
  if (!sameOriginGateway) return fetch(input, init);

  const directUrl = url.replace(
    `${window.location.origin}/supabase/`,
    `${environment.values.VITE_SUPABASE_URL}/`,
  );
  try {
    const response = await fetch(input, init);
    const contentType = response.headers.get('content-type') || '';
    if ((response.status === 502 || response.status === 503 || response.status === 504
        || response.status === 404)
        && !contentType.includes('application/json')) {
      return fetch(directUrl, init);
    }
    return response;
  } catch {
    return fetch(directUrl, init);
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
  if (!required) return null;

  try {
    await client.auth.signOut({ scope: 'local' });
  } catch {
    // The in-memory AuthContext is still invalidated by the event below.
  }

  notifyAuthenticationRequired();
  throw new AuthenticationRequiredError(undefined, cause);
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
    // A transport/provider failure is not the same as an anonymous visitor.
    // Preserve the real error so the application can offer a retry.
    if (!required) throw result.error;
    return authenticationFailure(client, required, result.error);
  }
  if (!session?.access_token) {
    return authenticationFailure(client, required);
  }

  if (validate) {
    const verified = await client.auth.getUser(session.access_token);
    if (verified.error || !verified.data?.user) {
      if (!forceRefresh) {
        return getUsableSession({ forceRefresh: true, required, validate: true });
      }
      return authenticationFailure(client, required, verified.error);
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
