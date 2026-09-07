/* Read-only item cards shared by player and management search. */
(()=>{
 const labels={'mc':'MC','bwl':'BWL','aq40':'AQ40','aq20':'AQ20','naxx':'Naxxramas','ony':'Onyxia','zg':'ZG','zg-prime':'ZG Prime','zg-late':'ZG Late','zg-mittwoch':'ZG Mittwoch'};
 const origins=item=>(item.raids||[item.raid]).filter(Boolean).map(r=>labels[r]||r).join(' · ');
 const node=(tag,text,cls)=>{const el=document.createElement(tag);el.textContent=text;if(cls)el.className=cls;return el;};
 const qualityClass=value=>{const quality=String(value??'').trim().toLowerCase();return ({'0':'poor','1':'common','2':'uncommon','3':'rare','4':'epic','5':'legendary','episch':'epic','selten':'rare','ungewöhnlich':'uncommon','legendär':'legendary','gewöhnlich':'common','schlecht':'poor'}[quality]||(['poor','common','uncommon','rare','epic','legendary'].includes(quality)?quality:''));};
 const fallbackIcon='https://wow.zamimg.com/images/wow/icons/large/inv_misc_questionmark.jpg';
 const iconUrl=item=>{
  const raw=String(item.icon||item.iconName||item.icon_url||'').trim();
  if(/^https:\/\//i.test(raw))return raw;
  const name=raw.replace(/\.(jpg|png|webp)$/i,'');
  return /^[a-z0-9_]+$/i.test(name)?`https://wow.zamimg.com/images/wow/icons/large/${name.toLowerCase()}.jpg`:fallbackIcon;
 };
 function positionCard(left,top){
  const rect=dialog.getBoundingClientRect(),gap=8;
  dialog.style.margin='0';dialog.style.right='auto';dialog.style.bottom='auto';
  dialog.style.left=Math.max(gap,Math.min(left,window.innerWidth-rect.width-gap))+'px';
  dialog.style.top=Math.max(gap,Math.min(top,window.innerHeight-rect.height-gap))+'px';
 }
 function makeDraggable(header){
  let drag=null;
  header.tabIndex=0;header.setAttribute('aria-label','Itemkarte verschieben: ziehen oder Pfeiltasten verwenden');
  header.addEventListener('pointerdown',event=>{
   if(event.button!==0||event.target.closest('button'))return;
   const rect=dialog.getBoundingClientRect();drag={id:event.pointerId,x:event.clientX,y:event.clientY,left:rect.left,top:rect.top};
   header.setPointerCapture(event.pointerId);event.preventDefault();header.classList.add('dragging');
  });
  header.addEventListener('pointermove',event=>{if(drag&&event.pointerId===drag.id)positionCard(drag.left+event.clientX-drag.x,drag.top+event.clientY-drag.y);});
  const stop=()=>{drag=null;header.classList.remove('dragging');};
  header.addEventListener('pointerup',stop);header.addEventListener('pointercancel',stop);header.addEventListener('lostpointercapture',stop);
  header.addEventListener('keydown',event=>{
   if(event.target!==header||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
   const rect=dialog.getBoundingClientRect(),step=event.shiftKey?30:10;
   positionCard(rect.left+(event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0),rect.top+(event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0));event.preventDefault();
  });
 }
 let dialog, returnFocus;
 function open(item,opener,character){
  returnFocus=opener;
  if(!dialog){dialog=document.createElement('dialog');dialog.className='item-search-dialog item-search-wow';dialog.setAttribute('aria-labelledby','itemSearchTitle');document.body.append(dialog);
   dialog.addEventListener('close',()=>returnFocus?.focus());
   window.addEventListener('resize',()=>{if(dialog.open){const rect=dialog.getBoundingClientRect();positionCard(rect.left,rect.top);}});
   dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
  }
  dialog.replaceChildren();
  for(const property of ['margin','left','top','right','bottom'])dialog.style[property]='';
  const header=node('header','','item-search-drag-handle');
  const icon=document.createElement('img');icon.className='item-search-icon';icon.alt='';icon.width=40;icon.height=40;icon.draggable=false;icon.referrerPolicy='no-referrer';icon.src=iconUrl(item);
  icon.addEventListener('error',()=>{if(icon.getAttribute('src')!==fallbackIcon)icon.src=fallbackIcon;});

  const close=node('button','✕','item-search-close');close.type='button';close.setAttribute('aria-label','Itemdetails schließen');close.addEventListener('click',()=>dialog.close());
  const title=node('h2',item.name);title.id='itemSearchTitle';
  title.className='item-search-title '+qualityClass(item.quality);
  header.append(icon,title,close);makeDraggable(header);dialog.append(header);
  const card=node('div','','item-search-card');
  const tooltip=String(item.tooltip||'').split(/\||\n/).map(s=>s.trim()).filter(Boolean);
  const lines=tooltip.length?tooltip:[item.bind,[item.slot,item.type].filter(Boolean).join(' · '),...(item.stats||[]),item.needed,item.equip].filter(Boolean);
  let effectsStarted=false,footerStarted=false;
  if(tooltip.length>1 && /^(Item Level|Gegenstandsstufe)\b/i.test(tooltip[1]))lines.shift();
  for(const line of lines){
    if(line===item.name)continue;
    const effect=/^(Anlegen:|Benutzen:|Equip:|Use:|Set:|\(\d+\) Set:|Chance bei Treffer|Chance on hit|Verzaubert:)/i.test(line);
    const footer=/^(Haltbarkeit|Benötigt|Verkaufspreis|Durability|Requires Level|Sell Price)/i.test(line);
    const classes=[];if(effect){classes.push('item-search-effect');if(!effectsStarted){classes.push('item-search-effect-start');effectsStarted=true;}}
    if(footer&&effectsStarted&&!footerStarted){classes.push('item-search-footer-start');footerStarted=true;}
    card.append(node('p',line,classes.join(' ')));
  }
  if(!lines.length)card.append(node('p','Für dieses Item sind noch keine Tooltipwerte hinterlegt.'));
  dialog.append(card);
  dialog.append(node('p',[origins(item),item.itemId?`Item-ID: ${item.itemId}`:''].filter(Boolean).join(' · '),'item-search-origin'));
  if(item.boss)dialog.append(node('p',`Boss / Quelle: ${item.boss}`,'item-search-origin'));
  window.GuildLootCompare?.mount(dialog,item,character);
  if(!dialog.open)dialog.showModal();close.focus();
 }
 async function search(term,signal){
  const base='https://lichtloot-production.up.railway.app/api/apps-script';
  const url=new URL(typeof withGuildUrl==='function'?withGuildUrl(base):base);
  url.searchParams.set('action','searchLootItems');url.searchParams.set('q',term);
  const response=await fetch(url,{signal});
  if(!response.ok)throw new Error('Itemsuche derzeit nicht erreichbar.');
  const data=await response.json();if(data.success!==true)throw new Error('Itemsuche derzeit nicht erreichbar.');return data;
 }
 window.GuildLootItems={search,open,origins,iconUrl,qualityClass};
})();
