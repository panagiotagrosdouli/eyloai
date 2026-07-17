const FALLBACK_PATH = '/';

const ALLOWED_PREFIXES = [
  '/',
  '/library',
  '/projects',
  '/researchers',
  '/opportunities',
  '/history',
  '/profile',
  '/settings',
  '/ideas',
  '/labs',
];

function decodeCandidate(candidate: string): string | null {
  try {
    return decodeURIComponent(candidate);
  } catch {
    return null;
  }
}

export function getSafeRedirect(
  candidate: string | null | undefined,
  fallback = FALLBACK_PATH,
): string {
  if (!candidate) return fallback;

  const decoded = decodeCandidate(candidate.trim());
  if (!decoded) return fallback;
  if (!decoded.startsWith('/') || decoded.startsWith('//')) return fallback;
  if (/^[\s]*javascript:/i.test(decoded)) return fallback;
  if (decoded.includes('\\')) return fallback;

  try {
    const parsed = new URL(decoded, 'https://eylo.local');
    if (parsed.origin !== 'https://eylo.local') return fallback;

    const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    const allowed = ALLOWED_PREFIXES.some((prefix) =>
      prefix === '/' ? path === '/' : path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`),
    );

    return allowed ? path : fallback;
  } catch {
    return fallback;
  }
}
