/* Public guild character lookup; account IDs, PINs and point notes stay private. */
(()=>{
 const el=(tag,text,cls)=>{const node=document.createElement(tag);node.textContent=text;if(cls)node.className=cls;return node;};
 async function request(action,params,signal){
  const base='https://lichtloot-production.up.railway.app/api/apps-script';
  const url=new URL(typeof withGuildUrl==='function'?withGuildUrl(base):base);url.searchParams.set('action',action);
  for(const [key,value] of Object.entries(params))url.searchParams.set(key,value);
  const response=await fetch(url,{signal});if(!response.ok)throw Error('Spielerdaten konnten nicht geladen werden.');
  const data=await response.json();if(!data.success)throw Error('Spielerdaten konnten nicht geladen werden.');return data;
 }
 async function open(player,opener){
  const dialog=el('dialog','','item-search-dialog player-search-dialog');dialog.setAttribute('aria-labelledby','searchPlayerTitle');
  const controller=new AbortController();
  const close=el('button','✕','item-search-close');close.type='button';close.setAttribute('aria-label','Spielerprofil schließen');close.onclick=()=>dialog.close();
  const title=el('h2',player.name,'item-search-title');title.id='searchPlayerTitle';
  const detail=el('p',[player.server||'Server nicht hinterlegt',player.className].filter(Boolean).join(' · '),'item-search-origin');
  const classes={priest:'priester',priester:'priester',mage:'magier',magier:'magier',warrior:'krieger',krieger:'krieger',rogue:'schurke',schurke:'schurke',druid:'druide',druide:'druide',warlock:'hexenmeister',hexenmeister:'hexenmeister',paladin:'paladin',shaman:'schamane',schamane:'schamane',hunter:'jäger',jäger:'jäger'};
  const header=el('header','','player-search-header'),identity=el('div');identity.append(title,detail);
  const classKey=classes[String(player.className||'').trim().toLowerCase()];
  if(classKey){const icon=el('img','','player-search-class-icon');icon.src=['schamane','jäger'].includes(classKey)?`https://wow.zamimg.com/images/wow/icons/large/classicon_${classKey==='schamane'?'shaman':'hunter'}.jpg`:`images/${classKey==='paladin'?'Pala':classKey}.png`;icon.alt=player.className;icon.onerror=()=>icon.remove();header.append(icon);}
  header.append(identity);
  const gear=el('button','Ausrüstung / Paperdoll öffnen','player-search-gear');gear.type='button';
  gear.disabled=!player.server||typeof window.openPrioPlayerGear!=='function';
  gear.onclick=()=>{dialog.close();window.openPrioPlayerGear(player.name,player.server);};
  const hint=el('p',!player.server?'Für die Gear-Ansicht fehlt die Serverzuordnung.':'Ausrüstung nach verfügbarem Armory- oder Log-Datenstand.','item-search-origin');
  const points=el('div','P0+-Punkte werden geladen …','player-search-points');points.setAttribute('role','status');
  dialog.append(close,header,gear,hint,el('h3','P0+-Punkte'),points);document.body.append(dialog);
  dialog.addEventListener('close',()=>{controller.abort();dialog.remove();opener?.focus();});
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
  dialog.showModal();close.focus();
  try{
   const data=await request('getSearchPlayerPoints',{player:player.name,server:player.server},controller.signal);
   if(!dialog.open)return;points.replaceChildren();
   if(!data.entries.length){points.textContent='Für diesen Charakter sind keine P0+-Punkte gespeichert.';return;}
   const fmt=value=>Number(value).toLocaleString('de-DE',{maximumFractionDigits:2});
   const summary=el('div','','player-search-total');summary.append(el('strong',`${fmt(data.total)} P0+`),el('span','Gesamt über alle Raidbereiche'));points.append(summary);
   const groups=new Map();for(const row of data.entries){if(!groups.has(row.raid))groups.set(row.raid,[]);groups.get(row.raid).push(row);}
   for(const [raid,rows] of groups){
    const section=el('section','','player-search-point-group');const heading=el('h4',raid.toUpperCase());heading.append(el('span',`${fmt(rows.reduce((sum,row)=>sum+Number(row.points),0))} P0+`));section.append(heading);
    const list=el('ul','');for(const row of rows){
     const li=el('li'),item=row.itemDetails,button=el('button','','player-search-item');button.type='button';
     const quality=window.GuildLootItems.qualityClass(item?.quality||row.quality);
     const icon=el('img','','player-search-item-icon');icon.src=window.GuildLootItems.iconUrl(item||{});icon.alt='';icon.onerror=()=>{icon.onerror=null;icon.src=window.GuildLootItems.iconUrl({});};
     button.append(icon,el('span',row.item,`player-search-item-name ${quality}`),el('strong',`${fmt(row.points)} P0+`,'player-search-point-badge'));
     if(item){button.setAttribute('aria-label',`${row.item}: ${fmt(row.points)} P0+ – Tooltip öffnen`);button.onclick=()=>window.GuildLootItems.open(item,button);}
     else{button.disabled=true;button.title='Für dieses Item sind noch keine Tooltipdaten verfügbar.';}
     li.append(button);list.append(li);
    }section.append(list);points.append(section);
   }
  }catch(error){if(error.name!=='AbortError'&&dialog.open)points.textContent='Punkte konnten nicht geladen werden. Bitte das Profil erneut öffnen.';}
 }
 window.GuildLootPlayers={search:(q,signal)=>request('searchGuildPlayers',{q},signal),open};
})();
