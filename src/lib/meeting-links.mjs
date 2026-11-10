/** Validate user-supplied legacy provider URLs; native rooms never use this URL. */
export function normalizeMeetingLink(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Enter a valid HTTPS meeting link.');
  }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) {
    throw new Error('Meeting links must use HTTPS and cannot contain embedded credentials.');
  }
  return url.href;
}
