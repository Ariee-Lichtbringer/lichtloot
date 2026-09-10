(()=>{
  const root=document.querySelector('[data-raid-news]');if(!root)return;
  const windowEl=root.querySelector('.raid-news-window'),pause=root.querySelector('.raid-news-pause');let last='',busy=false;
  pause.addEventListener('click',()=>{const paused=root.dataset.paused!=='true';root.dataset.paused=String(paused);pause.textContent=paused?'▶':'Ⅱ';pause.setAttribute('aria-label',paused?'Newsticker fortsetzen':'Newsticker pausieren');pause.setAttribute('aria-pressed',String(paused));});
  function item(entry){
    let href;
    try{const url=new URL(entry.url);if(url.protocol==='https:'&&['www.curseforge.com','www.youtube.com'].includes(url.hostname))href=url.href;}catch{}
    const el=document.createElement(href?'a':'button');el.className='raid-news-item';el.dataset.kind=entry.kind==='update'?'update':'news';
    if(href){el.href=href;el.target='_blank';el.rel='noopener noreferrer';if(new URL(href).hostname==='www.curseforge.com'){const icon=document.createElement('img');icon.src='images/addon-guide/curseforge.svg';icon.alt='CurseForge';el.append(icon);}}else{el.type='button';el.addEventListener('click',()=>{if(entry.action==='addon')window.showAddonGuide?.();else if(['raid-archive','professions','search','support','random-create','gear-planner'].includes(entry.action))window.openLichtlootNewsFeature?.(entry.action);else window.openLichtlootNews?.();});}
    const title=document.createElement('strong');title.textContent=String(entry.title||'Neuigkeit').slice(0,180);const body=document.createElement('span');body.textContent='· '+String(entry.text||'').slice(0,350);el.append(title);if(entry.text)el.append(body);return el;
  }
  async function refresh(){
    if(busy||document.hidden)return;busy=true;
    try{const response=await fetch('raid-news.json',{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!response.ok)return;const data=await response.json();if(!Array.isArray(data.items))return;const entries=data.items.filter(e=>e&&typeof e.title==='string').slice(0,12);if(!entries.length)return;const key=JSON.stringify(entries);if(key===last)return;
      // Keep a focused link in place; apply the feed update on the next refresh.
      if(windowEl.contains(document.activeElement))return;
      const track=document.createElement('div');track.className='raid-news-track';
      for(let i=0;i<2;i++){const group=document.createElement('div');group.className='raid-news-group';if(i){group.setAttribute('aria-hidden','true');group.inert=true;}for(const entry of entries)group.append(item(entry));track.append(group);}
      windowEl.replaceChildren(track);last=key;requestAnimationFrame(()=>track.style.setProperty('--ticker-duration',Math.max(35,track.scrollWidth/2/48)+'s'));
    }catch{/* Keep the last usable news during connection failures. */}finally{busy=false;}
  }
  refresh();setInterval(refresh,60000);document.addEventListener('visibilitychange',refresh);
})();
