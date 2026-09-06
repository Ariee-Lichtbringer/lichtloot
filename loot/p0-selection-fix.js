(function(){
  "use strict";

  function p0PlusEnabled(){
    const layout=typeof currentGuildInfo !== "undefined" ? currentGuildInfo?.layout : {};
    const raid=String(location.pathname || "").split("/").pop().replace("-loot.html", "");
    return layout?.lootPageSectionsByRaid?.[raid]?.p0Plus !== false;
  }
  function requireP0PlusEnabled(){
    if(p0PlusEnabled()) return true;
    const status=document.getElementById("playerStatus");
    if(status) status.innerHTML='<span class="bad">P0+ ist für diesen Raid deaktiviert. Bitte P0 ohne Plus oder normale Prios auswählen.</span>';
    return false;
  }
  function refreshP0PlusButtons(){
    document.querySelectorAll('[data-prio="p0plus"]').forEach(button=>{button.hidden=!p0PlusEnabled();});
  }

  window.p0WasClicked = Boolean(window.p0WasClicked || window.p0PlusWasClicked);

  const originalSetPrio = window.setPrio;
  if(typeof originalSetPrio === "function"){
    window.setPrio = function(slot,itemName){
      window.p0WasClicked = false;
      return originalSetPrio.apply(this,arguments);
    };
  }

  window.setP0 = function(itemName,itemId){
    window.p0WasClicked = true;
    window.p0PlusWasClicked = false;
    window.lastSavedPrioSignature = "";
    ["p1","p2","p3"].forEach(slot=>{
      const field=document.getElementById(slot);
      if(field) field.value=itemName;
      const idField=document.getElementById(slot+"ItemId");
      if(idField) idField.value=itemId || "";
    });
    const status=document.getElementById("playerStatus");
    if(status) status.innerHTML='<span class="ok">✓ '+safe(itemName)+' wurde als P0 gesetzt. P1–P3 wurden automatisch übernommen.</span>';
    if(typeof renderSelectedPrioPreviews === "function") renderSelectedPrioPreviews();
    if(typeof autoSaveDraft === "function") autoSaveDraft();
    if(typeof updateActiveButtons === "function") updateActiveButtons();
  };

  const originalSetP0Plus = window.setP0Plus;
  if(typeof originalSetP0Plus === "function"){
    window.setP0Plus = async function(){
      if(!requireP0PlusEnabled()) return;
      const result=await originalSetP0Plus.apply(this,arguments);
      if(window.p0PlusWasClicked) window.p0WasClicked=true;
      return result;
    };
  }

  const originalManualSelectChanged = window.manualSelectChanged;
  if(typeof originalManualSelectChanged === "function"){
    window.manualSelectChanged = function(){
      window.p0WasClicked=false;
      return originalManualSelectChanged.apply(this,arguments);
    };
  }

  const originalUpdateActiveButtons = window.updateActiveButtons;
  if(typeof originalUpdateActiveButtons === "function"){
    window.updateActiveButtons = function(){
      const result=originalUpdateActiveButtons.apply(this,arguments);
      refreshP0PlusButtons();
      const p1=document.getElementById("p1")?.value || "";
      const p2=document.getElementById("p2")?.value || "";
      const p3=document.getElementById("p3")?.value || "";
      if(window.p0WasClicked && !window.p0PlusWasClicked && p1 && p1===p2 && p2===p3){
        ["p1","p2","p3","p0"].forEach(slot=>{
          document.querySelectorAll('.mini-btn[data-item="'+cssEscape(p1)+'"][data-prio="'+slot+'"]').forEach(button=>{
            button.classList.add(slot === "p0" ? "p0active" : "active");
          });
        });
      }
      return result;
    };
  }

  const originalBuildSavePrioUrl = window.buildSavePrioUrl;
  if(typeof originalBuildSavePrioUrl === "function"){
    window.buildSavePrioUrl = function(){
      const base=originalBuildSavePrioUrl.apply(this,arguments);
      const p1=document.getElementById("p1")?.value || "";
      const p2=document.getElementById("p2")?.value || "";
      const p3=document.getElementById("p3")?.value || "";
      const selected=Boolean(window.p0WasClicked || window.p0PlusWasClicked) && p1 && p1===p2 && p2===p3;
      // MC enthält die neuen Parameter bereits direkt. Doppelte Query-Parameter
      // würden von Express als Array gelesen und dadurch als "nein" gewertet.
      if(/[?&]p0Selected=/.test(base)) return base;
      const joiner=base.includes("?") ? "&" : "?";
      return base+joiner+"p0Selected="+encodeURIComponent(selected ? "ja" : "nein")+
        "&p0Item="+encodeURIComponent(selected ? p1 : "");
    };
  }

  const originalGetLiveDraftPrio = window.getLiveDraftPrio;
  if(typeof originalGetLiveDraftPrio === "function"){
    window.getLiveDraftPrio = function(){
      const draft=originalGetLiveDraftPrio.apply(this,arguments);
      if(!draft) return draft;
      const selected=Boolean(window.p0WasClicked || window.p0PlusWasClicked) && draft.P1 && draft.P1===draft.P2 && draft.P2===draft.P3;
      draft.P0Selected=selected ? "ja" : "nein";
      draft.P0Item=selected ? draft.P1 : "";
      return draft;
    };
  }

  const originalPrioIsP0 = window.lichtlootPrioIsP0;
  window.lichtlootPrioIsP0 = function(prio){
    const selected=String(prio?.P0Selected || prio?.p0Selected || "").trim().toLowerCase();
    if(["ja","yes","true","1","p0","po"].includes(selected)) return true;
    if(prio?.P0Item || prio?.p0Item) return true;
    return typeof originalPrioIsP0 === "function" ? originalPrioIsP0(prio) : false;
  };
  window.getPrioSaveStatus=function(){
    let status=document.getElementById("prioSaveStatus");
    if(!status){
      status=document.createElement("div");status.id="prioSaveStatus";
      status.setAttribute("role","status");status.setAttribute("aria-live","polite");
      status.style.cssText="margin:10px 0;line-height:1.5;overflow-wrap:anywhere";
      const button=document.querySelector('button[onclick="savePrio()"]');
      if(button)button.insertAdjacentElement("afterend",status);else document.body.appendChild(status);
    }
    return status;
  };
  let savingPrio=false;
  const originalSavePrio=window.savePrio;
  if(typeof originalSavePrio === "function") window.savePrio=async function(){
    if(savingPrio)return;
    savingPrio=true;
    const status=window.getPrioSaveStatus();status.textContent="Auswahl wird geprüft …";
    try{
      if(window.p0PlusWasClicked && !p0PlusEnabled()){
        window.p0PlusWasClicked=false;window.p0WasClicked=true;
      }
      return await originalSavePrio.apply(this,arguments);
    }catch(error){
      status.textContent="Speichern fehlgeschlagen: "+(error.message||"Bitte erneut versuchen.");
    }finally{savingPrio=false;}
  };
  const originalRenderLootList=window.renderLootList;
  if(typeof originalRenderLootList === "function") window.renderLootList=function(){
    const result=originalRenderLootList.apply(this,arguments);
    refreshP0PlusButtons();
    return result;
  };
})();
