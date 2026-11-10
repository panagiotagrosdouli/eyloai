// Privacy export page endpoint. The authenticated identity is ALWAYS derived
// from Supabase Auth. Browser-supplied IDs and table names are ignored/rejected.
import { applyCors } from '../src/lib/api-cors.mjs';

export const EXPORT_TABLES = Object.freeze([
  'profiles', 'projects', 'ideas', 'meetings', 'saved_papers',
  'saved_researchers', 'saved_opportunities', 'search_history',
  'watchlists', 'monitoring_discoveries', 'notifications',
  'eyra_usage_actions', 'billing_entitlements', 'institution_memberships',
]);

const PAGE_SIZE = 200;
const MAX_OFFSET = 1000000;
const PROJECT_REF = 'kbzjngpzxpniaumlupaa';

function configuration() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY
    || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const serverKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  // Do not fall back to an arbitrary Supabase project with privileged keys.
  if (!url || !publicKey || !serverKey) return null;
  let parsed;
  try { parsed = new URL(url); } catch { return null; }
  if (parsed.protocol !== 'https:' || parsed.origin !== 'https://' + PROJECT_REF + '.supabase.co'
    || parsed.pathname !== '/') return null;
  return { url: parsed.origin, publicKey, serverKey };
}

function credentialHeaders(key) {
  const result = { apikey: key, accept: 'application/json' };
  // Legacy JWT service_role keys need the authorization header.
  if (!key.startsWith('sb_')) result.authorization = 'Bearer ' + key;
  return result;
}

export function validatePageRequest(query) {
  const table = query?.table;
  const offsetRaw = query?.offset ?? '0';
  if (typeof table !== 'string' || !EXPORT_TABLES.includes(table)) return null;
  if (!/^(0|[1-9][0-9]*)$/.test(String(offsetRaw))) return null;
  const offset = Number(offsetRaw);
  if (!Number.isSafeInteger(offset) || offset > MAX_OFFSET || offset % PAGE_SIZE !== 0) return null;
  return { table, offset };
}

async function fetchOwnedPage(config, userId, table, offset) {
  const url = new URL(config.url + '/rest/v1/' + table);
  url.searchParams.set('user_id', 'eq.' + userId);
  url.searchParams.set('select', '*');
  url.searchParams.set('order', table === 'profiles' || table === 'billing_entitlements'
    ? 'user_id.asc' : table === 'eyra_usage_actions' ? 'action_id.asc' : 'id.asc');
  url.searchParams.set('limit', String(PAGE_SIZE + 1));
  url.searchParams.set('offset', String(offset));
  const result = await fetch(url, {
    headers: credentialHeaders(config.serverKey),
    signal: AbortSignal.timeout(15000),
  });
  if (!result.ok) throw new Error('DATA_SOURCE_UNAVAILABLE');
  const rows = await result.json();
  if (!Array.isArray(rows)) throw new Error('INVALID_DATA_SOURCE_RESPONSE');
  return {
    rows: rows.slice(0, PAGE_SIZE),
    next_offset: rows.length > PAGE_SIZE ? offset + PAGE_SIZE : null,
  };
}

export default async function handler(request, response) {
  if (applyCors(request, response, ['GET'])) return;
  response.setHeader('Cache-Control', 'no-store, private');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed.' });
  }
  const page = validatePageRequest(request.query);
  if (!page) return response.status(400).json({ error: 'Invalid export collection or page.' });
  const config = configuration();
  if (!config) return response.status(503).json({ error: 'Privacy export configuration must be verified by an administrator.' });
  const auth = request.headers.authorization;
  if (typeof auth !== 'string' || !/^Bearer [^\s]+$/.test(auth)) {
    return response.status(401).json({ error: 'Authentication required.' });
  }
  try {
    const identity = await fetch(config.url + '/auth/v1/user', {
      headers: { apikey: config.publicKey, authorization: auth },
      signal: AbortSignal.timeout(15000),
    });
    if (!identity.ok) return response.status(401).json({ error: 'Authentication required.' });
    const user = await identity.json();
    if (!/^[a-f\d]{8}-([a-f\d]{4}-){3}[a-f\d]{12}$/i.test(user?.id || '')) {
      return response.status(401).json({ error: 'Authentication required.' });
    }
    const data = await fetchOwnedPage(config, user.id, page.table, page.offset);
    return response.status(200).json({
      table: page.table, offset: page.offset, ...data,
      // Deliberately never serialize Supabase Auth tokens or provider secrets.
    });
  } catch (error) {
    console.error('Privacy export failed', { code: error?.message === 'DATA_SOURCE_UNAVAILABLE'
      ? 'DATA_SOURCE_UNAVAILABLE' : 'EXPORT_FAILED', table: page.table });
    return response.status(502).json({
      error: 'The data export could not be completed. No partial download was generated.',
    });
  }
}
