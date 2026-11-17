import crypto from 'node:crypto';
import { FREE_MONTHLY_AI_ACTIONS } from '../src/lib/eyra-usage-policy.mjs';
import { billingActive, serverHeaders } from './eyra-auth-boundary.mjs';

const PLAN_LIMITS = { free: FREE_MONTHLY_AI_ACTIONS, pro: null, founder: null, institution: null };

/** Fail-closed monthly usage reservation; refunds only occur when no write was attempted. */
export function usageState(identity) {
  const month = new Date().toISOString().slice(0, 7);
  const billingEnabled = billingActive();
  const plan = billingEnabled && PLAN_LIMITS[identity.entitlement.plan] !== undefined
    ? identity.entitlement.plan
    : 'free';
  return {
    month,
    plan,
    used: 0,
    limit: PLAN_LIMITS[plan],
  };
}

export async function reserveUsage(identity, usage) {
  const actionId = crypto.randomUUID();
  const result = await fetch(
    `${identity.supabaseUrl}/rest/v1/rpc/reserve_eyra_usage`,
    {
      method: 'POST',
      headers: serverHeaders(identity.serverKey),
      body: JSON.stringify({
        p_action_id: actionId,
        p_user_id: identity.user.id,
        p_usage_month: usage.month,
        p_limit: usage.limit,
      }),
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!result.ok) throw new Error(`Usage reservation failed: ${result.status}`);

  const payload = await result.json();
  const reservation = Array.isArray(payload) ? payload[0] : payload;
  return {
    allowed: reservation?.allowed === true,
    used: Number(reservation?.used || 0),
    actionId: reservation?.allowed === true ? actionId : null,
    serverKey: identity.serverKey,
    supabaseUrl: identity.supabaseUrl,
  };
}

export async function releaseUsage(reservation) {
  if (!reservation?.actionId) return;

  try {
    const rollback = await fetch(
      `${reservation.supabaseUrl}/rest/v1/rpc/release_eyra_usage`,
      {
        method: 'POST',
        headers: serverHeaders(reservation.serverKey),
        body: JSON.stringify({ p_action_id: reservation.actionId }),
        signal: AbortSignal.timeout(15_000),
      },
    );
    // HTTP failures do not throw in fetch. Report unsuccessful quota refunds
    // so operators can investigate unexpected usage counts.
    if (!rollback.ok) {
      console.error('EYRA usage rollback was rejected', {
        status: rollback.status,
        actionId: reservation.actionId,
      });
    }
  } catch {
    console.error('EYRA usage rollback failed', { actionId: reservation.actionId });
  }
}

