/**
 * Only missing canonical profile columns authorize a legacy-schema retry.
 * Authentication and permission failures must never fall back.
 */
export function isLegacyProfileShapeError(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '');
  return ['42703', 'PGRST204'].includes(code)
    && /\b(?:data|user_id)\b/i.test(message);
}

export function normalizeLegacyProfileWrite(result) {
  if (result?.error) return result;
  return {
    ...result,
    data: result?.data ? { data: result.data } : null,
  };
}
