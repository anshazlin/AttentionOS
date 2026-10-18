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
 const request=got[0];assert.match(request.url,/gemini-2\.5-flash/);assert.equal(request.options.headers['x-goog-api-key'],'safe-testing-gemini');
 assert.doesNotMatch(request.options.body,/safe-testing-owner/);
 const liveResponse=response();
 await live({method:'POST',headers:{'x-owner-token':'safe-testing-owner'},body:{}},liveResponse);
 assert.equal(liveResponse.statusCode,200);
 assert.equal(liveResponse.payload.token,'ephemeral-test-token');
 const liveRequest=JSON.parse(got[1].options.body);
 assert.equal(liveRequest.uses,1);
 assert.equal(liveRequest.liveConnectConstraints.config.responseModalities[0],'AUDIO');
 const invalid=response();
 await live({method:'POST',headers:{'x-owner-token':'bad'}},invalid);
 assert.equal(invalid.statusCode,401);
 console.log('PASS: Gemini chat replies, approval actions, no owner-code leakage, short-lived Live voice tokens.');
}
main().catch(e=>{console.error(e);process.exitCode=1});