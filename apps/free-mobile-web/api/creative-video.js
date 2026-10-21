const crypto=require("node:crypto");
const fail=(res,code,error)=>res.status(code).json({ok:false,error});
const MAX_BYTES=3_250_000; // Vercel response limits require short/small video previews.
function isOwner(given,expected){const a=Buffer.from(String(given||"")),b=Buffer.from(String(expected||""));return a.length>0&&a.length===b.length&&crypto.timingSafeEqual(a,b)}
function safeUrl(raw){
 try{const u=new URL(raw);if(u.protocol!=="https:"||u.port||u.username||u.password||u.href.length>1800)return null;
  if(!["videos.pexels.com","upload.wikimedia.org"].includes(u.hostname))return null;
  if(!/\.(mp4|webm|ogv)$/i.test(u.pathname))return null;
  return u.toString()}catch{return null}
}
module.exports=async(req,res)=>{
 res.setHeader("Cache-Control","private, max-age=120");
 res.setHeader("X-Content-Type-Options","nosniff");
 if(req.method!=="POST")return fail(res,405,"POST required");
 if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host)return fail(res,403,"Invalid origin")}catch{return fail(res,403,"Invalid origin")}}
 if(!isOwner(req.headers["x-owner-token"],process.env.ATTENTIONOS_OWNER_TOKEN))return fail(res,401,"Owner access required");
 const url=safeUrl(req.body?.url);if(!url)return fail(res,400,"Unapproved video URL");
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),11000);
 try{
  const r=await fetch(url,{redirect:"error",headers:{"User-Agent":"AttentionOS private creator studio","Accept":"video/mp4,video/webm,video/ogg"},signal:ctrl.signal});
  if(!r.ok)return fail(res,502,"Video source responded HTTP "+r.status);
  const mime=String(r.headers.get("content-type")||"").split(";")[0];
  if(!["video/mp4","video/webm","video/ogg","application/ogg"].includes(mime))return fail(res,415,"Source is not a supported video file");
  const len=Number(r.headers.get("content-length")||0);
  if(len>MAX_BYTES)return fail(res,413,"This stock clip is too large for free proxying; choose a shorter clip or add your own video.");
  let size=0,parts=[];
  if(r.body?.getReader){const reader=r.body.getReader();for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BYTES){await reader.cancel();return fail(res,413,"Stock clip exceeds 3.2 MB limit")}parts.push(Buffer.from(value))}}
  else{const b=Buffer.from(await r.arrayBuffer());size=b.length;if(size>MAX_BYTES)return fail(res,413,"Stock clip too large");parts=[b]}
  const data=Buffer.concat(parts);
  if(data.length<500)return fail(res,502,"Empty stock video");
  const mp4=data.toString("ascii",4,8)==="ftyp",webm=data[0]===0x1a&&data[1]===0x45&&data[2]===0xdf&&data[3]===0xa3;
  const ogg=data.toString("ascii",0,4)==="OggS";
  if(!mp4&&!webm&&!ogg)return fail(res,502,"Video format signature invalid");
  res.setHeader("Content-Type",mp4?"video/mp4":webm?"video/webm":"video/ogg");
  res.setHeader("Content-Length",data.length);
  return res.status(200).send(data);
 }catch(e){return fail(res,502,e.name==="AbortError"?"Video download timed out.":"Could not retrieve licensed clip: "+e.message)}
 finally{clearTimeout(timer)}
};