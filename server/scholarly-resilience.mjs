// Bounded, per-runtime protection. Distributed client quotas are a separate gate.
const GAPS = { semantic_scholar: 1000, arxiv: 3000, europe_pmc: 100 };
export function providerMinimumGap(provider, query = '', env = process.env) {
  if (provider.startsWith('openalex_')) {
    const booleanOperators = String(query).match(/\b(?:AND|OR|NOT)\b/gi)?.length || 0;
    // OpenAlex allows 10 requests/second generally, but broad Boolean searches
    // have a strict one-per-second limit without bursts.
    return booleanOperators > 5 ? 1000 : 100;
  }
  if (provider === 'crossref') {
    const email = String(env.RESEARCH_CONTACT_EMAIL || env.VITE_RESEARCH_CONTACT_EMAIL || '').trim();
    // Crossref public search is 1 rps; the polite pool (mailto) allows 3 rps.
    return email ? 334 : 1000;
  }
  return GAPS[provider] ?? 100;
}

function boundedRetryAfterSeconds(value, now) {
  const raw = String(value || '').trim();
  const seconds = /^\d+(?:\.\d+)?$/.test(raw)
    ? Number(raw)
    : (Date.parse(raw) - now) / 1000;
  if (!Number.isFinite(seconds) || seconds < 0) return 30;
  return Math.min(86_400, Math.max(1, Math.ceil(seconds)));
}

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
    async execute(provider, key, operation, { signal, minGapMs } = /** @type {{signal?: AbortSignal, minGapMs?: number}} */ ({})) {
      signal?.throwIfAborted();
      const gapMs = Number.isFinite(minGapMs) && minGapMs >= 0 ? minGapMs : providerMinimumGap(provider);
      const cached = cache.get(key);
      if (cached && cached.expires > now()) return { ...cached, body: Buffer.from(cached.body), cache: 'HIT' };
      if (cached) evict(key);
      if (inFlight.has(key)) return inFlight.get(key);
      const group = provider.startsWith('openalex_') ? 'openalex' : provider;
      const state = providers.get(group) || { failures: 0, until: 0, nextStartAt: 0, busy: false, status: 503 };
      providers.set(group, state);
      if (state.until > now()) return blocked(state.status, Math.ceil((state.until - now()) / 1000), 'SOURCE_COOLDOWN');
      if (state.busy) return blocked(429, 1, 'SOURCE_BUSY');
      state.busy = true;
      const task = (async () => {
        try {
          const delay = Math.max(0, state.nextStartAt - now());
          if (delay) await sleep(delay, signal);
          signal?.throwIfAborted();
          state.nextStartAt = now() + gapMs;
          const result = await operation();
          if (result.status === 429) {
            const seconds = boundedRetryAfterSeconds(result.retryAfter, now());
            state.until = now() + seconds * 1000;
            state.status = 429;
            // Forward a canonical delay in seconds, including when the
            // provider sent an HTTP-date. This preserves the cooldown for the
            // browser without exposing provider error bodies.
            result.retryAfter = String(seconds);
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
          return { ...result, cache: result.cache || 'MISS' };
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
