(function(){
'use strict';
const j=window.JARVISBetter;if(!j)return;
const mount=j.by('jbLiveMount');
const button=document.createElement('button');button.id='jLiveButton';button.className='jbBtn green';button.textContent='📞 Start natural JARVIS call';mount.appendChild(button);
const sub=document.createElement('span');sub.className='jbSmall';sub.textContent='Two-way Gemini Live conversation · hands-free while connected · tap End call when finished';mount.appendChild(sub);
let ws=null,ready=false,stream=null,micCtx=null,outCtx=null,processor=null,playAt=0,transcript='',inputTranscript='';
const isReady=()=>Boolean(ws&&ws.readyState===WebSocket.OPEN&&ready);
const activeMic=()=>Boolean(stream);
function resetText(){button.textContent='📞 Start natural JARVIS call'}
async function connect(){
 try{
  // Prime playback inside the user gesture. Android browsers can block a new AudioContext made only when Gemini audio arrives.
  const AudioClass=window.AudioContext||window.webkitAudioContext;
  if(AudioClass&&!outCtx){try{outCtx=new AudioClass({sampleRate:24000});outCtx.resume().catch(()=>{})}catch{}}
  j.status('Requesting a secure Gemini Live session...');
  const info=await j.req('/api/jarvis-live',{});
  const uri='wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token='+encodeURIComponent(info.token);
  ws=new WebSocket(uri);ready=false;transcript='';inputTranscript='';button.textContent='⏹ End JARVIS call';j.by('jbMic').textContent='⏳ Connecting call...';
  ws.onopen=()=>{
   const voice=j.by('jbNatural').value||'Charon';
   ws.send(JSON.stringify({setup:{model:'models/'+info.model,
    generationConfig:{responseModalities:['AUDIO'],speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName:voice}}}},
    outputAudioTranscription:{},inputAudioTranscription:{},
    tools:[{functionDeclarations:[
      {name:'research_products',description:'Actually research public source leads and prepare three product Reel concepts in the AttentionOS editor. Use for finding trending products or research, instead of claiming the research was launched.',parameters:{type:'OBJECT',properties:{topic:{type:'STRING',description:'A specific product niche or category, such as budget home organizers or phone accessories'}}}},
      {name:'prepare_reel_draft',description:'Create and save one REAL local Reel script-and-caption draft in AttentionOS, not a finished video. Do not claim video generation or publication.',parameters:{type:'OBJECT',properties:{topic:{type:'STRING',description:'A niche or product topic'}}}},
      {name:'review_instagram_post',description:'Open Instagram review in AttentionOS and report if media is missing. Never publish without user final confirmation.',parameters:{type:'OBJECT',properties:{caption:{type:'STRING',description:'Desired caption text, if any'}}}},
      {name:'show_instagram_analytics',description:'Fetch actual Instagram analytics from connected Zernio without guessing metrics',parameters:{type:'OBJECT',properties:{}}},
      {name:'open_calendar',description:'Show content calendar inside AttentionOS',parameters:{type:'OBJECT',properties:{}}}
    ]}],
    systemInstruction:{parts:[{text:'You are JARVIS, a highly capable conversational AI. Address the user as Master, naturally and respectfully. You speak with a calm deep masculine voice, friendly and confident, not robotic. You can reason and chat about nearly any topic, follow up naturally, and remember earlier turns in this session. You assist a small brand called TrendWale. Use your declared tools to perform TrendWale research, save Reel drafts, open Instagram publish review, and read analytics when Master asks; report the result after the tool responds. NEVER say you completed research or a Reel before the tool finishes. Research provides news leads, not verified viral products. A script draft is NOT a rendered video. If asked to post now, call review_instagram_post; the app must confirm media and explicit publishing approval. Never claim external publishing happened until Zernio confirms. For any action not supported by a tool, state limitations. Keep spoken responses concise unless asked for details.'}]}
   }}));
   j.status('Connecting natural voice. Please wait...');
  };
  ws.onmessage=async e=>{
   try{
    const raw=e.data instanceof Blob?await e.data.text():e.data, msg=JSON.parse(raw);
    if(msg.setupComplete){ready=true;j.status('Gemini call connected. Starting microphone...');await startMic();return}
    if(msg.error){j.status('Gemini Live: '+(msg.error.message||'Service error'));return}
    if(msg.toolCall){await runToolCalls(msg.toolCall);return}
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
  j.by('jbMic').textContent='☎️ End JARVIS call';j.by('jbOrb').classList.add('active');
  j.status('In call with JARVIS. Speak naturally, pause for a response, and tap End call when finished.');
 }catch(e){stopMic();j.status('Microphone could not start: '+e.message)}
}
function stopMic(){
 const had=Boolean(stream);
 if(processor){processor.onaudioprocess=null;processor.disconnect();processor=null}
 if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}
 if(micCtx){micCtx.close().catch(()=>{});micCtx=null}
 j.by('jbMic').textContent='📞 Start JARVIS call';
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
 stopMic();if(ws){try{ws.close(1000,'user disconnected')}catch{}}ws=null;ready=false;transcript='';inputTranscript='';mute();resetText();j.status('Call ended. Gemini AI text chat remains available.')
}

async function runToolCalls(toolCall){
 const responses=[];
 for(const fc of toolCall.functionCalls||[]){
  const topic=String(fc.args?.topic||'affordable useful products for Indian shoppers').slice(0,230);
  try{
   j.status('Running '+fc.name.replace(/_/g,' ')+'...');
   let result;
   if(fc.name==='research_products'){
    if(!window.AttentionAgent?.planFor)throw Error('Research tools are unavailable');
    const r=await window.AttentionAgent.planFor(topic);
    result={ok:true,researchLeadCount:r.sources.length,sourceTitles:r.sources.slice(0,3).map(s=>s.title),reelConceptCount:r.ideas.length,note:'Public article leads are not verified viral or best-selling products. Scripts require review; no post published.'};
   }else if(fc.name==='prepare_reel_draft'){
    if(!window.AttentionAgent?.makeDraft)throw Error('Reel draft editor is unavailable');
    const d=await window.AttentionAgent.makeDraft(topic);
    result={ok:true,draftTitle:d.title,savedLocally:true,videoRendered:false,published:false,needsOriginalMedia:d.needsMedia,note:'Created a script/caption draft, not a finished Reel video.'};
   }else if(fc.name==='review_instagram_post'){
    if(!window.AttentionAgent?.reviewPost)throw Error('Instagram review panel is unavailable');
    const d=window.AttentionAgent.reviewPost('caption '+String(fc.args?.caption||'').slice(0,2200));
    result={ok:true,...d,published:false,note:'Review is not publication. User must approve Zernio submission with actual media.'};
   }else if(fc.name==='show_instagram_analytics'){
    if(!window.AttentionAgent?.analytics)throw Error('Analytics unavailable');
    window.AttentionAgent.open();
    await window.AttentionAgent.analytics();
    result={ok:true,note:'Analytics panel opened and request completed; read the data there, do not invent numbers.'};
   }else if(fc.name==='open_calendar'){
    const nav=document.querySelector('[data-nav="calendar"]');if(!nav)throw Error('Calendar screen not found');
    nav.click();result={ok:true,calendarOpened:true};
   }else throw Error('Unknown tool');
   responses.push({id:fc.id,name:fc.name,response:{result}});
  }catch(e){responses.push({id:fc.id,name:fc.name,response:{error:String(e.message||e)}})}
 }
 if(ws?.readyState===WebSocket.OPEN && responses.length)ws.send(JSON.stringify({toolResponse:{functionResponses:responses}}));
 j.status('JARVIS tool operations complete. Continuing conversation...');
}

button.onclick=()=>ws?disconnect():connect();
j.by('jbNatural').addEventListener('change',()=>{if(ws){disconnect();j.status('Voice changed. Reconnect natural voice to hear the new voice.')}});
j.by('jbClose').addEventListener('click',()=>disconnect());
window.JARVISNative={ready:isReady,connect,disconnect,sendText,startMic,stopMic,activeMic,mute,runToolCalls};
})();