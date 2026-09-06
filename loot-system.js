(function(){
  'use strict';
  let activeGuild=null,observer=null;
  function catalogButtons(){
    if(!document.documentElement.classList.contains('guild-dkp'))return;
    document.querySelectorAll('.loot-item-row').forEach(row=>{
      if(row.querySelector('.dkp-item-action'))return;
      const item=row.querySelector('[data-item]')?.dataset.item||row.querySelector('.item-with-icon span')?.textContent;
      if(!item)return;
      const button=document.createElement('button');button.className='mini-btn dkp-item-action';button.textContent='DKP · Vergabe & Historie';
      button.addEventListener('click',()=>{
        const dialog=document.createElement('dialog');dialog.style.cssText='width:min(1200px,96vw);height:90vh;padding:12px;background:#080f1c;border:1px solid #facc15;border-radius:12px;color:white';
        const close=document.createElement('button');close.textContent='Schließen';close.style.cssText='padding:10px;margin-bottom:8px';close.onclick=()=>dialog.close();
        const iframe=document.createElement('iframe');iframe.title='DKP: '+item;iframe.style.cssText='display:block;width:100%;height:calc(100% - 52px);border:0';
        const base=location.pathname.includes('/loot/')?'../':'';
        const raid=typeof RAID_NAME!=='undefined'?RAID_NAME:'';
        iframe.src=base+'dkp.html?'+new URLSearchParams({guild:activeGuild||'',item,raid});
        dialog.append(close,iframe);document.body.append(dialog);dialog.addEventListener('close',()=>{dialog.remove();button.focus();});dialog.showModal();
      });row.append(button);
    });
  }
  window.GuildLootMode = {apply(guild){
    const dkp = new URLSearchParams(location.search).get('random') !== '1' && (guild?.lootSystem || guild?.layout?.lootSystem) === 'dkp';
    document.documentElement.classList.toggle('guild-dkp',dkp);
    const labels=[['[data-start-nav="p0plus"] span','DKP-Liste'],['button[onclick="openP0PlusPanel()"] .side-label','DKP-Punkte'],['#p0PlusPanel > summary','DKP-Punkte bearbeiten'],['#p0plusOverlay h2','DKP-Übersicht'],['#ownP0PlusModal h2','Meine DKP']];
    labels.forEach(([selector,label])=>document.querySelectorAll(selector).forEach(el=>{if(!el.dataset.prioLabel)el.dataset.prioLabel=el.textContent;el.textContent=dkp?label:el.dataset.prioLabel;}));
    const card=document.getElementById('dashboardDkpCard');if(card)card.hidden=!dkp;
    if(dkp && card && window.GuildLootDKP){window.GuildLootDKP.mount('dashboardDkpContent',{guild:guild?.slug,ownOnly:true,credentials:()=>({playerPin:typeof getStoredLichtLootPlayerPin==='function'?getStoredLichtLootPlayerPin():''})});}
    let link=document.getElementById('guildDkpLink');
    activeGuild=guild?.slug || new URLSearchParams(location.search).get('guild') || '';
    if(!dkp){link?.remove();return;}
    catalogButtons();
    if(!observer){observer=new MutationObserver(catalogButtons);observer.observe(document.body,{childList:true,subtree:true});}
    if(!link){
      link=document.createElement('a');link.id='guildDkpLink';link.textContent='DKP · Konten & Lootvergabe →';
      link.style.cssText='display:block;position:relative;z-index:20;margin:18px auto;padding:15px 20px;width:fit-content;max-width:90%;border:1px solid #facc15;border-radius:12px;background:#111d30;color:#facc15;font:700 16px system-ui;text-decoration:none;text-align:center';
      document.body.prepend(link);
    }
    const base=location.pathname.includes('/loot/')?'../':'';
    link.href=base+'dkp.html?guild='+encodeURIComponent(guild?.slug || new URLSearchParams(location.search).get('guild') || '');
    if(!document.getElementById('guildDkpStyle')){
      const style=document.createElement('style');style.id='guildDkpStyle';
      style.textContent='.dkp-item-action{display:none}html.guild-dkp .dkp-item-action{display:block}html.guild-dkp .item-p0plus-line{display:none!important}html.guild-dkp button[onclick="savePrio()"],html.guild-dkp #prioCard,html.guild-dkp #prio1,html.guild-dkp #prio2,html.guild-dkp #prio3,html.guild-dkp .prio-select-grid,html.guild-dkp [data-prio],html.guild-dkp #playerCard,html.guild-dkp #dashboardMyPriosResults,html.guild-dkp .p0plus-search-box,html.guild-dkp #emergencyPrioButton,html.guild-dkp button[onclick="openP0PlusPointsUpdate()"]{display:none!important}html.guild-dkp #p0plusOverlay .p0plus-box{background:#0d1728!important;width:min(900px,94vw)!important}';
      document.head.appendChild(style);
    }
  }};
})();
