import { readSupabaseApiConfig } from './supabase-config.mjs';
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
  onUnavailable = (_diagnostic) => {},
} = {}) {
  // Only fixed classifications and HTTP status reach operator logs. Never pass
  // IPs, hashes, keys, request URLs, response bodies or exception messages.
  const unavailable = (reason, httpStatus = null) => {
    try { onUnavailable({ reason, http_status: httpStatus }); } catch { /* Logging must not bypass the quota guard. */ }
    return { status: 'unavailable' };
  };
  const config = readSupabaseApiConfig(env);
  const projectUrl = config.url;
  const serviceRoleKey = config.serverKey;
  if (!config.hasServerConfig) return unavailable('missing_server_configuration');
  if (typeof fetchImpl !== 'function') return unavailable('fetch_unavailable');

  const ip = getTrustedDiscoveryClientIp(request, env);
  const subjectHash = makeDiscoveryRateLimitSubject(ip, serviceRoleKey);
  if (!subjectHash) return unavailable('missing_trusted_client_ip');

  try {
    // Transient 502/503/504 responses may come from an overloaded gateway.
    // Retry once, but never bypass the durable quota or retry a potentially
    // committed request after a network error/timeout (which could double count).
    const rpcUrl = `${projectUrl}/rest/v1/rpc/consume_discovery_rate_limit`;
    const rpcOptions = {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        ...(!serviceRoleKey.startsWith('sb_') ? { authorization: `Bearer ${serviceRoleKey}` } : {}),
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        p_subject_hash: subjectHash,
        p_limit: limit,
        p_window_seconds: windowSeconds,
      }),
      signal: AbortSignal.timeout(6_000),
    };
    let result = await fetchImpl(rpcUrl, rpcOptions);
    if ([502, 503, 504].includes(result.status)) {
      await result.body?.cancel().catch(() => {});
      // Use a fresh timeout signal for the second attempt.
      result = await fetchImpl(rpcUrl, { ...rpcOptions, signal: AbortSignal.timeout(6_000) });
    }
    if (!result.ok) {
      const reason = result.status === 401 || result.status === 403 ? 'rpc_access_denied'
        : result.status === 404 ? 'rpc_not_found' : 'rpc_http_error';
      await result.body?.cancel().catch(() => {});
      return unavailable(reason, result.status);
    }
    let body;
    try { body = await result.json(); }
    catch (error) {
      return unavailable(error?.name === 'TimeoutError' || error?.name === 'AbortError'
        ? 'rpc_timeout' : 'invalid_rpc_response');
    }
    const record = Array.isArray(body) ? body[0] : body;
    if (typeof record?.allowed !== 'boolean'
      || !Number.isInteger(record.remaining)
      || !Number.isInteger(record.retry_after_seconds)) return unavailable('invalid_rpc_response');
    return {
      status: 'available',
      allowed: record.allowed,
      limit,
      remaining: Math.max(0, Math.min(limit, record.remaining)),
      retryAfterSeconds: Math.max(0, record.retry_after_seconds),
    };
  } catch (error) {
    return unavailable(error?.name === 'TimeoutError' || error?.name === 'AbortError'
      ? 'rpc_timeout' : 'rpc_network_error');
  }
}
