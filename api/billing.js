const DEFAULT_SUPABASE_URL = 'https://kbzjngpzxpniaumlupaa.supabase.co';

const PLANS = {
  free: { rank: 0, monthly_ai_actions: 5, project_limit: 1 },
  pro: { rank: 1, monthly_ai_actions: null, project_limit: null },
  founder: { rank: 2, monthly_ai_actions: null, project_limit: null },
  institution: { rank: 3, monthly_ai_actions: null, project_limit: null },
};

async function identity(authorization) {
  if (!authorization?.startsWith('Bearer ')) return null;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const supabaseUrl = process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  if (!anonKey) return null;

  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { authorization, apikey: anonKey },
  });
  if (!userResponse.ok) return null;
  const user = await userResponse.json();

  const profileResponse = await fetch(
    `${supabaseUrl}/rest/v1/profiles?user_id=eq.${encodeURIComponent(user.id)}&select=data&limit=1`,
    { headers: { authorization, apikey: anonKey } },
  );
  const rows = profileResponse.ok ? await profileResponse.json() : [];
  return { user, profile: rows?.[0]?.data || {} };
}

function stripeConfigured() {
  return Boolean(
    process.env.STRIPE_SECRET_KEY
    && process.env.STRIPE_WEBHOOK_SECRET
    && process.env.STRIPE_PRO_PRICE_ID
    && process.env.STRIPE_FOUNDER_PRICE_ID
    && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function stripeRequest(path, body) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error?.message || 'Stripe request failed.');
  return result;
}

function applicationUrl(request) {
  const configured = process.env.APP_URL?.replace(/\/$/, '');
  if (configured) return configured;
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || request.headers.host || 'eyloai.vercel.app';
  return host.startsWith('http') ? host : `https://${host}`;
}

export default async function handler(request, response) {
  if (!['GET', 'POST'].includes(request.method)) {
    response.setHeader('Allow', 'GET, POST');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    const auth = await identity(request.headers.authorization);
    if (!auth) return response.status(401).json({ error: 'Authentication required.' });

    const plan = PLANS[auth.profile.subscription_tier] ? auth.profile.subscription_tier : 'free';
    if (request.method === 'GET') {
      return response.status(200).json({
        plan,
        subscription_status: auth.profile.subscription_status || (plan === 'free' ? 'active' : 'unknown'),
        renewal_at: auth.profile.subscription_renewal_at || '',
        limits: PLANS[plan],
        billing_configured: stripeConfigured(),
      });
    }

    if (!stripeConfigured()) {
      return response.status(503).json({
        error: 'Billing is not configured yet. Add the Stripe price, webhook and Supabase service-role environment variables.',
        code: 'BILLING_NOT_CONFIGURED',
      });
    }

    const action = String(request.body?.action || 'checkout');
    const appUrl = applicationUrl(request);

    if (action === 'portal') {
      if (!auth.profile.stripe_customer_id) {
        return response.status(400).json({ error: 'No Stripe customer is linked to this account.' });
      }
      const portal = await stripeRequest('billing_portal/sessions', {
        customer: auth.profile.stripe_customer_id,
        return_url: `${appUrl}/pricing`,
      });
      return response.status(200).json({ url: portal.url });
    }

    const requestedPlan = String(request.body?.plan || '');
    if (!['pro', 'founder'].includes(requestedPlan)) {
      return response.status(400).json({ error: 'Choose a valid paid plan.' });
    }
    const priceId = requestedPlan === 'pro'
      ? process.env.STRIPE_PRO_PRICE_ID
      : process.env.STRIPE_FOUNDER_PRICE_ID;

    const body = {
      mode: 'subscription',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      client_reference_id: auth.user.id,
      customer_email: auth.user.email || '',
      success_url: `${appUrl}/pricing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/pricing?checkout=cancelled`,
      'metadata[user_id]': auth.user.id,
      'metadata[plan]': requestedPlan,
      'subscription_data[metadata][user_id]': auth.user.id,
      'subscription_data[metadata][plan]': requestedPlan,
      allow_promotion_codes: 'true',
    };
    if (auth.profile.stripe_customer_id) {
      delete body.customer_email;
      body.customer = auth.profile.stripe_customer_id;
    }

    const session = await stripeRequest('checkout/sessions', body);
    return response.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Billing endpoint error', { message: error instanceof Error ? error.message : 'Unknown error' });
    return response.status(500).json({ error: error?.message || 'Billing is temporarily unavailable.' });
  }
}
