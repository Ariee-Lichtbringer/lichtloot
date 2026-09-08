(() => {
  'use strict';
  const page=document.createElement('section');page.dataset.adminPage='beta';page.className='panel admin-page hidden';
  page.innerHTML=`<h1>Addon-Betatest</h1><p>Wähle Discord-Nutzer aus und schicke ihnen die Einladung zum Testen.</p><button type="button" data-refresh>Liste und Zustellstatus laden</button><p data-status role="status" aria-live="polite"></p><div class="beta-admin-grid"><section><h2>Discord-Empfänger</h2><label>Discord-Namen suchen<input type="search" data-search placeholder="Discord-Name, Nutzername oder Gilde"></label><div data-members class="beta-members"></div><p data-selected></p><button type="button" class="primary" data-send disabled>DM an ausgewählte Nutzer senden</button></section><section><h2>Vorschau der Discord-DM</h2><p>Die Einladung enthält die Beta-PIN sowie Links zum Download und zum Rückmeldeformular.</p><pre data-preview class="beta-preview"></pre></section></div><section><h2>Rückmeldungen zum Addon</h2><p>Fehlermeldungen und Verbesserungsvorschläge aus dem Formular.</p><div data-feedback></div></section>`;
  document.querySelector('main').append(page);
  const style=document.createElement('style');style.textContent='.beta-admin-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:22px 0}.beta-members{max-height:440px;overflow:auto;margin-top:12px}.beta-member{display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--line)}.beta-member input{width:auto;margin-top:5px}.beta-member small{display:block;color:var(--muted)}.beta-preview{white-space:pre-wrap;overflow-wrap:anywhere;font:14px/1.6 system-ui;background:#0b121d;padding:18px;border-radius:10px}.beta-feedback{border-top:1px solid var(--line);padding:16px 0}.beta-feedback p{white-space:pre-wrap}.beta-admin-grid input[type=search]{width:100%}@media(max-width:800px){.beta-admin-grid{grid-template-columns:1fr}}';document.head.append(style);
  const el=name=>page.querySelector('[data-'+name+']');
  let data=null,selected=new Set(),sending=false,loading=false,requestId=null;
  const statusLabels={queued:'Zum Versand vorgemerkt',delivered:'Zugestellt',failed:'Versand fehlgeschlagen'};
  async function call(action,body={}){
    const response=await fetch(new URL('/api/admin/addon-beta/'+action,API_URL),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({masterCode:code(),...body}),cache:'no-store'});
    const value=await response.json().catch(()=>({}));if(!response.ok||!value.success)throw Error(value.error||'Anfrage fehlgeschlagen. Bitte erneut laden.');return value;
  }
  function render(){
    if(!data)return;
    const latest=new Map();for(const h of data.history)if(!latest.has(h.recipientId))latest.set(h.recipientId,h);
    const search=el('search').value.trim().toLocaleLowerCase('de');el('members').replaceChildren();
    for(const member of data.members.filter(m=>[m.name,m.username,m.guild_name,m.id].join(' ').toLocaleLowerCase('de').includes(search)).sort((a,b)=>a.name.localeCompare(b.name,'de'))){
      const previous=latest.get(member.id),blocked=previous&&['queued','delivered'].includes(previous.status);
      if(blocked)selected.delete(member.id);
      const label=document.createElement('label');label.className='beta-member';
      const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=selected.has(member.id);checkbox.disabled=sending||blocked;
      checkbox.onchange=()=>{if(checkbox.checked)selected.add(member.id);else selected.delete(member.id);requestId=null;render();};
      const text=document.createElement('span');text.textContent=member.name+' (@'+member.username+')';
      const meta=document.createElement('small');meta.textContent=member.guild_name+' · Discord-ID '+member.id+(previous?' · '+(statusLabels[previous.status]||previous.status)+(previous.error?' – '+previous.error:''):'');text.append(meta);label.append(checkbox,text);el('members').append(label);
    }
    if(!el('members').childElementCount)el('members').textContent='Keine passenden Discord-Nutzer gefunden.';
    el('selected').textContent=selected.size+' ausgewählt (maximal 20)';el('send').disabled=sending||!selected.size||selected.size>20;
    el('preview').textContent=data.title+'\n\n'+data.message;
    el('feedback').replaceChildren();
    for(const ticket of data.feedback?.tickets||[]){
      const card=document.createElement('article');card.className='beta-feedback';
      const title=document.createElement('h3');title.textContent=ticket.subject;
      const meta=document.createElement('p');meta.textContent=ticket.contactName+' · '+(ticket.contactDiscord||ticket.contactEmail)+' · '+new Date(ticket.createdAt).toLocaleString('de-DE')+' · '+({new:'Neu',in_progress:'In Bearbeitung',resolved:'Erledigt'}[ticket.status]||ticket.status);
      const body=document.createElement('p');body.textContent=ticket.message;
      const open=document.createElement('button');open.type='button';open.textContent='Im Support bearbeiten';open.onclick=async()=>{
        showAdminPage('support');document.getElementById('supportStatusFilter').value='';document.getElementById('supportGuildFilter').value='';document.getElementById('supportCategoryFilter').value='addon_beta';document.getElementById('supportSearch').value='';await refreshSupport();selectSupportTicket(ticket.id);
      };card.append(title,meta,body,open);el('feedback').append(card);
    }
    if(!el('feedback').childElementCount)el('feedback').textContent='Noch keine Rückmeldungen eingegangen.';
    if(data.feedback?.hasMore){const note=document.createElement('p');note.textContent='Weitere Rückmeldungen findest du unter Support → Kategorie Addon-Betatest.';el('feedback').append(note);}
  }
  async function load(){if(loading||sending)return;loading=true;el('refresh').disabled=true;el('status').textContent='Discord-Nutzer und Rückmeldungen werden geladen …';try{data=await call('state');render();el('status').textContent=data.members.length+' Discord-Nutzer verfügbar. '+(data.feedback?.total||0)+' Rückmeldungen.';}catch(error){el('status').textContent=error.message;}finally{loading=false;el('refresh').disabled=false;}}
  el('refresh').onclick=load;el('search').oninput=render;
  el('send').onclick=async()=>{
    if(sending||!selected.size||selected.size>20)return;sending=true;requestId ||= crypto.randomUUID();render();el('refresh').disabled=true;el('status').textContent='Einladungen werden zum Versand vorgemerkt …';
    try{const result=await call('send',{recipientIds:[...selected],requestId});selected.clear();requestId=null;data=await call('state');render();el('status').textContent=result.results.filter(r=>!r.skipped).length+' Einladungen vorgemerkt. Mit „Liste und Zustellstatus laden“ prüfst du die Zustellung.';}
    catch(error){el('status').textContent=error.message+' Du kannst die Liste neu laden, um den Versandstatus zu prüfen.';}
    finally{sending=false;el('refresh').disabled=false;render();}
  };
  const nav=document.querySelector('[data-admin-nav=beta]');nav.addEventListener('click',()=>{if(adminReady)load();});
})();
