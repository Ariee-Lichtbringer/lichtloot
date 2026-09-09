// Shared entry point for homepage and leadership raid cards.
window.openRaidArchive = (raidId='', tab='loot', scope='past') => {
  if(typeof showRaidArchiveCenter==='function'){showRaidArchiveCenter(raidId,tab,scope);return;}
  const guild=typeof CURRENT_GUILD_SLUG!=='undefined'?CURRENT_GUILD_SLUG:(new URLSearchParams(location.search).get('guild')||'lichtloot');
  const url=new URL('/raidarchiv.html',location.href);
  url.search=new URLSearchParams({guild,scope,...(raidId?{raidId,tab}:{})});
  location.assign(url.href);
};
