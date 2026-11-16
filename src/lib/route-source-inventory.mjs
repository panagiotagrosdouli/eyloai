// Static authored route inventory for the current src/App.jsx routing contract.
// This does not replace an interactive browser audit or discover routes declared
// in other files; release reviewers must explicitly approve the source inventory.
const ROUTE = /<Route\s+path\s*=\s*["']([^"']+)["']/g;
const EXCLUDE = new Set(['*', '/*']);

function collect(source) {
  return [...source.matchAll(ROUTE)]
    .map(match => match[1])
    .filter(path => !EXCLUDE.has(path));
}

export function extractRouteSourceInventory(source) {
  if (typeof source !== 'string') throw new TypeError('Routing source must be a string.');
  const app = source.indexOf('function App()');
  const authenticated = source.indexOf('const AuthenticatedApp =');
  const protectedGate = source.indexOf('<Route element={<ProtectedRoute />}>');
  if (app < 0 || authenticated < 0 || protectedGate < 0
    || !(authenticated < protectedGate && protectedGate < app)) {
    throw new Error('App routing architecture changed; route inventory must be reviewed.');
  }
  const explicitPublic = collect(source.slice(app));
  const auxiliaryOutsideGate = collect(source.slice(authenticated, protectedGate));
  const protectedRoutes = collect(source.slice(protectedGate, app));
  const publicRoutes = [...new Set([...explicitPublic, ...auxiliaryOutsideGate])].sort();
  const privateRoutes = [...new Set(protectedRoutes)].sort();
  if (publicRoutes.length < 1 || privateRoutes.length < 1) {
    throw new Error('Empty source route inventory is not acceptable.');
  }
  if (publicRoutes.some(path => !path.startsWith('/'))
    || privateRoutes.some(path => !path.startsWith('/'))) {
    throw new Error('Unexpected relative route; manual review is required.');
  }
  return { public_routes: publicRoutes, private_routes: privateRoutes };
}
