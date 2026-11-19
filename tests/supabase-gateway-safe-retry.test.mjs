import test from 'node:test';
import assert from 'node:assert/strict';
import { mayRetrySupabaseGatewayRequest } from '../src/lib/auth/gatewayRetryPolicy.mjs';

test('proxy failover may retry ordinary GET and HEAD requests', () => {
  assert.equal(mayRetrySupabaseGatewayRequest('https://example.test/supabase/rest/v1/projects'), true);
  assert.equal(mayRetrySupabaseGatewayRequest('https://example.test/supabase/rest/v1/projects', { method: 'HEAD' }), true);
  assert.equal(mayRetrySupabaseGatewayRequest(new Request('https://example.test/auth/v1/user')), true);
});

test('proxy failover must never replay authentication mutations', () => {
  const url = 'https://example.test/auth/v1/token';
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    assert.equal(mayRetrySupabaseGatewayRequest(url, { method }), false, method);
  }
  assert.equal(mayRetrySupabaseGatewayRequest(new Request(url, { method: 'POST' })), false);
  assert.equal(mayRetrySupabaseGatewayRequest(new Request(url, { method: 'POST' }), { method: 'GET' }), true);
});
