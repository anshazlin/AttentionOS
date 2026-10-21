// Logic test of the agent state machine against an in-memory PostgREST + stubbed Gemini/Zernio/RSS.
// This proves control flow and safety gates ONLY. It is NOT evidence that production integrations work.
const assert=require('node:assert/strict');
process.env.SUPABASE_URL='https://testproj.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='service-role-key-for-tests-only';
process.env.GEMINI_API_KEY='test-gemini';process.env.ZERNIO_API_KEY='test-zernio';
const T={};let seq=0;const uid=()=>'00000000-0000-4000-8000-'+String(++seq).padStart(12,'0');
const defaults={aos_jobs:()=>({status:'queued',attempts:0,max_attempts:3,run_after:new Date().toISOString(),created_at:new Date().toISOString()}),aos_approvals:()=>({status:'pending',created_at:new Date().toISOString()}),aos_content:()=>({created_at:new Date().toISOString()}),aos_media:()=>({created_at:new Date().toISOString()}),aos_runs:()=>({created_at:new Date().toISOString()}),aos_posts:()=>({created_at:new Date().toISOString()})};
T.aos_settings=[{key:'mode',value:{mode:'copilot',autopublish:false}},{key:'zernio',value:{accountId:'acct_test_1'}},{key:'gemini',value:{plan_model:'gemini-test-flash',chat_model:'gemini-test-flash',verified_at:new Date().toISOString()}}];
T.aos_brand_kit=[{id:uid(),brand:'TrendWale',handle:'@trendwalee',voice:'Practical',audience:'Indian budget shoppers',banned_claims:['guaranteed'],required_disclosures:['Check price and delivery before ordering'],hashtags_default:[]}];
const zPosts=[];let copyMode='good';
function filt(rows,qs){let r=rows.slice();for(const [k,v] of qs.entries()){if(['select','order','limit','on_conflict'].includes(k))continue;if(v.startsWith('eq.'))r=r.filter(x=>String(x[k])===v.slice(3));else if(v.startsWith('in.(')){const s=new Set(v.slice(4,-1).split(','));r=r.filter(x=>s.has(String(x[k])))}}
 if(qs.get('limit'))r=r.slice(0,+qs.get('limit'));return r}
global.fetch=async(url,opt={})=>{
 url=String(url);const body=opt.body?JSON.parse(opt.body):undefined;const ok=(j,s=200)=>({ok:s<300,status:s,text:async()=>JSON.stringify(j),json:async()=>j});
 if(url.includes('.supabase.co/rest/v1/')){
  const [p,qstr]=url.split('/rest/v1/')[1].split('?');const qs=new URLSearchParams(qstr||'');
  if(p==='rpc/aos_claim_job'){const j=(T.aos_jobs||[]).find(x=>x.status==='queued'&&Date.parse(x.run_after)<=Date.now());if(!j)return ok([]);j.status='running';j.attempts++;return ok([j])}
  T[p]=T[p]||[];
  if(opt.method==='POST'&&qs.get('on_conflict')){const k=qs.get('on_conflict');const ex=T[p].find(x=>x[k]===body[k]);if(ex)Object.assign(ex,body);else T[p].push(body);return ok([body])}
  if(opt.method==='POST'){const rows=(Array.isArray(body)?body:[body]).map(r=>({id:uid(),...(defaults[p]?defaults[p]():{}),...r}));if(p==='aos_posts'&&rows.some(r=>T[p].some(x=>x.idempotency_key===r.idempotency_key)))return ok({code:'23505',message:'duplicate key'},409);T[p].push(...rows);return ok(rows,201)}
  if(opt.method==='PATCH'){const m=filt(T[p],qs);m.forEach(r=>Object.assign(r,body));return ok(m)}
  let r=filt(T[p],qs);const ord=qs.get('order');if(ord){const [c,d]=ord.split('.');r.sort((a,b)=>(a[c]>b[c]?1:-1)*(d==='desc'?-1:1))}return ok(r);
 }
 if(url.includes('news.google.com'))return {ok:true,text:async()=>'<rss><channel><item><title>Compact desk organizers gain interest</title><link>https://example.org/a</link><pubDate>Mon, 19 Oct 2026</pubDate></item></channel></rss>'};
 if(url.includes('generativelanguage.googleapis.com')){
  if(opt.method!=='POST')return ok({models:[{name:'models/gemini-test-flash',supportedGenerationMethods:['generateContent']}]});
  const prompt=body.contents[0].parts[0].text;const t=x=>ok({candidates:[{content:{parts:[{text:JSON.stringify(x)}]}}]});
  if(/single word OK/.test(prompt))return ok({candidates:[{content:{parts:[{text:'OK'}]}}]});
  if(/Sources \(id/.test(prompt))return t({opportunities:[{angle:'Desk organizers under a small budget',why:'Public leads mention organizers',sourceUrl:'https://example.org/a'},{angle:'x',why:'y',sourceUrl:'https://evil.example/injected'}]});
  if(/Pick ONE/.test(prompt))return t({angle:'Desk organizers',hookStyle:'question',durationS:15,sourceUrl:'https://example.org/a',avoid:[]});
  if(/Return \{"title"/.test(prompt)){const bad=copyMode==='bad';return t({title:'Desk glow-up',hook:'Is your desk a mess?',script:'0-3s: Hook\n3-9s: Show organizer\n9-15s: Invite comments',shotList:['wide','close','hands','end card'],caption:bad?'Guaranteed to fix everything':'A tidy desk, a calmer day.',hashtags:'#TrendWale',cta:'Comment GUIDE'})}
  return t({});
 }
 if(url.includes('zernio.com/api/v1/posts')&&opt.method==='POST'){zPosts.push(body);return ok({post:{_id:'zp_'+zPosts.length,status:'published'}})}
 return ok({error:'unexpected '+url},404);
};
const Q=require('../lib/queue.js'),A=require('../lib/agents.js');
(async()=>{
 // 1. Pipeline stops at "rendering": no fake video.
 let run=await Q.startRun({goal:'Find a trending product and create a Reel',topic:'desk organizers'});
 let r=await Q.drain(5000);assert.equal(r.failed,0);
 run=T.aos_runs[0];assert.equal(run.status,'rendering');
 assert.equal(T.aos_sources.length,1);
 const c=T.aos_content[0];assert.equal(c.guard_passed,true);assert.match(c.caption,/Check price and delivery/);
 assert.equal(c.source_url,'https://example.org/a');
 const analystJob=T.aos_jobs.find(j=>j.agent==='analyst');assert.equal(analystJob.result.opportunities.every(o=>o.sourceUrl!=='https://evil.example/injected'),true);
 assert.equal(zPosts.length,0);
 // 2. Media registered -> approval pending, still nothing published.
 await assert.rejects(()=>A.registerMedia({contentId:c.id,providerUrl:'http://insecure',bytes:500000}),/HTTPS/);
 await assert.rejects(()=>A.registerMedia({contentId:c.id,providerUrl:'https://media.example/x.mp4',bytes:100}),/too small/);
 const m=await A.registerMedia({contentId:c.id,providerUrl:'https://media.example/x.mp4',bytes:900000,durationS:15});
 assert.equal(T.aos_runs[0].status,'awaiting_approval');assert.equal(zPosts.length,0);
 // 3. Publisher refuses without approval even if a job is forced in.
 await A.enqueue(run.id,'publisher','publish',{approvalId:m.approvalId,contentId:c.id});
 await Q.drain(3000);assert.equal(zPosts.length,0);assert.match(T.aos_jobs.at(-1).error,/no approved approval/);
 // 4. Approve -> exactly one provider post, status from provider.
 await A.decide(m.approvalId,true,'owner');await Q.drain(5000);
 assert.equal(zPosts.length,1);assert.equal(zPosts[0].platforms[0].accountId,'acct_test_1');assert.equal(T.aos_runs[0].status,'published');assert.equal(T.aos_posts[0].provider_post_id,'zp_1');
 // 5. Duplicate-publication prevention.
 await A.enqueue(run.id,'publisher','publish',{approvalId:m.approvalId,contentId:c.id});await Q.drain(3000);
 assert.equal(zPosts.length,1);
 // 6. Safety gate blocks banned claim; no approval, no media step.
 copyMode='bad';const before=T.aos_approvals.length;
 await Q.startRun({goal:'second',topic:'desk organizers'});await Q.drain(5000);
 const run2=T.aos_runs[1];assert.equal(run2.status,'failed');assert.match(run2.error,/Banned claim/);assert.equal(T.aos_approvals.length,before);
 // 7. Rejecting cancels without publishing.
 copyMode='good';T.aos_content.forEach(x=>x.caption='old '+x.caption);
 await Q.startRun({goal:'third',topic:'desk organizers'});await Q.drain(5000);
 const c3=T.aos_content.at(-1),m3=await A.registerMedia({contentId:c3.id,providerUrl:'https://media.example/y.mp4',bytes:900000});
 await A.decide(m3.approvalId,false,'owner');await Q.drain(3000);assert.equal(T.aos_runs[2].status,'cancelled');assert.equal(zPosts.length,1);
 console.log('PASS: pipeline stops at render, approval gate, provider-sourced status, duplicate guard, safety block, reject path (mocked logic test).');
})().catch(e=>{console.error(e);process.exit(1)});
