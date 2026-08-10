// EYRA intelligence client.
//
// Every free-form and structured request is executed by the authenticated
// server-side OpenAI endpoint. EYLO never substitutes template content and
// presents it as live AI.

import {
  getUsableSession,
  invalidateAuthentication,
} from '@/lib/supabaseClient';

export class EyraRequestError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'EyraRequestError';
    this.status = status;
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
  // replay exactly the same request before requiring a new sign-in.
  if (response.status === 401) {
    accessToken = await getAccessToken(true);
    response = await postAnalysis(accessToken, cleanPrompt, responseSchema);
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
  return result.text;
}

export async function invokeEyra({ prompt = '', response_json_schema: responseSchema } = {}) {
  return requestOpenAiAnalysis(prompt, responseSchema);
}
