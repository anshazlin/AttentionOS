const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM,ResourceLoader,VirtualConsole}=require('jsdom');
const chatHandler=require('../api/jarvis-chat.js');
process.env.GEMINI_API_KEY='dummy-gemini-key';
process.env.ATTENTIONOS_OWNER_TOKEN='test-token';
function res(){return {code:0,body:null,setHeader(){},status(c){this.code=c;return this},json(x){this.body=x;return this}}}
async function askServer(message,history=[]){const r=res();await chatHandler({method:'POST',headers:{'x-owner-token':'test-token'},body:{message,history}},r);assert.equal(r.code,200);return r.body}
async function main(){
 const a=await askServer('Find trending products for TrendWale');assert.equal(a.action,'research_products');
 const b=await askServer('launch it',[{role:'model',text:'Shall I research trending products?'}]);assert.equal(b.action,'research_products');
 const c=await askServer('Make a reel draft');assert.equal(c.action,'prepare_reel');
 const d=await askServer('Now post it with caption viral');assert.equal(d.action,'review_post');
 const dummy={ok:true,mode:'templates',sources:[{title:'Public example on budget organizers',url:'https://example.org/source'}],ideas:[{title:'Useful organizer guide',hook:'Smart storage tip',script:'Show and explain',shotList:['Close-up','Use case'],caption:'Organizer ideas',hashtags:'#TrendWale',cta:'Comment GUIDE',sourceUrl:''}]};
 let apiCalls=[],anyPost=false;
 class Resources extends ResourceLoader{fetch(url){if(url.endsWith('/agent.js'))return Promise.resolve(Buffer.from(fs.readFileSync('apps/free-mobile-web/agent.js','utf8')));return Promise.resolve(Buffer.from(''))}}
 const errors=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(String(e.message)));
 const dom=new JSDOM(fs.readFileSync('apps/free-mobile-web/index.html','utf8'),{
  url:'https://example.test/',resources:new Resources(),runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,
  beforeParse(w){
   w.fetch=async(url,opts={})=>{
    const action=String(url);apiCalls.push(action);
    let body={};try{body=JSON.parse(opts.body||'{}')}catch{}
    if(action==='/api/jarvis-chat'){const r=await askServer(body.message,body.history);return {ok:true,status:200,text:async()=>JSON.stringify(r),json:async()=>r}}
    if(action==='/api/agent'){assert.equal(body.action,'plan');return {ok:true,status:200,text:async()=>JSON.stringify(dummy),json:async()=>dummy}}
    if(action.includes('/api/zernio')){if(opts.method==='POST'&&body.mode==='now')anyPost=true;return {ok:true,status:200,text:async()=>JSON.stringify({ok:true,connected:false}),json:async()=>({ok:true,connected:false})}}
    return {ok:true,status:200,text:async()=>JSON.stringify({ok:true,configured:true}),json:async()=>({ok:true,configured:true})}
   };
   w.speechSynthesis={getVoices:()=>[],addEventListener(){},cancel(){},speak(){}};
   w.alert=()=>{};w.confirm=()=>{throw Error('Publish confirmation must not be shown without media')};
  }
 });
 await new Promise(resolve=>dom.window.addEventListener('load',resolve));
 const w=dom.window;
 assert.ok(w.AttentionAgent,'Research agent not booted');
 w.document.getElementById('jbOwner').value='test-token';
 await w.JARVISBetter.chat('Find trending products for TrendWale');
 let messages=[...w.document.querySelectorAll('#jbMessages .jbBubble')].map(x=>x.textContent);
 assert.ok(messages.some(x=>x.includes('Research finished')&&x.includes('public article leads')),'Research response not backed by tool results');
 assert.ok(apiCalls.some(x=>x==='/api/agent'),'No actual research API call was made');
 await w.JARVISBetter.chat('Make a reel draft');
 messages=[...w.document.querySelectorAll('#jbMessages .jbBubble')].map(x=>x.textContent);
 assert.ok(messages.some(x=>x.includes('saved the Reel draft')),'Draft save not reported after execution');
 assert.ok(w.localStorage.getItem('attentionos_free_mobile_v1')?.includes('Useful organizer guide'),'Draft not actually persisted');
 assert.equal(w.document.querySelector('#agentIdeas input[data-field="title"]').value,'Useful organizer guide','Reel concept not rendered');
 await w.JARVISBetter.chat('Now post it with caption viral');
 messages=[...w.document.querySelectorAll('#jbMessages .jbBubble')].map(x=>x.textContent);
 assert.ok(messages.some(x=>x.includes('NOT posted')&&x.includes('No verified media')),'Must tell Master publishing did not happen');
 assert.equal(anyPost,false,'Publishing must never occur without approved media');
 assert.ok(!errors.some(x=>x.includes('Uncaught')),'Uncaught browser exception: '+errors.join('|'));
 dom.window.close();
 console.log('PASS: research really invokes API, Reel really enters draft review, publish is blocked without video. No actual Instagram action.');
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1});