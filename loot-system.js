(function(){
  'use strict';
  window.GuildLootMode = {apply(guild){
    const dkp = new URLSearchParams(location.search).get('random') !== '1' && (guild?.lootSystem || guild?.layout?.lootSystem) === 'dkp';
    document.documentElement.classList.toggle('guild-dkp',dkp);
    const labels=[['[data-start-nav="p0plus"] span','DKP-Liste'],['button[onclick="openP0PlusPanel()"] .side-label','DKP-Punkte'],['#p0PlusPanel > summary','DKP-Punkte bearbeiten'],['#p0plusOverlay h2','DKP-Übersicht'],['#ownP0PlusModal h2','Meine DKP']];
    labels.forEach(([selector,label])=>document.querySelectorAll(selector).forEach(el=>{if(!el.dataset.prioLabel)el.dataset.prioLabel=el.textContent;el.textContent=dkp?label:el.dataset.prioLabel;}));
    const card=document.getElementById('dashboardDkpCard');if(card)card.hidden=!dkp;
    if(dkp && card && window.GuildLootDKP){window.GuildLootDKP.mount('dashboardDkpContent',{guild:guild?.slug,ownOnly:true,credentials:()=>({playerPin:typeof getStoredLichtLootPlayerPin==='function'?getStoredLichtLootPlayerPin():''})});}
    let link=document.getElementById('guildDkpLink');
    if(!dkp){link?.remove();return;}
    if(!link){
      link=document.createElement('a');link.id='guildDkpLink';link.textContent='DKP · Konten & Lootvergabe →';
      link.style.cssText='display:block;position:relative;z-index:20;margin:18px auto;padding:15px 20px;width:fit-content;max-width:90%;border:1px solid #facc15;border-radius:12px;background:#111d30;color:#facc15;font:700 16px system-ui;text-decoration:none;text-align:center';
      document.body.prepend(link);
    }
    const base=location.pathname.includes('/loot/')?'../':'';
    link.href=base+'dkp.html?guild='+encodeURIComponent(guild?.slug || new URLSearchParams(location.search).get('guild') || '');
    if(!document.getElementById('guildDkpStyle')){
      const style=document.createElement('style');style.id='guildDkpStyle';
      style.textContent='html.guild-dkp button[onclick="savePrio()"],html.guild-dkp #prioCard,html.guild-dkp #prio1,html.guild-dkp #prio2,html.guild-dkp #prio3,html.guild-dkp .prio-select-grid,html.guild-dkp [data-prio],html.guild-dkp #playerCard,html.guild-dkp #dashboardMyPriosResults,html.guild-dkp .p0plus-search-box,html.guild-dkp #emergencyPrioButton,html.guild-dkp button[onclick="openP0PlusPointsUpdate()"]{display:none!important}html.guild-dkp #p0plusOverlay .p0plus-box{background:#0d1728!important;width:min(900px,94vw)!important}';
      document.head.appendChild(style);
    }
  }};
})();
