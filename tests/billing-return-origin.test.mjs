import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import handler from '../api/billing.js';

const oldFetch = globalThis.fetch;
const names = ['APP_URL','VERCEL_PROJECT_PRODUCTION_URL','VITE_SUPABASE_ANON_KEY','SUPABASE_SECRET_KEY','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','STRIPE_PRO_PRICE_ID','STRIPE_FOUNDER_PRICE_ID'];
const oldEnv = Object.fromEntries(names.map(k => [k, process.env[k]]));
after(() => {
  globalThis.fetch = oldFetch;
  for (const k of names) {
    if (oldEnv[k] === undefined) delete process.env[k];
    else process.env[k] = oldEnv[k];
  }
});
function res() {
  return { headers: {}, statusCode: 200, body: null,
    setHeader(k,v){ this.headers[k]=v; },
    status(n){ this.statusCode=n; return this; },
    json(v){ this.body=v; return this; },
  };
}
test('billing never exposes private responses in caches', async () => {
  const r=res();
  await handler({method:'PUT',headers:{host:'attacker.example'}},r);
  assert.equal(r.statusCode,405);
  assert.equal(r.headers['Cache-Control'],'private, no-store');
});
test('billing rejects attacker Host and constructs Stripe URLs from trusted origin', async () => {
  process.env.APP_URL='https://eyloai.example';
  process.env.VITE_SUPABASE_ANON_KEY='test-public-key';
  process.env.SUPABASE_SECRET_KEY='test-secret-key';
  process.env.STRIPE_SECRET_KEY='test-stripe-key';
  process.env.STRIPE_WEBHOOK_SECRET='test-webhook';
  process.env.STRIPE_PRO_PRICE_ID='price_test_pro';
  process.env.STRIPE_FOUNDER_PRICE_ID='price_test_founder';
  const observed=[];
  globalThis.fetch = async (url,options={}) => {
    observed.push({url:String(url),options});
    if (String(url).endsWith('/auth/v1/user')) return {ok:true,json:async()=>({id:'user-test',email:'researcher@example.com'})};
    if (String(url).includes('/billing_entitlements?')) return {ok:true,json:async()=>([])};
    if (String(url).includes('api.stripe.com')) return {ok:true,json:async()=>({url:'https://checkout.stripe.com/test'})};
    throw Error('Unexpected endpoint');
  };
  const r=res();
  await handler({method:'POST',headers:{host:'attacker.example',authorization:'Bearer test-session'},body:{action:'checkout',plan:'pro'}},r);
  assert.equal(r.statusCode,200);
  const stripe=observed.find(v=>v.url.includes('api.stripe.com'));
  assert.ok(stripe);
  assert.match(stripe.options.body.toString(),/eyloai.example/);
  assert.equal(stripe.options.body.toString().includes('attacker.example'),false);
});
