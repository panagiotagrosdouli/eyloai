// Public academic search history can reveal sensitive research interests.
// Never reuse unscoped legacy browser keys across authenticated identities.
const PREFIX = 'eylo:research-home:v2';
const ALLOWED_LISTS = new Set(['saved', 'history']);

export function discoveryBrowserScope(authStatus, userId) {
  if (authStatus === 'authenticated') {
    const id = typeof userId === 'string' ? userId.trim() : '';
    return id ? { namespace: `owner:${encodeURIComponent(id)}`, storage: 'local' } : null;
  }
  // Anonymous work is tab-scoped; never assign guest searches to a later login.
  if (authStatus === 'anonymous' || authStatus === 'configuration-error') {
    return { namespace: 'guest', storage: 'session' };
  }
  // During auth restoration and errors, show no potentially foreign history.
  return null;
}

export function discoveryBrowserListKey(scope, type) {
  if (!scope || !ALLOWED_LISTS.has(type)
      || !/^(?:owner:[^:]+|guest)$/.test(scope.namespace)) return '';
  return `${PREFIX}:${scope.namespace}:${type}`;
}

function storageFor(scope, storages) {
  return scope?.storage === 'local' ? storages?.local
    : scope?.storage === 'session' ? storages?.session : null;
}

export function readDiscoveryBrowserList(scope, type, storages) {
  const key = discoveryBrowserListKey(scope, type);
  if (!key) return [];
  try {
    const value = JSON.parse(storageFor(scope, storages)?.getItem(key) || '[]');
    return Array.isArray(value) ? value.slice(0, 100) : [];
  } catch {
    return [];
  }
}

export function writeDiscoveryBrowserList(scope, type, values, storages) {
  const key = discoveryBrowserListKey(scope, type);
  if (!key || !Array.isArray(values)) return false;
  try {
    storageFor(scope, storages)?.setItem(key, JSON.stringify(values.slice(0, 100)));
    return Boolean(storageFor(scope, storages));
  } catch {
    return false;
  }
}

export function clearDeletedDiscoveryBrowserData(local, userId) {
  const scope = discoveryBrowserScope('authenticated', userId);
  if (!scope) throw new Error('Expected deleted account identity.');
  for (const type of ALLOWED_LISTS) local.removeItem(discoveryBrowserListKey(scope, type));
}
