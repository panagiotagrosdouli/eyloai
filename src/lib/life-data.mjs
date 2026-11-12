import { fromDatetimeLocal } from './calendar-data.mjs';

const TYPES = new Set(['goal', 'task', 'habit', 'routine', 'milestone']);
const CADENCES = new Set(['none', 'daily', 'weekly', 'monthly']);

export function normalizeLifeItem(input = {}) {
  const itemType = String(input.item_type || 'task');
  const title = String(input.title || '').trim();
  const timezone = String(input.timezone || '').trim();
  const cadence = String(input.cadence || 'none');
  const status = String(input.status || 'active');
  const progress = Number(input.progress ?? 0);
  const reminder = input.reminder_minutes === '' || input.reminder_minutes == null ? null : Number(input.reminder_minutes);
  if (!TYPES.has(itemType)) throw new Error('Choose a valid life item type.');
  if (!title || title.length > 200) throw new Error('Title must contain 1–200 characters.');
  if (String(input.description || '').length > 5000) throw new Error('Description must be under 5,000 characters.');
  if (!CADENCES.has(cadence)) throw new Error('Choose a valid repeat schedule.');
  if (!['active', 'completed', 'archived'].includes(status)) throw new Error('Choose a valid status.');
  if (!timezone || timezone.length > 100) throw new Error('Choose a valid time zone.');
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }); }
  catch { throw new Error('Choose a valid time zone.'); }
  if (!Number.isInteger(progress) || progress < 0 || progress > 100) throw new Error('Progress must be between 0 and 100.');
  let dueAt = null;
  if (input.due_at) dueAt = fromDatetimeLocal(input.due_at, timezone);
  if (reminder !== null && (!Number.isInteger(reminder) || reminder < 1 || reminder > 10080)) {
    throw new Error('Reminder must be between 1 and 10,080 minutes.');
  }
  if (!dueAt && reminder !== null) throw new Error('A due date is required when setting a reminder.');
  if (reminder !== null && !['task', 'milestone'].includes(itemType)) {
    throw new Error('Calendar reminders are available for tasks and milestones.');
  }
  if (itemType === 'goal' && input.parent_id) throw new Error('A goal cannot be a child of another item.');
  if (itemType === 'habit' && cadence === 'none') throw new Error('Choose a cadence for the habit.');
  return {
    item_type: itemType,
    title,
    description: String(input.description || '').trim(),
    timezone,
    cadence,
    progress,
    due_at: dueAt,
    reminder_minutes: reminder,
    project_id: input.project_id || null,
    parent_id: input.parent_id || null,
    status,
  };
}

export function validateLifePlanSuggestions(value) {
  if (!Array.isArray(value) || value.length > 5) throw new Error('The plan response was not a valid list of up to five actions.');
  const seen = new Set();
  return value.map((item, index) => {
    const title = String(item?.title || '').trim();
    const description = String(item?.description || '').trim();
    if (!title || title.length > 200 || description.length > 1000) {
      throw new Error(`Suggested action ${index + 1} is invalid; no actions were saved.`);
    }
    return { title, description, item_type: 'task' };
  }).filter(item => {
    const normalized = item.title.toLocaleLowerCase();
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

export function habitDateInTimezone(date = new Date(), timezone = 'UTC') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
