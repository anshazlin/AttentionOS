/*
 * AttentionOS JARVIS foreground wake controller.
 * Inspired by the wake-word loop and clap transient design of
 * adewaskar/jarvis (MIT License, Copyright 2026 Aditya Dewaskar).
 * Entire detection is browser-local. Only authorized requests go to JARVIS after wake-up.
 * Android/browser restrictions: a first user gesture is required for microphone permission;
 * cannot run while the page is closed, screen locked, or Android suspends the tab.
 */
(function(){
'use strict';
const $$=id=>document.getElementById(id);
const S={enabled:false,starting:false,awake:false,recognizer:null,stream:null,audio:null,source:null,analyser:null,raf:0,interval:0,candidate:null,floor:.012,history:[],cooldown:0,restartTimer:0,speechAllowed:true,clapCount:0};
const style=document.createElement('style');style.textContent=
'#jwWake{position:fixed;z-index:8100;right:10px;bottom:90px;max-width:min(93vw,325px);border-radius:16px;background:#151f29;border:1px solid #679754;color:#f1f7eb;padding:9px 12px;box-shadow:0 8px 22px #0009;font:13px system-ui;display:flex;gap:8px;align-items:center;flex-wrap:wrap}' +
'#jwWake button{border:1px solid #79935d;background:#b8f47e;color:#172410;border-radius:11px;padding:9px 12px;font-weight:800;font:700 12px system-ui;cursor:pointer}' +
'#jwWake small{display:block;color:#aebcbd;font-size:10px;line-height:1.35;margin-top:3px}' +
'#jwWakeStatus{flex:1;min-width:105px;font-size:11px;line-height:1.45}' +
'#jwWake.armed{border-color:#b8f47e;background:#1a3025}' +
'#jwWake.armed button{background:#253b32;color:#b8f47e}' +
'@media(max-width:650px){#jwWake{bottom:96px;left:10px;right:auto;max-width:calc(100vw - 20px)}#jbLaunch{display:none!important}}';
document.head.appendChild(style);
const root=document.createElement('div');root.id='jwWake';root.setAttribute('role','group');root.setAttribute('aria-label','Jarvis wake-up settings');
root.innerHTML='<button id="jwToggle" type="button">Enable hands-free</button><div id="jwWakeStatus">Off · Say “Jarvis” or clap to wake.<small>Works only while the app is open and visible, after microphone permission.</small></div>';
document.body.appendChild(root);
const toggle=$$('jwToggle'),status=$$('jwWakeStatus');
function inform(message){status.firstChild?status.firstChild.textContent=message:status.textContent=message}
function update(){
 root.classList.toggle('armed',S.enabled);
 toggle.textContent=S.enabled?'Turn off listening':'Enable hands-free';
 if(!S.enabled)inform('Off · Say “Jarvis” or clap to wake.');
 else if(S.awake)inform('Awake · Talk naturally to JARVIS.');
 else if(document.hidden)inform('Paused · Open this app to resume.');
 else inform(S.speechAllowed?'Ready · Say “Jarvis” or clap once.':'Ready · Clap once to wake (speech recognition unavailable).');
}
function clearRecognizer(){
 if(S.restartTimer){clearTimeout(S.restartTimer);S.restartTimer=0}
 if(S.recognizer){const rec=S.recognizer;S.recognizer=null;rec.onresult=rec.onend=rec.onerror=null;try{rec.abort()}catch{}}
}
function releaseMicrophone(){
 if(S.raf)cancelAnimationFrame(S.raf);S.raf=0;S.candidate=null;S.history.length=0;
 if(S.source){try{S.source.disconnect()}catch{}S.source=null}
 if(S.analyser){try{S.analyser.disconnect()}catch{}S.analyser=null}
 if(S.stream){S.stream.getTracks().forEach(track=>track.stop());S.stream=null}
 if(S.audio){try{S.audio.close()}catch{}S.audio=null}
}
function pause(){clearRecognizer();releaseMicrophone();update()}
function clearWake(message){S.enabled=false;S.awake=false;S.starting=false;pause();if(message)inform(message)}
function phrase(text){
 const line=String(text||'').trim();
 const regex=/(?:^|[\s,.:!?])(?:hey\s+|okay\s+|ok\s+)?(?:jarvis|jervis|jarvys|jarves)(?:\b|(?=[,.:!?]))/i;
 const match=regex.exec(line);if(!match)return null;
 return {wake:true,trailing:line.slice(match.index+match[0].length).replace(/^[\s,.:!?-]+/,'').slice(0,300)}
}
function tick(){
 if(!S.enabled||S.awake||!S.analyser)return;
 S.raf=requestAnimationFrame(tick);
 const b=new Float32Array(512);S.analyser.getFloatTimeDomainData(b);
 let sum=0;for(let i=0;i<b.length;i++)sum+=b[i]*b[i];
 const rms=Math.sqrt(sum/b.length),now=performance.now();
 S.history.push(rms);if(S.history.length>20)S.history.shift();
 if(!S.candidate&&rms<S.floor*3)S.floor=Math.max(.002,S.floor+(rms-S.floor)*.05);
 if(S.candidate){
  if(rms<S.candidate.peak*.35 && now-S.candidate.start<130){
   S.candidate=null;S.cooldown=now+1300;S.clapCount++;wake('clap','');return;
  }
  if(now-S.candidate.start>260){S.candidate=null}
  else S.candidate.peak=Math.max(S.candidate.peak,rms);
  return;
 }
 if(now<S.cooldown||rms<.055||rms<S.floor*7)return;
 const before=S.history[S.history.length-6];
 if(before===undefined||before>rms*.16)return;
 S.candidate={start:now,peak:rms};
}
async function startClap(){
 if(!navigator.mediaDevices?.getUserMedia)return false;
 const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return false;
 try{
  S.stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false});
  if(!S.enabled||S.awake||document.hidden){releaseMicrophone();return false}
  S.audio=new AC();await S.audio.resume();
  S.source=S.audio.createMediaStreamSource(S.stream);
  S.analyser=S.audio.createAnalyser();S.analyser.fftSize=512;S.analyser.smoothingTimeConstant=0;
  S.source.connect(S.analyser);tick();return true;
 }catch(e){releaseMicrophone();inform('Clap microphone unavailable: '+(e.name||'permission denied'));return false}
}
function startWakeWords(){
 if(!S.enabled||S.awake||document.hidden||!S.speechAllowed)return;
 const R=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!R){S.speechAllowed=false;update();return}
 clearRecognizer();
 const r=new R();S.recognizer=r;r.lang='en-IN';r.continuous=true;r.interimResults=true;r.maxAlternatives=2;
 r.onresult=e=>{
  for(let i=e.resultIndex;i<e.results.length;i++){
   for(let j=0;j<Math.min(2,e.results[i].length);j++){
    const msg=phrase(e.results[i][j].transcript);
    if(msg){wake('wakeword',msg.trailing);return}
   }
  }
 };
 r.onerror=e=>{
  const code=e.error||'unknown';
  if(code==='not-allowed'||code==='service-not-allowed'){S.speechAllowed=false;clearRecognizer();inform('Speech wake permission denied. Clap wake may still work.');return}
  if(code==='audio-capture'){clearRecognizer();inform('Speech mic unavailable. Clap wake may still work.')}
 };
 r.onend=()=>{
  if(S.recognizer!==r)return;
  S.recognizer=null;
  if(S.enabled&&!S.awake&&!document.hidden&&S.speechAllowed){
   S.restartTimer=setTimeout(()=>{S.restartTimer=0;startWakeWords()},600);
  }
 };
 try{r.start()}catch{S.recognizer=null;S.restartTimer=setTimeout(()=>{S.restartTimer=0;startWakeWords()},1900)}
}
function waitUntilReady(remaining=44,trailing=''){
 if(!S.awake)return;
 if(window.JARVISNative?.ready()){
  if(trailing){window.JARVISNative.sendText(trailing)}
  return;
 }
 if(remaining<=0){
  window.JARVISBetter?.status('Natural voice did not connect. Check the Gemini Live error above or use the backup microphone.');
  return;
 }
 setTimeout(()=>waitUntilReady(remaining-1,trailing),300);
}
function wake(method,trailing){
 if(!S.enabled||S.awake||document.hidden)return;
 S.awake=true;
 pause();update();
 try{
  if(!window.JARVISBetter){inform('JARVIS AI is not loaded. Refresh the app.');S.awake=false;return}
  window.JARVISBetter.open();
  window.JARVISBetter.status(method==='clap'?'Clap detected. Starting your JARVIS conversation...':'Wake word heard. Starting your JARVIS conversation...');
  if(window.JARVISNative?.ready()){
   if(trailing)window.JARVISNative.sendText(trailing);
  }else if(window.JARVISNative?.connect){
   window.JARVISNative.connect();
   waitUntilReady(44,trailing);
  }else{
   window.JARVISBetter.status('Natural voice unavailable. Please use the backup microphone.');
  }
 }catch(e){S.awake=false;inform('Could not wake JARVIS: '+String(e.message||e))}
}
async function start(){
 if(S.starting||S.enabled)return;
 if(!window.isSecureContext){inform('Hands-free needs HTTPS and a supported browser.');return}
 S.enabled=true;S.starting=true;S.speechAllowed=true;update();
 const ok=await startClap();
 S.starting=false;
 if(!S.enabled)return;
 if(!ok && !(window.SpeechRecognition||window.webkitSpeechRecognition)){clearWake('Microphone unavailable. Check Android Chrome permissions.');return}
 startWakeWords();
 update();
}
function stop(){clearWake()}
function resume(){
 if(!S.enabled||S.awake||S.starting||document.hidden)return;
 S.starting=true;
 startClap().then(()=>{S.starting=false;if(S.enabled&&!S.awake&&!document.hidden){startWakeWords();update()}})
}
toggle.addEventListener('click',()=>{if(S.enabled)stop();else start()});
document.addEventListener('visibilitychange',()=>{if(document.hidden){pause()}else if(S.enabled&&!S.awake)resume()});
if(window.JARVISNative?.disconnect){
 const old=window.JARVISNative.disconnect;
 window.JARVISNative.disconnect=function(){old.apply(this,arguments);S.awake=false;if(S.enabled){setTimeout(()=>{if(!document.hidden)resume()},1000)}update()};
}
if(window.JARVISBetter?.close){
 const old=window.JARVISBetter.close;
 window.JARVISBetter.close=function(){old.apply(this,arguments);S.awake=false;if(S.enabled)setTimeout(()=>{if(!document.hidden)resume()},800);update()};
}
document.getElementById('jbClose')?.addEventListener('click',()=>{S.awake=false;if(S.enabled)setTimeout(()=>{if(!document.hidden)resume()},950)});
window.JARVISWake={enable:start,disable:stop,wake,phrase,isEnabled:()=>S.enabled,isAwake:()=>S.awake,claps:()=>S.clapCount};
update();
})();