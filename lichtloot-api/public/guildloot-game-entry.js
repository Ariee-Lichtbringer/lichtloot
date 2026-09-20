(() => {
  const panel = document.getElementById('loggedInPanel');
  function syncEntry() {
    document.body.classList.toggle('portal-player-active', !!panel && !panel.classList.contains('hidden'));
    const guild = typeof currentActiveGuildSlug === 'function' ? currentActiveGuildSlug() : new URLSearchParams(location.search).get('guild');
    document.querySelectorAll('[data-game-entry]').forEach(link => {
      const url = new URL(link.href);
      if (guild) url.searchParams.set('guild', guild); else url.searchParams.delete('guild');
      link.href = url.pathname + url.search + url.hash;
    });
  }
  syncEntry();
  if (panel) new MutationObserver(syncEntry).observe(panel, {attributes:true, attributeFilter:['class']});
  const guildName = document.getElementById('dashboardGuildName');
  if (guildName) new MutationObserver(syncEntry).observe(guildName, {childList:true, subtree:true, characterData:true});
})();
