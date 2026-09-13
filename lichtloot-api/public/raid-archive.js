// Shared entry point for homepage and leadership raid cards.
window.openRaidArchive = (raidId='', tab='loot', scope='past') => {
  if(typeof showRaidArchiveCenter==='function'){showRaidArchiveCenter(raidId,tab,scope);return;}
  const guild=typeof CURRENT_GUILD_SLUG!=='undefined'?CURRENT_GUILD_SLUG:(new URLSearchParams(location.search).get('guild')||'lichtloot');
  const url=new URL('/raidarchiv.html',location.href);
  const code=document.getElementById('masterCode')?.value.trim();
  const manage=Boolean(code && /gildenleitung\.html$/.test(location.pathname));
  if(manage){try{sessionStorage.setItem('lichtlootGuildMasterCode_'+guild,code);}catch{}}
  url.search=new URLSearchParams({guild,scope,...(manage?{manage:'1'}:{}),...(raidId?{raidId,tab}:{})});
  location.assign(url.href);
};
