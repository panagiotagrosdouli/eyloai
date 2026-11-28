import { createHash } from 'node:crypto';
import { readSupabaseApiConfig } from './supabase-config.mjs';

const PROVIDERS = new Set(['openalex', 'semantic_scholar', 'arxiv', 'europe_pmc', 'crossref']);
const MAX_RETRY_SECONDS = 86_400;

export class ProviderCoordinationError extends Error {
  constructor(code) {
    super('Shared scholarly provider controls are unavailable.');
    this.name = 'ProviderCoordinationError';
    this.code = code;
  }
}

export function scholarlyProviderGroup(provider) {
  return provider.startsWith('openalex_') ? 'openalex' : provider;
}

export function scholarlyCacheKey(provider, identity) {
  return createHash('sha256').update(`eylo-scholarly-cache:v1:${provider}:${JSON.stringify(identity)}`).digest('hex');
}

function safeRetryAfter(value) {
  const seconds = Number(value);
  return Number.isInteger(seconds) && seconds >= 0 && seconds <= MAX_RETRY_SECONDS ? seconds : 0;
}

export function createScholarlyProviderCoordinator({ env = process.env, fetchImpl = null } = {}) {
  async function rpc(name, args) {
    const config = readSupabaseApiConfig(env);
    const request = fetchImpl || globalThis.fetch;
    if (!config.hasServerConfig || typeof request !== 'function') throw new ProviderCoordinationError('configuration');
    let response;
    try {
      response = await request(`${config.url}/rest/v1/rpc/${name}`, {
        method: 'POST',
        headers: {
          apikey: config.serverKey,
          ...(!config.serverKey.startsWith('sb_') ? { authorization: `Bearer ${config.serverKey}` } : {}),
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify(args),
        cache: 'no-store',
        signal: AbortSignal.timeout(6_000),
      });
    } catch (error) {
      throw new ProviderCoordinationError(error?.name === 'TimeoutError' || error?.name === 'AbortError' ? 'timeout' : 'network');
    }
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      throw new ProviderCoordinationError(response.status === 401 || response.status === 403 ? 'permission' : 'rpc');
    }
    try { return await response.json(); }
    catch { throw new ProviderCoordinationError('response'); }
  }

  return Object.freeze({
    async readCache(cacheKey) {
      if (!/^[a-f0-9]{64}$/.test(cacheKey)) throw new ProviderCoordinationError('cache_key');
      const result = await rpc('read_scholarly_provider_cache', { p_cache_key: cacheKey });
      const record = Array.isArray(result) ? result[0] : result;
      if (!record) return null;
      if (typeof record.body !== 'string' || !['application/json', 'application/atom+xml'].includes(record.content_type)) {
        throw new ProviderCoordinationError('cache_response');
      }
      return { body: record.body, contentType: record.content_type };
    },

    async reserve({ provider, cacheKey, minIntervalMs, maxConcurrent = 1, leaseSeconds = 45 }) {
      if (!PROVIDERS.has(provider) || !/^[a-f0-9]{64}$/.test(cacheKey) || !Number.isInteger(minIntervalMs) || minIntervalMs < 0 || minIntervalMs > 60_000) {
        throw new ProviderCoordinationError('reservation_input');
      }
      const result = await rpc('reserve_scholarly_provider_slot', {
        p_provider: provider,
        p_cache_key: cacheKey,
        p_min_interval_ms: minIntervalMs,
        p_max_concurrent: maxConcurrent,
        p_lease_seconds: leaseSeconds,
      });
      const record = Array.isArray(result) ? result[0] : result;
      if (typeof record?.allowed !== 'boolean' || typeof record.status !== 'string') throw new ProviderCoordinationError('reservation_response');
      if (record.allowed && typeof record.lease_id !== 'string') throw new ProviderCoordinationError('reservation_response');
      return {
        ...record,
        retry_after_seconds: safeRetryAfter(record.retry_after_seconds),
      };
    },

    async finish({ provider, leaseId, status, retryAfterSeconds = 0 }) {
      if (!PROVIDERS.has(provider) || typeof leaseId !== 'string' || !Number.isInteger(status) || status < 100 || status > 599) {
        throw new ProviderCoordinationError('completion_input');
      }
      const result = await rpc('finish_scholarly_provider_request', {
        p_provider: provider,
        p_lease_id: leaseId,
        p_status: status,
        p_retry_after_seconds: safeRetryAfter(retryAfterSeconds),
      });
      const record = Array.isArray(result) ? result[0] : result;
      return record === true || record?.finish_scholarly_provider_request === true;
    },

    async writeCache({ cacheKey, provider, body, contentType, ttlSeconds }) {
      if (!/^[a-f0-9]{64}$/.test(cacheKey) || !PROVIDERS.has(provider)
        || typeof body !== 'string' || Buffer.byteLength(body) > 2_097_152
        || !['application/json', 'application/atom+xml'].includes(contentType)
        || !Number.isInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > 21_600) {
        throw new ProviderCoordinationError('cache_input');
      }
      const result = await rpc('write_scholarly_provider_cache', {
        p_cache_key: cacheKey,
        p_provider: provider,
        p_body: body,
        p_content_type: contentType,
        p_ttl_seconds: ttlSeconds,
      });
      const record = Array.isArray(result) ? result[0] : result;
      if (!(record === true || record?.write_scholarly_provider_cache === true)) throw new ProviderCoordinationError('cache_write');
      return true;
    },
  });
}

export const scholarlyProviderCoordinator = createScholarlyProviderCoordinator();
