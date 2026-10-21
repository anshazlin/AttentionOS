const BASE="https://zernio.com/api/v1";
async function zernio(path,method="GET",body){
  if(!process.env.ZERNIO_API_KEY)throw Object.assign(new Error("ZERNIO_API_KEY missing in Vercel env."),{code:"NO_ZERNIO"});
  const ctrl=new AbortController(),t=setTimeout(()=>ctrl.abort(),20000);
  try{
    const r=await fetch(BASE+path,{method,signal:ctrl.signal,headers:{Authorization:"Bearer "+process.env.ZERNIO_API_KEY,"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{})});
    const v=await r.json().catch(()=>({}));
    if(!r.ok)throw Object.assign(new Error(String(v.error||v.message||"Zernio "+r.status).slice(0,300)),{status:r.status,body:v});
    return v;
  }finally{clearTimeout(t)}
}
const idOk=x=>/^[a-zA-Z0-9_:-]{2,130}$/.test(String(x||""));
module.exports={zernio,idOk};
