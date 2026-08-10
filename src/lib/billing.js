import { supabase } from '@/lib/supabaseClient';

export const PLAN_RANK = { free: 0, pro: 1, founder: 2, institution: 3 };

async function sessionToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session?.access_token) throw new Error('Sign in to manage your plan.');
  return data.session.access_token;
}

export async function getBillingStatus() {
  const token = await sessionToken();
  const response = await fetch('/api/billing', { headers: { authorization: `Bearer ${token}` } });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Could not load billing status.');
  return result;
}

export async function startCheckout(plan) {
  const token = await sessionToken();
  const response = await fetch('/api/billing', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
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
  const token = await sessionToken();
  const response = await fetch('/api/billing', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'portal' }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Billing portal could not open.');
  window.location.assign(result.url);
}

export function hasPlan(current, minimum) {
  return (PLAN_RANK[current] ?? 0) >= (PLAN_RANK[minimum] ?? 0);
}
