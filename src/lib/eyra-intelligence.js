// EYRA intelligence client.
//
// Every free-form and structured request is executed by the authenticated
// server-side OpenAI endpoint. EYLO never substitutes template content and
// presents it as live AI.

import { protectedApiFetch } from '@/lib/protected-api';
import { trackEyraActionCompleted } from '@/lib/product-analytics';
import { readEyraEvents } from '@/lib/eyra-stream.mjs';

export class EyraRequestError extends Error {
  constructor(message, status, details = {}) {
    super(message);
    this.name = 'EyraRequestError';
    this.status = status;
    this.code = typeof details.code === 'string' ? details.code : null;
    this.retryAfterSeconds = Number.isFinite(details.retry_after_seconds)
      ? Math.max(0, Math.min(120, details.retry_after_seconds)) : null;
    this.actions = Array.isArray(details.actions) ? details.actions : [];
    this.runId = typeof details.run_id === 'string' ? details.run_id : null;
    this.runStatus = typeof details.status === 'string' ? details.status : null;
  }
}

function postAnalysis(prompt, responseSchema, signal, enableProjectTools = false, toolIntent = '', stream = false, resourceContext = undefined, latestUserRequest = undefined, writeConfirmed = false, runRequestId = undefined) {
  return protectedApiFetch('/api/eyra', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    signal,
    body: JSON.stringify({
      prompt,
      ...(stream ? { stream: true } : {}),
      ...(responseSchema ? { response_json_schema: responseSchema } : {}),
      ...(enableProjectTools ? { enable_project_tools: true } : {}),
      ...(enableProjectTools && toolIntent ? { tool_intent: toolIntent } : {}),
      ...(resourceContext ? { resource_context: resourceContext } : {}),
      ...(latestUserRequest !== undefined ? { latest_user_request: latestUserRequest } : {}),
      ...(writeConfirmed ? { write_confirmed: true } : {}),
      ...(enableProjectTools && runRequestId ? { run_request_id: runRequestId } : {}),
    }),
  });
}

async function requestOpenAiAnalysis(prompt, responseSchema, signal, enableProjectTools = false, toolIntent = '', stream = false, onDelta = undefined, resourceContext = undefined, latestUserRequest = undefined, writeConfirmed = false) {
  const cleanPrompt = String(prompt || '').trim();
  if (!cleanPrompt) throw new EyraRequestError('Tell EYRA what you want to analyse.', 400);

  // Stable across an authentication refresh/replay; a fresh invocation receives a new UUID.
  const runRequestId = enableProjectTools ? globalThis.crypto?.randomUUID?.() : undefined;
  signal?.throwIfAborted();
  const response = await postAnalysis(cleanPrompt, responseSchema, signal, enableProjectTools, toolIntent, stream, resourceContext, latestUserRequest, writeConfirmed, runRequestId);

  if (stream && response.ok) {
    let final = null;
    for await (const event of readEyraEvents(response.body)) {
      signal?.throwIfAborted();
      if (event.type === 'delta' && typeof event.delta === 'string') onDelta?.(event.delta);
      else if (event.type === 'done') final = event;
      else if (event.type === 'error') {
        // Streaming can start with HTTP 200 and fail later. Preserve only
        // explicitly allowlisted server codes, never arbitrary provider text.
        const code = ['EYRA_INCOMPLETE', 'EYRA_STREAM_INCOMPLETE'].includes(event.code)
          ? event.code : 'EYRA_STREAM_INCOMPLETE';
        throw new EyraRequestError('EYRA did not complete the response.', 502, { code });
      }
    }
    if (!final?.text) throw new EyraRequestError('EYRA did not confirm the completed response.', 502);
    return final.text;
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new EyraRequestError(
      result.error || 'EYRA could not complete this analysis. Please try again.',
      response.status,
      {
        ...result,
        run_id: result.run_id || response.headers?.get?.('x-eyra-run-id') || null,
      },
    );
  }

  if (responseSchema) {
    if (result.data && typeof result.data === 'object') return result.data;
    if (result.text) {
      try {
        return JSON.parse(result.text);
      } catch {
        throw new EyraRequestError('EYRA returned an invalid structured response.', 502);
      }
    }
    throw new EyraRequestError('EYRA returned an empty structured response.', 502);
  }

  if (!result.text) throw new EyraRequestError('EYRA returned an empty response.', 502);
  if (enableProjectTools) {
    return {
      text: result.text,
      actions: Array.isArray(result.actions) ? result.actions : [],
      run_id: typeof result.run_id === 'string' ? result.run_id : null,
      run_status: typeof result.run_status === 'string' ? result.run_status : null,
    };
  }
  return result.text;
}

/**
 * @param {{prompt?: string, response_json_schema?: Record<string, any>, signal?: AbortSignal, enable_project_tools?: boolean, tool_intent?: string, latest_user_request?: string, write_confirmed?: boolean, resource_context?: {kind:'project'|'paper'|'note', id:string}, stream?: boolean, on_delta?: (text: string) => void}} [options]
 * @returns {Promise<any>}
 */
export async function invokeEyra({ prompt = '', response_json_schema: responseSchema, signal, enable_project_tools: enableProjectTools = false, tool_intent: toolIntent = '', latest_user_request: latestUserRequest, write_confirmed: writeConfirmed = false, resource_context: resourceContext, stream = false, on_delta: onDelta } = {}) {
  const result = await requestOpenAiAnalysis(prompt, responseSchema, signal, enableProjectTools, toolIntent, stream, onDelta, resourceContext, latestUserRequest, writeConfirmed);
  trackEyraActionCompleted();
  return result;
}
