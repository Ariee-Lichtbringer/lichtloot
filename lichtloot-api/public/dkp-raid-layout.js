(function(){
'use strict';
const script=document.currentScript;
const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('dkp-raid-layout.css?v=20260911-1',script.src);document.head.append(css);
const el=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>Number(v||0).toLocaleString('de-DE',{maximumFractionDigits:2});
const colors={krieger:'#c69b6d',warrior:'#c69b6d',magier:'#69ccf0',mage:'#69ccf0',priester:'#eeeeee',priest:'#eeeeee',schurke:'#fff468',rogue:'#fff468',jäger:'#aad372',hunter:'#aad372',hexenmeister:'#a58ad9',warlock:'#a58ad9',druide:'#ff963a',druid:'#ff963a',paladin:'#f48cba',schamane:'#4999ff',shaman:'#4999ff'};
let snapshot=null,query='';
const active=()=>document.documentElement.classList.contains('guild-dkp')&&el('mainGrid');
function href(){return '../dkp.html?guild='+encodeURIComponent(snapshot?.guild||new URLSearchParams(location.search).get('guild')||'');}
function renderRows(){
 if(!el('dkpAccountRows'))return;
 const data=snapshot?.data;const accounts=(data?.accounts||[]).slice().sort((a,b)=>b.balance-a.balance||a.name.localeCompare(b.name,'de'));
 const matches=accounts.map((a,i)=>({a,rank:i+1})).filter(({a})=>[a.name,a.server,a.class_name].join(' ').toLocaleLowerCase('de').includes(query));
 el('dkpAccountRows').innerHTML=matches.map(({a,rank})=>{const own=(data.own||[]).includes(a.id),color=colors[String(a.class_name||'').toLowerCase()]||'#c6d1e1';return `<tr class="${own?'dkp-mine':''}"><td>${String(rank).padStart(2,'0')}</td><td style="color:${color}"><strong>${esc(a.name)}</strong>${own?'<span class="dkp-you">ICH</span>':''}<small>${esc(a.server)}</small></td><td style="color:${color}">${esc(a.class_name||'—')}</td><td class="dkp-number">${fmt(a.balance)}<small>DKP</small></td><td class="dkp-free">${fmt(a.balance-a.reserved)}<small>DKP frei</small></td></tr>`;}).join('');
 el('dkpStandingsEmpty').hidden=matches.length>0;el('dkpStandingsEmpty').textContent=!data?'Mit deinem SpielerLogin anmelden, um die DKP-Konten der Gilde zu sehen.':accounts.length?'Keine passenden Charaktere gefunden.':'Für diese Gilde sind noch keine DKP-Konten vorhanden.';
 el('dkpAccountCount').textContent=data?accounts.length+' Charaktere':'Gildenkonten';
 el('dkpTotal').textContent=data?'Gesamtpunkte: '+fmt(accounts.reduce((n,a)=>n+Number(a.balance),0))+' DKP':'Punktestand nach Anmeldung';
 const own=accounts.find(a=>a.id===snapshot?.character);el('dkpOwnPoints').textContent=own?fmt(own.balance)+' DKP':'Anmelden';
 el('dkpOwnName').textContent=own?own.name:'Mein Punktestand';
 const entries=data?.ledger?.slice(0,3)||[];
 el('dkpRecentEntries').innerHTML=entries.map(e=>`<article class="dkp-ledger-entry"><strong>${esc(e.reason||e.item||e.kind||'DKP-Buchung')}</strong><span>${esc(e.name||'Charakter')} ${e.raid?'· '+esc(e.raid):''}</span><b class="${Number(e.amount)<0?'negative':''}">${Number(e.amount)>0?'+':''}${fmt(e.amount)} DKP</b></article>`).join('')||'<p class="dkp-empty">Noch keine Buchungen verfügbar.</p>';
 el('dkpHistoryNote').textContent=data?.hasMore?'Letzte 100 Buchungen · kompletter Verlauf unter Historie':'Aktueller Gildenpunktestand';
 document.querySelectorAll('[data-dkp-hub]').forEach(a=>a.href=href());
}
function exportData(){
 if(!snapshot?.data)return;
 const rows=[['Spieler','Server','Klasse','Gesamt DKP','Gebunden','Frei'],...snapshot.data.accounts.map(a=>[a.name,a.server,a.class_name||'',a.balance,a.reserved,a.balance-a.reserved])];
 const quote=v=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"';
 const blob=new Blob(['\ufeff'+rows.map(row=>row.map(quote).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='dkp-punktestand.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function placePanels(){
 const bids=el('dkpLootBids'),live=el('dkpLiveSection');
 if(bids&&bids.parentElement!==el('dkpRightRail'))el('dkpRightRail').append(bids);
 if(live&&live.parentElement!==el('dkpLiveCard'))el('dkpLiveCard').append(live);
 if(live)live.hidden=false;if(el('dkpStartSection'))el('dkpStartSection').hidden=false;
 const auctions=snapshot?.data?.auctions?.filter(a=>a.status==='open')||[];
 el('dkpLiveState').textContent=auctions.length?auctions.length+' offen':'Keine Auktion';
 if(!live)el('dkpLiveEmpty').textContent='Melde dich rechts mit deinem SpielerLogin an, um laufende Auktionen zu sehen.';
 el('dkpLiveEmpty').hidden=!!live;
 document.querySelectorAll('#dkpLiveCard form[data-auction]').forEach(form=>{
  if(form.querySelector('.dkp-quick-bids'))return;
  const quick=document.createElement('div');quick.className='dkp-quick-bids';
  for(const n of [5,10,25]){const b=document.createElement('button');b.type='button';b.textContent='+'+n+' DKP';b.onclick=()=>{const input=form.elements.amount;input.value=(Math.max(Number(input.min)||0,Number(input.value)||0)+n).toFixed(2);input.dispatchEvent(new Event('input',{bubbles:true}));};quick.append(b);}
  form.prepend(quick);
  const auction=snapshot?.data?.auctions?.find(a=>String(a.id)===form.dataset.auction);
  if(auction){const row=[...document.querySelectorAll('#lootList .loot-item-row')].find(row=>row.querySelector('[data-item]')?.dataset.item===auction.item);const source=row?.querySelector('img');if(source){const img=source.cloneNode();img.className='dkp-auction-item-icon';img.alt='';form.closest('article').prepend(img);}}
 });
}
function apply(){
 const enabled=!!active();document.body.classList.toggle('dkp-raid-manager',enabled);if(!enabled)return;
 if(!el('dkpStandings')){
  const standings=document.createElement('section');standings.id='dkpStandings';standings.className='dkp-surface dkp-managed';standings.setAttribute('aria-label','DKP-Punktestand der Gilde');
  standings.innerHTML=`<div class="dkp-standings-head"><div class="dkp-standings-title"><h2>DKP-Standings & Raider</h2><span class="dkp-count" id="dkpAccountCount">Gildenkonten</span></div><div class="dkp-manager-actions"><a class="dkp-primary" data-dkp-hub>Punkte vergeben</a><a data-dkp-hub>Historie / Log</a><button type="button" id="dkpExportAccounts">Export CSV</button></div></div><input class="dkp-standings-search" id="dkpAccountSearch" type="search" placeholder="Spieler, Klasse oder Server suchen …" aria-label="DKP-Konten filtern"><div class="dkp-table-scroll"><table class="dkp-account-table"><thead><tr><th>#</th><th>Spieler</th><th>Klasse</th><th>Gesamt</th><th>Verfügbar</th></tr></thead><tbody id="dkpAccountRows"></tbody></table></div><p class="dkp-empty" id="dkpStandingsEmpty"></p><section class="dkp-ledger"><h3>Letzte DKP-Buchungen</h3><div class="dkp-ledger-grid" id="dkpRecentEntries"></div></section><footer class="dkp-standings-footer"><span id="dkpHistoryNote"></span><strong id="dkpTotal"></strong></footer>`;
  const rail=document.createElement('aside');rail.id='dkpRightRail';rail.className='dkp-managed';rail.innerHTML='<section class="dkp-surface dkp-bids" id="dkpLiveCard"><div class="dkp-live-title">LIVE-AUKTIONEN <span class="dkp-live-label" id="dkpLiveState">Keine Auktion</span></div><p id="dkpLiveEmpty" class="dkp-empty"></p></section>';
  el('mainGrid').append(standings,rail);
  const actions=document.querySelector('.header-actions')||document.querySelector('.header');if(actions){const own=document.createElement('div');own.className='dkp-own-balance';own.innerHTML='<span id="dkpOwnName">Mein Punktestand</span><strong id="dkpOwnPoints">Anmelden</strong>';actions.append(own);}
  el('dkpAccountSearch').oninput=e=>{query=e.target.value.toLocaleLowerCase('de');renderRows();};el('dkpExportAccounts').onclick=exportData;
 }
 const title=document.querySelector('.raid-page-title');if(title)for(const n of title.childNodes){if(n.nodeType===3&&/DKP-Gebote|Prio-Auswahl/.test(n.textContent)){if(!n._prioText)n._prioText=n.textContent;n.textContent=n.textContent.replace(/DKP-Gebote|Prio-Auswahl/,'DKP Raid & Loot Manager');}}
 snapshot=window.GuildLootBids?.snapshot?.()||snapshot;
 placePanels();renderRows();
}
window.GuildLootRaidLayout={apply};window.addEventListener('guildloot:dkp-state',apply);apply();
})();
