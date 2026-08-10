import {
  getUsableSession,
  invalidateAuthentication,
} from '@/lib/supabaseClient';

export const PLAN_RANK = { free: 0, pro: 1, founder: 2, institution: 3 };

const EARLY_ACCESS_STATUS = Object.freeze({
  plan: 'free',
  subscription_status: 'early_access',
  renewal_at: '',
  billing_configured: false,
  limits: {
    ai_actions: null,
    projects: null,
    scheduled_monitoring: false,
  },
});

async function sessionToken(forceRefresh = false) {
  const session = await getUsableSession({
    forceRefresh,
    required: true,
    validate: true,
  });
  return session.access_token;
}

async function billingRequest(options = {}) {
  let token = await sessionToken();
  let response = await fetch('/api/billing', {
    ...options,
    headers: {
      ...options.headers,
      authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401) {
    token = await sessionToken(true);
    response = await fetch('/api/billing', {
      ...options,
      headers: {
        ...options.headers,
        authorization: `Bearer ${token}`,
      },
    });
  }

  if (response.status === 401) {
    const authError = await invalidateAuthentication();
    throw authError;
  }

  return response;
}

async function billingIsConfigured() {
  const response = await fetch('/api/capabilities', {
    headers: { accept: 'application/json' },
  });
  if (!response.ok) throw new Error('Could not verify deployment capabilities.');
  const capabilities = await response.json();
  return capabilities.billing === true;
}

export async function getBillingStatus() {
  // Billing-disabled deployments are explicitly open for early access. Check
  // this public capability before touching authentication so premium tools do
  // not get blocked by an irrelevant subscription request.
  try {
    const configured = await billingIsConfigured();
    if (!configured) return { ...EARLY_ACCESS_STATUS };
  } catch {
    // If capability detection is unavailable, fail closed through the
    // authenticated billing endpoint instead of guessing an entitlement.
  }

  const response = await billingRequest();
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Could not load billing status.');
  return result;
}

export async function startCheckout(plan) {
  const response = await billingRequest({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'checkout', plan }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error || 'Checkout could not start.');
    error.code = result.code;
    throw error;
  }
  window.location.assign(result.url);
}

export async function openBillingPortal() {
  const response = await billingRequest({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'portal' }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Billing portal could not open.');
  window.location.assign(result.url);
}

export function hasPlan(current, minimum) {
  return (PLAN_RANK[current] ?? 0) >= (PLAN_RANK[minimum] ?? 0);
}
