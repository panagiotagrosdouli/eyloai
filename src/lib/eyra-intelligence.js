// EYRA intelligence client.
//
// Every free-form and structured request is executed by the authenticated
// server-side OpenAI endpoint. EYLO never substitutes template content and
// presents it as live AI.

import {
  getUsableSession,
  invalidateAuthentication,
} from '@/lib/supabaseClient';
import { trackEyraActionCompleted } from '@/lib/product-analytics';

export class EyraRequestError extends Error {
  constructor(message, status, details = {}) {
    super(message);
    this.name = 'EyraRequestError';
    this.status = status;
    this.actions = Array.isArray(details.actions) ? details.actions : [];
  }
}

async function getAccessToken(forceRefresh = false) {
  const session = await getUsableSession({
    forceRefresh,
    required: true,
    validate: true,
  });
  return session.access_token;
}

function postAnalysis(accessToken, prompt, responseSchema, signal, enableProjectTools = false, toolIntent = '') {
  return fetch('/api/eyra', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    signal,
    body: JSON.stringify({
      prompt,
      ...(responseSchema ? { response_json_schema: responseSchema } : {}),
      ...(enableProjectTools ? { enable_project_tools: true } : {}),
      ...(enableProjectTools && toolIntent ? { tool_intent: toolIntent } : {}),
    }),
  });
}

async function requestOpenAiAnalysis(prompt, responseSchema, signal, enableProjectTools = false, toolIntent = '') {
  const cleanPrompt = String(prompt || '').trim();
  if (!cleanPrompt) throw new EyraRequestError('Tell EYRA what you want to analyse.', 400);

  let accessToken = await getAccessToken();
  signal?.throwIfAborted();
  let response = await postAnalysis(accessToken, cleanPrompt, responseSchema, signal, enableProjectTools, toolIntent);

  // A cached browser session can outlive its access token. Refresh once and
  // replay exactly the same request before requiring a new sign-in.
  if (response.status === 401) {
    accessToken = await getAccessToken(true);
    signal?.throwIfAborted();
    response = await postAnalysis(accessToken, cleanPrompt, responseSchema, signal, enableProjectTools, toolIntent);
  }

  if (response.status === 401) {
    const authError = await invalidateAuthentication();
    throw new EyraRequestError(authError.message, 401);
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new EyraRequestError(
      result.error || 'EYRA could not complete this analysis. Please try again.',
      response.status,
      result,
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
    return { text: result.text, actions: Array.isArray(result.actions) ? result.actions : [] };
  }
  return result.text;
}

/**
 * @param {{prompt?: string, response_json_schema?: Record<string, any>, signal?: AbortSignal, enable_project_tools?: boolean, tool_intent?: string}} [options]
 * @returns {Promise<any>}
 */
export async function invokeEyra({ prompt = '', response_json_schema: responseSchema, signal, enable_project_tools: enableProjectTools = false, tool_intent: toolIntent = '' } = {}) {
  const result = await requestOpenAiAnalysis(prompt, responseSchema, signal, enableProjectTools, toolIntent);
  trackEyraActionCompleted();
  return result;
}
