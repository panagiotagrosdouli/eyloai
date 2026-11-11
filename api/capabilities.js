import { applyCors } from '../src/lib/api-cors.mjs';
import { analyticsEnabled } from '../src/lib/analytics-readiness.mjs';
import { readSupabaseApiConfig } from './supabase-config.mjs';

function supabaseServerConfigured() {
  const config = readSupabaseApiConfig();
  // All protected services require the same validated project origin and
  // public credential that their authentication handlers use.
  return config.hasPublicConfig && config.hasServerConfig;
}

export default function handler(request, response) {
  if (applyCors(request, response, ["GET"])) return;
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed.' });
  }
  return response.status(200).json({
    ai: Boolean(process.env.OPENAI_API_KEY && supabaseServerConfigured()),
    contact: Boolean(process.env.RESEND_API_KEY && process.env.CONTACT_TO_EMAIL && process.env.RESEND_FROM_EMAIL),
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
