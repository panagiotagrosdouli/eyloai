import test from 'node:test';
import assert from 'node:assert/strict';
import { readEyraEvents, relayEyraResponse } from '../src/lib/eyra-stream.mjs';
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
