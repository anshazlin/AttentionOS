const {timingSafeEqual}=require('node:crypto');
const limited=(v,n=150)=>typeof v==='string'?v.trim().slice(0,n):'';
function deny(res,code,msg){return res.status(code).json({ok:false,error:msg})}
function same(a,b){a=Buffer.from(String(a||''));b=Buffer.from(String(b||''));return a.length>0&&a.length===b.length&&timingSafeEqual(a,b)}
function decode(s){return String(s||'').replace(/<!\[CDATA\[|\]\]>/g,'').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim()}
async function research(topic){
 const query=encodeURIComponent(topic+' India affordable products OR trends');
 const u='https://news.google.com/rss/search?q='+query+'&hl=en-IN&gl=IN&ceid=IN:en';
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),7500);
 try{const r=await fetch(u,{signal:ctrl.signal,headers:{'user-agent':'AttentionOS/1.0'}});if(!r.ok)throw Error('RSS '+r.status);const x=await r.text();return [...x.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0,8).map(m=>{let z=m[1],title=(z.match(/<title>([\s\S]*?)<\/title>/)||[])[1],link=(z.match(/<link>([\s\S]*?)<\/link>/)||[])[1],date=(z.match(/<pubDate>([\s\S]*?)<\/pubDate>/)||[])[1];return {title:decode(title).slice(0,200),url:decode(link).slice(0,900),published:decode(date).slice(0,70)}}).filter(a=>a.title&&a.url)}catch(e){return []}finally{clearTimeout(timer)}
}
function fallback(topic,brand,sources){
 const ideas=[topic+' under a budget',topic+' before-and-after comparison',topic+' quick buying guide'];
 const hooks=['Stop scrolling—here is a practical way to shop smarter.','Would you use this? Here are three things to check.','Before buying, compare these details first.'];
 return ideas.map((idea,i)=>({title:idea,hook:hooks[i],script:['0–2s: '+hooks[i],'2–6s: Show the actual product and its key feature.','6–11s: Demonstrate a real benefit without inventing results.','11–15s: Invite viewers to comment GUIDE for details.'].join('\n'),shotList:['Close-up product photo','Hands-on demonstration','Feature and material close-up','Price and CTA card (verify price first)'],caption:hooks[i]+' \nExploring '+idea+' with '+brand+'. Check product description, reviews, price and delivery before ordering. Comment GUIDE for details.',hashtags:'#BudgetFinds #AffordableShopping #IndiaShopping #'+brand.replace(/\W/g,''),cta:'Comment GUIDE for the product details.',sourceUrl:sources[i]?.url||''}))
}
async function aiPlan(topic,brand,sources){
 const key=process.env.GEMINI_API_KEY;if(!key)return null;
 const model=process.env.GEMINI_MODEL||'gemini-3.8-flash';
 const prompt='You are a careful social content strategist for '+brand+'. Produce JSON only (an object with an "ideas" array of EXACTLY 3 objects). Each object has title,hook,script,shotList (array of 4 brief filming instructions),caption,hashtags,cta,sourceUrl. Topic: '+topic+'. Audience: Indian budget shoppers. Public news/search leads (NOT verified viral products): '+JSON.stringify(sources).slice(0,4500)+'. Never assert prices, sales, reviews or virality without evidence. Include 15-second original filming scripts that can be made with products user actually owns or is allowed to use. CTA asks for consent (comment GUIDE for details). Source URL only from provided leads or empty. No fabricated competitors or metrics.';
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),20000);
 try{const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent',{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{responseMimeType:'application/json',temperature:0.7}}),signal:ctrl.signal});const x=await r.json();if(!r.ok)throw Error(limited(JSON.stringify(x.error||'Gemini error'),300));const raw=x.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'';const o=JSON.parse(raw);if(!Array.isArray(o.ideas)||o.ideas.length<3)throw Error('Invalid model output');return o.ideas.slice(0,3).map(it=>({title:limited(it.title,150),hook:limited(it.hook,270),script:limited(it.script,2400),shotList:Array.isArray(it.shotList)?it.shotList.slice(0,6).map(v=>limited(v,300)):[],caption:limited(it.caption,2200),hashtags:limited(it.hashtags,350),cta:limited(it.cta,180),sourceUrl:sources.some(s=>s.url===it.sourceUrl)?it.sourceUrl:''}))}catch(e){return {error:limited(e.message,300)}}finally{clearTimeout(timer)}
}
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host)return deny(res,403,'Origin mismatch')}catch{return deny(res,403,'Origin mismatch')}}
 if(req.method!=='POST')return deny(res,405,'POST only');
 if(!same(req.headers['x-owner-token'],process.env.ATTENTIONOS_OWNER_TOKEN))return deny(res,401,'Owner access required');
 let b=req.body||{},action=limited(b.action,24),accountId=limited(b.accountId,100);
 if(action==='plan'||action==='research'){
 const topic=limited(b.topic,250)||'budget lifestyle gadgets',brand=limited(b.brand,80)||'TrendWale';
 const sources=await research(topic);
 if(action==='research')return res.status(200).json({ok:true,sources,sourceType:'Google News RSS leads, not verified popularity or product sales',searchedAt:new Date().toISOString()});
 const ai=await aiPlan(topic,brand,sources);let ideas=Array.isArray(ai)?ai:fallback(topic,brand,sources);
 return res.status(200).json({ok:true,mode:Array.isArray(ai)?'gemini':'templates',aiError:ai?.error||null,ideas,sources,notice:Array.isArray(ai)?'AI-generated suggestions must be reviewed.':'Structured templates, not autonomous AI. Add a free-tier GEMINI_API_KEY to enable model writing.'});
 }
 if(action==='analytics'){
 if(!process.env.ZERNIO_API_KEY)return deny(res,503,'Zernio not configured');
 if(!/^[\w:-]{2,130}$/.test(accountId))return deny(res,400,'Invalid account ID');
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),12000);
 try{const path='https://zernio.com/api/v1/analytics?platform=instagram&accountId='+encodeURIComponent(accountId)+'&limit=25&source=all';
 const r=await fetch(path,{headers:{Authorization:'Bearer '+process.env.ZERNIO_API_KEY},signal:ctrl.signal});const d=await r.json().catch(()=>({error:'Analytics response not JSON'}));if(!r.ok)return deny(res,r.status===402?402:502,limited(d.error||d.message||'Zernio analytics error',400));return res.status(200).json({ok:true,analytics:d})}catch(e){return deny(res,502,limited(e.message,200))}finally{clearTimeout(timer)}
 }
 return deny(res,400,'Unknown action');
};