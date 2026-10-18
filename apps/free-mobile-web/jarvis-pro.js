(function(){
"use strict";
const by=id=>document.getElementById(id);
const app={history:[],busy:false,voiceOn:false,listening:null,voices:[],live:null};
const style=document.createElement('style');
style.textContent='#jbOverlay{position:fixed;inset:0;z-index:8900;background:#0a1017;color:#eff8f0;display:none;overflow:auto;font:15px system-ui,sans-serif}#jbOverlay.open{display:block}#jbBody{max-width:830px;margin:auto;padding:18px 16px 100px}.jbRow{display:flex;align-items:center;flex-wrap:wrap;gap:10px}.jbHead{display:flex;align-items:center;justify-content:space-between;gap:10px;border-bottom:1px solid #334556;padding:10px 0 17px}.jbHead strong{font-size:23px;letter-spacing:-1px}.jbAccent{color:#bbf481}.jbPanel{background:#16212c;border:1px solid #344558;border-radius:19px;padding:16px;margin:15px 0}.jbBtn{padding:12px 15px;border:1px solid #4a5d6b;border-radius:13px;background:#253546;color:#ecf7f0;font-weight:750;font-size:14px;cursor:pointer}.jbBtn.green{background:#b7f47e;color:#132016;border-color:#b7f47e}.jbBtn:disabled{opacity:.5}.jbSmall{color:#aebaca;font-size:12px;line-height:1.6}.jbInput{border:1px solid #485a6c;background:#0b151d;border-radius:11px;color:#eaf4f1;padding:12px;box-sizing:border-box;width:100%;font-size:15px}.jbLabel{font-size:12px;color:#aebeca;font-weight:800;display:block;margin:9px 0 5px}.jbBadge{color:#b7f47e;font-size:12px;background:#29432a;border:1px solid #567b42;padding:6px;border-radius:10px}.jbOrb{height:105px;width:105px;border:3px solid #a5d486;box-shadow:0 0 30px #b4e47b33;background:radial-gradient(circle,#567d4e,#153b33 46%,#12202b);border-radius:50%;margin:10px auto;display:grid;place-items:center;color:#e8ffe5;font-size:31px}.jbOrb.active{animation:jbP 1.2s infinite alternate}@keyframes jbP{to{transform:scale(1.07);box-shadow:0 0 45px #adff91ad}}#jbMessages{height:min(42vh,480px);min-height:240px;overflow:auto;border:1px solid #304155;background:#0b151e;border-radius:15px;padding:11px}.jbBubble{border-radius:15px;background:#1d3040;padding:12px;white-space:pre-wrap;line-height:1.5;margin:8px 5px;overflow-wrap:anywhere}.jbBubble.user{background:#29432f;margin-left:24px}.jbBubble b{display:block;font-size:11px;letter-spacing:1px;color:#baf185;margin-bottom:5px}.jbGrid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.jbStatus{font-size:13px;color:#b7f47e;min-height:28px;padding:4px}#jbLiveMount{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}@media(max-width:650px){.jbGrid{grid-template-columns:1fr}.jbBtn{padding:11px 12px}}';
document.head.appendChild(style);
const shade=document.createElement('div');shade.id='jbOverlay';shade.setAttribute('role','dialog');shade.setAttribute('aria-label','JARVIS AI assistant');shade.setAttribute('aria-modal','true');
shade.innerHTML='<main id="jbBody"><div class="jbHead"><div><strong>JARVIS <span class="jbAccent">AI CORE</span></strong><div class="jbSmall">Conversational AI • Hands-free wake-up • TrendWale</div></div><button class="jbBtn" id="jbClose">✕ Close</button></div>'+
'<div class="jbPanel"><div class="jbRow" style="justify-content:space-between"><b>Intelligence connection</b><span id="jbBadge" class="jbBadge">Checking...</span></div><label class="jbLabel">Owner access code — temporary, not stored</label><input id="jbOwner" class="jbInput" type="password" autocomplete="off" placeholder="Enter ATTENTIONOS_OWNER_TOKEN"/><div class="jbSmall">Your Gemini API key remains protected in Vercel, never in the browser. Gemini Pro and ChatGPT Plus plans do not automatically include API credits.</div></div>'+
'<div class="jbPanel" style="text-align:center"><div id="jbOrb" class="jbOrb">◎</div><div class="jbStatus" id="jbStatus">At your service, Master.</div><div class="jbRow" style="justify-content:center"><button id="jbMic" class="jbBtn green">📞 Start JARVIS call</button><button id="jbMute" class="jbBtn">🔇 Voice off</button></div><div id="jbLiveMount"></div><div class="jbGrid"><div><label class="jbLabel">Gemini male voice</label><select id="jbNatural" class="jbInput"><option value="Charon">Charon — calm and mature</option><option value="Orus">Orus — firm and confident</option><option value="Iapetus">Iapetus — clear</option><option value="Fenrir">Fenrir — dramatic</option></select></div><div><label class="jbLabel">Fallback phone voice</label><select id="jbLocal" class="jbInput"><option value="">Choose a deep voice automatically</option></select></div></div><div class="jbSmall">Natural Gemini voice needs one secure Live connection. Your phone will ask for microphone permission. Browser fallback voices depend on your phone.</div></div>'+
'<div class="jbPanel"><div id="jbMessages" aria-live="polite"><div class="jbBubble"><b>JARVIS</b>At your service, Master. You can ask me anything, and I will remember our recent conversation. I can also help manage TrendWale drafts and open your tools.</div></div><div class="jbRow" style="margin:13px 0"><input id="jbQuestion" class="jbInput" style="flex:1;min-width:160px" placeholder="Ask a real question..." maxlength="1800"/><button id="jbSend" class="jbBtn green">Send</button></div><div class="jbRow"><button id="jbAgent" class="jbBtn">🔍 Research & 3 Reels</button><button id="jbAnalytics" class="jbBtn">📊 Instagram analytics</button><button id="jbClear" class="jbBtn">Clear chat</button></div><div class="jbSmall">JARVIS can make recommendations and prepare local drafts. Scheduling, posting, DMs and paid actions always need your explicit approval.</div></div></main>';
document.body.appendChild(shade);
function status(s){by('jbStatus').textContent=s}
function add(role,text){const box=document.createElement('div');box.className='jbBubble'+(role==='user'?' user':'');const b=document.createElement('b');b.textContent=role==='user'?'YOU':'JARVIS';const msg=document.createElement('div');msg.textContent=String(text||'');box.append(b,msg);by('jbMessages').appendChild(box);by('jbMessages').scrollTop=by('jbMessages').scrollHeight}
function token(){return by('jbOwner').value.trim()||by('ownerToken')?.value.trim()||''}
function secureToken(){const t=token();if(!t){status('Enter your Vercel owner access code first.');by('jbOwner').focus();throw Error('Owner code required')}return t}
function modelContext(){const x={brand:'TrendWale',postCount:0,scheduledCount:0};try{if(typeof state!=='undefined'&&state){x.brand=state.brand||'TrendWale';x.postCount=state.posts?.length||0;x.scheduledCount=state.posts?.filter(p=>p.status==='scheduled').length||0;x.latest=(state.posts||[]).slice(0,3).map(p=>({title:p.title,status:p.status}))}}catch{}return x}
async function req(endpoint,obj){const resp=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json','x-owner-token':secureToken()},body:JSON.stringify(obj||{})});let data;const raw=await resp.text();try{data=JSON.parse(raw)}catch{throw Error('Server returned non-JSON HTTP '+resp.status+'. Check Vercel deployment.')}if(!resp.ok||data.ok===false)throw Error(data.error||'Backend unavailable');return data}
function localVoices(){if(!window.speechSynthesis)return;app.voices=speechSynthesis.getVoices().filter(v=>/^en[-_]/i.test(v.lang));const el=by('jbLocal'),prior=el.value;while(el.options.length>1)el.remove(1);app.voices.forEach((v,i)=>{const o=new Option(v.name+' ('+v.lang+')',String(i));el.add(o)});if(prior)el.value=prior}
function chosenVoice(){if(by('jbLocal').value!=='')return app.voices[Number(by('jbLocal').value)]||null;return [...app.voices].sort((a,b)=>score(b)-score(a))[0]||null}
function score(v){const n=v.name.toLowerCase();return (/(male|david|daniel|george|guy|ryan|charon)/.test(n)?100:0)+(v.lang.toLowerCase().startsWith('en-gb')?25:0)+(v.name.toLowerCase().includes('google')?8:0)}
function say(text){if(!app.voiceOn||!window.speechSynthesis)return;try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(String(text).replace(/[*#]/g,'').slice(0,950));u.lang='en-GB';u.pitch=.78;u.rate=.93;const voice=chosenVoice();if(voice){u.voice=voice;u.lang=voice.lang}speechSynthesis.speak(u)}catch{status('This phone could not play the fallback voice. Text still works.')}}
async function chat(message,spoken=false){
 const m=String(message||'').trim();if(!m||app.busy)return;
 app.busy=true;by('jbSend').disabled=true;add('user',m);status('JARVIS is processing your request...');
 try{
   const d=await req('/api/jarvis-chat',{message:m,history:app.history.slice(-12),context:modelContext()});
   const verified=await execute(d,m);
   const answer=verified||d.reply||'No result was returned, Master.';
   add('model',answer);
   app.history.push({role:'user',text:m},{role:'model',text:answer});
   app.history=app.history.slice(-24);
   status('Ready, Master.');
   if(app.voiceOn&&!window.JARVISNative?.ready())say(answer);
 }catch(e){
   const msg='The request was NOT completed: '+e.message;
   add('model',msg);status(msg);
   app.history.push({role:'user',text:m},{role:'model',text:msg});
   if(app.voiceOn&&!window.JARVISNative?.ready())say(msg);
 }finally{app.busy=false;by('jbSend').disabled=false}
}
async function execute(d,original){
 switch(d.action){
 case 'research_products':
 case 'open_agent':{
   if(!window.AttentionAgent?.planFor)throw Error('The research agent failed to load.');
   status('Checking research sources and creating three concepts. Please wait...');
   const result=await window.AttentionAgent.planFor(d.topic||'budget product ideas in India');
   const titles=(result.sources||[]).slice(0,2).map(x=>x.title).filter(Boolean);
   return 'Research finished, Master. I found '+result.sources.length+' public article leads and prepared '+result.ideas.length+' editable Reel concepts. '+(titles.length?'Sources include: '+titles.join('; ')+'. ':'')+'These are research leads, not verified best-selling products. Open JARVIS AGENT to review them.';
 }
 case 'prepare_reel':{
   if(!window.AttentionAgent?.makeDraft)throw Error('The Reel editor is unavailable.');
   status('Preparing a real local Reel draft...');
   const r=await window.AttentionAgent.makeDraft(d.topic);
   return 'I saved the Reel draft "'+r.title+'" to the local review pipeline, Master. It contains a script and caption, but no actual product footage yet. You must upload your own video or image before it can be published.';
 }
 case 'review_post':{
   if(!window.AttentionAgent?.reviewPost)throw Error('Publishing review is unavailable.');
   const r=window.AttentionAgent.reviewPost(original);
   return 'I have NOT posted anything, Master. '+r.reason+(r.ready?' The media and draft are ready for your approval.':'');
 }
 case 'show_analytics':{
   if(!window.AttentionAgent?.analytics)throw Error('Analytics screen is unavailable.');
   window.AttentionAgent.open();await window.AttentionAgent.analytics();
   return 'I requested real Instagram analytics from Zernio. Check the analytics panel for the returned metrics.';
 }
 case 'open_calendar':
 case 'open_content':
 case 'open_automations':{
   const target=d.action==='open_calendar'?'calendar':d.action==='open_content'?'pipeline':'automations';
   const element=document.querySelector('[data-nav="'+target+'"]');
   if(!element)throw Error('The requested page is unavailable.');
   element.click();return 'Opened the '+target+' section, Master.';
 }
 case 'create_draft':{
   if(!d.draft)throw Error('AI did not return a valid draft.');
   if(typeof state==='undefined'||!Array.isArray(state.posts))throw Error('Local content storage is unavailable.');
   const now=new Date().toISOString();
   state.posts.unshift({id:crypto.randomUUID?.()||String(Date.now()),title:d.draft.title,caption:d.draft.caption,platform:'Instagram',status:'draft',type:'Post',date:'',createdAt:now,updatedAt:now});
   if(typeof save==='function')save();
   if(typeof render==='function')render();
   return 'Saved a text-only local draft called "'+d.draft.title+'", Master. It is NOT a video and nothing was published.';
 }
 }
 return null;
}
function open(){document.getElementById('jarvisShade')?.classList.remove('show');shade.classList.add('open');if(by('ownerToken')?.value)by('jbOwner').value=by('ownerToken').value;localVoices();refreshStatus()}
function close(){stopMic();window.JARVISNative?.disconnect?.();shade.classList.remove('open');window.speechSynthesis?.cancel()}
async function refreshStatus(){try{const r=await fetch('/api/jarvis-chat'),d=await r.json();by('jbBadge').textContent=d.configured?'Real Gemini AI configured':'Gemini API missing';status(d.configured?'Gemini brain ready. Enter your owner code and talk.':'AI key not configured for this deployment.')}catch{by('jbBadge').textContent='Status unknown'}}
function stopMic(){if(app.listening){try{app.listening.stop()}catch{}app.listening=null}by('jbMic').textContent='🎙 Talk to JARVIS';by('jbOrb').classList.remove('active');if(window.JARVISNative?.activeMic())window.JARVISNative.stopMic()}
function browserMic(){const R=window.SpeechRecognition||window.webkitSpeechRecognition;if(!R){status('Speech recognition not supported here. Type your message, or connect Gemini natural voice.');return}const rec=new R();rec.lang='en-IN';rec.interimResults=false;rec.continuous=false;app.listening=rec;by('jbMic').textContent='⏹ Stop listening';by('jbOrb').classList.add('active');status('Listening, Master...');rec.onresult=e=>{const t=e.results?.[0]?.[0]?.transcript;if(t){if(window.JARVISNative?.ready())window.JARVISNative.sendText(t);else chat(t,true)}};rec.onerror=e=>status('Microphone error: '+e.error);rec.onend=()=>{app.listening=null;by('jbMic').textContent='🎙 Talk to JARVIS';by('jbOrb').classList.remove('active')};try{rec.start()}catch(e){status(e.message)}}
function send(){const m=by('jbQuestion').value.trim();by('jbQuestion').value='';if(!m)return;if(window.JARVISNative?.ready())window.JARVISNative.sendText(m);else chat(m,false)}
by('jbClose').onclick=close;by('jbSend').onclick=send;by('jbQuestion').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();send()}};
by('jbMic').onclick=()=>{if(app.listening){stopMic();return}if(window.JARVISNative?.activeMic()||window.JARVISNative?.ready()){window.JARVISNative.disconnect();return}if(window.JARVISNative?.connect){window.JARVISNative.connect();return}status('Live voice is unavailable; use the fallback mic or text input.')};
const backup=document.createElement('button');backup.id='jbFallbackMic';backup.className='jbBtn';backup.textContent='🎤 Backup single question';backup.title='Uses Android speech recognition and basic device voice if Gemini Live is not available';backup.onclick=()=>{if(app.listening)stopMic();else browserMic()};by('jbMute').parentElement.appendChild(backup);
by('jbMute').onclick=()=>{app.voiceOn=!app.voiceOn;by('jbMute').textContent=app.voiceOn?'🔊 Voice on':'🔇 Voice off';if(!app.voiceOn){window.speechSynthesis?.cancel();window.JARVISNative?.mute()}};by('jbClear').onclick=()=>{app.history=[];by('jbMessages').innerHTML='';add('model','Conversation cleared. What can I help with, Master?');status('Ready, Master.')};
by('jbAgent').onclick=()=>window.AttentionAgent?.open('research trending affordable products for TrendWale');
by('jbAnalytics').onclick=()=>{window.AttentionAgent?.open();window.AttentionAgent?.analytics?.()};
window.JARVISBetter={open,close,chat,add,status,token:secureToken,req,by,app,speechOn:()=>app.voiceOn};
const fab=document.querySelector('.jarvisFab');if(fab){fab.onclick=open;fab.setAttribute('aria-label','Open intelligent JARVIS assistant')}
const launch=document.createElement('button');launch.id='jbLaunch';launch.type='button';launch.textContent='✦ JARVIS AI';launch.setAttribute('aria-label','Open intelligent Gemini JARVIS assistant');launch.style.cssText='position:fixed;right:12px;bottom:190px;z-index:7000;background:#b7f47e;color:#132016;border:2px solid #699340;padding:11px 15px;border-radius:15px;font:800 14px system-ui;box-shadow:0 5px 20px #0009;cursor:pointer';launch.onclick=open;document.body.appendChild(launch);
if(window.JARVIS){window.JARVIS.open=open;window.JARVIS.close=close}
if(window.speechSynthesis){speechSynthesis.addEventListener?.('voiceschanged',localVoices);localVoices()}
})();