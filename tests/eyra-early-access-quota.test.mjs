import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/eyra.js';
import { earlyAccessUsageLimit } from '../src/lib/eyra-early-access-policy.mjs';

function res() {
  return {
    statusCode: 200, body: null, headers: {},
    setHeader(key, value) { this.headers[key] = value; },
    status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; return this; },
  };
}
const vars = ['OPENAI_API_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRO_PRICE_ID', 'STRIPE_FOUNDER_PRICE_ID', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'EYRA_EARLY_ACCESS_MONTHLY_LIMIT'];
const saved = Object.fromEntries(vars.map(k => [k, process.env[k]]));
const fetchBefore = globalThis.fetch;
function setup() {
  for (const key of vars) delete process.env[key];
  process.env.OPENAI_API_KEY = 'test-placeholder-openai';
  process.env.EYRA_EARLY_ACCESS_MONTHLY_LIMIT = '3';
}
async function withEnv(task) {
  setup();
  try { await task(); } finally {
    globalThis.fetch = fetchBefore;
    for (const key of vars) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}
function request() { return {method:'POST', headers:{authorization:'Bearer test-session'}, body:{prompt:'Explain the finding.'}}; }

test('policy cap parsing prevents invalid, zero and negative limits', () => {
  assert.equal(earlyAccessUsageLimit({}), null);
  assert.equal(earlyAccessUsageLimit({EYRA_EARLY_ACCESS_MONTHLY_LIMIT:'20'}),20);
  for (const value of ['0','-1','NaN','2.2','100000'])
    assert.throws(() => earlyAccessUsageLimit({EYRA_EARLY_ACCESS_MONTHLY_LIMIT:value}));
});

test('a configured cap without a private Supabase key fails before OpenAI', async () => withEnv(async () => {
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).endsWith('/auth/v1/user')) return {ok:true,status:200,json:async()=>({id:'user-a'})};
    throw Error('The quota backend is absent; no model calls allowed');
  };
  const output = res();
  await handler(request(), output);
  assert.equal(output.statusCode,503);
  assert.equal(output.body.code,'EYRA_USAGE_BACKEND_UNAVAILABLE');
  assert.equal(calls.length,1);
}));

test('a quota rejection prevents paid OpenAI requests', async () => withEnv(async () => {
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_test-only';
  const calls = [];
  globalThis.fetch = async (url, options={}) => {
    calls.push(String(url));
    if (String(url).endsWith('/auth/v1/user')) return {ok:true,status:200,json:async()=>({id:'user-a'})};
    if (String(url).endsWith('/rpc/reserve_eyra_usage')) {
      const body=JSON.parse(options.body);
      assert.equal(body.p_limit,3);
      assert.equal(body.p_user_id,'user-a');
      assert.equal(options.headers.apikey,'sb_secret_test-only');
      return {ok:true,status:200,json:async()=>[{allowed:false,used:3}]};
    }
    throw Error('Rejected quota must stop upstream model calls');
  };
  const output=res();
  await handler(request(),output);
  assert.equal(output.statusCode,429);
  assert.equal(output.body.usage.limit,3);
  assert.equal(calls.length,2);
}));

test('an accepted quota reservation reaches OpenAI with metered usage', async () => withEnv(async () => {
  process.env.SUPABASE_SECRET_KEY='sb_secret_test-only';
  const calls=[];
  globalThis.fetch=async (url,options={}) => {
    calls.push(String(url));
    if (String(url).endsWith('/auth/v1/user')) return {ok:true,status:200,json:async()=>({id:'user-a'})};
    if (String(url).endsWith('/rpc/reserve_eyra_usage')) return {ok:true,status:200,json:async()=>[{allowed:true,used:1}]};
    if (String(url)==='https://api.openai.com/v1/responses') return {ok:true,status:200,headers:{get:()=>null},json:async()=>({status:'completed',id:'mock-response',model:'test-only',output:[{content:[{type:'output_text',text:'Result'}]}]})};
    throw Error('Unexpected URL '+url);
  };
  const output=res();
  await handler(request(),output);
  assert.equal(output.statusCode,200);
  assert.equal(output.body.usage.used,1);
  assert.equal(output.body.usage.limit,3);
  assert.equal(calls.length,3);
}));
