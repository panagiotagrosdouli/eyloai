import { applyCors } from '../src/lib/api-cors.mjs';
import { analyticsEnabled } from '../src/lib/analytics-readiness.mjs';
import { readSupabaseApiConfig } from './supabase-config.mjs';

export default function handler(request, response) {
  if (applyCors(request, response, ["GET"])) return;
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed.' });
  }
  const supabaseConfig = readSupabaseApiConfig();
  // An OpenAI key alone does not make EYRA usable without the same valid
  // Supabase identity and quota project used by the actual API handler.
  const securedAiConfigured = supabaseConfig.hasPublicConfig && supabaseConfig.hasServerConfig;
  return response.status(200).json({
    ai: Boolean(process.env.OPENAI_API_KEY && securedAiConfigured),
    contact: Boolean(process.env.RESEND_API_KEY && process.env.CONTACT_TO_EMAIL && process.env.RESEND_FROM_EMAIL),
    billing: Boolean(
      process.env.STRIPE_SECRET_KEY
      && process.env.STRIPE_WEBHOOK_SECRET
      && process.env.STRIPE_PRO_PRICE_ID
      && process.env.STRIPE_FOUNDER_PRICE_ID
      && securedAiConfigured
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
