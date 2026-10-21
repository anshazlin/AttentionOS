const crypto=require("node:crypto");
function error(res,status,message){return res.status(status).json({ok:false,error:message})}
function check(a,b){
 const left=Buffer.from(String(a||"")),right=Buffer.from(String(b||""));
 return left.length>0 && left.length===right.length && crypto.timingSafeEqual(left,right);
}
module.exports=async(req,res)=>{
 res.setHeader("Cache-Control","no-store");
 res.setHeader("X-Content-Type-Options","nosniff");
 if(req.headers.origin){
  try{if(new URL(req.headers.origin).host!==req.headers.host)return error(res,403,"Invalid origin")}
  catch{return error(res,403,"Invalid origin")}
 }
 if(req.method!=="POST")return error(res,405,"POST required");
 if(!check(req.headers["x-owner-token"],process.env.ATTENTIONOS_OWNER_TOKEN))return error(res,401,"Owner access code required");
 if(!process.env.GEMINI_API_KEY)return error(res,503,"Gemini API key is not configured.");
 const model=process.env.GEMINI_LIVE_MODEL||"gemini-3.8-live";
 const tokenSpec={
  uses:1,
  expireTime:new Date(Date.now()+15*60000).toISOString(),
  newSessionExpireTime:new Date(Date.now()+60000).toISOString()
 };
 const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),12000);
 try{
  // v1beta supports short-lived tokens without liveConnectConstraints.
  // The removed liveConnectConstraints field causes HTTP 400 on some supported deployments.
  // Legacy CreateAuthTokenRequest versions require the same config inside authToken.
  const payloads=[tokenSpec,{authToken:tokenSpec}];
  for(let i=0;i<payloads.length;i++){
   const response=await fetch("https://generativelanguage.googleapis.com/v1beta/auth_tokens",{
    method:"POST",
    headers:{"x-goog-api-key":process.env.GEMINI_API_KEY,"Content-Type":"application/json"},
    body:JSON.stringify(payloads[i]),
    signal:ctrl.signal
   });
   const data=await response.json().catch(()=>({}));
   if(response.ok){
    const token=data.name||data.authToken?.name;
    if(typeof token!=="string"||!token)return error(res,502,"Gemini returned an empty Live session token.");
    return res.status(200).json({ok:true,token,model,expiresInSeconds:60});
   }
   const message=String(data.error?.message||"Live token service rejected the request").slice(0,240);
   const schemaMismatch=response.status===400 && /(?:Unknown name|unknown field|authToken|missing required field|Invalid JSON payload)/i.test(message);
   if(i===0 && schemaMismatch)continue;
   return error(res,502,"Gemini Live token rejected (HTTP "+response.status+"): "+message);
  }
  return error(res,502,"Gemini Live token unavailable.");
 }catch(e){
  return error(res,502,e.name==="AbortError"?"Gemini Live token request timed out.":String(e.message||"Live token request failed").slice(0,180))
 }finally{clearTimeout(timeout)}
};