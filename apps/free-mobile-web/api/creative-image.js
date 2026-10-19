const crypto=require("node:crypto");
const no=(res,status,error)=>res.status(status).json({ok:false,error});
function equal(a,b){const x=Buffer.from(String(a||"")),y=Buffer.from(String(b||""));return x.length>0&&x.length===y.length&&crypto.timingSafeEqual(x,y)}
function checked(s){
 try{
  const u=new URL(s);
  if(u.protocol!=="https:"||!["images.pexels.com","upload.wikimedia.org"].includes(u.hostname)||u.port||u.username||u.password)return null;
  if(u.pathname.length>900||u.href.length>1600)return null;
  return u.toString();
 }catch{return null}
}
module.exports=async (req,res)=>{
 res.setHeader("Cache-Control","private, max-age=600");
 res.setHeader("X-Content-Type-Options","nosniff");
 if(req.method!=="POST")return no(res,405,"POST required");
 if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host)return no(res,403,"Origin mismatch")}catch{return no(res,403,"Origin mismatch")}}
 if(!equal(req.headers["x-owner-token"],process.env.ATTENTIONOS_OWNER_TOKEN))return no(res,401,"Private owner authentication required");
 const src=checked(req.body?.url);if(!src)return no(res,400,"Unapproved media host");
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),10000);
 try{
  const response=await fetch(src,{redirect:"error",headers:{"User-Agent":"AttentionOS/1.0 (private creative editor)","Accept":"image/jpeg,image/png,image/webp"},signal:ctrl.signal});
  if(!response.ok)return no(res,502,"Licensed photo download failed: HTTP "+response.status);
  const mime=response.headers.get("content-type")?.split(";")[0]||"";
  if(!["image/jpeg","image/png","image/webp"].includes(mime))return no(res,415,"Image MIME not supported");
  const advertised=Number(response.headers.get("content-length")||0);if(advertised>6_000_000)return no(res,413,"Choose a smaller photo (6 MB max)");
  const parts=[];let size=0;
  if(response.body?.getReader){
   const reader=response.body.getReader();
   while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>6_000_000){await reader.cancel();return no(res,413,"Photo exceeded 6 MB")}parts.push(Buffer.from(value))}
  }else{const b=Buffer.from(await response.arrayBuffer());size=b.length;if(size>6_000_000)return no(res,413,"Photo exceeds 6 MB");parts.push(b)}
  const result=Buffer.concat(parts);
  if(result.length<80)return no(res,502,"Image content was empty or corrupt");
  const jpg=result[0]===255&&result[1]===216;
  const png=result.toString("binary",1,4)==="PNG";
  const webp=result.toString("ascii",0,4)==="RIFF"&&result.toString("ascii",8,12)==="WEBP";
  if(!(jpg||png||webp))return no(res,502,"Media was not a valid JPEG, PNG, or WebP");
  res.setHeader("Content-Type",mime);
  res.setHeader("Content-Length",result.length);
  return res.status(200).send(result);
 }catch(e){return no(res,502,e.name==="AbortError"?"Image request timed out":"Image could not be retrieved: "+e.message)}
 finally{clearTimeout(timer)}
};