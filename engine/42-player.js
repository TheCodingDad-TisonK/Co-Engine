//@ Co Engine, part 42: the player. Movement, collision, looking at things, the keys, the mouse, photo mode.
  // ── Player ────────────────────────────────────────────────────────
  // player is the record the whole engine reads: x, y, z, yaw, pitch, the keys held, the tool carried. The game's hooks on CO.game:
  // playerOverride(dt) takes the frame (a vehicle, a seat) and returns true; speedMul() scales the walk; stepSurface(x, z) names the
  // step sound; collides(x, z) adds the game's own blockers; hitObjects() adds meshes to look at; hitDef(hit) resolves one of them;
  // useFallback() runs when E hits nothing; putDown() is G with nothing focused; mouseLook(e, sx, iy) takes the mouse; key(e)
  // takes a key before the engine's own bindings; escape() takes Esc first; wheel(dir) takes the wheel.
  var focusText = '';
  function coSetupPlayer(cfg) {
    var sp = cfg.spawn || { x: 0, z: 0 };
    player = { x: sp.x || 0, y: 0, z: sp.z || 0, yaw: sp.yaw === undefined ? 0 : sp.yaw, pitch: 0, vy: 0, grounded: true, keys: {}, locked: false, tool: null, stepT: 0, bob: 0, jumped: false };
    player.y = floorY(player.x, player.z);
    if (cfg.input === false) return player;   // the game binds its own keys, mouse and pointer lock
    canvas.addEventListener('click', function () { if (CO.editor && CO.editor.on) return; if (ui.started && !ui.blocked() && !player.locked) lockPointer(); });   // in the editor's viewport a click selects (60-editor)
    document.addEventListener('pointerlockchange', function () { player.locked = document.pointerLockElement === canvas; if (!player.locked) { player.keys = {}; if (ui.started && !ui.blocked() && !ui.suppressMenu && !ui.testing && !(CO.editor && CO.editor.on)) openMenu(); } ui.suppressMenu = false; });
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', function (e) { player.keys[e.code] = false; });
    document.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('blur', function () { player.keys = {}; });
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
    var k = player.keys, run = k.ShiftLeft || k.ShiftRight;
    var speed = 4.0 * (run ? 1.55 : 1) * (CO.game && CO.game.speedMul ? CO.game.speedMul() : 1);
    var fwd = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), side = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
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
    if (k.Space && player.grounded && !player.jumped) { player.vy = 6.0; player.grounded = false; player.jumped = true; }
    if (!k.Space) player.jumped = false;
    player.vy -= 16 * dt; player.y += player.vy * dt;
    if (player.y <= fy) { if (!player.grounded && player.vy < -6) sfx('putdown'); player.y = fy; player.vy = 0; player.grounded = true; } else player.grounded = false;
    var bobY = SET.bob !== false && (fwd || side) && player.grounded ? Math.sin(player.bob) * 0.03 : 0;
    camera.position.set(player.x, player.y + 1.62 + bobY, player.z);
    camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
  }
  // ── Looking at things ─────────────────────────────────────────────
  function updateFocus() {
    focus = null; focusText = '';
    if (!ui.started || ui.blocked() || photo.on || (CO.game && CO.game.focusOff && CO.game.focusOff())) return;
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
    if (e.code === 'F12') { e.preventDefault(); if (ui.started) screenshot(); return; }
    if (e.code === 'KeyD' && e.ctrlKey && e.shiftKey) { e.preventDefault(); devLinkToggle(); return; }
    if (e.code === 'F3') { e.preventDefault(); SET.fps = !SET.fps; var f = $('h-fps'); if (f) f.hidden = !SET.fps; saveSettings(); return; }
    var typing = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT');
    if (typing && e.code !== 'Escape') return;
    if (!ui.started) return;
    hideCards();
    if (e.code === 'F9') { e.preventDefault(); photoToggle(); return; }
    if (e.code === 'Escape') { e.preventDefault(); if (photo.on) { photoToggle(false); return; } if (CO.game && CO.game.escape && CO.game.escape()) return; if (edit.on && edit.grabbed) { editDrop(true); return; } if (ui.panelOpen) closePanel(); else if (ui.scanOpen && CO.game && CO.game.scanToggle) CO.game.scanToggle(false); else if (ui.menuOpen) closeMenu(); else openMenu(); return; }
    if (ui.blocked()) return;
    if (photo.on) { player.keys[e.code] = true; return; }
    if (e.code === 'F2') { e.preventDefault(); if (editAllowed() && !(CO.game && CO.game.editBlocked && CO.game.editBlocked())) editToggle(); return; }
    if (edit.on && !(CO.game && CO.game.editMode === false)) {
      if (e.code === 'KeyR') { editRotate(); return; }
      if (e.code === 'Backspace') { e.preventDefault(); editReset(); return; }
      if (e.code === 'Delete') { editRemove(); return; }
      if (e.code === 'KeyC') { openPanel('catalogue'); return; }
      if (e.code === 'KeyE' && !e.repeat) { if (edit.grabbed) editDrop(false); else if (focus && focus.editId) editGrab(focus.editId); return; }
      if (e.code === 'KeyG' && !e.repeat) { if (edit.grabbed) editDrop(true); return; }
    }
    if (CO.game && CO.game.key && CO.game.key(e)) return;
    player.keys[e.code] = true;
    if (e.repeat) return;
    if (e.code === 'KeyE') useFocus();
    else if (e.code === 'KeyG') { if (focus && focus.alt) focus.alt(); else if (CO.game && CO.game.putDown) CO.game.putDown(); }
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
    var f = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), r = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0), u = (k.Space ? 1 : 0) - (k.KeyC || k.ControlLeft ? 1 : 0);
    photo.x += (fx * f + rx * r) * sp; photo.y = clamp(photo.y + (fy * f + u) * sp, -1.0, 70); photo.z += (fz * f + rz * r) * sp;
    camera.position.set(photo.x, photo.y, photo.z); camera.rotation.set(photo.pitch, photo.yaw, 0, 'YXZ');
  }
