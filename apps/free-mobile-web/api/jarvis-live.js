const crypto=require("node:crypto");
function bad(res,code,error){return res.status(code).json({ok:false,error})}
function eq(a,b){const x=Buffer.from(String(a||"")),y=Buffer.from(String(b||""));return x.length>0&&x.length===y.length&&crypto.timingSafeEqual(x,y)}
module.exports=async(req,res)=>{
 res.setHeader("Cache-Control","no-store");
 if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host)return bad(res,403,"Invalid origin")}catch{return bad(res,403,"Invalid origin")}}
 if(req.method!=="POST")return bad(res,405,"POST required");
 if(!eq(req.headers["x-owner-token"],process.env.ATTENTIONOS_OWNER_TOKEN))return bad(res,401,"Owner access code required");
 if(!process.env.GEMINI_API_KEY)return bad(res,503,"Add GEMINI_API_KEY in Vercel to use natural Gemini audio.");
 const model=process.env.GEMINI_LIVE_MODEL||"gemini-3.8-live";
 const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),12000);
 try{
  const d={
   uses:1,
   expireTime:new Date(Date.now()+15*60000).toISOString(),
   newSessionExpireTime:new Date(Date.now()+60000).toISOString(),
   liveConnectConstraints:{model:"models/"+model,config:{responseModalities:["AUDIO"]}}
  };
  const r=await fetch("https://generativelanguage.googleapis.com/v1beta/auth_tokens",{method:"POST",headers:{"x-goog-api-key":process.env.GEMINI_API_KEY,"Content-Type":"application/json"},body:JSON.stringify(d),signal:ctrl.signal});
  const j=await r.json().catch(()=>({}));
  if(!r.ok)return bad(res,502,"Gemini Live token rejected (HTTP "+r.status+"): "+String(j.error?.message||"Live unavailable").slice(0,240));
  if(!j.name)return bad(res,502,"Gemini Live did not return a session token.");
  res.status(200).json({ok:true,token:j.name,model,expiresInSeconds:60});
 }catch(e){return bad(res,502,e.name==="AbortError"?"Gemini Live token timed out.":String(e.message||"Live token failed").slice(0,180))}finally{clearTimeout(timeout)}
};