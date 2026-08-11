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
    scheduled_monitoring: Boolean(process.env.CRON_SECRET && supabaseServerConfigured()),
    institution_analytics: supabaseServerConfigured(),
  });
}
