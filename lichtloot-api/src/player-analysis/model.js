// Read-only analysis of persisted logs. No external AI service or new log ingestion.
const key = value => String(value ?? '').normalize('NFC').trim().toLocaleLowerCase('de');
const num = value => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
const sum = (xs, field) => xs.length && xs.every(x => num(x[field]) !== null) ? xs.reduce((s,x) => s + Number(x[field]), 0) : null;
const rate = (value, ms) => value === null || !(ms > 0) ? null : value * 1000 / ms;
const round = n => n === null ? null : Math.round(n * 10) / 10;
const fail = message => { const e = new Error(message); e.statusCode = 400; throw e; };
export function raidName(raw) {
  const s = key(raw).replace(/[^a-z0-9]/g,'');
  return ({naxx:'Naxxramas',naxxramas:'Naxxramas',aq20:'AQ20',ruinsofahnqiraj:'AQ20',aq40:'AQ40',templeofahnqiraj:'AQ40',bwl:'BWL',blackwinglair:'BWL',mc:'MC',moltencore:'MC',zg:'ZG',zulgurub:'ZG',ony:'Onyxia',onyxia:'Onyxia',onyxiaslair:'Onyxia'})[s] || String(raw || 'Unbekannt');
}
function role(p) { const r=key(p.raidRole || p.signupRole); return r==='healer'||r==='heiler' ? 'healer' : r.includes('tank') ? 'tank' : r||'unknown'; }
export function selectPlayerRows(rows, name, server) {
  const unique=new Map();
  for(const row of rows) {
    const w=row.payload?.webAnalysis || row.payload || {};
    const r=w.rpb || w;
    const p=(r.players || []).find(x=>key(x.name)===key(name)&&key(x.server)===key(server));
    if(!p) continue;
    const report=r.report || w.report || {};
    const record={id:row.id, reportCode:report.reportCode||row.report_code, date:String(report.raidDate||row.raid_date||'').slice(0,10), raid:raidName(report.raid||row.raid), listedRaid:raidName(row.raid), report, r, p, generatedAt:row.generated_at};
    const marker=record.reportCode || row.id;
    if(!unique.has(marker) || String(record.generatedAt)>String(unique.get(marker).generatedAt)) unique.set(marker,record);
  }
  return [...unique.values()].sort((a,b)=>b.date.localeCompare(a.date)||String(b.generatedAt).localeCompare(String(a.generatedAt)));
}
function metricsFor(f,p) { return f.players?.[p.name] || Object.entries(f.players||{}).find(([n])=>key(n)===key(p.name))?.[1]; }
function killMetrics(record,p) {
  const source=Array.isArray(record.r.fights)&&record.r.fights.length ? record.r.fights : record.r.encounters||[];
  const seen=new Set();
  const fights=source.filter(f=>{
    const id=f.id??f.name;
    if(seen.has(id)||f.isBoss!==true||f.kill!==true||!metricsFor(f,p)) return false;
    seen.add(id);return true;
  });
  return fights.map(f=>({id:f.id,name:f.name,durationMs:num(f.durationMs),...metricsFor(f,p)}));
}
export function compareToPeers(value,values) {
  const known=values.filter(x=>num(x)!==null).map(Number);
  if(num(value)===null||known.length<3)return null;
  const mean=known.reduce((s,x)=>s+x,0)/known.length;
  if(mean<=0)return null;
  const delta=(Number(value)/mean-1)*100;
  return {mean:round(mean),deltaPercent:round(delta),peerCount:known.length,poor:delta<=-20+1e-9};
}
function countValue(value){
  if(typeof value==='number')return Number.isFinite(value)?value:null;
  const match=String(value??'').trim().match(/^(\d+)(?:\s|$)/);
  return match?Number(match[1]):null;
}
const coreAbility=/flash of light|holy light|holy shock|chain heal|healing wave|lesser healing wave|greater heal|flash heal|renew|rejuvenation|regrowth|healing touch|fireball|frostbolt|scorch|shadow bolt|shadowburn|mind blast|mind flay|sinister strike|backstab|bloodthirst|whirlwind|mortal strike|heroic strike|aimed shot|multi-shot|shred|claw|starfire|wrath/i;
function summarize(record) {
  const {p,r,report}=record, fights=killMetrics(record,p);
  const durationMs=sum(fights,'durationMs'), damage=sum(fights,'damageDone'), healing=sum(fights,'healingDone');
  const overheal=sum(fights,'overheal');
  const metric=role(p)==='healer'?'healingDone':'damageDone';
  // Compare only on this player's exact kills, with complete peer participation.
  const peerRows=(r.players||[]).filter(x=>x.className===p.className&&role(x)===role(p)).map(x=>{
    const peerFights=killMetrics(record,x).filter(f=>fights.some(t=>t.id===f.id&&t.name===f.name));
    const complete=peerFights.length===fights.length&&fights.length>0;
    const heal=complete?sum(peerFights,'healingDone'):null,damage=complete?sum(peerFights,'damageDone'):null,over=complete?sum(peerFights,'overheal'):null,duration=complete?sum(peerFights,'durationMs'):null;
    return {name:x.name,server:x.server,value:complete?round(rate(sum(peerFights,metric),duration)):null,hps:round(rate(heal,duration)),dps:round(rate(damage,duration)),healingDone:heal,damageDone:damage,overheal:over,overhealPercent:heal!==null&&over!==null&&heal+over>0?round(over*100/(heal+over)):null};
  }).filter(x=>x.value!==null).sort((a,b)=>b.value-a.value);
  const own=peerRows.find(x=>key(x.name)===key(p.name)&&key(x.server)===key(p.server));
  const deaths=(r.fights||[]).filter(f=>num(metricsFor(f,p)?.deaths)>0).map(f=>({boss:f.name,isBoss:f.isBoss===true,kill:f.kill===true,deaths:num(metricsFor(f,p).deaths)}));
  const warnings=[];
  if(record.raid!==record.listedRaid) warnings.push(`Raidlabel korrigiert: Liste „${record.listedRaid}“, tatsächlicher Bericht „${record.raid}“.`);
  if(!fights.length) warnings.push('Keine eindeutig markierten Bosskills mit Charakterdaten vorhanden.');
  if(durationMs===null||durationMs<=0) warnings.push('Bosskampfzeiten fehlen; HPS/DPS werden nicht berechnet.');
  const allMetrics=(r.fights||[]).map(f=>metricsFor(f,p)).filter(Boolean);
  if(allMetrics.length&&sum(allMetrics,'healingDone')!==null&&num(p.healingDone)!==null&&Math.abs(sum(allMetrics,'healingDone')-p.healingDone)>1) warnings.push('Gesamtheilung und Summe der gespeicherten Einzelkämpfe weichen voneinander ab.');
  const casts={};
  for(const f of fights) for(const [name,value] of Object.entries(f.abilityCasts||{})) {
    const label=name.replace(/\s*\((?:overheal|überheilung)%[^)]*\)/gi,'');
    if(/uptime|%/i.test(label)||num(value)===null) continue;
    casts[label]=(casts[label]||0)+Number(value);
  }
  const peerPlayers=(r.players||[]).filter(x=>x.className===p.className&&role(x)===role(p)&&!(key(x.name)===key(p.name)&&key(x.server)===key(p.server))&&peerRows.some(y=>y.name===x.name&&y.server===x.server));
  const metricComparison=role(p)==='tank'?null:compareToPeers(round(rate(metric==='healingDone'?healing:damage,durationMs)),peerRows.filter(x=>!(key(x.name)===key(p.name)&&key(x.server)===key(p.server))).map(x=>x.value));
  const activityComparison=compareToPeers(num(p.activityPercent),peerPlayers.map(x=>num(x.activityPercent)));
  const sectionId=role(p)==='healer'?'healer-casts':role(p)==='tank'?'tank-casts':['Warrior','Rogue','Hunter'].includes(p.className)?'physical-casts':'caster-casts';
  const sourceRows=(r.sections||[]).find(s=>s.id===sectionId)?.rows||[];
  const reportUsage=sourceRows.filter(row=>Number(row.spellId)>0&&row.originalLabel&&['count','text'].includes(row.type)).map(row=>{
    const value=row.values?.[p.name],count=countValue(value);
    const comparison=compareToPeers(count,peerPlayers.map(x=>countValue(row.values?.[x.name])));
    return {label:row.label,originalLabel:row.originalLabel,icon:row.icon||'',value:value==null?null:String(value),count,comparison:comparison?{...comparison,poor:comparison.poor&&coreAbility.test(row.originalLabel)&&!['cooldown','total'].includes(row.tone)}:null};
  }).filter(row=>row.count!==null);
  const castMetadata={};
  for(const row of sourceRows){if(!row.originalLabel)continue;const normalized=row.originalLabel.replace(/\s*\((?:overheal|überheilung)%[^)]*\)/gi,'');if(!castMetadata[normalized])castMetadata[normalized]={label:row.label.replace(/\s*\((?:overheal|überheilung)%[^)]*\)/gi,'').replace(/ (auf Trash|auf Bossen|gesamt)$/,''),icon:row.icon||''};}
  const castComparisons={};
  for(const [name,value] of Object.entries(casts)){
    const peers=peerPlayers.map(x=>{
      let count=0,known=false;for(const f of killMetrics(record,x).filter(f=>fights.some(t=>t.id===f.id))){for(const [n,v] of Object.entries(f.abilityCasts||{})){if(n.replace(/\s*\((?:overheal|überheilung)%[^)]*\)/gi,'')===name&&num(v)!==null){count+=Number(v);known=true;}}}return known?count:null;
    });
    const comparison=compareToPeers(value,peers);if(comparison)castComparisons[name]={...comparison,poor:comparison.poor&&coreAbility.test(name)};
  }
  return {metricComparison,activityComparison,reportUsage,castMetadata,castComparisons,id:record.id,date:record.date,raid:record.raid,reportUrl:report.reportUrl||'',generatedAt:record.generatedAt,name:p.name,server:p.server,className:p.className,role:role(p),kills:fights.length,raidKills:num(report.bossKills),bossDurationMs:durationMs,healing:healing,damage:damage,hps:round(rate(healing,durationMs)),dps:round(rate(damage,durationMs)),overhealPercent:healing!==null&&overheal!==null&&healing+overheal>0?round(overheal*100/(healing+overheal)):null,totalHealing:num(p.healingDone),totalDamage:num(p.damageDone),totalDeaths:num(p.deaths),bossDeaths:sum(fights,'deaths'),activity:num(p.activityPercent),worldBuffCount:num(p.worldBuffCount),rank:own?peerRows.filter(x=>x.value>own.value).length+1:null,peerCount:peerRows.length,peers:peerRows,deaths,casts,consumables:(r.consumableUsage?.players?.[p.name]?.items||[]).map(x=>({label:x.label||x.originalLabel,icon:x.icon||'',percent:num(x.percent),fightsUsed:num(x.fightsUsed),uses:num(x.uses),comparison:compareToPeers(num(x.percent),peerPlayers.map(peer=>num((r.consumableUsage?.players?.[peer.name]?.items||[]).find(item=>(item.label||item.originalLabel)===(x.label||x.originalLabel))?.percent)))})),bosses:fights.map(f=>({name:f.name,id:f.id,durationMs:f.durationMs,healing:num(f.healingDone),damage:num(f.damageDone),hps:round(rate(num(f.healingDone),f.durationMs)),dps:round(rate(num(f.damageDone),f.durationMs)),deaths:num(f.deaths),comparison:role(p)==='tank'?null:compareToPeers(round(rate(num(f[metric]),f.durationMs)),peerPlayers.map(peer=>{const b=killMetrics(record,peer).find(x=>x.id===f.id&&x.name===f.name);return b?round(rate(num(b[metric]),b.durationMs)):null;}))})),warnings};
}
export function buildPlayerAnalysis(rows,params) {
  const name=String(params.playerName||'').trim(),server=String(params.server||'').trim();
  if(!name||!server||name.length>80||server.length>80) fail('Bitte Charaktername und Server eingeben (je höchstens 80 Zeichen).');
  const records=selectPlayerRows(rows,name,server);
  const catalog=records.map(x=>({id:x.id,date:x.date,raid:x.raid}));
  if(!params.raid) return {catalog};
  const count=Number(params.count||1);
  if(![1,3,5].includes(count)) fail('Bitte einen einzelnen Raid oder die letzten 3 beziehungsweise 5 Raids auswählen.');
  const matching=records.filter(x=>key(x.raid)===key(raidName(params.raid)));
  if(count===1&&!params.analysisId) fail('Bitte einen Raidtermin auswählen.');
  const selected=(count===1?matching.filter(x=>x.id===params.analysisId):matching.slice(0,count)).reverse();
  if(!selected.length) fail('Für diese Auswahl sind keine gespeicherten Teilnahmen vorhanden.');
  const raids=selected.map(summarize),last=raids.at(-1),metric=last.role==='healer'?'hps':'dps';
  const observations=[],actions=[];
  const add=(title,text,action)=>{observations.push({title,text});if(action) actions.push(action);};
  if(raids.length<count) add('Weniger Teilnahmen verfügbar',`Es wurden ${raids.length} statt ${count} passende Teilnahmen gefunden. Alle verfügbaren werden ausgewertet.`);
  const comparable=raids.filter(x=>x.role===last.role&&x.rank!==null);
  if(comparable.length) add('Vergleich innerhalb der Klasse',comparable.map(x=>`${x.date}: Rang ${x.rank}/${x.peerCount}`).join(' · ')+'. Grundlage: dieselben Bosskills, Klasse und Rolle. Heil-/Tankaufträge und Ausrüstung sind nicht normalisiert.','Den Auftrag mit einem Spieler derselben Klasse und Rolle abgleichen, bevor aus Rangunterschieden Maßnahmen abgeleitet werden.');
  const low=raids.filter(x=>x.metricComparison?.poor);
  if(low.length)add('Deutlich unter dem Klassenvergleich',low.map(x=>`${x.date}: ${x[metric]} ${metric.toUpperCase()} gegenüber Ø ${x.metricComparison.mean} (${x.metricComparison.deltaPercent} %, ${x.metricComparison.peerCount} Vergleichsspieler)`).join(' · ')+'. Rot bedeutet mindestens 20 % unter dem Durchschnitt von mindestens drei anderen Spielern gleicher Klasse und Rolle auf denselben Bosskills. Aufgaben und Bedarf bleiben zu prüfen.');
  const repeated=new Map();
  raids.forEach(x=>{for(const boss of new Set(x.deaths.filter(d=>d.isBoss).map(d=>d.boss))){if(!repeated.has(boss))repeated.set(boss,[]);repeated.get(boss).push(x.date);}});
  for(const [boss,dates] of repeated) if(dates.length>=2) add(`Wiederkehrende Tode: ${boss}`,`In ${dates.length} ausgewerteten Raids dokumentiert (${dates.join(', ')}). Ursache und Vermeidbarkeit sind in den Summen nicht belegt.`,`Bei ${boss} die Todessequenzen, Positionen und vereinbarten Aufgaben gemeinsam prüfen.`);
  if(raids.length>1) {
    const first=raids[0];
    if(first.role!==last.role) add('Rollenwechsel','Erster und letzter Raid haben unterschiedliche Rollen. Ein direkter Leistungstrend wird nicht berechnet.');
    else {
      const names=[...new Set(first.bosses.map(x=>x.name))].filter(n=>last.bosses.some(x=>x.name===n));
      const shared=x=>x.bosses.filter(b=>names.includes(b.name));
      const field=metric==='hps'?'healing':'damage';
      const a=rate(sum(shared(first),field),sum(shared(first),'durationMs')),b=rate(sum(shared(last),field),sum(shared(last),'durationMs'));
      if(a!==null&&a>0&&b!==null) add('Entwicklung auf gemeinsamen Bossen',`${names.length} gemeinsame Bossnamen: ${round(a)} → ${round(b)} ${metric.toUpperCase()} (${round((b/a-1)*100)} %) zwischen ${first.date} und ${last.date}. Kampfablauf, Bedarf und Aufgaben können sich unterscheiden.`);
    }
  }
  if(last.role==='healer') add('Heilung und Überheilung',raids.map(x=>`${x.date}: ${x.overhealPercent===null?'keine Daten':x.overhealPercent+' %'} Overheal auf Bosskills`).join(' · ')+'. Overheal allein ist kein Fehlersignal; vorausschauende Heilung und parallele Heiler beeinflussen den Wert.','Bei niedriger effektiver Heilung Zielwahl, Heilfenster und Auftrag prüfen; Overheal nicht isoliert bewerten.');
  if(last.role==='tank') add('Tankbewertung','Schaden ist hier nur ein ergänzender Messwert. Aggroverlust, defensive Cooldown-Abdeckung und zugewiesene Tankaufgaben sind aus den verfügbaren Summen nicht sicher bewertbar.','Tankauftrag und Todesereignisse vor einem Leistungsurteil prüfen.');
  const topCasts=Object.entries(last.casts).sort((a,b)=>b[1]-a[1]).slice(0,3);
  if(topCasts.length) add('Fähigkeiten im letzten Raid',topCasts.map(([name,n])=>`${name}: ${n} erfasste Anwendungen`).join(' · ')+'. Gezählt in den ausgewerteten Bosskills. Der passende Einsatz hängt von Aufgabe und Kampfsituation ab.');
  const prep=raids.map(x=>`${x.date}: ${x.worldBuffCount===null?'nicht verfügbar':x.worldBuffCount} Worldbuff-Arten, ${x.consumables.length} Verbrauchskategorien mit gespeicherten Detaildaten`);
  add('Vorbereitungsnachweise',prep.join(' · ')+'. Diese Zahlen belegen weder durchgehende Uptime noch Vollständigkeit zum Pull.');
  if(!repeated.size) add('Todesereignisse','Keine Boss-Todesereignisse in den geladenen Einzelkämpfen ausgewiesen. Das ist nur bei vollständigen Ereignisdaten ein Beleg für einen fehlerfreien Verlauf.');
  const gaps=raids.flatMap(x=>x.consumables.filter(c=>/mageblood|magierblut|weapon enhancement|waffenverzauberung/i.test(c.label)&&c.percent!==null&&c.percent<80).map(c=>`${x.date}: ${c.label} in ${c.percent} % der berücksichtigten Kämpfe`));
  if(gaps.length) add('Buff-Nachweise prüfen',gaps.join(' · ')+'. Nachweis pro Kampf ist keine zeitliche Uptime.','Vorbereitungsbuffs nach Tod oder Unterbrechung kontrollieren.');
  return {catalog,analysis:{name:last.name,server:last.server,raid:last.raid,className:last.className,role:last.role,count:raids.length,requestedCount:count,metric,generatedAt:new Date().toISOString(),raids,observations,actions:[...new Set(actions)],limitations:['Nur gespeicherte Analysen der gewählten Gilde und des angegebenen Servers werden verwendet. Nicht gespeicherte Raids fehlen.','HPS/DPS beruhen ausschließlich auf eindeutig markierten Bosskills mit Charakterdaten und deren vollständiger Dauer. Trash und Wipes sind ausgeschlossen.','Teilnahmedauer innerhalb eines Kampfes, Aufgaben, Manaengpässe, erfolgreiche Dispels und vermeidbarer Schaden sind nicht vollständig belegt.','Parse-Werte werden nicht als Leistungsurteil verwendet. Verschiedene Aktivitätsdefinitionen werden nicht miteinander vermischt.','Worldbuff-Zahl bezeichnet erfasste Arten, nicht Uptime. Verbrauchsprozente zeigen Kämpfe mit Nachweis; fehlende Angaben bedeuten nicht automatisch fehlende Vorbereitung.','Der Bericht wird nachvollziehbar aus den gespeicherten Messwerten erstellt. Aussagen über persönliche Fehler erfordern die Prüfung der Ereignisse.']}};
}
