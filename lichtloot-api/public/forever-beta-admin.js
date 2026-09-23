(() => {
'use strict';
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const a=(text,href)=>{const n=el('a',text);n.href=href;return n;};
window.renderForeverDiscordSetup=(host,data,planning,api,reload)=>{
 host.replaceChildren(el('h3','Discord in vier Schritten'));
 const invite=a('1. PO Bot auf euren Server einladen','https://discord.com/oauth2/authorize?client_id=1527793332346945537&scope=bot%20applications.commands&permissions=2147568640&integration_type=0');invite.target='_blank';invite.rel='noopener';host.append(invite);
 host.append(el('p','2. Im gewünschten Kanal /forever_verbinden ausführen. Gildenkürzel: '+data.guild.slug+'. Den Leitungscode nur im privaten Eingabefenster des Bots eingeben.'));
 const check=data.discordCheck,result=check?.result||{},connected=!!data.discord;
 host.append(el('p','3. Server & Kanal: '+(connected?'verbunden':'noch nicht verbunden')));
 if(connected){const link=a('Verbundenen Kanal öffnen','https://discord.com/channels/'+data.discord.discord_guild_id+'/'+data.discord.channel_id);link.target='_blank';link.rel='noopener';host.append(link);}
 const status=el('p');status.setAttribute('role','status');host.append(status);
 if(check){const age=Date.now()-Date.parse(check.created_at);status.textContent=check.status==='done'?(result.error||'Bot: '+(result.bot?'erreichbar':'nicht bestätigt')+' · Server: '+(result.server?'erreichbar':'nicht bestätigt')+' · Kanalrechte: '+(result.permissions?'in Ordnung':'fehlen')):age>120000?'Noch keine Antwort des Bots. Bitte später erneut prüfen.':'Prüfung läuft. Nach etwa 30 Sekunden den Status aktualisieren.';host.append(el('small','Letzte Prüfung: '+new Date(check.updated_at).toLocaleString('de-DE')));}
 host.append(el('p','4. Testnachricht: '+(result.testSent?'erfolgreich gesendet':check?.kind==='test'&&check.status!=='done'?'wird gesendet':'noch nicht bestätigt')));
 for(const [label,action]of [['Verbindung prüfen','adminDiscordCheck'],['Testnachricht in den verbundenen Kanal senden','adminDiscordTest']]){const b=el('button',label);b.type='button';b.disabled=!connected;b.onclick=async()=>{b.disabled=true;try{await api(action);await reload();}catch(e){status.textContent=e.message;b.disabled=false;}};host.append(b);}
 const refresh=el('button','Prüfstatus aktualisieren');refresh.type='button';refresh.onclick=async()=>{refresh.disabled=true;try{await reload();}catch(e){status.textContent=e.message;refresh.disabled=false;}};host.append(refresh);
 if(result.messageId&&connected){const link=a('Testnachricht öffnen','https://discord.com/channels/'+data.discord.discord_guild_id+'/'+data.discord.channel_id+'/'+result.messageId);link.target='_blank';link.rel='noopener';host.append(link);}
};
window.renderForeverBetaAdmin=async(host,page,data,planning,api)=>{
 const titles={nachrichten:'Mitglieder informieren',betrieb:'Bot- & Update-Hinweise',pmzugang:'Plündermeister-Zugang',spieleranalyse:'Teilnahme je Charakter'};
 host.replaceChildren(el('h2',titles[page]));
 if(page==='pmzugang'){
  host.append(el('p','Der Plündermeister wird pro Raid einem freigegebenen SpielerLogin zugewiesen. Dieser Zugang darf Loot für den zugewiesenen Raid verwalten. Ein gemeinsames PM-Passwort ist dafür nicht nötig.'));
  for(const r of planning.raids){const u=new URL('forever-raids.html',location.href);u.searchParams.set('guild',data.guild.slug);u.searchParams.set('raid',r.id);u.hash='termine';host.append(a(r.title+' · Leitung und Plündermeister zuweisen',u.href));}
  if(!planning.raids.length)host.append(a('Zuerst einen Raid erstellen','#raid-erstellen'));return;
 }
 if(page==='spieleranalyse'){
  host.append(el('p','Erfasste Anmeldungen und Anwesenheit aus dieser Forever-Gilde. Keine Leistungsbewertung aus Kampflogs.'));
  try{const d=await api('adminPlayerAnalysis');if(!host.isConnected)return;const table=el('table'),head=el('tr');for(const title of ['Charakter','Anmeldungen','Anwesend','Unentschuldigt','Entschuldigt'])head.append(el('th',title));table.append(head);for(const p of d.players){const row=el('tr');for(const val of [p.name,p.registrations,p.present,p.noshow,p.excused])row.append(el('td',String(val)));table.append(row);}host.append(table);if(!d.players.length)host.append(el('p','Noch keine Charaktere vorhanden.'));}catch(e){host.append(el('p',e.message));}return;
 }
 host.append(el('p','Diese Mitteilung erscheint für angemeldete Mitglieder auf der Forever-Raidübersicht dieser Gilde. Es werden keine Discord-Direktnachrichten verschickt.'));
 const f=el('form');f.className='panel';const title=el('input'),message=el('textarea');title.maxLength=100;message.maxLength=4000;title.value=data.settings.announcement?.title||'';message.value=data.settings.announcement?.message||'';
 for(const [label,input] of [['Betreff',title],['Nachricht',message]]){const l=el('label',label);l.append(input);f.append(l);}
 if(page==='betrieb'){const presets=el('select');presets.setAttribute('aria-label','Hinweisvorlage');for(const text of ['Vorlage wählen','PO Bot vorübergehend nicht erreichbar','PO Bot wieder erreichbar','GuildLoot wird aktualisiert','GuildLoot wieder erreichbar'])presets.append(new Option(text,text));presets.onchange=()=>{if(presets.selectedIndex){title.value=presets.value;message.value=presets.value+'. Bitte beachtet die Informationen eurer Gildenleitung.';}};f.prepend(presets);}
 const save=el('button','Mitteilung veröffentlichen'),clear=el('button','Mitteilung entfernen'),status=el('p');clear.type='button';status.setAttribute('role','status');save.type='submit';f.append(save,clear,status);host.append(f);
 async function submit(remove){save.disabled=clear.disabled=true;try{await api('adminAnnouncement',{title:remove?'':title.value,message:remove?'':message.value});data.settings.announcement=remove?null:{title:title.value,message:message.value};if(remove){title.value='';message.value='';}status.textContent=remove?'Mitteilung entfernt.':'Mitteilung auf der Gildenseite veröffentlicht.';}catch(e){status.textContent=e.message;}finally{save.disabled=clear.disabled=false;}}
 f.onsubmit=e=>{e.preventDefault();if(!title.value.trim()||!message.value.trim()){status.textContent='Bitte Betreff und Nachricht ausfüllen.';return;}submit(false);};clear.onclick=()=>submit(true);
};
})();
