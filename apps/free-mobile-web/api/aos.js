const {timingSafeEqual}=require("node:crypto");
const db=require("../lib/db.js");
const A=require("../lib/agents.js");
const Q=require("../lib/queue.js");
const {resolveModel,listModels}=require("../lib/gemini.js");
const {zernio,idOk}=require("../lib/zernio.js");
const same=(a,b)=>{a=Buffer.from(String(a||""));b=Buffer.from(String(b||""));return a.length>0&&a.length===b.length&&timingSafeEqual(a,b)};
const out=(res,code,body)=>res.status(code).json(body);
const uuid=v=>/^[0-9a-f-]{36}$/i.test(String(v||""));
async function runDetail(id){
  const [run]=await db.select("aos_runs",db.eq("id",id));if(!run)return null;
  const [events,content,approvals,sources]=await Promise.all([
    db.select("aos_events","run_id=eq."+id+"&order=id.asc&limit=100"),
    db.select("aos_content","run_id=eq."+id+"&order=created_at.asc"),
    db.select("aos_approvals","run_id=eq."+id+"&order=created_at.desc"),
    db.select("aos_sources","run_id=eq."+id+"&limit=10"),
  ]);
  const media=content.length?await db.select("aos_media","content_id=in.("+content.map(c=>c.id).join(",")+")&order=created_at.desc"):[];
  const posts=content.length?await db.select("aos_posts","content_id=in.("+content.map(c=>c.id).join(",")+")&order=created_at.desc"):[];
  return {run,events,content,approvals,sources,media,posts};
}
module.exports=async(req,res)=>{
  res.setHeader("Cache-Control","no-store");res.setHeader("X-Content-Type-Options","nosniff");
  if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host)return out(res,403,{ok:false,error:"Invalid origin"})}catch{return out(res,403,{ok:false,error:"Invalid origin"})}}
  const action=String((req.method==="GET"?req.query?.action:req.body?.action)||"");
  // Public, non-sensitive readiness flags only.
  if(req.method==="GET"&&action==="health")return out(res,200,{ok:true,database:db.configured(),gemini:Boolean(process.env.GEMINI_API_KEY),zernio:Boolean(process.env.ZERNIO_API_KEY),owner:Boolean(process.env.ATTENTIONOS_OWNER_TOKEN),cron:Boolean(process.env.CRON_SECRET)});
  if(!process.env.ATTENTIONOS_OWNER_TOKEN)return out(res,503,{ok:false,error:"ATTENTIONOS_OWNER_TOKEN is not set in Vercel."});
  if(!same(req.headers["x-owner-token"],process.env.ATTENTIONOS_OWNER_TOKEN))return out(res,401,{ok:false,error:"Owner access code required."});
  if(!["GET","POST"].includes(req.method))return out(res,405,{ok:false,error:"Method not allowed"});
  const b=req.method==="POST"?(req.body||{}):(req.query||{});
  try{
    switch(action){
      case "state":{const s=await A.summary();const mode=await A.setting("mode");const z=await A.setting("zernio");const [brand,rules,learnings,events,jobs,content,approvals,posts,claims]=await Promise.all([A.brand(),db.select("aos_dm_rules","order=created_at.desc&limit=20"),db.select("aos_learnings","order=created_at.desc&limit=5"),db.select("aos_events","order=id.desc&limit=60"),db.select("aos_jobs","status=in.(queued,running)&select=agent,status"),db.select("aos_content","order=created_at.desc&limit=20"),db.select("aos_approvals","order=created_at.desc&limit=20"),db.select("aos_posts","order=created_at.desc&limit=20&select=id,content_id,provider_post_id,provider_status,created_at"),db.select("aos_claims","order=created_at.desc&limit=30")]);const ids=content.map(c=>c.id);const media=ids.length?await db.select("aos_media","content_id=in.("+ids.join(",")+")&order=created_at.desc"):[];return out(res,200,{ok:true,...s,mode,zernio:{accountId:z.accountId||""},brand,rules,learnings,events,jobs,content,media,approvals,posts,claims})}
      case "run":{if(!uuid(b.id))return out(res,400,{ok:false,error:"Invalid run id"});const d=await runDetail(b.id);return d?out(res,200,{ok:true,...d}):out(res,404,{ok:false,error:"Run not found"})}
      case "command":{
        const goal=String(b.goal||"").trim().slice(0,300);if(!goal)return out(res,400,{ok:false,error:"Tell JARVIS what to do."});
        const run=await Q.startRun({goal,topic:b.topic,source:b.source==="voice"?"voice":"jarvis"});
        const r=await Q.drain(b.budgetMs===0?0:Math.min(Number(b.budgetMs)||40000,45000));
        return out(res,200,{ok:true,drained:r,...(await runDetail(run.id))});
      }
      case "tick":{const r=await Q.drain(Math.min(Number(b.budgetMs)||45000,45000));return out(res,200,{ok:true,drained:r})}
      case "media":{if(!uuid(b.contentId))return out(res,400,{ok:false,error:"Invalid content id"});const r=await A.registerMedia({contentId:b.contentId,providerUrl:b.providerUrl,bytes:Number(b.bytes),durationS:Number(b.durationS)||null,caption:typeof b.caption==="string"?b.caption:undefined});return out(res,200,{ok:true,...r})}
      // Approval is a UI-only action: it needs the owner token AND an explicit confirm flag; voice/JARVIS code paths never call it.
      case "approve":case "reject":{if(!uuid(b.approvalId))return out(res,400,{ok:false,error:"Invalid approval id"});if(b.confirm!==true)return out(res,400,{ok:false,error:"Explicit confirmation required"});await A.decide(b.approvalId,action==="approve","owner");const r=await Q.drain(30000);return out(res,200,{ok:true,drained:r})}
      case "mode":{const mode=b.mode==="autopilot"?"autopilot":"copilot";const autopublish=mode==="autopilot"&&b.autopublish===true&&b.confirm===true;await db.upsert("aos_settings",{key:"mode",value:{mode,autopublish},updated_at:new Date().toISOString()},"key");return out(res,200,{ok:true,mode,autopublish})}
      case "settings":{if(!idOk(b.accountId))return out(res,400,{ok:false,error:"Invalid Instagram account ID"});await db.upsert("aos_settings",{key:"zernio",value:{accountId:b.accountId},updated_at:new Date().toISOString()},"key");return out(res,200,{ok:true})}
      case "brand":{const cur=await A.brand();const list=v=>Array.isArray(v)?v.map(x=>String(x).trim().slice(0,120)).filter(Boolean).slice(0,30):cur;const row={voice:String(b.voice??cur.voice).slice(0,500),audience:String(b.audience??cur.audience).slice(0,200),banned_claims:b.banned_claims?list(b.banned_claims):cur.banned_claims,required_disclosures:b.required_disclosures?list(b.required_disclosures):cur.required_disclosures,updated_at:new Date().toISOString()};if(cur.id)await db.patch("aos_brand_kit",db.eq("id",cur.id),row);return out(res,200,{ok:true})}
      case "claim":{const st=String(b.statement||"").trim().slice(0,300);if(!st)return out(res,400,{ok:false,error:"Statement required"});const url=String(b.evidenceUrl||"").slice(0,900);const status=/^https:\/\//.test(url)?"verified":"unverified";const [c]=await db.insert("aos_claims",{statement:st,evidence_url:url||null,status});return out(res,200,{ok:true,claim:c,note:status==="verified"?"Marked verified because an https evidence link was supplied. Check it yourself.":"Saved as unverified; it will not unlock prices or statistics."})}
      case "dm-rule":return out(res,200,{ok:true,...(await A.createDmRule({keyword:b.keyword,dmMessage:b.dmMessage,commentReply:b.commentReply,confirm:b.confirm===true}))});
      case "analytics":{const d=await A.fetchAnalytics();return out(res,200,{ok:true,analytics:d})}
      case "analytics-last":{const [r]=await db.select("aos_analytics","order=fetched_at.desc&limit=1");return out(res,200,{ok:true,snapshot:r||null})}
      case "learn":return out(res,200,{ok:true,...(await A.learn())});
      case "accounts":{const a=await zernio("/accounts");return out(res,200,{ok:true,accounts:(a.accounts||a.data||[]).map(x=>({id:x._id||x.id,platform:x.platform,username:x.username||x.name||""}))})}
      case "models":{const names=await listModels();const chat=await resolveModel("chat",{force:b.force===true});const plan=await resolveModel("plan",{force:b.force===true});return out(res,200,{ok:true,available:names.length,chat:chat.model,plan:plan.model,probes:[...chat.tried,...plan.tried]})}
      default:return out(res,400,{ok:false,error:"Unknown action"});
    }
  }catch(e){
    const code=e.code==="NO_DB"||e.code==="NO_KEY"||e.code==="NO_ZERNIO"?503:(e.status&&e.status>=400&&e.status<600?(e.status>=500?502:e.status):500);
    return out(res,code,{ok:false,error:String(e.message||"Request failed").slice(0,400)});
  }
};
