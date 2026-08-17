import { getUsableSession, invalidateAuthentication } from '@/lib/supabaseClient';

async function requestWithSession(url, options, forceRefresh) {
  const session = await getUsableSession({
    forceRefresh,
    required: true,
    validate: true,
  });

  return fetch(url, {
    ...options,
    headers: {
      ...options?.headers,
      authorization: `Bearer ${session.access_token}`,
    },
  });
}

/**
 * Call an authenticated EYLO API, refreshing and replaying once when a
 * browser token has expired. A second rejection invalidates the shared auth
 * state so every protected surface returns to sign-in consistently.
 */
export async function protectedApiFetch(url, options = {}) {
  let response = await requestWithSession(url, options, false);
  if (response.status === 401) response = await requestWithSession(url, options, true);

  if (response.status === 401) {
    throw await invalidateAuthentication();
  }

  return response;
}
