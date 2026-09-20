(() => {
  function guild() {
    return typeof currentActiveGuildSlug === 'function' ? currentActiveGuildSlug() : new URLSearchParams(location.search).get('guild');
  }
  let links = [];
  function target(path) {
    const url = new URL(path, location.href), selected = guild();
    const destination = path.startsWith('forever') ? 'forever' : 'era';
    const active = location.pathname.includes('forever') ? 'forever' : 'era';
    const match = links.find(g => g.slug===selected || g.layout?.sourceGuild===selected);
    const mapped = active===destination ? selected : destination==='forever' ? (match?.slug || '') : (match?.layout?.sourceGuild || '');
    if(mapped) url.searchParams.set('guild', mapped);
    return url.pathname + url.search;
  }
  const base=['localhost','127.0.0.1'].includes(location.hostname)?location.origin:'https://lichtloot-production.up.railway.app';
  fetch(base+'/api/apps-script?action=listGuilds&game=forever').then(r=>r.json()).then(d=>{links=d.guilds||[];document.querySelectorAll('[data-game-target]').forEach(a=>a.href=target(a.dataset.gameTarget));}).catch(()=>{});
  const guildLabel=document.getElementById('dashboardGuildName');
  if(guildLabel)new MutationObserver(()=>document.querySelectorAll('[data-game-target]').forEach(a=>a.href=target(a.dataset.gameTarget))).observe(guildLabel,{childList:true,subtree:true,characterData:true});
  document.querySelectorAll('[data-game-switcher]').forEach(host => {
    const active = host.dataset.gameSwitcher;
    const nav = document.createElement('nav');
    nav.className = 'game-switcher'; nav.setAttribute('aria-label', 'Spielbereich wechseln');
    nav.innerHTML = `<span class="game-switcher-label">Spielbereich</span><div class="game-switcher-options">
      <div class="game-era-picker"><button type="button" class="game-switcher-link game-era-toggle" aria-expanded="false" aria-controls="game-era-guilds" ${active==='era'?'aria-current="true"':''}><img src="images/wow-classic-logo.png" alt="" width="84" height="66"><span><strong>Classic Era</strong><small>Meine Lootgilden ▾</small></span></button><div id="game-era-guilds" class="game-era-menu" aria-label="Deine Era-Lootgilden" hidden></div></div>
      <a class="game-switcher-link" data-game-target="forever-start.html" href="forever-start.html" ${active==='forever'?'aria-current="true"':''}><img src="images/wow-forever-logo-transparent.png" alt="" width="84" height="66"><span><strong>WoW Forever</strong><small>${active==='forever'?'Aktiver Bereich':'Gilde & Raids'}</small></span></a>
      </div><a class="game-switcher-tools" data-game-target="forever.html" href="forever.html">Forever entdecken ↗<br>Items, Talente & Berufe</a>`;
    nav.querySelectorAll('[data-game-target]').forEach(link => {
      link.href = target(link.dataset.gameTarget);
      link.addEventListener('click', () => {link.href = target(link.dataset.gameTarget);});
    });
    const toggle=nav.querySelector('.game-era-toggle'),menu=nav.querySelector('.game-era-menu');
    let eraGuilds=null,loading=null;
    function hasSavedLogin(slug){
      const key='lichtlootPlayerPin_'+slug;
      try{return !!(localStorage.getItem(key)||sessionStorage.getItem(key)||'').trim();}catch{return false;}
    }
    function close(){menu.hidden=true;toggle.setAttribute('aria-expanded','false');}
    function entry(text,path,description,logo){
      const a=document.createElement('a');a.className='game-era-option';a.href=path;
      if(logo){const img=document.createElement('img');img.src=logo;img.alt='';img.width=36;img.height=36;a.append(img);}
      const copy=document.createElement('span'),title=document.createElement('strong'),detail=document.createElement('small');title.textContent=text;detail.textContent=description;copy.append(title,detail);a.append(copy);return a;
    }
    async function open(){
      menu.hidden=false;toggle.setAttribute('aria-expanded','true');menu.textContent='Deine Lootgilden werden geladen …';
      try{
        if(!eraGuilds){loading ||= fetch(base+'/api/apps-script?action=listGuilds&game=era').then(async r=>{const d=await r.json();if(!r.ok||!Array.isArray(d.guilds))throw Error();return d.guilds;}).finally(()=>{loading=null;});eraGuilds=await loading;}
        const mine=eraGuilds.filter(g=>g.layout?.game!=='forever'&&hasSavedLogin(g.slug));menu.replaceChildren();
        const heading=document.createElement('div');heading.className='game-era-menu-title';heading.textContent='Deine Era-Lootgilden';menu.append(heading);
        for(const g of mine){const name=typeof displayGuildName==='function'?displayGuildName(g):g.slug==='lichtloot'?'Lichtbringer':g.name||g.slug;menu.append(entry(name,'start.html?'+new URLSearchParams({guild:g.slug}),'Zur Raidübersicht →',g.logoUrl||'images/guild-defaults/default-logo.webp'));}
        if(!mine.length){const empty=document.createElement('p');empty.textContent='Hier erscheinen deine Lootgilden, sobald du dich dort mit deinem Era-SpielerLogin angemeldet hast.';menu.append(empty);}
        menu.append(entry(mine.length?'Weitere Lootgilde anmelden':'Zum Era-SpielerLogin',target('index.html'),'SpielerLogin & Gildenauswahl'));
      }catch{menu.replaceChildren(entry('Era-Bereich öffnen',target('index.html'),'Gilden konnten gerade nicht geladen werden.'));}
    }
    toggle.addEventListener('click',()=>menu.hidden?open():close());
    toggle.addEventListener('keydown',async event=>{if(event.key==='ArrowDown'){event.preventDefault();await open();if(!menu.hidden)menu.querySelector('a')?.focus();}});
    document.addEventListener('click',event=>{if(!nav.querySelector('.game-era-picker').contains(event.target))close();});
    nav.addEventListener('keydown',event=>{if(event.key==='Escape'&&!menu.hidden){event.preventDefault();close();toggle.focus();}});
    host.replaceWith(nav);
  });
})();
