// Real end-to-end WebM -> MP4 test: feed Chrome-generated video into FFmpeg WASM in Chromium, probe the actual H.264 file.
// This test requires the CDN to be reachable. It does NOT use owner tokens, Instagram, or mock encoders.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const puppeteer=require('puppeteer-core'),ffprobe=require('ffprobe-static');
(async()=>{
 const input='/tmp/attentionos-real-render.webm';
 assert.ok(fs.existsSync(input),'Run browser-video.cjs first to record actual WebM');
 const original=fs.readFileSync(input);
 assert.ok(original.length>10000,'Recorded input WebM was empty');
 const bin=['/usr/bin/google-chrome','/usr/bin/chromium'].find(p=>fs.existsSync(p));
 assert.ok(bin,'Chromium missing');
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
  assert.ok(video&&video.width===540&&video.height===960,'Encoded output is not vertical H.264 video');
  assert.ok(+meta.format.duration>9&&+meta.format.duration<15,'MP4 duration is not approximately 12 seconds');
  console.log('PASS: actual browser FFmpeg WASM generated '+mp4.length+' bytes of H264 MP4: '+video.width+'x'+video.height+' '+meta.format.duration+' sec');
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});