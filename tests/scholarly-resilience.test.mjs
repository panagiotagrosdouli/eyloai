import test from 'node:test';
import assert from 'node:assert/strict';
import { createScholarlyResilience } from '../server/scholarly-resilience.mjs';
import { fetchWithScholarlyBackoff } from '../src/lib/scholarly-provider-backoff.mjs';

const success = text => ({ status: 200, body: Buffer.from(text), cacheable: true });
test('coalesces identical requests, caches validated success, expires and bounds stored bytes', async () => {
  let clock = 0; let calls = 0; let release;
  const resilience = createScholarlyResilience({ now: () => clock, sleep: async ms => { clock += ms; }, maxEntries: 1, maxBytes: 4, ttlMs: 100 });
  const pending = new Promise(resolve => { release = resolve; });
  const operation = async () => { calls++; await pending; return success('one'); };
  const first = resilience.execute('crossref', 'q1', operation);
  const second = resilience.execute('crossref', 'q1', operation);
  release();
  await Promise.all([first, second]); assert.equal(calls, 1);
  assert.equal((await resilience.execute('crossref', 'q1', operation)).cache, 'HIT');
  clock += 101;
  await resilience.execute('crossref', 'q1', operation); assert.equal(calls, 2);
  await resilience.execute('crossref', 'q2', async () => success('two'));
  await resilience.execute('crossref', 'q1', operation); assert.equal(calls, 3, 'bounded cache evicts the older result');
});

test('429 opens a provider-specific cooldown and does not fabricate an empty success', async () => {
  let clock = 0; let calls = 0;
  const resilience = createScholarlyResilience({ now: () => clock, sleep: async ms => { clock += ms; } });
  await resilience.execute('semantic_scholar', 'one', async () => { calls++; return { status: 429, body: Buffer.from('limited'), retryAfter: '60' }; });
  const cooldown = await resilience.execute('semantic_scholar', 'two', async () => { calls++; return success('bad'); });
  assert.equal(calls, 1); assert.equal(cooldown.status, 429); assert.equal(cooldown.retryAfter, '60');
  assert.match(cooldown.body.toString(), /SOURCE_COOLDOWN/);
  assert.equal((await resilience.execute('europe_pmc', 'three', async () => success('real'))).status, 200);
  clock += 60_000;
  assert.equal((await resilience.execute('semantic_scholar', 'two', async () => success('recovered'))).status, 200);
});

test('three transient failures open a circuit, successful probe closes it, and errors are not cached', async () => {
  let clock = 0; let calls = 0;
  const resilience = createScholarlyResilience({ now: () => clock, sleep: async ms => { clock += ms; } });
  const failure = async () => { calls++; return { status: 503, body: Buffer.from('unavailable') }; };
  for (let i=0;i<3;i++) await resilience.execute('europe_pmc', 'q', failure);
  assert.equal((await resilience.execute('europe_pmc','q',failure)).status,503); assert.equal(calls,3);
  clock += 15_000;
  await resilience.execute('europe_pmc','q',async () => success('recovery'));
  assert.equal((await resilience.execute('europe_pmc','different',async () => success('live'))).status,200);
});

test('throttles different queries and rejects work rather than building an unbounded provider queue', async () => {
  let clock = 0; const waits = []; let release;
  const resilience = createScholarlyResilience({ now: () => clock, sleep: async ms => { waits.push(ms); clock += ms; } });
  const held = resilience.execute('semantic_scholar','one',async () => { await new Promise(resolve => { release = resolve; }); return success('one'); });
  const busy = await resilience.execute('semantic_scholar','two',async () => success('two'));
  assert.equal(busy.status,429); assert.match(busy.body.toString(),/SOURCE_BUSY/);
  release(); await held;
  await resilience.execute('semantic_scholar','two',async () => success('two'));
  assert.deepEqual(waits,[1000]);
});

test('server opt-in retries an unheaded 503 once with bounded exponential-backoff seed; never retries an unheaded 429', async () => {
  let calls=0; const waits=[];
  const result=await fetchWithScholarlyBackoff('https://example.org',{}, {retryWithoutHeader:true,baseDelayMs:750,fetchImpl:async()=> ++calls===1?new Response('failure',{status:503}):new Response('real'),sleep:async ms=>waits.push(ms)});
  assert.equal(result.status,200);assert.equal(calls,2);assert.deepEqual(waits,[750]);
  calls=0;
  await fetchWithScholarlyBackoff('https://example.org',{}, {retryWithoutHeader:true,fetchImpl:async()=>{calls++;return new Response('limited',{status:429});}});
  assert.equal(calls,1);
});

test('server retry budget caps exponential retries at three upstream attempts', async () => {
  let calls=0; const waits=[];
  await fetchWithScholarlyBackoff('https://example.org',{}, {retryWithoutHeader:true,maxAttempts:99,baseDelayMs:500,fetchImpl:async()=>{calls++;return new Response('down',{status:503});},sleep:async ms=>waits.push(ms)});
  assert.equal(calls,3);assert.deepEqual(waits,[500,1000]);
});
