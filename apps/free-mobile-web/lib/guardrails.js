// Deterministic content gates. Code decides; the LLM never edits these rules at runtime.
const INJECTION=/(ignore (all|previous|prior) (instructions|rules)|system prompt|you are now|disregard .{0,30}(rules|instructions)|reveal .{0,20}(key|token|secret)|<\/?(system|assistant)>)/i;
const PRICE=/(?:₹|rs\.?|inr)\s?\d[\d,]*|\b\d[\d,]*\s?(?:rupees|rs)\b/i;
const STAT=/\b\d[\d,.]*\s?(?:%|x|lakh|crore|million|k\+?)\s+(?:sold|sales|views|people|customers|reviews|orders)|\b(?:best[- ]?selling|viral|trending #?1|number one|most popular)\b/i;
function scrubUntrusted(text,max=300){
  const s=String(text||"").replace(/[\u0000-\u001f\u007f]/g," ").replace(/\s+/g," ").trim().slice(0,max);
  return {text:s,suspicious:INJECTION.test(s)};
}
function checkContent(c,brand,{verifiedClaims=[],recentCaptions=[]}={}){
  const issues=[];const warn=[];
  const caption=String(c.caption||""),script=String(c.script||""),hooks=String(c.hook||""),all=[caption,script,hooks,c.cta||""].join("\n");
  if(!caption.trim())issues.push("Caption is empty");
  if(caption.length>2200)issues.push("Caption exceeds 2200 characters");
  const tags=(String(c.hashtags||"").match(/#[\p{L}\p{N}_]+/gu)||[]);
  if(tags.length>15)issues.push("More than 15 hashtags");
  for(const b of brand?.banned_claims||[]){if(b&&all.toLowerCase().includes(String(b).toLowerCase()))issues.push('Banned claim: "'+b+'"')}
  const unverifiedPrice=PRICE.test(all)&&!verifiedClaims.some(v=>PRICE.test(v));
  if(unverifiedPrice)issues.push("Contains a price with no verified claim in the ledger");
  if(STAT.test(all)&&!verifiedClaims.length)issues.push("Contains a popularity/sales statistic with no verified evidence");
  if(INJECTION.test(all))issues.push("Output resembles an instruction-injection pattern");
  for(const d of brand?.required_disclosures||[]){if(d&&!all.toLowerCase().includes(String(d).toLowerCase()))warn.push('Missing required line: "'+d+'"')}
  const norm=s=>s.toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
  if(recentCaptions.some(r=>norm(r)===norm(caption)))issues.push("Duplicate of a recent caption");
  if(!Array.isArray(c.shotList)||c.shotList.length<2)warn.push("Shot list is thin");
  return {passed:issues.length===0,issues,warnings:warn,checkedAt:new Date().toISOString()};
}
// Fixes only things code can fix safely (required disclosure); never rewrites claims.
function applyDisclosures(c,brand){
  let caption=String(c.caption||"");
  for(const d of brand?.required_disclosures||[]){if(d&&!caption.toLowerCase().includes(d.toLowerCase()))caption=(caption+"\n"+d+".").trim()}
  return {...c,caption:caption.slice(0,2200)};
}
module.exports={checkContent,scrubUntrusted,applyDisclosures,INJECTION,PRICE,STAT};
