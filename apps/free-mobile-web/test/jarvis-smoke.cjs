const assert=require('node:assert/strict');
const chat=require('../api/jarvis-chat.js');
const live=require('../api/jarvis-live.js');
function response(){return {statusCode:0,payload:null,headers:{},status(n){this.statusCode=n;return this},setHeader(k,v){this.headers[k]=v},json(j){this.payload=j;return this}}}
async function main(){
 process.env.ATTENTIONOS_OWNER_TOKEN='safe-testing-owner';
 process.env.GEMINI_API_KEY='safe-testing-gemini';
 delete process.env.GEMINI_CHAT_MODEL;
 const got=[];
 global.fetch=async(url,opt)=>{
  got.push({url,options:opt});
  if(String(url).includes('/auth_tokens'))return {ok:true,json:async()=>({name:'ephemeral-test-token'})};
  return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify({reply:'I can help, Master.',action:'open_agent',topic:'budget TrendWale products',draft:null})}]}}]})};
 };
 const bad=response();
 await chat({method:'POST',headers:{},body:{message:'Hi'}},bad);
 assert.equal(bad.statusCode,401);
 const good=response();
 await chat({method:'POST',headers:{'x-owner-token':'safe-testing-owner'},body:{message:'Research products',history:[{role:'user',text:'Hello'}],context:{brand:'TrendWale'}}},good);
 assert.equal(good.statusCode,200);
 assert.equal(good.payload.reply,'I can help, Master.');
 assert.equal(good.payload.action,'open_agent');
 const request=got[0];assert.match(request.url,/gemini-3\.8-flash/);assert.equal(request.options.headers['x-goog-api-key'],'safe-testing-gemini');
 assert.doesNotMatch(request.options.body,/safe-testing-owner/);
 const liveResponse=response();
 await live({method:'POST',headers:{'x-owner-token':'safe-testing-owner'},body:{}},liveResponse);
 assert.equal(liveResponse.statusCode,200);
 assert.equal(liveResponse.payload.token,'ephemeral-test-token');
 const liveRequest=JSON.parse(got[1].options.body);
 assert.equal(liveRequest.uses,1);
 assert.equal(liveRequest.liveConnectConstraints,undefined);
 assert.equal(liveRequest.uses,1);
 assert.ok(liveRequest.expireTime);
 assert.ok(liveRequest.newSessionExpireTime);
 assert.equal(Object.prototype.hasOwnProperty.call(liveRequest,"authToken"),false);
 assert.doesNotMatch(got[1].options.body,/safe-testing-owner/);
 // Simulate a legacy endpoint that rejects flattened request fields.
 const beforeFallback=global.fetch;let attempts=0;
 global.fetch=async(url,opt)=>{
   if(!String(url).includes('/auth_tokens'))throw Error('Unexpected request');
   attempts++;
   const body=JSON.parse(opt.body);
   if(attempts===1){assert.equal(body.uses,1);return {ok:false,status:400,json:async()=>({error:{message:'Invalid JSON payload received. Unknown name "uses" at auth_token.'}})}}
   assert.equal(body.authToken.uses,1);
   return {ok:true,status:200,json:async()=>({authToken:{name:'legacy-test-token'}})};
 };
 const fallback=response();
 await live({method:'POST',headers:{'x-owner-token':'safe-testing-owner'}},fallback);
 assert.equal(fallback.statusCode,200);
 assert.equal(fallback.payload.token,'legacy-test-token');
 assert.equal(attempts,2);
 global.fetch=beforeFallback;
 const invalid=response();
 await live({method:'POST',headers:{'x-owner-token':'bad'}},invalid);
 assert.equal(invalid.statusCode,401);
 console.log('PASS: Gemini chat, token auth, supported minimal Live token schema, legacy envelope fallback, no owner-code leakage.');
}
main().catch(e=>{console.error(e);process.exitCode=1});