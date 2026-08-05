(function(){
  function requestKey(entry){
    if(entry && entry.requestType === "recruit") return "recruit";
    if(entry && entry.requestType === "p1p3") return "p1p3";
    return String((entry && entry.raid) || "").trim().toLowerCase();
  }

  window.renderSelectedCharacterPoReleases=function(data,requests){
    const box=document.getElementById("selectedCharacterPoReleases");
    if(!box) return;
    const releases=(data && data.poReleases) || {};
    const normalizeRaidKey=function(value){return String(value||"").trim().toLowerCase().replace(/[_\s]+/g,"-").replace(/^zg$/,"zg-prime");};
    const approvedKeys=new Set();
    Object.keys(releases).forEach(function(key){if(releases[key]===true||String(releases[key]).toLowerCase()==="true"||Number(releases[key])>0)approvedKeys.add(normalizeRaidKey(key));});
    ((data&&data.poReleaseDetails)||[]).forEach(function(entry){approvedKeys.add(normalizeRaidKey(entry&&entry.raid));});
    const labels=[["recruit","Rekrutenstatus"],["p1p3","P1–P3"],["mc","MC"],["bwl","BWL"],["aq40","AQ40"],["naxx","NAXX"],["zg-mittwoch","ZG Mittwoch"],["zg-prime","ZG PRIME"],["zg-late","ZG LATE"]];
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
      const historyResponse=await fetch(APPS_SCRIPT_URL+"?"+historyQuery.toString(),{cache:"no-store"});
      const history=await historyResponse.json();
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
})();
