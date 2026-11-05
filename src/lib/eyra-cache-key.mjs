// Volatile EYRA caches must be scoped by authenticated user, day and exact inputs.
// Never use this key for localStorage/sessionStorage persistence.
export function makeEyraCacheKey(namespace, userId, scope, today = new Date()) {
  if (typeof namespace !== 'string' || !namespace.trim()) throw new TypeError('Cache namespace is required.');
  if (typeof userId !== 'string' || !userId.trim()) throw new TypeError('Authenticated user ID is required.');
  return JSON.stringify([namespace, userId, today.toISOString().slice(0, 10), scope]);
}
