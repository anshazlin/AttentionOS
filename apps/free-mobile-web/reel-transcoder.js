/* Real in-browser WebM -> MP4 (H.264) conversion using pinned ffmpeg.wasm.
   Assets download from jsDelivr only when a browser outputs WebM.
   The conversion and video content stay on the user's phone. No mock result. */
(function(){
"use strict";
const CDN="https://cdn.jsdelivr.net/npm/";
const WRAPPER=CDN+"@ffmpeg/ffmpeg@0.12.15/dist/umd/";
const CORE=CDN+"@ffmpeg/core@0.12.10/dist/umd/";
const MAX_INPUT=24_000_000;
let inflight=null,active=null;
function info(cb,message){if(typeof cb==="function")cb(message)}
async function toBlob(url,mime,signal){
 const r=await fetch(url,{mode:"cors",signal});
 if(!r.ok)throw Error("FFmpeg download failed: HTTP "+r.status);
 const data=await r.blob();
 if(!data.size)throw Error("FFmpeg CDN returned an empty file");
 return URL.createObjectURL(new Blob([data],{type:mime}));
}
function script(url){
 return new Promise((resolve,reject)=>{
  if(window.FFmpegWASM?.FFmpeg){resolve();return}
  const element=document.createElement("script");
  element.src=url;element.async=true;element.referrerPolicy="no-referrer";
  element.onload=()=>window.FFmpegWASM?.FFmpeg?resolve():reject(Error("FFmpeg script loaded without its decoder"));
  element.onerror=()=>reject(Error("Cannot load the free FFmpeg library (blocked network or CDN)"));
  document.head.appendChild(element);
 });
}
async function convert(blob,cb){
 if(inflight)throw Error("Another MP4 conversion is running");
 if(!(blob instanceof Blob)||blob.type&&!blob.type.includes("webm"))throw Error("Provide a real WebM video");
 if(blob.size<10000||blob.size>MAX_INPUT)throw Error("Video must be 10 KB–24 MB for phone conversion");
 const ctrl=new AbortController(),urls=[];
 inflight=ctrl;
 try{
  info(cb,"Preparing local FFmpeg converter (first use downloads approximately 31 MB)...");
  await script(WRAPPER+"ffmpeg.js");
  const FFmpeg=window.FFmpegWASM?.FFmpeg;
  if(!FFmpeg)throw Error("FFmpeg wrapper unavailable");
  const wasm=new FFmpeg();active=wasm;
  const worker=await toBlob(WRAPPER+"814.ffmpeg.js","text/javascript",ctrl.signal);urls.push(worker);
  const core=await toBlob(CORE+"ffmpeg-core.js","text/javascript",ctrl.signal);urls.push(core);
  const module=await toBlob(CORE+"ffmpeg-core.wasm","application/wasm",ctrl.signal);urls.push(module);
  wasm.on("progress",({progress})=>info(cb,"Converting real video to H.264 MP4: "+Math.max(0,Math.min(99,Math.round(progress*100)))+"%"));
  await wasm.load({classWorkerURL:worker,coreURL:core,wasmURL:module});
  if(ctrl.signal.aborted)throw Error("Conversion cancelled");
  await wasm.writeFile("reel.webm",new Uint8Array(await blob.arrayBuffer()));
  info(cb,"Encoding Instagram-compatible MP4 on your device. Keep the app visible...");
  const status=await wasm.exec(["-i","reel.webm","-an","-c:v","libx264","-preset","ultrafast","-crf","29","-pix_fmt","yuv420p","-movflags","+faststart","-r","20","reel.mp4"],180000);
  if(status!==0)throw Error("Local MP4 encoding failed (FFmpeg exit "+status+"). The original WebM remains available.");
  const out=await wasm.readFile("reel.mp4");
  if(!out||out.byteLength<10000)throw Error("MP4 encoder produced an empty video");
  info(cb,"H.264 MP4 created locally · "+Math.round(out.byteLength/1024)+" KB.");
  return new Blob([out],{type:"video/mp4"});
 }catch(e){throw Error(String(e.message||e))}
 finally{
  active?.terminate?.();active=null;
  urls.forEach(url=>URL.revokeObjectURL(url));
  inflight=null;
 }
}
function cancel(){inflight?.abort();active?.terminate?.();active=null}
window.ReelMP4={convert,cancel,isBusy:()=>!!inflight};
})();