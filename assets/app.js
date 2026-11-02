(() => {
"use strict";
const $=s=>document.querySelector(s),toast=$("#toast");let toastTimer;
const showToast=t=>{toast.textContent=t;toast.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove("show"),2600)};
const clean=s=>String(s??"").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,"").trim();
function setupChat({formId,inputId,messagesId,endpoint,sendId,roleAvatar="R",initialWelcome=""}){
 const form=$(formId),input=$(inputId),list=$(messagesId),send=$(sendId);let history=[],busy=false;
 const resize=()=>{input.style.height="auto";input.style.height=Math.min(input.scrollHeight,180)+"px"};
 const add=(role,text)=>{const row=document.createElement("div");row.className="message "+role;if(role==="assistant"){const av=document.createElement("div");av.className="message-avatar";av.textContent=roleAvatar;row.append(av)}const body=document.createElement("div");body.className="message-body";body.textContent=text;row.append(body);list.append(row);row.scrollIntoView({behavior:"smooth",block:"end"});return body};
 async function sendText(value){const content=clean(value);if(!content||busy)return;add("user",content);history.push({role:"user",content});input.value="";resize();const output=add("assistant","Thinking…");busy=true;send.disabled=true;send.textContent="…";
 try{const res=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json","Accept":"text/event-stream"},body:JSON.stringify({messages:history})});if(!res.ok){let msg="Request failed ("+res.status+").";try{msg=(await res.json()).error||msg}catch{}throw new Error(msg)}if(!res.body)throw new Error("Streaming is not supported.");
 const reader=res.body.getReader(),decoder=new TextDecoder();let buffer="",answer="";
 while(true){const {value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});const lines=buffer.split("\n");buffer=lines.pop()||"";for(const line of lines){if(!line.startsWith("data:"))continue;const data=line.slice(5).trim();if(!data||data==="[DONE]")continue;try{const j=JSON.parse(data),delta=j.choices?.[0]?.delta?.content;if(typeof delta==="string"){answer+=delta;output.textContent=answer}}catch{}}}
 if(!answer.trim())throw new Error("The AI provider returned an empty response.");history.push({role:"assistant",content:answer});if(history.length>30)history=history.slice(-30);
 }catch(e){output.textContent="Error: "+(e?.message||"Unable to contact AI provider.");output.classList.add("message-error");history.pop()}finally{busy=false;send.disabled=false;send.textContent="↑";input.focus()}}
 form.addEventListener("submit",e=>{e.preventDefault();sendText(input.value)});input.addEventListener("input",resize);input.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();form.requestSubmit()}});
 return {clear(){history=[];list.replaceChildren();if(initialWelcome){const row=document.createElement("div");row.className="message assistant";const av=document.createElement("div");av.className="message-avatar";av.textContent=roleAvatar;const b=document.createElement("div");b.className="message-body";b.textContent=initialWelcome;row.append(av,b);list.append(row)}}};
}
const main=setupChat({formId:"#chatForm",inputId:"#prompt",messagesId:"#messages",endpoint:"/api/chat",sendId:"#sendBtn"});
const intro="Tell me what video you want to make. Include the topic, target audience, length, platform, language and visual style if you know them. I can help build the concept, script, scene-by-scene shot list, image prompts, captions, voiceover and editing plan.";
const video=setupChat({formId:"#videoForm",inputId:"#videoPrompt",messagesId:"#videoMessages",endpoint:"/api/video-chat",sendId:"#videoSendBtn",roleAvatar:"C",initialWelcome:intro});
document.querySelectorAll("[data-prompt]").forEach(b=>b.addEventListener("click",()=>{$("#prompt").value=b.dataset.prompt;$("#prompt").focus();$("#prompt").dispatchEvent(new Event("input"))}));
document.querySelectorAll("[data-video-prompt]").forEach(b=>b.addEventListener("click",()=>{$("#videoPrompt").value=b.dataset.videoPrompt;$("#videoPrompt").focus();$("#videoPrompt").dispatchEvent(new Event("input"))}));
$("#newChat").addEventListener("click",()=>{main.clear();$("#welcome").hidden=false;$("#prompt").focus();$("#sidebar").classList.remove("open")});
$("#clearChat").addEventListener("click",()=>{if($(".view.active")?.id==="view-video"){video.clear();showToast("Video Builder chat cleared.")}else{main.clear();$("#welcome").hidden=false;showToast("Chat cleared.")}});
$("#clearVideo").addEventListener("click",()=>{video.clear();showToast("Video Builder chat cleared.")});
$("#menuBtn").addEventListener("click",()=>$("#sidebar").classList.toggle("open"));
document.querySelectorAll("[data-view]").forEach(button=>button.addEventListener("click",()=>{const view=button.dataset.view;document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));$("#view-"+view)?.classList.add("active");document.querySelectorAll(".nav-item[data-view]").forEach(n=>n.classList.toggle("active",n===button));$("#pageName").textContent=button.textContent.trim().replace(/\s+Soon$/,"");$("#sidebar").classList.remove("open")}));
$("#aboutBtn").addEventListener("click",()=>showToast("Riyad AI Studio · Venice AI + Claude"));
})();