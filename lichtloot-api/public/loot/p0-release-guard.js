(function(){
  const ERROR_MESSAGE="Du hast keine P0+-Berechtigung für diesen Raid.";
  window.currentRaidP0ReleaseChecked=false;
  window.currentRaidP0Allowed=false;
  window.poReleaseRequirementEnabled=true;

  function isBlocked(){
    return window.poReleaseRequirementEnabled!==false
      && (!window.currentRaidP0ReleaseChecked || !window.currentRaidP0Allowed);
  }

  function showError(message){
    const status=document.getElementById("playerStatus");
    if(status) status.innerHTML='<span class="bad">'+message+'</span>';
  }

  function refreshButtons(){
    const blocked=isBlocked();
    document.querySelectorAll('[data-prio="p0plus"]').forEach(button=>{
      button.disabled=blocked;
      button.style.opacity=blocked ? ".38" : "";
      button.style.cursor=blocked ? "not-allowed" : "";
      button.title=blocked ? ERROR_MESSAGE : "";
    });
  }

  window.resetCurrentRaidPoReleaseGuard=function(){
    window.currentRaidP0ReleaseChecked=false;
    window.currentRaidP0Allowed=false;
    window.p0PlusWasClicked=false;
    refreshButtons();
  };

  window.applyCurrentRaidPoReleaseGuard=function(allowed){
    window.currentRaidP0ReleaseChecked=true;
    window.currentRaidP0Allowed=Boolean(allowed);
    if(!window.currentRaidP0Allowed) window.p0PlusWasClicked=false;
    if(typeof updateActiveButtons==="function") updateActiveButtons();
    refreshButtons();
  };

  window.applyPoReleaseRequirementSetting=function(enabled){
    window.poReleaseRequirementEnabled=enabled!==false;
    if(window.poReleaseRequirementEnabled===false){
      window.currentRaidP0ReleaseChecked=true;
      window.currentRaidP0Allowed=true;
    }
    if(typeof updateActiveButtons==="function") updateActiveButtons();
    refreshButtons();
  };

  document.addEventListener("DOMContentLoaded",function(){
    const originalSetP0Plus=window.setP0Plus;
    window.setP0Plus=function(){
      if(isBlocked()){
        window.p0PlusWasClicked=false;
        showError(ERROR_MESSAGE);
        refreshButtons();
        return;
      }
      return originalSetP0Plus.apply(this,arguments);
    };

    const originalSavePrio=window.savePrio;
    window.savePrio=async function(){
      const p1=document.getElementById("p1")?.value || "";
      const p2=document.getElementById("p2")?.value || "";
      const p3=document.getElementById("p3")?.value || "";
      const wantsP0=Boolean(window.p0PlusWasClicked) && p1 && p1===p2 && p2===p3;
      if(wantsP0 && isBlocked()){
        window.p0PlusWasClicked=false;
        showError(ERROR_MESSAGE);
        if(typeof updateActiveButtons==="function") updateActiveButtons();
        refreshButtons();
        return;
      }
      return originalSavePrio.apply(this,arguments);
    };

    const originalRenderLootList=window.renderLootList;
    window.renderLootList=function(){
      const result=originalRenderLootList.apply(this,arguments);
      refreshButtons();
      return result;
    };
    refreshButtons();
  });
})();
