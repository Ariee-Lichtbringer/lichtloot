/* Extend the existing staff attendance view only for the Nachtwächter guild. */
(function () {
  if (typeof CURRENT_GUILD_SLUG === 'undefined' || CURRENT_GUILD_SLUG !== 'nachtloot') return;
  const tabs = [
    {key:'zg', label:'ZG gesamt', detail:'Alle ZG-Priolisten'},
    {key:'zg-mittwoch', label:'ZG Mittwoch / Standard', detail:'GuildLoot-Priolisten'},
    {key:'zg-prime', label:'ZG Prime', detail:'GuildLoot-Priolisten'},
    {key:'zg-late', label:'ZG Late', detail:'GuildLoot-Priolisten'}
  ];
  RAID_HELPER_ATTENDANCE_TABS.push(...tabs);
  const keys = new Set(tabs.map(tab => tab.key));
  const counts = new Map();
  const originalTabs = window.renderRaidHelperAttendanceTabs;
  const originalLoad = window.loadRaidHelperAttendance;
  window.renderRaidHelperAttendanceTabs = function () {
    originalTabs();
    const buttons = document.querySelectorAll('#raidHelperAttendanceTabs button');
    buttons.forEach((button, index) => {
      const key = RAID_HELPER_ATTENDANCE_TABS[index]?.key;
      if (keys.has(key)) button.querySelector('.raid-helper-meta-pill').textContent = counts.get(key) ?? 'Prioliste';
    });
    const subtitle = document.querySelector('#raidHelperTab-attendance .raid-helper-view-head > div > span');
    if (subtitle) subtitle.textContent = keys.has(raidHelperAttendanceRaidKey)
      ? 'ZG-Teilnahme aus gespeicherten GuildLoot-Priolisten · unabhängig von Warcraft Logs und PO+-Transfer'
      : 'Teilnahme aus Priolisten mit übertragener PO+‑Punktevergabe';
  };
  window.loadRaidHelperAttendance = async function () {
    const key = raidHelperAttendanceRaidKey;
    if (!keys.has(key)) return originalLoad();
    window.renderRaidHelperAttendanceTabs();
    const box = document.getElementById('raidHelperAttendanceBox');
    const masterCode = document.getElementById('masterCode')?.value.trim();
    if (!masterCode) {
      box.innerHTML = '<div class="raid-helper-loading">Bitte zuerst mit dem Gilden-Mastercode anmelden.</div>';
      return;
    }
    box.innerHTML = '<div class="raid-helper-loading">ZG-Priolisten werden ausgewertet …</div>';
    try {
      const result = await railwayApi({action:'guildGetZgPrioAttendance', masterCode, raidKey:key, t:Date.now()});
      if (!result.success) throw new Error(result.error || 'ZG-Priolisten konnten nicht geladen werden.');
      counts.set(key, result.raidCount);
      if (raidHelperAttendanceRaidKey !== key) return;
      window.renderRaidHelperAttendanceTabs();
      renderZgPrioAttendance(result, box);
    } catch (error) {
      if (raidHelperAttendanceRaidKey !== key) return;
      box.innerHTML = `<div class="status bad">${escapeHtml(error.message || 'ZG-Attendance konnte nicht geladen werden.')} Bitte erneut aktualisieren.</div>`;
    }
  };

  function renderZgPrioAttendance(result, box) {
    const rows = result.rows || [];
    const players = new Map();
    rows.forEach(entry => entry.signups.forEach(signup => {
      const key = signup.characterId || `${signup.player.toLowerCase()}|${signup.server || ''}`;
      if (!players.has(key)) players.set(key, {...signup, cells:new Map()});
      players.get(key).cells.set(entry.raid.id, signup.status);
    }));
    const signed = player => [...player.cells.values()].filter(status => status === 'signed').length;
    const bench = player => [...player.cells.values()].filter(status => status === 'bench').length;
    const names = [...players.values()].sort((a,b) => signed(b)-signed(a) || a.player.localeCompare(b.player,'de') || a.server.localeCompare(b.server,'de'));
    const labels = {'zg':'ZG Standard', 'zg-mittwoch':'ZG Mittwoch', 'zg-prime':'ZG Prime', 'zg-late':'ZG Late'};
    const note = `<div class="status" style="margin:10px">Quelle: GuildLoot-Priolisten · seit ${escapeHtml(formatRaidDate(result.since))} · ${rows.length} Raids · ${Number(result.participationCount || 0)} Teilnahmen.<br><small>Ein Priolisteneintrag zählt als Teilnahme, Bench separat als B. Termine zählen ab dem Folgetag (Europe/Berlin). Leere Priolisten und abgesagte Raids werden nicht gewertet. Korrekturen an Priolisten werden beim Aktualisieren übernommen.</small></div>`;
    if (!rows.length) {
      box.innerHTML = note + '<div class="raid-helper-loading">Für diesen ZG-Bereich sind noch keine vergangenen Priolisten vorhanden.</div>';
      return;
    }
    const head = rows.map(({raid}) => `<th title="${escapeAttr(raid.raidName || labels[raid.raid])}">${escapeHtml(labels[raid.raid] || 'ZG')}<br><span class="muted">${escapeHtml(formatRaidDate(raid.raidDate))}<br>${escapeHtml(raid.raidTime || '')}</span></th>`).join('');
    const body = names.map(player => {
      const cells = rows.map(({raid}) => {
        const status = player.cells.get(raid.id) || '';
        const title = status === 'signed' ? 'Teilnahme laut GuildLoot-Prioliste' : status === 'bench' ? 'Bench laut GuildLoot-Prioliste' : 'Kein Eintrag in dieser Prioliste';
        return `<td class="raid-helper-attendance-cell ${status}" title="${title}">${status === 'signed' ? '✓' : status === 'bench' ? 'B' : '–'}</td>`;
      }).join('');
      return `<tr><td>${escapeHtml(player.player)}<br><span class="muted">${escapeHtml([player.className, player.server].filter(Boolean).join(' · '))}</span></td><td>${Math.round(signed(player)*100/rows.length)} %<br><span class="muted">${signed(player)}/${rows.length}${bench(player) ? ` · ${bench(player)} B` : ''}</span></td>${cells}</tr>`;
    }).join('');
    box.innerHTML = note + `<table class="raid-helper-attendance-table"><thead><tr><th>Charakter</th><th>Att.%</th>${head}</tr></thead><tbody>${body}</tbody></table>`;
  }
})();
