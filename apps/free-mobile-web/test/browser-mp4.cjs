// Real end-to-end WebM -> MP4 test: feed Chrome-generated video into FFmpeg WASM in Chromium, probe the actual H.264 file.
// This test requires the CDN to be reachable. It does NOT use owner tokens, Instagram, or mock encoders.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const puppeteer=require('puppeteer-core'),ffprobe=require('ffprobe-static');
(async()=>{
 const bin=['/usr/bin/google-chrome','/usr/bin/chromium'].find(p=>fs.existsSync(p));
 assert.ok(bin,'Chromium missing');
 const input='/tmp/attentionos-real-render.webm';
 if(!fs.existsSync(input)){
  // Chrome may encode MP4 natively. Record a REAL short WebM with the browser MediaRecorder
  // to exercise the fallback converter without fabricating a video file.
  const fixtureBrowser=await puppeteer.launch({executablePath:bin,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  try{
   const testPage=await fixtureBrowser.newPage();
   await testPage.goto('http://127.0.0.1:8878/index.html',{waitUntil:'domcontentloaded'});
   const bytes=await testPage.evaluate(async()=>{
    const c=document.createElement('canvas');c.width=320;c.height=568;
    const ctx=c.getContext('2d');
    const recorder=new MediaRecorder(c.captureStream(12),{mimeType:'video/webm;codecs=vp8',videoBitsPerSecond:650000});
    const chunks=[];recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
    const ended=new Promise((resolve,reject)=>{recorder.onstop=resolve;recorder.onerror=reject});
    recorder.start(200);
    const start=performance.now();
    await new Promise(resolve=>{
     const frame=()=>{
      const t=(performance.now()-start)/1000;
      ctx.fillStyle='#113644';ctx.fillRect(0,0,c.width,c.height);
      ctx.fillStyle='#bbf080';ctx.fillRect(30,80,Math.max(20,220*Math.min(t/2,1)),10);
      ctx.font='26px sans-serif';ctx.fillStyle='#f1fff3';ctx.fillText('REAL VIDEO TEST',32,290);
      if(t<2.4)requestAnimationFrame(frame);else resolve();
     };frame();
    });
    recorder.stop();await ended;
    const content=await new Blob(chunks,{type:'video/webm'}).arrayBuffer();
    const view=new Uint8Array(content);let txt='';
    for(let i=0;i<view.length;i+=6000)txt+=String.fromCharCode(...view.slice(i,i+6000));
    return btoa(txt);
   });
   fs.writeFileSync(input,Buffer.from(bytes,'base64'));
  }finally{await fixtureBrowser.close()}
 }
 const original=fs.readFileSync(input);
 assert.ok(original.length>10000,'Recorded input WebM was empty');
 const browser=await puppeteer.launch({executablePath:bin,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--js-flags=--max-old-space-size=4096']});
 try{
  const page=await browser.newPage();page.setDefaultTimeout(240000);
  await page.goto('http://127.0.0.1:8878/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.ReelMP4?.convert,{timeout:12000});
  const chunks=[];for(let i=0;i<original.length;i+=8192)chunks.push(original.subarray(i,i+8192).toString('base64'));
  const result=await page.evaluate(async parts=>{
   const combined=new Uint8Array(parts.reduce((n,x)=>n+atob(x).length,0));let pos=0;
   for(const p of parts){const b=atob(p);for(let i=0;i<b.length;i++)combined[pos++]=b.charCodeAt(i)}
   const messages=[];
   const mp4=await window.ReelMP4.convert(new Blob([combined],{type:'video/webm'}),s=>messages.push(s));
   const bytes=new Uint8Array(await mp4.arrayBuffer());
   const chunks=[];for(let i=0;i<bytes.length;i+=8192){let b='';for(const item of bytes.subarray(i,i+8192))b+=String.fromCharCode(item);chunks.push(btoa(b))}
   return {size:bytes.length,chunks,messages};
  },chunks);
  assert.ok(result.size>10000,'FFmpeg conversion yielded no actual MP4');
  const mp4=Buffer.concat(result.chunks.map(x=>Buffer.from(x,'base64')));
  assert.equal(mp4.toString('ascii',4,8),'ftyp','MP4 header missing');
  fs.writeFileSync('/tmp/attentionos-real-render.mp4',mp4);
  const meta=JSON.parse(execFileSync(ffprobe.path,['-v','error','-show_entries','format=duration:stream=codec_name,width,height','-of','json','/tmp/attentionos-real-render.mp4'],{encoding:'utf8',timeout:15000}));
  const video=(meta.streams||[]).find(x=>x.codec_name==='h264');
  assert.ok(video&&video.width===320&&video.height===568,'Encoded output is not vertical H.264 video');
  assert.ok(+meta.format.duration>1.6&&+meta.format.duration<3.5,'MP4 duration is not approximately 2.4 seconds');
  console.log('PASS: actual browser FFmpeg WASM generated '+mp4.length+' bytes of H264 MP4: '+video.width+'x'+video.height+' '+meta.format.duration+' sec');
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});