import { applyCors } from '../src/lib/api-cors.mjs';
import { readSupabaseApiConfig } from '../server/supabase-config.mjs';
import { billingActive, serverHeaders, authenticate } from '../server/eyra-auth-boundary.mjs';
import { usageState, reserveUsage, releaseUsage } from '../server/eyra-usage-boundary.mjs';
import { currentUserRequest } from '../server/eyra-turn-authorization.mjs';
import { PROJECT_TOOLS } from '../server/eyra-tool-registry.mjs';
import { executeProjectTool } from '../server/eyra-tool-executor.mjs';
import { EYRA_INSTRUCTIONS } from '../server/eyra-system-instructions.mjs';
import { loadAuthorizedResourceContext } from '../server/eyra-workspace-context.mjs';
import crypto from 'node:crypto';
import { matchesEyraResponseSchema } from '../src/lib/eyra-structured-contract.mjs';
import { relayEyraResponse } from '../src/lib/eyra-stream.mjs';
import {
  durableRunsEnabled, UUID as RUN_UUID, requestFingerprint, startAgentRun,
  reserveAgentAction, completeAgentAction, finalizeAgentRun, isAgentRunCancelled,
} from '../server/eyra-run-ledger.mjs';
import { requestedEyraWrites } from '../src/lib/eyra-write-intent.mjs';
import { inspectOpenAiLimit, outputText, outputRefusal, normalizeEyraSchema } from '../server/eyra-provider-contract.mjs';
import { proposedEyraWriteActions, EYRA_WRITE_PREVIEW_INSTRUCTIONS } from '../server/eyra-write-preview.mjs';
import { approvedEyraWritesEnabled, sealEyraWriteProposal } from '../server/eyra-field-approval.mjs';

const MAX_PROMPT_LENGTH = 24_000;
// Bound provider spending and prevent unexpectedly large responses on every model turn.
const MAX_OUTPUT_TOKENS = 4_096;
const MAX_SCHEMA_LENGTH = 32_000;


export default async function handler(request, response) {
  if (applyCors(request, response, ["POST"])) return;
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  // EYRA responses can include private research and billing usage metadata.
  // Never allow a browser or intermediary to cache success or error responses.
  response.setHeader('Cache-Control', 'private, no-store');

  const authorization = request.headers?.authorization;
  if (typeof authorization !== 'string' || !/^Bearer \S+$/.test(authorization)) {
    return response.status(401).json({ error: 'Authentication required.' });
  }

  if (!readSupabaseApiConfig().hasPublicConfig) {
    return response.status(503).json({
      error: 'EYRA authentication is awaiting verified database configuration.',
      code: 'SUPABASE_NOT_CONFIGURED',
    });
  }

  let reservation = null;
  let agentRunId = null;
  let agentIdentity = null;
  let runClosed = false;
  const actionResults = [];
  let streamTimer;
  let streamController;
  const stopStream = () => { if (!response.writableEnded) streamController?.abort(); };

  try {
    const identity = await authenticate(request.headers.authorization);
    if (!identity) {
      return response.status(401).json({ error: 'Authentication required.' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return response.status(503).json({ error: 'EYRA AI is not configured.', code: 'OPENAI_NOT_CONFIGURED' });

    // Reject malformed input rather than silently coercing objects and arrays
    // into unusable prompts (which could otherwise consume an EYRA action).
    if (typeof request.body?.prompt !== 'string') {
      return response.status(400).json({ error: 'A text prompt is required.', code: 'INVALID_PROMPT' });
    }
    const prompt = request.body.prompt.trim();
    if (!prompt) return response.status(400).json({ error: 'A prompt is required.' });
    if (prompt.length > MAX_PROMPT_LENGTH) {
      return response.status(413).json({
        error: 'This research request is too long. Shorten the prompt and try again.',
        code: 'PROMPT_TOO_LONG',
        max_length: MAX_PROMPT_LENGTH,
      });
    }
    const toolIntent = request.body?.tool_intent;
    if (request.body?.enable_project_tools === true && toolIntent !== undefined && (typeof toolIntent !== 'string' || toolIntent.length > 1000)) {
      return response.status(400).json({ error: 'The current action request is invalid.', code: 'INVALID_TOOL_INTENT' });
    }
    // Tool intent is browser-supplied metadata, not independent authorization.
    // The authenticated user’s actual prompt must authorize every write.
    let resourceInstructions;
    try {
      resourceInstructions = await loadAuthorizedResourceContext(request.body?.resource_context, identity);
    } catch (error) {
      if (error?.code === 'INVALID_RESOURCE_CONTEXT') {
        return response.status(400).json({ error: error.message, code: error.code });
      }
      if (error?.code === 'RESOURCE_NOT_FOUND') {
        return response.status(404).json({ error: error.message, code: error.code });
      }
      return response.status(503).json({ error: 'Workspace context is temporarily unavailable.', code: 'RESOURCE_CONTEXT_UNAVAILABLE' });
    }
    const latestUserRequest = request.body?.latest_user_request;
    if (latestUserRequest !== undefined
      && (typeof latestUserRequest !== 'string' || latestUserRequest.length > 2000)) {
      return response.status(400).json({
        error: 'The latest user request must be a short text value.',
        code: 'INVALID_LATEST_USER_REQUEST',
      });
    }
    if (request.body?.write_confirmed !== undefined && typeof request.body.write_confirmed !== 'boolean') {
      return response.status(400).json({
        error: 'Write confirmation must be a boolean.',
        code: 'INVALID_WRITE_CONFIRMATION',
      });
    }
    const currentIntent = currentUserRequest(prompt, latestUserRequest);
    const requestedWrites = requestedEyraWrites(currentIntent);
    // User approval is explicit per request. It never comes from the model,
    // historical messages, or a retrieved document.
    identity.explicitProjectCreate = requestedWrites.project && request.body?.write_confirmed === true;
    identity.explicitPaperSave = requestedWrites.paper && request.body?.write_confirmed === true;
    const previewWrites = request.body?.preview_write_actions === true;
    if (request.body?.preview_write_actions !== undefined
      && typeof request.body.preview_write_actions !== 'boolean') {
      return response.status(400).json({ error: 'Write preview must be a boolean.', code: 'INVALID_WRITE_PREVIEW' });
    }
    if (previewWrites && (request.body?.enable_project_tools !== true
      || request.body?.write_confirmed === true
      || (!requestedWrites.project && !requestedWrites.paper))) {
      return response.status(400).json({
        error: 'Write preview requires tools enabled, an explicit latest write request and no prior confirmation.',
        code: 'INVALID_WRITE_PREVIEW',
      });
    }


    const requestedSchema = request.body?.response_json_schema;
    const stream = request.body?.stream === true;
    if (request.body?.stream !== undefined && typeof request.body.stream !== 'boolean') return response.status(400).json({ error: 'Streaming must be a boolean.' });
    if (previewWrites && (stream || requestedSchema)) return response.status(400).json({ error: 'Write preview cannot be streamed or combined with structured output.', code: 'INVALID_WRITE_PREVIEW' });
    if (stream && (request.body?.enable_project_tools === true || requestedSchema)) return response.status(400).json({ error: 'Streaming is available for text conversations without record-modifying tools or structured output.', code: 'INVALID_STREAM_MODE' });
    let responseSchema;

    if (requestedSchema !== undefined && requestedSchema !== null) {
      if (typeof requestedSchema !== 'object' || Array.isArray(requestedSchema)) {
        return response.status(400).json({ error: 'The response structure must be an object.', code: 'INVALID_SCHEMA' });
      }
      if (JSON.stringify(requestedSchema).length > MAX_SCHEMA_LENGTH) {
        return response.status(400).json({ error: 'The requested response structure is too large.' });
      }
      try {
        responseSchema = normalizeEyraSchema(requestedSchema);
      } catch (error) {
        return response.status(400).json({
          error: error?.message || 'Invalid response schema.',
          code: 'INVALID_SCHEMA',
        });
      }
    }

    if (!identity.serverKey) {
      return response.status(503).json({
        error: 'EYRA usage controls are not configured.',
        code: 'USAGE_CONTROLS_UNAVAILABLE',
      });
    }

    // Preview is read-only: no agent run or action ledger is started.
    const durableRequested = !previewWrites && durableRunsEnabled() && request.body?.enable_project_tools === true;
    if (durableRequested && (typeof request.body?.run_request_id !== 'string'
      || !RUN_UUID.test(request.body.run_request_id))) {
      return response.status(400).json({
        error: 'A stable UUID run request ID is required while the durable agent ledger is enabled.',
        code: 'INVALID_RUN_REQUEST_ID',
      });
    }

    const usage = usageState(identity);
    reservation = await reserveUsage(identity, usage);
    if (!reservation.allowed) {
      return response.status(429).json({
        error: `The free plan includes ${usage.limit} EYRA AI actions per month. Upgrade to continue.`,
        code: 'PLAN_LIMIT_REACHED',
        plan: usage.plan,
        usage: { used: reservation.used, limit: usage.limit, month: usage.month },
        upgrade_url: '/pricing',
      });
    }

    if (durableRequested) {
      const fingerprint = requestFingerprint({
        prompt, latest_user_request: latestUserRequest || null,
        resource_context: request.body?.resource_context || null,
        tools: true, schema: requestedSchema || null,
        write_confirmed: request.body?.write_confirmed === true,
      });
      try {
        const started = await startAgentRun(identity, request.body.run_request_id, fingerprint, currentIntent || prompt);
        if (!started.created) {
          await releaseUsage(reservation);
          reservation = null;
          return response.status(started.conflict ? 409 : 409).json({
            error: started.conflict
              ? 'This agent request ID already belongs to different instructions.'
              : 'This agent run has already been started. Review its recorded status; writes are never automatically replayed.',
            code: started.conflict ? 'RUN_REQUEST_CONFLICT' : 'RUN_ALREADY_EXISTS',
            run_id: started.id, status: started.status,
          });
        }
        agentRunId = started.id;
        agentIdentity = identity;
        // Every later error path retains a stable recovery handle.
        response.setHeader('X-Eyra-Run-Id', agentRunId);
      } catch (error) {
        await releaseUsage(reservation);
        reservation = null;
        console.error('EYRA durable run unavailable', { reason: 'ledger_unavailable' });
        return response.status(503).json({
          error: 'Durable execution storage is unavailable; no agent action was started.',
          code: 'AGENT_LEDGER_UNAVAILABLE',
        });
      }
    }

    /** @type {Record<string, any>} */
    const requestBody = {
      model: process.env.OPENAI_MODEL || 'gpt-5.6',
      instructions: previewWrites ? EYRA_INSTRUCTIONS + '\n\n' + EYRA_WRITE_PREVIEW_INSTRUCTIONS : EYRA_INSTRUCTIONS,
      input: resourceInstructions
        ? [{ role: 'user', content: prompt }, { role: 'user', content: resourceInstructions }]
        : prompt,
      store: false,
      max_output_tokens: MAX_OUTPUT_TOKENS,
      ...(stream ? { stream: true } : {}),
      ...(previewWrites ? { tools: PROJECT_TOOLS.filter(tool => ['project.create', 'library.save_paper'].includes(tool.name)), tool_choice: 'auto' }
        : request.body?.enable_project_tools === true ? { tools: PROJECT_TOOLS, tool_choice: 'auto' } : {}),
    };

    if (request.body?.enable_project_tools !== undefined && typeof request.body.enable_project_tools !== 'boolean') {
      await releaseUsage(reservation);
      reservation = null;
      return response.status(400).json({ error: 'Project tool access must be enabled explicitly.', code: 'INVALID_TOOL_MODE' });
    }

    if (responseSchema) {
      requestBody.text = {
        format: {
          type: 'json_schema',
          name: 'eyra_result',
          strict: true,
          schema: responseSchema,
        },
      };
    }

    if (stream) {
      streamController = new AbortController();
      streamTimer = setTimeout(() => streamController.abort(), 60_000);
      response.on?.('close', stopStream);
    }
    const providerRequest = {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: stream ? streamController.signal : AbortSignal.timeout(60_000),
    };
    let openAiResponse = await fetch('https://api.openai.com/v1/responses', providerRequest);
    let limitDetails = null;
    if (openAiResponse.status === 429) {
      limitDetails = await inspectOpenAiLimit(openAiResponse);
      // Retry at most once, and only when the provider explicitly indicates a
      // short transient delay. Never retry exhausted quota or an unknown 429.
      if (!limitDetails.quotaExhausted && limitDetails.retryAfter !== null && limitDetails.retryAfter <= 2) {
        await new Promise(resolve => setTimeout(resolve, limitDetails.retryAfter * 1000));
        openAiResponse = await fetch('https://api.openai.com/v1/responses', providerRequest);
        limitDetails = openAiResponse.status === 429 ? await inspectOpenAiLimit(openAiResponse) : null;
      }
    }

    if (!openAiResponse.ok) {
      const requestId = openAiResponse.headers?.get?.('x-request-id') || '';
      console.error('OpenAI request failed', { status: openAiResponse.status, requestId });
      await releaseUsage(reservation);
      reservation = null;
      if (openAiResponse.status === 429) {
        if (limitDetails?.retryAfter) response.setHeader('Retry-After', String(limitDetails.retryAfter));
        return response.status(503).json(limitDetails?.quotaExhausted
          ? { error: 'EYRA API quota is exhausted. An administrator must review OpenAI API billing and usage.', code: 'OPENAI_QUOTA_EXHAUSTED' }
          : { error: 'EYRA provider is rate limited. Please retry after the provider delay.', code: 'OPENAI_RATE_LIMITED', ...(limitDetails?.retryAfter ? { retry_after_seconds: limitDetails.retryAfter } : {}) });
      }
      if (openAiResponse.status === 401 || openAiResponse.status === 403) {
        return response.status(503).json({
          error: 'EYRA provider configuration requires attention.',
          code: 'OPENAI_AUTH_FAILED',
        });
      }
      return response.status(502).json({ error: 'EYRA could not complete this request.', code: 'OPENAI_UPSTREAM_ERROR' });
    }

    if (stream) {
      response.status(200);
      response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      response.setHeader('X-Accel-Buffering', 'no');
      response.setHeader('X-Content-Type-Options', 'nosniff');
      const send = value => { if (!response.destroyed) response.write(`data: ${JSON.stringify(value)}\n\n`); };
      try {
        const final = await relayEyraResponse(openAiResponse.body, delta => send({ type: 'delta', delta }));
        send({ type: 'done', ...final });
      } catch {
        await releaseUsage(reservation); reservation = null;
        send({ type: 'error', error: 'EYRA did not complete the response. The draft was not saved.', code: 'EYRA_INCOMPLETE' });
      }
      response.end();
      return;
    }

    let result = await openAiResponse.json();
    // A 200 HTTP response can still contain a failed or incomplete generation.
    // Never publish partial model output as a finished research analysis.
    if (result.status && result.status !== 'completed') {
      console.warn('EYRA generation did not complete', {
        status: result.status,
        reason: result.incomplete_details?.reason || result.error?.code || 'unknown',
        responseId: result.id,
      });
      await releaseUsage(reservation);
      reservation = null;
      return response.status(502).json({
        error: 'EYRA did not finish generating the analysis. Please retry.',
        code: 'EYRA_INCOMPLETE',
      });
    }
    if (previewWrites) {
      // The first provider output is a proposed write only. Never execute the
      // model call here or pass it through the normal tool executor loop.
      let proposals;
      try {
        proposals = proposedEyraWriteActions(result.output || [], requestedWrites);
      } catch {
        await releaseUsage(reservation); reservation = null;
        return response.status(422).json({
          error: 'EYRA could not prepare a valid draft write for review. No record was changed.',
          code: 'INVALID_WRITE_PROPOSAL',
        });
      }
      return response.status(200).json({
        preview_only: true,
        write_proposals: proposals,
        ...(approvedEyraWritesEnabled() && proposals.length === 1
          ? { write_approval_token: sealEyraWriteProposal({
              ownerId: identity.user.id, request: currentIntent, proposal: proposals[0],
            }) }
          : {}),
        text: proposals.length
          ? 'Review the exact proposed fields. No record has been created or saved.'
          : 'EYRA did not propose a record. No record has been created or saved.',
        model: result.model || process.env.OPENAI_MODEL || 'gpt-5.6',
        response_id: result.id,
        plan: usage.plan,
        usage: { used: reservation.used, limit: usage.limit, month: usage.month },
      });
    }

    /** @type {Array<Record<string, any>>} */
    const toolTranscript = [
      { role: 'user', content: prompt },
      ...(resourceInstructions ? [{ role: 'user', content: resourceInstructions }] : []),
    ];
    const seenToolCallIds = new Set();
    // Only the two allowlisted, authenticated project operations above can be
    // executed. Each call is scoped by the caller's bearer token and Supabase RLS.
    for (let round = 0; round < 3; round += 1) {
      const calls = (result.output || []).filter((item) => item.type === 'function_call');
      if (!calls.length) break;
      if (calls.length + actionResults.length > 8) {
        return response.status(502).json({ error: 'EYRA reached its workspace action budget. Check any confirmed actions before retrying.', code: 'TOOL_BUDGET_EXCEEDED', actions: actionResults });
      }
      if (request.body?.enable_project_tools !== true) {
        return response.status(502).json({ error: 'EYRA requested a tool that is not enabled.', code: 'TOOL_NOT_ENABLED' });
      }
      // Reject malformed or repeated provider IDs before sending another
      // Responses request. Duplicate call IDs cannot be safely disambiguated
      // in the stateless provider transcript.
      const roundIds = new Set();
      for (const call of calls) {
        if (typeof call.call_id !== 'string' || !call.call_id
          || seenToolCallIds.has(call.call_id) || roundIds.has(call.call_id)) {
          actionResults.push({
            action_id: call.call_id, tool: call.name, status: 'failed',
            error: 'Duplicate or invalid tool call identifier.',
          });
          return response.status(502).json({
            error: 'EYRA received an invalid tool sequence. Check completed actions before retrying.',
            code: 'INVALID_TOOL_SEQUENCE',
            actions: actionResults,
          });
        }
        roundIds.add(call.call_id);
      }
      for (const id of roundIds) seenToolCallIds.add(id);
      const outputs = [];
      for (const call of calls) {
        let actionLedgerId = null;
        try {
          if (agentRunId) {
            if (await isAgentRunCancelled(identity, agentRunId)) {
              throw new Error('This agent run was cancelled before the next action.');
            }
            const reserved = await reserveAgentAction(identity, agentRunId, call.call_id,
              call.name, requestFingerprint({ name: call.name, arguments: call.arguments }));
            if (!reserved.reserved) {
              throw new Error('This tool action was already reserved or its outcome is uncertain. Review the run before retrying.');
            }
            actionLedgerId = reserved.id;
          }
          if (call.name === 'project.create' && actionResults.some((action) => action.tool === 'project.create' && action.status === 'succeeded')) {
            throw new Error('Only one project can be created in a single EYRA request.');
          }
          const value = await executeProjectTool(call.name, call.arguments, identity);
          if (actionLedgerId) {
            await completeAgentAction(identity, actionLedgerId, 'succeeded',
              { record_id: typeof value?.id === 'string' ? value.id.slice(0, 100) : null });
          }
          actionResults.push({ action_id: call.call_id, tool: call.name, status: 'succeeded', result: value });
          outputs.push({ type: 'function_call_output', call_id: call.call_id, output: JSON.stringify({ ok: true, result: value }) });
        } catch (error) {
          let safeError = error instanceof Error ? error.message : 'The project action failed.';
          if (actionLedgerId) {
            // A write may have committed despite a response or transport error.
            const uncertain = ['project.create', 'library.save_paper'].includes(call.name);
            try {
              await completeAgentAction(identity, actionLedgerId,
                uncertain ? 'needs_review' : 'failed', { reason: 'execution_incomplete' });
            } catch {
              safeError = 'Action persistence is uncertain. Inspect the workspace and run ledger before attempting any retry.';
            }
            if (uncertain) safeError += ' Verify the workspace before a new write; the action may have committed.';
          }
          const needsReview = Boolean(actionLedgerId)
            && ['project.create', 'library.save_paper'].includes(call.name);
          actionResults.push({
            action_id: call.call_id, tool: call.name,
            status: needsReview ? 'needs_review' : 'failed', error: safeError,
          });
          outputs.push({ type: 'function_call_output', call_id: call.call_id, output: JSON.stringify({ ok: false, error: safeError }) });
        }
      }
      // Preserve every earlier tool exchange; dropping previous rounds causes
      // the model to lose verified results and can trigger repeated actions.
      toolTranscript.push(...(result.output || []), ...outputs);
      const followup = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'gpt-5.6',
          instructions: EYRA_INSTRUCTIONS,
          // Keep the endpoint stateless (`store: false`) and carry the tool
          // exchange explicitly instead of relying on response retrieval.
          input: toolTranscript,
          tools: PROJECT_TOOLS,
          tool_choice: 'auto',
          store: false,
          max_output_tokens: MAX_OUTPUT_TOKENS,
        }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!followup.ok) {
        const details = followup.status === 429 ? await inspectOpenAiLimit(followup) : null;
        console.error('OpenAI tool follow-up failed', { status: followup.status, requestId: followup.headers?.get?.('x-request-id') || '' });
        if (details?.retryAfter) response.setHeader('Retry-After', String(details.retryAfter));
        return response.status(502).json({
          error: details?.quotaExhausted
            ? 'A workspace action ran, but EYRA API quota is exhausted. Review the completed actions before retrying.'
            : 'A workspace action ran, but EYRA could not prepare its final response. Review completed actions before retrying.',
          code: details?.quotaExhausted ? 'TOOL_FOLLOWUP_QUOTA_EXHAUSTED' : 'TOOL_FOLLOWUP_FAILED',
          actions: actionResults,
        });
      }
      result = await followup.json();
      if (result.status && result.status !== 'completed') {
        return response.status(502).json({ error: 'The project action ran, but EYRA did not finish its final response.', code: 'EYRA_INCOMPLETE', actions: actionResults });
      }
    }

    if ((result.output || []).some((item) => item.type === 'function_call')) {
      return response.status(502).json({
        error: 'EYRA reached its tool-step limit before completing the response.',
        code: 'TOOL_STEP_LIMIT',
        actions: actionResults,
      });
    }

    const refusal = outputRefusal(result);
    if (refusal) {
      if (actionResults.length) {
        return response.status(502).json({
          error: 'A project action ran, but EYRA could not prepare its final response.',
          code: 'TOOL_FOLLOWUP_REFUSED',
          actions: actionResults,
        });
      }
      await releaseUsage(reservation);
      reservation = null;
      return response.status(422).json({ error: refusal });
    }

    const text = outputText(result);
    if (!text) {
      if (actionResults.length) {
        return response.status(502).json({
          error: 'A project action ran, but EYRA returned no final response.',
          code: 'TOOL_FOLLOWUP_EMPTY',
          actions: actionResults,
        });
      }
      await releaseUsage(reservation);
      reservation = null;
      return response.status(502).json({ error: 'EYRA returned an empty response.' });
    }

    let data;
    if (responseSchema) {
      try {
        data = JSON.parse(text);
      } catch {
        console.error('EYRA structured response was not valid JSON', { responseId: result.id });
        if (actionResults.length) return response.status(502).json({
          error: 'A project or Library action ran, but EYRA returned invalid final JSON.',
          code: 'TOOL_FOLLOWUP_INVALID', actions: actionResults,
        });
        await releaseUsage(reservation);
        reservation = null;
        return response.status(502).json({ error: 'EYRA returned an invalid structured response.', code: 'EYRA_SCHEMA_MISMATCH' });
      }
      if (!matchesEyraResponseSchema(data, responseSchema)) {
        console.error('EYRA structured response failed the requested schema', { responseId: result.id });
        if (actionResults.length) return response.status(502).json({
          error: 'A project or Library action ran, but EYRA returned an inconsistent final response.',
          code: 'TOOL_FOLLOWUP_INVALID', actions: actionResults,
        });
        await releaseUsage(reservation);
        reservation = null;
        return response.status(502).json({
          error: 'EYRA returned an incomplete or inconsistent structured analysis.',
          code: 'EYRA_SCHEMA_MISMATCH',
        });
      }
    }

    const runStatus = actionResults.some(action => action.status === 'needs_review')
      ? 'needs_review'
      : actionResults.some(action => action.status === 'failed') ? 'partial' : 'completed';
    if (agentRunId) {
      await finalizeAgentRun(identity, agentRunId, runStatus, text, actionResults);
      runClosed = true;
    }
    return response.status(200).json({
      ...(agentRunId ? { run_id: agentRunId, run_status: runStatus } : {}),
      ...(responseSchema ? { data } : {}),
      text,
      model: result.model || process.env.OPENAI_MODEL || 'gpt-5.6',
      response_id: result.id,
      plan: usage.plan,
      usage: {
        used: reservation.used,
        limit: usage.limit,
        month: usage.month,
      },
      ...(actionResults.length ? { actions: actionResults } : {}),
    });
  } catch (error) {
    // Do not refund a request that already executed/attempted real tools.
    // Network failure after a write must not make a further attempt free.
    if (!actionResults.length) await releaseUsage(reservation);
    const timedOut = error?.name === 'TimeoutError';
    // Upstream exception messages can contain private research input.
    const safeErrorClass = ['TimeoutError', 'AbortError', 'TypeError'].includes(error?.name)
      ? error.name : 'Error';
    console.error('EYRA function error', {
      type: timedOut ? 'upstream_timeout' : 'unhandled_error',
      error_class: safeErrorClass,
    });
    if (timedOut) {
      return response.status(504).json({
        error: 'EYRA timed out while contacting an external service. Please try again.',
        code: 'UPSTREAM_TIMEOUT',
      });
    }
    return response.status(500).json({ error: 'EYRA is temporarily unavailable.' });
  } finally {
    if (agentRunId && agentIdentity && !runClosed) {
      try {
        await finalizeAgentRun(agentIdentity, agentRunId,
          actionResults.length ? 'needs_review' : 'failed', '', actionResults,
          actionResults.length ? 'PARTIAL_EXECUTION_REQUIRES_REVIEW' : 'AGENT_INCOMPLETE');
      } catch {
        console.error('EYRA durable run remains unresolved; manual review required', { run_id: agentRunId });
      }
    }
    if (streamTimer) clearTimeout(streamTimer);
    response.off?.('close', stopStream);
  }
}
