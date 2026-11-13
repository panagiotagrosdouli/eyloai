import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/eyra.js';

const keys=['VITE_SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','SUPABASE_SECRET_KEY','OPENAI_API_KEY'];
const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
Object.assign(process.env,{VITE_SUPABASE_URL:'https://eyra-stream-fixture.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture',SUPABASE_SECRET_KEY:'sb_secret_fixture',OPENAI_API_KEY:'sk-fixture-not-live'});
after(()=>{for(const [key,value] of Object.entries(previous)) {if(value===undefined)delete process.env[key];else process.env[key]=value;}});
function responseMock(){return{headers:{},chunks:[],statusCode:200,status(code){this.statusCode=code;return this;},setHeader(key,value){this.headers[key.toLowerCase()]=value;},json(value){this.payload=value;},write(value){this.chunks.push(value);},end(){this.writableEnded=true;}};}
const request=body=>({method:'POST',headers:{authorization:'Bearer fixture-user-token'},body:{prompt:'Explain the supplied methods with uncertainty.',stream:true,...body}});

test('authenticated stream uses Responses API, bounded output, private SSE and a terminal confirmed answer',async()=>{
  const old=globalThis.fetch;let reservations=0;
  globalThis.fetch=async(url,options={})=>{
    if(String(url).endsWith('/auth/v1/user'))return new Response(JSON.stringify({id:'user-a'}));
    if(String(url).endsWith('/rpc/reserve_eyra_usage')){reservations++;return new Response('[{"allowed":true,"used":1}]');}
    assert.equal(String(url),'https://api.openai.com/v1/responses');
    const payload=JSON.parse(options.body);assert.equal(payload.stream,true);assert.equal(payload.store,false);assert.equal(payload.max_output_tokens,4096);assert.equal(payload.tools,undefined);
    return new Response('data: '+JSON.stringify({type:'response.output_text.delta',delta:'Review the methods.'})+'\n\ndata: '+JSON.stringify({type:'response.completed',response:{id:'stream-fixture',status:'completed',output:[{content:[{type:'output_text',text:'Review the methods.'}]}]}})+'\n\n');
  };
  try{const res=responseMock();await handler(request({}),res);assert.equal(reservations,1);assert.match(res.headers['cache-control'],/no-store/);assert.match(res.headers['content-type'],/text\/event-stream/);const body=res.chunks.join('');assert.match(body,/"type":"delta"/);assert.match(body,/"type":"done"/);assert.equal(res.writableEnded,true);}finally{globalThis.fetch=old;}
});
test('incomplete stream returns an error event, refunds quota and never confirms the draft',async()=>{
  const old=globalThis.fetch;let refunds=0;
  globalThis.fetch=async url=>{
    if(String(url).endsWith('/auth/v1/user'))return new Response('{"id":"user-a"}');
    if(String(url).endsWith('/rpc/reserve_eyra_usage'))return new Response('[{"allowed":true,"used":1}]');
    if(String(url).endsWith('/rpc/release_eyra_usage')){refunds++;return new Response('true');}
    return new Response('data: {"type":"response.output_text.delta","delta":"unconfirmed"}\n\n');
  };
  try{const res=responseMock();await handler(request({}),res);assert.equal(refunds,1);assert.match(res.chunks.join(''),/"type":"error"/);assert.doesNotMatch(res.chunks.join(''),/"type":"done"/);}finally{globalThis.fetch=old;}
});
test('streaming cannot execute workspace mutation tools and is rejected before quota reservation',async()=>{
  const old=globalThis.fetch;let calls=0;
  globalThis.fetch=async url=>{calls++;assert.ok(String(url).endsWith('/auth/v1/user'));return new Response('{"id":"user-a"}');};
  try{const res=responseMock();await handler(request({enable_project_tools:true}),res);assert.equal(res.statusCode,400);assert.equal(res.payload.code,'INVALID_STREAM_MODE');assert.equal(calls,1);}finally{globalThis.fetch=old;}
});
