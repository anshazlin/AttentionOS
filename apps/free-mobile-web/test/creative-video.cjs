const assert=require("node:assert/strict");
const find=require("../api/creative-media.js");
const video=require("../api/creative-video.js");
function out(){return {statusCode:200,body:null,data:null,headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.statusCode=n;return this},json(v){this.body=v;return this},send(v){this.data=v;return this}}}
function req(body,token="owner-test"){return {method:"POST",headers:{origin:"https://attentionos.example",host:"attentionos.example","x-owner-token":token},body}}
async function main(){
 process.env.ATTENTIONOS_OWNER_TOKEN="owner-test";
 process.env.PEXELS_API_KEY="testing-only";
 const oldFetch=global.fetch;
 const frame=Buffer.alloc(800);frame.write("ftyp",4,"ascii");
 global.fetch=async(url)=>{
  const u=String(url);
  if(u.includes("api.pexels.com/v1/search"))return {ok:true,json:async()=>({photos:[]})};
  if(u.includes("api.pexels.com/v1/videos/search"))return {ok:true,json:async()=>({videos:[{id:123,user:{name:"Contributor"},url:"https://www.pexels.com/video/123",image:"https://images.pexels.com/photos/123/pexels-photo-123.jpeg",video_files:[{file_type:"video/mp4",width:720,height:1280,link:"https://videos.pexels.com/video-files/123/456/hd_720_1280_25fps.mp4"}]}]})};
  if(u.startsWith("https://commons.wikimedia.org/"))return {ok:true,json:async()=>({query:{pages:[]}})};
  return {ok:true,headers:{get:(key)=>key==="content-type"?"video/mp4":key==="content-length"?String(frame.length):null},body:null,arrayBuffer:async()=>frame};
 };
 try{
  let response=out();
  await find(req({query:"digital photo frame"}),response);
  assert.equal(response.statusCode,200);
  assert.ok(response.body.items.some(p=>p.kind==="video"&&p.src.includes("videos.pexels.com")), "Licensed video was not discovered");
  response=out();
  await video(req({url:"https://videos.pexels.com/video-files/123/456/hd_720_1280_25fps.mp4"},"wrong"),response);
  assert.equal(response.statusCode,401);
  response=out();
  await video(req({url:"https://myprivatehost.internal/secret.mp4"}),response);
  assert.equal(response.statusCode,400);
  response=out();
  await video(req({url:"https://videos.pexels.com/video-files/123/456/hd_720_1280_25fps.mp4"}),response);
  assert.equal(response.statusCode,200);
  assert.equal(response.headers["Content-Type"],"video/mp4");
  assert.equal(response.data.length,frame.length);
  global.fetch=async()=>({ok:true,headers:{get:k=>k==="content-length"?"9000000":"video/mp4"},body:null});
  response=out();
  await video(req({url:"https://videos.pexels.com/video-files/123/456/hd_720_1280_25fps.mp4"}),response);
  assert.equal(response.statusCode,413);
  console.log("PASS: licensed Pexels video discovery and private small-clip proxy, auth and size controls. All media payloads mocked.");
 }finally{global.fetch=oldFetch;delete process.env.PEXELS_API_KEY}
}
main().catch(e=>{console.error(e);process.exitCode=1});
