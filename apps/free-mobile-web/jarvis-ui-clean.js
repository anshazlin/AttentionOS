/* Compact JARVIS mobile interface; all underlying tool controls remain intact. */
(function(){
"use strict";
const by=id=>document.getElementById(id);
if(!by("jbOverlay"))return;
const css=document.createElement("style");css.id="jarvis-compact-ui";css.textContent="#jbOverlay #jbBody{max-width:780px;padding:12px 12px 105px;box-sizing:border-box}\n#jbOverlay .jbHead{display:flex;align-items:center;gap:12px;justify-content:space-between}\n#jbOverlay .jbHead .jbSmall{font-size:12px}\n#jbOverlay .jbPanel{max-width:100%;min-width:0;overflow-wrap:anywhere}\n#jbOverlay #jbOrb{display:none!important}\n#jbOverlay .jbPanel:has(#jbStatus){padding:9px 13px!important;margin-top:9px}\n#jbOverlay #jbStatus{min-height:0!important;line-height:1.4;margin:0;font-size:13px}\n#jbOverlay #jbMessages{max-height:45dvh;overflow:auto;overscroll-behavior:contain;scrollbar-width:thin}\n#jbOverlay .jbBubble{overflow-wrap:anywhere}\n#jbOverlay #jbConnectionSettings,#jbOverlay #jbVoiceOptions{border-top:1px solid #32434c;margin-top:9px;padding-top:8px;text-align:left}\n#jbOverlay #jbConnectionSettings summary,#jbOverlay #jbVoiceOptions summary{cursor:pointer;color:#c4d9c7;font-size:12px;font-weight:650;list-style-position:inside}\n#jbOverlay #jbConnectionSettings[open],#jbOverlay #jbVoiceOptions[open]{padding-bottom:10px}\n#jbOverlay #jbVoiceOptions .jbGrid{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr));margin-top:8px}\n#jbOverlay #jbVoiceOptions .jbSmall{font-size:11px;line-height:1.45;margin-top:8px}\n#jbOverlay #jbVoiceOptions #jbMute{display:inline-block!important;margin-top:10px}\n#jbOverlay #jbTaskPanel{display:none}\n#jwWake{bottom:calc(12px + env(safe-area-inset-bottom))!important;left:12px!important;right:auto!important;max-width:min(280px,calc(100vw - 24px))!important;min-width:0!important;gap:5px!important;padding:6px 8px!important;border-radius:14px!important;box-shadow:0 4px 15px #0008!important}\n#jwWake button{font-size:11px!important;line-height:1.15!important;padding:8px 9px!important;max-width:140px}\n#jwWakeStatus{min-width:0!important;font-size:10px!important;line-height:1.2!important;flex:1!important}\n#jwWake small{display:none!important}\n@media(max-width:550px){\n #jbOverlay .jbHead strong{font-size:22px!important}\n #jbOverlay #jbMessages{max-height:52dvh}\n #jbOverlay .jbPanel{margin:8px 0!important;padding:12px!important}\n #jbOverlay #jbBody{padding:9px 10px 95px!important}\n #jbOverlay .jbHead #jbClose{padding:7px 9px;font-size:12px}\n #jbOverlay #jbQuestion{min-width:100px!important}\n #jbOverlay .jbRow{gap:6px}\n #jwWake{max-width:min(245px,calc(100vw - 24px))!important}\n}";
document.head.appendChild(css);
const owner=by("jbOwner");
if(owner){
 const panel=owner.closest(".jbPanel"),head=panel?.querySelector(".jbRow");
 if(panel&&head&&!by("jbConnectionSettings")){
  const details=document.createElement("details");details.id="jbConnectionSettings";
  const title=document.createElement("summary");title.textContent="Owner access and connection details";details.appendChild(title);
  [...panel.children].filter(el=>el!==head).forEach(el=>details.appendChild(el));
  panel.appendChild(details);
  details.open=!owner.value.trim();
 }
}
const orb=by("jbOrb"),voicePanel=orb?.closest(".jbPanel");
if(voicePanel&&!by("jbVoiceOptions")){
 const options=document.createElement("details");options.id="jbVoiceOptions";
 const summary=document.createElement("summary");summary.textContent="Voice preferences (optional)";options.appendChild(summary);
 const grid=voicePanel.querySelector(".jbGrid"),mute=by("jbMute");
 if(grid)options.appendChild(grid);
 if(mute)options.appendChild(mute);
 const explanation=document.createElement("div");explanation.className="jbSmall";
 explanation.textContent="Natural speech requires a connected voice provider. Hands-free microphone wake-up works only while this page remains open. Your existing voice options are preserved here.";
 options.appendChild(explanation);
 voicePanel.appendChild(options);
}
const task=by("jbTaskPanel");
if(task){
 task.style.display="none";
 window.addEventListener("attentionos:reel-progress",()=>{task.style.display="block"});
}
})();
