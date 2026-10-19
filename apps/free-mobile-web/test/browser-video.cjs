// Real Chromium smoke test: 12-second canvas frames are encoded by actual browser MediaRecorder.
// No mocks for MediaRecorder, no fake MP4 bytes, and no external publishing.
const fs=require('node:fs');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const puppeteer=require('puppeteer-core');
const ffprobe=require('ffprobe-static');
(async()=>{
 const candidates=[process.env.CHROME_BIN,'/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'];
 const executablePath=candidates.find(v=>v&&fs.existsSync(v));
 if(!executablePath)throw Error('Chrome executable unavailable: real browser video test cannot run.');
 const browser=await puppeteer.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required','--use-fake-device-for-media-stream','--ignore-certificate-errors']});
 try{
  const page=await browser.newPage();
  page.setDefaultTimeout(45000);
  await page.goto('http://127.0.0.1:8878/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>Boolean(window.ReelStudio?.render),{timeout:14000});
  const result=await page.evaluate(async()=>{
    // Preserve native encoder output. FFmpeg fallback is tested separately.
    window.ReelMP4=undefined;
    await window.ReelStudio.open({title:'Smart kitchen brush',hook:'Smart brush demo concept',cta:'Compare sizes before you buy'},{topic:'smart kitchen brush'});
    const output=await window.ReelStudio.render();
    if(!output?.ok)return {output,stat:window.ReelStudio.state()};
    const link=document.querySelector('#reelOutput a[download]');
    if(!link)return {output,error:'No downloadable finished media'};
    const buffer=await (await fetch(link.href)).arrayBuffer();
    const bytes=new Uint8Array(buffer);
    let encoded='';
    for(let i=0;i<bytes.length;i+=6000){encoded+=String.fromCharCode(...bytes.slice(i,i+6000))}
    return {output,base64:btoa(encoded),filename:link.download,stat:window.ReelStudio.state()};
  });
  assert.ok(result.output?.ok,'Real browser render failed: '+JSON.stringify(result));
  assert.ok(result.output.bytes>10000,'Browser did not encode a real video');
  assert.ok(result.base64,'No playable file returned from editor');
  const bytes=Buffer.from(result.base64,'base64');
  assert.ok(bytes.length>10000,'Encoded video was smaller than expected');
  const path='/tmp/attentionos-real-render.'+result.output.format;
  fs.writeFileSync(path,bytes);
  const meta=JSON.parse(execFileSync(ffprobe.path,['-v','error','-show_entries','format=duration:stream=codec_name,width,height','-of','json',path],{encoding:'utf8',timeout:15000}));
  const video=(meta.streams||[]).find(x=>x.width&&x.height);
  assert.ok(video&&video.width===540&&video.height===960,'Not a valid 9:16 540x960 video');
  const duration=Number(meta.format?.duration);
  assert.ok(duration>=9.5&&duration<=14.5,'Actual video duration not ~12 seconds: '+duration);
  console.log('PASS: REAL Chrome MediaRecorder generated '+bytes.length+' bytes of '+result.output.format.toUpperCase()+' with '+video.codec_name+', '+video.width+'x'+video.height+', duration '+duration+' sec. No synthetic/mock frames and no Instagram publishing.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
