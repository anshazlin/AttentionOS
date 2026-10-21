const assert=require('node:assert/strict');
const voice=require('../api/voice.js');
function response(){return {code:200,headers:{},payload:null,body:null,status(n){this.code=n;return this},setHeader(k,v){this.headers[k.toLowerCase()]=v},json(p){this.payload=p;return this},send(buf){this.body=buf;return this}}}
function request(body,auth='owner-test'){return {method:'POST',headers:{'x-owner-token':auth,'origin':'https://example.test',host:'example.test'},body}}
async function test(){
 process.env.ATTENTIONOS_OWNER_TOKEN='owner-test';
 delete process.env.VOICE_SERVER_URL;
 delete process.env.VOICE_SERVER_TOKEN;
 let reply=response();await voice({method:'GET',headers:{}},reply);
 assert.equal(reply.code,200);assert.equal(reply.payload.configured,false);
 reply=response();await voice(request({text:'Hello',purpose:'personal'}),reply);
 assert.equal(reply.code,503);assert.match(reply.payload.error,/not configured/i);
 process.env.VOICE_SERVER_URL='https://voice.example.test';
 process.env.VOICE_SERVER_TOKEN='secret-model-host';
 reply=response();await voice(request({text:'Hi',purpose:'commercial',provider:'omnivoice'}),reply);
 assert.equal(reply.code,403);
 reply=response();await voice(request({text:'Hello',purpose:'personal'},'bad-secret'),reply);
 assert.equal(reply.code,401);
 reply=response();await voice(request({text:' ',purpose:'personal'}),reply);
 assert.equal(reply.code,400);
 let posted;
 const originalFetch=global.fetch;
 global.fetch=async(url,opts)=>{
  posted={url,opts};const wav=Buffer.concat([Buffer.from('RIFF'),Buffer.alloc(64)]);
  return {ok:true,status:200,headers:{get(k){return k==='content-type'?'audio/wav':k==='content-length'?String(wav.length):null}},arrayBuffer:async()=>wav};
 };
 reply=response();await voice(request({text:'Promotional product voice',purpose:'commercial',provider:'auto',voice:'bm_george',speed:1.0}),reply);
 assert.equal(reply.code,200);assert.equal(reply.headers['content-type'],'audio/wav');
 assert.equal(reply.body.slice(0,4).toString(),'RIFF');
 assert.equal(posted.url,'https://voice.example.test/v1/speak');
 assert.equal(posted.opts.headers.Authorization,'Bearer secret-model-host');
 assert.doesNotMatch(posted.opts.body,/owner-test|secret-model-host/);
 const b=JSON.parse(posted.opts.body);
 assert.equal(b.purpose,'commercial');
 assert.equal(b.provider,'auto');
 assert.equal(b.voice,'bm_george');
 global.fetch=originalFetch;
 console.log('PASS: private voice route, commercial model restriction, owner authentication, no leaked tokens and simulated WAV handling. No pretrained speech was generated in this test.');
}
test().catch(e=>{console.error(e);process.exitCode=1});
