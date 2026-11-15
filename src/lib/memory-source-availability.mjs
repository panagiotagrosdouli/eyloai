/**
 * EYRA conversation persistence is an optional, staged-only contract.
 * Missing schema can degrade the Memory source list; authorization, network,
 * quota and malformed-response failures must never become silent empty results.
 */
const MISSING_RELATION_CODES = new Set(['PGRST205', '42P01']);

export function readOptionalEyraMessages(result, ownerId) {
  if (result?.error) {
    if (MISSING_RELATION_CODES.has(result.error.code)) {
      return { records: [], historyAvailable: false };
    }
    throw result.error;
  }
  if (!Array.isArray(result?.data)) {
    throw new Error('EYRA message service returned an invalid response.');
  }
  if (!ownerId || result.data.some(row => row?.user_id !== ownerId)) {
    throw new Error('Source ownership mismatch.');
  }
  return { records: result.data, historyAvailable: true };
}
