// Bounded, per-runtime protection. Distributed client quotas are a separate gate.
const GAPS = { semantic_scholar: 1000, arxiv: 3000, europe_pmc: 100, crossref: 100 };
export function providerMinimumGap(provider) { return GAPS[provider] ?? 100; }

export function createScholarlyResilience({ now = Date.now, sleep = (ms, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) return reject(signal.reason);
  const abort = () => { clearTimeout(timer); reject(signal.reason); };
  const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, ms);
  signal?.addEventListener('abort', abort, { once: true });
}), maxEntries = 128, maxBytes = 16 * 1024 * 1024, ttlMs = 300_000 } = {}) {
  const cache = new Map();
  const providers = new Map();
  const inFlight = new Map();
  let bytes = 0;
  const evict = key => { const item = cache.get(key); if (item) bytes -= item.body.length; cache.delete(key); };
  const blocked = (status, seconds, code) => ({ status, body: Buffer.from(JSON.stringify({ error: 'Scholarly source is temporarily unavailable. Other sources may still return results.', code })), retryAfter: String(seconds), cache: 'BYPASS' });

  return {
    reset() { cache.clear(); providers.clear(); inFlight.clear(); bytes = 0; },
    async execute(provider, key, operation, { signal } = /** @type {{signal?: AbortSignal}} */ ({})) {
      signal?.throwIfAborted();
      const cached = cache.get(key);
      if (cached && cached.expires > now()) return { ...cached, body: Buffer.from(cached.body), cache: 'HIT' };
      if (cached) evict(key);
      if (inFlight.has(key)) return inFlight.get(key);
      const group = provider.startsWith('openalex_') ? 'openalex' : provider;
      const state = providers.get(group) || { failures: 0, until: 0, lastStart: -Infinity, busy: false, status: 503 };
      providers.set(group, state);
      if (state.until > now()) return blocked(state.status, Math.ceil((state.until - now()) / 1000), 'SOURCE_COOLDOWN');
      if (state.busy) return blocked(429, 1, 'SOURCE_BUSY');
      state.busy = true;
      const task = (async () => {
        try {
          const delay = Math.max(0, state.lastStart + providerMinimumGap(provider) - now());
          if (delay) await sleep(delay, signal);
          signal?.throwIfAborted();
          state.lastStart = now();
          const result = await operation();
          if (result.status === 429) {
            const raw = String(result.retryAfter || '').trim();
            const seconds = /^\d+(?:\.\d+)?$/.test(raw) ? Number(raw) : (Date.parse(raw) - now()) / 1000;
            state.until = now() + (Number.isFinite(seconds) && seconds >= 0 ? Math.min(86_400, Math.max(1, seconds)) : 30) * 1000;
            state.status = 429;
            if (!result.retryAfter) result.retryAfter = String(Math.ceil((state.until - now()) / 1000));
          } else if (result.status >= 500) {
            state.failures++;
            if (state.failures >= 3) { state.until = now() + 15_000; state.status = 503; }
          } else if (result.status >= 200 && result.status < 300) {
            state.failures = 0; state.until = 0;
          }
          if (result.status === 200 && result.cacheable === true && result.body.length <= maxBytes) {
            while (cache.size && (cache.size >= maxEntries || bytes + result.body.length > maxBytes)) evict(cache.keys().next().value);
            const item = { ...result, body: Buffer.from(result.body), expires: now() + ttlMs };
            cache.set(key, item); bytes += item.body.length;
          }
          return { ...result, cache: 'MISS' };
        } catch (error) {
          if (!signal?.aborted && ++state.failures >= 3) { state.until = now() + 15_000; state.status = 503; }
          throw error;
        } finally { state.busy = false; inFlight.delete(key); }
      })();
      inFlight.set(key, task);
      return task;
    },
  };
}

export const scholarlyResilience = createScholarlyResilience();
