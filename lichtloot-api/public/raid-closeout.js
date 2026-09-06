(function(){
  'use strict';
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labels={missing_flag:'P0+-Kennzeichen',missing_points:'Fehlende Punkte',duplicate_points:'Mehrfachbuchungen',stale_reminder:'Erinnerungen',received_pending:'Item-Erhalt'};
  const states=new WeakMap();
  function mount(host,options){
    if(!host)return;
    const state={host,options,plan:null,busy:false,selected:new Set(),preview:false};states.set(host,state);
    host.className='gl-closeout';
    host.innerHTML='<div class="glc-loading" role="status">◌ Raid-Abschluss wird geprüft …</div>';
    load(state);
  }
  const active=s=>s.host.isConnected&&states.get(s.host)===s;
  async function request(s,body){
    const credentials=s.options.credentials?.()||{};
    const response=await fetch(s.options.api,{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({guild:s.options.guild,raidId:s.options.raidId,...credentials,...body})});
    const data=await response.json();if(!response.ok||data.success===false)throw Error(data.error||'Abschlusscheck konnte nicht geladen werden.');return data;
  }
  async function load(s){
    if(s.busy)return;s.busy=true;
    try{const p=await request(s,{action:'getRaidCloseout'});if(!active(s))return;s.plan=p;s.selected.clear();s.preview=false;s.message='';render(s);}
    catch(e){if(active(s)){s.host.innerHTML=`<div class="glc-error" role="alert"><strong>Abschlusscheck nicht verfügbar</strong><p>${escape(e.message)}</p><button type="button" data-retry>Erneut prüfen</button></div>`;s.host.querySelector('[data-retry]').onclick=()=>load(s);}}
    finally{s.busy=false;}
  }
  function render(s){
    const p=s.plan,problems=p.findings.length,selected=p.actions.filter(a=>s.selected.has(a.id));
    const heading=p.targetError?'Punkte-Zuordnung prüfen':p.status==='upcoming'?'Für den Raid vorbereitet':p.status==='inactive'?'Raid nicht aktiv':problems?`${problems} ${problems===1?'Hinweis':'Hinweise'} zum Abschluss`:'Keine Unstimmigkeiten gefunden';
    const subtitle=p.status==='upcoming'?'Punkte-Korrekturen sind ab Raidbeginn verfügbar.':p.status==='clear'?'P0+, Punktebuchungen und Erinnerungen sind geprüft.':'Prüfe die Vorschläge und wähle gezielt aus, was korrigiert werden soll.';
    const date=String(p.raid.date||'').split('-').reverse().join('.');
    const cards=[['P0+','Kennzeichen',p.counts.missingFlags],['+','Fehlende Punkte',p.counts.missingPoints],['≋','Mehrfachbuchungen',p.counts.duplicates],['◷','Erinnerungen',p.counts.reminders]];
    s.host.innerHTML=`<div class="glc-head"><div class="glc-emblem" aria-hidden="true">${problems?'!':'✓'}</div><div class="glc-heading"><div class="glc-eyebrow">RAID-ABSCHLUSSCHECK</div><h3>${escape(heading)}</h3><p>${escape(subtitle)}</p></div><button type="button" data-reload class="glc-secondary">↻ Neu prüfen</button></div>
      <div class="glc-meta">${escape(p.raid.name)} · ${escape(date)} · ${escape(p.raid.time)} Uhr <span>Geprüft um ${escape(new Date(p.checkedAt).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}))}</span></div>
      <div class="glc-stats">${cards.map(([icon,label,n])=>`<div class="glc-stat ${n?'glc-attention':''}"><span class="glc-stat-icon" aria-hidden="true">${icon}</span><span>${label}</span><strong>${n}</strong></div>`).join('')}</div>
      ${p.targetError?`<p class="glc-notice">${escape(p.targetError)}</p>`:''}
      ${problems?`<details class="glc-details" ${p.status==='attention'?'open':''}><summary>Prüfergebnisse und Korrekturvorschläge <span>${problems}</span></summary><div class="glc-findings">${p.findings.map(f=>{
        const action=p.actions.find(a=>a.id===f.actionId),checked=action&&s.selected.has(action.id);
        return `<article class="glc-finding"><div class="glc-finding-main"><span class="glc-tag">${labels[f.kind]||escape(f.kind)}</span><h4>${escape(f.title)}</h4><p>${escape(f.detail)}</p>
        ${f.before!==undefined?`<div class="glc-change"><span>${escape(f.before)}</span><b aria-hidden="true">→</b><strong>${escape(f.after)}</strong>${f.kind==='missing_points'?'<small>Punkte</small>':''}</div>`:''}
        ${f.kind==='missing_points'?`<small class="glc-muted">${escape(f.attendance)} · Teilnahme und Item-Erhalt vor einer Nachbuchung prüfen.</small>`:''}
        ${f.entries?`<ul class="glc-ledger">${f.entries.map(e=>`<li>${escape(e.item)} <strong>${escape(e.points)} Punkte</strong></li>`).join('')}</ul><small class="glc-muted">Die einzelnen Buchungen im Punktekonto prüfen; hier wird nichts automatisch gelöscht.</small>`:''}
        ${f.kind==='received_pending'?'<small class="glc-muted">Den vorgemerkten Item-Erhalt in der P0+-Übertragung abschließen.</small>':''}</div>
        ${action?`<label class="glc-choice"><input type="checkbox" data-action="${escape(action.id)}" ${checked?'checked':''}> Korrigieren</label>`:'<span class="glc-manual">Manuell prüfen</span>'}</article>`;
      }).join('')}</div></details>`:p.targetError?'':'<div class="glc-clear">✓ Für diesen Raid sind keine offenen Prüfpunkte vorhanden.</div>'}
      ${p.actions.length?`<div class="glc-bottom"><p><strong>${selected.length}</strong> Korrekturen ausgewählt <span>· Änderungen erst nach Bestätigung</span></p><button type="button" data-preview class="glc-primary" ${selected.length?'':'disabled'}>Korrekturvorschau</button></div>`:''}
      ${s.preview?preview(s,selected):''}<div class="glc-status" role="status" aria-live="polite">${escape(s.message||'')}</div>`;
    s.host.querySelector('[data-reload]').onclick=()=>load(s);
    s.host.querySelectorAll('[data-action]').forEach(input=>input.onchange=()=>{input.checked?s.selected.add(input.dataset.action):s.selected.delete(input.dataset.action);s.preview=false;const id=input.dataset.action;render(s);[...s.host.querySelectorAll('[data-action]')].find(el=>el.dataset.action===id)?.focus();});
    const button=s.host.querySelector('[data-preview]');if(button)button.onclick=()=>{s.preview=true;render(s);s.host.querySelector('.glc-preview').scrollIntoView({behavior:'smooth',block:'nearest'});s.host.querySelector('[data-confirm]')?.focus();};
    const cancel=s.host.querySelector('[data-cancel]');if(cancel)cancel.onclick=()=>{s.preview=false;render(s);};
    const confirm=s.host.querySelector('[data-confirm]');if(confirm)confirm.onclick=()=>apply(s);
  }
  function preview(s,selected){
    const points=selected.reduce((sum,a)=>sum+Number(a.points||0),0),needsCode=!(s.options.credentials?.()||{}).masterCode;
    return `<section class="glc-preview" aria-label="Korrekturvorschau"><h4>Diese Änderungen werden gespeichert</h4><ul>${selected.map(a=>`<li>${escape(a.label)}${a.repairFlag?' <small>inkl. P0+-Kennzeichen</small>':''}</li>`).join('')}</ul>
    <div class="glc-total">Punkteänderung insgesamt <strong>+${escape(points)}</strong></div>
    ${selected.some(a=>a.type==='points')?'<label class="glc-confirm-attendance"><input type="checkbox" data-attendance> Ich habe die Teilnahme und die erhaltenen Items der ausgewählten Spieler geprüft.</label>':''}
    ${needsCode?'<label class="glc-code">Mastercode oder Plündermeister-Passwort<input type="password" data-code autocomplete="off"></label>':''}
    <p class="glc-muted">Jede Punkteänderung wird im Änderungsprotokoll festgehalten.</p><div class="glc-preview-actions"><button type="button" data-cancel class="glc-secondary">Zurück</button><button type="button" data-confirm class="glc-primary">Ausgewählte Korrekturen anwenden</button></div></section>`;
  }
  async function apply(s){
    if(s.busy)return;
    const attendanceConfirmed=s.host.querySelector('[data-attendance]')?.checked===true;
    const selected=s.plan.actions.filter(a=>s.selected.has(a.id));
    if(selected.some(a=>a.type==='points')&&!attendanceConfirmed){s.host.querySelector('.glc-status').textContent='Bitte zuerst Teilnahme und Item-Erhalt bestätigen.';return;}
    const code=s.host.querySelector('[data-code]')?.value||s.options.credentials?.().masterCode;
    if(!code){s.host.querySelector('.glc-status').textContent='Bitte den Mastercode oder das Plündermeister-Passwort eingeben.';return;}
    s.busy=true;s.host.querySelectorAll('button,input').forEach(el=>el.disabled=true);s.host.querySelector('.glc-status').textContent='Korrekturen werden gespeichert …';
    try{const r=await request(s,{action:'applyRaidCloseout',reviewToken:s.plan.reviewToken,actionIds:[...s.selected],attendanceConfirmed,masterCode:code});if(!active(s))return;
      s.busy=false;await load(s);if(!active(s)||s.host.querySelector('.glc-error'))return;s.message=`✓ ${r.applied} Korrekturen gespeichert · +${r.points} Punkte.`;render(s);s.options.onApplied?.();}
    catch(e){if(active(s)){s.busy=false;s.preview=false;s.selected.clear();s.message=e.message+' Bitte vor einem weiteren Versuch neu prüfen.';s.plan.actions=[];render(s);}}
    finally{s.busy=false;}
  }
  window.GuildLootCloseout={mount};
})();
