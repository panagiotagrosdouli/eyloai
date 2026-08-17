const DEFAULT_SUPABASE_URL = 'https://kbzjngpzxpniaumlupaa.supabase.co';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_QOF_tW8ve4IFUsflluOhww_aRubMF0V';
const ENTITY_TABLES = ['projects', 'saved_papers', 'saved_researchers', 'saved_opportunities', 'meetings', 'watchlists'];

function supabasePublicKey() {
  return process.env.SUPABASE_PUBLISHABLE_KEY
    || process.env.SUPABASE_ANON_KEY
    || process.env.VITE_SUPABASE_ANON_KEY
    || DEFAULT_SUPABASE_PUBLISHABLE_KEY;
}

function supabaseServerKey() {
  return process.env.SUPABASE_SECRET_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY;
}

function serverHeaders(key, headers = {}) {
  const result = { apikey: key, ...headers };
  if (!key.startsWith('sb_')) result.authorization = `Bearer ${key}`;
  return result;
}

async function authenticate(authorization) {
  if (!authorization?.startsWith('Bearer ')) return null;
  const anonKey = supabasePublicKey();
  const url = process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const response = await fetch(`${url}/auth/v1/user`, { headers: { authorization, apikey: anonKey } });
  return response.ok ? response.json() : null;
}

async function serviceFetch(path, options = {}) {
  const key = supabaseServerKey();
  const url = process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: serverHeaders(key, options.headers),
  });
  if (!response.ok) throw new Error(`Institution analytics query failed: ${response.status}`);
  return response.json();
}

export default async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed.' });
  if (!supabaseServerKey()) return response.status(503).json({ error: 'Institution analytics is not configured.' });

  try {
    const user = await authenticate(request.headers.authorization);
    if (!user) return response.status(401).json({ error: 'Authentication required.' });

    const profileRows = await serviceFetch(`profiles?user_id=eq.${encodeURIComponent(user.id)}&select=data&limit=1`);
    const profile = profileRows?.[0]?.data || {};
    if (profile.subscription_tier !== 'institution' || profile.organization_role !== 'institution_admin' || !profile.institution_id) {
      return response.status(403).json({ error: 'Institution admin entitlement and institution_id are required.' });
    }

    const allProfiles = await serviceFetch('profiles?select=user_id,data&limit=2000');
    const members = allProfiles.filter(row => row.data?.institution_id === profile.institution_id);
    const memberIds = members.map(row => row.user_id);
    const counts = Object.fromEntries(ENTITY_TABLES.map(table => [table, 0]));

    if (memberIds.length) {
      const filter = encodeURIComponent(`in.(${memberIds.join(',')})`);
      await Promise.all(ENTITY_TABLES.map(async table => {
        const rows = await serviceFetch(`${table}?user_id=${filter}&select=id&limit=10000`);
        counts[table] = rows.length;
      }));
    }

    const month = new Date().toISOString().slice(0, 7);
    const aiActions = members.reduce((total, row) =>
      total + (row.data?.eyra_usage_month === month ? Number(row.data?.eyra_usage_count || 0) : 0), 0);

    return response.status(200).json({
      institution_id: profile.institution_id,
      institution_name: profile.organization || 'Institution',
      members: members.length,
      ai_actions_this_month: aiActions,
      counts,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Institution analytics failed', { message: error instanceof Error ? error.message : 'Unknown error' });
    return response.status(500).json({ error: 'Institution analytics is temporarily unavailable.' });
  }
}
