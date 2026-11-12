/**
 * Owner-scoped optimistic writes must use the exact previously loaded
 * updated_date. Database update triggers advance the version on each write.
 * No response (zero rows matched) means stale state, not success.
 */
export function requireEntityVersion(version) {
  if (typeof version !== 'string' || !version.trim() || !Number.isFinite(Date.parse(version))) {
    throw Object.assign(new Error('Refresh this project before modifying its evidence.'), {
      code: 'ENTITY_VERSION_REQUIRED',
    });
  }
  return version;
}

export function requireVersionedWriteResult(result) {
  if (result?.error) throw result.error;
  if (!result?.data || typeof result.data !== 'object' || !result.data.id) {
    throw Object.assign(new Error('This project changed in another tab. Reload before saving.'), {
      code: 'ENTITY_CONFLICT',
    });
  }
  return result.data;
}
