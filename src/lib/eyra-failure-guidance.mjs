// A safe human-readable diagnostic for the EYRA response path.
// Provider free-text messages are untrusted and must never be repeated here.
export function describeEyraFailure(error) {
  const code = typeof error?.code === 'string' ? error.code : '';
  const status = Number(error?.status);
  if (status === 401 || code === 'AUTH_REQUIRED' || code === 'INVALID_SESSION') {
    return 'Your EYRA session needs to be renewed. Sign in again before requesting a new analysis.';
  }
  if (code === 'OPENAI_QUOTA_EXHAUSTED') {
    return 'EYRA AI credits are exhausted. The service administrator must check OpenAI API billing; resending the question now will not restore credits.';
  }
  if (code === 'OPENAI_RATE_LIMITED' || (status === 429 && code !== 'PLAN_LIMIT_REACHED')) {
    const seconds = Number(error?.retryAfterSeconds);
    const wait = Number.isFinite(seconds) && seconds > 0 && seconds <= 120
      ? ' The provider requested a delay of about ' + Math.ceil(seconds) + ' seconds.' : '';
    return 'The EYRA provider is temporarily rate-limited.' + wait + ' Try again later; previously retrieved source links remain available.';
  }
  if (code === 'PLAN_LIMIT_REACHED') {
    return 'The EYRA usage allowance for this plan has been reached. Check the account usage limits before sending another request.';
  }
  if (code === 'USAGE_CONTROLS_UNAVAILABLE') {
    return 'EYRA cannot currently verify its usage controls. The request was not processed; retry when the service is available.';
  }
  if (code === 'OPENAI_NOT_CONFIGURED' || code === 'OPENAI_AUTH_FAILED') {
    return 'The EYRA AI provider is not configured correctly. An administrator must check the provider connection.';
  }
  if (code === 'PROMPT_TOO_LONG' || status === 413) {
    return 'The EYRA request exceeds the server input limit. Break the question into smaller parts; already retrieved source links are still available.';
  }
  if (code === 'EYRA_UNSUPPORTED_CITATION') {
    return 'The generated text cited a record absent from the retrieved sources. For scientific integrity the answer was withheld; inspect the original source links.';
  }
  if (code === 'EYRA_INCOMPLETE' || code === 'EYRA_STREAM_INCOMPLETE') {
    return 'EYRA stopped before it confirmed a complete response. Partial text was not treated as a finished scientific answer.';
  }
  if (code === 'TOOL_FOLLOWUP_QUOTA_EXHAUSTED' || code === 'TOOL_FOLLOWUP_FAILED'
    || code === 'TOOL_BUDGET_EXCEEDED' || code === 'INVALID_TOOL_SEQUENCE') {
    return 'An authorized workspace tool may have completed before the final analysis failed. Inspect its saved record and run history before requesting another write.';
  }
  return 'EYRA could not finish the analysis. No complete AI response was confirmed; the source records below remain available for independent inspection.';
}
