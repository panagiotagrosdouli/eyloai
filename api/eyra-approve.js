import { applyCors } from '../src/lib/api-cors.mjs';
import { authenticate } from '../server/eyra-auth-boundary.mjs';
import { readSupabaseApiConfig } from '../server/supabase-config.mjs';
import { requestedEyraWrites } from '../src/lib/eyra-write-intent.mjs';
import { approvedEyraWritesEnabled, verifyEyraWriteApproval } from '../server/eyra-field-approval.mjs';
import { startAgentRun, reserveAgentAction, completeAgentAction, finalizeAgentRun,
  isAgentRunCancelled, requestFingerprint } from '../server/eyra-run-ledger.mjs';
import { executeProjectTool } from '../server/eyra-tool-executor.mjs';

/**
 * Exact-field approval, deliberately disabled until reviewed hosted durable
 * ledger/RLS and signing secret have been activated. It never asks the model
 * to regenerate fields: it executes precisely the authenticated signed draft.
 */
export default async function handler(request, response) {
  if (applyCors(request, response, ['POST'])) return;
  response.setHeader('Cache-Control', 'private, no-store');
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed.' });
  }
  if (!approvedEyraWritesEnabled()) {
    return response.status(503).json({
      code: 'EYRA_FIELD_APPROVAL_DISABLED',
      error: 'Exact-field approval is not yet activated in this environment.',
    });
  }
  if (!readSupabaseApiConfig().hasPublicConfig) {
    return response.status(503).json({ code: 'SUPABASE_NOT_CONFIGURED', error: 'Authentication is unavailable.' });
  }
  const auth = request.headers?.authorization;
  if (typeof auth !== 'string' || !/^Bearer \S+$/.test(auth)) {
    return response.status(401).json({ code: 'AUTH_REQUIRED', error: 'Authentication required.' });
  }
  const payload = request.body;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)
    || Object.keys(payload).some(key => !['request', 'approval_token'].includes(key))
    || typeof payload.request !== 'string' || payload.request.length > 2000
    || typeof payload.approval_token !== 'string' || payload.approval_token.length > 16000) {
    return response.status(400).json({ code: 'INVALID_APPROVAL', error: 'Invalid approval request.' });
  }

  let identity;
  try { identity = await authenticate(auth); }
  catch { return response.status(503).json({ code: 'AUTH_UNAVAILABLE', error: 'Authentication is temporarily unavailable.' }); }
  if (!identity?.user?.id || !identity.serverKey) {
    return response.status(401).json({ code: 'AUTH_REQUIRED', error: 'Authentication required.' });
  }
  let verified;
  try {
    verified = verifyEyraWriteApproval(payload.approval_token, {
      ownerId: identity.user.id, request: payload.request,
    });
    const intent = requestedEyraWrites(payload.request);
    if ((verified.proposal.tool === 'project.create' && !intent.project)
      || (verified.proposal.tool === 'library.save_paper' && !intent.paper)) {
      throw new Error('The current user request does not authorize this write.');
    }
  } catch {
    return response.status(403).json({
      code: 'APPROVAL_INVALID_OR_EXPIRED',
      error: 'The exact-field approval is invalid, expired, or does not match this account.',
    });
  }
  // Reserve the UUID supplied by the *signed server token*, never client input.
  // On replay startAgentRun returns created=false: no second write can execute.
  const { id: requestId, proposal } = verified;
  const fingerprint = requestFingerprint({
    type: 'eyra_approved_write_v1', owner: identity.user.id,
    request: payload.request, tool: proposal.tool, fields: proposal.fields,
  });
  let run;
  try {
    run = await startAgentRun(identity, requestId, fingerprint, payload.request);
  } catch {
    return response.status(503).json({
      code: 'AGENT_LEDGER_UNAVAILABLE',
      error: 'Durable approval storage is unavailable. No action was started.',
    });
  }
  if (!run.created) {
    return response.status(409).json({
      code: run.conflict ? 'APPROVAL_REPLAY_CONFLICT' : 'APPROVAL_ALREADY_USED',
      error: 'This approval has already been reserved. Inspect run history before retrying.',
      run_id: run.id, status: run.status,
    });
  }
  response.setHeader('X-Eyra-Run-Id', run.id);
  let actionId = null;
  let attempted = false;
  try {
    if (await isAgentRunCancelled(identity, run.id)) {
      throw new Error('The approved run was cancelled before starting its action.');
    }
    const reservation = await reserveAgentAction(
      identity, run.id, 'exact_fields_approved', proposal.tool,
      requestFingerprint({ tool: proposal.tool, fields: proposal.fields }),
    );
    if (!reservation.reserved) throw new Error('Action was already reserved or has an uncertain outcome.');
    actionId = reservation.id;

    // The actual model output is never fetched or regenerated on approval.
    identity.explicitProjectCreate = proposal.tool === 'project.create';
    identity.explicitPaperSave = proposal.tool === 'library.save_paper';
    attempted = true;
    const saved = await executeProjectTool(proposal.tool, JSON.stringify(proposal.fields), identity);
    await completeAgentAction(identity, actionId, 'succeeded', {
      record_id: typeof saved?.id === 'string' ? saved.id.slice(0, 100) : null,
    });
    await finalizeAgentRun(identity, run.id, 'completed', 'Approved exact-field write completed.', [
      { action_id: 'exact_fields_approved', tool: proposal.tool, status: 'succeeded', result: saved },
    ]);
    return response.status(200).json({
      status: 'completed', run_id: run.id,
      action: { tool: proposal.tool, status: 'succeeded', record_id: saved?.id || null },
    });
  } catch {
    // Once the approved operation was attempted, a lost response may mean it
    // committed. Never retry automatically and never return a false failure.
    if (actionId) {
      try {
        await completeAgentAction(identity, actionId, attempted ? 'needs_review' : 'failed', {
          reason: attempted ? 'outcome_uncertain' : 'action_not_attempted',
        });
      } catch { /* Preserve the uncertain outcome. */ }
    }
    try {
      await finalizeAgentRun(identity, run.id, attempted ? 'needs_review' : 'failed',
        attempted ? 'Review the actual record before retrying.' : 'Approved action was not started.',
        [{ action_id: 'exact_fields_approved', tool: proposal.tool, status: attempted ? 'needs_review' : 'failed' }],
        attempted ? 'APPROVED_WRITE_OUTCOME_UNCERTAIN' : 'APPROVED_WRITE_NOT_STARTED');
    } catch { /* Ledger failure is itself an uncertain state; never replay. */ }
    return response.status(503).json({
      code: attempted ? 'APPROVED_WRITE_OUTCOME_UNCERTAIN' : 'APPROVED_WRITE_NOT_STARTED',
      error: attempted
        ? 'The approved action may have completed. Inspect the workspace and run history before retrying.'
        : 'The approved action could not be started. Check run history before retrying.',
      run_id: run.id,
    });
  }
}
