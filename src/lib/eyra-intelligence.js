// EYRA intelligence client.
//
// Every free-form and structured request is executed by the authenticated
// server-side OpenAI endpoint. EYLO never substitutes template content and
// presents it as live AI.

import { supabase } from '@/lib/supabaseClient';

export class EyraRequestError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'EyraRequestError';
    this.status = status;
  }
}

async function getAccessToken(forceRefresh = false) {
  if (!supabase) throw new EyraRequestError('EYRA authentication is not configured.', 503);

  const initial = forceRefresh
    ? await supabase.auth.refreshSession()
    : await supabase.auth.getSession();
  if (initial.error) throw initial.error;
  if (initial.data.session?.access_token) return initial.data.session.access_token;

  if (!forceRefresh) {
    const refreshed = await supabase.auth.refreshSession();
    if (refreshed.error) throw refreshed.error;
    if (refreshed.data.session?.access_token) return refreshed.data.session.access_token;
  }

  throw new EyraRequestError('Your secure session expired. Sign in again to continue AI analysis.', 401);
}

function postAnalysis(accessToken, prompt, responseSchema) {
  return fetch('/api/eyra', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      ...(responseSchema ? { response_json_schema: responseSchema } : {}),
    }),
  });
}

async function requestOpenAiAnalysis(prompt, responseSchema) {
  const cleanPrompt = String(prompt || '').trim();
  if (!cleanPrompt) throw new EyraRequestError('Tell EYRA what you want to analyse.', 400);

  let accessToken = await getAccessToken();
  let response = await postAnalysis(accessToken, cleanPrompt, responseSchema);

  // A cached browser session can outlive its access token. Refresh once and
  // replay the same request before surfacing an authentication failure.
  if (response.status === 401) {
    accessToken = await getAccessToken(true);
    response = await postAnalysis(accessToken, cleanPrompt, responseSchema);
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = response.status === 401
      ? 'Your secure EYRA session could not be renewed. Sign in again to continue AI analysis.'
      : result.error || 'EYRA could not complete this analysis. Please try again.';
    throw new EyraRequestError(message, response.status);
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
  return result.text;
}

export async function invokeEyra({ prompt = '', response_json_schema: responseSchema } = {}) {
  return requestOpenAiAnalysis(prompt, responseSchema);
}
