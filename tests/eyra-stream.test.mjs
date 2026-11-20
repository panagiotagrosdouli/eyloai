import test from 'node:test';
import assert from 'node:assert/strict';
import { readEyraEvents, relayEyraResponse, readEyraReply } from '../src/lib/eyra-stream.mjs';
import { eyraConversationKey, normalizeEyraConversation } from '../src/lib/eyra-conversation.mjs';

function stream(events, split = false) {
  const bytes = new TextEncoder().encode(events.map(event => `data: ${JSON.stringify(event)}\r\n\r\n`).join(''));
  return new ReadableStream({ start(controller) { if (split) for (const byte of bytes) controller.enqueue(Uint8Array.of(byte)); else controller.enqueue(bytes); controller.close(); } });
}
const completed = text => ({ type: 'response.completed', response: { id: 'response-test', status: 'completed', output: [{ content: [{ type: 'output_text', text }] }] } });

test('stream relay preserves split UTF-8 and requires a completed authoritative response', async () => {
  const deltas=[];
  const result=await relayEyraResponse(stream([{type:'response.output_text.delta',delta:'Έρευνα '},{type:'response.output_text.delta',delta:'[P1]'},completed('Έρευνα [P1]')],true),delta=>deltas.push(delta));
  assert.equal(deltas.join(''),'Έρευνα [P1]'); assert.equal(result.text,'Έρευνα [P1]');
});
test('partial, failed, malformed and oversized streams never become completed answers', async () => {
  await assert.rejects(relayEyraResponse(stream([{type:'response.output_text.delta',delta:'partial'}]),()=>{}),/did not confirm/);
  await assert.rejects(relayEyraResponse(stream([{type:'response.incomplete'}]),()=>{}),/did not complete/);
  const read=async()=>{for await (const _event of readEyraEvents(stream([{type:'large',value:'x'.repeat(100)}]),10)) void _event;};
  await assert.rejects(read(),/budget/);
  const invalid = new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('data: {bad}\n\n'));c.close();}});
  await assert.rejects(async()=>{for await(const _event of readEyraEvents(invalid)) void _event;},/invalid response/);
});
test('saved conversations bind to accounts, retain attribution and reject fabricated citation IDs and excessive content', () => {
  assert.notEqual(eyraConversationKey('user-a'),eyraConversationKey('user-b'));
  assert.equal(eyraConversationKey(null),null);
  const messages=[{role:'user',content:'Review these sources',timestamp:1},{role:'eyra',content:'Retrieved metadata supports a review [P1].',timestamp:2,sources:[{id:'P1',url:'https://doi.org/10.1234/real-record',title:'Retrieved record'}]}];
  assert.equal(normalizeEyraConversation(messages)[1].sources[0].id,'P1');
  assert.throws(()=>normalizeEyraConversation([{...messages[1],content:'Unsupported [P9]'}]),/citation/);
  assert.throws(()=>normalizeEyraConversation([{role:'user',content:'x'.repeat(24001)}]),/unsupported/);
});

test('incomplete OpenAI streams identify safe token-limit and content-filter categories', async () => {
  for (const [reason, pattern] of [
    ['max_output_tokens', /provider exhausted output tokens/],
    ['content_filter', /provider stopped due to content filtering/],
    ['untrusted-user-data-should-not-appear', /generation did not complete/],
  ]) {
    const event = { type: 'response.incomplete', response: { status: 'incomplete', incomplete_details: { reason } } };
    await assert.rejects(relayEyraResponse(stream([event]), () => {}), pattern);
  }
  await assert.rejects(
    relayEyraResponse(stream([{
      type: 'response.incomplete',
      response: { incomplete_details: { reason: 'secret-user-input' } },
    }]), () => {}),
    error => !String(error.message).includes('secret-user-input'),
  );
});

test('a confirmed provider response completes without waiting for a transport EOF and releases its reader', async () => {
  let controller;
  let cancelled = false;
  const body = new ReadableStream({
    start(value) {
      controller = value;
      value.enqueue(new TextEncoder().encode([
        { type: 'response.output_text.delta', delta: 'Confirmed research answer.' },
        completed('Confirmed research answer.'),
      ].map(event => `data: ${JSON.stringify(event)}\n\n`).join('')));
    },
    cancel() { cancelled = true; },
  });
  let timer;
  try {
    const result = await Promise.race([
      relayEyraResponse(body, () => {}),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Completed response incorrectly waited for EOF')), 300); }),
    ]);
    assert.equal(result.text, 'Confirmed research answer.');
    assert.equal(cancelled, true);
    assert.equal(body.locked, false);
  } finally {
    clearTimeout(timer);
    if (!cancelled) controller.close();
  }
});

test('a connection error after the completed provider event cannot discard the authoritative answer', async () => {
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode([
        { type: 'response.output_text.delta', delta: 'Verified completion.' },
        completed('Verified completion.'),
      ].map(event => `data: ${JSON.stringify(event)}\n\n`).join('')));
    },
    pull(controller) { controller.error(new Error('Transport closed after completion')); },
  });
  assert.equal((await relayEyraResponse(body, () => {})).text, 'Verified completion.');
});


test('browser relay accepts a valid done event promptly even when the server connection stays open', async () => {
  let cancelled = false;
  const deltas = [];
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode([
        { type: 'delta', delta: 'Draft answer.' },
        { type: 'done', text: 'Confirmed answer.' },
      ].map(event => `data: ${JSON.stringify(event)}\n\n`).join('')));
    },
    cancel() { cancelled = true; },
  });
  let timer;
  try {
    const result = await Promise.race([
      readEyraReply(body, { onDelta: delta => deltas.push(delta) }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Browser waited for EOF')), 300); }),
    ]);
    assert.equal(result, 'Confirmed answer.');
    assert.deepEqual(deltas, ['Draft answer.']);
    assert.equal(cancelled, true);
    assert.equal(body.locked, false);
  } finally { clearTimeout(timer); if (!cancelled) await body.cancel(); }
});

test('browser relay rejects partial text, invalid completions and non-allowlisted error content', async () => {
  for (const text of ['', '  ', 42, { fabricated: true }, 'x'.repeat(40001)]) {
    await assert.rejects(readEyraReply(stream([{ type: 'done', text }])), /did not confirm/);
  }
  await assert.rejects(readEyraReply(stream([{ type: 'delta', delta: 'partial' }])), /did not confirm/);
  await assert.rejects(readEyraReply(stream([{ type: 'error', code: 'EYRA_INCOMPLETE', error: 'private-provider-body' }])), error => error.code === 'EYRA_INCOMPLETE' && !error.message.includes('private-provider-body'));
  await assert.rejects(readEyraReply(stream([{ type: 'error', code: 'private-provider-body' }])), error => error.code === 'EYRA_STREAM_INCOMPLETE');
});

test('a user cancellation before completion still rejects the browser reply', async () => {
  const controller = new AbortController();
  const body = stream([{ type: 'delta', delta: 'draft' }, { type: 'done', text: 'final' }]);
  await assert.rejects(readEyraReply(body, { signal: controller.signal, onDelta: () => controller.abort() }), error => error.name === 'AbortError');
  assert.equal(body.locked, false);
});

test('a malformed provider completion stays rejected despite a terminal event', async () => {
  for (const output of [[], [{ type: 'function_call', name: 'project.create' }], [{ content: [{ type: 'output_text', text: ' ' }] }]]) {
    await assert.rejects(relayEyraResponse(stream([{ type: 'response.output_text.delta', delta: 'draft' }, { type: 'response.completed', response: { status: 'completed', output } }]), () => {}));
  }
});
