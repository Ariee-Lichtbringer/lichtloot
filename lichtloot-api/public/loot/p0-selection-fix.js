(function(){
  "use strict";

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
    window.setP0Plus = function(){
      const result=originalSetP0Plus.apply(this,arguments);
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
      const selected=Boolean(window.p0WasClicked) && p1 && p1===p2 && p2===p3;
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
      const selected=Boolean(window.p0WasClicked) && draft.P1 && draft.P1===draft.P2 && draft.P2===draft.P3;
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
})();
