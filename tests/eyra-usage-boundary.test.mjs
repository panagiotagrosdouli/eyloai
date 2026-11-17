import test from 'node:test';
import assert from 'node:assert/strict';
import { usageState, reserveUsage, releaseUsage } from '../server/eyra-usage-boundary.mjs';

const identity = { user: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
  entitlement: { plan: 'free' },
  supabaseUrl: 'https://stagingstagingstagi.supabase.co', serverKey: 'sb_secret_fixture' };

test('usage allowance is bounded and defaults to free when billing is unconfigured', () => {
  const result = usageState(identity);
  assert.equal(result.plan, 'free');
  assert.match(result.month, /^\d{4}-\d{2}$/);
  assert.equal(typeof result.limit, 'number');
  assert.ok(result.limit > 0);
});

test('usage reservation uses only verified server owner and never refunds a denied request', async () => {
  const prev = globalThis.fetch; let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls++;
    assert.match(url, /\/rest\/v1\/rpc\/reserve_eyra_usage$/);
    const payload = JSON.parse(options.body);
    assert.equal(payload.p_user_id, identity.user.id);
    assert.match(payload.p_action_id, /^[0-9a-f-]{36}$/);
    assert.equal(options.headers.apikey, identity.serverKey);
    return new Response(JSON.stringify({ allowed: false, used: 17 }), { status: 200 });
  };
  try {
    const reservation = await reserveUsage(identity, usageState(identity));
    assert.equal(reservation.allowed, false);
    assert.equal(reservation.actionId, null);
    await releaseUsage(reservation);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = prev; }
});

test('confirmed reservation has stable action id passed to exact release RPC', async () => {
  const prev = globalThis.fetch; let reservedId;
  globalThis.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    if (url.endsWith('/reserve_eyra_usage')) {
      reservedId = body.p_action_id;
      return new Response('{"allowed":true,"used":1}', { status: 200 });
    }
    assert.ok(url.endsWith('/release_eyra_usage'));
    assert.equal(body.p_action_id, reservedId);
    return new Response('{}', { status: 200 });
  };
  try {
    const reservation = await reserveUsage(identity, usageState(identity));
    assert.equal(reservation.allowed, true);
    assert.equal(reservation.actionId, reservedId);
    await releaseUsage(reservation);
  } finally { globalThis.fetch = prev; }
});
