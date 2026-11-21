import test from 'node:test';
import assert from 'node:assert/strict';
import { checkHostedRelease } from '../scripts/verify-hosted-release.mjs';

const SHA = 'a'.repeat(40);
const json = body => ({ ok:true, headers:{ get:()=> 'application/json' }, json:async()=>body });
const stub = (deployment,capabilities) => async url => url.pathname.endsWith('deployment-status') ? json(deployment) : json(capabilities);

test('public production SHA and capabilities are checked without asserting pilot readiness', async()=>{
 const fetchImpl=stub({ deployment_sha:SHA, environment:'production',provenance_verified:true },{ai:true,contact:false,billing:false});
 const r=await checkHostedRelease({expectedSha:SHA,fetchImpl});
 assert.equal(r.decision,'PUBLIC_PROVENANCE_VERIFIED');
 assert.equal(r.results.deployment.ok,true);
 assert.equal(r.results.capabilities.contact,false);
 assert.match(r.note,/NEVER verifies/);
});
test('mismatched deployed revision fails closed',async()=>{
 const fetchImpl=stub({deployment_sha:'b'.repeat(40),environment:'production',provenance_verified:true},{ai:true,contact:false,billing:false});
 const r=await checkHostedRelease({expectedSha:SHA,fetchImpl});
 assert.equal(r.decision,'NO_GO');
 assert.equal(r.results.deployment.ok,false);
});
test('unverified provenance fails even if SHA matches',async()=>{
 const fetchImpl=stub({deployment_sha:SHA,environment:'production',provenance_verified:false},{ai:true,contact:false,billing:false});
 const r=await checkHostedRelease({expectedSha:SHA,fetchImpl});
 assert.equal(r.decision,'NO_GO');
});
test('missing capability flags fail closed',async()=>{
 const fetchImpl=stub({deployment_sha:SHA,environment:'production',provenance_verified:true},{ai:true});
 const r=await checkHostedRelease({expectedSha:SHA,fetchImpl});
 assert.equal(r.decision,'NO_GO');
});
test('non-JSON and fetch failures return sanitized failures',async()=>{
 const fetchImpl=async url=>{if(url.pathname.endsWith('deployment-status'))throw Error('sensitive response string');return {ok:true,headers:{get:()=> 'text/html'}}};
 const r=await checkHostedRelease({expectedSha:SHA,fetchImpl});
 assert.equal(r.decision,'NO_GO');
 assert.ok(!JSON.stringify(r).includes('sensitive response string'));
});
test('only clean HTTPS origins and a full reviewed SHA are accepted',async()=>{
 await assert.rejects(checkHostedRelease({expectedSha:'short'}),/SHA/);
 await assert.rejects(checkHostedRelease({expectedSha:SHA,origin:'http://example.com'}),/HTTPS/);
 await assert.rejects(checkHostedRelease({expectedSha:SHA,origin:'https://example.com/path'}),/HTTPS/);
});
