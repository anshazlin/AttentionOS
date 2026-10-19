(function(){
"use strict";
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let idea=null,photos=[],current=null,busy=false,stop=false,videoURL=null;
const css=document.createElement("style");
css.textContent=[
"#reelStudio{position:fixed;inset:0;background:#0b121afb;color:#f4f9f0;display:none;overflow-y:auto;z-index:9750;font:14px system-ui}",
"#reelStudio.visible{display:block}#reelStudio>main{max-width:870px;margin:auto;padding:18px 14px 120px}",
".reelCard{background:#17222d;border:1px solid #38505d;border-radius:18px;padding:16px;margin:15px 0}",
".reelCard h2,.reelCard h3{margin:0 0 12px}.reelRow{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:12px 0}",
".reelBtn{border:1px solid #537157;border-radius:12px;padding:12px 14px;background:#293b41;color:#f4f9f0;font:750 13px system-ui;cursor:pointer}",
".reelBtn.green{background:#b8f47e;color:#112015}.reelBtn:disabled{opacity:.5}",
".reelField{box-sizing:border-box;width:100%;padding:12px;background:#0a1721;border:1px solid #4b6370;border-radius:12px;color:#fff;font:14px system-ui}",
".reelLabel{display:block;color:#c4d1d4;font-size:12px;font-weight:750;margin:12px 0 6px}",
".reelFine{font-size:12px;color:#afc0c6;line-height:1.5}.reelWarning{background:#342f1e;border:1px solid #6b603d;border-radius:12px;padding:11px;color:#f5d99d;font-size:12px;line-height:1.5}",
"#reelImages{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}",
".reelChoice{border:2px solid #3b515e;border-radius:12px;overflow:hidden;background:#101e2a;cursor:pointer;min-width:0}",
".reelChoice.chosen{border-color:#b8f47e}.reelChoice img{width:100%;aspect-ratio:3/4;object-fit:cover;display:block}",
".reelChoice small{display:block;color:#dee5da;padding:6px;font-size:10px;overflow-wrap:anywhere}",
"#reelCanvas{display:block;width:min(100%,235px);aspect-ratio:9/16;margin:12px auto;background:#07111b;border-radius:13px}",
"#reelOutput video{max-width:min(100%,230px);max-height:440px;border-radius:12px;display:block}",
"#reelOutput a,#reelSources a{color:#b8f47e;overflow-wrap:anywhere}",
"#reelMessage{position:sticky;bottom:5px;background:#b8f47e;color:#122015;font-weight:800;padding:12px;border-radius:12px;white-space:pre-wrap}",
"@media(max-width:600px){#reelImages{grid-template-columns:repeat(3,minmax(0,1fr))}.reelCard{padding:12px}}"
].join("");
document.head.appendChild(css);
const root=document.createElement("section");root.id="reelStudio";root.setAttribute("role","dialog");root.setAttribute("aria-label","Automatic Reel video editor");
root.innerHTML='<main><div class="reelRow" style="justify-content:space-between"><h2>TRENDWALE · AUTO REEL STUDIO</h2><button class="reelBtn" id="reelClose">✕ Close</button></div>'+
'<div class="reelCard"><h3>1. Pick the product</h3><p class="reelFine">JARVIS searches licensed images and turns them into an animated 9:16 video. Stock photos are illustrative and must not be presented as the exact item sold.</p><label class="reelLabel">Product or theme</label><input id="reelQuery" class="reelField" maxlength="105" value="digital photo frame"/><label class="reelLabel">Opening hook</label><textarea id="reelHook" class="reelField" rows="2" maxlength="170"></textarea><label class="reelLabel">Call to action</label><input id="reelCTA" class="reelField" maxlength="140"/><div class="reelRow"><button id="reelFind" class="reelBtn green">🔎 Find licensed product visuals</button><label class="reelBtn" for="reelOwn">↑ Add product photos</label><input id="reelOwn" type="file" accept="image/jpeg,image/png,image/webp" multiple hidden/></div><div id="reelSources" class="reelFine"></div></div>'+
'<div class="reelCard"><h3>2. Choose scenes</h3><div id="reelImages"><p class="reelFine">No photos selected yet.</p></div><p class="reelWarning">Stock visuals might not show your actual product. Use genuine product photos for accurate advertising. Include required Creative Commons author/license credits in captions.</p></div>'+
'<div class="reelCard"><h3>3. Generate the edited video</h3><div class="reelRow"><button id="reelRender" class="reelBtn green">🎬 Auto-edit 12-second Reel</button><button id="reelCancel" class="reelBtn">Stop</button></div><canvas id="reelCanvas" width="540" height="960"></canvas><p class="reelFine">The browser adds scene transitions, animated images, captions and branding. MP4 availability depends on your device. WebM cannot be directly published as an Instagram Reel.</p><div id="reelOutput"></div></div>'+
'<div id="reelMessage" role="status" aria-live="polite">Ready, Master. Select your product.</div></main>';
document.body.appendChild(root);
const tell=s=>{$("reelMessage").textContent=s};
function owner(){const t=$("ownerToken")?.value?.trim()||$("jbOwner")?.value?.trim();if(!t)throw Error("Enter the private owner code in Automations or JARVIS.");return t}
async function post(url,body){const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json","x-owner-token":owner()},body:JSON.stringify(body)});const raw=await r.text();let d;try{d=JSON.parse(raw)}catch{throw Error("Server returned HTTP "+r.status+" rather than JSON.")}if(!r.ok||d.ok===false)throw Error(d.error||"Request unsuccessful");return d}
function clearResults(){if(videoURL){URL.revokeObjectURL(videoURL);videoURL=null}current=null;$("reelOutput").innerHTML=""}
function open(obj={},options={}){
 idea=obj||{};root.classList.add("visible");
 $("reelQuery").value=String(options.topic||idea.title||"digital photo frame").slice(0,105);
 $("reelHook").value=String(idea.hook||"This affordable home upgrade is worth a look").slice(0,170);
 $("reelCTA").value=String(idea.cta||"Comment GUIDE for the product details").slice(0,140);
 if(options.autoSearch)Promise.resolve(find()).then(()=>{if(options.autoRender){if(photos.some(p=>p.chosen))render();else tell('No usable licensed photos found. Add your own product photos to finish the Reel.')}});
 else tell("Ready to search or upload product images.");
}
function close(){stop=true;root.classList.remove("visible")}
$("reelClose").onclick=close;
function gallery(){
 const g=$("reelImages");g.innerHTML="";
 if(!photos.length){g.textContent="No suitable images yet. Try search, or add actual supplier photos.";return}
 photos.forEach((p,i)=>{
  const div=document.createElement("div");div.className="reelChoice"+(p.chosen?" chosen":"");div.tabIndex=0;div.setAttribute("role","button");
  const img=document.createElement("img");img.loading="lazy";img.alt=p.title||"Product photo";img.src=p.preview||p.src;
  const label=document.createElement("small");label.textContent=(p.chosen?"✓ ":"")+"Scene "+(i+1)+" · "+(p.own?"Owner photo":p.license);
  div.append(img,label);const click=()=>{p.chosen=!p.chosen;gallery()};
  div.onclick=click;div.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();click()}};
  g.append(div);
 });
}
async function find(){
 if(busy)return;busy=true;$("reelFind").disabled=true;clearResults();tell("Searching approved stock sources...");
 try{
  const query=$("reelQuery").value.trim();if(query.length<3)throw Error("Enter a product category.");
  const d=await post("/api/creative-media",{query});
  photos=photos.filter(x=>x.own);
  const items=(d.items||[]).filter(x=>x.kind==="image").slice(0,9);
  items.forEach((p,i)=>photos.push({...p,chosen:i<4,own:false}));
  const sources=[...new Set((d.providers||[]))].join(", ");
  $("reelSources").textContent=(sources||"No media provider available")+" · "+items.length+" usable photos · "+(d.warnings||[]).join("; ");
  gallery();
  tell(items.length?"Found "+items.length+" licensed stock images. First four are selected. Now render the video.":"No verified images found. Add your own product photos for a real video.");
 }catch(e){tell("Media search failed: "+e.message)}finally{busy=false;$("reelFind").disabled=false}
}
$("reelFind").onclick=find;
$("reelOwn").onchange=e=>{
 const files=Array.from(e.target.files||[]).slice(0,8);
 files.forEach(f=>{if(!["image/jpeg","image/png","image/webp"].includes(f.type)||f.size>6_000_000)return;
  const src=URL.createObjectURL(f);photos.unshift({src,preview:src,chosen:true,own:true,title:f.name,license:"owner-supplied",credit:"",localURL:src})});
 gallery();tell("Added your own product photos. Ready for editing.");
};
async function load(p){
 const im=new Image();im.decoding="async";
 let src=p.src;
 if(!p.own){
  const r=await fetch("/api/creative-image",{method:"POST",headers:{"Content-Type":"application/json","x-owner-token":owner()},body:JSON.stringify({url:p.src})});
  if(!r.ok){const d=await r.json().catch(()=>({}));throw Error(d.error||"Photo HTTP "+r.status)}
  p.temporaryURL=URL.createObjectURL(await r.blob());src=p.temporaryURL;
 }
 im.src=src;
 await new Promise((resolve,reject)=>{im.onload=resolve;im.onerror=()=>reject(Error("Could not decode photo"));if(im.complete&&im.naturalWidth)resolve()});
 if(!im.naturalWidth)throw Error("Photo had no visual pixels");
 return im
}
function wrap(ctx,str,maxWidth,maxLines){
 const words=String(str||"").split(/\s+/).filter(Boolean),out=[];let line="";
 for(const word of words){const next=line?line+" "+word:word;if(ctx.measureText(next).width>maxWidth&&line){out.push(line);line=word}else line=next}
 if(line)out.push(line);return out.slice(0,maxLines)
}
function cover(ctx,img,s){
 const w=img.naturalWidth,h=img.naturalHeight,z=Math.max(540/w,960/h)*s;const dw=w*z,dh=h*z;
 ctx.drawImage(img,(540-dw)/2,(960-dh)/2,dw,dh)
}
function paint(ctx,imgs,t,story){
 const index=Math.min(imgs.length-1,Math.floor(t/(12/imgs.length)));
 const progress=t/(12/imgs.length)-index;
 ctx.fillStyle="#091820";ctx.fillRect(0,0,540,960);
 cover(ctx,imgs[index],1.02+progress*.10);
 if(progress>.8&&index<imgs.length-1){ctx.save();ctx.globalAlpha=(progress-.8)/.2;cover(ctx,imgs[index+1],1.01);ctx.restore()}
 const g=ctx.createLinearGradient(0,340,0,960);g.addColorStop(0,"#08151a00");g.addColorStop(1,"#061018ee");ctx.fillStyle=g;ctx.fillRect(0,340,540,620);
 ctx.fillStyle="#b8f47e";ctx.fillRect(30,49,480,7);
 ctx.fillStyle="#fff";ctx.font="bold 31px system-ui";ctx.fillText("TRENDWALE",30,109);
 ctx.font="19px system-ui";ctx.fillText("Budget finds · Product inspiration",30,145);
 let copy=index===0?story.hook:index===imgs.length-1?story.cta:index===1?story.title:"Check photos, features and reviews";
 ctx.font="bold 45px system-ui";const textLines=wrap(ctx,copy,470,5);
 textLines.forEach((line,i)=>ctx.fillText(line,30,670-(textLines.length-1)*24+i*60));
 ctx.fillStyle="#b8f47e";ctx.font="20px system-ui";ctx.fillText("Comment GUIDE for details",30,890);
 ctx.fillStyle="#ffffff4f";ctx.fillRect(30,922,480,8);
 ctx.fillStyle="#b8f47e";ctx.fillRect(30,922,480*Math.min(t/12,1),8);
 if(story.stock){ctx.fillStyle="#fff";ctx.font="14px system-ui";ctx.fillText("Illustrative stock footage • Product not verified",30,188)}
}
function mime(){
 if(!window.MediaRecorder||!HTMLCanvasElement.prototype.captureStream)throw Error("Video recording is unsupported. Try Chrome on your phone.");
 const allowed=["video/mp4;codecs=avc1.42E01E","video/mp4","video/webm;codecs=vp8","video/webm"];
 const type=allowed.find(x=>MediaRecorder.isTypeSupported(x));if(!type)throw Error("No supported video codec");return type
}
async function render(){
 if(busy)return;const selected=photos.filter(x=>x.chosen).slice(0,5);
 if(selected.length<1){tell("Select at least one genuine or licensed photo to make the Reel.");return}
 busy=true;stop=false;$("reelRender").disabled=true;clearResults();
 const loaded=[],images=[];let recorder;
 try{
  tell("Loading photos for 12-second edited video...");
  for(const p of selected){if(stop)throw Error("Editing stopped");try{loaded.push(p);images.push(await load(p))}catch(e){tell("Skipped a photo: "+e.message)}}
  if(images.length<1)throw Error("No images loaded. Add original product photos.");
  if(images.length===1){images.push(images[0],images[0]);}
  const type=mime(),canvas=$("reelCanvas"),ctx=canvas.getContext("2d"),chunks=[];
  recorder=new MediaRecorder(canvas.captureStream(20),{mimeType:type,videoBitsPerSecond:1600000});
  recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};
  const recorded=new Promise((resolve,reject)=>{recorder.onstop=resolve;recorder.onerror=e=>reject(Error(e.error?.message||"Recorder error"))});
  const story={hook:$("reelHook").value,title:$("reelQuery").value,cta:$("reelCTA").value,stock:loaded.some(x=>!x.own)};
  const started=performance.now();
  paint(ctx,images,0,story);recorder.start(800);
  tell("Editing video now. Keep this page open for 12 seconds...");
  await new Promise((resolve,reject)=>{
   const frame=()=>{
    if(stop||document.hidden){try{recorder.stop()}catch{}reject(Error("Rendering cancelled: keep this page visible."));return}
    const sec=Math.min(12,(performance.now()-started)/1000);
    paint(ctx,images,sec,story);
    if(sec>=12){try{recorder.stop()}catch{}resolve()}else requestAnimationFrame(frame);
   };requestAnimationFrame(frame)
  });
  await recorded;
  if(!chunks.length)throw Error("Your phone encoded no frames.");
  const ext=type.startsWith("video/mp4")?"mp4":"webm",blob=new Blob(chunks,{type});
  if(blob.size<10000)throw Error("The encoder produced an empty video. Try a different browser.");
  videoURL=URL.createObjectURL(blob);
  current={blob,ext,filename:"TrendWale-Reel-"+Date.now()+"."+ext,files:loaded};
  const box=$("reelOutput");box.innerHTML="";
  const vid=document.createElement("video");vid.src=videoURL;vid.controls=true;vid.playsInline=true;box.append(vid);
  const row=document.createElement("div");row.className="reelRow";
  const link=document.createElement("a");link.className="reelBtn green";link.href=videoURL;link.download=current.filename;link.textContent="↓ Download "+ext.toUpperCase()+" Reel";
  const btn=document.createElement("button");btn.className="reelBtn";btn.disabled=ext!=="mp4";btn.textContent="↑ Upload MP4 to Zernio (not publish)";btn.onclick=uploadZernio;
  row.append(link,btn);box.append(row);
  const msg=document.createElement("p");msg.className="reelFine";msg.textContent="Real 12-second video, "+loaded.length+" scenes. "+(ext==="mp4"?"MP4 is ready for your review.":"Your browser only generated WebM. This file needs MP4 conversion before Instagram.");box.append(msg);
  for(const p of loaded.filter(x=>!x.own)){const a=document.createElement("a");a.href=p.source;a.rel="noopener noreferrer";a.target="_blank";a.textContent=p.credit+" · "+p.license+" / ";box.append(a)}
  tell("The actual "+ext.toUpperCase()+" video is ready. "+(ext==="mp4"?"You can approve a Zernio upload.":"Convert WebM to MP4 before publishing."));
 }catch(e){tell("Video NOT finished: "+e.message);if(recorder?.state==="recording")recorder.stop()}
 finally{loaded.forEach(p=>{if(p.temporaryURL){URL.revokeObjectURL(p.temporaryURL);delete p.temporaryURL}});busy=false;$("reelRender").disabled=false}
}
async function uploadZernio(){
 if(!current||current.ext!=="mp4"){tell("MP4 required. No Instagram upload was attempted.");return}
 if(!confirm("Upload the generated MP4 to Zernio as media for your approval? This does NOT publish."))return;
 try{
  const result=await post("/api/zernio?action=presign",{action:"presign",filename:current.filename,contentType:"video/mp4",size:current.blob.size});
  const d=result.data||result;if(!d.uploadUrl||!d.publicUrl)throw Error("Zernio media upload URL unavailable");
  const r=await fetch(d.uploadUrl,{method:"PUT",headers:{"Content-Type":"video/mp4"},body:current.blob});if(!r.ok)throw Error("Media upload failed HTTP "+r.status);
  if(idea){
   const usesStock=current.files.some(p=>!p.own);
   const credits=current.files.filter(p=>!p.own).map(p=>p.credit+" ("+p.license+") "+p.source).filter(Boolean);
   const prefix=String(idea.caption||"").slice(0,1300);
   const attribution=credits.length?"\n\nMedia credits: "+[...new Set(credits)].join("; ").slice(0,670):"";
   const qualifier=usesStock?"\nIllustrative footage; check actual listing for product details.":"";
   idea.caption=(prefix+qualifier+attribution).slice(0,2180);
   idea.mediaUrl=d.publicUrl;idea.saved=true;
  }
  tell("Uploaded to Zernio media library. NOT published. Review and approve from Automations.");
 }catch(e){tell("Not uploaded: "+e.message)}
}
$("reelRender").onclick=render;
$("reelCancel").onclick=()=>{stop=true;tell("Stopping edit...")};
window.ReelStudio={open,find,render,close,uploadZernio,state:()=>({open:root.classList.contains("visible"),photos:photos.length,chosen:photos.filter(p=>p.chosen).length,result:current?{format:current.ext,bytes:current.blob.size}:null})};
})();