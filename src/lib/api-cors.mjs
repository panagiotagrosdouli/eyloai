const PUBLIC_ORIGINS = new Set([
  'https://panagiotagrosdouli.github.io',
  'https://eyloai.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

function parseOrigin(value) {
  try {
    const url = new URL(String(value || ''));
    if (!['https:', 'http:'].includes(url.protocol) || url.origin !== value) return null;
    return url;
  } catch {
    return null;
  }
}

export function isAllowedBrowserOrigin(origin, requestHost = '') {
  const parsed = parseOrigin(origin);
  if (!parsed) return false;
  if (PUBLIC_ORIGINS.has(parsed.origin)) return true;
  // Preview origins are allowed only when they match the actual request host
  // exactly and use HTTPS; never trust a caller-supplied HTTP origin.
  return parsed.protocol === 'https:'
    && Boolean(requestHost && parsed.host.toLowerCase() === String(requestHost).toLowerCase());
}

export function applyCors(request, response, methods = ['GET']) {
  const origin = request.headers?.origin;
  const allowed = isAllowedBrowserOrigin(origin, request.headers?.host);
  // Real HTTP responses support setHeader; lightweight handler test doubles may not.
  if (typeof response.setHeader === 'function') response.setHeader('Cache-Control', 'no-store');
  if (allowed) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
    response.setHeader('Access-Control-Allow-Methods', [...methods, 'OPTIONS'].join(', '));
    response.setHeader('Access-Control-Allow-Headers', 'Accept, Authorization, Content-Type');
    response.setHeader('Access-Control-Max-Age', '600');
  }

  if (request.method !== 'OPTIONS') return false;
  const requestedMethod = String(request.headers?.['access-control-request-method'] || '').toUpperCase();
  if (!allowed || !methods.includes(requestedMethod)) {
    response.setHeader('Allow', [...methods, 'OPTIONS'].join(', '));
    response.status(403).json({ error: 'Invalid cross-origin request.' });
    return true;
  }

  response.setHeader('Allow', [...methods, 'OPTIONS'].join(', '));
  response.status(204).end();
  return true;
}
