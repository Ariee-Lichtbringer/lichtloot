(function(){
  'use strict';
  const API='https://lichtloot-production.up.railway.app/api/dkp';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=v=>Number(v||0).toLocaleString('de-DE',{maximumFractionDigits:2});
  const enabled=()=>document.documentElement.classList.contains('guild-dkp');
  const raid=typeof RAID_NAME!=='undefined'?String(RAID_NAME).toLowerCase():'';
  let guild='',panel=null,data=null,character='',draft=[],revision=0,dirty=false,busy=false,loading=false,tab='start',manualPin='',sessionPin='',epoch=0;
  const pending=new Map();
  const pin=()=>manualPin||(typeof getStoredLichtLootPlayerPin==='function'?getStoredLichtLootPlayerPin():'');
  const el=id=>document.getElementById(id);
  function message(t){const node=el('dkpBidsStatus');if(node)node.textContent=t;const reload=el('dkpBidsRefresh');if(reload)reload.textContent=dirty?'Entwurf verwerfen & aktualisieren':'Aktualisieren';}
  function styles(){
    if(el('dkpBidsStyle'))return;
    const s=document.createElement('style');s.id='dkpBidsStyle';s.textContent=`
    html.guild-dkp body.loot-redesign #mainGrid:has(#prioCard:not(.prios-closed))>#lootCard{display:flex!important}
    html.guild-dkp body.loot-redesign #mainGrid.grid:has(#prioCard){grid-template-columns:minmax(0,1fr)!important}
    @media(min-width:1361px){html.guild-dkp body.loot-redesign #mainGrid.grid:has(#prioCard){grid-template-columns:minmax(0,1fr) minmax(0,1.15fr)!important}html.guild-dkp #dkpLootBids{grid-column:2!important}}
    #dkpLootBids{display:none}html.guild-dkp #dkpLootBids{display:block;min-width:0}
    html.guild-dkp #prioCard,html.guild-dkp #lootOwnSelection,html.guild-dkp .loot-save-area,html.guild-dkp #lootSaveReceipt{display:none!important}
    html.guild-dkp #p0plusOverlay .p0plus-box>:not(.p0plus-head):not(#dkpOverviewContent){display:none!important}
    html.guild-dkp #p0plusOverlay{width:min(960px,94vw)!important;max-width:94vw!important;max-height:85vh!important;overflow:auto!important;box-sizing:border-box}
    html.guild-dkp #p0plusOverlay .p0plus-box{width:100%!important;max-width:none!important;box-sizing:border-box}
    #dkpOverviewContent{display:none}html.guild-dkp #dkpOverviewContent{display:block}
    .dkp-bids{color:#e9eef7;font:15px/1.5 system-ui;text-align:left}.dkp-bids h2,.dkp-bids h3{color:#facc15;margin:0 0 14px}.dkp-bids button,.dkp-bids input,.dkp-bids select{font:inherit;padding:10px;border:1px solid #45536a;border-radius:8px;box-sizing:border-box;max-width:100%}.dkp-bids input,.dkp-bids select{background:#081322;color:#fff;min-width:0}.dkp-bids button{cursor:pointer;background:#203647;color:#f6d368}.dkp-bids button:disabled{opacity:.5;cursor:default}.dkp-bids .dkp-tabs{display:flex;gap:8px;margin:18px 0;flex-wrap:wrap}.dkp-bids [aria-selected=true],.dkp-bids button[type=submit]{background:#ddbc5e;color:#101722}.dkp-bids label{display:block}.dkp-bids select{width:100%}.dkp-bids p{line-height:1.55}.dkp-bids small{color:#a9bbce}.dkp-bids [hidden]{display:none!important}.dkp-bids .dkp-bid-row{padding:14px 0;border-top:1px solid #33445b}.dkp-bids .dkp-bid-row input[name=item]{width:100%;margin:5px 0 10px}.dkp-bids .dkp-amount-line{display:flex;gap:10px;align-items:end}.dkp-bids .dkp-amount-line label{flex:1}.dkp-bids .dkp-amount-line input{width:100%}.dkp-bids .dkp-auction{border:1px solid #34475f;border-radius:10px;padding:16px;margin:12px 0}.dkp-bids .dkp-auction form{display:flex;gap:10px;align-items:end;flex-wrap:wrap}.dkp-bids #dkpBidsStatus{min-height:1.5em;margin-top:12px}.dkp-bids details{margin-top:20px}.dkp-bids summary{cursor:pointer}.dkp-bids .dkp-guild-wish{border-bottom:1px solid #34475f;padding:10px 0}
    `;document.head.append(s);
  }
  async function api(payload){
    const credentials=pin();if(!credentials)throw Error('Bitte mit deinem SpielerLogin anmelden.');
    const response=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({guild,playerPin:credentials,...payload})});
    const result=await response.json();if(!response.ok||!result.success)throw Error(result.error||'DKP konnten nicht geladen werden.');return result;
  }
  function loadDraft(){
    const saved=data?.startBids?.find(b=>b.character_id===character);
    revision=saved?.revision||0;draft=Array.from({length:3},(_,i)=>({...saved?.bids?.[i],item:saved?.bids?.[i]?.item||'',amount:saved?.bids?.[i]?.amount||''}));dirty=false;
  }
  function itemNames(){
    const names=new Set([...document.querySelectorAll('#p1 option')].map(o=>o.value).filter(Boolean));
    document.querySelectorAll('#lootList [data-item]').forEach(n=>names.add(n.dataset.item));
    draft.forEach(b=>{if(b.item)names.add(b.item);});return [...names].sort((a,b)=>a.localeCompare(b,'de'));
  }
  function renderDraft(){
    el('dkpStartRows').innerHTML=draft.map((b,i)=>`<div class="dkp-bid-row" data-slot="${i}"><label>Item ${i+1}<input name="item" list="dkpItemNames" maxlength="200" value="${esc(b.item)}" placeholder="Links auswählen oder Item suchen" aria-label="Startgebot Item ${i+1}"></label><div class="dkp-amount-line"><label>Startgebot (DKP)<input name="amount" type="number" min="0.01" max="9999999.99" step="0.01" value="${esc(b.amount)}" aria-label="DKP für Item ${i+1}"></label><button type="button" data-remove="${i}" aria-label="Startgebot ${i+1} entfernen">Entfernen</button></div></div>`).join('');
    el('dkpItemNames').innerHTML=itemNames().map(n=>`<option value="${esc(n)}"></option>`).join('');
    el('dkpStartForm').querySelectorAll('input').forEach(input=>input.oninput=()=>{const b=draft[Number(input.closest('[data-slot]').dataset.slot)];b[input.name]=input.value;dirty=true;message('Noch nicht gespeichert.');});
    el('dkpStartForm').querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{draft[Number(b.dataset.remove)]={item:'',amount:''};dirty=true;renderDraft();message('Entfernt. Mit „Startgebote speichern“ übernehmen.');});
  }
  function chooseTab(next){tab=next;el('dkpStartSection').hidden=tab!=='start';el('dkpLiveSection').hidden=tab!=='live';panel.querySelectorAll('[role=tab]').forEach(b=>{const active=b.dataset.tab===tab;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;});}
  function renderAuctions(){
    const own=data.accounts.find(a=>a.id===character);
    el('dkpFreePoints').textContent=own?`${fmt(own.balance)} DKP · ${fmt(own.reserved)} gebunden · ${fmt(own.balance-own.reserved)} frei`:'';
    const auctions=data.auctions.filter(a=>a.status==='open');
    el('dkpAuctionList').innerHTML=auctions.map(a=>{
      const minimum=Math.max(Number(a.min_bid),Math.round((Number(a.high_bid)+0.01)*100)/100);
      const wish=(data.startBids?.find(b=>b.character_id===character)?.bids||[]).find(b=>b.item.trim().toLocaleLowerCase('de')===a.item.toLocaleLowerCase('de'));
      const amount=Math.max(minimum,Number(wish?.amount)||0).toFixed(2);
      return `<article class="dkp-auction"><h3>${esc(a.item)}</h3><small>${esc(a.raid||'Gildenauktion')}</small><p>Höchstgebot: ${fmt(a.high_bid)} DKP${a.winner_name?' · '+esc(a.winner_name):' · noch kein Gebot'}<br>Mindestgebot jetzt: ${fmt(minimum)} DKP</p><form data-auction="${esc(a.id)}"><label>Dein Gebot (DKP)<input name="amount" type="number" min="${minimum}" max="9999999.99" step="0.01" value="${amount}" required></label><button type="submit">Verbindlich bieten</button></form></article>`;
    }).join('')||'<p>Aktuell gibt es keine laufenden Auktionen. Sobald die Gildenleitung eine Auktion startet, erscheint sie hier.</p>';
    el('dkpAuctionList').querySelectorAll('form').forEach(form=>form.onsubmit=event=>{event.preventDefault();mutate({action:'bid',auctionId:form.dataset.auction,characterId:character,amount:form.elements.amount.value},'Gebot abgegeben.');});
  }
  function renderGuildWishes(){
    el('dkpGuildWishes').innerHTML=(data.startBids||[]).filter(b=>b.bids.length).map(b=>`<div class="dkp-guild-wish"><strong>${esc(b.name)} · ${esc(b.server)}</strong>${b.bids.map(w=>`<div>${esc(w.item)} · ${fmt(w.amount)} DKP</div>`).join('')}</div>`).join('')||'<p>Noch keine Startgebote für diesen Raid gespeichert.</p>';
  }
  function render(){
    if(!data){panel.innerHTML='<h2>DKP-Gebote</h2><p>Speichere bis zu drei Startgebote oder biete in laufenden Auktionen mit.</p><form id="dkpBidsLogin"><label>SpielerLogin<input name="pin" type="password" autocomplete="current-password" required></label><button type="submit">Anmelden</button></form><p id="dkpBidsStatus" role="status"></p>';el('dkpBidsLogin').onsubmit=e=>{e.preventDefault();manualPin=e.target.elements.pin.value.trim();refresh();};return;}
    const own=data.accounts.filter(a=>data.own.includes(a.id));
    panel.innerHTML=`<h2>DKP-Gebote</h2><label>Charakter<select id="dkpBidCharacter">${own.map(a=>`<option value="${esc(a.id)}" ${a.id===character?'selected':''}>${esc(a.name)} · ${esc(a.server)}</option>`).join('')}</select></label><p id="dkpFreePoints"></p><div class="dkp-tabs" role="tablist" aria-label="DKP-Gebote"><button type="button" id="dkpStartTab" role="tab" data-tab="start" aria-controls="dkpStartSection">Startgebote</button><button type="button" id="dkpLiveTab" role="tab" data-tab="live" aria-controls="dkpLiveSection">Laufende Auktionen</button></div><section id="dkpStartSection" role="tabpanel" aria-labelledby="dkpStartTab"><p>Bis zu drei Items pro Charakter und Raid vormerken. Startgebote reservieren keine Punkte und bieten nicht automatisch mit.</p><form id="dkpStartForm"><div id="dkpStartRows"></div><datalist id="dkpItemNames"></datalist><button type="submit">Startgebote speichern</button></form><details><summary>Startgebote der Gilde · ${esc(raid.toUpperCase())}</summary><div id="dkpGuildWishes"></div></details></section><section id="dkpLiveSection" role="tabpanel" aria-labelledby="dkpLiveTab"><p>Offene Auktionen deiner Gilde. Ein passendes Startgebot wird als Betrag vorgeschlagen. Erst „Verbindlich bieten“ gibt das Gebot ab.</p><div id="dkpAuctionList"></div></section><p id="dkpBidsStatus" role="status" aria-live="polite"></p><button type="button" id="dkpBidsRefresh">Aktualisieren</button>`;
    panel.querySelectorAll('[role=tab]').forEach(b=>{b.onclick=()=>chooseTab(b.dataset.tab);b.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();chooseTab(e.key==='Home'?'start':e.key==='End'?'live':tab==='start'?'live':'start');el(tab==='start'?'dkpStartTab':'dkpLiveTab').focus();}};});
    el('dkpBidCharacter').onchange=e=>{if(dirty){e.target.value=character;message('Bitte Änderungen erst speichern oder mit „Aktualisieren“ verwerfen.');return;}character=e.target.value;loadDraft();renderDraft();renderAuctions();};
    el('dkpBidsRefresh').onclick=()=>{if(dirty){dirty=false;loadDraft();renderDraft();}refresh(true);};
    el('dkpStartForm').onsubmit=e=>{e.preventDefault();const bids=draft.filter(b=>b.item.trim()).map(b=>({item:b.item.trim(),amount:b.amount}));if(draft.some(b=>!b.item.trim()&&b.amount)){message('Bitte zu jedem Betrag ein Item auswählen.');return;}if(bids.some(b=>!b.amount||Number(b.amount)<=0)){message('Bitte für jedes Item ein positives DKP-Gebot eintragen.');return;}mutate({action:'saveStartBids',characterId:character,raid,bids,revision},'Startgebote gespeichert.');};
    renderDraft();renderAuctions();renderGuildWishes();chooseTab(tab);
  }
  async function refresh(force=false){
    if(loading||busy||!enabled())return;
    loading=true;const token=epoch,credentials=pin();
    try{
      const next=await api({action:'state',includeStartBids:true,raid});
      if(token!==epoch||credentials!==pin()||!enabled())return;
      if(next.lootSystem!=='dkp')throw Error('Diese Gilde verwendet kein DKP. Bitte die Seite neu laden.');
      const first=!data||sessionPin!==credentials;data=next;sessionPin=credentials;
      if(first){const own=data.accounts.filter(a=>data.own.includes(a.id));character=own.find(a=>a.name===el('playerName')?.value)?.id||own[0]?.id||'';loadDraft();render();}
      else{if(force&&!dirty){loadDraft();renderDraft();}if(!el('dkpAuctionList').contains(document.activeElement))renderAuctions();renderGuildWishes();}
      if(force)message('Aktualisiert.');
    }catch(error){if(token===epoch){message(error.message);}}
    finally{loading=false;}
  }
  async function mutate(payload,success){
    if(busy||loading)return;busy=true;const token=epoch,key=JSON.stringify(payload);if(!pending.has(key))pending.set(key,crypto.randomUUID());
    panel.querySelectorAll('button,input,select').forEach(b=>b.disabled=true);message('Wird gespeichert …');
    try{const result=await api({...payload,requestId:pending.get(key)});if(token!==epoch)return;pending.delete(key);if(payload.action==='saveStartBids'){revision=result.revision;dirty=false;}message(success);}
    catch(error){if(token===epoch)message(error.message);}
    finally{busy=false;if(token===epoch){panel.querySelectorAll('button,input,select').forEach(b=>b.disabled=false);await refresh();}}
  }
  function addItem(item){
    if(!data){message('Bitte zuerst mit deinem SpielerLogin anmelden.');panel.scrollIntoView({block:'center',behavior:'smooth'});return;}
    if(busy||loading)return;
    const existing=draft.findIndex(b=>b.item===item),slot=existing>=0?existing:draft.findIndex(b=>!b.item);
    if(slot<0){message('Bereits drei Items ausgewählt. Entferne zuerst ein Startgebot.');return;}
    if(existing<0){draft[slot]={item,amount:''};dirty=true;renderDraft();}
    chooseTab('start');panel.scrollIntoView({block:'center',behavior:'smooth'});panel.querySelector(`[data-slot="${slot}"] input[name=amount]`).focus();message('DKP-Betrag eintragen und Startgebote speichern.');
  }
  function catalog(){
    if(!enabled())return;
    document.querySelectorAll('.loot-item-row').forEach(row=>{
      if(row.querySelector('.dkp-start-item'))return;
      const item=row.querySelector('[data-item]')?.dataset.item||row.querySelector('.item-with-icon span')?.textContent;
      if(!item)return;const b=document.createElement('button');b.type='button';b.className='mini-btn dkp-item-action dkp-start-item';b.textContent='Startgebot vormerken';b.onclick=()=>addItem(item);row.append(b);
    });
    document.querySelectorAll('button[onclick="toggleP0PlusOverview()"]').forEach(n=>{if(!n.closest('#p0plusOverlay')&&n.textContent.includes('P0+')){n.dataset.prioText=n.textContent;n.textContent='DKP Übersicht';}});
    const heading=document.querySelector('.raid-page-title');if(heading)for(const node of heading.childNodes){if(node.nodeType===3&&node.textContent.includes('Prio-Auswahl')){node._prioText=node.textContent;node.textContent=node.textContent.replace('Prio-Auswahl','DKP-Gebote');}}
    const subtitle=document.querySelector('.header>.subtitle');if(subtitle&&subtitle.textContent.includes('P0+')){subtitle.dataset.prioText=subtitle.textContent;subtitle.textContent='Startgebote planen und in laufenden DKP-Auktionen mitbieten.';}
    document.querySelectorAll('[data-start-nav="p0plus"] span').forEach(n=>{if(n.textContent!=='DKP Übersicht')n.textContent='DKP Übersicht';});
  }
  function overview(){
    const box=document.querySelector('#p0plusOverlay .p0plus-box');if(!box)return;
    let content=el('dkpOverviewContent');if(!content){content=document.createElement('div');content.id='dkpOverviewContent';box.append(content);}
    const overlay=el('p0plusOverlay');let wasOpen=false;
    const update=()=>{const open=enabled()&&!overlay.classList.contains('hidden');if(open&&!wasOpen){const title=box.querySelector('h2');if(title)title.textContent='DKP Übersicht';if(window.GuildLootDKP)window.GuildLootDKP.mount(content,{guild,credentials:()=>({playerPin:pin()})});else content.innerHTML='<p>DKP-Konten und Auktionen öffnen:</p><a href="'+(raid?'../':'')+'dkp.html?guild='+encodeURIComponent(guild)+'">DKP Übersicht</a>';}wasOpen=open;};
    new MutationObserver(update).observe(overlay,{attributes:true,attributeFilter:['class']});update();
  }
  let initialized=false;
  window.GuildLootBids={apply(slug){
    if(guild!==slug){guild=slug;epoch++;data=null;dirty=false;manualPin='';pending.clear();if(panel){render();refresh();}}
    styles();
    if(!enabled()){document.querySelectorAll('.raid-page-title').forEach(h=>h.childNodes.forEach(n=>{if(n._prioText)n.textContent=n._prioText;}));document.querySelectorAll('[data-prio-text]').forEach(n=>{n.textContent=n.dataset.prioText;});return;}
    if(!initialized){initialized=true;if(raid&&el('mainGrid')){panel=document.createElement('div');panel.id='dkpLootBids';panel.className='card info-card dkp-bids';el('mainGrid').append(panel);render();refresh();setInterval(()=>{if(!document.hidden)refresh();},15000);}overview();new MutationObserver(catalog).observe(document.body,{childList:true,subtree:true});}
    catalog();
  }};
})();
