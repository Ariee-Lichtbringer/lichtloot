(function(){
'use strict';
function mount(hostId,selector){
const host=document.getElementById(hostId);if(!host)return;
host.innerHTML='<details style="margin:14px 0;border:1px solid #52677d;border-radius:12px;padding:14px"><summary style="cursor:pointer;color:#facc15;font-weight:700">Mein GuildLoot ins Addon exportieren</summary><p>Alle aktuellen Gilden-Punktestände, deine aktuellen Prios, P0-Freigaben und deinen Raidkalender. Die vollständige Raid-Prioliste kannst du zusätzlich auf der Lootseite exportieren.</p><button type="button" class="tool-btn" data-export>Persönlichen Export erstellen</button><p data-status role="status"></p><textarea hidden data-text rows="6" aria-label="Persönlicher Addon-Export" style="width:100%;box-sizing:border-box"></textarea><button hidden type="button" class="tool-btn" data-copy>Kopieren</button> <button hidden type="button" class="tool-btn" data-download>Herunterladen</button></details>';
const find=key=>host.querySelector('[data-'+key+']'),button=find('export'),status=find('status'),box=find('text');let exported='';
button.onclick=async()=>{
 button.disabled=true;exported='';box.value='';box.hidden=true;find('copy').hidden=true;find('download').hidden=true;
 try{
  const selection=document.getElementById(selector).value;
  const pin=getStoredLichtLootPlayerPin()||document.getElementById('myPriosPin').value.trim();let identity;
  try{identity=JSON.parse(selection);}catch(e){identity={name:selection,server:''};}
  if(!identity?.name||!pin)throw Error('Bitte Spieler-PIN eingeben, Charaktere laden und einen Charakter auswählen.');
  identity={name:identity.name,server:identity.server||''};
  status.textContent='Aktuelle Punkte, Prios und Freigaben werden geladen …';
  async function get(action,extra={}){
   const url=new URL(LICHTLOOT_API_URL);url.search=new URLSearchParams({action,guild:CURRENT_GUILD_SLUG,t:Date.now(),...extra});
   const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(30000)});const data=await response.json();
   if(!response.ok||data.success!==true)throw Error(data.error||'Daten konnten nicht geladen werden.');return data;
  }
  const full=await GuildLootPersonalExport.collect({guild:CURRENT_GUILD_SLUG,identity,pin,get});
  if(document.getElementById(selector).value!==selection)throw Error('Charakter wurde gewechselt. Bitte erneut exportieren.');
  exported=full.text;box.value=exported;box.hidden=false;find('copy').hidden=false;find('download').hidden=false;box.focus();box.select();
  status.textContent='Export für '+identity.name+' – '+identity.server+'. Ab Addon 0.9.0: /gle → Daten importieren → Import übernehmen. Stand '+new Date().toLocaleString('de-DE');
 }catch(e){status.textContent=e.message;}finally{button.disabled=false;}
};
find('copy').onclick=async()=>{box.focus();box.select();try{await navigator.clipboard.writeText(exported);status.textContent='Export kopiert.';}catch(e){status.textContent='Text markiert. Mit Strg+C oder Cmd+C kopieren.';}};
find('download').onclick=()=>{if(!exported)return;const url=URL.createObjectURL(new Blob([exported],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='mein-guildloot.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
}
mount('guildlootMyExport','myLichtlootCharSelect');
mount('guildlootDashboardExport','dashboardCharSelect');
})();
