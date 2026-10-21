/* Browser-local real WebM -> H.264 MP4 conversion.
   Use the unbundled ESM ffmpeg worker. UMD workers fail to import blob core URLs.
   Runs only if the native browser cannot directly encode MP4; no simulated video. */
(function(){
"use strict";
const CDN="https://cdn.jsdelivr.net/npm/";
const WRAPPER=CDN+"@ffmpeg/ffmpeg@0.12.15/dist/esm/";
const CORE=CDN+"@ffmpeg/core@0.12.10/dist/esm/";
const MAX_INPUT=24_000_000;
let inflight=null,active=null,ffmpegClass=null;
function info(cb,message){if(typeof cb==="function")cb(message)}
async function toBlob(url,mime,signal){
 const r=await fetch(url,{mode:"cors",signal});
 if(!r.ok)throw Error("FFmpeg asset unavailable (HTTP "+r.status+")");
 const data=await r.blob();
 if(!data.size)throw Error("FFmpeg asset was empty");
 return URL.createObjectURL(new Blob([data],{type:mime}));
}
async function convert(blob,cb){
 if(inflight)throw Error("Another MP4 conversion is running");
 if(!(blob instanceof Blob)||blob.type&&!blob.type.includes("webm"))throw Error("Expected a real WebM video");
 if(blob.size<10000||blob.size>MAX_INPUT)throw Error("Video must be between 10 KB and 24 MB for local MP4 conversion");
 const ctrl=new AbortController(),urls=[];
 inflight=ctrl;
 try{
  info(cb,"Loading free FFmpeg video engine. The first use needs approximately 31 MB of downloads...");
  if(!ffmpegClass){
   try{ffmpegClass=(await import(WRAPPER+"index.js")).FFmpeg}
   catch(e){throw Error("ESM FFmpeg script could not load: "+e.message)}
  }
  if(!ffmpegClass)throw Error("FFmpeg WebAssembly is not available");
  const worker=await toBlob(WRAPPER+"worker.js","text/javascript",ctrl.signal);urls.push(worker);
  const core=await toBlob(CORE+"ffmpeg-core.js","text/javascript",ctrl.signal);urls.push(core);
  const wasm=await toBlob(CORE+"ffmpeg-core.wasm","application/wasm",ctrl.signal);urls.push(wasm);
  const ffmpeg=new ffmpegClass();active=ffmpeg;
  ffmpeg.on("progress",({progress})=>info(cb,"Encoding real H.264 MP4: "+Math.max(0,Math.min(99,Math.round(progress*100)))+"%"));
  let loadingTimer;
  try{
   await Promise.race([
    ffmpeg.load({classWorkerURL:worker,coreURL:core,wasmURL:wasm}),
    new Promise((_,reject)=>{loadingTimer=setTimeout(()=>reject(Error("Browser cannot start free FFmpeg within 75 seconds. Native MP4 is preferred; the original WebM is preserved.")),75000)})
   ]);
  }finally{clearTimeout(loadingTimer)}
  if(ctrl.signal.aborted)throw Error("MP4 conversion cancelled");
  await ffmpeg.writeFile("reel.webm",new Uint8Array(await blob.arrayBuffer()));
  info(cb,"Converting video to MP4 on this device. Keep the website open...");
  const status=await ffmpeg.exec(["-i","reel.webm","-an","-c:v","libx264","-preset","ultrafast","-crf","29","-pix_fmt","yuv420p","-movflags","+faststart","reel.mp4"],180000);
  if(status!==0)throw Error("H.264 encoding failed (exit "+status+"). Download WebM or use another browser.");
  const raw=await ffmpeg.readFile("reel.mp4");
  if(!raw||raw.byteLength<10000)throw Error("Encoder produced no usable MP4");
  const bytes=new Uint8Array(raw);
  if(String.fromCharCode(...bytes.subarray(4,8))!=="ftyp")throw Error("The resulting file is not a real MP4");
  info(cb,"H.264 MP4 created: "+Math.round(bytes.byteLength/1024)+" KB.");
  return new Blob([bytes],{type:"video/mp4"});
 }catch(e){throw Error(String(e.message||e))}
 finally{
  if(active){try{active.terminate()}catch{}active=null}
  for(const url of urls)URL.revokeObjectURL(url);
  inflight=null;
 }
}
function cancel(){inflight?.abort();if(active){try{active.terminate()}catch{}active=null}}
window.ReelMP4={convert,cancel,isBusy:()=>!!inflight};
})();