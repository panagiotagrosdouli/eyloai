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
