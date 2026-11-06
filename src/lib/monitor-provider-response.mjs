/**
 * Fail closed when scheduled research sources return unbounded or malformed JSON.
 *
 * Do not record source errors as successful empty watchlist checks.
 * The in-memory body limit applies even when Content-Length is absent.
 */
import {
  readBoundedScholarlyResponse, ScholarlyResponseTooLargeError,
} from './discovery-response-limit.mjs';

export const MAX_MONITOR_PROVIDER_BYTES = 2 * 1024 * 1024;
export const MAX_MONITOR_PROVIDER_RECORDS = 5;

export class MonitorProviderResponseError extends Error {
  constructor(code) {
    super('The monitored research provider returned an unusable response.');
    this.name = 'MonitorProviderResponseError';
    this.code = code;
  }
}

export async function readMonitorProviderRecords(response, provider, maxBytes = MAX_MONITOR_PROVIDER_BYTES) {
  if (!['openalex', 'grants'].includes(provider)) {
    throw new TypeError('Unknown monitoring provider.');
  }
  const contentType = response?.headers?.get?.('content-type');
  if (contentType && !/^application\/(?:json|[a-z0-9.+-]+\+json)(?:\s*;|\s*$)/i.test(contentType.trim())) {
    try { await response.body?.cancel(); } catch { /* Keep original error. */ }
    throw new MonitorProviderResponseError('MONITOR_NON_JSON_SOURCE');
  }
  let bytes;
  try {
    bytes = await readBoundedScholarlyResponse(response, maxBytes);
  } catch (error) {
    if (error instanceof ScholarlyResponseTooLargeError) {
      throw new MonitorProviderResponseError('MONITOR_SOURCE_TOO_LARGE');
    }
    throw error;
  }
  let payload;
  try {
    if (!bytes.length) throw new Error('Empty source response');
    payload = JSON.parse(bytes.toString('utf8'));
  } catch {
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
