import test from 'node:test';
import assert from 'node:assert/strict';
import { searchEuropePMC } from '../src/lib/eyra-api.js';

test('hosted scholarly failures cannot bypass server quotas by retrying a provider directly', async () => {
  const previousFetch=globalThis.fetch; const previousWindow=globalThis.window;
  const requests=[];
  globalThis.window={};
  globalThis.fetch=async url=>{requests.push(String(url));return new Response('{"error":"quota unavailable"}',{status:503});};
  try {
    await assert.rejects(searchEuropePMC('source boundary',3,{throwOnError:true}),/503/);
    assert.equal(requests.length,1);
    assert.match(requests[0],/^\/api\/discovery\?/);
    assert.equal(requests.some(url=>url.includes('ebi.ac.uk')),false);
  } finally {
    globalThis.fetch=previousFetch;
    if(previousWindow===undefined) delete globalThis.window; else globalThis.window=previousWindow;
  }
});
