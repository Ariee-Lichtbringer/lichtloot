(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const guild = new URLSearchParams(location.search).get('guild') || '';
  const API = 'https://lichtloot-production.up.railway.app/api/dkp';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number = value => Number(value).toLocaleString('de-DE', {maximumFractionDigits:2});
  let credentials = null, state = null, offset = 0, busy = false, pending = null;
  const initialItem=new URLSearchParams(location.search).get('item')||'';
  let historyItem=initialItem,lootOnly=!!initialItem;
  if(initialItem){$('item').value=initialItem;$('auctionItem').value=initialItem;$('historyItem').value=initialItem;$('kind').value='loot';$('characters').multiple=false;$('item').required=true;$('reason').value='Lootvergabe';$('raid').value=new URLSearchParams(location.search).get('raid')||'';$('selectionHelp').textContent='Für die Lootvergabe einen Charakter auswählen.';}
  const guildUrl = 'start.html?guild=' + encodeURIComponent(guild);
  $('back').href = guildUrl; $('prioLink').href = guildUrl;
  $('guildName').textContent = guild || 'Bitte zuerst eine Gilde auswählen';
  function status(message, type = '') { $('status').textContent = message; $('status').className = 'status ' + type; }
  async function api(payload) {
    const response = await fetch(API, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({guild,...credentials,...payload}),cache:'no-store'});
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'Die Anfrage konnte nicht verarbeitet werden.');
    return data;
  }
  function render(data) {
    state = data;
    extras(data);
    $('login').hidden = true; $('workspace').hidden = false;
    $('modePanel').hidden = !data.manager;
    $('management').hidden = !data.manager || data.lootSystem !== 'dkp';
    $('disabledNote').hidden = data.lootSystem === 'dkp';
    $('modeBadge').textContent = data.lootSystem === 'dkp' ? 'DKP aktiv' : 'Prio aktiv';
    $('lootSystem').value = data.lootSystem;
    const selected = [...$('characters').selectedOptions].map(o=>o.value);
    $('characters').innerHTML = data.accounts.map(a=>`<option value="${esc(a.id)}" ${selected.includes(a.id)?'selected':''}>${esc(a.name)} – ${esc(a.server)} (${number(a.balance-a.reserved)} DKP frei)</option>`).join('');
    $('accounts').innerHTML = data.accounts.map(a=>`<tr><td><strong>${esc(a.name)}</strong>${data.own.includes(a.id)?' · du':''}<br><small>${esc(a.server)}</small></td><td class="number">${number(a.balance)}</td><td class="number">${number(a.reserved)}</td><td class="number positive">${number(a.balance-a.reserved)}</td></tr>`).join('') || '<tr><td colspan="4">Noch keine Charaktere registriert.</td></tr>';
    const own = data.accounts.filter(a=>data.own.includes(a.id));
    $('auctions').innerHTML = data.auctions.map(a=>{
      const open = a.status === 'open' && data.lootSystem === 'dkp';
      const result = a.status==='cancelled'?'Abgebrochen':a.status==='closed'?'Abgeschlossen':'Offen';
      const winner = a.winner_name ? `${esc(a.winner_name)} – ${esc(a.winner_server)} · ${number(a.high_bid)} DKP` : 'Noch kein Gebot';
      return `<article class="auction"><div class="toolbar"><h3>${esc(a.item)}</h3><span class="badge">${result}</span></div><p>${a.raid?esc(a.raid)+" · ":""}Mindestgebot ${number(a.min_bid)} DKP</p><strong>${winner}</strong>${open && own.length?`<form data-bid="${esc(a.id)}"><div class="row"><label>Dein Charakter<select name="characterId">${own.map(c=>`<option value="${esc(c.id)}">${esc(c.name)} – ${esc(c.server)}</option>`).join('')}</select></label><label>Gebot in DKP<input name="amount" type="number" step="0.01" min="${Math.max(Number(a.min_bid),Number(a.high_bid)+0.01).toFixed(2)}" required></label><button>Verbindlich bieten</button></div></form>`:''}${open && data.manager?`<div class="row" style="margin-top:16px"><button data-close="${esc(a.id)}">${a.winner_id?'Loot vergeben & DKP abziehen':'Ohne Gebot abschließen'}</button><button class="secondary" data-cancel="${esc(a.id)}">Auktion abbrechen</button></div>`:''}</article>`;
    }).join('') || '<p>Noch keine Auktionen. Die Leitung kann Loot direkt buchen oder eine Auktion eröffnen.</p>';
    $('ledger').innerHTML = data.ledger.map(e=>`<tr><td>${esc(new Date(e.created_at).toLocaleString('de-DE'))}</td><td>${esc(e.name || 'Entfernter Charakter')}<br><small>${esc(e.server)}</small></td><td class="number ${Number(e.amount)>0?'positive':'negative'}">${Number(e.amount)>0?'+':''}${number(e.amount)}</td><td>${esc(e.reason)}${e.item?'<br><strong>'+esc(e.item)+'</strong>':''}</td><td>${esc(e.raid)}</td></tr>`).join('') || '<tr><td colspan="5">Noch keine DKP-Buchungen.</td></tr>';
    $('previous').disabled = offset === 0; $('next').disabled = !data.hasMore; $('pageInfo').textContent = 'Seite ' + (offset/100+1);
  }
  async function refresh() { const session=credentials;const result=await api({action:'state',offset,item:historyItem,lootOnly,includeRaids:true});if(credentials===session&&session)render(result); }
  async function mutate(payload, message) {
    if (busy) return;
    busy = true;
    const key = JSON.stringify(payload);
    if (!pending || pending.key !== key) pending = {key,requestId:crypto.randomUUID()};
    document.querySelectorAll('button').forEach(b=>b.disabled=true);
    status('Wird gespeichert …');
    try {
      await api({...payload,requestId:pending.requestId});
      pending = null;
      status(message,'success');
      try { await refresh(); } catch(error) { status(message+' Die Anzeige konnte noch nicht aktualisiert werden. Bitte „Aktualisieren“ verwenden.','success'); }
    } catch(error) { status(error.message,'error'); }
    finally { busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=false);if(state){$('previous').disabled=offset===0;$('next').disabled=!state.hasMore;} }
  }
  $('role').addEventListener('change',()=>{ $('credentialLabel').firstChild.textContent=$('role').value==='manager'?'Leitungs- / Lootleitungscode':'SpielerLogin'; });
  $('loginForm').addEventListener('submit',async e=>{
    e.preventDefault(); if(!guild){status('Bitte DKP über die Seite deiner Gilde öffnen.','error');return;}
    credentials = $('role').value==='manager'?{masterCode:$('credential').value.trim()}:{playerPin:$('credential').value.trim()};
    try { await refresh();$('credential').value='';status(''); } catch(error){credentials=null;status(error.message,'error');}
  });
  $('logout').addEventListener('click',()=>{credentials=null;state=null;pending=null;$('workspace').hidden=true;$('login').hidden=false;$('credential').value='';status('Abgemeldet.');});
  $('refresh').addEventListener('click',()=>refresh().then(()=>status('Anzeige aktualisiert.','success')).catch(e=>status(e.message,'error')));
  $('modeForm').addEventListener('submit',e=>{e.preventDefault();mutate({action:'setMode',lootSystem:$('lootSystem').value},'Lootsystem gespeichert.');});
  $('kind').addEventListener('change',()=>{const credit=$('kind').value==='credit';$('characters').multiple=credit;$('item').required=$('kind').value==='loot';$('selectionHelp').textContent=credit?'Mehrere Charaktere mit Strg / ⌘ auswählen. Der Betrag gilt je Charakter.':'Für einen Abzug genau einen Charakter auswählen.';});
  $('bookForm').addEventListener('submit',e=>{e.preventDefault();mutate({action:'book',characterIds:[...$('characters').selectedOptions].map(o=>o.value),amount:$('amount').value,kind:$('kind').value,reason:$('reason').value.trim(),item:$('item').value.trim(),raid:$('raid').value.trim()},'DKP-Buchung gespeichert.');});
  $('auctionForm').addEventListener('submit',e=>{e.preventDefault();mutate({action:'openAuction',item:$('auctionItem').value.trim(),raid:$('auctionRaid').value.trim(),amount:$('minimum').value},'Auktion eröffnet.');});
  $('auctions').addEventListener('submit',e=>{const form=e.target.closest('[data-bid]');if(!form)return;e.preventDefault();mutate({action:'bid',auctionId:form.dataset.bid,characterId:form.elements.characterId.value,amount:form.elements.amount.value},'Gebot gespeichert.');});
  $('auctions').addEventListener('click',e=>{const close=e.target.closest('[data-close]'),cancel=e.target.closest('[data-cancel]');if(close)mutate({action:'closeAuction',auctionId:close.dataset.close},'Auktion abgeschlossen.');if(cancel)mutate({action:'cancelAuction',auctionId:cancel.dataset.cancel},'Auktion abgebrochen. Reservierte DKP sind wieder frei.');});
  for(const [id,step] of [['previous',-100],['next',100]])$(id).addEventListener('click',async()=>{const previous=offset;offset=Math.max(0,offset+step);try{await refresh();}catch(e){offset=previous;status(e.message,'error');}});
  let rewardContext=null;
  function extras(data){
    const enabled=data.manager&&data.lootSystem==='dkp';
    for(const id of ['rulesPanel','raidRewards','discordPanel'])$(id).hidden=!enabled;
    $('decayPanel').hidden=!enabled||!data.rules?.decayPercent;
    if(data.rules){
      $('publicRules').textContent=`Raidteilnahme: ${number(data.rules.attendance)} · Ersatzbank: ${number(data.rules.bench)} · Pünktlichkeit: +${number(data.rules.punctual)} DKP. Mindestgebot: ${number(data.rules.minimum)} DKP. ${data.rules.pricing==='fixed'?'Einheitlicher Lootpreis: '+number(data.rules.fixedPrice)+' DKP.':'Lootkosten legt die Leitung pro Vergabe fest.'} Monatlicher Verfall: ${number(data.rules.decayPercent)}% (nach Auslösung durch die Leitung).`;
      for(const [key,value] of Object.entries(data.rules))if($('rulesForm').elements[key])$('rulesForm').elements[key].value=value;
      if(!$('amount').value&&data.rules.pricing==='fixed')$('amount').value=data.rules.fixedPrice;
      $('minimum').min=data.rules.minimum;
      if(Number($('minimum').value)<data.rules.minimum)$('minimum').value=data.rules.minimum;
      const percent=data.rules.decayPercent;
      $('decayExplanation').textContent=`${percent}% Abzug pro Konto. Offene Auktionen müssen zuvor beendet werden. Einmal pro Kalendermonat; keine automatische Ausführung.`;
      $('decayPreview').innerHTML=data.accounts.filter(a=>a.balance>0).map(a=>`<p>${esc(a.name)}: ${number(a.balance)} → ${number(a.balance-Math.round(a.balance*percent)/100)} DKP</p>`).join('');
    }
    if(data.raids){const selected=$('rewardRaid').value;$('rewardRaid').innerHTML='<option value="">Raid auswählen</option>'+data.raids.map(r=>`<option value="${esc(r.id)}">${esc(r.name||r.raid_type)} · ${esc(r.raid_date)}</option>`).join('');$('rewardRaid').value=selected;}
    if(data.channels){const selected=$('discordChannel').value;$('discordChannel').innerHTML='<option value="">Kanal auswählen</option>'+data.channels.map(c=>`<option value="${esc(c.channel_id)}">#${esc(c.channel_name)}</option>`).join('');$('discordChannel').value=selected;}
    $('extraCharacter').innerHTML=data.accounts.map(a=>`<option value="${esc(a.id)}">${esc(a.name)} · ${esc(a.server)}</option>`).join('');
  }
  $('rulesForm').addEventListener('submit',e=>{e.preventDefault();const rules=Object.fromEntries(new FormData(e.target));mutate({action:'saveRules',rules,revision:state.revision},'DKP-Regeln gespeichert.');});
  const rosterValues=()=>[...$('rosterRows').querySelectorAll('[data-roster]')].map(row=>({id:row.dataset.roster,status:row.querySelector('select').value,punctual:row.querySelector('input').checked}));
  function totalRewards(){if(!rewardContext)return;const rules=rewardContext.rules;const total=rosterValues().reduce((sum,r)=>sum+(r.status==='absent'?0:(r.status==='bench'?rules.bench:rules.attendance)+(r.punctual?rules.punctual:0)),0);$('rewardTotal').textContent='Vorschau: insgesamt '+number(total)+' DKP';$('attendanceConfirmed').checked=false;}
  function addRoster(a){
    if([...$('rosterRows').children].some(row=>row.dataset.roster===a.id))return;
    const row=document.createElement('div');row.className='row';row.dataset.roster=a.id;
    row.innerHTML=`<label>${esc(a.name)} · ${esc(a.server)}<select><option value="absent">Keine Gutschrift / abwesend</option><option value="attended">Teilgenommen</option><option value="bench">Ersatzbank</option></select><small>Anmeldestatus: ${esc(a.status||'manuell ergänzt')}</small></label><label><input type="checkbox" style="width:auto"> Pünktlich</label>`;
    $('rosterRows').append(row);totalRewards();
  }
  $('rosterRows').addEventListener('change',totalRewards);
  $('addCharacter').addEventListener('click',()=>{const a=state.accounts.find(a=>a.id===$('extraCharacter').value);if(a)addRoster(a);});
  $('rewardRaid').addEventListener('change',()=>{rewardContext=null;$('attendanceForm').hidden=true;$('alreadyAwarded').textContent='';});
  $('loadRoster').addEventListener('click',async()=>{
    const raidId=$('rewardRaid').value;if(!raidId)return status('Bitte einen Raid auswählen.','error');
    const session=credentials;
    try{const data=await api({action:'state',includeRaids:true,raidId});if(session!==credentials)return;
      rewardContext={raidId,rules:data.rules,revision:data.revision};$('rosterRows').innerHTML='';(data.roster||[]).forEach(addRoster);
      $('attendanceForm').hidden=!!data.awarded;$('alreadyAwarded').textContent=data.awarded?'Für diesen Raid wurden bereits DKP gebucht. Korrekturen sind über Punkte & Loot buchen möglich.':'';totalRewards();
    }catch(error){status(error.message,'error');}
  });
  $('attendanceForm').addEventListener('submit',e=>{e.preventDefault();if(!rewardContext)return;mutate({action:'awardRaid',raidId:rewardContext.raidId,roster:rosterValues(),revision:rewardContext.revision,confirmed:$('attendanceConfirmed').checked},'Raidpunkte gebucht. Dieser Raid ist gegen doppelte Vergabe geschützt.');});
  $('decayForm').addEventListener('submit',e=>{e.preventDefault();mutate({action:'decay',period:new Date().toISOString().slice(0,7),revision:state.revision,confirmed:true,balances:state.accounts.map(a=>({id:a.id,balance:a.balance}))},'Monatlicher DKP-Verfall gebucht.');});
  $('historyForm').addEventListener('submit',e=>{e.preventDefault();historyItem=$('historyItem').value.trim();lootOnly=true;offset=0;refresh().catch(e=>status(e.message,'error'));$('historyHint').textContent=historyItem?'Lootvergabe für '+historyItem:'Alle Lootvergaben';});
  $('allBookings').addEventListener('click',()=>{historyItem='';lootOnly=false;offset=0;$('historyItem').value='';$('historyHint').textContent='Alle DKP-Buchungen';refresh().catch(e=>status(e.message,'error'));});
  $('discordPanel').addEventListener('click',e=>{const type=e.target.closest('[data-draft]')?.dataset.draft;if(!type)return;
    let lines=type==='accounts'?state.accounts.map(a=>`${a.name} (${a.server}): ${number(a.balance)} DKP · ${number(a.balance-a.reserved)} frei`):type==='auctions'?state.auctions.filter(a=>a.status==='open').map(a=>`${a.item}: ${a.winner_name||'kein Gebot'} · ${number(a.high_bid)} DKP · Minimum ${number(a.min_bid)}`):state.ledger.map(a=>`${a.name}: ${number(a.amount)} DKP · ${a.item||a.reason} · ${a.raid||''}`);
    let draft=`${guild} · ${type==='accounts'?'DKP-Konten':type==='auctions'?'Offene Auktionen':'DKP-Historie'}\n`;
    let included=0;for(const line of lines){if((draft+line+'\n').length>3650)break;draft+=line+'\n';included++;}
    if(included<lines.length)draft+='Weitere Einträge auf GuildLoot.\n';
    $('discordDraft').value=draft+'https://lichtloot.de/dkp.html?guild='+encodeURIComponent(guild);
  });
  $('discordForm').addEventListener('submit',e=>{e.preventDefault();mutate({action:'postDiscord',channelId:$('discordChannel').value,description:$('discordDraft').value.trim()},'Discord-Versandauftrag gespeichert. Der Bot übernimmt die Zustellung.');});

  setInterval(()=>{if(credentials&&!busy&&!document.hidden&&!document.activeElement?.closest('form'))refresh().catch(e=>status('Aktualisierung fehlgeschlagen: '+e.message,'error'));},15000);
})();
