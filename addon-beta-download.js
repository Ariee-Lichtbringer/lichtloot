(() => {
  'use strict';
  const hosts = ['guildlootMyExport', 'guildlootDashboardExport'].map(id => document.getElementById(id)).filter(Boolean);
  if (!hosts.length) return;
  const style = document.createElement('style');
  style.textContent = `dialog.addon-beta-dialog{position:fixed;inset:0;margin:auto!important;box-sizing:border-box;width:min(520px,calc(100vw - 32px));max-width:calc(100vw - 32px);height:fit-content;max-height:calc(100vh - 32px);max-height:calc(100dvh - 32px);overflow:auto;overscroll-behavior:contain;border:1px solid #a88942;border-radius:16px;background:#101827;color:#e5edf8;padding:26px;box-shadow:0 24px 80px #0009}.addon-beta-dialog::backdrop{background:#000b}.addon-beta-dialog h2{color:#f0f4f8;font-size:24px;line-height:1.25;margin:0 0 24px}.addon-beta-dialog form{margin:0}.addon-beta-dialog #addonBetaHint{font-size:13px;line-height:1.6;color:#a9b8c6;margin:16px 0}.addon-beta-dialog label{font-size:14px}.addon-beta-dialog label{display:block;margin-bottom:8px}.addon-beta-dialog select{box-sizing:border-box;width:100%;padding:10px;margin:0 0 16px;color:#fff;background:#07101e;border:1px solid #64748b;border-radius:8px;font:inherit}.addon-beta-dialog input{box-sizing:border-box;width:100%;padding:12px;font-size:20px;letter-spacing:4px;color:#fff;background:#07101e;border:1px solid #64748b;border-radius:8px}.addon-beta-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}.addon-beta-dialog [role=status]{min-height:24px;color:#fcd34d}.addon-beta-trigger{margin:10px 0}`;
  document.head.append(style);
  const dialog = document.createElement('dialog');
  dialog.className = 'addon-beta-dialog';
  dialog.setAttribute('aria-labelledby', 'addonBetaTitle');
  dialog.innerHTML = `<form><h2 id="addonBetaTitle">GuildLoot Sync herunterladen</h2><label for="addonBetaPlatform">Download für deinen Computer</label><select id="addonBetaPlatform" required><option value="">Bitte auswählen …</option><option value="windows">Windows · Sync-Setup (.exe)</option><option value="mac-arm64">Mac mit Apple-Chip · Sync-Installer (.pkg)</option><option value="mac-x64">Mac mit Intel · Sync-Installer (.pkg)</option></select><label for="addonBetaPin">Bitte PIN eingeben</label><input id="addonBetaPin" type="password" inputmode="numeric" autocomplete="off" pattern="[0-9]{8}" minlength="8" maxlength="8" required aria-describedby="addonBetaHint" autofocus><p id="addonBetaHint">GuildLoot Sync 0.3.8 enthält Addon 0.21.2-beta. Vorhandene Gildenprofile bleiben beim Update erhalten. Lade den Installer herunter und öffne ihn anschließend. Schließe die bisherige Sync-App vor der Installation. Ist das Addon bereits über CurseForge installiert, wähle in Sync „Vorhandenes Addon verbinden“ und den Ordner GuildLootEra. Ohne CurseForge kannst du alternativ „Addon installieren / aktualisieren“ verwenden. Verwende die bisherige Beta-PIN für den Download.</p><p role="status" aria-live="polite"></p><div class="addon-beta-actions"><button type="submit" class="tool-btn">Herunterladen</button><button type="button" class="tool-btn" data-close>Abbrechen</button></div></form>`;
  document.body.append(dialog);
  const input = dialog.querySelector('input'), status = dialog.querySelector('[role=status]'), submit = dialog.querySelector('[type=submit]');
  const platform=dialog.querySelector('select');
  const names={windows:'GuildLoot-Sync-0.3.8-Windows-Setup.exe','mac-arm64':'GuildLoot-Sync-0.3.8-mac-Apple-Silicon.pkg','mac-x64':'GuildLoot-Sync-0.3.8-mac-Intel.pkg',addon:'GuildLootEra-0.21.2-beta.zip'};
  platform.value=/Win/i.test(navigator.platform)?'windows':'';
  let controller;
  dialog.querySelector('[data-close]').onclick = () => dialog.close();
  dialog.addEventListener('close', () => { controller?.abort(); input.value = ''; });
  dialog.addEventListener('click', event => { if(event.target === dialog){ const r=dialog.getBoundingClientRect(); if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close(); } });
  function openDownload(update = false) {
    dialog.querySelector('#addonBetaTitle').textContent = update ? 'GuildLoot Sync aktualisieren' : 'GuildLoot Sync herunterladen';
    status.textContent = ''; input.value = ''; dialog.showModal(); input.focus();
  }
  document.querySelectorAll('[data-addon-update]').forEach(button => { button.onclick = () => openDownload(true); });
  document.querySelectorAll('[data-addon-download]').forEach(button => { button.onclick = () => openDownload(); });
  if (new URLSearchParams(location.search).get('addonBeta') === '1') { dialog.showModal(); input.focus(); }
  dialog.querySelector('form').addEventListener('submit', async event => {
    event.preventDefault(); if(submit.disabled)return;
    const choice=platform.value, filename=names[choice];if(!filename)return;
    submit.disabled = true; platform.disabled=true; status.textContent = 'Download wird vorbereitet. Das Installationspaket ist ca. 110–135 MB groß …'; controller = new AbortController();
    try {
      const base = typeof RAILWAY_API_URL !== 'undefined' ? RAILWAY_API_URL : location.origin;
      const response = await fetch(new URL('/api/addon-beta/download', base), {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({pin:input.value,platform:choice}), cache:'no-store', signal:controller.signal});
      if(!response.ok){ const data = await response.json().catch(()=>({})); throw new Error(data.error || 'Download fehlgeschlagen. Bitte erneut versuchen.'); }
      const blob = await response.blob(), url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove(); setTimeout(()=>URL.revokeObjectURL(url),60000);
      input.value = ''; status.textContent = choice==='addon' ? 'Addon-ZIP heruntergeladen. Diese enthält kein GuildLoot Sync.' : 'Download fertig. Öffne '+filename+' in deinen Downloads und folge der Installation. GuildLoot Sync startet danach.';
    } catch(error) { if(error.name !== 'AbortError') {status.textContent = error.message; input.select();} }
    finally { submit.disabled = false; platform.disabled=false; }
  });
})();
