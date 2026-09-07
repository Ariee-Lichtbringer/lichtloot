/* Item comparison: base item values, explicit slots and independently reported set thresholds. */
(()=>{
 const exact=v=>String(v||'').trim().normalize('NFC').toLowerCase();
 const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const lines=item=>String(item?.tooltip||item?.tooltipText||item?.statsText||(Array.isArray(item?.stats)?item.stats.join('|'):'' )).split(/[|\n]/).map(s=>s.trim()).filter(Boolean);
 function slot(item){
  const s=norm(item?.slotType||item?.slot||item?.slotName).replace(/_/g,' ');
  const rules=[['twohand',/two.hand|zweihand/],['mainhand',/main.hand|waffenhand/],['offhand',/off.hand|schildhand/],['onehand',/one.hand|einh(?:and|andig)/],['head',/head|kopf/],['neck',/neck|hals/],['shoulder',/shoulder|schulter/],['back',/back|rucken|cloak/],['chest',/chest|brust|robe/],['wrist',/wrist|handgelenk/],['hands',/hands|hande|handschuh/],['waist',/waist|taille/],['legs',/legs|bein/],['feet',/feet|fuss|fu[ßs]e|stiefel/],['finger',/finger|ring/],['trinket',/trinket|schmuck/],['ranged',/ranged|distanz|fernkampf/]];
  return rules.find(([,r])=>r.test(s))?.[0]||'';
 }
 function candidates(item,gear){const target=slot(item);return gear.map((worn,index)=>({worn,index})).filter(({worn})=>{const equipped=slot(worn);if(target==='twohand')return ['mainhand','twohand'].includes(equipped);if(target==='onehand')return ['mainhand','offhand','onehand'].includes(equipped);return target&&target===equipped;});}
 const labels={weaponDps:'Waffen-DPS',speed:'Waffentempo (Sek.)',str:'Stärke',agi:'Beweglichkeit',sta:'Ausdauer',int:'Intelligenz',spi:'Willenskraft',armor:'Rüstung',healing:'Bonusheilung',spell:'Zauberschaden',ap:'Angriffskraft',mp5:'Mana / 5 Sek.',hit:'Trefferchance (%)',spellHit:'Zaubertrefferchance (%)',crit:'Kritische Trefferchance (%)',spellCrit:'Zauberkrit (%)',defense:'Verteidigung',fire:'Feuerwiderstand',frost:'Frostwiderstand',nature:'Naturwiderstand',shadow:'Schattenwiderstand',arcane:'Arkanwiderstand'};
 function stats(item){
  const values={},unknown=[];const add=(k,n)=>values[k]=(values[k]||0)+Number(String(n).replace(',','.'));
  const attributes={strength:'str',starke:'str',agility:'agi',beweglichkeit:'agi',stamina:'sta',ausdauer:'sta',intellect:'int',intelligenz:'int',spirit:'spi',willenskraft:'spi','fire resistance':'fire',feuerwiderstand:'fire','frost resistance':'frost',frostwiderstand:'frost','nature resistance':'nature',naturwiderstand:'nature','shadow resistance':'shadow',schattenwiderstand:'shadow','arcane resistance':'arcane',arkanwiderstand:'arcane'};
  for(const raw of lines(item)){
   const s=norm(raw);const dps=s.match(/(\d+(?:[.,]\d+)?)\s*(?:damage per second|schaden pro sekunde)/);if(dps)add('weaponDps',dps[1]);const speed=s.match(/(?:speed|tempo|geschwindigkeit)\s*(\d+(?:[.,]\d+)?)/);if(speed)add('speed',speed[1]);let m=s.match(/^\+(\d+)\s+(.+?)\.?$/);if(m&&attributes[m[2]]){add(attributes[m[2]],m[1]);continue;}
   m=s.match(/^(\d+)\s+(?:rustung|armor)$/);if(m){add('armor',m[1]);continue;}
   if(!/^(anlegen:|equip:)/.test(s))continue;
   if(/chance on|chance bei|when |against |gegen |beim |pro treffer|for \d+ sec|fur \d+ sek/.test(s)){unknown.push(raw);continue;}
   m=s.match(/(?:damage and healing|schaden und heilung).*?(\d+)/);if(m){add('spell',m[1]);add('healing',m[1]);continue;}
   m=s.match(/(?:healing|heilung).*?(\d+)/);if(m){add('healing',m[1]);continue;}
   m=s.match(/(?:spell damage|zauberschaden).*?(\d+)/);if(m){add('spell',m[1]);continue;}
   m=s.match(/(?:restores (\d+) mana per 5|alle 5 sek\.?(?:unden)?\s*(\d+).*?mana)/);if(m){add('mp5',m[1]||m[2]);continue;}
   m=s.match(/(?:\+(\d+) attack power|angriffskraft.*?(\d+))/);if(m){add('ap',m[1]||m[2]);continue;}
   m=s.match(/(?:defense|verteidigung).*?(\d+)/);if(m){add('defense',m[1]);continue;}
   m=s.match(/(\d+(?:[.,]\d+)?)\s*%/);if(m&&/crit|kritisch/.test(s)){add(/spell|zauber/.test(s)?'spellCrit':'crit',m[1]);continue;}
   if(m&&/hit|trefferchance/.test(s)){add(/spell|zauber/.test(s)?'spellHit':'hit',m[1]);continue;}
   unknown.push(raw);
  }
  return {values,unknown};
 }
 function setInfo(item){const all=lines(item),header=all.find(l=>/^.+\s*\(\d+\s*\/\s*\d+\)$/.test(l));if(!header)return null;return {name:header.replace(/\s*\(\d+\s*\/\s*\d+\)$/,''),bonuses:all.filter(l=>/^(?:\(\d+\)\s*)?Set:/i.test(l))};}
 function setChanges(before,after,templates=[]){
  const sets=new Map();for(const [side,gear] of [['before',before],['after',after],['template',templates]])for(const item of gear){const info=setInfo(item);if(!info)continue;const key=norm(info.name);if(!sets.has(key))sets.set(key,{name:info.name,before:0,after:0,bonuses:new Map()});const s=sets.get(key);if(side!=='template')s[side]++;for(const line of info.bonuses){const m=line.match(/^\((\d+)\)\s*Set:\s*(.*)/i);if(m)s.bonuses.set(Number(m[1]),m[2]);}}
  return [...sets.values()].filter(s=>s.before!==s.after).map(s=>({...s,changes:[...s.bonuses].filter(([n])=>(s.before>=n)!==(s.after>=n)).map(([n,text])=>({threshold:n,text,gained:s.after>=n})),known:s.bonuses.size>0}));
 }
 function compare(item,gear,index,templates=[]){
  const removed=[gear[index]];if(slot(item)==='twohand')removed.push(...gear.filter((g,i)=>i!==index&&slot(g)==='offhand'));
  const after=gear.filter(g=>!removed.includes(g)).concat(item),old={},fresh=stats(item);
  for(const worn of removed)for(const [k,v] of Object.entries(stats(worn).values))old[k]=(old[k]||0)+v;
  return {removed,rows:Object.keys(labels).filter(k=>old[k]||fresh.values[k]).map(k=>({key:k,label:labels[k],before:old[k]||0,after:fresh.values[k]||0,delta:(fresh.values[k]||0)-(old[k]||0)})),sets:setChanges(gear,after,templates),unknown:[...new Set([...removed.flatMap(g=>stats(g).unknown),...fresh.unknown])]};
 }
 function addTotals(rows,gear,characterStats={}){
  const mapping={str:'STRENGTH',agi:'AGILITY',sta:'STAMINA',int:'INTELLECT',spi:'SPIRIT',armor:'ARMOR',ap:'ATTACKPOWER',spell:'SPELLPOWER',healing:'BONUSHEALINGGEAR'};
  const equipment={};for(const item of gear)for(const [key,value] of Object.entries(stats(item).values))equipment[key]=(equipment[key]||0)+value;
  return rows.map(row=>{
   if(['weaponDps','speed'].includes(row.key))return {...row,totalBefore:null,totalAfter:null,totalSource:''};
   const raw=characterStats[mapping[row.key]],provided=raw!==null&&raw!==undefined&&raw!==''&&Number.isFinite(Number(raw));
   const totalBefore=provided?Number(raw):(equipment[row.key]||0);
   return {...row,totalBefore,totalAfter:totalBefore+row.delta,totalSource:provided?(row.key==='healing'?'Ausrüstung · Armory':'Charakter · Datenstand'):'Erkannte Ausrüstung'};
  });
 }
 const el=(tag,text,cls)=>{const n=document.createElement(tag);n.textContent=text||'';if(cls)n.className=cls;return n;};
 function mount(parent,item,context){
  if(!slot(item))return;
  const area=el('details','','item-compare');area.append(el('summary','Mit Charakter vergleichen'));parent.append(area);area.addEventListener('toggle',()=>window.dispatchEvent(new Event('resize')));
  const body=el('div','','item-compare-body');area.append(body);
  const selected=context||(typeof selectedDashboardCharacter==='function'?selectedDashboardCharacter():null);
  const known=typeof myLichtlootCharacters!=='undefined'&&Array.isArray(myLichtlootCharacters)?myLichtlootCharacters:[];
  const form=el('form'),nameLabel=el('label','Charakter'),realmLabel=el('label','Server'),name=el('input'),realm=el('input');name.required=true;realm.required=true;name.value=selected?.name||'';realm.value=selected?.server||'';name.autocomplete='off';realm.autocomplete='off';nameLabel.append(name);realmLabel.append(realm);
  if(known.length){const own=el('select');own.setAttribute('aria-label','Eigenen Charakter auswählen');own.append(new Option('Eigenen Charakter auswählen',''));known.forEach((c,i)=>own.append(new Option(`${c.name} · ${c.server}`,String(i))));own.onchange=()=>{const c=known[own.value];if(c){name.value=c.name;realm.value=c.server;}};form.append(own);}
  const load=el('button','Ausrüstung vergleichen');load.type='submit';form.append(nameLabel,realmLabel,load);body.append(form);
  const output=el('div','','item-compare-output');output.setAttribute('aria-live','polite');body.append(output);let generation=0;
  form.onsubmit=async event=>{event.preventDefault();const run=++generation,character={name:name.value.trim(),server:realm.value.trim()};if(!character.name||!character.server)return;
   output.textContent='Ausrüstung wird geladen …';load.disabled=true;
   try{
    const profile=await window.GuildLootGear.loadProfile(character.name,character.server);if(run!==generation||!area.isConnected)return;
    const latest=profile.latest||(profile.history||[]).at(-1)||{},gear=latest.gear||[],choices=candidates(item,gear);output.replaceChildren();
    output.append(el('p',`${character.name} · ${character.server} · ${latest.raid||latest.source||'Ausrüstungsdaten'}${latest.raidDate?' · '+latest.raidDate:''}`,'item-search-origin'));
    if(!choices.length){output.append(el('p','Für diesen Ausrüstungsplatz liegen keine passenden getragenen Items vor.'));return;}
    const choose=el('select');choose.setAttribute('aria-label','Zu ersetzendes Item');choices.forEach(({worn,index})=>choose.append(new Option(`${worn.slot||worn.slotName} · ${worn.name}`,String(index))));output.append(choose);
    const result=el('div');output.append(result);
    async function render(){const index=Number(choose.value),worn=gear[index];const renderRun=++generation;let template=null;
     result.textContent='Vergleich wird erstellt …';
     if(setInfo(worn)&&worn.itemId){try{const catalog=await window.GuildLootItems.search(String(worn.itemId));template=catalog.items.find(i=>String(i.itemId)===String(worn.itemId));}catch{}}
     if(renderRun!==generation||!area.isConnected)return;result.replaceChildren();
     const diff=compare(item,gear,index,template?[template]:[]),cards=el('div','','item-compare-cards');
     for(const [label,items] of [['Aktuell',diff.removed],['Geplant',[item]]]){const card=el('section');card.append(el('h4',label));for(const entry of items){const heading=el('p',entry.name,window.GuildLootItems.qualityClass(entry.quality)),img=el('img');img.src=window.GuildLootItems.iconUrl({...entry,icon:entry.icon||entry.iconUrl});img.alt='';heading.prepend(img);card.append(heading);const tooltip=el('details');tooltip.append(el('summary','Itemwerte anzeigen'),el('p',lines(entry).join('\n'),'item-compare-raw'));card.append(tooltip);if(entry.enchant)card.append(el('small','Verzauberung: '+entry.enchant));}cards.append(card);}result.append(cards);
     const table=el('table'),head=el('tr');['Wert','Gesamt vorher','Altes Item','Neues Item','Gesamt nachher*','Differenz'].forEach(t=>{const th=el('th',t);th.scope='col';head.append(th);});table.append(head);
     const fmt=n=>Number(n).toLocaleString('de-DE',{maximumFractionDigits:2});
     for(const row of addTotals(diff.rows,gear,latest.stats||{})){
      const tr=el('tr'),label=el('th',row.label);label.scope='row';tr.append(label);
      const total=el('td',row.totalBefore===null?'–':fmt(row.totalBefore));if(row.totalSource)total.append(el('small',row.totalSource,'item-compare-total-source'));tr.append(total);
      [fmt(row.before),fmt(row.after),row.totalAfter===null?'–':'≈ '+fmt(row.totalAfter)].forEach(t=>tr.append(el('td',t)));
      tr.append(el('td',(row.delta>0?'+':'')+fmt(row.delta),row.key==='speed'?'':row.delta>0?'compare-positive':row.delta<0?'compare-negative':''));table.append(tr);
     }
     const scroll=el('div','','item-compare-table-scroll');scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label','Wertevergleich mit Gesamtwerten');scroll.append(table);result.append(scroll);

     if(!diff.rows.length)result.append(el('p','Für diese Items sind keine automatisch vergleichbaren Zahlenwerte hinterlegt. Bitte die Itemwerte ansehen.'));
     result.append(el('p','* Gesamt nachher = Gesamt vorher − altes Item + neues Item. Das ist eine rechnerische Schätzung bei unveränderten Verzauberungen, Buffs und Talenten; deren Wechselwirkungen und geänderte Seteffekte werden nicht neu berechnet. Fehlt ein Charakterwert, steht ausdrücklich die Summe der erkannten Ausrüstungswerte dabei. Waffen-DPS und Tempo werden nicht über mehrere Waffen addiert.','item-search-origin'));
     const sets=el('section');sets.append(el('h4','Setboni'));if(!diff.sets.length)sets.append(el('p','Keine Änderung der erkannten Setteil-Anzahl.'));for(const s of diff.sets){sets.append(el('p',`${s.name}: ${s.before} → ${s.after} Teile`));if(!s.known)sets.append(el('p','Die benötigten Teilezahlen sind nicht hinterlegt. Aktivierung oder Verlust lässt sich nicht sicher bestimmen.'));else if(!s.changes.length)sets.append(el('p','Keine bekannte Setbonus-Schwelle überschritten.'));for(const change of s.changes)sets.append(el('p',`${change.gained?'Gewonnen':'Verloren'} (${change.threshold} Teile): ${change.text}`,change.gained?'compare-positive':'compare-negative'));}result.append(sets);
     if(diff.unknown.length){const effects=el('details');effects.append(el('summary','Weitere Effekte – separat beurteilen'));diff.unknown.forEach(line=>effects.append(el('p',line)));result.append(effects);}
     const save=el('button','Als Prio vormerken'),status=el('p','','item-search-origin');save.type='button';save.onclick=()=>{try{const key='guildloot:item-wishlist:v1',guild=typeof CURRENT_GUILD_SLUG!=='undefined'?CURRENT_GUILD_SLUG:new URLSearchParams(location.search).get('guild')||'lichtloot';const stored=JSON.parse(localStorage.getItem(key)||'[]');const entry={guild,character,itemId:item.itemId,name:item.name,raids:item.raids||[item.raid],createdAt:new Date().toISOString()};const list=Array.isArray(stored)?stored:[];const identity=e=>e.guild===guild&&exact(e.character?.name)===exact(character.name)&&exact(e.character?.server)===exact(character.server)&&String(e.itemId)===String(item.itemId);localStorage.setItem(key,JSON.stringify([...list.filter(e=>!identity(e)),entry]));status.textContent='Auf diesem Gerät vorgemerkt. Wähle auf der Raidseite den Termin und speichere dort deine Prio.';save.textContent='Vorgemerkt ✓';renderAccountWishlist();}catch{status.textContent='Die Vormerkung konnte auf diesem Gerät nicht gespeichert werden.';}};result.append(save,status);
     const raids=[...new Set(item.raids||[item.raid])];for(const raid of raids){const source=/^zg/.test(raid)?'zg':raid;if(!['mc','bwl','aq40','aq20','naxx','ony','zg'].includes(source))continue;const link=el('a',`${window.GuildLootItems.origins({raid})}: Prio eintragen`);const url=new URL(`/loot/${source}-loot.html`,location.origin);url.searchParams.set('itemSearch',item.name);url.searchParams.set('plannedFor',`${character.name} · ${character.server}`);url.hash='itemSearch';const scoped=typeof withGuildUrl==='function'?withGuildUrl(url.href):url.href;link.href=scoped;link.className='item-compare-raid-link';result.append(link);}
    }
    choose.onchange=()=>render();await render();
   }catch(error){if(run===generation&&area.isConnected)output.textContent=error.message||'Ausrüstung konnte nicht geladen werden.';}finally{load.disabled=false;}
  };
 }
 function currentGuild(){return typeof CURRENT_GUILD_SLUG!=='undefined'?CURRENT_GUILD_SLUG:new URLSearchParams(location.search).get('guild')||'lichtloot';}
 function matchingEntries(entries,guild,character){return entries.filter(e=>e.guild===guild&&(!character||(exact(e.character?.name)===exact(character.name)&&exact(e.character?.server)===exact(character.server))));}
 function renderWishlist(list,character,isOpen=()=>list.isConnected){
  list.replaceChildren();let saved=[];try{saved=JSON.parse(localStorage.getItem('guildloot:item-wishlist:v1')||'[]');}catch{}if(!Array.isArray(saved))saved=[];
  const entries=matchingEntries(saved,currentGuild(),character);if(!entries.length)list.append(el('p','Noch keine Items'+(character?' für diesen Charakter':' in dieser Gilde')+' vorgemerkt.'));
  for(const entry of entries){const row=el('section','','item-wishlist-row'),open=el('button',entry.name,'player-search-gear'),status=el('p','','item-search-origin');open.type='button';open.onclick=async()=>{open.disabled=true;status.textContent='Item wird geladen …';try{const result=await window.GuildLootItems.search(String(entry.itemId));const item=result.items.find(i=>String(i.itemId)===String(entry.itemId));if(!item)throw Error('Das vorgemerkte Item ist nicht mehr im Katalog vorhanden.');if(!isOpen())return;status.textContent='';window.GuildLootItems.open(item,open,entry.character);}catch(e){status.textContent=e.message;}finally{open.disabled=false;}};
   const remove=el('button','Entfernen');remove.type='button';remove.onclick=()=>{try{const current=JSON.parse(localStorage.getItem('guildloot:item-wishlist:v1')||'[]');localStorage.setItem('guildloot:item-wishlist:v1',JSON.stringify(current.filter(e=>!(e.guild===entry.guild&&exact(e.character?.name)===exact(entry.character?.name)&&exact(e.character?.server)===exact(entry.character?.server)&&String(e.itemId)===String(entry.itemId)))));renderWishlist(list,character,isOpen);renderAccountWishlist();}catch{status.textContent='Vormerkung konnte nicht entfernt werden.';}};
   row.append(el('p',`${entry.character?.name||''} · ${entry.character?.server||''}`),open,remove);
   for(const raid of [...new Set(entry.raids||[])]){const source=/^zg/.test(raid)?'zg':raid;if(!['mc','bwl','aq40','aq20','naxx','ony','zg'].includes(source))continue;const link=el('a',`${window.GuildLootItems.origins({raid})}: Prio eintragen`,'item-compare-raid-link');const url=new URL(`/loot/${source}-loot.html`,location.origin);url.searchParams.set('itemSearch',entry.name);url.searchParams.set('plannedFor',`${entry.character?.name||''} · ${entry.character?.server||''}`);url.searchParams.set('guild',entry.guild);url.hash='itemSearch';link.href=url.href;row.append(link);}
   row.append(status);list.append(row);
  }
 }
 function renderAccountWishlist(){const host=document.getElementById('dashboardItemWishlist');if(!host)return;const character=typeof selectedDashboardCharacter==='function'?selectedDashboardCharacter():null;host.replaceChildren();if(!character?.name||!character.server){host.append(el('p','Wähle einen Charakter, um seine vorgemerkten Items zu sehen.'));return;}renderWishlist(host,character);}
 function installWishlist(){
  renderAccountWishlist();
  const host=document.querySelector('.start-function-search');if(!host||document.getElementById('itemWishlistButton'))return;
  const button=el('button','Vorgemerkte Items','item-wishlist-button');button.id='itemWishlistButton';button.type='button';host.append(button);
  button.onclick=()=>{
   const dialog=el('dialog','','item-search-dialog');dialog.setAttribute('aria-label','Vorgemerkte Items');const close=el('button','Schließen','item-search-close');close.type='button';close.onclick=()=>dialog.close();dialog.append(close,el('h2','Vorgemerkte Items'),el('p','Auf diesem Gerät gespeichert. Raid-Prios werden erst auf der jeweiligen Raidseite eingetragen.','item-search-origin'));const list=el('div');dialog.append(list);renderWishlist(list,null,()=>dialog.open);document.body.append(dialog);dialog.addEventListener('close',()=>{dialog.remove();button.focus();},{once:true});dialog.showModal();
  };
 }
 window.addEventListener('storage',renderAccountWishlist);
 window.addEventListener('load',installWishlist,{once:true});
 window.GuildLootCompare={addTotals,matchingEntries,renderAccountWishlist,slot,candidates,stats,setInfo,setChanges,compare,mount};
})();
