const crypto=require("node:crypto");
const fail=(res,status,error)=>res.status(status).json({ok:false,error});
function verified(a,b){const x=Buffer.from(String(a||"")),y=Buffer.from(String(b||""));return x.length>0&&x.length===y.length&&crypto.timingSafeEqual(x,y)}
module.exports=async(req,res)=>{
 res.setHeader("Cache-Control","no-store");
 res.setHeader("X-Content-Type-Options","nosniff");
 const configured=Boolean(process.env.VOICE_SERVER_URL&&process.env.VOICE_SERVER_TOKEN);
 if(req.method==="GET")return res.status(200).json({ok:true,configured,mode:"private-self-hosted",providers:["kokoro","omnivoice"],commercialProvider:"kokoro"});
 if(req.method!=="POST")return fail(res,405,"POST required");
 if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host)return fail(res,403,"Origin mismatch")}catch{return fail(res,403,"Origin mismatch")}}
 if(!verified(req.headers["x-owner-token"],process.env.ATTENTIONOS_OWNER_TOKEN))return fail(res,401,"Private owner authorization required");
 if(!configured)return fail(res,503,"Voice server is not configured. Set private VOICE_SERVER_URL and VOICE_SERVER_TOKEN on Vercel after hosting the model.");
 const b=req.body||{},text=typeof b.text==="string"?b.text.trim():"";
 if(!text||text.length>1200)return fail(res,400,"Voice text must contain 1 to 1200 characters.");
 const purpose=b.purpose==="commercial"?"commercial":b.purpose==="personal"?"personal":null;
 const provider=["auto","kokoro","omnivoice"].includes(b.provider)?b.provider:"auto";
 const voice=typeof b.voice==="string"?b.voice.slice(0,90):"";
 const speed=Number(b.speed??1);
 if(!purpose)return fail(res,400,"Select personal or commercial purpose.");
 if(provider==="omnivoice"&&purpose==="commercial")return fail(res,403,"Non-commercial OmniVoice weights cannot be used for TrendWale marketing.");
 if(!Number.isFinite(speed)||speed<.75||speed>1.3)return fail(res,400,"Speed must be between 0.75 and 1.30.");
 if(b.reference_wav_base64)return fail(res,400,"Reference voice cloning is supported by the private Python server only. Do not upload reference audio through Vercel.");
 let service;
 try{service=new URL(process.env.VOICE_SERVER_URL);if(service.protocol!=="https:"||service.username||service.password||service.search||service.hash)throw Error("not HTTPS")}catch{return fail(res,503,"Configure a secure HTTPS model endpoint; do not use a public unauthenticated voice service.")}
 if(!process.env.VOICE_SERVER_TOKEN)return fail(res,503,"Missing private voice-server secret.");
 const url=service.toString().replace(/\/$/,"")+"/v1/speak";
 const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),28000);
 try{
  const response=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+process.env.VOICE_SERVER_TOKEN},body:JSON.stringify({text,purpose,provider,voice,speed}),signal:ctrl.signal});
  const mime=response.headers.get("content-type")||"";
  if(!response.ok){
   const message=await response.text().catch(()=>"");
   let detail="";try{detail=JSON.parse(message).detail||""}catch{detail=message}
   return fail(res,response.status===401?502:response.status===403?403:502,"Speech engine unavailable: "+String(detail||"upstream error").slice(0,220));
  }
  if(!mime.includes("audio/wav"))return fail(res,502,"Speech engine did not return WAV audio");
  const length=Number(response.headers.get("content-length")||0);
  if(length>6_000_000)return fail(res,413,"Audio too large for this gateway");
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length<48||bytes.length>6_000_000||bytes.toString("ascii",0,4)!=="RIFF")return fail(res,502,"Speech engine response was not a valid WAV file");
  res.setHeader("Content-Type","audio/wav");
  res.setHeader("Content-Length",bytes.length);
  return res.status(200).send(bytes);
 }catch(e){return fail(res,502,e.name==="AbortError"?"Voice engine timed out. It may be loading model weights.":String(e.message||"Voice service unavailable").slice(0,190))}
 finally{clearTimeout(timeout)}
};