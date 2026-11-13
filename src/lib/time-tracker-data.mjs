import { fromDatetimeLocal } from './zoned-time.mjs';

export function normalizeManualTimeEntry(input = {}) {
  const description = String(input.description || '').trim();
  const timezone = String(input.timezone || '').trim();
  if (!description || description.length > 500) throw new Error('Describe what you worked on (1–500 characters).');
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }); }
  catch { throw new Error('Choose a valid time zone.'); }
  let started; let ended;
  try {
    started = new Date(fromDatetimeLocal(input.started_at, timezone));
    ended = new Date(fromDatetimeLocal(input.ended_at, timezone));
  } catch (error) { throw new Error(error.message || 'Choose valid start and end times.'); }
  if (!Number.isFinite(started.getTime()) || !Number.isFinite(ended.getTime())) throw new Error('Choose valid start and end times.');
  if (ended <= started) throw new Error('End time must be after start time.');
  return {
    description,
    started_at: started.toISOString(),
    ended_at: ended.toISOString(),
    project_id: input.project_id || null,
    life_task_id: input.life_task_id || null,
  };
}

export function durationSeconds(entry, now = Date.now()) {
  const start = Date.parse(entry?.started_at);
  const end = entry?.ended_at ? Date.parse(entry.ended_at) : now;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.floor((end - start) / 1000));
}

export function summarizeTimeEntries(entries, { now = new Date(), timezone = 'UTC' } = {}) {
  const dateParts = value => Object.fromEntries(new Intl.DateTimeFormat('en', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(value).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  const todayParts = dateParts(now);
  const todayKey = `${todayParts.year}-${todayParts.month}-${todayParts.day}`;
  const [year, month, date] = todayKey.split('-').map(Number);
  const todayWall = Date.UTC(year, month - 1, date);
  const day = new Date(todayWall).getUTCDay();
  const mondayOffset = (day + 6) % 7;
  const weekWall = new Date(todayWall - mondayOffset * 86_400_000);
  const weekKey = `${String(weekWall.getUTCFullYear()).padStart(4, '0')}-${String(weekWall.getUTCMonth() + 1).padStart(2, '0')}-${String(weekWall.getUTCDate()).padStart(2, '0')}`;
  const weekStart = Date.parse(fromDatetimeLocal(`${weekKey}T00:00`, timezone));
  const todayStart = Date.parse(fromDatetimeLocal(`${todayKey}T00:00`, timezone));
  const secondsWithin = (entry, start, end) => {
    const entryStart = Date.parse(entry.started_at);
    const entryEnd = entry.ended_at ? Date.parse(entry.ended_at) : now.getTime();
    if (!Number.isFinite(entryStart) || !Number.isFinite(entryEnd)) return 0;
    return Math.max(0, Math.floor((Math.min(entryEnd, end) - Math.max(entryStart, start)) / 1000));
  };
  const groups = new Map();
  let todaySeconds = 0;
  let weekSeconds = 0;
  for (const entry of entries || []) {
    const seconds = durationSeconds(entry, now.getTime());
    todaySeconds += secondsWithin(entry, todayStart, now.getTime());
    weekSeconds += secondsWithin(entry, weekStart, now.getTime());
    const key = entry.project_id || 'unassigned';
    const group = groups.get(key) || { project_id: entry.project_id || null, seconds: 0, entries: 0 };
    group.seconds += seconds; group.entries += 1; groups.set(key, group);
  }
  return { todaySeconds, weekSeconds, byProject: [...groups.values()].sort((a, b) => b.seconds - a.seconds) };
}

function csvCell(value) {
  let text = String(value ?? '');
  if (/^[\u0000-\u0020]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function exportTimeEntriesCsv(entries) {
  const rows = [
    ['description', 'project_id', 'life_task_id', 'started_at', 'ended_at', 'duration_seconds'],
    ...(entries || []).map(entry => [entry.description, entry.project_id, entry.life_task_id,
      entry.started_at, entry.ended_at, durationSeconds(entry)]),
  ];
  return `${rows.map(row => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

export async function loadAllTimeEntries(client, userId, pageSize = 500, maxRows = 50_000) {
  if (!client || !userId || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 1000
    || !Number.isInteger(maxRows) || maxRows < pageSize) throw new Error('Invalid time export request.');
  const all = [];
  for (let offset = 0; offset < maxRows; offset += pageSize) {
    const { data, error } = await client.from('time_entries').select('*').eq('user_id', userId)
      .order('started_at', { ascending: false }).order('id', { ascending: true }).range(offset, offset + pageSize - 1);
    if (error) throw error;
    const page = data || [];
    if (page.some(entry => entry.user_id !== userId)) throw new Error('Time export returned a record from another account.');
    all.push(...page);
    if (page.length < pageSize) return all;
    if (all.length >= maxRows) {
      const { data: extra, error: extraError } = await client.from('time_entries').select('id').eq('user_id', userId)
        .order('started_at', { ascending: false }).order('id', { ascending: true }).range(maxRows, maxRows);
      if (extraError) throw extraError;
      if (extra?.length) throw new Error('Time export reached its safety limit; narrow the date range and retry.');
      return all;
    }
  }
  return all;
}
