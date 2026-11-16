import test from 'node:test';
import assert from 'node:assert/strict';
import { sessionRequest } from '../src/lib/auth/sessionRequest.mjs';

const session = (id = 'owner-a', token = 'token-a') => ({ user: { id }, access_token: token });
function fixture() {
  const state = { current: session(), sent: [], refreshed: 0, invalidated: [], unsubscribed: 0 };
  let onChange;
  const runtime = {
    auth: {
      getSession: async () => ({ data: { session: state.current } }),
      onAuthStateChange: callback => {
        onChange = callback;
        return { data: { subscription: { unsubscribe: () => { state.unsubscribed++; } } } };
      },
    },
    getUsableSession: async ({ forceRefresh }) => {
      if (forceRefresh) { state.refreshed++; state.current = session('owner-a', 'refreshed-a'); }
      return state.current;
    },
    invalidateAuthentication: async (_, token) => {
      state.invalidated.push(token);
      return new Error('Authentication required');
    },
    fetchImpl: async (url, options) => {
      state.sent.push({ url, ...options });
      return new Response('{}');
    },
  };
  const change = (next, event = 'SIGNED_IN') => { state.current = next; onChange(event, next); };
  return { state, runtime, change };
}

test('same-account token refresh retries once with the exact body and preserved Headers', async () => {
  const { state, runtime } = fixture();
  runtime.fetchImpl = async (url, options) => {
    state.sent.push({ url, ...options });
    return new Response('{}', { status: state.sent.length === 1 ? 401 : 200 });
  };
  await (await sessionRequest('/private', { method: 'POST', body: '{"private":"a"}', headers: new Headers({ 'content-type': 'application/json' }) }, runtime)).text();
  assert.equal(state.sent.length, 2);
  assert.equal(state.sent[1].body, state.sent[0].body);
  assert.equal(state.sent[1].headers.get('content-type'), 'application/json');
  assert.equal(state.sent[0].headers.get('authorization'), 'Bearer token-a');
  assert.equal(state.sent[1].headers.get('authorization'), 'Bearer refreshed-a');
  assert.deepEqual(state.invalidated, []);
  assert.equal(state.unsubscribed, 1);
});

for (const status of [200, 401]) {
  test(`a delayed ${status} after switching accounts never returns private data or retries`, async () => {
    const { state, runtime, change } = fixture();
    runtime.fetchImpl = async () => {
      change(session('owner-b', 'token-b'));
      return new Response('{"private":"a"}', { status });
    };
    await assert.rejects(sessionRequest('/private', {}, runtime), { code: 'SESSION_CHANGED' });
    assert.equal(state.refreshed, 0);
    assert.deepEqual(state.invalidated, []);
    assert.equal(state.current.user.id, 'owner-b');
    assert.equal(state.unsubscribed, 1);
  });
}

test('account change during refresh cannot replay the first account request body', async () => {
  const { state, runtime } = fixture();
  runtime.getUsableSession = async ({ forceRefresh }) => {
    if (forceRefresh) state.current = session('owner-b', 'token-b');
    return state.current;
  };
  runtime.fetchImpl = async (url, options) => {
    state.sent.push(options);
    return new Response('{}', { status: 401 });
  };
  await assert.rejects(sessionRequest('/private', { body: 'owner-a research' }, runtime), { code: 'SESSION_CHANGED' });
  assert.equal(state.sent.length, 1);
  assert.deepEqual(state.invalidated, []);
});

test('sign-out then sign-in to the same account is still a request boundary', async () => {
  const { state, runtime, change } = fixture();
  runtime.fetchImpl = async () => {
    change(null, 'SIGNED_OUT');
    change(session());
    return new Response('{}', { status: 401 });
  };
  await assert.rejects(sessionRequest('/private', {}, runtime), { code: 'SESSION_CHANGED' });
  assert.equal(state.refreshed, 0);
});

test('in-flight requests receive cancellation on an account boundary', async () => {
  const { runtime, change, state } = fixture();
  let signal;
  runtime.fetchImpl = async (_, options) => {
    signal = options.signal;
    change(session('owner-b', 'token-b'));
    signal.throwIfAborted();
  };
  await assert.rejects(sessionRequest('/private', {}, runtime), { code: 'SESSION_CHANGED' });
  assert.equal(signal.aborted, true);
  assert.equal(state.unsubscribed, 1);
});

test('same-account TOKEN_REFRESHED events do not cancel successful requests', async () => {
  const { runtime, change, state } = fixture();
  runtime.fetchImpl = async () => {
    change(session('owner-a', 'rotated-a'), 'TOKEN_REFRESHED');
    return new Response('{}');
  };
  const response = await sessionRequest('/private', {}, runtime);
  assert.equal(response.status, 200);
  await response.text();
  assert.equal(state.unsubscribed, 1);
});

test('two rejected tokens invalidate only the last rejected token and never retry a third time', async () => {
  const { state, runtime } = fixture();
  runtime.fetchImpl = async (_, options) => { state.sent.push(options); return new Response('{}', { status: 401 }); };
  await assert.rejects(sessionRequest('/private', {}, runtime), /Authentication required/);
  assert.equal(state.sent.length, 2);
  assert.deepEqual(state.invalidated, ['refreshed-a']);
  assert.equal(state.unsubscribed, 1);
});

test('caller cancellation prevents refresh and removes the auth listener', async () => {
  const { state, runtime } = fixture();
  const controller = new AbortController();
  runtime.fetchImpl = async () => { controller.abort(); return new Response('{}', { status: 401 }); };
  await assert.rejects(sessionRequest('/private', { signal: controller.signal }, runtime), { name: 'AbortError' });
  assert.equal(state.refreshed, 0);
  assert.deepEqual(state.invalidated, []);
  assert.equal(state.unsubscribed, 1);
});

test('already-cancelled requests do no authentication or network work', async () => {
  const { state, runtime } = fixture();
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(sessionRequest('/private', { signal: controller.signal }, runtime), { name: 'AbortError' });
  assert.equal(state.sent.length, 0);
  assert.equal(state.unsubscribed, 0);
});

test('network failures clean up without replay or invalidation', async () => {
  const { state, runtime } = fixture();
  runtime.fetchImpl = async () => { throw new TypeError('Network unavailable'); };
  await assert.rejects(sessionRequest('/private', {}, runtime), /Network unavailable/);
  assert.equal(state.refreshed, 0);
  assert.deepEqual(state.invalidated, []);
  assert.equal(state.unsubscribed, 1);
});

for (const boundary of ['account', 'caller']) {
  test(`${boundary} cancellation after response headers interrupts a pending body read`, async () => {
    const { state, runtime, change } = fixture();
    const caller = new AbortController();
    let cancelled = false;
    runtime.fetchImpl = async () => new Response(new ReadableStream({ cancel() { cancelled = true; } }));
    const response = await sessionRequest('/private', { signal: caller.signal }, runtime);
    const pending = response.text();
    if (boundary === 'account') change(session('owner-b', 'token-b'));
    else caller.abort();
    await assert.rejects(pending, boundary === 'account' ? { code: 'SESSION_CHANGED' } : { name: 'AbortError' });
    assert.equal(cancelled, true);
    assert.equal(state.unsubscribed, 1);
  });
}

test('discarding a response cancels its body and releases the auth listener', async () => {
  const { state, runtime } = fixture();
  const response = await sessionRequest('/private', {}, runtime);
  await response.body.cancel();
  assert.equal(state.unsubscribed, 1);
});
