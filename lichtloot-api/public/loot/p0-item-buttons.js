(function(){
  window.setP0 = function(itemName,itemId){
    window.p0PlusWasClicked=false;
    window.lastSavedPrioSignature="";
    ["p1","p2","p3"].forEach(function(slot){
      const select=document.getElementById(slot);
      if(!select)return;
      if(typeof window.setSelectedPrioItemId==="function")window.setSelectedPrioItemId(slot,itemId||"");
      if(typeof window.selectPrioOption==="function")window.selectPrioOption(slot,itemName,itemId||"");
      else select.value=itemName;
    });
    const status=document.getElementById("playerStatus");
    if(status)status.innerHTML='<span class="ok">✓ '+String(itemName||"").replace(/[<>&]/g,"")+' wurde als P0 ohne P0+-Punkte gesetzt.</span>';
    if(typeof window.renderSelectedPrioPreviews==="function")window.renderSelectedPrioPreviews();
    if(typeof window.autoSaveDraft==="function")window.autoSaveDraft();
    if(typeof window.updateActiveButtons==="function")window.updateActiveButtons();
  };
})();
