const crypto=require("node:crypto");
const MAX_QUERY=105;
const deny=(res,status,error)=>res.status(status).json({ok:false,error});
function owner(a,b){const x=Buffer.from(String(a||"")),y=Buffer.from(String(b||""));return x.length>0&&x.length===y.length&&crypto.timingSafeEqual(x,y)}
function clean(v,max=200){return String(v??"").replace(/<[^>]*>/g," ").replace(/&(?:amp|lt|gt|quot|nbsp);/g," ").replace(/\s+/g," ").trim().slice(0,max)}
const compatible=new Set(["CC0","CC0 1.0","CC BY 4.0","CC BY 3.0","CC BY 2.0","CC BY 2.5","CC BY 1.0","Public domain","PD","Public Domain Mark 1.0"]);
function validLicense(str){let s=clean(str,100);return compatible.has(s)||/^CC BY (?:[1-4](?:\.0)?)$/i.test(s)||/^CC0(?: 1\.0)?$/i.test(s)||/^Public domain$/i.test(s)}
function mediaAddress(raw){try{const u=new URL(raw);return u.protocol==="https:"&&["images.pexels.com","upload.wikimedia.org"].includes(u.hostname)&&u.username===""&&u.password===""?u.toString():null}catch{return null}}
async function jsonFetch(url,headers,signal){
 const r=await fetch(url,{headers:{Accept:"application/json","User-Agent":"AttentionOS/1.0 (copyright-aware licensed-media search)",...headers},signal});
 if(!r.ok)throw Error("Source HTTP "+r.status);
 return r.json();
}
async function pexels(query,signal){
 const key=process.env.PEXELS_API_KEY;if(!key)return [];
 const headers={Authorization:key};
 const q=encodeURIComponent(query);
 const images=await jsonFetch("https://api.pexels.com/v1/search?query="+q+"&per_page=12&orientation=portrait",headers,signal).catch(()=>({photos:[]}));
 const clips=await jsonFetch("https://api.pexels.com/v1/videos/search?query="+q+"&per_page=8&orientation=portrait",headers,signal).catch(()=>({videos:[]}));
 const photos=(images.photos||[]).map(p=>({id:"pexels-photo-"+p.id,kind:"image",src:mediaAddress(p.src?.portrait||p.src?.large||p.src?.original),preview:mediaAddress(p.src?.medium),title:clean(p.alt||query,150),credit:clean("Photo by "+(p.photographer||"Pexels contributor"),160),source:p.url||"https://www.pexels.com",license:"Pexels License",stock:true,exactProduct:false})).filter(x=>x.src);
 const videos=(clips.videos||[]).map(v=>{
  const files=(v.video_files||[]).filter(f=>f.file_type==="video/mp4"&&mediaAddress(f.link)&&f.width&&f.height);
  files.sort((a,b)=>Math.abs(720-a.width)+Math.abs(1280-a.height)-Math.abs(720-b.width)-Math.abs(1280-b.height));
  return {id:"pexels-video-"+v.id,kind:"video",src:mediaAddress(files[0]?.link),preview:mediaAddress(v.image),title:clean(query,150),credit:clean("Video by "+(v.user?.name||"Pexels contributor"),160),source:v.url||"https://www.pexels.com",license:"Pexels License",stock:true,exactProduct:false}
 }).filter(x=>x.src);
 return [...videos,...photos];
}
async function commons(query,signal){
 const params=new URLSearchParams({action:"query",generator:"search",gsrsearch:query,gsrnamespace:"6",gsrlimit:"40",prop:"imageinfo",iiprop:"url|extmetadata",iiurlwidth:"960",format:"json",formatversion:"2"});
 const data=await jsonFetch("https://commons.wikimedia.org/w/api.php?"+params,{},signal);
 const pages=(data.query?.pages||[]);
 return pages.flatMap(p=>{
  const ii=p.imageinfo?.[0];if(!ii)return [];
  const title=clean(p.title||"",200);
  if(!/\.(?:jpe?g|png|webp)$/i.test(title))return [];
  const license=clean(ii.extmetadata?.LicenseShortName?.value||ii.extmetadata?.License?.value||"",110);
  if(!validLicense(license))return [];
  const src=mediaAddress(ii.thumburl||ii.url),preview=mediaAddress(ii.thumburl||ii.url);
  if(!src)return [];
  const credit=clean(ii.extmetadata?.Artist?.value||ii.user||"Wikimedia Commons contributor",200);
  const source=ii.descriptionurl||"https://commons.wikimedia.org/wiki/"+encodeURIComponent(p.title.replace(/ /g,"_"));
  return [{id:"commons-"+p.pageid,kind:"image",src,preview,title,credit,source,license,stock:true,exactProduct:false}];
 });
}
module.exports=async (req,res)=>{
 res.setHeader("Cache-Control","no-store");
 res.setHeader("X-Content-Type-Options","nosniff");
 if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host)return deny(res,403,"Origin mismatch")}catch{return deny(res,403,"Origin mismatch")}}
 if(req.method==="GET")return res.status(200).json({ok:true,pexelsConfigured:Boolean(process.env.PEXELS_API_KEY),fallback:"Wikimedia Commons CC0/PD/CC BY images",commercialAttributionRequired:true});
 if(req.method!=="POST")return deny(res,405,"POST required");
 if(!owner(req.headers["x-owner-token"],process.env.ATTENTIONOS_OWNER_TOKEN))return deny(res,401,"Owner authentication required");
 const q=clean(req.body?.query||"",MAX_QUERY);
 if(q.length<3)return deny(res,400,"Describe the actual product (3–105 characters).");
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),11500);
 let items=[],via=[],errors=[];
 try{
  if(process.env.PEXELS_API_KEY){try{items.push(...await pexels(q,ctrl.signal));via.push("Pexels")}catch(e){errors.push("Pexels: "+e.message)}}
  if(items.filter(x=>x.kind==="image").length<4){
   const search=[q,q.replace(/\b(?:trending|viral|cheap|best|India|Meesho)\b/gi,"").trim()].filter(Boolean);
   for(const term of [...new Set(search)]){
    try{items.push(...await commons(term,ctrl.signal));via.push("Wikimedia Commons")}catch(e){errors.push("Wikimedia Commons: "+e.message)}
    if(items.length>=10)break;
   }
  }
  const seen=new Set();items=items.filter(x=>!seen.has(x.src)&&(seen.add(x.src),true)).slice(0,16);
  return res.status(200).json({ok:true,query:q,items,providers:[...new Set(via)],warnings:errors,notice:"These are licensed illustrative images/videos, NOT confirmed photos of the exact product. Verify product match before promotional publishing; preserve attribution for CC BY material."});
 }finally{clearTimeout(timer)}
};