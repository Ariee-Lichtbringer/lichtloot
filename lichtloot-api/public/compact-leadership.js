(() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  const compact = params.get('view') === 'compact';
  const guild = params.get('guild');
  document.querySelectorAll('[data-compact-leadership-link]').forEach(link => {
    const url = new URL('/gildenleitung.html', location.href);
    url.searchParams.set('view', 'compact');
    if (guild) url.searchParams.set('guild', guild);
    link.href = url.href;
  });
  if (!compact) return;
  document.body.classList.add('compact-leadership');
  const header = document.createElement('section');
  header.className = 'compact-leadership-header';
  header.innerHTML = '<h1>Gildenleitung mobil</h1><p>Raid auswählen · Spieler anmelden, abmelden oder auf die Bank setzen.</p><a>Vollständige Gildenleitung öffnen →</a>';
  const full = new URL(location.href);
  full.searchParams.delete('view');
  header.querySelector('a').href = full.href;
  document.querySelector('.dashboard-main')?.prepend(header);
  // Use the existing authenticated workflow and server-side permission checks.
  window.activateCompactLeadership = () => {
    if (document.body.classList.contains('guild-locked') || document.body.classList.contains('worldbuff-only')) return;
    openRaidHelperPanel('currentEvents');
  };
  if (typeof lastOverviewLoadedAt !== 'undefined' && lastOverviewLoadedAt) window.activateCompactLeadership();
})();
