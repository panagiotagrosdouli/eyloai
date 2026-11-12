import { readSupabaseApiConfig } from '../../api/supabase-config.mjs';

export async function runCalendarReminderDispatch({
  env = process.env,
  authorization = '',
  fetchImpl = fetch,
} = {}) {
  const cronSecret = String(env.CRON_SECRET || '');
  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return { status: 401, body: { error: 'Cron authorization required.' } };
  }

  const config = readSupabaseApiConfig(env);
  if (!config.hasServerConfig) {
    return { status: 503, body: { error: 'Calendar reminders need an explicitly configured Supabase project and server key.' } };
  }

  try {
    const response = await fetchImpl(`${config.url}/rest/v1/rpc/dispatch_calendar_reminders`, {
      method: 'POST',
      headers: {
        apikey: config.serverKey,
        authorization: config.serverKey.startsWith('sb_') ? `Bearer ${config.serverKey}` : `Bearer ${config.serverKey}`,
        'content-type': 'application/json',
      },
      body: '{}',
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return { status: 502, body: { error: 'Calendar reminder dispatch failed.' } };
    const rawDispatched = await response.json();
    if (typeof rawDispatched !== 'number' || !Number.isInteger(rawDispatched) || rawDispatched < 0) {
      return { status: 502, body: { error: 'Calendar reminder dispatch returned an invalid result.' } };
    }
    const dispatched = rawDispatched;
    return { status: 200, body: { dispatched, completed_at: new Date().toISOString() } };
  } catch {
    return { status: 502, body: { error: 'Calendar reminder dispatch failed.' } };
  }
}
