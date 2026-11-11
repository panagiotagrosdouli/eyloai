/**
 * Private browser caches must not survive an account boundary.
 * Token refreshes within the same identity keep the user's current work.
 */
export function shouldClearPrivateCache(previousUserId, nextUserId, event) {
  if (event === 'SIGNED_OUT' || event === 'AUTH_REQUIRED') return true;
  return Boolean(previousUserId && previousUserId !== nextUserId);
}
