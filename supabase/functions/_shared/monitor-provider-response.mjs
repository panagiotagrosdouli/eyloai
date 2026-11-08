/**
 * Validate and bound external provider responses in both the Vercel and Deno
 * monitoring workers. Only web platform APIs are used so this stays portable.
 */
export const MAX_MONITOR_PROVIDER_BYTES = 2 * 1024 * 1024;
export const MAX_MONITOR_PROVIDER_RECORDS = 5;

export class MonitorProviderResponseError extends Error {
  constructor(code) {
    super('The monitored research provider returned an unusable response.');
    this.name = 'MonitorProviderResponseError';
    this.code = code;
  }
}

async function readBoundedText(response, maxBytes) {
  const declaredLength = Number(response.headers?.get?.('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    try { await response.body?.cancel(); } catch { /* Preserve the size error. */ }
    throw new MonitorProviderResponseError('MONITOR_SOURCE_TOO_LARGE');
  }

  const reader = response.body?.getReader?.();
  if (!reader) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) {
      throw new MonitorProviderResponseError('MONITOR_SOURCE_TOO_LARGE');
    }
    return text;
  }

  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        try { await reader.cancel(); } catch { /* Preserve the size error. */ }
        throw new MonitorProviderResponseError('MONITOR_SOURCE_TOO_LARGE');
      }
      chunks.push(value);
    }
  } catch (error) {
    try { await reader.cancel(); } catch { /* Preserve the source error. */ }
    throw error;
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

export async function readMonitorProviderRecords(response, provider, maxBytes = MAX_MONITOR_PROVIDER_BYTES) {
  if (!['openalex', 'grants'].includes(provider)) {
    throw new TypeError('Unknown monitoring provider.');
  }
  const contentType = response?.headers?.get?.('content-type');
  if (contentType && !/^application\/(?:json|[a-z0-9.+-]+\+json)(?:\s*;|\s*$)/i.test(contentType.trim())) {
    try { await response.body?.cancel(); } catch { /* Preserve the media-type error. */ }
    throw new MonitorProviderResponseError('MONITOR_NON_JSON_SOURCE');
  }

  let payload;
  try {
    const text = await readBoundedText(response, maxBytes);
    if (!text.trim()) throw new Error('Empty provider response');
    payload = JSON.parse(text);
  } catch (error) {
    if (error instanceof MonitorProviderResponseError) throw error;
    throw new MonitorProviderResponseError('MONITOR_INVALID_JSON');
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new MonitorProviderResponseError('MONITOR_INVALID_RESULT_STRUCTURE');
  }
  if (provider === 'grants' && payload.errorcode !== 0) {
    throw new MonitorProviderResponseError('MONITOR_PROVIDER_ERROR');
  }
  const records = provider === 'openalex' ? payload.results : payload.data?.oppHits;
  if (!Array.isArray(records) || records.length > MAX_MONITOR_PROVIDER_RECORDS) {
    throw new MonitorProviderResponseError('MONITOR_INVALID_RESULT_STRUCTURE');
  }
  const valid = provider === 'openalex'
    ? records.every(item => item && typeof item === 'object' && !Array.isArray(item)
      && typeof item.id === 'string' && item.id.trim().length > 0)
    : records.every(item => item && typeof item === 'object' && !Array.isArray(item)
      && Number.isSafeInteger(Number(item.id)) && Number(item.id) > 0);
  if (!valid) throw new MonitorProviderResponseError('MONITOR_INVALID_SOURCE_RECORD');
  return records;
}

/**
 * OpenAlex inverted-index offsets are untrusted numbers. Allocating an array
 * by a provider-supplied position may attempt a multi-gigabyte sparse array.
 */
export function boundedOpenAlexAbstract(index) {
  if (!index || typeof index !== 'object' || Array.isArray(index)) return '';
  const positions = new Map();
  for (const [word, offsets] of Object.entries(index)) {
    if (!word || word.length > 120 || !Array.isArray(offsets)) continue;
    for (const position of offsets) {
      if (!Number.isSafeInteger(position) || position < 0 || position >= 500) continue;
      if (!positions.has(position)) positions.set(position, word);
      if (positions.size >= 150) break;
    }
    if (positions.size >= 150) break;
  }
  return [...positions.entries()]
    .sort(([a], [b]) => a - b)
    .slice(0, 150)
    .map(([, word]) => word)
    .join(' ')
    .slice(0, 500);
}
