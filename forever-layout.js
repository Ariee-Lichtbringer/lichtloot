(() => {
'use strict';
const base=['localhost','127.0.0.1'].includes(location.hostname)?location.origin:'https://lichtloot-production.up.railway.app';
const raids={hyjal:'Hyjal Summit',barrow:'Barrow Deeps',onyxia:'Onyxias Hort',dungeon:'Dungeons',other:'Gildenabend'};
const sections={raidSignup:'Raidanmelder',poReleases:'P0-Freigaben',p0Plus:'P0+ Punkte',miniRaids:'Mini-Raidkacheln',gearPlanner:'Ausrüstungsvergleich'};
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
let current=null,loadVersion=0;
const get=(o,path,otherwise)=>path.split('.').reduce((v,k)=>v?.[k],o)??otherwise;
const set=(o,path,v)=>{const keys=path.split('.'),last=keys.pop();let at=o;for(const k of keys)at=at[k]??={};at[last]=v;};
function visible(node,on){if(node)node.toggleAttribute('data-layout-hidden',!on);}
function apply(layout){
 ++loadVersion;
 current=layout||null;const l=layout||{},root=document.documentElement;
 for(const [key,value] of Object.entries({'--gold':l.primaryColor,'--accent':l.accentColor,'--blue':l.accentColor,'--gold-rgb':l.primaryColor?.match(/[a-f\d]{2}/ig)?.map(x=>parseInt(x,16)).join(',')})){if(value)root.style.setProperty(key,value);else root.style.removeProperty(key);}
 document.body.style.backgroundImage=l.backgroundUrl?'linear-gradient(#060b18dc,#060b18ed),url('+JSON.stringify(l.backgroundUrl)+')':'';
 document.body.style.backgroundAttachment=l.backgroundUrl?'fixed':'';document.body.style.backgroundSize=l.backgroundUrl?'cover':'';
 document.querySelectorAll('aside img.brand,.sidebar .side-logo,.sidebar .brand-logo').forEach(img=>{img.dataset.defaultLogo??=img.getAttribute('src');img.src=l.logoUrl||img.dataset.defaultLogo;});
 const lead=location.pathname.endsWith('forever-leitung.html'),nav=document.querySelector(lead?'aside nav':'.sidebar');
 if(nav&&lead){
  const groups={'Raids & Anmeldungen':'raidorga','Loot & Punkte':'loot','Gildenbank':'bank','Mitglieder':'members','Analysen':'analyses'};
  for(const d of nav.querySelectorAll(':scope > details')){const key=groups[d.querySelector('summary')?.textContent];if(key)visible(d,l.guildManagementSections?.[key]!==false);}
  for(const [hash,key] of Object.entries({uebersicht:'dashboard',raidsheet:'raidSheet',logs:'loganalysen',pluendermeister:'lootMaster',p0items:'p0Items',punktesicherung:'backup',postfach:'mailbox'}))nav.querySelectorAll('a[href$="#'+hash+'"]').forEach(a=>visible(a,l.guildManagementSections?.[key]!==false));
  const admin=[...nav.querySelectorAll(':scope > details')].find(d=>d.querySelector('summary')?.textContent==='Einstellungen');if(admin)admin.querySelectorAll('a').forEach(a=>{if(a.hash!=='#layout'&&!['#punktesicherung','#raidsheet'].includes(a.hash))visible(a,l.guildManagementSections?.admin!==false);});
 }
 if(nav&&!lead){
  const groups={'Raidinformationen':'raidinfos','Raidorga':'raidorga','Gildenbank':'bank','Mitglieder':'members','Vorbereiten & Entdecken':'tools'};
  for(const d of nav.querySelectorAll('.forever-nav-group')){const title=d.querySelector('summary')?.firstChild?.textContent?.trim(),key=groups[title];if(key)visible(d,l.startPageSections?.navigation?.[key]!==false);}
  visible(nav.querySelector('a[href="#uebersicht"]'),l.startPageSections?.navigation?.dashboard!==false);
  visible(nav.querySelector('a[href="#p0"]'),l.startPageSections?.poReleaseRequest!==false);
  visible(nav.querySelector('a[href="#chronik"]'),l.startPageSections?.raidRecords!==false);
  nav.querySelectorAll('[data-forever-prio]').forEach(a=>visible(a,!l.supportedRaids||l.supportedRaids.includes(a.dataset.foreverPrio)));
 }
 document.querySelectorAll('img[data-raid-art-kind]').forEach(img=>{if(!img.dataset.explicitRaidImage)img.src=l.raidImages?.[img.dataset.raidArtKind]||img.dataset.defaultRaidImage;});
}
function sectionEnabled(kind,key){return current?.lootPageSections?.[key]!==false&&current?.lootPageSectionsByRaid?.[kind]?.[key]!==false;}
function withinWindow(raid){const days=current?.startPageSections?.raidCardDays||'all';return days==='all'||new Date(raid.starts_at)<=new Date(Date.now()+Number(days)*86400000);}
async function load(guild){const version=++loadVersion;apply(null);if(!guild)return;try{const r=await fetch(base+'/api/forever/layout?'+new URLSearchParams({guild}),{cache:'no-store'}),d=await r.json();if(version===loadVersion&&r.ok&&d.success)apply(d.layout);}catch{}}
window.ForeverLayout={apply,load,sectionEnabled,withinWindow,get current(){return current;}};
window.renderForeverLayoutEditor=(host,data,api,onSaved)=>{
 const original=structuredClone(data.savedLayout||data.layout||{});let draft=structuredClone(data.layout||{});
 host.replaceChildren(el('h2','Layout bearbeiten'),el('p','Logo, Farben, Raidbilder und sichtbare Bereiche für eure Forever-Gilde. Änderungen werden für diese Gilde gespeichert.'));
 const form=el('form',undefined,'forever-layout-form'),status=el('p','Bereit.','layout-status');status.setAttribute('role','status');host.append(form,status);
 const toolbar=el('div',undefined,'actions'),save=el('button','Layout speichern','primary');save.type='submit';const defaults=el('button','Standardwerte laden');defaults.type='button';const cancel=el('button','Änderungen verwerfen');cancel.type='button';toolbar.append(save,defaults,cancel);form.append(toolbar);
 const preview=el('div',undefined,'layout-live-preview');form.append(preview);
 const field=(parent,label,path,type='text',options)=>{const wrapper=el('label',undefined,type==='checkbox'?'layout-check':''),input=el(type==='select'?'select':'input');input.dataset.layoutPath=path;if(type!=='select')input.type=type;if(type==='select')for(const [v,t] of options)input.add(new Option(t,v));if(type==='checkbox'){input.checked=get(draft,path,true);wrapper.append(input,el('span',label));}else{input.value=get(draft,path,type==='color'?(path==='primaryColor'?'#facc15':'#60a5fa'):'');wrapper.append(el('span',label),input);}parent.append(wrapper);return input;};
 const group=(title,open=false)=>{const details=el('details',undefined,'layout-accordion');details.open=open;details.append(el('summary',title));const content=el('div',undefined,'layout-fields');details.append(content);form.append(details);return content;};
 const design=group('1. Grunddesign · Logo, Hintergrund und Farben',true);field(design,'Logo-URL','logoUrl');field(design,'Hintergrund-URL','backgroundUrl');field(design,'Hauptfarbe','primaryColor','color');field(design,'Akzentfarbe','accentColor','color');
 const discord=group('2. Discord-Bot und Channels');const bot=el('a','P0-Anmelder-Bot einladen','primary');bot.href='https://discord.com/oauth2/authorize?client_id=1527793332346945537&permissions=2147568640&scope=bot%20applications.commands&integration_type=0';bot.target='_blank';bot.rel='noopener';discord.append(bot,el('p','Im gewünschten Channel /forever_verbinden mit eurem Gildenkürzel und Leitungscode verwenden. Dafür ist „Server verwalten“ erforderlich.'));
 if(data.discord){const a=el('a','Verbundenen Raidanmelder-Channel öffnen');a.href='https://discord.com/channels/'+data.discord.discord_guild_id+'/'+data.discord.channel_id;discord.append(a);}else discord.append(el('p','Noch kein Raidanmelder-Channel verbunden.'));
 const groups=el('a','Channels je Raidgruppe verwalten →');groups.href='#gruppen';discord.append(groups);
 const art=group('3. Raidbilder');for(const [kind,name] of Object.entries(raids)){const box=el('div',undefined,'layout-image-field');field(box,name+' · Bild-URL','raidImages.'+kind);const image=window.foreverRaidArt({kind});image.dataset.previewKind=kind;box.append(image);art.append(box);}
 const priorities=group('4. Raidtypen und Prioritätsstufen');priorities.append(el('p','Aktive Raidtypen stehen bei der Erstellung neuer Termine zur Auswahl. Bestehende Termine bleiben erhalten.'));
 for(const [kind,name] of Object.entries(raids)){const label=el('label',undefined,'layout-check'),input=el('input');input.type='checkbox';input.dataset.supportedRaid=kind;input.checked=!draft.supportedRaids||draft.supportedRaids.includes(kind);label.append(input,el('span',name));priorities.append(label);}
 for(const n of [1,2,3]){const row=el('div',undefined,'layout-priority-row'),level=draft.priorityLevels?.find(l=>l.priority===n)||{priority:n,label:'P'+n,enabled:true};draft.priorityLevels??=[1,2,3].map(priority=>({priority,label:'P'+priority,enabled:true}));field(row,'P'+n+' aktiv','priorityLevels.'+(n-1)+'.enabled','checkbox');const input=field(row,'Bezeichnung','priorityLevels.'+(n-1)+'.label');input.maxLength=20;input.value=level.label;priorities.append(row);}
 const rules=group('5. Raidregeln');const rulesLink=el('a','Raidregeln und Discord-Link bearbeiten →','primary');rulesLink.href='#einstellungen';rules.append(el('p','Eure Gildenregeln werden im Forever-Gildenbereich angezeigt.'),rulesLink);
 const loot=group('6. Lootseiten · Inhalte und Anzeige');for(const [key,label] of Object.entries(sections))field(loot,label,'lootPageSections.'+key,'checkbox');field(loot,'Zeitpunkt des Prioeintrags unter dem Namen','prioListDisplay.prioEntryUnderName','checkbox').checked=draft.prioListDisplay?.prioEntryUnderName===true;field(loot,'Erfasste Anwesenheit unter dem Namen','prioListDisplay.attendanceUnderName','checkbox').checked=draft.prioListDisplay?.attendanceUnderName===true;
 field(loot,'Umfang der P0-Freigaben','lootPagePoReleaseScope','select',[['all','Alle Raidtermine'],['raid','Nur die aktuelle Raidart']]).value=draft.lootPagePoReleaseScope||'all';
 const matrix=el('div',undefined,'layout-matrix-scroll'),table=el('table'),head=el('tr');head.append(el('th','Lootseite'));const keys={...sections,prioRequiresSignup:'Prio nur mit Raidanmeldung'};for(const title of Object.values(keys))head.append(el('th',title));table.append(head);for(const [kind,name] of Object.entries(raids)){const row=el('tr');row.append(el('th',name));for(const [key,title] of Object.entries(keys)){const td=el('td'),input=field(td,name+': '+title,'lootPageSectionsByRaid.'+kind+'.'+key,'checkbox');input.setAttribute('aria-label',name+': '+title);row.append(td);}table.append(row);}matrix.append(table);loot.append(matrix);
 const start=group('7. Startseite und Gildenleitung');const startNav={dashboard:'Dashboard',raidinfos:'Raidinformationen',raidorga:'Raidorga',bank:'Gildenbank',members:'Mitglieder',tools:'Vorbereiten & Entdecken'};start.append(el('h3','Navigation auf der Startseite'));for(const [key,title] of Object.entries(startNav))field(start,title,'startPageSections.navigation.'+key,'checkbox');field(start,'P0-Freigaben','startPageSections.poReleaseRequest','checkbox');field(start,'Raidchronik und Statistiken','startPageSections.raidRecords','checkbox');field(start,'Zeitraum der Raidkacheln','startPageSections.raidCardDays','select',[['7','Nächste 7 Tage'],['14','Nächste 14 Tage'],['30','Nächste 30 Tage'],['60','Nächste 60 Tage'],['all','Alle kommenden Raids']]).value=draft.startPageSections?.raidCardDays||'all';
 start.append(el('h3','Navigation der Gildenleitung'),el('p','„Layout bearbeiten“ bleibt immer erreichbar.'));
 const management={dashboard:'Übersicht',raidorga:'Raids & Anmeldungen',loot:'Loot & Punkte',bank:'Gildenbank',members:'Mitglieder',analyses:'Analysen',raidSheet:'Aufstellungsplaner',loganalysen:'Loganalysen',lootMaster:'Plündermeister',p0Items:'Lootregeln',backup:'Sicherung',mailbox:'Postfach',admin:'Weitere Einstellungen'};
 for(const [key,title] of Object.entries(management))field(start,title,'guildManagementSections.'+key,'checkbox');
 function collect(){const next=structuredClone(draft);form.querySelectorAll('[data-layout-path]').forEach(input=>set(next,input.dataset.layoutPath,input.type==='checkbox'?input.checked:input.value));next.supportedRaids=[...form.querySelectorAll('[data-supported-raid]:checked')].map(i=>i.dataset.supportedRaid);return next;}
 function paint(){const l=collect();preview.replaceChildren(el('small','LIVE-VORSCHAU'),el('h3',data.guild.name),el('p','Raidübersicht · Anmeldungen · Loot'));preview.style.borderColor=l.primaryColor;preview.style.color=l.primaryColor;const safe=s=>/^https:\/\//.test(s)||/^\/?images\//.test(s);preview.style.backgroundImage=safe(l.backgroundUrl)?'linear-gradient(#080e19b0,#080e19b0),url('+JSON.stringify(l.backgroundUrl)+')':'';if(safe(l.logoUrl)){const img=el('img');img.src=l.logoUrl;img.alt='Logo-Vorschau';preview.prepend(img);}for(const img of form.querySelectorAll('[data-preview-kind]')){const kind=img.dataset.previewKind,src=l.raidImages?.[kind];img.src=safe(src)?src:img.dataset.defaultRaidImage;}status.textContent='Ungespeicherte Änderungen.';}
 form.addEventListener('input',paint);cancel.onclick=()=>window.renderForeverLayoutEditor(host,{...data,layout:original},api,onSaved);defaults.onclick=()=>window.renderForeverLayoutEditor(host,{...data,savedLayout:original,layout:{revision:original.revision||0}},api,onSaved);
 form.onsubmit=async e=>{e.preventDefault();save.disabled=true;status.textContent='Layout wird gespeichert …';try{const result=await api('adminLayout',{layout:collect()});apply(result.layout);await onSaved();status.textContent='Layout gespeichert.';}catch(error){status.textContent=error.message;}finally{save.disabled=false;}};
 paint();status.textContent='Bereit. Änderungen werden erst mit „Layout speichern“ übernommen.';
};
const stylesheet=document.createElement('link');stylesheet.rel='stylesheet';stylesheet.href='forever-layout.css?v=20260923';document.head.append(stylesheet);
const selected=()=>new URLSearchParams(location.search).get('guild')||sessionStorage.getItem('guildloot:forever:selectedGuild');load(selected());
document.addEventListener('change',e=>{if(e.target.id==='guildSelect')load(e.target.value);});
addEventListener('forever-session',e=>{if(e.detail?.layout)apply(e.detail.layout);else if(!e.detail)load(selected());});
})();
