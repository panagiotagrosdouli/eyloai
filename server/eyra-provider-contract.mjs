/**
 * OpenAI Responses boundary helpers. These functions operate on provider data,
 * which is untrusted. Never expose raw upstream error bodies to users or logs.
 */
export async function inspectOpenAiLimit(response) {
  let code = '';
  try {
    const payload = await response.json();
    code = String(payload?.error?.code || payload?.error?.type || '').slice(0, 80);
  } catch { /* Malformed provider errors are generic rate limits. */ }
  const quotaExhausted = ['insufficient_quota', 'billing_hard_limit_reached', 'quota_exceeded'].includes(code);
  const rawRetry = response.headers?.get?.('retry-after');
  const retryAfter = rawRetry !== null && rawRetry !== undefined && /^\d{1,4}$/.test(String(rawRetry))
    ? Math.min(300, Number(rawRetry)) : null;
  return { quotaExhausted, retryAfter };
}

export function outputText(openAiResponse) {
  return (openAiResponse.output || [])
    .flatMap(item => item.content || [])
    .filter(item => item.type === 'output_text')
    .map(item => item.text)
    .join('\n')
    .trim();
}

export function outputRefusal(openAiResponse) {
  return (openAiResponse.output || [])
    .flatMap(item => item.content || [])
    .find(item => item.type === 'refusal')?.refusal;
}

const MAX_SCHEMA_DEPTH = 8;

/** Normalize client response schemas to the strict structural subset. */
export function normalizeEyraSchema(schema, depth = 0) {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    throw new Error('Invalid response schema.');
  }
  if (depth > MAX_SCHEMA_DEPTH) throw new Error('Response schema is too deeply nested.');

  const normalized = {};
  const scalarKeys = [
    'type', 'description', 'enum', 'minimum', 'maximum',
    'minLength', 'maxLength', 'minItems', 'maxItems',
  ];

  scalarKeys.forEach(key => {
    if (schema[key] !== undefined) normalized[key] = schema[key];
  });

  if (schema.properties || schema.type === 'object') {
    const properties = schema.properties || {};
    normalized.type = 'object';
    normalized.properties = Object.fromEntries(
      Object.entries(properties).map(([key, value]) => [key, normalizeEyraSchema(value, depth + 1)])
    );
    normalized.required = Object.keys(properties);
    normalized.additionalProperties = false;
  }

  if (schema.items || schema.type === 'array') {
    normalized.type = 'array';
    normalized.items = normalizeEyraSchema(schema.items || { type: 'string' }, depth + 1);
  }

  return normalized;
}
