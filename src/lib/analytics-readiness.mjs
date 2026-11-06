/**
 * Deployment operator-controlled capability. The flag is an explicit switch,
 * not scientific or security certification. Set it ONLY after staging and
 * production acceptance of the real get_workspace_analytics database RPC.
 */
export function analyticsEnabled(env = process.env) {
  return env.EYLO_ANALYTICS_ENABLED === '1';
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
