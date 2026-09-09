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

  function setupSelection() {
    const loot = byId('lootCard');
    if (!loot || byId('lootOwnSelection')) return;
    const panel = document.createElement('section');
    panel.id = 'lootOwnSelection';
    panel.setAttribute('aria-labelledby', 'lootOwnSelectionTitle');
    panel.innerHTML = '<h3 id="lootOwnSelectionTitle">Deine Auswahl</h3><div class="loot-selection-rows"></div><p>Rechtsklick auf eine aktive Prio oder × entfernt die Auswahl. Änderungen mit „Prios speichern“ übernehmen.</p>';
    loot.querySelector('.search-box').before(panel);
    const saveArea = loot.querySelector('.loot-save-area');
    if (saveArea) panel.after(saveArea);
    const saveStatus = byId('prioSaveStatus');
    if (saveArea && saveStatus) saveArea.after(saveStatus);

    function values() {
      return ['p1', 'p2', 'p3'].map(key => ({ key, item: byId(key)?.value || '', id: window.getSelectedPrioItemId?.(key) || '' }));
    }
    function p0Mode(items) {
      return Boolean(window.p0WasClicked || window.p0PlusWasClicked) && items[0].item && items.every(item => item.item === items[0].item);
    }
    function matches(button, items) {
      const slot = button.dataset.prio;
      const item = items.find(item => item.key === slot) || items[0];
      if (!item.item || item.item !== button.dataset.item) return false;
      if (button.dataset.itemId && item.id && button.dataset.itemId !== String(item.id)) return false;
      if (slot === 'p0' || slot === 'p0plus') return p0Mode(items) && (slot === 'p0plus' ? Boolean(window.p0PlusWasClicked) : !window.p0PlusWasClicked);
      return ['p1', 'p2', 'p3'].includes(slot);
    }
    let previous = '';
    function render() {
      const items = values();
      const p0 = p0Mode(items);
      const levels = typeof window.eraPriorityLevels === 'function' ? window.eraPriorityLevels() : items.map(item => ({ key: item.key, label: item.key.toUpperCase(), enabled: true }));
      const rows = p0 ? [{ ...items[0], key: window.p0PlusWasClicked ? 'p0plus' : 'p0', label: window.p0PlusWasClicked ? 'P0+' : 'P0' }]
        : levels.filter(level => level.enabled).map(level => ({ ...items.find(item => item.key === level.key), label: level.label }));
      const signature = JSON.stringify(rows);
      if (signature !== previous) {
        previous = signature;
        const list = panel.querySelector('.loot-selection-rows');
        list.replaceChildren();
        rows.forEach(item => {
          const row = document.createElement('div'), label = document.createElement('b'), name = document.createElement('div'), remove = document.createElement('button');
          row.className = 'loot-selection-row'; label.textContent = item.label;
          name.className = 'loot-selection-name';
          if (item.item && typeof window.ownClosedPrioItemHtml === 'function') name.innerHTML = window.ownClosedPrioItemHtml(item.item, item.id);
          else name.textContent = item.item || 'Noch kein Item gewählt';
          remove.type = 'button'; remove.textContent = '×'; remove.disabled = !item.item;
          remove.setAttribute('aria-label', `${item.label} entfernen`); remove.dataset.clearPrio = item.key;
          row.append(label, name, remove); list.append(row);
        });
      }
      loot.querySelectorAll('.mini-btn[data-prio]').forEach(button => {
        if (matches(button, items) && !button.disabled) {
          button.title = 'Rechtsklick: diese Auswahl entfernen'; button.dataset.selectionRemovable = 'true';
        } else if (button.dataset.selectionRemovable) {
          if (button.title === 'Rechtsklick: diese Auswahl entfernen') button.removeAttribute('title');
          delete button.dataset.selectionRemovable;
        }
      });
    }
    function clear(slot) {
      const keys = slot === 'p0' || slot === 'p0plus' ? ['p1', 'p2', 'p3'] : [slot];
      if (!keys.every(key => ['p1', 'p2', 'p3'].includes(key))) return;
      keys.forEach(key => {
        const select = byId(key);
        if (select) { select.value = ''; select.selectedIndex = [...select.options].findIndex(option => option.value === ''); }
        window.setSelectedPrioItemId?.(key, '');
        if (byId(key + 'ItemId')) byId(key + 'ItemId').value = '';
      });
      window.p0WasClicked = false; window.p0PlusWasClicked = false;
      window.lastSavedPrioSignature = ''; window.prioDraftDirty = true;
      // Persist the empty slot before older button renderers can restore a cached draft.
      window.autoSaveDraft?.();
      window.manualSelectChanged?.();
      window.renderCurrentPrios?.();
      const status = window.getPrioSaveStatus?.();
      if (status) status.textContent = 'Auswahl geändert. Wähle dein neues Item und speichere die Prios erneut.';
      render();
    }
    panel.addEventListener('click', event => {
      const button = event.target.closest('[data-clear-prio]');
      if (button && !button.disabled) clear(button.dataset.clearPrio);
    });
    loot.addEventListener('contextmenu', event => {
      const button = event.target.closest('.mini-btn[data-prio]');
      if (!button || button.disabled || !matches(button, values())) return;
      event.preventDefault(); clear(button.dataset.prio);
    });
    let queued = false;
    function scheduleRender() {
      if (queued) return;
      queued = true; queueMicrotask(() => { queued = false; render(); });
    }
    ['renderSelectedPrioPreviews', 'updateActiveButtons'].forEach(key => {
      const original = window[key];
      if (typeof original !== 'function') return;
      window[key] = function(...args) { const result = original.apply(this, args); scheduleRender(); return result; };
    });
    ['p1', 'p2', 'p3'].forEach(key => {
      const select = byId(key);
      if (select) { select.addEventListener('change', scheduleRender); new MutationObserver(scheduleRender).observe(select, { childList: true, subtree: true }); }
    });
    render();
  }

  function setup() {
    document.body.classList.add('loot-redesign');
    setupSelection();
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
