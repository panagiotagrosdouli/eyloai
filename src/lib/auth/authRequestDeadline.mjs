// Supabase Auth can remain pending if the provider or network never settles.
// A deadline releases the UI spinner. It cannot cancel an already accepted
// provider request; callers must not claim the request was definitely rejected.
export const AUTH_REQUEST_TIMEOUT_MS = 15000;

export class AuthRequestTimeoutError extends Error {
  constructor() {
    super('The authentication request did not settle before the deadline.');
    this.name = 'AuthRequestTimeoutError';
    this.code = 'AUTH_REQUEST_TIMEOUT';
  }
}

export async function withAuthRequestDeadline(operation, timeoutMs = AUTH_REQUEST_TIMEOUT_MS) {
  if (typeof operation !== 'function') throw new TypeError('Auth operation must be callable.');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) throw new RangeError('Invalid auth timeout.');
  let timeout;
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new AuthRequestTimeoutError()), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}
