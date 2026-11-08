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
  return response.status(200).json({
    ai: Boolean(process.env.OPENAI_API_KEY && supabaseServerConfigured()),
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
    // Do not advertise the RPC before actual production Supabase acceptance.
    // Operator enablement is a manual post-verification switch.
    institution_analytics: analyticsEnabled(),
  });
}
