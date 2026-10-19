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
 const d=await askServer('Now post it with caption viral');assert.equal(d.action,'publish_now');
 const up=await askServer('Upload it');assert.equal(up.action,'upload_reel_media');
 const combined=await askServer('Now add clips and edit the video. Upload it');assert.equal(combined.action,'upload_reel_media');
 const product=await askServer('Create a 2nd video of Smart Brushes Kitchen Smart Brush');assert.equal(product.action,'prepare_reel');assert.equal(product.topic,'Smart Brushes Kitchen Smart Brush');
 const topicAnswer=await askServer('smart brush',[{role:'model',text:'What product topic should your second Reel focus on?'}]);
 assert.equal(topicAnswer.action,'prepare_reel');
 assert.equal(topicAnswer.topic,'smart brush');
 const dummy={ok:true,mode:'templates',sources:[{title:'Public example on budget organizers',url:'https://example.org/source'}],ideas:[{title:'Useful organizer guide',hook:'Smart storage tip',script:'Show and explain',shotList:['Close-up','Use case'],caption:'Organizer ideas',hashtags:'#TrendWale',cta:'Comment GUIDE',sourceUrl:''}]};
 let apiCalls=[],anyPost=false;
 class Resources extends ResourceLoader{fetch(url){if(url.endsWith('/agent.js'))return Promise.resolve(Buffer.from(fs.readFileSync('apps/free-mobile-web/agent.js','utf8')));if(url.endsWith('/reel-studio.js'))return Promise.resolve(Buffer.from(fs.readFileSync('apps/free-mobile-web/reel-studio.js','utf8')));return Promise.resolve(Buffer.from(''))}}
 const errors=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(String(e.message)));
 const dom=new JSDOM(fs.readFileSync('apps/free-mobile-web/index.html','utf8'),{
  url:'https://example.test/',resources:new Resources(),runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,
  beforeParse(w){
   w.fetch=async(url,opts={})=>{
    const action=String(url);apiCalls.push(action);
    let body={};try{body=JSON.parse(opts.body||'{}')}catch{}
    if(action==='/api/jarvis-chat'){const r=await askServer(body.message,body.history);return {ok:true,status:200,text:async()=>JSON.stringify(r),json:async()=>r}}
    if(action==='/api/agent'){
      assert.equal(body.action,'plan');
      const result=String(body.topic||'').toLowerCase().includes('smart brush')
       ?{...dummy,ideas:[{...dummy.ideas[0],title:'Smart brush guide',researchTopic:'smart brush'}]}
       :dummy;
      return {ok:true,status:200,text:async()=>JSON.stringify(result),json:async()=>result}
    }
    if(action==='/api/creative-media'){const media={ok:true,items:[],providers:['Wikimedia Commons'],warnings:[]};return {ok:true,status:200,text:async()=>JSON.stringify(media),json:async()=>media}}
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
 assert.ok(messages.some(x=>x.includes('Video NOT completed')&&x.includes('Video recording is unsupported')),'JARVIS falsely claimed video creation instead of reporting the missing encoder');
 assert.ok(w.ReelStudio,'Real Reel editor did not load');
 assert.equal(w.ReelStudio.state().open,true,'Video editor not opened after JARVIS edit request');
 assert.ok(w.localStorage.getItem('attentionos_free_mobile_v1')?.includes('Useful organizer guide'),'Draft not actually persisted');
 assert.equal(w.document.querySelector('#agentIdeas input[data-field="title"]').value,'Useful organizer guide','Reel concept not rendered');
 // User answers the product-selection question with a short noun phrase.
 w.JARVISBetter.app.history=[{role:'model',text:'What product should your second Reel focus on?'}];
 await w.JARVISBetter.chat('smart brush');
 assert.equal(w.AttentionAgent.currentDraft()?.title,'Smart brush guide','The new product must replace the earlier Reel as active draft');
 assert.ok(apiCalls.filter(x=>x==='/api/agent').length>=2,'Changing products must trigger new research');
 assert.ok(w.document.getElementById('reelQuery').value.toLowerCase().includes('smart brush'),'Video editor should show the latest product, not previous one');
 await w.JARVISBetter.chat('Upload it');
 messages=[...w.document.querySelectorAll('#jbMessages .jbBubble')].map(x=>x.textContent);
 assert.ok(messages.some(x=>x.includes('Nothing uploaded')),'No upload may be claimed without a rendered MP4');
 await w.JARVISBetter.chat('Now post it with caption viral');
 messages=[...w.document.querySelectorAll('#jbMessages .jbBubble')].map(x=>x.textContent);
 assert.ok(messages.some(x=>x.includes('Instagram was NOT published')&&x.includes('media')),'Must report that publishing did not happen without approved MP4 media');
 assert.equal(anyPost,false,'Publishing must never occur without approved media');
 assert.ok(!errors.some(x=>x.includes('Uncaught')),'Uncaught browser exception: '+errors.join('|'));
 dom.window.close();
 console.log('PASS: research invokes API, draft is saved, unavailable video encoder is honestly reported, and unapproved publishing stays blocked.');
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1});