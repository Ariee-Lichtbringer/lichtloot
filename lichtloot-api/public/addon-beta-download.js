(() => {
  'use strict';
  const hosts = ['guildlootMyExport', 'guildlootDashboardExport'].map(id => document.getElementById(id)).filter(Boolean);
  if (!hosts.length && !document.querySelector('[data-addon-download],[data-addon-update]')) return;
  const style = document.createElement('style');
  style.textContent = `dialog.addon-beta-dialog{position:fixed;inset:0;margin:auto!important;box-sizing:border-box;width:min(520px,calc(100vw - 32px));max-width:calc(100vw - 32px);height:fit-content;max-height:calc(100vh - 32px);max-height:calc(100dvh - 32px);overflow:auto;overscroll-behavior:contain;border:1px solid #a88942;border-radius:16px;background:#101827;color:#e5edf8;padding:26px;box-shadow:0 24px 80px #0009}.addon-beta-dialog::backdrop{background:#000b}.addon-beta-dialog h2{color:#f0f4f8;font-size:24px;line-height:1.25;margin:0 0 24px}.addon-beta-dialog form{margin:0}.addon-beta-dialog #addonBetaHint{font-size:13px;line-height:1.6;color:#a9b8c6;margin:16px 0}.addon-beta-dialog label{font-size:14px}.addon-beta-dialog label{display:block;margin-bottom:8px}.addon-beta-dialog select{box-sizing:border-box;width:100%;padding:10px;margin:0 0 16px;color:#fff;background:#07101e;border:1px solid #64748b;border-radius:8px;font:inherit}.addon-beta-dialog input{box-sizing:border-box;width:100%;padding:12px;font-size:20px;letter-spacing:4px;color:#fff;background:#07101e;border:1px solid #64748b;border-radius:8px}.addon-beta-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}.addon-beta-dialog [role=status]{min-height:24px;color:#fcd34d}.addon-beta-trigger{margin:10px 0}`;
  style.textContent += `.addon-beta-dialog{background:linear-gradient(145deg,#101e2c,#070e19)!important;border-color:#b99a3b!important;font-family:inherit}.addon-beta-dialog h2{color:#f4ce65}.addon-beta-dialog select{min-height:48px;border-color:#3a5967;color-scheme:dark}.addon-beta-dialog select:focus-visible,.addon-beta-dialog button:focus-visible{outline:2px solid #53dfc6;outline-offset:3px}.addon-beta-dialog #addonBetaHint{color:#58dfc5;margin:0 0 18px}.sync-download-steps{padding-left:22px;line-height:1.65;font-size:14px}.sync-download-steps li{margin:12px 0}.sync-download-note{font-size:12px;color:#a8bbca}.addon-beta-dialog .addon-beta-actions button{min-height:44px;padding:10px 18px;border:1px solid #405867;border-radius:8px;background:#172b38;color:#dce8f0;font:inherit;cursor:pointer}.addon-beta-dialog .addon-beta-actions button[type=submit]{background:linear-gradient(110deg,#f1d47b,#c29b37)!important;color:#101820!important;border-color:#c9a745!important;font-weight:750}.addon-beta-dialog button:disabled{opacity:.6;cursor:wait}`;
  document.head.append(style);
  const dialog = document.createElement('dialog');
  dialog.className = 'addon-beta-dialog';
  dialog.setAttribute('aria-labelledby', 'addonBetaTitle');
  dialog.innerHTML = `<form><h2 id="addonBetaTitle">GuildLoot Sync herunterladen</h2><label for="addonBetaPlatform">Download für deinen Computer</label><select id="addonBetaPlatform" required><option value="">Bitte auswählen …</option><option value="windows">Windows · Sync-Setup (.exe)</option><option value="mac-arm64">Mac mit Apple-Chip · Sync-Installer (.pkg)</option><option value="mac-x64">Mac mit Intel · Sync-Installer (.pkg)</option></select><p id="addonBetaHint">Kostenlos und ohne Download-PIN · Sync 0.3.9</p><ol class="sync-download-steps"><li>Installer herunterladen und öffnen. Eine laufende Sync-App vorher beenden.</li><li>In Sync „Vorhandenes Addon verbinden“ wählen, wenn du es über CurseForge installiert hast.</li><li>Gildenprofil mit deinem Spieler-PIN verbinden, synchronisieren und in WoW /reload eingeben.</li></ol><p class="sync-download-note">Deine vorhandenen Gildenprofile bleiben beim Update erhalten.</p><p role="status" aria-live="polite"></p><div class="addon-beta-actions"><button type="submit" class="tool-btn">Herunterladen</button><button type="button" class="tool-btn" data-close>Abbrechen</button></div></form>`;
  document.body.append(dialog);
  const status = dialog.querySelector('[role=status]'), submit = dialog.querySelector('[type=submit]');
  const platform=dialog.querySelector('select');
  const names={windows:'GuildLoot-Sync-0.3.9-Windows-Setup.exe','mac-arm64':'GuildLoot-Sync-0.3.9-mac-Apple-Silicon.pkg','mac-x64':'GuildLoot-Sync-0.3.9-mac-Intel.pkg'};
  platform.value=/Win/i.test(navigator.platform)?'windows':'';
  let controller;
  dialog.querySelector('[data-close]').onclick = () => dialog.close();
  dialog.addEventListener('close', () => { controller?.abort(); });
  dialog.addEventListener('click', event => { if(event.target === dialog){ const r=dialog.getBoundingClientRect(); if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close(); } });
  function openDownload(update = false) {
    dialog.querySelector('#addonBetaTitle').textContent = update ? 'GuildLoot Sync aktualisieren' : 'GuildLoot Sync herunterladen';
    status.textContent = ''; dialog.showModal(); platform.focus();
  }
  document.querySelectorAll('[data-addon-update]').forEach(button => { button.onclick = () => openDownload(true); });
  document.querySelectorAll('[data-addon-download]').forEach(button => { button.onclick = () => openDownload(); });
  if (new URLSearchParams(location.search).get('addonBeta') === '1') { dialog.showModal(); platform.focus(); }
  dialog.querySelector('form').addEventListener('submit', async event => {
    event.preventDefault(); if(submit.disabled)return;
    const choice=platform.value, filename=names[choice];if(!filename)return;
    submit.disabled = true; platform.disabled=true; status.textContent = 'Download wird vorbereitet. Das Installationspaket ist ca. 110–135 MB groß …'; controller = new AbortController();
    try {
      const base = typeof RAILWAY_API_URL !== 'undefined' ? RAILWAY_API_URL : location.origin;
      const response = await fetch(new URL('/api/addon-beta/download', base), {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({platform:choice}), cache:'no-store', signal:controller.signal});
      if(!response.ok){ const data = await response.json().catch(()=>({})); throw new Error(data.error || 'Download fehlgeschlagen. Bitte erneut versuchen.'); }
      const blob = await response.blob(), url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove(); setTimeout(()=>URL.revokeObjectURL(url),60000);
      status.textContent = 'Download fertig. Öffne '+filename+' in deinen Downloads und folge der Installation. GuildLoot Sync startet danach.';
    } catch(error) { if(error.name !== 'AbortError') {status.textContent = error.message;} }
    finally { submit.disabled = false; platform.disabled=false; }
  });
})();
