(() => {
  'use strict';
  const scriptBase=new URL('.',document.currentScript.src);
  const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('player-analysis.css?v=20260905-4',scriptBase);document.head.append(css);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number=(n,d=0)=>n===null||n===undefined?'–':Number(n).toLocaleString('de-DE',{maximumFractionDigits:d});
  const date=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)?s.split('-').reverse().join('.'):s||'Datum unbekannt';
  const labelRole=r=>r==='healer'?'Heiler':r==='tank'?'Tank':r==='unknown'?'Rolle unbekannt':'Schaden';
  const safeUrl=value=>{try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:'';}catch{return '';}};
  const iconPath=path=>new URL(path,scriptBase).href;
  const CLASS_ICONS={Warrior:'images/krieger.png',Paladin:'images/Pala.png',Druid:'images/druide.png',Rogue:'images/schurke.png',Hunter:'images/ja%CC%88ger.png',Priest:'images/priester.png',Mage:'images/magier.png',Warlock:'images/hexenmeister.png',Shaman:'https://wow.zamimg.com/images/wow/icons/large/classicon_shaman.jpg'};
  const CLASS_NAMES={Warrior:'Krieger',Paladin:'Paladin',Druid:'Druide',Rogue:'Schurke',Hunter:'Jäger',Priest:'Priester',Mage:'Magier',Warlock:'Hexenmeister',Shaman:'Schamane'};
  const CLASS_GROUP={Warrior:'Kriegern',Paladin:'Paladinen',Druid:'Druiden',Rogue:'Schurken',Hunter:'Jägern',Priest:'Priestern',Mage:'Magiern',Warlock:'Hexenmeistern',Shaman:'Schamanen'};
  const wowIcon=value=>/^(inv|spell|ability|classicon)_[a-z0-9_]+$/i.test(value||'')?'https://wow.zamimg.com/images/wow/icons/large/'+value.toLowerCase()+'.jpg':'';
  const cell=c=>c==='Nicht ausgewiesen'?'<span class="pa-missing" title="Nicht ausgewiesen" aria-label="Nicht ausgewiesen">×</span>':c&&typeof c==='object'?`${c.icon?`<img class="pa-cell-icon" src="${esc(c.icon)}" alt="">`:''}${esc(c.text)}${c.comparison?`<small class="pa-comparison">${c.comparison.deltaPercent<0?'↓':'↑'} ${esc(number(Math.abs(c.comparison.deltaPercent),1))} % · Ø ${esc(number(c.comparison.mean,1))} (${c.comparison.peerCount})</small>`:''}`:esc(c);
  const rated=(text,comparison)=>({text,comparison});
  const table=(heads,rows)=>`<div class="pa-table"><table><thead><tr>${heads.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(c=>`<td class="${c?.comparison?.poor?'pa-poor':''}">${cell(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  let dialog,controller,catalog=[],report=null,reportToken='',readOnly=false,deliveryStatus='',focusBefore=null,identity='',serial=0;
  const $=id=>dialog.querySelector('#pa-'+id);
  function guild(){return typeof CURRENT_GUILD_SLUG!=='undefined'?CURRENT_GUILD_SLUG:new URLSearchParams(location.search).get('guild')||'lichtloot';}
  async function api(params,signal){
    const base=typeof LICHTLOOT_API_URL!=='undefined'?LICHTLOOT_API_URL:'https://lichtloot-production.up.railway.app/api/apps-script';
    const url=new URL(base);Object.entries({action:'getPublicPlayerAnalysis',guild:guild(),...params}).forEach(([k,v])=>url.searchParams.set(k,v));
    const response=await fetch(url,{signal,cache:'no-store'});const data=await response.json();
    if(!response.ok||data.success===false)throw new Error(data.error||'Analyse konnte nicht geladen werden.');return data;
  }
  function status(text,error=false){$('status').textContent=text;$('status').dataset.error=String(error);}
  function reset(){serial++;controller?.abort();catalog=[];identity='';report=null;reportToken='';deliveryStatus='';$('result').innerHTML='';$('raid').innerHTML='<option value="">Zuerst Charakter eingeben</option>';$('date').innerHTML='';$('analyze').disabled=true;}
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
  function branding(){
    const info=typeof currentGuildInfo!=='undefined'?currentGuildInfo:null;
    if(readOnly&&report)return {name:report.guildName||guild(),logo:safeUrl(report.guildLogoUrl)};
    return {name:info?.name||guild(),logo:safeUrl(info?.logoUrl)};
  }
  function sources(a){return a.raids.map(r=>{
    const url=new URL('raid-analyse.html',scriptBase);url.searchParams.set('guild',guild());url.searchParams.set('id',r.id);
    const log=safeUrl(r.reportUrl);
    return `<li>${esc(date(r.date))}: <a href="${esc(url.href)}" target="_blank" rel="noopener">Loganalyse öffnen</a>${log?` · <a href="${esc(log)}" target="_blank" rel="noopener">Originalreport</a>`:''}</li>`;
  }).join('');}
  function render(a){
    const latest=a.raids.at(-1),healer=a.role==='healer',metric=a.metric;
    const names=[...new Set(a.raids.flatMap(r=>r.bosses.map(b=>b.name)))];
    const bosses=names.map(name=>[name,...a.raids.map(r=>{const b=r.bosses.filter(b=>b.name===name);if(!b.length)return '–';const f=healer?'healing':'damage';if(b.some(x=>x[f]===null||!x.durationMs))return '–';return rated(number(b.reduce((s,x)=>s+x[f],0)*1000/b.reduce((s,x)=>s+x.durationMs,0),1),b.length===1?b[0].comparison:null);})]);
    const deathRows=a.raids.flatMap(r=>r.deaths.map(d=>[date(r.date),d.boss,d.isBoss?(d.kill?'Bosskill':'Bossversuch / Wipe'):'Trash / kein Boss',number(d.deaths)]));
    const consumeNames=[...new Set(a.raids.flatMap(r=>r.consumables.map(c=>c.label)))];
    const consumeRows=consumeNames.map(n=>[{text:n,icon:wowIcon(a.raids.flatMap(r=>r.consumables).find(c=>c.label===n&&c.icon)?.icon)},...a.raids.map(r=>{const c=r.consumables.find(c=>c.label===n);return !c?'Nicht ausgewiesen':rated(`${c.uses===null||c.uses===undefined?'–':number(c.uses)} erfasst · ${c.percent===null?number(c.fightsUsed)+' Kämpfe':number(c.percent)+' % Kämpfe'}`,c.comparison);})]);
    const abilityNames=[...new Set(a.raids.flatMap(r=>Object.keys(r.casts)))].sort((a,b)=>a.localeCompare(b,'de'));

    const brand=branding();
    $('result').innerHTML=`<article class="pa-report"><div class="pa-report-brand">${brand.logo?`<img class="pa-guild-logo" src="${esc(brand.logo)}" alt="Gildenlogo">`:''}<span class="pa-kicker">GuildLoot · ${esc(brand.name)} · Spieleranalyse</span></div><h2 class="pa-character-title">${CLASS_ICONS[a.className]?`<img class="pa-class-icon" src="${esc(iconPath(CLASS_ICONS[a.className]))}" alt="${esc(CLASS_NAMES[a.className]||a.className)}">`:""}${esc(a.name)} · ${esc(a.raid)}</h2><p>${esc(a.server)} · ${esc(CLASS_NAMES[a.className]||a.className)} · ${esc(labelRole(a.role))} · ${esc(date(a.raids[0].date))} bis ${esc(date(latest.date))}</p><div class="pa-tags"><span>${a.count} ausgewertete Teilnahmen</span><span>Bosskills getrennt von Trash und Wipes</span></div><div class="pa-kpis"><article><strong>${a.count}</strong><span>Raids ausgewertet</span></article><article><strong>${number(latest[metric],1)}</strong><span>${metric.toUpperCase()} · letzter Raid, Bosskills</span></article><article class="pa-rank-card"><strong>${latest.rank===null?'Kein Rang':'Platz '+latest.rank+' von '+latest.peerCount}</strong><span>unter den ${esc(CLASS_GROUP[latest.className]||latest.className)} · ${esc(labelRole(latest.role))}</span><small>${esc(date(latest.date))} · nach ${metric.toUpperCase()} auf Bosskills</small></article><article><strong>${a.raids.every(r=>r.totalDeaths!==null)?number(a.raids.reduce((s,r)=>s+r.totalDeaths,0)):'–'}</strong><span>Tode · gespeicherte Gesamtwerte</span></article></div>
    <h3>Zusammenfassung und Prüfpunkte</h3><div class="pa-findings">${a.observations.map(o=>`<section class="pa-finding ${o.title.includes('Deutlich unter')?'pa-finding-danger':o.title.includes('Tode')||o.title.includes('prüfen')?'pa-finding-warn':''}"><h4>${esc(o.title)}</h4><p>${esc(o.text)}</p></section>`).join('')}</div>
    <h3>Alle ausgewerteten Raids</h3><p class="pa-note">Leistung: Summe der effektiven Heilung beziehungsweise des Schadens geteilt durch die Dauer derselben Bosskills. Aktivität und Gesamttode sind separat gespeicherte Reportwerte.</p>${table(['Datum','Bosskills des Chars',healer?'Heilung · Kills':'Schaden · Kills',metric.toUpperCase(),'Overheal · Kills','WCL-Aktivität','Tode gesamt','Worldbuff-Arten'],a.raids.map(r=>[date(r.date),r.kills,number(healer?r.healing:r.damage),rated(number(r[metric],1),r.metricComparison),r.overhealPercent===null?'–':number(r.overhealPercent,1)+' %',rated(r.activity===null?'–':number(r.activity,1)+' %',r.activityComparison),number(r.totalDeaths),number(r.worldBuffCount)]))}
    <h3>Bossvergleich · ${metric.toUpperCase()}</h3>${table(['Boss',...a.raids.map(r=>date(r.date))],bosses)}<p class="pa-note">„–“ bedeutet: kein passender Bosskill oder keine vollständigen Messwerte. Unterschiedliche Aufgaben und Kampfabläufe beeinflussen die Werte.</p>
    <h3>Überleben und Mechaniken</h3>${deathRows.length?table(['Datum','Kampf','Bereich','Tode'],deathRows):'<p>Keine Todesereignisse in den gespeicherten Einzelkämpfen ausgewiesen.</p>'}<p class="pa-note">Todesursachen und vermeidbare Mechanikfehler sind ohne Ereignisfolge nicht belegt. Ein Todesereignis allein ist keine Schuldzuweisung.</p>
    <h3>Vorbereitung und Verbrauch</h3>${consumeRows.length?table(['Verbrauchsmittel',...a.raids.map(r=>date(r.date))],consumeRows):'<p>Keine Verbrauchsdetails verfügbar.</p>'}<p class="pa-note">Anteil berücksichtigter Kämpfe mit Nachweis, keine zeitliche Buff-Uptime und keine sichere Anzahl verbrauchter Gegenstände.</p>
    <h3>Fähigkeiten und Cooldowns · tatsächliche Nutzungen</h3><label class="pa-field pa-chart-control">Datenbereich<select id="pa-usage-scope"><option value="report">Gesamter Bericht · Werte aus der Loganalyse</option><option value="boss">Nur Bosskills · Anwendungen</option></select></label><p class="pa-note">Die Gesamtansicht übernimmt Nutzungszahlen und Zusatzwerte direkt aus dem Fähigkeitenbereich der Loganalyse. Bosskills werden separat summiert. „Nicht ausgewiesen“ wird nicht in 0 umgewandelt.</p><div id="pa-usage"></div>
    <h3>Vergleich innerhalb der Klasse</h3><div class="pa-chart-controls"><label class="pa-field">Raid<select id="pa-chart-raid">${a.raids.map((r,i)=>`<option value="${i}" ${i===a.raids.length-1?'selected':''}>${esc(date(r.date))}</option>`).join('')}</select></label><label class="pa-field">Diagrammwert<select id="pa-chart-metric"></select></label></div><div id="pa-chart" class="pa-chart"></div><p class="pa-note">Gleiche Klasse, Rolle und Bosskills wie der analysierte Charakter. Nur Spieler mit Messwerten in sämtlichen Vergleichskämpfen. Aufgaben, Ausrüstung und Aktivzeit sind nicht normalisiert.</p>${a.raids.map(r=>`<details><summary>${esc(date(r.date))} · ${r.rank===null?'Kein Vergleich verfügbar':`Rang ${r.rank} von ${r.peerCount}`}</summary>${table(['Charakter','Server',metric.toUpperCase()],r.peers.map(p=>[p.name,p.server,number(p.value,1)]))}</details>`).join('')}
    <h3>Für die nächste Besprechung</h3>${a.actions.length?`<ol>${a.actions.map(x=>`<li>${esc(x)}</li>`).join('')}</ol>`:'<p>Aufgaben und vorhandene Einzelereignisse gemeinsam prüfen.</p>'}
    <h3>Datenqualität und Grenzen</h3><p class="pa-rating-legend"><strong>Rot:</strong> mindestens 20 % unter dem Durchschnitt von mindestens drei anderen Spielern gleicher Klasse und Rolle. Ø und Abstand stehen am Wert. Fehlende Daten werden nicht bewertet. Bei defensiven Cooldowns, Dispels und anderen situationsabhängigen Fähigkeiten bedeutet seltenerer Einsatz nicht automatisch schlechtere Leistung; sie werden deshalb nicht pauschal rot markiert.</p><ul>${a.raids.flatMap(r=>r.warnings.map(x=>`<li>${esc(date(r.date))}: ${esc(x)}</li>`)).join('')}${a.limitations.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><h3>Quellen</h3><ul>${sources(a)}</ul><p class="pa-note">Erstellt: ${esc(new Date(a.generatedAt).toLocaleString('de-DE'))}. Auswertung des gespeicherten Stands; keine neue Warcraft-Logs-Analyse ausgelöst.</p><div class="pa-discord-recipient" ${readOnly||!reportToken?"hidden":""}><label class="pa-field">Discord-Empfänger aus der Charakterliste<select id="pa-recipient"><option value="">${esc(a.name)} – ${esc(a.server)} (analysierter Charakter)</option></select></label><p class="pa-note">Der P0-Bot sendet einen Link zu diesem gespeicherten Bericht an das verknüpfte Discord-Konto.</p></div><div class="pa-actions"><button type="button" class="pa-primary" id="pa-discord" ${readOnly||!reportToken?"hidden":""}><img class="pa-button-icon" src="${esc(iconPath("images/discord.svg"))}" alt="">Berichtslink per Discord senden</button><button type="button" class="pa-secondary" id="pa-download">Bericht herunterladen</button><button type="button" class="pa-secondary" id="pa-print">Drucken / PDF</button></div><p id="pa-delivery" class="pa-status" role="status" aria-live="polite"></p></article>`;
    const sectionIcons=['loganalysen.jpg','raids.jpg','raidanmelder.jpg','raidregeln.svg','worldbuffs.jpg','charakterverwaltung-icon-128.png','charakterverwaltung-icon-128.png','raidlead.jpg','sicherung.jpg','loganalysen.jpg'];
    $('result').querySelectorAll('h3').forEach((heading,index)=>{const img=document.createElement('img');img.className='pa-section-icon';img.alt='';img.src=iconPath('images/dashboard-icons/'+sectionIcons[index]);heading.prepend(img);heading.dataset.section=String(index);});
    $('result').querySelectorAll('img').forEach(img=>img.addEventListener('error',()=>img.hidden=true));
    $('usage-scope').onchange=()=>renderUsage(a);renderUsage(a);
    $('chart-raid').onchange=()=>{setChartMetrics(a);renderChart(a);};$('chart-metric').onchange=()=>renderChart(a);setChartMetrics(a);renderChart(a);
    const deliveryPanel=$('recipient').closest('.pa-discord-recipient');deliveryPanel.append($('discord'),$('delivery'));$('result').querySelector('.pa-kpis').before(deliveryPanel);
    $('discord').onclick=sendDiscord;
    if(!readOnly&&reportToken)loadRecipients(reportToken);
    $('download').onclick=download;$('print').onclick=()=>{document.body.classList.add('pa-print');const states=[...$('result').querySelectorAll('details')].map(el=>[el,el.open]);states.forEach(([el])=>el.open=true);window.addEventListener('afterprint',()=>{document.body.classList.remove('pa-print');states.forEach(([el,open])=>el.open=open);},{once:true});window.print();};
  }
  function renderUsage(a){
    const boss=$('usage-scope').value==='boss';
    const names=[...new Set(a.raids.flatMap(r=>boss?Object.keys(r.casts):(r.reportUsage||[]).map(x=>x.label)))];
    const rows=names.map(name=>{
      const metadata=boss?a.raids.map(r=>r.castMetadata?.[name]).find(Boolean):a.raids.flatMap(r=>r.reportUsage||[]).find(x=>x.label===name);
      return [{text:metadata?.label||name,icon:wowIcon(metadata?.icon)},...a.raids.map(r=>{
        if(boss)return r.casts[name]===undefined?'Nicht ausgewiesen':rated(number(r.casts[name]),r.castComparisons?.[name]);
        const value=(r.reportUsage||[]).find(x=>x.label===name);return value?.value==null?'Nicht ausgewiesen':rated(value.value,value.comparison);
      })];
    });
    $('usage').innerHTML=rows.length?table(['Fähigkeit',...a.raids.map(r=>date(r.date))],rows):'<p>Für diesen Datenbereich sind keine Nutzungszahlen gespeichert.</p>';
    $('usage').querySelectorAll('img').forEach(img=>img.onerror=()=>img.hidden=true);
  }
  function setChartMetrics(a){
    const raid=a.raids[Number($('chart-raid').value)]||a.raids.at(-1),old=$('chart-metric').value;
    const options=raid.role==='healer'?[['hps','HPS'],['healingDone','Gesamtheilung · Bosskills'],['overheal','Overheal · Menge'],['overhealPercent','Overheal · Prozent']]:[['dps','DPS'],['damageDone','Gesamtschaden · Bosskills']];
    $('chart-metric').innerHTML=options.map(([v,t])=>`<option value="${v}">${esc(t)}</option>`).join('');
    if(options.some(([v])=>v===old))$('chart-metric').value=old;
  }
  function renderChart(a){
    const raid=a.raids[Number($('chart-raid').value)]||a.raids.at(-1),metric=$('chart-metric').value;
    const peers=raid.peers.filter(x=>x[metric]!==null&&x[metric]!==undefined).sort((a,b)=>b[metric]-a[metric]);
    const maximum=Math.max(1,...peers.map(x=>x[metric]));
    const unit=metric==='overhealPercent'?' %':['hps','dps'].includes(metric)?' '+metric.toUpperCase():'';
    $('chart').setAttribute('aria-label',`${$('chart-metric').selectedOptions[0]?.textContent} · ${date(raid.date)}`);
    $('chart').innerHTML=peers.length?`<p class="pa-note">${esc(date(raid.date))} · ${raid.kills} gleiche Bosskills · ${esc(CLASS_NAMES[raid.className]||raid.className)} · ${esc(labelRole(raid.role))}</p>${peers.map(peer=>{
      const self=peer.name===a.name&&peer.server===a.server;
      const poor=self&&['hps','dps','healingDone','damageDone'].includes(metric)&&raid.metricComparison?.poor;
      return `<div class="pa-bar-row ${self?'pa-self':''} ${poor?'pa-bar-poor':''}"><div class="pa-bar-label"><b class="pa-rank-number">${peers.filter(x=>x[metric]>peer[metric]).length+1}.</b> ${esc(peer.name)}${self?' <span>dieser Charakter</span>':''}</div><div class="pa-bar-track"><div class="pa-bar-fill" style="width:${Math.max(0,peer[metric]/maximum*100).toFixed(2)}%"></div></div><strong>${esc(number(peer[metric],['hps','dps','overhealPercent'].includes(metric)?1:0))}${unit}</strong></div>`;
    }).join('')}<p class="pa-note">Gesamtheilung, Overheal und Gesamtschaden sind Summen dieser Bosskills. Sortierung: höchster Wert zuerst. Bei Overheal ist dies keine Leistungsrangliste.</p>`:'<p>Für diesen Diagrammwert sind keine Vergleichsdaten gespeichert.</p>';
  }
  async function loadRecipients(token){
    try{const result=await deliveryRequest('guildGetPlayerAnalysisRecipients',token);if(token!==reportToken||!$('recipient'))return;
      const options=result.recipients||[];$('recipient').innerHTML=`<option value="">${esc(report.name)} – ${esc(report.server)} (analysierter Charakter)</option>`+options.map(x=>`<option value="${esc(x.id)}" ${x.discord?'':'disabled'}>${esc(x.name)} – ${esc(x.server)}${x.discord?'':' · kein Discord-Konto'}</option>`).join('');
    }catch(e){if(token===reportToken&&$('delivery'))$('delivery').textContent='Empfängerliste: '+e.message;}
  }
  async function deliveryRequest(action,token,extra={}){
    if(typeof railwayWrite!=='function')throw new Error('Bitte den Versand aus der angemeldeten Gildenleitung starten.');
    const masterCode=document.getElementById('masterCode')?.value.trim()||'';
    let reviewerPlayerPin='';try{const key='lichtlootPlayerPin_'+guild();reviewerPlayerPin=localStorage.getItem(key)||sessionStorage.getItem(key)||'';}catch{}
    const data=await railwayWrite({action,masterCode,reviewerPlayerPin,reportToken:token,...extra});
    if(data.success===false)throw new Error(data.error||'Discord-Auftrag fehlgeschlagen.');return data;
  }
  function showDelivery(data){
    deliveryStatus=data.status;
    const target=data.recipient||report?.name||'Spieler';
    const labels={queued:`Der P0-Bot hat den Berichtslink für ${target} in der Versandwarteschlange.`,sent:`Berichtslink per Discord an ${target} zugestellt.`,failed:data.error||'Discord-DM fehlgeschlagen.'};
    $('delivery').textContent=labels[data.status]||'Versandstatus noch nicht verfügbar.';
    $('delivery').dataset.error=String(data.status==='failed');
    $('discord').disabled=data.status==='sent';$('recipient').disabled=['queued','sent'].includes(data.status);
    $('discord').textContent=data.status==='sent'?'Per Discord zugestellt':data.status==='failed'?'Discord-Versand erneut versuchen':data.status==='queued'?'Versandstatus aktualisieren':'Berichtslink per Discord senden';
  }
  async function sendDiscord(){
    const token=reportToken;if(!token||readOnly)return;
    const button=$('discord');button.disabled=true;$('delivery').textContent='Discord-Zuordnung und Versand werden geprüft …';
    try{
      const data=await deliveryRequest(deliveryStatus==='queued'?'guildGetPlayerAnalysisDelivery':'guildSendPlayerAnalysisDm',token,{retry:deliveryStatus==='failed',recipientId:$('recipient').value||null});
      if(token!==reportToken||!dialog.open)return;showDelivery(data);
      if(data.status==='queued'){
        const poll=async remaining=>{if(token!==reportToken||!dialog.open||deliveryStatus!=='queued')return;try{const result=await deliveryRequest('guildGetPlayerAnalysisDelivery',token);if(token!==reportToken||!dialog.open)return;showDelivery(result);if(result.status==='queued'&&remaining>0)setTimeout(()=>poll(remaining-1),4000);}catch{if(token===reportToken&&dialog.open)$('delivery').textContent='Status konnte nicht abgerufen werden. Mit dem Button erneut prüfen.';}};
        setTimeout(()=>poll(8),4000);
      }
    }catch(e){if(token===reportToken&&dialog.open){$('delivery').textContent=e.message;$('delivery').dataset.error='true';button.disabled=false;}}
  }
  async function download(){
    const exportName=report.name,exportRaid=report.raid;
    const clone=$('result').cloneNode(true);clone.querySelectorAll('.pa-actions,.pa-discord-recipient,#pa-delivery').forEach(x=>x.remove());clone.querySelectorAll('details').forEach(x=>x.open=true);
    let theme;
    try { const response=await fetch(new URL('player-analysis.css?v=20260905-4',scriptBase));if(!response.ok)throw new Error();theme=await response.text(); }
    catch { status('Design für den Download konnte nicht geladen werden. Bitte erneut versuchen oder Drucken / PDF verwenden.',true);return; }
    const html=`<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(exportName)} – Spieleranalyse</title><style>${theme.replace(/<\/style/gi,'')}</style></head><body class="pa-export"><main class="pa-dialog">${clone.innerHTML}</main></body></html>`;
    const url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`Spieleranalyse-${exportName.replace(/[^\p{L}\p{N}_-]/gu,'')}-${exportRaid.replace(/[^\p{L}\p{N}_-]/gu,'')}.html`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function analyze(event){
    event.preventDefault();if(!catalog.length){await loadCatalog();return;}
    controller?.abort();controller=new AbortController();const token=++serial;
    $('analyze').disabled=true;$('load').disabled=true;report=null;reportToken='';deliveryStatus='';$('result').innerHTML='';status('Teilnahmen werden verglichen und der Bericht wird erstellt …');
    try{const data=await api({playerName:$('name').value.trim(),server:$('server').value.trim(),raid:$('raid').value,count:$('count').value,analysisId:$('date').value},controller.signal);if(token!==serial)return;report=data.analysis;reportToken=data.reportToken||'';deliveryStatus='';render(report);status(`Ausführlicher Bericht aus ${report.count} Teilnahme${report.count===1?'':'n'} erstellt.`);$('result').scrollIntoView({behavior:'smooth',block:'start'});}catch(e){if(e.name!=='AbortError')status(e.message,true);}finally{if(token===serial){$('analyze').disabled=!catalog.length;$('load').disabled=false;}}
  }
  window.openPlayerAnalysis=()=>{
    focusBefore=document.activeElement;
    if(!dialog){
      dialog=document.createElement('dialog');dialog.className='pa-dialog';dialog.setAttribute('aria-labelledby','pa-title');
      dialog.innerHTML=`<header class="pa-head"><div class="pa-brand"><img id="pa-logo" class="pa-guild-logo" hidden alt="Gildenlogo"><div><span class="pa-kicker" id="pa-brand-label">GuildLoot · Loganalyse</span><h2 id="pa-title">Spieleranalyse</h2><p>Einzelraid oder Vergleich · Fenster unten rechts vergrößern</p></div></div><div class="pa-window-controls"><button type="button" id="pa-size" class="pa-close" aria-label="Fenster maximieren" aria-pressed="false">⛶</button><button type="button" class="pa-close pa-dismiss" aria-label="Spieleranalyse schließen">✕</button></div></header><div class="pa-body"><form class="pa-form"><label class="pa-field">Charaktername<input id="pa-name" required maxlength="80" autocomplete="off" placeholder="z. B. Sintha"></label><label class="pa-field">Server<input id="pa-server" required maxlength="80" autocomplete="off" value="Everlook" placeholder="z. B. Everlook"></label><div class="pa-wide pa-actions"><button id="pa-load" class="pa-secondary" type="button">Teilnahmen laden</button><span class="pa-note">Nur gespeicherte Analysen dieser Gilde</span></div><label class="pa-field">Raid<select id="pa-raid"><option value="">Zuerst Charakter eingeben</option></select></label><label class="pa-field">Zeitraum<select id="pa-count"><option value="1">Einzelner Raid</option><option value="3">Letzte 3 Teilnahmen</option><option value="5" selected>Letzte 5 Teilnahmen</option></select></label><label class="pa-field pa-wide" id="pa-date-field" hidden>Raidtermin<select id="pa-date"></select></label><div class="pa-wide pa-actions"><button id="pa-analyze" class="pa-primary" disabled type="submit">Analysieren</button></div></form><p id="pa-status" class="pa-status" role="status" aria-live="polite">Charakter eingeben und einen Raid auswählen.</p><div id="pa-result"></div></div>`;
      document.body.append(dialog);dialog.querySelector('.pa-dismiss').onclick=()=>dialog.close();$('size').onclick=()=>{const full=dialog.classList.toggle('pa-full');$('size').setAttribute('aria-pressed',String(full));$('size').setAttribute('aria-label',full?'Fenstergröße zurücksetzen':'Fenster maximieren');dialog.style.width='';dialog.style.height='';};dialog.addEventListener('close',()=>{serial++;controller?.abort();$('load').disabled=false;$('analyze').disabled=!catalog.length;focusBefore?.focus();});
      $('load').onclick=loadCatalog;dialog.querySelector('form').onsubmit=analyze;
      for(const id of ['name','server']){$(id).addEventListener('input',()=>{reset();$('load').disabled=false;status('Name oder Server geändert. Teilnahmen neu laden.');});$(id).addEventListener('blur',()=>{if($('name').value.trim()&&$('server').value.trim())loadCatalog();});}
      const changeSelection=()=>{serial++;controller?.abort();report=null;reportToken='';deliveryStatus='';$('result').innerHTML='';$('load').disabled=false;$('analyze').disabled=!catalog.length;status('Auswahl geändert. Mit Analysieren einen neuen Bericht erstellen.');};
      $('raid').onchange=()=>{changeSelection();selectDates();};$('count').onchange=()=>{changeSelection();selectDates();};$('date').onchange=changeSelection;
    }
    const brand=branding();$('brand-label').textContent='GuildLoot · '+brand.name;
    $('logo').hidden=!brand.logo;if(brand.logo){$('logo').src=brand.logo;$('logo').onerror=()=>{$('logo').hidden=true;};}
    if(!dialog.open)dialog.showModal();$('name').focus();
  };
  const savedToken=new URLSearchParams(location.search).get('report');
  if(savedToken){
    readOnly=true;
    (async()=>{
      window.openPlayerAnalysis();dialog.classList.add('pa-reader');dialog.querySelector('form').hidden=true;dialog.querySelector('.pa-dismiss').hidden=true;
      dialog.addEventListener('cancel',event=>event.preventDefault());status('Gespeicherter Spielerbericht wird geladen …');
      try{const data=await api({action:'getPublicPlayerAnalysisReport',reportToken:savedToken});report=data.analysis;render(report);const brand=branding();$('brand-label').textContent='GuildLoot · '+brand.name;$('logo').hidden=!brand.logo;if(brand.logo)$('logo').src=brand.logo;status('Gespeicherter Bericht · '+date(report.raids[0].date)+' bis '+date(report.raids.at(-1).date));}
      catch(e){status(e.message,true);}
    })();
  }
})();
