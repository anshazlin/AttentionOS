const assert=require('node:assert/strict');
const oldFetch=global.fetch;
const agent=require('../api/agent.js');
const social=require('../api/zernio.js');
function resp(){return {code:200,status(n){this.code=n;return this},setHeader(){},json(payload){this.payload=payload;return this}}}
async function run(){
 process.env.ATTENTIONOS_OWNER_TOKEN='development-test-owner';
 process.env.ZERNIO_API_KEY='development-test-key';
 delete process.env.GEMINI_API_KEY;
 const fetches=[];
 global.fetch=async function(url,opt){
  fetches.push({url:String(url),opt});
  if(String(url).includes('news.google.com'))return {ok:true,text:async()=>'<rss><channel><item><title>Affordable home storage - Example</title><link>https://example.org/article</link><pubDate>Mon, 19 Oct 2026 10:00:00 GMT</pubDate></item></channel></rss>'};
  if(String(url).includes('/media/presign'))return {ok:true,json:async()=>({uploadUrl:'https://uploads.example.org',publicUrl:'https://media.zernio.com/example.jpg'})};
  if(String(url).includes('/posts'))return {ok:true,json:async()=>({post:{_id:'test-post-123',status:'scheduled'}})};
  return {ok:false,status:404,json:async()=>({error:'Unexpected API path'})};
 };
 const plan=resp();
 await agent({method:'POST',headers:{'x-owner-token':'development-test-owner'},body:{action:'plan',brand:'TrendWale',topic:'affordable organizers'}},plan);
 assert.equal(plan.code,200);
 assert.equal(plan.payload.mode,'templates');
 assert.equal(plan.payload.ideas.length,3);
 assert.equal(plan.payload.sources.length,1);
 assert.match(plan.payload.sources[0].title,/Affordable home storage/);
 const unauth=resp();
 await agent({method:'POST',headers:{},body:{action:'plan'}},unauth);
 assert.equal(unauth.code,401);
 const media=resp();
 await social({method:'POST',headers:{'x-owner-token':'development-test-owner'},query:{action:'presign'},body:{action:'presign',filename:'clip.mp4',contentType:'video/mp4',size:152000}},media);
 assert.equal(media.code,200);assert.equal(media.payload.data.publicUrl,'https://media.zernio.com/example.jpg');
 const schedule=resp(),at='2027-05-06T18:00:00.000Z';
 await social({method:'POST',headers:{'x-owner-token':'development-test-owner'},query:{action:'publish'},body:{action:'publish',mode:'schedule',accountId:'6ad50afb07660418f469e3d8',caption:'Original product demonstration',mediaUrl:'https://media.zernio.com/example.jpg',scheduledFor:at}},schedule);
 assert.equal(schedule.code,200);
 const submitted=JSON.parse(fetches.find(x=>x.url.endsWith('/posts')).opt.body);
 assert.equal(submitted.scheduledFor,at);
 assert.equal(submitted.platforms[0].platform,'instagram');
 assert.equal(submitted.publishNow,undefined);
 console.log('PASS: 3 research drafts, auth rejection, media upload handshake, safe Zernio scheduling.');
 global.fetch=oldFetch;
}
run().catch(e=>{console.error(e);process.exit(1)});