const EVENT_TYPES = new Set(['event', 'deadline', 'exam', 'study']);
const RECURRENCES = new Set(['none', 'daily', 'weekly', 'monthly']);

export function normalizeCalendarEvent(input = {}) {
  const title = String(input.title || '').trim();
  const timezone = String(input.timezone || '').trim();
  if (!timezone || timezone.length > 100) throw new Error('Choose a valid time zone.');
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }); }
  catch { throw new Error('Choose a valid time zone.'); }
  let startsAt;
  try { startsAt = new Date(fromDatetimeLocal(input.starts_at, timezone)); }
  catch (error) { throw new Error(error.message || 'Choose a valid date and time.'); }
  const eventType = String(input.event_type || 'event');
  const recurrence = String(input.recurrence || 'none');
  const status = String(input.status || 'scheduled');
  const reminder = input.reminder_minutes === '' || input.reminder_minutes == null
    ? null : Number(input.reminder_minutes);
  if (!title || title.length > 200) throw new Error('Title must contain 1–200 characters.');
  if (!Number.isFinite(startsAt.getTime())) throw new Error('Choose a valid date and time.');
  if (!EVENT_TYPES.has(eventType)) throw new Error('Choose a valid calendar item type.');
  if (!RECURRENCES.has(recurrence)) throw new Error('Choose a valid repeat schedule.');
  if (!['scheduled', 'completed'].includes(status)) throw new Error('Choose a valid status.');
  if (reminder !== null && (!Number.isInteger(reminder) || reminder < 1 || reminder > 10080)) {
    throw new Error('Reminder must be between 1 and 10,080 minutes.');
  }
  return {
    title,
    description: String(input.description || '').trim().slice(0, 5000),
    subject: String(input.subject || '').trim().slice(0, 120),
    event_type: eventType,
    starts_at: startsAt.toISOString(),
    timezone,
    recurrence,
    status,
    reminder_minutes: reminder,
    project_id: input.project_id || null,
  };
}

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

function localWallMilliseconds(value) {
  const [datePart, timePart] = value.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  return Date.UTC(year, month - 1, day, hour, minute);
}

function wallString(milliseconds) {
  const date = new Date(milliseconds);
  return `${String(date.getUTCFullYear()).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}T${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
}

function addLocalMonths(milliseconds, count) {
  const date = new Date(milliseconds);
  const year = date.getUTCFullYear();
  const monthIndex = date.getUTCMonth() + count;
  const targetYear = year + Math.floor(monthIndex / 12);
  const targetMonth = ((monthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return Date.UTC(targetYear, targetMonth, Math.min(date.getUTCDate(), lastDay), date.getUTCHours(), date.getUTCMinutes());
}

export function nextCalendarOccurrence(event, now = Date.now()) {
  const baseTimestamp = Date.parse(event?.starts_at);
  if (!Number.isFinite(baseTimestamp)) return null;
  if (!event.recurrence || event.recurrence === 'none' || baseTimestamp > now) return baseTimestamp;
  const timezone = event.timezone || 'UTC';
  const baseLocal = toDatetimeLocal(baseTimestamp, timezone);
  const nowLocal = toDatetimeLocal(now, timezone);
  const baseWall = localWallMilliseconds(baseLocal);
  const nowWall = localWallMilliseconds(nowLocal);
  let candidateWall;
  if (event.recurrence === 'daily' || event.recurrence === 'weekly') {
    const intervalDays = event.recurrence === 'daily' ? 1 : 7;
    const count = Math.max(0, Math.ceil((nowWall - baseWall) / (intervalDays * 86_400_000)));
    candidateWall = baseWall + count * intervalDays * 86_400_000;
  } else if (event.recurrence === 'monthly') {
    const base = new Date(baseWall); const current = new Date(nowWall);
    let count = Math.max(0, (current.getUTCFullYear() - base.getUTCFullYear()) * 12 + current.getUTCMonth() - base.getUTCMonth());
    candidateWall = addLocalMonths(baseWall, count);
    if (candidateWall < nowWall) candidateWall = addLocalMonths(baseWall, ++count);
  } else return baseTimestamp;

  // Skip a wall-clock occurrence that falls inside a DST gap, keeping the
  // recurrence anchored to its original local clock time.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const timestamp = Date.parse(fromDatetimeLocal(wallString(candidateWall), timezone));
      if (timestamp >= now) return timestamp;
    } catch { /* Advance this occurrence if the local wall time does not exist. */ }
    if (event.recurrence === 'daily') candidateWall += 86_400_000;
    else if (event.recurrence === 'weekly') candidateWall += 7 * 86_400_000;
    else candidateWall = addLocalMonths(candidateWall, 1);
  }
  return null;
}

export function visibleCalendarEvents(events, view = 'upcoming', now = Date.now()) {
  return (events || []).filter(event => {
    const next = nextCalendarOccurrence(event, now);
    return view === 'all' || (view === 'past' ? next !== null && next < now : next !== null && next >= now);
  }).sort((a, b) => (nextCalendarOccurrence(a, now) ?? Infinity) - (nextCalendarOccurrence(b, now) ?? Infinity));
}
