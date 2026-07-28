(function(){
  const KAESE_NAME="Kaese";

  function isNachtloot(){
    return typeof currentGuildSlug==="function" && currentGuildSlug()==="nachtloot";
  }

  function statusMessage(){
    const status=document.getElementById("playerStatus");
    if(status){
      status.innerHTML='<span class="warn">Rekrutenregel: P1 ist automatisch Kaese. Du kannst nur P2 und P3 auswählen.</span>';
    }
  }

  function refreshControls(){
    const restricted=Boolean(window.nachtlootRecruitRestricted);
    const p1=document.getElementById("p1");
    if(p1){
      if(restricted){
        const hasKaese=Array.from(p1.options || []).some(option=>option.value===KAESE_NAME);
        if(!hasKaese) p1.add(new Option(KAESE_NAME,KAESE_NAME));
        p1.value=KAESE_NAME;
      }
      p1.disabled=restricted;
      p1.title=restricted ? "Als Rekrut ist P1 automatisch Kaese." : "";
    }
    document.querySelectorAll('[data-prio="p1"],[data-prio="p0plus"]').forEach(button=>{
      button.disabled=restricted;
      button.style.opacity=restricted ? ".38" : "";
      button.style.cursor=restricted ? "not-allowed" : "";
      button.title=restricted ? "Als Nachtwächter-Rekrut kannst du nur P2 und P3 setzen." : "";
    });
  }

  window.applyNachtlootRecruitPrioRule=function(recruitStatusLifted){
    window.nachtlootRecruitRestricted=isNachtloot() && !Boolean(recruitStatusLifted);
    if(window.nachtlootRecruitRestricted){
      window.p0PlusWasClicked=false;
      const p1=document.getElementById("p1");
      if(p1) p1.value=KAESE_NAME;
      statusMessage();
    }
    refreshControls();
    if(typeof updateActiveButtons==="function") updateActiveButtons();
  };

  document.addEventListener("DOMContentLoaded",function(){
    if(!isNachtloot()) return;

    const originalSetPrio=window.setPrio;
    window.setPrio=function(slot,itemName){
      if(window.nachtlootRecruitRestricted && slot==="p1"){
        statusMessage();
        refreshControls();
        return;
      }
      return originalSetPrio.apply(this,arguments);
    };

    const originalSetP0Plus=window.setP0Plus;
    window.setP0Plus=function(){
      if(window.nachtlootRecruitRestricted){
        statusMessage();
        refreshControls();
        return;
      }
      return originalSetP0Plus.apply(this,arguments);
    };

    const originalManualSelectChanged=window.manualSelectChanged;
    window.manualSelectChanged=function(){
      if(window.nachtlootRecruitRestricted){
        const p1=document.getElementById("p1");
        if(p1) p1.value=KAESE_NAME;
      }
      const result=originalManualSelectChanged.apply(this,arguments);
      refreshControls();
      return result;
    };

    const originalRenderLootList=window.renderLootList;
    window.renderLootList=function(){
      const result=originalRenderLootList.apply(this,arguments);
      refreshControls();
      return result;
    };

    const originalFillItems=window.fillItems;
    window.fillItems=function(){
      const result=originalFillItems.apply(this,arguments);
      refreshControls();
      return result;
    };
  });
})();
