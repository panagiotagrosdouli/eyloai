const DEFAULT_SUPABASE_URL = 'https://kbzjngpzxpniaumlupaa.supabase.co';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_QOF_tW8ve4IFUsflluOhww_aRubMF0V';

function supabasePublicKey() {
  return process.env.SUPABASE_PUBLISHABLE_KEY
    || process.env.SUPABASE_ANON_KEY
    || process.env.VITE_SUPABASE_ANON_KEY
    || DEFAULT_SUPABASE_PUBLISHABLE_KEY;
}

export default async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed.' });
  if (!request.headers.authorization?.startsWith('Bearer ')) {
    return response.status(401).json({ error: 'Authentication required.' });
  }

  try {
    const url = process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
    const upstream = await fetch(`${url}/rest/v1/rpc/get_workspace_analytics`, {
      method: 'POST',
      headers: {
        apikey: supabasePublicKey(),
        authorization: request.headers.authorization,
        'content-type': 'application/json',
      },
      body: '{}',
    });
    const result = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      const status = [401, 403].includes(upstream.status) ? upstream.status : 502;
      return response.status(status).json({
        error: status === 401 ? 'Authentication required.' : 'Workspace analytics is temporarily unavailable.',
      });
    }

    response.setHeader('Cache-Control', 'private, no-store');
    return response.status(200).json(result);
  } catch (error) {
    console.error('Workspace analytics failed', { message: error instanceof Error ? error.message : 'Unknown error' });
    return response.status(500).json({ error: 'Workspace analytics is temporarily unavailable.' });
  }
}
