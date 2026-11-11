// The persisted profile is the canonical workspace record. Authentication
// metadata is a compatibility fallback for accounts without a profile row.
export function mergeWorkspaceProfile(authFields = {}, storedFields = {}, fallbackName = '') {
  const merged = { ...authFields, ...storedFields };
  return {
    ...merged,
    full_name: storedFields.full_name ?? authFields.full_name ?? fallbackName ?? '',
  };
}
