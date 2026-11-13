import { applyCors } from '../src/lib/api-cors.mjs';
import { readSupabaseApiConfig } from './supabase-config.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NOT_FOUND = { error: 'Conversation not found.', code: 'CONVERSATION_NOT_FOUND' };
const SERVICE_UNAVAILABLE = {
  error: 'Conversation saving is unavailable. Your message was not confirmed as saved; retry with the same message ID.',
  code: 'CONVERSATION_SAVE_UNAVAILABLE',
};
const isUuid = (value) => typeof value === 'string' && UUID.test(value);

function respond(res, status, data) {
  return res.status(status).json(data);
}

function parseOperation(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  if (body.action === 'create') {
    if (!isUuid(body.id) || typeof body.title !== 'string'
        || body.title.length < 1 || body.title.length > 180 || !body.title.trim()) return null;
    return {
      method: 'eyra_create_conversation',
      payload: { p_id: body.id, p_title: body.title },
    };
  }
  if (body.action === 'append') {
    const text = body.content?.text;
    if (!isUuid(body.conversation_id) || !isUuid(body.message_id)
        || !['user', 'assistant', 'tool'].includes(body.role)
        || !body.content || typeof body.content !== 'object' || Array.isArray(body.content)
        || Object.keys(body.content).length !== 1
        || typeof text !== 'string' || text.length < 1 || text.length > 16000
        || !text.trim() || Buffer.byteLength(JSON.stringify({ text }), 'utf8') > 65536) return null;
    return {
      method: 'eyra_append_message',
      payload: {
        p_conversation_id: body.conversation_id,
        p_message_id: body.message_id,
        p_role: body.role,
        p_text: text,
      },
    };
  }
  return null;
}

export default async function handler(req, res) {
  if (applyCors(req, res, ['POST'])) return;
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return respond(res, 405, { error: 'Method not allowed.' });
  }
  const authorization = req.headers?.authorization;
  if (typeof authorization !== 'string' || !/^Bearer \S+$/.test(authorization)) {
    return respond(res, 401, { error: 'Authentication required.' });
  }
  const operation = parseOperation(req.body);
  if (!operation) {
    return respond(res, 400, { error: 'Invalid conversation write request.', code: 'CONVERSATION_INVALID_WRITE' });
  }
  const config = readSupabaseApiConfig();
  if (!config.hasPublicConfig) return respond(res, 503, SERVICE_UNAVAILABLE);

  // No service-role credential: verified user JWT + RLS + SECURITY INVOKER RPC.
  const headers = {
    apikey: config.publicKey,
    authorization,
    accept: 'application/json',
    'content-type': 'application/json',
  };
  try {
    const auth = await fetch(`${config.url}/auth/v1/user`, {
      headers, cache: 'no-store', signal: AbortSignal.timeout(15000),
    });
    if (!auth.ok) return respond(res, 401, { error: 'Authentication required.' });
    const user = await auth.json();
    if (!isUuid(user?.id)) return respond(res, 401, { error: 'Authentication required.' });

    const upstream = await fetch(`${config.url}/rest/v1/rpc/${operation.method}`, {
      method: 'POST',
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify(operation.payload),
    });
    if (!upstream.ok) {
      const error = await upstream.json().catch(() => ({}));
      if (error.code === 'P0002') return respond(res, 404, NOT_FOUND);
      if (error.code === '23505') {
        return respond(res, 409, { error: 'This retry ID is already used for different content.', code: 'CONVERSATION_ID_CONFLICT' });
      }
      if (error.code === '22023' || error.code === '23514') {
        return respond(res, 400, { error: 'Invalid conversation content.', code: 'CONVERSATION_VALIDATION_FAILED' });
      }
      // Never expose provider/PostgREST messages, SQL or record identifiers.
      return respond(res, 503, SERVICE_UNAVAILABLE);
    }
    const saved = await upstream.json();
    if (!saved || typeof saved !== 'object' || !isUuid(saved.id)) {
      return respond(res, 503, SERVICE_UNAVAILABLE);
    }
    return respond(res, 200, operation.method === 'eyra_create_conversation'
      ? { conversation: saved }
      : { message: saved });
  } catch (error) {
    console.error('EYRA conversation write failed', {
      kind: error?.name === 'TimeoutError' ? 'timeout' : 'upstream',
    });
    return respond(res, error?.name === 'TimeoutError' ? 504 : 503, SERVICE_UNAVAILABLE);
  }
}
