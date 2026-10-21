const db=require("./db.js");
const A=require("./agents.js");
// Drains queued jobs within a time budget. Safe to call concurrently: aos_claim_job uses FOR UPDATE SKIP LOCKED.
async function drain(budgetMs=40000){
  const end=Date.now()+budgetMs;let done=0,failed=0;
  while(Date.now()<end){
    const [job]=(await db.rpc("aos_claim_job"))||[];
    if(!job)break;
    try{
      const result=await A.dispatch(job);
      await db.patch("aos_jobs",db.eq("id",job.id),{status:"done",result,error:null,updated_at:new Date().toISOString()});done++;
    }catch(e){
      const final=e.final||job.attempts>=job.max_attempts;
      await db.patch("aos_jobs",db.eq("id",job.id),{status:final?"failed":"queued",error:String(e.message).slice(0,400),run_after:new Date(Date.now()+30000*job.attempts).toISOString(),updated_at:new Date().toISOString()});
      await A.log(job.run_id,job.agent,job.kind+" "+(final?"failed":"will retry")+": "+e.message,final?"error":"warn");
      if(final&&job.run_id){const [r]=await db.select("aos_runs",db.eq("id",job.run_id)+"&select=status");if(r&&!["failed","cancelled","published"].includes(r.status))await A.setRun(job.run_id,{status:"failed",error:String(e.message).slice(0,300)})}
      failed++;
    }
  }
  return {done,failed};
}
async function startRun({goal,topic,source="jarvis"}){
  const mode=await A.setting("mode");
  const [run]=await db.insert("aos_runs",{goal:String(goal).slice(0,300),topic:String(topic||"").slice(0,200),mode:mode.mode==="autopilot"?"autopilot":"copilot",source,status:"running"});
  await A.log(run.id,"chief_of_staff","Started: "+run.goal);
  await A.enqueue(run.id,"analyst","research",{topic:run.topic||"affordable useful home, fashion and gadget products"});
  return run;
}
module.exports={drain,startRun};
