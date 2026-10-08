(function () {
  'use strict';
  if (typeof THREE === 'undefined') { document.body.innerHTML = '<p style="padding:40px;font-family:sans-serif">three.js failed to load (vendor/three/three.min.js).</p>'; return; }
  // ── Co Engine ─────────────────────────────────────────────────────
  // The engine parts come first in the closure, the game's parts after. The engine declares the names both sides share
  // here, unassigned, and fills them when the game calls CO.setup (the renderer, the scene, the palette) and CO.boot (the
  // state, the shell, the frame loop). A game part may use any of them at its top level once CO.setup has run.
  var CO = { version: '0.1.0', cfg: null, game: null, root: null, flash: 0, ready: false };
  var S, SET, SAVE, SETTINGS_KEY, BOOT_SLOT, BOOT_SAVE;               // 40-state fills these
  var canvas, renderer, scene, camera;                                 // 10-three fills these in CO.setup
  var player = null, focus = null, hudDirty = true;                    // 42-player owns player and focus; the HUD throttle flag is read everywhere

  // ── Utilities ─────────────────────────────────────────────────────
  var now = function () { return Date.now(); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var money = function (n) { return (n < 0 ? '-$' : '$') + Math.floor(Math.abs(n)).toLocaleString('en-US'); };
  var randi = function (a, b) { return a + Math.floor(Math.random() * (b - a + 1)); };
  var randf = function (a, b) { return a + Math.random() * (b - a); };
  var pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var pad2 = function (n) { return (n < 10 ? '0' : '') + n; };
  var fmtTime = function (h) { h = ((h % 24) + 24) % 24; var m = Math.floor((h % 1) * 60); return pad2(Math.floor(h)) + ':' + pad2(m); };
  var dist2 = function (ax, az, bx, bz) { var dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; };
  var uid = (function () { var n = 0; return function (p) { n++; return (p || 'id') + '-' + Date.now().toString(36) + '-' + n.toString(36); }; })();
  var mtof = function (m) { return 440 * Math.pow(2, (m - 69) / 12); };   // MIDI note to Hz, for anything that plays a tune
  // the hook bus: a game or a pack registers a function under a name, the engine calls every one in order, each inside its own try
  var HOOKS = {};
  function hook(name, fn) { (HOOKS[name] = HOOKS[name] || []).push(fn); return fn; }
  function runHooks(name, a, b, c) { var list = HOOKS[name]; if (!list) return; for (var i = 0; i < list.length; i++) { try { list[i](a, b, c); } catch (e) { if (typeof console !== 'undefined') console.error('hook ' + name + ': ' + (e && e.message || e)); } } }
  // CO.setup(cfg): the game's first part calls this once, before any part uses the scene. It reads the settings and the save slot
  // (40-state), makes the renderer, the scene, the camera, the lights and the palette (10-three), then runs the 'setup' hooks.
  // cfg.game is the game's hook object (CO.game). Function declarations are hoisted, so the parts that define the setup steps come later.
  function coSetup(cfg) { cfg = cfg || {}; CO.cfg = cfg; CO.game = cfg.game || CO.game || {}; coSetupState(cfg); if (cfg.fov === undefined && SET && SET.fov) cfg.fov = SET.fov; coSetupThree(cfg); runHooks('setup', cfg); CO.ready = true; return CO; }
  CO.setup = coSetup;
  // ── Three.js world ────────────────────────────────────────────────
  // Nothing here runs at parse time. CO.setup(cfg) makes the renderer, the scene, the camera, the sun and the sky bounce, draws
  // the base textures and builds the palette; from then on a game's parts can call box(), sign(), MAT.wall and the rest at
  // their top level. cfg (every field optional):
  //   canvas 'co-canvas'  exposure 0.82  background 0x8fb0d4  fog { color, near 70, far 190 }  fov 75  near 0.08  far 260
  //   env true (the reflection studio)  hemi { sky 0xdfeaff, ground 0x5a4d40, intensity 0.45 }
  //   sun { color 0xfff0d8, intensity 1.1, box 70, near 1, far 230, mapSize 4096, target [0, 0, -20] }  lightBudget 12  post true
  var shadowDirty = true, shadowT = 0;
  var worldTime = 0;   // seconds since boot, for anything that sways, spins or pulses
  var hemi = null, sun = null;
  var TEX = {}, NRM = {}, RGH = {}, MAT = {};

  function resize() { var w = window.innerWidth, h = window.innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }

  // Reflections: a small studio (dark shell, a few bright troffers, one warm and one cool wall) is drawn once and baked into
  // the environment map. It is dim on purpose: it is there so chrome, glass and screens have something to reflect, not to light the hall.
  function buildEnvStudio() {
    var es = new THREE.Scene();
    es.add(new THREE.Mesh(new THREE.BoxGeometry(24, 12, 24), new THREE.MeshBasicMaterial({ color: 0x0b0d0f, side: THREE.BackSide })));
    function pane(w, h, col, k, x, y, z, rx, ry) { var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k) })); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, 0); es.add(m); }
    pane(24, 24, 0x14100c, 1, 0, -5.9, 0, -Math.PI / 2); pane(24, 24, 0x141517, 1, 0, 5.9, 0, Math.PI / 2);
    [[-5, -4], [5, -4], [-5, 4], [5, 4], [0, 0]].forEach(function (p) { pane(3.0, 1.1, 0xfff4e2, 1.1, p[0], 5.8, p[1], Math.PI / 2); });
    pane(6, 4, 0xcfe4ff, 1.2, 0, 1, -11.8, 0, 0); pane(5, 3.5, 0xffd9a8, 0.9, 11.8, 0.5, 2, 0, -Math.PI / 2);
    var pm = new THREE.PMREMGenerator(renderer); pm.compileEquirectangularShader();
    try { var rt = pm.fromScene(es, 0.04); scene.environment = rt.texture; } catch (e) { /* no env map on this GPU: materials fall back to the lights */ }
    pm.dispose();
  }

  // Three.js lights every pixel with every visible point light, whether or not the light can reach it, so thirty lamps mean thirty
  // evaluations per pixel. Every point light in the scene goes in one list and only the nearest few to the camera stay visible; the
  // rest are hidden. The visible count is held constant so the shaders are not recompiled when you walk from one end of the hall
  // to the other. A lamp inside a hidden group is left alone (the renderer skips it anyway). Lamps that are off sort last.
  var lightBudget = { n: 12, lights: null, scanT: 0, tickT: 0, tmp: new THREE.Vector3(), cam: new THREE.Vector3() };
  function updateLightBudget() {
    var t = worldTime;
    if (!lightBudget.lights || t - lightBudget.scanT > 2) { var list = []; scene.traverse(function (o) { if (o.isPointLight) list.push(o); }); lightBudget.lights = list; lightBudget.scanT = t; }
    if (t - lightBudget.tickT < 0.1) return; lightBudget.tickT = t;
    camera.getWorldPosition(lightBudget.cam);
    var cand = [];
    lightBudget.lights.forEach(function (l) {
      for (var p = l.parent; p; p = p.parent) if (p.visible === false) return;
      l.getWorldPosition(lightBudget.tmp); var d = lightBudget.tmp.distanceTo(lightBudget.cam);
      l.userData.budgetScore = (l.intensity > 0 ? 0 : 1e6) + Math.max(0, d - (l.distance || 40) * 0.25) - (l.visible ? 3 : 0); cand.push(l);   // a lamp already on keeps its place: two near-equal lamps at the cut used to swap every tick
    });
    cand.sort(function (a, b) { return a.userData.budgetScore - b.userData.budgetScore; });
    for (var i = 0; i < cand.length; i++) cand[i].visible = i < lightBudget.n;
  }

  // ── Textures: every one is drawn on a canvas ──────────────────────
  function tex(w, h, draw, rx, ry) {
    var c = document.createElement('canvas'); c.width = w; c.height = h; var ctx = c.getContext('2d'); draw(ctx, w, h);
    var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx || 1, ry || 1); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; return t;
  }
  function makeAlphaTex(w, h, draw) { var c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t; }   // a cut-out sheet: transparent canvas, no repeat
  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function grain(ctx, w, h, n, alpha, dark) { for (var i = 0; i < n; i++) { var v = Math.floor(Math.random() * 255); ctx.fillStyle = 'rgba(' + (dark ? 0 : v) + ',' + (dark ? 0 : v) + ',' + (dark ? 0 : v) + ',' + alpha + ')'; ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 3); } }
  // soft blotches: water marks, oil, wear. Dark or light, a few big and many small.
  function blotches(ctx, w, h, n, rmin, rmax, dark, alpha) { for (var i = 0; i < n; i++) { var r = randf(rmin, rmax), x = Math.random() * w, y = Math.random() * h; var g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(' + (dark ? '0,0,0,' : '255,255,255,') + alpha + ')'); g.addColorStop(1, 'rgba(' + (dark ? '0,0,0,0)' : '255,255,255,0)')); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); } }
  function cracks(ctx, w, h, n, alpha) { for (var i = 0; i < n; i++) { ctx.strokeStyle = 'rgba(20,20,20,' + alpha + ')'; ctx.lineWidth = 1; ctx.beginPath(); var x = Math.random() * w, y = Math.random() * h; ctx.moveTo(x, y); for (var k = 0; k < 6; k++) { x += (Math.random() - 0.5) * 50; y += (Math.random() - 0.5) * 50; ctx.lineTo(x, y); } ctx.stroke(); } }
  // the base sheets: concrete, asphalt, cladding, plaster, brick, block, wood, grass, a few floors and fabrics. A game adds its own
  // entries to TEX by assignment, with the same helpers.
  function buildBaseTextures() {
    TEX.concrete = tex(1024, 1024, function (c, w, h) {
      c.fillStyle = '#8b8d8e'; c.fillRect(0, 0, w, h); grain(c, w, h, 26000, 0.12); grain(c, w, h, 5000, 0.08, true);
      blotches(c, w, h, 30, 40, 160, true, 0.09); blotches(c, w, h, 16, 30, 110, false, 0.07); cracks(c, w, h, 10, 0.25);
      c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, h / 2); c.lineTo(w, h / 2); c.moveTo(w / 2, 0); c.lineTo(w / 2, h); c.stroke();   // the slab joints
      for (var i = 0; i < 6; i++) { c.strokeStyle = 'rgba(30,30,30,0.18)'; c.lineWidth = randf(6, 14); c.beginPath(); var x = Math.random() * w, y = Math.random() * h; c.moveTo(x, y); c.quadraticCurveTo(x + randf(-120, 120), y + randf(-120, 120), x + randf(-260, 260), y + randf(-260, 260)); c.stroke(); }   // tyre scuffs
    }, 5, 3.5);
    TEX.asphalt = tex(1024, 1024, function (c, w, h) { c.fillStyle = '#3d3f42'; c.fillRect(0, 0, w, h); grain(c, w, h, 50000, 0.16); grain(c, w, h, 12000, 0.12, true); for (var i = 0; i < 9000; i++) { c.fillStyle = Math.random() < 0.5 ? 'rgba(120,118,112,0.35)' : 'rgba(86,84,80,0.4)'; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); } blotches(c, w, h, 10, 60, 260, true, 0.14); blotches(c, w, h, 6, 40, 160, false, 0.05); cracks(c, w, h, 16, 0.25); for (var s = 0; s < 4; s++) { c.strokeStyle = 'rgba(14,14,16,0.5)'; c.lineWidth = randf(3, 6); c.beginPath(); var x = Math.random() * w, y = Math.random() * h; c.moveTo(x, y); for (var k = 0; k < 8; k++) { x += randf(-60, 60); y += randf(-60, 60); c.lineTo(x, y); } c.stroke(); } }, 22, 22);
    TEX.corrugated = tex(512, 256, function (c, w, h) {
      c.fillStyle = '#9aa3ad'; c.fillRect(0, 0, w, h);
      for (var x = 0; x < w; x += 16) { var g = c.createLinearGradient(x, 0, x + 16, 0); g.addColorStop(0, '#7e8792'); g.addColorStop(0.5, '#b7bfc8'); g.addColorStop(1, '#7e8792'); c.fillStyle = g; c.fillRect(x, 0, 16, h); }
      grain(c, w, h, 2500, 0.06, true);
      for (var y = 24; y < h; y += 104) for (var rx = 8; rx < w; rx += 16) { c.fillStyle = 'rgba(40,45,50,0.5)'; c.beginPath(); c.arc(rx, y, 1.6, 0, 6.3); c.fill(); }   // rivet rows
      for (var i = 0; i < 8; i++) { var sx = Math.random() * w; var sg = c.createLinearGradient(0, h * 0.5, 0, h); sg.addColorStop(0, 'rgba(120,70,30,0)'); sg.addColorStop(1, 'rgba(110,60,25,0.35)'); c.fillStyle = sg; c.fillRect(sx, h * 0.5, randf(2, 6), h * 0.5); }   // rust streaks down from the fixings
    }, 8, 2);
    TEX.corrugatedDoor = tex(256, 256, function (c, w, h) { c.fillStyle = '#5d6771'; c.fillRect(0, 0, w, h); for (var y = 0; y < h; y += 20) { var g = c.createLinearGradient(0, y, 0, y + 20); g.addColorStop(0, '#4a535c'); g.addColorStop(0.5, '#7b858f'); g.addColorStop(1, '#4a535c'); c.fillStyle = g; c.fillRect(0, y, w, 20); } grain(c, w, h, 1500, 0.08, true); blotches(c, w, h, 6, 20, 60, true, 0.2); }, 2, 4);
    TEX.plaster = tex(256, 256, function (c, w, h) { c.fillStyle = '#e4e1d8'; c.fillRect(0, 0, w, h); grain(c, w, h, 2500, 0.05); blotches(c, w, h, 4, 20, 50, true, 0.05); }, 4, 2);
    TEX.wood = tex(256, 128, function (c, w, h) {
      c.fillStyle = '#b08a5a'; c.fillRect(0, 0, w, h);
      var drift = [randf(-6, 6), randf(-6, 6), randf(-6, 6)];
      for (var i = 0; i < 60; i++) { c.strokeStyle = 'rgba(80,50,20,' + (0.1 + Math.random() * 0.25) + ')'; c.lineWidth = 1 + Math.random() * 1.5; c.beginPath(); var y = Math.random() * h; c.moveTo(0, y); c.bezierCurveTo(w * 0.3, y + drift[0] + randf(-3, 3), w * 0.65, y + drift[1] + randf(-3, 3), w + 4, y + drift[2]); c.stroke(); }
      for (var p = 0; p < 500; p++) { c.fillStyle = 'rgba(60,35,10,0.18)'; c.fillRect(Math.random() * w, Math.random() * h, randf(3, 10), 1); }
      c.fillStyle = 'rgba(0,0,0,0.3)'; [0.2, 0.5, 0.8].forEach(function (f) { c.fillRect(0, h * f, w, 2); });   // the slat gaps of a pallet deck
    }, 1, 1);
    TEX.grass = tex(512, 512, function (c, w, h) { c.fillStyle = '#4f6a3a'; c.fillRect(0, 0, w, h); var cols = ['#3f6f2e', '#5c8f44', '#6f9a4a', '#45752f', '#7ea25a']; for (var i = 0; i < 3000; i++) { var x = Math.random() * w, y = Math.random() * h; c.strokeStyle = cols[i % 5]; c.lineWidth = randf(0.8, 1.6); c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + randf(-4, 4), y - randf(4, 9), x + randf(-6, 6), y - randf(8, 16)); c.stroke(); } c.fillStyle = 'rgba(70,50,30,.16)'; for (var d = 0; d < 20; d++) { c.beginPath(); c.ellipse(Math.random() * w, Math.random() * h, randf(14, 40), randf(8, 22), Math.random() * 3, 0, 6.29); c.fill(); } }, 30, 30);
    TEX.skylight = tex(64, 64, function (c, w, h) { c.fillStyle = '#eef6ff'; c.fillRect(0, 0, w, h); }, 1, 1);
    TEX.hazard = tex(128, 32, function (c, w, h) { c.fillStyle = '#f5b53d'; c.fillRect(0, 0, w, h); c.fillStyle = '#111'; for (var x = -32; x < w; x += 32) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 16, 0); c.lineTo(x + 32, h); c.lineTo(x + 16, h); c.closePath(); c.fill(); } grain(c, w, h, 300, 0.1, true); }, 4, 1);
    TEX.noiseMetal = tex(128, 128, function (c, w, h) { c.fillStyle = '#9ea4aa'; c.fillRect(0, 0, w, h); grain(c, w, h, 3000, 0.1); }, 1, 1);
    TEX.vmesh = tex(128, 256, function (c, w, h) { c.clearRect(0, 0, w, h); c.strokeStyle = 'rgba(60,96,70,1)'; c.lineWidth = 2.2; for (var vx = 4; vx < w; vx += 10) { c.beginPath(); c.moveTo(vx, 0); c.lineTo(vx, h); c.stroke(); } for (var hy = 4; hy < h; hy += 28) { c.beginPath(); c.moveTo(0, hy); c.lineTo(w, hy); c.stroke(); } }, 2, 1);
    TEX.mesh = tex(128, 128, function (c, w, h) { c.clearRect(0, 0, w, h); c.strokeStyle = 'rgba(70,75,80,0.95)'; c.lineWidth = 2; for (var i = 0; i <= w; i += 16) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + 16, h); c.stroke(); c.beginPath(); c.moveTo(i + 16, 0); c.lineTo(i, h); c.stroke(); } }, 8, 2);
    TEX.brick = tex(256, 256, function (c, w, h) { c.fillStyle = '#c9c2b4'; c.fillRect(0, 0, w, h); var cols = ['#8a4a3a', '#95553f', '#7c4335', '#9a5c45', '#874836', '#a0634c']; var bw = w / 8, bh = h / 8; for (var r = 0; r < 8; r++) for (var k = -1; k < 9; k++) { var x = k * bw + (r % 2 ? bw / 2 : 0); c.fillStyle = pick(cols); c.fillRect(x + 2, r * bh + 2, bw - 4, bh - 4); } grain(c, w, h, 6000, 0.2); }, 2, 0.6);
    TEX.paper = tex(128, 128, function (c, w, h) { c.fillStyle = '#f3efe4'; c.fillRect(0, 0, w, h); grain(c, w, h, 800, 0.05); }, 1, 1);
    TEX.cork = tex(256, 256, function (c, w, h) { c.fillStyle = '#b8905c'; c.fillRect(0, 0, w, h); grain(c, w, h, 8000, 0.25); blotches(c, w, h, 60, 3, 10, true, 0.3); }, 1, 1);
    TEX.fabric = tex(128, 128, function (c, w, h) { c.fillStyle = '#2f4a73'; c.fillRect(0, 0, w, h); grain(c, w, h, 4000, 0.12); }, 1, 1);
    TEX.cloth = tex(128, 128, function (c, w, h) { c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h); for (var y = 0; y < h; y += 2) for (var x = 0; x < w; x += 2) { c.fillStyle = 'rgba(0,0,0,' + (((x + y) / 2) % 2 ? 0.14 : 0.04) + ')'; c.fillRect(x, y, 2, 2); } }, 6, 6);   // a white weave that takes whatever colour a shirt is given
    TEX.rubberMat = tex(128, 128, function (c, w, h) { c.fillStyle = '#1b1d20'; c.fillRect(0, 0, w, h); c.fillStyle = '#24272b'; for (var y = 0; y < h; y += 16) for (var x = 0; x < w; x += 16) { c.beginPath(); c.arc(x + 8, y + 8, 5, 0, 6.3); c.fill(); } }, 6, 6);
    // painted blockwork: four courses of 400 x 200 blocks in a sheet 1.6 by 0.8 m, grey paint over grey block, a few blocks a shade off
    TEX.block = tex(512, 256, function (c, w, h) { c.fillStyle = '#6e7276'; c.fillRect(0, 0, w, h); var bw = w / 4, bh = h / 4; for (var r = 0; r < 4; r++) for (var k = -1; k < 5; k++) { var x = k * bw + (r % 2 ? bw / 2 : 0); c.fillStyle = pick(['#9a9c9a', '#959895', '#9fa19e', '#929592', '#9c9e9b']); c.fillRect(x + 3, r * bh + 3, bw - 6, bh - 6); } grain(c, w, h, 5000, 0.08); blotches(c, w, h, 10, 20, 70, true, 0.08); for (var i = 0; i < 40; i++) { c.fillStyle = 'rgba(40,40,42,' + randf(0.05, 0.2) + ')'; c.fillRect(Math.random() * w, h * 0.7 + Math.random() * h * 0.3, randf(2, 10), randf(2, 5)); } }, 1, 1);
    // carpet tile for an office: half-metre tiles in a blue-grey loop pile, the joints just showing, laid chequerboard
    TEX.carpet = tex(256, 256, function (c, w, h) { c.fillStyle = '#3f4857'; c.fillRect(0, 0, w, h); for (var ty = 0; ty < 2; ty++) for (var tx = 0; tx < 2; tx++) { c.fillStyle = (tx + ty) % 2 ? '#404a5a' : '#3b4453'; c.fillRect(tx * 128 + 1, ty * 128 + 1, 126, 126); } grain(c, w, h, 14000, 0.1); for (var y = 0; y < h; y += 3) { c.fillStyle = 'rgba(255,255,255,0.025)'; c.fillRect(0, y, w, 1); } }, 1, 1);
    // vinyl sheet: a pale speckled floor with a faint weld line every 1.5 m
    TEX.vinyl = tex(256, 256, function (c, w, h) { c.fillStyle = '#c9c6bd'; c.fillRect(0, 0, w, h); for (var i = 0; i < 9000; i++) { c.fillStyle = pick(['rgba(90,86,80,0.35)', 'rgba(255,255,255,0.3)', 'rgba(120,110,100,0.25)']); c.fillRect(Math.random() * w, Math.random() * h, randf(1, 3), randf(1, 3)); } blotches(c, w, h, 6, 30, 90, true, 0.05); c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(0, h / 2 - 1, w, 2); }, 1, 1);
    // a ceiling tile for rooms, and a plain lining for the inside of a trailer or a container
    TEX.tile = tex(256, 256, function (c, w, h) { c.fillStyle = '#e9e9e4'; c.fillRect(0, 0, w, h); grain(c, w, h, 3000, 0.05, true); c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 3; c.strokeRect(1.5, 1.5, w - 3, h - 3); c.beginPath(); c.moveTo(w / 2, 0); c.lineTo(w / 2, h); c.stroke(); }, 6, 4);
    TEX.lining = tex(256, 256, function (c, w, h) { c.fillStyle = '#c9cdd1'; c.fillRect(0, 0, w, h); grain(c, w, h, 2500, 0.08); for (var y = 0; y < h; y += 64) { c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(0, y, w, 3); } for (var i = 0; i < 24; i++) { c.fillStyle = 'rgba(0,0,0,' + randf(0.05, 0.18) + ')'; c.fillRect(Math.random() * w, Math.random() * h, randf(10, 40), randf(2, 6)); } }, 6, 2);
  }
  // a sign on the house slate (#1b232c) is an enamelled plate: the slate shades a little towards the bottom, a hairline of
  // light sits just in from the edge and a hairline of the sign's own colour inside that. opt.plate false turns that off (paint)
  function isPlate(opt) { return !!opt && opt.plate !== false && (opt.plate === true || opt.bg === '#1b232c'); }
  function textTex(lines, opt) {
    opt = opt || {}; var w = opt.w || 512, h = opt.h || 128, plate = isPlate(opt);
    return tex(w, h, function (c) {
      if (plate) { var g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#222c38'); g.addColorStop(1, '#10161d'); c.fillStyle = g; c.fillRect(0, 0, w, h); var e = Math.max(2, Math.round(Math.min(w, h) * 0.02)); c.strokeStyle = 'rgba(255,255,255,0.14)'; c.lineWidth = e; c.strokeRect(e / 2, e / 2, w - e, h - e); c.strokeStyle = opt.fg || '#f5b53d'; c.globalAlpha = 0.5; c.lineWidth = Math.max(1, e * 0.6); c.strokeRect(e * 3, e * 3, w - e * 6, h - e * 6); c.globalAlpha = 1; }
      else { c.fillStyle = opt.bg || '#1b232c'; c.fillRect(0, 0, w, h); }
      if (opt.border) { c.strokeStyle = opt.border; c.lineWidth = 8; c.strokeRect(4, 4, w - 8, h - 8); }
      c.fillStyle = opt.fg || '#f5b53d'; c.textAlign = 'center'; c.textBaseline = 'middle';
      var size = opt.size || Math.min(h * 0.6, w / (Math.max.apply(null, lines.map(function (l) { return l.length; })) * 0.6));
      c.font = (opt.weight || 'bold') + ' ' + Math.floor(size) + 'px ' + (opt.font || 'Bahnschrift, Arial, sans-serif');
      if (plate) { c.shadowColor = 'rgba(0,0,0,0.6)'; c.shadowBlur = Math.max(2, size * 0.08); c.shadowOffsetY = Math.max(1, size * 0.04); }
      lines.forEach(function (l, i) { c.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * size * 1.15, w * 0.92); });   // never off the plate
      c.shadowColor = 'rgba(0,0,0,0)'; c.shadowBlur = 0; c.shadowOffsetY = 0;
    });
  }
  // normal maps: a height field drawn on a canvas, turned into tangent-space normals with a Sobel filter. Linear, never sRGB.
  function normalTex(w, h, drawHeight, strength, rx, ry) {
    var hc = document.createElement('canvas'); hc.width = w; hc.height = h; var hx = hc.getContext('2d'); drawHeight(hx, w, h);
    var src = hx.getImageData(0, 0, w, h).data, out = hx.createImageData(w, h), o = out.data, s = strength || 1;
    var at = function (x, y) { x = (x + w) % w; y = (y + h) % h; return src[(y * w + x) * 4] / 255; };
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var dx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
      var dy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
      var nx = -dx * s, ny = -dy * s, nz = 1, len = Math.sqrt(nx * nx + ny * ny + nz * nz), i = (y * w + x) * 4;
      o[i] = (nx / len * 0.5 + 0.5) * 255; o[i + 1] = (ny / len * 0.5 + 0.5) * 255; o[i + 2] = (nz / len * 0.5 + 0.5) * 255; o[i + 3] = 255;
    }
    hx.putImageData(out, 0, 0);
    var t = new THREE.CanvasTexture(hc); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx || 1, ry || 1); t.anisotropy = 8; return t;
  }
  function heightNoise(c, w, h, base, n, amp) { c.fillStyle = base; c.fillRect(0, 0, w, h); for (var i = 0; i < n; i++) { var v = Math.floor(128 + (Math.random() - 0.5) * amp); c.fillStyle = 'rgba(' + v + ',' + v + ',' + v + ',0.6)'; c.fillRect(Math.random() * w, Math.random() * h, randf(1, 4), randf(1, 4)); } }
  function buildBaseNormals() {
    NRM.concrete = normalTex(512, 512, function (c, w, h) { heightNoise(c, w, h, '#808080', 14000, 90); for (var i = 0; i < 20; i++) { var r = randf(20, 90), x = Math.random() * w, y = Math.random() * h, g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(60,60,60,0.5)'); g.addColorStop(1, 'rgba(128,128,128,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); } c.strokeStyle = '#303030'; c.lineWidth = 4; c.beginPath(); c.moveTo(0, h / 2); c.lineTo(w, h / 2); c.moveTo(w / 2, 0); c.lineTo(w / 2, h); c.stroke(); }, 1.6, 5, 3.5);
    NRM.corrugated = normalTex(256, 128, function (c, w, h) { for (var x = 0; x < w; x++) { var v = Math.floor(128 + Math.sin(x / 16 * Math.PI * 2) * 90); c.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; c.fillRect(x, 0, 1, h); } for (var y = 12; y < h; y += 52) for (var rx = 8; rx < w; rx += 16) { c.fillStyle = '#404040'; c.beginPath(); c.arc(rx, y, 2.2, 0, 6.3); c.fill(); } }, 2.2, 8, 2);
    NRM.ribs = normalTex(128, 256, function (c, w, h) { for (var y = 0; y < h; y++) { var v = Math.floor(128 + Math.sin(y / 20 * Math.PI * 2) * 100); c.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; c.fillRect(0, y, w, 1); } }, 2.0, 2, 4);
    NRM.asphalt = normalTex(512, 512, function (c, w, h) { heightNoise(c, w, h, '#808080', 40000, 120); }, 1.2, 22, 22);
    NRM.plaster = normalTex(256, 256, function (c, w, h) { heightNoise(c, w, h, '#808080', 3000, 40); }, 0.8, 4, 2);
    NRM.brick = normalTex(256, 256, function (c, w, h) { c.fillStyle = '#a0a0a0'; c.fillRect(0, 0, w, h); var bw = w / 8, bh = h / 8; for (var r = 0; r < 8; r++) for (var k = -1; k < 9; k++) { var x = k * bw + (r % 2 ? bw / 2 : 0); c.fillStyle = '#404040'; c.fillRect(x, r * bh, bw, bh); c.fillStyle = '#a8a8a8'; c.fillRect(x + 2, r * bh + 2, bw - 4, bh - 4); } heightNoise(c, w, h, 'rgba(0,0,0,0)', 2000, 30); }, 1.8, 2, 0.6);
    NRM.wood = normalTex(256, 128, function (c, w, h) { c.fillStyle = '#808080'; c.fillRect(0, 0, w, h); for (var i = 0; i < 70; i++) { var y = Math.random() * h; c.strokeStyle = 'rgba(40,40,40,' + randf(0.2, 0.6) + ')'; c.lineWidth = randf(1, 2); c.beginPath(); c.moveTo(0, y); c.bezierCurveTo(w * 0.3, y + randf(-4, 4), w * 0.7, y + randf(-4, 4), w, y); c.stroke(); } c.fillStyle = '#202020'; [0.2, 0.5, 0.8].forEach(function (f) { c.fillRect(0, h * f, w, 3); }); }, 1.2, 1, 1);
    NRM.cardboard = normalTex(256, 256, function (c, w, h) { heightNoise(c, w, h, '#808080', 2500, 30); c.fillStyle = '#505050'; c.fillRect(0, h * 0.48, w, 4); c.fillStyle = '#9a9a9a'; c.fillRect(w * 0.44, 0, w * 0.12, h); c.fillStyle = '#8c8c8c'; c.fillRect(w * 0.08, h * 0.08, w * 0.34, h * 0.3); for (var i = 0; i < h; i += 6) { c.fillStyle = 'rgba(100,100,100,0.25)'; c.fillRect(0, i, w, 1); } }, 1.0, 1, 1);
    NRM.chequer = normalTex(128, 128, function (c, w, h) { c.fillStyle = '#808080'; c.fillRect(0, 0, w, h); for (var y = 0; y < h; y += 32) for (var x = 0; x < w; x += 32) { var d = ((x + y) / 32) % 2; c.save(); c.translate(x + 16, y + 16); c.rotate(d ? 0.5 : -0.5); c.fillStyle = '#c0c0c0'; c.fillRect(-10, -3, 20, 6); c.restore(); } }, 1.5, 3, 3);
    NRM.rubber = normalTex(128, 128, function (c, w, h) { c.fillStyle = '#808080'; c.fillRect(0, 0, w, h); for (var y = 0; y < h; y += 16) for (var x = 0; x < w; x += 16) { c.fillStyle = '#b0b0b0'; c.beginPath(); c.arc(x + 8, y + 8, 5, 0, 6.3); c.fill(); } }, 1.2, 6, 6);
    NRM.block = normalTex(512, 256, function (c, w, h) { c.fillStyle = '#505050'; c.fillRect(0, 0, w, h); var bw = w / 4, bh = h / 4; for (var r = 0; r < 4; r++) for (var k = -1; k < 5; k++) { var x = k * bw + (r % 2 ? bw / 2 : 0); c.fillStyle = '#9a9a9a'; c.fillRect(x + 3, r * bh + 3, bw - 6, bh - 6); } heightNoise(c, w, h, 'rgba(0,0,0,0)', 3000, 30); }, 1.6, 1, 1);
    NRM.carpet = normalTex(256, 256, function (c, w, h) { heightNoise(c, w, h, '#808080', 6000, 50); c.fillStyle = '#606060'; c.fillRect(0, 127, w, 2); c.fillRect(127, 0, 2, h); }, 0.9, 1, 1);
  }
  function roughTex(w, h, base, amp, rx, ry) { var t = tex(w, h, function (c) { var v = Math.floor(base * 255); c.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; c.fillRect(0, 0, w, h); for (var i = 0; i < 4000; i++) { var k = Math.floor(v + (Math.random() - 0.5) * amp * 255); c.fillStyle = 'rgba(' + k + ',' + k + ',' + k + ',0.7)'; c.fillRect(Math.random() * w, Math.random() * h, randf(1, 6), randf(1, 6)); } for (var j = 0; j < 12; j++) { var r = randf(10, 50), x = Math.random() * w, y = Math.random() * h, g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(' + Math.floor(v - amp * 120) + ',' + Math.floor(v - amp * 120) + ',' + Math.floor(v - amp * 120) + ',0.8)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); } }, rx, ry); t.encoding = THREE.LinearEncoding; return t; }

  // ── Materials ─────────────────────────────────────────────────────
  // the environment map is for reflections only: every lit material takes very little light from it
  function dimEnv(m) { if (m && m.isMeshStandardMaterial) m.envMapIntensity = m.isMeshPhysicalMaterial ? 0.45 : (m.metalness > 0.5 ? 0.4 : 0.22); return m; }
  var std = function (o) { return dimEnv(new THREE.MeshStandardMaterial(o)); };
  function glowMat(col, k) { var m = std({ color: 0x111111, emissive: col, emissiveIntensity: k || 1, roughness: 0.4 }); m.userData.glow = true; return m; }
  function buildBasePalette() {
    RGH.floor = roughTex(256, 256, 0.9, 0.25, 5, 3.5); RGH.paint = roughTex(256, 256, 0.45, 0.35, 1, 1); RGH.metal = roughTex(256, 256, 0.5, 0.3, 1, 1);
    var V2 = function (a, b) { return new THREE.Vector2(a, b); };
    MAT.floor = std({ map: TEX.concrete, roughness: 0.92, metalness: 0.03, normalMap: NRM.concrete, normalScale: V2(0.7, 0.7), roughnessMap: RGH.floor });
    MAT.yard = std({ map: TEX.asphalt, roughness: 0.95, normalMap: NRM.asphalt, normalScale: V2(0.6, 0.6) });
    MAT.grass = std({ map: TEX.grass, roughness: 1 });
    MAT.wall = std({ map: TEX.corrugated, roughness: 0.55, metalness: 0.4, normalMap: NRM.corrugated, normalScale: V2(1, 1), roughnessMap: RGH.metal });
    MAT.wallIn = std({ map: TEX.corrugated, roughness: 0.65, metalness: 0.3, color: 0xcfd6dd, normalMap: NRM.corrugated, normalScale: V2(1, 1) });
    MAT.roof = std({ color: 0x3b4249, roughness: 0.9 });
    MAT.roofIn = std({ color: 0x5c6670, roughness: 0.9 });   // the plane is turned to face down, so its front is what you see from the floor
    MAT.door = std({ map: TEX.corrugatedDoor, roughness: 0.55, metalness: 0.4, normalMap: NRM.ribs, normalScale: V2(1, 1) });
    MAT.plaster = std({ map: TEX.plaster, roughness: 0.9, normalMap: NRM.plaster, normalScale: V2(0.4, 0.4) });
    MAT.brick = std({ map: TEX.brick, roughness: 0.95, normalMap: NRM.brick, normalScale: V2(0.9, 0.9) });
    MAT.block = std({ map: TEX.block, roughness: 0.9, normalMap: NRM.block, normalScale: V2(0.8, 0.8) });
    MAT.carpet = std({ map: TEX.carpet, roughness: 1, normalMap: NRM.carpet, normalScale: V2(0.4, 0.4) });
    MAT.vinyl = std({ map: TEX.vinyl, roughness: 0.45, metalness: 0.02 });
    MAT.gunmetal = std({ color: 0x4a5058, roughness: 0.38, metalness: 0.85, map: TEX.noiseMetal });
    MAT.rack = std({ color: 0xcf6417, roughness: 0.55, metalness: 0.3, roughnessMap: RGH.paint });
    MAT.beam = std({ color: 0x2b5aa6, roughness: 0.5, metalness: 0.4 });
    MAT.deck = std({ color: 0x6a737c, roughness: 0.7, metalness: 0.5 });
    MAT.wood = std({ map: TEX.wood, roughness: 0.85, normalMap: NRM.wood, normalScale: V2(0.6, 0.6) });
    MAT.steel = std({ map: TEX.noiseMetal, roughness: 0.45, metalness: 0.6 });
    MAT.steelDark = std({ color: 0x3a3f45, roughness: 0.5, metalness: 0.6 });
    MAT.chrome = std({ color: 0xd8dde3, roughness: 0.18, metalness: 0.95 });
    MAT.black = std({ color: 0x15171a, roughness: 0.8 });
    MAT.plastic = std({ color: 0x2a2d33, roughness: 0.6 });
    MAT.rubber = std({ color: 0x1d1f22, roughness: 0.95 });
    MAT.rubberMat = std({ map: TEX.rubberMat, roughness: 0.95, normalMap: NRM.rubber, normalScale: V2(0.8, 0.8) });
    MAT.chequer = std({ color: 0x8e959c, roughness: 0.45, metalness: 0.7, normalMap: NRM.chequer, normalScale: V2(1, 1) });
    MAT.yellow = std({ color: 0xf5b53d, roughness: 0.6 });
    MAT.yellowLine = new THREE.MeshBasicMaterial({ color: 0xd9a12c });
    MAT.whiteLine = new THREE.MeshBasicMaterial({ color: 0xd8dbdf });
    MAT.hazard = std({ map: TEX.hazard, roughness: 0.6 });
    MAT.mesh = std({ map: TEX.mesh, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.5 });
    MAT.red = std({ color: 0xc8342a, roughness: 0.6 });
    MAT.green = std({ color: 0x2f9e44, roughness: 0.6 });
    MAT.blue = std({ color: 0x2f6fb3, roughness: 0.6 });
    MAT.white = std({ color: 0xf0f0f0, roughness: 0.6 });
    MAT.grey = std({ color: 0x8c949c, roughness: 0.7 });
    MAT.trim = std({ color: 0xf2efe6, roughness: 0.8 });
    MAT.paper = std({ map: TEX.paper, roughness: 0.95 });
    MAT.cork = std({ map: TEX.cork, roughness: 0.95 });
    MAT.fabric = std({ map: TEX.fabric, roughness: 1 });
    MAT.screen = new THREE.MeshBasicMaterial({ color: 0x0d1216 }); MAT.screen.userData.noBake = true;
    MAT.screenGlass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, depthWrite: false });
    MAT.skylight = new THREE.MeshBasicMaterial({ map: TEX.skylight });
    MAT.lamp = new THREE.MeshBasicMaterial({ color: 0xfff6e4 });
    MAT.exit = new THREE.MeshBasicMaterial({ color: 0x5fd38d }); MAT.exit.userData.noBake = true;
    MAT.glass = std({ color: 0xa9c7e8, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.3 });
    MAT.tile = std({ map: TEX.tile, roughness: 0.95 });
    MAT.lining = std({ map: TEX.lining, roughness: 0.8, metalness: 0.15 });
    MAT.skin = std({ color: 0xd9a98a, roughness: 0.8 });
    MAT.hivis = std({ color: 0xf6c21b, roughness: 0.8 });
    MAT.hivisOrange = std({ color: 0xf07a1a, roughness: 0.8 });
    MAT.jeans = std({ color: 0x2e3f63, roughness: 0.95 });
    MAT.hair = std({ color: 0x3a2a1c, roughness: 0.95 });
    MAT.hit = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }); MAT.hit.userData.noBake = true;
  }

  // ── Geometry helpers ──────────────────────────────────────────────
  var geoCache = {};
  function boxGeo(w, h, d) { var k = w + ',' + h + ',' + d; return geoCache[k] || (geoCache[k] = new THREE.BoxGeometry(w, h, d)); }
  // A box with every edge eased: a dead sharp edge catches no light and reads as cardboard. The rows of vertices nearest each edge
  // are moved onto an arc, spaced so the corner turns in equal angles, and the normals follow; the texture keeps its scale (the
  // picture did not move, only the rows). Thinner than 30 mm or longer than 4 m stays sharp unless a radius is asked for.
  var BEVEL = { on: true, max: 0.012, faces: [['z', 'y', -1, -1], ['z', 'y', 1, -1], ['x', 'z', 1, 1], ['x', 'z', 1, -1], ['x', 'y', 1, -1], ['x', 'y', -1, -1]] };
  function bevelGeo(w, h, d, r, k) {
    var mn = Math.min(w, h, d), mx = Math.max(w, h, d);
    if (r === undefined) r = (!BEVEL.on || mn < 0.03 || mx > 4) ? 0 : Math.min(BEVEL.max, mn * 0.22);
    if (!(r > 0) || !(mn > 0)) return boxGeo(w, h, d);
    r = Math.min(r, mn * 0.499); k = Math.max(1, Math.round(k || (r > 0.03 ? 3 : r > 0.015 ? 2 : 1)));   /* a big radius needs more than one step to read as round */
    var key = 'b' + w + ',' + h + ',' + d + ',' + r + ',' + k; if (geoCache[key]) return geoCache[key];
    var n = 2 * k + 1, per = (n + 1) * (n + 1), g = new THREE.BoxGeometry(w, h, d, n, n, n), pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv, half = { x: w / 2, y: h / 2, z: d / 2 }, v = new THREE.Vector3(), c = new THREE.Vector3();
    function ax(p, hf) { var i = Math.round((p + hf) / (2 * hf) * n); return i <= k ? -hf + r - r * Math.tan((k - i) / k * Math.PI / 4) : hf - r + r * Math.tan((i - (n - k)) / k * Math.PI / 4); }
    for (var i = 0; i < pos.count; i++) {
      v.set(ax(pos.getX(i), half.x), ax(pos.getY(i), half.y), ax(pos.getZ(i), half.z));
      var fc = BEVEL.faces[Math.floor(i / per)]; uv.setXY(i, (v[fc[0]] * fc[2] + half[fc[0]]) / (2 * half[fc[0]]), 1 - (v[fc[1]] * fc[3] + half[fc[1]]) / (2 * half[fc[1]]));
      c.set(clamp(v.x, -half.x + r, half.x - r), clamp(v.y, -half.y + r, half.y - r), clamp(v.z, -half.z + r, half.z - r));
      v.sub(c); if (v.lengthSq() > 1e-12) { v.normalize(); nor.setXYZ(i, v.x, v.y, v.z); pos.setXYZ(i, c.x + v.x * r, c.y + v.y * r, c.z + v.z * r); }
    }
    return (geoCache[key] = g);
  }
  // a body part cut from an eased box: narrower at one end than the other, the way a chest runs down to a waist. Give it a fresh geometry.
  function taperGeo(g, h, sx0, sz0) { var p = g.attributes.position; for (var i = 0; i < p.count; i++) { var t = clamp((p.getY(i) + h / 2) / h, 0, 1); p.setX(i, p.getX(i) * lerp(sx0, 1, t)); p.setZ(i, p.getZ(i) * lerp(sz0, 1, t)); } g.computeVertexNormals(); return g; }
  // The same for anything turned: a cylinder's rims are eased and it gets enough sides to read as round. Wires and rods are left alone.
  function roundCylGeo(rt, rb, h, seg) {
    var rmax = Math.max(rt, rb), rmin = Math.min(rt, rb), r = (!BEVEL.on || rmax < 0.025 || h < 0.02) ? 0 : Math.min(BEVEL.max, h * 0.22, rmin * 0.3);
    seg = seg || 18; if (rmax >= 0.025) seg = Math.max(seg, rmax > 0.12 ? 32 : rmax > 0.05 ? 24 : 16);
    var key = 'c' + rt + ',' + rb + ',' + h + ',' + seg + (r > 0.0012 ? '' : 's'); if (geoCache[key]) return geoCache[key];
    if (!(r > 0.0012)) return (geoCache[key] = new THREE.CylinderGeometry(rt, rb, h, seg));
    var g = new THREE.CylinderGeometry(rt, rb, h, seg, 3), pos = g.attributes.position, nor = g.attributes.normal, row = seg + 1, torso = 4 * row, slope = (rb - rt) / h;
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i), z = pos.getZ(i), top = pos.getY(i) > 0, len = Math.hypot(x, z) || 1, ux = x / len, uz = z / len, rad, y;
      if (i < torso) {
        var rw = Math.floor(i / row);
        if (rw === 0) { rad = rt - r; y = h / 2; } else if (rw === 1) { rad = rt + slope * r; y = h / 2 - r; } else if (rw === 2) { rad = rb - slope * r; y = -h / 2 + r; } else { rad = rb - r; y = -h / 2; }
        if (rw === 0 || rw === 3) { var ny = rw === 0 ? 0.7071 : -0.7071; nor.setXYZ(i, nor.getX(i) * 0.7071, ny, nor.getZ(i) * 0.7071); var nl = Math.hypot(nor.getX(i), nor.getY(i), nor.getZ(i)) || 1; nor.setXYZ(i, nor.getX(i) / nl, nor.getY(i) / nl, nor.getZ(i) / nl); }
        pos.setXYZ(i, ux * rad, y, uz * rad);
      } else if (len > 1e-6) { rad = (top ? rt : rb) - r; pos.setXYZ(i, ux * rad, pos.getY(i), uz * rad); }
    }
    return (geoCache[key] = g);
  }
  // ── Placers: a mesh made, placed and parented in one call. The default parent is CO.root, else the scene ──
  function parentOf(p) { return p || CO.root || scene; }
  function box(w, h, d, mat, x, y, z, parent) {
    var m = new THREE.Mesh(mat.map ? boxGeo(w, h, d) : bevelGeo(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parentOf(parent).add(m); return m;
  }
  function plane(w, h, mat, x, y, z, rx, ry, parent) {
    var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.x = rx || 0; m.rotation.y = ry || 0; m.receiveShadow = true; parentOf(parent).add(m); return m;
  }
  function cyl(r, h, mat, x, y, z, parent, seg, rb) { var m = new THREE.Mesh(roundCylGeo(r, rb === undefined ? r : rb, h, seg || 12), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parentOf(parent).add(m); return m; }
  function sphere(r, mat, x, y, z, parent) { var m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), mat); m.position.set(x, y, z); m.castShadow = true; parentOf(parent).add(m); return m; }
  function sprite(mat, x, y, z, sx, sy, parent) { var m = new THREE.Sprite(mat); m.position.set(x, y, z); m.scale.set(sx || 1, sy || sx || 1, 1); parentOf(parent).add(m); return m; }
  function sign(lines, w, h, x, y, z, ry, opt, parent) {
    var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: textTex(lines, opt) })); m.position.set(x, y, z); m.rotation.y = ry || 0; parentOf(parent).add(m);
    // an enamelled plate is fixed to something: a sheet of dark metal a little bigger than the print behind it, and on a plate
    // big enough, four studs through the corners. Hung on the sign's own mesh, so whatever moves the sign moves its plate.
    if (isPlate(opt) && !(opt && opt.flat)) { var pl = new THREE.Mesh(bevelGeo(w + 0.03, h + 0.03, 0.014, 0.004), MAT.gunmetal); pl.position.z = -0.0085; pl.castShadow = true; m.add(pl); if (w >= 0.5 && h >= 0.12) [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) { var st = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.006, 10), MAT.chrome); st.rotation.x = Math.PI / 2; st.position.set(s[0] * (w / 2 - 0.028), s[1] * (h / 2 - 0.028), 0.003); m.add(st); }); }
    return m;
  }
  // a soft dark blob on the ground under anything that stands on it: the contact shadow the sun map cannot give
  var blobTex = null, blobMat = null;
  function groundBlob(w, d, x, z, parent, y) {
    if (!blobMat) { blobTex = tex(128, 128, function (c, w2, h2) { c.clearRect(0, 0, w2, h2); var g = c.createRadialGradient(64, 64, 6, 64, 64, 62); g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(0.55, 'rgba(0,0,0,0.28)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, w2, h2); }); blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 1 }); blobMat.userData.noBake = true; }
    var m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), blobMat); m.rotation.x = -Math.PI / 2; m.position.set(x, (y || 0) + 0.006, z); m.renderOrder = 1; m.receiveShadow = false; m.userData.noBake = true; parentOf(parent).add(m); return m;
  }
  // things the player can look at and press E on
  var inter = [];
  function addInter(mesh, def) { mesh.userData.it = def; inter.push(mesh); return mesh; }
  function hitBox(w, h, d, x, y, z, def, parent) { var m = new THREE.Mesh(boxGeo(w, h, d), MAT.hit); m.position.set(x, y, z); parentOf(parent).add(m); return addInter(m, def); }
  // things the player cannot walk through: axis-aligned boxes in world space
  var solids = [], dyn = [];
  function solid(x0, x1, z0, z1, y0, y1) { solids.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), y0: y0 === undefined ? -5 : y0, y1: y1 === undefined ? 9 : y1 }); }
  var _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s1 = new THREE.Vector3(1, 1, 1), _e = new THREE.Euler();
  // things that move every frame: { update: function (dt) }
  var animated = [];
  function animate(fn) { animated.push(fn); }
  // frees a subtree's GPU buffers. Materials and geometries in KEEP (the palette, the caches, anything shared) are left alone.
  var KEEP = [];
  function keepShared(x) { if (KEEP.indexOf(x) < 0) KEEP.push(x); return x; }
  function disposeTree(root) {
    root.traverse(function (o) {
      if (o.geometry && KEEP.indexOf(o.geometry) < 0) { var cached = false; for (var k in geoCache) if (geoCache[k] === o.geometry) { cached = true; break; } if (!cached) o.geometry.dispose(); }
      var mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      mats.forEach(function (m) { var shared = KEEP.indexOf(m) >= 0; if (!shared) for (var k2 in MAT) if (MAT[k2] === m) { shared = true; break; } if (!shared && m.map && m.map.userData && m.map.userData.shared) shared = true; if (!shared) m.dispose(); });
    });
  }
  function clearKids(g) { while (g.children.length) { var ch = g.children[0]; g.remove(ch); disposeTree(ch); } }
  // a short-lived burst of particles: sparks, dust, water, cardboard chips
  var bursts = [];
  function burst(x, y, z, col, n, mode) {
    n = n || 20; var geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), vel = [];
    for (var i = 0; i < n; i++) { pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; var a = Math.random() * 6.28, s = randf(0.6, 2.2); vel.push({ x: Math.cos(a) * s * (mode === 'up' ? 0.3 : 1), y: mode === 'up' ? randf(1.5, 3) : mode === 'down' ? -randf(0.5, 1.5) : randf(0.5, 2.5), z: Math.sin(a) * s * (mode === 'up' ? 0.3 : 1) }); }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var mat = new THREE.PointsMaterial({ color: col, size: mode === 'smoke' ? 0.12 : 0.05, transparent: true, opacity: 0.9, depthWrite: false });
    var pts = new THREE.Points(geo, mat); scene.add(pts);
    bursts.push({ pts: pts, vel: vel, t: 0, life: mode === 'smoke' ? 2.4 : 1.1, mode: mode });
  }
  function tickBursts(dt) {
    for (var i = bursts.length - 1; i >= 0; i--) {
      var b = bursts[i]; b.t += dt; var p = b.pts.geometry.attributes.position.array;
      for (var k = 0; k < b.vel.length; k++) { var v = b.vel[k]; if (b.mode !== 'smoke') v.y -= 6 * dt; else v.y += 0.4 * dt; p[k * 3] += v.x * dt; p[k * 3 + 1] += v.y * dt; p[k * 3 + 2] += v.z * dt; if (p[k * 3 + 1] < 0.02 && b.mode !== 'smoke') { p[k * 3 + 1] = 0.02; v.y = -v.y * 0.4; v.x *= 0.6; v.z *= 0.6; } }
      b.pts.geometry.attributes.position.needsUpdate = true; b.pts.material.opacity = 0.9 * (1 - b.t / b.life);
      if (b.t >= b.life) { scene.remove(b.pts); b.pts.geometry.dispose(); b.pts.material.dispose(); bursts.splice(i, 1); }
    }
  }

  // ── Post-processing: the scene renders to a texture, then one full-screen quad applies grading, vignette and grain ──
  var post = { rt: null, quad: null, mat: null, cam: null, scene: null, on: true, t: 0, calls: 0 };
  function buildPost() {
    post.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); post.scene = new THREE.Scene();
    post.mat = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVignette: { value: 0.42 }, uGrain: { value: 0.035 }, uSat: { value: 1.08 }, uContrast: { value: 1.06 }, uLift: { value: 0.012 }, uFlash: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: [
        'uniform sampler2D tDiffuse; uniform float uTime, uVignette, uGrain, uSat, uContrast, uLift, uFlash; varying vec2 vUv;',
        'float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }',
        'void main() {',
        '  vec2 uv = vUv; vec2 d = uv - 0.5;',
        '  float ca = 0.0012 * dot(d, d) * 4.0;',
        '  vec3 c; c.r = texture2D(tDiffuse, uv + d * ca).r; c.g = texture2D(tDiffuse, uv).g; c.b = texture2D(tDiffuse, uv - d * ca).b;',
        '  float l = dot(c, vec3(0.299, 0.587, 0.114)); c = mix(vec3(l), c, uSat);',
        '  c = (c - 0.5) * uContrast + 0.5 + uLift;',
        '  float v = smoothstep(0.95, 0.25, length(d) * 1.15); c *= mix(1.0 - uVignette, 1.0, v);',
        '  c += (hash(uv * 1000.0 + fract(uTime)) - 0.5) * uGrain * (1.0 - l * 0.6);',
        '  c += uFlash;',
        '  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);',
        '}'].join('\n'),
      depthTest: false, depthWrite: false
    });
    post.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post.mat); post.scene.add(post.quad);
  }
  function postResize() { var w = Math.floor(window.innerWidth * renderer.getPixelRatio()), h = Math.floor(window.innerHeight * renderer.getPixelRatio()); if (post.rt) post.rt.dispose(); post.rt = new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, encoding: THREE.sRGBEncoding }); post.rt.samples = 0; }
  function lowQuality() { return typeof SET === 'object' && !!SET && SET.quality === 'low'; }
  function renderFrame(dt) {
    if (!post.on || !post.mat || lowQuality()) { renderer.setRenderTarget(null); renderer.render(scene, camera); post.calls = renderer.info.render.calls; return; }
    if (!post.rt || post.rt.width !== Math.floor(window.innerWidth * renderer.getPixelRatio())) postResize();
    post.t += dt; post.mat.uniforms.uTime.value = post.t; post.mat.uniforms.tDiffuse.value = post.rt.texture; post.mat.uniforms.uFlash.value = CO.flash * 0.25;
    renderer.setRenderTarget(post.rt); renderer.render(scene, camera); post.calls = renderer.info.render.calls;
    renderer.setRenderTarget(null); renderer.render(post.scene, post.cam);
  }

  // ── Setup ─────────────────────────────────────────────────────────
  function coSetupThree(cfg) {
    cfg = cfg || {};
    canvas = $(cfg.canvas || 'co-canvas');
    if (!canvas) { canvas = document.createElement('canvas'); canvas.id = cfg.canvas || 'co-canvas'; document.body.appendChild(canvas); }
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = cfg.exposure === undefined ? 0.82 : cfg.exposure;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;   // the sun map is redrawn on a timer, not every frame
    scene = new THREE.Scene();
    var bg = cfg.background === undefined ? 0x8fb0d4 : cfg.background;
    if (bg !== null) scene.background = new THREE.Color(bg);
    var fog = cfg.fog === undefined ? { color: bg === null ? 0x8fb0d4 : bg, near: 70, far: 190 } : cfg.fog;
    if (fog) scene.fog = new THREE.Fog(fog.color === undefined ? (bg === null ? 0x8fb0d4 : bg) : fog.color, fog.near === undefined ? 70 : fog.near, fog.far === undefined ? 190 : fog.far);
    camera = new THREE.PerspectiveCamera(cfg.fov || 75, 1, cfg.near || 0.08, cfg.far || 260);
    window.addEventListener('resize', resize);
    if (cfg.env !== false) buildEnvStudio();
    var hc = cfg.hemi || {}; hemi = new THREE.HemisphereLight(hc.sky === undefined ? 0xdfeaff : hc.sky, hc.ground === undefined ? 0x5a4d40 : hc.ground, hc.intensity === undefined ? 0.45 : hc.intensity); scene.add(hemi);
    // the shadow box covers the whole site; the sun aims at its target, which a game's lighting pass moves with it
    var sc = cfg.sun || {}, sb = sc.box === undefined ? 70 : sc.box;
    sun = new THREE.DirectionalLight(sc.color === undefined ? 0xfff0d8 : sc.color, sc.intensity === undefined ? 1.1 : sc.intensity); sun.castShadow = true;
    var ms = sc.mapSize || 4096; sun.shadow.mapSize.set(ms, ms); sun.shadow.camera.left = -sb; sun.shadow.camera.right = sb; sun.shadow.camera.top = sb; sun.shadow.camera.bottom = -sb; sun.shadow.camera.near = sc.near === undefined ? 1 : sc.near; sun.shadow.camera.far = sc.far === undefined ? 230 : sc.far;
    var tg = sc.target || [0, 0, -20]; sun.target.position.set(tg[0], tg[1], tg[2]); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03; sun.shadow.radius = 4;
    scene.add(sun); scene.add(sun.target);
    if (cfg.lightBudget) lightBudget.n = cfg.lightBudget;
    buildBaseTextures(); buildBaseNormals(); buildBasePalette();
    if (cfg.post !== false) buildPost(); else post.on = false;
    CO.three = { renderer: renderer, scene: scene, camera: camera, canvas: canvas };
    return CO.three;
  }
  // ── Static bake ───────────────────────────────────────────────────
  // Thousands of small boxes (bracing, trims, props) each cost a draw call. After the world is built, everything that cannot
  // move or change is merged into one mesh per material. Anything interactive, animated, glowing, transparent, instanced, or
  // under a group flagged dynamic is left alone, so doors, trucks, people, lamps and screens behave as before.
  // A material is kept out of the bake with material.userData.noBake = true (the engine sets it on MAT.hit; a game sets it on
  // its screens and its lit signs). An object is kept out with object.userData.noBake or an ancestor's userData.dynamic.
  var baked = { meshes: [], hidden: 0, draws: 0 };
  function bakeable(o) {
    if (!o.isMesh || o.isInstancedMesh || o.isSprite || !o.visible) return false;
    var m = o.material; if (!m || Array.isArray(m) || m.userData.glow || m.userData.noBake || m.transparent) return false;
    if (o.userData.it || o.userData.noBake || inter.indexOf(o) >= 0) return false;
    if (!(o.geometry && o.geometry.attributes && o.geometry.attributes.position)) return false;
    for (var p = o; p; p = p.parent) { if (p.userData && p.userData.dynamic) return false; if (!p.visible) return false; if (p === camera) return false; }
    return true;
  }
  function bakeStatic() {
    scene.updateMatrixWorld(true);
    var byMat = {}, list = [];
    scene.traverse(function (o) { if (bakeable(o)) list.push(o); });
    list.forEach(function (o) { var k = o.material.uuid + (o.castShadow ? 'c' : '') + (o.receiveShadow ? 'r' : ''); (byMat[k] = byMat[k] || { mat: o.material, items: [] }).items.push(o); });
    Object.keys(byMat).forEach(function (k) {
      var grp = byMat[k]; if (grp.items.length < 2) return;
      var pos = [], nor = [], uv = [], hasUv = true;
      grp.items.forEach(function (o) {
        var g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
        g.applyMatrix4(o.matrixWorld);
        var pa = g.attributes.position.array, na = g.attributes.normal ? g.attributes.normal.array : null, ua = g.attributes.uv ? g.attributes.uv.array : null;
        for (var i = 0; i < pa.length; i++) pos.push(pa[i]);
        if (na) for (var j = 0; j < na.length; j++) nor.push(na[j]); else for (var j2 = 0; j2 < pa.length; j2++) nor.push(0);
        if (ua) for (var u = 0; u < ua.length; u++) uv.push(ua[u]); else hasUv = false;
        g.dispose();
      });
      var merged = new THREE.BufferGeometry();
      merged.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      merged.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      if (hasUv && uv.length === pos.length / 3 * 2) merged.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      var mesh = new THREE.Mesh(merged, grp.mat); mesh.castShadow = grp.items[0].castShadow; mesh.receiveShadow = grp.items[0].receiveShadow; mesh.frustumCulled = false; mesh.userData.baked = true;
      scene.add(mesh); baked.meshes.push(mesh);
      grp.items.forEach(function (o) { o.visible = false; o.userData.bakedAway = true; baked.hidden++; });
      baked.draws++;
    });
    shadowDirty = true;
  }
  // everything back the way it was: the merged meshes go, the originals show. A world that changed (a prop moved, a wall grew)
  // calls unbakeStatic, changes, then bakeStatic again.
  function unbakeStatic() { baked.meshes.forEach(function (m) { scene.remove(m); m.geometry.dispose(); }); baked.meshes = []; baked.draws = 0; baked.hidden = 0; scene.traverse(function (o) { if (o.userData.bakedAway) { o.visible = true; o.userData.bakedAway = false; } }); }
  function rebake() { unbakeStatic(); bakeStatic(); }
  // ── The prop system ───────────────────────────────────────────────
  // A prop is built by defProp(id, { label, x, z, rot, cat, wall, fixed, extra, price, ico, desc, when(), snap(), build(ctx, P, inst), after }).
  // Its placement is the default from the definition unless S.layout[id] overrides it ({ x, z, rot, h, hidden }). Bought extras
  // live in S.custom as { id, type, x, z, rot, h }. Rotation is in quarter turns. Each prop builds into its own group, so moving
  // it is: remove the instance, build it again at the new spot.
  // The game's hooks on CO.game, all optional: resolveDef(id, def) rewrites a default spot for the world as it stands (a hall that
  // grew); propAllowed(id, def) says whether a prop stands now (a stage, a level, a licence); groundY(x, z) is the floor a prop
  // stands on; wallPlanes() lists the faces a wall prop can hang on; editClamp(pt, def) keeps a carried prop inside the site;
  // canEdit() gates build mode. Hooks on the bus: 'propCtx' (ctx, g, id), 'propBuilt' (id, inst, def), 'propRemoved' (id, inst),
  // 'propPlaced' (id, inst, def), 'propDeleted' (id, def), 'editBought' (custom record).
  var PROPS = {}, PROP_ORDER = [], propInst = {};
  function defProp(id, def) { if (CO.game && CO.game.resolveDef) CO.game.resolveDef(id, def); def.id = id; PROPS[id] = def; PROP_ORDER.push(id); return def; }
  function propAllowed(id) { var d = PROPS[id]; if (!d) return true; if (d.extra) return true; if (CO.game && CO.game.propAllowed && !CO.game.propAllowed(id, d)) return false; return true; }
  function propDef(id) { if (PROPS[id]) return PROPS[id]; var c = customById(id); return c ? PROPS[c.type] : null; }
  function customById(id) { return (S && S.custom || []).filter(function (c) { return c.id === id; })[0] || null; }
  function propPlacement(id) {
    var d = PROPS[id], c = customById(id), o = (S && S.layout && S.layout[id]) || {};
    if (c) return { x: typeof o.x === 'number' ? o.x : c.x, z: typeof o.z === 'number' ? o.z : c.z, rot: typeof o.rot === 'number' ? o.rot : (c.rot || 0), h: typeof o.h === 'number' ? o.h : (c.h || 0), hidden: !!o.hidden, custom: true };
    return { x: typeof o.x === 'number' ? o.x : d.x, z: typeof o.z === 'number' ? o.z : d.z, rot: typeof o.rot === 'number' ? o.rot : (d.rot || 0), h: o.h || 0, hidden: !!o.hidden, custom: false };
  }
  function propLabel(id) { var d = propDef(id); return d ? d.label : id; }
  function rotAABB(o, rot) {
    var pts = [[o.x0, o.z0], [o.x1, o.z0], [o.x0, o.z1], [o.x1, o.z1]], a = rot * Math.PI / 2, c = Math.cos(a), s = Math.sin(a), xs = [], zs = [];
    pts.forEach(function (p) { xs.push(p[0] * c + p[1] * s); zs.push(-p[0] * s + p[1] * c); });
    return { x0: Math.min.apply(null, xs), x1: Math.max.apply(null, xs), z0: Math.min.apply(null, zs), z1: Math.max.apply(null, zs) };
  }
  // what a build function gets: placers that parent into the prop's group, a solid list the prop fills, a hit box helper that
  // tags the prop id, a point light, and a dynamic sub-group for parts that move (they stay out of the bake)
  function propCtx(g, id) {
    var obs = [];
    var ctx = {
      group: g, obstacles: obs, id: id,
      box: function (w, h, d, mat, x, y, z) { return box(w, h, d, mat, x, y, z, g); },
      cyl: function (r, h, mat, x, y, z, seg, rb) { return cyl(r, h, mat, x, y, z, g, seg, rb); },
      sphere: function (r, mat, x, y, z) { return sphere(r, mat, x, y, z, g); },
      plane: function (w, h, mat, x, y, z, rx, ry) { return plane(w, h, mat, x, y, z, rx, ry, g); },
      sign: function (lines, w, h, x, y, z, ry, opt) { return sign(lines, w, h, x, y, z, ry, opt, g); },
      hit: function (w, h, d, x, y, z, def) { var m = hitBox(w, h, d, x, y, z, def, g); m.userData.propId = id; return m; },
      solid: function (x0, x1, z0, z1, y0, y1) { obs.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), y0: y0 === undefined ? -1 : y0, y1: y1 === undefined ? 3 : y1 }); },
      light: function (col, intensity, dist, x, y, z, decay) { var l = new THREE.PointLight(col, intensity, dist, decay === undefined ? 2 : decay); l.position.set(x, y, z); g.add(l); return l; },
      dynGroup: function () { var dg = new THREE.Group(); dg.userData.dynamic = true; g.add(dg); return dg; },
      add: function (m) { g.add(m); return m; }
    };
    runHooks('propCtx', ctx, g, id);
    return ctx;
  }
  function removePropInst(id) {
    var inst = propInst[id]; if (!inst) return;
    var inGroup = function (o) { for (var p = o; p; p = p.parent) if (p === inst.g) return true; return false; };
    inst.g.traverse(function (o) { var k = inter.indexOf(o); if (k >= 0) inter.splice(k, 1); });
    for (var si = screens.length - 1; si >= 0; si--) if (inGroup(screens[si].mesh)) screens.splice(si, 1);
    scene.remove(inst.g);
    for (var i = solids.length - 1; i >= 0; i--) if (solids[i].prop === id) solids.splice(i, 1);
    runHooks('propRemoved', id, inst);
    delete propInst[id]; NAV.dirty = true;
  }
  function propGroundY(x, z) { return CO.game && CO.game.groundY ? CO.game.groundY(x, z) : 0; }
  function buildProp(id) {
    removePropInst(id);
    var def = propDef(id); if (!def) return null; if (!propAllowed(id)) return null;
    var P = propPlacement(id), g = new THREE.Group(); g.userData.propId = id; g.position.set(P.x, typeof def.y === 'number' ? def.y : propGroundY(P.x, P.z), P.z); g.rotation.y = P.rot * Math.PI / 2;
    var ctx = propCtx(g, id), inst = { id: id, g: g, P: P, ctx: ctx, def: def };
    if (!P.hidden) propInst[id] = inst;   // a removed prop is not on the list: nothing then counts a hidden machine as standing
    if (!P.hidden) {
      def.build(ctx, P, inst);
      g.traverse(function (o) { if (o.isMesh) o.userData.propId = id; });
      ctx.obstacles.forEach(function (o) { var r = rotAABB(o, P.rot); solids.push({ x0: P.x + r.x0, x1: P.x + r.x1, z0: P.z + r.z0, z1: P.z + r.z1, y0: o.y0, y1: o.y1, prop: id }); });
      if (def.after) def.after(ctx, P, inst);
      if (!def.wall && !def.fixed && !def.noBlob && ctx.obstacles.length) { var fx0 = 1e9, fx1 = -1e9, fz0 = 1e9, fz1 = -1e9; ctx.obstacles.forEach(function (o) { fx0 = Math.min(fx0, o.x0); fx1 = Math.max(fx1, o.x1); fz0 = Math.min(fz0, o.z0); fz1 = Math.max(fz1, o.z1); }); groundBlob((fx1 - fx0) * 1.5 + 0.3, (fz1 - fz0) * 1.5 + 0.3, (fx0 + fx1) / 2, (fz0 + fz1) / 2, g, 0); }
      runHooks('propBuilt', id, inst, def);
    }
    scene.add(g); NAV.dirty = true; shadowDirty = true;
    return inst;
  }
  function buildProps() { PROP_ORDER.forEach(function (id) { if (!PROPS[id].extra && propAllowed(id) && (!PROPS[id].when || PROPS[id].when())) buildProp(id); }); (S && S.custom || []).forEach(function (c) { if (PROPS[c.type]) buildProp(c.id); }); }
  function propIdOf(obj) { for (var o = obj; o; o = o.parent) if (o.userData && o.userData.propId) return o.userData.propId; return null; }
  function propWorld(prop, lx, lz) { var P = propPlacement(prop), a = P.rot * Math.PI / 2; return { x: P.x + lx * Math.cos(a) + lz * Math.sin(a), z: P.z - lx * Math.sin(a) + lz * Math.cos(a), a: a }; }

  // ── Build mode ────────────────────────────────────────────────────
  var edit = { on: false, grabbed: null, helper: null, snap: true, wallAim: null, snapCycle: 0, grabRot: 0, snapText: '' };   // snapCycle: which snap (or free heading) R has walked to for the carried piece
  var ray = new THREE.Raycaster(); ray.far = 3.4; var centre = new THREE.Vector2(0, 0);
  function editAllowed() { return CO.game && CO.game.canEdit ? CO.game.canEdit() : true; }
  function editToggle() {
    if (!edit.on && !editAllowed()) return;
    if (edit.grabbed) editDrop(true);
    edit.on = !edit.on;
    var eb = $('h-edit'); if (eb) { eb.hidden = !edit.on; }
    if (edit.on) { unbakeStatic(); focus = null; toast('Build mode: aim at a prop and E grabs it · R turns · Backspace puts it back · Del removes · C is the catalogue', ''); }
    else { if (edit.helper) { scene.remove(edit.helper); edit.helper = null; } bakeStatic(); save(); toast('Layout saved', 'good'); }
    sfx('click'); hudDirty = true;
  }
  function editHelper(obj, col) {
    if (!obj) { if (edit.helper) edit.helper.visible = false; return; }
    if (edit.helper && edit.helper.userData.col !== col) { scene.remove(edit.helper); edit.helper = null; }
    if (!edit.helper) { edit.helper = new THREE.BoxHelper(obj, col); edit.helper.userData.col = col; scene.add(edit.helper); }
    edit.helper.visible = true; edit.helper.setFromObject(obj);
  }
  function wallPlanes() { return CO.game && CO.game.wallPlanes ? CO.game.wallPlanes() : []; }
  // where the carried prop goes: the point on the floor the player aims at, or 2.6 m ahead; a def's own snap first (a belt piece),
  // then the nearest wall face for a wall prop, then the game's clamp (inside the site), on a 5 cm grid while snap is on
  function editAim(def) {
    ray.setFromCamera(centre, camera);
    var dir = ray.ray.direction, o = ray.ray.origin, px = player ? player.x : o.x, pz = player ? player.z : o.z, y = floorY(px, pz), pt;
    var t = (y - o.y) / dir.y;
    if (dir.y < -0.05 && t > 0 && t < 10) pt = o.clone().add(dir.clone().multiplyScalar(t));
    else { var flat = dir.clone(); flat.y = 0; flat.normalize(); pt = o.clone().add(flat.multiplyScalar(2.6)); pt.y = y; }
    var sn = function (v) { return edit.snap ? Math.round(v * 20) / 20 : v; };
    if (def.snap) { var bs = def.snap(def, pt, edit.grabbed); edit.snapText = bs ? (bs.text || '') : ''; if (bs) return bs; }
    if (def.wall) {
      var best = null, bd = 2.5;
      wallPlanes().forEach(function (w) { var d = w.a === 'x' ? Math.abs(pt.x - w.v) : Math.abs(pt.z - w.v); var within = w.a === 'x' ? (pt.z > w.z0 && pt.z < w.z1) : (pt.x > w.x0 && pt.x < w.x1); if (within && d < bd) { bd = d; best = w; } });
      if (best) { if (best.a === 'x') return { x: best.v, z: sn(pt.z), rot: best.n > 0 ? 1 : 3, wall: true }; return { x: sn(pt.x), z: best.v, rot: best.n > 0 ? 0 : 2, wall: true }; }
    }
    var cl = CO.game && CO.game.editClamp ? CO.game.editClamp(pt, def) : null;
    return { x: sn(cl ? cl.x : pt.x), z: sn(cl ? cl.z : pt.z), rot: null, wall: false };
  }
  function ghostProp(id) { propInst[id].g.traverse(function (o) { if (o.isMesh && o.material && o.material.clone && !o.userData.ghosted) { o.userData.origMat = o.material; o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.5; o.material.depthWrite = false; o.castShadow = false; o.userData.ghosted = true; } }); }
  function editTick() {
    if (!edit.on) return;
    if (edit.grabbed) {
      var inst = propInst[edit.grabbed]; if (!inst) { edit.grabbed = null; return; }
      var def = propDef(edit.grabbed), aim = editAim(def);
      // a piece snapped at another height is rebuilt at that height while it is still being carried
      if (typeof aim.h === 'number' && Math.abs((inst.P.h || 0) - aim.h) > 0.01) { var cc = customById(edit.grabbed); if (cc) cc.h = aim.h; if (S.layout && S.layout[edit.grabbed]) S.layout[edit.grabbed].h = aim.h; buildProp(edit.grabbed); inst = propInst[edit.grabbed]; inst.P.h = aim.h; for (var si = solids.length - 1; si >= 0; si--) if (solids[si].prop === edit.grabbed) solids.splice(si, 1); ghostProp(edit.grabbed); }
      inst.g.position.set(aim.x, propGroundY(aim.x, aim.z), aim.z); if (aim.rot !== null && (def.wall || def.snap)) { inst.P.rot = aim.rot; inst.g.rotation.y = aim.rot * Math.PI / 2; }
      editHelper(inst.g, 0xf5b53d);
    } else if (focus && focus.editId && propInst[focus.editId]) editHelper(propInst[focus.editId].g, 0x5fd38d);
    else editHelper(null);
  }
  function editGrab(id) {
    if (edit.grabbed || !propInst[id]) return;
    var def = propDef(id); if (def.fixed) { toast('That one stays where it is.', 'bad'); return; }
    edit.grabbed = id; edit.snapText = ''; edit.snapCycle = 0; edit.grabRot = propInst[id].P.rot || 0; for (var i = solids.length - 1; i >= 0; i--) if (solids[i].prop === id) solids.splice(i, 1); NAV.dirty = true;
    ghostProp(id);
    sfx('pickup'); toast('Carrying the ' + propLabel(id) + ' · E places · R turns · Esc drops it back', '');
  }
  function editDrop(cancel) {
    var id = edit.grabbed; if (!id) return; edit.grabbed = null; edit.snapText = '';
    var inst = propInst[id], def = propDef(id);
    if (!cancel && inst) { if (!S.layout) S.layout = {}; S.layout[id] = { x: Math.round(inst.g.position.x * 100) / 100, z: Math.round(inst.g.position.z * 100) / 100, rot: inst.P.rot, h: inst.P.h || 0 }; sfx('putdown'); }
    buildProp(id); editHelper(null); save();
    if (!cancel && inst) { runHooks('propPlaced', id, propInst[id], def); if (!(def && def.quietPlace)) toast('Placed the ' + propLabel(id), 'good'); }
  }
  function editRotate(pid) {
    var id = pid || edit.grabbed || (focus && focus.editId); if (!id || !propInst[id]) return;
    var inst = propInst[id], def = propDef(id); if (def && def.fixed) { toast('That one stays where it is.', 'bad'); return; } if (def.wall && !edit.grabbed) { toast('Wall pieces face the wall.', ''); return; }
    if (edit.grabbed && def.snap) { edit.snapCycle++; sfx('click'); return; }   // a carried piece with its own snap: R walks the snaps near the aim, then the free headings; the def's snap applies it
    inst.P.rot = (inst.P.rot + 1) % 4; inst.g.rotation.y = inst.P.rot * Math.PI / 2; sfx('click');
    if (!edit.grabbed) { if (!S.layout) S.layout = {}; S.layout[id] = { x: inst.g.position.x, z: inst.g.position.z, rot: inst.P.rot }; buildProp(id); save(); }
  }
  function editReset(pid) {
    var id = pid || edit.grabbed || (focus && focus.editId); if (!id) return; if (propDef(id) && propDef(id).fixed) { toast('That one stays where it is.', 'bad'); return; }
    if (edit.grabbed) edit.grabbed = null;
    if (S.layout) delete S.layout[id]; buildProp(id); editHelper(null); sfx('ok'); toast('Put the ' + propLabel(id) + ' back where it started', 'good'); save();
  }
  function editRemove(pid) {
    var id = pid || edit.grabbed || (focus && focus.editId); if (!id) return; var def = propDef(id); if (def && def.fixed) { toast('That one stays where it is.', 'bad'); return; }
    var c = customById(id);
    if (edit.grabbed) edit.grabbed = null;
    if (c) { runHooks('propDeleted', id, def); S.custom.splice(S.custom.indexOf(c), 1); removePropInst(id); if (def && def.price) { pay(Math.round(def.price / 2), 'Sold back: ' + def.label); toast('Sold the ' + def.label + ' back for half', ''); } }
    else { if (!S.layout) S.layout = {}; S.layout[id] = S.layout[id] || {}; S.layout[id].hidden = true; buildProp(id); toast('Removed the ' + propLabel(id) + ' (the catalogue brings it back)', ''); }
    editHelper(null); sfx('bad'); save();
  }
  function editRestore(id) { if (S.layout && S.layout[id]) { delete S.layout[id].hidden; } buildProp(id); sfx('ok'); toast('The ' + propLabel(id) + ' is back', 'good'); save(); }
  function editBuy(type) {
    var def = PROPS[type]; if (!def || !def.extra) return; if (typeof def.lvl === 'number' && S.level !== undefined && S.level < def.lvl) { toast('That comes at level ' + def.lvl + '.', 'bad'); return; }
    if (def.price && S.bank < def.price) { toast('That costs ' + money(def.price) + ' and you have ' + money(S.bank), 'bad'); return; }
    if (def.price) pay(-def.price, 'Bought: ' + def.label);
    if (!S.custom) S.custom = [];
    var aim = editAim(def), c = { id: uid('cp'), type: type, x: aim.x, z: aim.z, rot: aim.rot || 0, h: aim.h || 0 }; S.custom.push(c);
    buildProp(c.id); runHooks('editBought', c, def); editGrab(c.id); toast('Carrying the ' + def.label + ' · aim and press E', '');
    return c;
  }
  // the catalogue's data: removed props to bring back, and extras to buy, grouped by category (the game draws it)
  function catalogueData() {
    var hidden = PROP_ORDER.filter(function (id) { return !PROPS[id].extra && propPlacement(id).hidden; }), groups = {};
    PROP_ORDER.forEach(function (id) { var d = PROPS[id]; if (!d.extra) return; (groups[d.cat || 'other'] = groups[d.cat || 'other'] || []).push(id); });
    return { hidden: hidden, groups: groups };
  }
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
  function hingedDoor(id, x, z, alongX, label, opt) {
    opt = opt || {};
    var g = new THREE.Group(); g.userData.dynamic = true; g.position.set(x, 0, z); scene.add(g);
    var w = opt.w || 1.0, h = opt.h || 2.15, t = 0.06, hinge = new THREE.Group(); g.add(hinge);
    var leaf = box(alongX ? w : t, h, alongX ? t : w, opt.mat || MAT.plaster, alongX ? w / 2 : 0, h / 2, alongX ? 0 : w / 2, hinge);
    if (opt.window) box(alongX ? 0.4 : t + 0.01, 0.5, alongX ? t + 0.01 : 0.4, MAT.glass, alongX ? w / 2 : 0, 1.55, alongX ? 0 : w / 2, hinge);
    box(alongX ? 0.14 : 0.04, 0.03, alongX ? 0.04 : 0.14, MAT.chrome, alongX ? w - 0.15 : 0.06, 1.05, alongX ? 0.06 : w - 0.15, hinge); box(alongX ? 0.14 : 0.04, 0.03, alongX ? 0.04 : 0.14, MAT.chrome, alongX ? w - 0.15 : -0.06, 1.05, alongX ? -0.06 : w - 0.15, hinge);
    if (opt.pushbar) box(alongX ? 0.8 : 0.05, 0.05, alongX ? 0.05 : 0.8, MAT.chrome, alongX ? w / 2 : 0.07, 1.0, alongX ? 0.07 : w / 2, hinge);
    var led = box(0.03, 0.03, 0.03, glowMat(0x39d353, 1.2), alongX ? w - 0.1 : 0.05, 2.0, alongX ? 0.05 : w - 0.1, hinge);
    // the frame: on a group of its own, so it joins the static bake (the leaf's group is dynamic and the frame never moves)
    var fg = new THREE.Group(); fg.position.set(x, 0, z); scene.add(fg);
    var fm = opt.frameMat || MAT.steelDark; if (alongX) { box(0.08, h + 0.1, t + 0.06, fm, -0.04, (h + 0.1) / 2, 0, fg); box(0.08, h + 0.1, t + 0.06, fm, w + 0.04, (h + 0.1) / 2, 0, fg); box(w + 0.16, 0.08, t + 0.06, fm, w / 2, h + 0.09, 0, fg); } else { box(t + 0.06, h + 0.1, 0.08, fm, 0, (h + 0.1) / 2, -0.04, fg); box(t + 0.06, h + 0.1, 0.08, fm, 0, (h + 0.1) / 2, w + 0.04, fg); box(t + 0.06, 0.08, w + 0.16, fm, 0, h + 0.09, w / 2, fg); }
    var d = { id: id, g: g, frame: fg, hinge: hinge, leaf: leaf, led: led, x: x, z: z, alongX: alongX, w: w, h: h, t: 0, label: label, swing: opt.swing || 1 };
    var hit = hitBox(alongX ? w : 0.4, h, alongX ? 0.4 : w, alongX ? w / 2 : 0, h / 2, alongX ? 0 : w / 2, { prompt: function () { return doorPrompt(d); }, use: function () { doorUse(d); }, alt: function () { doorLock(d); } }, g);
    d.hit = hit;
    if (!S.hdoors) S.hdoors = {}; if (!S.hdoors[id]) S.hdoors[id] = { open: !!opt.open, locked: false };
    d.t = S.hdoors[id].open ? 1 : 0; doorPose(d);
    hdoors.push(d); return d;
  }
  function hd(id) { return S && S.hdoors && S.hdoors[id] ? S.hdoors[id] : { open: false, locked: false }; }
  function doorById(id) { for (var i = 0; i < hdoors.length; i++) if (hdoors[i].id === id) return hdoors[i]; return null; }
  function doorPose(d) { d.hinge.rotation.y = (d.alongX ? -1 : 1) * d.swing * d.t * 1.65; d.led.material.emissive.setHex(hd(d.id).locked ? 0xff3b30 : 0x39d353); }
  function doorPrompt(d) { var s = hd(d.id); if (s.locked) return d.label + ' · locked · Shift+E unlocks'; return (s.open ? 'Close ' : 'Open ') + d.label + ' · Shift+E locks'; }
  function doorUse(d) { var s = hd(d.id); if (player && player.keys && (player.keys.ShiftLeft || player.keys.ShiftRight)) { doorLock(d); return; } if (s.locked) { sfx('bad'); toast(d.label + ' is locked.', 'bad'); return; } s.open = !s.open; sfx('door'); }
  function doorLock(d) { var s = hd(d.id); if (s.open) { s.open = false; } s.locked = !s.locked; sfx(s.locked ? 'lock' : 'unlock'); toast((s.locked ? 'Locked ' : 'Unlocked ') + d.label, s.locked ? '' : 'good'); doorPose(d); screenDirtyAll(); }
  function doorCentre(d) { return { x: d.alongX ? d.x + d.w / 2 : d.x, z: d.alongX ? d.z : d.z + d.w / 2 }; }
  function doorsTick(dt) {
    var walkers = CO.game && CO.game.doorOpeners ? CO.game.doorOpeners() : [];
    hdoors.forEach(function (d) {
      var s = hd(d.id), c = doorCentre(d);
      var near = walkers.some(function (p) { return dist2(p.x, p.z, c.x, c.z) < 1.7; });   // someone with keys: the door opens for them when they are close and closes once they are through
      var want = s.open || near ? 1 : 0;
      if (Math.abs(d.t - want) > 0.002) { d.t = lerp(d.t, want, 1 - Math.pow(0.006, dt)); if (Math.abs(d.t - want) < 0.004) d.t = want; doorPose(d); shadowDirty = true; }
    });
  }
  function doorSolids(out) { hdoors.forEach(function (d) { if (d.t > 0.5) return; if (d.alongX) out.push({ x0: d.x, x1: d.x + d.w, z0: d.z - 0.08, z1: d.z + 0.08, y0: -1, y1: 3 }); else out.push({ x0: d.x - 0.08, x1: d.x + 0.08, z0: d.z, z1: d.z + d.w, y0: -1, y1: 3 }); }); }
  function lockAll(lock) { hdoors.forEach(function (d) { var s = hd(d.id); if (lock) { s.open = false; s.locked = true; } else s.locked = false; doorPose(d); }); runHooks('lockAll', lock); sfx(lock ? 'lock' : 'unlock'); logEvent(lock ? 'Night mode: every door closed and locked' : 'Doors unlocked for the day'); screenDirtyAll(); }
  function anyDoorUnlocked() { return hdoors.some(function (d) { return !hd(d.id).locked; }); }
  // ── Floors and walkable ground ────────────────────────────────────
  // Where the player stands. A game answers CO.game.floorY(x, z, y) with decks, ramps and trailers; the default is a flat 0.
  // insideWalk(x, z) says whether a point is ground the crew may walk on; CO.game.insideWalk overrides it, the default is everywhere.
  function floorY(x, z, y) { return CO.game && CO.game.floorY ? CO.game.floorY(x, z, y) : 0; }
  function insideWalk(x, z) { return CO.game && CO.game.insideWalk ? CO.game.insideWalk(x, z) : true; }
  var lampMeshes = [];   // every lens that goes dark with the power: the troffers, the high bays, whatever a game adds
  // take the openings out of a 1D span: [[a0, a1]] minus every [o0, o1] (and an optional o2, the opening's height, left to the caller)
  function spanCut(a0, a1, openings) {
    var segs = [[a0, a1]];
    (openings || []).forEach(function (o) { var out = []; segs.forEach(function (s) { if (o[1] <= s[0] || o[0] >= s[1]) { out.push(s); return; } if (o[0] > s[0]) out.push([s[0], o[0]]); if (o[1] < s[1]) out.push([o[1], s[1]]); }); segs = out; });
    return segs;
  }
  // a painted lining on a room's outer walls: a plane just inside the cladding, skirting along the floor, a dado rail, with openings
  // left for doors. axis 'x': the wall runs along z at x = at; 'z': along x at z = at. inward is +1 or -1, the side the room is on.
  function lineWall(axis, at, a0, a1, h, mat, openings, inward, opt) {
    opt = opt || {};
    var segs = spanCut(a0, a1, openings);
    var off = at + inward * (opt.inset === undefined ? 0.17 : opt.inset), ry = axis === 'x' ? (inward > 0 ? Math.PI / 2 : -Math.PI / 2) : (inward > 0 ? 0 : Math.PI), trim = opt.trim || MAT.trim;
    function strip(w, hh, y, mid, m) { if (axis === 'x') { plane(w, hh, m, off, y, mid, 0, ry); } else { plane(w, hh, m, mid, y, off, 0, ry); } }
    segs.forEach(function (s) { var w = s[1] - s[0], mid = (s[0] + s[1]) / 2; strip(w, h, h / 2, mid, mat); if (opt.skirting !== false) { var sk = axis === 'x' ? box(0.03, 0.12, w, trim, off + inward * 0.012, 0.06, mid) : box(w, 0.12, 0.03, trim, mid, 0.06, off + inward * 0.012); sk.receiveShadow = true; } if (opt.dado !== false) { if (axis === 'x') box(0.025, 0.05, w, trim, off + inward * 0.01, 0.95, mid); else box(w, 0.05, 0.025, trim, mid, 0.95, off + inward * 0.01); } });
    (openings || []).forEach(function (o) { if (o[2] && o[2] < h) { var w = o[1] - o[0], mid = (o[0] + o[1]) / 2; strip(w, h - o[2], o[2] + (h - o[2]) / 2, mid, mat); } });
    return segs;
  }
  // a room's own floor laid over the slab: the texture repeats in metres so a carpet tile is half a metre wherever it is
  function roomFloor(mat, x0, x1, z0, z1, per, y) {
    var m = mat.clone(); m.map = mat.map.clone(); m.map.needsUpdate = true; m.map.repeat.set((x1 - x0) / per, (z1 - z0) / per);
    if (mat.normalMap) { m.normalMap = mat.normalMap.clone(); m.normalMap.needsUpdate = true; m.normalMap.repeat.set((x1 - x0) / per, (z1 - z0) / per); }
    var p = plane(x1 - x0, z1 - z0, m, (x0 + x1) / 2, (y === undefined ? 0 : y) + 0.012, (z0 + z1) / 2, -Math.PI / 2); p.receiveShadow = true; return p;
  }
  // a recessed troffer in a room's ceiling: a white frame and a prismatic lens that dims when the power is off
  function troffer(x, y, z, w, d) { box(w || 1.2, 0.05, d || 0.6, MAT.trim, x, y - 0.025, z).castShadow = false; var lens = box((w || 1.2) - 0.1, 0.02, (d || 0.6) - 0.1, MAT.lamp, x, y - 0.045, z); lens.castShadow = false; lampMeshes.push(lens); return lens; }
  // a high bay hung from a roof at roofH: the conduit drop, the ballast box, the reflector and the lens
  var HIGHBAY_REFL = null;
  function highBay(x, y, z, roofH) {
    if (!HIGHBAY_REFL) HIGHBAY_REFL = std({ color: 0x9aa3ad, roughness: 0.35, metalness: 0.7, side: THREE.DoubleSide });   // one reflector material for every lamp: thirty of them bake into one draw instead of thirty
    roofH = roofH === undefined ? y + 1.2 : roofH;
    cyl(0.025, roofH - y - 0.22, MAT.steelDark, x, (roofH + y + 0.22) / 2, z, null, 6);
    box(0.34, 0.22, 0.26, MAT.steelDark, x, y + 0.11, z); box(0.1, 0.06, 0.06, MAT.black, x + 0.2, y + 0.12, z);
    var refl = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.14, 0.42, 20, 1, true), HIGHBAY_REFL); refl.position.set(x, y - 0.21, z); parentOf(null).add(refl);
    var lens = cyl(0.42, 0.03, MAT.lamp, x, y - 0.41, z, null, 20); lens.castShadow = false; lampMeshes.push(lens); return lens;
  }
  // ── The yard kit ──────────────────────────────────────────────────
  var FENCE = null;
  function fenceMats() { if (!FENCE) FENCE = { post: std({ color: 0x2f5d3a, roughness: 0.5, metalness: 0.5 }), mesh: std({ map: TEX.vmesh, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.6, color: 0x3d6b48 }), conc: std({ map: TEX.plaster, color: 0x9a9890, roughness: 0.95 }), wire: std({ color: 0x8e949a, roughness: 0.4, metalness: 0.8 }) }; return FENCE; }
  // a run of fence from (x0, z0) to (x1, z1): posts every 3 m with concrete feet, mesh panels, two folds and a top rail, three
  // strands of barbed wire on angled arms, and a solid the length of the run. opt: { y: ground height, wires: false, solid: false }
  function fenceRun(x0, z0, x1, z1, opt) {
    opt = opt || {}; var F = fenceMats(), Y = opt.y || 0;
    // ang turns a y-axis cylinder laid along z onto the run (the wires); rot turns an x-long box or plane onto it (panels, rails, boards)
    var dx = x1 - x0, dz = z1 - z0, len = Math.sqrt(dx * dx + dz * dz), n = Math.max(1, Math.round(len / 3)), ang = Math.atan2(dx, dz), ux = dx / len, uz = dz / len, nx = uz, nz = -ux, rot = Math.atan2(-uz, ux);
    for (var i = 0; i <= n; i++) {
      var t = i / n, px = x0 + dx * t, pz = z0 + dz * t;
      box(0.08, 2.5, 0.08, F.post, px, Y + 1.25, pz); box(0.3, 0.25, 0.3, F.conc, px, Y + 0.12, pz); box(0.12, 0.03, 0.12, F.post, px, Y + 2.52, pz);
      if (opt.wires !== false) { var arm = box(0.04, 0.6, 0.04, F.post, px + nx * 0.2, Y + 2.72, pz + nz * 0.2); arm.rotation.set(0, ang, -0.7, 'YXZ'); arm.position.y += 0.1; }
      if (i < n) {
        var mx = x0 + dx * (t + 0.5 / n), mz = z0 + dz * (t + 0.5 / n), seg = len / n;
        var mp = plane(seg - 0.1, 2.2, F.mesh, mx, Y + 1.35, mz, 0, rot); mp.receiveShadow = false;
        [0.75, 1.65].forEach(function (vy) { var fold = box(seg - 0.1, 0.06, 0.03, F.post, mx, Y + vy, mz); fold.rotation.y = rot; });
        var gb = box(seg, 0.3, 0.05, F.conc, mx, Y + 0.15, mz); gb.rotation.y = rot; var tr = box(seg, 0.03, 0.03, F.post, mx, Y + 2.46, mz); tr.rotation.y = rot; var br = box(seg, 0.03, 0.03, F.post, mx, Y + 0.32, mz); br.rotation.y = rot;
      }
    }
    if (opt.solid !== false) solid(Math.min(x0, x1) - 0.06, Math.max(x0, x1) + 0.06, Math.min(z0, z1) - 0.06, Math.max(z0, z1) + 0.06, Y, Y + 2.6);   // the fence is a fence: nobody walks through it
    if (opt.wires !== false) [0, 1, 2].forEach(function (k) { var wy = Y + 2.62 + k * 0.17, wo = 0.22 + k * 0.14; var wire = cyl(0.006, len, F.wire, (x0 + x1) / 2 + nx * wo, wy, (z0 + z1) / 2 + nz * wo, null, 4); wire.rotation.x = Math.PI / 2; wire.rotation.z = 0; wire.rotation.order = 'YXZ'; wire.rotation.y = ang; });
  }
  // a tree: a tapered trunk and four lumpy crowns, scaled by s, standing on y
  var TREE_MATS = null;
  function tree(x, z, s, y, parent) {
    s = s || 1; y = y || 0;
    if (!TREE_MATS) TREE_MATS = { trunk: std({ color: 0x5b4634, roughness: 1 }), crowns: [0x3f6f2e, 0x5c8f44, 0x45752f, 0x6f9a4a].map(function (c) { return std({ color: c, roughness: 1 }); }) };
    cyl(0.12 * s, 2.6 * s, TREE_MATS.trunk, x, y + 1.3 * s, z, parent, 8, 0.18 * s);
    [[0, 3.2, 0, 1.3], [0.7, 2.7, 0.4, 0.9], [-0.6, 2.9, -0.5, 1.0], [0.1, 4.0, 0.2, 0.8]].forEach(function (b, i) { sphere(b[3] * s, TREE_MATS.crowns[i], x + b[0] * s, y + b[1] * s, z + b[2] * s, parent); });
  }
  // a street or yard lamp: a post, an arm and a glowing head; the lens goes on the lamp list
  function lampPost(x, z, y, h, parent) { h = h || 5; y = y || 0; cyl(0.06, h, MAT.steelDark, x, y + h / 2, z, parent, 8, 0.09); box(0.9, 0.06, 0.06, MAT.steelDark, x + 0.45, y + h - 0.05, z, parent); var lens = box(0.36, 0.14, 0.3, glowMat(0xfff2c0, 0.6), x + 0.9, y + h - 0.12, z, parent); lampMeshes.push(lens); return lens; }
  // point-in-rectangle helpers used all over a site
  function inRect(x, z, x0, x1, z0, z1) { return x > x0 && x < x1 && z > z0 && z < z1; }
  function rectsOverlap(a, b) { return a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0; }
  // ── The route finder ──────────────────────────────────────────────
  // A grid of NAV.cell metres over the site. A cell is blocked by any static solid (walls, racks, furniture) under head height,
  // or, outside the walkable ground (insideWalk), unless the game lets a walker through there (CO.game.navPass(x, z): a docked
  // trailer, a staff door). Hinged doors never block a walker with keys. navSetup names the area; NAV.dirty rebuilds the grid.
  var NAV = { cell: 0.4, x0: -40, z0: -40, w: 200, h: 200, grid: null, dirty: true, pad: 0.3, headroom: 1.6, steps: 20000 };
  function navSetup(o) { o = o || {}; if (o.cell) NAV.cell = o.cell; if (typeof o.x0 === 'number') NAV.x0 = o.x0; if (typeof o.z0 === 'number') NAV.z0 = o.z0; if (o.width) NAV.w = Math.round(o.width / NAV.cell); if (o.depth) NAV.h = Math.round(o.depth / NAV.cell); if (typeof o.w === 'number') NAV.w = o.w; if (typeof o.h === 'number') NAV.h = o.h; if (typeof o.pad === 'number') NAV.pad = o.pad; NAV.grid = null; NAV.dirty = true; return NAV; }
  function navBuild() {
    var g = new Uint8Array(NAV.w * NAV.h), c = NAV.cell, pad = NAV.pad;
    for (var j = 0; j < NAV.h; j++) for (var i = 0; i < NAV.w; i++) {
      var x = NAV.x0 + (i + 0.5) * c, z = NAV.z0 + (j + 0.5) * c, blocked = 0;
      if (!insideWalk(x, z)) blocked = 2;   // outside the ground you walk: open only where the game says so
      else for (var k = 0; k < solids.length; k++) { var s = solids[k]; if (s.y0 > NAV.headroom) continue; if (x > s.x0 - pad && x < s.x1 + pad && z > s.z0 - pad && z < s.z1 + pad) { blocked = 1; break; } }
      g[j * NAV.w + i] = blocked;
    }
    NAV.grid = g; NAV.dirty = false;
  }
  function navOpen(i, j) {
    if (i < 0 || j < 0 || i >= NAV.w || j >= NAV.h) return false;
    var b = NAV.grid[j * NAV.w + i]; if (b === 0) return true; if (b === 1) return false;
    if (CO.game && CO.game.navPass) return !!CO.game.navPass(NAV.x0 + (i + 0.5) * NAV.cell, NAV.z0 + (j + 0.5) * NAV.cell);
    return false;
  }
  function navCell(p) { return { i: clamp(Math.floor((p.x - NAV.x0) / NAV.cell), 0, NAV.w - 1), j: clamp(Math.floor((p.z - NAV.z0) / NAV.cell), 0, NAV.h - 1) }; }
  function navNearestOpen(cl) { if (navOpen(cl.i, cl.j)) return cl; for (var r = 1; r < 8; r++) for (var dj = -r; dj <= r; dj++) for (var di = -r; di <= r; di++) if (Math.abs(di) === r || Math.abs(dj) === r) if (navOpen(cl.i + di, cl.j + dj)) return { i: cl.i + di, j: cl.j + dj }; return cl; }
  function navFreeAt(x, z) { if (NAV.dirty || !NAV.grid) navBuild(); var cl = navCell({ x: x, z: z }); return navOpen(cl.i, cl.j); }
  function navLine(a, b) { var dx = b.x - a.x, dz = b.z - a.z, n = Math.ceil(Math.sqrt(dx * dx + dz * dz) / (NAV.cell * 0.5)) + 1, prev = null; for (var k = 0; k <= n; k++) { var cl = navCell({ x: a.x + dx * k / n, z: a.z + dz * k / n }); if (!navOpen(cl.i, cl.j)) return false; if (prev && cl.i !== prev.i && cl.j !== prev.j && (!navOpen(cl.i, prev.j) || !navOpen(prev.i, cl.j))) return false; prev = cl; } return true; }   // no corner cutting on the string-pulled runs either
  function route(a, b) {
    if (NAV.dirty || !NAV.grid) navBuild();
    var sc = navNearestOpen(navCell(a)), gc = navNearestOpen(navCell(b));
    if (sc.i === gc.i && sc.j === gc.j) return [b];
    var W = NAV.w, open = [], came = {}, gs = {}, key = function (c) { return c.j * W + c.i; }, h = function (c) { return Math.abs(c.i - gc.i) + Math.abs(c.j - gc.j); };
    var sk = key(sc); gs[sk] = 0; open.push({ c: sc, f: h(sc) }); var closed = {}, found = null, steps = 0;
    while (open.length && steps++ < NAV.steps) {
      var bi = 0; for (var q = 1; q < open.length; q++) if (open[q].f < open[bi].f) bi = q;
      var cur = open.splice(bi, 1)[0], ck = key(cur.c); if (closed[ck]) continue; closed[ck] = 1;
      if (cur.c.i === gc.i && cur.c.j === gc.j) { found = cur.c; break; }
      for (var dj = -1; dj <= 1; dj++) for (var di = -1; di <= 1; di++) {
        if (!di && !dj) continue; var ni = cur.c.i + di, nj = cur.c.j + dj; if (!navOpen(ni, nj)) continue;
        if (di && dj && (!navOpen(cur.c.i + di, cur.c.j) || !navOpen(cur.c.i, cur.c.j + dj))) continue;   // no corner cutting
        var nk = nj * W + ni, ng = gs[ck] + (di && dj ? 1.414 : 1);
        if (gs[nk] !== undefined && gs[nk] <= ng) continue;
        gs[nk] = ng; came[nk] = ck; open.push({ c: { i: ni, j: nj }, f: ng + h({ i: ni, j: nj }) });
      }
    }
    if (!found) return [b];
    var cells = [], k2 = key(found); while (k2 !== undefined && k2 !== sk) { cells.push({ x: NAV.x0 + ((k2 % W) + 0.5) * NAV.cell, z: NAV.z0 + (Math.floor(k2 / W) + 0.5) * NAV.cell }); k2 = came[k2]; }
    cells.reverse(); cells.push(b);
    // string-pulling
    var out = [], from = a, idx = 0;
    while (idx < cells.length) { var far = idx; for (var m = cells.length - 1; m > idx; m--) if (navLine(from, cells[m])) { far = m; break; } out.push(cells[far]); from = cells[far]; idx = far + 1; }
    return out;
  }
  // turn the short way round
  function yawWrap(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }
  function easeYaw(cur, target, k) { return cur + yawWrap(target - cur) * k; }
  // walk a record { x, z, yaw } along a list of waypoints at speed, easing the heading; returns true when the last one is reached
  function walkAlong(rec, path, speed, dt) {
    if (!path || !path.length) return true;
    var p = path[0], dx = p.x - rec.x, dz = p.z - rec.z, dist = Math.sqrt(dx * dx + dz * dz), step = speed * dt;
    if (dist <= step) { rec.x = p.x; rec.z = p.z; path.shift(); return path.length === 0; }
    rec.x += dx / dist * step; rec.z += dz / dist * step; rec.yaw = easeYaw(rec.yaw || 0, Math.atan2(dx, dz), Math.min(1, dt * 8));
    return false;
  }
  // ── Log / toast ───────────────────────────────────────────────────
  function logEvent(msg, kind) {
    if (S && S.log) { S.log.unshift({ day: S.day, t: fmtTime(S.time || 0), msg: msg, kind: kind || '' }); if (S.log.length > 60) S.log.pop(); }
    feedPush(msg, kind);
  }
  function feedPush(msg, kind) {
    var feed = $('h-feed'); if (!feed) return;
    var d = document.createElement('div'); d.className = kind || '';
    d.innerHTML = '<span class="t">' + fmtTime(S && S.time || 0) + '</span>' + msg;
    feed.appendChild(d);
    while (feed.children.length > 6) feed.removeChild(feed.firstChild);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 14000);
  }
  var TOAST_MS = 2600;
  function toast(msg, kind) {
    var box = $('h-toasts');
    if (box) { var d = document.createElement('div'); d.className = kind || ''; d.innerHTML = msg; box.appendChild(d); while (box.children.length > 3) box.removeChild(box.firstChild); setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, TOAST_MS); }
    if (kind === 'bad') sfx('bad'); else if (kind === 'rare') sfx('rare'); else sfx('ok');
  }
  // ── Sound ─────────────────────────────────────────────────────────
  var AC = null, sfxBus = null;
  function audio() { if (!AC) { AC = new (window.AudioContext || window.webkitAudioContext)(); sfxBus = AC.createGain(); sfxBus.gain.value = SET && typeof SET.vol === 'number' ? SET.vol : 0.8; sfxBus.connect(AC.destination); } if (AC.state === 'suspended') AC.resume(); return AC; }
  // small synth helpers
  function sTone(type, f0, t, dur, gain, opts) { opts = opts || {}; var o = AC.createOscillator(), gn = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (opts.f1) o.frequency.exponentialRampToValueAtTime(opts.f1, t + dur); gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(gain, t + (opts.attack || 0.008)); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur); var dest = opts.dest || sfxBus; if (opts.lp) { var f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = opts.lp; gn.connect(f); f.connect(dest); } else gn.connect(dest); o.connect(gn); o.start(t); o.stop(t + dur + 0.05); }
  function sNoise(t, dur, gain, opts) { opts = opts || {}; var len = Math.floor(AC.sampleRate * dur); var buf = AC.createBuffer(1, len, AC.sampleRate); var d = buf.getChannelData(0); for (var i = 0; i < len; i++) { var env = opts.shape === 'swell' ? Math.sin(i / len * Math.PI) : opts.shape === 'flat' ? 1 : (1 - i / len); d[i] = (Math.random() * 2 - 1) * env; } var src = AC.createBufferSource(); src.buffer = buf; var f = AC.createBiquadFilter(); f.type = opts.type || 'highpass'; f.frequency.value = opts.freq || 4000; if (opts.q) f.Q.value = opts.q; var gn = AC.createGain(); gn.gain.setValueAtTime(gain, t); if (opts.fade) gn.gain.exponentialRampToValueAtTime(0.0001, t + dur); src.connect(f); f.connect(gn); gn.connect(opts.dest || sfxBus); src.start(t); }
  function sThud(t, f, gain, dur) { sTone('sine', f, t, dur || 0.12, gain, { f1: f * 0.5 }); sNoise(t, 0.05, gain * 0.5, { type: 'lowpass', freq: 600 }); }
  function sBeep(t, f, dur, gain) { sTone('square', f, t, dur || 0.08, gain || 0.05, { lp: 3000 }); }
  // the base voices every game has; a game adds its own to SFX by assignment
  var SFX = {
    ok:      function (t) { sTone('sine', 520, t, 0.07, 0.07); sTone('sine', 780, t + 0.07, 0.1, 0.07); },
    bad:     function (t) { sTone('sawtooth', 220, t, 0.14, 0.05, { lp: 1200 }); sTone('sawtooth', 160, t + 0.12, 0.16, 0.05, { lp: 1000 }); },
    rare:    function (t) { [660, 880, 1320, 1760].forEach(function (f, i) { sTone('sine', f, t + i * 0.07, 0.16, 0.07); }); },
    click:   function (t) { sTone('sine', 900, t, 0.03, 0.06); sNoise(t, 0.02, 0.05, { freq: 5000 }); },
    cash:    function (t) { [1175, 1568, 2093, 2637].forEach(function (f, i) { sTone('sine', f, t + i * 0.045, 0.14, 0.06); }); sNoise(t, 0.12, 0.08, { freq: 7000, fade: true }); },
    pickup:  function (t) { sNoise(t, 0.05, 0.08, { type: 'lowpass', freq: 1800 }); sTone('sine', 300, t, 0.08, 0.05, { f1: 200 }); },
    putdown: function (t) { sThud(t, 180, 0.09, 0.12); sNoise(t, 0.04, 0.05, { type: 'lowpass', freq: 1500 }); },
    crate:   function (t) { sThud(t, 120, 0.14, 0.18); sNoise(t + 0.02, 0.1, 0.08, { type: 'lowpass', freq: 900, fade: true }); },
    step:    function (t, o) { var f = o === 'steel' ? 200 : o === 'outside' ? 110 : 130; sThud(t, f, 0.035, 0.07); if (o === 'steel') sNoise(t, 0.03, 0.03, { freq: 3000 }); if (o === 'outside') sNoise(t, 0.06, 0.04, { type: 'bandpass', freq: 1200, q: 0.5 }); },
    roller:  function (t) { for (var i = 0; i < 14; i++) { sNoise(t + i * 0.085, 0.07, 0.07, { type: 'lowpass', freq: 500 + (i % 2) * 300 }); sTone('square', 60 + (i % 3) * 8, t + i * 0.085, 0.08, 0.02, { lp: 300 }); } sThud(t + 1.25, 90, 0.1, 0.15); },
    door:    function (t) { sTone('sawtooth', 180, t, 0.35, 0.02, { f1: 260, lp: 700 }); sThud(t + 0.38, 220, 0.07, 0.08); sNoise(t + 0.38, 0.03, 0.06, { freq: 3000 }); },
    bell:    function (t) { sTone('sine', 2093, t, 0.6, 0.06); sTone('sine', 2637, t + 0.005, 0.5, 0.04); sTone('sine', 3136, t + 0.01, 0.4, 0.02); },
    chime:   function (t) { [523, 659, 784, 1047].forEach(function (f, i) { sTone('sine', f, t + i * 0.16, 0.6, 0.05); }); },
    lock:    function (t) { sThud(t, 400, 0.06, 0.05); sNoise(t + 0.05, 0.04, 0.08, { freq: 3500 }); sTone('sine', 1800, t + 0.1, 0.08, 0.03); },
    unlock:  function (t) { sNoise(t, 0.05, 0.08, { freq: 3000 }); sThud(t + 0.08, 300, 0.07, 0.06); },
    beep:    function (t) { sBeep(t, 2200, 0.06, 0.04); },
    levelup: function (t) { [523, 659, 784, 1047, 1319].forEach(function (f, i) { sTone('triangle', f, t + i * 0.1, 0.4, 0.06); }); sNoise(t + 0.5, 0.4, 0.05, { freq: 6000, fade: true }); },
    fanfare: function (t) { [523, 659, 784, 1047, 784, 1047].forEach(function (f, i) { sTone('triangle', f, t + i * 0.12, 0.3, 0.06); }); },
    sleep:   function (t) { [440, 392, 349, 330].forEach(function (f, i) { sTone('sine', f, t + i * 0.3, 0.5, 0.04); }); },
    glass:   function (t) { for (var i = 0; i < 8; i++) sTone('sine', 2400 + Math.random() * 2400, t + i * 0.03, 0.08, 0.03); sNoise(t, 0.2, 0.1, { freq: 5000, fade: true }); }
  };
  var sfxCount = 0;
  function sfx(kind, opt) {
    if (SET && SET.sound === false) return;
    try { audio(); if (sfxBus && SET && typeof SET.vol === 'number') sfxBus.gain.value = SET.vol; var fn = SFX[kind] || SFX.click; fn(AC.currentTime, opt); sfxCount++; } catch (e) {}
  }
  // ── Settings (not part of the save: they belong to the machine) ───
  var SET_DEFAULTS = { sens: 1, invertY: false, quality: 'high', sound: true, vol: 0.8, fps: false, fov: 75, film: true, bob: true };
  function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(SET)); } catch (e) {} }
  function loadSettings() { try { var ss = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null'); if (ss) for (var sk in ss) if (sk in SET) SET[sk] = ss[sk]; } catch (e) {} return SET; }
  // ── The slot and the raw peek ─────────────────────────────────────
  // cfg.save is the save key prefix ('depotco'): the slot number lives at <prefix>-slot, the save at <prefix>-slot<n>, the
  // settings at <prefix>-settings unless cfg.settingsKey says otherwise. BOOT_SAVE is the raw save before anything is laid out,
  // so a game can size its world from it (a building stage) before it builds.
  function coSetupState(cfg) {
    var prefix = cfg.save || 'co-game';
    BOOT_SLOT = (function () { try { var q = /[?&]slot=(\d)/.exec(location.search); var sl = q ? +q[1] : +(localStorage.getItem(prefix + '-slot') || 1); return sl >= 1 && sl <= (cfg.slots || 3) ? sl : 1; } catch (e) { return 1; } })();
    SAVE = prefix + '-slot' + BOOT_SLOT; SETTINGS_KEY = cfg.settingsKey || prefix + '-settings';
    BOOT_SAVE = (function () { try { var raw = localStorage.getItem(SAVE), s = raw ? JSON.parse(raw) : null; return s && typeof s === 'object' ? s : null; } catch (e) { return null; } })();
    SET = {}; for (var k in SET_DEFAULTS) SET[k] = SET_DEFAULTS[k]; if (cfg.settings) for (var k2 in cfg.settings) SET[k2] = cfg.settings[k2];
    loadSettings();
    CO.save = { prefix: prefix, key: SAVE, slot: BOOT_SLOT };
  }
  function setSlot(n) { try { localStorage.setItem(CO.save.prefix + '-slot', String(n)); } catch (e) {} }
  // ── Load and save ─────────────────────────────────────────────────
  // loadSave(fresh, migrate): S becomes the slot's save, with every top-level key the fresh state has and the save lacks filled in,
  // then the game's migrate(s, fresh) run on it; or the fresh state when there is no save or it will not parse (the broken copy is
  // kept beside the slot). Returns true when a save was loaded.
  function loadSave(fresh, migrate) {
    var f = fresh(); S = f;
    try {
      var raw = localStorage.getItem(SAVE); if (!raw) return false;
      var s = JSON.parse(raw); if (!s || typeof s !== 'object') return false;
      for (var k in f) if (!(k in s)) s[k] = f[k];
      if (migrate) { var m = migrate(s, f); if (m && typeof m === 'object') s = m; }
      S = s; return true;
    } catch (e) {
      try { if (typeof console !== 'undefined') console.error('co-engine: the save in ' + SAVE + ' could not be loaded', e); var brokenRaw = localStorage.getItem(SAVE); if (brokenRaw) localStorage.setItem(SAVE + '-broken', brokenRaw); } catch (e2) {}
      S = fresh(); return false;
    }
  }
  var saveT = 0, wiped = false;
  function save() {
    if (wiped || !S) return;
    try { S.savedAt = now(); localStorage.setItem(SAVE, JSON.stringify(S)); saveT = now(); save.failed = false; }
    catch (e) { if (!save.failed) { save.failed = true; toast('The save could not be written: the browser refused the storage. Export it from the pause menu.', 'bad'); if (typeof console !== 'undefined') console.error('co-engine: save failed', e); } }   // said once, not at every autosave
  }
  function wipe() { wiped = true; try { localStorage.removeItem(SAVE); } catch (e) {} }
  function exportSave() { return JSON.stringify(S); }
  // ── The ledger ────────────────────────────────────────────────────
  function pay(n, why) { S.bank = (S.bank || 0) + n; if (S.stats) { if (n >= 0) S.stats.earned = (S.stats.earned || 0) + n; else S.stats.spent = (S.stats.spent || 0) + -n; } if (S.ledger) { S.ledger.unshift({ day: S.day, t: fmtTime(S.time || 0), n: n, why: why }); if (S.ledger.length > 80) S.ledger.pop(); } hudDirty = true; }
  // ── Seeded random ─────────────────────────────────────────────────
  // a thing's own dice: the same throw every time it is built, so a bought picture keeps its print and a tree its size through
  // every move, turn and reload. FNV-1a over the id and the throw number, mapped to [0, 1).
  function propSeed(id, k) { var s = String(id) + ':' + (k || 0), n = 2166136261; for (var i = 0; i < s.length; i++) { n ^= s.charCodeAt(i); n = Math.imul(n, 16777619) >>> 0; } return (n % 100000) / 100000; }
  function seededF(id, k, a, b) { return a + propSeed(id, k) * (b - a); }
  function seededI(id, k, a, b) { return a + Math.floor(propSeed(id, k) * (b - a + 1)); }
  function seededPick(id, k, arr) { return arr[Math.floor(propSeed(id, k) * arr.length) % arr.length]; }
  // a small linear congruential stream for a run of throws from one seed (a tree's branches, a crowd's faces)
  function seededStream(seed) { var s = (typeof seed === 'number' ? seed : Math.floor(propSeed(seed, 0) * 2147483647)) >>> 0 || 1; return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
  // succeeds if any of n tries at probability p does
  function unitRoll(p, n) { return 1 - Math.pow(1 - p, n || 1) > Math.random(); }
  // ── Colours ───────────────────────────────────────────────────────
  function mixHex(a, b, t) { var ar = a >> 16 & 255, ag = a >> 8 & 255, ab = a & 255, br = b >> 16 & 255, bg = b >> 8 & 255, bb = b & 255; return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t); }
  function hexCss(n) { return '#' + ('000000' + (n & 0xffffff).toString(16)).slice(-6); }
  // ── Data ──────────────────────────────────────────────────────────
  // merge a list by id: replace the entry whose id matches, else append. For a pack or a DLC that adds to a game's tables.
  function mergeById(list, extra) { extra.forEach(function (e) { var i = -1; for (var k = 0; k < list.length; k++) if (list[k].id === e.id) { i = k; break; } if (i >= 0) list[i] = e; else list.push(e); }); return list; }
  function fmtKg(n) { return (n < 10 ? Math.round(n * 10) / 10 : Math.round(n)) + ' kg'; }
  function fmtAgo(sec) { return sec < 60 ? Math.round(sec) + 's ago' : sec < 3600 ? Math.round(sec / 60) + 'm ago' : Math.round(sec / 3600) + 'h ago'; }
  function fmtLeft(sec) { return sec >= 60 ? Math.ceil(sec / 60) + ' min' : Math.ceil(sec) + ' s'; }
  // ── The sample ────────────────────────────────────────────────────
  // the game's hooks: a flat floor, walkable ground inside the room, two wall faces a wall prop can hang on, a clamp that keeps
  // a carried prop inside, and the list of walkers that doors open for
  var walkers = [];
  var GAME = {
    floorY: function (x, z) { return 0; },
    insideWalk: function (x, z) { return Math.abs(x) < 10 && Math.abs(z) < 10; },
    wallPlanes: function () { return [{ a: 'z', v: -9.83, n: 1, x0: -10, x1: 10 }, { a: 'x', v: -9.83, n: 1, z0: -10, z1: 10 }]; },
    editClamp: function (pt) { return { x: clamp(pt.x, -9.5, 9.5), z: clamp(pt.z, -9.5, 9.5) }; },
    doorOpeners: function () { return walkers; }
  };
  CO.setup({ canvas: 'co-canvas', save: 'co-sample', game: GAME, sun: { box: 30, far: 90, mapSize: 2048, target: [0, 0, 0] }, lightBudget: 6 });
  var loaded = loadSave(function () { return { day: 1, time: 9, bank: 500, level: 1, log: [], ledger: [], stats: { earned: 0, spent: 0 }, layout: {}, custom: [], hdoors: {}, presses: 0 }; });
  // the room: a slab, four walls (the north one with a doorway), the linings, a roof, lamps, and a hinged door in the doorway
  plane(20, 20, MAT.floor, 0, 0, 0, -Math.PI / 2);
  box(13.15, 4, 0.3, MAT.wall, -3.575, 2, -10); box(5.95, 4, 0.3, MAT.wall, 7.175, 2, -10); box(1.2, 1.7, 0.3, MAT.wall, 3.6, 3.15, -10);   // the north wall round a 1.2 m doorway at x 3 to 4.2
  box(20.3, 4, 0.3, MAT.wall, 0, 2, 10); box(0.3, 4, 20, MAT.wall, -10, 2, 0); box(0.3, 4, 20, MAT.wall, 10, 2, 0);
  solid(-10.15, 3, -10.15, -9.85); solid(4.2, 10.15, -10.15, -9.85); solid(-10.15, 10.15, 9.85, 10.15); solid(-10.15, -9.85, -10.15, 10.15); solid(9.85, 10.15, -10.15, 10.15);
  var northSegs = lineWall('z', -10, -9.85, 9.85, 3, MAT.plaster, [[3, 4.2, 2.3]], 1); lineWall('x', -10, -9.85, 9.85, 3, MAT.plaster, [], 1);
  roomFloor(MAT.carpet, -9.85, -2, 2, 9.85, 1.0);
  plane(20, 20, MAT.roofIn, 0, 4, 0, Math.PI / 2);
  troffer(-6, 3.9, 6); troffer(-6, 3.9, 8); highBay(4, 3.2, 0, 4);
  var door = hingedDoor('north', 3.1, -10, true, 'the north door', { pushbar: true });
  // outside: a fence to the south and a tree in the corner
  fenceRun(-14, 14, 14, 14); tree(13, -13, 1.1);
  // props: a crate stack you can carry, a sign on the wall, a panel with a touch screen, and a chair in the catalogue
  defProp('crateStack', { label: 'crate stack', x: -4, z: 2, rot: 0, cat: 'room', build: function (c) { for (var i = 0; i < 6; i++) c.box(0.9, 0.5, 0.9, MAT.wood, (i % 3) * 1.0 - 1, 0.25 + Math.floor(i / 3) * 0.5, 0); c.solid(-1.5, 1.5, -0.45, 0.45, 0, 1.0); } });
  defProp('wallSign', { label: 'wall sign', x: 0, z: -9.82, rot: 0, cat: 'wall', wall: true, build: function (c) { c.sign(['CO ENGINE', 'sample room'], 2.4, 0.6, 0, 2.6, 0.01, 0, { bg: '#1b232c' }); } });
  defProp('panel', { label: 'control panel', x: 8, z: -9.5, rot: 0, cat: 'hall', build: function (c) {
    c.box(0.9, 1.3, 0.22, MAT.grey, 0, 1.45, -0.11); c.solid(-0.45, 0.45, -0.25, 0.05, 0, 2.2);
    touchScreen({ w: 420, h: 330, pw: 0.78, ph: 0.616, x: 0, y: 1.5, z: 0.012, parent: c.group, title: 'Sample panel', draw: function (ctx, sc) { scBg(ctx, sc.w, sc.h); scHead(ctx, sc.w, 'SAMPLE PANEL', 'Day ' + S.day); scText(ctx, 16, 66, 'Presses: ' + (S.presses || 0)); scButton(sc, 16, 80, 120, 40, 'Press', true, function () { S.presses = (S.presses || 0) + 1; }); scButton(sc, 148, 80, 120, 40, 'Lights', !S.lightsOff, function () { S.lightsOff = !S.lightsOff; }); } });
  } });
  defProp('xChair', { extra: true, label: 'chair', cat: 'room', price: 40, desc: 'A chair.', build: function (c) { c.box(0.44, 0.05, 0.44, MAT.red, 0, 0.46, 0); c.box(0.44, 0.5, 0.05, MAT.red, 0, 0.72, -0.2); [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]].forEach(function (p) { c.cyl(0.02, 0.45, MAT.steelDark, p[0], 0.22, p[1], 6); }); c.solid(-0.25, 0.25, -0.25, 0.25, 0, 1); } });
  buildProps();
  navSetup({ x0: -16, z0: -16, width: 32, depth: 32, cell: 0.4 });
  camera.position.set(0, 1.6, 7); camera.lookAt(0, 1, -2);
  bakeStatic(); resize(); renderFrame(0.016);
  var frames = 0, last = performance.now();
  function sampleFrame() { requestAnimationFrame(sampleFrame); var t = performance.now(), dt = Math.min(0.05, (t - last) / 1000); last = t; worldTime += dt; doorsTick(dt); drawScreens(dt); editTick(); animated.forEach(function (fn) { fn(dt); }); updateLightBudget(); tickBursts(dt); renderFrame(dt); frames++; }
  sampleFrame();
  window.CO_SAMPLE = { T: { CO: CO, get S() { return S; }, SET: SET, scene: scene, renderer: renderer, camera: camera, baked: baked, MAT: MAT, TEX: TEX, NRM: NRM, solids: solids, inter: inter, screens: screens, hdoors: hdoors, door: door, walkers: walkers, northSegs: northSegs, lampMeshes: lampMeshes, geoCache: geoCache, BEVEL: BEVEL, NAV: NAV,
    PROPS: PROPS, propInst: propInst, edit: edit, defProp: defProp, buildProp: buildProp, buildProps: buildProps, propPlacement: propPlacement, propWorld: propWorld, removePropInst: removePropInst, rotAABB: rotAABB, catalogueData: catalogueData,
    editToggle: editToggle, editGrab: editGrab, editDrop: editDrop, editRotate: editRotate, editReset: editReset, editRemove: editRemove, editRestore: editRestore, editBuy: editBuy, editAim: editAim,
    hd: hd, doorUse: doorUse, doorLock: doorLock, doorPose: doorPose, doorsTick: doorsTick, doorSolids: doorSolids, lockAll: lockAll, anyDoorUnlocked: anyDoorUnlocked, doorById: doorById,
    drawScreens: drawScreens, screenZoneAt: screenZoneAt, screenTap: screenTap, screenDirtyAll: screenDirtyAll, scFit: scFit,
    spanCut: spanCut, lineWall: lineWall, roomFloor: roomFloor, troffer: troffer, highBay: highBay, fenceRun: fenceRun, tree: tree, lampPost: lampPost, floorY: floorY, insideWalk: insideWalk, inRect: inRect,
    navSetup: navSetup, navBuild: navBuild, navFreeAt: navFreeAt, route: route, walkAlong: walkAlong, yawWrap: yawWrap,
    sfx: sfx, SFX: SFX, sfxCount: function () { return sfxCount; }, toast: toast, logEvent: logEvent,
    loadSave: loadSave, save: save, pay: pay, saveSettings: saveSettings, loaded: loaded,
    bevelGeo: bevelGeo, roundCylGeo: roundCylGeo, boxGeo: boxGeo, taperGeo: taperGeo, textTex: textTex, tex: tex, normalTex: normalTex, box: box, cyl: cyl, sign: sign, groundBlob: groundBlob, disposeTree: disposeTree, clearKids: clearKids,
    bakeStatic: bakeStatic, unbakeStatic: unbakeStatic, rebake: rebake, renderFrame: renderFrame, post: post, resize: resize, burst: burst, tickBursts: tickBursts, bursts: bursts, updateLightBudget: updateLightBudget, lightBudget: lightBudget,
    propSeed: propSeed, seededF: seededF, seededStream: seededStream, mixHex: mixHex, hexCss: hexCss, mergeById: mergeById, fmtTime: fmtTime, money: money, hook: hook, runHooks: runHooks, HOOKS: HOOKS,
    frames: function () { return frames; }, calls: function () { return post.calls; } } };
})();
