/**
 * Bound external Grants.gov JSON before parsing. The shared bounded stream
 * reader enforces the limit even when Content-Length is absent or dishonest.
 * A bad provider payload is a source failure, never an empty search result.
 */
import {
  readBoundedScholarlyResponse, ScholarlyResponseTooLargeError,
} from './discovery-response-limit.mjs';

export const MAX_GRANTS_SEARCH_BYTES = 2 * 1024 * 1024;
export const MAX_GRANTS_DETAIL_BYTES = 1 * 1024 * 1024;

export class FundingSourceResponseError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'FundingSourceResponseError';
    this.code = code;
  }
}

export async function readFundingJsonResponse(response, maximum) {
  const type = response?.headers?.get?.('content-type');
  if (type && !/^application\/(?:json|[a-z0-9.+-]+\+json)(?:\s*;|\s*$)/i.test(type.trim())) {
    try { await response.body?.cancel(); } catch { /* Keep original source failure. */ }
    throw new FundingSourceResponseError('FUNDING_INVALID_CONTENT_TYPE', 'Funding source returned a non-JSON media type.');
  }
  let data;
  try {
    data = await readBoundedScholarlyResponse(response, maximum);
  } catch (error) {
    if (error instanceof ScholarlyResponseTooLargeError) {
      throw new FundingSourceResponseError('FUNDING_RESPONSE_TOO_LARGE', 'Funding source response exceeded the safe byte limit.');
    }
    throw error;
  }
  if (!data.length) throw new FundingSourceResponseError('FUNDING_INVALID_RESPONSE', 'Funding source returned empty JSON.');
  try {
    const parsed = JSON.parse(data.toString('utf8'));
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('JSON root is not an object.');
    }
    return parsed;
  } catch {
    throw new FundingSourceResponseError('FUNDING_INVALID_RESPONSE', 'Funding source returned invalid JSON.');
  }
}
