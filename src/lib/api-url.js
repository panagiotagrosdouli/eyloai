const GITHUB_PAGES_BASE = '/eyloai/';
const VERCEL_API_ORIGIN = 'https://eyloai.vercel.app';

export function apiUrl(path) {
  const pathname = String(path || '');
  if (!pathname.startsWith('/') || pathname.startsWith('//')) {
    throw new TypeError('API paths must be absolute paths on the current host.');
  }
  const origin = import.meta.env?.BASE_URL === GITHUB_PAGES_BASE ? VERCEL_API_ORIGIN : '';
  return origin + pathname;
}
