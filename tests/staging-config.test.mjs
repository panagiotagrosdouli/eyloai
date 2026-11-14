import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { verifyStagingConfig } from '../scripts/verify-staging-config.mjs';

const valid = { EYLO_ENVIRONMENT:'staging', VERCEL_ENV:'preview', EYLO_STAGING_SUPABASE_REF:'abcdefghijklmnopqrst', EYLO_STAGING_CONFIRMED_REF:'abcdefghijklmnopqrst', VITE_SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co', VITE_SUPABASE_ANON_KEY:'sb_publishable_fixture', VITE_SUPABASE_USE_PROXY:'false' };
test('staging preparation rejects live, unrelated, mismatched and unconfirmed targets and server keys',()=>{
  assert.equal(verifyStagingConfig(valid).ok,true);
  for(const ref of ['kbzjngpzxpniaumlupaa','umzrggayitzfgrrofjnw']) assert.equal(verifyStagingConfig({...valid,EYLO_STAGING_SUPABASE_REF:ref,EYLO_STAGING_CONFIRMED_REF:ref,VITE_SUPABASE_URL:`https://${ref}.supabase.co`}).ok,false);
  for(const patch of [{EYLO_STAGING_CONFIRMED_REF:''},{VERCEL_ENV:'production'},{VITE_SUPABASE_USE_PROXY:'true'},{VITE_SUPABASE_ANON_KEY:'sb_secret_forbidden'},{VITE_SUPABASE_URL:'https://other.supabase.co'}])assert.equal(verifyStagingConfig({...valid,...patch}).ok,false);
});
test('staging deployment configuration has no production Supabase rewrite or automatic cron',()=>{
  const config=JSON.parse(readFileSync(new URL('../vercel.staging.json',import.meta.url),'utf8'));
  assert.equal(config.rewrites.some(rule=>rule.source.includes('supabase')),false);
  assert.deepEqual(config.crons,[]);
  assert.match(config.buildCommand,/verify-staging-config/);
  const fallback=new RegExp('^'+config.rewrites.find(rule=>rule.destination==='/index.html').source+'$');
  assert.equal(fallback.test('/api/eyra'),false);assert.equal(fallback.test('/projects/p1'),true);
});

test('staging routes consolidated APIs before the guarded SPA fallback',()=>{const config=JSON.parse(readFileSync(new URL('../vercel.staging.json',import.meta.url),'utf8'));for(const endpoint of ['capabilities','contact','deployment-status','admin-operations','developer','account-deletion'])assert.ok(config.rewrites.some(rule=>rule.source==='/api/'+endpoint&&rule.destination==='/api/system?endpoint='+endpoint));});
