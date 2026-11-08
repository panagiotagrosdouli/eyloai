/**
 * Bound the bytes received from a third-party scholarly API.
 *
 * Vercel Node streams allow early termination even when a remote Content-Length
 * header is absent or false. Never call arrayBuffer() on an unbounded provider
 * response. Passing URLs/auth headers through is out of scope for this helper.
 */
export const MAX_SCHOLARLY_RESPONSE_BYTES = 4 * 1024 * 1024;

export class ScholarlyResponseTooLargeError extends Error {
  constructor() {
    super('External scholarly response exceeds the permitted body size.');
    this.name = 'ScholarlyResponseTooLargeError';
    this.code = 'SOURCE_RESPONSE_TOO_LARGE';
  }
}

export async function readBoundedScholarlyResponse(response, maximum = MAX_SCHOLARLY_RESPONSE_BYTES) {
  if (!Number.isSafeInteger(maximum) || maximum < 1) {
    throw new RangeError('Invalid maximum scholarly response size.');
  }

  const rawLength = response.headers?.get('content-length');
  if (rawLength && /^[0-9]+$/.test(rawLength.trim()) && Number(rawLength) > maximum) {
    try { await response.body?.cancel(); } catch { /* Abort and report size, never stream the body. */ }
    throw new ScholarlyResponseTooLargeError();
  }

  if (!response.body) return Buffer.alloc(0);
  if (typeof response.body.getReader !== 'function') {
    throw new Error('Scholarly response did not provide a readable stream.');
  }

  const reader = response.body.getReader();
  const buffers = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) throw new Error('Unexpected scholarly response chunk type.');
      total += value.byteLength;
      if (total > maximum) throw new ScholarlyResponseTooLargeError();
      buffers.push(Buffer.from(value));
    }
  } catch (error) {
    try { await reader.cancel(); } catch { /* Keep the original error. */ }
    throw error;
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(buffers, total);
}
