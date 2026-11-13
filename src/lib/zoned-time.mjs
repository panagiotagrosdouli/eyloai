// Local time conversion ported from PR #391, without its competing Calendar model.
function zonedParts(date, timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
}

export function toDatetimeLocal(value, timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC') {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const parts = zonedParts(date, timezone);
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}T${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
}

export function fromDatetimeLocal(value, timezone) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(value || ''))) throw new Error('Choose a valid date and time.');
  if (!timezone) throw new Error('Choose a valid time zone.');
  const [datePart, timePart] = value.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  const wallTime = Date.UTC(year, month - 1, day, hour, minute);
  const normalized = new Date(wallTime);
  if (normalized.getUTCFullYear() !== year || normalized.getUTCMonth() !== month - 1
    || normalized.getUTCDate() !== day || hour > 23 || minute > 59) {
    throw new Error('Choose a valid date and time.');
  }
  let candidate = wallTime;
  for (let index = 0; index < 4; index += 1) {
    const parts = zonedParts(new Date(candidate), timezone);
    const representedWallTime = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    const delta = wallTime - representedWallTime;
    if (delta === 0) return new Date(candidate).toISOString();
    candidate += delta;
  }
  throw new Error('That local time does not exist in the selected time zone.');
}
