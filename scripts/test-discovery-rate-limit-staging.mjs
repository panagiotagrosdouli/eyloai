import { createHmac, randomBytes } from 'node:crypto';
import { readSupabaseApiConfig } from '../api/supabase-config.mjs';

const expectedRef = String(process.env.SUPABASE_STAGING_PROJECT_REF || '').trim();
if (process.env.SUPABASE_STAGING_ACKNOWLEDGED !== 'I_AM_AUTHORIZED_TO_TEST_STAGING') {
  throw new Error('Set SUPABASE_STAGING_ACKNOWLEDGED=I_AM_AUTHORIZED_TO_TEST_STAGING only after confirming this is the authorized staging project.');
}
if (!/^[a-z0-9]{20}$/.test(expectedRef)) {
  throw new Error('SUPABASE_STAGING_PROJECT_REF must be the 20-character ref of the authorized staging project.');
}

const config = readSupabaseApiConfig(process.env);
const actualRef = config.url ? new URL(config.url).hostname.split('.')[0] : '';
const hmacSecret = String(process.env.DISCOVERY_RATE_LIMIT_HMAC_KEY || '');
if (!config.hasServerConfig || actualRef !== expectedRef) {
  throw new Error('Configured Supabase URL/key do not match the explicitly acknowledged staging project.');
}
if (Buffer.byteLength(hmacSecret, 'utf8') < 32) {
  throw new Error('DISCOVERY_RATE_LIMIT_HMAC_KEY must contain at least 32 UTF-8 bytes.');
}

const rpcHeaders = {
  apikey: config.serverKey,
  'content-type': 'application/json',
  accept: 'application/json',
};
if (!process.env.SUPABASE_SECRET_KEY && config.serverKey.startsWith('eyJ')) {
  rpcHeaders.authorization = `Bearer ${config.serverKey}`;
}

const testHash = createHmac('sha256', hmacSecret)
  .update('eylo:discovery-rate-limit-staging-test:v1\0')
  .update(randomBytes(32))
  .digest('hex');
const endpoint = `${config.url}/rest/v1/rpc/consume_discovery_rate_limit`;

async function consume(now) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: rpcHeaders,
    cache: 'no-store',
    body: JSON.stringify({
      p_client_hash: testHash,
      p_window_seconds: 2,
      p_max_requests: 10,
      p_now: now.toISOString(),
    }),
  });
  if (!response.ok) throw new Error(`Staging rate-limit RPC returned HTTP ${response.status}.`);
  const payload = await response.json().catch(() => null);
  if (!Array.isArray(payload) || payload.length !== 1 || typeof payload[0].allowed !== 'boolean') {
    throw new Error('Staging rate-limit RPC returned an invalid decision.');
  }
  return payload[0];
}

const t0 = new Date();
const burst = await Promise.all(Array.from({ length: 30 }, () => consume(t0)));
const allowedAtBurst = burst.filter(decision => decision.allowed).length;
const retryValues = burst.filter(decision => !decision.allowed).map(decision => decision.retry_after_seconds);
if (allowedAtBurst !== 10) {
  throw new Error(`Atomic burst test expected exactly 10 of 30 calls to pass; received ${allowedAtBurst}.`);
}
if (retryValues.some(value => !Number.isInteger(value) || value < 1 || value > 2)) {
  throw new Error('Denied burst requests did not return a valid Retry-After interval.');
}

const refilledToken = await consume(new Date(t0.getTime() + 250));
if (!refilledToken.allowed) throw new Error('Token bucket did not refill one token after 250 ms.');

const fullRefill = await consume(new Date(t0.getTime() + 2_000));
if (!fullRefill.allowed) throw new Error('Token bucket did not recover after one full refill interval.');

const backwardsClock = await consume(new Date(t0.getTime() + 1_000));
if (!backwardsClock.allowed) throw new Error('A backward clock input corrupted the active token bucket.');

console.log('Staging rate-limit test passed: atomic 30-request burst (10 allowed), Retry-After, refill and clock-order checks.');
console.log('One pseudonymous test counter was created; it expires after 24 hours of inactivity plus up to five minutes for cleanup.');
