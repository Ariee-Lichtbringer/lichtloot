(()=>{
'use strict';
if(window.__guildLootSupportLoaded)return;
window.__guildLootSupportLoaded=true;
const API='https://lichtloot-production.up.railway.app/api/apps-script',MAX=5*1024*1024;
let dialog,form,previewUrl='',sending=false,trigger;
function guild(){return (typeof window.currentActiveGuildSlug==='function'&&window.currentActiveGuildSlug())||(typeof window.getCurrentGuildSlug==='function'&&window.getCurrentGuildSlug())||(typeof window.currentGuildSlug==='function'&&window.currentGuildSlug())||new URLSearchParams(location.search).get('guild')||'lichtloot';}
function status(message,bad=false){const el=dialog.querySelector('[data-status]');el.textContent=message;el.classList.toggle('is-error',bad);}
function clearImage(){if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl='';const preview=dialog.querySelector('[data-preview]');preview.hidden=true;preview.removeAttribute('src');form.elements.screenshot.value='';dialog.querySelector('[data-remove]').hidden=true;}
function close(){if(sending)return;dialog.close();trigger?.focus();}
function build(){
 dialog=document.createElement('dialog');dialog.id='guildSupportDialog';dialog.className='gl-support';dialog.setAttribute('aria-labelledby','guildSupportTitle');
 dialog.innerHTML=`<header><div><h2 id="guildSupportTitle">Fehler melden &amp; Support</h2><p>Beschreibe, was nicht funktioniert. Die Meldung landet bei der GuildLoot-Administration.</p></div><button type="button" data-close aria-label="Support schließen">×</button></header><form><div class="gl-support-grid"><label>Name / Charakter<input name="contactName" required maxlength="120" autocomplete="name"></label><label>Kategorie<select name="category"><option value="technical">Fehlermeldung</option><option value="account">Login / Account</option><option value="raid">Raid / Prios / Punkte</option><option value="question">Allgemeine Frage</option><option value="feedback">Idee / Feedback</option></select></label><label>E-Mail<input name="contactEmail" type="email" maxlength="240" autocomplete="email"></label><label>Discord-Name<input name="contactDiscord" maxlength="120" autocomplete="off"></label><label class="full">Betreff<input name="subject" required maxlength="180" placeholder="Was funktioniert nicht?"></label><label class="full">Fehlerbeschreibung<textarea name="message" required minlength="10" maxlength="6000" rows="5" placeholder="Was wolltest du tun? Was ist passiert? Falls sichtbar: die genaue Fehlermeldung."></textarea></label><label class="full">Screenshot (optional)<input name="screenshot" type="file" accept="image/png,image/jpeg,image/webp"><small>PNG, JPG oder WebP · maximal 5 MB. Bitte keine Zugangscodes im Screenshot zeigen.</small></label></div><img data-preview hidden alt="Vorschau des angehängten Screenshots"><button data-remove hidden type="button">Screenshot entfernen</button><p data-status role="status" aria-live="polite">Bitte E-Mail oder Discord-Namen für eine Rückmeldung angeben.</p><footer><button type="button" data-close>Abbrechen</button><button type="submit" data-send>Meldung senden</button></footer></form>`;
 document.body.append(dialog);form=dialog.querySelector('form');dialog.querySelectorAll('[data-close]').forEach(b=>b.onclick=close);dialog.addEventListener('cancel',e=>{if(sending)e.preventDefault()});dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});
 dialog.querySelector('[data-remove]').onclick=()=>{clearImage();status('Screenshot entfernt.');};
 form.elements.screenshot.onchange=async()=>{
  const file=form.elements.screenshot.files[0];if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl='';dialog.querySelector('[data-preview]').hidden=true;dialog.querySelector('[data-remove]').hidden=true;
  if(!file)return;
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>MAX||!file.size){clearImage();status('Bitte PNG, JPG oder WebP mit maximal 5 MB auswählen.',true);return;}
  previewUrl=URL.createObjectURL(file);const url=previewUrl,img=dialog.querySelector('[data-preview]');img.src=url;
  try{await img.decode();if(url!==previewUrl)return;img.hidden=false;dialog.querySelector('[data-remove]').hidden=false;status('Screenshot angehängt. Er wird erst mit der Meldung hochgeladen.');}
  catch{if(url===previewUrl){clearImage();status('Die Datei konnte nicht als Bild gelesen werden.',true);}}
 };
 form.onsubmit=async event=>{
  event.preventDefault();if(sending||!form.reportValidity())return;
  const values=Object.fromEntries(new FormData(form));const file=form.elements.screenshot.files[0];delete values.screenshot;
  if(!values.contactEmail.trim()&&!values.contactDiscord.trim()){status('Bitte E-Mail oder Discord-Namen angeben.',true);form.elements.contactEmail.focus();return;}
  if(file&&(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>MAX)){status('Der Screenshot muss PNG, JPG oder WebP sein und darf maximal 5 MB groß sein.',true);return;}
  sending=true;const controls=[...form.elements,...dialog.querySelectorAll('[data-close]')];controls.forEach(e=>e.disabled=true);status('Meldung wird gesendet …');
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),30000);
  try{
   const screenshotData=file?await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('Screenshot konnte nicht gelesen werden.'));r.readAsDataURL(file);}):'';
   const response=await fetch(API,{signal:controller.signal,method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...values,action:'submitSupportTicket',guild:guild(),pageUrl:location.origin+location.pathname,screenshotData,screenshotName:file?.name||''})});
   const result=await response.json();if(!response.ok||!result.success)throw Error(result.error||'Meldung konnte nicht gesendet werden.');
   form.reset();clearImage();status('✓ Meldung gesendet. Sie ist in der GuildLoot-Administration angekommen.');dialog.querySelector('[data-send]').dataset.sent='true';dialog.querySelector('[data-send]').textContent='Gesendet';
  }catch(error){status((error.message||'Senden fehlgeschlagen.')+' Deine Eingaben bleiben erhalten. Bitte erneut versuchen.',true);}
  finally{clearTimeout(timeout);sending=false;controls.forEach(e=>e.disabled=false);dialog.querySelector('[data-send]').disabled=dialog.querySelector('[data-send]').dataset.sent==='true';}
 };
}
function open(button){if(!dialog)build();trigger=button;if(!dialog.open){if(dialog.querySelector('[data-send]').dataset.sent){delete dialog.querySelector('[data-send]').dataset.sent;dialog.querySelector('[data-send]').disabled=false;dialog.querySelector('[data-send]').textContent='Meldung senden';status('Bitte E-Mail oder Discord-Namen für eine Rückmeldung angeben.');}dialog.showModal();form.elements.contactName.focus();}}

function installSupportAccess(){
 document.querySelectorAll('a').forEach(link=>{
  if(link.textContent.trim()!=='Support'&&!link.hasAttribute('data-guild-support'))return;
  link.setAttribute('data-guild-support','');link.setAttribute('href','#support');link.removeAttribute('onclick');link.removeAttribute('target');
 });
 const footerLink=[...document.querySelectorAll('footer [data-guild-support]')].some(link=>!link.closest('dialog,[role="dialog"]')&&link.getClientRects().length>0);
 const existing=document.querySelector('.gl-support-access');
 if(existing){existing.hidden=footerLink;return;}
 if(footerLink)return;
 const access=document.createElement('div');access.className='gl-support-access';
 const link=document.createElement('a');link.href='#support';link.setAttribute('data-guild-support','');link.textContent='Support · Fehler melden';access.append(link);
 const copyright=document.querySelector('[data-ariee-copyright]');
 if(copyright)copyright.before(access);else document.body.append(access);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installSupportAccess,{once:true});else installSupportAccess();
window.addEventListener('resize',installSupportAccess);
window.addEventListener('load',installSupportAccess,{once:true});
document.addEventListener('click',event=>{const link=event.target.closest('[data-guild-support]');if(!link)return;event.preventDefault();open(link);});
// Acknowledgement is stored per authenticated player on the server, across devices.
const newsAttempted=new Set();let newsBusy=false;
function supportNewsIdentity(){
 const slug=guild();const keys=['lichtlootPlayerPin_'+slug];if(slug==='lichtloot')keys.push('lichtlootPlayerPin','lichtLootPlayerPin','spielerPin','playerPin','lichtloot_spielerpin');
 for(const key of keys){try{const pin=sessionStorage.getItem(key)||localStorage.getItem(key);if(pin&&pin.trim())return {guild:slug,playerPin:pin.trim()};}catch{}}
 return null;
}
async function checkSupportNews(){
 if(newsBusy||document.hidden||/\/(admin[^/]*)\.html$/.test(location.pathname))return;
 if([...document.querySelectorAll('dialog[open],.nachtloot-news-backdrop:not(.hidden),[role="dialog"][aria-modal="true"]:not(.hidden)')].some(el=>el.getClientRects().length))return;
 const identity=supportNewsIdentity();if(!identity)return;const key=identity.guild+':'+identity.playerPin;if(newsAttempted.has(key))return;
 newsBusy=true;
 try{
  const response=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'playerClaimSearchNews',...identity}),signal:AbortSignal.timeout(15000)});const result=await response.json();
  if(!response.ok||!result.success){if(response.status===403)newsAttempted.add(key);return;}
  newsAttempted.add(key);if(!result.show)return;
  if(typeof window.openLichtlootNews==='function'){window.installLichtlootNews?.();window.openLichtlootNews();return;}
  const news=document.createElement('dialog');news.className='gl-support';news.id='guildSupportNews';news.setAttribute('aria-labelledby','guildSupportNewsTitle');
  news.innerHTML="<header><div><p>GuildLoot · Neuigkeiten · 09.09.2026</p><h2 id=\"guildSupportNewsTitle\">Raidarchiv & Berufe skillen</h2></div><button type=\"button\" data-news-close aria-label=\"Neuigkeiten schließen\">×</button></header><section><h3>Neu: Raidarchiv auf der Startseite</h3><p>Vergangene Raids findest du jetzt direkt im Raidarchiv auf der Startseite. Öffne einen Raid und schau dir die verfügbaren Informationen und die Lootübersicht an.</p><button type=\"button\" data-news-feature=\"raid-archive\">Raidarchiv öffnen →</button></section><section><h3>Neu: Berufe skillen</h3><p>Plane deinen Beruf von 1 bis 300: Wähle deinen Beruf und deinen aktuellen Skill. Der Guide zeigt dir passende Schritte, Rezepte und Materialien sowie Hinweise zur Ausbildung. Auch Sammelberufe, Kochen, Erste Hilfe und Angeln sind dabei.</p><button type=\"button\" data-news-feature=\"professions\">Berufe skillen →</button></section><footer><button type=\"button\" data-news-close>Gelesen</button></footer>";
  document.body.append(news);news.querySelectorAll('[data-news-close]').forEach(b=>b.onclick=()=>news.close());
  news.querySelectorAll('[data-news-feature]').forEach(button=>button.onclick=()=>{
   news.close();const action=button.dataset.newsFeature;
   if(action==='raid-archive'&&typeof window.openRaidArchive==='function'){window.openRaidArchive();return;}
   if(action==='professions'&&window.GuildLootProfessions){window.GuildLootProfessions.open();return;}
   const target=new URL('/start.html',location.origin);target.searchParams.set('guild',identity.guild);target.searchParams.set('newsFeature',action);location.href=target.href;
  });
  news.addEventListener('close',()=>news.remove(),{once:true});news.showModal();

 }catch{/* A transient failure is retried; no acknowledgement is stored locally. */}finally{newsBusy=false;}
}
window.addEventListener('load',checkSupportNews,{once:true});window.addEventListener('storage',checkSupportNews);setInterval(checkSupportNews,10000);setTimeout(checkSupportNews,1500);
})();
