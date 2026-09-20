(() => {
'use strict';
const $ = id => document.getElementById(id);
const base = ['localhost','127.0.0.1'].includes(location.hostname) ? location.origin : 'https://lichtloot-production.up.railway.app';
const labels = {tank:'Tank',heal:'Heiler',dd:'Schaden',signed:'Zugesagt',bench:'Ersatzbank',late:'Komme später',tentative:'Vielleicht',absent:'Abgesagt',open:'Anmeldung offen',closed:'Anmeldung geschlossen',cancelled:'Termin abgesagt',completed:'Abgeschlossen',normal:'Normal',pvp:'PvP',rp:'Rollenspiel',warrior:'Krieger',paladin:'Paladin',hunter:'Jäger',rogue:'Schurke',priest:'Priester',shaman:'Schamane',mage:'Magier',warlock:'Hexenmeister',druid:'Druide',hyjal:'Hyjal Summit',barrow:'Barrow Deeps',onyxia:'Onyxias Hort',dungeon:'Dungeon',other:'Gildenabend / Sonstiges'};
const roleKeys=['tank','heal','dd'], classKeys=['warrior','paladin','hunter','rogue','priest','shaman','mage','warlock','druid'];
const dateFormat = new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',timeZone:'Europe/Berlin'});
let session=null, data=null, generation=0, selectedGuild='', editorSubmit, saving=false, loadedView='upcoming';
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const button=(title,action,cls='quiet')=>{const n=node('button',title,cls);n.type='button';n.onclick=action;return n;};
function notice(message,error=false){$('notice').textContent=message;$('notice').classList.toggle('error',error);$('notice').hidden=!message;}
function stored(key){try{return sessionStorage.getItem(key);}catch{return null;}}
function store(key,value){try{if(value===null)sessionStorage.removeItem(key);else sessionStorage.setItem(key,value);}catch{}}
function credentialKey(guild){return `guildloot:forever:${guild}:session`;}
async function api(action,extra={}) {
 if(!session)throw Error('Bitte zuerst anmelden.');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
 try {
  const response=await fetch(base+'/api/forever',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...extra,action,guild:session.guild,...(session.mode==='lead'?{masterCode:session.code}:{playerPin:session.code})}),signal:controller.signal});
  const result=await response.json().catch(()=>({}));
  if(!response.ok || !result.success)throw Error(result.error||'Die Forever-Planung ist gerade nicht erreichbar. Bitte erneut versuchen.');
  return result;
 } catch(error){if(error.name==='AbortError')throw Error('Die Anfrage dauert zu lange. Bitte erneut versuchen.');throw error;}
 finally{clearTimeout(timer);}
}
async function load() {
 const version=++generation;
 $('refresh').disabled=true;
 try {
  const result=await api('overview',{archive:$('viewFilter').value==='archive'});
  if(version!==generation)return;
  data=result;loadedView=$('viewFilter').value;$('login').hidden=true;$('workspace').hidden=false;
  $('identity').textContent=result.actor.label+' · '+result.guild.name;$('logout').hidden=false;
  $('guildName').textContent=result.guild.name;
  $('newRaid').hidden=$('newGroup').hidden=!result.actor.canManage;
  $('newCharacter').hidden=!result.actor.canSignup;
  render();
 }finally{if(version===generation)$('refresh').disabled=false;}
}
function logout(){generation++;if(session)store(credentialKey(session.guild),null);session=null;data=null;$('workspace').hidden=true;$('raidList').replaceChildren();$('login').hidden=false;$('logout').hidden=true;$('identity').textContent='Nicht angemeldet';$('loginForm').elements.code.value='';$('editor').close();$('roster').close();notice('');}
$('logout').onclick=logout;
$('refresh').onclick=()=>{notice('');load().catch(e=>notice(e.message,true));};
$('viewFilter').onchange=()=>{load().catch(e=>{$('viewFilter').value=loadedView;notice(e.message,true);});};
$('groupFilter').onchange=renderRaids;
function option(value,title){const n=node('option',title);n.value=value;return n;}
async function initialize(){
 try {
  const response=await fetch(base+'/api/apps-script?action=listGuilds',{cache:'no-store'}), result=await response.json();
  if(!response.ok || !Array.isArray(result.guilds))throw Error('Gilden konnten nicht geladen werden.');
  $('guildSelect').replaceChildren(option('','Gilde auswählen'),...result.guilds.map(g=>option(g.slug,g.name||g.slug)));
  const requested=new URLSearchParams(location.search).get('guild')||stored('guildloot:forever:selectedGuild');
  if(result.guilds.some(g=>g.slug===requested))$('guildSelect').value=requested;
  selectedGuild=$('guildSelect').value;
  const saved=stored(credentialKey(selectedGuild));
  if(saved){try{session=JSON.parse(saved);if(session.guild!==selectedGuild)throw Error('Falsche Gilde');await load();}catch{session=null;store(credentialKey(selectedGuild),null);}}
 }catch(error){$('guildSelect').replaceChildren(option('','Gilden konnten nicht geladen werden'));notice(error.message+' Bitte die Seite neu laden.',true);}
}
$('guildSelect').onchange=()=>{selectedGuild=$('guildSelect').value;$('loginForm').elements.code.value='';};
$('loginForm').onsubmit=async event=>{
 event.preventDefault();const form=event.currentTarget, submit=form.querySelector('button');submit.disabled=true;notice('');
 session={guild:form.elements.guild.value,mode:form.elements.mode.value,code:form.elements.code.value.trim()};
 try{await load();store(credentialKey(session.guild),JSON.stringify(session));store('guildloot:forever:selectedGuild',session.guild);const url=new URL(location.href);url.searchParams.set('guild',session.guild);history.replaceState(null,'',url);form.elements.code.value='';}
 catch(error){session=null;notice(error.message,true);}finally{submit.disabled=false;}
};
function render(){
 for(const link of document.querySelectorAll('a[href^="forever.html"]')){const url=new URL(link.getAttribute('href'),location.href);url.searchParams.set('guild',session.guild);link.href=url.pathname+url.search+url.hash;}
 const selected=$('groupFilter').value;
 $('groupFilter').replaceChildren(option('','Alle Gruppen'),...data.groups.map(g=>option(g.id,g.name)));
 if(data.groups.some(g=>g.id===selected))$('groupFilter').value=selected;
 $('statRaids').textContent=data.raids.length;
 const mine=data.raids.filter(r=>r.signups.some(s=>s.mine&&s.status==='signed'));
 $('statMine').textContent=mine.length;$('statGroups').textContent=data.groups.length;
 const next=mine.filter(r=>new Date(r.starts_at)>new Date()&&!['cancelled','completed'].includes(r.status)).sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at))[0];
 $('statNext').textContent=next?dateFormat.format(new Date(next.starts_at))+' · '+next.time:'–';$('statNextTitle').textContent=next?.title||'Noch keine Zusage';
 renderRaids();
 $('characterList').replaceChildren();
 if(!data.characters.length)$('characterList').append(node('p',data.actor.canSignup?'Noch kein Forever-Charakter angelegt. Starte mit deinem ersten Charakter.':'Mit dem SpielerLogin kannst du eigene Charaktere anlegen und dich anmelden.','subtle'));
 for(const c of data.characters){const row=node('div',undefined,'list-row'),info=node('div');info.append(node('strong',c.name),node('small',`${labels[c.class_name]} · ${labels[c.role]} · ${labels[c.ruleset]}`));row.append(info,button('Bearbeiten',()=>characterEditor(c)));$('characterList').append(row);}
 $('groupList').replaceChildren();
 if(!data.groups.length)$('groupList').append(node('p',data.actor.canManage?'Legt eine Stammgruppe an – etwa „Freitagsraid“. Termine sind auch ohne feste Gruppe möglich.':'Eure Leitung hat noch keine feste Gruppe angelegt.','subtle'));
 for(const g of data.groups){const row=node('div',undefined,'list-row'),info=node('div');info.append(node('strong',g.name),node('small',`${data.raids.filter(r=>r.group_id===g.id).length} Termine in dieser Ansicht`));row.append(info);if(data.actor.canManage)row.append(button('Umbenennen',()=>groupEditor(g)));$('groupList').append(row);}
}
function renderRaids(){
 const list=$('raidList');list.replaceChildren();const group=$('groupFilter').value;
 const raids=data.raids.filter(r=>!group||r.group_id===group);
 if(!raids.length){const empty=node('div',undefined,'empty');empty.append(node('h3','Platz für euren nächsten Abend.'),node('p',data.actor.canManage?'Erstelle einen Raid, einen Dungeonabend oder euren ersten Forever-Treff.':'Hier erscheinen die Termine eurer Leitung. Lege schon jetzt deinen Forever-Charakter an.'));if(data.actor.canManage)empty.append(button('Ersten Termin erstellen',()=>raidEditor(),'primary'));list.append(empty);}
 for(const raid of raids){
  const card=node('article',undefined,'raid-card');card.id='raid-'+raid.id;
  const top=node('div',undefined,'raid-top'),tile=node('div',undefined,'date-tile'),d=new Date(raid.starts_at);
  tile.append(node('strong',new Intl.DateTimeFormat('de-DE',{day:'2-digit',timeZone:'Europe/Berlin'}).format(d)),node('small',new Intl.DateTimeFormat('de-DE',{month:'short',timeZone:'Europe/Berlin'}).format(d)));
  const info=node('div',undefined,'raid-info');info.append(node('h3',raid.title),node('p',`${new Intl.DateTimeFormat('de-DE',{weekday:'long',timeZone:'Europe/Berlin'}).format(d)} · ${raid.time} Uhr · ${raid.group_name||'Gildenweiter Termin'}`,'raid-meta'));
  const tags=node('div',undefined,'card-tags');tags.append(node('span',labels[raid.kind],'tag'),node('span',labels[raid.status],'tag'));info.append(tags);top.append(tile,info);card.append(top);
  const body=node('div',undefined,'raid-body');if(raid.description)body.append(node('p',raid.description,'description'));
  const signed=raid.signups.filter(s=>s.status==='signed'),targets=[raid.tanks,raid.heals,raid.size-raid.tanks-raid.heals];
  const counts=node('div',undefined,'role-counts');roleKeys.forEach((role,i)=>{const n=signed.filter(s=>s.role===role).length,box=node('div',labels[role],'role-box'+(n<targets[i]?' missing':''));box.append(node('b',`${n} / ${targets[i]}`));box.title=n<targets[i]?`Noch ${targets[i]-n} ${labels[role]} gesucht`:'Rollenbedarf gedeckt';counts.append(box);});body.append(counts);
  const bar=node('div',undefined,'fill-line'),fill=node('i');fill.style.width=Math.min(100,signed.length/raid.size*100)+'%';bar.append(fill);body.append(bar);
  const capacity=node('div',undefined,'capacity');capacity.append(node('span',`${signed.length} / ${raid.size} Plätze belegt`),node('span',`${raid.signups.filter(s=>s.status==='bench').length} auf Ersatzbank`));body.append(capacity);
  const mine=raid.signups.find(s=>s.mine);if(mine)body.append(node('p',`${labels[mine.status]} · ${mine.name} · ${labels[mine.role]}`,'my-status'));
  const actions=node('div',undefined,'raid-actions');
  if(raid.status==='open'&&new Date(raid.starts_at)>new Date()&&data.actor.canSignup)actions.append(button(mine?'Anmeldung ändern':'Anmelden',()=>data.characters.length?signupEditor(raid,mine):characterEditor(),'primary'));
  actions.append(button(`Teilnehmer (${raid.signups.length})`,()=>showRoster(raid)),button('Kalender',()=>calendar(raid)),button('Link kopieren',()=>copyLink(raid)));
  if(data.actor.canManage)actions.append(button('Verwalten',()=>raidEditor(raid)));
  body.append(actions);card.append(body);list.append(card);
 }
 const wanted=new URLSearchParams(location.search).get('raid');
 if(wanted){const card=$('raid-'+wanted);if(card)card.style.borderColor='#b7a4ff';}
}
function field(name,label,type,value,items,wide=false){
 const wrap=node('label',label,wide?'wide':''),input=document.createElement(type==='select'?'select':type==='textarea'?'textarea':'input');
 input.name=name;if(type!=='select'&&type!=='textarea')input.type=type;
 if(items)input.append(...items.map(([v,l])=>option(v,l)));
 input.value=value??'';input.required=!['description','note','groupId'].includes(name);
 if(type==='number'){input.min='0';input.max='40';input.step='1';}
 if(type==='text')input.maxLength=name==='title'?100:60;
 if(type==='textarea')input.maxLength=name==='note'?240:1500;
 wrap.append(input);return wrap;
}
const choices=keys=>keys.map(k=>[k,labels[k]]);
function editor(title,fields,submit){
 $('editorTitle').textContent=title;$('editorFields').replaceChildren(...fields);$('editorError').textContent='';editorSubmit=submit;$('editorForm').querySelector('button[type=submit]').disabled=false;$('roster').close();$('editor').showModal();
}
$('closeEditor').onclick=()=>{if(!saving)$('editor').close();};
$('editor').addEventListener('cancel',e=>{if(saving)e.preventDefault();});
$('editorForm').onsubmit=async e=>{
 e.preventDefault();if(saving)return;saving=true;const submit=e.currentTarget.querySelector('button[type=submit]');submit.disabled=true;$('editorError').textContent='';
 try{const values=Object.fromEntries(new FormData(e.currentTarget));const result=await editorSubmit(values);$('editor').close();notice(result.status==='bench'?'Der Termin ist voll. Deine Anmeldung steht auf der Ersatzbank.':'Gespeichert.');try{await load();}catch(error){notice('Gespeichert, aber die Ansicht konnte nicht aktualisiert werden. Bitte „Aktualisieren“ wählen.',true);}}
 catch(error){$('editorError').textContent=error.message;}finally{saving=false;submit.disabled=false;}
};
function characterEditor(c={}){editor(c.id?'Charakter bearbeiten':'Forever-Charakter anlegen',[
 field('name','Charaktername (gegebenenfalls mit Nachnamen)','text',c.name),field('ruleset','Regelwerk','select',c.ruleset||'normal',choices(['normal','pvp','rp'])),field('className','Klasse','select',c.class_name||'warrior',choices(classKeys)),field('role','Bevorzugte Rolle','select',c.role||'dd',choices(roleKeys))
 ],v=>api('saveCharacter',{...v,id:c.id}));}
function groupEditor(g={}){editor(g.id?'Raidgruppe umbenennen':'Raidgruppe anlegen',[field('name','Name der Gruppe','text',g.name,null,true)],v=>api('saveGroup',{...v,id:g.id}));}
function raidEditor(r={}){
 const fields=[field('title','Titel','text',r.title,null,true),field('kind','Ziel','select',r.kind||'hyjal',choices(['hyjal','barrow','onyxia','dungeon','other'])),field('groupId','Raidgruppe','select',r.group_id||'',[['','Gildenweiter Termin'],...data.groups.map(g=>[g.id,g.name])]),field('date','Datum','date',r.date),field('time','Uhrzeit · Europe/Berlin','time',r.time||'20:00'),field('size','Plätze insgesamt','number',r.size||20),field('tanks','Davon Tanks','number',r.tanks??2),field('heals','Davon Heiler','number',r.heals??4),field('status','Anmeldung / Terminstatus','select',r.status||'open',choices(['open','closed','cancelled','completed'])),field('description','Treffpunkt, Hinweise & Regeln (optional)','textarea',r.description,null,true)];
 editor(r.id?'Termin verwalten':'Neuen Termin planen',fields,v=>api('saveRaid',{...v,id:r.id,revision:r.revision}));
 const form=$('editorForm');form.elements.size.min='1';
 if(!r.id)form.elements.kind.onchange=()=>{const defaults={hyjal:[20,2,4],barrow:[10,2,2],onyxia:[40,2,8],dungeon:[5,1,1],other:[10,1,2]}[form.elements.kind.value];['size','tanks','heals'].forEach((key,i)=>form.elements[key].value=defaults[i]);};
}
function signupEditor(r,signup,manage=false){
 const c=data.characters.find(c=>c.id===signup?.characterId)||data.characters[0];
 const fields=[];
 if(!manage)fields.push(field('characterId','Dein Forever-Charakter','select',signup?.characterId||c?.id,data.characters.map(c=>[c.id,`${c.name} · ${labels[c.class_name]}`]),true));
 fields.push(field('role','Rolle für diesen Termin','select',signup?.role||c?.role||'dd',choices(roleKeys)),field('status','Deine Teilnahme','select',signup?.status||'signed',choices(['signed','bench','late','tentative','absent'])),field('note','Hinweis (z. B. „ab 20:30 Uhr“, optional)','textarea',signup?.note,null,true));
 editor(manage?`${signup.name} · Teilnahme bearbeiten`:'Deine Anmeldung',fields,v=>api(manage?'manageSignup':'signup',{...v,raidId:r.id,...(manage?{characterId:signup.characterId}:{})}));
 if(!manage)$('editorForm').elements.characterId.onchange=e=>{$('editorForm').elements.role.value=data.characters.find(c=>c.id===e.target.value)?.role||'dd';};
}
$('newCharacter').onclick=()=>characterEditor();$('newGroup').onclick=()=>groupEditor();$('newRaid').onclick=()=>raidEditor();
$('closeRoster').onclick=()=>$('roster').close();
function showRoster(r){
 $('rosterTitle').textContent=r.title;const host=$('rosterContent');host.replaceChildren();
 if(!r.signups.length)host.append(node('p','Noch keine Anmeldungen.','subtle'));
 for(const status of ['signed','bench','late','tentative','absent']){
  const list=r.signups.filter(s=>s.status===status);if(!list.length)continue;host.append(node('h3',`${labels[status]} (${list.length})`));
  for(const s of list){const row=node('div',undefined,'roster-row'),info=node('div');info.append(node('strong',s.name+(s.mine?' · Du':'')),node('small',`${labels[s.className]} · ${labels[s.role]} · ${labels[s.ruleset]}`));if(s.note)info.append(node('p',s.note));row.append(info);if(data.actor.canManage&&!['cancelled','completed'].includes(r.status))row.append(button('Bearbeiten',()=>signupEditor(r,s,true)));host.append(row);}
 }
 if(data.actor.canManage){const h=node('div',undefined,'history');const show=button('Änderungsverlauf laden',async()=>{show.disabled=true;try{const result=await api('history',{raidId:r.id}),list=node('ul');for(const row of result.history)list.append(node('li',`${new Date(row.created_at).toLocaleString('de-DE',{timeZone:'Europe/Berlin'})} · ${row.actor}: ${row.detail}`));h.replaceChildren(list);}catch(error){show.disabled=false;h.append(node('p',error.message,'form-error'));}});h.append(show);host.append(h);}
 $('roster').showModal();
}
function raidLink(r){const url=new URL(location.href);url.search='';url.hash='';url.searchParams.set('guild',session.guild);url.searchParams.set('raid',r.id);return url.href;}
async function copyLink(r){try{await navigator.clipboard.writeText(raidLink(r));notice('Terminlink kopiert. Gildenmitglieder können ihn mit ihrem Login öffnen.');}catch{notice('Terminlink: '+raidLink(r));}}
function calendar(r){
 const escape=value=>String(value).replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
 const stamp=value=>new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z/,'Z');
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//GuildLoot//Forever//DE','BEGIN:VEVENT',`UID:${r.id}@guildloot-forever`,`DTSTAMP:${stamp(Date.now())}`,`DTSTART:${stamp(r.starts_at)}`,`SUMMARY:${escape(r.title)}`,`DESCRIPTION:${escape(r.description+'\n'+raidLink(r))}`,`STATUS:${r.status==='cancelled'?'CANCELLED':'CONFIRMED'}`,'END:VEVENT','END:VCALENDAR'];
 const url=URL.createObjectURL(new Blob([lines.join('\r\n')+'\r\n'],{type:'text/calendar;charset=utf-8'})),a=node('a');a.href=url;a.download='forever-termin.ics';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
initialize();
})();
