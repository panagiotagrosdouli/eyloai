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

export const supabase = isSupabaseConfigured
  ? createClient(
      supabaseUrl,
      environment.values.VITE_SUPABASE_ANON_KEY,
      {
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
    const error = new Error('Authentication service is not configured.');
    error.code = 'SUPABASE_CONFIGURATION_ERROR';
    throw error;
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

  if (!forceRefresh && (result.error || !session || expiresSoon(session))) {
    result = await client.auth.refreshSession();
    session = result.data?.session ?? null;
  }

  if (result.error || !session?.access_token) {
    return authenticationFailure(client, required, result.error);
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
