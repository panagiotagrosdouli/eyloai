// Durable EYRA run ledger. Disabled until its migration passes independent
// staging acceptance and EYRA_DURABLE_RUNS_ENABLED=true is explicitly set.
//
// Only a server holding the Supabase service key may mutate ledger rows.
// All user IDs come from a separately verified Supabase Auth bearer.
import crypto from 'node:crypto';

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function durableRunsEnabled() {
  return process.env.EYRA_DURABLE_RUNS_ENABLED === 'true';
}

export function requestFingerprint(request) {
  return crypto.createHash('sha256').update(JSON.stringify(request)).digest('hex');
}

function apiHeaders(key, extra = {}) {
  if (!key) throw new Error('EYRA run ledger requires a server-side database key.');
  return {
    apikey: key, accept: 'application/json', 'content-type': 'application/json',
    ...(key.startsWith('sb_') ? {} : { authorization: 'Bearer ' + key }),
    ...extra,
  };
}

async function ledgerRequest(identity, table, method, params, body, extraHeaders = {}) {
  if (!identity?.serverKey || !identity?.supabaseUrl || !identity?.user?.id) {
    throw new Error('Authenticated EYRA run ledger configuration is unavailable.');
  }
  const url = new URL(identity.supabaseUrl + '/rest/v1/' + table);
  for (const [key, value] of Object.entries(params || {})) url.searchParams.set(key, value);
  const response = await fetch(url, {
    method, headers: apiHeaders(identity.serverKey, extraHeaders),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: 'no-store', signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error('EYRA run ledger storage request failed (' + response.status + ').');
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error('EYRA run ledger returned an invalid response.');
  return rows;
}

export async function startAgentRun(identity, requestId, fingerprint, preview) {
  if (typeof requestId !== 'string' || !UUID.test(requestId)
    || !/^[0-9a-f]{64}$/.test(fingerprint)
    || typeof preview !== 'string' || !preview.trim()) {
    throw new Error('Invalid durable run identity.');
  }
  const userId = identity.user.id;
  const rows = await ledgerRequest(identity, 'eyra_agent_runs', 'POST', {
    on_conflict: 'user_id,request_id',
    select: 'id,user_id,request_id,request_hash,status,response_text,action_summary,error_code',
  }, {
    user_id: userId, request_id: requestId, request_hash: fingerprint,
    input_preview: preview.trim().slice(0, 300), status: 'running',
  }, { prefer: 'resolution=ignore-duplicates,return=representation' });

  if (rows.length > 1) throw new Error('Agent run insert returned multiple identities.');
  if (rows.length === 1) {
    if (rows[0].user_id !== userId || rows[0].request_id !== requestId || !UUID.test(rows[0].id)) {
      throw new Error('Agent run ownership confirmation failed.');
    }
    return { id: rows[0].id, created: true, status: 'running' };
  }
  const previous = await ledgerRequest(identity, 'eyra_agent_runs', 'GET', {
    select: 'id,user_id,request_id,request_hash,status,response_text,action_summary,error_code',
    user_id: 'eq.' + userId, request_id: 'eq.' + requestId, limit: '1',
  });
  if (previous.length !== 1 || previous[0].user_id !== userId
    || previous[0].request_id !== requestId || !UUID.test(previous[0].id)) {
    throw new Error('An existing agent run could not be verified.');
  }
  if (previous[0].request_hash !== fingerprint) {
    return { id: previous[0].id, created: false, conflict: true, status: previous[0].status };
  }
  // Never auto-retry a non-idempotent action. Even a failed run may contain
  // an action whose external side effect committed before a transport loss.
  return { ...previous[0], created: false, conflict: false };
}

export async function reserveAgentAction(identity, runId, callId, name, argumentsHash) {
  if (!UUID.test(runId) || typeof callId !== 'string' || callId.length < 1
    || callId.length > 200 || typeof name !== 'string' || name.length > 100
    || !/^[0-9a-f]{64}$/.test(argumentsHash)) throw new Error('Invalid agent action identity.');
  const rows = await ledgerRequest(identity, 'eyra_agent_actions', 'POST', {
    on_conflict: 'run_id,call_id',
    select: 'id,run_id,user_id,call_id,status',
  }, {
    run_id: runId, user_id: identity.user.id,
    call_id: callId, tool_name: name, arguments_hash: argumentsHash,
    status: 'started',
  }, { prefer: 'resolution=ignore-duplicates,return=representation' });
  if (rows.length !== 1 || rows[0].run_id !== runId
    || rows[0].user_id !== identity.user.id || rows[0].call_id !== callId
    || rows[0].status !== 'started') {
    // Fail closed on replay, ambiguous insert, or backend response corruption.
    return { reserved: false };
  }
  return { reserved: true, id: rows[0].id };
}

export async function completeAgentAction(identity, actionId, status, outcome) {
  if (!UUID.test(actionId) || !['succeeded','failed','needs_review'].includes(status)) {
    throw new Error('Invalid agent action completion.');
  }
  const summary = JSON.stringify(outcome || {});
  if (summary.length > 20_000) throw new Error('Agent action outcome exceeds ledger budget.');
  const rows = await ledgerRequest(identity, 'eyra_agent_actions', 'PATCH', {
    id: 'eq.' + actionId, user_id: 'eq.' + identity.user.id,
    status: 'eq.started', select: 'id,status',
  }, {
    status, outcome: JSON.parse(summary), finished_at: new Date().toISOString(),
  }, { prefer: 'return=representation' });
  if (rows.length !== 1 || rows[0].id !== actionId || rows[0].status !== status) {
    throw new Error('Agent action completion could not be verified.');
  }
}

export async function finalizeAgentRun(identity, runId, status, text, actions = [], errorCode = null) {
  if (!UUID.test(runId) || !['completed','failed','partial','cancelled','needs_review'].includes(status)) {
    throw new Error('Invalid agent run terminal status.');
  }
  const safeActions = actions.slice(0, 8).map(action => ({
    action_id: String(action.action_id || '').slice(0, 200),
    tool: String(action.tool || '').slice(0, 100),
    status: String(action.status || '').slice(0, 30),
    record_id: typeof action.result?.id === 'string' ? action.result.id.slice(0, 100) : null,
  }));
  const rows = await ledgerRequest(identity, 'eyra_agent_runs', 'PATCH', {
    id: 'eq.' + runId, user_id: 'eq.' + identity.user.id,
    status: 'eq.running', select: 'id,status',
  }, {
    status, response_text: String(text || '').slice(0, 16_000),
    action_summary: safeActions,
    error_code: errorCode ? String(errorCode).slice(0, 100) : null,
    updated_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
  }, { prefer: 'return=representation' });
  if (rows.length !== 1 || rows[0].id !== runId || rows[0].status !== status) {
    throw new Error('Agent run completion could not be verified; it may have been cancelled.');
  }
}

export async function isAgentRunCancelled(identity, runId) {
  const rows = await ledgerRequest(identity, 'eyra_agent_runs', 'GET', {
    select: 'id,status', id: 'eq.' + runId,
    user_id: 'eq.' + identity.user.id, limit: '1',
  });
  if (rows.length !== 1 || rows[0].id !== runId) throw new Error('Agent run state unavailable.');
  return rows[0].status === 'cancelled';
}
