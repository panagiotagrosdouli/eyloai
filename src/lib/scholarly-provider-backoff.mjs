// Respect provider rate limits without retry storms or unbounded serverless work.
// A single retry is allowed only for an explicitly short Retry-After value.
export function scholarlyRetryDelay(response, maxDelayMs = 1500, now = Date.now()) {
  if (response?.status !== 429 && response?.status !== 503) return null;
  const raw = response.headers?.get?.('retry-after');
  if (!raw) return null;
  const value = String(raw).trim();
  let delay;
  if (/^\d+(?:\.\d+)?$/.test(value)) {
    delay = Number(value) * 1000;
  } else {
    const time = Date.parse(value);
    if (!Number.isFinite(time)) return null;
    delay = time - now;
  }
  if (!Number.isFinite(delay) || delay < 0 || delay > maxDelayMs) return null;
  return delay;
}

export async function fetchWithScholarlyBackoff(url, options = {}, dependencies = {}) {
  const request = dependencies.fetchImpl || fetch;
  const sleep = dependencies.sleep || ((ms, signal) => new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason || new DOMException('Aborted', 'AbortError'));
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, ms);
    const abort = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); reject(signal.reason || new DOMException('Aborted', 'AbortError')); };
    signal?.addEventListener('abort', abort, { once: true });
  }));
  let response = await request(url, options);
  const attempts = Math.max(1, Math.min(3, Number(dependencies.maxAttempts) || 2));
  for (let attempt = 1; attempt < attempts; attempt++) {
  const permitted = scholarlyRetryDelay(response);
  // Only explicit server-side opt-in retries an unheaded transient outage.
  // Unheaded 429s are never retried; a long Retry-After is never shortened.
  const delay = permitted ?? (dependencies.retryWithoutHeader === true
    && [502, 503, 504].includes(response.status) && !response.headers?.get?.('retry-after')
    ? Math.min(1500, Math.max(250, Number(dependencies.baseDelayMs) || 500) * (2 ** (attempt - 1))) : null);
  if (delay === null) return response;
  await response.body?.cancel?.().catch(() => {});
  if (options.signal?.aborted) throw options.signal.reason || new DOMException('Aborted', 'AbortError');
  await sleep(delay, options.signal);
  if (options.signal?.aborted) throw options.signal.reason || new DOMException('Aborted', 'AbortError');
  response = await request(url, options);
  }
  return response;
}
