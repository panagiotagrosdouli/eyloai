/**
 * Deployment operator-controlled capability. The flag is an explicit switch,
 * not scientific or security certification. Set it ONLY after staging and
 * production acceptance of the real get_workspace_analytics database RPC.
 */
export function analyticsEnabled(env = process.env) {
  return env.EYLO_ANALYTICS_ENABLED === '1';
}

export function workspaceAnalyticsConfig(env = process.env) {
  const url = String(env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
  const key = String(
    env.SUPABASE_PUBLISHABLE_KEY
    || env.SUPABASE_ANON_KEY
    || env.VITE_SUPABASE_ANON_KEY
    || '',
  ).trim();
  if (!url || !key) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.supabase.co')
      || parsed.username || parsed.password || parsed.port || parsed.pathname !== '/' || parsed.search || parsed.hash) {
      return null;
    }
  } catch {
    return null;
  }
  return { url, key };
}

export function validWorkspaceAnalyticsPayload(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (!['personal', 'institution'].includes(value.scope)) return false;
  if (typeof value.institution_name !== 'string') return false;
  if (!Number.isInteger(value.members) || value.members < 1) return false;
  if (typeof value.generated_at !== 'string' || !value.generated_at) return false;
  if (!Number.isInteger(value.ai_actions_this_month) || value.ai_actions_this_month < 0) return false;
  const counts = value.counts;
  if (!counts || typeof counts !== 'object' || Array.isArray(counts)) return false;
  const expected = ['projects', 'saved_papers', 'saved_researchers', 'saved_opportunities', 'meetings', 'watchlists'];
  return expected.every(key => Number.isInteger(counts[key]) && counts[key] >= 0);
}
