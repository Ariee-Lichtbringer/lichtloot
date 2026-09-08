(function(){
'use strict';
function showEvidence(target,log){
 const rows=[...(log.trades||[]).map(e=>[e.observedAt,e.giver,'Handel',e.quantity+' × '+e.itemName+' → '+e.recipient]),...(log.chatEvidence||[]).map(e=>[e.observedAt,e.sender,e.kind==='roll'?'Wurf · Item offen':e.priority,e.raw])];
 if(!rows.length)return;
 const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Handel, Prio-Meldungen und Würfe · '+rows.length+' Nachweise manuell prüfen';details.append(summary);
 const note=document.createElement('p');note.textContent='Chatnachweise bestätigen keine Vergabe. Würfe bleiben ohne automatische Itemzuordnung.';details.append(note);
 const table=document.createElement('table');table.style.width='100%';const head=table.createTHead().insertRow();for(const title of ['Zeit','Spieler / Melder','Art','Nachweis']){const th=document.createElement('th');th.textContent=title;head.append(th);}
 const body=table.createTBody();rows.sort((a,b)=>a[0]-b[0]);for(const row of rows){const tr=body.insertRow();row[0]=new Date(row[0]*1000).toLocaleTimeString('de-DE');for(const value of row){const td=tr.insertCell();td.textContent=String(value||'').replace(/\|c[0-9a-fA-F]{8}|\|r/g,'').replace(/\|H[^|]*\|h(.*?)\|h/g,'$1');}}
 details.append(table);target.append(details);
}
function mount(host,options){
 if(!host)return;
 host.innerHTML='<section style="margin:14px 0;padding:16px;border:1px solid #52677d;border-radius:12px"><h3 style="margin:0 0 8px">GuildLoot-Addon · Raid importieren</h3><p>Beute und Teilnahme aus dem Addon übernehmen. Erhaltene P0-Items werden gold markiert. Anschließend wie gewohnt „P0+ übertragen“ öffnen; dort wird die Teilnahme mit Warcraft Logs gegengeprüft.</p><label>Exportdatei auswählen <input data-file type="file" accept=".json,.txt,application/json,text/plain"></label><details style="margin:10px 0"><summary>Oder Exporttext einfügen</summary><textarea data-text rows="5" aria-label="Raid-Export aus dem Addon" style="box-sizing:border-box;width:100%;font:14px/1.5 monospace"></textarea></details><label>Mastercode oder Plündermeister-Passwort <input data-password type="password" autocomplete="current-password"></label><button type="button" data-import class="btn" style="margin:10px">Raid-Export übernehmen</button><div data-status role="status"></div></section>';
 const file=host.querySelector('[data-file]'),box=host.querySelector('[data-text]'),password=host.querySelector('[data-password]'),status=host.querySelector('[data-status]'),button=host.querySelector('[data-import]');
 button.onclick=async()=>{
  button.disabled=true;status.textContent='Export wird geprüft …';
  try{
   if(!password.value)throw Error('Bitte das Plündermeister-Passwort eingeben.');
   if(file.files[0]?.size>1500000)throw Error('Exportdatei zu groß.');
   const text=file.files[0]?await file.files[0].text():box.value;
   if(!text.trim())throw Error('Bitte eine Exportdatei auswählen oder den Exporttext einfügen.');
   const response=await fetch(options.api,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'guildAddonRaidImport',guild:options.guild,raidId:options.raidId,text,masterCode:password.value}),signal:AbortSignal.timeout(45000)});
   const result=await response.json();if(!response.ok||!result.success)throw Error(result.error||'Import fehlgeschlagen.');
   password.value='';
   const summary=result.duplicate?'Dieser Export wurde bereits übernommen.':result.marked+' P0-Items gold markiert · '+result.participants+' Teilnehmer im Addon belegt · '+result.unknown+' weitere Spieler werden mit Warcraft Logs geprüft.';
   await options.onApplied();
   const target=document.querySelector('#addonRaidUpload [data-status]');if(target)target.textContent=summary+' Punkte wurden noch nicht geändert. Jetzt „P0+ übertragen“ öffnen.'+(result.warning?' Das Addon meldet eine unvollständige Aufzeichnung.':'');
   if(target)showEvidence(target,JSON.parse(text));
  }catch(e){status.textContent=e.message;}finally{button.disabled=false;}
 };
}
globalThis.GuildLootRaidUpload={mount};
})();
