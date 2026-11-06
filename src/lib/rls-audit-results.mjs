/**
 * A broken backend must never be scored as a successful RLS denial.
 * Successful PostgREST table responses for these probes are JSON arrays
 * because the script requests return=representation and no .single().
 */
export function validatePostgrestResult(result) {
  if (!result || !Number.isInteger(result.status) || typeof result.ok !== 'boolean') {
    throw new Error('Invalid PostgREST audit response.');
  }
  if (result.ok && !Array.isArray(result.data)) {
    throw new Error('PostgREST returned a successful response without a JSON row array.');
  }
  return { ...result, rows: Array.isArray(result.data) ? result.data : [] };
}

export function confirmsDeniedAccess(result) {
  if (!result || !Number.isInteger(result.status)) return false;
  // Explicit auth/permission denials, or a successful RLS-filtered empty array.
  // A 404, 429, 500, timeout or malformed response is INCONCLUSIVE, not secure.
  if (!result.ok && (result.status === 401 || result.status === 403)) return true;
  return result.ok
    && result.status >= 200
    && result.status < 300
    && Array.isArray(result.rows)
    && result.rows.length === 0;
}
