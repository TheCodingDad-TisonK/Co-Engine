//@ Co Engine, part 46: menus as data. CO.menus({ theme, start, pause, settings, pages }) describes the start screen, the pause menu, the settings and text pages a button opens, and the engine draws them into the page's dc-start and dc-menu. The editor's Menus tab edits it with a live preview and writes src/00-menus.js. A section left out keeps the page's own markup, so a game opts in a screen at a time.
  // ── Menus as data ─────────────────────────────────────────────────
  // theme:    { accent, panel, text, muted, font, radius, dim, align: 'center' | 'left', width, layout: 'stack' | 'row', image }
  // start:    { title, subtitle, logo, chips, note, keepPage, buttons: [{ label, action, primary }] }   image (in theme) is the backdrop;
  //           keepPage (on unless false) keeps what else the page's start card held under the buttons: a disclaimer, support links
  // pause:    { title, line, buttons: [{ label, action, primary }] }
  // settings: { hide: ['fov', ...], custom: [{ key, label, type: 'toggle' | 'slider' | 'select', min, max, step, options, value }] }
  // pages:    { name: { title, text } }                                   text is paragraphs and '- ' lists, as in the UI tab
  // An action is one of the engine's: on the start screen play, new, settings, guide, slots, quit; in the pause menu resume,
  // settings, guide, stats, saves, edit, devlink, reset, quit; on both 'page <name>'. Anything else is a dev command or an
  // expression over the kit, as a UI panel button's is. A custom setting lives in SET with the engine's (SET.difficulty), is
  // kept with them, and reaches GAME.setting(key, value) and the 'settings' hook when it changes; setting(key) reads one.
  var MENUS = { theme: {}, start: null, pause: null, settings: null, pages: {} }, menusPageExtra = null;
  var MENU_THEME = { accent: '#f5b53d', panel: '#121a24', text: '#eef1f5', muted: '#a0acb8', font: 'Bahnschrift, "Segoe UI", Arial, sans-serif', radius: 12, dim: 0.72, align: 'center', width: 440, layout: 'stack', image: '' };
  var MENU_SETTINGS = [['sens', 'Mouse sensitivity'], ['invertY', 'Invert Y'], ['fov', 'Field of view'], ['bob', 'Head bob while walking'], ['quality', 'Quality'], ['sound', 'Sound'], ['vol', 'Volume'], ['film', 'Film look (vignette, grain)'], ['fps', 'Show FPS (F3)']];
  var MENU_ACTIONS = { start: ['play', 'new', 'settings', 'guide', 'slots', 'quit'], pause: ['resume', 'settings', 'guide', 'stats', 'saves', 'edit', 'devlink', 'reset', 'quit'] };
  CO.menus = function (data) {
    if (data === undefined) return menusData();
    data = JSON.parse(JSON.stringify(data || {}));
    MENUS = { theme: data.theme || {}, start: data.start || null, pause: data.pause || null, settings: data.settings || null, pages: data.pages || {} };
    if (SET) menusSettingDefaults();
    menusRender(); return menusData();
  };
  function menusOn() { return !!(MENUS.start || MENUS.pause || MENUS.settings); }
  function menusData() { return JSON.parse(JSON.stringify(MENUS)); }
  function setting(key) { return SET ? SET[key] : undefined; }
  function menusTheme() { var t = {}, k; for (k in MENU_THEME) t[k] = MENU_THEME[k]; for (k in MENUS.theme || {}) if (MENUS.theme[k] !== '' && MENUS.theme[k] !== null && MENUS.theme[k] !== undefined) t[k] = MENUS.theme[k]; return t; }
  // a custom setting's starting value, put in SET before the saved settings load so they keep it
  function menusSettingDefaults() { ((MENUS.settings && MENUS.settings.custom) || []).forEach(function (c) { if (!c || !c.key || (c.key in SET)) return; SET[c.key] = c.value !== undefined ? c.value : c.type === 'toggle' ? false : c.type === 'slider' ? (c.min || 0) : (c.options && c.options[0]) || ''; }); }
  function menusRgba(hex, a) { var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '')); if (!m) return 'rgba(245,181,61,' + a + ')'; var n = parseInt(m[1], 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; }
  function menusStyle() {
    var t = menusTheme(), el = $('co-mm-style'); if (!el) { el = document.createElement('style'); el.id = 'co-mm-style'; document.head.appendChild(el); }
    var r = Math.max(0, +t.radius || 0), br = Math.max(0, r - 4), dim = 'rgba(5,8,12,' + (+t.dim) + ')', left = t.align === 'left';
    el.textContent = '.co-mm { --panel: ' + t.panel + '; --text: ' + t.text + '; --muted: ' + t.muted + '; --amber: ' + t.accent + '; --line: rgba(255,255,255,0.1); font-family: ' + t.font + '; color: var(--text); }' +
      '#dc-start.co-mm { background: ' + (t.image ? 'linear-gradient(' + dim + ',' + dim + '), url("' + String(t.image).replace(/"/g, '') + '") center / cover no-repeat' : dim) + '; justify-content: ' + (left ? 'flex-start' : 'center') + '; ' + (left ? 'padding-left: 7vw;' : '') + ' }' +
      '#dc-menu.co-mm { background: ' + dim + '; justify-content: ' + (left ? 'flex-start' : 'center') + '; ' + (left ? 'padding-left: 7vw;' : '') + ' }' +
      '.co-mm .co-mm-card { background: var(--panel); border: 1px solid var(--line); border-radius: ' + r + 'px; padding: 26px 30px; width: min(' + (+t.width || 440) + 'px, 92vw); max-width: none; min-width: 0; max-height: 88vh; overflow: auto; box-sizing: border-box; text-align: ' + (left ? 'left' : 'center') + '; box-shadow: 0 18px 60px rgba(0,0,0,0.45); }' +
      '.co-mm .co-mm-logo { max-width: 60%; max-height: 120px; margin: 0 0 10px; }' +
      '.co-mm h1.co-mm-title { margin: 0 0 4px; font-size: 32px; letter-spacing: 0.02em; } .co-mm h2.co-mm-title { margin: 0 0 4px; font-size: 22px; }' +
      '.co-mm .co-mm-subtitle { margin: 0 0 6px; color: var(--muted); font-size: 15px; }' +
      '.co-mm #dc-start-stats { display: flex; gap: 6px; flex-wrap: wrap; justify-content: ' + (left ? 'flex-start' : 'center') + '; margin: 10px 0 0; } .co-mm #dc-start-stats span { background: rgba(255,255,255,0.06); border: 1px solid var(--line); border-radius: ' + br + 'px; padding: 3px 9px; font-size: 12.5px; }' +
      '.co-mm .co-mm-btns { display: flex; flex-direction: ' + (t.layout === 'row' ? 'row' : 'column') + '; flex-wrap: wrap; gap: 8px; margin-top: 16px; justify-content: ' + (left ? 'flex-start' : 'center') + '; }' +
      '.co-mm .co-mm-btns button, .co-mm .co-mm-body button { padding: 10px 16px; margin: 0; border: 1px solid var(--line); border-radius: ' + br + 'px; background: rgba(255,255,255,0.06); color: var(--text); font: inherit; font-size: 15px; cursor: pointer; text-align: inherit; }' +
      '.co-mm .co-mm-btns button:hover, .co-mm .co-mm-body button:hover { border-color: ' + menusRgba(t.accent, 0.7) + '; }' +
      '.co-mm button.primary { background: ' + menusRgba(t.accent, 0.16) + '; border-color: ' + menusRgba(t.accent, 0.5) + '; color: var(--amber); }' +
      '.co-mm .co-mm-body { margin-top: 14px; text-align: left; } .co-mm .co-mm-body .dc-form label { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 6px 0; border-bottom: 1px solid var(--line); }' +
      '.co-mm .co-mm-extra { margin-top: 16px; text-align: left; }' +
      '.co-mm .co-mm-slot { display: flex; justify-content: space-between; align-items: center; gap: 10px; width: 100%; box-sizing: border-box; } .co-mm .co-mm-slot small { color: var(--muted); }';
  }
  function menusButtons(list, attr) { return (list || []).map(function (b, i) { return '<button ' + attr + '="' + i + '"' + (b.primary ? ' class="primary"' : '') + '>' + esc(b.label || 'Button') + '</button>'; }).join(''); }
  function menusRender() {
    if (typeof document === 'undefined' || !document.body) return;
    menusStyle();
    var st = $('dc-start');
    if (MENUS.start) {
      if (!st) { st = document.createElement('div'); st.id = 'dc-start'; st.className = 'dc-overlay'; document.body.appendChild(st); }
      if (menusPageExtra === null) menusPageExtra = menusExtraOf(st);   // once, from the page's own card, before it is drawn over
      var s = MENUS.start, keepStats = $('dc-start-stats'), keepNote = $('dc-start-note'), stats = keepStats ? keepStats.innerHTML : '', note = keepNote ? keepNote.textContent : '';
      st.classList.add('co-mm'); st.classList.remove('dim');
      st.innerHTML = '<div class="co-mm-card">' + (s.logo ? '<img class="co-mm-logo" src="' + esc(s.logo) + '" alt="">' : '') + '<h1 class="co-mm-title">' + esc(s.title || document.title || 'A new game') + '</h1>' + (s.subtitle ? '<p class="co-mm-subtitle">' + esc(s.subtitle) + '</p>' : '') +
        '<p id="dc-start-stats"' + (s.chips === false ? ' hidden' : '') + '>' + stats + '</p><p id="dc-start-note" class="dc-sub"' + (s.note === false ? ' hidden' : '') + '>' + esc(note) + '</p>' +
        '<div class="co-mm-btns" id="co-mm-start-btns">' + menusButtons(s.buttons, 'data-start') + '</div><div class="co-mm-body" id="co-mm-start-body" hidden></div>' + (s.keepPage !== false && menusPageExtra ? '<div class="co-mm-extra">' + menusPageExtra + '</div>' : '') + '</div>';
      if (st.hasAttribute('data-co-menus')) st.style.visibility = '';
      if (!st.coMenusBound) { st.coMenusBound = true; st.addEventListener('click', menusStartClick); st.addEventListener('input', function (e) { settingInput(e.target); }); }
    } else if (st) st.classList.remove('co-mm');
    var mn = $('dc-menu');
    if (MENUS.pause && mn) {
      var p = MENUS.pause, line = $('dc-menu-sub');
      mn.classList.add('co-mm'); mn.classList.remove('dim');
      mn.innerHTML = '<div class="dc-menu-card co-mm-card"><h2 class="co-mm-title">' + esc(p.title || 'Paused') + '</h2><p class="dc-sub" id="dc-menu-sub"' + (p.line === false ? ' hidden' : '') + '>' + (line ? esc(line.textContent) : '') + '</p>' +
        '<div class="dc-menu-btns co-mm-btns">' + (p.buttons || []).map(function (b, i) { var a = String(b.action || '').trim(), key = MENU_ACTIONS.pause.indexOf(a) >= 0 ? a : /^page\s+\S/.test(a) ? 'page:' + a.slice(5).trim() : 'mm:' + i; return '<button data-menu="' + esc(key) + '"' + (key === 'devlink' ? ' id="dc-m-devlink"' : '') + (b.primary ? ' class="primary"' : '') + '>' + esc(b.label || 'Button') + '</button>'; }).join('') + '</div>' +
        '<div id="dc-menu-body" class="co-mm-body" hidden></div></div>';
      var body = $('dc-menu-body'); if (body && !body.coMenusBound) { body.coMenusBound = true; body.addEventListener('input', function (e) { settingInput(e.target); }); }
    } else if (mn) mn.classList.remove('co-mm');
  }
  // what the page's start card holds besides its title, subtitle, chips, note and start button: kept under the made start screen
  function menusExtraOf(st) {
    var card = st.querySelector('.card') || st.firstElementChild; if (!card || card.classList.contains('co-mm-card')) return '';
    var out = ''; Array.prototype.forEach.call(card.children, function (el, i) { if (/^H[12]$/.test(el.tagName) || el.id === 'dc-start-stats' || el.id === 'dc-start-note' || el.id === 'dc-start-btn' || el.querySelector('#dc-start-btn') || (i < 3 && el.classList.contains('dc-sub') && !el.id)) return; out += el.outerHTML; }); return out;
  }
  // the page's start card was told to wait for the made one (data-co-menus); with no start screen made, it shows itself
  function menusPageReady() { var st = $('dc-start'); if (st && st.hasAttribute('data-co-menus') && !MENUS.start) st.style.visibility = ''; }
  // the editor's menu-first: the game waits at its start screen as a player sees it
  function menusAtMenu() { var st = $('dc-start'); if (st) { st.hidden = false; if (st.hasAttribute('data-co-menus')) st.style.visibility = ''; } return !ui.started; }
  // the start screen's own body: settings, a page, the guide or the slots, with a way back to the buttons
  function menusStartBody(html) { var b = $('co-mm-start-body'), bs = $('co-mm-start-btns'); if (!b) return; if (html === null) { b.hidden = true; if (bs) bs.hidden = false; return; } b.innerHTML = '<div style="margin:0 0 10px"><button data-start-back="1" class="primary">← Back</button></div>' + html; b.hidden = false; if (bs) bs.hidden = true; }
  function menusPageHtml(name) { var pg = MENUS.pages && MENUS.pages[name]; return pg ? (pg.title ? '<h3 style="margin:0 0 8px">' + esc(pg.title) + '</h3>' : '') + '<div class="dc-how">' + uiTextHtml(pg.text) + '</div>' : '<p>No page called ' + esc(name) + '.</p>'; }
  function menusSlotsHtml() {
    var n = (CO.cfg && CO.cfg.slots) || 3, h = '<p class="dc-sub" style="margin:0 0 8px">Each slot is a game of its own.</p>';
    for (var i = 1; i <= n; i++) { var info = 'empty'; try { var raw = localStorage.getItem(CO.save.prefix + '-slot' + i), sv = raw ? JSON.parse(raw) : null; if (sv) info = (sv.day !== undefined ? 'Day ' + sv.day : 'saved') + (sv.savedAt ? ' · ' + new Date(sv.savedAt).toLocaleDateString() : ''); } catch (e) {} h += '<div style="margin:0 0 6px"><button class="co-mm-slot' + (i === BOOT_SLOT ? ' primary' : '') + '" data-start-slot="' + i + '"><b>Slot ' + i + (i === BOOT_SLOT ? ' (this one)' : '') + '</b><small>' + esc(info) + '</small></button></div>'; }
    return h;
  }
  function menusStartClick(e) {
    var back = e.target.closest('[data-start-back]'), slot = e.target.closest('[data-start-slot]'), b = e.target.closest('[data-start]');
    if (back) { sfx('click'); menusStartBody(null); return; }
    if (slot) { var n = +slot.getAttribute('data-start-slot'); sfx('click'); if (n === BOOT_SLOT) { menusStartBody(null); return; } if (ui.started) save(); setSlot(n); sessionFlag('skip-splash'); location.reload(); return; }
    if (!b || !MENUS.start) return; var btn = (MENUS.start.buttons || [])[+b.getAttribute('data-start')]; if (!btn) return;
    menusStartAct(String(btn.action || '').trim(), b);
  }
  function menusStartAct(a, el) {
    sfx('click');
    if (a === 'play' || a === '') { if (ui.started) { var st = $('dc-start'); if (st) st.hidden = true; return; } enter(); return; }
    if (a === 'new') { if (el && el.getAttribute('data-sure') !== '1') { var was = el.textContent; el.setAttribute('data-sure', '1'); el.textContent = 'Start over in slot ' + BOOT_SLOT + '? Click again'; setTimeout(function () { el.removeAttribute('data-sure'); el.textContent = was; }, 3000); return; } wipe(); sessionFlag('skip-splash'); sessionFlag('autoplay'); location.reload(); return; }
    if (a === 'settings') { menusStartBody(settingsHtml()); return; }
    if (a === 'guide') { menusStartBody('<div class="dc-how">' + (CO.game && CO.game.guideHtml ? CO.game.guideHtml() : (UI.guide ? uiTextHtml(UI.guide) : '<p>No guide yet.</p>')) + '</div>'); return; }
    if (a === 'slots') { menusStartBody(menusSlotsHtml()); return; }
    if (a === 'quit') { try { window.close(); } catch (e) {} return; }
    if (/^page\s+\S/.test(a)) { menusStartBody(menusPageHtml(a.slice(5).trim())); return; }
    var r = uiAction(a); if (typeof r === 'string') toast(r, '');
  }
  // a pause button that is not one of the engine's: a page, or a dev command or expression
  function menusPauseAct(i, el) { var btn = MENUS.pause && (MENUS.pause.buttons || [])[i]; if (!btn) return; var r = uiAction(String(btn.action || '').trim()); if (typeof r === 'string') toast(r, ''); }
  function menusSettingRows() {
    var hide = (MENUS.settings && MENUS.settings.hide) || [], rows = '';
    MENU_SETTINGS.forEach(function (s) {
      var k = s[0]; if (hide.indexOf(k) >= 0) return; var v = SET[k];
      if (k === 'sens') rows += '<label><span>' + s[1] + '</span><input type="range" min="0.3" max="2.5" step="0.1" value="' + v + '" data-set="sens"></label>';
      else if (k === 'fov') rows += '<label><span>' + s[1] + '</span><input type="range" min="60" max="100" step="1" value="' + v + '" data-set="fov"></label>';
      else if (k === 'vol') rows += '<label><span>' + s[1] + '</span><input type="range" min="0" max="1" step="0.05" value="' + v + '" data-set="vol"></label>';
      else if (k === 'quality') rows += '<label><span>' + s[1] + '</span><select data-set="quality">' + [['high', 'High'], ['medium', 'Medium'], ['low', 'Low (no shadows)']].map(function (o) { return '<option value="' + o[0] + '"' + (v === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>';
      else rows += '<label><span>' + s[1] + '</span><input type="checkbox" ' + ((k === 'bob' || k === 'film') ? (v !== false ? 'checked' : '') : (v ? 'checked' : '')) + ' data-set="' + k + '"></label>';
    });
    ((MENUS.settings && MENUS.settings.custom) || []).forEach(function (c) {
      if (!c || !c.key) return; var v = SET[c.key], label = esc(c.label || c.key);
      if (c.type === 'slider') rows += '<label><span>' + label + '</span><input type="range" min="' + (c.min !== undefined ? c.min : 0) + '" max="' + (c.max !== undefined ? c.max : 1) + '" step="' + (c.step || 0.1) + '" value="' + v + '" data-set="' + esc(c.key) + '"></label>';
      else if (c.type === 'select') rows += '<label><span>' + label + '</span><select data-set="' + esc(c.key) + '">' + (c.options || []).map(function (o) { return '<option' + (String(v) === String(o) ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select></label>';
      else rows += '<label><span>' + label + '</span><input type="checkbox" ' + (v ? 'checked' : '') + ' data-set="' + esc(c.key) + '"></label>';
    });
    return rows;
  }
  function menusCustomKey(k) { return ((MENUS.settings && MENUS.settings.custom) || []).some(function (c) { return c && c.key === k; }); }
  function menusCode() {
    if (!menusOn() && !Object.keys(MENUS.pages || {}).length) return '';
    var out = {}; ['theme', 'start', 'pause', 'settings', 'pages'].forEach(function (k) { var v = MENUS[k]; if (v && (typeof v !== 'object' || Object.keys(v).length)) out[k] = v; });
    return '//@ the menus the editor saved: the start screen, the pause menu, the settings and their pages, as data. Written by the Co Engine editor; it sorts first in src/. Edit it in the editor rather than here.\n  CO.menus(' + JSON.stringify(out, null, 2).replace(/\n/g, '\n  ') + ');\n';
  }
  // what the page has now, as menu data: the Menus tab starts a game that has none from it
  function menusSeed() {
    var cs = getComputedStyle(document.documentElement), css = function (n, d) { var v = cs.getPropertyValue(n).trim(); return v || d; };
    var h1 = document.querySelector('#dc-start h1'), h2 = document.querySelector('#dc-menu h2'), btns = [];
    document.querySelectorAll('#dc-menu .dc-menu-btns [data-menu]').forEach(function (b) { var k = b.getAttribute('data-menu'); if (MENU_ACTIONS.pause.indexOf(k) >= 0) btns.push({ label: b.textContent.trim() || k, action: k, primary: b.classList.contains('primary') || undefined }); });
    if (!btns.length) btns = [{ label: 'Resume', action: 'resume', primary: true }, { label: 'Settings', action: 'settings' }, { label: 'How to play', action: 'guide' }, { label: 'Quit to the start screen', action: 'quit' }];
    var startBtns = [{ label: 'Play', action: 'play', primary: true }, { label: 'Settings', action: 'settings' }, { label: 'How to play', action: 'guide' }];
    if (((CO.cfg && CO.cfg.slots) || 3) > 1) startBtns.push({ label: 'Save slots', action: 'slots' });
    startBtns.push({ label: 'Quit', action: 'quit' });
    return { theme: { accent: css('--amber', MENU_THEME.accent), panel: css('--panel', MENU_THEME.panel), text: css('--text', MENU_THEME.text), muted: css('--muted', MENU_THEME.muted) },
      start: { title: h1 ? h1.textContent.trim() : document.title, subtitle: (document.querySelector('#dc-start .card > .dc-sub:not([id])') || { textContent: '' }).textContent.trim(), buttons: startBtns },
      pause: { title: h2 ? h2.textContent.trim() : 'Paused', buttons: btns.map(function (b) { var o = { label: b.label, action: b.action }; if (b.primary) o.primary = true; return o; }) },
      settings: { hide: [], custom: [] }, pages: {} };
  }
  // the editor's preview: the start screen over the running game, the pause menu, or its settings; null puts it all away
  function menusPreview(which) {
    var st = $('dc-start');
    if (which === 'start') { if (ui.menuOpen) closeMenu(); if (st) { st.hidden = false; menusStartBody(null); } return !!st; }
    if (st && ui.started) st.hidden = true;
    if (which === 'pause' || which === 'settings') { if (!ui.menuOpen) openMenu(); else menuAct('back'); if (which === 'settings') menuAct('settings'); return true; }
    if (ui.menuOpen) closeMenu(); return true;
  }
