(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const guild = new URLSearchParams(location.search).get('guild') || '';
  const API = 'https://lichtloot-production.up.railway.app/api/dkp';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number = value => Number(value).toLocaleString('de-DE', {maximumFractionDigits:2});
  let credentials = null, state = null, offset = 0, busy = false, pending = null;
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
  async function refresh() { const session=credentials;const result=await api({action:'state',offset});if(credentials===session&&session)render(result); }
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
  setInterval(()=>{if(credentials&&!busy&&!document.hidden&&!document.activeElement?.closest('form'))refresh().catch(e=>status('Aktualisierung fehlgeschlagen: '+e.message,'error'));},15000);
})();
