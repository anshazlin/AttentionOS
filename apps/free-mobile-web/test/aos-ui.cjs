// Real Chromium UI test. The /api/* layer is MOCKED, so this proves UI behaviour, layout and safety gates in the browser.
// It is NOT evidence that Supabase, Gemini or Zernio work in production.
const assert=require('node:assert/strict');
const http=require('node:http');const fs=require('node:fs');const path=require('node:path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css'};
const server=http.createServer((q,r)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';const f=path.join(root,p);if(f.startsWith(root)&&fs.existsSync(f)&&fs.statSync(f).isFile()){r.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream'});return r.end(fs.readFileSync(f))}r.writeHead(404);r.end('nf')});
const RUN='11111111-1111-4111-8111-111111111111',C1='22222222-2222-4222-8222-222222222222',AP='33333333-3333-4333-8333-333333333333';
const now=new Date().toISOString();
const XSS='<img src=x onerror="window.__xss=1">';
const state={ok:true,runs:[{id:RUN,goal:'Find a trending product and create a Reel',topic:'desk organizers',status:'awaiting_approval',created_at:now}],pendingApprovals:[],failed:[],mode:{mode:'copilot',autopublish:false},zernio:{accountId:'acct1'},brand:{voice:'Practical',audience:'Indian budget shoppers',banned_claims:['guaranteed'],required_disclosures:['Check price and delivery before ordering']},rules:[],learnings:[{id:'l1',insight:'Posts with a question hook earned more saves.'}],events:[{id:1,run_id:RUN,agent:'analyst',level:'info',message:'Found 3 public leads',created_at:now}],jobs:[],content:[{id:C1,run_id:RUN,title:XSS,hook:'Is your desk a mess?',script:'0-3s: Hook',shot_list:['wide','close'],caption:'A tidy desk.',hashtags:'#TrendWale',cta:'Comment GUIDE',guard_passed:true,guard_report:{issues:[],warnings:[]},created_at:now}],media:[{id:'m1',content_id:C1,provider_url:'https://media.example/x.mp4',bytes:900000,created_at:now}],approvals:[{id:AP,run_id:RUN,content_id:C1,action:'publish',status:'pending',created_at:now}],posts:[],claims:[{id:'c1',statement:'Organizer is made of ABS plastic',evidence_url:'https://example.org/spec',status:'verified'}]};
const detail={ok:true,run:state.runs[0],events:state.events,content:state.content,approvals:state.approvals,sources:[{id:'s1',title:'Desk organizers gain interest',url:'https://example.org/a',published:'Mon, 19 Oct 2026'}],media:state.media,posts:[]};
(async()=>{
 await new Promise(r=>server.listen(0,r));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{});
 const calls=[];let intent={ok:true,reply:'',action:'research_products',topic:'desk organizers'};
 async function newPage(vp,mobile){
  const ctx=await browser.newContext({viewport:vp,isMobile:!!mobile,hasTouch:!!mobile,deviceScaleFactor:2});
  const page=await ctx.newPage();const errors=[];
  page.on('pageerror',e=>errors.push('pageerror: '+e.message));
  page.on('console',m=>{if(m.type()==='error'&&!/media\.example/.test(m.location().url||''))errors.push('console: '+m.text())});
  await page.route('https://media.example/**',r=>r.abort());
  await page.route('**/api/**',async r=>{
   const u=new URL(r.request().url());const a=u.searchParams.get('action');const h=r.request().headers();const body=r.request().postData()?JSON.parse(r.request().postData()):null;
   calls.push({path:u.pathname,action:a,token:h['x-owner-token'],body});
   const send=(j,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(j)});
   if(u.pathname==='/api/jarvis-chat')return send(intent);
   if(a==='health')return send({ok:true,database:true,gemini:true,zernio:true,owner:true,cron:true});
   if(h['x-owner-token']!=='correct-code')return send({ok:false,error:'Owner access code required.'},401);
   if(a==='state')return send(state);
   if(a==='run')return send(detail);
   if(a==='command')return send({ok:true,drained:{done:4,failed:0},...detail,run:{...detail.run,status:'rendering'}});
   if(a==='approve'||a==='reject')return send({ok:true});
   if(a==='analytics-last')return send({ok:true,snapshot:{fetched_at:now,payload:{posts:[{caption:'Desk',likes:41,comments:3,reach:1200}]}}});
   return send({ok:true});
  });
  await page.goto(base+'/');return {page,errors,ctx};
 }
 const login=async(page,code)=>{await page.fill('#gateCode',code);await page.click('#gateForm button')};
 // 1. Gate: wrong code rejected, right code accepted, nothing stored in the browser.
 let {page,errors,ctx}=await newPage({width:1280,height:800});
 await page.waitForSelector('#gateCode');
 await login(page,'wrong');await page.waitForSelector('#gateErr:not(:empty)');
 assert.match(await page.textContent('#gateErr'),/code/i);
 {const i=errors.findIndex(e=>/status of 401/.test(e));assert.ok(i>=0,'wrong code should have produced a 401');errors.splice(i,1)} // the one expected error: the deliberate wrong-code attempt
 await login(page,'correct-code');await page.waitForSelector('[data-nav="agents"]');
 const storage=await page.evaluate(()=>JSON.stringify([localStorage,sessionStorage,document.cookie]));
 assert.equal(/correct-code/.test(storage),false,'owner code must not be persisted');
 // 2. All six areas render, no overflow, no console errors, XSS inert.
 const names=['overview','agents','studio','publish','analytics','settings'];
 async function sweep(label){
  for(const n of names){await page.click('[data-nav="'+n+'"]');await page.waitForSelector('.view');await page.waitForTimeout(250);
   const o=await page.evaluate(()=>({sw:document.documentElement.scrollWidth,iw:window.innerWidth}));
   assert.ok(o.sw<=o.iw+1,label+' '+n+' overflows horizontally ('+o.sw+' > '+o.iw+')');}
 }
 await sweep('desktop');
 assert.equal(await page.evaluate(()=>window.__xss),undefined,'XSS payload executed');
 assert.equal(await page.isVisible('#reelStudio'),false);
 await page.click('[data-nav="overview"]');await page.waitForTimeout(300);await page.screenshot({path:path.join(__dirname,'shot-desktop-overview.png')});
 await page.click('[data-nav="publish"]');await page.waitForTimeout(300);await page.screenshot({path:path.join(__dirname,'shot-desktop-publish.png')});
 // 3. JARVIS runs a real workflow call (not just text) and lands in Studio.
 await page.fill('#jarvisInput','Find a trending product and create a Reel');await page.click('#jarvisSend');
 await page.waitForFunction(()=>/rendered in your browser/.test(document.getElementById('jarvisReply').textContent));
 const cmd=calls.find(c=>c.action==='command');assert.ok(cmd,'JARVIS must call the workflow endpoint');assert.equal(cmd.token,'correct-code');assert.equal(cmd.body.topic,'desk organizers');
 assert.equal(await page.getAttribute('[data-nav="studio"]','aria-current'),'page');
 // 4. Speech/text can never publish: publish_now only navigates; no approve call.
 intent={ok:true,reply:'',action:'publish_now',topic:''};const before=calls.filter(c=>c.action==='approve').length;
 await page.fill('#jarvisInput','post it now');await page.click('#jarvisSend');
 await page.waitForFunction(()=>/needs your approval/.test(document.getElementById('jarvisReply').textContent));
 assert.equal(calls.filter(c=>c.action==='approve').length,before);
 // 5. Approval needs explicit confirmation in the UI.
 await page.click('[data-nav="publish"]');await page.waitForSelector('[data-approve]');
 page.once('dialog',d=>d.dismiss());await page.click('[data-approve]');await page.waitForTimeout(200);
 assert.equal(calls.filter(c=>c.action==='approve').length,0,'dismissed confirm must not approve');
 page.once('dialog',d=>d.accept());await page.click('[data-approve]');await page.waitForTimeout(300);
 const ap=calls.find(c=>c.action==='approve');assert.ok(ap&&ap.body.confirm===true&&ap.body.approvalId===AP);
 assert.deepEqual(errors,[],'desktop console errors: '+errors.join(' | '));
 await ctx.close();
 // 6. Android-size layout.
 ({page,errors,ctx}=await newPage({width:390,height:844},true));
 await page.waitForSelector('#gateCode');await login(page,'correct-code');await page.waitForSelector('[data-nav="agents"]');
 await sweep('mobile');
 for(const n of names){await page.click('[data-nav="'+n+'"]');await page.waitForTimeout(250);
  const clash=await page.evaluate(()=>{const j=document.getElementById('jarvis').getBoundingClientRect(),n=document.getElementById('nav').getBoundingClientRect();return j.bottom>n.top+1});
  assert.equal(clash,false,'JARVIS bar overlaps the bottom nav on '+n);}
 await page.click('[data-nav="overview"]');await page.waitForTimeout(300);await page.screenshot({path:path.join(__dirname,'shot-mobile-overview.png')});
 await page.click('[data-nav="publish"]');await page.waitForTimeout(300);await page.screenshot({path:path.join(__dirname,'shot-mobile-publish.png')});
 assert.deepEqual(errors,[],'mobile console errors: '+errors.join(' | '));
 await browser.close();server.close();
 console.log('PASS: owner gate, 6 areas at 1280px and 390px without overflow or console errors, JARVIS calls workflow, voice/text cannot approve, approval needs confirm, XSS inert (API mocked).');
})().catch(e=>{console.error(e);process.exit(1)});
