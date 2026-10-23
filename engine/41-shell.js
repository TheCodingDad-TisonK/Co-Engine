//@ Co Engine, part 41: the shell. The ui layers, the HUD throttle and the prompt, panels, the pause menu, settings, cards, screenshots.
  // ── The page contract ─────────────────────────────────────────────
  // The engine reads these elements when they exist and does nothing when they do not: dc-start, dc-start-btn, dc-start-stats,
  // dc-start-note (the start screen); dc-hud (the HUD box) with h-prompt, h-toasts, h-feed, h-fps, h-devlink, h-edit inside it;
  // dc-panel with dc-panel-title, dc-panel-tabs, dc-panel-body, dc-panel-close; dc-menu with .dc-menu-btns, dc-menu-body,
  // dc-menu-sub and buttons carrying data-menu; and any card element a game names in showCard.
  var ui = { started: false, menuOpen: false, panelOpen: false, scanOpen: false, rebuilding: false, testing: false, rebuildPending: false, suppressMenu: false,
    blocked: function () { return ui.menuOpen || ui.panelOpen || ui.rebuilding || !!(CO.game && CO.game.blocked && CO.game.blocked()); } };
  // ── HUD ───────────────────────────────────────────────────────────
  // the HUD redraws when something set hudDirty, or every quarter second; the game fills its own fields in CO.game.hud() and the 'hud' hooks
  var hudT = 0;
  // the aiming point: a dot with a dark ring in the middle of the view, made by the engine when the page has none of its own (Depot Co
  // draws a .dc-crosshair itself), shown while the player plays and hidden behind a panel, the menu or the scene camera
  var crossEl = null, crossShown = null;
  function crosshair() {
    if (crossEl === null) { crossEl = document.querySelector('[class*="crosshair"], #crosshair') ? false : null;   /* Depot's .dc-crosshair, Grow's .g3-crosshair: a page with its own keeps it */ if (crossEl === null) { var host = $('dc-hud') || document.body, d = document.createElement('div'); d.id = 'h-cross'; d.style.cssText = 'position:fixed;left:50%;top:50%;width:6px;height:6px;margin:-3px 0 0 -3px;border-radius:50%;background:rgba(255,255,255,0.9);box-shadow:0 0 0 1.5px rgba(0,0,0,0.6),0 0 6px rgba(0,0,0,0.5);pointer-events:none;z-index:5'; host.appendChild(d); crossEl = d; } }
    if (!crossEl) return; var want = !!(ui.started && !ui.blocked() && !(photo.on && CO.game.photo !== false) && !(CO.game && CO.game.crosshair === false)); if (want !== crossShown) { crossShown = want; crossEl.style.display = want ? '' : 'none'; }
  }
  function updateHud(dt) {
    crosshair();
    hudT += dt; if (!hudDirty && hudT < 0.25) return; hudT = 0; hudDirty = false;
    if (S && !(CO.game && CO.game.hudFields === false)) { var d = $('h-day'); if (d && S.day !== undefined) d.textContent = 'Day ' + S.day + (isSunday() ? ' · Sunday' : ''); var c = $('h-clock'); if (c && S.time !== undefined) c.textContent = fmtTime(S.time); var b = $('h-cash'); if (b && S.bank !== undefined) { b.textContent = money(S.bank); b.style.color = S.bank < 0 ? 'var(--red)' : ''; } }
    if (CO.game && CO.game.hud) CO.game.hud(); uiHudFill(); runHooks('hud');
  }
  function updatePrompt() {
    var p = $('h-prompt'); if (!p) return;
    if (!focusText || (CO.game && CO.game.promptHidden && CO.game.promptHidden())) { p.hidden = true; return; }
    p.hidden = false; p.innerHTML = '<b>E</b>' + esc(focusText);
  }
  // ── Panels ────────────────────────────────────────────────────────
  // openPanel(kind, tab) shows the panel element; the game describes a kind in CO.game.panel(kind, tab) as { title, tabs: [[id, label]], body }.
  // The catalogue kind is the engine's. Buttons in a panel carry data-act and data-arg; the engine takes the catalogue's restore
  // and buy, the game takes the rest in CO.game.panelAct(act, arg). Tabs carry data-tab.
  var panel = { kind: null, tab: null };
  var panelDrag = null;
  function panelPositionLoad() {
    try { var p = JSON.parse(localStorage.getItem('co-panel-position') || 'null'); if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) { document.documentElement.style.setProperty('--panel-left', p.x + 'px'); document.documentElement.style.setProperty('--panel-top', p.y + 'px'); } } catch (e) {}
  }
  function panelDragStart(e) {
    if (!e || e.button !== 0 || e.target.closest('button, input, select, textarea, a')) return;
    var el = $('dc-panel'), r = el && el.getBoundingClientRect(); if (!r) return;
    panelDrag = { dx: e.clientX - (r.left + r.width / 2), dy: e.clientY - (r.top + r.height / 2) };
    el.style.transform = 'translate(-50%, -50%)'; el.classList.add('dragging');
    e.preventDefault();
  }
  function panelDragMove(e) {
    if (!panelDrag) return;
    var el = $('dc-panel'); if (!el) return;
    var w = el.offsetWidth, h = el.offsetHeight, x = Math.max(w / 2 + 8, Math.min(window.innerWidth - w / 2 - 8, e.clientX - panelDrag.dx)), y = Math.max(h / 2 + 8, Math.min(window.innerHeight - h / 2 - 8, e.clientY - panelDrag.dy));
    document.documentElement.style.setProperty('--panel-left', x + 'px'); document.documentElement.style.setProperty('--panel-top', y + 'px');
  }
  function panelDragEnd() {
    if (!panelDrag) return; panelDrag = null;
    var el = $('dc-panel'); if (el) el.classList.remove('dragging');
    try { var r = el.getBoundingClientRect(); localStorage.setItem('co-panel-position', JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 })); } catch (e) {}
  }
  function openPanel(kind, tab) {
    panel.kind = kind; panel.tab = tab || null; ui.panelOpen = true; var el = $('dc-panel'); if (el) el.hidden = false; if (ui.scanOpen && CO.game && CO.game.scanToggle) CO.game.scanToggle(false);
    ui.suppressMenu = true; try { document.exitPointerLock(); } catch (e) {}
    renderPanel(); sfx('click');
  }
  function closePanel() { if (!ui.panelOpen) return; ui.panelOpen = false; var el = $('dc-panel'); if (el) el.hidden = true; panel.kind = null; hudDirty = true; lockPointer(); }
  function renderPanel() {
    if (!ui.panelOpen) return;
    panelPositionLoad();
    var spec = panel.kind === 'catalogue' ? { title: 'Catalogue · build mode', tabs: [], body: catalogueHtml() } : (CO.game && CO.game.panel ? CO.game.panel(panel.kind, panel.tab) : null);
    if (!spec && panel.kind === 'npc') spec = npcPanelSpec();   /* part 47: an NPC's words and choices */
    if (!spec) spec = uiPanelSpec(panel.kind);   /* a panel the editor's UI tab described */
    if (!spec) spec = { title: panel.kind || '', tabs: [], body: '' };
    if (spec.tab && spec.tab !== panel.tab) panel.tab = spec.tab;
    var t = $('dc-panel-title'); if (t) t.textContent = spec.title || '';
    var tb = $('dc-panel-tabs'); if (tb) tb.innerHTML = (spec.tabs || []).map(function (tab) { return '<button class="' + (tab[0] === panel.tab ? 'on' : '') + '" data-tab="' + tab[0] + '">' + tab[1] + '</button>'; }).join('');
    var body = $('dc-panel-body'); if (body) body.innerHTML = spec.body || '';
  }
  function btn(act, arg, label, cls, disabled) { return '<button class="dc-btn small ' + (cls || '') + '" data-act="' + act + '" data-arg="' + esc(arg == null ? '' : arg) + '"' + (disabled ? ' disabled' : '') + '>' + label + '</button>'; }
  function panelAct(act, arg) {
    if (panel.kind === 'catalogue' && act === 'restore') { editRestore(arg); renderPanel(); return true; }
    if (panel.kind === 'catalogue' && act === 'buy') { closePanel(); editBuy(arg); return true; }   // only the catalogue's: a game's shop has a buy of its own
    if (act === 'ui') return uiPanelAct(arg);
    if (act === 'npc') return npcChoice(arg);
    if (CO.game && CO.game.panelAct && CO.game.panelAct(act, arg)) return true;
    runHooks('panelAct', act, arg); return false;
  }
  // the catalogue (C in build mode): removed props to bring back, and extras to buy, grouped as CO.game.catalogueGroups lists them
  function catalogueHtml() {
    var h = '<p>Build mode. Press <kbd>E</kbd> on a prop to carry it, <kbd>R</kbd> to turn it, <kbd>Backspace</kbd> to put it back where it started, <kbd>Del</kbd> to remove it. Bought extras sell back for half.</p>';
    var data = catalogueData(), where = function (id) { return CO.game && CO.game.propWhere ? CO.game.propWhere(id) : ''; }, open = function (d) { return CO.game && CO.game.propOpen ? CO.game.propOpen(d) : !(typeof d.lvl === 'number' && S && S.level !== undefined && S.level < d.lvl); };
    if (data.hidden.length) h += '<h3>Removed</h3><div class="dc-grid">' + data.hidden.map(function (id) { return '<div class="dc-card"><div class="body"><b>' + esc(PROPS[id].label) + '</b><small>' + esc(where(id)) + '</small></div>' + btn('restore', id, 'Bring back', 'primary') + '</div>'; }).join('') + '</div>';
    var groups = CO.game && CO.game.catalogueGroups ? CO.game.catalogueGroups : Object.keys(data.groups).map(function (k) { return [k, k.charAt(0).toUpperCase() + k.slice(1)]; });
    groups.forEach(function (gr) {
      var all = data.groups[gr[0]] || [], items = all.filter(function (id) { return open(PROPS[id]); });
      if (!items.length) { var lk = all.map(function (id) { return PROPS[id].lvl || 1; }); if (lk.length) h += '<h3>' + gr[1] + ' <small style="color:var(--muted);font-weight:normal">from level ' + Math.min.apply(null, lk) + '</small></h3>'; return; }
      h += '<h3>' + gr[1] + (gr[2] ? ' <small style="color:var(--muted);font-weight:normal">' + esc(typeof gr[2] === 'function' ? gr[2]() : gr[2]) + '</small>' : '') + '</h3><div class="dc-grid">' + items.map(function (id) { var d = PROPS[id]; return '<div class="dc-card"><div class="body"><b>' + (d.ico || '') + ' ' + esc(d.label) + '</b><small>' + esc(d.desc || '') + '</small></div><div style="text-align:right"><div class="price">' + (d.price ? money(d.price) : 'free') + '</div>' + btn('buy', id, 'Add', 'primary', !!(d.price && S && S.bank < d.price)) + '</div></div>'; }).join('') + '</div>';
    });
    return h;
  }
  // ── Pause menu ────────────────────────────────────────────────────
  function sessionFlag(name, v) { try { sessionStorage.setItem(CO.save.prefix + '-' + name, v || '1'); } catch (e) {} }
  function openMenu() {
    if (ui.menuOpen) return; ui.menuOpen = true; var m = $('dc-menu'); if (!m) return; m.hidden = false;
    var dl = $('dc-m-devlink'); if (dl) dl.textContent = devLink.on ? 'Unlink the editor' : 'Link the editor';
    var body = $('dc-menu-body'); if (body) body.hidden = true; var btns = m.querySelector('.dc-menu-btns'); if (btns) btns.hidden = false;
    if (ui.scanOpen && CO.game && CO.game.scanToggle) CO.game.scanToggle(false); ui.suppressMenu = true; try { document.exitPointerLock(); } catch (e) {}
    save(); var ms = $('dc-menu-sub'); if (ms) ms.textContent = (CO.game && CO.game.menuLine ? CO.game.menuLine() : (UI.menuLine ? uiEval(UI.menuLine) : 'The game waits until you come back.')) + ' ' + (saveT && !save.failed ? 'Saved at ' + new Date(saveT).toLocaleTimeString() + ', slot ' + BOOT_SLOT + '.' : 'The save could not be written: export it below.');
    runHooks('menuOpen');
  }
  function closeMenu() { if (!ui.menuOpen) return; ui.menuOpen = false; var m = $('dc-menu'); if (m) m.hidden = true; lockPointer(); }
  function menuBody(html) { var b = $('dc-menu-body'); if (!b) return; b.hidden = false; b.innerHTML = '<div class="dc-menu-row" style="margin:0 0 10px"><button data-menu="back" class="primary">← Back</button></div>' + html; var btns = $('dc-menu').querySelector('.dc-menu-btns'); if (btns) btns.hidden = true; }
  function menuAct(k, b) {
    sfx('click');
    if (k === 'resume') closeMenu();
    else if (k === 'back') { $('dc-menu-body').hidden = true; var btns = $('dc-menu').querySelector('.dc-menu-btns'); if (btns) btns.hidden = false; }
    else if (k === 'edit') { closeMenu(); if (!edit.on) editToggle(); }
    else if (k === 'devlink') { closeMenu(); devLinkToggle(); }
    else if (k === 'settings') menuBody(settingsHtml());
    else if (k === 'guide') menuBody('<div class="dc-how">' + (CO.game && CO.game.guideHtml ? CO.game.guideHtml() : (UI.guide ? uiTextHtml(UI.guide) : '<p>No guide yet.</p>')) + '</div>');
    else if (k === 'stats') menuBody(CO.game && CO.game.statsHtml ? CO.game.statsHtml() : '<p>No stats yet.</p>');
    else if (k === 'saves') menuBody('<p style="color:var(--muted)">This save as text. Copy it somewhere safe, or paste one in and load it.</p><textarea class="dc-ta" id="dc-save-ta">' + esc(JSON.stringify(S)) + '</textarea><div class="dc-menu-row"><button data-menu="download">⬇ Download .json</button><button data-menu="import" class="primary">Load what is pasted</button></div>');
    else if (k === 'download') { var blob = new Blob([JSON.stringify(S)], { type: 'application/json' }); var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = CO.save.prefix + '-slot' + BOOT_SLOT + (S.day !== undefined ? '-day' + S.day : '') + '.json'; a.click(); }
    else if (k === 'import') { try { var s = JSON.parse($('dc-save-ta').value); if (!s || typeof s !== 'object' || (CO.game && CO.game.saveLooksRight && !CO.game.saveLooksRight(s))) throw new Error('not a save'); wiped = true; localStorage.setItem(SAVE, JSON.stringify(s)); sessionFlag('skip-splash'); sessionFlag('autoplay'); location.reload(); } catch (err) { toast('That is not a save of this game.', 'bad'); } }   // wiped: the unload autosave must not write the old game back over the import
    else if (k === 'reset') { if (b && b.getAttribute('data-sure') !== '1') { b.setAttribute('data-sure', '1'); b.textContent = 'Really reset slot ' + BOOT_SLOT + '? Click again'; setTimeout(function () { b.removeAttribute('data-sure'); b.textContent = '⟲ Reset this save'; }, 3000); return; } wipe(); sessionFlag('skip-splash'); location.reload(); }
    else if (k === 'quit') { save(); sessionFlag('skip-splash'); location.reload(); }
    else if (k.indexOf('page:') === 0) menuBody(menusPageHtml(k.slice(5)));
    else if (k.indexOf('mm:') === 0) menusPauseAct(+k.slice(3), b);
    else if (CO.game && CO.game.menu) CO.game.menu(k, b);
  }
  // ── Settings ──────────────────────────────────────────────────────
  function settingsHtml() {
    if (MENUS.settings) return '<div class="dc-form">' + menusSettingRows() + (CO.game && CO.game.settingsHtml ? CO.game.settingsHtml() : '') + '</div>';   // part 46: the settings the menu maker chose
    return '<div class="dc-form">' +
      '<label><span>Mouse sensitivity</span><input type="range" min="0.3" max="2.5" step="0.1" value="' + SET.sens + '" data-set="sens"></label>' +
      '<label><span>Invert Y</span><input type="checkbox" ' + (SET.invertY ? 'checked' : '') + ' data-set="invertY"></label>' +
      '<label><span>Field of view</span><input type="range" min="60" max="100" step="1" value="' + SET.fov + '" data-set="fov"></label>' +
      '<label><span>Head bob while walking</span><input type="checkbox" ' + (SET.bob !== false ? 'checked' : '') + ' data-set="bob"></label>' +
      '<label><span>Quality</span><select data-set="quality"><option value="high"' + (SET.quality === 'high' ? ' selected' : '') + '>High</option><option value="medium"' + (SET.quality === 'medium' ? ' selected' : '') + '>Medium</option><option value="low"' + (SET.quality === 'low' ? ' selected' : '') + '>Low (no shadows)</option></select></label>' +
      '<label><span>Sound</span><input type="checkbox" ' + (SET.sound ? 'checked' : '') + ' data-set="sound"></label>' +
      '<label><span>Volume</span><input type="range" min="0" max="1" step="0.05" value="' + SET.vol + '" data-set="vol"></label>' +
      '<label><span>Film look (vignette, grain)</span><input type="checkbox" ' + (SET.film !== false ? 'checked' : '') + ' data-set="film"></label>' +
      '<label><span>Show FPS (F3)</span><input type="checkbox" ' + (SET.fps ? 'checked' : '') + ' data-set="fps"></label>' +
      (CO.game && CO.game.settingsHtml ? CO.game.settingsHtml() : '') +
      '</div>';
  }
  function settingInput(el) {
    var k = el.getAttribute('data-set'); if (!k) return;
    var v = el.type === 'checkbox' ? el.checked : el.tagName === 'SELECT' ? el.value : +el.value;
    if (!(k in SET)) { if (CO.game && CO.game.setting) CO.game.setting(k, v); hudDirty = true; return; }
    SET[k] = v; saveSettings(); applySettings(); if (menusCustomKey(k) && CO.game && CO.game.setting) CO.game.setting(k, v);
  }
  function applySettings() {
    if (!renderer) return;
    camera.fov = SET.fov; camera.updateProjectionMatrix(); post.on = SET.film !== false;
    var pr = SET.quality === 'high' ? Math.min(window.devicePixelRatio || 1, 2) : SET.quality === 'medium' ? 1 : 0.75;
    renderer.setPixelRatio(pr); renderer.shadowMap.enabled = SET.quality !== 'low'; if (sun) sun.castShadow = SET.quality !== 'low'; lightBudget.n = SET.quality === 'high' ? (CO.cfg.lightBudget || 16) : SET.quality === 'medium' ? 10 : 6;
    var big = CO.cfg && CO.cfg.sun && CO.cfg.sun.mapSize || 4096, sm = SET.quality === 'high' ? big : Math.min(big, 2048); if (sun && sun.shadow.mapSize.x !== sm) { sun.shadow.mapSize.set(sm, sm); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    if (sky.rain) { var rn = SET.quality === 'high' ? sky.rainN : SET.quality === 'medium' ? Math.round(sky.rainN * 0.64) : Math.round(sky.rainN * 0.36), snn = SET.quality === 'high' ? sky.snowN : SET.quality === 'medium' ? Math.round(sky.snowN * 0.66) : Math.round(sky.snowN * 0.4); CO.rainN = rn; CO.snowN = snn; sky.rain.geometry.setDrawRange(0, rn); sky.snow.geometry.setDrawRange(0, snn); }
    if (applySettings.q !== SET.quality) { applySettings.q = SET.quality; scene.traverse(function (o) { if (o.material && o.material.needsUpdate !== undefined) o.material.needsUpdate = true; }); }   // only a quality change recompiles the shaders
    shadowDirty = true; var f = $('h-fps'); if (f) f.hidden = !SET.fps; if (sfxBus) sfxBus.gain.value = SET.vol;
    runHooks('settings', SET);
  }
  function screenshot() {
    try { renderFrame(0.016); canvas.toBlob(function (b) { if (!b) return; var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = (CO.save ? CO.save.prefix : 'co') + '-' + Date.now() + '.png'; a.click(); toast('Screenshot saved' + (/Electron/.test(navigator.userAgent) ? ' to Pictures' : ''), 'good'); }, 'image/png'); } catch (e) {}
  }
  // ── Cards: a timed overlay any key dismisses (a level card, a day report) ──
  var cards = {};
  function showCard(id, html, seconds) { var el = $(id); if (!el) return; el.innerHTML = html; el.hidden = false; cards[id] = seconds || 12; }
  function hideCard(id) { var el = $(id); if (el && !el.hidden) el.hidden = true; delete cards[id]; }
  function hideCards() { for (var id in cards) hideCard(id); }
  function tickCards(dt) { for (var id in cards) { cards[id] -= dt; if (cards[id] <= 0) hideCard(id); } }
  // ── Binding the page ──────────────────────────────────────────────
  function coSetupShell() {
    menusPageReady();   // part 46
    var pc = $('dc-panel-close'); if (pc) pc.addEventListener('click', closePanel);
    var pn = $('dc-panel'); if (pn) {
      panelPositionLoad();
      var ph = pn.querySelector('header'); if (ph && !ph.__coPanelDrag) { ph.__coPanelDrag = true; ph.addEventListener('pointerdown', panelDragStart); }
      if (!window.__coPanelDragBound) { window.__coPanelDragBound = true; window.addEventListener('pointermove', panelDragMove); window.addEventListener('pointerup', panelDragEnd); window.addEventListener('pointercancel', panelDragEnd); }
      pn.addEventListener('click', function (e) { var tb = e.target.closest('[data-tab]'); if (tb) { panel.tab = tb.getAttribute('data-tab'); renderPanel(); sfx('click'); return; } var b = e.target.closest('[data-act]'); if (!b || b.disabled) return; panelAct(b.getAttribute('data-act'), b.getAttribute('data-arg')); });
    }
    var mn = $('dc-menu'); if (mn) mn.addEventListener('click', function (e) { var b = e.target.closest('[data-menu]'); if (!b) return; menuAct(b.getAttribute('data-menu'), b); });
    var mb = $('dc-menu-body'); if (mb) mb.addEventListener('input', function (e) { settingInput(e.target); });
  }
