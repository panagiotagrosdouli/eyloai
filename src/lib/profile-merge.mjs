// The persisted profile is the canonical workspace record. Authentication
// metadata is a compatibility fallback for accounts without a profile row.
export function mergeWorkspaceProfile(authFields = {}, storedFields = {}, fallbackName = '') {
  const merged = { ...authFields, ...storedFields };
  return {
    ...merged,
    full_name: storedFields.full_name ?? authFields.full_name ?? fallbackName ?? '',
  };
}

/**
 * The profiles table, rather than Supabase Auth user_metadata, is the
 * canonical persisted workspace profile. An auth-only write is not success.
 */
export function assertCanonicalProfileWrite(result) {
  if (result?.error) {
    throw Object.assign(new Error('Could not save your workspace profile. Please retry.'), {
      code: 'PROFILE_WRITE_FAILED',
    });
  }
  if (!result?.data || typeof result.data.data !== 'object' || result.data.data === null
    || Array.isArray(result.data.data)) {
    throw Object.assign(new Error('Workspace profile save was not confirmed. Please retry.'), {
      code: 'PROFILE_WRITE_UNCONFIRMED',
    });
  }
  return result.data.data;
}
