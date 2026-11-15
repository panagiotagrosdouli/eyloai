// Authenticated EYRA run history client. This is intentionally opt-in:
// hosted agent ledger migration and EYRA_DURABLE_RUNS_ENABLED must be active.
import { getUsableSession } from '@/lib/supabaseClient';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class EyraRunHistoryError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'EyraRunHistoryError';
    this.status = status;
    this.code = code;
  }
}

async function authenticatedRunRequest(method, { id, action } = {}) {
  if (id !== undefined && (typeof id !== 'string' || !UUID.test(id))) {
    throw new EyraRunHistoryError('Invalid EYRA run identifier.', 400, 'INVALID_RUN_ID');
  }
  const session = await getUsableSession({ required: true, validate: true });
  const url = new URL('/api/eyra-runs', window.location.origin);
  if (method === 'GET') {
    if (id) url.searchParams.set('id', id);
    else url.searchParams.set('limit', '20');
  }
  const response = await fetch(url, {
    method,
    headers: {
      authorization: 'Bearer ' + session.access_token,
      'content-type': 'application/json',
    },
    ...(method === 'GET' ? {} : { body: JSON.stringify({ id, ...(action ? { action } : {}) }) }),
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const unavailable = response.status === 503;
    throw new EyraRunHistoryError(
      unavailable
        ? 'Run history is not activated in this environment.'
        : typeof data?.error === 'string' ? data.error : 'EYRA run history request failed.',
      response.status,
      typeof data?.code === 'string' ? data.code : 'RUN_HISTORY_ERROR',
    );
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new EyraRunHistoryError('Invalid run history response.', 502, 'INVALID_RUN_HISTORY_RESPONSE');
  }
  return data;
}

export async function listEyraAgentRuns() {
  const result = await authenticatedRunRequest('GET');
  if (!Array.isArray(result.runs) || result.runs.length > 20) {
    throw new EyraRunHistoryError('Invalid run history records.', 502, 'INVALID_RUN_HISTORY_RESPONSE');
  }
  return result.runs;
}

export async function loadEyraAgentRun(id) {
  const result = await authenticatedRunRequest('GET', { id });
  if (!result.run || result.run.id !== id || !Array.isArray(result.actions)
    || result.actions.length > 8) {
    throw new EyraRunHistoryError('Invalid run details.', 502, 'INVALID_RUN_HISTORY_RESPONSE');
  }
  return result;
}

export async function cancelEyraAgentRun(id) {
  const result = await authenticatedRunRequest('POST', { id, action: 'cancel' });
  if (result.run_id !== id || result.status !== 'cancelled') {
    throw new EyraRunHistoryError('Cancellation was not confirmed.', 502, 'CANCELLATION_NOT_CONFIRMED');
  }
  return result;
}

export async function deleteEyraAgentRun(id) {
  const result = await authenticatedRunRequest('DELETE', { id });
  if (result.run_id !== id || result.deleted !== true) {
    throw new EyraRunHistoryError('Deletion was not confirmed.', 502, 'DELETION_NOT_CONFIRMED');
  }
  return result;
}
