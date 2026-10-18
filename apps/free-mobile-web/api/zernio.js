const {timingSafeEqual}=require("node:crypto");
const BASE="https://zernio.com/api/v1";
function json(res,status,error){return res.status(status).json({success:false,error})}
function tokenEq(a,b){const x=Buffer.from(String(a||"")),y=Buffer.from(String(b||""));return x.length===y.length&&timingSafeEqual(x,y)}
async function zernio(path,method="GET",body){const r=await fetch(BASE+path,{method,headers:{Authorization:"Bearer "+process.env.ZERNIO_API_KEY,"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{})});const v=await r.json().catch(()=>({}));if(!r.ok){const e=new Error(String(v.error||v.message||"Zernio error").slice(0,300));e.status=r.status;throw e}return v}
const oid=x=>/^[a-zA-Z0-9_:-]{2,130}$/.test(String(x||""));
module.exports=async function handler(req,res){
res.setHeader("Cache-Control","no-store");res.setHeader("X-Content-Type-Options","nosniff");
if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host)return json(res,403,"Wrong origin")}catch{return json(res,403,"Invalid origin")}}
if(req.method==="GET"&&req.query.action==="status")return res.status(200).json({ok:true,connected:Boolean(process.env.ZERNIO_API_KEY&&process.env.ATTENTIONOS_OWNER_TOKEN),mode:"requires-login"});
if(!["GET","POST"].includes(req.method))return json(res,405,"Method not allowed");
if(!process.env.ZERNIO_API_KEY||!process.env.ATTENTIONOS_OWNER_TOKEN)return json(res,503,"Configure ZERNIO_API_KEY and ATTENTIONOS_OWNER_TOKEN in Vercel.");
if(!tokenEq(req.headers["x-owner-token"],process.env.ATTENTIONOS_OWNER_TOKEN))return json(res,401,"Invalid owner access token");
const b=req.body||{};if(!b||typeof b!=="object"||Array.isArray(b))return json(res,400,"Invalid request body");
if(req.method==="GET" && req.query.action==="accounts"){try{const a=await zernio("/accounts");return res.status(200).json({ok:true,accounts:a.accounts||a.data||[]})}catch(e){return json(res,e.status||502,e.message)}}
if(req.method==="GET" && req.query.action==="automations"){try{const a=await zernio("/comment-automations");return res.status(200).json({ok:true,automations:a.automations||a.data||[]})}catch(e){return json(res,e.status||502,e.message)}}
if(req.method!=="POST")return json(res,405,"Method not allowed");
try {
let data;
switch(b.action||req.query.action){
case "accounts":data=await zernio("/accounts");break;
case "presign":{
 const filename=String(b.filename||"").replace(/[^a-zA-Z0-9._-]/g,"_").slice(0,140),contentType=String(b.contentType||"");
 const allowed=["image/jpeg","image/png","image/webp","video/mp4","video/quicktime","video/webm"];
 if(!filename||!allowed.includes(contentType)||!Number.isInteger(b.size)||b.size<1||b.size>300000000)return json(res,400,"Choose JPG, PNG, MP4, MOV or WebM file under 300 MB");
 data=await zernio("/media/presign","POST",{filename,contentType,size:b.size});break}
case "list-posts":{const account=String(b.accountId||"");if(!oid(account))return json(res,400,"Invalid account");data=await zernio("/posts?accountId="+encodeURIComponent(account)+"&limit=20");break}

case "automations":data=await zernio("/comment-automations");if(Array.isArray(data.automations)&&oid(b.accountId))data.automations=data.automations.filter(a=>a.accountId===b.accountId);break;
case "inbox":if(!oid(b.accountId))return json(res,400,"Select account");data=await zernio("/inbox/conversations?accountId="+b.accountId);break;
case "publish":
case "post":{
if(!oid(b.accountId))return json(res,400,"Select account");const content=String(b.content||b.caption||"").slice(0,2200),url=String(b.mediaUrl||"");
if(b.mode!=="draft"&&!/^https:\/\/[^\s]{1,2048}$/.test(url))return json(res,400,"Public HTTPS media URL required");
const kind=/\.(mp4|mov)(\?|#|$)/i.test(url)?"video":"image";
const request={content,platforms:[{platform:"instagram",accountId:b.accountId}]};if(url)request.mediaItems=[{type:kind,url}];
if(b.mode==="draft"){request.isDraft=true}else if(b.scheduledFor){const date=new Date(b.scheduledFor);if(!Number.isFinite(+date)||date<=new Date())return json(res,400,"Schedule must be in future");request.scheduledFor=date.toISOString();request.timezone="UTC"}
else if(b.publishNow===true||b.mode==="now")request.publishNow=true;else return json(res,400,"Explicit publishing confirmation required");
data=await zernio("/posts","POST",request);break}
case "automation":
case "create-automation":{
if(!oid(b.accountId))return json(res,400,"Select account");const keyword=String(b.keyword||(Array.isArray(b.keywords)?b.keywords[0]:"")||"").trim(),dmMessage=String(b.dmMessage||"").trim(),name=String(b.name||"Comment DM").slice(0,80);
if(!keyword||keyword.length>100||!dmMessage||dmMessage.length>1000||!["exact","word","contains"].includes(b.matchMode||"word"))return json(res,400,"Invalid rule fields");
let profileId=String(b.profileId||"");if(!oid(profileId)){const ac=await zernio("/accounts");const a=(ac.accounts||[]).find(a=>(a._id||a.id)===b.accountId&&a.platform==="instagram");profileId=String(a?.profileId?._id||a?.profileId||a?.profile?._id||"")}
if(!oid(profileId))return json(res,400,"Zernio Instagram profile ID missing. Check account permissions.");
const obj={profileId,accountId:b.accountId,name,trigger:"comment",keywords:[keyword],matchMode:b.matchMode||"word",dmMessage,isActive:true,repeatPolicy:{mode:"once"}};
if(b.commentReply)obj.commentReply=String(b.commentReply).slice(0,250);
data=await zernio("/comment-automations","POST",obj);break}
case "reply":{
if(!oid(b.conversationId)||!String(b.message||"").trim()||String(b.message).length>1000)return json(res,400,"Invalid reply");
data=await zernio("/inbox/conversations/"+b.conversationId+"/messages","POST",{message:String(b.message).trim()});break}
default:return json(res,400,"Invalid action");
}
return res.status(200).json({ok:true,success:true,data,postId:data.post?.id||data.postId||null,automationId:data.automation?.id||data.id||null});
}catch(e){return json(res,e.status&&e.status<500?e.status:502,e.message||"Zernio request failed")}
}