/* Find dashboard functions without changing guild or account context. */
(()=>{
  const init=()=>{
    const management=Boolean(document.getElementById('dashboardTop'));
    const header=document.querySelector(management?'#dashboardTop > .topbar':'.start-header');
    if(!header||document.getElementById('startFunctionSearch'))return;
    const account=(tile)=>{
      openAccountManagementCenter();
      showMeinLichtLootSection('chars');
      if(tile){
        initCharacterManagementTiles();
        const button=document.querySelector(`[data-character-manage-tile="${tile}"]`);
        button?.click();
        button?.scrollIntoView({block:'center',behavior:'smooth'});
      }
    };
    const entries=management?[
      ['Raid erstellen','Neuen Raid und Anmelder erstellen','raid erstellen anlegen neu anmeldung schnell',()=>openRaidCreatorFromDashboard()],
      ['Wochenrhythmen','Gespeicherte automatische Raidtermine','wochenrhythmen wochenrhythmus wochenrythmus rhythmus woche automatisch wiederholen geplant',()=>openRaidHelperPanel('scheduledEvents')],
      ['Aktuelle Raids','Teilnehmer und Anmeldungen verwalten','raid aktuell anmeldung teilnehmer aufstellung',()=>openRaidHelperPanel('currentEvents')],
      ['Raidarchiv','Vergangene Raids','archiv raid vergangen historie',()=>openRaidArchivePanel()],
      ['Spieler & Charaktere','Spielerlogins und Twinks verwalten','spieler charakter twink login pin zugang suchen',()=>openPlayerPanel()],
      ['Zugangsanträge','Neue Spielerzugänge prüfen','zugang antrag anträge login freischalten',()=>openPendingLoginReview()],
      ['Freigabeanträge','P0-Freigaben prüfen','p0 freigabe freigeben antrag anträge',()=>openP0ReleasePanel()],
      ['P0-Anmelder erstellen','Neuen P0-Anmelder direkt erstellen','p0 po anmelder anmeldung erstellen anlegen neu',()=>openP0OnlyCreatorFromDashboard()],
      ['P0-Anmeldungen','Raidübergreifende Übersicht','p0 po anmeldung anmelden',()=>openRaidHelperPanel('poSignup')],
      ['P0+ Punktekonten','Punkte verwalten','punkte p0+ konto punktekonten',()=>openP0PlusPanel()],
      ['Lootregeln','P0- und Item-Einstellungen','loot regeln items einstellungen',()=>openPoItemSettingsPanel()],
      ['Postfach','Nachrichten und Anfragen','postfach nachrichten support mail',()=>openIssueInboxPanel()],
      ['Worldbuffs','Worldbuff-Termine verwalten','worldbuff buff termin eintragen',()=>openWorldbuffPanel()],
      ['Loganalysen','Raids auswerten','logs loganalyse analyse auswertung',()=>openLogAnalysisPanel()],
      ['Vorlagen','Raidvorlagen verwalten','vorlage template raid vorlagen',()=>openRaidHelperPanel('templates')],
      ['Einstellungen','Gildenlayout und Funktionen','einstellungen layout gilde funktionen',()=>openLootLayoutPanel()]
    ]:[
      ['Raid erstellen','Schnell Raid erstellen öffnen','raid erstellen anlegen neu schnell popup',()=>{if(document.getElementById('raidCreateBox')?.classList.contains('hidden'))toggleRaidCreate();}],
      ['Charakter hinzufügen','Charaktere → Neuer Charakter','char charakter charaktere twink alt main hinzufügen hinzufuegen anlegen erstellen neu add',()=>account('add')],
      ['Charakter löschen','Charaktere → Charakter entfernen','char charakter twink löschen loeschen entfernen delete',()=>account('remove')],
      ['Meine Charaktere','Charakter wählen und verwalten','mein lichtloot nachtloot account profil charakter char twink wechseln verwalten',()=>account()],
      ['Punkte & Prios','Deine P0+ Punkte und Priolisten','punkte prios prioritäten prioritaeten loot p0 p0+ historie',()=>account('history')],
      ['Raidkalender','Deine Raidtermine im Kalender','raid kalender termine anmeldung raidanmeldung',()=>{account();openRaidCalendarModal();}],
      ['Worldbuff eintragen','Eigene Buff-Termine verwalten','worldbuff buff eintragen hinzufügen planen verschieben',()=>{account();showMeinLichtLootSection('worldbuffs');}],
      ['Worldbuffs ansehen','Alle kommenden Worldbuffs','worldbuff buffs termine ony nef rend',()=>showBuffOverview('worldbuff')],
      ['Postfach öffnen','Deine Nachrichten','postfach nachrichten mail inbox',()=>{account();openPlayerMailbox();}],
      ['Loganalyse','Raids und Kampflogs auswerten','logs loganalyse analyse auswertung',()=>showLogsDashboard()]
    ];
    const raidEntries=()=>{
      if(management)return [];
      const upcoming=(window.dashboardUpcomingRaidCards||[]);
      return Object.entries(raids).filter(([key])=>['mc','bwl','aq40','naxx','zg','aq20','ony'].includes(key)).flatMap(([key,config])=>{
        const dates=upcoming.filter(row=>row._raidKey===key);
        return (dates.length?dates:[null]).flatMap(row=>{
          const detail=row?`${formatRaidDateForDisplay(activeRaidDate(row))} · ${formatRaidTimeForDisplay(activeRaidTime(row))} Uhr`:'Raidseite öffnen · Termin dort auswählen';
          const target=signup=>{
            const url=new URL(withGuildUrl(config.lootPage),location.href);
            if(row&&activeRaidPin(row))url.searchParams.set('pin',activeRaidPin(row));
            if(signup)url.searchParams.set('view','signup');
            location.href=url.href;
          };
          const aliases=key==='zg'?'zul gurub zulgurub':key==='mc'?'geschmolzener kern':key==='bwl'?'pechschwingenhort':key==='aq40'?'aq 40':key==='aq20'?'aq 20':'';
          return [
            [`${config.name}: Prio eintragen`,detail,`${key} ${config.short} ${aliases} prio priorität prioritaet prioliste loot eintragen setzen`,()=>target(false)],
            [`${config.name}: Raidanmeldung`,detail,`${key} ${config.short} ${aliases} raid anmeldung anmelden teilnehmen teilnehmer`,()=>target(true)]
          ];
        });
      });
    };
    const normal=value=>value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ß/g,'ss').replace(/[^a-z0-9+ ]/g,' ');
    const section=document.createElement('section');
    section.className='start-function-search';
    section.setAttribute('aria-label','Funktionen suchen');
    section.innerHTML='<form role="search"><label for="startFunctionSearch">Was möchtest du machen?</label><div class="start-search-field"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><input id="startFunctionSearch" type="search" autocomplete="off" placeholder="Funktion, Raid, Spieler oder Item" aria-controls="startSearchResults"><button type="submit">Suchen</button></div></form><div id="startSearchResults" class="start-search-results" hidden></div><p class="start-search-status" role="status" aria-live="polite"></p>';
    header.after(section);
    if(management){section.classList.add('management-function-search');section.querySelector('input').placeholder='Verwaltung, Raid, Spieler oder Item';}
    const back=document.createElement('button');back.type='button';back.className='start-search-back';back.textContent='← Zurück zu den Raids';if(!management)section.append(back);back.addEventListener('click',()=>{document.body.classList.remove('start-search-open');goHomeView();});
    const activate=entry=>{if(!management)document.body.classList.add('start-search-open');entry[3]();};
    const input=section.querySelector('input'),results=section.querySelector('#startSearchResults'),status=section.querySelector('[role="status"]');
    let matches=[], itemTimer, itemRequest, playerTimer, playerRequest, generation=0;
    const close=()=>{generation++;clearTimeout(itemTimer);itemRequest?.abort();clearTimeout(playerTimer);playerRequest?.abort();results.hidden=true;status.textContent='';};
    const render=()=>{
      const current=++generation;clearTimeout(itemTimer);itemRequest?.abort();clearTimeout(playerTimer);playerRequest?.abort();
      let itemTotal=null,playerTotal=null;
      const updateStatus=()=>{status.textContent=[`${matches.length} ${matches.length===1?'Funktion':'Funktionen'}`,itemTotal===null?'':`${itemTotal} ${itemTotal===1?'Item':'Items'}`,playerTotal===null?'':`${playerTotal} Charaktere`].filter(Boolean).join(' · ');};

      const tokens=normal(input.value).split(/\s+/).filter(word=>word&&!['ich','mochte','will','einen','ein','eine','meinen','wie','kann','man','und','oder','zu'].includes(word));
      const available=[...entries,...raidEntries()];
      matches=tokens.length?available.filter(entry=>tokens.every(token=>normal(entry.slice(0,3).join(' ')).includes(token))):entries.slice(0,5);
      results.replaceChildren();
      matches.forEach(entry=>{
        const button=document.createElement('button');button.type='button';
        const title=document.createElement('strong'),detail=document.createElement('span');
        title.textContent=entry[0];detail.textContent=entry[1];button.append(title,detail);
        button.addEventListener('click',()=>{close();activate(entry);});results.append(button);
      });
      if(input.value.trim().length>=2 && window.GuildLootItems){
        const group=document.createElement('div');group.className='start-search-items';
        const heading=document.createElement('strong');heading.textContent='Items · gesamte Datenbank';group.append(heading);
        const note=document.createElement('p');note.textContent='Items werden gesucht …';group.append(note);results.append(group);
        const term=input.value.trim();
        itemTimer=setTimeout(async()=>{
          itemRequest=new AbortController();
          try{
            const data=await GuildLootItems.search(term,itemRequest.signal);
            if(current!==generation)return;
            note.textContent=data.items.length?`${data.total} ${data.total===1?'Item':'Items'} gefunden${data.total>data.items.length?' · die besten 25 Treffer werden angezeigt':''}`:'Keine passenden Items gefunden.';
            data.items.forEach(item=>{
              const button=document.createElement('button');button.type='button';
              const title=document.createElement('strong'),detail=document.createElement('span');title.textContent=item.name;
              detail.textContent=[GuildLootItems.origins(item),item.itemId?`ID ${item.itemId}`:'','Tooltip öffnen'].filter(Boolean).join(' · ');
              button.append(title,detail);button.addEventListener('click',()=>{close();GuildLootItems.open(item,input);});group.append(button);
            });
            itemTotal=data.total;updateStatus();
          }catch(error){if(current!==generation||error.name==='AbortError')return;note.textContent='Itemsuche derzeit nicht erreichbar. Bitte erneut suchen.';}
        },250);
      }
      if(input.value.trim().length>=2 && window.GuildLootPlayers){
        const group=document.createElement('div');group.className='start-search-items';
        const heading=document.createElement('strong');heading.textContent='Spieler · aktive Gilde';group.append(heading);
        const note=document.createElement('p');note.setAttribute('role','status');note.textContent='Spieler werden gesucht …';group.append(note);results.append(group);
        const term=input.value.trim();
        playerTimer=setTimeout(async()=>{
          playerRequest=new AbortController();
          try{
            const data=await GuildLootPlayers.search(term,playerRequest.signal);
            if(current!==generation)return;
            playerTotal=data.total;updateStatus();
            note.textContent=data.players.length?`${data.total} Charaktere gefunden${data.total>data.players.length?' · die besten 25 Treffer werden angezeigt':''}`:'Keine passenden Spieler in dieser Gilde gefunden.';
            data.players.forEach(player=>{
              const button=document.createElement('button');button.type='button';
              const title=document.createElement('strong'),detail=document.createElement('span');title.textContent=player.name;
              detail.textContent=[player.server||'Server nicht hinterlegt',player.className,'P0+-Punkte & Ausrüstung'].filter(Boolean).join(' · ');
              button.append(title,detail);button.addEventListener('click',()=>{close();GuildLootPlayers.open(player,input);});group.append(button);
            });
          }catch(error){if(current!==generation||error.name==='AbortError')return;note.textContent='Spielersuche derzeit nicht erreichbar. Bitte erneut suchen.';}
        },250);
      }
      results.hidden=false;
      status.textContent=matches.length?`${matches.length} ${matches.length===1?'passende Funktion':'passende Funktionen'}`:(management?'Keine passende Funktion. Versuche „Wochenrhythmen“, „Spieler“ oder „Raid erstellen“.':'Keine passende Funktion. Versuche „Twink“, „Prio Naxx“ oder „Raid erstellen“.');
    };
    document.addEventListener('start-raids-updated',()=>{if(!results.hidden)render();});
    input.addEventListener('input',render);input.addEventListener('focus',render);
    section.querySelector('form').addEventListener('submit',event=>{event.preventDefault();render();});
    section.addEventListener('keydown',event=>{
      if(event.key==='Escape'){close();input.focus();close();event.preventDefault();}
      if(event.key==='ArrowDown'||event.key==='ArrowUp'){
        if(results.hidden)render();const buttons=[...results.querySelectorAll('button')];if(!buttons.length)return;
        const current=buttons.indexOf(document.activeElement),step=event.key==='ArrowDown'?1:-1;
        buttons[current===-1?(step===1?0:buttons.length-1):(current+step+buttons.length)%buttons.length].focus();event.preventDefault();
      }
    });
    document.addEventListener('click',event=>{if(!section.contains(event.target))close();});
    // Safari does not focus buttons on mouse-down. Closing on blur would remove
    // the result before its click arrives. Only Tab navigation closes on focus exit.
    section.addEventListener('keydown',event=>{if(event.key==='Tab')setTimeout(()=>{if(!section.contains(document.activeElement))close();},0);});
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
