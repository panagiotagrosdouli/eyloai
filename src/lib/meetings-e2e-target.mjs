/**
 * Refuse unapproved, production or insecure meeting E2E origins.
 * The environment must explicitly bind the test to one isolated staging host.
 */
export function validateMeetingsStagingTarget(rawUrl, allowedHost) {
  if (!rawUrl || !allowedHost) {
    throw new Error('An HTTPS staging URL and EYLO_E2E_ALLOWED_HOST are both required.');
  }
  let target;
  try {
    target = new URL(rawUrl);
  } catch {
    throw new Error('Invalid staging URL.');
  }
  const host = String(allowedHost).trim().toLowerCase();
  const prohibited = new Set(['eyloai.vercel.app', 'www.eyloai.vercel.app', 'eylo.ai', 'www.eylo.ai', 'localhost']);
  if (
    target.protocol !== 'https:' ||
    target.username || target.password ||
    target.port || target.pathname !== '/' || target.search || target.hash ||
    !host || host.includes('/') || host.includes(':') ||
    target.hostname !== host || prohibited.has(host) ||
    host === '127.0.0.1' || host === '::1' ||
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)
  ) {
    throw new Error('Meeting E2E requires an explicitly approved, non-production HTTPS staging hostname.');
  }
  return target;
}
