const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM,ResourceLoader,VirtualConsole}=require('jsdom');
const html=fs.readFileSync('apps/free-mobile-web/index.html','utf8');
class Resources extends ResourceLoader{fetch(url){if(url.endsWith('/agent.js'))return Promise.resolve(Buffer.from(fs.readFileSync('apps/free-mobile-web/agent.js','utf8')));return Promise.resolve(Buffer.from(''))}}
const response=(body)=>({ok:true,status:200,headers:{get:()=> 'application/json'},json:async()=>body,text:async()=>JSON.stringify(body)});
let sockets=[],websocketMessages=[],stopCount=0,anyPublish=false;
const seed={ok:true,mode:'templates',sources:[{title:'Example storage article',url:'https://example.org/article'}],ideas:[{title:'Storage trick',hook:'Save space',script:'Show it',shotList:['Open box'],caption:'Check this organizer',hashtags:'#TrendWale',cta:'Comment GUIDE'}]};
const v=new VirtualConsole();v.on('jsdomError',e=>{if(!String(e.message).includes('Not implemented: navigation'))console.error('BROWSER WARNING',e.message)});
const dom=new JSDOM(html,{
 url:'https://example.test',runScripts:'dangerously',resources:new Resources(),pretendToBeVisual:true,virtualConsole:v,
 beforeParse(w){
  w.speechSynthesis={getVoices:()=>[],addEventListener:()=>{},cancel:()=>{},speak:()=>{}};
  w.AudioContext=class{constructor(){this.sampleRate=24000;this.destination={};this.currentTime=0}resume(){return Promise.resolve()}close(){return Promise.resolve()}createMediaStreamSource(){return {connect(){}}}createScriptProcessor(){return {connect(){},disconnect(){}}}createGain(){return {gain:{value:0},connect(){}}}createBuffer(){return {getChannelData:()=>new Float32Array(1),duration:0}}createBufferSource(){return {connect(){},start(){}}}};
  Object.defineProperty(w.navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>({getTracks:()=>[{stop:()=>stopCount++}]})}});
  w.WebSocket=class{
    static OPEN=1;
    constructor(uri){this.url=uri;this.readyState=0;this.sent=[];sockets.push(this);queueMicrotask(()=>{this.readyState=1;this.onopen?.()})}
    send(payload){const msg=JSON.parse(payload);this.sent.push(msg);websocketMessages.push(msg);if(msg.setup)queueMicrotask(()=>this.onmessage?.({data:JSON.stringify({setupComplete:{}})}))}
    close(){this.readyState=3;this.onclose?.({code:1000})}
  };
  w.fetch=async(url,opts={})=>{
    const u=String(url);let b={};try{b=JSON.parse(opts.body||'{}')}catch{}
    if(u==='/api/jarvis-live')return response({ok:true,model:'gemini-3.8-live',token:'mock-temporary-token'});
    if(u==='/api/agent')return response(seed);
    if(u.includes('/api/zernio')&&b.mode==='now')anyPublish=true;
    return response({ok:true,configured:true,connected:true});
  };
  w.alert=()=>{};w.confirm=()=>{throw Error('No posting should be requested without owned media')};
 }
});
async function main(){
 await new Promise(ok=>dom.window.addEventListener('load',ok));
 const w=dom.window;w.document.getElementById('jbOwner').value='mock-owner';
 w.JARVISBetter.open();
 await w.JARVISNative.connect();
 await new Promise(ok=>setTimeout(ok,40));
 assert.equal(w.JARVISNative.ready(),true,'WebSocket setup was not completed');
 assert.equal(w.JARVISNative.activeMic(),true,'Microphone was not auto started in continuous call');
 assert.ok(w.document.getElementById('jbMic').textContent.includes('End JARVIS call'),'Call did not show end-call control');
 const setup=websocketMessages.find(x=>x.setup)?.setup;
 assert.equal(setup.model,'models/gemini-3.8-live');
 assert.ok(setup.tools?.[0]?.functionDeclarations?.some(x=>x.name==='research_products'),'Missing real research Live function');
 const socket=sockets[0];
 await socket.onmessage({data:JSON.stringify({toolCall:{functionCalls:[{name:'research_products',id:'call-1',args:{topic:'organizers'}}]}})});
 let callResult=websocketMessages.filter(m=>m.toolResponse).at(-1).toolResponse.functionResponses[0];
 assert.equal(callResult.name,'research_products');assert.equal(callResult.response.result.researchLeadCount,1);
 await socket.onmessage({data:JSON.stringify({toolCall:{functionCalls:[{name:'prepare_reel_draft',id:'call-2',args:{topic:'organizers'}}]}})});
 callResult=websocketMessages.filter(m=>m.toolResponse).at(-1).toolResponse.functionResponses[0];
 assert.equal(callResult.response.result.savedLocally,true);assert.equal(callResult.response.result.videoRendered,false);
 assert.ok(w.localStorage.getItem('attentionos_free_mobile_v1')?.includes('Storage trick'));
 await socket.onmessage({data:JSON.stringify({toolCall:{functionCalls:[{name:'review_instagram_post',id:'call-3',args:{caption:'Viral'}}]}})});
 callResult=websocketMessages.filter(m=>m.toolResponse).at(-1).toolResponse.functionResponses[0];
 assert.equal(callResult.response.result.published,false);assert.equal(callResult.response.result.mediaReady,false);
 assert.equal(anyPublish,false,'Unapproved content was posted');
 w.JARVISNative.disconnect();
 assert.equal(w.JARVISNative.activeMic(),false);assert.ok(stopCount>=1);
 dom.window.close();
 console.log('PASS: Gemini Live one-tap call starts continuous mic, invokes research/draft tools, refuses unapproved publish, and stops mic on hang-up.');
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;dom.window.close()});
