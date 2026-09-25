export function isCommandShortcut(event) {
  return Boolean(
    event
    && (event.metaKey || event.ctrlKey)
    && !event.altKey
    && String(event.key || '').toLowerCase() === 'k'
  );
}

export function buildResearchUrl(query) {
  const value = String(query || '').trim();
  return value ? `/home?q=${encodeURIComponent(value)}` : '/home';
}
