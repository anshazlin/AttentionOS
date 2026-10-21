// Gemini access with VERIFIED model selection. We never trust a hardcoded model id:
// list models for the key, filter to generateContent, then probe candidates in preference order.
const db=require("./db.js");
const BASE="https://generativelanguage.googleapis.com/v1beta";
const key=()=>process.env.GEMINI_API_KEY||"";
async function listModels(){
  if(!key())throw Object.assign(new Error("GEMINI_API_KEY missing in Vercel env."),{code:"NO_KEY"});
  const r=await fetch(BASE+"/models?pageSize=200",{headers:{"x-goog-api-key":key()}});
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw Object.assign(new Error("Gemini models list failed "+r.status+": "+String(j.error?.message||"").slice(0,200)),{status:r.status});
  return (j.models||[]).filter(m=>(m.supportedGenerationMethods||[]).includes("generateContent")).map(m=>m.name.replace(/^models\//,""));
}
function rank(name,kind){
  // text-only generation models; exclude image/audio/tts/live/embedding/robotics variants.
  if(/(image|tts|audio|live|embedding|robotics|computer-use|veo|imagen|native)/i.test(name))return -1;
  const v=Number((/gemini-(\d+(?:\.\d+)?)/i.exec(name)||[])[1]||0);
  const tier=/pro/i.test(name)?3:/lite/i.test(name)?1:/flash/i.test(name)?2:0;
  const stable=/(preview|exp)/i.test(name)?0:0.5; // prefer stable over preview at equal version
  // "plan" (strategy/copy) prefers quality: pro>flash>lite. "chat" prefers speed: flash>lite>pro.
  const t=kind==="plan"?tier:(tier===2?3:tier===1?2:tier===3?1:0);
  return v*10+t*3+stable;
}
async function probe(model){
  const r=await fetch(BASE+"/models/"+encodeURIComponent(model)+":generateContent",{method:"POST",headers:{"x-goog-api-key":key(),"Content-Type":"application/json"},body:JSON.stringify({contents:[{parts:[{text:"Reply with the single word OK"}]}],generationConfig:{maxOutputTokens:8}})});
  const j=await r.json().catch(()=>({}));
  return {ok:r.ok,status:r.status,message:String(j.error?.message||"").slice(0,200)};
}
// Returns {model, tried:[{model,ok,status,message}]}; caches the verified id in aos_settings for 6h.
async function resolveModel(kind="plan",{force=false}={}){
  const envPin=kind==="chat"?process.env.GEMINI_CHAT_MODEL:process.env.GEMINI_MODEL;
  let cached=null;
  if(!force&&db.configured()){try{const [row]=await db.select("aos_settings","key=eq.gemini&select=value");const v=row?.value;if(v?.[kind+"_model"]&&Date.now()-Date.parse(v.verified_at||0)<6*3600e3)cached=v[kind+"_model"]}catch{}}
  if(cached)return {model:cached,tried:[],cached:true};
  const names=await listModels();
  const ordered=names.map(n=>[n,rank(n,kind)]).filter(x=>x[1]>=0).sort((a,b)=>b[1]-a[1]).map(x=>x[0]);
  const candidates=[...(envPin&&names.includes(envPin)?[envPin]:[]),...ordered].filter((n,i,a)=>a.indexOf(n)===i).slice(0,6);
  const tried=[];
  for(const m of candidates){
    const p=await probe(m);tried.push({model:m,...p});
    if(p.ok){
      if(db.configured()){try{const [row]=await db.select("aos_settings","key=eq.gemini&select=value");const v={...(row?.value||{}),[kind+"_model"]:m,verified_at:new Date().toISOString()};await db.upsert("aos_settings",{key:"gemini",value:v,updated_at:new Date().toISOString()},"key")}catch{}}
      return {model:m,tried,cached:false};
    }
  }
  throw Object.assign(new Error("No Gemini model usable with this key. "+(tried[0]?tried[0].status+" "+tried[0].message:"No candidates listed.")),{code:"NO_MODEL",tried});
}
// Tool-less generation. Output is parsed as JSON and validated by the caller's `validate`.
async function generateJSON({kind="plan",system,prompt,validate,timeoutMs=45000,temperature=0.6}){
  const {model}=await resolveModel(kind);
  const ctrl=new AbortController(),t=setTimeout(()=>ctrl.abort(),timeoutMs);
  try{
    const r=await fetch(BASE+"/models/"+encodeURIComponent(model)+":generateContent",{method:"POST",signal:ctrl.signal,headers:{"x-goog-api-key":key(),"Content-Type":"application/json"},body:JSON.stringify({...(system?{systemInstruction:{parts:[{text:system}]}}:{}),contents:[{role:"user",parts:[{text:prompt}]}],generationConfig:{responseMimeType:"application/json",temperature,maxOutputTokens:3000}})});
    const j=await r.json().catch(()=>({}));
    if(!r.ok){if(r.status===404||r.status===429)await resolveModel(kind,{force:true}).catch(()=>{});throw Object.assign(new Error("Gemini "+r.status+": "+String(j.error?.message||"").slice(0,200)),{status:r.status})}
    const raw=j.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("")||"";
    let parsed;try{parsed=JSON.parse(raw)}catch{throw new Error("Gemini returned non-JSON output")}
    const out=validate?validate(parsed):parsed;
    return {data:out,model};
  }finally{clearTimeout(t)}
}
module.exports={listModels,resolveModel,generateJSON,rank};
