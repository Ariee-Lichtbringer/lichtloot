(() => {
'use strict';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const endpoint='https://lichtloot-production.up.railway.app/api/leadership/raid-archive';
let guild='',code='',enabled=false;
async function request(body){
 const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({guild,masterCode:code,...body})});
 const data=await response.json();
 if(!response.ok||!data.success){const error=Error(data.error||'Die Änderung konnte nicht gespeichert werden.');error.status=response.status;throw error;}
 return data;
}
async function init(slug){
 guild=slug;
 if(new URLSearchParams(location.search).get('manage')!=='1')return;
 try{code=sessionStorage.getItem('lichtlootGuildMasterCode_'+guild)||'';}catch{}
 if(!code){notice('Zum Zuweisen von Loot bitte das Raidarchiv über die Gildenleitung öffnen.');return;}
 try{await request({action:'access'});enabled=true;}catch{notice('Die Leitungsrechte konnten nicht bestätigt werden. Bitte in der Gildenleitung erneut anmelden.');}
}
function notice(message){const box=document.createElement('p');box.className='assignment-notice';box.setAttribute('role','status');box.textContent=message;document.querySelector('main').prepend(box);}
function cell(row){const a=row.assignment;return `<td class="assignment-cell">${a?.name?`<span class="player-name">${esc(a.name)}</span><span class="realm">${esc(a.server)}</span>`:'<span class="subtle">–</span>'}${enabled&&row.receiptKey?`<button class="assignment-edit" data-assign="${esc(row.receiptKey)}" aria-label="${esc((a?.name?'Zuweisung ändern: ':'Loot zuweisen: ')+(row.item||row.itemId))}">${a?.name?'Ändern':'Zuweisen'}</button>`:''}</td>`;}
function open(row,raidId,onSaved){
 const origin=document.activeElement,modal=document.createElement('dialog');modal.className='assignment-dialog';
 modal.setAttribute('aria-labelledby','assignmentTitle');
 modal.innerHTML=`<form method="dialog"><header><div><div class="eyebrow">LOOT ZUWEISEN</div><h2 id="assignmentTitle">${esc(row.item||row.itemId)}</h2><p>× ${esc(row.quantity)} · Aufgezeichnet für ${esc(row.player)}</p></div><button type="button" data-close aria-label="Schließen">×</button></header><div class="assignment-grid"><section><label for="assignmentSearch">Spieler aus der Datenbank</label><input id="assignmentSearch" type="search" placeholder="Name oder Realm suchen …" autocomplete="off"><p class="subtle">Spieler anklicken oder auf das Empfängerfeld ziehen.</p><div id="assignmentPlayers" class="assignment-players" aria-live="polite"></div></section><section><div id="assignmentDrop" class="assignment-drop"><label for="assignmentName">Zugewiesen an</label><input id="assignmentName" maxlength="80" required autocomplete="off" placeholder="Spieler ablegen oder Namen eingeben"><label for="assignmentServer">Realm <span class="subtle">(optional)</span></label><input id="assignmentServer" maxlength="80" autocomplete="off" placeholder="z. B. Everlook"><p id="assignmentSource" class="subtle"></p></div><p class="subtle">Die Zuweisung gilt für diese Lootzeile mit der gesamten Menge. Der aufgezeichnete Empfänger bleibt erhalten.</p></section></div><p id="assignmentStatus" role="status" aria-live="polite"></p><footer><button type="button" data-clear ${row.assignment?.name?'':'hidden'}>Zuweisung zurücknehmen</button><button type="button" data-reload hidden>Neu laden</button><button type="button" data-close>Abbrechen</button><button type="submit" class="assignment-save">Zuweisung speichern</button></footer></form>`;
 document.body.append(modal);
 const $=id=>modal.querySelector('#'+id),form=modal.querySelector('form');
 let selected=null,players=[],searchVersion=0,timer,busy=false;
 $('assignmentName').value=row.assignment?.name||'';$('assignmentServer').value=row.assignment?.server||'';
 function source(){ $('assignmentSource').textContent=selected?'Aus der Spielerdatenbank ausgewählt.':'Freie Namenseingabe möglich.'; }
 function choose(p){selected=p;$('assignmentName').value=p.name;$('assignmentServer').value=p.server;source();}
 ['assignmentName','assignmentServer'].forEach(id=>$(id).oninput=()=>{selected=null;source();});source();
 async function search(){const version=++searchVersion;$('assignmentPlayers').textContent='Spieler werden geladen …';try{
  const data=await request({action:'players',search:$('assignmentSearch').value});if(version!==searchVersion||!modal.isConnected)return;
  players=data.players;$('assignmentPlayers').innerHTML=players.length?players.map((p,i)=>`<button type="button" draggable="true" data-player="${i}"><strong>${esc(p.name)}</strong><span>${esc(p.server)}${p.className?' · '+esc(p.className):''}</span></button>`).join(''):'<p class="subtle">Keine Spieler gefunden. Du kannst rechts einen Namen frei eingeben.</p>';
  if(players.length===30)$('assignmentPlayers').insertAdjacentHTML('beforeend','<p class="subtle">Erste 30 Treffer – Suche eingrenzen.</p>');
  modal.querySelectorAll('[data-player]').forEach(button=>{button.disabled=busy;button.onclick=()=>choose(players[Number(button.dataset.player)]);button.ondragstart=e=>{if(busy){e.preventDefault();return;}e.dataTransfer.setData('application/x-guildloot-player',players[Number(button.dataset.player)].id);e.dataTransfer.effectAllowed='copy';};});
 }catch(error){if(version===searchVersion&&modal.isConnected)$('assignmentPlayers').textContent='Spielersuche fehlgeschlagen. Freie Namenseingabe ist weiterhin möglich.';}}
 $('assignmentSearch').oninput=()=>{++searchVersion;clearTimeout(timer);timer=setTimeout(search,200);};
 const drop=$('assignmentDrop');drop.ondragover=e=>{if(!busy&&Array.from(e.dataTransfer.types).includes('application/x-guildloot-player')){e.preventDefault();drop.classList.add('drag-over');e.dataTransfer.dropEffect='copy';}};
 drop.ondragleave=()=>drop.classList.remove('drag-over');drop.ondrop=e=>{e.preventDefault();drop.classList.remove('drag-over');if(busy)return;const p=players.find(p=>p.id===e.dataTransfer.getData('application/x-guildloot-player'));if(p)choose(p);};
 modal.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>{if(!busy)modal.close();});modal.oncancel=e=>{if(busy)e.preventDefault();};
 modal.onclose=()=>{clearTimeout(timer);++searchVersion;modal.remove();origin?.focus();};
 modal.querySelector('[data-reload]').onclick=()=>location.reload();
 async function save(clear=false){
  if(busy||(!clear&&!form.reportValidity()))return;
  const payload={action:'assign',raidId,receiptKey:row.receiptKey,revision:row.assignment?.revision||0,clear,characterId:selected?.id||'',name:$('assignmentName').value,server:$('assignmentServer').value};
  busy=true;modal.querySelectorAll('input,button').forEach(e=>e.disabled=true);$('assignmentStatus').textContent='Zuweisung wird gespeichert …';
  try{const data=await request(payload);row.assignment=data.assignment;onSaved();modal.close();}catch(error){$('assignmentStatus').textContent=error.message;if(error.status===409)modal.querySelector('[data-reload]').hidden=false;}finally{busy=false;modal.querySelectorAll('input,button').forEach(e=>e.disabled=false);}
 }
 form.onsubmit=e=>{e.preventDefault();save();};modal.querySelector('[data-clear]').onclick=()=>save(true);
 modal.showModal();$('assignmentSearch').focus();search();
}
window.RaidLootEditor={init,cell,get enabled(){return enabled;},bind(container,rows,raidId,onSaved){container.querySelectorAll('[data-assign]').forEach(b=>b.onclick=()=>{const row=rows.find(r=>r.receiptKey===b.dataset.assign);if(row)open(row,raidId,onSaved);});}};
})();
