(() => {
  'use strict';
  const scriptBase=new URL('.',document.currentScript.src);
  const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('player-analysis.css',scriptBase);document.head.append(css);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number=(n,d=0)=>n===null||n===undefined?'–':Number(n).toLocaleString('de-DE',{maximumFractionDigits:d});
  const date=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)?s.split('-').reverse().join('.'):s||'Datum unbekannt';
  const labelRole=r=>r==='healer'?'Heiler':r==='tank'?'Tank':r==='unknown'?'Rolle unbekannt':'Schaden';
  const safeUrl=value=>{try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:'';}catch{return '';}};
  const table=(heads,rows)=>`<div class="pa-table"><table><thead><tr>${heads.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  let dialog,controller,catalog=[],report=null,focusBefore=null,identity='',serial=0;
  const $=id=>dialog.querySelector('#pa-'+id);
  function guild(){return typeof CURRENT_GUILD_SLUG!=='undefined'?CURRENT_GUILD_SLUG:new URLSearchParams(location.search).get('guild')||'lichtloot';}
  async function api(params,signal){
    const base=typeof LICHTLOOT_API_URL!=='undefined'?LICHTLOOT_API_URL:'https://lichtloot-production.up.railway.app/api/apps-script';
    const url=new URL(base);Object.entries({action:'getPublicPlayerAnalysis',guild:guild(),...params}).forEach(([k,v])=>url.searchParams.set(k,v));
    const response=await fetch(url,{signal,cache:'no-store'});const data=await response.json();
    if(!response.ok||data.success===false)throw new Error(data.error||'Analyse konnte nicht geladen werden.');return data;
  }
  function status(text,error=false){$('status').textContent=text;$('status').dataset.error=String(error);}
  function reset(){serial++;controller?.abort();catalog=[];identity='';report=null;$('result').innerHTML='';$('raid').innerHTML='<option value="">Zuerst Charakter eingeben</option>';$('date').innerHTML='';$('analyze').disabled=true;}
  function selectDates(){
    const raid=$('raid').value;const options=catalog.filter(x=>x.raid===raid);
    $('date').innerHTML=options.map(x=>`<option value="${esc(x.id)}">${esc(date(x.date))}</option>`).join('');
    $('date-field').hidden=$('count').value!=='1';$('analyze').disabled=!options.length;
  }
  async function loadCatalog(){
    const playerName=$('name').value.trim(),server=$('server').value.trim();
    if(!playerName||!server){status('Bitte Charaktername und Server eingeben.');return;}
    const id=JSON.stringify([playerName,server]);if(identity===id&&catalog.length)return;
    controller?.abort();controller=new AbortController();const token=++serial;
    $('load').disabled=true;$('analyze').disabled=true;status('Gespeicherte Teilnahmen werden gesucht …');
    try{
      const data=await api({playerName,server},controller.signal);if(token!==serial)return;
      catalog=data.catalog||[];identity=id;
      const raids=[...new Set(catalog.map(x=>x.raid))];
      $('raid').innerHTML=raids.map(x=>`<option>${esc(x)}</option>`).join('')||'<option value="">Keine Teilnahmen</option>';
      if(raids.includes('Naxxramas'))$('raid').value='Naxxramas';selectDates();
      status(catalog.length?`${catalog.length} gespeicherte Teilnahmen gefunden. Raid und Vergleich auswählen.`:'Keine gespeicherten Teilnahmen für diesen Namen und Server in dieser Gilde gefunden. Schreibweise prüfen.');
    }catch(e){if(e.name!=='AbortError')status(e.message,true);}finally{if(token===serial)$('load').disabled=false;}
  }
  function sources(a){return a.raids.map(r=>{
    const url=new URL('raid-analyse.html',scriptBase);url.searchParams.set('guild',guild());url.searchParams.set('id',r.id);
    const log=safeUrl(r.reportUrl);
    return `<li>${esc(date(r.date))}: <a href="${esc(url.href)}" target="_blank" rel="noopener">Loganalyse öffnen</a>${log?` · <a href="${esc(log)}" target="_blank" rel="noopener">Originalreport</a>`:''}</li>`;
  }).join('');}
  function render(a){
    const latest=a.raids.at(-1),healer=a.role==='healer',metric=a.metric;
    const names=[...new Set(a.raids.flatMap(r=>r.bosses.map(b=>b.name)))];
    const bosses=names.map(name=>[name,...a.raids.map(r=>{const b=r.bosses.filter(b=>b.name===name);if(!b.length)return '–';const f=healer?'healing':'damage';if(b.some(x=>x[f]===null||!x.durationMs))return '–';return number(b.reduce((s,x)=>s+x[f],0)*1000/b.reduce((s,x)=>s+x.durationMs,0),1);})]);
    const deathRows=a.raids.flatMap(r=>r.deaths.map(d=>[date(r.date),d.boss,d.isBoss?(d.kill?'Bosskill':'Bossversuch / Wipe'):'Trash / kein Boss',number(d.deaths)]));
    const consumeNames=[...new Set(a.raids.flatMap(r=>r.consumables.map(c=>c.label)))];
    const consumeRows=consumeNames.map(n=>[n,...a.raids.map(r=>{const c=r.consumables.find(c=>c.label===n);return !c?'Nicht ausgewiesen':c.percent===null?`${number(c.fightsUsed)} Kämpfe`:number(c.percent)+' %';})]);
    const abilityNames=[...new Set(a.raids.flatMap(r=>Object.keys(r.casts)))].sort((a,b)=>a.localeCompare(b,'de'));
    const castRows=abilityNames.map(n=>[n,...a.raids.map(r=>r.casts[n]===undefined?'Nicht ausgewiesen':number(r.casts[n]))]);
    $('result').innerHTML=`<article class="pa-report"><h2>${esc(a.name)} · ${esc(a.raid)}</h2><p>${esc(a.server)} · ${esc(a.className)} · ${esc(labelRole(a.role))} · ${esc(date(a.raids[0].date))} bis ${esc(date(latest.date))}</p><div class="pa-tags"><span>${a.count} ausgewertete Teilnahmen</span><span>Bosskills getrennt von Trash und Wipes</span></div><div class="pa-kpis"><article><strong>${a.count}</strong><span>Raids ausgewertet</span></article><article><strong>${number(latest[metric],1)}</strong><span>${metric.toUpperCase()} · letzter Raid, Bosskills</span></article><article><strong>${latest.rank===null?'–':latest.rank+' / '+latest.peerCount}</strong><span>Klasse & Rolle · letzter Raid</span></article><article><strong>${a.raids.every(r=>r.totalDeaths!==null)?number(a.raids.reduce((s,r)=>s+r.totalDeaths,0)):'–'}</strong><span>Tode · gespeicherte Gesamtwerte</span></article></div>
    <h3>Zusammenfassung und Prüfpunkte</h3><div class="pa-findings">${a.observations.map(o=>`<section class="pa-finding"><h4>${esc(o.title)}</h4><p>${esc(o.text)}</p></section>`).join('')}</div>
    <h3>Alle ausgewerteten Raids</h3><p class="pa-note">Leistung: Summe der effektiven Heilung beziehungsweise des Schadens geteilt durch die Dauer derselben Bosskills. Aktivität und Gesamttode sind separat gespeicherte Reportwerte.</p>${table(['Datum','Bosskills des Chars',healer?'Heilung · Kills':'Schaden · Kills',metric.toUpperCase(),'Overheal · Kills','WCL-Aktivität','Tode gesamt','Worldbuff-Arten'],a.raids.map(r=>[date(r.date),r.kills,number(healer?r.healing:r.damage),number(r[metric],1),r.overhealPercent===null?'–':number(r.overhealPercent,1)+' %',r.activity===null?'–':number(r.activity,1)+' %',number(r.totalDeaths),number(r.worldBuffCount)]))}
    <h3>Bossvergleich · ${metric.toUpperCase()}</h3>${table(['Boss',...a.raids.map(r=>date(r.date))],bosses)}<p class="pa-note">„–“ bedeutet: kein passender Bosskill oder keine vollständigen Messwerte. Unterschiedliche Aufgaben und Kampfabläufe beeinflussen die Werte.</p>
    <h3>Überleben und Mechaniken</h3>${deathRows.length?table(['Datum','Kampf','Bereich','Tode'],deathRows):'<p>Keine Todesereignisse in den gespeicherten Einzelkämpfen ausgewiesen.</p>'}<p class="pa-note">Todesursachen und vermeidbare Mechanikfehler sind ohne Ereignisfolge nicht belegt. Ein Todesereignis allein ist keine Schuldzuweisung.</p>
    <h3>Vorbereitung und Verbrauch</h3>${consumeRows.length?table(['Verbrauchsmittel',...a.raids.map(r=>date(r.date))],consumeRows):'<p>Keine Verbrauchsdetails verfügbar.</p>'}<p class="pa-note">Anteil berücksichtigter Kämpfe mit Nachweis, keine zeitliche Buff-Uptime und keine sichere Anzahl verbrauchter Gegenstände.</p>
    <h3>Fähigkeiten und Cooldowns · Bosskills</h3><p class="pa-note">Nur numerische Zähler aus denselben Bosskills; Prozent- und Overheal-Zeilen sind ausgeschlossen. Anwendungen sind nicht automatisch erfolgreiche Dispels. Die Daten belegen keine optimale Cooldown-Nutzung.</p>${castRows.length?table(['Fähigkeit',...a.raids.map(r=>date(r.date))],castRows):'<p>Keine verlässlichen Fähigkeitenzähler verfügbar.</p>'}
    <h3>Vergleich innerhalb der Klasse</h3><p class="pa-note">Gleiche Klasse, Rolle und Bosskills wie der analysierte Charakter. Nur Spieler mit Messwerten in sämtlichen Vergleichskämpfen. Aufgaben, Ausrüstung und Aktivzeit sind nicht normalisiert.</p>${a.raids.map(r=>`<details><summary>${esc(date(r.date))} · ${r.rank===null?'Kein Vergleich verfügbar':`Rang ${r.rank} von ${r.peerCount}`}</summary>${table(['Charakter','Server',metric.toUpperCase()],r.peers.map(p=>[p.name,p.server,number(p.value,1)]))}</details>`).join('')}
    <h3>Für die nächste Besprechung</h3>${a.actions.length?`<ol>${a.actions.map(x=>`<li>${esc(x)}</li>`).join('')}</ol>`:'<p>Aufgaben und vorhandene Einzelereignisse gemeinsam prüfen.</p>'}
    <h3>Datenqualität und Grenzen</h3><ul>${a.raids.flatMap(r=>r.warnings.map(x=>`<li>${esc(date(r.date))}: ${esc(x)}</li>`)).join('')}${a.limitations.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><h3>Quellen</h3><ul>${sources(a)}</ul><p class="pa-note">Erstellt: ${esc(new Date(a.generatedAt).toLocaleString('de-DE'))}. Auswertung des gespeicherten Stands; keine neue Warcraft-Logs-Analyse ausgelöst.</p><div class="pa-actions"><button type="button" class="pa-secondary" id="pa-download">Bericht herunterladen</button><button type="button" class="pa-secondary" id="pa-print">Drucken / PDF</button></div></article>`;
    $('download').onclick=download;$('print').onclick=()=>{document.body.classList.add('pa-print');const states=[...$('result').querySelectorAll('details')].map(el=>[el,el.open]);states.forEach(([el])=>el.open=true);window.addEventListener('afterprint',()=>{document.body.classList.remove('pa-print');states.forEach(([el,open])=>el.open=open);},{once:true});window.print();};
  }
  function download(){
    const clone=$('result').cloneNode(true);clone.querySelectorAll('.pa-actions').forEach(x=>x.remove());clone.querySelectorAll('details').forEach(x=>x.open=true);
    const html=`<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(report.name)} – Spieleranalyse</title><style>body{font:16px/1.6 system-ui;max-width:1100px;margin:35px auto;padding:20px;color:#172637}h2,h3{color:#146a69}table{border-collapse:collapse;width:100%;font-size:13px}th,td{padding:9px;border:1px solid #ccd7df;text-align:left}th{background:#e8f3f3}.pa-table{overflow:auto;margin:18px 0}.pa-kpis,.pa-findings{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}.pa-kpis article,.pa-finding{border:1px solid #ccd7df;padding:16px;border-radius:12px}.pa-kpis strong{display:block;font-size:24px}.pa-tags{display:none}a{color:#176e87}.pa-note{font-size:13px}summary{font-weight:bold;margin-top:15px}@media print{.pa-table{overflow:visible}table{font-size:10px}.pa-finding{break-inside:avoid}}</style>${clone.innerHTML}</html>`;
    const url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`Spieleranalyse-${report.name.replace(/[^\p{L}\p{N}_-]/gu,'')}-${report.raid.replace(/[^\p{L}\p{N}_-]/gu,'')}.html`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function analyze(event){
    event.preventDefault();if(!catalog.length){await loadCatalog();return;}
    controller?.abort();controller=new AbortController();const token=++serial;
    $('analyze').disabled=true;$('load').disabled=true;report=null;$('result').innerHTML='';status('Teilnahmen werden verglichen und der Bericht wird erstellt …');
    try{const data=await api({playerName:$('name').value.trim(),server:$('server').value.trim(),raid:$('raid').value,count:$('count').value,analysisId:$('date').value},controller.signal);if(token!==serial)return;report=data.analysis;render(report);status(`Ausführlicher Bericht aus ${report.count} Teilnahme${report.count===1?'':'n'} erstellt.`);$('result').scrollIntoView({behavior:'smooth',block:'start'});}catch(e){if(e.name!=='AbortError')status(e.message,true);}finally{if(token===serial){$('analyze').disabled=!catalog.length;$('load').disabled=false;}}
  }
  window.openPlayerAnalysis=()=>{
    focusBefore=document.activeElement;
    if(!dialog){
      dialog=document.createElement('dialog');dialog.className='pa-dialog';dialog.setAttribute('aria-labelledby','pa-title');
      dialog.innerHTML=`<header class="pa-head"><div><h2 id="pa-title">Spieleranalyse</h2><p>Ein Raid oder die Entwicklung über mehrere Teilnahmen</p></div><button type="button" class="pa-close" aria-label="Spieleranalyse schließen">✕</button></header><div class="pa-body"><form class="pa-form"><label class="pa-field">Charaktername<input id="pa-name" required maxlength="80" autocomplete="off" placeholder="z. B. Sintha"></label><label class="pa-field">Server<input id="pa-server" required maxlength="80" autocomplete="off" value="Everlook" placeholder="z. B. Everlook"></label><div class="pa-wide pa-actions"><button id="pa-load" class="pa-secondary" type="button">Teilnahmen laden</button><span class="pa-note">Nur gespeicherte Analysen dieser Gilde</span></div><label class="pa-field">Raid<select id="pa-raid"><option value="">Zuerst Charakter eingeben</option></select></label><label class="pa-field">Zeitraum<select id="pa-count"><option value="1">Einzelner Raid</option><option value="3">Letzte 3 Teilnahmen</option><option value="5" selected>Letzte 5 Teilnahmen</option></select></label><label class="pa-field pa-wide" id="pa-date-field" hidden>Raidtermin<select id="pa-date"></select></label><div class="pa-wide pa-actions"><button id="pa-analyze" class="pa-primary" disabled type="submit">Analysieren</button></div></form><p id="pa-status" class="pa-status" role="status" aria-live="polite">Charakter eingeben und einen Raid auswählen.</p><div id="pa-result"></div></div>`;
      document.body.append(dialog);dialog.querySelector('.pa-close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{serial++;controller?.abort();$('load').disabled=false;$('analyze').disabled=!catalog.length;focusBefore?.focus();});
      $('load').onclick=loadCatalog;dialog.querySelector('form').onsubmit=analyze;
      for(const id of ['name','server']){$(id).addEventListener('input',()=>{reset();$('load').disabled=false;status('Name oder Server geändert. Teilnahmen neu laden.');});$(id).addEventListener('blur',()=>{if($('name').value.trim()&&$('server').value.trim())loadCatalog();});}
      const changeSelection=()=>{serial++;controller?.abort();report=null;$('result').innerHTML='';$('load').disabled=false;$('analyze').disabled=!catalog.length;status('Auswahl geändert. Mit Analysieren einen neuen Bericht erstellen.');};
      $('raid').onchange=()=>{changeSelection();selectDates();};$('count').onchange=()=>{changeSelection();selectDates();};$('date').onchange=changeSelection;
    }
    if(!dialog.open)dialog.showModal();$('name').focus();
  };
})();
