import { PROJECT_TOOLS } from './eyra-tool-registry.mjs';

/** Strict tool argument validation and bounded untrusted PostgREST responses. */
const TOOL_STRING_LIMITS = {
  title: 180, description: 4000, goal: 2000, milestones: 6000,
  tasks: 6000, query: 180, doi: 255, id: 36, course_id: 36,
};

export function validatedEyraToolArguments(name, rawArguments) {
  const spec = PROJECT_TOOLS.find(tool => tool.name === name);
  if (!spec) throw new Error('Unsupported workspace or research tool.');
  if (typeof rawArguments !== 'string' || rawArguments.length > 32_000) {
    throw new Error('Tool arguments exceed the allowed size.');
  }
  let argumentsObject;
  try { argumentsObject = JSON.parse(rawArguments); } catch {
    throw new Error('Invalid tool arguments.');
  }
  if (!argumentsObject || typeof argumentsObject !== 'object' || Array.isArray(argumentsObject)) {
    throw new Error('Tool arguments must be a JSON object.');
  }
  const permitted = Object.keys(spec.parameters.properties);
  const required = spec.parameters.required;
  if (Object.keys(argumentsObject).some(key => !permitted.includes(key))
    || required.some(key => !Object.hasOwn(argumentsObject, key))) {
    throw new Error('Tool arguments do not match the allowlisted schema.');
  }
  for (const key of permitted) {
    if (typeof argumentsObject[key] !== 'string'
      || argumentsObject[key].length > (key === 'title' && name === 'library.save_paper'
        ? 1000 : (TOOL_STRING_LIMITS[key] || 1000))) {
      throw new Error('Invalid field in tool arguments.');
    }
  }
  return argumentsObject;
}

export async function boundedJsonResponse(result, maxBytes = 1_048_576) {
  const declared = Number(result.headers?.get?.('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new Error('Workspace record response exceeded its safety budget.');
  }
  const reader = result.body?.getReader?.();
  if (!reader) {
    const raw = await result.text();
    if (Buffer.byteLength(raw, 'utf8') > maxBytes) {
      throw new Error('Workspace record response exceeded its safety budget.');
    }
    try { return JSON.parse(raw); } catch { throw new Error('Workspace record response was invalid JSON.'); }
  }
  let bytes = 0;
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!(value instanceof Uint8Array)) {
      throw new Error('Invalid workspace record stream.');
    }
    bytes += value.byteLength;
    if (bytes > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new Error('Workspace record response exceeded its safety budget.');
    }
    chunks.push(value);
  }
  const joined = Buffer.concat(chunks.map(part => Buffer.from(part)));
  try { return JSON.parse(joined.toString('utf8')); }
  catch { throw new Error('Workspace record response was invalid JSON.'); }
}

