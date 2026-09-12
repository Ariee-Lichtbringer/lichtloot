/* Shared information architecture; existing controls retain their handlers and permissions. */
(()=>{
 const makeButton=(label,action)=>{const b=document.createElement('button');b.type='button';b.className='side-link';b.innerHTML='<span class="side-icon">◆</span><span class="side-label"></span>';b.querySelector('.side-label').textContent=label;b.addEventListener('click',action);return b;};
 function mount(){
  const nav=document.querySelector('.sidebar .side-nav');if(!nav||nav.dataset.organized)return;nav.dataset.organized='true';
  const links=[...nav.querySelectorAll('.side-link')];
  const take=(fn,label)=>{const b=links.find(b=>(b.getAttribute('onclick')||'').includes(fn+'('));if(b&&label){b.querySelector('.side-label').textContent=label;b.setAttribute('aria-label',label);b.title=label;}return b;};
  function group(id,title,items){let g=document.getElementById(id);if(!g){g=document.createElement('div');g.id=id;g.className='side-group collapsed';const toggle=document.createElement('button');toggle.type='button';toggle.className='side-group-toggle';toggle.innerHTML='<span></span>';toggle.onclick=()=>{g.classList.toggle('collapsed');toggle.setAttribute('aria-expanded',String(!g.classList.contains('collapsed')));};g.append(toggle,document.createElement('div'));g.lastChild.className='side-group-items';}g.querySelector('.side-group-toggle span').textContent=title;const host=g.querySelector('.side-group-items');items.filter(Boolean).forEach(b=>host.append(b));return g;}
  const settings=document.getElementById('sideGroupAdmin');
  const backup=document.getElementById('sideGroupBackup');
  const raid=group('sideGroupRaidorga','Raids & Anmeldungen',[
   take('openRaidHelperPanel','Aktuelle Raids'),makeButton('Raid erstellen',()=>openRaidCreatorFromDashboard()),makeButton('Wochenrhythmen',()=>openRaidHelperPanel('scheduledEvents')),take('openRaidArchivePanel','Raidarchiv')
  ]);
  const loot=group('sideGroupLoot','Loot & Punkte',[makeButton('P0-Anmeldungen',()=>openRaidHelperPanel('poSignup')),take('openP0ReleasePanel','Freigabeanträge'),take('openP0PlusPanel','P0+ Punktekonten'),take('openPoItemSettingsPanel','Lootregeln'),take('openRaidleadPanelDirect','Plündermeister')]);
  loot.querySelectorAll('.side-link').forEach(button=>{if(['P0-Anmeldungen','Freigabeanträge','Lootregeln'].includes(button.querySelector('.side-label')?.textContent))button.classList.add('guild-prio-only');});
  const bank=group('sideGroupBank','Gildenbank',[take('openArmorRequestsPanel','Gildenbankanträge'),take('openGuildBankSettingsPanel','Einstellungen')]);
  const members=group('sideGroupMembers','Mitglieder',[take('openPlayerPanel','Spieler & Charaktere'),makeButton('Zugangsanträge',()=>openPendingLoginReview()),take('openIssueInboxPanel','Postfach'),take('openRaidMemberNoticePanel','Mitglieder informieren'),take('openPlayerAnalysis','Spieleranalyse')]);
  const analysis=group('sideGroupAnalysis','Analysen',[take('openLogAnalysisPanel','Loganalysen'),take('openTrafficStatsPanel','Aufrufstatistik')]);
  // Less frequent and guild-specific tools stay available with original visibility restrictions.
  const tools=group('sideGroupTools','Weitere Raidwerkzeuge',[take('openRaidPanel','Raidübersicht & Nachbereitung'),take('openRaidSetupPage','Aufstellungsplaner'),take('openBwlRaidSetupTest'),take('openPanemGearPlanner')]);
  settings?.querySelector('.side-group-toggle span')?.replaceChildren(document.createTextNode('Einstellungen'));
  if(settings){settings.querySelector('.side-group-items').append(tools);if(backup)settings.querySelector('.side-group-items').append(backup);}
  const buffs=document.getElementById('sideGroupBuffs');if(buffs)buffs.querySelector('.side-group-toggle span').textContent='Worldbuffs';
  const overview=take('scrollToDashboard','Übersicht');[overview,raid,loot,bank,members,buffs,analysis,settings].filter(Boolean).forEach(g=>nav.append(g));
  nav.addEventListener('click',event=>{const link=event.target.closest('.side-link');if(!link)return;nav.querySelectorAll('.side-link.active').forEach(el=>el.classList.remove('active'));link.classList.add('active');document.body.classList.remove('raid-unified-open');});
  const quick=document.querySelector('.dashboard-quick-action-p0');if(quick)quick.hidden=false;
  const create=document.querySelector('.dashboard-quick-action-raid');if(create){create.querySelector('strong').textContent='RAID ERSTELLEN';create.querySelector('.dashboard-quick-action-copy>span').textContent='Termin, Teilnehmer und P0 gemeinsam anlegen';create.querySelector('.dashboard-quick-action-cta').textContent='Raid erstellen →';}
  const names={scheduledEvents:['Wochenrhythmen','Automatische Veröffentlichung'],poSignup:['P0-Anmeldungen','Raidübergreifende Übersicht'],poCreate:['P0 ohne Raid','Einzelnen Anmelder erstellen'],pastEvents:['Vergangene Raids','Nachbereitung'],currentEvents:['Aktuelle Raids','Teilnehmer und Loot verwalten']};
  Object.entries(names).forEach(([key,[title,description]])=>{const tab=document.querySelector(`[data-raid-helper-tab="${key}"]`);if(tab){tab.querySelector('strong').textContent=title;const sub=tab.querySelector('.raid-helper-tab-copy>span');if(sub)sub.textContent=description;}});
  document.dispatchEvent(new Event('guild-navigation-ready'));
 }
 window.mountGuildRaidWorkspace=raidId=>{
  const root=document.getElementById('raidHelperCurrentDetail');if(!root||root.querySelector('.guild-raid-tabs'))return;
  const header=root.querySelector('.raid-helper-current-detail-head'),columns=root.querySelector('.raid-unified-columns');if(!header||!columns)return;
  const tabs=document.createElement('div');tabs.className='guild-raid-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Raidverwaltung');header.after(tabs);
  const panes=[];
  const add=(name,node)=>{if(!node)return;node.dataset.guildRaidPanel=name;panes.push(node);const b=document.createElement('button');b.type='button';b.setAttribute('role','tab');b.textContent=name;b.onclick=()=>{panes.forEach(p=>p.hidden=p!==node);[...tabs.children].forEach(t=>t.setAttribute('aria-selected',String(t===b)));};tabs.append(b);};
  const participants=columns.querySelector('.raid-unified-pane:not(.po)'),po=columns.querySelector('.po');
  const discord=root.querySelector('.raid-unified-toolbar-group:nth-child(2)');if(discord){columns.append(discord);discord.classList.add('raid-unified-pane');}
  add('Teilnehmer',participants);
  const formation=document.createElement('section');formation.className='raid-unified-pane';formation.innerHTML='<h3>Aufstellung</h3><p>Gruppen, Rollen und Bossaufgaben im Aufstellungsplaner verwalten.</p>';
  const setup=document.getElementById('raidSetupSideButton');
  if(setup&&getComputedStyle(setup).display!=='none'){const button=document.createElement('button');button.className='small-btn primary';button.textContent='Aufstellungsplaner öffnen';button.onclick=()=>openRaidSetupPage();formation.append(button);columns.append(formation);add('Aufstellung',formation);}
  add('Prios & P0',po);add('Discord-Beiträge',discord);
  const raid=findRaidByAnyId(raidId);
  const finish=document.createElement('section');finish.className='raid-unified-pane';finish.innerHTML='<h3>Nachbereitung</h3><p>Lootvergabe und Punkteübertragung für diesen Raid prüfen.</p>';const pm=document.createElement('button');pm.className='small-btn primary';pm.textContent='Raid im Plündermeister öffnen';pm.onclick=()=>openRaidleadPanelDirect(raidId);finish.append(pm);
  if(raid&&typeof canTransferP0PlusFromRaid==='function'&&canTransferP0PlusFromRaid(raid)){const transfer=document.createElement('button');transfer.className='small-btn good';transfer.textContent='P0+ Punkte übertragen';transfer.onclick=()=>isZgRaidForP0Transfer(raid)?openP0PlusTransferDialog(raidId):transferP0PlusFromGuild(raidId);finish.append(transfer);}
  columns.append(finish);add('Nachbereitung',finish);tabs.firstElementChild?.click();
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
