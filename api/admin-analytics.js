import { applyCors } from '../src/lib/api-cors.mjs';
import { analyticsEnabled, validWorkspaceAnalyticsPayload } from '../src/lib/analytics-readiness.mjs';

function configuredSupabaseAnalytics() {
  const url = String(process.env.VITE_SUPABASE_URL || '').trim();
  const key = String(
    process.env.SUPABASE_PUBLISHABLE_KEY
    || process.env.SUPABASE_ANON_KEY
    || process.env.VITE_SUPABASE_ANON_KEY
    || '',
  ).trim();

  if (!url || !key) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.supabase.co')) return null;
  } catch {
    return null;
  }
  return { url, key };
}

export default async function handler(request, response) {
  if (applyCors(request, response, ["GET"])) return;
  // The response includes per-user metrics. Apply no-store to ALL paths,
  // including authentication failures and upstream errors.
  response.setHeader('Cache-Control', 'private, no-store');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  const authorization = request.headers?.authorization;
  if (typeof authorization !== 'string' || !/^Bearer \S+$/.test(authorization)) {
    return response.status(401).json({ error: 'Authentication required.' });
  }

  if (!analyticsEnabled()) {
    return response.status(503).json({
      error: 'Workspace analytics is awaiting verified database setup.',
      code: 'ANALYTICS_NOT_ENABLED',
    });
  }

  const supabase = configuredSupabaseAnalytics();
  if (!supabase) {
    return response.status(503).json({
      error: 'Workspace analytics is awaiting verified database setup.',
      code: 'ANALYTICS_NOT_CONFIGURED',
    });
  }

  try {
    const upstream = await fetch(`${supabase.url}/rest/v1/rpc/get_workspace_analytics`, {
      method: 'POST',
      headers: {
        apikey: supabase.key,
        authorization,
        'content-type': 'application/json',
      },
      body: '{}',
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    const result = await upstream.json().catch(() => null);

    if (!upstream.ok) {
      const status = [401, 403].includes(upstream.status) ? upstream.status : 502;
      return response.status(status).json({
        error: status === 401 ? 'Authentication required.' : 'Workspace analytics is temporarily unavailable.',
      });
    }

    if (!validWorkspaceAnalyticsPayload(result)) {
      return response.status(502).json({
        error: 'Workspace analytics returned an invalid response.',
        code: 'ANALYTICS_INVALID_RESPONSE',
      });
    }

    return response.status(200).json(result);
  } catch (error) {
    const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    console.error('Workspace analytics failed', {
      type: timedOut ? 'upstream_timeout' : 'upstream_error',
    });
    return response.status(timedOut ? 504 : 502).json({
      error: 'Workspace analytics is temporarily unavailable.',
    });
  }
}
