/**
 * Deterministic structural validation of the subset of JSON Schema supported by
 * EYRA's server-side normalizeSchema function. Model responses are untrusted.
 * Returns false instead of guessing missing scientific fields.
 */
export function matchesEyraResponseSchema(value, schema, depth = 0) {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema) || depth > 8) return false;

  if (schema.enum !== undefined) {
    if (!Array.isArray(schema.enum) || !schema.enum.some(item => item === value)) return false;
  }

  switch (schema.type) {
    case 'object': {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
      const properties = schema.properties || {};
      if (!properties || typeof properties !== 'object' || Array.isArray(properties)) return false;
      const required = schema.required || [];
      if (!Array.isArray(required) || required.some(name => !Object.hasOwn(value, name))) return false;
      if (schema.additionalProperties === false && Object.keys(value).some(name => !Object.hasOwn(properties, name))) return false;
      return Object.entries(value).every(([name, entry]) =>
        !Object.hasOwn(properties, name) || matchesEyraResponseSchema(entry, properties[name], depth + 1));
    }
    case 'array':
      return Array.isArray(value)
        && (schema.minItems === undefined || value.length >= schema.minItems)
        && (schema.maxItems === undefined || value.length <= schema.maxItems)
        && value.every(item => matchesEyraResponseSchema(item, schema.items, depth + 1));
    case 'string':
      return typeof value === 'string'
        && (schema.minLength === undefined || value.length >= schema.minLength)
        && (schema.maxLength === undefined || value.length <= schema.maxLength);
    case 'number':
    case 'integer':
      return typeof value === 'number'
        && Number.isFinite(value)
        && (schema.type !== 'integer' || Number.isInteger(value))
        && (schema.minimum === undefined || value >= schema.minimum)
        && (schema.maximum === undefined || value <= schema.maximum);
    case 'boolean':
      return typeof value === 'boolean';
    case 'null':
      return value === null;
    default:
      return false;
  }
}
