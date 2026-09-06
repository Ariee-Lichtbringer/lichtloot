(function(){
  'use strict';
  const API='https://lichtloot-production.up.railway.app/api/dkp';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=n=>Number(n).toLocaleString('de-DE',{maximumFractionDigits:2});
  const instances=new WeakMap();
  const isDkp=()=>document.documentElement.classList.contains('guild-dkp');
  function styles(){
    if(document.getElementById('dkpWidgetStyle'))return;
    const style=document.createElement('style');style.id='dkpWidgetStyle';style.textContent=`.dkp-widget{color:#edf3fb;font:14px/1.5 system-ui;text-align:left}.dkp-widget h3{color:#facc15;margin:0 0 10px}.dkp-widget input,.dkp-widget select{padding:9px 10px;background:#081322;color:#edf3fb;border:1px solid #415571;border-radius:8px;max-width:100%;font:inherit}.dkp-widget button{padding:9px 14px;border-radius:8px;background:#facc15;color:#10151e;border:0;font-weight:750;cursor:pointer}.dkp-widget button:disabled{opacity:.5}.dkp-widget a{color:#facc15}.dkp-widget .dkp-bar{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-bottom:12px}.dkp-widget .dkp-table-wrap{overflow:auto}.dkp-widget table{width:100%;border-collapse:collapse;white-space:nowrap}.dkp-widget td,.dkp-widget th{padding:10px;text-align:left;border-bottom:1px solid #304057}.dkp-widget th{color:#a8b9cd;font-size:12px}.dkp-widget .dkp-num{text-align:right;font-variant-numeric:tabular-nums}.dkp-widget small{color:#9eb2ca}.dkp-widget .dkp-edit{display:grid;grid-template-columns:100px minmax(120px,1fr) auto;gap:6px}.dkp-widget .dkp-status{margin:10px 0;white-space:normal}.dkp-widget .dkp-credit{margin:16px 0;padding:14px;border:1px solid #415571;border-radius:10px}.dkp-widget .dkp-credit label{display:block;margin:8px 0}.dkp-widget .dkp-credit input,.dkp-widget .dkp-credit select{width:100%}.dkp-widget .dkp-credit select[multiple]{min-height:120px}.dkp-widget details{margin-top:12px}.dkp-widget summary:after{display:none!important}.dkp-widget .dkp-editable,.dkp-widget .dkp-editable thead,.dkp-widget .dkp-editable tbody{display:block!important;width:100%!important;min-width:0!important;max-width:100%!important}.dkp-widget .dkp-editable tr{display:grid!important;width:100%!important;min-width:0!important;grid-template-columns:minmax(0,1fr) repeat(3,60px)!important}.dkp-widget .dkp-editable th,.dkp-widget .dkp-editable td{min-width:0!important;width:auto!important}.dkp-widget .dkp-editable th:last-child{display:none}.dkp-widget .dkp-editable td:last-child{grid-column:1/-1}.dkp-widget .dkp-editable .dkp-edit{grid-template-columns:100px minmax(0,1fr) auto}.dkp-widget .dkp-editable input{min-width:0;width:100%}@media(max-width:700px){.dkp-widget .dkp-edit{grid-template-columns:90px minmax(140px,1fr)}.dkp-widget .dkp-edit button{grid-column:1/-1}}`;
    document.head.appendChild(style);
  }
  async function mount(container,options={}){
    if(typeof container==='string')container=document.getElementById(container);
    if(!container)return;
    styles();
    const token={};instances.set(container,token);
    const guild=options.guild || new URLSearchParams(location.search).get('guild') || 'lichtloot';
    const credentials=options.credentials?.() || {};
    const hub=(location.pathname.includes('/loot/')?'../':'')+'dkp.html?guild='+encodeURIComponent(guild);
    container.innerHTML='<div class="dkp-widget">DKP werden geladen …</div>';
    async function api(payload){
      const activeCredentials=options.credentials?.() || {};
      if(!activeCredentials.playerPin&&!activeCredentials.masterCode)throw new Error('Bitte erneut anmelden.');
      const response=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({guild,...activeCredentials,...payload}),cache:'no-store'});
      const result=await response.json();
      if(!response.ok || !result.success)throw new Error(result.error || 'DKP konnten nicht geladen werden.');
      return result;
    }
    try{
      if(!credentials.playerPin&&!credentials.masterCode)throw new Error(options.manager?'Bitte oben den Leitungscode eingeben und die DKP-Liste neu laden.':'Bitte zuerst mit deinem SpielerLogin anmelden.');
      const data=await api({action:'state'});
      if(instances.get(container)!==token)return;
      const accounts=options.ownOnly?data.accounts.filter(a=>data.own.includes(a.id)):data.accounts;
      const canEdit=options.manager&&data.manager&&data.lootSystem==='dkp';
      container.innerHTML=`<div class="dkp-widget"><div class="dkp-bar"><h3>${options.ownOnly?'Meine DKP':'DKP-Punkteliste'}</h3><button type="button" data-reload>Neu laden</button></div><p><small>DKP pro Charakter · Führende Gebote reservieren Punkte bis zur Lootvergabe.</small></p><div class="dkp-bar"><input type="search" data-search placeholder="Charakter oder Server suchen" aria-label="DKP-Liste durchsuchen"><a href="${esc(hub)}">Lootvergabe, Gebote & gesamter Verlauf →</a></div><div class="dkp-status" role="status" aria-live="polite"></div>${canEdit?`<details class="dkp-credit"><summary>DKP gutschreiben · auch für mehrere Charaktere</summary><form data-credit><label>Charaktere<select name="characters" multiple required>${data.accounts.map(a=>`<option value="${esc(a.id)}">${esc(a.name)} – ${esc(a.server)}</option>`).join('')}</select></label><small>Mehrfachauswahl mit Strg / ⌘. Betrag je Charakter.</small><label>DKP<input name="amount" type="number" min="0.01" max="9999999.99" step="0.01" required></label><label>Grund<input name="reason" maxlength="500" required placeholder="z. B. Raidteilnahme"></label><button>Gutschreiben</button></form></details>`:''}<div class="dkp-table-wrap"><table class="${canEdit?'dkp-editable':''}"><thead><tr><th>Charakter / Server</th><th class="dkp-num">DKP</th><th class="dkp-num">Gebunden</th><th class="dkp-num">Frei</th>${canEdit?'<th>DKP-Stand bearbeiten</th>':''}</tr></thead><tbody>${accounts.map(a=>`<tr data-account="${esc(a.id)}" data-search-text="${esc((a.name+' '+a.server).toLowerCase())}"><td><strong>${esc(a.name)}</strong><br><small>${esc(a.server)}</small></td><td class="dkp-num">${fmt(a.balance)}</td><td class="dkp-num">${fmt(a.reserved)}</td><td class="dkp-num">${fmt(a.balance-a.reserved)}</td>${canEdit?`<td><form class="dkp-edit" data-edit="${esc(a.id)}"><input name="amount" type="number" step="0.01" min="0" max="9999999.99" value="${Number(a.balance)}" aria-label="Neuer DKP-Stand für ${esc(a.name)}" required><input name="reason" placeholder="Korrekturgrund" aria-label="Korrekturgrund für ${esc(a.name)}" maxlength="500" required><button>Speichern</button></form></td>`:''}</tr>`).join('')||`<tr><td colspan="5">Keine Charaktere gefunden.</td></tr>`}</tbody></table></div><details><summary>Letzte DKP-Buchungen</summary><div style="max-height:260px;overflow:auto">${data.ledger.filter(e=>!options.ownOnly||data.own.includes(e.character_id)).map(e=>`<p><strong>${esc(e.name)} · ${Number(e.amount)>0?'+':''}${fmt(e.amount)} DKP</strong><br>${esc(e.reason)}${e.item?' · '+esc(e.item):''}<br><small>${esc(new Date(e.created_at).toLocaleString('de-DE'))}</small></p>`).join('')||'<p>Noch keine Buchungen.</p>'}</div></details></div>`;
      const status=container.querySelector('.dkp-status');
      container.querySelector('[data-reload]').onclick=()=>mount(container,options);
      container.querySelector('[data-search]').oninput=event=>{const value=event.target.value.trim().toLowerCase();container.querySelectorAll('[data-account]').forEach(row=>row.hidden=!row.dataset.searchText.includes(value));};
      let busy=false;
      const pending=new Map();
      container.querySelectorAll('form').forEach(form=>form.addEventListener('submit',async event=>{
        event.preventDefault();if(busy)return;
        const payload=form.hasAttribute('data-credit')?{action:'book',kind:'credit',characterIds:[...form.elements.characters.selectedOptions].map(o=>o.value),amount:form.elements.amount.value,reason:form.elements.reason.value.trim()}:{action:'setBalance',characterId:form.dataset.edit,amount:form.elements.amount.value,expectedBalance:data.accounts.find(a=>a.id===form.dataset.edit).balance,reason:form.elements.reason.value.trim()};
        const key=JSON.stringify(payload);if(!pending.has(key))pending.set(key,crypto.randomUUID());
        busy=true;container.querySelectorAll('button').forEach(b=>b.disabled=true);status.textContent='DKP werden gespeichert …';
        try{await api({...payload,requestId:pending.get(key)});pending.delete(key);await mount(container,options);const nextStatus=container.querySelector('.dkp-status');if(nextStatus)nextStatus.textContent='DKP gespeichert. Die Korrektur steht im Buchungsverlauf.';}
        catch(error){status.textContent=error.message;}
        finally{busy=false;container.querySelectorAll('button').forEach(b=>b.disabled=false);}
      }));
    }catch(error){
      if(instances.get(container)!==token)return;
      container.innerHTML=`<div class="dkp-widget"><p role="status">${esc(error.message)}</p><button type="button">Neu laden</button> <a href="${esc(hub)}">DKP öffnen</a></div>`;
      container.querySelector('button').onclick=()=>mount(container,options);
    }
  }
  window.GuildLootDKP={mount,isDkp,clear(container){if(typeof container==='string')container=document.getElementById(container);if(container){instances.set(container,{});container.textContent='Bitte anmelden, um deine DKP zu sehen.';}}};
})();
