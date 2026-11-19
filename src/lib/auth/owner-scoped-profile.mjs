/**
 * Keep research dashboard records invisible on account switches, including the
 * render between identity change and React effect cleanup. Never trust the
 * previous owner-specific cache when the current identity is missing.
 */
export function visibleOwnerProfileState(state, currentOwnerId) {
  if (typeof currentOwnerId !== 'string' || !currentOwnerId.trim()
    || !state || state.ownerId !== currentOwnerId) {
    return { data: null, loaded: false, error: false };
  }
  return {
    data: state.data ?? null,
    loaded: state.loaded === true,
    error: state.error === true,
  };
}
