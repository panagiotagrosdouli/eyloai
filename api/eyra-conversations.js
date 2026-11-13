import { applyCors } from '../src/lib/api-cors.mjs';
import { readSupabaseApiConfig } from '../server/supabase-config.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NOT_FOUND = { error: 'Conversation not found.', code: 'CONVERSATION_NOT_FOUND' };

function positiveInt(raw, fallback, max) {
  if (raw === undefined) return fallback;
  if (typeof raw !== 'string' || !/^[1-9]\d*$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value <= max ? value : null;
}

function privateJson(response, status, payload) {
  return response.status(status).json(payload);
}

export default async function handler(request, response) {
  // GET-only, no mutations, no provider calls and no admin database credential.
  if (applyCors(request, response, ['GET'])) return;
  response.setHeader('Cache-Control', 'private, no-store');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return privateJson(response, 405, { error: 'Method not allowed.' });
  }

  const token = request.headers?.authorization;
  if (typeof token !== 'string' || !/^Bearer \S+$/.test(token)) {
    return privateJson(response, 401, { error: 'Authentication required.' });
  }

  const query = request.query || {};
  const id = query.id;
  if (id !== undefined && (typeof id !== 'string' || !UUID.test(id))) {
    return privateJson(response, 400, { error: 'Invalid conversation ID.', code: 'INVALID_CONVERSATION_ID' });
  }
  const limit = positiveInt(query.limit, id ? 100 : 20, id ? 100 : 50);
  const page = positiveInt(query.page, 1, 100);
  if (limit === null || page === null) {
    return privateJson(response, 400, { error: 'Invalid pagination.', code: 'INVALID_PAGINATION' });
  }

  const config = readSupabaseApiConfig();
  if (!config.hasPublicConfig) {
    return privateJson(response, 503, { error: 'Conversation service not configured.', code: 'SUPABASE_NOT_CONFIGURED' });
  }

  // Authenticate through Supabase Auth on every read. Forward the user bearer
  // only to the configured Supabase host; do not use a service-role key.
  const headers = {
    apikey: config.publicKey,
    authorization: token,
    accept: 'application/json',
  };
  async function readRows(table, params) {
    const url = new URL(`${config.url}/rest/v1/${table}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    const result = await fetch(url, {
      headers, cache: 'no-store', signal: AbortSignal.timeout(15000),
    });
    if (!result.ok) throw new Error('Conversation database read failed.');
    const rows = await result.json();
    if (!Array.isArray(rows)) throw new Error('Conversation database returned an invalid payload.');
    return rows;
  }

  try {
    const auth = await fetch(`${config.url}/auth/v1/user`, {
      headers, cache: 'no-store', signal: AbortSignal.timeout(15000),
    });
    if (!auth.ok) return privateJson(response, 401, { error: 'Authentication required.' });
    const user = await auth.json();
    if (typeof user?.id !== 'string' || !UUID.test(user.id)) {
      return privateJson(response, 401, { error: 'Authentication required.' });
    }
    const owner = `eq.${user.id}`;

    if (id) {
      const rows = await readRows('eyra_conversations', {
        select: 'id,title,version,created_date,updated_date',
        id: `eq.${id}`, user_id: owner, limit: '1',
      });
      if (!rows.length) return privateJson(response, 404, NOT_FOUND);
      const messages = await readRows('eyra_messages', {
        select: 'id,conversation_id,sequence_number,role,content,sources,created_date',
        user_id: owner, conversation_id: `eq.${id}`,
        order: 'sequence_number.asc,id.asc',
        limit: String(limit), offset: String((page - 1) * limit),
      });
      return privateJson(response, 200, {
        conversation: rows[0], messages, page, limit, has_more: messages.length === limit,
      });
    }
    const conversations = await readRows('eyra_conversations', {
      select: 'id,title,version,created_date,updated_date',
      user_id: owner, order: 'updated_date.desc,id.desc',
      limit: String(limit), offset: String((page - 1) * limit),
    });
    return privateJson(response, 200, {
      conversations, page, limit, has_more: conversations.length === limit,
    });
  } catch (error) {
    const timeout = error?.name === 'TimeoutError';
    console.error('EYRA conversation read unavailable', { reason: timeout ? 'timeout' : 'upstream' });
    return privateJson(response, timeout ? 504 : 503, {
      error: 'Conversation history is temporarily unavailable.',
      code: timeout ? 'CONVERSATION_TIMEOUT' : 'CONVERSATION_SERVICE_UNAVAILABLE',
    });
  }
}
