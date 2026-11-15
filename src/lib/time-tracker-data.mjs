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

export function isTimeEntryPaused(entry) {
  return entry?.ended_at == null && entry?.pause_intervals?.at(-1)?.ended_at === null;
}

// Subtract each recorded pause from the requested UTC window; local day/week
// boundaries are supplied by the report caller, so DST needs no special offset.
export function trackedSecondsWithin(entry, windowStart, windowEnd, now = Date.now()) {
  const start = Date.parse(entry?.started_at);
  const end = entry?.ended_at ? Date.parse(entry.ended_at) : now;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  const lower = Math.max(start, windowStart);
  const upper = Math.min(end, windowEnd);
  const pauses = entry.pause_intervals ?? [];
  if (!Array.isArray(pauses) || pauses.length > 1000) throw new Error('Invalid timer pause history. Reload before reporting.');
  let milliseconds = Math.max(0, upper - lower);
  let previousEnd = start;
  for (const [index, pause] of pauses.entries()) {
    const pauseStart = Date.parse(pause?.started_at);
    const pauseEnd = pause?.ended_at === null ? Math.max(end, pauseStart) : Date.parse(pause?.ended_at);
    if (!Number.isFinite(pauseStart) || !Number.isFinite(pauseEnd)
      || pauseStart < previousEnd || pauseEnd < pauseStart || (entry.ended_at != null && pauseEnd > end)
      || (pause.ended_at === null && (index !== pauses.length - 1 || entry.ended_at != null))) {
      throw new Error('Invalid timer pause history. Reload before reporting.');
    }
    milliseconds -= Math.max(0, Math.min(upper, pauseEnd) - Math.max(lower, pauseStart));
    previousEnd = pauseEnd;
  }
  return Math.max(0, Math.floor(milliseconds / 1000));
}

export function durationSeconds(entry, now = Date.now()) {
  return trackedSecondsWithin(entry, -Infinity, Infinity, now);
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
  const groups = new Map();
  let todaySeconds = 0;
  let weekSeconds = 0;
  let totalSeconds = 0;
  for (const entry of entries || []) {
    const seconds = durationSeconds(entry, now.getTime());
    totalSeconds += seconds;
    todaySeconds += trackedSecondsWithin(entry, todayStart, now.getTime(), now.getTime());
    weekSeconds += trackedSecondsWithin(entry, weekStart, now.getTime(), now.getTime());
    const key = entry.project_id || 'unassigned';
    const group = groups.get(key) || { project_id: entry.project_id || null, seconds: 0, entries: 0 };
    group.seconds += seconds; group.entries += 1; groups.set(key, group);
  }
  return { todaySeconds, weekSeconds, totalSeconds, byProject: [...groups.values()].sort((a, b) => b.seconds - a.seconds) };
}

function csvCell(value) {
  let text = String(value ?? '');
  if (/^[\u0000-\u0020]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function exportTimeEntriesCsv(entries, now = Date.now()) {
  const rows = [
    ['description', 'project_id', 'life_task_id', 'started_at', 'ended_at', 'duration_seconds', 'pause_intervals'],
    ...(entries || []).map(entry => [entry.description, entry.project_id, entry.life_task_id,
      entry.started_at, entry.ended_at, durationSeconds(entry, now), JSON.stringify(entry.pause_intervals || [])]),
  ];
  return `${rows.map(row => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

export async function loadAllTimeEntries(client, userId, pageSize = 500, maxRows = 50_000) {
  if (!client || !userId || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 1000
    || !Number.isInteger(maxRows) || maxRows < pageSize) throw new Error('Invalid time export request.');
  const all = [];
  for (let offset = 0; offset < maxRows; offset += pageSize) {
    const { data, error } = await client.from('time_entries').select('*').eq('user_id', userId)
      .order('started_at', { ascending: false }).order('id', { ascending: true }).range(offset, Math.min(offset + pageSize, maxRows) - 1);
    if (error) throw error;
    const page = data || [];
    if (page.some(entry => entry.user_id !== userId)) throw new Error('Time export returned a record from another account.');
    all.push(...page);
    if (page.length < Math.min(pageSize, maxRows - offset)) return all;
    if (all.length >= maxRows) {
      const { data: extra, error: extraError } = await client.from('time_entries').select('id').eq('user_id', userId)
        .order('started_at', { ascending: false }).order('id', { ascending: true }).range(maxRows, maxRows);
      if (extraError) throw extraError;
      if (extra?.length) throw new Error('Time history exceeds its record safety limit. Complete reports are unavailable; contact support before exporting.');
      return all;
    }
  }
  return all;
}

async function stopLegacyTimeEntry(client, entry, userId) {
  const started = Date.parse(entry.started_at);
  const now = Date.now();
  if (!Number.isFinite(started) || now <= started || !Number.isFinite(Date.parse(entry.updated_at))) {
    throw new Error('Reload this timer and check your device time before stopping it.');
  }
  const endedAt = new Date(now).toISOString();
  const { data, error } = await client.from('time_entries').update({ ended_at: endedAt })
    .eq('id', entry.id).eq('user_id', userId).eq('started_at', entry.started_at)
    .eq('updated_at', entry.updated_at).is('ended_at', null).select('*').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Timer changed in another tab. Reload before retrying.');
  if (data.id !== entry.id || data.user_id !== userId || data.started_at !== entry.started_at
    || Date.parse(data.ended_at) !== now || (data.pause_intervals?.length || 0) > 0) {
    throw new Error('Timer update could not be verified. Reload before retrying.');
  }
  return data;
}

export async function transitionTimeEntry(client, entry, userId, action) {
  if (!client || !entry?.id || entry.user_id !== userId || !['pause', 'resume', 'stop'].includes(action)) {
    throw new Error('Timer not found or access denied. Reload before retrying.');
  }
  // Old-schema rows have neither pause field. Preserve the previous owner/CAS
  // stop path without bypassing the transition RPC for any migrated timer.
  if (action === 'stop' && entry.pause_intervals === undefined && entry.timer_revision === undefined) {
    return stopLegacyTimeEntry(client, entry, userId);
  }
  const { data, error } = await client.rpc('transition_time_entry', {
    p_entry_id: entry.id, p_action: action, p_expected_revision: entry.timer_revision ?? 0,
  });
  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883') throw new Error('Timer controls require the pause/resume database migration. Contact your workspace administrator.');
    throw error;
  }
  const row = Array.isArray(data) && data.length === 1 ? data[0] : data;
  const changed = action === 'stop' || (action === 'pause' ? !isTimeEntryPaused(entry) : isTimeEntryPaused(entry));
  const expectedRevision = (entry.timer_revision ?? 0) + (changed ? 1 : 0);
  if (!row || row.id !== entry.id || row.user_id !== userId
    || !Number.isSafeInteger(row.timer_revision) || row.timer_revision !== expectedRevision
    || (action === 'stop' ? row.ended_at == null : row.ended_at != null)
    || (action === 'pause' && !isTimeEntryPaused(row))
    || (action === 'resume' && isTimeEntryPaused(row))) {
    throw new Error('Timer update could not be verified. Reload before retrying.');
  }
  return row;
}

export function createTimeReport(entries, { fromDate = '', toDate = '', timezone = 'UTC', now = Date.now() } = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate || '') || !/^\d{4}-\d{2}-\d{2}$/.test(toDate || '')) {
    throw new Error('Choose valid report dates.');
  }
  const start = Date.parse(fromDatetimeLocal(`${fromDate}T00:00`, timezone));
  // Validate the final date before advancing it; Date normalizes impossible dates.
  fromDatetimeLocal(`${toDate}T00:00`, timezone);
  if (fromDate > toDate) throw new Error('Report end date must be on or after its start date.');
  const nextDay = new Date(`${toDate}T00:00:00Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const end = Date.parse(fromDatetimeLocal(`${nextDay.toISOString().slice(0, 10)}T00:00`, timezone));
  const rows = (entries || []).map(entry => ({ entry, seconds: trackedSecondsWithin(entry, start, Math.min(end, now), now) })).filter(row => row.seconds > 0);
  const groups = new Map();
  for (const row of rows) {
    const key = row.entry.project_id || null;
    groups.set(key, (groups.get(key) || 0) + row.seconds);
  }
  return { fromDate, toDate, timezone, started_at: new Date(start).toISOString(), ended_at: new Date(end).toISOString(),
    totalSeconds: rows.reduce((sum, row) => sum + row.seconds, 0), rows,
    byProject: [...groups].map(([project_id, seconds]) => ({ project_id, seconds })).sort((a, b) => b.seconds - a.seconds),
  };
}

export function exportTimeReportCsv(report) {
  const rows = [
    ['description', 'project_id', 'life_task_id', 'report_start_inclusive', 'report_end_exclusive', 'timezone', 'seconds_in_range'],
    ...report.rows.map(({ entry, seconds }) => [entry.description, entry.project_id, entry.life_task_id,
      report.started_at, report.ended_at, report.timezone, seconds]),
  ];
  return `${rows.map(row => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}
