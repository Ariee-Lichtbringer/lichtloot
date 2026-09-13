(function(root){
'use strict';
const text=v=>String(v??''),esc=v=>text(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names={mc:'Molten Core',bwl:'Blackwing Lair',naxx:'Naxxramas',aq40:"Ahn’Qiraj",aq20:"Ruins of Ahn’Qiraj",zg:"Zul’Gurub",ony:'Onyxia'};
function type(value){const s=text(value).toLowerCase();if(/ruins|ruinen|aq.?20|qiraj.?20/.test(s))return 'aq20';if(/aq.?40|qiraj|tempel/.test(s))return 'aq40';if(/bwl|blackwing|pechschwingen/.test(s))return 'bwl';if(/naxx/.test(s))return 'naxx';if(/zul|^zg/.test(s))return 'zg';if(/ony/.test(s))return 'ony';if(/molten|^mc$|geschmolz/.test(s))return 'mc';return '';}
function day(value){const s=text(value);if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;const d=new Date(s);return Number.isNaN(d.valueOf())?'':new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);}
function reportCode(entry){return text(entry.reportCode||entry.logId||text(entry.reportUrl||entry.logUrl).match(/\/reports\/([a-zA-Z0-9]+)/)?.[1]);}
function merge(archives,analyses,external,guild){
 const records=[],byCode=new Map();
 for(const a of analyses){const code=reportCode(a),key=type(a.raid||a.title),date=day(a.raidDate||a.summary?.raidDate);const r={key,date,analysis:a,code};records.push(r);if(code)byCode.set(code,r);}
 if(guild==='lichtloot')for(const e of external){const code=reportCode(e),existing=code&&byCode.get(code);if(existing){existing.lichtstats=e;continue;}const r={key:type(e.zone||e.name),date:day(e.raidDate),lichtstats:e,code};records.push(r);if(code)byCode.set(code,r);}
 const assigned=new Set();
 for(const r of records){
  const explicit=r.analysis?.summary?.raidId||r.analysis?.summary?.linkedRaidId;
  const candidates=archives.filter(a=>explicit?text(a.id)===text(explicit):r.key&&type(a.type)===r.key&&day(a.date)===r.date);
  const peers=records.filter(other=>other.key===r.key&&other.date===r.date);
  if(candidates.length===1&&(explicit||peers.length===1)&&!assigned.has(candidates[0].id)){r.archive=candidates[0];assigned.add(r.archive.id);}
 }
 for(const a of archives)if(!assigned.has(a.id))records.push({key:type(a.type),date:day(a.date),archive:a});
 return records.sort((a,b)=>b.date.localeCompare(a.date)||text(b.archive?.time).localeCompare(text(a.archive?.time)));
}
function safeUrl(value){if(!text(value).trim())return '';try{const u=new URL(value,location.href);return ['https:','http:'].includes(u.protocol)?u.href:'';}catch{return '';}}
function number(...values){for(const v of values){if(v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v)))return Number(v);}return null;}
let generation=0,limit=24;
function configure(){
 const $=id=>document.getElementById(id),set=(id,v)=>{if($(id))$(id).textContent=v;};
 set('logsNavLabel','Raidchronik');set('logsDashboardTitle','Raidchronik');set('logsDashboardDescription','Vergangene Raids mit Auswertung, Warcraft Logs, Prioliste und Raidloot.');
 set('logDashReportsLabel','Raids');set('logDashClaLabel','Eigene Auswertungen');set('logDashRpbLabel','Lootprotokolle');set('logDashOpenLabel','Archivierte Raids');
 if($('logsDashboardSearch'))$('logsDashboardSearch').placeholder='Nach Raid, Datum oder Report suchen …';
 $('logsDashboardSection')?.classList.add('raid-chronicle');$('logsDashboardSection')?.classList.remove('is-lichtstats');
 const tags=document.querySelector('.logs-dashboard-search-tags');if(tags)tags.innerHTML='<span>Raid</span><span>Datum</span><span>Auswertung</span><span>Prioliste</span><span>Raidloot</span>';
 $('lichtstatsEmbed')?.removeAttribute('src');$('lichtstatsEmbed')?.classList.add('hidden');$('lichtstatsLoginBar')?.classList.add('hidden');
}
function render(entries){
 configure();const $=id=>document.getElementById(id),guild=CURRENT_GUILD_SLUG,query=text($('logsDashboardSearch')?.value).trim().toLowerCase();
 const group=entries.filter(r=>(['zg','aq20'].includes(r.key)?'20':'40')===dashboardLogRaidGroup);
 const list=group.filter(r=>{const date=r.date?new Date(r.date+'T12:00:00').toLocaleDateString('de-DE'):'';const hay=[names[r.key],r.archive?.title,r.analysis?.title,r.lichtstats?.name,r.date,date,r.code].join(' ').toLowerCase();return query.split(/\s+/).every(q=>hay.includes(q));});
 for(const [id,value] of Object.entries({logDashReports:group.length,logDashCla:group.filter(r=>r.analysis).length,logDashRpb:group.filter(r=>r.archive?.hasLootLog).length,logDashOpen:group.filter(r=>r.archive).length}))if($(id))$(id).textContent=value;
 const rows=$('logsDashboardRows');if(!rows)return;
 rows.innerHTML=list.length?list.slice(0,limit).map(r=>{
  const a=r.analysis,s=a?.summary||{},e=guild==='lichtloot'?r.lichtstats:null,archive=r.archive;
  const kills=number(s.bossKills,e?.bossKills),bosses=number(s.totalBosses,e?.totalBosses),wipes=number(s.wipeCount,s.wipes,e?.wipeCount),players=number(s.playerCount,e?.playerCount);
  const ready=s.webAnalysisStatus==='completed'||['cla_done','rpb_done','completed'].includes(a?.status)||e?.status==='completed';
  const analysis=a?.id?`raid-analyse.html?${new URLSearchParams({id:a.id,type:'rpb',guild})}`:'';
  const wcl=safeUrl(a?.reportUrl||e?.logUrl||(r.code?`https://vanilla.warcraftlogs.com/reports/${encodeURIComponent(r.code)}`:''));
  const action=(label,url,kind='')=>url?`<a class="${kind}" href="${esc(url)}" ${kind==='analysis'?'data-analysis':''} ${kind==='analysis'?'':'target="_blank" rel="noopener"'}>${label}</a>`:`<button type="button" disabled title="Noch nicht vorhanden">${label}<small>Noch nicht vorhanden</small></button>`;
  const archiveButton=(label,tab)=>archive?`<button type="button" data-archive="${esc(archive.id)}" data-tab="${tab}">${label}${tab==='loot'&&!archive.hasLootLog?'<small>Noch kein Lootprotokoll</small>':''}</button>`:action(label,'');
  return `<article class="log-dashboard-row"><div class="log-dashboard-raid"><img src="${esc(r.key?`images/raid-banners/${r.key}.jpg`:'images/guild-defaults/default-logo.webp')}" alt="" loading="lazy"><div><strong>${esc(archive?.title||e?.zone||names[r.key]||a?.raid||'Raid')}</strong><span>${esc(r.date)}${archive?.time?' · '+esc(archive.time)+' Uhr':''}</span></div></div><div class="log-dashboard-date">${r.date?esc(new Date(r.date+'T12:00:00').toLocaleDateString('de-DE')):'Datum unbekannt'}${players!==null?`<br>${players} Spieler`:''}</div><div class="log-dashboard-badges"><span class="log-badge ${ready?'done':''}">${ready?'fertig':archive?.hasLootLog?'Loot erfasst':a?'Auswertung in Vorbereitung':'Raid archiviert'}</span>${kills!==null?`<span class="log-badge done">${kills}${bosses!==null?'/'+bosses:''} Bosse</span>`:''}${wipes!==null?`<span class="log-badge ${wipes?'wait':'done'}">${wipes} Wipes</span>`:''}</div><div class="log-dashboard-actions">${action('Auswertung',analysis,'analysis')}${action('WCL',wcl,'wcl')}${archiveButton('Prioliste','prios')}${archiveButton('Raidloot','loot')}${guild==='lichtloot'&&e? action('LichtStats',safeUrl(e.url),'lichtstats'):''}</div></article>`;
 }).join(''):'<div class="status">Keine passenden Raids gefunden.</div>';
 rows.querySelectorAll('[data-archive]').forEach(b=>b.onclick=()=>showRaidArchiveCenter(b.dataset.archive,b.dataset.tab,'past'));
 rows.querySelectorAll('[data-analysis]').forEach(a=>a.onclick=event=>{event.preventDefault();openDashboardRaidAnalysis(a.href);});
 if(list.length>limit){const button=document.createElement('button');button.className='right-inline-btn chronicle-more';button.textContent='Weitere Raids anzeigen';button.onclick=()=>{limit+=24;render(entries);};rows.append(button);}
}
async function load(){
 const turn=++generation;configure();const rows=document.getElementById('logsDashboardRows');if(rows)rows.innerHTML='<div class="status">Raidchronik wird geladen …</div>';
 async function pages(path,field){let all=[],offset=0;for(;;){const data=await fetchRailwayApi(path+'&offset='+offset);if(data.success===false)throw Error(data.error||'Daten konnten nicht geladen werden');const batch=data[field]||[];all.push(...batch);if(!data.hasMore)break;offset+=batch.length;if(!batch.length)break;}return all;}
 const sources=[['Raidarchiv',pages('/api/public/raid-archive?scope=past','raids')],['Eigene Analysen',pages('/api/apps-script?action=getPublicLogAnalyses&limit=40','analyses')]];
 if(CURRENT_GUILD_SLUG==='lichtloot')sources.push(['LichtStats',(async()=>{let all=[];for(let offset=0;;offset+=100){const d=await fetchRailwayApi('/api/lichtstats/reports?limit=100&offset='+offset);if(d.success===false)throw Error('LichtStats nicht verfügbar');const batch=d.reports||[];all.push(...batch);if(batch.length<100)break;}return all;})()]);
 const result=await Promise.allSettled(sources.map(s=>s[1]));if(turn!==generation)return;
 dashboardLogAnalysesCache=merge(result[0].value||[],result[1].value||[],result[2]?.value||[],CURRENT_GUILD_SLUG);limit=24;render(dashboardLogAnalysesCache);
 const failed=result.flatMap((r,i)=>r.status==='rejected'?[sources[i][0]]:[]);document.getElementById('chronicleLoadNotice')?.remove();
 if(failed.length){const note=document.createElement('p');note.id='chronicleLoadNotice';note.className='status bad';note.setAttribute('role','status');note.textContent=failed.join(', ')+' konnten nicht geladen werden. Bitte „Neu laden“ versuchen.';rows?.before(note);}
}
root.RaidChronicle={merge,type,day,configure,render,load};
})(typeof window==='undefined'?globalThis:window);
