(function(){
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const sources={savePrio:'Lootseite',savePrioAsRaidlead:'Raidleitung',deletePrio:'Prio gelöscht',deleteGuildPrio:'Gildenleitung',savePoSignupPrioFromBot:'Discord-Bot',initial_snapshot:'Bestand bei Aktivierung',ensurePrioSchemaNow:'Bereinigung doppelter Einträge',database_or_cascade:'Datenbank oder verknüpfte Löschung'};
 const items=s=>s?[1,2,3].map(n=>s['p'+n]?.name?`P${n}: ${s['p'+n].name}`:'').filter(Boolean).join(' · ')||'Keine Items':'—';
 function render(entries){return entries.length?entries.map(e=>{const s=e.new_state||e.old_state||{};return `<article style="border-top:1px solid #475569;padding:16px 0"><strong>${esc({BASELINE:'Ausgangsbestand',INSERT:'Gespeichert',UPDATE:'Geändert',DELETE:'Gelöscht'}[e.operation]||e.operation)} · ${esc(s.characterName)}</strong><p>${esc(s.raidName)} · ${esc(s.raidDate)} ${esc(s.raidTime)}<br>${esc(new Date(e.recorded_at).toLocaleString('de-DE'))}</p><p>Vorher: ${esc(items(e.old_state))}<br>Nachher: ${esc(items(e.new_state))}</p><small>Auslöser: ${esc(sources[e.source]||"System / Verwaltung")}</small></article>`;}).join(''):'Noch keine Vorgänge für diese Auswahl.';}
 async function open(manager=false){
  const dialog=document.createElement('dialog');dialog.style.cssText='background:#0c1726;color:#eee;border:1px solid #d6b65d;border-radius:14px;width:min(760px,90vw);max-height:85vh;padding:24px;font:16px/1.5 system-ui,sans-serif';
  dialog.innerHTML='<button type="button" style="float:right;background:#1e293b;color:white;border:1px solid #d6b65d;border-radius:8px;padding:8px 12px" aria-label="Prio-Verlauf schließen">Schließen</button><h2>Prio-Verlauf</h2><p>Die letzten 100 Vorgänge seit Aktivierung des Protokolls. Ausgangsbestand ist keine frühere Speicherbestätigung.</p><label>Nach Charakter oder Raid filtern <input type="search" style="box-sizing:border-box;width:100%;margin:12px 0;padding:10px;background:#152235;color:white;border:1px solid #64748b;border-radius:8px"></label><div role="status">Lade Verlauf …</div>';
  document.body.append(dialog);dialog.querySelector('button').onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();
  const target=dialog.querySelector('[role=status]');
  try{
   let data;
   if(manager)data=await railwayApi({action:'guildGetPrioChangeHistory',masterCode:document.getElementById('masterCode').value.trim(),t:Date.now()});
   else{
    const select=document.getElementById('myLichtlootCharSelect');if(!select?.value)throw Error('Bitte zuerst einen Charakter auswählen.');
    const c=JSON.parse(select.value),pin=document.getElementById('myPriosPin').value.trim();
    const url=new URL(LICHTLOOT_API_URL);url.search=new URLSearchParams({action:'getPrioChangeHistory',guild:CURRENT_GUILD_SLUG,player:c.name,server:c.server||'',pin,t:Date.now()});
    const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(15000)});data=await response.json();
   }
   if(!data.success)throw Error(data.error||'Verlauf konnte nicht geladen werden.');
   const entries=data.entries||[];target.innerHTML=render(entries);
   dialog.querySelector('input').oninput=e=>{const q=e.target.value.toLocaleLowerCase('de');target.innerHTML=render(entries.filter(row=>JSON.stringify([row.old_state?.characterName,row.new_state?.characterName,row.old_state?.raidName,row.new_state?.raidName]).toLocaleLowerCase('de').includes(q)));};
  }catch(e){target.textContent=e.message;}
 }
 window.GuildLootPrioHistory={open,render};
})();
