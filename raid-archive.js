(() => {
  const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let dialog, generation = 0;
  const button = (text, action) => { const b=document.createElement('button'); b.textContent=text;b.type='button';b.onclick=action;return b; };
  window.openRaidArchive = async (raidId='', initialTab='loot', scope='past') => {
    if (!dialog) {
      const style=document.createElement('style');style.textContent=`.gl-archive{box-sizing:border-box;background:#0c1422;color:#e3eaf5;border:1px solid #a88a30;border-radius:18px;width:min(1100px,90vw);max-height:85vh;padding:24px;font:16px system-ui}.gl-archive::backdrop{background:#000b}.gl-archive button,.gl-archive input{background:#172438;color:inherit;border:1px solid #526078;border-radius:7px;padding:10px;margin:4px;cursor:pointer}.gl-archive header{display:flex;justify-content:space-between;align-items:center}.gl-archive h2{color:#ffd52a}.gl-archive .scroll{overflow:auto;max-height:60vh}.gl-archive table{color:inherit;width:100%;border-collapse:collapse}.gl-archive th,.gl-archive td{text-align:left;padding:12px;border-bottom:1px solid #2a3648}.gl-archive th{color:#55e6df;position:sticky;top:0;background:#0c1422}.gl-archive a{color:#d4afff}.gl-archive article{padding:12px;border-bottom:1px solid #354156}.gl-archive [aria-pressed=true]{border-color:#ffd52a;color:#ffd52a}`;document.head.append(style);
      dialog=document.createElement('dialog');dialog.className='gl-archive';document.body.append(dialog);
      dialog.addEventListener('close',()=>generation++);
    }
    const turn=++generation;
    dialog.innerHTML='<header><h2>Raidarchiv</h2></header><div class="content">Wird geladen …</div>';
    dialog.querySelector('header').append(button('Schließen',()=>dialog.close()));
    if(!dialog.open)dialog.showModal();
    const content=dialog.querySelector('.content');
    const guild=typeof CURRENT_GUILD_SLUG!=='undefined'?CURRENT_GUILD_SLUG:(new URLSearchParams(location.search).get('guild')||'lichtloot');
    const api=typeof LICHTLOOT_API_URL!=='undefined'?new URL('/api/public/raid-archive',LICHTLOOT_API_URL):new URL('/api/public/raid-archive',location.origin);
    const load=async(offset=0)=>{api.search=new URLSearchParams({guild,raidId,offset,scope});const response=await fetch(api,{cache:'no-store'});const data=await response.json();if(!response.ok||!data.success)throw Error(data.error||'Archiv konnte nicht geladen werden.');return data;};
    try {
      const data=await load();if(turn!==generation)return;
      content.innerHTML='';
      if(!raidId){
        content.append(button('Aktuelle Raids',()=>openRaidArchive('','prios','current')),button('Vergangene Raids',()=>openRaidArchive('','loot','past')));
        const search=document.createElement('input');search.type='search';search.placeholder='Raid oder Datum suchen';search.setAttribute('aria-label','Raid oder Datum suchen');content.append(search);
        const list=document.createElement('div');list.className='scroll';content.append(list);
        let raids=data.raids;
        const render=()=>{list.innerHTML='';const matches=raids.filter(r=>`${r.title} ${r.type} ${r.date}`.toLowerCase().includes(search.value.toLowerCase()));if(!matches.length)list.textContent='Keine Raids gefunden.';for(const r of matches){const card=document.createElement('article');card.innerHTML=`<strong>${esc(r.title)}</strong> · ${esc(r.date)} ${esc(r.time||'')}`;card.append(button('Prioliste',()=>openRaidArchive(r.id,'prios',scope)),button('Raidloot',()=>openRaidArchive(r.id,'loot',scope)));list.append(card);}};
        search.oninput=render;render();
        const more=button('Weitere Raids laden',async()=>{more.disabled=true;try{const next=await load(raids.length);if(turn!==generation)return;raids.push(...next.raids);render();more.hidden=!next.hasMore;}catch(error){more.textContent=error.message;}finally{more.disabled=false;}});more.hidden=!data.hasMore;content.append(more);return;
      }
      dialog.querySelector('h2').textContent=`${data.raid.title} · ${data.raid.date}`;
      content.append(button('Zur Raidübersicht',()=>openRaidArchive('','loot',scope)));
      const tabs=document.createElement('nav'),body=document.createElement('div');body.className='scroll';content.append(tabs,body);
      const table=(headers,rows)=>`<table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(cell=>`<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
      const show=tab=>{for(const b of tabs.children)b.setAttribute('aria-pressed',String(b.dataset.tab===tab));if(tab==='prios'){body.innerHTML=data.prios.length?table(['Spieler','Server','Klasse','P1','P2','P3','P0+'],data.prios.map(p=>[p.player,p.server,p.className,p.p1,p.p2,p.p3,p.p0].map(esc))):'<p>Keine Prioliste für diesen Raid vorhanden.</p>';if(data.priosVisible===false)body.insertAdjacentHTML('afterbegin','<p>P1–P3 werden bis zur Freigabe nur als „gesetzt“ angezeigt.</p>');return;}
        if(!data.hasLootLog){body.innerHTML='<p>Für diesen Raid wurde kein Lootprotokoll hochgeladen.</p>';return;}
        body.innerHTML=`<p>${data.loot.length} aufgezeichnete Empfangsmeldungen. Sie belegen den Empfang; eine Bossquelle ist dadurch nicht bestätigt.</p>`+(data.loot.length?table(['Zeit','Spieler','Item','Menge'],data.loot.map(l=>[esc(new Date(l.time*1000).toLocaleTimeString('de-DE',{timeZone:'Europe/Berlin'})),esc(l.player),`<a href="https://www.wowhead.com/classic/item=${encodeURIComponent(l.itemId)}" target="_blank" rel="noopener">${esc(l.item||l.itemId)}</a>`,esc(l.quantity)])):'<p>Das hochgeladene Protokoll enthält keine Empfangsmeldungen.</p>');};
      for(const [tab,label] of [['prios','Prioliste'],['loot','Raidloot']]){const b=button(label,()=>show(tab));b.dataset.tab=tab;tabs.append(b);}show(initialTab);
    }catch(error){if(turn===generation)content.textContent=error.message;}
  };
})();
