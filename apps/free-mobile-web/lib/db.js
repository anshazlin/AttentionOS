// Server-only Supabase access (PostgREST) with the service role key. Never imported by browser code.
// RLS is enabled on every aos_ table with no anon policies, so only this server path can read/write.
function cfg(){
  const url=(process.env.SUPABASE_URL||"").replace(/\/$/,""),key=process.env.SUPABASE_SERVICE_ROLE_KEY||"";
  if(!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url)||key.length<20){const e=new Error("Database not configured: add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to Vercel env.");e.code="NO_DB";throw e}
  return {url,key};
}
async function call(path,{method="GET",body,prefer}={}){
  const {url,key}=cfg();
  const r=await fetch(url+"/rest/v1/"+path,{method,headers:{apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json",...(prefer?{Prefer:prefer}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
  const text=await r.text();let data=null;try{data=text?JSON.parse(text):null}catch{data=text}
  if(!r.ok){const e=new Error("DB "+r.status+": "+String(data?.message||data||"error").slice(0,240));e.status=r.status;e.dbCode=data?.code;throw e}
  return data;
}
const q=v=>encodeURIComponent(v);
module.exports={
  configured:()=>{try{cfg();return true}catch{return false}},
  select:(table,query="")=>call(table+(query?"?"+query:"")),
  insert:async(table,row)=>(await call(table,{method:"POST",body:row,prefer:"return=representation"})),
  patch:async(table,match,row)=>(await call(table+"?"+match,{method:"PATCH",body:row,prefer:"return=representation"})),
  upsert:async(table,row,onConflict)=>(await call(table+"?on_conflict="+onConflict,{method:"POST",body:row,prefer:"resolution=merge-duplicates,return=representation"})),
  rpc:(fn,args={})=>call("rpc/"+fn,{method:"POST",body:args}),
  eq:(col,val)=>col+"=eq."+q(val),
  event:async(runId,agent,message,level="info",data=null)=>{try{await call("aos_events",{method:"POST",body:{run_id:runId||null,agent,level,message:String(message).slice(0,500),data}})}catch{}},
};
