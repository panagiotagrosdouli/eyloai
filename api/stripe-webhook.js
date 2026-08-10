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
  const parts = Object.fromEntries(header.split(',').map(part => part.split('=', 2)));
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  const actualBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

async function updateProfile(userId, patch) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing.');
  const headers = { authorization: `Bearer ${serviceKey}`, apikey: serviceKey };

  const currentResponse = await fetch(
    `${supabaseUrl}/rest/v1/profiles?user_id=eq.${encodeURIComponent(userId)}&select=data&limit=1`,
    { headers },
  );
  if (!currentResponse.ok) throw new Error('Could not load billing profile.');
  const rows = await currentResponse.json();
  const current = rows?.[0]?.data || {};
  const data = { ...current, ...patch, billing_updated_at: new Date().toISOString() };

  const upsert = await fetch(`${supabaseUrl}/rest/v1/profiles?on_conflict=user_id`, {
    method: 'POST',
    headers: {
      ...headers,
      'content-type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({ user_id: userId, data }),
  });
  if (!upsert.ok) throw new Error('Could not persist billing entitlement.');
}

function entitlementFromSubscription(subscription) {
  const status = subscription.status || 'unknown';
  const active = ['active', 'trialing'].includes(status);
  return {
    subscription_tier: active && ['pro', 'founder'].includes(subscription.metadata?.plan)
      ? subscription.metadata.plan
      : 'free',
    subscription_status: status,
    stripe_customer_id: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id || '',
    stripe_subscription_id: subscription.id || '',
    subscription_renewal_at: subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : '',
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
    const object = event.data?.object || {};

    if (event.type === 'checkout.session.completed') {
      const userId = object.client_reference_id || object.metadata?.user_id;
      const plan = object.metadata?.plan;
      if (userId && ['pro', 'founder'].includes(plan)) {
        await updateProfile(userId, {
          subscription_tier: plan,
          subscription_status: 'active',
          stripe_customer_id: typeof object.customer === 'string' ? object.customer : object.customer?.id || '',
          stripe_subscription_id: typeof object.subscription === 'string' ? object.subscription : object.subscription?.id || '',
        });
      }
    }

    if (['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'].includes(event.type)) {
      const userId = object.metadata?.user_id;
      if (userId) await updateProfile(userId, entitlementFromSubscription(object));
    }

    return response.status(200).json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error', { message: error instanceof Error ? error.message : 'Unknown error' });
    return response.status(500).json({ error: 'Webhook processing failed.' });
  }
}
