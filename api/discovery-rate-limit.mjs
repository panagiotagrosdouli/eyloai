import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { readSupabaseApiConfig } from './supabase-config.mjs';

export const DISCOVERY_RATE_LIMIT = Object.freeze({
  requests: 60,
  windowSeconds: 60,
  timeoutMs: 2_500,
});

function canonicalIp(value) {
  const candidate = String(value || '').trim().replace(/^\[|\]$/g, '');
  if (!isIP(candidate)) return '';
  if (isIP(candidate) === 4) return candidate;
  try {
    return new URL(`http://[${candidate}]/`).hostname.slice(1, -1).toLowerCase();
  } catch {
    return '';
  }
}

function expandIpv6(address) {
  const [left = '', right] = address.split('::');
  const leftWords = left ? left.split(':') : [];
  const rightWords = right ? right.split(':') : [];
  const zeros = address.includes('::') ? 8 - leftWords.length - rightWords.length : 0;
  const words = [...leftWords, ...Array(zeros).fill('0'), ...rightWords];
  return words.length === 8 ? words.map(word => Number.parseInt(word || '0', 16)) : null;
}

function clientNetwork(value) {
  const ip = canonicalIp(value);
  if (!ip) return '';
  if (isIP(ip) === 4) return `ipv4:${ip}`;

  const words = expandIpv6(ip);
  if (!words) return '';
  const bits = words.reduce((result, word) => (result << 16n) | BigInt(word), 0n);
  // Normalize IPv4-mapped IPv6 so the same address cannot obtain two buckets.
  if ((bits >> 32n) === 0xffffn) {
    const mapped = Number(bits & 0xffffffffn);
    return `ipv4:${[(mapped >>> 24) & 255, (mapped >>> 16) & 255, (mapped >>> 8) & 255, mapped & 255].join('.')}`;
  }
  // IPv6 temporary interface identifiers rotate. Use the standard SLAAC /64
  // subnet as the abuse bucket, and document that a subnet shares its quota.
  return `ipv6:${words.slice(0, 4).map(word => word.toString(16)).join(':')}::/64`;
}

/**
 * Vercel overwrites x-forwarded-for to prevent spoofing. Prefer its dedicated
 * copy, and accept socket IP only outside Vercel for local/server test runs.
 */
export function getTrustedDiscoveryClientIp(request, env = process.env) {
  const headers = request?.headers || {};
  const vercelIp = headers['x-vercel-forwarded-for'];
  if (typeof vercelIp === 'string' && vercelIp.trim()) {
    return canonicalIp(vercelIp.split(',')[0]);
  }
  if (env.VERCEL === '1' || env.VERCEL === 'true') return '';
  return canonicalIp(request?.socket?.remoteAddress);
}

export function discoveryClientHash(clientIp, hmacSecret) {
  const network = clientNetwork(clientIp);
  const secret = String(hmacSecret || '');
  if (!network || Buffer.byteLength(secret, 'utf8') < 32) return '';
  return createHmac('sha256', secret)
    .update('eylo:discovery-rate-limit:v1\0')
    .update(network)
    .digest('hex');
}

function serviceApiHeaders(config, env) {
  const headers = {
    apikey: config.serverKey,
    'content-type': 'application/json',
    accept: 'application/json',
  };
  // Modern sb_secret keys are opaque API keys, not JWTs. Legacy service_role
  // keys are JWTs and remain supported until the project rotates to new keys.
  if (!env.SUPABASE_SECRET_KEY && config.serverKey.startsWith('eyJ')) {
    headers.authorization = `Bearer ${config.serverKey}`;
  }
  return headers;
}

/** @param {{request?: {headers?: Record<string, string | string[] | undefined>, socket?: {remoteAddress?: string}}, env?: Record<string, string | undefined>, fetchImpl?: typeof fetch}} [options] */
export async function consumeDiscoveryRateLimit({ request, env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const config = readSupabaseApiConfig(env);
  const clientIp = getTrustedDiscoveryClientIp(request, env);
  const clientHash = discoveryClientHash(clientIp, env.DISCOVERY_RATE_LIMIT_HMAC_KEY);
  if (!config.hasServerConfig || !clientHash) {
    return { status: 'unconfigured' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DISCOVERY_RATE_LIMIT.timeoutMs);
  try {
    const response = await fetchImpl(`${config.url}/rest/v1/rpc/consume_discovery_rate_limit`, {
      method: 'POST',
      headers: serviceApiHeaders(config, env),
      body: JSON.stringify({
        p_client_hash: clientHash,
        p_window_seconds: DISCOVERY_RATE_LIMIT.windowSeconds,
        p_max_requests: DISCOVERY_RATE_LIMIT.requests,
      }),
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) return { status: 'unavailable' };
    const result = await response.json().catch(() => null);
    const decision = Array.isArray(result) && result.length === 1 ? result[0] : null;
    if (!decision || typeof decision.allowed !== 'boolean') return { status: 'unavailable' };
    if (decision.allowed) return { status: 'allowed' };
    const retryAfterSeconds = Number(decision.retry_after_seconds);
    if (!Number.isInteger(retryAfterSeconds) || retryAfterSeconds < 1 || retryAfterSeconds > DISCOVERY_RATE_LIMIT.windowSeconds) {
      return { status: 'unavailable' };
    }
    return { status: 'limited', retryAfterSeconds };
  } catch {
    return { status: 'unavailable' };
  } finally {
    clearTimeout(timeout);
  }
}
