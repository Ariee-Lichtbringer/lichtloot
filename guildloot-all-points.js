(function(){
'use strict';
const raids={mc:409,bwl:469,ony:249,zg:309,aq20:509,aq40:531,naxx:533,'zg-mittwoch':309,'zg-prime':309,'zg-late':309};
const labels={mc:'MC',bwl:'BWL',ony:'Onyxia',zg:'ZG',aq20:'AQ20',aq40:'AQ40',naxx:'Naxx','zg-mittwoch':'ZG Mittwoch','zg-prime':'ZG Prime','zg-late':'ZG Late'};
function build({guild,entries,catalogs}){
 if(!guild||!Array.isArray(entries))throw Error('Unvollständige Punktedaten.');
 const grouped=Object.fromEntries(Object.keys(raids).map(r=>[r,[]]));
 for(const entry of entries){
  const raid=String(entry.raid||'').trim().toLowerCase();
  if(!grouped[raid])throw Error('Unbekannter Raid im Punktestand: '+raid+'. Es wurde kein unvollständiger Export erstellt.');
  if(!entry.player||!entry.item||!Number.isFinite(Number(entry.points))||Number(entry.points)<0)throw Error('Ungültiger Punktestand.');
  grouped[raid].push(entry);
 }
 const blocks=['GLPA1'];let count=0;
 for(const [key,instanceId] of Object.entries(raids)){
  const result=GuildLootPrioDownload.buildPrioExport({guild:{slug:guild},raid:{id:'points:'+key,name:labels[key]+' · P0+-Punkte',raid_date:new Date().toISOString().slice(0,10)},prios:[],points:grouped[key],items:catalogs[key]||[],instanceId});
  if(result.warnings.length)throw Error(result.warnings.join(' ')+' Export abgebrochen, damit keine Punkte fehlen.');
  blocks.push(result.text);count+=result.entries;
 }
 return {text:blocks.join('\n'),entries:count};
}
async function exportAll(){
 const button=document.getElementById('guildlootAllPointsButton'),status=document.getElementById('guildlootAllPointsStatus'),box=document.getElementById('guildlootAllPointsText'),copy=document.getElementById('guildlootAllPointsCopy');
 button.disabled=true;box.hidden=true;copy.hidden=true;box.value='';status.textContent='Aktuelle Punkte aller Raids werden geladen …';
 try{
  const guild=typeof CURRENT_GUILD_SLUG!=='undefined'?CURRENT_GUILD_SLUG:currentGuildSlug();
  const api=typeof LICHTLOOT_API_URL!=='undefined'?LICHTLOOT_API_URL:APPS_SCRIPT_URL;
  async function get(action,extra={}){
   const url=new URL(api);url.search=new URLSearchParams({action,guild,all:1,nocache:1,t:Date.now(),...extra});
   const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(30000)});const result=await response.json();
   if(!response.ok||!result.success)throw Error(result.error||'Daten konnten nicht geladen werden.');return result;
  }
  const points=await get('getP0Plus',{addon:1});
  if(!Array.isArray(points.entries))throw Error('Punktestand fehlt.');
  const catalogs={};
  await Promise.all([...new Set(points.entries.map(e=>e.raid))].map(async raid=>{
   const result=await get('getLootItems',{raid:raid.startsWith('zg-')?'zg':raid});
   if(!Array.isArray(result.items))throw Error('Itemliste fehlt: '+raid);
   catalogs[raid]=result.items.map(i=>({name:i.name,item_id:i.itemId||i.ItemID}));
  }));
  const result=build({guild,entries:points.entries,catalogs});
  box.value=result.text;box.hidden=false;copy.hidden=false;box.focus();box.select();
  status.textContent=result.entries+' Punkte-Konten · Stand '+new Date().toLocaleString('de-DE')+'. Im Addon ab Version 0.4.0: /gle → Importieren → einfügen → Import übernehmen. Die Raid-Prioliste bleibt erhalten.';
 }catch(e){status.textContent=e.message;}finally{button.disabled=false;}
}
globalThis.GuildLootAllPoints={build,exportAll};
if(typeof document!=='undefined'){
 document.getElementById('guildlootAllPointsButton')?.addEventListener('click',exportAll);
 document.getElementById('guildlootAllPointsCopy')?.addEventListener('click',async()=>{
  const box=document.getElementById('guildlootAllPointsText');box.focus();box.select();
  try{await navigator.clipboard.writeText(box.value);document.getElementById('guildlootAllPointsStatus').textContent='Kopiert. Im Addon: /gle → Importieren → einfügen → Import übernehmen.';}
  catch(e){document.getElementById('guildlootAllPointsStatus').textContent='Export markiert. Bitte mit Strg+C oder Cmd+C kopieren.';}
 });
}
})();
