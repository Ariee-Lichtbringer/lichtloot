/* Load the selected guild's configured logo; never substitute a product logo. */
(async function () {
  const heading = document.querySelector('.top > div');
  if (!heading) return;
  const slug = (new URLSearchParams(location.search).get('guild') || 'lichtloot').trim().toLowerCase();
  try {
    const url = new URL('https://lichtloot-production.up.railway.app/api/apps-script');
    url.searchParams.set('action', 'listGuilds');
    const response = await fetch(url);
    if (!response.ok) return;
    const data = await response.json();
    const guild = (data.guilds || []).find(entry => String(entry.slug || '').toLowerCase() === slug);
    if (!guild) return;
    if (guild.name) heading.querySelector('.kicker').textContent = guild.name;
    if (!guild.logoUrl) return;
    const logoUrl = new URL(guild.logoUrl, location.href);
    if (!['https:', 'http:'].includes(logoUrl.protocol)) return;
    const img = new Image();
    img.alt = `Gildenlogo ${guild.name || slug}`;
    img.width = 78;
    img.height = 78;
    img.onload = () => {
      const mark = document.createElement('div');
      mark.className = 'analysis-guild-logo';
      mark.append(img);
      const copy = document.createElement('div');
      copy.className = 'analysis-brand-copy';
      while (heading.firstChild) copy.append(heading.firstChild);
      heading.classList.add('analysis-brand');
      heading.append(mark, copy);
    };
    img.src = logoUrl.href;
  } catch (_) {
    // Branding must never block the analysis when the guild endpoint is unavailable.
  }
})();
