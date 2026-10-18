(function(){
'use strict';
const j=window.JARVISBetter;if(!j)return;
const mount=j.by('jbLiveMount');
const button=document.createElement('button');button.id='jLiveButton';button.className='jbBtn green';button.textContent='✨ Connect natural male voice';mount.appendChild(button);
const sub=document.createElement('span');sub.className='jbSmall';sub.textContent='Native Gemini Live audio · Charon voice default · tap mic to speak';mount.appendChild(sub);
let ws=null,ready=false,stream=null,micCtx=null,outCtx=null,processor=null,playAt=0,transcript='',inputTranscript='';
const isReady=()=>Boolean(ws&&ws.readyState===WebSocket.OPEN&&ready);
const activeMic=()=>Boolean(stream);
function resetText(){button.textContent='✨ Connect natural male voice'}
async function connect(){
 try{
  j.status('Requesting a secure Gemini Live session...');
  const info=await j.req('/api/jarvis-live',{});
  const uri='wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token='+encodeURIComponent(info.token);
  ws=new WebSocket(uri);ready=false;transcript='';inputTranscript='';button.textContent='⏹ Disconnect natural voice';
  ws.onopen=()=>{
   const voice=j.by('jbNatural').value||'Charon';
   ws.send(JSON.stringify({setup:{model:'models/'+info.model,
    generationConfig:{responseModalities:['AUDIO'],speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName:voice}}}},
    outputAudioTranscription:{},inputAudioTranscription:{},
    systemInstruction:{parts:[{text:'You are JARVIS, a highly capable conversational AI. Address the user as Master, naturally and respectfully. You speak with a calm deep masculine voice, friendly and confident, not robotic. You can reason and chat about nearly any topic, follow up naturally, and remember earlier turns in this session. You assist a small brand called TrendWale. Do not claim to have posted, messaged, paid, scheduled, or researched data in other apps unless the user explicitly performed those tasks through the interface. For actions, ask the user to use the review and approval workflows. Keep spoken responses concise unless asked for details.'}]}
   }}));
   j.status('Connecting natural voice. Please wait...');
  };
  ws.onmessage=async e=>{
   try{
    const raw=e.data instanceof Blob?await e.data.text():e.data, msg=JSON.parse(raw);
    if(msg.setupComplete){ready=true;j.status('Native Gemini voice connected. Tap the microphone and talk, Master.');return}
    if(msg.error){j.status('Gemini Live: '+(msg.error.message||'Service error'));return}
    if(msg.serverContent){
     const c=msg.serverContent;
     if(c.inputTranscription?.text)inputTranscript+=c.inputTranscription.text;
     if(c.outputTranscription?.text)transcript+=c.outputTranscription.text;
     for(const p of c.modelTurn?.parts||[]){if(p.inlineData?.data)play(p.inlineData.data,p.inlineData.mimeType)}
     if(c.turnComplete){
      if(inputTranscript.trim()){j.add('user',inputTranscript.trim());inputTranscript=''}
      if(transcript.trim()){j.add('model',transcript.trim());transcript=''}
      j.status('Ready for your next question, Master.');
     }
    }
   }catch(err){j.status('Live audio error: '+err.message)}
  };
  ws.onerror=()=>j.status('Natural voice connection error. Use Gemini AI chat or the device voice.');
  ws.onclose=event=>{if(ws){ws=null;ready=false;resetText();stopMic();j.status('Natural voice disconnected ('+event.code+'). Conversational AI chat still works.')}};
 }catch(e){j.status('Natural voice unavailable: '+e.message);ws=null;ready=false;resetText()}
}
function play(b64,mime){
 if(!j.speechOn())return;const A=window.AudioContext||window.webkitAudioContext;if(!A)return;
 const rate=Number(/rate=(\d+)/.exec(mime||'')?.[1])||24000;
 if(!outCtx){outCtx=new A({sampleRate:rate});playAt=0}
 outCtx.resume().catch(()=>{});
 const bytes=atob(b64),len=Math.floor(bytes.length/2);if(!len)return;
 const sound=outCtx.createBuffer(1,len,rate),a=sound.getChannelData(0);
 for(let i=0;i<len;i++){let n=bytes.charCodeAt(i*2)|(bytes.charCodeAt(i*2+1)<<8);if(n&0x8000)n-=65536;a[i]=n/32768}
 const source=outCtx.createBufferSource();source.buffer=sound;source.connect(outCtx.destination);
 const start=Math.max(outCtx.currentTime+0.045,playAt);source.start(start);playAt=start+sound.duration;
}
function encodePCM(data,inRate){
 const ratio=inRate/16000,count=Math.floor(data.length/ratio);const out=new Uint8Array(count*2);
 for(let i=0;i<count;i++){
  const begin=Math.floor(i*ratio),end=Math.min(data.length,Math.floor((i+1)*ratio));let n=0;
  for(let k=begin;k<end;k++)n+=data[k];
  const value=Math.max(-1,Math.min(1,n/Math.max(1,end-begin)));
  const sample=value<0?Math.round(value*32768):Math.round(value*32767);
  out[i*2]=sample&255;out[i*2+1]=(sample>>8)&255;
 }
 let str='';for(let i=0;i<out.length;i++)str+=String.fromCharCode(out[i]);return btoa(str);
}
async function startMic(){
 if(!isReady())return j.status('Connect Gemini natural voice first.');
 try{
  if(!navigator.mediaDevices?.getUserMedia)throw Error('Your browser does not permit microphone capture');
  const A=window.AudioContext||window.webkitAudioContext;if(!A)throw Error('Web Audio API unavailable');
  stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
  micCtx=new A();await micCtx.resume();
  const input=micCtx.createMediaStreamSource(stream);
  processor=micCtx.createScriptProcessor(4096,1,1);
  const silence=micCtx.createGain();silence.gain.value=0;
  input.connect(processor);processor.connect(silence);silence.connect(micCtx.destination);
  processor.onaudioprocess=e=>{
   if(!isReady()||!stream||ws.bufferedAmount>250000)return;
   const payload=encodePCM(e.inputBuffer.getChannelData(0),micCtx.sampleRate);
   try{ws.send(JSON.stringify({realtimeInput:{audio:{data:payload,mimeType:'audio/pcm;rate=16000'}}}))}catch{}
  };
  j.by('jbMic').textContent='⏹ Finish speaking';j.by('jbOrb').classList.add('active');
  j.status('Listening through Gemini Live. Tap Finish speaking when done.');
 }catch(e){stopMic();j.status('Microphone could not start: '+e.message)}
}
function stopMic(){
 const had=Boolean(stream);
 if(processor){processor.onaudioprocess=null;processor.disconnect();processor=null}
 if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}
 if(micCtx){micCtx.close().catch(()=>{});micCtx=null}
 j.by('jbMic').textContent='🎙 Talk to JARVIS';
 j.by('jbOrb').classList.remove('active');
 if(had&&isReady()){ws.send(JSON.stringify({realtimeInput:{audioStreamEnd:true}}));j.status('Working on your spoken request...')}
}
function sendText(t){
 if(!isReady())return false;
 j.add('user',t);
 ws.send(JSON.stringify({clientContent:{turns:[{role:'user',parts:[{text:String(t).slice(0,1800)}]}],turnComplete:true}}));
 j.status('JARVIS is responding with natural audio...');return true
}
function mute(){
 if(outCtx){outCtx.close().catch(()=>{});outCtx=null;playAt=0}
}
function disconnect(){
 stopMic();if(ws){try{ws.close(1000,'user disconnected')}catch{}}ws=null;ready=false;transcript='';inputTranscript='';mute();resetText();j.status('Natural voice stopped. Gemini AI chat is still available.')
}
button.onclick=()=>ws?disconnect():connect();
j.by('jbNatural').addEventListener('change',()=>{if(ws){disconnect();j.status('Voice changed. Reconnect natural voice to hear the new voice.')}});
j.by('jbClose').addEventListener('click',()=>disconnect());
window.JARVISNative={ready:isReady,connect,disconnect,sendText,startMic,stopMic,activeMic,mute};
})();