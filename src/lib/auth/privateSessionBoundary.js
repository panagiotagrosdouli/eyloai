/**
 * Cache data is scoped to the current account, never the browser as a whole.
 * Sign-out/auth revocation clears data even when a previous identity is unknown.
 */
export function shouldClearPrivateCache(previousUserId, nextUserId, event) {
  if (event === 'SIGNED_OUT' || event === 'AUTH_REQUIRED') return true;
  return Boolean(previousUserId && previousUserId !== nextUserId);
}
