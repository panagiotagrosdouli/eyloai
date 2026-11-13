const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RECURRENCES = ['none', 'daily', 'weekly', 'monthly'];

function invalid(message) {
  return Object.assign(new Error(message), { code: 'CALENDAR_VALIDATION' });
}

function bounded(value, max, label, required = false) {
  const result = String(value ?? '').trim();
  if (required && !result) throw invalid(`${label} is required.`);
  if (result.length > max) throw invalid(`${label} must be ${max} characters or fewer.`);
  return result;
}

function validInstant(value, label, required = false) {
  const text = bounded(value, 40, label, required);
  if (text && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})$/.test(text) || !Number.isFinite(Date.parse(text)))) {
    throw invalid(`${label} must be a valid date and time with a timezone.`);
  }
  return text ? new Date(text).toISOString() : null;
}

export function normalizeCalendarEvent(input = {}) {
  const title = bounded(input.title, 160, 'Event title', true);
  const description = bounded(input.description, 4000, 'Description');
  const start = validInstant(input.start_at, 'Start time', true);
  const end = validInstant(input.end_at, 'End time', true);
  if (Date.parse(end) <= Date.parse(start)) throw invalid('End time must be after the start time.');
  const allDay = input.all_day === true;
  if (allDay && (![start, end].every(value => value.endsWith('T00:00:00.000Z')))) {
    throw invalid('All-day events require UTC midnight boundaries; the end date is exclusive.');
  }
  const reminder = validInstant(input.reminder_at, 'Reminder time');
  if (reminder && Date.parse(reminder) >= Date.parse(end)) throw invalid('Reminder must be before the event ends.');
  const recurrence = RECURRENCES.includes(input.recurrence) ? input.recurrence : 'none';
  const projectId = bounded(input.project_id, 64, 'Project ID');
  if (projectId && !UUID.test(projectId)) throw invalid('Project ID is invalid.');
  return {
    title,
    description,
    all_day: allDay,
    start_at: start,
    end_at: end,
    reminder_at: reminder,
    recurrence,
    project_id: projectId || null,
    project_title: bounded(input.project_title, 160, 'Project title'),
  };
}

// Timed events use the viewer's local calendar; all-day dates are floating
// dates encoded at UTC midnight. Never shift a conference deadline by timezone.
export function eventOccursOnDay(event, year, month, day) {
  const create = event.all_day === true
    ? (y, m, d) => Date.UTC(y, m, d)
    : (y, m, d) => new Date(y, m, d).getTime();
  const from = create(year, month, day), to = create(year, month, day + 1);
  const start = Date.parse(event.start_at), end = Date.parse(event.end_at);
  return Number.isFinite(start) && start < to && (Number.isFinite(end) && end > start ? end > from : start >= from);
}
export function eventsForMonth(events, year, month) {
  const days = new Date(year, month + 1, 0).getDate();
  return [...events].filter(event => Array.from({length: days}, (_, index) => index + 1)
    .some(day => eventOccursOnDay(event, year, month, day)))
    .sort((a, b) => a.start_at.localeCompare(b.start_at));
}
export function calendarEventLabel(event, locale) {
  if (event.all_day !== true) return new Date(event.start_at).toLocaleString(locale);
  const formatter = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' });
  const start = formatter.format(new Date(event.start_at));
  const last = formatter.format(new Date(Date.parse(event.end_at) - 86400000));
  return `${start}${start === last ? '' : ` – ${last}`} · All day`;
}

export function nextEventStart(startAt, recurrence) {
  const date = new Date(startAt);
  if (Number.isNaN(date.getTime())) throw invalid('A valid event start time is required.');
  if (recurrence === 'daily') date.setUTCDate(date.getUTCDate() + 1);
  else if (recurrence === 'weekly') date.setUTCDate(date.getUTCDate() + 7);
  else if (recurrence === 'monthly') {
    const day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + 1);
    date.setUTCDate(Math.min(day, new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()));
  } else throw invalid('Choose a supported recurrence frequency.');
  return date.toISOString();
}
