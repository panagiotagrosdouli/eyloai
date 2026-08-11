import crypto from 'node:crypto';

const DEFAULT_SUPABASE_URL = 'https://kbzjngpzxpniaumlupaa.supabase.co';
const STRIPE_API_VERSION = '2026-06-24.dahlia';
const CHECKOUT_INTEGRATION_IDENTIFIER = 'eylo_checkout_tkqrmxva';

const PLANS = {
  free: { rank: 0, monthly_ai_actions: 5, project_limit: 1 },
  pro: { rank: 1, monthly_ai_actions: null, project_limit: null },
  founder: { rank: 2, monthly_ai_actions: null, project_limit: null },
  institution: { rank: 3, monthly_ai_actions: null, project_limit: null },
};

function supabaseUrl() {
  return process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
}

function supabasePublicKey() {
  return process.env.SUPABASE_PUBLISHABLE_KEY
    || process.env.SUPABASE_ANON_KEY
    || process.env.VITE_SUPABASE_ANON_KEY;
}

function supabaseServerKey() {
  return process.env.SUPABASE_SECRET_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY;
}

function serverHeaders(key) {
  const headers = { apikey: key, accept: 'application/json' };
  if (!key.startsWith('sb_')) headers.authorization = `Bearer ${key}`;
  return headers;
}

async function identity(authorization) {
  if (!authorization?.startsWith('Bearer ')) return null;

  const publicKey = supabasePublicKey();
  if (!publicKey) return null;

  const userResponse = await fetch(`${supabaseUrl()}/auth/v1/user`, {
    headers: { authorization, apikey: publicKey },
  });
  if (!userResponse.ok) return null;
  const user = await userResponse.json();

  let entitlement = {};
  const serverKey = supabaseServerKey();
  if (serverKey) {
    const entitlementResponse = await fetch(
      `${supabaseUrl()}/rest/v1/billing_entitlements?user_id=eq.${encodeURIComponent(user.id)}&select=*&limit=1`,
      { headers: serverHeaders(serverKey) },
    );
    if (!entitlementResponse.ok) {
      throw new Error('Could not load the server-controlled billing entitlement.');
    }
    const rows = await entitlementResponse.json();
    entitlement = rows?.[0] || {};
  }

  return { user, entitlement };
}

function stripeConfigured() {
  return Boolean(
    process.env.STRIPE_SECRET_KEY
    && process.env.STRIPE_WEBHOOK_SECRET
    && process.env.STRIPE_PRO_PRICE_ID
    && process.env.STRIPE_FOUNDER_PRICE_ID
    && supabaseServerKey()
  );
}

async function stripeRequest(path, body, { idempotencyKey } = {}) {
  const headers = {
    authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
    'content-type': 'application/x-www-form-urlencoded',
    'stripe-version': STRIPE_API_VERSION,
  };
  if (idempotencyKey) headers['idempotency-key'] = idempotencyKey;

  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers,
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

function checkoutIdempotencyKey(userId, plan) {
  const fiveMinuteWindow = Math.floor(Date.now() / 300000);
  return crypto
    .createHash('sha256')
    .update(`eylo-checkout:${userId}:${plan}:${fiveMinuteWindow}`)
    .digest('hex');
}

export default async function handler(request, response) {
  if (!['GET', 'POST'].includes(request.method)) {
    response.setHeader('Allow', 'GET, POST');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    const auth = await identity(request.headers.authorization);
    if (!auth) return response.status(401).json({ error: 'Authentication required.' });

    const plan = PLANS[auth.entitlement.plan] ? auth.entitlement.plan : 'free';
    if (request.method === 'GET') {
      return response.status(200).json({
        plan,
        subscription_status: auth.entitlement.subscription_status || (plan === 'free' ? 'active' : 'unknown'),
        renewal_at: auth.entitlement.subscription_renewal_at || '',
        limits: PLANS[plan],
        billing_configured: stripeConfigured(),
      });
    }

    if (!stripeConfigured()) {
      return response.status(503).json({
        error: 'Billing is not configured yet. Add the Stripe price, webhook and Supabase server environment variables.',
        code: 'BILLING_NOT_CONFIGURED',
      });
    }

    const action = String(request.body?.action || 'checkout');
    const appUrl = applicationUrl(request);

    if (action === 'portal') {
      if (!auth.entitlement.stripe_customer_id) {
        return response.status(400).json({ error: 'No Stripe customer is linked to this account.' });
      }
      const portal = await stripeRequest('billing_portal/sessions', {
        customer: auth.entitlement.stripe_customer_id,
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
      integration_identifier: CHECKOUT_INTEGRATION_IDENTIFIER,
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
    if (auth.entitlement.stripe_customer_id) {
      delete body.customer_email;
      body.customer = auth.entitlement.stripe_customer_id;
    }

    const session = await stripeRequest('checkout/sessions', body, {
      idempotencyKey: checkoutIdempotencyKey(auth.user.id, requestedPlan),
    });
    return response.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Billing endpoint error', { message: error instanceof Error ? error.message : 'Unknown error' });
    return response.status(500).json({ error: error?.message || 'Billing is temporarily unavailable.' });
  }
}
