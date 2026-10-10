//@ Co Engine, part 21: touch screens drawn in the world, and hinged doors with locks
  // ── Touch screens: a canvas drawn in the world, tapped where the crosshair points ─
  var screens = [];
  function touchScreen(o) {
    var res = o.res || 1, c = document.createElement('canvas'); c.width = o.w * res; c.height = o.h * res; var ctx = c.getContext('2d'); if (res !== 1) ctx.setTransform(res, 0, 0, res, 0, 0);   // res: canvas pixels per logical pixel; the layout and the tap zones stay in logical pixels
    var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8;
    var mesh = new THREE.Mesh(new THREE.PlaneGeometry(o.pw, o.ph), new THREE.MeshBasicMaterial({ map: t })); mesh.material.userData.noBake = true; mesh.position.set(o.x, o.y, o.z); mesh.rotation.y = o.ry || 0; parentOf(o.parent).add(mesh);
    var glass = new THREE.Mesh(new THREE.PlaneGeometry(o.pw, o.ph), MAT.screenGlass); glass.position.set(0, 0, 0.0015); glass.renderOrder = 2; mesh.add(glass);
    var sc = { w: o.w, h: o.h, res: res, ctx: ctx, tex: t, mesh: mesh, zones: [], draw: o.draw, cur: null, ripple: 0, title: o.title, dirty: true, autoPage: o.autoPage }; mesh.userData.screen = sc;
    addInter(mesh, { prompt: function () { var z = screenZone(sc); return z ? z.label : (o.title || 'Screen'); }, use: function () { screenTap(sc); } });
    screens.push(sc); return sc;
  }
  function screenZone(sc) { var h = ray.intersectObject(sc.mesh, false); if (!h.length || !h[0].uv) { sc.cur = null; return null; } var x = h[0].uv.x * sc.w, y = (1 - h[0].uv.y) * sc.h; sc.cur = { x: x, y: y }; for (var i = 0; i < sc.zones.length; i++) { var z = sc.zones[i]; if (x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h) return z; } return null; }
  function screenZoneAt(sc, x, y) { for (var i = 0; i < sc.zones.length; i++) { var z = sc.zones[i]; if (x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h) return z; } return null; }   // a tap by logical coordinates: the editor and the tests use it
  function screenTap(sc, zone) { var z = zone || screenZone(sc); sfx('click'); if (z && z.act) { z.act(); sc.ripple = 1; sc.dirty = true; } }
  function drawScreens(dt) { screens.forEach(function (sc) { if (sc.autoPage) { var pg = Math.floor(worldTime / 6); if (sc.lastAuto !== pg) { sc.lastAuto = pg; sc.dirty = true; } } if (sc.ripple > 0) { sc.ripple -= dt * 3; sc.dirty = true; } if (!sc.dirty) return; sc.dirty = false; sc.zones.length = 0; if (sc.res && sc.res !== 1) sc.ctx.setTransform(sc.res, 0, 0, sc.res, 0, 0); sc.draw(sc.ctx, sc); if (sc.cur && sc.ripple > 0) { sc.ctx.strokeStyle = 'rgba(255,255,255,' + sc.ripple + ')'; sc.ctx.lineWidth = 3; sc.ctx.beginPath(); sc.ctx.arc(sc.cur.x, sc.cur.y, (1 - sc.ripple) * 30 + 4, 0, 6.3); sc.ctx.stroke(); } sc.tex.needsUpdate = true; }); }
  function screenDirtyAll() { screens.forEach(function (s) { s.dirty = true; }); }
  // drawing helpers in the house style. The theme is one object a game can repaint.
  var SCREEN_THEME = { bg: '#0d1216', accent: 'rgba(245,181,61,0.18)', dot: 'rgba(255,255,255,0.04)', title: '#f5b53d', sub: '#a0acb8', rule: 'rgba(245,181,61,0.35)', text: '#eef1f5', btn: '#f5b53d', btnText: '#1a1205', btnOff: 'rgba(255,255,255,0.08)', btnOffText: '#eef1f5', font: 'Bahnschrift, Arial, sans-serif' };
  function scBg(c, w, h, accent) { c.fillStyle = SCREEN_THEME.bg; c.fillRect(0, 0, w, h); var g = c.createRadialGradient(0, 0, 10, 0, 0, w); g.addColorStop(0, accent || SCREEN_THEME.accent); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); c.fillStyle = SCREEN_THEME.dot; for (var y = 8; y < h; y += 16) for (var x = 8; x < w; x += 16) c.fillRect(x, y, 1.5, 1.5); }
  function scHead(c, w, title, sub) { c.fillStyle = SCREEN_THEME.title; c.font = 'bold 22px ' + SCREEN_THEME.font; c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.fillText(title, 16, 30); c.fillStyle = SCREEN_THEME.sub; c.font = '14px ' + SCREEN_THEME.font; c.textAlign = 'right'; c.fillText(sub === undefined ? (S && typeof S.time === 'number' ? fmtTime(S.time) : '') : sub, w - 16, 30); c.textAlign = 'left'; c.fillStyle = SCREEN_THEME.rule; c.fillRect(16, 40, w - 32, 2); }
  function scButton(sc, x, y, w, h, label, on, act, col) { var c = sc.ctx; c.fillStyle = on ? (col || SCREEN_THEME.btn) : SCREEN_THEME.btnOff; c.strokeStyle = on ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.18)'; c.lineWidth = 1.5; c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, 8); else c.rect(x, y, w, h); c.fill(); c.stroke(); c.fillStyle = on ? SCREEN_THEME.btnText : SCREEN_THEME.btnOffText; c.font = 'bold 15px ' + SCREEN_THEME.font; var tw = c.measureText(label).width; if (tw > w - 10) c.font = 'bold ' + Math.max(10, Math.floor(15 * (w - 10) / tw)) + 'px ' + SCREEN_THEME.font; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(label, x + w / 2, y + h / 2, w - 8); c.textBaseline = 'alphabetic'; c.textAlign = 'left'; sc.zones.push({ x: x, y: y, w: w, h: h, label: label, act: act }); }
  function scText(c, x, y, text, col, size) { c.fillStyle = col || SCREEN_THEME.text; c.font = (size || 14) + 'px ' + SCREEN_THEME.font; c.textAlign = 'left'; var sc = c.getTransform ? c.getTransform().a || 1 : 1; c.fillText(text, x, y, Math.max(20, c.canvas.width / sc - x - 8)); }   // never past the right edge of the screen, whatever the resolution
  function scFit(c, text, maxW) { if (c.measureText(text).width <= maxW) return text; var lo = 0, hi = text.length; while (lo < hi) { var mid = (lo + hi + 1) >> 1; if (c.measureText(text.slice(0, mid) + '…').width <= maxW) lo = mid; else hi = mid - 1; } return text.slice(0, lo) + '…'; }   // trimmed with an ellipsis to fit

  // ── Hinged doors ──────────────────────────────────────────────────
  // Each door is a leaf on a hinge. E opens or closes it, Shift+E locks or unlocks it (you carry the keys). Walkers with keys
  // (the game lists them with CO.game.doorOpeners(), as [{ x, z }]) have the door swing open as they come up to it and close
  // behind them. The state lives in S.hdoors[id] = { open, locked }.
  var hdoors = [];
  function hingedDoor(id, x, z, alongX, label, opt) { return worldItem('door', function () {
    opt = opt || {};
    var g = new THREE.Group(); g.userData.dynamic = true; g.position.set(x, 0, z); (WORLD_PARENT || scene).add(g);
    var w = opt.w || 1.0, h = opt.h || 2.15, t = 0.06, hinge = new THREE.Group(); g.add(hinge);
    var leaf = box(alongX ? w : t, h, alongX ? t : w, opt.mat || MAT.plaster, alongX ? w / 2 : 0, h / 2, alongX ? 0 : w / 2, hinge);
    if (opt.window) box(alongX ? 0.4 : t + 0.01, 0.5, alongX ? t + 0.01 : 0.4, MAT.glass, alongX ? w / 2 : 0, 1.55, alongX ? 0 : w / 2, hinge);
    box(alongX ? 0.14 : 0.04, 0.03, alongX ? 0.04 : 0.14, MAT.chrome, alongX ? w - 0.15 : 0.06, 1.05, alongX ? 0.06 : w - 0.15, hinge); box(alongX ? 0.14 : 0.04, 0.03, alongX ? 0.04 : 0.14, MAT.chrome, alongX ? w - 0.15 : -0.06, 1.05, alongX ? -0.06 : w - 0.15, hinge);
    if (opt.pushbar) box(alongX ? 0.8 : 0.05, 0.05, alongX ? 0.05 : 0.8, MAT.chrome, alongX ? w / 2 : 0.07, 1.0, alongX ? 0.07 : w / 2, hinge);
    var led = box(0.03, 0.03, 0.03, glowMat(0x39d353, 1.2), alongX ? w - 0.1 : 0.05, 2.0, alongX ? 0.05 : w - 0.1, hinge);
    // the frame: on a group of its own, so it joins the static bake (the leaf's group is dynamic and the frame never moves)
    var fg = new THREE.Group(); fg.position.set(x, 0, z); (WORLD_PARENT || scene).add(fg);
    var fm = opt.frameMat || MAT.steelDark; if (alongX) { box(0.08, h + 0.1, t + 0.06, fm, -0.04, (h + 0.1) / 2, 0, fg); box(0.08, h + 0.1, t + 0.06, fm, w + 0.04, (h + 0.1) / 2, 0, fg); box(w + 0.16, 0.08, t + 0.06, fm, w / 2, h + 0.09, 0, fg); } else { box(t + 0.06, h + 0.1, 0.08, fm, 0, (h + 0.1) / 2, -0.04, fg); box(t + 0.06, h + 0.1, 0.08, fm, 0, (h + 0.1) / 2, w + 0.04, fg); box(t + 0.06, 0.08, w + 0.16, fm, 0, h + 0.09, w / 2, fg); }
    var d = { id: id, g: g, frame: fg, hinge: hinge, leaf: leaf, led: led, x: x, z: z, alongX: alongX, w: w, h: h, t: 0, label: label, swing: opt.swing || 1 };
    var hit = hitBox(alongX ? w : 0.4, h, alongX ? 0.4 : w, alongX ? w / 2 : 0, h / 2, alongX ? 0 : w / 2, { prompt: function () { return doorPrompt(d); }, use: function () { doorUse(d); }, alt: function () { doorLock(d); } }, g);
    d.hit = hit;
    if (!S.hdoors) S.hdoors = {}; if (!S.hdoors[id]) S.hdoors[id] = { open: !!opt.open, locked: false };
    d.t = S.hdoors[id].open ? 1 : 0; doorPose(d);
    hdoors.push(d); return d;
  }, null); }
  function hd(id) { return S && S.hdoors && S.hdoors[id] ? S.hdoors[id] : { open: false, locked: false }; }
  function doorById(id) { for (var i = 0; i < hdoors.length; i++) if (hdoors[i].id === id) return hdoors[i]; return null; }
  function doorPose(d) { d.hinge.rotation.y = (d.alongX ? -1 : 1) * d.swing * d.t * 1.65; d.led.material.emissive.setHex(hd(d.id).locked ? 0xff3b30 : 0x39d353); }
  function doorPrompt(d) { var s = hd(d.id); if (s.locked) return d.label + ' · locked · Shift+E unlocks'; return (s.open ? 'Close ' : 'Open ') + d.label + ' · Shift+E locks'; }
  function doorUse(d) { var s = hd(d.id); if (player && player.keys && (player.keys.ShiftLeft || player.keys.ShiftRight)) { doorLock(d); return; } if (s.locked) { sfx('bad'); toast(d.label + ' is locked.', 'bad'); return; } s.open = !s.open; sfx('door'); }
  function doorLock(d) { var s = hd(d.id); if (s.open) { s.open = false; } s.locked = !s.locked; sfx(s.locked ? 'lock' : 'unlock'); toast((s.locked ? 'Locked ' : 'Unlocked ') + d.label, s.locked ? '' : 'good'); doorPose(d); screenDirtyAll(); }
  // a door inside a world item stands where the item stands now: its hinge's place is read from the scene (0.9.1)
  var DOOR_V = null;
  function doorSync(d) { var p = d.g.parent; if (!p || p === scene || p === CO.root) return; if (!DOOR_V) DOOR_V = new THREE.Vector3(); d.g.getWorldPosition(DOOR_V); d.x = DOOR_V.x; d.z = DOOR_V.z; }
  function doorCentre(d) { doorSync(d); return { x: d.alongX ? d.x + d.w / 2 : d.x, z: d.alongX ? d.z : d.z + d.w / 2 }; }
  function doorsTick(dt) {
    var walkers = CO.game && CO.game.doorOpeners ? CO.game.doorOpeners() : [];
    hdoors.forEach(function (d) {
      var s = hd(d.id), c = doorCentre(d);
      var near = walkers.some(function (p) { return dist2(p.x, p.z, c.x, c.z) < 1.7; });   // someone with keys: the door opens for them when they are close and closes once they are through
      var want = s.open || near ? 1 : 0;
      if (Math.abs(d.t - want) > 0.002) { d.t = lerp(d.t, want, 1 - Math.pow(0.006, dt)); if (Math.abs(d.t - want) < 0.004) d.t = want; doorPose(d); shadowDirty = true; }
    });
  }
  function doorSolids(out) { hdoors.forEach(function (d) { doorSync(d); if (d.t > 0.5) return; if (d.alongX) out.push({ x0: d.x, x1: d.x + d.w, z0: d.z - 0.08, z1: d.z + 0.08, y0: -1, y1: 3 }); else out.push({ x0: d.x - 0.08, x1: d.x + 0.08, z0: d.z, z1: d.z + d.w, y0: -1, y1: 3 }); }); }
  function lockAll(lock) { hdoors.forEach(function (d) { var s = hd(d.id); if (lock) { s.open = false; s.locked = true; } else s.locked = false; doorPose(d); }); runHooks('lockAll', lock); sfx(lock ? 'lock' : 'unlock'); logEvent(lock ? 'Night mode: every door closed and locked' : 'Doors unlocked for the day'); screenDirtyAll(); }
  function anyDoorUnlocked() { return hdoors.some(function (d) { return !hd(d.id).locked; }); }
