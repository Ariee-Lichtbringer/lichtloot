(() => {
  'use strict';
  const host = document.getElementById('p0Planner');
  if (!host) return;
  const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const berlin = new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  function berlinISO(value) {
    const target = value.length === 16 ? value + ':00' : value;
    const matches = [1,2].map(offset => new Date(Date.parse(target+'Z') - offset*3600000))
      .filter(date => Number.isFinite(date.getTime()) && berlin.format(date).replace(' ','T') === target);
    if (matches.length !== 1) throw new Error('Die Uhrzeit ist durch die Zeitumstellung ungültig oder mehrdeutig. Bitte eine andere Uhrzeit wählen.');
    return matches[0].toISOString();
  }
  const display = v => new Date(v).toLocaleString('de-DE',{timeZone:'Europe/Berlin',dateStyle:'short',timeStyle:'medium'});
  host.innerHTML = `<details class="raid"><summary class="section"><strong>P0 zeitgesteuert setzen</strong></summary>
    <div class="section"><p>Raid-Sicherung zuerst laden, dann die P0 planen. Alle Uhrzeiten gelten für Berlin. Der Server führt gespeicherte Aufträge auch bei geschlossenem Browser aus.</p>
    <form id="p0ScheduleForm" class="p0-plan-grid">
      <label>Raid<select id="p0PlanRaid" required><option value="">Zuerst Sicherung laden</option></select></label>
      <label>SpielerLogin<input id="p0PlanLogin" type="password" autocomplete="off" required></label>
      <label>Charakter<input id="p0PlanPlayer" autocomplete="off" required maxlength="100"></label>
      <label>Server<input id="p0PlanServer" value="Everlook" required maxlength="100"></label>
      <label>P0-Item<input id="p0PlanItem" required maxlength="200" placeholder="Vollständiger Itemname"></label>
      <label>Ausführen am · Berlin<input id="p0PlanAt" type="datetime-local" step="1" required></label>
      <label>P0-Schluss · Berlin<input id="p0PlanDeadline" type="datetime-local" step="1" required></label>
      <button type="submit" id="p0PlanSave">P0 verbindlich planen</button>
    </form>
    <p class="muted">Die P0 ersetzt bei Ausführung die bisherige Prio dieses Charakters. P0-Schluss bitte gemäß Raidregel eintragen; nach dieser Grenze wird der Auftrag verworfen. Die genaue Sekunde ist nicht garantiert, die Discord-Anzeige folgt über den Bot.</p>
    <p id="p0PlanStatus" role="status" aria-live="polite"></p>
    <button type="button" class="secondary" id="p0PlanRefresh">Planungen aktualisieren</button>
    <div id="p0PlanJobs" style="margin-top:12px">Noch keine Planungen geladen.</div></div></details>`;
  const get = id => document.getElementById(id);
  const raidSelect = get('p0PlanRaid');
  let raids = [], requestNumber = 0, loading = false;
  const message = (text,error=false) => { get('p0PlanStatus').textContent=text; get('p0PlanStatus').style.color=error?'var(--red)':'var(--green)'; };
  const selected = () => raids.find(r => `${r.guild}:${r.id}` === raidSelect.value);
  async function api(action,params={},guild=selected()?.guild) {
    if (!guild) throw new Error('Bitte zuerst die Sicherung laden und einen Raid auswählen.');
    const masterCode = get('masterCode').value.trim();
    if (!masterCode) throw new Error('Bitte den Master-Code eingeben.');
    const response=await fetch(API_BASE,{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({guild,masterCode,action,...params})});
    const data=await response.json();
    if (!response.ok || data.success === false) throw new Error(data.error || 'Planung konnte nicht verarbeitet werden.');
    return data;
  }
  async function refresh() {
    const token=++requestNumber, guild=selected()?.guild;
    if (!guild) { get('p0PlanJobs').textContent='Bitte einen Raid auswählen.'; return; }
    loading=true;
    try {
      const data=await api('guildListScheduledP0',{},guild);
      if (token!==requestNumber) return;
      const states={pending:'Geplant',applied:'P0 gespeichert',failed:'Nicht ausgeführt',cancelled:'Storniert'};
      get('p0PlanJobs').innerHTML=data.jobs.length?`<div class="table-wrap"><table><thead><tr><th>Raid / Charakter</th><th>P0-Item</th><th>Ausführung / Schluss · Berlin</th><th>Status</th><th>Aktion</th></tr></thead><tbody>${data.jobs.map(job=>`<tr><td>${esc(job.raid_name)}<br>${esc(job.player_name)} · ${esc(job.server)}</td><td>${esc(job.item_name)}</td><td>${esc(display(job.execute_at))}<br>${esc(display(job.deadline_at))}</td><td>${esc(states[job.status]||job.status)}<br><span class="muted">${esc(job.detail)}</span></td><td>${job.status==='pending'?`<button type="button" class="secondary" data-cancel="${esc(job.id)}" data-guild="${esc(guild)}">Stornieren</button>`:''}</td></tr>`).join('')}</tbody></table></div>`:'Keine Planungen für diese Gilde vorhanden.';
    } catch(error) { if(token===requestNumber) {get('p0PlanJobs').textContent='Planungen konnten nicht geladen werden.';message(error.message,true);} }
    finally { if(token===requestNumber) loading=false; }
  }
  function defaults() {
    const raid=selected();
    const day=String(raid?.raidDate || '').slice(0,10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      get('p0PlanAt').value=day+'T19:14:58';get('p0PlanDeadline').value=day+'T19:15:00';
    }
  }
  window.addEventListener('backup:loaded',event=>{
    const old=raidSelect.value;
    raids=event.detail.raids || [];
    raidSelect.innerHTML='<option value="">Raid auswählen</option>'+raids.map(raid=>`<option value="${esc(`${raid.guild}:${raid.id}`)}">${esc(raid.guildName)} · ${esc(raid.raidName||raid.raid)} · ${esc(raid.raidDate)} ${esc(raid.raidTime)} · ${esc(raid.status)}</option>`).join('');
    if(raids.some(r=>`${r.guild}:${r.id}`===old)) raidSelect.value=old;
    else { ++requestNumber;get('p0PlanJobs').textContent='Bitte einen Raid auswählen.'; }
  });
  raidSelect.addEventListener('change',()=>{defaults();refresh();});
  get('p0PlanRefresh').addEventListener('click',refresh);
  get('p0ScheduleForm').addEventListener('submit',async event=>{
    event.preventDefault();const button=get('p0PlanSave');button.disabled=true;
    try {
      const raid=selected();if(!raid)throw new Error('Bitte einen Raid auswählen.');
      await api('guildScheduleP0',{raidId:raid.id,playerPin:get('p0PlanLogin').value.trim(),player:get('p0PlanPlayer').value.trim(),server:get('p0PlanServer').value.trim(),item:get('p0PlanItem').value.trim(),executeAt:berlinISO(get('p0PlanAt').value),deadlineAt:berlinISO(get('p0PlanDeadline').value)});
      get('p0PlanLogin').value='';message('P0 ist verbindlich geplant. Der Browser kann geschlossen werden.');await refresh();
    } catch(error) {message(error.message,true);} finally {button.disabled=false;}
  });
  get('p0PlanJobs').addEventListener('click',async event=>{
    const button=event.target.closest('[data-cancel]');if(!button)return;button.disabled=true;
    try {await api('guildCancelScheduledP0',{id:button.dataset.cancel},button.dataset.guild);message('Planung storniert.');await refresh();}
    catch(error){message(error.message,true);button.disabled=false;}
  });
  setInterval(()=>{if(!document.hidden && !loading && selected() && get('masterCode').value.trim())refresh();},10000);
})();
