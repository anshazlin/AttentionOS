const assert=require('node:assert/strict');
const media=require('../api/creative-media.js');
const image=require('../api/creative-image.js');
function out(){return {code:0,result:null,bytes:null,headers:{},setHeader(k,v){this.headers[k]=v},status(v){this.code=v;return this},json(v){this.result=v;return this},send(v){this.bytes=v;return this}}}
function req(body,auth='test-owner'){return {method:'POST',headers:{'x-owner-token':auth,origin:'https://attentionos.example',host:'attentionos.example'},body}}
async function main(){
 process.env.ATTENTIONOS_OWNER_TOKEN='test-owner';delete process.env.PEXELS_API_KEY;
 let r=out();await media(req({query:'digital photo frame'},'bad'),r);assert.equal(r.code,401);
 const old=global.fetch;let contacted=[];
 global.fetch=async url=>{
  contacted.push(String(url));
  if(String(url).includes('commons.wikimedia.org')){
   return {ok:true,json:async()=>({query:{pages:[
    {pageid:23,title:'File:Digitalframe.jpg',imageinfo:[{thumburl:'https://upload.wikimedia.org/wikipedia/commons/0/01/Digitalframe.jpg',descriptionurl:'https://commons.wikimedia.org/wiki/File:Digitalframe.jpg',extmetadata:{LicenseShortName:{value:'Public domain'},Artist:{value:'Owner'}}}]},
    {pageid:34,title:'File:Secret.jpg',imageinfo:[{thumburl:'https://upload.wikimedia.org/wikipedia/commons/x/xxx/Secret.jpg',extmetadata:{LicenseShortName:{value:'All rights reserved'}}}]}
   ]}})}
  }
  const jpg=Buffer.from([0xff,0xd8,...Array(200).fill(8)]);
  return {ok:true,headers:{get:k=>k==='content-type'?'image/jpeg':k==='content-length'?String(jpg.length):null},body:null,arrayBuffer:async()=>jpg};
 };
 r=out();await media(req({query:'digital photo frame'}),r);
 assert.equal(r.code,200);assert.equal(r.result.items.length,1);
 assert.equal(r.result.items[0].license,'Public domain');
 assert.equal(r.result.items[0].exactProduct,false);
 assert.ok(contacted.some(u=>u.startsWith('https://commons.wikimedia.org')));
 r=out();await image(req({url:'http://internal.example/secret'}),r);assert.equal(r.code,400);
 r=out();await image(req({url:'https://upload.wikimedia.org/wikipedia/commons/0/01/Digitalframe.jpg'}),r);
 assert.equal(r.code,200);assert.equal(r.headers['Content-Type'],'image/jpeg');
 assert.equal(r.bytes[0],255);assert.equal(r.bytes[1],216);
 global.fetch=old;
 console.log('PASS: licensed media search filters copyrighted stock, checks owner token, and safely proxies JPEG into Reel editor. No external media was published.');
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1});
