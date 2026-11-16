import { apiUrl } from '@/lib/api-url';
import { getUsableSession, invalidateAuthentication, requireSupabase } from '@/lib/supabaseClient';
import { sessionRequest } from '@/lib/auth/sessionRequest.mjs';

/**
 * Call an authenticated EYLO API, refreshing and replaying once when a
 * browser token has expired. A second rejection invalidates the shared auth
 * state so every protected surface returns to sign-in consistently.
 */
export async function protectedApiFetch(url, options = {}) {
  return sessionRequest(apiUrl(url), options, {
    auth: requireSupabase().auth, getUsableSession, invalidateAuthentication,
  });
}
