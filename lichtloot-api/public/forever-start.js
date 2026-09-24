(() => {
'use strict';
const $=id=>document.getElementById(id),base=['localhost','127.0.0.1'].includes(location.hostname)?location.origin:'https://lichtloot-production.up.railway.app';
let session=null;
const key=g=>`guildloot:forever:${g}:session`;
function read(k){try{return sessionStorage.getItem(k);}catch{return null;}}
function store(k,v){try{v===null?sessionStorage.removeItem(k):sessionStorage.setItem(k,v);}catch{}}
function notice(text){$('notice').textContent=text;$('notice').hidden=!text;}
function url(path,guild){const u=new URL(path,location.href);if(guild)u.searchParams.set('guild',guild);return u.pathname+u.search+u.hash;}
function syncGuild(){const g=$('guildSelect').value;$('createAccount').href=url('forever-register.html',g);}
async function login(candidate){
 const response=await fetch(base+'/api/forever',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'overview',guild:candidate.guild,...(candidate.mode==='lead'?{masterCode:candidate.code}:{playerPin:candidate.code})})});
 const data=await response.json();if(!response.ok||!data.success)throw Error(data.error||'Anmeldung nicht möglich. Bitte erneut versuchen.');
 window.ForeverLayout?.apply(data.layout);session=candidate;store(key(session.guild),JSON.stringify(session));store('guildloot:forever:selectedGuild',session.guild);
 history.replaceState(null,'',url('forever-start.html',session.guild));
 $('entry').hidden=true;$('account').hidden=false;$('welcomeTitle').textContent='Willkommen '+data.actor.label;$('guildName').textContent=data.guild.name;
 $('account').querySelector('.success').textContent='✓ '+(candidate.mode==='lead'?'Gildenleitung':'SpielerLogin')+' aktiv · Forever';
 $('characters').replaceChildren();
 const classes={warrior:'Krieger',paladin:'Paladin',hunter:'Jäger',rogue:'Schurke',priest:'Priester',shaman:'Schamane',mage:'Magier',warlock:'Hexenmeister',druid:'Druide'},roles={tank:'Tank',heal:'Heiler',dd:'Schaden (offen)',melee:'Nahkampf',ranged:'Fernkampf'};
 for(const c of data.characters){const row=document.createElement('div');row.className='character';const title=document.createElement('strong'),meta=document.createElement('small');title.textContent=c.name;meta.textContent=(classes[c.class_name]||c.class_name)+' · '+(roles[c.role]||c.role);const info=document.createElement('div');info.append(title,meta);window.foreverClassIdentity(row,info,c.class_name);$('characters').append(row);}
 if(!data.characters.length){const p=document.createElement('p');p.className='muted';p.textContent=data.actor.canSignup?'Noch kein Forever-Charakter angelegt. Erstelle deinen ersten Charakter, um dich für Raids anzumelden.':'Mit dem SpielerLogin kannst du eigene Charaktere anlegen und dich anmelden.';$('characters').append(p);}
 $('leadershipLink').hidden=!data.actor.canManage;$('leadershipLink').href=url('forever-leitung.html',session.guild);
 $('raidsLink').href=url('forever-raids.html',session.guild);$('charactersLink').href=url('forever-raids.html#charaktere',session.guild);$('charactersLink').hidden=!data.actor.canSignup;
 $('charactersLink').textContent=data.characters.length?'Charaktere verwalten':'Ersten Forever-Charakter anlegen';notice('');
}
function logout(){if(session)store(key(session.guild),null);session=null;$('account').hidden=true;$('entry').hidden=false;$('loginForm').elements.code.value='';notice('');}
function syncRecoveryQuestion(){const legacy=$('recoveryQuestion').value==='legacy';$('legacyQuestionLabel').hidden=!legacy;$('legacyQuestion').disabled=!legacy;$('legacyQuestion').required=legacy;}
$('recoveryQuestion').onchange=syncRecoveryQuestion;
$('recoverLogin').onclick=()=>{if(!$('guildSelect').value){notice('Bitte zuerst eine Gilde auswählen.');return;}$('recoveryForm').reset();syncRecoveryQuestion();$('recoveryMessage').textContent='';$('recovery').showModal();};$('closeRecovery').onclick=()=>$('recovery').close();$('recoveryForm').onsubmit=async e=>{e.preventDefault();const f=e.currentTarget,b=f.querySelector('button');b.disabled=true;try{const r=await fetch(base+'/api/forever/recover',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({guild:$('guildSelect').value,...Object.fromEntries(new FormData(f)),question:f.elements.question.value==='legacy'?$('legacyQuestion').value:f.elements.question.value})}),d=await r.json();if(!r.ok||!d.success)throw Error(d.error||'Wiederherstellung fehlgeschlagen.');f.reset();syncRecoveryQuestion();$('recoveryMessage').textContent=d.message;}catch(e){$('recoveryMessage').textContent=e.message;}finally{b.disabled=false;}};
$('logout').onclick=logout;$('switchGuild').onclick=()=>{logout();$('guildSelect').focus();};$('guildSelect').onchange=syncGuild;
$('loginForm').onsubmit=async event=>{event.preventDefault();const f=event.currentTarget,b=f.querySelector('button');b.disabled=true;notice('SpielerLogin wird geprüft …');try{await login({guild:f.elements.guild.value,mode:f.elements.mode.value,code:f.elements.code.value.trim()});f.elements.code.value='';}catch(e){notice(e.message);}finally{b.disabled=false;}};
(async()=>{try{const res=await fetch(base+'/api/apps-script?action=listGuilds&game=forever'),d=await res.json();if(!res.ok||!Array.isArray(d.guilds))throw Error('Gilden konnten nicht geladen werden. Bitte lade die Seite erneut.');$('guildSelect').replaceChildren(new Option('Gilde auswählen',''),...d.guilds.map(g=>new Option(g.name||g.slug,g.slug)));const g=new URLSearchParams(location.search).get('guild')||read('guildloot:forever:selectedGuild');if(d.guilds.some(x=>x.slug===g)){$('guildSelect').value=g;syncGuild();const saved=read(key(g));if(saved){try{const candidate=JSON.parse(saved);if(candidate.guild===g)await login(candidate);}catch{store(key(g),null);notice('Bitte melde dich erneut an.');}}}}catch(e){notice(e.message);}})();
})();
