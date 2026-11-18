// Explicit PostgREST schema metadata absence is different from network,
// authorization or policy denial. Never leak upstream SQL or user details.
export function classifyEyraCloudHistoryFailure(error) {
  const code = typeof error?.code === 'string' ? error.code : '';
  return ['PGRST205', '42P01', 'PGRST202', '42883'].includes(code)
    ? 'unavailable' : 'error';
}

export function safeEyraCloudHistoryError(error, fallback) {
  if (classifyEyraCloudHistoryFailure(error) === 'unavailable') {
    return Object.assign(new Error('Cloud conversation history is not activated in this environment. Export this tab to keep a local file.'), {
      code: 'EYRA_CLOUD_HISTORY_UNAVAILABLE',
    });
  }
  return Object.assign(new Error(fallback), { code: 'EYRA_CLOUD_HISTORY_ERROR' });
}

/**
 * Keep a missing hosted EYRA schema distinct from authentication, policy
 * denial and ordinary upstream outages. This classification consumes only
 * the PostgREST machine code; provider text is never returned to clients.
 */
export function classifyEyraConversationReadHttpFailure(status, error) {
  if (classifyEyraCloudHistoryFailure(error) === 'unavailable') {
    return {
      status: 503,
      code: 'EYRA_CLOUD_HISTORY_UNAVAILABLE',
      message: 'Cloud conversation history is not activated in this environment.',
    };
  }
  if (status === 401 || status === 403) {
    return {
      status: 403,
      code: 'CONVERSATION_ACCESS_DENIED',
      message: 'Conversation history could not be accessed.',
    };
  }
  return {
    status: 503,
    code: 'CONVERSATION_SERVICE_UNAVAILABLE',
    message: 'Conversation history is temporarily unavailable.',
  };
}
