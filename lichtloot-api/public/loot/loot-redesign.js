/* Shared loot-page presentation; saving and Discord delivery remain server-owned. */
(() => {
  const byId = id => document.getElementById(id);
  const text = value => String(value ?? '');
  window.showPrioSavedConfirmation = (saved, participantPin = '') => {
    let dialog = byId('prioSavedDialog');
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'prioSavedDialog';
      dialog.setAttribute('aria-labelledby', 'prioSavedTitle');
      dialog.innerHTML = '<form method="dialog"><button class="prio-saved-close" aria-label="Schließen">×</button><h2 id="prioSavedTitle"><span aria-hidden="true">✓</span> Prio erfolgreich gespeichert</h2><p class="prio-saved-intro"></p><dl class="prio-saved-meta"></dl><div class="prio-saved-items"></div><p class="prio-saved-points"></p><p class="prio-saved-pin"></p><button class="prio-saved-done">Alles klar</button></form>';
      document.body.append(dialog);
      dialog.addEventListener('close', () => dialog._returnFocus?.focus());
    }
    dialog.querySelector('.prio-saved-intro').textContent = `Deine Prio für ${saved.raid} wurde erfolgreich gespeichert.`;
    const meta = dialog.querySelector('.prio-saved-meta');
    meta.replaceChildren();
    for (const [label, value] of [['Charakter', saved.player], ['Raid', saved.raid], ['Termin', [saved.date, saved.time ? `${saved.time} Uhr` : ''].filter(Boolean).join(' · ')], ['Prio-PIN', saved.prioPin]]) {
      const dt = document.createElement('dt'), dd = document.createElement('dd');
      dt.textContent = label; dd.textContent = text(value) || '–'; meta.append(dt, dd);
    }
    const items = dialog.querySelector('.prio-saved-items');
    items.replaceChildren();
    for (const prio of saved.priorities || []) {
      const row = document.createElement('div'), badge = document.createElement('b'), name = document.createElement('span');
      row.className = 'prio-saved-item'; badge.textContent = prio.label; name.textContent = prio.item;
      row.append(badge, name); items.append(row);
    }
    const points = dialog.querySelector('.prio-saved-points');
    points.hidden = !saved.p0Selected;
    points.textContent = saved.p0Selected ? `Deine aktuellen P0-Punkte für dieses Item: ${saved.points == null ? 'nicht verfügbar' : Number(saved.points).toLocaleString('de-DE')}` : '';
    const pin = dialog.querySelector('.prio-saved-pin');
    pin.hidden = !participantPin;
    pin.textContent = participantPin ? `Dein neuer Teilnehmer-PIN: ${participantPin}. Bewahre ihn für deine weiteren Anmeldungen auf.` : '';
    if (!dialog.open) {
      dialog._returnFocus = document.activeElement;
      dialog.showModal();
    }
    dialog.querySelector('.prio-saved-done').focus();
  };

  function setup() {
    document.body.classList.add('loot-redesign');
    const card = byId('prioCard');
    if (!card || card.querySelector('.loot-prio-toolbar')) return;
    const toolbar = document.createElement('div');
    toolbar.className = 'loot-prio-toolbar';
    card.prepend(toolbar);
    const title = card.querySelector('h2');
    if (title) toolbar.append(title);
    const refresh = card.querySelector('button[onclick="refreshPrios()"]');
    if (refresh) { refresh.textContent = '↻ Aktualisieren'; toolbar.append(refresh); }
    const exportButtons = card.querySelector('.prio-export-main');
    if (exportButtons) toolbar.append(exportButtons);
    const p0Heading = card.querySelector('th:nth-child(7)');
    if (p0Heading) p0Heading.textContent = 'P0 / P0+';
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();
})();
