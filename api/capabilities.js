function supabaseServerConfigured() {
  return Boolean(
    process.env.SUPABASE_SECRET_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export default function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed.' });
  response.setHeader('Cache-Control', 'no-store');
  return response.status(200).json({
    ai: Boolean(process.env.OPENAI_API_KEY),
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
    // Analytics is served by an authenticated, least-privilege database RPC;
    // no Vercel service-role credential is required.
    institution_analytics: true,
  });
}
