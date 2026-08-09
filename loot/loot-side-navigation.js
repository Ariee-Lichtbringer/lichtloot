(function(){
  function go(path){
    window.location.href=typeof guildUrl==="function" ? guildUrl(path) : path;
  }
  function act(name){
    if(typeof window[name]==="function") window[name]();
  }
  function icon(name){
    return '<img class="loot-side-icon" src="../images/dashboard-icons/'+name+'" alt="">';
  }
  function link(label,iconName,onClick,active){
    return '<button type="button" class="loot-side-link'+(active?' active':'')+'" data-loot-action="'+onClick+'">'+icon(iconName)+'<span>'+label+'</span></button>';
  }

  document.addEventListener("DOMContentLoaded",function(){
    document.querySelector(".main-nav")?.remove();
    document.querySelector(".logo-banner-mini")?.remove();

    const sidebar=document.createElement("aside");
    sidebar.className="loot-sidebar";
    sidebar.innerHTML=
      '<img src="../images/content.png" alt="Lichtbringer Lootsystem" class="loot-sidebar-logo">'+
      '<nav class="loot-side-nav" aria-label="Seitennavigation">'+
        link("Dashboard","dashboard.jpg","dashboard",true)+
        '<details class="loot-side-group"><summary class="loot-side-summary">'+icon("worldbuffs.jpg")+'<span>Buffs</span><span class="loot-side-arrow">›</span></summary><div class="loot-side-items">'+
          link("Worldbuffs","worldbuffs.jpg","worldbuffs")+
          link("Hordenbuffs","hordenbuffs.jpg","hordenbuffs")+
        '</div></details>'+
        '<details class="loot-side-group"><summary class="loot-side-summary">'+icon("raidregeln.svg")+'<span>Raidinformationen</span><span class="loot-side-arrow">›</span></summary><div class="loot-side-items">'+
          link("Raidregeln","raidregeln.svg","raidregeln")+
          link("P0+ Übersicht","po-plus-liste.jpg","p0plus")+
        '</div></details>'+
        '<details class="loot-side-group"><summary class="loot-side-summary">'+icon("raidlead.jpg")+'<span>Raidorga</span><span class="loot-side-arrow">›</span></summary><div class="loot-side-items">'+
          link("Raid erstellen","raid-erstellen.svg","create")+
          '<div class="loot-side-login"><input id="raidleadPin" type="text" placeholder="Raidlead PIN"><button type="button" class="loot-side-link" data-loot-action="raidlead">Raidlead</button></div>'+
        '</div></details>'+
      '</nav>';
    document.body.insertBefore(sidebar,document.body.firstChild);

    sidebar.addEventListener("click",function(event){
      const button=event.target.closest("[data-loot-action]");
      if(!button) return;
      const action=button.dataset.lootAction;
      if(action==="dashboard") go("../start.html");
      else if(action==="worldbuffs") go("../worldbuffs.html");
      else if(action==="hordenbuffs") go("../hordenbuffs.html");
      else if(action==="raidregeln") typeof window.showLootRaidRules==="function" ? window.showLootRaidRules() : go("../raidregeln.html");
      else if(action==="p0plus") act("toggleP0PlusOverview");
      else if(action==="create") act("toggleRaidCreate");
      else if(action==="raidlead") act("raidleadLogin");
    });
    sidebar.querySelector("#raidleadPin")?.addEventListener("keydown",function(event){
      if(event.key==="Enter") act("raidleadLogin");
    });
  });
})();
