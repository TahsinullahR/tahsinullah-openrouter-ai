(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const messages = $("#messages"), promptBox = $("#prompt"), form = $("#chatForm");
  const welcome = $("#welcome"), sendBtn = $("#sendBtn"), toast = $("#toast");
  let history = [], busy = false, toastTimer;
  const showToast = (text) => { toast.textContent = text; toast.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("show"), 2600); };
  const setBusy = (value) => { busy = value; sendBtn.disabled = value; sendBtn.textContent = value ? "…" : "↑"; };
  const addMessage = (role, content, error = false) => {
    welcome.hidden = true;
    const row = document.createElement("div"); row.className = "message " + role;
    if (role === "assistant") { const avatar = document.createElement("div"); avatar.className = "message-avatar"; avatar.textContent = "R"; row.append(avatar); }
    const body = document.createElement("div"); body.className = "message-body" + (error ? " message-error" : "");
    body.textContent = content; row.append(body); messages.append(row); row.scrollIntoView({behavior:"smooth",block:"end"}); return body;
  };
  const safeText = (value) => String(value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  async function send(text) {
    const content = safeText(text).trim();
    if (!content || busy) return;
    addMessage("user", content); history.push({role:"user",content}); promptBox.value = ""; resize();
    const output = addMessage("assistant", ""); output.textContent = "Thinking…"; setBusy(true);
    try {
      const response = await fetch("/api/chat", {
        method:"POST", headers:{"Content-Type":"application/json","Accept":"text/event-stream"},
        body:JSON.stringify({messages:history})
      });
      if (!response.ok) {
        let detail = "Request failed (" + response.status + ").";
        try { const data = await response.json(); detail = data.error || detail; } catch {}
        throw new Error(detail);
      }
      if (!response.body) throw new Error("Streaming is not supported by this response.");
      const reader = response.body.getReader(), decoder = new TextDecoder();
      let buffer = "", answer = "";
      while (true) {
        const {value,done} = await reader.read(); if (done) break;
        buffer += decoder.decode(value,{stream:true});
        const lines = buffer.split("\n"); buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim(); if (!data || data === "[DONE]") continue;
          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta?.content;
            if (typeof delta === "string") { answer += delta; output.textContent = answer; }
          } catch {}
        }
      }
      if (!answer.trim()) answer = "The provider returned an empty response.";
      output.textContent = answer; history.push({role:"assistant",content:answer});
      if (history.length > 30) history = history.slice(-30);
    } catch (err) {
      output.textContent = "Error: " + (err?.message || "Unable to contact the AI service.");
      output.classList.add("message-error");
      history.pop();
    } finally { setBusy(false); promptBox.focus(); }
  }
  function resize(){ promptBox.style.height="auto"; promptBox.style.height=Math.min(promptBox.scrollHeight,180)+"px"; }
  form.addEventListener("submit", e => { e.preventDefault(); send(promptBox.value); });
  promptBox.addEventListener("input", resize);
  promptBox.addEventListener("keydown", e => { if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();form.requestSubmit();} });
  document.querySelectorAll("[data-prompt]").forEach(b => b.addEventListener("click",()=>{promptBox.value=b.dataset.prompt;resize();promptBox.focus();}));
  $("#newChat").addEventListener("click",()=>{history=[];messages.replaceChildren();welcome.hidden=false;promptBox.focus();$("#sidebar").classList.remove("open");});
  $("#clearChat").addEventListener("click",()=>{history=[];messages.replaceChildren();welcome.hidden=false;showToast("This chat was cleared.");});
  $("#menuBtn").addEventListener("click",()=>$("#sidebar").classList.toggle("open"));
  document.querySelectorAll("[data-view]").forEach(button => button.addEventListener("click",()=>{
    const view=button.dataset.view;
    document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
    $("#view-"+view)?.classList.add("active");
    document.querySelectorAll(".nav-item[data-view]").forEach(n=>n.classList.toggle("active",n===button));
    $("#pageName").textContent=button.textContent.trim().replace(/\s+Soon$/,"");
    $("#sidebar").classList.remove("open");
  }));
  $("#aboutBtn").addEventListener("click",()=>showToast("Riyad AI Studio · Venice AI chat"));
})();