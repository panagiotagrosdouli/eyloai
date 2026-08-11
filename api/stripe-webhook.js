import crypto from 'node:crypto';

const DEFAULT_SUPABASE_URL = 'https://kbzjngpzxpniaumlupaa.supabase.co';

export const config = {
  api: { bodyParser: false },
};

async function rawBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

function verifySignature(payload, header, secret) {
  if (!header || !secret) return false;

  let timestamp = '';
  const signatures = [];
  for (const part of header.split(',')) {
    const separator = part.indexOf('=');
    if (separator < 1) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key === 't') timestamp = value;
    if (key === 'v1') signatures.push(value);
  }

  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber) || signatures.length === 0) return false;
  if (Math.abs(Date.now() / 1000 - timestampNumber) > 300) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');

  return signatures.some((signature) => {
    const actualBuffer = Buffer.from(signature, 'hex');
    return actualBuffer.length === expectedBuffer.length
      && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
  });
}

function supabaseUrl() {
  return process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
}

function supabaseServerKey() {
  return process.env.SUPABASE_SECRET_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY;
}

function serverHeaders(key) {
  const headers = {
    apikey: key,
    accept: 'application/json',
    'content-type': 'application/json',
  };
  if (!key.startsWith('sb_')) headers.authorization = `Bearer ${key}`;
  return headers;
}

async function applyEntitlement(event, userId, entitlement, authoritative = true) {
  const serviceKey = supabaseServerKey();
  if (!serviceKey) throw new Error('A Supabase server key is missing.');

  const rpcResponse = await fetch(
    `${supabaseUrl()}/rest/v1/rpc/apply_billing_entitlement`,
    {
      method: 'POST',
      headers: serverHeaders(serviceKey),
      body: JSON.stringify({
        p_event_id: event.id,
        p_event_type: event.type,
        p_event_created_at: authoritative ? Number(event.created || 0) : 0,
        p_user_id: userId,
        p_plan: entitlement.plan,
        p_subscription_status: entitlement.subscription_status,
        p_stripe_customer_id: entitlement.stripe_customer_id || null,
        p_stripe_subscription_id: entitlement.stripe_subscription_id || null,
        p_subscription_renewal_at: entitlement.subscription_renewal_at || null,
      }),
    },
  );

  if (!rpcResponse.ok) {
    const detail = await rpcResponse.json().catch(() => ({}));
    throw new Error(detail.message || 'Could not persist the Stripe entitlement.');
  }
}

function objectId(value) {
  if (typeof value === 'string') return value;
  return value?.id || null;
}

function subscriptionEntitlement(subscription) {
  const status = subscription.status || 'unknown';
  const active = ['active', 'trialing'].includes(status);
  const metadataPlan = subscription.metadata?.plan;
  return {
    plan: active && ['pro', 'founder'].includes(metadataPlan)
      ? metadataPlan
      : 'free',
    subscription_status: status,
    stripe_customer_id: objectId(subscription.customer),
    stripe_subscription_id: subscription.id || null,
    subscription_renewal_at: subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null,
  };
}

export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' });

  try {
    const payload = await rawBody(request);
    if (!verifySignature(payload, request.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET)) {
      return response.status(400).json({ error: 'Invalid Stripe signature.' });
    }

    const event = JSON.parse(payload);
    if (!event.id || !event.type) {
      return response.status(400).json({ error: 'Invalid Stripe event.' });
    }

    const object = event.data?.object || {};

    if (event.type === 'checkout.session.completed') {
      const userId = object.client_reference_id || object.metadata?.user_id;
      const plan = object.metadata?.plan;
      if (userId && ['pro', 'founder'].includes(plan)) {
        const paid = ['paid', 'no_payment_required'].includes(object.payment_status);
        await applyEntitlement(event, userId, {
          plan: paid ? plan : 'free',
          subscription_status: paid ? 'active' : 'checkout_completed',
          stripe_customer_id: objectId(object.customer),
          stripe_subscription_id: objectId(object.subscription),
          subscription_renewal_at: null,
        }, false);
      }
    }

    if ([
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted',
    ].includes(event.type)) {
      const userId = object.metadata?.user_id;
      if (userId) {
        await applyEntitlement(event, userId, subscriptionEntitlement(object));
      }
    }

    return response.status(200).json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error', { message: error instanceof Error ? error.message : 'Unknown error' });
    return response.status(500).json({ error: 'Webhook processing failed.' });
  }
}
