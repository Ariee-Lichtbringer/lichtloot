(() => {
  'use strict';
  const hosts = ['guildlootMyExport', 'guildlootDashboardExport'].map(id => document.getElementById(id)).filter(Boolean);
  if (!hosts.length) return;
  const style = document.createElement('style');
  style.textContent = `.addon-beta-dialog{box-sizing:border-box;width:min(420px,calc(100% - 32px));max-height:90vh;overflow:auto;border:1px solid #a88942;border-radius:16px;background:#101827;color:#e5edf8;padding:26px;box-shadow:0 24px 80px #0009}.addon-beta-dialog::backdrop{background:#000b}.addon-beta-dialog h2{color:#facc15;margin:0 0 18px}.addon-beta-dialog label{display:block;margin-bottom:8px}.addon-beta-dialog input{box-sizing:border-box;width:100%;padding:12px;font-size:20px;letter-spacing:4px;color:#fff;background:#07101e;border:1px solid #64748b;border-radius:8px}.addon-beta-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}.addon-beta-dialog [role=status]{min-height:24px;color:#fcd34d}.addon-beta-trigger{margin:10px 0}`;
  document.head.append(style);
  const dialog = document.createElement('dialog');
  dialog.className = 'addon-beta-dialog';
  dialog.setAttribute('aria-labelledby', 'addonBetaTitle');
  dialog.innerHTML = `<form><h2 id="addonBetaTitle">Beta Testversion</h2><label for="addonBetaPin">Bitte PIN eingeben</label><input id="addonBetaPin" type="password" inputmode="numeric" autocomplete="off" pattern="[0-9]{8}" minlength="8" maxlength="8" required aria-describedby="addonBetaHint" autofocus><p id="addonBetaHint">Mit deiner 8-stelligen Beta-PIN kannst du das GuildLoot-Addon herunterladen.</p><p role="status" aria-live="polite"></p><div class="addon-beta-actions"><button type="submit" class="tool-btn">Herunterladen</button><button type="button" class="tool-btn" data-close>Abbrechen</button></div></form>`;
  document.body.append(dialog);
  const input = dialog.querySelector('input'), status = dialog.querySelector('[role=status]'), submit = dialog.querySelector('[type=submit]');
  let controller;
  dialog.querySelector('[data-close]').onclick = () => dialog.close();
  dialog.addEventListener('close', () => { controller?.abort(); input.value = ''; });
  dialog.addEventListener('click', event => { if(event.target === dialog){ const r=dialog.getBoundingClientRect(); if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close(); } });
  hosts.forEach(host => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'tool-btn addon-beta-trigger'; button.textContent = 'GuildLoot-Addon · Beta herunterladen';
    button.onclick = () => { status.textContent = ''; input.value = ''; dialog.showModal(); input.focus(); };
    host.before(button);
  });
  if (new URLSearchParams(location.search).get('addonBeta') === '1') { dialog.showModal(); input.focus(); }
  dialog.querySelector('form').addEventListener('submit', async event => {
    event.preventDefault(); if(submit.disabled)return;
    submit.disabled = true; status.textContent = 'PIN wird geprüft …'; controller = new AbortController();
    try {
      const base = typeof RAILWAY_API_URL !== 'undefined' ? RAILWAY_API_URL : location.origin;
      const response = await fetch(new URL('/api/addon-beta/download', base), {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({pin:input.value}), cache:'no-store', signal:controller.signal});
      if(!response.ok){ const data = await response.json().catch(()=>({})); throw new Error(data.error || 'Download fehlgeschlagen. Bitte erneut versuchen.'); }
      const blob = await response.blob(), url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = 'GuildLootEra-0.19.0-beta.zip'; document.body.append(link); link.click(); link.remove(); setTimeout(()=>URL.revokeObjectURL(url),60000);
      input.value = ''; status.textContent = 'Download gestartet. Viel Spaß beim Testen!';
    } catch(error) { if(error.name !== 'AbortError') {status.textContent = error.message; input.select();} }
    finally { submit.disabled = false; }
  });
})();
