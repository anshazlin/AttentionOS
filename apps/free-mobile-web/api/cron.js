// Daily scheduled run (Vercel Hobby cron limit). Vercel sends Authorization: Bearer $CRON_SECRET.
const {timingSafeEqual}=require("node:crypto");
const db=require("../lib/db.js");const Q=require("../lib/queue.js");const A=require("../lib/agents.js");
const same=(a,b)=>{a=Buffer.from(String(a||""));b=Buffer.from(String(b||""));return a.length>0&&a.length===b.length&&timingSafeEqual(a,b)};
module.exports=async(req,res)=>{
  res.setHeader("Cache-Control","no-store");
  if(!process.env.CRON_SECRET||!same(req.headers.authorization,"Bearer "+process.env.CRON_SECRET))return res.status(401).json({ok:false,error:"Unauthorized"});
  try{
    const report={};
    report.queue=await Q.drain(25000);
    try{report.learn=await A.learn()}catch(e){report.learnSkipped=String(e.message).slice(0,200)}
    return res.status(200).json({ok:true,...report});
  }catch(e){return res.status(500).json({ok:false,error:String(e.message).slice(0,300)})}
};
