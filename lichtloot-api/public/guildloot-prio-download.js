(function(){
'use strict';
const fail=s=>new Error(s);
const norm=v=>String(v??'').trim().normalize('NFC').toLowerCase();
function buildPrioExport({guild,raid,prios,points,items,instanceId}){
  if(!instanceId)throw fail('Dieser Raid wird von der Classic-Era-Beta noch nicht unterstützt.');
  const encode=v=>encodeURIComponent(String(v??''));
  const lines=[['GLP1',guild.slug,raid.external_raid_id||raid.id,raid.name||raid.raid_type,Math.floor(Date.now()/1000),instanceId,guild.server||'',String(raid.raid_date instanceof Date?raid.raid_date.toISOString().slice(0,10):raid.raid_date).slice(0,10)].map(encode).join('|')];
  const warnings=[],seen=new Set();
  function add(row,itemId,itemName,priority){
    if(!Number.isSafeInteger(Number(itemId))||Number(itemId)<1){warnings.push(`Keine Item-ID für ${row.Spieler}: ${itemName}.`);return;}
    const realm=row.Server||'';
    const key=[itemId,row.Spieler,realm,priority].join('|');if(seen.has(key))return;seen.add(key);
    const total=points.filter(p=>norm(p.player)===norm(row.Spieler)&&norm(p.server)===norm(realm)&&norm(p.item)===norm(itemName)).reduce((n,p)=>n+Number(p.points||0),0);
    if(!Number.isFinite(total))throw fail('Ungültiger Punktestand.');
    const bench=row.staffBenched===true||['ja','true','1','bench'].includes(norm(row.Bench));
    lines.push([itemId,itemName,row.Spieler,realm,priority,total,row.Klasse||'',bench?1:0].map(encode).join('|'));
  }
  for(const row of prios){
    for(const slot of ['P1','P2','P3'])if(row[slot])add(row,row[`${slot}ItemId`],row[slot],slot);
    if(row.P0Item){const matches=items.filter(i=>norm(i.name)===norm(row.P0Item));const ids=[...new Set(matches.map(i=>Number(i.item_id)))];add(row,ids.length===1?ids[0]:null,row.P0Item,norm(row.P0Plus)==='ja'?'P0+':'P0');}
  }
  // Include point accounts for all players of this raid type, even without a current priority.
  for(const p of points){
    const matches=items.filter(i=>norm(i.name)===norm(p.item));const ids=[...new Set(matches.map(i=>Number(i.item_id)))];
    const already=prios.some(r=>norm(r.Spieler)===norm(p.player)&&norm(r.Server)===norm(p.server)&&[r.P1,r.P2,r.P3,r.P0Item].some(i=>norm(i)===norm(p.item)));
    if(!already)add({Spieler:p.player,Server:p.server},ids.length===1?ids[0]:null,p.item,'Punkte');
  }
  return {text:lines.join('\n'),warnings:[...new Set(warnings)],entries:lines.length-1};
}
const instances={mc:409,bwl:469,ony:249,zg:309,'zg-mittwoch':309,'zg-prime':309,'zg-late':309,aq20:509,aq40:531,naxx:533};
function mount(host,options){
 if(!host)return;
 host.innerHTML='<div style="margin:12px 0;padding:14px;border:1px solid #52677d;border-radius:10px"><button type="button" class="small-btn good" data-export>GuildLoot-Addon: Prios + aktuelle P0+-Punkte</button><p style="margin:8px 0;font-size:14px">Auch bei archivierten Raids: damalige Prioliste mit dem heutigen Punktestand.</p><div data-status role="status"></div><textarea data-text hidden rows="6" aria-label="GuildLoot-Export zum Kopieren" style="box-sizing:border-box;width:100%;margin-top:10px;font:14px/1.5 monospace"></textarea><button type="button" class="small-btn ghost" data-download hidden>Exportdatei herunterladen</button></div>';
 const button=host.querySelector('[data-export]'),status=host.querySelector('[data-status]'),box=host.querySelector('[data-text]'),download=host.querySelector('[data-download]');let exported='';
 async function get(action,extra={}){
  const url=new URL(options.api);url.search=new URLSearchParams({action,guild:options.guild,t:Date.now(),...extra});
  const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(30000)});const data=await response.json();
  if(!response.ok||data.success===false||data.error)throw Error(data.error||'Daten konnten nicht geladen werden.');return data;
 }
 button.onclick=async()=>{
  button.disabled=true;box.hidden=true;download.hidden=true;exported='';status.textContent='Prioliste und aktuelle Punkte werden geladen …';
  try{
   const key=String(options.raid.raid||'').toLowerCase(),instanceId=instances[key];
   if(!instanceId)throw Error('Für diesen Raid ist der Era-Export noch nicht verfügbar.');
   const raidId=String(options.raid.raidId||options.raid.id||'');if(!raidId)throw Error('Raid-ID fehlt.');
   const [prios,points,catalog]=await Promise.all([get('getPublishedPrios',{raidId}),get('getP0Plus',{raid:key,all:1,nocache:1}),get('getLootItems',{raid:key.startsWith('zg-')?'zg':key})]);
   if(!Array.isArray(prios.prios)||!Array.isArray(points.entries)||!Array.isArray(catalog.items))throw Error('Unvollständige Antwort. Es wurde kein Export erstellt.');
   const result=buildPrioExport({guild:{slug:options.guild},raid:{id:raidId,name:options.raid.raidName||key.toUpperCase(),raid_date:options.raid.raidDate||options.raid.date},instanceId,prios:prios.prios,points:points.entries,items:catalog.items.map(i=>({name:i.name,item_id:i.itemId||i.ItemID}))});
   if(!host.isConnected)return;
   exported=result.text;box.value=exported;box.hidden=false;download.hidden=false;box.focus();box.select();
   status.textContent=result.entries+' Einträge. In WoW /gle → Importfeld → Einfügen → Übernehmen. Aktuelle Punkte, Stand '+new Date().toLocaleString('de-DE')+'.'+(result.warnings.length?' Hinweise: '+result.warnings.join(' '):'');
  }catch(e){if(host.isConnected)status.textContent=e.message;}finally{button.disabled=false;}
 };
 download.onclick=()=>{if(!exported)return;const url=URL.createObjectURL(new Blob([exported],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=String(options.raid.raidId||'raid').replace(/[^a-zA-Z0-9_-]/g,'_')+'-guildloot-punkte.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
}
globalThis.GuildLootPrioDownload={mount,buildPrioExport};
})();
