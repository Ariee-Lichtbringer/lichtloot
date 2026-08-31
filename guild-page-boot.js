(function () {
  const guild = new URLSearchParams(window.location.search).get("guild");
  if (!guild || ["lichtloot", "lichtbringer"].includes(guild.trim().toLowerCase())) return;

  const root = document.documentElement;
  root.classList.add("guild-page-booting");

  const style = document.createElement("style");
  style.textContent = [
    "html.guild-page-booting{background:#020617!important}",
    "html.guild-page-booting body{visibility:hidden!important}",
    "html.guild-page-booting::after{content:'Gilde wird geöffnet …';position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:#020617;color:#f8fafc;font:900 18px Arial,sans-serif;letter-spacing:.04em;visibility:visible}"
  ].join("");
  document.head.appendChild(style);

  let finished = false;
  function finish() {
    if (finished) return;
    finished = true;
    root.classList.remove("guild-page-booting");
  }

  window.addEventListener("load", function () {
    window.setTimeout(finish, 900);
  }, { once: true });
  window.setTimeout(finish, 6000);
})();

/* Seitenaufrufe auch dann erfassen, wenn das HTML aus dem Browser-Cache kommt. */
(function () {
  const guild = new URLSearchParams(window.location.search).get("guild") || "lichtloot";
  const payload = JSON.stringify({ path: window.location.pathname || "/", guild });
  const analyticsUrl = "https://lichtloot-production.up.railway.app/api/page-view";
  const send = function () {
    fetch(analyticsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      cache: "no-store",
      keepalive: true
    }).catch(function () {});
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", send, { once: true });
  } else {
    send();
  }
})();

/* Einheitliche Systemhinweise und technische Fehlererfassung. */
(function(){
  const STORAGE_KEY="lichtloot_pending_system_errors_v1",wrapped=new WeakSet(),recent=new Map();
  const PUBLIC_TEXT="Speichern ist momentan nicht möglich. LichtLoot ist vorübergehend nicht erreichbar oder wird aktualisiert. Bitte versuche es in einigen Minuten erneut.";
  const clean=value=>String(value??"").slice(0,12000);
  const guild=()=>new URLSearchParams(location.search).get("guild")||"lichtloot";
  const reference=()=>`LL-${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2,6)}`.toUpperCase();
  const pageContext=()=>({page:location.pathname+location.search,raid:clean(typeof window.RAID_NAME!=="undefined"?window.RAID_NAME:""),player:clean(document.getElementById("playerName")?.value||document.getElementById("myPriosChar")?.value||""),server:clean(document.getElementById("playerServer")?.value||"")});
  function banner(id){
    let box=document.getElementById("lichtlootSystemNotice");
    if(!box){box=document.createElement("aside");box.id="lichtlootSystemNotice";box.setAttribute("role","alert");box.style.cssText="position:fixed;z-index:2147483600;left:50%;top:18px;transform:translateX(-50%);width:min(680px,calc(100vw - 28px));padding:15px 48px 15px 17px;border:1px solid #f59e0b;border-radius:12px;background:#111827;color:#f8fafc;box-shadow:0 22px 60px #000a;font:700 14px/1.45 Arial,sans-serif";const close=document.createElement("button");close.type="button";close.textContent="×";close.setAttribute("aria-label","Systemhinweis schließen");close.style.cssText="position:absolute;right:10px;top:8px;border:0;background:transparent;color:#fff;font-size:25px;cursor:pointer";close.onclick=()=>box.remove();box.appendChild(close);document.body.appendChild(box);}let text=box.querySelector("[data-system-text]");if(!text){text=document.createElement("div");text.dataset.systemText="1";box.prepend(text);}text.innerHTML=`<strong style="display:block;color:#fbbf24;margin-bottom:3px">Systemhinweis</strong>${PUBLIC_TEXT}<small style="display:block;margin-top:7px;color:#94a3b8">Vorgangs-ID: ${id}</small>`;
  }
  function queued(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]")}catch{return[]}}
  function saveQueue(rows){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(rows.slice(-30)))}catch{}}
  async function send(payload){const response=await fetch("/api/apps-script",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"reportIssue",guild:guild(),type:"Systemfehler",category:"system_error",source:payload.actionName||"Website",...payload})});if(!response.ok)throw new Error(`HTTP ${response.status}`);const result=await response.json();if(result?.success===false)throw new Error(result.error||"Fehler konnte nicht gemeldet werden.");return result;}
  async function flush(){const rows=queued();if(!rows.length)return;const remaining=[];for(const row of rows){try{await send(row)}catch{remaining.push(row)}}saveQueue(remaining);}
  function report(error,context={},show=true){const message=clean(error?.message||error||"Unbekannter Fehler"),key=`${context.actionName||""}|${message}`;if(Date.now()-(recent.get(key)||0)<5000)return context.referenceId||reference();recent.set(key,Date.now());const id=context.referenceId||reference(),base=pageContext(),payload={...base,...context,referenceId:id,originalDate:new Date().toISOString(),note:message,technicalDetails:clean(error?.stack||message),httpStatus:clean(context.httpStatus||error?.status||"")};if(show)banner(id);send(payload).catch(()=>{const rows=queued();if(!rows.some(row=>row.referenceId===id)){rows.push(payload);saveQueue(rows);}});return id;}
  function isWrite(params){const action=clean(params?.action);return /^(save|create|update|delete|set|send|queue|publish|approve|reject|transfer|clear|move|cancel|claim|import|reset|merge|guild(save|create|update|delete|set|send|queue|approve|reject|transfer|clear|move|cancel|claim|import|reset|merge))/i.test(action)&&action!=="reportIssue";}
  function wrap(name){const original=window[name];if(typeof original!=="function"||wrapped.has(original))return;const replacement=async function(params,...rest){if(!isWrite(params))return original.call(this,params,...rest);try{const result=await original.call(this,params,...rest);if(result?.success===false||(result?.error&&result?.success!==true)){const actual=new Error(result.error||`${params.action} fehlgeschlagen.`),id=report(actual,{actionName:params.action,httpStatus:result.status||""});return {...result,success:false,error:`${PUBLIC_TEXT} Vorgangs-ID: ${id}`};}return result;}catch(error){const id=report(error,{actionName:params?.action||name,httpStatus:error?.status||""});const publicError=new Error(`${PUBLIC_TEXT} Vorgangs-ID: ${id}`);publicError.cause=error;throw publicError;}};wrapped.add(replacement);window[name]=replacement;}
  function install(){["apiJsonp","railwayApi","railwayWrite","apiFetch"].forEach(wrap);}
  window.LichtLootSystem={reportFailure:report,showSystemNotice:banner,flush};
  window.addEventListener("error",event=>{if(event?.error)report(event.error,{actionName:"JavaScript"},true)});
  window.addEventListener("unhandledrejection",event=>report(event.reason||"Unbehandelter Fehler",{actionName:"Promise"},true));
  window.addEventListener("online",flush);
  setInterval(install,1000);setInterval(flush,30000);install();setTimeout(flush,1500);
})();
