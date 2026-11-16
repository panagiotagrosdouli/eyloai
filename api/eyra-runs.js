// Authenticated read, cancellation and deletion for owner-scoped EYRA agent runs.
// Mutation uses the server secret only after independent Supabase Auth validation.
// Requires the reviewed ledger migration and EYRA_DURABLE_RUNS_ENABLED=true.
import { applyCors } from '../src/lib/api-cors.mjs';
import { readSupabaseApiConfig } from '../server/supabase-config.mjs';
import { durableRunsEnabled, UUID } from '../server/eyra-run-ledger.mjs';

function fail(res, status, code, error) { return res.status(status).json({ code, error }); }
function serverKey() { return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY; }

export default async function handler(request, response) {
  if (applyCors(request, response, ['GET', 'POST', 'DELETE'])) return;
  response.setHeader('Cache-Control', 'private, no-store');
  if (!['GET', 'POST', 'DELETE'].includes(request.method)) {
    response.setHeader('Allow', 'GET, POST, DELETE');
    return fail(response, 405, 'METHOD_NOT_ALLOWED', 'Unsupported method.');
  }
  const config = readSupabaseApiConfig();
  if (!durableRunsEnabled() || !config.hasPublicConfig || !serverKey()) {
    return fail(response, 503, 'AGENT_LEDGER_UNAVAILABLE',
      'EYRA run history has not been activated after staging verification.');
  }
  const token = request.headers?.authorization;
  if (typeof token !== 'string' || !/^Bearer \S+$/.test(token)) {
    return fail(response, 401, 'AUTHENTICATION_REQUIRED', 'Authentication required.');
  }
  const id = request.method === 'GET' ? request.query?.id : request.body?.id;
  if (id !== undefined && (typeof id !== 'string' || !UUID.test(id))) {
    return fail(response, 400, 'INVALID_RUN_ID', 'A valid agent run UUID is required.');
  }
  if (request.method !== 'GET' && !id) {
    return fail(response, 400, 'INVALID_RUN_ID', 'A valid agent run UUID is required.');
  }
  const limitInput = request.query?.limit;
  if (limitInput !== undefined && (typeof limitInput !== 'string'
    || !/^[1-9]\d*$/.test(limitInput) || Number(limitInput) > 20)) {
    return fail(response, 400, 'INVALID_PAGINATION', 'Run history limit must be 1–20.');
  }
  try {
    const auth = await fetch(config.url + '/auth/v1/user', {
      headers: { apikey: config.publicKey, authorization: token },
      cache: 'no-store', signal: AbortSignal.timeout(15000),
    });
    if (!auth.ok) return fail(response, 401, 'AUTHENTICATION_REQUIRED', 'Authentication required.');
    const user = await auth.json();
    if (!UUID.test(user?.id || '')) {
      return fail(response, 401, 'AUTHENTICATION_REQUIRED', 'Authentication required.');
    }
    const key = serverKey();
    const headers = {
      apikey: key, accept: 'application/json', 'content-type': 'application/json',
      ...(key.startsWith('sb_') ? {} : { authorization: 'Bearer ' + key }),
    };
    const owner = user.id;
    async function db(table, method, params, body, extra) {
      const url = new URL(config.url + '/rest/v1/' + table);
      for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
      const result = await fetch(url, {
        method, headers: { ...headers, ...extra }, cache: 'no-store',
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(15000),
      });
      if (!result.ok) throw new Error('Ledger DB operation unavailable.');
      const rows = await result.json();
      if (!Array.isArray(rows)) throw new Error('Invalid ledger data.');
      return rows;
    }
    if (request.method === 'GET') {
      const rows = await db('eyra_agent_runs', 'GET', {
        select: 'id,request_id,input_preview,status,response_text,action_summary,error_code,started_at,updated_at,finished_at',
        user_id: 'eq.' + owner, ...(id ? { id: 'eq.' + id, limit: '1' } : {
          order: 'started_at.desc,id.desc', limit: limitInput || '20',
        }),
      });
      if (id && rows.length === 0) {
        return fail(response, 404, 'RUN_NOT_FOUND', 'Agent run not found.');
      }
      const actions = id
        ? await db('eyra_agent_actions', 'GET', {
          select: 'id,call_id,tool_name,status,outcome,error_code,started_at,finished_at',
          user_id: 'eq.' + owner, run_id: 'eq.' + id, order: 'started_at.asc,id.asc', limit: '8',
        })
        : [];
      return response.status(200).json(id ? { run: rows[0], actions } : { runs: rows });
    }
    if (request.method === 'POST') {
      if (request.body?.action === 'review_stale') {
        // This is a conservative operator reconciliation marker, not a retry
        // or proof about external writes. Only runs silent for >30 minutes
        // can move from running to needs_review.
        const owned = await db('eyra_agent_runs', 'GET', {
          select: 'id,status,updated_at',
          id: 'eq.' + id, user_id: 'eq.' + owner, limit: '1',
        });
        if (owned.length !== 1 || owned[0].id !== id) {
          return fail(response, 404, 'RUN_NOT_FOUND', 'Agent run not found.');
        }
        const run = owned[0];
        if (run.status !== 'running') {
          return fail(response, 409, 'RUN_NOT_STALE', 'Only running agent executions may be marked for review.');
        }
        const observedUpdatedAt = run.updated_at;
        const updatedTime = typeof observedUpdatedAt === 'string' ? Date.parse(observedUpdatedAt) : NaN;
        if (!Number.isFinite(updatedTime)
          || Date.now() - updatedTime < 30 * 60 * 1000) {
          return fail(response, 409, 'RUN_NOT_STALE',
            'The agent run is too recent or its last activity cannot be verified.');
        }
        const transition = await db('eyra_agent_runs', 'PATCH', {
          select: 'id,status', id: 'eq.' + id, user_id: 'eq.' + owner,
          status: 'eq.running', updated_at: 'eq.' + observedUpdatedAt,
        }, {
          status: 'needs_review',
          updated_at: new Date().toISOString(),
          finished_at: new Date().toISOString(),
          error_code: 'STALE_RUN_REQUIRES_MANUAL_REVIEW',
        }, { prefer: 'return=representation' });
        if (transition.length !== 1 || transition[0].id !== id
          || transition[0].status !== 'needs_review') {
          return fail(response, 409, 'RUN_CHANGED',
            'The agent run changed while it was being marked for review. Reload its status.');
        }
        // Preserve any confirmed succeeded or failed outcomes. Pending actions
        // are explicitly uncertain; never execute them again.
        try {
          await db('eyra_agent_actions', 'PATCH', {
            select: 'id,status', user_id: 'eq.' + owner,
            run_id: 'eq.' + id, status: 'eq.started',
          }, {
            status: 'needs_review',
            outcome: { reason: 'stale_run_manual_reconciliation' },
            error_code: 'STALE_ACTION_OUTCOME_UNVERIFIED',
            finished_at: new Date().toISOString(),
          }, { prefer: 'return=representation' });
        } catch {
          // The parent is still needs_review. The caller must inspect the
          // actions before any additional attempt, rather than claiming success.
          return fail(response, 503, 'ACTION_REVIEW_INCOMPLETE',
            'The run requires manual review, but some action records could not be updated. Reload the run before proceeding.');
        }
        return response.status(200).json({
          run_id: id, status: 'needs_review', recovery: 'manual_inspection_only',
        });
      }
      if (request.body?.action !== 'cancel') {
        return fail(response, 400, 'INVALID_RUN_ACTION', 'Only cancellation or stale-run review is available.');
      }
      const rows = await db('eyra_agent_runs', 'PATCH', {
        select: 'id,status', id: 'eq.' + id,
        user_id: 'eq.' + owner, status: 'eq.running',
      }, {
        status: 'cancelled', finished_at: new Date().toISOString(),
        updated_at: new Date().toISOString(), error_code: 'CANCEL_REQUESTED',
      }, { prefer: 'return=representation' });
      if (rows.length !== 1) {
        return fail(response, 409, 'RUN_NOT_CANCELLABLE',
          'This run is already terminal or inaccessible; inspect its status.');
      }
      // Cancellation is cooperative: in-flight external operations might still
      // commit before the worker checks the updated state.
      return response.status(200).json({ run_id: id, status: 'cancelled', cancellation: 'best_effort' });
    }
    const removed = await db('eyra_agent_runs', 'DELETE', {
      select: 'id', id: 'eq.' + id,
      user_id: 'eq.' + owner, status: 'neq.running',
    }, undefined, { prefer: 'return=representation' });
    if (removed.length !== 1) {
      return fail(response, 409, 'RUN_NOT_DELETABLE',
        'Only terminal runs owned by the caller may be deleted.');
    }
    return response.status(200).json({ run_id: id, deleted: true });
  } catch (error) {
    console.error('EYRA agent history unavailable', { reason: error?.name === 'TimeoutError' ? 'timeout' : 'database' });
    return fail(response, error?.name === 'TimeoutError' ? 504 : 503,
      'AGENT_LEDGER_UNAVAILABLE', 'Agent run history is temporarily unavailable.');
  }
}
