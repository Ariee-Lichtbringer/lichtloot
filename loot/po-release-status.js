(function(){
  async function showRaidMemberNotice(notice){
    if(!notice||!notice.active||!notice.text||!notice.version||document.getElementById("raidMemberNoticeModal"))return;
    const guild=currentGuildSlug(),pin=getStoredLichtLootPlayerPin();
    if(!pin)return;
    const acceptance=await fetch(APPS_SCRIPT_URL+"?"+new URLSearchParams({action:"getRaidMemberNoticeAcceptance",guild,pin,version:notice.version,t:Date.now()}).toString(),{cache:"no-store"}).then(response=>response.json()).catch(()=>({}));
    if(acceptance.accepted)return;
    const modal=document.createElement("div");modal.id="raidMemberNoticeModal";modal.style.cssText="position:fixed;inset:0;z-index:100001;background:rgba(2,6,23,.88);display:grid;place-items:center;padding:20px";
    modal.innerHTML='<div style="width:min(680px,100%);max-height:90vh;overflow:auto;background:#081221;border:2px solid #facc15;border-radius:18px;padding:25px;color:#e5e7eb;box-shadow:0 28px 90px #000"><h2 style="margin:0 0 15px;color:#facc15">📣 '+String(notice.title||"Information für Raidmitglieder").replace(/[<>&]/g,"")+'</h2><div style="white-space:pre-wrap;line-height:1.6">'+String(notice.text).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")+'</div><label style="display:flex;gap:10px;align-items:flex-start;margin:22px 0;font-weight:850"><input data-check type="checkbox" style="width:22px;height:22px;flex:0 0 auto"><span>Ich habe die Mitteilung gelesen und stimme den genannten Nutzungsbedingungen beziehungsweise Änderungen der Raidregeln zu.</span></label><button data-accept type="button" disabled style="width:100%;padding:13px;border:0;border-radius:10px;background:#16a34a;color:white;font-weight:950;opacity:.45">Gelesen und zugestimmt</button></div>';
    document.body.appendChild(modal);const check=modal.querySelector("[data-check]"),button=modal.querySelector("[data-accept]");check.onchange=()=>{button.disabled=!check.checked;button.style.opacity=check.checked?"1":".45";};button.onclick=async()=>{button.disabled=true;const result=await fetch(APPS_SCRIPT_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"acceptRaidMemberNotice",guild,pin,version:notice.version})}).then(response=>response.json()).catch(()=>({}));if(result.accepted)modal.remove();else button.disabled=false;};
  }
  async function maybeShowWorldbuffAgreement(char,enabled){
    const page=String(location.pathname||"").toLowerCase();
    if(!/(^|\/)(bwl|ony|zg)-loot\.html$/.test(page)) return;
    if(!enabled || !char || !char.name || document.getElementById("worldbuffRuleAgreementModal")) return;
    const pin=getStoredLichtLootPlayerPin();
    if(!pin) return;
    const guild=currentGuildSlug();
    const query=new URLSearchParams({action:"getWorldbuffRuleAgreement",guild:guild,pin:pin,character:char.name,server:char.server||"",t:Date.now()});
    const status=await fetch(APPS_SCRIPT_URL+"?"+query.toString(),{cache:"no-store"}).then(response=>response.json()).catch(()=>({}));
    if(status.agreed) return;
    const modal=document.createElement("div");
    modal.id="worldbuffRuleAgreementModal";
    modal.style.cssText="position:fixed;inset:0;z-index:100000;background:rgba(2,6,23,.86);display:grid;place-items:center;padding:20px";
    modal.innerHTML='<div style="width:min(620px,100%);background:#0b1222;border:2px solid #facc15;border-radius:18px;padding:24px;color:#e5e7eb;box-shadow:0 24px 80px #000"><h2 style="margin:0 0 14px;color:#facc15">📯 Worldbuff-Regeln</h2><p>Wenn du <strong>Herz oder Kopf auf Prio</strong> nimmst, verpflichtest du dich, den daraus entstehenden Worldbuff zum von der Gilde festgelegten Termin abzugeben.</p><p>Erfolgt die Abgabe trotz entsprechender Prio nicht zum vorgesehenen Termin, kann dies zum Raidausschluss bei den Lichtbringern führen.</p><label style="display:flex;align-items:flex-start;gap:10px;margin:20px 0;font-weight:800"><input id="worldbuffRuleAgreementCheck" type="checkbox" style="width:22px;height:22px;flex:0 0 auto"> <span>Ich habe die Regeln gelesen und bin mit der verpflichtenden Abgabe zum Gildentermin einverstanden.</span></label><div id="worldbuffRuleAgreementStatus" style="min-height:22px;color:#fca5a5"></div><button id="worldbuffRuleAgreementAccept" type="button" disabled style="width:100%;padding:13px;border:0;border-radius:10px;background:#16a34a;color:white;font-weight:900;cursor:pointer;opacity:.45">Gelesen und akzeptiert</button></div>';
    document.body.appendChild(modal);
    const check=modal.querySelector("#worldbuffRuleAgreementCheck"),button=modal.querySelector("#worldbuffRuleAgreementAccept"),message=modal.querySelector("#worldbuffRuleAgreementStatus");
    check.addEventListener("change",()=>{button.disabled=!check.checked;button.style.opacity=check.checked?"1":".45";});
    button.addEventListener("click",async()=>{button.disabled=true;message.textContent="Bestätigung wird gespeichert …";try{const response=await fetch(APPS_SCRIPT_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"acceptWorldbuffRuleAgreement",guild:guild,pin:pin,character:char.name,server:char.server||""})});const result=await response.json();if(!result.success)throw new Error(result.error||"Bestätigung konnte nicht gespeichert werden.");modal.remove();}catch(error){message.textContent=error.message||"Bestätigung konnte nicht gespeichert werden.";button.disabled=false;}});
  }
  function requestKey(entry){
    if(entry && entry.requestType === "recruit") return "recruit";
    if(entry && entry.requestType === "p1p3") return "p1p3";
    return String((entry && entry.raid) || "").trim().toLowerCase();
  }

  function selectedWorldbuffToken(candidateItem){
    const page=String(location.pathname||"").toLowerCase();
    const selected=[["p1","p2","p3"].map(id=>String(document.getElementById(id)?.value||"")).join(" | "),candidateItem||""].join(" | ").toLowerCase();
    if(/\/zg-loot\.html$/.test(page) && selected.includes("herz") && selected.includes("hakkar")) return "Herz von Hakkar";
    if(/\/bwl-loot\.html$/.test(page) && selected.includes("kopf") && selected.includes("nefar")) return "Kopf von Nefarian";
    if(/\/ony-loot\.html$/.test(page) && selected.includes("kopf") && selected.includes("ony")) return "Kopf von Onyxia";
    return "";
  }

  async function requireWorldbuffAgreementForSave(candidateItem){
    const token=selectedWorldbuffToken(candidateItem);
    if(!token || window.worldbuffAgreementEnabled===false) return true;
    const pin=getStoredLichtLootPlayerPin(),character=String(document.getElementById("playerName")?.value||"").trim(),server=String(document.getElementById("playerServer")?.value||"").trim(),raidKey=String(window.currentRaidId||document.getElementById("raidPin")?.value||"").trim(),guild=currentGuildSlug();
    if(!pin||!character||!raidKey) return false;
    const query=new URLSearchParams({action:"getWorldbuffRuleAgreement",guild,pin,character,server,raidKey,t:Date.now()});
    const current=await fetch(APPS_SCRIPT_URL+"?"+query.toString(),{cache:"no-store"}).then(r=>r.json()).catch(()=>({}));
    if(current.agreed) return true;
    return new Promise(resolve=>{
      const modal=document.createElement("div");modal.id="worldbuffRuleAgreementModal";modal.style.cssText="position:fixed;inset:0;z-index:100000;background:rgba(2,6,23,.86);display:grid;place-items:center;padding:20px";
      modal.innerHTML='<div style="width:min(620px,100%);background:#0b1222;border:2px solid #facc15;border-radius:18px;padding:24px;color:#e5e7eb;box-shadow:0 24px 80px #000"><h2 style="margin:0 0 14px;color:#facc15">📯 Worldbuff-Regeln für diesen Raid</h2><p>Du möchtest <strong>'+token+'</strong> auf Prio nehmen. Damit verpflichtest du dich, den daraus entstehenden Worldbuff zum von der Gilde festgelegten Termin abzugeben.</p><p>Erfolgt die Abgabe trotz Prio nicht zum vorgesehenen Termin, kann dies zum Raidausschluss bei den Lichtbringern führen.</p><label style="display:flex;align-items:flex-start;gap:10px;margin:20px 0;font-weight:800"><input data-check type="checkbox" style="width:22px;height:22px;flex:0 0 auto"> <span>Ich habe die Regeln gelesen und bin für diesen Raid mit der verpflichtenden Abgabe zum Gildentermin einverstanden.</span></label><div data-status style="min-height:22px;color:#fca5a5"></div><div style="display:flex;gap:10px"><button data-cancel type="button" style="flex:1;padding:12px;border-radius:10px;background:#334155;color:white;border:0">Abbrechen</button><button data-accept type="button" disabled style="flex:2;padding:12px;border-radius:10px;background:#16a34a;color:white;border:0;font-weight:900;opacity:.45">Zustimmen und Prio speichern</button></div></div>';
      document.body.appendChild(modal);const check=modal.querySelector("[data-check]"),accept=modal.querySelector("[data-accept]"),status=modal.querySelector("[data-status]");
      check.onchange=()=>{accept.disabled=!check.checked;accept.style.opacity=check.checked?"1":".45";};modal.querySelector("[data-cancel]").onclick=()=>{modal.remove();resolve(false);};
      accept.onclick=async()=>{accept.disabled=true;status.textContent="Zustimmung wird gespeichert …";try{const response=await fetch(APPS_SCRIPT_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"acceptWorldbuffRuleAgreement",guild,pin,character,server,raidKey})});const result=await response.json();if(!result.success)throw new Error(result.error||"Zustimmung konnte nicht gespeichert werden.");modal.remove();resolve(true);}catch(error){status.textContent=error.message||"Zustimmung konnte nicht gespeichert werden.";accept.disabled=false;}};
    });
  }

  window.renderSelectedCharacterPoReleases=function(data,requests){
    const box=document.getElementById("selectedCharacterPoReleases");
    if(!box) return;
    const releases=(data && data.poReleases) || {};
    const normalizeRaidKey=function(value){return String(value||"").trim().toLowerCase().replace(/[_\s]+/g,"-").replace(/^zg$/,"zg-prime");};
    const approvedKeys=new Set();
    Object.keys(releases).forEach(function(key){if(releases[key]===true||String(releases[key]).toLowerCase()==="true"||Number(releases[key])>0)approvedKeys.add(normalizeRaidKey(key));});
    ((data&&data.poReleaseDetails)||[]).forEach(function(entry){approvedKeys.add(normalizeRaidKey(entry&&entry.raid));});
    const visibleRaids=new Set(Array.isArray(data&&data.visiblePoReleaseRaids)?data.visiblePoReleaseRaids:["recruit","p1p3","mc","bwl","aq40","aq20","naxx","zg-mittwoch","zg-prime","zg-late"]);
    const labels=[["recruit","Rekrutenstatus"],["p1p3","P1–P3"],["mc","MC"],["bwl","BWL"],["aq40","AQ40"],["aq20","AQ20"],["naxx","NAXX"],["zg-mittwoch","ZG Mittwoch"],["zg-prime","ZG PRIME"],["zg-late","ZG LATE"]].filter(function(item){return visibleRaids.has(item[0]);});
    const pending=new Set((requests||[]).filter(entry=>String((entry&&entry.status)||"").toLowerCase()==="pending").map(requestKey));
    const chips=labels.map(function(item){
      const key=item[0],label=item[1];
      const approved=key==="recruit" ? Boolean(data&&data.recruitStatusLifted) : approvedKeys.has(normalizeRaidKey(key));
      const inReview=!approved && pending.has(key);
      return '<span class="loot-release-chip '+(approved?'approved':inReview?'pending':'')+'">'+safe(label)+': '+(approved?'✓ freigegeben':inReview?'● in Prüfung':'– offen')+'</span>';
    }).join("");
    box.innerHTML='<div class="loot-release-title">PO-Freigaben für alle Raids</div><div class="loot-release-list">'+chips+'</div><div class="loot-release-help">Gelb = Antrag wird geprüft · Grün = freigegeben · Dunkel = noch nicht freigegeben</div>';
  };

  window.loadSelectedCharacterPoReleases=async function(char){
    const box=document.getElementById("selectedCharacterPoReleases");
    const pin=getStoredLichtLootPlayerPin();
    if(!box || !pin || !char || !char.name) return;
    box.innerHTML='<div class="loot-release-title">PO-Freigaben für alle Raids</div><div class="loot-release-help">Status wird geladen …</div>';
    try{
      const historyQuery=new URLSearchParams({action:"getPlayerPrioHistory",guild:currentGuildSlug(),char:char.name,server:char.server||"",pin:pin,t:Date.now()});
      const displayQuery=new URLSearchParams({action:"getPoReleaseDisplaySettings",guild:currentGuildSlug(),t:Date.now()});
      const responses=await Promise.all([fetch(APPS_SCRIPT_URL+"?"+historyQuery.toString(),{cache:"no-store"}),fetch(APPS_SCRIPT_URL+"?"+displayQuery.toString(),{cache:"no-store"})]);
      const history=await responses[0].json();
      const display=await responses[1].json().catch(function(){return {};});
      showRaidMemberNotice(display.raidMemberNotice);
      window.worldbuffAgreementEnabled=display.worldbuffAgreementEnabled!==false;
      history.visiblePoReleaseRaids=Array.isArray(display.visibleRaids)?display.visibleRaids:null;
      if(!history.success) throw new Error(history.error||"Freigaben konnten nicht geladen werden.");
      let requests=[];
      if(currentGuildSlug()==="nachtloot"){
        const requestQuery=new URLSearchParams({action:"getMyPoReleaseRequests",guild:currentGuildSlug(),character:char.name,server:char.server||"",pin:pin,t:Date.now()});
        const requestResponse=await fetch(APPS_SCRIPT_URL+"?"+requestQuery.toString(),{cache:"no-store"});
        const requestData=await requestResponse.json().catch(function(){return {};});
        requests=Array.isArray(requestData.entries)?requestData.entries:[];
      }
      window.renderSelectedCharacterPoReleases(history,requests);
    }catch(error){
      box.innerHTML='<div class="loot-release-title">PO-Freigaben für alle Raids</div><div class="loot-release-help"><span class="bad">Status konnte nicht geladen werden.</span></div>';
    }
  };
  const originalSavePrio=window.savePrio;
  if(typeof originalSavePrio==="function") window.savePrio=async function(){if(await requireWorldbuffAgreementForSave())return originalSavePrio.apply(this,arguments);};
  const originalSetPrio=window.setPrio;
  if(typeof originalSetPrio==="function") window.setPrio=async function(slot,item){if(await requireWorldbuffAgreementForSave(item))return originalSetPrio.apply(this,arguments);};
  const originalSetP0Plus=window.setP0Plus;
  if(typeof originalSetP0Plus==="function") window.setP0Plus=async function(item){if(await requireWorldbuffAgreementForSave(item))return originalSetP0Plus.apply(this,arguments);};
  fetch(APPS_SCRIPT_URL+"?"+new URLSearchParams({action:"getPoReleaseDisplaySettings",guild:currentGuildSlug(),t:Date.now()}).toString(),{cache:"no-store"}).then(response=>response.json()).then(data=>{window.worldbuffAgreementEnabled=data.worldbuffAgreementEnabled!==false;showRaidMemberNotice(data.raidMemberNotice);}).catch(()=>{});
})();
