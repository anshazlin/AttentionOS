const fs=require('node:fs');const assert=require('node:assert/strict');
const {JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync('apps/free-mobile-web/index.html','utf8');
let failures=[],fatal=[];
const virtualConsole=new VirtualConsole();
virtualConsole.on('jsdomError',e=>failures.push(String(e?.message||e)));
virtualConsole.on('error',e=>failures.push(String(e)));
const dom=new JSDOM(html,{
 url:'https://example.test',
 runScripts:'dangerously',
 resources:'usable',
 pretendToBeVisual:true,
 virtualConsole,
 beforeParse(window){
  window.fetch=async()=>({ok:true,status:200,headers:{get:()=> 'application/json'},json:async()=>({ok:true,connected:false,configured:true}),text:async()=>JSON.stringify({ok:true,connected:false,configured:true})});
  window.alert=(msg)=>fatal.push(String(msg));
  window.scrollTo=()=>{};
  window.speechSynthesis={getVoices:()=>[],addEventListener:()=>{},cancel:()=>{},speak:()=>{}};
 }
});
dom.window.addEventListener('error',e=>fatal.push(e.message));
setTimeout(()=>{
try{
 const w=dom.window,d=w.document;
 assert.ok(w.JARVISBetter,'Conversational JARVIS failed to initialize');
 assert.ok(w.JARVISNative,'Gemini natural voice module failed to initialize');
 assert.ok(d.getElementById('jbLaunch'),'Dedicated JARVIS AI button missing');
 assert.ok(d.getElementById('jbOverlay'),'New JARVIS AI panel missing');
 const shortcut=d.querySelector('.jarvisFab');assert.ok(shortcut,'Legacy launcher missing');
 shortcut.click();
 assert.ok(d.getElementById('jbOverlay').classList.contains('open'),'Old green launcher did not open real JARVIS AI');
 assert.ok(!d.getElementById('jarvisShade').classList.contains('show'),'Old static voice panel is still visible');
 d.getElementById('jbClose').click();
 d.getElementById('jbLaunch').click();
 assert.ok(d.getElementById('jbOverlay').classList.contains('open'),'JARVIS AI launcher did not open intelligent panel');
 assert.ok(!fatal.length,'Unhandled page errors: '+fatal.join(' | '));
 console.log('PASS: real conversational JARVIS boots and both buttons open the intelligent AI interface.');
}catch(e){console.error('FAIL '+e.stack);console.error('Browser warnings:',failures.slice(0,8));process.exitCode=1;}finally{setTimeout(()=>dom.window.close(),300)}
},550);
