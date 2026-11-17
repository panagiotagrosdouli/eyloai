// PostgREST missing-schema and missing-function errors are not user errors.
// Classify only explicit database metadata codes; never infer missing tables
// from an unrelated permission, authentication or transport failure.
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
