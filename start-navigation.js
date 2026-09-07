/* Shared, theme-aware fantasy emblems for the player dashboard. */
(()=>{
  const art={
    dashboard:'M5 27V12l5-3V5l6 4 6-4v4l5 3v15H5Z M12 27v-9h8v9 M10 12v3 M22 12v3 M14 12h4',
    worldbuff:'M16 7a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M16 1v4 M16 27v4 M1 16h4 M27 16h4 M5 5l3 3 M24 24l3 3 M5 27l3-3 M24 8l3-3 M16 11l3 5-3 5-3-5Z',
    hordenbuff:'M17 2c2 8 9 10 10 17a11 11 0 0 1-22 0c0-5 3-8 5-11l2 8c4-3 4-9 5-14Z M17 16c-5 5-7 10-1 12 6-1 6-5 1-12Z',
    logs:'M4 27V17l3-3 3 3v10H4Z M13 27V11l3-3 3 3v16h-6Z M22 27V5l3-3 3 3v22h-6Z M2 30h28',
    raidRules:'M8 4h17l-2 4v17l-2 3H5l3-4V4Z M8 4H5a3 3 0 0 0 0 6h3 M23 22h4a3 3 0 0 1 0 6h-6 M12 11h7 M12 15h7 M12 19h4',
    p0plus:'M19 12a8 8 0 1 1 0 16 8 8 0 0 1 0-16Z M19 16v8 M16 18h5 M17 22h5 M12 21A9 9 0 1 1 20 9 M11 6v10 M8 9h6 M8 13h6',
    prioPages:'M11 6h17v4H11Z M11 14h17v4H11Z M11 22h17v4H11Z M4 4v6 M3 14h4v2H3v3h4 M3 23h4v5H3 M4 25h3',
    raidlead:'M4 13V9l4-5h16l4 5v4H4Z M5 14v13h22V14 M3 13h26 M13 11h6v8h-6Z M16 14v2 M9 5v7 M23 5v7 M8 24h16',
    create:'M5 7h22v21H5Z M10 3v8 M22 3v8 M5 13h22 M16 17v8 M12 21h8',
    bell:'M7 22h18l-3-5v-5a6 6 0 0 0-12 0v5l-3 5Z M13 26a3 3 0 0 0 6 0 M16 2v3',
    shield:'M5 7l11-4 11 4v10c0 6-6 10-11 13C11 27 5 23 5 17V7Z M9 10l7-3 7 3v7c0 4-4 7-7 9-3-2-7-5-7-9v-7Z',
    leadership:'M5 10l11-3 11 3v8c0 5-6 9-11 12C11 27 5 23 5 18v-8Z M10 7 8 2l5 3 3-4 3 4 5-3-2 5 M16 12l2 4 4 1-3 3 1 4-4-2-4 2 1-4-3-3 4-1Z'
  };
  let count=0;
  function icon(name){
    const id='nav-metal-'+(++count),path=art[name]||art.shield;
    const span=document.createElement('i');span.className='fantasy-nav-icon';span.setAttribute('aria-hidden','true');
    span.innerHTML=`<svg viewBox="0 0 32 32" focusable="false"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop class="metal-light"/><stop offset=".48" class="metal-mid"/><stop offset="1" class="metal-dark"/></linearGradient></defs><path d="${path}" fill="none" stroke="#02060c" stroke-width="3.7" stroke-linejoin="round" stroke-linecap="round" transform="translate(0 1)"/><path d="${path}" fill="var(--nav-metal-fill)" stroke="url(#${id})" stroke-width="1.65" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
    return span;
  }
  function mount(){
    const side=document.querySelector('.start-sidebar');if(!side)return;
    if(!side.dataset.fantasyNavigation){
      side.dataset.fantasyNavigation='ready';
      side.querySelectorAll('.start-side-group').forEach(group=>group.classList.remove('collapsed'));
      side.addEventListener('click',event=>{
        const toggle=event.target.closest('.start-side-group-toggle');
        if(toggle)toggle.setAttribute('aria-expanded',String(!toggle.parentElement.classList.contains('collapsed')));
      });
    }
    side.querySelectorAll('[data-start-nav]').forEach(button=>{
      if(button.querySelector('.fantasy-nav-icon'))return;
      const old=button.querySelector('.start-side-icon-img,.start-side-icon');if(old)old.replaceWith(icon(button.dataset.startNav));
    });
    const leadership=side.querySelector('.sidebar-leadership-link .start-side-icon');if(leadership)leadership.replaceWith(icon('leadership'));
    const trigger=side.querySelector('#globalGuildTrigger');if(trigger&&!trigger.querySelector('.fantasy-nav-icon'))trigger.prepend(icon('shield'));
    const news=side.querySelector('.nachtloot-news-button');if(news&&!news.querySelector('.fantasy-nav-icon'))news.prepend(icon('bell'));
    if(!side.querySelector('.sidebar-account-entry')){
      const entry=document.createElement('button');entry.type='button';entry.className='sidebar-account-entry';
      entry.append('Mein ');const label=document.createElement('span');label.dataset.guildBrand='lootName';label.textContent=document.querySelector('[data-guild-brand="lootName"]')?.textContent||'LichtLoot';entry.append(label);
      entry.addEventListener('click',()=>window.openAccountManagementCenter());side.querySelector('.start-sidebar-logo').after(entry);
    }
    side.querySelectorAll('.start-side-group-toggle').forEach(button=>button.setAttribute('aria-expanded',String(!button.parentElement.classList.contains('collapsed'))));
    const slug=new URLSearchParams(location.search).get('guild')||'';
    side.classList.toggle('night-metal',slug==='nachtloot');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
  window.addEventListener('load',mount);
  // Guild branding and the news entry can arrive after the initial render.
  const observer=new MutationObserver(()=>{observer.disconnect();mount();observe();});
  function observe(){const side=document.querySelector('.start-sidebar');if(side)observer.observe(side,{childList:true,subtree:true});}
  document.addEventListener('DOMContentLoaded',observe);
})();
