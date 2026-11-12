import { applyCors } from '../src/lib/api-cors.mjs';
import { contactDeliveryConfig } from '../src/lib/contact-readiness.mjs';
import { analyticsEnabled, workspaceAnalyticsConfig } from '../src/lib/analytics-readiness.mjs';
import { stripeTestModeEnabled } from '../src/lib/stripe-readiness.mjs';
import { readSupabaseApiConfig } from './supabase-config.mjs';

function hasValue(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

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
    ai: Boolean(hasValue(process.env.OPENAI_API_KEY) && supabaseServerConfigured()),
    contact: Boolean(contactDeliveryConfig()),
    billing: Boolean(
      stripeTestModeEnabled()
      && hasValue(process.env.STRIPE_SECRET_KEY)
      && hasValue(process.env.STRIPE_WEBHOOK_SECRET)
      && hasValue(process.env.STRIPE_PRO_PRICE_ID)
      && hasValue(process.env.STRIPE_FOUNDER_PRICE_ID)
      && supabaseServerConfigured()
    ),
    // The Vercel cron exists in code, but only advertise it after the operator
    // enables the verified deployment and its scheduler/database credentials.
    scheduled_monitoring: Boolean(
      process.env.EYLO_SCHEDULED_MONITORING_ENABLED === '1'
      && hasValue(process.env.CRON_SECRET)
      && supabaseServerConfigured()
    ),
    // Do not advertise the RPC before actual production Supabase acceptance.
    // Operator enablement is a manual post-verification switch.
    institution_analytics: Boolean(analyticsEnabled() && workspaceAnalyticsConfig()),
  });
}
