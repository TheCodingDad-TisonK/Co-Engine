//@ Co Engine, part 42: the player. Movement, collision, looking at things, the keys, the mouse, photo mode.
  // ── Player ────────────────────────────────────────────────────────
  // player is the record the whole engine reads: x, y, z, yaw, pitch, the keys held, the tool carried. The game's hooks on CO.game:
  // playerOverride(dt) takes the frame (a vehicle, a seat) and returns true; speedMul() scales the walk; stepSurface(x, z) names the
  // step sound; collides(x, z) adds the game's own blockers; hitObjects() adds meshes to look at; hitDef(hit) resolves one of them;
  // useFallback() runs when E hits nothing; putDown() is G with nothing focused; mouseLook(e, sx, iy) takes the mouse; key(e)
  // takes a key before the engine's own bindings; escape() takes Esc first; wheel(dir) takes the wheel.
  var focusText = '';
  // ── Key & pad bindings ─────────────────────────────────────────────
  // Every action the player takes maps to a keyboard code (BIND) and, where a controller has a button for it, a gamepad button
  // index (PAD_BIND). Both are saved with the settings and edited on the Settings page. The left stick walks and the right stick
  // looks on a controller: those are axes, not buttons, so they are not in the list (PAD_BIND.cancel is the B button, which like
  // Start routes to the menu action).
  var BIND_DEFAULTS = { forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'Space', run: 'ShiftLeft', use: 'KeyE', alt: 'KeyG', menu: 'Escape' };
  var PAD_BIND_DEFAULTS = { jump: 0, run: 10, use: 2, alt: 3, cancel: 1, menu: 9 };
  var BIND = {}, PAD_BIND = {};
  var BIND_ACTIONS = [
    { id: 'forward', label: 'Move forward', key: 1 },
    { id: 'back', label: 'Move back', key: 1 },
    { id: 'left', label: 'Move left', key: 1 },
    { id: 'right', label: 'Move right', key: 1 },
    { id: 'jump', label: 'Jump', key: 1, pad: 1 },
    { id: 'run', label: 'Run', key: 1, pad: 1 },
    { id: 'use', label: 'Use / interact', key: 1, pad: 1 },
    { id: 'alt', label: 'Alt / put down', key: 1, pad: 1 },
    { id: 'cancel', label: 'Cancel / back', pad: 1 },
    { id: 'menu', label: 'Menu / pause', key: 1, pad: 1 }
  ];
  function bindInit() {
    var kb = SET && SET.bind || {}, pb = SET && SET.padBind || {}, k;
    for (k in BIND_DEFAULTS) BIND[k] = kb[k] || BIND_DEFAULTS[k];
    for (k in PAD_BIND_DEFAULTS) PAD_BIND[k] = pb[k] === undefined ? PAD_BIND_DEFAULTS[k] : pb[k];
    SET.bind = BIND; SET.padBind = PAD_BIND;
  }
  function keyLabel(code) {
    var m = { Space: 'Space', ShiftLeft: 'Shift', ShiftRight: 'Shift', ControlLeft: 'Ctrl', ControlRight: 'Ctrl', AltLeft: 'Alt', AltRight: 'Alt', Escape: 'Esc', Enter: 'Enter', Backspace: 'Backspace', Tab: 'Tab', CapsLock: 'Caps', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
    return m[code] || String(code || '').replace(/^Key/, '').replace(/^Digit/, '').replace(/Left$/, ' L').replace(/Right$/, ' R');
  }
  function padBtnLabel(i) { var m = { 0: 'A', 1: 'B', 2: 'X', 3: 'Y', 4: 'LB', 5: 'RB', 6: 'LT', 7: 'RT', 8: 'View', 9: 'Start', 10: 'L3', 11: 'R3', 12: '↑', 13: '↓', 14: '←', 15: '→' }; return m[i] !== undefined ? m[i] : 'Button ' + i; }
  // ── Binding capture & the Settings section ─────────────────────────
  var bindCapture = { kind: null, id: null, el: null };
  function bindStart(kind, id, el) {
    if (bindCapture.el) bindCapture.el.textContent = bindCapture.kind === 'pad' ? padBtnLabel(PAD_BIND[bindCapture.id]) : keyLabel(BIND[bindCapture.id]);
    bindCapture = { kind: kind, id: id, el: el };
    el.textContent = kind === 'pad' ? 'Press a button…' : 'Press a key…';
    sfx('click');
  }
  function bindCancel() { var c = bindCapture; bindCapture = { kind: null, id: null, el: null }; if (c.el) c.el.textContent = c.kind === 'pad' ? padBtnLabel(PAD_BIND[c.id]) : keyLabel(BIND[c.id]); }
  function bindDone(val) {
    var c = bindCapture; bindCapture = { kind: null, id: null, el: null };
    if (c.kind === 'pad') { PAD_BIND[c.id] = val; SET.padBind = PAD_BIND; } else { BIND[c.id] = val; SET.bind = BIND; }
    saveSettings();
    if (c.el) c.el.textContent = c.kind === 'pad' ? padBtnLabel(val) : keyLabel(val);
    sfx('click');
  }
  function bindReset() {
    var k;
    for (k in BIND_DEFAULTS) BIND[k] = BIND_DEFAULTS[k];
    for (k in PAD_BIND_DEFAULTS) PAD_BIND[k] = PAD_BIND_DEFAULTS[k];
    SET.bind = BIND; SET.padBind = PAD_BIND;
    saveSettings();
    if (ui.panelOpen) renderPanel();   // redraw the controls panel with the default labels
    sfx('click');
  }
  function bindingsHtml() {
    var kb = '', pb = '';
    BIND_ACTIONS.forEach(function (a) {
      if (a.key) kb += '<label><span>' + a.label + '</span><button type="button" class="dc-btn" data-bind="' + a.id + '">' + keyLabel(BIND[a.id]) + '</button></label>';
      if (a.pad) pb += '<label><span>' + a.label + '</span><button type="button" class="dc-btn" data-padbind="' + a.id + '">' + padBtnLabel(PAD_BIND[a.id]) + '</button></label>';
    });
    return '<div class="dc-form"><h3 style="margin:0 0 4px">Keyboard</h3>' + kb + '<h3 style="margin:16px 0 4px">Controller</h3>' + pb + '<p class="dc-sub" style="margin-top:12px">Click a binding, then press the key or controller button to set it. Esc cancels.</p><div class="dc-menu-row" style="margin-top:12px"><button type="button" class="dc-btn" data-bind-reset="1">Reset to defaults</button></div></div>';
  }
  function coSetupPlayer(cfg) {
    var sp = cfg.spawn || { x: 0, z: 0 };
    player = { x: sp.x || 0, y: 0, z: sp.z || 0, yaw: sp.yaw === undefined ? 0 : sp.yaw, pitch: 0, vy: 0, grounded: true, keys: {}, pad: { x: 0, y: 0, run: false, jump: false, lookX: 0, lookY: 0 }, locked: false, tool: null, stepT: 0, bob: 0, jumped: false };
    player.y = floorY(player.x, player.z);
    bindInit();
    if (cfg.input === false) return player;   // the game binds its own keys, mouse and pointer lock
    canvas.addEventListener('click', function () { if (CO.editor && CO.editor.on) return; if (ui.started && !ui.blocked() && !player.locked) lockPointer(); });   // in the editor's viewport a click selects (60-editor)
    document.addEventListener('pointerlockchange', function () { player.locked = document.pointerLockElement === canvas; if (!player.locked) { player.keys = {}; if (ui.started && !ui.blocked() && !ui.suppressMenu && !ui.testing && !(CO.editor && CO.editor.on)) openMenu(); } ui.suppressMenu = false; });
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', function (e) { player.keys[e.code] = false; });
    document.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('blur', function () { player.keys = {}; });
    padInit();
    document.addEventListener('click', function (e) { var b = e.target && e.target.closest ? e.target.closest('[data-bind],[data-padbind]') : null; if (!b) return; bindStart(b.getAttribute('data-bind') ? 'key' : 'pad', b.getAttribute('data-bind') || b.getAttribute('data-padbind'), b); });
    document.addEventListener('click', function (e) { var b = e.target && e.target.closest ? e.target.closest('[data-open-controls]') : null; if (b) openPanel('controls'); });
    document.addEventListener('click', function (e) { var b = e.target && e.target.closest ? e.target.closest('[data-bind-reset]') : null; if (b) bindReset(); });
    document.addEventListener('click', function (e) { var b = e.target && e.target.closest ? e.target.closest('[data-reset-settings]') : null; if (b) settingsReset(); });
    return player;
  }
  function collides(x, z, opt) {
    var r = 0.32, y0 = player.y, y1 = player.y + 1.7;
    if (floorY(x, z, player.y) - player.y > 0.5) return true;
    for (var i = 0; i < solids.length; i++) { var s = solids[i]; if (x > s.x0 - r && x < s.x1 + r && z > s.z0 - r && z < s.z1 + r && y0 < s.y1 && y1 > s.y0) return true; }
    for (var k = 0; k < dyn.length; k++) { var d = dyn[k]; if (d.skip && (opt === d.skip || (CO.game && CO.game.skipDyn && CO.game.skipDyn(d)))) continue; if (x > d.x0 - r && x < d.x1 + r && z > d.z0 - r && z < d.z1 + r && y0 < d.y1 && y1 > d.y0) return true; }
    if (CO.game && CO.game.collides && CO.game.collides(x, z, opt)) return true;
    return false;
  }
  function updatePlayer(dt) {
    if (CO.game && CO.game.playerOverride && CO.game.playerOverride(dt)) return;
    var k = player.keys, p = player.pad || { x: 0, y: 0, run: false, jump: false, lookX: 0, lookY: 0 };
    if (p.lookX || p.lookY) { var ps = 2.4 * SET.sens, py = SET.invertY ? -1 : 1; player.yaw -= p.lookX * ps * dt; player.pitch = clamp(player.pitch - p.lookY * ps * py * dt, -1.5, 1.5); }
    var run = k[BIND.run] || p.run;
    var speed = 4.0 * (run ? 1.55 : 1) * (CO.game && CO.game.speedMul ? CO.game.speedMul() : 1);
    var fwd = (k[BIND.forward] ? 1 : 0) - (k[BIND.back] ? 1 : 0) + p.y, side = (k[BIND.right] ? 1 : 0) - (k[BIND.left] ? 1 : 0) + p.x;
    var mx = 0, mz = 0;
    if (fwd || side) {
      var fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw), rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
      mx = fx * fwd + rx * side; mz = fz * fwd + rz * side; var l = Math.sqrt(mx * mx + mz * mz); mx /= l; mz /= l;
      var nx = player.x + mx * speed * dt, nz = player.z + mz * speed * dt;
      if (!collides(nx, player.z)) player.x = nx;
      if (!collides(player.x, nz)) player.z = nz;
      player.stepT += speed * dt; player.bob += dt * (run ? 11 : 8);
      if (player.stepT > 2.1) { player.stepT = 0; sfx('step', CO.game && CO.game.stepSurface ? CO.game.stepSurface(player.x, player.z, player.y) : 'floor'); }
    } else player.bob *= Math.max(0, 1 - 8 * dt);
    var fy = floorY(player.x, player.z, player.y);
    if ((k[BIND.jump] || p.jump) && player.grounded && !player.jumped) { player.vy = 6.0; player.grounded = false; player.jumped = true; }
    if (!k[BIND.jump] && !p.jump) player.jumped = false;
    player.vy -= 16 * dt; player.y += player.vy * dt;
    if (player.y <= fy) { if (!player.grounded && player.vy < -6) sfx('putdown'); player.y = fy; player.vy = 0; player.grounded = true; } else player.grounded = false;
    var bobY = SET.bob !== false && (fwd || side) && player.grounded ? Math.sin(player.bob) * 0.03 : 0;
    camera.position.set(player.x, player.y + 1.62 + bobY, player.z);
    camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
  }
  // ── Looking at things ─────────────────────────────────────────────
  function updateFocus() {
    if (CO.game && CO.game.focusOff && CO.game.focusOff()) return;   // the game keeps its own focus (Grow Co): leave it alone; clearing it here wiped the shop's aim every frame, so E and clicks found nothing
    focus = null; focusText = '';
    if (!ui.started || ui.blocked() || photo.on) return;
    ray.setFromCamera(centre, camera);
    if (edit.on && !(CO.game && CO.game.editMode === false)) {
      if (edit.grabbed) { if (edit.snapText) { focus = { prompt: function () { return edit.snapText; }, use: function () {} }; focusText = edit.snapText; } return; }
      ray.far = 7; var ph = ray.intersectObjects(scene.children, true); ray.far = 3.4;
      for (var q = 0; q < ph.length; q++) { var pid = propIdOf(ph[q].object); if (!pid) continue; if (ph[q].object.userData.baked || !ph[q].object.visible) continue; var pdef = propDef(pid); if (!pdef || pdef.fixed) continue; focus = { editId: pid, prompt: function () { return ''; }, use: function () {} }; focusText = 'Grab the ' + pdef.label + '  ·  R turn · Backspace put back · Del remove'; return; }
      return;
    }
    var extra = CO.game && CO.game.hitObjects ? CO.game.hitObjects() : [];
    var hits = ray.intersectObjects(extra.length ? inter.concat(extra) : inter, false);
    // a touch screen sits a few centimetres proud of its cabinet, whose hit box can reach past it: within 0.5 m the screen wins,
    // and the hit box of the screen's own prop never beats it at any range; the game may name other winners in hitPriority
    for (var si = 1; si < hits.length; si++) {
      var hs = hits[si], win = false;
      if (hs.object.userData.screen) { win = true; var spid = propIdOf(hs.object); for (var sj = 0; sj < si; sj++) { var ho = hits[sj].object; if (!(hs.distance - hits[sj].distance < 0.5 || (spid && ho.material === MAT.hit && propIdOf(ho) === spid))) { win = false; break; } } }
      else if (CO.game && CO.game.hitPriority && CO.game.hitPriority(hs, hits[0])) win = true;
      if (win) { hits.unshift(hits.splice(si, 1)[0]); break; }
    }
    for (var i = 0; i < hits.length; i++) {
      var h = hits[i], def = h.object.userData.it || (CO.game && CO.game.hitDef ? CO.game.hitDef(h) : null);
      if (!def) continue;
      if (def.prop === undefined) def.prop = propIdOf(h.object) || null;
      var txt = def.prompt(); if (!txt) continue;
      focus = def; focusText = txt; break;
    }
  }
  function useFocus() {
    if (edit.on && !(CO.game && CO.game.editMode === false)) { if (edit.grabbed) editDrop(false); else if (focus && focus.editId) editGrab(focus.editId); return; }
    if (CO.game && CO.game.useOverride && CO.game.useOverride()) return;
    if (focus) { focus.use(); sfx('click'); updateFocus(); } else if (CO.game && CO.game.useFallback) CO.game.useFallback();
  }
  // ── Gamepad ────────────────────────────────────────────────────────
  // A controller (Xbox layout) drives the same inputs the keyboard and mouse do. The left stick walks, the right stick looks,
  // A jumps (or presses the highlighted menu button), X is E (use), Y is G (alt), B and Start are Escape, and a click on the
  // left stick runs. In a menu or panel the D-pad or left stick moves the highlight and A presses it. The pad is polled every
  // frame from navigator.getGamepads(), so a controller can be turned on at any point. Buttons rise on the standard Xbox
  // layout: 0 A · 1 B · 2 X · 3 Y · 4 LB · 5 RB · 6 LT · 7 RT · 8 View · 9 Menu · 10/11 stick clicks · 12–15 the D-pad.
  var PAD = { idx: -1, g: null, prev: [], edge: [], navCd: 0, focusEl: null };
  function padDead(a, dz) { dz = dz === undefined ? 0.18 : dz; return Math.abs(a) < dz ? 0 : (Math.abs(a) - dz) / (1 - dz) * (a < 0 ? -1 : 1); }
  function padGamepad() {
    try { var gs = navigator.getGamepads ? navigator.getGamepads() : []; for (var i = 0; i < gs.length; i++) { var g = gs[i]; if (g && g.connected) return g; } } catch (e) {}
    return null;
  }
  function padPoll() {
    var g = padGamepad(); PAD.g = g; if (!g) { PAD.idx = -1; return null; }
    var first = PAD.idx !== g.index; PAD.idx = g.index;
    for (var i = 0; i < g.buttons.length; i++) { var p = g.buttons[i].pressed; PAD.edge[i] = !first && !!p && !PAD.prev[i]; PAD.prev[i] = p; }
    return g;
  }
  function padKey(code) { return { code: code, key: String(code).replace(/^Key/, '').replace(/^Digit/, '').toLowerCase(), repeat: false, ctrlKey: false, shiftKey: false, altKey: false, target: document.body, preventDefault: function () {}, stopImmediatePropagation: function () {} }; }
  function padClearFocus() { var els = document.querySelectorAll('.pad-focus'); for (var i = 0; i < els.length; i++) els[i].classList.remove('pad-focus'); }
  // the buttons the gamepad can reach in the overlay that is open now: the start screen, a panel, or the pause menu
  function padMenuButtons() {
    var roots = [];
    if (!ui.started) { var s = $('dc-start'); if (s && !s.hidden) roots.push(s); }
    if (ui.panelOpen) { var pn = $('dc-panel'); if (pn && !pn.hidden) roots.push(pn); }
    if (ui.menuOpen) { var mn = $('dc-menu'); if (mn && !mn.hidden) roots.push(mn); }
    var out = [];
    for (var r = 0; r < roots.length; r++) { var bs = roots[r].querySelectorAll('button'); for (var i = 0; i < bs.length; i++) if (bs[i].offsetParent !== null) out.push(bs[i]); }
    return out;
  }
  function padMenu(dt, ay) {
    var g = PAD.g, list = padMenuButtons(); padClearFocus();
    if (!list.length) { PAD.focusEl = null; return; }
    var idx = list.indexOf(PAD.focusEl);
    if (idx < 0) { idx = 0; for (var i = 0; i < list.length; i++) if (list[i].classList.contains('primary')) { idx = i; break; } }
    var dir = 0;
    if ((g.buttons[12] && g.buttons[12].pressed) || ay < -0.5) dir = -1; else if ((g.buttons[13] && g.buttons[13].pressed) || ay > 0.5) dir = 1;
    PAD.navCd -= dt;
    if (dir && PAD.navCd <= 0) { idx = (idx + dir + list.length) % list.length; PAD.navCd = 0.16; sfx('click'); }
    var el = list[idx]; PAD.focusEl = el; el.classList.add('pad-focus'); if (el.scrollIntoView) try { el.scrollIntoView({ block: 'nearest' }); } catch (e2) {}
    if (PAD.edge[0]) el.click();                              // A presses the highlighted button
    if (PAD.edge[PAD_BIND.cancel] || PAD.edge[PAD_BIND.menu]) onKeyDown(padKey(BIND.menu));   // B or Start steps back
  }
  function padInit() {
    var st = document.createElement('style'); st.id = 'co-pad-style';
    st.textContent = '.pad-focus { outline: 2px solid #f5b53d !important; outline-offset: 2px; box-shadow: 0 0 0 4px rgba(245,181,61,0.25) !important; }';
    document.head.appendChild(st);
    window.addEventListener('gamepadconnected', function (e) { if (PAD.idx < 0) PAD.idx = e.gamepad.index; if (typeof toast === 'function') toast('Controller connected', ''); });
  }
  // one tick of the pad, every frame: fills player.pad for walking, drives the menu highlight, and captures a rebind when asked
  function coPadTick(dt) {
    var p = player.pad; p.x = p.y = p.run = p.jump = p.lookX = p.lookY = 0;
    var g = padPoll(); if (!g) return;
    if (bindCapture.kind === 'pad') { for (var bi = 0; bi < g.buttons.length; bi++) if (PAD.edge[bi]) { bindDone(bi); break; } return; }
    var ax = padDead(g.axes[0] || 0), ay = padDead(g.axes[1] || 0), lx = padDead(g.axes[2] || 0), ly = padDead(g.axes[3] || 0);
    if (ui.started && !ui.blocked() && !photo.on) {
      p.x = ax; p.y = -ay; p.run = !!(g.buttons[PAD_BIND.run] && g.buttons[PAD_BIND.run].pressed); p.jump = !!(g.buttons[PAD_BIND.jump] && g.buttons[PAD_BIND.jump].pressed); p.lookX = lx; p.lookY = ly;
      if (PAD.edge[PAD_BIND.use]) onKeyDown(padKey(BIND.use));               // use
      if (PAD.edge[PAD_BIND.alt]) onKeyDown(padKey(BIND.alt));               // alt / put down
      if (PAD.edge[PAD_BIND.cancel] || PAD.edge[PAD_BIND.menu]) onKeyDown(padKey(BIND.menu));   // the menu
    } else padMenu(dt, ay);
  }
  // ── Input ─────────────────────────────────────────────────────────
  function lockPointer() { if (!ui.started || ui.blocked() || ui.testing || (CO.editor && CO.editor.on)) return; try { var r = canvas.requestPointerLock(); if (r && r.catch) r.catch(function () {}); } catch (e) {} }
  function onMouseMove(e) {
    if (!(player.locked || (CO.editor && CO.editor.drag)) || ui.blocked()) return;
    var sx = 0.0022 * SET.sens, iy = SET.invertY ? -1 : 1;
    if (photo.on) { photo.yaw -= e.movementX * sx; photo.pitch = clamp(photo.pitch - e.movementY * sx * iy, -1.5, 1.5); return; }
    if (CO.game && CO.game.mouseLook && CO.game.mouseLook(e, sx, iy)) return;
    player.yaw -= e.movementX * sx; player.pitch = clamp(player.pitch - e.movementY * sx * iy, -1.5, 1.5);
  }
  function onKeyDown(e) {
    if (bindCapture.kind) { if (e.code === 'Escape') { e.preventDefault(); bindCancel(); return; } if (bindCapture.kind === 'key') { e.preventDefault(); bindDone(e.code); return; } }   // a rebind is waiting: the next key binds it (Esc cancels)
    if (e.code === 'F12') { e.preventDefault(); if (ui.started) screenshot(); return; }
    if (e.code === 'KeyD' && e.ctrlKey && e.shiftKey) { e.preventDefault(); devLinkToggle(); return; }
    if (e.code === 'F3') { e.preventDefault(); SET.fps = !SET.fps; var f = $('h-fps'); if (f) f.hidden = !SET.fps; saveSettings(); return; }
    var typing = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT');
    if (typing && e.code !== BIND.menu) return;
    if (!ui.started) return;
    hideCards();
    if (e.code === 'F9') { e.preventDefault(); photoToggle(); return; }
    if (e.code === BIND.menu) { e.preventDefault(); if (photo.on) { photoToggle(false); return; } if (CO.game && CO.game.escape && CO.game.escape()) return; if (edit.on && edit.grabbed) { editDrop(true); return; } if (ui.panelOpen) closePanel(); else if (ui.scanOpen && CO.game && CO.game.scanToggle) CO.game.scanToggle(false); else if (ui.menuOpen) closeMenu(); else openMenu(); return; }
    if (ui.blocked()) return;
    if (photo.on) { player.keys[e.code] = true; return; }
    if (e.code === 'F2') { e.preventDefault(); if (editAllowed() && !(CO.game && CO.game.editBlocked && CO.game.editBlocked())) editToggle(); return; }
    if (edit.on && !(CO.game && CO.game.editMode === false)) {
      if (e.code === 'KeyR') { editRotate(); return; }
      if (e.code === 'Backspace') { e.preventDefault(); editReset(); return; }
      if (e.code === 'Delete') { editRemove(); return; }
      if (e.code === 'KeyC') { openPanel('catalogue'); return; }
      if (e.code === BIND.use && !e.repeat) { if (edit.grabbed) editDrop(false); else if (focus && focus.editId) editGrab(focus.editId); return; }
      if (e.code === BIND.alt && !e.repeat) { if (edit.grabbed) editDrop(true); return; }
    }
    if (CO.game && CO.game.key && CO.game.key(e)) return;
    player.keys[e.code] = true;
    if (e.repeat) return;
    if (e.code === BIND.use) useFocus();
    else if (e.code === BIND.alt) { if (focus && focus.alt) focus.alt(); else if (CO.game && CO.game.putDown) CO.game.putDown(); }
  }
  function screenUnderCrosshair() { for (var i = 0; i < screens.length; i++) { if (!screens[i].mesh.visible) continue; if (ray.intersectObject(screens[i].mesh, false).length) return screens[i]; } return null; }
  function onWheel(e) {
    var dir = e.deltaY > 0 ? 1 : -1;
    if (photo.on && ui.started && !ui.blocked()) { photoZoom(dir); return; }
    if (CO.game && CO.game.wheel && CO.game.wheel(dir, e)) return;
    if (ui.started && !ui.blocked()) { var ssc = screenUnderCrosshair(); if (ssc && ssc.scrollable) { ssc.scroll = clamp((ssc.scroll || 0) + dir, 0, ssc.scrollMax || 0); ssc.userScrollAt = worldTime; ssc.dirty = true; } }
  }
  // ── Photo mode ────────────────────────────────────────────────────
  // F9 lets go of the player: the camera flies free (WASD, Space up, C down, Shift fast, the mouse looks), the HUD goes, the world
  // holds still, and F12 takes the picture. F9 or Esc puts you back where you were standing.
  var photo = { on: false, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, speed: 6, fov: 75 };
  function photoToggle(on) {
    if (CO.game && CO.game.photo === false) return;   // the game has a photo mode of its own
    if (on === undefined) on = !photo.on; if (on === photo.on) return;
    if (on) {
      if (!ui.started || ui.blocked() || edit.on || (CO.game && CO.game.photoBlocked && CO.game.photoBlocked())) return;
      photo.on = true; photo.x = camera.position.x; photo.y = camera.position.y; photo.z = camera.position.z; photo.yaw = player.yaw; photo.pitch = player.pitch; photo.fov = SET.fov;
      if (ui.scanOpen && CO.game && CO.game.scanToggle) CO.game.scanToggle(false); var hud = $('dc-hud'); if (hud) hud.hidden = true; player.keys = {}; sfx('beep'); runHooks('photo', true);
    } else { photo.on = false; var hud2 = $('dc-hud'); if (hud2) hud2.hidden = false; hudDirty = true; player.keys = {}; sfx('click'); camera.fov = SET.fov; camera.updateProjectionMatrix(); runHooks('photo', false); }
  }
  function photoZoom(dir) { if (!photo.on) return; photo.fov = clamp(photo.fov + dir * 4, 20, 110); camera.fov = photo.fov; camera.updateProjectionMatrix(); }
  function photoTick(dt) {
    var k = player.keys, sp = photo.speed * (k.ShiftLeft || k.ShiftRight ? 3 : 1) * dt;
    var cp = Math.cos(photo.pitch), fx = -Math.sin(photo.yaw) * cp, fy = Math.sin(photo.pitch), fz = -Math.cos(photo.yaw) * cp, rx = Math.cos(photo.yaw), rz = -Math.sin(photo.yaw);
    var f = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), r = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0), u = (k.Space ? 1 : 0) - (k.KeyC || (k.ControlLeft && !(CO.editor && CO.editor.on)) ? 1 : 0);   /* in the editor Ctrl selects and drags; C flies down */
    photo.x += (fx * f + rx * r) * sp; photo.y = clamp(photo.y + (fy * f + u) * sp, -1.0, 70); photo.z += (fz * f + rz * r) * sp;
    camera.position.set(photo.x, photo.y, photo.z); camera.rotation.set(photo.pitch, photo.yaw, 0, 'YXZ');
  }
