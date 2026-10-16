const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://kbzjngpzxpniaumlupaa.supabase.co';
function serverKey() { return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY; }
function publicKey() { return process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY; }
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) return res.status(401).json({ error: 'Sign in required' });
  const key = serverKey();
  const pub = publicKey();
  if (!key || !pub) return res.status(503).json({ error: 'Owner access is not configured' });
  try {
    // Verify the access token against the live auth provider; never trust an
    // email, user ID, JWT payload or role supplied directly by the browser.
    const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { authorization, apikey: pub },
    });
    if (!authResponse.ok) return res.status(401).json({ error: 'Sign in required' });
    const user = await authResponse.json();
    if (!user?.id) return res.status(401).json({ error: 'Sign in required' });
    const headers = { apikey: key };
    if (!key.startsWith('sb_')) headers.authorization = `Bearer ${key}`;
    const ownerResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/platform_owners?user_id=eq.${encodeURIComponent(user.id)}&select=user_id&limit=1`,
      { headers },
    );
    if (!ownerResponse.ok) return res.status(503).json({ error: 'Owner verification unavailable' });
    const rows = await ownerResponse.json();
    return res.status(rows?.length ? 200 : 403).json(rows?.length
      ? { owner: true } : { owner: false, error: 'Owner access has not been granted' });
  } catch {
    return res.status(503).json({ error: 'Owner verification unavailable' });
  }
}
