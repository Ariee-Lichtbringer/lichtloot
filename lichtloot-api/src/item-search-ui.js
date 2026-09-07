/* Read-only item cards shared by player and management search. */
(()=>{
 const labels={'mc':'MC','bwl':'BWL','aq40':'AQ40','aq20':'AQ20','naxx':'Naxxramas','ony':'Onyxia','zg':'ZG','zg-prime':'ZG Prime','zg-late':'ZG Late','zg-mittwoch':'ZG Mittwoch'};
 const origins=item=>(item.raids||[item.raid]).filter(Boolean).map(r=>labels[r]||r).join(' · ');
 const node=(tag,text,cls)=>{const el=document.createElement(tag);el.textContent=text;if(cls)el.className=cls;return el;};
 let dialog, returnFocus;
 function open(item,opener){
  returnFocus=opener;
  if(!dialog){dialog=document.createElement('dialog');dialog.className='item-search-dialog';dialog.setAttribute('aria-labelledby','itemSearchTitle');document.body.append(dialog);
   dialog.addEventListener('close',()=>returnFocus?.focus());
   dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
  }
  dialog.replaceChildren();
  const close=node('button','✕','item-search-close');close.type='button';close.setAttribute('aria-label','Itemdetails schließen');close.addEventListener('click',()=>dialog.close());dialog.append(close);
  const title=node('h2',item.name);title.id='itemSearchTitle';
  const quality=String(item.quality||'').toLowerCase();
  title.className='item-search-title '+({'4':'epic','3':'rare','2':'uncommon','5':'legendary'}[quality]||(['epic','rare','uncommon','legendary'].includes(quality)?quality:''));dialog.append(title);
  dialog.append(node('p',[origins(item),item.itemId?`Item-ID: ${item.itemId}`:''].filter(Boolean).join(' · '),'item-search-origin'));
  const card=node('div','','item-search-card');
  const tooltip=String(item.tooltip||'').split(/\||\n/).map(s=>s.trim()).filter(Boolean);
  const lines=tooltip.length?tooltip:[item.bind,[item.slot,item.type].filter(Boolean).join(' · '),...(item.stats||[]),item.needed,item.equip].filter(Boolean);
  for(const line of lines){if(line===item.name)continue;card.append(node('p',line,/^(Anlegen:|Benutzen:|Equip:|Use:)/i.test(line)?'item-search-effect':''));}
  if(!lines.length)card.append(node('p','Für dieses Item sind noch keine Tooltipwerte hinterlegt.'));
  dialog.append(card);
  if(item.boss)dialog.append(node('p',`Boss / Quelle: ${item.boss}`,'item-search-origin'));
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
 window.GuildLootItems={search,open,origins};
})();
