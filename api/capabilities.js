import { earlyAccessUsageLimit } from '../src/lib/eyra-early-access-policy.mjs';
import { analyticsEnabled } from '../src/lib/analytics-readiness.mjs';

function supabaseServerConfigured() {
  return Boolean(
    process.env.SUPABASE_SECRET_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export default function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed.' });
  }
  let earlyAccessMonthlyLimit;
  try {
    earlyAccessMonthlyLimit = earlyAccessUsageLimit();
  } catch {
    return response.status(503).json({ error: 'Service usage configuration is invalid.' });
  }
  return response.status(200).json({
    ai: Boolean(process.env.OPENAI_API_KEY)
      && (earlyAccessMonthlyLimit === null || supabaseServerConfigured()),
    ...(earlyAccessMonthlyLimit !== null ? { early_access_monthly_ai_actions: earlyAccessMonthlyLimit } : {}),
    billing: Boolean(
      process.env.STRIPE_SECRET_KEY
      && process.env.STRIPE_WEBHOOK_SECRET
      && process.env.STRIPE_PRO_PRICE_ID
      && process.env.STRIPE_FOUNDER_PRICE_ID
      && supabaseServerConfigured()
    ),
    // Manual watchlist checks remain available. The production daily schedule
    // is enabled only after explicit consent to send each active query to the
    // selected external research/funding source.
    scheduled_monitoring: false,
    // This RPC is only advertised after explicit acceptance of the ACTUAL
    // production Supabase schema, grants and two-account isolation.
    institution_analytics: analyticsEnabled(),
  });
}
