import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';

export const DISCOVERY_RATE_LIMIT = Object.freeze({ limit: 120, windowSeconds: 600 });

function header(request, name) {
  const headers = request?.headers;
  if (typeof headers?.get === 'function') return headers.get(name);
  return headers?.[name] || headers?.[name.toLowerCase()] || '';
}

function normalizeIp(value) {
  const candidate = String(value || '').trim().replace(/^\[|\]$/g, '');
  const mapped = candidate.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i)?.[1];
  if (mapped) return isIP(mapped) === 4 ? mapped : '';
  return isIP(candidate) ? candidate.toLowerCase() : '';
}

/**
 * Vercel overwrites X-Forwarded-For to prevent client spoofing. Outside
 * Vercel, only use the socket peer unless a trusted proxy is configured.
 */
export function getTrustedDiscoveryClientIp(request, env = process.env) {
  if (env.VERCEL === '1') {
    const forwarded = header(request, 'x-vercel-forwarded-for') || header(request, 'x-forwarded-for');
    return String(forwarded || '').split(',').map(normalizeIp).find(Boolean) || '';
  }
  return normalizeIp(request?.socket?.remoteAddress);
}

export function makeDiscoveryRateLimitSubject(ip, serviceRoleKey) {
  const normalizedIp = normalizeIp(ip);
  const key = String(serviceRoleKey || '').trim();
  if (!normalizedIp || !key) return '';
  return createHmac('sha256', key).update(`eylo-discovery-ip:v1:${normalizedIp}`).digest('hex');
}

export async function consumeDiscoveryQuota(request, {
  env = process.env,
  fetchImpl = globalThis.fetch,
  limit = DISCOVERY_RATE_LIMIT.limit,
  windowSeconds = DISCOVERY_RATE_LIMIT.windowSeconds,
} = {}) {
  const projectUrl = String(env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
  const serviceRoleKey = String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  let validProjectUrl = false;
  try {
    const parsed = new URL(projectUrl);
    validProjectUrl = parsed.protocol === 'https:'
      && parsed.hostname.endsWith('.supabase.co')
      && !parsed.username && !parsed.password && !parsed.port
      && parsed.pathname === '/' && !parsed.search && !parsed.hash;
  } catch { /* missing and malformed config fail closed */ }
  if (!validProjectUrl || !serviceRoleKey || typeof fetchImpl !== 'function') {
    return { status: 'unavailable' };
  }

  const ip = getTrustedDiscoveryClientIp(request, env);
  const subjectHash = makeDiscoveryRateLimitSubject(ip, serviceRoleKey);
  if (!subjectHash) return { status: 'unavailable' };

  try {
    const result = await fetchImpl(`${projectUrl}/rest/v1/rpc/consume_discovery_rate_limit`, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        p_subject_hash: subjectHash,
        p_limit: limit,
        p_window_seconds: windowSeconds,
      }),
      signal: AbortSignal.timeout(3_000),
    });
    if (!result.ok) return { status: 'unavailable' };
    const body = await result.json();
    const record = Array.isArray(body) ? body[0] : body;
    if (typeof record?.allowed !== 'boolean'
      || !Number.isInteger(record.remaining)
      || !Number.isInteger(record.retry_after_seconds)) return { status: 'unavailable' };
    return {
      status: 'available',
      allowed: record.allowed,
      limit,
      remaining: Math.max(0, Math.min(limit, record.remaining)),
      retryAfterSeconds: Math.max(0, record.retry_after_seconds),
    };
  } catch {
    return { status: 'unavailable' };
  }
}
