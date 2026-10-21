(function(){
"use strict";
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const svg=p=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+p+'</svg>';
const ICON={
 overview:svg('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
 agents:svg('<rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>'),
 studio:svg('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v18M17 3v18M3 8h4M3 16h4M17 8h4M17 16h4"/>'),
 publish:svg('<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/>'),
 analytics:svg('<path d="M3 3v18h18"/><path d="M8 17v-6M13 17V7M18 17v-4"/>'),
 settings:svg('<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>'),
 mic:svg('<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4"/>')
};
const VIEWS=[["overview","Overview"],["agents","AI Agents"],["studio","Content Studio"],["publish","Publishing & Community"],["analytics","Analytics"],["settings","Settings"]];
const NAVLABEL={overview:"Overview",agents:"Agents",studio:"Studio",publish:"Publish",analytics:"Analytics",settings:"Settings"};
const AGENTS=[
 ["analyst","Analyst","Finds public sources for a topic. Never invents trends or numbers.","Reads public news feeds"],
 ["strategist","Strategist","Chooses one angle using your brand kit and past analytics.","Brand kit, learnings"],
 ["copywriter","Copywriter","Writes script, caption and hashtags, then runs the safety checks.","Gemini, safety checks"],
 ["art_director","Art Director","Prepares the 9:16 render plan. Your browser renders the real MP4.","Render plan only"],
 ["publisher","Publisher","Publishes once per Reel, only after your approval.","Zernio posts, approval required"],
 ["community","Community","Creates comment-to-DM rules after you confirm.","Zernio comment automations"],
 ["chief_of_staff","Chief of Staff","Starts runs, tracks approvals and reports failures.","Job queue, approvals"]
];
const STATUS={queued:["Queued",""],running:["Working","live"],rendering:["Needs video render","warn"],awaiting_approval:["Waiting for your approval","warn"],approved:["Approved","ok"],publishing:["Publishing","live"],published:["Published","ok"],failed:["Failed","bad"],cancelled:["Cancelled",""]};
const pill=s=>{const [t,c]=STATUS[s]||[s,""];return '<span class="pill '+c+'">'+esc(t)+'</span>'};
const when=x=>{try{return new Date(x).toLocaleString([],{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}catch{return ""}};
let token="",S=null,H=null,view="overview",selRun=null,runDetail=null,busy=false,hist=[],analyticsSnap=null,accounts=null,modelInfo=null;

function toast(msg,bad){const t=$("toast");t.textContent=msg;t.className="toast"+(bad?" bad":"");t.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>{t.hidden=true},bad?7000:3800)}
async function api(action,body){
 const opt={headers:{"x-owner-token":token}};
 if(body){opt.method="POST";opt.headers["Content-Type"]="application/json";opt.body=JSON.stringify({...body,action})}
 const r=await fetch("/api/aos?action="+encodeURIComponent(action)+(body&&body.id?"&id="+encodeURIComponent(body.id):""),opt);
 const t=await r.text();let d;try{d=JSON.parse(t)}catch{throw Error("The server returned HTTP "+r.status+" instead of data.")}
 if(!r.ok||d.ok===false){if(r.status===401&&token){lock("That access code was not accepted.")}throw Error(d.error||"Request failed")}
 return d;
}
async function health(){try{const r=await fetch("/api/aos?action=health");H=await r.json()}catch{H=null}}
async function refresh(){S=await api("state");$("ownerToken").value=token;renderNav();render()}
function lock(msg){token="";$("ownerToken").value="";S=null;renderGate(msg)}

function renderNav(){
 const pend=S?(S.approvals||[]).filter(a=>a.status==="pending").length:0;
 $("nav").innerHTML='<div class="brand"><i></i>AttentionOS</div>'+VIEWS.map(([id,name])=>'<button data-nav="'+id+'"'+(id===view?' aria-current="page"':"")+' aria-label="'+esc(name)+'">'+ICON[id]+'<span class="lbl">'+esc(NAVLABEL[id])+'</span>'+(id==="publish"&&pend?'<span class="badge" aria-label="'+pend+' waiting">'+pend+'</span>':"")+'</button>').join("");
}
function renderGate(msg){
 $("nav").innerHTML='<div class="brand"><i></i>AttentionOS</div>';
 $("jarvis").hidden=true;
 $("main").innerHTML='<section class="gate view"><h1>Owner access</h1><p>Enter your private owner code to use AttentionOS. It stays in this tab only.</p><form id="gateForm"><label class="lbl" for="gateCode">Owner code</label><input class="field" id="gateCode" type="password" autocomplete="current-password" required><p class="err" id="gateErr" role="alert">'+esc(msg||"")+'</p><button class="btn primary" style="margin-top:14px" type="submit">Continue</button></form></section>';
 $("gateForm").onsubmit=async e=>{e.preventDefault();const b=e.target.querySelector("button");b.disabled=true;token=$("gateCode").value.trim();try{await refresh();$("jarvis").hidden=false;go(location.hash.slice(1)||"overview")}catch(err){token="";$("gateErr").textContent=err.message}finally{b.disabled=false}};
 setTimeout(()=>$("gateCode")&&$("gateCode").focus(),0);
}
function go(v){if(!VIEWS.some(x=>x[0]===v))v="overview";view=v;history.replaceState(null,"","#"+v);renderNav();render();$("main").focus({preventScroll:true});window.scrollTo(0,0)}
function head(title,sub,right){return '<header class="head"><div><h1>'+esc(title)+'</h1>'+(sub?'<p>'+esc(sub)+'</p>':"")+'</div>'+(right||"")+'</header>'}
function empty(title,text,btn){return '<div class="empty"><strong>'+esc(title)+'</strong>'+esc(text)+(btn||"")+'</div>'}
function render(){
 if(!S)return;
 const fn={overview:vOverview,agents:vAgents,studio:vStudio,publish:vPublish,analytics:vAnalytics,settings:vSettings}[view];
 $("main").innerHTML='<div class="view">'+fn()+'</div>';
 if(view==="studio")loadRun();
 if(view==="analytics"&&!analyticsSnap)loadAnalyticsLast();
}

/* ---------- Overview ---------- */
function vOverview(){
 const runs=S.runs||[],pend=(S.approvals||[]).filter(a=>a.status==="pending");
 const rendering=runs.find(r=>r.status==="rendering");
 let next;
 if(pend.length)next=head("Overview","")+'<div class="row"><div><div class="t">'+pend.length+' Reel'+(pend.length>1?"s":"")+' waiting for your approval</div><div class="s">Nothing is published until you approve it.</div></div><div class="actions"><button class="btn primary" data-nav="publish">Review</button></div></div>';
 else if(rendering)next=head("Overview","")+'<div class="row"><div><div class="t">'+esc(rendering.goal)+'</div><div class="s">Script is ready. The video needs to be rendered in your browser.</div></div><div class="actions"><button class="btn primary" data-open-run="'+esc(rendering.id)+'">Render video</button></div></div>';
 else next=head("Overview","")+(runs.length?"":empty("No workflows yet","Ask JARVIS below, for example “Find a trending product and create a Reel”.",'<br><button class="btn primary" data-suggest="Find a trending product and create a Reel">Run this</button>'));
 const ready=[["Database",H&&H.database],["Gemini",H&&H.gemini],["Instagram (Zernio)",H&&H.zernio],["Owner code",H&&H.owner],["Daily schedule",H&&H.cron]];
 const acct=S.zernio&&S.zernio.accountId;
 return next+
 (runs.length?'<section class="section"><h2>Recent workflows</h2><div class="list">'+runs.slice(0,8).map(r=>'<div class="row link" data-open-run="'+esc(r.id)+'" tabindex="0" role="button"><div><div class="t">'+esc(r.goal)+'</div><div class="s">'+esc(when(r.created_at))+(r.error?' · '+esc(r.error):"")+'</div></div>'+pill(r.status)+'</div>').join("")+'</div></section>':"")+
 '<section class="section"><h2>Connections</h2><div class="list">'+ready.map(([n,ok])=>'<div class="row"><div class="t">'+esc(n)+'</div><span class="pill '+(ok?"ok":"bad")+'">'+(ok?"Key configured":"Not set up")+'</span></div>').join("")+
 '<div class="row"><div class="t">Instagram account</div>'+(acct?'<span class="pill ok">Selected</span>':'<button class="btn" data-nav="settings">Choose in Settings</button>')+'</div></div></section>';
}

/* ---------- Agents ---------- */
function vAgents(){
 const ev=S.events||[],jobs=S.jobs||[];
 return head("AI Agents","Seven agents, each with one job and a fixed set of tools. Status below comes from the job queue and event log.")+
 '<div class="list">'+AGENTS.map(([id,name,job,tools])=>{
  const last=ev.find(e=>e.agent===id),q=jobs.filter(j=>j.agent===id);
  return '<div class="row"><div><div class="t">'+esc(name)+'</div><div class="s">'+esc(job)+'</div><div class="s">Tools: '+esc(tools)+'</div><div class="s">'+(last?esc(last.message)+' · '+esc(when(last.created_at)):"No activity yet")+'</div></div>'+(q.length?'<span class="pill live">'+q.length+' in queue</span>':'<span class="pill">Idle</span>')+'</div>';
 }).join("")+'</div>'+
 '<p class="note" style="margin-top:18px">Mode: <strong>'+(S.mode&&S.mode.mode==="autopilot"?"Autopilot":"Copilot")+'</strong>. Publishing '+(S.mode&&S.mode.autopublish?"is pre-approved in Autopilot.":"always waits for your approval.")+' Change this in Settings.</p>';
}

/* ---------- Studio ---------- */
function vStudio(){
 const runs=S.runs||[];
 if(!runs.length)return head("Content Studio","")+empty("Nothing to show yet","Ask JARVIS to create a Reel. Research, script and video appear here.");
 if(!selRun||!runs.some(r=>r.id===selRun))selRun=runs[0].id;
 return head("Content Studio","",'<select class="field" id="runPick" style="width:auto;max-width:100%" aria-label="Workflow">'+runs.map(r=>'<option value="'+esc(r.id)+'"'+(r.id===selRun?" selected":"")+'>'+esc(r.goal.slice(0,48))+' · '+esc(when(r.created_at))+'</option>').join("")+'</select>')+'<div id="runBody"><div class="skeleton"></div><div class="skeleton" style="width:70%"></div></div>';
}
async function loadRun(){
 if(!selRun)return;
 try{
  const d=await api("run",{id:selRun});runDetail=d;if(view!=="studio")return;
  const body=$("runBody");if(!body)return;
  const r=d.run,c=d.content[0],m=d.media[0],ap=d.approvals[0],post=d.posts[0];
  let h='<div class="row" style="padding-top:0"><div><div class="t">'+esc(r.goal)+'</div><div class="s">Started '+esc(when(r.created_at))+(r.error?' · <span class="err">'+esc(r.error)+'</span>':"")+'</div></div>'+pill(r.status)+'</div>';
  if(c){
   const g=c.guard_report||{};
   h+='<section class="section"><h2>Content</h2><div class="list">'+
    '<div class="row"><div><div class="t">'+esc(c.title)+'</div><div class="s">Hook: '+esc(c.hook)+'</div></div><span class="pill '+(c.guard_passed?"ok":"bad")+'">'+(c.guard_passed?"Safety checks passed":"Blocked")+'</span></div>'+
    '<details><summary>Script</summary><div class="body"><pre>'+esc(c.script)+'</pre>Shots: '+esc((c.shot_list||[]).join(" · "))+'</div></details>'+
    '<details><summary>Caption</summary><div class="body"><pre>'+esc(c.caption)+'</pre>'+esc(c.hashtags)+'</div></details>'+
    ((g.issues&&g.issues.length)||(g.warnings&&g.warnings.length)?'<details open><summary>Safety report</summary><div class="body">'+(g.issues||[]).map(x=>'<p class="err">'+esc(x)+'</p>').join("")+(g.warnings||[]).map(x=>'<p>'+esc(x)+'</p>').join("")+'</div></details>':"")+
   '</div></section>';
   if(r.status==="rendering"&&c.guard_passed&&!m)h+='<section class="section"><h2>Video</h2><p class="note">Your browser renders a real 9:16 MP4 from licensed stock or your own footage, then uploads it to Zernio storage. It does not publish.</p><p style="margin-top:12px"><button class="btn primary" data-render="'+esc(c.id)+'">Render and upload video</button></p></section>';
   if(m)h+='<section class="section"><h2>Video</h2><video src="'+esc(m.provider_url)+'" controls playsinline preload="metadata" style="max-width:240px;width:100%;border-radius:10px;background:#000"></video><p class="s" style="color:var(--muted);margin-top:6px">'+Math.round((m.bytes||0)/1024)+' KB · uploaded '+esc(when(m.created_at))+'</p></section>';
   if(ap&&ap.status==="pending")h+='<p class="note" style="margin-top:20px">Waiting for your approval. <button class="hint-chip" data-nav="publish">Open Publishing</button></p>';
   if(post)h+='<p class="note" style="margin-top:20px">Instagram post id <strong>'+esc(post.provider_post_id||"none returned")+'</strong>, provider status <strong>'+esc(post.provider_status||"unknown")+'</strong>.</p>';
  }
  h+='<section class="section"><h2>Activity</h2>'+(d.events.length?'<ul class="steps">'+d.events.map(e=>'<li class="'+esc(e.level)+'"><div class="who">'+esc((AGENTS.find(a=>a[0]===e.agent)||[0,e.agent||"System"])[1])+'<time>'+esc(when(e.created_at))+'</time></div><div class="msg">'+esc(e.message)+'</div></li>').join("")+'</ul>':'<p class="note">No activity recorded.</p>')+'</section>';
  if(d.sources.length)h+='<section class="section"><h2>Sources</h2><div class="list">'+d.sources.map(s=>'<div class="row"><div><a href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer">'+esc(s.title)+'</a><div class="s">'+esc(s.published||"")+'</div></div></div>').join("")+'</div><p class="note" style="margin-top:8px">Public news leads. They are not proof that a product is selling.</p></section>';
  body.innerHTML=h;
 }catch(e){const b=$("runBody");if(b)b.innerHTML='<p class="err">'+esc(e.message)+'</p>'}
}
async function renderVideo(contentId,btn){
 if(busy)return;const d=runDetail;if(!d)return;const c=d.content.find(x=>x.id===contentId);if(!c)return;
 if(!window.ReelStudio){toast("The video engine did not load. Reload the page.",true);return}
 busy=true;btn.disabled=true;btn.textContent="Rendering. Keep this tab open";
 try{
  const draft={title:c.title,hook:c.hook,cta:c.cta,caption:c.caption,researchTopic:d.run.topic||c.title};
  const res=await window.ReelStudio.uploadPrepared(draft);
  try{window.ReelStudio.close()}catch{}
  if(!res||!res.ok)throw Error((res&&res.error)||"No video was produced");
  await api("media",{contentId,providerUrl:res.mediaUrl,bytes:res.bytes,durationS:12,caption:draft.caption});
  toast("Video uploaded. It is waiting for your approval.");await refresh();
 }catch(e){toast(e.message,true);btn.disabled=false;btn.textContent="Render and upload video"}
 finally{busy=false}
}

/* ---------- Publishing & Community ---------- */
function vPublish(){
 const ap=S.approvals||[],pend=ap.filter(a=>a.status==="pending"),content=S.content||[],media=S.media||[],posts=S.posts||[],rules=S.rules||[];
 const C=id=>content.find(c=>c.id===id)||{},M=id=>media.find(m=>m.content_id===id);
 return head("Publishing & Community","Nothing goes to Instagram without your approval here. Voice commands cannot approve.")+
 '<section class="section" style="margin-top:0"><h2>Waiting for approval</h2>'+(pend.length?pend.map(a=>{const c=C(a.content_id),m=M(a.content_id);return '<div class="row" style="flex-direction:column"><div style="width:100%"><div class="t">'+esc(c.title)+'</div>'+(m?'<video src="'+esc(m.provider_url)+'" controls playsinline preload="metadata" style="max-width:220px;width:100%;border-radius:10px;margin:10px 0;background:#000"></video>':"")+'<details><summary>Caption</summary><div class="body"><pre>'+esc(c.caption)+'</pre>'+esc(c.hashtags)+'</div></details></div><div class="actions"><button class="btn primary" data-approve="'+esc(a.id)+'">Approve and publish</button><button class="btn danger" data-reject="'+esc(a.id)+'">Reject</button></div></div>'}).join(""):empty("Nothing waiting","Approved Reels appear here after a video is rendered."))+'</section>'+
 '<section class="section"><h2>Published</h2>'+(posts.length?'<div class="list">'+posts.map(p=>'<div class="row"><div><div class="t">'+esc(C(p.content_id).title||"Reel")+'</div><div class="s">Post id '+esc(p.provider_post_id||"none returned")+' · '+esc(when(p.created_at))+'</div></div><span class="pill '+(/fail|error/i.test(p.provider_status||"")?"bad":"ok")+'">'+esc(p.provider_status||"unknown")+'</span></div>').join("")+'</div>':'<p class="note">No posts yet.</p>')+'</section>'+
 '<section class="section"><h2>Comment-to-DM rules</h2>'+(rules.length?'<div class="list">'+rules.map(r=>'<div class="row"><div><div class="t">Comment “'+esc(r.keyword)+'”</div><div class="s">'+esc(r.dm_message)+'</div></div>'+(r.active?'<span class="pill ok">Active in Instagram</span>':'<span class="pill">Saved, not active</span>')+'</div>').join("")+'</div>':"")+
 '<form id="ruleForm" class="form" style="margin-top:14px"><label class="lbl" for="rKey">When someone comments</label><input class="field" id="rKey" maxlength="100" placeholder="GUIDE" required><label class="lbl" for="rDm">Send this DM</label><textarea class="field" id="rDm" maxlength="1000" required></textarea><label class="lbl" for="rReply">Public reply (optional)</label><input class="field" id="rReply" maxlength="250"><label class="check"><input type="checkbox" id="rConfirm"><span>Create it in Instagram now. This will start sending DMs to people who comment.</span></label><p style="margin-top:14px"><button class="btn primary" type="submit">Save rule</button></p><p class="note" style="margin-top:8px">Delivery is confirmed only when Zernio returns an automation id. DMs to individual people are not verifiable from here.</p></form></section>';
}

/* ---------- Analytics ---------- */
async function loadAnalyticsLast(){try{const d=await api("analytics-last");analyticsSnap=d.snapshot||false;if(view==="analytics")render()}catch{analyticsSnap=false}}
function vAnalytics(){
 const learn=S.learnings||[];let table="";
 if(analyticsSnap){
  const p=analyticsSnap.payload,arr=Array.isArray(p)?p:(p.posts||p.data||p.analytics||p.items||[]);
  if(Array.isArray(arr)&&arr.length&&typeof arr[0]==="object"){
   const keys=Object.keys(arr[0]).filter(k=>["string","number"].includes(typeof arr[0][k])&&String(arr[0][k]).length<60&&!/^(_?id|.*Id|url|.*Url)$/.test(k)).slice(0,6);
   table='<div class="scroll-x"><table class="table"><thead><tr>'+keys.map(k=>'<th class="'+(typeof arr[0][k]==="number"?"n":"")+'">'+esc(k)+'</th>').join("")+'</tr></thead><tbody>'+arr.slice(0,25).map(row=>'<tr>'+keys.map(k=>'<td class="'+(typeof row[k]==="number"?"n":"")+'">'+esc(row[k]??"")+'</td>').join("")+'</tr>').join("")+'</tbody></table></div><p class="note" style="margin-top:8px">Retrieved from Instagram via Zernio on '+esc(when(analyticsSnap.fetched_at))+'.</p>';
  }else table='<p class="note">Zernio returned data in a shape this table cannot read (fields: '+esc(Object.keys(p||{}).join(", ")||"none")+'). Retrieved '+esc(when(analyticsSnap.fetched_at))+'.</p>';
 }else if(analyticsSnap===false)table=empty("No analytics yet","Fetch your latest post metrics from Instagram. Numbers are shown exactly as returned.");
 else table='<div class="skeleton"></div>';
 return head("Analytics","Only real data retrieved from Instagram through Zernio.",'<button class="btn" id="fetchAnalytics">Fetch from Instagram</button>')+table+
 '<section class="section"><h2>What AttentionOS learned</h2>'+(learn.length?'<div class="list">'+learn.map(l=>'<div class="row"><div class="t">'+esc(l.insight)+'</div></div>').join("")+'</div>':'<p class="note">No learnings yet.</p>')+'<p style="margin-top:12px"><button class="btn" id="learnBtn">Generate learnings from analytics</button></p></section>';
}

/* ---------- Settings ---------- */
function vSettings(){
 const m=S.mode||{},b=S.brand||{},acct=S.zernio&&S.zernio.accountId;
 return head("Settings","")+
 '<section class="section" style="margin-top:0"><h2>Mode</h2><div class="seg" role="group" aria-label="Mode"><button data-mode="copilot" aria-pressed="'+(m.mode!=="autopilot")+'">Copilot</button><button data-mode="autopilot" aria-pressed="'+(m.mode==="autopilot")+'">Autopilot</button></div><p class="note" style="margin-top:10px">Copilot asks before every publish. Autopilot runs the workflow on its own'+(m.mode==="autopilot"?'; publishing is '+(m.autopublish?"pre-approved":"still approved by you")+'.':'.')+' Safety checks apply in both.</p>'+(m.mode==="autopilot"?'<label class="check"><input type="checkbox" id="autopub"'+(m.autopublish?" checked":"")+'><span>Pre-approve publishing in Autopilot</span></label>':"")+'</section>'+
 '<section class="section"><h2>Instagram account</h2><p class="note">'+(acct?'Selected: <strong>'+esc(acct)+'</strong>':'None selected.')+'</p><div id="acctBox" style="margin-top:10px">'+(accounts?acctSelect():'<button class="btn" id="loadAccts">Load accounts from Zernio</button>')+'</div></section>'+
 '<section class="section"><h2>Brand kit</h2><form id="brandForm" class="form"><label class="lbl" for="bVoice">Voice</label><textarea class="field" id="bVoice" maxlength="500">'+esc(b.voice||"")+'</textarea><label class="lbl" for="bAud">Audience</label><input class="field" id="bAud" maxlength="200" value="'+esc(b.audience||"")+'"><label class="lbl" for="bBan">Banned phrases (one per line)</label><textarea class="field" id="bBan">'+esc((b.banned_claims||[]).join("\n"))+'</textarea><label class="lbl" for="bDis">Required lines in every caption (one per line)</label><textarea class="field" id="bDis">'+esc((b.required_disclosures||[]).join("\n"))+'</textarea><p style="margin-top:14px"><button class="btn primary" type="submit">Save brand kit</button></p></form></section>'+
 '<section class="section"><h2>Claim ledger</h2><p class="note">Prices and popularity statistics are blocked unless a verified claim exists. Verified means you supplied an https evidence link.</p><div class="list" style="margin-top:8px">'+((S.claims||[]).map(c=>'<div class="row"><div><div class="t">'+esc(c.statement)+'</div>'+(c.evidence_url?'<div class="s"><a href="'+esc(c.evidence_url)+'" target="_blank" rel="noopener noreferrer">Evidence</a></div>':"")+'</div><span class="pill '+(c.status==="verified"?"ok":"")+'">'+esc(c.status)+'</span></div>').join("")||"")+'</div><form id="claimForm" class="form" style="margin-top:12px"><label class="lbl" for="cSt">Statement</label><input class="field" id="cSt" maxlength="300" required><label class="lbl" for="cUrl">Evidence link (https)</label><input class="field" id="cUrl" type="url" placeholder="https://"><p style="margin-top:14px"><button class="btn" type="submit">Add claim</button></p></form></section>'+
 '<section class="section"><h2>Gemini</h2><p class="note">Models are verified against your API key before use, not assumed.</p>'+(modelInfo?'<dl class="kv"><dt>Chat model</dt><dd>'+esc(modelInfo.chat)+'</dd><dt>Planning model</dt><dd>'+esc(modelInfo.plan)+'</dd><dt>Models on this key</dt><dd>'+esc(modelInfo.available)+'</dd></dl>':"")+'<p style="margin-top:12px"><button class="btn" id="checkModels">Verify models</button></p></section>'+
 '<section class="section"><h2>Session</h2><button class="btn" id="signout">Lock AttentionOS</button></section>';
}
function acctSelect(){const ig=accounts.filter(a=>a.platform==="instagram");if(!ig.length)return '<p class="note">No Instagram account is connected in Zernio.</p>';return '<select class="field" id="acctPick" style="max-width:320px">'+ig.map(a=>'<option value="'+esc(a.id)+'"'+(a.id===(S.zernio||{}).accountId?" selected":"")+'>@'+esc(a.username||a.id)+'</option>').join("")+'</select> <button class="btn" id="saveAcct" style="margin-left:8px">Use this account</button>'}

/* ---------- Events ---------- */
document.addEventListener("click",async e=>{
 const t=e.target.closest("[data-nav],[data-open-run],[data-render],[data-approve],[data-reject],[data-mode],[data-suggest],#fetchAnalytics,#learnBtn,#loadAccts,#saveAcct,#checkModels,#signout");if(!t)return;
 try{
  if(t.dataset.nav){go(t.dataset.nav);return}
  if(t.dataset.openRun){selRun=t.dataset.openRun;go("studio");return}
  if(t.dataset.render){await renderVideo(t.dataset.render,t);return}
  if(t.dataset.suggest){$("jarvisInput").value=t.dataset.suggest;$("jarvis").requestSubmit();return}
  if(t.dataset.approve){if(!confirm("Publish this Reel to Instagram now? This posts publicly."))return;t.disabled=true;await api("approve",{approvalId:t.dataset.approve,confirm:true});toast("Approved. Publishing now.");await refresh();return}
  if(t.dataset.reject){if(!confirm("Reject this Reel? It will not be published."))return;t.disabled=true;await api("reject",{approvalId:t.dataset.reject,confirm:true});await refresh();return}
  if(t.dataset.mode){await api("mode",{mode:t.dataset.mode});await refresh();return}
  if(t.id==="fetchAnalytics"){t.disabled=true;await api("analytics",{});analyticsSnap=null;toast("Analytics retrieved.");await loadAnalyticsLast();return}
  if(t.id==="learnBtn"){t.disabled=true;const d=await api("learn",{});toast(d.insights&&d.insights.length?d.insights.length+" insight(s) saved.":"No insights yet.");await refresh();return}
  if(t.id==="loadAccts"){t.disabled=true;accounts=(await api("accounts")).accounts;render();return}
  if(t.id==="saveAcct"){await api("settings",{accountId:$("acctPick").value});toast("Instagram account saved.");await refresh();return}
  if(t.id==="checkModels"){t.disabled=true;modelInfo=await api("models",{force:true});toast("Verified "+modelInfo.chat+" and "+modelInfo.plan+".");render();return}
  if(t.id==="signout"){lock();return}
 }catch(err){toast(err.message,true);if(t.disabled)t.disabled=false}
});
document.addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&e.target.matches&&e.target.matches(".row.link")){e.preventDefault();e.target.click()}});
document.addEventListener("change",e=>{
 if(e.target.id==="runPick"){selRun=e.target.value;runDetail=null;render()}
 if(e.target.id==="autopub"){const on=e.target.checked;if(on&&!confirm("Let Autopilot publish Reels without asking each time? Safety checks still apply."))return void(e.target.checked=false);api("mode",{mode:"autopilot",autopublish:on,confirm:true}).then(refresh).catch(err=>toast(err.message,true))}
});
document.addEventListener("submit",async e=>{
 const f=e.target;
 try{
  if(f.id==="ruleForm"){e.preventDefault();const confirmNow=$("rConfirm").checked;if(confirmNow&&!confirm("Create this rule in Instagram now?"))return;const d=await api("dm-rule",{keyword:$("rKey").value,dmMessage:$("rDm").value,commentReply:$("rReply").value,confirm:confirmNow});toast(d.activated?"Rule is active in Instagram.":"Rule saved, not active.");await refresh()}
  if(f.id==="brandForm"){e.preventDefault();const lines=id=>$(id).value.split("\n").map(x=>x.trim()).filter(Boolean);await api("brand",{voice:$("bVoice").value,audience:$("bAud").value,banned_claims:lines("bBan"),required_disclosures:lines("bDis")});toast("Brand kit saved.");await refresh()}
  if(f.id==="claimForm"){e.preventDefault();const d=await api("claim",{statement:$("cSt").value,evidenceUrl:$("cUrl").value});toast(d.note);await refresh()}
 }catch(err){toast(err.message,true)}
});

/* ---------- JARVIS ---------- */
const NAVMAP={open_agent:"agents",open_calendar:"studio",open_content:"studio",open_automations:"publish",show_analytics:"analytics",review_post:"publish",publish_now:"publish",upload_reel_media:"studio"};
function say(text,speak){$("jarvisReply").textContent=text;if(speak&&"speechSynthesis" in window&&text){try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text.slice(0,400));u.lang="en-GB";const v=speechSynthesis.getVoices().find(x=>/en-GB/i.test(x.lang)&&/male|daniel|george|google uk english male/i.test(x.name));if(v)u.voice=v;speechSynthesis.speak(u)}catch{}}}
async function chatIntent(text){
 const r=await fetch("/api/jarvis-chat",{method:"POST",headers:{"Content-Type":"application/json","x-owner-token":token},body:JSON.stringify({message:text,history:hist.slice(-8),context:{}})});
 const d=await r.json().catch(()=>({ok:false,error:"Unreadable response"}));
 if(!r.ok||d.ok===false)throw Error(d.error||"JARVIS could not answer");return d;
}
async function runCommand(text,fromVoice){
 if(busy){say("Still working on the last command.");return}
 busy=true;$("jarvisSend").disabled=true;
 try{
  say("Thinking…");
  const intent=await chatIntent(text);
  hist.push({role:"user",text},{role:"model",text:intent.reply||intent.action});
  if(intent.action==="research_products"||intent.action==="prepare_reel"||intent.action==="create_draft"){
   say("Running the agents. This can take up to a minute…");
   const d=await api("command",{goal:text,topic:intent.topic||"",source:fromVoice?"voice":"jarvis"});
   selRun=d.run.id;runDetail=null;await refresh();
   const c=d.content[0],last=d.events[d.events.length-1];
   let msg;
   if(d.run.status==="failed")msg="The workflow stopped: "+(d.run.error||"unknown error")+".";
   else if(d.run.status==="rendering")msg="Research, strategy and script are done"+(c?" ("+c.title+")":"")+". The video needs to be rendered in your browser. Opening Studio.";
   else msg="Started. "+(last?last.message:"")+" Check Studio for progress.";
   say(msg,fromVoice);go("studio");return;
  }
  if(NAVMAP[intent.action]){const dest=NAVMAP[intent.action];if(intent.action==="publish_now"||intent.action==="upload_reel_media")say("Publishing needs your approval in the Publish tab. I can't approve it for you.",fromVoice);else say(intent.reply||"Opening "+dest+".",fromVoice);go(dest);return}
  say(intent.reply||"I'm here. What should we work on?",fromVoice);
 }catch(e){say(e.message);toast(e.message,true)}
 finally{busy=false;$("jarvisSend").disabled=false}
}
$("jarvis").addEventListener("submit",e=>{e.preventDefault();const v=$("jarvisInput").value.trim();if(!v||!token)return;$("jarvisInput").value="";runCommand(v,e.submitter&&e.submitter.dataset&&e.submitter.dataset.voice==="1"||$("micBtn").dataset.fromVoice==="1");$("micBtn").dataset.fromVoice="0"});
(function mic(){
 const b=$("micBtn");b.innerHTML=ICON.mic;
 const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!SR){b.disabled=true;b.title="Voice input is not supported in this browser";b.setAttribute("aria-label","Voice input unavailable in this browser");return}
 let rec=null;
 b.onclick=()=>{
  if(rec){rec.stop();return}
  rec=new SR();rec.lang="en-IN";rec.interimResults=false;rec.maxAlternatives=1;
  b.setAttribute("aria-pressed","true");
  rec.onresult=ev=>{const t=ev.results[0][0].transcript;$("jarvisInput").value=t;b.dataset.fromVoice="1";$("jarvis").requestSubmit()};
  rec.onerror=ev=>{toast(ev.error==="not-allowed"?"Microphone permission was denied.":"Voice input stopped: "+ev.error,true)};
  rec.onend=()=>{rec=null;b.setAttribute("aria-pressed","false")};
  try{rec.start()}catch{rec=null;b.setAttribute("aria-pressed","false")}
 };
})();

/* While the app is open and jobs are queued, keep working them (Vercel cannot run a free always-on worker). */
let ticking=false;
setInterval(async()=>{
 if(!token||ticking||busy||document.hidden||!S||!(S.jobs||[]).length)return;
 ticking=true;try{await api("tick",{budgetMs:30000});await refresh()}catch{}finally{ticking=false}
},25000);

window.addEventListener("hashchange",()=>{if(token)go(location.hash.slice(1))});
(async function init(){await health();renderGate()})();
})();
