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
      <a class="game-switcher-link" data-game-target="index.html" href="index.html" ${active==='era'?'aria-current="true"':''}><img src="images/wow-classic-logo.png" alt="" width="84" height="66"><span><strong>Classic Era</strong><small>${active==='era'?'Aktiver Bereich':'Raids & Prios'}</small></span></a>
      <a class="game-switcher-link" data-game-target="forever-start.html" href="forever-start.html" ${active==='forever'?'aria-current="true"':''}><img src="images/wow-forever-logo-transparent.png" alt="" width="84" height="66"><span><strong>WoW Forever</strong><small>${active==='forever'?'Aktiver Bereich':'Gilde & Raids'}</small></span></a>
      </div><a class="game-switcher-tools" data-game-target="forever.html" href="forever.html">Forever entdecken ↗<br>Items, Talente & Berufe</a>`;
    nav.querySelectorAll('[data-game-target]').forEach(link => {
      link.href = target(link.dataset.gameTarget);
      link.addEventListener('click', () => {link.href = target(link.dataset.gameTarget);});
    });
    host.replaceWith(nav);
  });
})();
