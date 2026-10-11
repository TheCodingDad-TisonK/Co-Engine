(function () {
  'use strict';
  if (typeof THREE === 'undefined') { document.body.innerHTML = '<p style="padding:40px;font-family:sans-serif">three.js failed to load (vendor/three/three.min.js).</p>'; return; }
  // ── Co Engine ─────────────────────────────────────────────────────
  // The engine parts come first in the closure, the game's parts after. The engine declares the names both sides share
  // here, unassigned, and fills them when the game calls CO.setup (the renderer, the scene, the palette) and CO.boot (the
  // state, the shell, the frame loop). A game part may use any of them at its top level once CO.setup has run.
  var CO = { version: '0.12.1', cfg: null, game: null, root: null, flash: 0, ready: false, paused: false, stepOnce: false, editor: null };
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
  // every argument reaches every hook (the lighting hook takes four: day, dawn, overcast, power; until 0.5.1 only three got through, so power was always undefined)
  function runHooks(name) { var list = HOOKS[name]; if (!list) return; var args = Array.prototype.slice.call(arguments, 1); for (var i = 0; i < list.length; i++) { try { list[i].apply(null, args); } catch (e) { if (typeof console !== 'undefined') console.error('hook ' + name + ': ' + (e && e.message || e)); } } }
  // CO.setup(cfg): the game's first part calls this once, before any part uses the scene. It reads the settings and the save slot
  // (40-state), makes the renderer, the scene, the camera, the lights and the palette (10-three), then runs the 'setup' hooks.
  // cfg.game is the game's hook object (CO.game). Function declarations are hoisted, so the parts that define the setup steps come later.
  function coSetup(cfg) { cfg = cfg || {}; CO.cfg = cfg; CO.game = cfg.game || CO.game || {}; coSetupState(cfg); if (cfg.fov === undefined && SET && SET.fov) cfg.fov = SET.fov; coSetupThree(cfg); coSetupShell(cfg); coSetupPlayer(cfg); runHooks('setup', cfg); CO.ready = true; return CO; }
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
  function cachedGeo(k, make) { var g = geoCache[k]; if (!g) { g = geoCache[k] = make(); g.userData.shared = true; } return g; }   // a cached geometry is shared by every mesh built from it: never dispose it with a mesh
  function boxGeo(w, h, d) { return cachedGeo(w + ',' + h + ',' + d, function () { return new THREE.BoxGeometry(w, h, d); }); }
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
    g.userData.shared = true; return (geoCache[key] = g);
  }
  // a body part cut from an eased box: narrower at one end than the other, the way a chest runs down to a waist. Give it a fresh geometry.
  function taperGeo(g, h, sx0, sz0) { var p = g.attributes.position; for (var i = 0; i < p.count; i++) { var t = clamp((p.getY(i) + h / 2) / h, 0, 1); p.setX(i, p.getX(i) * lerp(sx0, 1, t)); p.setZ(i, p.getZ(i) * lerp(sz0, 1, t)); } g.computeVertexNormals(); return g; }
  // The same for anything turned: a cylinder's rims are eased and it gets enough sides to read as round. Wires and rods are left alone.
  function roundCylGeo(rt, rb, h, seg) {
    var rmax = Math.max(rt, rb), rmin = Math.min(rt, rb), r = (!BEVEL.on || rmax < 0.025 || h < 0.02) ? 0 : Math.min(BEVEL.max, h * 0.22, rmin * 0.3);
    seg = seg || 18; if (rmax >= 0.025) seg = Math.max(seg, rmax > 0.12 ? 32 : rmax > 0.05 ? 24 : 16);
    var key = 'c' + rt + ',' + rb + ',' + h + ',' + seg + (r > 0.0012 ? '' : 's'); if (geoCache[key]) return geoCache[key];
    if (!(r > 0.0012)) return cachedGeo(key, function () { return new THREE.CylinderGeometry(rt, rb, h, seg); });
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
    g.userData.shared = true; return (geoCache[key] = g);
  }
  // ── Placers: a mesh made, placed and parented in one call. The default parent is CO.root, else the scene ──
  function parentOf(p) { return p || WORLD_PARENT || CO.root || scene; }   // inside a kit call (part 26) the call's own item
  // box(w, h, d, mat, x, y, z, parent) or box(..., opts) with opts { parent, sharp, r, cast, receive, solid, tag, floorLevel }: a textured, tiled,
  // invisible or userData.sharp material gets a plain box, anything else an eased one (r: the bevel radius). A material with
  // userData.tile = [w, h] is tiled in metres, so the same brick lands on every panel whatever its size. opts.solid adds the box's
  // footprint to the game's blockers: CO.game.boxSolid(w, h, d, x, y, z, opts) when the game keeps its own list, else solids.
  function box(w, h, d, mat, x, y, z, parent) {
    var opts = parent && !parent.isObject3D ? parent : null, par = opts ? opts.parent : parent;
    var sharp = (opts && opts.sharp) || !mat || (mat.map && !(opts && opts.r)) || mat.visible === false || !!(mat.userData && (mat.userData.sharp || mat.userData.tile));
    var g = sharp ? boxGeo(w, h, d) : bevelGeo(w, h, d, opts && opts.r);
    if (mat && mat.userData && mat.userData.tile) { var tl = mat.userData.tile, geo = new THREE.BoxGeometry(w, h, d), uv = geo.attributes.uv; for (var ui = 0; ui < uv.count; ui++) { var fc = Math.floor(ui / 4), fw = fc < 2 ? d : w, fh = fc >= 2 && fc < 4 ? d : h; uv.setXY(ui, uv.getX(ui) * fw / tl[0], uv.getY(ui) * fh / tl[1]); } g = geo; }
    var m = new THREE.Mesh(g, mat); m.position.set(x, y, z); m.castShadow = !opts || opts.cast !== false; m.receiveShadow = !opts || opts.receive !== false; parentOf(par).add(m);
    if (opts && opts.solid) { if (CO.game && CO.game.boxSolid) CO.game.boxSolid(w, h, d, x, y, z, opts); else solid(x - w / 2, x + w / 2, z - d / 2, z + d / 2, y - h / 2, y + h / 2); }
    return m;
  }
  function plane(w, h, mat, x, y, z, rx, ry, parent) {
    var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.x = rx || 0; m.rotation.y = ry || 0; m.receiveShadow = true; parentOf(parent).add(m); return m;
  }
  // cyl(r, h, mat, x, y, z, parent, seg, rb), or Grow Co's order cyl(rt, rb, h, mat, x, y, z, parent, seg): the material in the fourth place tells them apart
  function cyl(r, h, mat, x, y, z, parent, seg, rb) {
    if (x && x.isMaterial) return cyl(r, mat, x, y, z, parent, seg, rb === undefined ? 18 : rb, h);
    var m = new THREE.Mesh(roundCylGeo(r, rb === undefined ? r : rb, h, seg || 12), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parentOf(parent).add(m); return m;
  }
  function sphere(r, mat, x, y, z, parent) { var m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), mat); m.position.set(x, y, z); m.castShadow = true; parentOf(parent).add(m); return m; }
  // sprite(mat, x, y, z, sx, sy, parent), or Grow Co's sprite(tex, w, h, x, y, z, parent) with a texture first
  function sprite(mat, x, y, z, sx, sy, parent) {
    if (mat && mat.isTexture) return sprite(new THREE.SpriteMaterial({ map: mat, transparent: true, depthWrite: false }), z, sx, sy, x, y, parent);
    var m = new THREE.Sprite(mat); m.position.set(x, y, z); m.scale.set(sx || 1, sy || sx || 1, 1); parentOf(parent).add(m); return m;
  }
  function sign(lines, w, h, x, y, z, ry, opt, parent) {
    var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: textTex(lines, opt) })); m.position.set(x, y, z); m.rotation.y = ry || 0; m.userData.sign = { lines: lines, opt: opt }; parentOf(parent).add(m);
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
    if (!post.on || !post.mat || lowQuality()) { renderer.setRenderTarget(null); renderer.render(scene, camera); post.calls = renderer.info.render.calls; post.tris = renderer.info.render.triangles; return; }
    if (!post.rt || post.rt.width !== Math.floor(window.innerWidth * renderer.getPixelRatio())) postResize();
    post.t += dt; post.mat.uniforms.uTime.value = post.t; post.mat.uniforms.tDiffuse.value = post.rt.texture; post.mat.uniforms.uFlash.value = CO.flash * 0.25;
    renderer.setRenderTarget(post.rt); renderer.render(scene, camera); post.calls = renderer.info.render.calls; post.tris = renderer.info.render.triangles;   /* the post quad renders after this and resets the counts */
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
    var tg = sc.target || [0, 0, -20]; sun.target.position.set(tg[0], tg[1], tg[2]); sun.shadow.bias = sc.bias === undefined ? -0.0006 : sc.bias; sun.shadow.normalBias = sc.normalBias === undefined ? 0.03 : sc.normalBias; sun.shadow.radius = sc.radius === undefined ? 4 : sc.radius;
    scene.add(sun); scene.add(sun.target);
    if (cfg.lightBudget) lightBudget.n = cfg.lightBudget;
    if (cfg.palette !== false) { buildBaseTextures(); buildBaseNormals(); buildBasePalette(); }   // palette false: the game draws every texture and material of its own
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
    for (var a = o.parent; a; a = a.parent) if (a.visible === false) return false;   /* a removed world item stays out of the bake */
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
  // ── Materials from a layer graph ───────────────────────────────────
  // A graph: { size, repeat: [rx, ry], layers: [{ type, color, color2, alpha, blend, n, size, gap, angle, dark }], roughness: 0.9 or
  // { base, amp }, metalness, bump: { amp, strength } or null, emissive, emissiveIntensity, glow, transparent, opacity }. The layers paint
  // one canvas from the bottom up; the same canvas is the colour map. A game's src/00-materials.js calls CO.material before the boot,
  // so a build function can say MAT.myBrick; the editor calls it again while running and every mesh on that material follows.
  var MATGRAPH = {}, MATGRAPH_ORDER = [], MAT_TIME = { value: 0 };
  animate(function (dt) { MAT_TIME.value += dt; });
  var MAT_LAYER_TYPES = ['fill', 'grain', 'blotches', 'cracks', 'noise', 'bricks', 'planks', 'tiles', 'stripes', 'checks', 'rings', 'speckle'];
  function matLayer(ctx, w, h, L, tag, k) {
    var t = L.type || 'fill', a = L.alpha === undefined ? 1 : +L.alpha, c1 = L.color || '#808080', c2 = L.color2 || '#404040', sz = L.size || 32, gap = L.gap === undefined ? 2 : +L.gap, n = L.n === undefined ? 200 : +L.n, i, j;
    ctx.save(); ctx.globalAlpha = a; ctx.globalCompositeOperation = L.blend || 'source-over';
    var rnd1 = function (q, lo, hi) { return seededF(tag + ':' + k, q, lo, hi); };
    if (t === 'fill') { ctx.fillStyle = c1; ctx.fillRect(0, 0, w, h); }
    else if (t === 'grain') { for (i = 0; i < n; i++) { var v = Math.floor(rnd1(i, 0, 255)); ctx.fillStyle = L.dark ? 'rgba(0,0,0,' + rnd1(i + 7, 0.05, 0.3) + ')' : 'rgb(' + v + ',' + v + ',' + v + ')'; ctx.globalAlpha = a * (L.dark ? 1 : 0.18); ctx.fillRect(rnd1(i + 1, 0, w), rnd1(i + 2, 0, h), rnd1(i + 3, 1, 3), rnd1(i + 4, 1, 3)); } }
    else if (t === 'blotches') { for (i = 0; i < n; i++) { var r = rnd1(i, sz * 0.2, sz), x = rnd1(i + 1, 0, w), y = rnd1(i + 2, 0, h), g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, L.dark ? 'rgba(0,0,0,' + a * 0.35 + ')' : c1); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.globalAlpha = L.dark ? 1 : a * 0.5; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); } }
    else if (t === 'cracks') { ctx.strokeStyle = c1; ctx.lineWidth = L.width || 1; for (i = 0; i < Math.min(n, 60); i++) { ctx.beginPath(); var cx = rnd1(i, 0, w), cy = rnd1(i + 1, 0, h); ctx.moveTo(cx, cy); for (j = 0; j < 6; j++) { cx += rnd1(i * 10 + j, -sz / 2, sz / 2); cy += rnd1(i * 10 + j + 5, -sz / 2, sz / 2); ctx.lineTo(cx, cy); } ctx.stroke(); } }
    else if (t === 'noise') { var amp = L.amp === undefined ? 40 : +L.amp; for (i = 0; i < n; i++) { var nv = Math.floor(128 + rnd1(i, -0.5, 0.5) * amp); ctx.fillStyle = 'rgb(' + nv + ',' + nv + ',' + nv + ')'; ctx.fillRect(rnd1(i + 1, 0, w), rnd1(i + 2, 0, h), rnd1(i + 3, 2, sz / 4), rnd1(i + 4, 2, sz / 4)); } }
    else if (t === 'bricks') { var bw = L.size || 48, bh = L.size2 || 20; ctx.fillStyle = c2; ctx.fillRect(0, 0, w, h); for (j = 0; j * bh < h; j++) for (i = -1; i * bw < w + bw; i++) { var off = (j % 2) * bw / 2, bx = i * bw + off, by = j * bh; ctx.fillStyle = L.vary ? mixHex(c1, c2, rnd1(i * 97 + j, 0, 0.18)) : c1; ctx.fillRect(bx + gap / 2, by + gap / 2, bw - gap, bh - gap); } }
    else if (t === 'planks') { var pw = L.size || 40; ctx.fillStyle = c2; ctx.fillRect(0, 0, w, h); for (i = 0; i * pw < w; i++) { ctx.fillStyle = mixHex(c1, c2, rnd1(i, 0, 0.15)); ctx.fillRect(i * pw + gap / 2, 0, pw - gap, h); for (j = 0; j < 30; j++) { ctx.fillStyle = 'rgba(0,0,0,' + rnd1(i * 50 + j, 0.03, 0.12) + ')'; ctx.fillRect(i * pw + rnd1(i * 50 + j + 1, 2, pw - 4), rnd1(i * 50 + j + 2, 0, h), 1, rnd1(i * 50 + j + 3, 8, 60)); } } }
    else if (t === 'tiles') { ctx.fillStyle = c2; ctx.fillRect(0, 0, w, h); for (j = 0; j * sz < h; j++) for (i = 0; i * sz < w; i++) { ctx.fillStyle = L.vary ? mixHex(c1, c2, rnd1(i * 131 + j, 0, 0.12)) : c1; ctx.fillRect(i * sz + gap / 2, j * sz + gap / 2, sz - gap, sz - gap); } }
    else if (t === 'stripes') { var ang = (L.angle || 0) * Math.PI / 180, sw = L.size || 16; ctx.translate(w / 2, h / 2); ctx.rotate(ang); ctx.translate(-w, -h); for (i = 0; i * sw < w * 3; i++) { ctx.fillStyle = i % 2 ? c2 : c1; ctx.fillRect(i * sw, 0, sw, h * 3); } }
    else if (t === 'checks') { for (j = 0; j * sz < h; j++) for (i = 0; i * sz < w; i++) { ctx.fillStyle = (i + j) % 2 ? c2 : c1; ctx.fillRect(i * sz, j * sz, sz, sz); } }
    else if (t === 'rings') { var rc = L.n === undefined ? 12 : n; for (i = rc; i >= 1; i--) { ctx.fillStyle = i % 2 ? c1 : c2; ctx.beginPath(); ctx.arc(w / 2, h / 2, (i / rc) * Math.max(w, h) * 0.72, 0, Math.PI * 2); ctx.fill(); } }
    else if (t === 'speckle') { for (i = 0; i < n; i++) { ctx.fillStyle = i % 3 ? c1 : c2; ctx.beginPath(); ctx.arc(rnd1(i, 0, w), rnd1(i + 1, 0, h), rnd1(i + 2, 0.5, sz / 8), 0, Math.PI * 2); ctx.fill(); } }
    ctx.restore();
  }
  function matCanvas(name, g) { var sz = g.size || 256, c = document.createElement('canvas'); c.width = sz; c.height = sz; var ctx = c.getContext('2d'); ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, sz, sz); (g.layers || []).forEach(function (L, k) { if (L && L.on !== false) matLayer(ctx, sz, sz, L, name, k); }); return c; }
  function matBuild(name, g) {
    g = JSON.parse(JSON.stringify(g || {})); if (!g.layers) g.layers = [{ type: 'fill', color: g.color || '#8a8f96' }];
    var sz = g.size || 256, rep = g.repeat || [1, 1], canvas = matCanvas(name, g), map = new THREE.CanvasTexture(canvas);
    map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(rep[0], rep[1]); map.encoding = THREE.sRGBEncoding; map.anisotropy = 8;
    var rough = typeof g.roughness === 'object' && g.roughness ? g.roughness : null, roughMap = rough ? roughTex(sz, sz, rough.base === undefined ? 0.8 : rough.base, rough.amp === undefined ? 0.2 : rough.amp, rep[0], rep[1]) : null;
    var normalMap = g.bump ? normalTex(sz, sz, function (c, w, h) { heightNoise(c, w, h, '#808080', g.bump.n || 1500, g.bump.amp || 40); }, g.bump.strength || 1, rep[0], rep[1]) : null;
    var m = MAT[name] && MAT[name].isMeshStandardMaterial ? MAT[name] : new THREE.MeshStandardMaterial();
    if (m.map && m.map !== map) m.map.dispose(); if (m.roughnessMap && m.roughnessMap !== roughMap) m.roughnessMap.dispose(); if (m.normalMap && m.normalMap !== normalMap) m.normalMap.dispose();
    m.map = map; m.roughnessMap = roughMap; m.normalMap = normalMap; m.color.set(g.tint || '#ffffff'); m.roughness = rough ? 1 : (g.roughness === undefined ? 0.9 : +g.roughness); m.metalness = g.metalness || 0;
    m.emissive.set(g.emissive || '#000000'); m.emissiveIntensity = g.emissiveIntensity === undefined ? 1 : +g.emissiveIntensity; m.transparent = !!g.transparent || (g.opacity !== undefined && g.opacity < 1); m.opacity = g.opacity === undefined ? 1 : +g.opacity;
    m.userData.glow = !!g.glow; m.userData.graph = true; m.name = name;
    // a GLSL snippet after the colour map: it may change diffuseColor, with vUv (when the material has a map) and uTime in seconds
    if (g.glsl) { var src = String(g.glsl); m.onBeforeCompile = function (sh) { sh.uniforms.uTime = MAT_TIME; sh.fragmentShader = 'uniform float uTime;\n' + sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n' + src); }; m.customProgramCacheKey = function () { return 'co-glsl:' + name + ':' + src.length + ':' + src.slice(0, 64); }; } else { m.onBeforeCompile = function () {}; m.customProgramCacheKey = function () { return 'co'; }; }
    m.needsUpdate = true;
    MAT[name] = m; if (!MATGRAPH[name]) MATGRAPH_ORDER.push(name); MATGRAPH[name] = g; return m;
  }
  CO.material = function (name, graph) { if (!name) return MATGRAPH; return matBuild(String(name), graph); };
  function matRemove(name) { if (!MATGRAPH[name]) return false; delete MATGRAPH[name]; MATGRAPH_ORDER.splice(MATGRAPH_ORDER.indexOf(name), 1); return true; }
  function matGraphs() { return { order: MATGRAPH_ORDER.slice(), graphs: JSON.parse(JSON.stringify(MATGRAPH)), types: MAT_LAYER_TYPES.slice(), blends: ['source-over', 'multiply', 'overlay', 'screen', 'soft-light', 'darken', 'lighten'], builtin: Object.keys(MAT).filter(function (k) { return !MATGRAPH[k]; }) }; }
  // a picture of one material on a sphere and a cube, rendered off screen with the page's own renderer
  var matPreview = null;
  function matShot(name, size) {
    var m = MAT[name]; if (!m || !renderer) return null; size = size || 160;
    if (!matPreview) { var sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(32, 1, 0.1, 20); cam.position.set(0, 1.1, 4.2); cam.lookAt(0, 0.1, 0); sc.add(new THREE.HemisphereLight(0xdfe8ff, 0x3a3328, 0.9)); var sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(2.5, 4, 3); sc.add(sun); var sph = new THREE.Mesh(new THREE.SphereGeometry(0.75, 48, 32), m), cube = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), m); sph.position.x = -0.95; cube.position.x = 0.95; cube.rotation.y = 0.6; cube.rotation.x = 0.2; sc.add(sph); sc.add(cube); matPreview = { scene: sc, cam: cam, sph: sph, cube: cube, rt: new THREE.WebGLRenderTarget(size, size), size: size, canvas: document.createElement('canvas') }; matPreview.canvas.width = size; matPreview.canvas.height = size; }
    var P = matPreview; P.sph.material = m; P.cube.material = m; P.scene.background = new THREE.Color(0x0e141b);
    var was = renderer.getRenderTarget(); renderer.setRenderTarget(P.rt); renderer.render(P.scene, P.cam); var px = new Uint8Array(size * size * 4); renderer.readRenderTargetPixels(P.rt, 0, 0, size, size, px); renderer.setRenderTarget(was);
    var ctx = P.canvas.getContext('2d'), img = ctx.createImageData(size, size), row = size * 4, y; for (y = 0; y < size; y++) img.data.set(px.subarray(y * row, y * row + row), (size - 1 - y) * row); ctx.putImageData(img, 0, 0);
    return P.canvas.toDataURL('image/png');
  }
  // the part the editor writes
  function matGraphCode() {
    if (!MATGRAPH_ORDER.length) return '';
    var lines = ['//@ the materials the editor saved: each one a layer graph the engine paints into a texture at load. Written by the Co Engine editor; it sorts first in src/ so every build function can say MAT.<name>. Edit them in the editor rather than here.'];
    MATGRAPH_ORDER.forEach(function (n) { lines.push('  CO.material(' + JSON.stringify(n) + ', ' + JSON.stringify(MATGRAPH[n]) + ');'); });
    lines.push(''); return lines.join('\n');
  }
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
  // The layout a game ships: where its props stand (over what the definitions say) and the copies the editor placed. The editor writes it
  // into src/00-layout.js as CO.layout({ props: { id: { x, z, rot, h, hidden } }, placed: [{ id, type, x, z, rot, h }] }), the first part
  // in the build so the boot sees it. A player's save still wins over it, as it wins over the definitions.
  var LAYOUT = { props: {}, placed: [] };
  CO.layout = function (L) { if (!L) return LAYOUT; if (L.props) for (var k in L.props) LAYOUT.props[k] = L.props[k]; if (L.placed) L.placed.forEach(function (p) { if (p && p.id && !placedById(p.id)) LAYOUT.placed.push(p); }); return LAYOUT; };
  function placedById(id) { for (var i = 0; i < LAYOUT.placed.length; i++) if (LAYOUT.placed[i].id === id) return LAYOUT.placed[i]; return null; }
  function numOr(v, d) { return typeof v === 'number' ? v : d; }
  function defProp(id, def) { if (CO.game && CO.game.resolveDef) CO.game.resolveDef(id, def); def.id = id; if (MODEL_OVER[id]) def.build = MODEL_OVER[id]; PROPS[id] = def; PROP_ORDER.push(id); return def; }
  // a prop whose build is shared (a pack's wrapper, a builder several props use) is reshaped by type: src/00-models.js, written by the
  // editor's Save, says modelOverride(type, build) and the build lands on that prop whenever it is defined, before or after (0.8.0)
  var MODEL_OVER = {};
  function modelOverride(type, build) { MODEL_OVER[type] = build; if (PROPS[type]) PROPS[type].build = build; }
  function propAllowed(id) { var d = PROPS[id]; if (!d) return true; if (d.extra) return true; if (CO.game && CO.game.propAllowed && !CO.game.propAllowed(id, d)) return false; return true; }
  function propDef(id) { if (PROPS[id]) return PROPS[id]; var c = customById(id); if (c) return PROPS[c.type]; var p = placedById(id); return p ? PROPS[p.type] : null; }
  function customById(id) { return (S && S.custom || []).filter(function (c) { return c.id === id; })[0] || null; }
  // where a prop stands: the save's override, else the shipped layout, else the definition (a custom copy: the save over its own record)
  function propPlacement(id) {
    var d = PROPS[id], c = customById(id), p = placedById(id), o = (S && S.layout && S.layout[id]) || {}, L = LAYOUT.props[id] || {};
    if (c) return { x: numOr(o.x, c.x), z: numOr(o.z, c.z), rot: numOr(o.rot, c.rot || 0), h: numOr(o.h, c.h || 0), hidden: !!o.hidden, custom: true };
    if (p && !d) return { x: numOr(o.x, p.x), z: numOr(o.z, p.z), rot: numOr(o.rot, p.rot || 0), h: numOr(o.h, p.h || 0), hidden: !!o.hidden, custom: false, placed: true };
    return { x: numOr(o.x, numOr(L.x, d.x)), z: numOr(o.z, numOr(L.z, d.z)), rot: numOr(o.rot, numOr(L.rot, d.rot || 0)), h: numOr(o.h, L.h || 0), hidden: o.hidden !== undefined ? !!o.hidden : !!L.hidden, custom: false };
  }
  // the shipped place of a prop, with no save over it: what the layout file says, else the definition
  function propDefault(id) { var d = PROPS[id], p = placedById(id), L = LAYOUT.props[id] || {}; if (p && !d) return { x: p.x, z: p.z, rot: p.rot || 0, h: p.h || 0, hidden: false }; return { x: numOr(L.x, d.x), z: numOr(L.z, d.z), rot: numOr(L.rot, d.rot || 0), h: L.h || 0, hidden: !!L.hidden }; }
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
      lane: function (points, opt) { return roadLaneLocal(g, id, points, opt); },
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
    roadDropProp(id);
    runHooks('propRemoved', id, inst);
    delete propInst[id]; NAV.dirty = true;
  }
  function propGroundY(x, z) { var g = CO.game && CO.game.groundY ? CO.game.groundY(x, z) : 0; return TERRAIN.on ? Math.max(g, terrainY(x, z)) : g; }
  function buildProp(id) {
    removePropInst(id);
    var def = propDef(id); if (!def) return null; if (!propAllowed(id)) return null;
    var P = propPlacement(id), g = new THREE.Group(); g.userData.propId = id; g.position.set(P.x, (typeof def.y === 'number' ? def.y : propGroundY(P.x, P.z)) + (def.ownHeight ? 0 : (P.h || 0)), P.z);   /* the height a prop was raised to (the inspector, PageUp, Drop) lifts the whole prop; a def that places its own parts by P.h says ownHeight (0.6.0; before, h was stored and never shown) */ g.rotation.y = P.rot * Math.PI / 2;
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
  function buildProps() { PROP_ORDER.forEach(function (id) { if (!PROPS[id].extra && propAllowed(id) && (!PROPS[id].when || PROPS[id].when())) buildProp(id); }); LAYOUT.placed.forEach(function (p) { if (PROPS[p.type] && !PROPS[p.id]) buildProp(p.id); }); (S && S.custom || []).forEach(function (c) { if (PROPS[c.type]) buildProp(c.id); }); }
  function propIdOf(obj) { for (var o = obj; o; o = o.parent) if (o.userData && o.userData.propId) return o.userData.propId; return null; }
  function propWorld(prop, lx, lz) { var P = propPlacement(prop), a = P.rot * Math.PI / 2; return { x: P.x + lx * Math.cos(a) + lz * Math.sin(a), z: P.z - lx * Math.sin(a) + lz * Math.cos(a), a: a }; }

  // ── Build mode ────────────────────────────────────────────────────
  var edit = { on: false, grabbed: null, helper: null, snap: true, wallAim: null, snapCycle: 0, grabRot: 0, snapText: '' };   // snapCycle: which snap (or free heading) R has walked to for the carried piece
  var ray = new THREE.Raycaster(); ray.far = 3.4; var centre = new THREE.Vector2(0, 0);
  function editAllowed() { return CO.game && CO.game.canEdit ? CO.game.canEdit() : true; }
  function editToggle() {
    if (CO.game && CO.game.editMode === false) return;   // the game brings its own build mode
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
    if (!edit.on || (CO.game && CO.game.editMode === false)) return;
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
  function editRestore(id) { if (!S.layout) S.layout = {}; S.layout[id] = S.layout[id] || {}; S.layout[id].hidden = false; buildProp(id); sfx('ok'); toast('The ' + propLabel(id) + ' is back', 'good'); save(); }
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
    var hidden = PROP_ORDER.filter(function (id) { return !PROPS[id].extra && propPlacement(id).hidden; }).concat(LAYOUT.placed.filter(function (p) { return !PROPS[p.id] && propPlacement(p.id).hidden; }).map(function (p) { return p.id; })), groups = {};
    PROP_ORDER.forEach(function (id) { var d = PROPS[id]; if (!d.extra || d.shop === false) return; (groups[d.cat || 'other'] = groups[d.cat || 'other'] || []).push(id); });
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
  // ── The human model ───────────────────────────────────────────────
  // A rigged person: hip and knee pivots, shoulder and elbow pivots, a torso that rolls with the stride and a head that turns to
  // look at you. Every limb is an eased cylinder, the shoes have soles and laces, the shirt has a collar, buttons, a pocket and a
  // belt, the hair is a cap with a fringe, sideburns and a nape (or long, or a bun), and the face is a 256 px decal that blinks.
  // makeHuman(opt), animateHuman(g, dt, mode, speed, look, carry), setMood(g, mood), say(g, text, col).
  var SKINS = [0xf1d2b6, 0xe2b48f, 0xd9a98a, 0xb87b5a, 0x8d5a3c, 0x5c3a28];
  var HAIRS = [0x1d1510, 0x3a2a1c, 0x6b4a2b, 0xa8793f, 0xd9b36a, 0x8a8a8a, 0xb0352a, 0x2b2b35];
  var SHIRTS = [0x8c949c, 0x3b4b6b, 0x7b3f3f, 0x2f6f4f, 0xd9d9d9, 0x5a4b7b, 0x8a6a3a, 0x335b7b, 0x2a2d33];
  var PANTS = [0x2e3f63, 0x3a3a3a, 0x5b4b3a, 0x1f2a44, 0x6b6b6b];
  var EYES = ['#3a5a8a', '#4a3221', '#2a6a3a', '#5a4a2a', '#6a7a8a'];
  var faceCache = {};
  // what a face key decides, the same every time that key is drawn: eye colour, brow weight, freckles
  function faceSpec(key) { var n = 0; for (var i = 0; i < key.length; i++) n = (n * 31 + key.charCodeAt(i)) >>> 0; return { eye: EYES[n % EYES.length], freckles: n % 5 === 0, brow: n % 3 === 0 ? '#1a1008' : '#2a1a10', thin: n % 4 === 1 }; }
  function faceTex(key, mood, skin, blink) {
    var k = key + mood + (blink ? 'b' : ''); if (faceCache[k]) return faceCache[k];
    var sp = faceSpec(key);
    var t = tex(256, 256, function (ctx, w, h) {
      ctx.clearRect(0, 0, w, h);
      var eyeY = 112, iris = sp.eye, closed = blink || mood === 'tired', squint = mood === 'happy' ? 12 : mood === 'angry' ? 12.5 : 15;
      [84, 172].forEach(function (x, i) {
        var sd = i ? 1 : -1, px = x + (mood === 'shifty' ? 8 : 0);
        if (closed) { ctx.strokeStyle = '#3a2a20'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - 21, eyeY + 1); ctx.quadraticCurveTo(x, eyeY + 9, x + 21, eyeY + 1); ctx.stroke(); return; }
        ctx.save(); ctx.beginPath(); ctx.ellipse(x, eyeY, 22, squint, 0, 0, Math.PI * 2); ctx.clip();
        ctx.fillStyle = '#fbf8f2'; ctx.fillRect(x - 24, eyeY - 18, 48, 36);
        var ig = ctx.createRadialGradient(px, eyeY + 1, 2, px, eyeY + 1, 11); ig.addColorStop(0, iris); ig.addColorStop(0.75, iris); ig.addColorStop(1, 'rgba(10,15,25,.9)'); ctx.fillStyle = ig; ctx.beginPath(); ctx.arc(px, eyeY + 1, 10.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#0b0b0d'; ctx.beginPath(); ctx.arc(px, eyeY + 1, 4.8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.beginPath(); ctx.arc(px + 4, eyeY - 4, 3.2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.arc(px - 4, eyeY + 5, 1.6, 0, Math.PI * 2); ctx.fill();
        var lid = ctx.createLinearGradient(0, eyeY - squint, 0, eyeY - squint + 12); lid.addColorStop(0, 'rgba(40,20,10,.5)'); lid.addColorStop(1, 'rgba(40,20,10,0)'); ctx.fillStyle = lid; ctx.fillRect(x - 24, eyeY - squint, 48, 12);
        ctx.restore();
        ctx.strokeStyle = '#2f2019'; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.ellipse(x, eyeY, 22, squint, 0, Math.PI * 1.02, Math.PI * 1.98); ctx.stroke();
        ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(60,35,25,.45)'; ctx.beginPath(); ctx.ellipse(x, eyeY, 22, squint, 0, Math.PI * 0.12, Math.PI * 0.88); ctx.stroke();
        ctx.lineWidth = 2.5; ctx.strokeStyle = '#2f2019'; ctx.beginPath(); ctx.moveTo(x + sd * 21, eyeY - 3); ctx.lineTo(x + sd * 27, eyeY - 8); ctx.stroke();
      });
      ctx.fillStyle = sp.brow; var tilt = mood === 'angry' ? 12 : mood === 'tired' ? -6 : mood === 'happy' ? -3 : 0, bt = sp.thin ? 0.6 : 1;
      [[58, 110], [198, 146]].forEach(function (b) { ctx.beginPath(); ctx.moveTo(b[0], 84 - tilt + 2); ctx.quadraticCurveTo((b[0] + b[1]) / 2, 72, b[1], 84 + tilt - 4 * bt); ctx.lineTo(b[1], 84 + tilt + 5 * bt); ctx.quadraticCurveTo((b[0] + b[1]) / 2, 80, b[0], 84 - tilt + 4); ctx.closePath(); ctx.fill(); });
      ctx.fillStyle = 'rgba(70,35,20,.22)'; ctx.beginPath(); ctx.ellipse(128, 166, 17, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#8a4536'; ctx.lineCap = 'round'; ctx.lineWidth = 4.5; ctx.beginPath();
      if (mood === 'happy') { ctx.fillStyle = '#4a1a1a'; ctx.beginPath(); ctx.moveTo(96, 186); ctx.quadraticCurveTo(128, 216, 160, 186); ctx.quadraticCurveTo(128, 194, 96, 186); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(102, 188.5); ctx.quadraticCurveTo(128, 196, 154, 188.5); ctx.quadraticCurveTo(128, 203, 102, 188.5); ctx.fill(); ctx.beginPath(); ctx.moveTo(96, 186); ctx.quadraticCurveTo(128, 216, 160, 186); ctx.stroke(); }
      else if (mood === 'tired') { ctx.moveTo(100, 198); ctx.quadraticCurveTo(128, 186, 156, 198); ctx.stroke(); }
      else if (mood === 'angry') { ctx.moveTo(100, 196); ctx.quadraticCurveTo(128, 186, 156, 192); ctx.stroke(); }
      else if (mood === 'talk') { ctx.fillStyle = '#3a1a1a'; ctx.beginPath(); ctx.ellipse(128, 194, 16, 12, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#c0605a'; ctx.beginPath(); ctx.ellipse(128, 200, 9, 5, 0, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.moveTo(104, 192); ctx.quadraticCurveTo(128, 199, 152, 192); ctx.stroke(); }
      if (mood !== 'talk' && mood !== 'happy') { ctx.strokeStyle = 'rgba(90,40,30,.25)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(114, 205); ctx.quadraticCurveTo(128, 210, 142, 205); ctx.stroke(); }
      ctx.fillStyle = 'rgba(255,110,110,' + (mood === 'happy' ? 0.26 : 0.12) + ')'; [62, 194].forEach(function (x) { var bl = ctx.createRadialGradient(x, 152, 2, x, 152, 22); bl.addColorStop(0, ctx.fillStyle); bl.addColorStop(1, 'rgba(255,110,110,0)'); ctx.save(); ctx.fillStyle = bl; ctx.beginPath(); ctx.arc(x, 152, 22, 0, Math.PI * 2); ctx.fill(); ctx.restore(); });
      if (sp.freckles) { ctx.fillStyle = 'rgba(120,70,40,.5)'; for (var f = 0; f < 22; f++) { ctx.beginPath(); ctx.arc(60 + Math.random() * 136, 136 + Math.random() * 30, 1.6, 0, Math.PI * 2); ctx.fill(); } }
    });
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; faceCache[k] = t; return t;
  }
  var HUMAN_GEO = null, HUMAN_SCALE = 0.93, HUMAN_M = null;
  function humanGeo() {
    if (HUMAN_GEO) return HUMAN_GEO;
    var G = HUMAN_GEO = {
      thigh: roundCylGeo(0.088, 0.068, 0.42, 18), shin: roundCylGeo(0.064, 0.046, 0.4, 18), knee: new THREE.SphereGeometry(0.068, 14, 10),
      shoe: bevelGeo(0.12, 0.085, 0.27, 0.036, 3), sole: bevelGeo(0.128, 0.03, 0.285, 0.012, 1), lace: bevelGeo(0.1, 0.02, 0.06, 0.006, 1),
      hips: bevelGeo(0.36, 0.18, 0.22, 0.08, 3), torso: taperGeo(bevelGeo(0.4, 0.5, 0.24, 0.1, 3).clone(), 0.5, 0.86, 0.9), chest: bevelGeo(0.44, 0.26, 0.26, 0.11, 3),
      belt: bevelGeo(0.38, 0.05, 0.24, 0.012, 1), buckle: bevelGeo(0.05, 0.04, 0.02, 0.005, 1), placket: bevelGeo(0.12, 0.05, 0.03, 0.008, 1), button: roundCylGeo(0.008, 0.008, 0.006, 8), pocket: bevelGeo(0.1, 0.1, 0.005, 0.002, 1),
      upperArm: roundCylGeo(0.054, 0.044, 0.3, 14), foreArm: roundCylGeo(0.044, 0.034, 0.3, 14), elbow: new THREE.SphereGeometry(0.047, 12, 10), shoulder: new THREE.SphereGeometry(0.072, 14, 10),
      hand: bevelGeo(0.075, 0.1, 0.036, 0.016, 2), thumb: roundCylGeo(0.012, 0.012, 0.05, 8), cuff: roundCylGeo(0.043, 0.04, 0.035, 14), hem: roundCylGeo(0.058, 0.056, 0.04, 16), collar: bevelGeo(0.085, 0.036, 0.012, 0.004, 1),
      neck: roundCylGeo(0.05, 0.062, 0.1, 14), head: new THREE.SphereGeometry(0.17, 28, 20), ear: new THREE.SphereGeometry(0.03, 10, 8), nose: new THREE.SphereGeometry(0.021, 12, 10),
      hairCap: new THREE.SphereGeometry(0.17, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), hairLong: new THREE.SphereGeometry(0.17, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.62),
      vest: bevelGeo(0.47, 0.5, 0.29, 0.06, 3), band: bevelGeo(0.48, 0.04, 0.3, 0.012, 1), strap: bevelGeo(0.05, 0.28, 0.3, 0.012, 1),
      peak: bevelGeo(0.2, 0.015, 0.14, 0.005, 1)
    };
    G.beard = new THREE.SphereGeometry(0.17, 20, 8, -Math.PI * 0.1, Math.PI * 1.2, Math.PI * 0.7, Math.PI * 0.3); G.beard.scale(1.035, 1.15, 0.985);
    G.hairFall = new THREE.CylinderGeometry(0.178, 0.205, 0.4, 22, 3, true, Math.PI * 0.42, Math.PI * 1.16);
    G.ear.scale(0.5, 1.15, 0.85); G.nose.scale(0.82, 1.3, 1.05); G.head.scale(1, 1.12, 0.95);
    G.hairCap.scale(1.07, 1.2, 1.02); G.hairLong.scale(1.08, 1.21, 1.04);
    G.fringe = new THREE.SphereGeometry(0.17, 20, 8, Math.PI * 0.15, Math.PI * 0.7, Math.PI * 0.3, Math.PI * 0.2); G.fringe.scale(1.075, 1.205, 1.03);
    G.sideL = new THREE.SphereGeometry(0.17, 12, 8, Math.PI * 1.88, Math.PI * 0.24, Math.PI * 0.4, Math.PI * 0.22); G.sideL.scale(1.075, 1.205, 1.03);
    G.sideR = new THREE.SphereGeometry(0.17, 12, 8, Math.PI * 0.88, Math.PI * 0.24, Math.PI * 0.4, Math.PI * 0.22); G.sideR.scale(1.075, 1.205, 1.03);
    G.nape = new THREE.SphereGeometry(0.17, 16, 8, Math.PI * 1.2, Math.PI * 0.6, Math.PI * 0.4, Math.PI * 0.3); G.nape.scale(1.075, 1.205, 1.03);
    for (var k in G) keepShared(G[k]);
    HUMAN_M = { band: std({ color: 0xc9ced3, roughness: 0.3, metalness: 0.4, emissive: 0x666666, emissiveIntensity: 0.25 }), lace: std({ color: 0xf2f2f2, roughness: 0.9 }), belt: std({ color: 0x3a2a1a, roughness: 0.5 }), sole: std({ color: 0xd8d4cc, roughness: 0.9 }) };
    for (var m in HUMAN_M) keepShared(HUMAN_M[m]);
    return G;
  }
  // opt: skin, hair, style ('short' | 'long' | 'bun' | 'bald' | 'cap'), shirt (a material), vest (a material), name, rolled, mood, cap, capMat, hardhat (a material), noBeard, glasses
  function makeHuman(opt) {
    opt = opt || {}; var G = humanGeo(), M = HUMAN_M;
    var skinCol = opt.skin || pick(SKINS), hairCol = opt.hair || pick(HAIRS), style = opt.style || pick(['short', 'short', 'long', 'bun', 'bald', 'cap']);
    var skin = std({ color: skinCol, roughness: 0.75 }), shirt = opt.shirt || std({ map: TEX.cloth, color: pick(SHIRTS), roughness: 0.92 }), pants = opt.pants || std({ map: TEX.cloth, color: pick(PANTS), roughness: 0.95 }), hair = std({ color: hairCol, roughness: 0.62 }), hairSide = hair.clone(); hairSide.side = THREE.DoubleSide;
    var shoeM = std({ color: pick([0x1e1a18, 0x3a2a1a, 0x4a3a2a, 0x2f2f33]), roughness: 0.6 }), shirtDark = shirt.clone(); if (shirtDark.color) shirtDark.color.multiplyScalar(0.85);
    var rolled = opt.rolled !== undefined ? !!opt.rolled : Math.random() < 0.4;
    var g = new THREE.Group(), u = g.userData; u.dynamic = true;
    u.key = opt.key || 'f' + Math.floor(Math.random() * 100000); u.mood = opt.mood || 'neutral'; u.blink = 0; u.blinkIn = randf(2, 6); u.walk = 0; u.idleT = Math.random() * 10; u.lookYaw = 0; u.lookPitch = 0; u.skinKey = skinCol.toString(16); u.phase = Math.random() * 6.28;
    g.scale.setScalar(HUMAN_SCALE);
    function mesh(geo, mat, x, y, z, parent) { var m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; (parent || g).add(m); return m; }
    function leg(side) {
      var hip = new THREE.Group(); hip.position.set(side * 0.1, 0.86, 0); g.add(hip);
      mesh(G.thigh, pants, 0, -0.21, 0, hip);
      var knee = new THREE.Group(); knee.position.set(0, -0.42, 0); hip.add(knee); hip.userData.knee = knee;
      mesh(G.knee, pants, 0, 0, 0, knee); mesh(G.shin, pants, 0, -0.2, 0, knee);
      mesh(G.shoe, shoeM, 0, -0.4, 0.05, knee); mesh(G.sole, M.sole, 0, -0.445, 0.05, knee); mesh(G.hem, pants, 0, -0.35, 0, knee); mesh(G.lace, M.lace, 0, -0.36, 0.12, knee);
      return hip;
    }
    u.legs = [leg(-1), leg(1)];
    var torso = new THREE.Group(); torso.position.y = 0.86; g.add(torso); u.torso = torso;
    mesh(G.hips, pants, 0, 0.02, 0, torso); mesh(G.belt, M.belt, 0, 0.1, 0, torso); mesh(G.buckle, MAT.chrome, 0, 0.1, 0.125, torso);
    mesh(G.torso, shirt, 0, 0.36, 0, torso); u.chest = mesh(G.chest, shirt, 0, 0.52, 0, torso);
    [-1, 1].forEach(function (sd) { var cl = mesh(G.collar, shirt, sd * 0.05, 0.648, 0.118, torso); cl.rotation.set(-0.35, sd * -0.25, sd * -0.62); });
    mesh(G.placket, shirt, 0, 0.62, 0.13, torso); for (var b = 0; b < 4; b++) mesh(G.button, M.lace, 0, 0.2 + b * 0.11, 0.125, torso).rotation.x = Math.PI / 2; mesh(G.pocket, shirtDark, -0.11, 0.48, 0.125, torso);
    if (opt.vest) { mesh(G.vest, opt.vest, 0, 0.33, 0, torso); mesh(G.band, M.band, 0, 0.22, 0, torso); mesh(G.band, M.band, 0, 0.38, 0, torso); mesh(G.strap, M.band, -0.15, 0.5, 0, torso); mesh(G.strap, M.band, 0.15, 0.5, 0, torso); }
    if (opt.name) { var tag = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.05), new THREE.MeshBasicMaterial({ map: textTex([opt.name], { w: 128, h: 48, bg: '#fff', fg: '#1b232c' }) })); tag.position.set(0.1, 0.46, opt.vest ? 0.152 : 0.132); torso.add(tag); }
    function arm(side) {
      var sh = new THREE.Group(); sh.position.set(side * 0.27, 0.6, 0); torso.add(sh);
      mesh(G.shoulder, shirt, 0, 0, 0, sh); mesh(G.upperArm, shirt, 0, -0.16, 0, sh);
      var el = new THREE.Group(); el.position.set(0, -0.31, 0); sh.add(el); sh.userData.elbow = el;
      mesh(G.elbow, shirt, 0, 0, 0, el); mesh(G.foreArm, rolled ? skin : shirt, 0, -0.15, 0, el);
      if (!rolled) mesh(G.cuff, shirt, 0, -0.285, 0, el); else mesh(G.cuff, shirt, 0, -0.03, 0, el);
      var hand = mesh(G.hand, skin, 0, -0.35, 0, el); el.userData.hand = hand; var th = mesh(G.thumb, skin, side * 0.04, -0.33, 0.01, el); th.rotation.z = side * 0.6;
      return sh;
    }
    u.arms = [arm(-1), arm(1)];
    var head = new THREE.Group(); head.position.set(0, 0.66, 0); torso.add(head); u.head = head;
    mesh(G.neck, skin, 0, 0.04, 0, head); mesh(G.head, skin, 0, 0.24, 0, head); mesh(G.nose, skin, 0, 0.222, 0.164, head);
    [-1, 1].forEach(function (s) { mesh(G.ear, skin, s * 0.165, 0.24, -0.01, head); });
    var hy = 0.24, capOn = style === 'cap' || !!opt.cap;
    if (style !== 'bald') {
      if (style === 'long') { mesh(G.hairLong, hair, 0, hy, 0, head); mesh(G.hairFall, hairSide, 0, hy - 0.16, -0.012, head); }
      else { mesh(G.hairCap, hair, 0, hy, 0, head); mesh(G.nape, hair, 0, hy, 0, head); }
      if (style === 'bun') mesh(new THREE.SphereGeometry(0.075, 12, 10), hair, 0, hy + 0.14, -0.14, head);
      mesh(G.fringe, hair, 0, hy, 0, head); mesh(G.sideL, hair, 0, hy, 0, head); mesh(G.sideR, hair, 0, hy, 0, head);
    }
    if ((opt.beard === true || (opt.beard === undefined && Math.random() < 0.3)) && !opt.noBeard) mesh(G.beard, hairSide, 0, hy, 0, head);
    var face = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.28), new THREE.MeshBasicMaterial({ map: faceTex(u.key, u.mood, u.skinKey), transparent: true, depthWrite: false })); face.position.set(0, 0.245, 0.17); head.add(face); u.face = face;
    if (opt.glasses === true || (opt.glasses === undefined && Math.random() < 0.22)) { var fr = std({ color: 0x222222, roughness: 0.4, metalness: 0.5 }); [-0.06, 0.06].forEach(function (x) { mesh(new THREE.TorusGeometry(0.038, 0.006, 6, 16), fr, x, 0.255, 0.178, head); }); mesh(bevelGeo(0.03, 0.006, 0.006, 0.002, 1), fr, 0, 0.26, 0.178, head); [-1, 1].forEach(function (s) { mesh(bevelGeo(0.006, 0.006, 0.16, 0.002, 1), fr, s * 0.1, 0.255, 0.085, head); }); }
    // hats sit on the brows (the eye line is at 0.26 in the head's frame, the brows at 0.29), never over the eyes
    if (capOn && !opt.hardhat) { var capM = opt.capMat || MAT.blue; mesh(new THREE.SphereGeometry(0.184, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), capM, 0, 0.29, 0, head); var peak = mesh(G.peak, capM, 0, 0.3, 0.2, head); peak.rotation.x = 0.15; mesh(new THREE.SphereGeometry(0.02, 8, 6), capM, 0, 0.47, 0, head); }
    if (opt.hardhat) { mesh(new THREE.SphereGeometry(0.19, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), opt.hardhat, 0, 0.3, 0, head); mesh(roundCylGeo(0.212, 0.212, 0.016, 24), opt.hardhat, 0, 0.3, 0.0, head); var pk = mesh(bevelGeo(0.16, 0.012, 0.08, 0.004, 1), opt.hardhat, 0, 0.3, 0.245, head); pk.rotation.x = 0.12; }
    groundBlob(0.9, 0.9, 0, 0, g, 0.002);
    runHooks('humanMade', g, opt);
    return g;
  }
  function setMood(g, mood) { var u = g.userData; if (u.mood === mood) return; u.mood = mood; u.face.material.map = faceTex(u.key, mood, u.skinKey, u.blink > 0); }
  // mode: 'walk' | 'idle' | 'wait' | 'work' | 'sit'. look: a world point the head turns to, within reason. carry: true holds a box out
  // in front; 'push' puts both hands down on a grip pushed ahead; 'tow' trails one arm back to something pulled behind; a function
  // (la, ra, le, re, s, sw) poses the arms itself. The feet stay planted: the torso rises and falls with the stride and rolls a little.
  function animateHuman(g, dt, mode, speed, look, carry) {
    var u = g.userData; if (!u.legs) return;
    u.idleT += dt;
    if (mode === 'walk') u.walk += dt * (6 + speed * 1.5); else { var ph = u.walk % Math.PI; u.walk += (ph < Math.PI / 2 ? -ph : Math.PI - ph) * Math.min(1, 10 * dt); }
    var t = u.walk, sw = mode === 'walk' ? 0.55 : 0, s = Math.sin(t), L = u.legs[0], R = u.legs[1], lk = L.userData.knee, rk = R.userData.knee, la = u.arms[0], ra = u.arms[1], le = la.userData.elbow, re = ra.userData.elbow, T = u.torso;
    if (mode === 'sit') {
      L.rotation.x = -1.45; R.rotation.x = -1.45; lk.rotation.x = 1.45; rk.rotation.x = 1.45; R.position.y = 0.86; la.rotation.x = -0.5; ra.rotation.x = -0.5; le.rotation.x = -0.15; re.rotation.x = -0.15; la.rotation.z = 0.18; ra.rotation.z = -0.18; T.position.set(0, 0.86, 0); T.rotation.set(0, 0, 0); u.head.rotation.z = 0;
    } else {
    L.rotation.x = s * sw; R.rotation.x = -s * sw;
    lk.rotation.x = Math.max(0, -Math.sin(t - 0.6)) * 1.0 * (sw ? 1 : 0); rk.rotation.x = Math.max(0, Math.sin(t - 0.6)) * 1.0 * (sw ? 1 : 0);
    if (typeof carry === 'function') carry(la, ra, le, re, s, sw);
    else if (carry === 'push' || carry === 'jack') { la.rotation.x = -0.8; ra.rotation.x = -0.8; le.rotation.x = -0.25; re.rotation.x = -0.25; la.rotation.z = 0.12; ra.rotation.z = -0.12; }
    else if (carry === 'tow') { ra.rotation.x = 0.56; re.rotation.x = 0; ra.rotation.z = -0.15; la.rotation.x = -s * sw * 0.8; le.rotation.x = -Math.max(0, s) * sw * 0.6 - 0.15; la.rotation.z = 0.08; }
    else if (carry) { la.rotation.x = -0.9; ra.rotation.x = -0.9; le.rotation.x = -0.9; re.rotation.x = -0.9; la.rotation.z = 0.25; ra.rotation.z = -0.25; }
    else if (mode === 'work') { la.rotation.x = -0.6 + Math.sin(u.idleT * 6) * 0.25; ra.rotation.x = -0.6 - Math.sin(u.idleT * 6) * 0.25; le.rotation.x = -0.8; re.rotation.x = -0.8; la.rotation.z = 0.1; ra.rotation.z = -0.1; }
    else { var drift = Math.sin(u.idleT * 1.1) * 0.05; la.rotation.x = -s * sw * 0.8 + drift; ra.rotation.x = s * sw * 0.8 - drift; le.rotation.x = -Math.max(0, s) * sw * 0.6 - 0.15; re.rotation.x = -Math.max(0, -s) * sw * 0.6 - 0.15; la.rotation.z = 0.08 + Math.sin(u.idleT * 0.7) * 0.03; ra.rotation.z = -0.08 - Math.sin(u.idleT * 0.7) * 0.03; }
    if (mode === 'wait') { R.position.y = 0.86 + Math.max(0, Math.sin(u.idleT * 2.4)) * 0.04; } else R.position.y = 0.86;
    if (mode === 'walk') { T.position.y = 0.86 + Math.abs(Math.cos(t)) * 0.03; T.position.x = 0; T.rotation.z = s * 0.03; T.rotation.y = s * 0.06; u.head.rotation.z = -s * 0.025; }
    else { T.position.y = 0.86 + Math.sin(u.idleT * 0.31) * 0.006; T.position.x = Math.sin(u.idleT * 0.31) * 0.007; T.rotation.z = Math.sin(u.idleT * 0.31) * 0.014; T.rotation.y = mode === 'wait' ? Math.sin(u.idleT * 0.35) * 0.12 : lerp(T.rotation.y, 0, Math.min(1, 4 * dt)); u.head.rotation.z = 0; }
    }
    if (u.chest) u.chest.scale.z = 1 + Math.sin(worldTime * 1.6 + u.phase) * 0.018;
    g.position.y = u.baseY || 0;
    var wantYaw = 0, wantPitch = 0;
    if (look) { var dx = look.x - g.position.x, dz = look.z - g.position.z, d = Math.sqrt(dx * dx + dz * dz); if (d < 9) { var a = Math.atan2(dx, dz) - g.rotation.y; while (a > Math.PI) a -= 6.283; while (a < -Math.PI) a += 6.283; wantYaw = clamp(a, -1.3, 1.3); wantPitch = clamp(Math.atan2((look.y || 1.6) - 1.6, d), -0.3, 0.3); } }
    else wantYaw = Math.sin(u.idleT * 0.4) * 0.15;
    u.lookYaw += (wantYaw - u.lookYaw) * Math.min(1, 6 * dt); u.lookPitch += (wantPitch - u.lookPitch) * Math.min(1, 6 * dt);
    u.head.rotation.y = u.lookYaw - (mode === 'walk' ? T.rotation.y : 0); u.head.rotation.x = -u.lookPitch;
    u.blinkIn -= dt; if (u.blinkIn <= 0 && u.blink <= 0) { u.blink = 0.12; u.face.material.map = faceTex(u.key, u.mood, u.skinKey, true); } if (u.blink > 0) { u.blink -= dt; if (u.blink <= 0) { u.blinkIn = randf(2, 6.5); u.face.material.map = faceTex(u.key, u.mood, u.skinKey, false); } }
    if (u.bubble) { u.bubble.t -= dt; if (u.bubble.t <= 0) { g.remove(u.bubble.sp); u.bubble = null; } }
  }
  // a line of speech above the head, for a few seconds
  function say(g, text, col) {
    var u = g.userData; if (!u || !u.head) return;
    if (u.bubble) { g.remove(u.bubble.sp); u.bubble = null; }
    var t = tex(512, 160, function (c, w, h) {
      c.clearRect(0, 0, w, h); c.font = '500 30px "Segoe UI", Arial, sans-serif'; var words = text.split(' '), lines = [], cur = '';
      words.forEach(function (wd) { var tr = cur ? cur + ' ' + wd : wd; if (c.measureText(tr).width > w - 60) { lines.push(cur); cur = wd; } else cur = tr; }); if (cur) lines.push(cur); lines = lines.slice(0, 3);
      var bw = Math.min(w - 20, Math.max.apply(null, lines.map(function (l) { return c.measureText(l).width; })) + 50), bh = lines.length * 36 + 26, bx = (w - bw) / 2, by = h - bh - 18;
      c.fillStyle = 'rgba(16,22,30,0.92)'; c.strokeStyle = col || '#f5b53d'; c.lineWidth = 3; c.beginPath(); c.moveTo(bx + 14, by); c.lineTo(bx + bw - 14, by); c.quadraticCurveTo(bx + bw, by, bx + bw, by + 14); c.lineTo(bx + bw, by + bh - 14); c.quadraticCurveTo(bx + bw, by + bh, bx + bw - 14, by + bh); c.lineTo(w / 2 + 12, by + bh); c.lineTo(w / 2, h - 2); c.lineTo(w / 2 - 12, by + bh); c.lineTo(bx + 14, by + bh); c.quadraticCurveTo(bx, by + bh, bx, by + bh - 14); c.lineTo(bx, by + 14); c.quadraticCurveTo(bx, by, bx + 14, by); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#eef1f5'; c.textAlign = 'center'; c.textBaseline = 'middle'; lines.forEach(function (l, i) { c.fillText(l, w / 2, by + 20 + i * 36 + 4); });
    });
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); sp.scale.set(1.9, 0.6, 1); sp.position.set(0, 2.15, 0); sp.renderOrder = 5; g.add(sp);
    u.bubble = { sp: sp, t: 2.6 + text.length * 0.03 };
    setMood(g, 'talk'); setTimeout(function () { if (u.mood === 'talk') setMood(g, 'neutral'); }, 900);
  }
  // a walker record on the grid: { x, z, yaw, path, speed } moved along its route; returns true at the end of it
  function walkerStep(rec, dt) { if (!rec.path || !rec.path.length) return true; return walkAlong(rec, rec.path, rec.speed || 1.6, dt); }
  function walkerGo(rec, x, z) { rec.path = route({ x: rec.x, z: rec.z }, { x: x, z: z }); return rec.path; }
  // ── The terrain ───────────────────────────────────────────────────
  // CO.terrain({ w, d, cell, x0, z0, heights, paint, palette, maxH }) stores the data (a game's src/00-terrain.js calls it before the
  // boot); terrainBuild() makes the mesh when the world builds. heights has (w + 1) * (d + 1) corners, row by row from z0; paint has
  // w * d cells, each an index into palette. The flat world outside the terrain stays at 0.
  var TERRAIN = { on: false, w: 0, d: 0, cell: 1, x0: 0, z0: 0, heights: null, paint: null, palette: ['grass', 'dirt', 'gravel', 'sand', 'road'], maxH: 8, mesh: null, geo: null, canvas: null, ctx: null, texture: null, px: 16 };
  // the painters for the ground: a base colour and a scatter of dots, per name; a game adds its own with CO.terrainPaint(name, spec)
  var TERRAIN_PAINT = {
    grass: { base: '#4d7a39', dots: ['#5b8c45', '#3f682e', '#6a9a4f'], n: 26, r: [1, 2.6] },
    dirt: { base: '#6b5239', dots: ['#7a5f44', '#5a432e', '#86684b'], n: 22, r: [1, 3] },
    gravel: { base: '#7b7d80', dots: ['#8f9195', '#65676b', '#a3a5a8'], n: 40, r: [0.8, 2] },
    sand: { base: '#c9b07a', dots: ['#d6bf8c', '#b89d6a', '#e0cb9c'], n: 18, r: [1, 2.4] },
    road: { base: '#3b3e43', dots: ['#45484d', '#33363a', '#505358'], n: 30, r: [0.6, 1.6] },
    snow: { base: '#e6ecf1', dots: ['#f3f6f9', '#d5dde4'], n: 10, r: [1, 3] },
    water: { base: '#2f6f9a', dots: ['#3a7fae', '#28618a'], n: 14, r: [1.5, 3.5] }
  };
  CO.terrainPaint = function (name, spec) { TERRAIN_PAINT[name] = spec; return spec; };
  CO.terrain = function (cfg) {
    if (!cfg) return TERRAIN;
    var w = Math.max(1, Math.round(cfg.w || 32)), d = Math.max(1, Math.round(cfg.d || 32));
    TERRAIN.on = true; TERRAIN.w = w; TERRAIN.d = d; TERRAIN.cell = cfg.cell || 1; TERRAIN.x0 = typeof cfg.x0 === 'number' ? cfg.x0 : -w * TERRAIN.cell / 2; TERRAIN.z0 = typeof cfg.z0 === 'number' ? cfg.z0 : -d * TERRAIN.cell / 2;
    if (cfg.palette) TERRAIN.palette = cfg.palette.slice(); if (cfg.maxH) TERRAIN.maxH = cfg.maxH;
    var nC = (w + 1) * (d + 1), nP = w * d; TERRAIN.heights = new Float32Array(nC); TERRAIN.paint = new Uint8Array(nP);
    if (cfg.heights) for (var i = 0; i < nC && i < cfg.heights.length; i++) TERRAIN.heights[i] = +cfg.heights[i] || 0;
    if (cfg.paint) for (var j = 0; j < nP && j < cfg.paint.length; j++) TERRAIN.paint[j] = cfg.paint[j] | 0;
    if (TERRAIN.mesh) terrainRebuild();   // called again while running (the editor makes a new one): the mesh follows
    return TERRAIN;
  };
  // the ground height at a world point: bilinear between the four corners of the cell; 0 off the terrain
  function terrainY(x, z) {
    var T = TERRAIN; if (!T.on) return 0;
    var u = (x - T.x0) / T.cell, v = (z - T.z0) / T.cell; if (u < 0 || v < 0 || u > T.w || v > T.d) return 0;
    var i = Math.min(T.w - 1, Math.floor(u)), j = Math.min(T.d - 1, Math.floor(v)), fu = u - i, fv = v - j, W = T.w + 1, H = T.heights;
    var h00 = H[j * W + i], h10 = H[j * W + i + 1], h01 = H[(j + 1) * W + i], h11 = H[(j + 1) * W + i + 1];
    return (h00 * (1 - fu) + h10 * fu) * (1 - fv) + (h01 * (1 - fu) + h11 * fu) * fv;
  }
  function terrainPaintAt(x, z) { var T = TERRAIN; if (!T.on) return null; var i = Math.floor((x - T.x0) / T.cell), j = Math.floor((z - T.z0) / T.cell); if (i < 0 || j < 0 || i >= T.w || j >= T.d) return null; return T.palette[T.paint[j * T.w + i]] || null; }
  function terrainPaintCell(i, j) {
    var T = TERRAIN, spec = TERRAIN_PAINT[T.palette[T.paint[j * T.w + i]]] || TERRAIN_PAINT.dirt, c = T.ctx, px = T.px, x = i * px, y = j * px, k;
    c.fillStyle = spec.base; c.fillRect(x, y, px, px);
    for (k = 0; k < spec.n; k++) { var r = seededF('t' + i + ',' + j, k, spec.r[0], spec.r[1]) * px / 16; c.fillStyle = spec.dots[seededI('tc' + i + ',' + j, k, 0, spec.dots.length - 1)]; c.beginPath(); c.arc(x + seededF('tx' + i + ',' + j, k, 0, px), y + seededF('tz' + i + ',' + j, k, 0, px), r, 0, Math.PI * 2); c.fill(); }
    // the neighbours' paints feather in over the edges, so two paints meet in a soft seam rather than a hard line
    var own = T.paint[j * T.w + i], f = Math.max(2, Math.round(px * 0.45)), nb = [[i - 1, j, 'l'], [i + 1, j, 'r'], [i, j - 1, 't'], [i, j + 1, 'b']];
    for (k = 0; k < 4; k++) { var ni = nb[k][0], nj = nb[k][1]; if (ni < 0 || nj < 0 || ni >= T.w || nj >= T.d) continue; var np = T.paint[nj * T.w + ni]; if (np === own) continue; var ns = TERRAIN_PAINT[T.palette[np]] || TERRAIN_PAINT.dirt, side = nb[k][2], g = side === 'l' ? c.createLinearGradient(x, 0, x + f, 0) : side === 'r' ? c.createLinearGradient(x + px, 0, x + px - f, 0) : side === 't' ? c.createLinearGradient(0, y, 0, y + f) : c.createLinearGradient(0, y + px, 0, y + px - f); g.addColorStop(0, ns.base); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.globalAlpha = 0.75; if (side === 'l') c.fillRect(x, y, f, px); else if (side === 'r') c.fillRect(x + px - f, y, f, px); else if (side === 't') c.fillRect(x, y, px, f); else c.fillRect(x, y + px - f, px, f); c.globalAlpha = 1; }
  }
  function terrainBuild() {
    var T = TERRAIN; if (!T.on || T.mesh) return T.mesh;
    var W = T.w + 1, D = T.d + 1, pos = new Float32Array(W * D * 3), uv = new Float32Array(W * D * 2), idx = [], i, j;
    for (j = 0; j < D; j++) for (i = 0; i < W; i++) { var k = j * W + i; pos[k * 3] = T.x0 + i * T.cell; pos[k * 3 + 1] = T.heights[k]; pos[k * 3 + 2] = T.z0 + j * T.cell; uv[k * 2] = i / T.w; uv[k * 2 + 1] = 1 - j / T.d; }
    for (j = 0; j < T.d; j++) for (i = 0; i < T.w; i++) { var a = j * W + i, b = a + 1, c2 = a + W, d2 = c2 + 1; idx.push(a, c2, b, b, c2, d2); }
    var geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
    T.canvas = document.createElement('canvas'); T.canvas.width = T.w * T.px; T.canvas.height = T.d * T.px; T.ctx = T.canvas.getContext('2d');
    for (j = 0; j < T.d; j++) for (i = 0; i < T.w; i++) terrainPaintCell(i, j);
    T.texture = new THREE.CanvasTexture(T.canvas); T.texture.encoding = THREE.sRGBEncoding; T.texture.anisotropy = 8;
    var mat = new THREE.MeshStandardMaterial({ map: T.texture, roughness: 0.96, metalness: 0 }); mat.userData.noBake = true;
    T.geo = geo; T.mesh = new THREE.Mesh(geo, mat); T.mesh.name = 'terrain'; T.mesh.receiveShadow = true; T.mesh.userData.noBake = true; T.mesh.userData.terrain = true;
    (CO.root || scene).add(T.mesh); shadowDirty = true; return T.mesh;
  }
  function terrainRebuild() { var T = TERRAIN; if (T.mesh) { if (T.mesh.parent) T.mesh.parent.remove(T.mesh); T.geo.dispose(); T.mesh.material.dispose(); T.texture.dispose(); T.mesh = null; } terrainBuild(); NAV.dirty = true; }
  // the corners in a rectangle moved: the mesh follows, the normals and the shadows too; the cells in it are painted again
  function terrainUpdate(i0, j0, i1, j1) {
    var T = TERRAIN; if (!T.mesh) return; var W = T.w + 1, p = T.geo.attributes.position.array, i, j;
    for (j = Math.max(0, j0); j <= Math.min(T.d, j1); j++) for (i = Math.max(0, i0); i <= Math.min(T.w, i1); i++) p[(j * W + i) * 3 + 1] = T.heights[j * W + i];
    T.geo.attributes.position.needsUpdate = true; T.geo.computeVertexNormals(); T.geo.computeBoundingSphere();
    for (j = Math.max(0, j0); j < Math.min(T.d, j1 + 1); j++) for (i = Math.max(0, i0); i < Math.min(T.w, i1 + 1); i++) terrainPaintCell(i, j);
    T.texture.needsUpdate = true; shadowDirty = true; NAV.dirty = true;
  }
  // a brush at a world point: raise, lower, smooth or flatten the corners within the radius (a soft falloff), or paint the cells
  function terrainBrush(x, z, mode, radius, strength, texIndex) {
    var T = TERRAIN; if (!T.on) return { changed: 0, error: 'no terrain: make one first' };
    radius = Math.max(0.3, +radius || 2); strength = Math.max(0, +strength || 0.5); var W = T.w + 1, H = T.heights, n = 0;
    var ci = (x - T.x0) / T.cell, cj = (z - T.z0) / T.cell, rc = radius / T.cell, i0 = Math.floor(ci - rc), i1 = Math.ceil(ci + rc), j0 = Math.floor(cj - rc), j1 = Math.ceil(cj + rc), i, j;
    if (mode === 'road') {   /* a road: the strip flattens to the height under the brush and takes the road paint */
      var rh = terrainY(x, z), W2 = T.w + 1, ri = T.palette.indexOf('road'), nR = 0; if (ri < 0) { T.palette.push('road'); ri = T.palette.length - 1; }
      for (j = Math.max(0, j0); j <= Math.min(T.d, j1); j++) for (i = Math.max(0, i0); i <= Math.min(T.w, i1); i++) { var rdx = i - ci, rdz = j - cj; if (rdx * rdx + rdz * rdz <= rc * rc) { var ra = j * W2 + i; if (H[ra] !== rh) { H[ra] = rh; nR++; } } }
      for (j = Math.max(0, j0); j < Math.min(T.d, j1 + 1); j++) for (i = Math.max(0, i0); i < Math.min(T.w, i1 + 1); i++) { var pdx = (i + 0.5) - ci, pdz = (j + 0.5) - cj; if (pdx * pdx + pdz * pdz <= (rc * 0.8) * (rc * 0.8) && T.paint[j * T.w + i] !== ri) { T.paint[j * T.w + i] = ri; nR++; } }
      if (nR) terrainUpdate(i0, j0, i1, j1); return { changed: nR };
    }
    if (mode === 'paint') {
      var tex = Math.max(0, Math.min(T.palette.length - 1, texIndex | 0));
      for (j = Math.max(0, j0); j < Math.min(T.d, j1 + 1); j++) for (i = Math.max(0, i0); i < Math.min(T.w, i1 + 1); i++) { var dx = (i + 0.5) - ci, dz = (j + 0.5) - cj; if (dx * dx + dz * dz <= rc * rc && T.paint[j * T.w + i] !== tex) { T.paint[j * T.w + i] = tex; n++; } }
      if (n) terrainUpdate(i0, j0, i1, j1); return { changed: n };
    }
    var centre = terrainY(x, z), hs = [];
    for (j = Math.max(0, j0); j <= Math.min(T.d, j1); j++) for (i = Math.max(0, i0); i <= Math.min(T.w, i1); i++) {
      var ddx = i - ci, ddz = j - cj, dist = Math.sqrt(ddx * ddx + ddz * ddz) / rc; if (dist > 1) continue;
      var k = (1 - dist) * (1 - dist), at = j * W + i, h = H[at], nh = h;
      if (mode === 'raise') nh = h + strength * k; else if (mode === 'lower') nh = h - strength * k;
      else if (mode === 'flatten') nh = h + (centre - h) * Math.min(1, strength * k * 2);
      else if (mode === 'smooth') { var sum = 0, cnt = 0, di, dj; for (dj = -1; dj <= 1; dj++) for (di = -1; di <= 1; di++) { var ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii > T.w || jj > T.d) continue; sum += H[jj * W + ii]; cnt++; } nh = h + (sum / cnt - h) * Math.min(1, strength * k * 2); }
      nh = Math.max(-T.maxH, Math.min(T.maxH, nh)); if (nh !== h) { hs.push([at, nh]); n++; }
    }
    hs.forEach(function (e) { H[e[0]] = e[1]; });
    if (n) terrainUpdate(i0, j0, i1, j1); return { changed: n };
  }
  // the terrain point under a viewport position, for the editor's brushes
  function terrainPick(nx, ny) { var T = TERRAIN; if (!T.mesh) return null; eRay.setFromCamera({ x: nx || 0, y: ny || 0 }, camera); eRay.far = 400; var hits = eRay.intersectObject(T.mesh, false); return hits.length ? { x: rnd(hits[0].point.x), y: rnd(hits[0].point.y), z: rnd(hits[0].point.z), paint: terrainPaintAt(hits[0].point.x, hits[0].point.z) } : null; }
  // flora and props scattered over the ground: copies of a definition on the cells painted with one name (or anywhere), seeded, placed through the shipped layout
  function terrainScatter(type, count, onPaint, seed) {
    var T = TERRAIN; if (!T.on) return { error: 'no terrain' }; if (!PROPS[type]) return { error: 'no prop definition ' + type };
    var cells = [], i, j; for (j = 0; j < T.d; j++) for (i = 0; i < T.w; i++) if (onPaint == null || onPaint === '' || T.palette[T.paint[j * T.w + i]] === onPaint) cells.push([i, j]);
    if (!cells.length) return { error: 'no cells painted ' + onPaint };
    var placed = [], n = Math.max(1, Math.min(500, count | 0)), tag = String(seed || Date.now()), k;
    for (k = 0; k < n; k++) { var c = cells[seededI(tag, k, 0, cells.length - 1)], id = 'sc' + tag.slice(-4) + '-' + k; placed.push({ id: id, type: type, x: Math.round((T.x0 + (c[0] + seededF(tag, k + 1000, 0.15, 0.85)) * T.cell) * 20) / 20, z: Math.round((T.z0 + (c[1] + seededF(tag, k + 2000, 0.15, 0.85)) * T.cell) * 20) / 20, rot: seededI(tag, k + 3000, 0, 3), h: 0 }); }
    CO.layout({ placed: placed }); placed.forEach(function (p) { buildProp(p.id); });
    return { placed: placed.map(function (p) { return p.id; }), count: placed.length };
  }
  function terrainState() { var T = TERRAIN; return { on: T.on, w: T.w, d: T.d, cell: T.cell, x0: T.x0, z0: T.z0, palette: T.palette.slice(), paints: Object.keys(TERRAIN_PAINT), maxH: T.maxH, cells: T.w * T.d }; }
  // the part the editor writes: the whole terrain as data, the heights to two decimals, a row per line so a diff reads
  function terrainCode() {
    var T = TERRAIN; if (!T.on) return '';
    var W = T.w + 1, lines = ['//@ the terrain the editor saved: the ground as a grid of heights and a paint per cell. Written by the Co Engine editor; it sorts first in src/ so the boot sees it. Sculpt and paint in the editor rather than here.', '  CO.terrain({', '    w: ' + T.w + ', d: ' + T.d + ', cell: ' + T.cell + ', x0: ' + T.x0 + ', z0: ' + T.z0 + ', maxH: ' + T.maxH + ',', '    palette: ' + JSON.stringify(T.palette) + ',', '    heights: ['], j, i, row;
    for (j = 0; j < T.d + 1; j++) { row = []; for (i = 0; i < W; i++) row.push(Math.round(T.heights[j * W + i] * 100) / 100); lines.push('      ' + row.join(',') + ','); }
    lines.push('    ],', '    paint: [');
    for (j = 0; j < T.d; j++) { row = []; for (i = 0; i < T.w; i++) row.push(T.paint[j * T.w + i]); lines.push('      ' + row.join(',') + ','); }
    lines.push('    ]', '  });', '');
    return lines.join('\n');
  }
  // ── Floors and walkable ground ────────────────────────────────────
  // Where the player stands. A game answers CO.game.floorY(x, z, y) with decks, ramps and trailers; the default is a flat 0.
  // insideWalk(x, z) says whether a point is ground the crew may walk on; CO.game.insideWalk overrides it, the default is everywhere.
  function floorY(x, z, y) { var g = CO.game && CO.game.floorY ? CO.game.floorY(x, z, y) : 0; return TERRAIN.on ? Math.max(g, terrainY(x, z)) : g; }
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
  function lineWall(axis, at, a0, a1, h, mat, openings, inward, opt) { return worldItem('wall', function () {
    opt = opt || {};
    var segs = spanCut(a0, a1, openings);
    var off = at + inward * (opt.inset === undefined ? 0.17 : opt.inset), ry = axis === 'x' ? (inward > 0 ? Math.PI / 2 : -Math.PI / 2) : (inward > 0 ? 0 : Math.PI), trim = opt.trim || MAT.trim;
    function strip(w, hh, y, mid, m) { if (axis === 'x') { plane(w, hh, m, off, y, mid, 0, ry); } else { plane(w, hh, m, mid, y, off, 0, ry); } }
    segs.forEach(function (s) { var w = s[1] - s[0], mid = (s[0] + s[1]) / 2; strip(w, h, h / 2, mid, mat); if (opt.skirting !== false) { var sk = axis === 'x' ? box(0.03, 0.12, w, trim, off + inward * 0.012, 0.06, mid) : box(w, 0.12, 0.03, trim, mid, 0.06, off + inward * 0.012); sk.receiveShadow = true; } if (opt.dado !== false) { if (axis === 'x') box(0.025, 0.05, w, trim, off + inward * 0.01, 0.95, mid); else box(w, 0.05, 0.025, trim, mid, 0.95, off + inward * 0.01); } });
    (openings || []).forEach(function (o) { if (o[2] && o[2] < h) { var w = o[1] - o[0], mid = (o[0] + o[1]) / 2; strip(w, h - o[2], o[2] + (h - o[2]) / 2, mid, mat); } });
    return segs;
  }, null); }
  // a room's own floor laid over the slab: the texture repeats in metres so a carpet tile is half a metre wherever it is
  function roomFloor(mat, x0, x1, z0, z1, per, y) { return worldItem('floor', function () {
    var m = mat.clone(); m.map = mat.map.clone(); m.map.needsUpdate = true; m.map.repeat.set((x1 - x0) / per, (z1 - z0) / per);
    if (mat.normalMap) { m.normalMap = mat.normalMap.clone(); m.normalMap.needsUpdate = true; m.normalMap.repeat.set((x1 - x0) / per, (z1 - z0) / per); }
    var p = plane(x1 - x0, z1 - z0, m, (x0 + x1) / 2, (y === undefined ? 0 : y) + 0.012, (z0 + z1) / 2, -Math.PI / 2); p.receiveShadow = true; return p;
  }, null); }
  // a recessed troffer in a room's ceiling: a white frame and a prismatic lens that dims when the power is off
  function troffer(x, y, z, w, d) { return worldItem('ceiling light', function () { box(w || 1.2, 0.05, d || 0.6, MAT.trim, x, y - 0.025, z).castShadow = false; var lens = box((w || 1.2) - 0.1, 0.02, (d || 0.6) - 0.1, MAT.lamp, x, y - 0.045, z); lens.castShadow = false; lampMeshes.push(lens); return lens; }, null); }
  // a high bay hung from a roof at roofH: the conduit drop, the ballast box, the reflector and the lens
  var HIGHBAY_REFL = null;
  function highBay(x, y, z, roofH) { return worldItem('high bay lamp', function () {
    if (!HIGHBAY_REFL) HIGHBAY_REFL = std({ color: 0x9aa3ad, roughness: 0.35, metalness: 0.7, side: THREE.DoubleSide });   // one reflector material for every lamp: thirty of them bake into one draw instead of thirty
    roofH = roofH === undefined ? y + 1.2 : roofH;
    cyl(0.025, roofH - y - 0.22, MAT.steelDark, x, (roofH + y + 0.22) / 2, z, null, 6);
    box(0.34, 0.22, 0.26, MAT.steelDark, x, y + 0.11, z); box(0.1, 0.06, 0.06, MAT.black, x + 0.2, y + 0.12, z);
    var refl = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.14, 0.42, 20, 1, true), HIGHBAY_REFL); refl.position.set(x, y - 0.21, z); parentOf(null).add(refl);
    var lens = cyl(0.42, 0.03, MAT.lamp, x, y - 0.41, z, null, 20); lens.castShadow = false; lampMeshes.push(lens); return lens;
  }, null); }
  // ── The yard kit ──────────────────────────────────────────────────
  var FENCE = null;
  function fenceMats() { if (!FENCE) FENCE = { post: std({ color: 0x2f5d3a, roughness: 0.5, metalness: 0.5 }), mesh: std({ map: TEX.vmesh, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.6, color: 0x3d6b48 }), conc: std({ map: TEX.plaster, color: 0x9a9890, roughness: 0.95 }), wire: std({ color: 0x8e949a, roughness: 0.4, metalness: 0.8 }) }; return FENCE; }
  // a run of fence from (x0, z0) to (x1, z1): posts every 3 m with concrete feet, mesh panels, two folds and a top rail, three
  // strands of barbed wire on angled arms, and a solid the length of the run. opt: { y: ground height, wires: false, solid: false }
  function fenceRun(x0, z0, x1, z1, opt) { return worldItem('fence', function () {
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
  }, opt && opt.parent); }
  // a tree: a tapered trunk and four lumpy crowns, scaled by s, standing on y
  var TREE_MATS = null;
  function tree(x, z, s, y, parent) { return worldItem('tree', function () {
    s = s || 1; y = y || 0;
    if (!TREE_MATS) TREE_MATS = { trunk: std({ color: 0x5b4634, roughness: 1 }), crowns: [0x3f6f2e, 0x5c8f44, 0x45752f, 0x6f9a4a].map(function (c) { return std({ color: c, roughness: 1 }); }) };
    cyl(0.12 * s, 2.6 * s, TREE_MATS.trunk, x, y + 1.3 * s, z, parent, 8, 0.18 * s);
    [[0, 3.2, 0, 1.3], [0.7, 2.7, 0.4, 0.9], [-0.6, 2.9, -0.5, 1.0], [0.1, 4.0, 0.2, 0.8]].forEach(function (b, i) { sphere(b[3] * s, TREE_MATS.crowns[i], x + b[0] * s, y + b[1] * s, z + b[2] * s, parent); });
  }, parent); }
  // a street or yard lamp: a post, an arm and a glowing head; the lens goes on the lamp list
  function lampPost(x, z, y, h, parent) { return worldItem('lamp post', function () { h = h || 5; y = y || 0; cyl(0.06, h, MAT.steelDark, x, y + h / 2, z, parent, 8, 0.09); box(0.9, 0.06, 0.06, MAT.steelDark, x + 0.45, y + h - 0.05, z, parent); var lens = box(0.36, 0.14, 0.3, glowMat(0xfff2c0, 0.6), x + 0.9, y + h - 0.12, z, parent); lampMeshes.push(lens); return lens; }, parent); }
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
  // ── The clock ─────────────────────────────────────────────────────
  // S.day and S.time (hours, 0 to 24) are the game's; the engine reads them. A week is CAL.week days, a season CAL.season days.
  var CAL = { week: 7, season: 7, seasons: ['spring', 'summer', 'autumn', 'winter'], dayStart: 6 };
  function nowAbs() { return (S ? (S.day || 1) * 24 + (S.time || 0) : 0); }
  function season() { return Math.floor((((S && S.day || 1) - 1) % (CAL.season * CAL.seasons.length)) / CAL.season); }
  function seasonName() { return CAL.seasons[season()]; }
  function weekday() { return ((S && S.day || 1) - 1) % CAL.week; }
  function isSunday() { return (S && S.day || 1) % CAL.week === 0; }
  // ── Weather ───────────────────────────────────────────────────────
  // S.weather = { kind, wet, snow, wind, until }. The table per season says how likely each kind is; a game may replace it on
  // WEATHER_TABLE. tickWeatherState(dt) rolls the weather on, wets and snows the ground, and flashes and thunders in a storm.
  var WEATHER_TABLE = {
    winter: [['snow', 0.32], ['overcast', 0.3], ['clear', 0.28], ['rain', 0.1]],
    summer: [['clear', 0.6], ['overcast', 0.18], ['rain', 0.12], ['storm', 0.1]],
    other: [['clear', 0.42], ['overcast', 0.26], ['rain', 0.22], ['storm', 0.1]]
  };
  var WEATHER_WORDS = { rain: 'Rain on the roof.', storm: 'A storm is rolling in.', snow: 'Snow. It will be slow outside.', overcast: 'Clouds have come over.', clear: 'The sky has cleared.' };
  var weatherFlash = 0;
  function pickWeather(first) {
    var table = WEATHER_TABLE[seasonName()] || WEATHER_TABLE.other, r = Math.random(), acc = 0, kind = table[table.length - 1][0];
    for (var i = 0; i < table.length; i++) { acc += table[i][1]; if (r < acc) { kind = table[i][0]; break; } }
    var prev = S.weather ? S.weather.kind : null;
    S.weather = { kind: kind, wet: S.weather ? S.weather.wet : 0, snow: S.weather ? S.weather.snow : 0, wind: kind === 'storm' ? randf(0.8, 1.2) : kind === 'clear' ? randf(0.1, 0.4) : randf(0.3, 0.7), until: nowAbs() + randf(2.5, 8) };
    if (!first && prev !== kind) logEvent(WEATHER_WORDS[kind] || kind, kind === 'storm' ? 'bad' : '');
    runHooks('weather', kind, prev);
  }
  function indoors(x, z) { return CO.game && CO.game.indoors ? CO.game.indoors(x, z) : false; }
  function tickWeatherState(dt) {
    if (!S.weather) pickWeather(true);
    var W = S.weather;
    if (nowAbs() > W.until) pickWeather(false);
    var raining = W.kind === 'rain' || W.kind === 'storm';
    W.wet = clamp(W.wet + (raining ? dt / 50 : -dt / 260), 0, 1);
    W.snow = clamp(W.snow + (W.kind === 'snow' ? dt / 90 : seasonName() === 'winter' ? -dt / 1200 : -dt / 200), 0, 1);
    if (W.kind === 'storm' && Math.random() < dt * 0.06) { weatherFlash = 1; var delay = randf(300, 1800); setTimeout(function () { sfx('thunder'); }, delay); }
    weatherFlash *= Math.max(0, 1 - 6 * dt); CO.flash = weatherFlash;
    var inside = player ? indoors(player.x, player.z) : true;
    ambience(raining ? (inside ? 0.05 : 0.14) * (W.kind === 'storm' ? 1.4 : 1) : 0);
  }
  // a looping band of filtered noise is the rain; its level follows whether you are under a roof
  var amb = { gain: null, src: null, want: 0 };
  function ambience(level) {
    amb.want = level;
    if (!AC) return;
    if (!amb.src) { var len = AC.sampleRate * 2, buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0); for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; var src = AC.createBufferSource(); src.buffer = buf; src.loop = true; var f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400; var g = AC.createGain(); g.gain.value = 0; src.connect(f); f.connect(g); g.connect(sfxBus); src.start(); amb.src = src; amb.gain = g; }
    amb.gain.gain.setTargetAtTime(SET && SET.sound !== false ? level : 0, AC.currentTime, 0.4);
  }
  // ── The sky ───────────────────────────────────────────────────────
  // a dome with a zenith-to-horizon gradient, a sun and a moon that ride opposite each other, clouds that drift with the wind,
  // and the rain and snow as point clouds round the camera. buildSky(opt) makes them; tickSky(dt) moves them.
  var sky = { dome: null, mat: null, sunDisc: null, moon: null, clouds: [], rain: null, snow: null, windT: 0, y: 0, rainN: 7000, snowN: 3000 };
  function cloudTex() { return tex(256, 128, function (c, w, h) { c.clearRect(0, 0, w, h); for (var i = 0; i < 14; i++) { var r = randf(18, 42), x = randf(r, w - r), y = randf(r * 0.6, h - r * 0.6); var g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.6, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r); } }); }
  function discTex(col) { return tex(128, 128, function (c, w, h) { c.clearRect(0, 0, w, h); var g = c.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, col); g.addColorStop(0.45, col); g.addColorStop(0.6, 'rgba(255,240,200,0.35)'); g.addColorStop(1, 'rgba(255,240,200,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); }); }
  function buildSky(opt) {
    opt = opt || {}; sky.y = opt.y || 0;
    var skyMat = new THREE.ShaderMaterial({ uniforms: { top: { value: new THREE.Color(0x4f7fb8) }, mid: { value: new THREE.Color(0x8fb0d4) }, bot: { value: new THREE.Color(0xd6e2ec) } }, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vW; void main() { vW = normalize((modelMatrix * vec4(position, 1.0)).xyz); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 top, mid, bot; varying vec3 vW; void main() { float h = clamp(vW.y, -0.05, 1.0); vec3 c = h < 0.12 ? mix(bot, mid, smoothstep(-0.05, 0.12, h)) : mix(mid, top, pow(smoothstep(0.12, 1.0, h), 0.6)); gl_FragColor = vec4(c, 1.0); }' });
    var dome = new THREE.Mesh(new THREE.SphereGeometry(opt.radius || 230, 32, 16), skyMat); dome.position.y = sky.y; dome.renderOrder = -10; dome.userData.noBake = true; dome.frustumCulled = false; scene.add(dome); sky.dome = dome; sky.mat = skyMat;
    var sunSp = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex('rgba(255,244,214,1)'), transparent: true, depthWrite: false, fog: false })); sunSp.scale.set(26, 26, 1); scene.add(sunSp); sky.sunDisc = sunSp;
    var moonSp = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex('rgba(225,230,240,0.9)'), transparent: true, depthWrite: false, fog: false })); moonSp.scale.set(12, 12, 1); scene.add(moonSp); sky.moon = moonSp;
    var ct = cloudTex();
    for (var k = 0; k < (opt.clouds === undefined ? 10 : opt.clouds); k++) { var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: ct, transparent: true, depthWrite: false, opacity: 0.85, fog: false })); var s = randf(50, 90); sp.scale.set(s, s * 0.5, 1); sp.position.set(randf(-150, 150), randf(70, 100), randf(-150, 150)); scene.add(sp); sky.clouds.push({ sp: sp, v: randf(0.6, 1.4) }); }
    if (opt.precipitation !== false) {
      var streak = tex(16, 64, function (c, w, h) { c.clearRect(0, 0, w, h); var g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(210,225,240,0)'); g.addColorStop(0.5, 'rgba(210,225,240,0.9)'); g.addColorStop(1, 'rgba(210,225,240,0)'); c.fillStyle = g; c.fillRect(6, 0, 4, h); });
      var flake = tex(32, 32, function (c, w, h) { c.clearRect(0, 0, w, h); var g = c.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
      var mkPoints = function (n, size, map, range) { var geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3); for (var i = 0; i < n; i++) { pos[i * 3] = randf(-range, range); pos[i * 3 + 1] = randf(0, 16); pos[i * 3 + 2] = randf(-range, range); } geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); var pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: map, size: size, transparent: true, opacity: 0.85, depthWrite: false, alphaTest: 0.05 })); pts.visible = false; pts.frustumCulled = false; scene.add(pts); return pts; };
      sky.rainN = opt.rainN || 7000; sky.snowN = opt.snowN || 3000;
      sky.rain = mkPoints(sky.rainN, 0.26, streak, 24); sky.rain.material.opacity = 0.5; sky.rain.material.color.setHex(0xc7d3de); sky.snow = mkPoints(sky.snowN, 0.22, flake, 30);
    }
    return sky;
  }
  // the height of whatever is over a point: 0 outdoors, a roof height under a roof. The game answers CO.game.roofAt(x, z).
  function roofAt(x, z) { return CO.game && CO.game.roofAt ? CO.game.roofAt(x, z) : 0; }
  function tickSky(dt) {
    sky.windT += dt;
    var W = S && S.weather || { kind: 'clear', wet: 0, snow: 0, wind: 0.4 }, t = S ? S.time || 12 : 12;
    if (sky.dome) { sky.dome.position.x = camera.position.x; sky.dome.position.z = camera.position.z; }
    sky.clouds.forEach(function (c) { c.sp.position.x += c.v * dt * (0.5 + W.wind); if (c.sp.position.x > camera.position.x + 150) c.sp.position.x = camera.position.x - 150; });
    if (sky.sunDisc && sun) { _v.copy(sun.position).sub(sun.target.position).normalize(); var elv = Math.sin(Math.PI * clamp((t - 6) / 16, 0, 1)); sky.sunDisc.position.copy(_v).multiplyScalar(200).add(camera.position); sky.sunDisc.material.opacity = clamp(elv * 4, 0, 1); sky.moon.position.copy(_v).multiplyScalar(-200).add(camera.position); sky.moon.position.y = Math.abs(sky.moon.position.y - camera.position.y) + camera.position.y + 20; sky.moon.material.opacity = clamp(0.9 - elv * 4, 0, 0.9); }
    var raining = W.kind === 'rain' || W.kind === 'storm', snowing = W.kind === 'snow', px = player ? player.x : camera.position.x, pz = player ? player.z : camera.position.z;
    if (sky.rain) {
      sky.rain.visible = raining; sky.snow.visible = snowing;
      if (raining) { var p = sky.rain.geometry.attributes.position.array, pn = Math.min(p.length, (CO.rainN || sky.rainN) * 3); for (var r = 0; r < pn; r += 3) { p[r + 1] -= (9 + (W.kind === 'storm' ? 4 : 0)) * dt; var roofY = roofAt(p[r], p[r + 2]); if (p[r + 1] < roofY + sky.y || Math.abs(p[r] - px) > 26 || Math.abs(p[r + 2] - pz) > 26) { p[r] = px + randf(-24, 24); p[r + 2] = pz + randf(-24, 24); var rf = roofAt(p[r], p[r + 2]); p[r + 1] = randf(rf ? rf + 0.6 : 6, 16); } } sky.rain.geometry.attributes.position.needsUpdate = true; }
      if (snowing) { var q = sky.snow.geometry.attributes.position.array, qn = Math.min(q.length, (CO.snowN || sky.snowN) * 3); for (var s = 0; s < qn; s += 3) { q[s + 1] -= 1.3 * dt; q[s] += Math.sin(sky.windT + s) * 0.4 * dt; var ry = roofAt(q[s], q[s + 2]); if (q[s + 1] < ry + sky.y || Math.abs(q[s] - px) > 32 || Math.abs(q[s + 2] - pz) > 32) { q[s] = px + randf(-30, 30); q[s + 2] = pz + randf(-30, 30); var sf = roofAt(q[s], q[s + 2]); q[s + 1] = randf(sf ? sf + 0.6 : 6, 16); } } sky.snow.geometry.attributes.position.needsUpdate = true; }
    }
    var overcast = raining ? 0.75 : snowing ? 0.6 : W.kind === 'overcast' ? 0.5 : 0;
    var cday = 0.12 + 0.88 * Math.sin(Math.PI * clamp((t - 6) / 16, 0, 1)); sky.clouds.forEach(function (c) { c.sp.material.color.setScalar((1 - overcast * 0.55) * cday); c.sp.material.opacity = 0.5 + overcast * 0.5; });
    runHooks('sky', W, dt);
  }
  // ── Light by the hour ─────────────────────────────────────────────
  // the sun's angle, colour and strength, the sky bounce, the sky and fog colours, and the lamp materials follow S.time and the
  // weather. The game lights its own lamps in the 'lighting' hook, which gets (day, dawn, overcast, power) each tick.
  var skyNight = new THREE.Color(0x0b1020), skyDawn = new THREE.Color(0xd9916b), skyDay = new THREE.Color(0x8fb0d4), skyOvercast = new THREE.Color(0x6b7482), skyTmp = new THREE.Color(), lightT = 0;
  function powered() { return CO.game && CO.game.powered ? CO.game.powered() : true; }
  function lighting(dt) {
    lightT += dt; if (lightT < 0.1) return; lightT = 0;
    var t = S ? S.time || 12 : 12, day = clamp((t - 5.5) / 1.5, 0, 1) * clamp((21.5 - t) / 1.5, 0, 1), dawn = Math.max(0, 1 - Math.abs(t - 6.5) / 1.5) + Math.max(0, 1 - Math.abs(t - 20.5) / 1.5);
    var az = Math.PI * (t - 6) / 16, elev = Math.sin(Math.PI * clamp((t - 6) / 16, 0, 1));
    var W = S && S.weather || { kind: 'clear' }, overcast = W.kind === 'overcast' ? 0.45 : W.kind === 'rain' ? 0.65 : W.kind === 'storm' ? 0.85 : W.kind === 'snow' ? 0.55 : 0;
    sun.position.set(Math.cos(az) * 60, 8 + elev * 80, 30 + Math.sin(az) * 20); sun.position.add(sun.target.position); sun.intensity = Math.max(0, elev) * 1.15 * (0.6 + 0.4 * day) * (1 - overcast * 0.8) + weatherFlash * 2.5;
    sun.color.setHSL(0.09, dawn * 0.6 * (1 - overcast), 0.95 - dawn * 0.15);
    skyTmp.copy(skyNight).lerp(skyDay, day); if (dawn > 0) skyTmp.lerp(skyDawn, dawn * 0.5 * (1 - day * 0.3));
    if (overcast) skyTmp.lerp(skyOvercast, overcast * day * 0.8); if (weatherFlash > 0.05) skyTmp.lerp(new THREE.Color(0xffffff), weatherFlash * 0.7);
    if (scene.background && scene.background.isColor) scene.background.copy(skyTmp); if (scene.fog) { scene.fog.color.copy(skyTmp); scene.fog.near = 70 - overcast * 30; scene.fog.far = 190 - overcast * 90; }
    if (sky.mat) { sky.mat.uniforms.top.value.copy(skyTmp).multiplyScalar(0.62 + overcast * 0.25); sky.mat.uniforms.mid.value.copy(skyTmp); sky.mat.uniforms.bot.value.copy(skyTmp).lerp(new THREE.Color(0xffffff), 0.4 * day * (1 - overcast * 0.5)); }
    hemi.intensity = 0.12 + day * 0.35 * (1 - overcast * 0.5) + weatherFlash;
    var power = powered();
    MAT.lamp.color.setHex(power ? 0xfff6e4 : 0x3a3a3a); MAT.skylight.color.setHex(0xffffff); MAT.skylight.color.multiplyScalar(0.04 + day * 0.96);
    runHooks('lighting', day, dawn, overcast, power);
  }
  // The sun's shadow map is a second full pass over every caster, so it is not redrawn every frame. It is redrawn four times a
  // second, at once when something flagged it dirty, and every frame while the game says something big is moving (CO.game.shadowLive()).
  function shadowTick(dt) {
    if (!renderer.shadowMap.enabled) return;
    shadowT += dt;
    var live = CO.game && CO.game.shadowLive ? CO.game.shadowLive() : false;
    if (shadowDirty || live || shadowT > 0.25) { renderer.shadowMap.needsUpdate = true; shadowDirty = false; shadowT = 0; }
  }
  // ── World items ───────────────────────────────────────────────────
  // A key names an item by what it is and where the game built it ("lamp post@12,6", "mesh plane 34x19.2@0,13.6"), so it survives a
  // reload and most changes to the game's code. An edit is { x, y, z, ry (degrees), sx, sy, sz, hidden }, every field optional.
  var WORLD_EDITS = {}, WORLD_ITEMS = [], WORLD_PARENT = null, WORLD_COPIES = [];
  // copies of world items (0.9.4): { id, of (the original's key), x, y, z, ry (degrees), sx, sy, sz }, kept in src/00-world.js
  CO.worldCopies = function (list) { (list || []).forEach(function (c) { if (c && c.id && c.of && !WORLD_COPIES.some(function (k) { return k.id === c.id; })) WORLD_COPIES.push(c); }); return WORLD_COPIES; };
  CO.world = function (edits) { if (edits && typeof edits === 'object') for (var k in edits) WORLD_EDITS[k] = edits[k]; return WORLD_EDITS; };
  // a kit call builds into a group of its own, centred on what it built and standing on the ground, so it turns and resizes about itself
  // a game marks an item movesOnly (o.userData.movesOnly = true) when its rules follow where it stands but not a turn or a new size
  function worldItem(kind, fn, parent) {
    if (parent || WORLD_PARENT) return fn();
    var root = CO.root || scene, g = new THREE.Group(); g.name = kind; g.userData.worldItem = kind; root.add(g);
    var n0 = solids.length, out; WORLD_PARENT = g;
    try { out = fn(); } finally { WORLD_PARENT = null; }
    g.userData.solids = solids.slice(n0);
    g.updateMatrixWorld(true); var b = new THREE.Box3().setFromObject(g);
    if (!b.isEmpty()) { var cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2; g.children.forEach(function (c) { c.position.x -= cx; c.position.z -= cz; }); g.position.set(cx, 0, cz); g.updateMatrixWorld(true); }
    return out;
  }
  function wr(v) { return Math.round(v * 100) / 100; }
  // the things at the top of the world that count as items: not props, people, doors, cars, lights, helpers, the sky or the bake
  function worldCandidate(o) {
    if (!o || o === CO.root || o.userData.editor || o.userData.baked || o.userData.dynamic || o.userData.legs || o.userData.person || o.userData.propId) return false;
    if (o.isLight || o.isPoints || o.isSprite || o.isCamera || o.userData.it || o.material === MAT.hit) return false;   /* a use box is the thing it belongs to, not a thing of its own */
    if (o.userData.worldItem) return true;
    if (hdoors.some(function (d) { return d.g === o; })) return false;
    if (typeof traffic !== 'undefined' && traffic && traffic.cars && traffic.cars.some(function (c) { return c.g === o; })) return false;
    if (o.name === 'terrain' || (typeof TERRAIN === 'object' && TERRAIN && TERRAIN.mesh === o)) return false;
    if (o.isMesh) { var m = Array.isArray(o.material) ? o.material[0] : o.material, P = o.geometry && o.geometry.parameters || {}; if (m && m.side === THREE.BackSide) return false; if (P.radius > 100) return false; return !!o.geometry; }
    return !!o.isGroup && o.children.length > 0;
  }
  function worldKind(o) {
    if (o.userData.worldItem) return o.userData.worldItem;
    if (o.isMesh) { var P = o.geometry.parameters || {}, t = (o.geometry.type || 'mesh').replace(/Geometry$/, '').toLowerCase(); var dims = ['width', 'height', 'depth', 'radius', 'radiusTop'].filter(function (k) { return typeof P[k] === 'number'; }).map(function (k) { return wr(P[k]); }).join('x'); return 'mesh ' + t + (dims ? ' ' + dims : ''); }
    return o.name || 'group';
  }
  function worldName(o) { var k = worldKind(o); return /^mesh /.test(k) ? k.replace(/^mesh (\w+).*/, '$1') + (o.material && matName(o.material) ? ' · ' + matName(o.material) : '') : k; }
  // after the build: every item gets its key and remembers where the game put it and the solids it came with
  // a plain box mesh and a solid laid on exactly its footprint are one wall: the solid travels with the box
  function worldClaimSolids(o, claimed) {
    if (!o.geometry || o.geometry.type !== 'BoxGeometry') return;
    o.updateMatrixWorld(true); var b = new THREE.Box3().setFromObject(o), mine = [], near = function (a, c) { return Math.abs(a - c) < 0.05; };
    solids.forEach(function (s) { if (claimed.indexOf(s) < 0 && near(s.x0, b.min.x) && near(s.x1, b.max.x) && near(s.z0, b.min.z) && near(s.z1, b.max.z)) mine.push(s); });
    if (mine.length) { o.userData.solids = mine; mine.forEach(function (s) { claimed.push(s); }); }
  }
  function worldScan() {
    WORLD_ITEMS = []; var seen = {}, claimed = [];
    (CO.root && CO.root !== scene ? [scene, CO.root] : [scene]).forEach(function (r) { r.children.forEach(function (o) { (o.userData.solids || []).forEach(function (s) { claimed.push(s); }); }); });   /* a kit item's own solids are not up for claiming */
    (CO.root && CO.root !== scene ? [scene, CO.root] : [scene]).forEach(function (r) { r.children.slice().forEach(function (o) {
      if (!worldCandidate(o) || o.userData.worldKey) { if (o.userData.worldKey) WORLD_ITEMS.push(o); return; }
      var base = worldKind(o) + '@' + wr(o.position.x) + ',' + wr(o.position.z) + (Math.abs(o.position.y) > 0.005 ? ',' + wr(o.position.y) : ''), key = base, n = 1;
      while (seen[key]) key = base + '#' + (++n); seen[key] = true;
      if (!o.userData.worldItem && o.isMesh && !o.userData.solids) worldClaimSolids(o, claimed);   /* a wall drawn as a plain box takes the solid laid on its footprint */
      o.userData.worldKey = key; o.userData.worldBase = { x: o.position.x, y: o.position.y, z: o.position.z, ry: o.rotation.y, sx: o.scale.x, sy: o.scale.y, sz: o.scale.z };
      o.userData.worldSolidsBase = (o.userData.solids || []).map(function (s) { return { x0: s.x0, x1: s.x1, z0: s.z0, z1: s.z1, y0: s.y0, y1: s.y1 }; });
      WORLD_ITEMS.push(o);
    }); });
    return WORLD_ITEMS;
  }
  function worldItemOf(o) { for (var a = o; a; a = a.parent) if (a.userData && a.userData.worldKey) return a; return null; }
  function worldByKey(key) { for (var i = 0; i < WORLD_ITEMS.length; i++) if (WORLD_ITEMS[i].userData.worldKey === key) return WORLD_ITEMS[i]; return null; }
  // the solids an item came with follow it: turned, resized and moved with it, and gone while it is hidden
  function worldSolids(o) {
    var ss = o.userData.solids || [], B = o.userData.worldSolidsBase || [], b0 = o.userData.worldBase; if (!ss.length || !b0) return;
    var c0 = Math.cos(b0.ry), s0 = Math.sin(b0.ry), a = o.rotation.y, c = Math.cos(a), s = Math.sin(a), hidden = !o.visible;
    ss.forEach(function (sol, i) {
      var q = B[i]; if (!q) return; if (hidden) { sol.x0 = sol.x1 = sol.z0 = sol.z1 = 1e6; return; }
      var xs = [], zs = [];
      [[q.x0, q.z0], [q.x1, q.z0], [q.x0, q.z1], [q.x1, q.z1]].forEach(function (p) {
        var dx = p[0] - b0.x, dz = p[1] - b0.z, lx = (dx * c0 - dz * s0) / b0.sx, lz = (dx * s0 + dz * c0) / b0.sz;   /* into the item's own frame at build */
        lx *= o.scale.x; lz *= o.scale.z; xs.push(o.position.x + lx * c + lz * s); zs.push(o.position.z - lx * s + lz * c);
      });
      sol.x0 = Math.min.apply(null, xs); sol.x1 = Math.max.apply(null, xs); sol.z0 = Math.min.apply(null, zs); sol.z1 = Math.max.apply(null, zs);
      var ky = o.scale.y / b0.sy; sol.y0 = o.position.y + (q.y0 - b0.y) * ky; sol.y1 = o.position.y + (q.y1 - b0.y) * ky;
    });
    if (typeof NAV === 'object' && NAV) NAV.dirty = true;
  }
  function worldLay(o, e) {
    var b0 = o.userData.worldBase; if (!b0 || !e) return;
    o.position.set(typeof e.x === 'number' ? e.x : b0.x, typeof e.y === 'number' ? e.y : b0.y, typeof e.z === 'number' ? e.z : b0.z);
    o.rotation.y = typeof e.ry === 'number' ? e.ry * Math.PI / 180 : b0.ry;
    o.scale.set(typeof e.sx === 'number' ? e.sx : b0.sx, typeof e.sy === 'number' ? e.sy : b0.sy, typeof e.sz === 'number' ? e.sz : b0.sz);
    o.visible = !e.hidden; o.updateMatrixWorld(true); worldSolids(o); shadowDirty = true;
  }
  // after the build and before the bake: the saved edits laid on the world, then the copies built
  function worldEditsApply() { worldScan(); WORLD_ITEMS.forEach(function (o) { var e = WORLD_EDITS[o.userData.worldKey]; if (e) worldLay(o, e); }); WORLD_COPIES.forEach(function (c) { worldCopyBuild(c); }); }
  // a copy: the original's meshes cloned (they share its geometry and materials, so a copy costs little), its solids cloned and laid where
  // the copy stands. What the original does (a door that opens, a prompt) stays with the original: a copy is its look and its solids
  function worldCopyBuild(c) {
    var src = worldByKey(c.of); if (!src) return null;
    var keep = [], vis = []; src.traverse(function (o) { keep.push(o.userData); vis.push(o.userData && o.userData.bakedAway ? true : o.visible); o.userData = {}; });
    var g; try { g = src.clone(true); } finally { var i0 = 0; src.traverse(function (o) { o.userData = keep[i0++]; }); }
    var i1 = 0; g.traverse(function (o) { o.visible = vis[i1++]; });
    g.visible = true; g.name = src.name; g.userData = { worldItem: src.userData.worldItem || null, worldKey: c.id, worldCopy: c, worldBase: src.userData.worldBase, worldSolidsBase: src.userData.worldSolidsBase || [] };
    g.userData.solids = g.userData.worldSolidsBase.map(function (q) { var s = { x0: q.x0, x1: q.x1, z0: q.z0, z1: q.z1, y0: q.y0, y1: q.y1 }; solids.push(s); return s; });
    (CO.root || scene).add(g); worldCopyLay(g); WORLD_ITEMS.push(g); return g;
  }
  function worldCopyLay(g) { var c = g.userData.worldCopy, b = g.userData.worldBase || { x: 0, y: 0, z: 0, ry: 0, sx: 1, sy: 1, sz: 1 }; g.position.set(num(c.x, b.x), num(c.y, b.y), num(c.z, b.z)); g.rotation.y = typeof c.ry === 'number' ? c.ry * Math.PI / 180 : b.ry; g.scale.set(num(c.sx, b.sx), num(c.sy, b.sy), num(c.sz, b.sz)); g.updateMatrixWorld(true); worldSolids(g); shadowDirty = true; }
  function num(v, d) { return typeof v === 'number' ? v : d; }
  // a copy removed: out of the scene, its solids gone, its record dropped
  function worldCopyRemove(g) { var c = g.userData.worldCopy; if (g.parent) g.parent.remove(g); (g.userData.solids || []).forEach(function (s) { var k = solids.indexOf(s); if (k >= 0) solids.splice(k, 1); }); var a = WORLD_COPIES.indexOf(c); if (a >= 0) WORLD_COPIES.splice(a, 1); var b = WORLD_ITEMS.indexOf(g); if (b >= 0) WORLD_ITEMS.splice(b, 1); if (typeof NAV === 'object' && NAV) NAV.dirty = true; shadowDirty = true; }
  // what the editor keeps: the item as it stands now against where the game built it
  function worldRecord(o) {
    if (o.userData.worldCopy) { var c = o.userData.worldCopy; c.x = wr(o.position.x); c.y = wr(o.position.y); c.z = wr(o.position.z); c.ry = Math.round(o.rotation.y * 180 / Math.PI * 10) / 10; c.sx = wr(o.scale.x); c.sy = wr(o.scale.y); c.sz = wr(o.scale.z); worldSolids(o); return c; }
    var b0 = o.userData.worldBase, key = o.userData.worldKey; if (!b0 || !key) return null;
    var e = {}, near = function (a, b) { return Math.abs(a - b) < 0.0005; };
    if (!near(o.position.x, b0.x)) e.x = wr(o.position.x); if (!near(o.position.y, b0.y)) e.y = wr(o.position.y); if (!near(o.position.z, b0.z)) e.z = wr(o.position.z);
    if (!near(o.rotation.y, b0.ry)) e.ry = Math.round(o.rotation.y * 180 / Math.PI * 10) / 10;
    if (!near(o.scale.x, b0.sx)) e.sx = wr(o.scale.x); if (!near(o.scale.y, b0.sy)) e.sy = wr(o.scale.y); if (!near(o.scale.z, b0.sz)) e.sz = wr(o.scale.z);
    if (!o.visible) e.hidden = true;
    if (Object.keys(e).length) WORLD_EDITS[key] = e; else delete WORLD_EDITS[key];
    worldSolids(o); return e;
  }
  // the part the editor writes: src/00-world.js, or nothing when the world stands as the game builds it
  function worldCode() {
    var keys = Object.keys(WORLD_EDITS).sort(); if (!keys.length && !WORLD_COPIES.length) return '';
    var obj = function (o) { return JSON.stringify(o).replace(/"(\w+)":/g, '$1: ').replace(/,(?=\w+: )/g, ', ').replace(/^\{/, '{ ').replace(/\}$/, ' }'); };
    var lines = ['//@ the world the editor changed: what was moved, turned, resized, removed or copied of what the game builds straight into its world. Written by the Co Engine editor; it sorts first in src/ and is laid on the world as it is built. A key is the thing and where the game built it; delete a line to put that thing back, or to take a copy away.'];
    if (keys.length) { lines.push('  CO.world({'); keys.forEach(function (k) { lines.push('    ' + JSON.stringify(k) + ': ' + obj(WORLD_EDITS[k]) + ','); }); lines.push('  });'); }
    if (WORLD_COPIES.length) { lines.push('  CO.worldCopies(['); WORLD_COPIES.forEach(function (c) { lines.push('    ' + obj(c) + ','); }); lines.push('  ]);'); }
    return lines.join('\n') + '\n';
  }
  // ── Meshes ────────────────────────────────────────────────────────
  var CAR_COLS = [0xb8322a, 0x2c5f9e, 0xd8dbdf, 0x2a2d33, 0x7a8691, 0xe0a02a, 0x4f6a3a];
  // a tyre with rings, a rim and a hub, laid along z at (x, y, z) in parent g
  function truckWheel(g, x, y, z, r, w) { var ty = cyl(r, w, MAT.rubber, x, y, z, g, 20); ty.rotation.x = Math.PI / 2; for (var k = 0; k < 3; k++) { var ring = new THREE.Mesh(new THREE.TorusGeometry(r - 0.04, 0.012, 6, 24), MAT.black); ring.position.set(x, y, z + (k - 1) * w * 0.3); g.add(ring); } cyl(r * 0.58, w + 0.02, MAT.chrome, x, y, z, g, 14).rotation.x = Math.PI / 2; cyl(r * 0.2, w + 0.06, MAT.steelDark, x, y, z, g, 10).rotation.x = Math.PI / 2; return ty; }
  // a bevelled box straight into a group: the one-line closure every vehicle builder used to write for itself
  function rbx(g, w, h, d, r, mat, x, y, z) { var m = new THREE.Mesh(bevelGeo(w, h, d, r), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; }
  // a hatchback: bevelled body, glass, wheels with arches, lamps, plates, a roof rack bar. opt: { col, plate, seed }
  function carMesh(opt) {
    opt = typeof opt === 'number' ? { col: opt } : (opt || {});
    var g = new THREE.Group(), col = opt.col === undefined ? pick(CAR_COLS) : opt.col, paint = new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.35, metalness: 0.4, clearcoat: 0.9, clearcoatRoughness: 0.15 }), glass = std({ color: 0x2a3340, roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0.85 });
    rbx(g, 4.3, 0.52, 1.82, 0.08, paint, 0, 0.6, 0); rbx(g, 2.4, 0.56, 1.66, 0.1, paint, -0.25, 1.12, 0); rbx(g, 1.0, 0.3, 1.6, 0.05, paint, 1.6, 0.9, 0);
    /* the windscreen leans back from the bonnet to the roof's front edge, the rear window forward from the boot to its back edge */ var ws = rbx(g, 0.06, 0.46, 1.5, 0.02, glass, 1.075, 1.21, 0); ws.rotation.z = 0.58; var rw = rbx(g, 0.06, 0.63, 1.5, 0.02, glass, -1.625, 1.14, 0); rw.rotation.z = -0.59; rbx(g, 2.1, 0.44, 0.04, 0.01, glass, -0.25, 1.12, 0.84); rbx(g, 2.1, 0.44, 0.04, 0.01, glass, -0.25, 1.12, -0.84);
    [-1, 1].forEach(function (s) { box(0.02, 0.4, 0.02, MAT.black, -0.25, 1.12, s * 0.86, g); box(0.02, 0.4, 0.02, MAT.black, 0.5, 1.1, s * 0.86, g); box(0.14, 0.02, 0.03, MAT.chrome, -0.6, 0.78, s * 0.92, g); box(0.14, 0.02, 0.03, MAT.chrome, 0.3, 0.78, s * 0.92, g); box(0.12, 0.1, 0.16, paint, 0.6, 1.2, s * 1.0, g); });
    g.userData.wheels = [];
    // each wheel is one group at the axle (tyre, rim, spokes, hub) so a game spins it with wheel.rotation.z, around the axle across the car;
    // the spokes lie flat on the outer face and the arch stands in the car's side plane over the tyre
    [[1.4, 0.95], [1.4, -0.95], [-1.4, 0.95], [-1.4, -0.95]].forEach(function (p) {
      var s = p[1] > 0 ? 1 : -1, w = new THREE.Group(); w.position.set(p[0], 0.33, p[1]); w.userData.wheel = true; g.add(w);
      cyl(0.33, 0.22, MAT.rubber, 0, 0, 0, w, 20).rotation.x = Math.PI / 2; cyl(0.2, 0.225, MAT.chrome, 0, 0, 0, w, 16).rotation.x = Math.PI / 2;
      for (var sp = 0; sp < 3; sp++) box(0.34, 0.035, 0.02, MAT.steelDark, 0, 0, s * 0.118, w).rotation.z = sp * Math.PI / 3;
      cyl(0.055, 0.03, MAT.steelDark, 0, 0, s * 0.125, w, 10).rotation.x = Math.PI / 2;
      var arch = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.05, 6, 14, Math.PI), paint); arch.position.set(p[0], 0.35, s * 0.92); g.add(arch); g.userData.wheels.push(w);
    });
    rbx(g, 0.12, 0.2, 1.9, 0.03, MAT.plastic, 2.14, 0.42, 0); rbx(g, 0.12, 0.2, 1.9, 0.03, MAT.plastic, -2.14, 0.42, 0);
    g.userData.lamps = [box(0.06, 0.16, 0.34, glowMat(0xfff2c0, 0.4), 2.16, 0.68, 0.62, g), box(0.06, 0.16, 0.34, glowMat(0xfff2c0, 0.4), 2.16, 0.68, -0.62, g)]; box(0.06, 0.14, 0.34, glowMat(0xff2a1a, 0.5), -2.16, 0.68, 0.62, g); box(0.06, 0.14, 0.34, glowMat(0xff2a1a, 0.5), -2.16, 0.68, -0.62, g);
    var plate = opt.plate || ('CO ' + randi(10, 99) + ' ' + pick(['AB', 'KH', 'NL', 'XY']) + randi(100, 999));
    sign([plate], 0.44, 0.11, 2.2, 0.46, 0, Math.PI / 2, { w: 256, h: 64, bg: '#f5f1e6', fg: '#1b232c' }, g); sign([plate.slice(0, 5)], 0.44, 0.11, -2.2, 0.46, 0, -Math.PI / 2, { w: 256, h: 64, bg: '#f5f1e6', fg: '#1b232c' }, g);
    box(0.5, 0.06, 1.0, MAT.black, -0.2, 1.42, 0, g); cyl(0.015, 0.3, MAT.black, -0.9, 1.5, 0.4, g, 4); box(0.3, 0.015, 0.02, MAT.black, 1.0, 1.0, -0.3, g).rotation.z = -0.55;
    g.userData.paint = paint; g.userData.dynamic = true;
    return g;
  }
  // ── Lane traffic ──────────────────────────────────────────────────
  // cars that drive along x in lanes and wrap at the edge: traffic.add(z, dir, speed, mesh) and tickTraffic(dt). The player
  // and the game's own vehicles are not in it; it is the road's life.
  var traffic = { cars: [], x0: -130, x1: 130 };
  function trafficAdd(z, dir, v, mesh, y) { var g = mesh || carMesh(); g.position.set(randf(traffic.x0, traffic.x1), y || 0, z); g.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2; g.rotation.y = dir > 0 ? 0 : Math.PI; scene.add(g); var c = { g: g, dir: dir, v: v || randf(6, 11), z: z }; traffic.cars.push(c); return c; }
  function tickTraffic(dt) { if (!traffic || !traffic.cars) return; roadTick(dt); traffic.cars.forEach(function (c) { if (c.road) return; c.g.position.x += c.dir * c.v * dt; if (c.g.position.x > traffic.x1) c.g.position.x = traffic.x0; if (c.g.position.x < traffic.x0) c.g.position.x = traffic.x1; var ws = c.g.userData.wheels; if (ws) ws.forEach(function (w) { w.rotation.z -= c.dir * c.v * dt / 0.33; }); }); }
  // ── Road network ─────────────────────────────────────────────────
  // Lanes are directed polylines of [x, z] points. A road piece adds its own from its build with c.lane(points, opt), local to
  // the prop, so they move and turn with it; a game adds one in world space with roadLane(points, opt). Lane ends that meet
  // (within 1.2 m, heading within 60 degrees) join into one network, rebuilt when a road piece is placed, moved or removed.
  // roadTraffic({ cars }) keeps that many cars driving it: a car picks its next lane at random at each lane end, keeps its
  // distance to the car ahead, waits while another approach crosses a junction (lanes with the same opt.box), gives way to a
  // lane of higher opt.prio it merges into (a roundabout's ring) and slows for a tight curve (opt.r, its radius). A lane end
  // that leads nowhere sends the car back to a lane nothing leads into, so an open road behaves like the wrapping lanes above.
  // The cars sit in traffic.cars beside the lane cars, flagged road: true. The dev command 'lanes' draws the network.
  var ROADS = { src: [], net: null, sig: '', checkT: 0, want: 0, cars: [], dbg: null, seq: 0 };
  function roadLane(points, opt) { var s = { pts: points.map(function (p) { return [p[0], p[1]]; }), opt: opt || {}, g: null, prop: null, n: ++ROADS.seq }; ROADS.src.push(s); ROADS.sig = ''; return s; }
  function roadLaneLocal(g, prop, points, opt) { var s = roadLane(points, opt); s.g = g; s.prop = prop; return s; }
  function roadDropProp(prop) { var n = ROADS.src.length; ROADS.src = ROADS.src.filter(function (s) { return s.prop !== prop; }); if (ROADS.src.length !== n) ROADS.sig = ''; }
  function roadLive(g) { for (var o = g; o; o = o.parent) { if (o === scene) return true; } return false; }
  function roadSig() { var parts = [ROADS.src.length]; ROADS.src.forEach(function (s) { if (!s.g) return; var p = s.g.position; parts.push(s.n, Math.round(p.x * 20), Math.round(p.z * 20), Math.round(s.g.rotation.y * 100), roadLive(s.g) ? 1 : 0); }); return parts.join(','); }
  function roadNet() {
    var v = new THREE.Vector3(), lanes = [];
    ROADS.src = ROADS.src.filter(function (s) { return !s.g || roadLive(s.g); });
    ROADS.src.forEach(function (s) {
      if (s.g) s.g.updateMatrixWorld(true);
      var pts = s.pts.map(function (p) { if (s.g) { v.set(p[0], 0, p[1]).applyMatrix4(s.g.matrixWorld); return [v.x, v.y, v.z]; } return [p[0], s.opt.y || 0, p[1]]; });
      if (pts.length < 2) return;
      var cum = [0]; for (var i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][2] - pts[i - 1][2]));
      lanes.push({ pts: pts, cum: cum, len: cum[cum.length - 1], src: s, next: [], prev: [], box: s.opt.box ? (s.prop || 'world') + ':' + s.opt.box : null, from: s.opt.from === undefined ? null : s.opt.from, prio: s.opt.prio || 0, vmax: s.opt.vmax || (s.opt.r ? Math.max(2.5, Math.sqrt(2.4 * s.opt.r)) : 11) });
    });
    var head = function (a, b) { var dx = b[0] - a[0], dz = b[2] - a[2], l = Math.hypot(dx, dz) || 1; return [dx / l, dz / l]; };
    lanes.forEach(function (a) {
      var e = a.pts[a.pts.length - 1], ha = head(a.pts[a.pts.length - 2], e);
      lanes.forEach(function (b) {
        if (b === a) return; var s0 = b.pts[0]; if (Math.hypot(s0[0] - e[0], s0[2] - e[2]) > 1.2) return;
        var hb = head(s0, b.pts[1]); if (ha[0] * hb[0] + ha[1] * hb[1] < 0.5) return;
        a.next.push(b); b.prev.push(a);
      });
    });
    // a loop of priority lanes (a roundabout's ring) takes a car per 10 m of it; a car waits to join a full one, so it cannot lock up
    lanes.forEach(function (l) { if (!l.prio || l.comp) return; var comp = { len: 0, cap: 1 }, todo = [l]; l.comp = comp; while (todo.length) { var q = todo.pop(); comp.len += q.len; q.next.concat(q.prev).forEach(function (o) { if (o.prio && !o.comp) { o.comp = comp; todo.push(o); } }); } comp.cap = Math.max(1, Math.floor(comp.len / 10)); });
    var entries = lanes.filter(function (l) { return !l.prev.length && !l.box; });
    return { lanes: lanes, entries: entries.length ? entries : lanes.filter(function (l) { return !l.box; }), joins: lanes.reduce(function (n, l) { return n + l.next.length; }, 0) };
  }
  function lanePoint(L, s, out) {
    var p = L.pts, c = L.cum, i = 1; while (i < p.length - 1 && c[i] < s) i++;
    var a = p[i - 1], b = p[i], t = clamp((s - c[i - 1]) / Math.max(1e-6, c[i] - c[i - 1]), 0, 1);
    out.x = a[0] + (b[0] - a[0]) * t; out.y = a[1] + (b[1] - a[1]) * t; out.z = a[2] + (b[2] - a[2]) * t; out.yaw = Math.atan2(-(b[2] - a[2]), b[0] - a[0]); return out;
  }
  function roadPick(L) { return L.next.length ? L.next[Math.floor(Math.random() * L.next.length)] : null; }
  function roadFree(L, s, skip) { var p = lanePoint(L, s, {}); for (var i = 0; i < ROADS.cars.length; i++) { var d = ROADS.cars[i]; if (d === skip || d.parked) continue; if (d.lane === L && Math.abs(d.s - s) < 9) return false; if (Math.hypot(d.g.position.x - p.x, d.g.position.z - p.z) < 7) return false; } return true; }
  function roadPlace(c, L, s) { c.lane = L; c.src = L.src; c.s = s; c.next = roadPick(L); c.wait = 0; c.parked = false; c.g.visible = true; var p = lanePoint(L, s, {}); c.g.position.set(p.x, p.y, p.z); c.yaw = p.yaw; c.g.rotation.y = p.yaw; }
  function roadPark(c) { c.parked = true; c.lane = null; c.next = null; c.v = 0; c.g.visible = false; }
  function roadSeat(c, anywhere) {
    var net = ROADS.net; if (!net || !net.lanes.length) { roadPark(c); return false; }
    var pool = anywhere ? net.lanes.filter(function (l) { return !l.box && l.len > 4; }) : net.entries; if (!pool.length) pool = net.lanes;
    for (var k = 0; k < 8; k++) { var L = pool[Math.floor(Math.random() * pool.length)], s = anywhere ? Math.random() * L.len : 0; if (roadFree(L, s, c)) { roadPlace(c, L, s); c.v = anywhere ? c.vmax * 0.6 : Math.min(c.vmax, L.vmax) * 0.7; return true; } }
    roadPark(c); return false;
  }
  function roadReseat() {
    var byNode = new Map(); ROADS.net.lanes.forEach(function (l) { byNode.set(l.src, l); });
    ROADS.cars.forEach(function (c) { if (c.parked) return; var L = byNode.get(c.src); if (L) { c.lane = L; c.s = Math.min(c.s, L.len); if (!c.next || L.next.indexOf(c.next) < 0) { var nn = c.next && byNode.get(c.next.src); c.next = nn && L.next.indexOf(nn) >= 0 ? nn : roadPick(L); } } else roadSeat(c, true); });
  }
  // how far ahead the nearest car is: on this lane, on the lane it goes to next, or any car close in front heading its way.
  // Two cars that each have the other in front (side by side at a merge or in a junction) do not both wait: the one on the
  // lower priority lane does, or on equal lanes the later car, so one always goes and they cannot lock each other
  function roadGap(c, me) {
    var best = 1e9, rem = c.lane.len - c.s;
    for (var i = 0; i < ROADS.cars.length; i++) {
      var d = ROADS.cars[i]; if (d === c || d.parked) continue;
      if (d.lane === c.lane && d.s > c.s) best = Math.min(best, d.s - c.s);
      else if (d.lane === c.next) best = Math.min(best, rem + d.s);
      else { var dx = d.g.position.x - me.x, dz = d.g.position.z - me.z, dist = Math.hypot(dx, dz); if (dist < 7) { var hx = Math.cos(c.yaw), hz = -Math.sin(c.yaw), fwd = dx * hx + dz * hz, side = Math.abs(dx * hz - dz * hx); if (fwd > 0 && side < 1.7 && Math.cos(d.yaw - c.yaw) > -0.3) { var gx = Math.cos(d.yaw), gz = -Math.sin(d.yaw), mutual = (-dx * gx - dz * gz) > 0 && Math.abs(-dx * gz + dz * gx) < 1.7; if (!mutual || d.lane.prio > c.lane.prio || (d.lane.prio === c.lane.prio && d.id < c.id)) best = Math.min(best, fwd); } } }
    }
    return best;
  }
  // is any car within limit metres of the end of lane L, counting back through the lanes that feed it (acc is the way already counted)
  function roadComing(L, acc, limit, skip, seen) {
    seen = seen || []; if (seen.indexOf(L) >= 0) return false; seen.push(L);
    for (var i = 0; i < ROADS.cars.length; i++) { var d = ROADS.cars[i]; if (d !== skip && !d.parked && d.lane === L && L.len - d.s + acc < limit) return true; }
    for (var k = 0; k < L.prev.length; k++) if (acc + L.len < limit && roadComing(L.prev[k], acc + L.len, limit, skip, seen)) return true;
    return false;
  }
  // may the car leave its lane for the next one: no other approach inside the junction, nobody with priority about to arrive
  function roadMayEnter(c) {
    var ok = roadMayEnter0(c), B = c.next;
    if (ok && B && B.box) { c.res = B.box; c.resFrom = B.from; } else if (!ok) c.res = null;   // a car that goes reserves the junction, so two cannot decide together
    return ok;
  }
  function roadMayEnter0(c) {
    var B = c.next; c.capHold = false; c.boxHold = false; if (!B) return true;
    if (c.lane.src.opt.merge) return true;   // a car already merging has given way at the line: it carries on
    // into a junction only with room on the far side, so nobody stops in the box and locks the other approaches out
    if (B.box) { if (!c.after || B.next.indexOf(c.after) < 0) c.after = roadPick(B); if (c.after) for (var ai = 0; ai < ROADS.cars.length; ai++) { var da = ROADS.cars[ai]; if (da !== c && !da.parked && da.lane === c.after && da.s < 8) { c.boxHold = true; return false; } } }
    var loopL = B.comp ? B : (B.src.opt.merge && B.next.length ? B.next[0] : null);
    if (loopL && loopL.comp && c.lane.comp !== loopL.comp) { B = loopL; var inLoop = 0; for (var ci = 0; ci < ROADS.cars.length; ci++) { var dc = ROADS.cars[ci]; if (dc !== c && !dc.parked && dc.lane && dc.lane.comp === B.comp) inLoop++; } if (inLoop >= B.comp.cap) { c.capHold = true; return false; } B = c.next; }
    for (var i = 0; i < ROADS.cars.length; i++) {
      var d = ROADS.cars[i]; if (d === c || d.parked || !d.lane) continue;
      if (B.box && ((d.lane.box === B.box && d.lane.from !== B.from) || (d.res === B.box && d.resFrom !== B.from))) { c.boxHold = true; return false; }
      if (d.lane === B && d.s < 6) return false;
    }
    // a merge lane (a roundabout entry) joins the lane after it: give way to anyone coming round on that lane's feeders
    if (B.src.opt.merge && B.next.length) { var T = B.next[0]; for (var ti = 0; ti < T.prev.length; ti++) if (T.prev[ti] !== B && roadComing(T.prev[ti], 0, 22, c)) return false; }
    var near = function (F, extra) { for (var j = 0; j < ROADS.cars.length; j++) { var e = ROADS.cars[j]; if (e !== c && !e.parked && e.lane === F && F.len - e.s + extra < 12) return true; } return false; };
    for (var k = 0; k < B.prev.length; k++) { var F = B.prev[k]; if (F === c.lane || F.prio <= c.lane.prio) continue; if (near(F, 0)) return false; for (var m = 0; m < F.prev.length; m++) if (F.prev[m].prio > c.lane.prio && near(F.prev[m], F.len)) return false; }
    return true;
  }
  function roadTick(dt) {
    ROADS.checkT -= dt;
    if (ROADS.checkT <= 0 || !ROADS.sig) { ROADS.checkT = 0.5; var sig = roadSig(); if (sig !== ROADS.sig) { ROADS.sig = sig; ROADS.net = roadNet(); roadReseat(); if (ROADS.dbg) roadDebugDraw(); } }
    var net = ROADS.net; if (!ROADS.cars.length || !net) return;
    var me = new THREE.Vector3(), p = {};
    ROADS.cars.forEach(function (c) { if (c.parked) { if (Math.random() < dt) roadSeat(c, false); return; }
      var L = c.lane, rem = L.len - c.s, target = Math.min(c.vmax, L.vmax);
      if (c.next && rem < 18) target = Math.min(target, c.next.vmax + rem * 0.5);
      me.copy(c.g.position); var gap = roadGap(c, me); if (gap < 40) target = Math.min(target, Math.max(0, (gap - 6) * 0.9));
      c.hold = !!(c.next && rem < 3 && !roadMayEnter(c));
      if (c.hold) { c.wait += dt; var force = c.wait > 9 && !c.capHold && !c.boxHold; target = force ? 1.5 : 0; if (force) c.hold = false; } else if (rem >= 3) c.wait = 0;
      c.v = clamp(c.v + clamp(target - c.v, -8 * dt, 3 * dt), 0, 30);
    });
    ROADS.cars.forEach(function (c) {
      if (c.parked) return;
      c.s += c.v * dt;
      if (c.hold && c.s > c.lane.len - 0.4) { c.s = c.lane.len - 0.4; c.v = 0; }
      while (c.s >= c.lane.len) { var over = c.s - c.lane.len; if (c.next) { c.lane = c.next; c.src = c.lane.src; c.s = over; c.next = c.after && c.lane.next.indexOf(c.after) >= 0 ? c.after : roadPick(c.lane); c.after = null; c.wait = 0; if (!c.lane.box) c.res = null; } else { roadSeat(c, false); break; } }
      if (c.parked) return;
      lanePoint(c.lane, c.s, p); c.g.position.set(p.x, p.y, p.z);
      var dy = Math.atan2(Math.sin(p.yaw - c.yaw), Math.cos(p.yaw - c.yaw)); c.yaw += dy * Math.min(1, dt * 7); c.g.rotation.y = c.yaw;
      var ws = c.g.userData.wheels; if (ws) ws.forEach(function (w) { w.rotation.z -= c.v * dt / 0.33; });
    });
  }
  // keep n cars on the road network (0 takes them all off); opt.speed is the top speed in m/s, opt.colours a list to pick from
  function roadTraffic(opt) {
    opt = typeof opt === 'number' ? { cars: opt } : (opt || {}); ROADS.want = Math.max(0, opt.cars | 0);
    while (ROADS.cars.length > ROADS.want) { var c0 = ROADS.cars.pop(); scene.remove(c0.g); var k = traffic.cars.indexOf(c0); if (k >= 0) traffic.cars.splice(k, 1); }
    if (!ROADS.sig) { ROADS.sig = roadSig(); ROADS.net = roadNet(); }
    while (ROADS.cars.length < ROADS.want) {
      var g = carMesh(opt.colours ? pick(opt.colours) : undefined); g.userData.dynamic = true; scene.add(g);
      var c = { id: ++ROADS.seq, g: g, road: true, dir: 1, z: 0, v: 0, vmax: (opt.speed || 9) * randf(0.85, 1.1), s: 0, lane: null, next: null, wait: 0, yaw: 0 };
      ROADS.cars.push(c); traffic.cars.push(c); roadSeat(c, true);
    }
    return ROADS.cars.length;
  }
  function roadDebugDraw() {
    if (ROADS.dbg) { scene.remove(ROADS.dbg); ROADS.dbg.traverse(function (o) { if (o.geometry) o.geometry.dispose(); }); }
    var g = new THREE.Group(); g.userData.dynamic = true; g.userData.noBake = true;
    var mats = [new THREE.LineBasicMaterial({ color: 0x2fd0ff }), new THREE.LineBasicMaterial({ color: 0xffb020 }), new THREE.LineBasicMaterial({ color: 0xff3a6a })];
    (ROADS.net ? ROADS.net.lanes : []).forEach(function (L) {
      var m = L.next.length ? (L.prio ? mats[1] : mats[0]) : mats[2], pts = L.pts.map(function (q) { return new THREE.Vector3(q[0], q[1] + 0.15, q[2]); });
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), m));
      var p = lanePoint(L, L.len * 0.5, {}), a = p.yaw, hx = Math.cos(a), hz = -Math.sin(a), tip = new THREE.Vector3(p.x + hx * 0.5, p.y + 0.15, p.z + hz * 0.5);
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(p.x - hx * 0.3 - hz * 0.35, p.y + 0.15, p.z - hz * 0.3 + hx * 0.35), tip, new THREE.Vector3(p.x - hx * 0.3 + hz * 0.35, p.y + 0.15, p.z - hz * 0.3 - hx * 0.35)]), m));
    });
    scene.add(g); ROADS.dbg = g;
  }
  // the dev command 'lanes': draw the network (blue lanes, amber priority lanes, red ends that lead nowhere) or hide it
  function roadDebug(on) {
    if (on === undefined) on = !ROADS.dbg;
    if (!on) { if (ROADS.dbg) { scene.remove(ROADS.dbg); ROADS.dbg = null; } return 'lanes hidden'; }
    if (!ROADS.net || !ROADS.sig) { ROADS.sig = roadSig(); ROADS.net = roadNet(); }
    roadDebugDraw(); return ROADS.net.lanes.length + ' lanes, ' + ROADS.net.joins + ' joins, ' + ROADS.cars.length + ' cars';
  }
  // ── A vehicle you drive ───────────────────────────────────────────
  // The record is the game's ({ x, z, yaw, speed, gear }); driveStep moves it from the keys with an acceleration, a top speed per
  // gear, drag, steering that scales with speed and a collision test the game supplies (vehicleBlocked(x, z, v)). Returns the
  // speed. vehicleCamera puts the camera at the driving seat with a look offset the mouse turns.
  var DRIVE = { accel: 3.2, top: 4.2, reverse: 2.6, drag: 3, steer: 1.6, gears: [0.6, 1.0, 1.5] };
  function driveStep(v, keys, dt, opt) {
    opt = opt || {}; var D = opt.spec || DRIVE, throttle = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), steer = (keys.KeyA ? 1 : 0) - (keys.KeyD ? 1 : 0), gm = D.gears[(v.gear || 1) - 1] || 1, cap = opt.cap === undefined ? 1 : opt.cap;
    v.speed = v.speed || 0;
    if (throttle) v.speed = clamp(v.speed + throttle * D.accel * gm * dt, -D.reverse * cap, D.top * gm * cap); else v.speed *= Math.max(0, 1 - D.drag * dt);
    if (Math.abs(v.speed) > 0.05) v.yaw += steer * D.steer * dt * (v.speed > 0 ? 1 : -1) * Math.min(1, Math.abs(v.speed) / 1.5);
    var nx = v.x + Math.sin(v.yaw) * v.speed * dt, nz = v.z + Math.cos(v.yaw) * v.speed * dt;
    var blocked = opt.blocked ? opt.blocked(nx, nz, v) : false;
    if (!blocked) { v.x = nx; v.z = nz; } else v.speed = -v.speed * 0.2;
    return v.speed;
  }
  // an obstacle the vehicle is already inside cannot block it, so it can always back out; r is the vehicle's half width
  function vehicleBlocked(v, x, z, r, list) {
    var cx = v.x, cz = v.z, all = list || solids.concat(dyn);
    for (var i = 0; i < all.length; i++) { var s = all[i]; if (s.vehicle === v) continue; if (s.y0 > 2.5) continue; if (x > s.x0 - r && x < s.x1 + r && z > s.z0 - r && z < s.z1 + r) { var already = cx > s.x0 - r && cx < s.x1 + r && cz > s.z0 - r && cz < s.z1 + r; if (!already) return true; var dxn = Math.max(s.x0 - x, 0, x - s.x1), dzn = Math.max(s.z0 - z, 0, z - s.z1), dxc = Math.max(s.x0 - cx, 0, cx - s.x1), dzc = Math.max(s.z0 - cz, 0, cz - s.z1); if (dxn + dzn < dxc + dzc - 0.001) return true; } }
    return false;
  }
  function vehicleCamera(v, look, eye, back) { var y = floorY(v.x, v.z) + (eye || 1.78), b = back === undefined ? 0.45 : back; camera.position.set(v.x - Math.sin(v.yaw) * b, y, v.z - Math.cos(v.yaw) * b); camera.rotation.set(look ? look.pitch : 0, v.yaw + Math.PI + (look ? look.yaw : 0), 0, 'YXZ'); }
  // ── Physics ───────────────────────────────────────────────────────
  // body(obj, { mass, shape: 'box' | 'sphere', size: [w, h, d] or r, restitution, friction, kinematic }) makes an object a body; its position is
  // the body's centre. removeBody(obj) takes it out. impulse(obj, vx, vy, vz) kicks it. Bodies rest on floorY (so on the terrain too),
  // on the engine's solids and on each other; a body that is still for a while sleeps until something touches it.
  var PHYS = { on: true, g: -9.81, bodies: [], sleepT: 0.6, maxStep: 1 / 50, iterations: 3, stepped: 0 };
  function bodyOf(obj) { for (var i = 0; i < PHYS.bodies.length; i++) if (PHYS.bodies[i].obj === obj) return PHYS.bodies[i]; return null; }
  function bodyBounds(obj) { var b = new THREE.Box3().setFromObject(obj), s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3()); return { size: [Math.max(0.05, s.x), Math.max(0.05, s.y), Math.max(0.05, s.z)], off: [c.x - obj.position.x, c.y - obj.position.y, c.z - obj.position.z] }; }
  function body(obj, opt) {
    opt = opt || {}; var B = bodyOf(obj); if (B) removeBody(obj);
    var bb = bodyBounds(obj), size = opt.size ? (typeof opt.size === 'number' ? [opt.size * 2, opt.size * 2, opt.size * 2] : opt.size.slice()) : bb.size;
    B = { obj: obj, mass: opt.mass === undefined ? 1 : +opt.mass, shape: opt.shape || 'box', hx: size[0] / 2, hy: size[1] / 2, hz: size[2] / 2, off: opt.size ? [0, 0, 0] : bb.off, vel: new THREE.Vector3(), restitution: opt.restitution === undefined ? 0.15 : +opt.restitution, friction: opt.friction === undefined ? 0.6 : +opt.friction, kinematic: !!opt.kinematic, asleep: false, still: 0, onGround: false, id: obj.userData && (obj.userData.propId || obj.userData.eid) || obj.name || ('b' + PHYS.bodies.length) };
    PHYS.bodies.push(B); obj.userData.body = B; return B;
  }
  function removeBody(obj) { var i = PHYS.bodies.findIndex(function (b) { return b.obj === obj; }); if (i >= 0) PHYS.bodies.splice(i, 1); if (obj.userData) delete obj.userData.body; return i >= 0; }
  function impulse(obj, vx, vy, vz) { var B = bodyOf(obj); if (!B) return false; B.vel.x += vx || 0; B.vel.y += vy || 0; B.vel.z += vz || 0; B.asleep = false; B.still = 0; return true; }
  function wake(B) { B.asleep = false; B.still = 0; }
  // the box a body fills now, in world space
  function bodyBox(B) { var p = B.obj.position; return { x0: p.x + B.off[0] - B.hx, x1: p.x + B.off[0] + B.hx, y0: p.y + B.off[1] - B.hy, y1: p.y + B.off[1] + B.hy, z0: p.z + B.off[2] - B.hz, z1: p.z + B.off[2] + B.hz }; }
  function overlap(a, b) { var dx = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), dy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0), dz = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0); if (dx <= 0 || dy <= 0 || dz <= 0) return null; return { dx: dx, dy: dy, dz: dz }; }
  // push a body out of a box along the smallest overlap, and take the velocity along that axis away (with the bounce and the friction)
  function resolve(B, box, other) {
    var ov = overlap(bodyBox(B), box); if (!ov) return false; var p = B.obj.position, cx = p.x + B.off[0], cy = p.y + B.off[1], cz = p.z + B.off[2], bcx = (box.x0 + box.x1) / 2, bcy = (box.y0 + box.y1) / 2, bcz = (box.z0 + box.z1) / 2;
    if (ov.dy <= ov.dx && ov.dy <= ov.dz) { var up = cy >= bcy; p.y += up ? ov.dy : -ov.dy; if ((up && B.vel.y < 0) || (!up && B.vel.y > 0)) B.vel.y = -B.vel.y * B.restitution; if (up) { B.onGround = true; B.vel.x *= 1 - Math.min(1, B.friction * 0.2); B.vel.z *= 1 - Math.min(1, B.friction * 0.2); if (other && other.vel) { B.vel.x += (other.vel.x - B.vel.x) * 0.5; B.vel.z += (other.vel.z - B.vel.z) * 0.5; } } }
    else if (ov.dx <= ov.dz) { var right = cx >= bcx; p.x += right ? ov.dx : -ov.dx; if ((right && B.vel.x < 0) || (!right && B.vel.x > 0)) B.vel.x = -B.vel.x * B.restitution; }
    else { var front = cz >= bcz; p.z += front ? ov.dz : -ov.dz; if ((front && B.vel.z < 0) || (!front && B.vel.z > 0)) B.vel.z = -B.vel.z * B.restitution; }
    if (other && other.asleep) wake(other); return true;
  }
  // a hinge: the object swings from a pivot on an axis like a pendulum, with damping; a sign on a bracket, a lamp on a chain
  var HINGES = [];
  function hinge(obj, opt) { removeHinge(obj); opt = opt || {}; var p = opt.pivot || [obj.position.x, obj.position.y + (opt.length || 1), obj.position.z], H = { obj: obj, pivot: p, length: opt.length || 1, axis: opt.axis === 'x' ? 'x' : 'z', angle: opt.angle || 0, omega: opt.omega || 0, damping: opt.damping === undefined ? 0.4 : +opt.damping }; HINGES.push(H); obj.userData.hinge = H; return H; }
  function removeHinge(obj) { var i = HINGES.findIndex(function (h) { return h.obj === obj; }); if (i >= 0) HINGES.splice(i, 1); if (obj.userData) delete obj.userData.hinge; return i >= 0; }
  function swing(obj, omega) { var H = obj.userData && obj.userData.hinge; if (!H) return false; H.omega += omega; return true; }
  function hingeStep(dt) { HINGES.forEach(function (H) { H.omega += (PHYS.g / H.length) * Math.sin(H.angle) * dt - H.omega * H.damping * dt; H.angle += H.omega * dt; var o = H.obj; if (H.axis === 'z') { o.position.set(H.pivot[0] + Math.sin(H.angle) * H.length, H.pivot[1] - Math.cos(H.angle) * H.length, H.pivot[2]); o.rotation.z = H.angle; } else { o.position.set(H.pivot[0], H.pivot[1] - Math.cos(H.angle) * H.length, H.pivot[2] + Math.sin(H.angle) * H.length); o.rotation.x = -H.angle; } }); }
  // a spring: a body pulled towards an anchor point with stiffness k and damping, around a rest length; a punch bag, a hanging sign that bounces
  var SPRINGS = [];
  function spring(obj, opt) { opt = opt || {}; var B = bodyOf(obj) || body(obj, { mass: opt.mass || 1 }); unspring(obj); var S2 = { B: B, anchor: opt.anchor || [obj.position.x, obj.position.y + 1, obj.position.z], k: opt.k === undefined ? 20 : +opt.k, damping: opt.damping === undefined ? 2 : +opt.damping, rest: opt.rest || 0 }; SPRINGS.push(S2); wake(B); return S2; }
  function unspring(obj) { var i = SPRINGS.findIndex(function (s) { return s.B.obj === obj; }); if (i >= 0) SPRINGS.splice(i, 1); return i >= 0; }
  function springStep(dt) { SPRINGS.forEach(function (S2) { var B = S2.B, p = B.obj.position, dx = S2.anchor[0] - p.x, dy = S2.anchor[1] - p.y, dz = S2.anchor[2] - p.z, len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6, f = S2.k * (len - S2.rest) / B.mass; B.vel.x += (dx / len * f - B.vel.x * S2.damping) * dt; B.vel.y += (dy / len * f - B.vel.y * S2.damping - PHYS.g * 0) * dt; B.vel.z += (dz / len * f - B.vel.z * S2.damping) * dt; wake(B); }); }
  function physicsStep(dt) {
    var bodies = PHYS.bodies, i, j, k;
    hingeStep(dt); springStep(dt);
    for (i = 0; i < bodies.length; i++) {
      var B = bodies[i]; if (B.kinematic || B.asleep) continue; var p = B.obj.position;
      B.vel.y += PHYS.g * dt; p.x += B.vel.x * dt; p.y += B.vel.y * dt; p.z += B.vel.z * dt; B.onGround = false;
      // the ground under the body's centre
      var gy = floorY(p.x + B.off[0], p.z + B.off[2]), bottom = p.y + B.off[1] - B.hy; if (bottom < gy) { p.y += gy - bottom; if (B.vel.y < 0) B.vel.y = -B.vel.y * B.restitution; if (Math.abs(B.vel.y) < 0.5) B.vel.y = 0; B.onGround = true; B.vel.x *= 1 - Math.min(1, B.friction * 0.25); B.vel.z *= 1 - Math.min(1, B.friction * 0.25); }
      // the engine's solids (walls, machines, the props' obstacles) near the body
      for (k = 0; k < PHYS.iterations; k++) { var hit = false; for (j = 0; j < solids.length; j++) { var s = solids[j]; if (s.prop && (s.prop === B.id || s.prop === B.ignoreOwn)) continue; var box = { x0: s.x0, x1: s.x1, y0: s.y0 === undefined ? -5 : s.y0, y1: s.y1 === undefined ? 3 : s.y1, z0: s.z0, z1: s.z1 }; if (resolve(B, box, null)) hit = true; } if (!hit) break; }
    }
    // bodies against bodies: the lighter one moves, both wake
    for (i = 0; i < bodies.length; i++) for (j = i + 1; j < bodies.length; j++) {
      var A = bodies[i], C = bodies[j]; if ((A.asleep && C.asleep) || (A.kinematic && C.kinematic)) continue;
      var mover = A.kinematic ? C : C.kinematic ? A : (A.mass <= C.mass ? A : C), fixed = mover === A ? C : A; if (resolve(mover, bodyBox(fixed), fixed)) { wake(mover); if (!fixed.kinematic) wake(fixed); }
    }
    // spheres roll: the mesh turns with the ground speed
    for (i = 0; i < bodies.length; i++) { var R = bodies[i]; if (R.shape !== 'sphere' || R.asleep) continue; var sp = Math.sqrt(R.vel.x * R.vel.x + R.vel.z * R.vel.z); if (sp > 0.01) { var ax = new THREE.Vector3(R.vel.z, 0, -R.vel.x).normalize(); R.obj.rotateOnWorldAxis(ax, sp * dt / Math.max(0.05, R.hx)); } }
    // sleep when still
    for (i = 0; i < bodies.length; i++) { var D = bodies[i]; if (D.kinematic || D.asleep || SPRINGS.some(function (s) { return s.B === D; })) continue; if (D.onGround && D.vel.lengthSq() < 0.0025) { D.still += dt; if (D.still > PHYS.sleepT) { D.asleep = true; D.vel.set(0, 0, 0); } } else D.still = 0; }
    PHYS.stepped++;
  }
  function physicsTick(dt) {
    if (!PHYS.on || (!PHYS.bodies.length && !HINGES.length) || (CO.game && CO.game.physics === false)) return;
    if (CO.physicsSolver && CO.physicsSolver.step) { CO.physicsSolver.step(PHYS.bodies, dt, PHYS); return; }
    var left = Math.min(dt, 0.1); while (left > 0) { var h = Math.min(PHYS.maxStep, left); physicsStep(h); left -= h; }
    PHYS.bodies.forEach(function (B) { if (B.obj.userData && B.obj.userData.dynamic === undefined) shadowDirty = true; });
  }
  animate(physicsTick);
  function physicsState() { return { on: PHYS.on && !(CO.game && CO.game.physics === false), g: PHYS.g, springs: SPRINGS.length, hinges: HINGES.map(function (H) { return { id: H.obj.userData && (H.obj.userData.propId || H.obj.userData.eid) || H.obj.name || null, angle: rnd(H.angle), length: H.length, axis: H.axis }; }), bodies: PHYS.bodies.map(function (B) { return { id: B.id, mass: B.mass, asleep: B.asleep, onGround: B.onGround, x: rnd(B.obj.position.x), y: rnd(B.obj.position.y), z: rnd(B.obj.position.z), vy: rnd(B.vel.y) }; }), stepped: PHYS.stepped, solver: CO.physicsSolver ? 'plugged' : 'built in' }; }
  // ── Clips ─────────────────────────────────────────────────────────
  // A clip: { duration, loop, tracks: [{ path, keys: [[t, value, ease]] }], events: [[t, name]] }. A path names a node and a field:
  // 'rotation.x' on the object itself, 'child.2.position.y' the third child, 'name.lamp.rotation.z' a named descendant, and on a
  // person 'leg.0', 'knee.1', 'arm.0', 'elbow.1', 'torso', 'head' (the rig's parts). Values are numbers; ease is 'linear', 'smooth',
  // 'in', 'out' or 'step'. Times are seconds.
  var CLIPS = {}, CLIP_ORDER = [], playing = [];
  CO.clip = function (name, clip) { if (!name) return CLIPS; if (clip === null) { delete CLIPS[name]; CLIP_ORDER.splice(CLIP_ORDER.indexOf(name), 1); return null; } clip = JSON.parse(JSON.stringify(clip || {})); clip.duration = clip.duration || clipLength(clip); if (!clip.tracks) clip.tracks = []; if (!CLIPS[name]) CLIP_ORDER.push(name); CLIPS[name] = clip; return clip; };
  function clipLength(c) { var d = 0; (c.tracks || []).forEach(function (t) { (t.keys || []).forEach(function (k) { d = Math.max(d, k[0]); }); }); (c.events || []).forEach(function (e) { d = Math.max(d, e[0]); }); return d || 1; }
  function easeV(k, f) { if (k === 'step') return 0; if (k === 'in') return f * f; if (k === 'out') return 1 - (1 - f) * (1 - f); if (k === 'linear') return f; return f * f * (3 - 2 * f); }
  function trackValue(keys, t) {
    if (!keys || !keys.length) return undefined; if (t <= keys[0][0]) return keys[0][1]; var last = keys[keys.length - 1]; if (t >= last[0]) return last[1];
    for (var i = 0; i < keys.length - 1; i++) { var a = keys[i], b = keys[i + 1]; if (t >= a[0] && t <= b[0]) { var f = b[0] === a[0] ? 1 : (t - a[0]) / (b[0] - a[0]); return a[1] + (b[1] - a[1]) * easeV(b[2] || 'smooth', f); } }
    return last[1];
  }
  // the node and field a path names, on an object (a person's parts come from the rig's userData)
  function clipTarget(obj, path) {
    var p = String(path).split('.'), node = obj, u = obj.userData || {}, i = 0;
    if (p[0] === 'child') { node = obj.children[+p[1]]; i = 2; }
    else if (p[0] === 'name') { node = obj.getObjectByName(p[1]); i = 2; }
    else if (p[0] === 'leg' && u.legs) { node = u.legs[+p[1]]; i = 2; }
    else if (p[0] === 'knee' && u.legs) { node = u.legs[+p[1]] && u.legs[+p[1]].userData.knee; i = 2; }
    else if (p[0] === 'arm' && u.arms) { node = u.arms[+p[1]]; i = 2; }
    else if (p[0] === 'elbow' && u.arms) { node = u.arms[+p[1]] && u.arms[+p[1]].userData.elbow; i = 2; }
    else if (p[0] === 'torso' && u.torso) { node = u.torso; i = 1; }
    else if (p[0] === 'head' && u.head) { node = u.head; i = 1; }
    if (!node) return null; var prop = p[i], axis = p[i + 1];
    if (prop === 'material') { var mm = node.material || (function () { var f = null; node.traverse(function (o) { if (!f && o.isMesh && o.material && !o.material.userData.shared) f = o.material; }); return f; })(); if (!mm) return null; if (axis === 'color' || axis === 'emissive') { var ch = p[i + 2]; if (!mm[axis] || 'rgb'.indexOf(ch) < 0) return null; return { node: node, set: function (v) { mm[axis][ch] = v; }, get: function () { return mm[axis][ch]; } }; } if (typeof mm[axis] !== 'number') return null; return { node: node, set: function (v) { mm[axis] = v; if (axis === 'opacity') mm.transparent = v < 1; }, get: function () { return mm[axis]; } }; }
    if (prop === 'visible' || prop === 'intensity' || prop === 'opacity') return { node: node, set: function (v) { if (prop === 'opacity' && node.material) { node.material.opacity = v; node.material.transparent = v < 1; } else node[prop] = prop === 'visible' ? v >= 0.5 : v; }, get: function () { return prop === 'opacity' && node.material ? node.material.opacity : (prop === 'visible' ? (node.visible ? 1 : 0) : node[prop]); } };
    if (!node[prop] || axis === undefined) return null;
    return { node: node, set: function (v) { node[prop][axis] = v; }, get: function () { return node[prop][axis]; } };
  }
  // play a clip on an object: it joins the playing list and the frame drives it; a second play on the same object replaces the first
  function playClip(obj, name, opt) {
    var clip = CLIPS[name]; if (!clip || !obj) return null; opt = opt || {};
    stopClip(obj);
    var tracks = clip.tracks.map(function (t) { var tg = clipTarget(obj, t.path); return tg ? { keys: t.keys, tg: tg, from: tg.get() } : null; }).filter(Boolean);
    var P = { obj: obj, name: name, clip: clip, t: 0, speed: opt.speed || 1, loop: opt.loop !== undefined ? !!opt.loop : !!clip.loop, blend: opt.blend === undefined ? 0.2 : +opt.blend, tracks: tracks, fired: {}, done: false, onDone: opt.onDone || null, hold: opt.hold !== false };
    playing.push(P); if (obj.userData) obj.userData.clip = P; return P;
  }
  function stopClip(obj) { for (var i = playing.length - 1; i >= 0; i--) if (playing[i].obj === obj) { playing[i].done = true; playing.splice(i, 1); } if (obj && obj.userData) obj.userData.clip = null; }
  function clipTick(dt) {
    for (var i = playing.length - 1; i >= 0; i--) {
      var P = playing[i], c = P.clip; P.t += dt * P.speed; var t = P.t, over = t >= c.duration;
      if (over) { if (P.loop) { t = P.t = c.duration ? P.t % c.duration : 0; P.fired = {}; } else t = c.duration; }
      var w = P.blend > 0 ? Math.min(1, P.t / P.blend) : 1;
      P.tracks.forEach(function (tr) { var v = trackValue(tr.keys, t); if (v === undefined) return; tr.tg.set(w < 1 ? tr.from + (v - tr.from) * w : v); });
      (c.events || []).forEach(function (e) { if (!P.fired[e[0] + ':' + e[1]] && t >= e[0]) { P.fired[e[0] + ':' + e[1]] = true; runHooks('clipEvent', P.obj, e[1], P); } });
      if (over && !P.loop) { P.done = true; playing.splice(i, 1); if (P.obj.userData) P.obj.userData.clip = null; if (!P.hold) P.tracks.forEach(function (tr) { tr.tg.set(tr.from); }); if (P.onDone) P.onDone(P); }
    }
  }
  animate(clipTick);
  // what the editor reads and writes
  function clipList() { return { order: CLIP_ORDER.slice(), clips: JSON.parse(JSON.stringify(CLIPS)), playing: playing.map(function (P) { return { name: P.name, t: Math.round(P.t * 100) / 100, loop: P.loop, obj: P.obj.userData && (P.obj.userData.propId || P.obj.userData.eid) || P.obj.name || null }; }) }; }
  function clipCode() {
    if (!CLIP_ORDER.length) return '';
    var lines = ['//@ the clips the editor saved: animation as data, played by the engine. Written by the Co Engine editor; it sorts first in src/ so a game can play them from its first frame. Edit them in the editor rather than here.'];
    CLIP_ORDER.forEach(function (n) { if (BUILTIN_CLIPS[n] && JSON.stringify(BUILTIN_CLIPS[n]) === JSON.stringify(CLIPS[n])) return; lines.push('  CO.clip(' + JSON.stringify(n) + ', ' + JSON.stringify(CLIPS[n]) + ');'); });
    if (lines.length === 1) return ''; lines.push(''); return lines.join('\n');
  }
  // a pose from the current transforms of the paths a clip names: a key at time t for every track
  function clipKeyPose(obj, name, t, ease) { var c = CLIPS[name]; if (!c) return null; var n = 0; c.tracks.forEach(function (tr) { var tg = clipTarget(obj, tr.path); if (!tg) return; var v = Math.round(tg.get() * 1000) / 1000, keys = tr.keys || (tr.keys = []), at = keys.findIndex(function (k) { return Math.abs(k[0] - t) < 1e-6; }); if (at >= 0) keys[at] = [t, v, ease || keys[at][2]]; else { keys.push([t, v, ease || 'smooth']); keys.sort(function (a, b) { return a[0] - b[0]; }); } n++; }); c.duration = Math.max(c.duration || 0, t); return n; }
  // the clips every game starts with: a person's gestures, and a few for props
  var BUILTIN_CLIPS = {
    wave: { duration: 1.6, loop: false, tracks: [{ path: 'arm.1.rotation.x', keys: [[0, -0.2], [0.3, -2.6], [1.3, -2.6], [1.6, -0.2]] }, { path: 'elbow.1.rotation.x', keys: [[0, -0.15], [0.3, -0.6], [0.55, -1.2], [0.8, -0.5], [1.05, -1.2], [1.3, -0.6], [1.6, -0.15]] }, { path: 'arm.1.rotation.z', keys: [[0, -0.1], [0.3, -0.5], [1.3, -0.5], [1.6, -0.1]] }] },
    nod: { duration: 0.9, loop: false, tracks: [{ path: 'head.rotation.x', keys: [[0, 0], [0.25, 0.35], [0.5, -0.05], [0.7, 0.3], [0.9, 0]] }] },
    cheer: { duration: 1.4, loop: false, tracks: [{ path: 'arm.0.rotation.x', keys: [[0, -0.2], [0.35, -2.9], [1.0, -2.9], [1.4, -0.2]] }, { path: 'arm.1.rotation.x', keys: [[0, -0.2], [0.35, -2.9], [1.0, -2.9], [1.4, -0.2]] }, { path: 'torso.position.y', keys: [[0, 0.86], [0.35, 0.92], [0.5, 0.86], [0.7, 0.92], [0.9, 0.86]] }] },
    point: { duration: 1.2, loop: false, tracks: [{ path: 'arm.1.rotation.x', keys: [[0, -0.2], [0.3, -1.5], [1.0, -1.5], [1.2, -0.2]] }, { path: 'elbow.1.rotation.x', keys: [[0, -0.15], [0.3, -0.05], [1.0, -0.05], [1.2, -0.15]] }, { path: 'head.rotation.y', keys: [[0, 0], [0.3, -0.3], [1.0, -0.3], [1.2, 0]] }] },
    lift: { duration: 1.6, loop: false, tracks: [{ path: 'torso.position.y', keys: [[0, 0.86], [0.5, 0.62], [1.1, 0.62], [1.6, 0.86]] }, { path: 'knee.0.rotation.x', keys: [[0, 0], [0.5, 1.2], [1.1, 1.2], [1.6, 0]] }, { path: 'knee.1.rotation.x', keys: [[0, 0], [0.5, 1.2], [1.1, 1.2], [1.6, 0]] }, { path: 'leg.0.rotation.x', keys: [[0, 0], [0.5, -1.0], [1.1, -1.0], [1.6, 0]] }, { path: 'leg.1.rotation.x', keys: [[0, 0], [0.5, -1.0], [1.1, -1.0], [1.6, 0]] }, { path: 'arm.0.rotation.x', keys: [[0, -0.2], [0.5, -0.9], [1.1, -0.9], [1.6, -0.2]] }, { path: 'arm.1.rotation.x', keys: [[0, -0.2], [0.5, -0.9], [1.1, -0.9], [1.6, -0.2]] }], events: [[1.1, 'lifted']] },
    spin: { duration: 2, loop: true, tracks: [{ path: 'rotation.y', keys: [[0, 0, 'linear'], [2, 6.2832, 'linear']] }] },
    bob: { duration: 1.5, loop: true, tracks: [{ path: 'position.y', keys: [[0, 0], [0.75, 0.25], [1.5, 0]] }] },
    swing: { duration: 2.4, loop: true, tracks: [{ path: 'rotation.z', keys: [[0, -0.35], [1.2, 0.35], [2.4, -0.35]] }] },
    blink: { duration: 0.8, loop: true, tracks: [{ path: 'visible', keys: [[0, 1, 'step'], [0.4, 0, 'step'], [0.8, 1, 'step']] }] }
  };
  Object.keys(BUILTIN_CLIPS).forEach(function (n) { CO.clip(n, BUILTIN_CLIPS[n]); });
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
    glass:   function (t) { for (var i = 0; i < 8; i++) sTone('sine', 2400 + Math.random() * 2400, t + i * 0.03, 0.08, 0.03); sNoise(t, 0.2, 0.1, { freq: 5000, fade: true }); },
    thunder: function (t) { sNoise(t, 2.6, 0.5, { type: 'lowpass', freq: 220, shape: 'swell', fade: true }); sTone('sine', 45, t + 0.1, 2.0, 0.12, { f1: 28 }); sNoise(t + 0.6, 1.4, 0.2, { type: 'lowpass', freq: 400, fade: true }); }
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
    var named = /[?&]save=([A-Za-z0-9_-]+)/.exec(location.search);   // ?save=<name>: a save of its own beside the slots, for development and for a reporter's file
    SAVE = named ? prefix + '-' + named[1] : prefix + '-slot' + BOOT_SLOT; SETTINGS_KEY = cfg.settingsKey || prefix + '-settings';
    BOOT_SAVE = (function () { try { var raw = localStorage.getItem(SAVE), s = raw ? JSON.parse(raw) : null; return s && typeof s === 'object' ? s : null; } catch (e) { return null; } })();
    SET = {}; for (var k in SET_DEFAULTS) SET[k] = SET_DEFAULTS[k]; if (cfg.settings) for (var k2 in cfg.settings) SET[k2] = cfg.settings[k2];
    menusSettingDefaults();   // part 46: the menu maker's own settings, so the saved values of them load too
    loadSettings();
    CO.save = { prefix: prefix, key: SAVE, slot: BOOT_SLOT, named: named ? named[1] : null };
  }
  function setSlot(n) { try { localStorage.setItem(CO.save.prefix + '-slot', String(n)); } catch (e) {} }
  // ── Load and save ─────────────────────────────────────────────────
  // loadSave(fresh, migrate): S becomes the slot's save, with every top-level key the fresh state has and the save lacks filled in,
  // then the game's migrate(s, fresh, missing) run on it (missing[key] is true for each key that was filled in, so a migration can
  // tell an old save from a new field); or the fresh state when there is no save or it will not parse (the broken copy is kept
  // beside the slot). Returns true when a save was loaded.
  function loadSave(fresh, migrate) {
    var f = fresh(); S = f;
    try {
      var raw = localStorage.getItem(SAVE); if (!raw) return false;
      var s = JSON.parse(raw); if (!s || typeof s !== 'object') return false;
      var missing = {}; for (var k in f) if (!(k in s)) { s[k] = f[k]; missing[k] = true; }
      if (migrate) { var m = migrate(s, f, missing); if (m && typeof m === 'object') s = m; }
      S = s; return true;
    } catch (e) {
      try { if (typeof console !== 'undefined') console.error('co-engine: the save in ' + SAVE + ' could not be loaded', e); var brokenRaw = localStorage.getItem(SAVE); if (brokenRaw) localStorage.setItem(SAVE + '-broken', brokenRaw); } catch (e2) {}
      S = fresh(); return false;
    }
  }
  // save() writes the slot, or with cfg.saveDebounce (ms) schedules one write for a burst of calls; saveNow() writes at once (the unload)
  var saveT = 0, wiped = false, saveTimer = null;
  function writeSave() {
    if (wiped || !S) return;
    try { S.savedAt = now(); localStorage.setItem(SAVE, JSON.stringify(S)); saveT = now(); save.failed = false; }
    catch (e) { if (!save.failed) { save.failed = true; toast('The save could not be written: the browser refused the storage. Export it from the pause menu.', 'bad'); if (typeof console !== 'undefined') console.error('co-engine: save failed', e); } }   // said once, not at every autosave
  }
  function save() { var ms = CO.cfg && CO.cfg.saveDebounce; if (!ms) { writeSave(); return; } if (saveTimer) return; saveTimer = setTimeout(function () { saveTimer = null; writeSave(); }, ms); }
  function saveNow() { if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; } writeSave(); }
  function wipe() { wiped = true; try { localStorage.removeItem(SAVE); } catch (e) {} }
  function exportSave() { return JSON.stringify(S); }
  // ── The ledger ────────────────────────────────────────────────────
  function pay(n, why) { S.bank = (S.bank || 0) + n; if (S.stats) { if (n >= 0) S.stats.earned = (S.stats.earned || 0) + n; else S.stats.spent = (S.stats.spent || 0) + -n; } if (S.ledger) { S.ledger.unshift({ day: S.day, t: fmtTime(S.time || 0), n: n, why: why }); if (S.ledger.length > 80) S.ledger.pop(); } hudDirty = true; }
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
  function openPanel(kind, tab) {
    panel.kind = kind; panel.tab = tab || null; ui.panelOpen = true; var el = $('dc-panel'); if (el) el.hidden = false; if (ui.scanOpen && CO.game && CO.game.scanToggle) CO.game.scanToggle(false);
    ui.suppressMenu = true; try { document.exitPointerLock(); } catch (e) {}
    renderPanel(); sfx('click');
  }
  function closePanel() { if (!ui.panelOpen) return; ui.panelOpen = false; var el = $('dc-panel'); if (el) el.hidden = true; panel.kind = null; hudDirty = true; lockPointer(); }
  function renderPanel() {
    if (!ui.panelOpen) return;
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
    var pn = $('dc-panel'); if (pn) pn.addEventListener('click', function (e) { var tb = e.target.closest('[data-tab]'); if (tb) { panel.tab = tb.getAttribute('data-tab'); renderPanel(); sfx('click'); return; } var b = e.target.closest('[data-act]'); if (!b || b.disabled) return; panelAct(b.getAttribute('data-act'), b.getAttribute('data-arg')); });
    var mn = $('dc-menu'); if (mn) mn.addEventListener('click', function (e) { var b = e.target.closest('[data-menu]'); if (!b) return; menuAct(b.getAttribute('data-menu'), b); });
    var mb = $('dc-menu-body'); if (mb) mb.addEventListener('input', function (e) { settingInput(e.target); });
  }
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
    var f = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), r = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0), u = (k.Space ? 1 : 0) - (k.KeyC || (k.ControlLeft && !(CO.editor && CO.editor.on)) ? 1 : 0);   /* in the editor Ctrl selects and drags; C flies down */
    photo.x += (fx * f + rx * r) * sp; photo.y = clamp(photo.y + (fy * f + u) * sp, -1.0, 70); photo.z += (fz * f + rz * r) * sp;
    camera.position.set(photo.x, photo.y, photo.z); camera.rotation.set(photo.pitch, photo.yaw, 0, 'YXZ');
  }
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
  // ── UI as data ────────────────────────────────────────────────────
  // hud: [{ label, value, color }]           chips in a row of their own under the engine's (value is an expression: 'S.day', 'money(S.bank)')
  // panels: { kind: { title, text, buttons: [{ label, action, primary }] } }   openPanel(kind) shows it; text is paragraphs and '- ' lists; an action is a dev command ('cash 500') or an expression
  // start: ['expression', ...]               the start screen's chips    menuLine: 'expression'    guide: 'text'
  var UI = { hud: [], panels: {}, start: [], menuLine: '', guide: '' }, uiFns = {};
  CO.ui = function (data) { if (!data) return UI; if (data.hud) UI.hud = data.hud.slice(); if (data.panels) { UI.panels = {}; for (var k in data.panels) UI.panels[k] = data.panels[k]; } if (data.start) UI.start = data.start.slice(); if (data.menuLine !== undefined) UI.menuLine = data.menuLine; if (data.guide !== undefined) UI.guide = data.guide; uiFns = {}; hudDirty = true; uiHudBuild(); return UI; };
  function uiEval(expr) {
    if (expr === undefined || expr === null || expr === '') return '';
    var fn = uiFns[expr]; if (!fn) { try { fn = uiFns[expr] = new Function('K', 'with (K) { return (' + expr + '\n); }'); } catch (e) { return '?'; } }
    try { var v = fn(editorKit()); return v === undefined || v === null ? '' : String(v); } catch (e2) { return '?'; }
  }
  function uiAction(action) {
    if (!action) return false; var sp = String(action).indexOf(' '), name = sp < 0 ? action : action.slice(0, sp), arg = sp < 0 ? undefined : action.slice(sp + 1).trim();
    if (devCommandList().indexOf(name) >= 0) { if (arg !== undefined && arg !== '' && !isNaN(arg)) arg = +arg; var r = devCommand(name, arg); hudDirty = true; return r; }   /* the engine's dev commands and the game's */
    try { new Function('K', 'with (K) { ' + action + '\n }')(editorKit()); hudDirty = true; save(); return true; } catch (e) { toast('The button failed: ' + e.message, 'bad'); return false; }
  }
  // the HUD chips: a row of their own under the engine's top row, made once and filled on every HUD refresh
  function uiHudBuild() {
    var hud = $('dc-hud'); if (!hud) return null; var row = $('h-ui');
    if (!row) { row = document.createElement('div'); row.id = 'h-ui'; row.style.cssText = 'position:absolute;top:52px;left:12px;display:flex;gap:8px;flex-wrap:wrap;max-width:60vw;pointer-events:none;font:13px/1.3 inherit'; hud.appendChild(row); }
    row.innerHTML = UI.hud.map(function (f, i) { return '<span data-ui="' + i + '" style="background:rgba(5,8,12,0.6);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:5px 10px' + (f.color ? ';color:' + f.color : '') + '"><span style="opacity:.6;font-size:11px;letter-spacing:.06em;text-transform:uppercase;margin-right:6px">' + esc(f.label || '') + '</span><b></b></span>'; }).join('');
    return row;
  }
  function uiHudFill() { if (!UI.hud.length) return; var row = $('h-ui') || uiHudBuild(); if (!row) return; var bs = row.querySelectorAll('b'); UI.hud.forEach(function (f, i) { if (bs[i]) bs[i].textContent = uiEval(f.value); }); }
  function uiTextHtml(text) { return String(text || '').split(/\n\s*\n/).map(function (para) { var lines = para.split('\n'); if (lines.every(function (l) { return /^\s*-\s/.test(l); })) return '<ul>' + lines.map(function (l) { return '<li>' + esc(l.replace(/^\s*-\s/, '')) + '</li>'; }).join('') + '</ul>'; return '<p>' + esc(para).replace(/\n/g, '<br>') + '</p>'; }).join(''); }
  function uiPanelSpec(kind) { var p = UI.panels[kind]; if (!p) return null; return { title: uiEval(p.titleExpr) || p.title || kind, tabs: [], body: '<div class="dc-how">' + uiTextHtml(p.text) + '</div>' + (p.buttons && p.buttons.length ? '<div class="dc-menu-row" style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">' + p.buttons.map(function (b, i) { return '<button class="dc-btn ' + (b.primary ? 'primary' : '') + '" data-act="ui" data-arg="' + esc(kind + ':' + i) + '">' + esc(b.label || 'Button') + '</button>'; }).join('') + '</div>' : '') }; }
  function uiPanelAct(arg) { var at = String(arg || '').lastIndexOf(':'), kind = arg.slice(0, at), i = +arg.slice(at + 1), p = UI.panels[kind], b = p && p.buttons && p.buttons[i]; if (!b) return false; var r = uiAction(b.action); if (b.close) closePanel(); else renderPanel(); if (typeof r === 'string') toast(r, ''); return true; }
  function uiStartChips() { return UI.start.map(uiEval).filter(Boolean); }
  function uiData() { return JSON.parse(JSON.stringify(UI)); }
  function uiCode() {
    var empty = !UI.hud.length && !Object.keys(UI.panels).length && !UI.start.length && !UI.menuLine && !UI.guide; if (empty) return '';
    return '//@ the UI the editor saved: HUD chips, panels, the start screen chips, the pause line and the guide, as data over the kit. Written by the Co Engine editor; it sorts first in src/. Edit it in the editor rather than here.\n  CO.ui(' + JSON.stringify(UI, null, 2).replace(/\n/g, '\n  ') + ');\n';
  }
  // ── Tuning tables ─────────────────────────────────────────────────
  var TABLES = {}, TABLE_ORDER = [], TUNE = {};
  function pathGet(o, p) { var k = String(p).split('.'); for (var i = 0; i < k.length; i++) { if (o == null) return undefined; o = o[k[i]]; } return o; }
  function pathSet(o, p, v) { var k = String(p).split('.'); for (var i = 0; i < k.length - 1; i++) { if (o[k[i]] == null) return false; o = o[k[i]]; } o[k[k.length - 1]] = v; return true; }
  // the leaves of a table worth editing: numbers, strings and booleans, by path, at most 400 of them
  function tableLeaves(obj) { var out = []; (function walk(o, pre, depth) { if (out.length >= 400 || depth > 5) return; Object.keys(o).forEach(function (k) { var v = o[k], p = pre ? pre + '.' + k : k; if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') out.push({ path: p, value: v, type: typeof v }); else if (v && typeof v === 'object' && !v.isObject3D && !v.isMaterial && typeof v !== 'function') walk(v, p, depth + 1); }); })(obj, '', 0); return out; }
  CO.table = function (name, obj, desc) {
    if (!name) return TABLES; if (!obj || typeof obj !== 'object') return obj;
    if (!TABLES[name]) TABLE_ORDER.push(name);
    var defaults = {}; tableLeaves(obj).forEach(function (l) { defaults[l.path] = l.value; });
    TABLES[name] = { obj: obj, desc: desc || '', defaults: defaults };
    var t = TUNE[name]; if (t) for (var p in t) pathSet(obj, p, t[p]);
    return obj;
  };
  CO.tune = function (overrides) { for (var n in overrides) { TUNE[n] = TUNE[n] || {}; for (var p in overrides[n]) { TUNE[n][p] = overrides[n][p]; if (TABLES[n]) pathSet(TABLES[n].obj, p, overrides[n][p]); } } return TUNE; };
  function tablesList() { return TABLE_ORDER.map(function (n) { var T = TABLES[n]; return { name: n, desc: T.desc, fields: tableLeaves(T.obj).map(function (l) { return { path: l.path, value: l.value, type: l.type, changed: T.defaults[l.path] !== undefined && T.defaults[l.path] !== l.value, was: T.defaults[l.path] }; }) }; }); }
  function tableSet(name, path, value) {
    var T = TABLES[name]; if (!T) return { error: 'no table ' + name }; var was = pathGet(T.obj, path); if (was === undefined) return { error: 'no field ' + path + ' in ' + name };
    var v = typeof was === 'number' ? +value : typeof was === 'boolean' ? (value === true || value === 'true') : String(value); if (typeof was === 'number' && isNaN(v)) return { error: 'a number, please' };
    pathSet(T.obj, path, v); TUNE[name] = TUNE[name] || {}; if (T.defaults[path] === v) delete TUNE[name][path]; else TUNE[name][path] = v;
    hudDirty = true; screenDirtyAll();
    histPush(name + '.' + path, function () { pathSet(T.obj, path, was); if (T.defaults[path] === was) delete TUNE[name][path]; else TUNE[name][path] = was; hudDirty = true; screenDirtyAll(); }, function () { pathSet(T.obj, path, v); if (T.defaults[path] === v) delete TUNE[name][path]; else TUNE[name][path] = v; hudDirty = true; screenDirtyAll(); });
    return { ok: true, value: v };
  }
  function tablesCode() {
    var out = {}, any = false; for (var n in TUNE) { var keys = Object.keys(TUNE[n]); if (keys.length) { out[n] = TUNE[n]; any = true; } }
    if (!any) return '';
    return '//@ the tuning the editor saved: changes to the game\'s tables (prices, the economy, the ladder) over what the code says. Written by the Co Engine editor\'s Settings tab; it sorts first in src/ and applies as each table registers.\n  CO.tune(' + JSON.stringify(out, null, 2).replace(/\n/g, '\n  ') + ');\n';
  }
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
  // ── NPCs as data ──────────────────────────────────────────────────
  // characters: { id: { names: ['Sam', 'Alex'], look: { shirt, pants, skin, hair, style }, speed, car, steps: [...] } }
  // spawners:   [{ id, character, x, z, every, max, hours: [from, to], park: [x, z], on }]    car: arrives at x, z and parks at park
  // workers:    [{ id, character, x, z, ry, home: [x, z], hours: [from, to] }]                  stands at x, z through the hours
  // spots:      { name: { x, z, ry } }                                                         places the steps go to
  // A step is { do, ... }:
  //   walk { to }        to a spot's name, 'x, z', 'player', 'home' (where it came from), 'car' or 'post' (a worker's place)
  //   say { text, wait } a speech bubble ({name} is the NPC's name); wait is how long it stands for it (it reads its length)
  //   wait { seconds }   wander { radius, seconds }   face { to }   mood { mood: happy, sad, angry, talk, neutral }
  //   talk { prompt, text, choices: [{ label, say, run, then }] }   waits for the player to press E on it, then offers the
  //                      choices in a panel; then is next (the default), stay, leave, repeat or 'step 3'
  //   until { test, every }   waits for an expression over the kit to come true (npc is the NPC: npc.data, npc.name)
  //   run { code }       a dev command (cash 50) or code over the kit, with npc
  //   event { name }     tells the game: runHooks('npc', name, npc) and GAME.npcEvent(name, npc)
  //   leave              back to the car or the way it came, and gone        repeat   from the first step again   goto { step }
  // A worker runs its character's steps over and over while its hours last, then goes home. An NPC is not saved: spawners and
  // workers make them again from the data when the game loads.
  var NPCS = { characters: {}, spawners: [], workers: [], spots: {} }, npcList = [], npcSeq = 0, npcTimers = {};
  var NPC_COLS = { shirt: 0x3f6a9e, pants: 0x2f3440 };
  CO.npcs = function (data) {
    if (data === undefined) return npcData();
    data = JSON.parse(JSON.stringify(data || {}));
    NPCS = { characters: data.characters || {}, spawners: data.spawners || [], workers: data.workers || [], spots: data.spots || {} };
    npcClear(); npcTimers = {}; return npcData();
  };
  function npcData() { return JSON.parse(JSON.stringify(NPCS)); }
  function npcCode() {
    if (!Object.keys(NPCS.characters).length && !NPCS.spawners.length && !NPCS.workers.length && !Object.keys(NPCS.spots).length) return '';
    return '//@ the NPCs the editor saved: characters and what they do, their spawners, the workers and the spots they go to, as data. Written by the Co Engine editor; it sorts first in src/. Edit it in the editor rather than here.\n  CO.npcs(' + JSON.stringify(NPCS, null, 2).replace(/\n/g, '\n  ') + ');\n';
  }
  function npcClear() { npcList.slice().forEach(function (n) { npcRemove(n); }); npcList = []; }
  function npcHex(v, d) { if (typeof v === 'number') return v; var m = /^#?([0-9a-f]{6})$/i.exec(String(v || '')); return m ? parseInt(m[1], 16) : d; }
  function npcHour() { return S && typeof S.time === 'number' ? S.time : null; }
  function npcInHours(h) { if (!h || h.length !== 2) return true; var t = npcHour(); if (t === null) return true; return h[0] <= h[1] ? t >= h[0] && t < h[1] : t >= h[0] || t < h[1]; }
  function npcPoint(n, to) {
    to = String(to === undefined ? '' : to).trim();
    if (to === 'player' && player) return { x: player.x, z: player.z };
    if (to === 'home') return { x: n.home.x, z: n.home.z };
    if (to === 'post' && n.post) return { x: n.post.x, z: n.post.z, ry: n.post.ry };
    if (to === 'car' && n.car) return { x: n.carDoor.x, z: n.carDoor.z };
    var sp = NPCS.spots[to]; if (sp) return { x: +sp.x || 0, z: +sp.z || 0, ry: sp.ry };
    var m = /^(-?[\d.]+)\s*[, ]\s*(-?[\d.]+)$/.exec(to); if (m) return { x: +m[1], z: +m[2] };
    if (to.indexOf('prop:') === 0 && typeof propPlacement === 'function') { var pp = propPlacement(to.slice(5)); if (pp) { var w = propWorld(to.slice(5), 0, 1.2); return { x: w.x, z: w.z }; } }
    return null;
  }
  function npcSay(n, text) { var t = String(text || '').replace(/\{name\}/g, n.name); say(n.g, t); runHooks('npcSay', n.pub, t); return t; }
  function npcRun(n, code) {
    code = String(code || '').trim(); if (!code) return;
    var sp = code.indexOf(' '), name = sp < 0 ? code : code.slice(0, sp), arg = sp < 0 ? undefined : code.slice(sp + 1).trim();
    if (devCommandList().indexOf(name) >= 0) { if (arg !== undefined && arg !== '' && !isNaN(arg)) arg = +arg; var r = devCommand(name, arg); hudDirty = true; return r; }
    try { new Function('K', 'npc', 'with (K) { ' + code + '\n }')(editorKit(), n.pub); hudDirty = true; } catch (e) { toast(n.name + ': ' + e.message, 'bad'); }
  }
  function npcTest(n, expr) { try { return !!new Function('K', 'npc', 'with (K) { return (' + expr + '\n); }')(editorKit(), n.pub); } catch (e) { return false; } }
  // a person in the world with its own record: where it is, the step it is on, what it waits for
  function npcMake(charId, at, opt) {
    var ch = NPCS.characters[charId]; if (!ch) return null; opt = opt || {};
    var look = ch.look || {}, names = (ch.names && ch.names.length ? ch.names : [charId]), name = opt.name || names[Math.floor(Math.random() * names.length)];
    var hopt = { key: charId + ':' + name + ':' + (++npcSeq) };
    if (look.skin) hopt.skin = npcHex(look.skin); if (look.hair) hopt.hair = npcHex(look.hair); if (look.style) hopt.style = look.style;
    if (look.shirt) hopt.shirt = std({ map: TEX.cloth, color: npcHex(look.shirt, NPC_COLS.shirt), roughness: 0.92 }); if (look.pants) hopt.pants = std({ map: TEX.cloth, color: npcHex(look.pants, NPC_COLS.pants), roughness: 0.95 });
    var g = makeHuman(hopt); g.userData.dynamic = true; g.userData.npc = true; scene.add(g);
    var n = { id: 'npc' + npcSeq, ch: ch, charId: charId, name: name, g: g, x: at.x, z: at.z, yaw: at.ry || 0, path: null, speed: ch.speed || 1.4, step: 0, t: 0, state: 'start', talkOpen: false, home: { x: at.x, z: at.z }, data: {}, spawner: opt.spawner || null, worker: opt.worker || null, post: opt.post || null, car: null, carDoor: null, gone: false };
    n.pub = { id: n.id, name: name, character: charId, data: n.data, get x() { return n.x; }, get z() { return n.z; }, get step() { return n.step; }, say: function (t) { return npcSay(n, t); }, leave: function () { npcLeave(n); }, go: function (i) { npcGoto(n, i); }, next: function () { npcNext(n); } };
    n.hit = hitBox(0.8, 1.9, 0.8, 0, 0.95, 0, { prompt: function () { var st = npcStepNow(n); return st && st.do === 'talk' && n.state === 'talk' ? String(st.prompt || 'Talk to {name}').replace(/\{name\}/g, n.name) : ''; }, use: function () { npcTalk(n); } }, g);
    npcList.push(n); npcPlace(n); runHooks('npcSpawn', n.pub); return n;
  }
  function npcPlace(n) { n.g.position.set(n.x, floorY(n.x, n.z), n.z); n.g.rotation.y = n.yaw; }
  function npcRemove(n) {
    n.gone = true; if (n.talkOpen && ui.panelOpen && panel.kind === 'npc') closePanel();
    var k = inter.indexOf(n.hit); if (k >= 0) inter.splice(k, 1); scene.remove(n.g);
    if (n.car) { scene.remove(n.car.g); var tk = traffic.cars.indexOf(n.car.rec); if (tk >= 0) traffic.cars.splice(tk, 1); }
    var i = npcList.indexOf(n); if (i >= 0) npcList.splice(i, 1); runHooks('npcGone', n.pub);
  }
  function npcStepNow(n) { var steps = n.ch.steps || []; return steps[n.step] || null; }
  function npcNext(n) { n.step++; n.state = 'start'; n.t = 0; n.path = null; }
  function npcGoto(n, i) { n.step = Math.max(0, i | 0); n.state = 'start'; n.t = 0; n.path = null; }
  function npcLeave(n) { n.leaving = true; n.state = 'start'; n.path = null; n.t = 0; }
  // the route finder where its grid covers both ends; outside it a straight walk; either way the walk ends on the point itself
  function npcOnGrid(q) { if (NAV.dirty || !NAV.grid) navBuild(); return !!NAV.grid && q.x >= NAV.x0 && q.z >= NAV.z0 && q.x < NAV.x0 + NAV.w * NAV.cell && q.z < NAV.z0 + NAV.h * NAV.cell; }
  function npcWalkTo(n, p) { var path = npcOnGrid(n) && npcOnGrid(p) ? route({ x: n.x, z: n.z }, { x: p.x, z: p.z }) : null; if (!path || !path.length) path = [{ x: p.x, z: p.z }]; else { var last = path[path.length - 1]; if (Math.hypot(last.x - p.x, last.z - p.z) > 0.5) path.push({ x: p.x, z: p.z }); } n.path = path; n.faceTo = p.ry; }
  // the player pressed E on an NPC at a talk step: its words and the choices, in a panel
  function npcTalk(n) { var st = npcStepNow(n); if (!st || st.do !== 'talk') return; n.talkOpen = true; NPC_PANEL.n = n; n.yaw = Math.atan2(player.x - n.x, player.z - n.z); setMood(n.g, 'talk'); openPanel('npc'); }
  var NPC_PANEL = { n: null };
  function npcPanelSpec() {
    var n = NPC_PANEL.n, st = n && npcStepNow(n); if (!n || !st) return { title: '', tabs: [], body: '' };
    var choices = st.choices && st.choices.length ? st.choices : [{ label: 'OK' }];
    return { title: n.name, tabs: [], body: '<div class="dc-how">' + uiTextHtml(String(st.text || '').replace(/\{name\}/g, n.name)) + '</div><div class="dc-menu-row" style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">' + choices.map(function (c, i) { return '<button class="dc-btn' + (i === 0 ? ' primary' : '') + '" data-act="npc" data-arg="' + i + '">' + esc(c.label || 'OK') + '</button>'; }).join('') + '</div>' };
  }
  function npcChoice(i) {
    var n = NPC_PANEL.n, st = n && npcStepNow(n); if (!n || !st) { closePanel(); return true; }
    var c = (st.choices && st.choices[+i]) || {}; n.talkOpen = false; NPC_PANEL.n = null; closePanel();
    if (c.say) npcSay(n, c.say); if (c.run) npcRun(n, c.run);
    runHooks('npc', 'choice', n.pub, c.label); if (CO.game && CO.game.npcEvent) CO.game.npcEvent('choice', n.pub, c.label);
    var then = String(c.then || 'next').trim();
    if (then === 'stay') n.state = 'talk'; else if (then === 'leave') npcLeave(n); else if (then === 'repeat') npcGoto(n, 0); else if (/^step\s+\d+$/.test(then)) npcGoto(n, +then.slice(5) - 1); else npcNext(n);
    return true;
  }
  // one NPC, one frame: its car, its walk, the step it is on
  function npcTick(n, dt) {
    if (n.car && n.car.moving) { npcCarTick(n, dt); return; }
    var moving = false;
    if (n.path && n.path.length) { var done = walkAlong(n, n.path, n.speed, dt); moving = !done; if (done) { n.path = null; if (typeof n.faceTo === 'number') n.yaw = n.faceTo; } }
    npcPlace(n); animateHuman(n.g, dt, moving ? 'walk' : 'idle', n.speed);
    if (moving) return;
    if (n.leaving) { npcLeaveTick(n, dt); return; }
    var st = npcStepNow(n);
    if (!st) { if (n.worker) { npcGoto(n, 0); return; } npcLeave(n); return; }
    if (n.worker && !npcInHours(n.worker.hours) && st.do !== 'talk') { npcLeave(n); return; }
    var first = n.state === 'start'; if (first) { n.state = 'run'; n.t = 0; } n.t += dt;
    switch (st.do) {
      case 'walk': if (first) { var p = npcPoint(n, st.to); if (p) npcWalkTo(n, p); else npcNext(n); } else npcNext(n); break;
      case 'say': if (first) { var t = npcSay(n, st.text); n.wait = st.wait !== undefined ? +st.wait : 1.2 + t.length * 0.05; } else if (n.t >= n.wait) npcNext(n); break;
      case 'wait': if (n.t >= (+st.seconds || 1)) npcNext(n); break;
      case 'wander': if (first) { n.wanderAt = { x: n.x, z: n.z }; n.wanderT = 0; } if (n.t >= (+st.seconds || 10)) { npcNext(n); break; } n.wanderT -= dt; if (n.wanderT <= 0) { var r = +st.radius || 3, a = Math.random() * Math.PI * 2, d = Math.random() * r; npcWalkTo(n, { x: n.wanderAt.x + Math.cos(a) * d, z: n.wanderAt.z + Math.sin(a) * d }); n.wanderT = randf(2, 5); } break;
      case 'face': var fp = npcPoint(n, st.to); if (fp) n.yaw = Math.atan2(fp.x - n.x, fp.z - n.z); else if (typeof st.ry === 'number') n.yaw = st.ry; npcNext(n); break;
      case 'mood': setMood(n.g, st.mood || 'neutral'); npcNext(n); break;
      case 'talk': if (first) n.state = 'talk'; else n.state = 'talk'; break;
      case 'until': if (!n.untilT || n.untilT <= 0) { n.untilT = +st.every || 0.5; if (npcTest(n, st.test || 'true')) npcNext(n); } else n.untilT -= dt; break;
      case 'run': npcRun(n, st.code); npcNext(n); break;
      case 'event': runHooks('npc', st.name || 'event', n.pub); if (CO.game && CO.game.npcEvent) CO.game.npcEvent(st.name || 'event', n.pub); npcNext(n); break;
      case 'leave': npcLeave(n); break;
      case 'repeat': npcGoto(n, 0); break;
      case 'goto': npcGoto(n, (+st.step || 1) - 1); break;
      default: npcNext(n);
    }
  }
  // leaving: walk back to the car and drive off, or walk back the way it came, and go
  function npcLeaveTick(n, dt) {
    if (n.state === 'start') { n.state = 'walking'; var p = n.car ? n.carDoor : n.home; npcWalkTo(n, p); return; }
    if (n.car) { n.g.visible = false; n.car.moving = true; n.car.back = true; n.car.i = n.car.path.length - 1; return; }
    npcRemove(n);
  }
  // a car that brings its NPC: from the spawner along to its parking place, then the NPC gets out; leaving reverses it
  function npcCarStart(n, sp) {
    var path = [{ x: +sp.x, z: +sp.z }].concat((sp.via || []).map(function (q) { return { x: +q[0], z: +q[1] }; })).concat([{ x: +sp.park[0], z: +sp.park[1] }]);
    var g = carMesh(); g.userData.dynamic = true; scene.add(g); var rec = { g: g, npc: true, road: true, dir: 1, z: 0, v: 0 }; traffic.cars.push(rec);
    var c = { g: g, rec: rec, path: path, i: 0, x: path[0].x, z: path[0].z, yaw: 0, v: 0, moving: true, back: false };
    var a = path[path.length - 2] || path[0], b = path[path.length - 1], yaw = Math.atan2(-(b.z - a.z), b.x - a.x);
    n.car = c; n.carDoor = { x: b.x - Math.sin(yaw) * 1.6, z: b.z - Math.cos(yaw) * 1.6 };   // the driver's side: to the left of the way the car faces
    n.g.visible = false; npcCarPlace(c);
  }
  function npcCarPlace(c) { c.g.position.set(c.x, floorY(c.x, c.z), c.z); c.g.rotation.y = c.yaw; }
  function npcCarTick(n, dt) {
    var c = n.car, tgt = c.back ? c.path[c.i - 1] : c.path[c.i + 1];
    if (!tgt) { c.moving = false; if (c.back) { npcRemove(n); return; } n.x = n.carDoor.x; n.z = n.carDoor.z; n.g.visible = true; npcPlace(n); return; }
    var dx = tgt.x - c.x, dz = tgt.z - c.z, d = Math.hypot(dx, dz), last = c.back ? c.i - 1 === 0 : c.i + 1 === c.path.length - 1, want = last && !c.back ? Math.min(7, Math.max(1.2, d * 0.9)) : 7;
    c.v += clamp(want - c.v, -6 * dt, 3 * dt); var step = c.v * dt;
    var yaw = Math.atan2(-dz, dx); c.yaw = c.yaw + Math.atan2(Math.sin(yaw - c.yaw), Math.cos(yaw - c.yaw)) * Math.min(1, dt * 4);   // leaving, it turns round as it pulls away
    if (d <= step) { c.x = tgt.x; c.z = tgt.z; c.i += c.back ? -1 : 1; } else { c.x += dx / d * step; c.z += dz / d * step; }
    npcCarPlace(c); var ws = c.g.userData.wheels; if (ws) ws.forEach(function (w) { w.rotation.z -= c.v * dt / 0.33; });
  }
  function npcSpawn(sp) {
    var at = { x: +sp.x || 0, z: +sp.z || 0, ry: sp.ry || 0 }, ch = NPCS.characters[sp.character]; if (!ch) return null;
    var n = npcMake(sp.character, at, { spawner: sp }); if (!n) return null;
    if (ch.car && sp.park) npcCarStart(n, sp);
    return n;
  }
  function npcWorkerStart(w) {
    var home = w.home ? { x: +w.home[0], z: +w.home[1] } : { x: +w.x, z: +w.z }, inside = !w.hours;
    var n = npcMake(w.character, inside ? { x: +w.x, z: +w.z, ry: w.ry || 0 } : { x: home.x, z: home.z }, { worker: w, post: { x: +w.x, z: +w.z, ry: w.ry || 0 }, name: w.name });
    if (!n) return null; n.home = home; if (!inside) npcWalkTo(n, n.post); return n;
  }
  // the frame: spawners make NPCs on their clock and inside their hours, workers come and go with theirs, every NPC steps
  function npcsTick(dt) {
    if (!ui.started) return;
    NPCS.spawners.forEach(function (sp, i) {
      if (sp.on === false) return; var key = sp.id || 'sp' + i, mine = npcList.filter(function (n) { return n.spawner === sp; }).length;
      if (!npcInHours(sp.hours) || mine >= (sp.max === undefined ? 1 : +sp.max)) return;
      npcTimers[key] = (npcTimers[key] === undefined ? Math.min(3, +sp.every || 30) : npcTimers[key]) - dt;
      if (npcTimers[key] <= 0) { npcTimers[key] = Math.max(1, +sp.every || 30); npcSpawn(sp); }
    });
    NPCS.workers.forEach(function (w) { var have = npcList.some(function (n) { return n.worker === w; }); if (!have && npcInHours(w.hours) && !w.off) npcWorkerStart(w); });
    npcList.slice().forEach(function (n) { if (!n.gone) npcTick(n, dt); });
  }
  // the editor's way to look: one NPC now from a spawner, a character at a point, or what each NPC is doing
  function npcSpawnNow(ref) {
    if (typeof ref === 'string' && /^\d+$/.test(ref)) ref = +ref;
    var sp = typeof ref === 'number' ? NPCS.spawners[ref] : NPCS.spawners.filter(function (s) { return s.id === ref; })[0];
    if (sp) { var n = npcSpawn(sp); return n ? n.pub.id : null; }
    if (NPCS.characters[ref]) { var a = aheadPoint(4); var m = npcMake(ref, { x: a.x, z: a.z }); return m ? m.pub.id : null; }
    return null;
  }
  function npcInfo() { return npcList.map(function (n) { var st = npcStepNow(n); return { id: n.id, name: n.name, character: n.charId, x: Math.round(n.x * 10) / 10, z: Math.round(n.z * 10) / 10, step: n.step + 1, doing: n.leaving ? 'leave' : n.car && n.car.moving ? 'drive' : st ? st.do : 'done', state: n.state, worker: !!n.worker }; }); }
  function npcAim() { var a = aheadPoint(6); return { x: Math.round(a.x * 10) / 10, z: Math.round(a.z * 10) / 10, ry: Math.round(camera.rotation.y * 100) / 100 }; }
  // ── The dev link ──────────────────────────────────────────────────
  // The editor (and the dev console) run a local server on 127.0.0.1:8432. The game links to it with Ctrl+Shift+D, when started
  // with ?dev=1, or, in the desktop app, by itself: every five seconds while unlinked it asks the port once and links when
  // something answers. While linked it posts a readout once a second and takes commands over a server-sent event stream; every
  // command goes through devCommand, the same code the tests call. The HUD element h-devlink shows LINKED.
  var DEV_PORT = 8432, devLink = { on: false, es: null, t: 0, sent: 0, got: 0, fails: 0, last: '', manualOff: false, probeT: 0 };
  var DEV_AUTO = /Electron/i.test(navigator.userAgent);
  function devProbe() {
    try { var opt = { mode: 'cors', cache: 'no-store' }; if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) opt.signal = AbortSignal.timeout(800);
      fetch('http://127.0.0.1:' + DEV_PORT + '/state', opt).then(function (r) { if (r.ok && !devLink.on && !devLink.manualOff) devLinkToggle(); }).catch(function () {}); } catch (e) {}
  }
  // the readout: the engine's fields, then whatever the game adds in CO.game.devState()
  function devState() {
    var st = { version: CO.gameVersion || 'dev', engine: CO.version, day: S && S.day, time: S ? Math.round((S.time || 0) * 100) / 100 : 0, clock: fmtTime(S && S.time || 0), bank: S && S.bank, level: S && S.level, weather: S && S.weather ? S.weather.kind : 'clear', player: player ? { x: Math.round(player.x * 10) / 10, z: Math.round(player.z * 10) / 10 } : null, commands: devCommandList() };
    if (CO.game && CO.game.devState) { var extra = CO.game.devState(); for (var k in extra) st[k] = extra[k]; }
    return st;
  }
  // the commands: the engine's base set, and the game's in CO.game.commands as { name: function (arg) { return 'what happened'; } }
  var DEV_COMMANDS = {
    cash: function (n) { pay(typeof n === 'number' ? n : 1000, 'Dev console'); return 'bank ' + money(S.bank); },
    setTime: function (h) { if (typeof h === 'number') { S.time = ((h % 24) + 24) % 24; hudDirty = true; return 'time ' + fmtTime(S.time); } return 'setTime needs an hour'; },
    saveNow: function () { save(); return 'saved to ' + SAVE; },
    reload: function () { save(); setTimeout(function () { location.reload(); }, 200); return 'reloading'; },
    tp: function (arg) { if (!player) return 'no player'; var m = /^(-?[\d.]+)[ ,]+(-?[\d.]+)$/.exec(String(arg || '')); if (!m) return 'tp needs "x, z"'; player.x = +m[1]; player.z = +m[2]; player.y = floorY(player.x, player.z); return 'at ' + player.x + ', ' + player.z; },
    lanes: function (arg) { return roadDebug(arg === 'on' ? true : arg === 'off' ? false : undefined); },
    weather: function (kind) { if (!S.weather) S.weather = { wet: 0, snow: 0, wind: 0.4 }; S.weather.kind = kind || 'clear'; S.weather.until = nowAbs() + 6; return 'weather ' + S.weather.kind; }
  };
  function devCommandList() { var out = Object.keys(DEV_COMMANDS); if (CO.game && CO.game.commands) for (var k in CO.game.commands) if (out.indexOf(k) < 0) out.push(k); return out; }
  function devCommand(name, arg) {
    var fn = (CO.game && CO.game.commands && CO.game.commands[name]) || DEV_COMMANDS[name];
    if (!fn) return 'unknown command ' + name;
    try { var r = fn(arg); hudDirty = true; return r === undefined ? 'ok' : String(r); } catch (e) { return 'error: ' + (e && e.message || e); }
  }
  function devLinkBadge() { var b = $('h-devlink'); if (!b) return; b.hidden = !devLink.on; b.textContent = devLink.on ? (devLink.es && devLink.es.readyState === 1 ? 'LINKED · editor' : 'LINKING...') : ''; }
  function devLinkToggle() {
    if (devLink.on) { devLink.manualOff = true; devLinkStop('Editor unlinked. Ctrl+Shift+D links again.'); return; }
    devLink.manualOff = false;
    if (typeof EventSource === 'undefined') { toast('No EventSource in this browser: the editor cannot link.', 'bad'); return; }
    devLink.on = true; devLink.fails = 0;
    try { var es = new EventSource('http://127.0.0.1:' + DEV_PORT + '/events'); devLink.es = es;
      es.onopen = function () { devLink.fails = 0; devLinkBadge(); toast('Editor linked', 'good'); };
      es.onmessage = function (ev) { var cmd; try { cmd = JSON.parse(ev.data); } catch (e) { return; } if (!cmd || !cmd.name) return; devLink.got++; var res = devCommand(cmd.name, cmd.arg); devLink.last = cmd.name + ': ' + res; devPost('/result', { id: cmd.id, name: cmd.name, result: res }); };
      es.onerror = function () { devLink.fails++; devLinkBadge(); if (devLink.fails === 1) toast('Nothing answering on 127.0.0.1:' + DEV_PORT + '. Open the editor; the game keeps trying.', ''); if (devLink.fails > 30) devLinkStop('Editor link: gave up after 30 tries'); };
    } catch (e) { devLinkStop('Editor link: could not open'); return; }
    devLinkBadge(); logEvent('Editor link opened. Ctrl+Shift+D unlinks.');
  }
  function devLinkStop(why) { if (devLink.es) { try { devLink.es.close(); } catch (e) {} } devLink.es = null; devLink.on = false; devLinkBadge(); if (why) toast(why, ''); }
  function devPost(path, body) { try { fetch('http://127.0.0.1:' + DEV_PORT + path, { method: 'POST', mode: 'cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true }).then(function () { devLink.sent++; }).catch(function () {}); } catch (e) {} }
  function tickDevLink(dt) {
    if (!devLink.on) { if (!DEV_AUTO || devLink.manualOff || ui.testing) return; devLink.probeT += dt; if (devLink.probeT < 5) return; devLink.probeT = 0; devProbe(); return; }
    devLink.t += dt; if (devLink.t < 1) return; devLink.t = 0; if (devLink.es && devLink.es.readyState === 1) devPost('/state', devState());
  }
  // ── The editor bridge ─────────────────────────────────────────────
  // The editor shows the running game in its viewport and talks to it through this object (executeJavaScript into the page, or the
  // dev link). Everything here reads or writes the live scene and the save; nothing runs unless the editor asks. Objects are named
  // by id: a prop by its prop id, anything else by an editor id stamped on userData the first time it is listed.
  var EOBJ = {}, eidN = 0, editorSel = null, editorHelper = null, eRay = new THREE.Raycaster(), editorMulti = [], editorHelpers2 = [], groupDrag = null, pendingOff = null;   // editorSel is the last of editorMulti, the things selected together
  // a game that builds its props itself (Grow Co) names its builder in GAME.buildProp; the bridge rebuilds through it
  function rebuildProp(id) { return CO.game && CO.game.buildProp ? CO.game.buildProp(id) : buildProp(id); }
  function eid(o) { if (!o.userData.eid) o.userData.eid = 'e' + (++eidN); EOBJ[o.userData.eid] = o; return o.userData.eid; }
  function isPropRoot(o) { return !!(o.userData.propId && propInst[o.userData.propId] && propInst[o.userData.propId].g === o); }
  function eobj(id) {
    if (propInst[id]) return propInst[id].g;
    var o = EOBJ[id]; if (o && o.parent) return o;
    var found = null; scene.traverse(function (x) { if (!found && x.userData && x.userData.eid === id) found = x; }); if (found) EOBJ[id] = found; return found;
  }
  function matName(m) { if (!m) return ''; for (var k in MAT) if (MAT[k] === m) return k; return m.name || ''; }
  function eName(o) {
    if (isPropRoot(o)) return propLabel(o.userData.propId);
    if (o.name) return o.name;
    if (o.isDirectionalLight) return 'sun'; if (o.isHemisphereLight) return 'sky bounce'; if (o.isSpotLight) return 'spot light'; if (o.isPointLight) return 'point light';
    if (o.userData.legs) return 'person' + (o.userData.name ? ' · ' + o.userData.name : '');
    if (o.userData.screen) return 'screen' + (o.userData.screen.title ? ' · ' + o.userData.screen.title : '');
    if (o.isSprite) return 'sprite'; if (o.isPoints) return 'points';
    if (o.isMesh) { var mn = matName(o.material); return mn ? 'mesh · ' + mn : 'mesh'; }
    if (o.isGroup) return o.userData.dynamic ? 'group (dynamic)' : 'group';
    return o.type;
  }
  function eType(o) { return isPropRoot(o) ? 'prop' : o.isLight ? 'light' : o.isMesh ? 'mesh' : o.isSprite ? 'sprite' : o.isPoints ? 'points' : o.isGroup ? 'group' : o.type; }
  function eNode(o) { return { id: isPropRoot(o) ? o.userData.propId : eid(o), name: eName(o), type: eType(o), n: o.children.length, vis: o.visible !== false }; }
  function rnd(v) { return Math.round(v * 1000) / 1000; }
  // the scene as the hierarchy panel shows it: the props by category, the lights, the people, the doors, the screens, the vehicles,
  // whatever else stands at the top, and the static world as a count. A game adds its own branches in CO.game.editorTree(eid).
  function editorTree() {
    var props = {}, lights = [], people = [], screensL = [], doors = [], vehicles = [], other = [], baked = 0, statics = 0;
    for (var id in propInst) { var d = propInst[id].def || propDef(id) || {}; (props[d.cat || 'other'] = props[d.cat || 'other'] || []).push({ id: id, name: propLabel(id), type: 'prop', custom: !!customById(id), n: propInst[id].g.children.length, from: customById(id) ? 'save' : placedById(id) && !PROPS[id] ? 'layout' : (LAYOUT.props[id] ? 'definition, moved in the layout' : 'definition'), pack: !!(d.id && /^pk[A-Z]/.test(d.id)) }); }
    var roots = CO.root && CO.root !== scene ? [scene, CO.root] : [scene];
    roots.forEach(function (r) { r.children.forEach(function (o) {
      if (o === CO.root || o.userData.editor || isPropRoot(o) || o.userData.worldKey) return;
      if (o.isLight) { lights.push(eNode(o)); return; }
      if (o.userData.legs || o.userData.person) { people.push(eNode(o)); return; }
      if (o.userData.baked) { baked++; return; }
      if (o.isMesh && !o.userData.dynamic) { statics++; return; }
      if (o === editorHelper) return;
      other.push(eNode(o));
    }); });
    hdoors.forEach(function (d) { var s = hd(d.id); doors.push({ id: eid(d.g), name: d.label || d.id, type: 'door', open: !!s.open, locked: !!s.locked }); });
    screens.forEach(function (sc) { screensL.push({ id: eid(sc.mesh), name: sc.title || 'screen', type: 'screen' }); });
    if (traffic && traffic.cars) traffic.cars.forEach(function (c, i) { vehicles.push({ id: eid(c.g), name: 'car ' + (i + 1), type: 'vehicle' }); });
    var extra = null; try { extra = CO.game && CO.game.editorTree ? CO.game.editorTree(eid) : null; } catch (e) { extra = { error: String(e && e.message || e) }; }
    var worldL = WORLD_ITEMS.filter(function (o) { return o.parent; }).map(function (o) { return { id: eid(o), name: worldName(o), type: 'world', n: o.children.length, vis: o.visible !== false, edited: !!WORLD_EDITS[o.userData.worldKey] }; });
    return { props: props, lights: lights, people: people, doors: doors, screens: screensL, vehicles: vehicles, other: other, world: worldL, selection: editorMulti.slice(), counts: { baked: baked, statics: statics, inter: inter.length, solids: solids.length, dyn: dyn.length }, extra: extra, time: S ? { day: S.day, time: S.time } : null, selected: editorSel, paused: !!CO.paused, scene: !!photo.on, started: !!ui.started, engine: CO.version, game: CO.gameVersion };
  }
  function editorChildren(id) { var o = eobj(id); if (!o) return []; return o.children.filter(function (c) { return !c.userData.editor; }).map(eNode); }
  // the inspector record: the transform, the material or the light, the prop's definition and placement, and what the game adds
  function editorInspect(id) {
    var o = eobj(id); if (!o) return null;
    var w = new THREE.Vector3(); o.getWorldPosition(w);
    var r = { id: id, name: eName(o), type: eType(o), position: [rnd(o.position.x), rnd(o.position.y), rnd(o.position.z)], rotation: [rnd(o.rotation.x * 180 / Math.PI), rnd(o.rotation.y * 180 / Math.PI), rnd(o.rotation.z * 180 / Math.PI)], scale: [rnd(o.scale.x), rnd(o.scale.y), rnd(o.scale.z)], world: [rnd(w.x), rnd(w.y), rnd(w.z)], visible: o.visible !== false, children: o.children.length, parent: o.parent && o.parent !== scene && o.parent !== CO.root ? eName(o.parent) : null, dynamic: !!o.userData.dynamic, baked: !!o.userData.baked };
    if (o.isMesh && o.material && !Array.isArray(o.material)) { var m = o.material; r.material = { key: matName(m), type: m.type, color: m.color ? '#' + m.color.getHexString() : null, emissive: m.emissive ? '#' + m.emissive.getHexString() : null, emissiveIntensity: m.emissiveIntensity === undefined ? null : rnd(m.emissiveIntensity), roughness: m.roughness === undefined ? null : rnd(m.roughness), metalness: m.metalness === undefined ? null : rnd(m.metalness), opacity: rnd(m.opacity), transparent: !!m.transparent, map: !!m.map, shared: !!matName(m) }; }
    if (o.isMesh && o.geometry && o.geometry.parameters) r.geometry = { type: o.geometry.type, params: o.geometry.parameters };
    if (o.isLight) r.light = { type: o.type, color: '#' + o.color.getHexString(), intensity: rnd(o.intensity), distance: o.distance === undefined ? null : o.distance, decay: o.decay === undefined ? null : o.decay, shadow: !!o.castShadow };
    if (propInst[id]) { var inst = propInst[id], def = inst.def || propDef(id) || {}, P = propPlacement(id), c = customById(id); r.prop = { id: id, type: c ? c.type : (placedById(id) ? placedById(id).type : id), label: def.label, cat: def.cat || null, custom: !!c, fixed: !!def.fixed, wall: !!def.wall, extra: !!def.extra, price: def.price || 0, lvl: def.lvl || null, desc: def.desc || '', x: rnd(P.x), z: rnd(P.z), rot: P.rot, h: rnd(P.h || 0), hidden: !!P.hidden, moved: !!(S && S.layout && S.layout[id]), obstacles: inst.ctx.obstacles.length }; }
    if (o.userData.worldKey) { r.worldItem = { key: o.userData.worldKey, kind: worldKind(o), edited: !!WORLD_EDITS[o.userData.worldKey], solids: (o.userData.solids || []).length }; r.name = worldName(o); r.type = 'world'; }
    if (editorMulti.length > 1 && editorMulti.indexOf(id) >= 0) r.together = editorMulti.length;
    if (o.userData.screen) r.screen = { title: o.userData.screen.title || '', w: o.userData.screen.w, h: o.userData.screen.h, zones: o.userData.screen.zones.length };
    try { var g = CO.game && CO.game.editorInspect ? CO.game.editorInspect(id, o) : null; if (g) r.game = g; } catch (e) { r.game = { error: String(e && e.message || e) }; }
    return r;
  }
  // a live edit: a prop's placement (kept in the save, rebuilt), or an object's transform, visibility, material or light (not kept)
  function editorApply(id, path, value) {
    var p = String(path).split('.'), v = value;
    if (p[0] === 'prop') {
      if (!PROPS[id] && !customById(id) && !placedById(id)) return id + ' is not a prop';   /* a copy the layout ships counts too */
      var P = propPlacement(id); if (!S.layout) S.layout = {}; var L = S.layout[id] = S.layout[id] || { x: P.x, z: P.z, rot: P.rot, h: P.h || 0 };
      if (p[1] === 'hidden') { L.hidden = !!(v && v !== 'false'); } else if (p[1] === 'reset') { delete S.layout[id]; } else if (p[1] === 'rot') L.rot = ((Math.round(+v) % 4) + 4) % 4; else if (p[1] === 'xz') { L.x = +v[0]; L.z = +v[1]; } else L[p[1]] = +v;
      rebuildProp(id); save(); editorSelect(propInst[id] ? id : null); return 'ok';
    }
    var o = eobj(id); if (!o) return 'no such object ' + id;
    var isWorld = !!(o.userData && o.userData.worldKey);
    if (isWorld && o.userData.movesOnly && (p[0] === 'rotation' || p[0] === 'scale')) return worldName(o) + ' moves but does not turn or resize: the rules of the game are built around its shape'; if (isWorld && (p[0] === 'position' || p[0] === 'rotation' || p[0] === 'scale' || p[0] === 'visible' || p[0] === 'world') && baked.meshes.length) unbakeStatic();
    if (p[0] === 'world' && p[1] === 'reset' && isWorld) { var b0 = o.userData.worldBase; o.position.set(b0.x, b0.y, b0.z); o.rotation.y = b0.ry; o.scale.set(b0.sx, b0.sy, b0.sz); o.visible = true; o.updateMatrixWorld(true); worldRecord(o); shadowDirty = true; if (editorHelper) editorHelper.update(); return 'ok'; }
    if (p[0] === 'position' || p[0] === 'rotation' || p[0] === 'scale') { o[p[0]][p[1]] = p[0] === 'rotation' ? (+v) * Math.PI / 180 : +v; o.updateMatrixWorld(true); if (isWorld) worldRecord(o); shadowDirty = true; if (editorHelper) editorHelper.update(); return 'ok'; }
    if (p[0] === 'visible') { o.visible = !!v && v !== 'false'; if (isWorld) worldRecord(o); shadowDirty = true; return 'ok'; }
    if (p[0] === 'material') { var m = o.material; if (!m) return 'no material'; if (p[1] === 'color' || p[1] === 'emissive') { if (!m[p[1]]) return 'no ' + p[1]; m[p[1]].set(String(v)); } else m[p[1]] = +v; m.needsUpdate = true; return 'ok'; }
    if (p[0] === 'light') { if (!o.isLight) return 'not a light'; if (p[1] === 'color') o.color.set(String(v)); else o[p[1]] = +v; return 'ok'; }
    if (p[0] === 'name') { o.name = String(v); return 'ok'; }
    return 'unknown path ' + path;
  }
  function editorSelect(id, add) {
    var o = id ? eobj(id) : null, nid = o ? (propInst[id] ? id : eid(o)) : null;
    if (add && nid) { var at = editorMulti.indexOf(nid); if (at >= 0) { editorMulti.splice(at, 1); nid = null; } else editorMulti.push(nid); }
    else editorMulti = nid ? [nid] : [];
    editorMulti = editorMulti.filter(function (k) { return !!eobj(k); });
    editorSel = nid || editorMulti[editorMulti.length - 1] || null;
    editorHelpersShow();
    return editorSel ? editorInspect(editorSel) : null;
  }
  function editorHelpersShow() {
    if (editorHelper) { scene.remove(editorHelper); editorHelper.geometry.dispose(); editorHelper = null; }
    editorHelpers2.forEach(function (h) { scene.remove(h); h.geometry.dispose(); }); editorHelpers2 = [];
    editorMulti.forEach(function (k) { var o = eobj(k); if (!o) return; var hb = new THREE.BoxHelper(o, k === editorSel ? 0xf5b53d : 0x5aa9ff); hb.userData.editor = true; hb.userData.noBake = true; hb.material.depthTest = false; hb.renderOrder = 9; scene.add(hb); if (k === editorSel) editorHelper = hb; else editorHelpers2.push(hb); });
  }
  function editorHelpersUpdate() { if (editorHelper) editorHelper.update(); editorHelpers2.forEach(function (h) { h.update(); }); }
  // what can be dragged: a prop that is not fixed, a world item
  // ── the selection box ──
  var boxSel = null;
  function boxSelStart(e) {
    var el = document.createElement('div'); el.style.cssText = 'position:fixed;z-index:50;border:1px dashed #f5b53d;background:rgba(245,181,61,0.08);pointer-events:none;left:' + e.clientX + 'px;top:' + e.clientY + 'px;width:0;height:0';
    document.body.appendChild(el); boxSel = { x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY, add: e.ctrlKey || e.metaKey, el: el };
  }
  function boxSelMove(e) { var B = boxSel; B.x1 = e.clientX; B.y1 = e.clientY; var l = Math.min(B.x0, B.x1), t = Math.min(B.y0, B.y1); B.el.style.left = l + 'px'; B.el.style.top = t + 'px'; B.el.style.width = Math.abs(B.x1 - B.x0) + 'px'; B.el.style.height = Math.abs(B.y1 - B.y0) + 'px'; }
  // what stands inside the box on the screen: the four corners of its footprint on the ground project into it (a roof or a sign that
  // leans out in the picture does not count against it; the ground and the road, far bigger than any box, never fit)
  function boxSelEnd(e) {
    var B = boxSel; boxSel = null; if (B.el.parentNode) B.el.parentNode.removeChild(B.el);
    var l = Math.min(B.x0, e.clientX), r = Math.max(B.x0, e.clientX), t = Math.min(B.y0, e.clientY), b = Math.max(B.y0, e.clientY);
    if (r - l < 4 && b - t < 4) { if (!B.add) editorSelect(null); return; }
    var rc = canvas.getBoundingClientRect(), v = new THREE.Vector3(), bb = new THREE.Box3(), found = [];
    scene.updateMatrixWorld(true);
    var inside = function (o) { bb.setFromObject(o); if (bb.isEmpty()) return false; for (var k = 0; k < 4; k++) { v.set(k & 1 ? bb.max.x : bb.min.x, bb.min.y, k & 2 ? bb.max.z : bb.min.z).project(camera); if (v.z > 1) return false; var sx = rc.left + (v.x + 1) / 2 * rc.width, sy = rc.top + (1 - v.y) / 2 * rc.height; if (sx < l || sx > r || sy < t || sy > b) return false; } return true; };
    for (var id in propInst) if (propInst[id].g.visible !== false && inside(propInst[id].g)) found.push(id);
    WORLD_ITEMS.forEach(function (o) { if (o.parent && o.visible && inside(o)) found.push(eid(o)); });
    if (!B.add) editorMulti = []; found.forEach(function (k) { if (editorMulti.indexOf(k) < 0) editorMulti.push(k); });
    editorSel = editorMulti[editorMulti.length - 1] || null; editorHelpersShow();
    console.log('[co-editor] ' + JSON.stringify({ select: editorSel, selection: editorMulti.slice(), boxed: found.length }));
  }
  function editorMovable(id) { if (propInst[id]) { var d = propDef(id); return !(d && d.fixed); } var o = eobj(id); return !!(o && o.userData.worldKey); }
  // a drag starts on a selected thing: one thing drags the way it always did (walls snap), several move together by the same step
  function editorDragStart(e, hq) {
    var ids = editorMulti.filter(editorMovable); if (ids.indexOf(hq.id) < 0) return false;
    if (ids.some(function (k) { return !propInst[k]; }) && baked.meshes.length) unbakeStatic();
    if (ids.length === 1) {
      var id = ids[0], g1 = eobj(id), p1 = pointOnPlane(e, g1.position.y); if (!p1) return false;
      propDrag = propInst[id] ? { id: id, g: g1, y: g1.position.y, off: p1.clone().sub(g1.position), before: layoutSnap(id), moved: false } : { id: id, g: g1, y: g1.position.y, off: p1.clone().sub(g1.position), world: true, before: { x: g1.position.x, z: g1.position.z }, moved: false };
      return true;
    }
    var hg = eobj(hq.id), p0 = pointOnPlane(e, hg.position.y); if (!p0) return false;
    groupDrag = { y: hg.position.y, p0: p0.clone(), moved: false, items: ids.map(function (k) { var g = eobj(k); return { id: k, g: g, prop: !!propInst[k], x0: g.position.x, z0: g.position.z, before: propInst[k] ? layoutSnap(k) : { x: g.position.x, z: g.position.z } }; }) };
    return true;
  }
  // several things moved: each kept where it now stands (a prop in the layout, a world item in src/00-world.js), one undo step for all
  function editorGroupCommit(GD) {
    var after = GD.items.map(function (it) { return { x: Math.round(it.g.position.x * 100) / 100, z: Math.round(it.g.position.z * 100) / 100 }; });
    var put = function (which) {
      GD.items.forEach(function (it, i) {
        if (it.prop) { if (which === 'before') layoutRestore(it.id, it.before); else { var P = propPlacement(it.id); if (!S.layout) S.layout = {}; var Lz = S.layout[it.id] = S.layout[it.id] || { x: P.x, z: P.z, rot: P.rot, h: P.h || 0 }; Lz.x = after[i].x; Lz.z = after[i].z; rebuildProp(it.id); } }
        else { var g = eobj(it.id), q = which === 'before' ? it.before : after[i]; g.position.x = q.x; g.position.z = q.z; g.updateMatrixWorld(true); worldRecord(g); }
      });
      save(); shadowDirty = true; editorHelpersShow();
    };
    put('after'); histPush('move ' + GD.items.length + ' things', function () { put('before'); }, function () { put('after'); });
    console.log('[co-editor] ' + JSON.stringify({ movedTogether: GD.items.map(function (it) { return it.id; }) }));
    return GD.items.length;
  }
  function editorMoveSel(dx, dz) {
    var ids = editorMulti.filter(editorMovable); if (!ids.length) return 'nothing selected that moves';
    if (ids.some(function (k) { return !propInst[k]; }) && baked.meshes.length) unbakeStatic();
    var GD = { items: ids.map(function (k) { var g = eobj(k); return { id: k, g: g, prop: !!propInst[k], before: propInst[k] ? layoutSnap(k) : { x: g.position.x, z: g.position.z } }; }) };
    GD.items.forEach(function (it) { it.g.position.x += +dx || 0; it.g.position.z += +dz || 0; });
    return 'moved ' + editorGroupCommit(GD);
  }
  // ── duplicate, copy, paste (0.9.4) ──
  // Duplicate makes a copy of every selected prop and world item, 1.5 m along, and selects the copies; Paste does the same at the point
  // the camera looks at, keeping the group's arrangement. A prop copy is a placed copy (the layout keeps it); a world item's copy is a
  // world copy (src/00-world.js keeps it). One undo step takes them all away.
  var editorClip = [];
  function editorDuplicate(ids, at) {
    ids = (ids && ids.length ? ids : editorMulti).filter(function (k) { return !!eobj(k); }); if (!ids.length) return { error: 'nothing selected to duplicate' };
    var spots = ids.map(function (k) { if (propInst[k]) { var P = propPlacement(k); return { x: P.x, z: P.z }; } var o = eobj(k); return { x: o.position.x, z: o.position.z }; });
    var cx = spots.reduce(function (s, p) { return s + p.x; }, 0) / spots.length, cz = spots.reduce(function (s, p) { return s + p.z; }, 0) / spots.length;
    var dx = at ? at.x - cx : 1.5, dz = at ? at.z - cz : 1.5, made = [], refused = [], snap = function (v) { return Math.round(v * 20) / 20; };
    if (!S.custom) S.custom = [];
    ids.forEach(function (k, i) {
      if (propInst[k]) { var src = customById(k) || placedById(k), type = src ? src.type : (PROPS[k] ? k : null), P = propPlacement(k); if (!type) return; var c = { id: uid('cp'), type: type, x: snap(spots[i].x + dx), z: snap(spots[i].z + dz), rot: P.rot || 0, h: P.h || 0 }; S.custom.push(c); buildProp(c.id); made.push({ prop: c, id: c.id }); return; }
      var o = eobj(k); if (!o || !o.userData.worldKey) return; if (o.userData.movesOnly) { refused.push(worldName(o)); return; }
      var rec = { id: uid('wc'), of: o.userData.worldCopy ? o.userData.worldCopy.of : o.userData.worldKey, x: wr(o.position.x + dx), y: wr(o.position.y), z: wr(o.position.z + dz), ry: Math.round(o.rotation.y * 180 / Math.PI * 10) / 10, sx: wr(o.scale.x), sy: wr(o.scale.y), sz: wr(o.scale.z) };
      WORLD_COPIES.push(rec); var g = worldCopyBuild(rec); if (g) made.push({ world: rec, id: eid(g) }); else { WORLD_COPIES.splice(WORLD_COPIES.indexOf(rec), 1); refused.push(worldName(o)); }
    });
    if (!made.length) return { error: refused.length ? refused.join(', ') + ' cannot be copied (it moves only)' : 'nothing to copy' };
    save();
    var undo = function () { made.forEach(function (m) { if (m.prop) { var a = S.custom.indexOf(m.prop); if (a >= 0) S.custom.splice(a, 1); removePropInst(m.prop.id); } else { var g = worldByKey(m.world.id); if (g) worldCopyRemove(g); } }); editorSelect(null); save(); };
    var redo = function () { made.forEach(function (m) { if (m.prop) { S.custom.push(m.prop); buildProp(m.prop.id); } else { WORLD_COPIES.push(m.world); var g = worldCopyBuild(m.world); if (g) m.id = eid(g); } }); save(); };
    histPush((at ? 'paste ' : 'duplicate ') + made.length + (made.length === 1 ? ' thing' : ' things'), undo, redo);
    editorMulti = made.map(function (m) { return m.id; }); editorSel = editorMulti[editorMulti.length - 1]; editorHelpersShow();
    console.log('[co-editor] ' + JSON.stringify({ select: editorSel, selection: editorMulti.slice(), duplicated: made.length }));
    return { ok: true, made: editorMulti.slice(), refused: refused };
  }
  function editorCopy(ids) { editorClip = (ids && ids.length ? ids : editorMulti).filter(function (k) { return !!eobj(k); }); return { ok: true, copied: editorClip.length }; }
  function editorPaste() { if (!editorClip.length) return { error: 'nothing copied: select something and press Ctrl+C first' }; var a = aheadPoint(6); return editorDuplicate(editorClip, { x: a.x, z: a.z }); }
  function editorRemoveSel() { var ids = editorMulti.slice(), out = ids.map(function (k) { return editorRemove(k); }); editorSelect(null); return out; }
  // what the crosshair or a click is on: the nearest visible mesh, named as its prop when it belongs to one
  function editorPick(nx, ny) {
    scene.updateMatrixWorld(true);   /* a prop rebuilt this tick has no world matrix until the next frame */
    eRay.setFromCamera({ x: nx === undefined ? 0 : nx, y: ny === undefined ? 0 : ny }, camera); eRay.far = 120;
    var hits = eRay.intersectObjects(scene.children, true);
    // a baked merge is skipped and the hidden original behind it counts: it is the thing the player would name
    for (var i = 0; i < hits.length; i++) { var h = hits[i].object; if (h.userData.baked || h.userData.editor || h.material === MAT.hit || h === editorHelper || h.isPoints || h.userData.noBake || (!h.visible && !h.userData.bakedAway) || (h.material && h.material.transparent && h.material.opacity < 0.9 && !h.userData.screen)) continue;   /* not a blob, a helper or a glass pane */ var pid = propIdOf(h), isProp = !!(pid && propInst[pid]), wi = isProp ? null : worldItemOf(h); return { id: isProp ? pid : wi ? eid(wi) : eid(h), prop: isProp, world: !!wi, distance: rnd(hits[i].distance), point: [rnd(hits[i].point.x), rnd(hits[i].point.y), rnd(hits[i].point.z)] }; }
    return null;
  }
  function aheadPoint(dist) { var d = new THREE.Vector3(); camera.getWorldDirection(d); var p = camera.position.clone().add(d.multiplyScalar(dist || 3)); return { x: p.x, z: p.z, y: floorY(p.x, p.z) }; }
  // a new copy of a prop definition, free, where the camera looks (or at x, z): kept in the save as a bought extra would be
  function editorSpawn(type, x, z) {
    var def = PROPS[type]; if (!def) return 'no prop definition ' + type;
    if (x === undefined || z === undefined) { var a = aheadPoint(3); x = a.x; z = a.z; }
    if (!S.custom) S.custom = []; var c = { id: uid('cp'), type: type, x: Math.round(x * 20) / 20, z: Math.round(z * 20) / 20, rot: 0, h: 0 }; S.custom.push(c);
    buildProp(c.id); save(); editorSelect(c.id);
    histPush('place ' + type, function () { var i = S.custom.indexOf(c); if (i >= 0) S.custom.splice(i, 1); removePropInst(c.id); if (editorSel === c.id) editorSelect(null); save(); }, function () { S.custom.push(c); buildProp(c.id); save(); });
    return c.id;
  }
  function editorRemove(id) {
    var c = customById(id);
    if (c) { var at = S.custom.indexOf(c); S.custom.splice(at, 1); removePropInst(id); save(); if (editorSel === id) editorSelect(null); histPush('remove ' + c.type, function () { S.custom.splice(Math.min(at, S.custom.length), 0, c); buildProp(c.id); save(); }, function () { var i = S.custom.indexOf(c); if (i >= 0) S.custom.splice(i, 1); removePropInst(c.id); if (editorSel === c.id) editorSelect(null); save(); }); return 'removed ' + id; }
    if (propInst[id]) { var before = layoutSnap(id); if (!S.layout) S.layout = {}; S.layout[id] = S.layout[id] || {}; S.layout[id].hidden = true; buildProp(id); save(); if (editorSel === id) editorSelect(null); var after = layoutSnap(id); histPush('hide ' + id, function () { layoutRestore(id, before); }, function () { layoutRestore(id, after); }); return 'hidden ' + id + ' (the catalogue brings it back)'; }
    var wc = eobj(id); if (wc && wc.userData.worldCopy) { var rec = wc.userData.worldCopy; worldCopyRemove(wc); if (editorSel === id) editorSelect(null); histPush('remove a copy of ' + worldName(wc), function () { WORLD_COPIES.push(rec); worldCopyBuild(rec); }, function () { var g = worldByKey(rec.id); if (g) worldCopyRemove(g); }); return 'removed a copy of ' + worldName(wc); }
    var wo = eobj(id); if (wo && wo.userData.worldKey) { if (baked.meshes.length) unbakeStatic(); wo.visible = false; worldRecord(wo); if (editorSel === id) editorSelect(null); shadowDirty = true; histPush('remove ' + worldName(wo), function () { wo.visible = true; worldRecord(wo); shadowDirty = true; }, function () { wo.visible = false; worldRecord(wo); shadowDirty = true; }); return 'removed ' + worldName(wo) + ' (kept in src/00-world.js; Put it back in the inspector or Ctrl+Z brings it back)'; }
    var o = eobj(id); if (!o) return 'no such object ' + id; var par = o.parent; if (par) par.remove(o); if (editorSel === id) editorSelect(null); shadowDirty = true;
    histPush('remove ' + eName(o), function () { if (par) { par.add(o); shadowDirty = true; } }, function () { if (o.parent) o.parent.remove(o); if (editorSel === id) editorSelect(null); shadowDirty = true; });
    return 'removed ' + id + ' until the next reload';
  }
  // the scene view is the engine's free camera: the world holds still, the camera flies. frame(id) brings the camera to a thing.
  function editorEnter() { if (ui.started) return true; if (CO.game && CO.game.editorEnter) CO.game.editorEnter(); else enter(); return ui.started; }
  function editorMode(m) {
    if (m === 'top') { editorMode('scene'); photo.y = Math.max(photo.y, 22); photo.pitch = -1.5; camera.position.set(photo.x, photo.y, photo.z); camera.rotation.set(photo.pitch, photo.yaw, 0, 'YXZ'); return photo.on ? 'top' : 'game'; }
    if (m === 'scene') { editorEnter(); if (ui.menuOpen) closeMenu(); if (ui.panelOpen) closePanel(); if (!photo.on) photoToggle(true); return photo.on ? 'scene' : 'game'; }
    if (photo.on) photoToggle(false); return 'game';
  }
  // how far the scene camera can back away from a point along one yaw before a wall (or any solid thing that is not the object itself) is in the way
  function frameClear(c, yaw, d, o) {
    var dir = new THREE.Vector3(Math.sin(yaw), 0.45, Math.cos(yaw)).normalize(), rc = new THREE.Raycaster(c, dir, 0.05, d); rc.camera = camera;   /* sprites need it */ var hits = rc.intersectObjects(scene.children, true);
    for (var i = 0; i < hits.length; i++) {
      var h = hits[i].object, own = false, p = h; while (p) { if (p === o) { own = true; break; } p = p.parent; }
      if (own || h.userData.editor || h === editorHelper || h.material === MAT.hit || h.isPoints || !h.visible || (h.material && h.material.transparent && h.material.opacity < 0.9)) continue;
      return Math.max(1.2, hits[i].distance - 0.5);
    }
    return d;
  }
  // the scene camera flies to one object: back along its current yaw when there is room, else to the side with the most room, so it never ends up behind a wall
  function editorFrame(id) {
    var o = eobj(id); if (!o) return 'no such object ' + id;
    var box3 = new THREE.Box3().setFromObject(o), c = box3.getCenter(new THREE.Vector3()), s = box3.getSize(new THREE.Vector3()), d = Math.max(2.2, Math.max(s.x, s.y, s.z) * 1.6 + 1.2);
    if (editorMode('scene') !== 'scene') return 'the scene view did not open';
    var yaw = photo.yaw, best = yaw, bestD = frameClear(c, yaw, d, o), k, cand, cd;
    if (bestD < d * 0.8) for (k = 1; k < 4; k++) { cand = yaw + k * Math.PI / 2; cd = frameClear(c, cand, d, o); if (cd > bestD + 0.3) { best = cand; bestD = cd; } }
    yaw = best; d = bestD;
    var px = c.x + Math.sin(yaw) * d, pz = c.z + Math.cos(yaw) * d, py = c.y + d * 0.45;
    photo.yaw = yaw; photo.x = px; photo.y = py; photo.z = pz; photo.pitch = -Math.atan2(py - c.y, Math.sqrt((px - c.x) * (px - c.x) + (pz - c.z) * (pz - c.z)));
    camera.position.set(px, py, pz); camera.rotation.set(photo.pitch, photo.yaw, 0, 'YXZ');
    return 'framed ' + id;
  }
  // the assets panel: every prop definition, the palette, the textures, the voices, the people presets
  function editorAssets() {
    return {
      props: PROP_ORDER.map(function (id) { var d = PROPS[id]; return { id: id, label: d.label, cat: d.cat || 'other', ico: d.ico || '', price: d.price || 0, extra: !!d.extra, lvl: d.lvl || null, wall: !!d.wall, fixed: !!d.fixed, desc: d.desc || '', standing: !!propInst[id] }; }),
      materials: Object.keys(MAT).map(function (k) { var m = MAT[k]; return { key: k, type: m.type, color: m.color ? '#' + m.color.getHexString() : null, map: !!m.map, emissive: m.emissive && m.emissive.getHex() ? '#' + m.emissive.getHexString() : null }; }),
      textures: Object.keys(TEX).filter(function (k) { return !!TEX[k]; }), normals: Object.keys(NRM), sounds: Object.keys(SFX),
      people: { skins: SKINS.map(function (c) { return '#' + c.toString(16).padStart(6, '0'); }), hairs: HAIRS.map(function (c) { return '#' + c.toString(16).padStart(6, '0'); }), styles: ['short', 'long', 'bun', 'bald', 'cap'] },
      catalogue: CO.game && CO.game.catalogueGroups ? CO.game.catalogueGroups.map(function (g) { return [g[0], g[1]]; }) : null
    };
  }
  function editorShot(quality) { renderFrame(0.016); try { return canvas.toDataURL('image/jpeg', quality || 0.8); } catch (e) { return null; } }
  // in the editor's viewport there is no pointer lock (a locked pointer in an embedded page is not safe): a left click selects what it
  // is on, and the look follows the mouse while the right button is held, in the scene camera and in the game alike
  var editorTool = { mode: null, radius: 3, strength: 0.5, tex: 0 }, toolDown = false;
  function editorSetTool(t) { if (!t || !t.mode) { editorTool.mode = null; editorTool.type = null; return editorTool; } editorTool.mode = t.mode; editorTool.type = t.type || null; if (t.radius) editorTool.radius = +t.radius; if (t.strength !== undefined) editorTool.strength = +t.strength; if (t.tex !== undefined) editorTool.tex = t.tex | 0; return editorTool; }
  function toolApply(e) { var r = canvas.getBoundingClientRect(), nx = ((e.clientX - r.left) / r.width) * 2 - 1, ny = -((e.clientY - r.top) / r.height) * 2 + 1, pt = terrainPick(nx, ny); if (!pt) return; var res = terrainBrush(pt.x, pt.z, editorTool.mode, editorTool.radius, editorTool.mode === 'paint' ? 1 : editorTool.strength * 0.25, editorTool.tex); if (res && res.changed) console.log('[co-editor] ' + JSON.stringify({ terrain: res.changed })); }
  var dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), dragPt = new THREE.Vector3(), propDrag = null, partDrag = null, dragT = 0, toolStroke = null;
  function terrainRestore(h, p) { if (!TERRAIN.on || TERRAIN.heights.length !== h.length) return; TERRAIN.heights.set(h); TERRAIN.paint.set(p); terrainUpdate(0, 0, TERRAIN.w, TERRAIN.d); }
  // the nearest wall face within 2.5 m, the way build mode snaps a wall prop: the point on it and the quarter turn that faces out
  function wallSnap(pt, s) { var best = null, bd = 2.5; wallPlanes().forEach(function (w) { var d = w.a === 'x' ? Math.abs(pt.x - w.v) : Math.abs(pt.z - w.v); var within = w.a === 'x' ? (pt.z > w.z0 && pt.z < w.z1) : (pt.x > w.x0 && pt.x < w.x1); if (within && d < bd) { bd = d; best = w; } }); if (!best) return null; return best.a === 'x' ? { x: best.v, z: snapTo(pt.z, s || 0.05), rot: best.n > 0 ? 1 : 3 } : { x: snapTo(pt.x, s || 0.05), z: best.v, rot: best.n > 0 ? 0 : 2 }; }
  function pointOnPlane(e, y) { var r = canvas.getBoundingClientRect(), nx = ((e.clientX - r.left) / r.width) * 2 - 1, ny = -((e.clientY - r.top) / r.height) * 2 + 1; eRay.setFromCamera({ x: nx, y: ny }, camera); dragPlane.constant = -y; return eRay.ray.intersectPlane(dragPlane, dragPt) ? dragPt : null; }
  function snapTo(v, s) { return Math.round(v / s) * s; }
  // the vertex of a mesh part nearest the pointer on screen, within 14 px
  function nearestVertex(mesh, e) { var r = canvas.getBoundingClientRect(), pos = mesh.geometry.attributes.position, best = null, v = new THREE.Vector3(); mesh.updateMatrixWorld(true); for (var i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); var w = v.clone().applyMatrix4(mesh.matrixWorld), sp = w.clone().project(camera), sx = (sp.x + 1) / 2 * r.width + r.left, sy = (1 - sp.y) / 2 * r.height + r.top, d = Math.hypot(sx - e.clientX, sy - e.clientY); if (d < 14 && (!best || d < best.d)) best = { i: mesh.userData.vertMap ? mesh.userData.vertMap[i] : i, d: d, w: w }; } return best; }
  function editorBind() {
    canvas.addEventListener('mousedown', function (e) {
      if (!CO.editor.on || !ui.started) return;
      if (e.button === 0 && editorTool.mode === 'model' && editorTool.type) { var r0 = canvas.getBoundingClientRect(), mx = ((e.clientX - r0.left) / r0.width) * 2 - 1, my = -((e.clientY - r0.top) / r0.height) * 2 + 1, pk = modelPick(editorTool.type, mx, my); if (pk) { var inst0 = propInst[pk.id]; inst0.g.updateMatrixWorld(true); var partObj = null; inst0.g.traverse(function (o) { if (!partObj && o.userData && o.userData.part === pk.part) partObj = o; }); var wp = partObj ? partObj.getWorldPosition(new THREE.Vector3()) : inst0.g.position.clone(); var vh = partObj && partObj.userData.vertexEdit ? nearestVertex(partObj, e) : null; if (vh) { partDrag = { type: editorTool.type, id: pk.id, part: pk.part, g: inst0.g, mesh: partObj, vert: vh.i, y: vh.w.y }; console.log('[co-editor] ' + JSON.stringify({ partPick: pk.part, vert: vh.i, type: editorTool.type })); e.preventDefault(); return; } var p0 = pointOnPlane(e, wp.y); if (p0) { partDrag = { type: editorTool.type, id: pk.id, part: pk.part, g: inst0.g, y: wp.y, off: p0.clone().sub(wp) }; console.log('[co-editor] ' + JSON.stringify({ partPick: pk.part, type: editorTool.type })); e.preventDefault(); return; } } }
      if (e.button === 0 && editorTool.mode && editorTool.mode !== 'model' && TERRAIN.on) { toolDown = true; toolStroke = { mode: editorTool.mode, h: Float32Array.from(TERRAIN.heights), p: Uint8Array.from(TERRAIN.paint) }; toolApply(e); e.preventDefault(); return; }
      // Shift and the left button in the scene camera draw a selection box (Ctrl and Shift add to what is selected)
      if (e.button === 0 && e.shiftKey && photo.on) { boxSelStart(e); e.preventDefault(); return; }
      // the left button: a click selects, Ctrl and a click adds to the selection or takes away; a drag on a selected thing moves it and
      // everything selected with it, with Ctrl in the game view and without in the scene camera
      if (e.button === 0) {
        var rq = canvas.getBoundingClientRect(), qx = ((e.clientX - rq.left) / rq.width) * 2 - 1, qy = -((e.clientY - rq.top) / rq.height) * 2 + 1, hq = editorPick(qx, qy), add = e.ctrlKey || e.metaKey;
        pendingOff = null;
        if (add) { if (hq) { if (editorMulti.indexOf(hq.id) >= 0) pendingOff = hq.id; else editorSelect(hq.id, true); } }
        else if (!hq || editorMulti.indexOf(hq.id) < 0) editorSelect(hq ? hq.id : null);
        else { editorSel = hq.id; editorHelpersShow(); }
        console.log('[co-editor] ' + JSON.stringify({ select: editorSel, selection: editorMulti.slice(), point: hq ? hq.point : null, nx: qx, ny: qy }));
        if (hq && (add || photo.on) && editorMulti.indexOf(hq.id) >= 0 && editorDragStart(e, hq)) { e.preventDefault(); return; }
      }
      if (e.button === 2) { CO.editor.drag = true; e.preventDefault(); }
    });
    document.addEventListener('mouseup', function (e) {
      if (e.button === 2) CO.editor.drag = false; if (e.button === 0) toolDown = false;
      if (e.button === 0 && boxSel) { boxSelEnd(e); return; }
      var moved0 = (groupDrag && groupDrag.moved) || (propDrag && propDrag.moved);
      if (e.button === 0 && pendingOff) { var po = pendingOff; pendingOff = null; if (!moved0) { editorSelect(po, true); console.log('[co-editor] ' + JSON.stringify({ select: editorSel, selection: editorMulti.slice() })); } }
      if (e.button === 0 && groupDrag) { var GD0 = groupDrag; groupDrag = null; if (GD0.moved) editorGroupCommit(GD0); return; }
      if (e.button === 0 && toolStroke) { var TS = toolStroke; toolStroke = null; var afterH = Float32Array.from(TERRAIN.heights), afterP = Uint8Array.from(TERRAIN.paint); histPush('terrain ' + TS.mode, function () { terrainRestore(TS.h, TS.p); }, function () { terrainRestore(afterH, afterP); }); }
      if (e.button === 0 && propDrag && propDrag.world) { var DW = propDrag; propDrag = null; if (DW.moved) { var gw = DW.g, bw = DW.before, aw = { x: gw.position.x, z: gw.position.z }; worldRecord(gw); histPush('move ' + worldName(gw), function () { gw.position.x = bw.x; gw.position.z = bw.z; gw.updateMatrixWorld(true); worldRecord(gw); shadowDirty = true; }, function () { gw.position.x = aw.x; gw.position.z = aw.z; gw.updateMatrixWorld(true); worldRecord(gw); shadowDirty = true; }); console.log('[co-editor] ' + JSON.stringify({ moved: DW.id, x: wr(aw.x), z: wr(aw.z), world: true })); } return; }
      if (e.button === 0 && propDrag) { var D = propDrag; propDrag = null; if (D.moved) { var P = propPlacement(D.id), x = Math.round(D.g.position.x * 100) / 100, z = Math.round(D.g.position.z * 100) / 100; if (!S.layout) S.layout = {}; S.layout[D.id] = S.layout[D.id] || { x: P.x, z: P.z, rot: P.rot, h: P.h || 0 }; S.layout[D.id].x = x; S.layout[D.id].z = z; if (D.rot !== undefined) S.layout[D.id].rot = D.rot; rebuildProp(D.id); save(); var after = layoutSnap(D.id), bef = D.before; histPush('move ' + D.id, function () { layoutRestore(D.id, bef); }, function () { layoutRestore(D.id, after); }); editorSelect(D.id); console.log('[co-editor] ' + JSON.stringify({ moved: D.id, x: x, z: z })); } }
      if (e.button === 0 && partDrag) { console.log('[co-editor] ' + JSON.stringify({ partDragEnd: partDrag.part, type: partDrag.type })); partDrag = null; }
    });
    canvas.addEventListener('mousemove', function (e) {
      if (toolDown && editorTool.mode && editorTool.mode !== 'model' && TERRAIN.on) toolApply(e);
      if (boxSel) { boxSelMove(e); return; }
      if (groupDrag) { var pg = pointOnPlane(e, groupDrag.y); if (!pg) return; var sg = e.shiftKey ? 0.5 : 0.05, gdx = snapTo(pg.x - groupDrag.p0.x, sg), gdz = snapTo(pg.z - groupDrag.p0.z, sg); groupDrag.items.forEach(function (it) { it.g.position.x = it.x0 + gdx; it.g.position.z = it.z0 + gdz; it.g.updateMatrixWorld(true); }); if (gdx || gdz) groupDrag.moved = true; editorHelpersUpdate(); shadowDirty = true; return; }
      if (propDrag) { var p = pointOnPlane(e, propDrag.y); if (!p) return; var s = e.shiftKey ? 0.5 : 0.05, nx2 = snapTo(p.x - propDrag.off.x, s), nz2 = snapTo(p.z - propDrag.off.z, s); var dd = propDrag.world ? null : propDef(propDrag.id); if (dd && dd.wall) { var ws2 = wallSnap({ x: nx2, z: nz2 }, s); if (ws2) { nx2 = ws2.x; nz2 = ws2.z; if (propDrag.g.rotation.y !== ws2.rot * Math.PI / 2) { propDrag.g.rotation.y = ws2.rot * Math.PI / 2; propDrag.rot = ws2.rot; } } } if (nx2 !== propDrag.g.position.x || nz2 !== propDrag.g.position.z) { propDrag.g.position.x = nx2; propDrag.g.position.z = nz2; propDrag.moved = true; if (editorHelper) editorHelper.update(); shadowDirty = true; } return; }
      if (partDrag) { var pp = pointOnPlane(e, partDrag.y); if (!pp) return; var now = performance.now(); if (now - dragT < 40) return; dragT = now; var st = e.shiftKey ? 0.25 : 0.05; if (partDrag.vert !== undefined) { var lv = partDrag.mesh.worldToLocal(pp.clone()); console.log('[co-editor] ' + JSON.stringify({ vertDrag: partDrag.part, v: partDrag.vert, type: partDrag.type, x: snapTo(lv.x, st / 5), z: snapTo(lv.z, st / 5) })); return; } var local = partDrag.g.worldToLocal(pp.clone().sub(partDrag.off)); console.log('[co-editor] ' + JSON.stringify({ partDrag: partDrag.part, type: partDrag.type, x: snapTo(local.x, st), z: snapTo(local.z, st) })); }
    });
    window.addEventListener('blur', function () { CO.editor.drag = false; });
    canvas.addEventListener('contextmenu', function (e) { if (CO.editor.on) e.preventDefault(); });
    // Ctrl and the wheel turn the prop under the pointer (or the selected one) a quarter at a time
    canvas.addEventListener('wheel', function (e) { if (!CO.editor.on || !ui.started || !(e.ctrlKey || e.metaKey)) return; e.preventDefault(); e.stopImmediatePropagation(); var r2 = canvas.getBoundingClientRect(), wx = ((e.clientX - r2.left) / r2.width) * 2 - 1, wy = -((e.clientY - r2.top) / r2.height) * 2 + 1, hw = editorPick(wx, wy), id = hw && hw.prop && propInst[hw.id] ? hw.id : hw && hw.world ? hw.id : editorSel; var wt = id && !propInst[id] ? eobj(id) : null; if (wt && wt.userData.worldKey) { var ry0 = wt.rotation.y * 180 / Math.PI; editorSet(id, 'rotation.y', Math.round(ry0 + (e.deltaY > 0 ? -90 : 90))); editorSelect(id); return; } if (!id || !propInst[id]) return; var dw = propDef(id); if (dw && dw.fixed) return; var rot = propPlacement(id).rot || 0; editorSet(id, 'prop.rot', (rot + (e.deltaY > 0 ? 1 : 3)) % 4); editorSelect(id); console.log('[co-editor] ' + JSON.stringify({ moved: id, rot: (rot + (e.deltaY > 0 ? 1 : 3)) % 4 })); }, { capture: true, passive: false });
    window.addEventListener('keydown', function (e) { if (!CO.editor.on || !(e.ctrlKey || e.metaKey)) return; var k = (e.key || '').toLowerCase(); if (k === 'd' || k === 'c' || k === 'v') { e.preventDefault(); var rk = k === 'd' ? editorDuplicate() : k === 'c' ? editorCopy() : editorPaste(); console.log('[co-editor] ' + JSON.stringify({ clip: k, result: rk && (rk.error || rk.made || rk.copied) })); return; } if (k === 'z' && !e.shiftKey) { e.preventDefault(); console.log('[co-editor] ' + JSON.stringify({ history: editorUndoStep() })); } else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); console.log('[co-editor] ' + JSON.stringify({ history: editorRedoStep() })); } });
  }
  // ── Undo and redo: a stack of steps, each one knowing how to undo and redo itself ──
  // The editor's own edits are steps (a prop field, a live field, a spawn, a remove); the game's build mode is play, not editing, and is not.
  var editorUndoStack = [], editorRedoStack = [];
  function histPush(label, undo, redo) { editorUndoStack.push({ label: label, undo: undo, redo: redo, t: Date.now() }); if (editorUndoStack.length > 200) editorUndoStack.shift(); editorRedoStack.length = 0; }
  function layoutSnap(id) { return S && S.layout && S.layout[id] ? JSON.parse(JSON.stringify(S.layout[id])) : undefined; }
  function layoutRestore(id, snap) { if (!S.layout) S.layout = {}; if (snap === undefined) delete S.layout[id]; else S.layout[id] = JSON.parse(JSON.stringify(snap)); rebuildProp(id); save(); if (editorSel === id) editorSelect(propInst[id] ? id : null); }
  function editorUndoStep() { var s = editorUndoStack.pop(); if (!s) return 'nothing to undo'; s.undo(); editorRedoStack.push(s); if (editorHelper) editorHelper.update(); return 'undid: ' + s.label; }
  function editorRedoStep() { var s = editorRedoStack.pop(); if (!s) return 'nothing to redo'; s.redo(); editorUndoStack.push(s); if (editorHelper) editorHelper.update(); return 'redid: ' + s.label; }
  function editorHistory() { return { undo: editorUndoStack.map(function (s) { return s.label; }), redo: editorRedoStack.map(function (s) { return s.label; }) }; }
  // the current value of a live field, in the units set() takes, so a step can put it back
  function editorGet(id, path) {
    var o = eobj(id); if (!o) return undefined; var p = String(path).split('.');
    if (p[0] === 'position' || p[0] === 'scale') return o[p[0]][p[1]];
    if (p[0] === 'rotation') return o.rotation[p[1]] * 180 / Math.PI;
    if (p[0] === 'visible') return o.visible;
    if (p[0] === 'material') { var m = o.material; if (!m) return undefined; return (p[1] === 'color' || p[1] === 'emissive') ? (m[p[1]] ? '#' + m[p[1]].getHexString() : undefined) : m[p[1]]; }
    if (p[0] === 'light') return !o.isLight ? undefined : p[1] === 'color' ? '#' + o.color.getHexString() : o[p[1]];
    if (p[0] === 'name') return o.name;
    return undefined;
  }
  // set() records a step around apply(): a prop field as a layout snapshot before and after, a live field as its old and new value
  function editorSet(id, path, value) {
    var head = String(path).split('.')[0];
    if (head === 'prop') { var before = layoutSnap(id), r = editorApply(id, path, value); if (r === 'ok') { var after = layoutSnap(id); histPush(path + ' of ' + id, function () { layoutRestore(id, before); }, function () { layoutRestore(id, after); }); } return r; }
    if (head === 'world') { var wo = eobj(id); if (!wo || !wo.userData.worldKey) return 'not a world item'; var snap = function () { return { p: wo.position.clone(), ry: wo.rotation.y, s: wo.scale.clone(), v: wo.visible }; }, put = function (q) { wo.position.copy(q.p); wo.rotation.y = q.ry; wo.scale.copy(q.s); wo.visible = q.v; wo.updateMatrixWorld(true); worldRecord(wo); shadowDirty = true; }, w0 = snap(), rw = editorApply(id, path, value), w1 = snap(); if (rw === 'ok') histPush('put back ' + worldName(wo), function () { put(w0); }, function () { put(w1); }); return rw; }
    var was = editorGet(id, path), r2 = editorApply(id, path, value);
    if (r2 === 'ok' && was !== undefined) histPush(path + ' of ' + id, function () { editorApply(id, path, was); }, function () { editorApply(id, path, value); });
    return r2;
  }

  // ── Pack authoring: a prop definition's build code, compiled and previewed live, and new definitions ──
  // The names a build function may use when the editor compiles it outside the closure: the engine's kit, plus what the game adds in
  // GAME.editorKit (an object, or a function returning one). A name missing here surfaces as "x is not defined" in the preview.
  function editorKit() {
    var K = { THREE: THREE, CO: CO, S: S, SET: SET, MAT: MAT, TEX: TEX, NRM: NRM, PROPS: PROPS, defProp: defProp, propDef: propDef, propPlacement: propPlacement, propWorld: propWorld, propLabel: propLabel, customById: customById, propInst: propInst,
      box: box, plane: plane, cyl: cyl, sphere: sphere, sprite: sprite, sign: sign, tex: tex, textTex: textTex, normalTex: normalTex, roughTex: roughTex, std: std, glowMat: glowMat, cachedGeo: cachedGeo, boxGeo: boxGeo, bevelGeo: bevelGeo, taperGeo: taperGeo, roundCylGeo: roundCylGeo,
      groundBlob: groundBlob, hitBox: hitBox, solid: solid, solids: solids, animate: animate, animated: animated, burst: burst, parentOf: parentOf, inter: inter, addInter: addInter, dyn: dyn, scene: scene, camera: camera, player: player, ui: ui,
      clamp: clamp, lerp: lerp, money: money, randi: randi, randf: randf, pick: pick, uid: uid, dist2: dist2, pad2: pad2, fmtTime: fmtTime, floorY: floorY, propSeed: propSeed, seededF: seededF, seededI: seededI, seededPick: seededPick, mixHex: mixHex, hexCss: hexCss,
      hook: hook, runHooks: runHooks, sfx: sfx, toast: toast, logEvent: logEvent, save: save, buildProp: buildProp, removePropInst: removePropInst, touchScreen: touchScreen, screens: screens, screenDirtyAll: screenDirtyAll, scBg: scBg, scHead: scHead, scText: scText, scButton: scButton, openPanel: openPanel, closePanel: closePanel, pay: pay, terrainY: terrainY, TERRAIN: TERRAIN, LAYOUT: LAYOUT };
    if (CO.game && CO.game.editorKit) { var G = typeof CO.game.editorKit === 'function' ? CO.game.editorKit() : CO.game.editorKit; for (var k in G) K[k] = G[k]; }
    return K;
  }
  var ORIG_BUILD = {};
  // code the editor runs (a build function, a whole definition, a pack) runs inside the engine's own scope by a direct eval here, so it sees every name a part of the game sees (0.6.0; before, only the kit's names)
  function closureRun(src) { return eval(src); }
  function editorCompile(code, what) {
    var fn; try { fn = closureRun('(' + code + '\n)'); } catch (e) { return { error: 'the ' + what + ' code does not parse: ' + e.message }; }
    if (typeof fn !== 'function') return { error: 'the ' + what + ' code must be a function expression: function (c, P, inst) { ... }' };
    return { fn: fn };
  }
  function propTypeIds(type) { var ids = []; if (PROPS[type] && !PROPS[type].extra) ids.push(type); LAYOUT.placed.forEach(function (p) { if (p.type === type && !PROPS[p.id]) ids.push(p.id); }); (S && S.custom || []).forEach(function (c) { if (c.type === type) ids.push(c.id); }); return ids; }
  function rebuildType(type) { var n = 0, err = null; propTypeIds(type).forEach(function (id) { try { rebuildProp(id); n++; } catch (e) { err = err || (id + ': ' + e.message); } }); if (editorSel && propTypeIds(type).indexOf(editorSel) >= 0) editorSelect(propInst[editorSel] ? editorSel : null); return { rebuilt: n, error: err }; }
  // the build code this prop stands on is also another prop's (a pack's loop, a builder used twice): saving over it would reshape them all
  function buildShared(type) { var b0 = ORIG_BUILD[type] || PROPS[type].build, s0 = b0 ? b0.toString() : ''; if (!s0) return false; for (var k in PROPS) { if (k === type) continue; var b = ORIG_BUILD[k] || PROPS[k].build; if (b && (b === b0 || b.toString() === s0)) return true; } return false; }
  function editorSource(type) {
    var def = PROPS[type]; if (!def) return { error: 'no prop definition ' + type };
    var fields = {}; ['label', 'cat', 'x', 'z', 'rot', 'y', 'wall', 'fixed', 'extra', 'price', 'desc', 'lvl', 'ico', 'noBlob'].forEach(function (k) { if (def[k] !== undefined) fields[k] = def[k]; });
    return { type: type, fields: fields, build: def.build ? def.build.toString() : null, after: def.after ? def.after.toString() : null, original: ORIG_BUILD[type] ? ORIG_BUILD[type].toString() : null, modified: !!ORIG_BUILD[type] && def.build !== ORIG_BUILD[type], shared: buildShared(type) || !!MODEL_OVER[type], canOverride: true, instances: propTypeIds(type), kit: Object.keys(editorKit()) };
  }
  // the new build function takes over every placed instance of the type at once; a build that throws is refused and the previous one comes back
  function editorPreview(type, code) {
    var def = PROPS[type]; if (!def) return { ok: false, error: 'no prop definition ' + type };
    var c = editorCompile(code, 'build'); if (c.error) return { ok: false, error: c.error };
    if (!ORIG_BUILD[type]) ORIG_BUILD[type] = def.build;
    var was = def.build; def.build = c.fn;
    var r = rebuildType(type);
    if (r.error) { def.build = was; rebuildType(type); return { ok: false, error: 'the new build threw, the previous one is back: ' + r.error }; }
    return { ok: true, rebuilt: r.rebuilt, modified: def.build !== ORIG_BUILD[type] };
  }
  function editorRevert(type) { var def = PROPS[type]; if (!def) return { ok: false, error: 'no prop definition ' + type }; if (ORIG_BUILD[type]) { def.build = ORIG_BUILD[type]; delete ORIG_BUILD[type]; } var r = rebuildType(type); return { ok: !r.error, rebuilt: r.rebuilt, error: r.error }; }
  // a whole definition, run live: defProp(id, { ... }). A placed one (x, z, not extra) builds at once; an extra one joins the assets
  function editorDefine(code) {
    var n0 = PROP_ORDER.length, known = PROP_ORDER.slice();
    try { closureRun(code + '\n'); } catch (e) { return { ok: false, error: 'the definition does not run: ' + e.message }; }
    var added = PROP_ORDER.slice(n0); if (!added.length) return { ok: false, error: 'the code ran but defined no prop: it should call defProp(id, { ... })' };
    PROP_ORDER.length = n0; var ids = []; added.forEach(function (k) { if (ids.indexOf(k) < 0) ids.push(k); if (PROP_ORDER.indexOf(k) < 0) PROP_ORDER.push(k); });   /* a redefinition keeps its place in the order; a pack adds many */
    var id = ids[ids.length - 1], def = PROPS[id], built = 0, redefined = [];
    for (var q = 0; q < ids.length; q++) {
      var k2 = ids[q], d2 = PROPS[k2];
      if (known.indexOf(k2) >= 0) { delete ORIG_BUILD[k2]; var rr = rebuildType(k2); if (rr.error) return { ok: false, id: k2, error: 'the new definition does not build: ' + rr.error }; built += rr.rebuilt; redefined.push(k2); }
      else if (!d2.extra && typeof d2.x === 'number' && typeof d2.z === 'number') { try { buildProp(k2); built++; } catch (e) { delete PROPS[k2]; PROP_ORDER.splice(PROP_ORDER.indexOf(k2), 1); return { ok: false, id: k2, error: 'the new prop ' + k2 + ' does not build: ' + e.message }; } }
    }
    return { ok: true, id: id, ids: ids, built: ids.length === 1 ? built > 0 : built, extra: !!def.extra, redefined: ids.length === 1 ? redefined.length > 0 : redefined };
  }

  // ── The layout the game ships: what the editor writes into src/00-layout.js, and the moment it did ──
  function sameSpot(a, b) { return a.x === b.x && a.z === b.z && (a.rot || 0) === (b.rot || 0) && (a.h || 0) === (b.h || 0) && !!a.hidden === !!b.hidden; }
  function editorLayout() {
    var props = {}, placed = [], changed = 0, pendingCopies = 0;
    PROP_ORDER.forEach(function (id) { var d = PROPS[id]; if (d.extra) return; var P = propPlacement(id), D = propDefault(id), def = { x: d.x, z: d.z, rot: d.rot || 0, h: 0, hidden: false }; if (!sameSpot(P, D)) changed++; if (!sameSpot(P, def)) props[id] = { x: P.x, z: P.z, rot: P.rot, h: P.h || 0, hidden: !!P.hidden }; });
    LAYOUT.placed.forEach(function (p) { if (PROPS[p.id]) return; var P = propPlacement(p.id); if (!sameSpot(P, propDefault(p.id))) changed++; if (!P.hidden) placed.push({ id: p.id, type: p.type, x: P.x, z: P.z, rot: P.rot, h: P.h || 0 }); });
    (S && S.custom || []).forEach(function (c) { if (!PROPS[c.type] || placedById(c.id)) return; var P = propPlacement(c.id); if (!P.hidden) { placed.push({ id: c.id, type: c.type, x: P.x, z: P.z, rot: P.rot, h: P.h || 0 }); pendingCopies++; } });
    var lines = ['//@ the layout the editor saved: where the props stand and the copies that ship with the game. Written by the Co Engine editor; it sorts first in src/ so the boot sees it. Move things in the editor rather than here.', '  CO.layout({', '    props: {'];
    Object.keys(props).sort().forEach(function (id) { var p = props[id]; lines.push('      ' + JSON.stringify(id) + ': { x: ' + p.x + ', z: ' + p.z + ', rot: ' + p.rot + ', h: ' + p.h + (p.hidden ? ', hidden: true' : '') + ' },'); });
    lines.push('    },', '    placed: [');
    placed.forEach(function (p) { lines.push('      { id: ' + JSON.stringify(p.id) + ', type: ' + JSON.stringify(p.type) + ', x: ' + p.x + ', z: ' + p.z + ', rot: ' + p.rot + ', h: ' + p.h + ' },'); });
    lines.push('    ]', '  });', '');
    return { props: props, placed: placed, changed: changed, copies: placed.length, pending: changed + pendingCopies, code: lines.join('\n') };
  }
  // the file is written: what it says is now the baseline, the copies it carries leave the save, and overrides equal to the baseline go
  function editorLayoutAdopt(L) {
    L = L || editorLayout(); LAYOUT.props = {}; for (var k in L.props) LAYOUT.props[k] = L.props[k]; LAYOUT.placed = (L.placed || []).slice();
    var moved = []; if (S.custom) S.custom = S.custom.filter(function (c) { if (placedById(c.id)) { moved.push(c.id); return false; } return true; });
    if (S.layout) Object.keys(S.layout).forEach(function (id) { if (!PROPS[id] && !placedById(id) && !customById(id)) return; if (sameSpot(propPlacement(id), propDefault(id))) delete S.layout[id]; });
    moved.forEach(function (id) { buildProp(id); }); save();
    return { adopted: true, props: Object.keys(LAYOUT.props).length, placed: LAYOUT.placed.length, pending: editorLayout().pending };
  }

  // ── Drop: a placed prop falls under physics from where it is (or from a height) and its resting place goes into the layout ──
  var dropping = {};
  function editorDrop(id, fromHeight) {
    var inst = propInst[id]; if (!inst) return { error: id + ' is not a placed prop' }; if (dropping[id]) return { error: id + ' is already falling' };
    var g = inst.g; if (fromHeight) g.position.y += +fromHeight;
    var before = layoutSnap(id), B = body(g, { mass: 1, restitution: 0.1, friction: 0.7 }); B.ignoreOwn = id; dropping[id] = { t: 0, B: B, before: before };
    return { ok: true, id: id, from: rnd(g.position.y) };
  }
  hook('frame', function (dt) {
    for (var id in dropping) {
      var D = dropping[id], g = D.B.obj; D.t += dt;
      if (D.B.asleep || D.t > 6) {
        removeBody(g); delete dropping[id]; var P = propPlacement(id), ground = propGroundY(g.position.x, g.position.z);
        if (!S.layout) S.layout = {}; var L = S.layout[id] = S.layout[id] || { x: P.x, z: P.z, rot: P.rot, h: P.h || 0 }; L.x = Math.round(g.position.x * 100) / 100; L.z = Math.round(g.position.z * 100) / 100; L.h = Math.max(0, Math.round((g.position.y - ground) * 100) / 100);
        rebuildProp(id); save(); var after = layoutSnap(id), bef = D.before; histPush('drop ' + id, function () { layoutRestore(id, bef); }, function () { layoutRestore(id, after); });
        if (editorSel === id) editorSelect(id); console.log('[co-editor] ' + JSON.stringify({ dropped: id, x: L.x, z: L.z, h: L.h }));
      }
    }
  });

  // ── The profiler: the frame's phases and the renderer's counts, sampled while the editor's profiler is open ──
  var PROF = { on: false, ring: [], max: 120, cur: null };
  function profBegin() { if (!PROF.on) return; PROF.cur = { t0: performance.now(), sim: 0, world: 0, present: 0, ui: 0, render: 0, total: 0 }; }
  function profMark(k, t) { if (!PROF.on || !PROF.cur) return; PROF.cur[k] += performance.now() - t; }
  function profEnd() { if (!PROF.on || !PROF.cur) return; var c = PROF.cur; c.total = performance.now() - c.t0; PROF.ring.push(c); if (PROF.ring.length > PROF.max) PROF.ring.shift(); PROF.cur = null; }
  function rnd2(v) { return Math.round(v * 100) / 100; }
  function editorProfile(on) {
    if (on !== undefined) { PROF.on = !!on; if (!PROF.on) PROF.ring.length = 0; }
    var r = PROF.ring, n = r.length, sum = { sim: 0, world: 0, present: 0, ui: 0, render: 0, total: 0 }, mx = 0, totals = [], k;
    r.forEach(function (c) { for (k in sum) sum[k] += c[k]; mx = Math.max(mx, c.total); totals.push(c.total); });
    var sorted = totals.slice().sort(function (a, b) { return a - b; }), p95 = n ? rnd2(sorted[Math.min(n - 1, Math.floor(n * 0.95))]) : 0, avg = {}; for (k in sum) avg[k] = n ? rnd2(sum[k] / n) : 0;
    var wall = n > 1 ? (r[n - 1].t0 - r[0].t0) / (n - 1) : 0, info = renderer.info, mem = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null, lights = 0; scene.traverse(function (o) { if (o.isLight) lights++; });
    return { on: PROF.on, frames: n, fps: wall ? Math.round(1000 / wall) : null, avg: avg, max: rnd2(mx), p95: p95, samples: r.map(function (c) { return [rnd2(c.sim), rnd2(c.world), rnd2(c.present), rnd2(c.ui), rnd2(c.render), rnd2(c.total)]; }),
      draws: post.calls || info.render.calls, triangles: post.tris || info.render.triangles, lines: info.render.lines, points: info.render.points, geometries: info.memory.geometries, textures: info.memory.textures, programs: info.programs ? info.programs.length : null, heapMB: mem,
      counts: { baked: baked.meshes.length, bakedDraws: baked.draws, inter: inter.length, dyn: dyn.length, solids: solids.length, animated: animated.length, lights: lights, props: Object.keys(propInst).length, lightBudget: lightBudget.n, shadows: !!renderer.shadowMap.enabled } };
  }

  CO.editor = {
    on: false, drag: false, bind: editorBind,
    tree: editorTree, children: editorChildren, inspect: editorInspect, set: editorSet, select: editorSelect, pick: editorPick, frame: editorFrame, spawn: editorSpawn, remove: editorRemove, assets: editorAssets, shot: editorShot,
    mode: editorMode, enter: editorEnter, pause: function (v) { CO.paused = v === undefined ? !CO.paused : !!v; return CO.paused; }, step: function () { CO.stepOnce = true; return 'step'; },
    selected: function () { return editorSel; }, state: function () { return devState(); }, sfx: function (k) { sfx(k); return k; }, command: function (name, arg) { return devCommand(name, arg); }, log: function (n) { return S && S.log ? S.log.slice(0, n || 30) : []; },
    undo: editorUndoStep, redo: editorRedoStep, history: editorHistory, get: editorGet,
    source: editorSource, preview: editorPreview, revert: editorRevert, define: editorDefine, kit: function () { return Object.keys(editorKit()); },
    profile: editorProfile, adopt: function (type) { delete ORIG_BUILD[type]; return 'ok'; },
    layout: editorLayout, layoutAdopt: editorLayoutAdopt,
    setTool: editorSetTool, tool: function () { return editorTool; },
    setTool: editorSetTool, tool: function () { return editorTool; },
    terrain: terrainState, terrainY: terrainY, terrainBrush: function (x, z, mode, radius, strength, tex) { if (!TERRAIN.on) return terrainBrush(x, z, mode, radius, strength, tex); var bh = Float32Array.from(TERRAIN.heights), bp = Uint8Array.from(TERRAIN.paint), r = terrainBrush(x, z, mode, radius, strength, tex); if (r && r.changed) { var ah = Float32Array.from(TERRAIN.heights), ap = Uint8Array.from(TERRAIN.paint); histPush('terrain ' + mode, function () { terrainRestore(bh, bp); }, function () { terrainRestore(ah, ap); }); } return r; }, terrainPick: terrainPick, terrainCode: terrainCode, terrainScatter: terrainScatter,
    terrainNew: function (cfg) { cfg = cfg || {}; var T = CO.terrain({ w: cfg.w || 48, d: cfg.d || 48, cell: cfg.cell || 1, x0: cfg.x0, z0: cfg.z0, palette: cfg.palette, maxH: cfg.maxH }); if (!T.mesh) terrainBuild(); NAV.dirty = true; return terrainState(); },
    terrainOff: function () { var T = TERRAIN; if (T.mesh) { if (T.mesh.parent) T.mesh.parent.remove(T.mesh); T.mesh = null; } T.on = false; T.heights = null; T.paint = null; NAV.dirty = true; shadowDirty = true; return terrainState(); },
    materials: matGraphs, material: function (name, graph) { var prev = MATGRAPH[name] ? JSON.parse(JSON.stringify(MATGRAPH[name])) : null, next = JSON.parse(JSON.stringify(graph || {})); matBuild(name, next); histPush('material ' + name, function () { if (prev) matBuild(name, prev); else matRemove(name); }, function () { matBuild(name, next); }); return { ok: true, name: name, shot: matShot(name) }; }, materialShot: matShot, materialCode: matGraphCode, materialRemove: matRemove,
    clips: clipList, clip: function (name, clip) { if (!name) return { error: 'a clip needs a name' }; var c = CO.clip(name, clip); return { ok: true, name: name, duration: c.duration, tracks: c.tracks.length }; }, clipRemove: function (name) { if (!CLIPS[name]) return false; CO.clip(name, null); return true; }, clipCode: clipCode,
    clipPlay: function (id, name, opt) { var o = eobj(id); if (!o) return { error: 'no such object ' + id }; if (!CLIPS[name]) return { error: 'no clip ' + name }; var P = playClip(o, name, opt || {}); return P ? { ok: true, name: name, tracks: P.tracks.length, duration: P.clip.duration, loop: P.loop } : { error: 'the clip did not start' }; },
    clipStop: function (id) { var o = eobj(id); if (o) stopClip(o); return !!o; },
    clipSeek: function (id, name, t) { var o = eobj(id), c = CLIPS[name]; if (!o || !c) return { error: 'no such object or clip' }; stopClip(o); c.tracks.forEach(function (tr) { var tg = clipTarget(o, tr.path); if (tg) { var v = trackValue(tr.keys, t); if (v !== undefined) tg.set(v); } }); return { ok: true, t: t }; },
    clipKey: function (id, name, t, ease) { var o = eobj(id); if (!o) return { error: 'no such object ' + id }; var n = clipKeyPose(o, name, +t || 0, ease); return n === null ? { error: 'no clip ' + name } : { ok: true, keyed: n, t: +t || 0 }; },
    clipPaths: function (id) { var o = eobj(id); if (!o) return []; var u = o.userData || {}, out = ['position.x', 'position.y', 'position.z', 'rotation.x', 'rotation.y', 'rotation.z', 'scale.x', 'scale.y', 'scale.z', 'visible']; if (u.legs) ['leg.0', 'leg.1', 'knee.0', 'knee.1', 'arm.0', 'arm.1', 'elbow.0', 'elbow.1', 'torso', 'head'].forEach(function (p) { out.push(p + '.rotation.x', p + '.rotation.y', p + '.rotation.z'); out.push(p + '.position.y'); }); o.children.forEach(function (ch, i) { if (ch.userData.editor) return; ['rotation.x', 'rotation.y', 'rotation.z', 'position.x', 'position.y', 'position.z'].forEach(function (f) { out.push('child.' + i + '.' + f); }); if (ch.name) out.push('name.' + ch.name + '.rotation.y'); }); return out; },
    npcs: npcData, npcsCode: npcCode, npcSpawn: npcSpawnNow, npcInfo: npcInfo, npcAim: npcAim, npcClear: npcClear,
    npcsSet: function (data) { var prev = npcData(), next = JSON.parse(JSON.stringify(data || {})); CO.npcs(next); histPush('NPCs', function () { CO.npcs(prev); }, function () { CO.npcs(next); }); return npcData(); },
    atMenu: menusAtMenu,
    menus: menusData, menusCode: menusCode, menusSeed: menusSeed, menusPreview: menusPreview,
    menusSet: function (data) { var prev = menusData(), next = JSON.parse(JSON.stringify(data || {})); CO.menus(next); histPush('Menus', function () { CO.menus(prev); }, function () { CO.menus(next); }); return menusData(); },
    ui: uiData, uiSet: function (data) { var prev = uiData(), next = JSON.parse(JSON.stringify(data || {})); CO.ui(next); if (ui.panelOpen) renderPanel(); histPush('UI', function () { CO.ui(prev); }, function () { CO.ui(next); }); return uiData(); },
    tables: tablesList, tableSet: tableSet, tablesCode: tablesCode, uiCode: uiCode, uiOpen: function (kind) { openPanel(kind); return !!UI.panels[kind]; }, uiEval: uiEval,
    packCode: function (types) { var ids = (types && types.length ? types : PROP_ORDER.filter(function (id) { return !/^pk[A-Z]/.test(id); })).filter(function (id) { return PROPS[id] && PROPS[id].build; }); var lines = ['//@ a pack made in the Co Engine editor from ' + (CO.game && CO.game.handle || 'a game') + '\'s props. A prop that calls the game\'s own functions needs them in the game it goes to.']; ids.forEach(function (id) { var d = PROPS[id], f = {}; ['label', 'cat', 'wall', 'fixed', 'price', 'desc', 'lvl', 'ico', 'noBlob'].forEach(function (k) { if (d[k] !== undefined) f[k] = d[k]; }); f.extra = true; f.shop = false; var body = JSON.stringify(f); lines.push('  defProp(' + JSON.stringify(id) + ', Object.assign(' + body + ', { build: ' + d.build.toString() + (d.after ? ', after: ' + d.after.toString() : '') + ' }));'); }); return { ids: ids, code: lines.join('\n') + '\n' }; },
    run: function (code) { var r = closureRun(String(code)); try { return r === undefined ? null : JSON.parse(JSON.stringify(r)); } catch (e) { return String(r); } },
    model: modelOf, modelPreview: modelPreview, modelStart: modelStart, modelPick: modelPick, modelMirror: modelMirror, modelCode: modelCode, modelConvert: modelConvert, worldCode: worldCode, selection: function () { return editorMulti.slice(); }, duplicate: editorDuplicate, copy: editorCopy, paste: editorPaste, worldCopies: function () { return WORLD_COPIES.slice(); }, selectMany: function (ids) { editorMulti = (ids || []).filter(function (k) { return !!eobj(k); }); editorSel = editorMulti[editorMulti.length - 1] || null; editorHelpersShow(); return editorMulti.slice(); }, moveSel: editorMoveSel, removeSel: editorRemoveSel, worldItems: function () { return WORLD_ITEMS.map(function (o) { return { id: eid(o), key: o.userData.worldKey, name: worldName(o), hidden: !o.visible }; }); },
    physics: physicsState, bodyAdd: function (id, opt) { var o = eobj(id); if (!o) return { error: 'no such object ' + id }; var B = body(o, opt || {}); return { ok: true, id: B.id, size: [B.hx * 2, B.hy * 2, B.hz * 2] }; }, bodyRemove: function (id) { var o = eobj(id); return !!o && removeBody(o); }, impulse: function (id, vx, vy, vz) { var o = eobj(id); return !!o && impulse(o, vx, vy, vz); },
    springAdd: function (id, opt) { var o = eobj(id); if (!o) return { error: 'no such object ' + id }; var S2 = spring(o, opt || {}); return { ok: true, anchor: S2.anchor, k: S2.k }; }, springRemove: function (id) { var o = eobj(id); return !!o && unspring(o); },
    drop: editorDrop, hingeAdd: function (id, opt) { var o = eobj(id); if (!o) return { error: 'no such object ' + id }; var H = hinge(o, opt || {}); return { ok: true, pivot: H.pivot, length: H.length, axis: H.axis }; }, hingeRemove: function (id) { var o = eobj(id); return !!o && removeHinge(o); },
    ids: function () { return { props: Object.keys(propInst), objects: Object.keys(EOBJ) }; }
  };
  // ── The prop modeller ─────────────────────────────────────────────
  // A part: { kind, mat, x, y, z, ry (degrees), name } plus, by kind: box { w, h, d, r (bevel) }, cyl { r, h, seg, rb }, sphere { r },
  // plane { w, h, rx }, sign { lines, w, h }, light { color, intensity, dist }, solid { w, d, h } (an obstacle, not drawn), hit { w, h, d, prompt }.
  // A model: { parts: [...], autoSolid: true } (autoSolid adds one obstacle around every box and cylinder that touches the ground).
  var MODEL_MARK = '/*@model ';
  function modelFrom(code) { var i = String(code || '').indexOf(MODEL_MARK); if (i < 0) return null; var j = code.indexOf('*/', i); if (j < 0) return null; try { return JSON.parse(code.slice(i + MODEL_MARK.length, j).trim()); } catch (e) { return null; } }
  function n2(v) { return Math.round((+v || 0) * 1000) / 1000; }
  function matRef(m) { return /^[A-Za-z_]\w*$/.test(m || '') ? 'MAT.' + m : 'MAT.grey'; }
  function packMat(pk, path, hex, rough, metal) { var get = CO.packMats && CO.packMats[pk], v = get ? get() : null; String(path).split('.').forEach(function (k) { v = v && typeof v === 'object' ? v[k] : null; }); return v && v.isMaterial ? v : hex ? modelMat(hex, rough === undefined ? 0.8 : rough, metal || 0) : MAT.grey; }
  function partMat(p) { if (p.img && !p.mat) return 'modelImgMat(' + JSON.stringify(p.img) + ', ' + JSON.stringify(p.color || '#ffffff') + ', ' + (p.basic ? 1 : 0) + ', ' + (p.clear || 0) + ', ' + n2(p.rough === undefined ? 0.8 : p.rough) + ', ' + n2(p.metal || 0) + ')'; if (p.mat && p.mat.indexOf('/') > 0) { var sl = p.mat.indexOf('/'); return 'packMat(' + JSON.stringify(p.mat.slice(0, sl)) + ', ' + JSON.stringify(p.mat.slice(sl + 1)) + (p.color ? ', ' + JSON.stringify(p.color) + ', ' + n2(p.rough === undefined ? 0.8 : p.rough) + ', ' + n2(p.metal || 0) : '') + ')'; } return !p.mat && p.color ? 'modelMat(' + JSON.stringify(p.color) + ', ' + n2(p.rough === undefined ? 0.8 : p.rough) + ', ' + n2(p.metal || 0) + (p.glow || p.opacity !== undefined ? ', ' + JSON.stringify(p.glow || '') : '') + (p.opacity !== undefined ? ', ' + n2(p.opacity) : '') + ')' : matRef(p.mat); }
  function modelPartCode(p, i) {
    var x = n2(p.x), y = n2(p.y), z = n2(p.z), ry = (p.rx || p.rz) && p.kind !== 'plane' ? ' p' + i + '.rotation.set(' + n2((p.rx || 0) * Math.PI / 180) + ', ' + n2((p.ry || 0) * Math.PI / 180) + ', ' + n2((p.rz || 0) * Math.PI / 180) + ', "YXZ");' : p.ry ? ' p' + i + '.rotation.y = ' + n2(p.ry * Math.PI / 180) + ';' : '', tag = ' p' + i + '.userData.part = ' + i + ';';
    if (p.kind === 'box') return p.r ? 'var p' + i + ' = box(' + n2(p.w) + ', ' + n2(p.h) + ', ' + n2(p.d) + ', ' + partMat(p) + ', ' + x + ', ' + y + ', ' + z + ', { parent: c.group, r: ' + n2(p.r) + ' });' + ry + tag : 'var p' + i + ' = c.box(' + n2(p.w) + ', ' + n2(p.h) + ', ' + n2(p.d) + ', ' + partMat(p) + ', ' + x + ', ' + y + ', ' + z + ');' + ry + tag;
    if (p.kind === 'mesh') { var vs = (p.verts || []).map(function (q) { return [n2(q[0]), n2(q[1]), n2(q[2])]; }), fs = (p.faces || []).map(function (q) { return [q[0] | 0, q[1] | 0, q[2] | 0]; }); return 'var p' + i + ' = (function () { var V = ' + JSON.stringify(vs) + ', F = ' + JSON.stringify(fs) + ', pos = [], map = []; F.forEach(function (f) { f.forEach(function (k) { pos.push(V[k][0], V[k][1], V[k][2]); map.push(k); }); }); var geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals(); var m = new THREE.Mesh(geo, ' + partMat(p) + '); m.castShadow = m.receiveShadow = true; m.userData.vertexEdit = true; m.userData.vertMap = map; return c.add(m); })(); p' + i + '.position.set(' + x + ', ' + y + ', ' + z + ');' + ry + tag; }
    if (p.kind === 'lathe') return 'var p' + i + ' = c.add(new THREE.Mesh(new THREE.LatheGeometry(' + JSON.stringify((p.points || [[0.3, 0], [0.4, 0.5], [0.2, 1]]).map(function (q) { return [n2(q[0]), n2(q[1])]; })) + '.map(function (q) { return new THREE.Vector2(q[0], q[1]); }), ' + (p.seg || 24) + '), ' + partMat(p) + ')); p' + i + '.position.set(' + x + ', ' + y + ', ' + z + '); p' + i + '.castShadow = p' + i + '.receiveShadow = true;' + ry + tag;
    if (p.kind === 'extrude') return 'var p' + i + ' = c.add(new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape(' + JSON.stringify((p.shape || [[-0.5, 0], [0.5, 0], [0, 0.8]]).map(function (q) { return [n2(q[0]), n2(q[1])]; })) + '.map(function (q) { return new THREE.Vector2(q[0], q[1]); })), { depth: ' + n2(p.depth || 0.2) + ', bevelEnabled: false }), ' + partMat(p) + ')); p' + i + '.position.set(' + x + ', ' + y + ', ' + z + '); p' + i + '.castShadow = p' + i + '.receiveShadow = true;' + ry + tag;
    if (p.kind === 'cyl') return 'var p' + i + ' = c.cyl(' + n2(p.r) + ', ' + n2(p.h) + ', ' + partMat(p) + ', ' + x + ', ' + y + ', ' + z + (p.seg || p.rb ? ', ' + (p.seg || 16) + (p.rb ? ', ' + n2(p.rb) : '') : '') + ');' + ry + tag;
    if (p.kind === 'sphere') return 'var p' + i + ' = c.sphere(' + n2(p.r) + ', ' + partMat(p) + ', ' + x + ', ' + y + ', ' + z + ');' + tag;
    if (p.kind === 'plane') return 'var p' + i + ' = c.plane(' + n2(p.w) + ', ' + n2(p.h) + ', ' + partMat(p) + ', ' + x + ', ' + y + ', ' + z + ', ' + n2((p.rx || 0) * Math.PI / 180) + ', ' + n2((p.ry || 0) * Math.PI / 180) + ');' + tag;
    if (p.kind === 'sign') return 'var p' + i + ' = c.sign(' + JSON.stringify(p.lines || ['SIGN']) + ', ' + n2(p.w || 1) + ', ' + n2(p.h || 0.4) + ', ' + x + ', ' + y + ', ' + z + ', ' + n2((p.ry || 0) * Math.PI / 180) + (p.opt ? ', ' + JSON.stringify(p.opt) : '') + ');' + (' if (p' + i + ' && p' + i + '.userData) p' + i + '.userData.part = ' + i + ';');
    if (p.kind === 'light') return 'var p' + i + ' = c.light(' + JSON.stringify(p.color || '#ffd9a0') + ', ' + n2(p.intensity || 1) + ', ' + n2(p.dist || 8) + ', ' + x + ', ' + y + ', ' + z + ');' + tag;
    if (p.kind === 'solid') return 'c.solid(' + n2(x - p.w / 2) + ', ' + n2(x + p.w / 2) + ', ' + n2(z - p.d / 2) + ', ' + n2(z + p.d / 2) + ', ' + n2(y) + ', ' + n2(y + p.h) + ');';
    if (p.kind === 'hit') return 'c.hit(' + n2(p.w) + ', ' + n2(p.h) + ', ' + n2(p.d) + ', ' + x + ', ' + y + ', ' + z + ', { prompt: function () { return ' + JSON.stringify(p.prompt || 'Use it') + '; }, use: function () { toast(' + JSON.stringify(p.prompt || 'Used') + ', ""); } });';
    return '';
  }
  function modelCode(model) {
    model = model || { parts: [] }; var lines = ['function (c, P, inst) {', '  ' + MODEL_MARK + JSON.stringify(model) + ' */'];
    (model.parts || []).forEach(function (p, i) { var l = modelPartCode(p, i); if (l) lines.push('  ' + l); });
    if (model.autoSolid !== false) (model.parts || []).forEach(function (p) { if ((p.kind === 'box' || p.kind === 'cyl') && n2(p.y) - (p.kind === 'box' ? p.h : p.h) / 2 < 0.3) { var hw = p.kind === 'box' ? p.w / 2 : p.r, hd = p.kind === 'box' ? p.d / 2 : p.r, top = n2(p.y) + p.h / 2; lines.push('  c.solid(' + n2(p.x - hw) + ', ' + n2(p.x + hw) + ', ' + n2(p.z - hd) + ', ' + n2(p.z + hd) + ', 0, ' + n2(top) + ');'); } });
    lines.push('}'); return lines.join('\n');
  }
  function modelOf(type) { var def = PROPS[type]; if (!def || !def.build) return { error: 'no prop definition ' + type }; var src = def.build.toString(), m = modelFrom(src); return { type: type, model: m, modelled: !!m, code: src, mats: modelMatList(m) }; }
  function modelMatList(m) { var out = Object.keys(MAT).filter(function (k) { return k !== 'hit'; }); ((m && m.parts) || []).forEach(function (p) { if (p.mat && out.indexOf(p.mat) < 0) out.push(p.mat); }); return out; }
  function modelPreview(type, model) { var code = modelCode(model); var r = editorPreview(type, code); r.code = code; return r; }
  function modelStart(type) { var def = PROPS[type]; if (!def) return { error: 'no prop definition ' + type }; var m = { parts: [{ kind: 'box', mat: 'wood', x: 0, y: 0.5, z: 0, w: 1, h: 1, d: 1, ry: 0 }], autoSolid: true }; return modelPreview(type, m).ok ? { ok: true, model: m, code: modelCode(m) } : { error: 'the first box did not build' }; }
  // which part of a modelled prop is under a viewport point
  function modelPick(type, nx, ny) { var ids = propTypeIds(type); scene.updateMatrixWorld(true); eRay.setFromCamera({ x: nx || 0, y: ny || 0 }, camera); eRay.far = 120; for (var k = 0; k < ids.length; k++) { var inst = propInst[ids[k]]; if (!inst) continue; var hits = eRay.intersectObject(inst.g, true); for (var i = 0; i < hits.length; i++) { var o = hits[i].object; while (o && o !== inst.g) { if (o.userData && o.userData.part !== undefined) return { part: o.userData.part, id: ids[k], distance: rnd(hits[i].distance) }; o = o.parent; } } } return null; }
  function modelMirror(model, axis) { var m = JSON.parse(JSON.stringify(model)); m.parts.forEach(function (p) { if (axis === 'z') { p.z = -n2(p.z); if (p.ry) p.ry = -p.ry; if (p.rx) p.rx = -p.rx; if (p.verts) p.verts.forEach(function (v) { v[2] = -v[2]; }); } else { p.x = -n2(p.x); if (p.ry) p.ry = -p.ry; if (p.rz) p.rz = -p.rz; if (p.verts) p.verts.forEach(function (v) { v[0] = -v[0]; }); } if (p.faces) p.faces.forEach(function (f) { var s = f[1]; f[1] = f[2]; f[2] = s; }); }); return m; }
  // ── Parts from a prop drawn in code (0.8.0) ──────────────────────
  // The selected prop's placed copy is read back as a model: every box, cylinder, sphere and plane keeps its size and turn, a sign
  // keeps its lines, a light its colour, a use box its prompt, an obstacle becomes a solid, and any other shape becomes a mesh of
  // its corners (vertex drag works on it). A material the palette names keeps its name; any other keeps its colour, roughness,
  // metalness and glow (a picture or a texture drawn in code becomes its plain colour). Nothing is built to read it: the copy that
  // stands is what is read, so no stray uses or screens are left behind.
  var modelMats = {}, modelImgs = {};
  // a picture drawn in code, carried in the model as a PNG (at most 512 px a side) and made into a material once per picture
  function modelImgMat(src, hex, basic, clear, rough, metal) {
    var k = src.length + ':' + src.slice(-48) + hex + basic + clear + rough + metal; if (modelImgs[k]) return modelImgs[k];
    var t = new THREE.TextureLoader().load(src); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8;
    var o = { map: t, color: new THREE.Color(hex), transparent: !!clear, opacity: typeof clear === 'number' && clear > 0 && clear < 1 ? clear : 1 }; return (modelImgs[k] = basic ? new THREE.MeshBasicMaterial(o) : std(Object.assign(o, { roughness: rough, metalness: metal })));
  }
  function imgOf(map) { var im = map && map.image; if (!im || !(im.width > 0) || !(im.height > 0)) return null; try { var s = Math.min(1, 512 / Math.max(im.width, im.height)), cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(im.width * s)); cv.height = Math.max(1, Math.round(im.height * s)); cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height); return cv.toDataURL('image/png'); } catch (e) { return null; } }
  function modelMat(hex, rough, metal, glow, opacity) { var see = typeof opacity === 'number' && opacity < 1, k = hex + ',' + rough + ',' + metal + ',' + (glow || '') + ',' + (see ? opacity : ''); if (!modelMats[k]) modelMats[k] = std({ color: new THREE.Color(hex), roughness: rough, metalness: metal, emissive: glow ? new THREE.Color(glow) : new THREE.Color(0), emissiveIntensity: glow ? 1 : 0, transparent: see, opacity: see ? opacity : 1, depthWrite: !see }); return modelMats[k]; }
  // which pack names a material: a carried variable, or an entry of a table or a cache one holds ("growco/MAT.wood", "depotco/FABRIC")
  function packMatName(m) {
    if (!m || !CO.packMats) return null;
    for (var pk in CO.packMats) { var vals; try { vals = CO.packMats[pk](); } catch (e) { continue; }
      for (var k in vals) { var v = vals[k]; if (!v || typeof v !== 'object') continue; if (v === m) return pk + '/' + k; if (v.isMaterial || v.isTexture || v.isObject3D || v.isBufferGeometry) continue;
        var ks = Object.keys(v); if (ks.length > 4000) continue; for (var j = 0; j < ks.length; j++) if (v[ks[j]] === m && /^[\w$]+$/.test(ks[j])) return pk + '/' + k + '.' + ks[j]; } }
    return null;
  }
  function modelConvert(type) {
    var def = PROPS[type]; if (!def) return { error: 'no prop definition ' + type };
    var ids = propTypeIds(type), inst = null; for (var k = 0; k < ids.length && !inst; k++) inst = propInst[ids[k]] || null;
    if (!inst) return { error: 'place a ' + (def.label || type) + ' first: the parts are read from a copy that stands' };
    var root = inst.g; root.updateMatrixWorld(true);
    var inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), M = new THREE.Matrix4(), pos = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), eu = new THREE.Euler(), D = 180 / Math.PI;
    var parts = [], stats = { box: 0, cyl: 0, sphere: 0, plane: 0, sign: 0, mesh: 0, light: 0, hit: 0, solid: 0, colour: 0, skipped: 0 }, skip = [];
    function near0(a) { return Math.abs(a) < 1e-3; }
    function hex(c) { return '#' + c.getHexString(); }
    function matOf(m, p) {
      if (Array.isArray(m)) m = m[0];
      for (var key in MAT) if (MAT[key] === m) { p.mat = key; return; }
      var pm = packMatName(m); if (pm) { p.mat = pm; if (m.color) { p.color = hex(m.color); p.rough = typeof m.roughness === 'number' ? n2(m.roughness) : 0.8; p.metal = typeof m.metalness === 'number' ? n2(m.metalness) : 0; } stats.pack = (stats.pack || 0) + 1; return; }
      if (m && m.map && m.map !== (typeof blobTex !== 'undefined' ? blobTex : null)) { var img = imgOf(m.map); if (img) { p.img = img; p.basic = !!m.isMeshBasicMaterial; p.clear = m.transparent ? (m.opacity < 1 ? n2(m.opacity) : 1) : 0; stats.picture = (stats.picture || 0) + 1; } }
      if (!p.img) stats.colour++; p.color = m && m.color ? hex(m.color) : '#888888'; p.rough = m && typeof m.roughness === 'number' ? n2(m.roughness) : 0.8; p.metal = m && typeof m.metalness === 'number' ? n2(m.metalness) : 0;
      if (m && m.emissive && m.emissive.getHex() && (m.emissiveIntensity || 0) > 0) p.glow = hex(m.emissive.clone().multiplyScalar(Math.min(1, m.emissiveIntensity)));
      if (m && m.transparent && m.opacity < 1) p.opacity = n2(m.opacity);
    }
    // a shape whose corners were moved after it was made (a bent frond, a tapered leg) is only what its numbers say if its bounds agree
    function shapeHolds(g, t, P) {
      var b = new THREE.Box3().setFromBufferAttribute(g.attributes.position), ok = function (v, w) { return Math.abs(v - w) < 2e-3; };
      if (t === 'BoxGeometry') return ok(b.min.x, -P.width / 2) && ok(b.max.x, P.width / 2) && ok(b.min.y, -P.height / 2) && ok(b.max.y, P.height / 2) && ok(b.min.z, -P.depth / 2) && ok(b.max.z, P.depth / 2);
      if (t === 'CylinderGeometry') { var rm = Math.max(P.radiusTop, P.radiusBottom); return ok(b.min.y, -P.height / 2) && ok(b.max.y, P.height / 2) && b.max.x <= rm + 2e-3 && b.max.x >= rm * 0.7 && b.max.z <= rm + 2e-3; }
      if (t === 'SphereGeometry') return ok(b.max.y, P.radius) && ok(b.min.y, -P.radius) && ok(b.max.x, P.radius);
      if (t === 'PlaneGeometry') return ok(b.min.x, -P.width / 2) && ok(b.max.x, P.width / 2) && ok(b.min.y, -P.height / 2) && ok(b.max.y, P.height / 2) && ok(b.min.z, 0) && ok(b.max.z, 0);
      return false;
    }
    function under(o, list) { for (var a = o.parent; a && a !== root; a = a.parent) if (list.indexOf(a) >= 0) return true; return false; }
    root.traverse(function (o) {
      if (o === root || under(o, skip)) return;
      for (var a = o; a && a !== root; a = a.parent) if (a.visible === false && !a.userData.bakedAway && !(a.isMesh && a.material === MAT.hit)) return;   /* a piece the static bake merged away is hidden but still part of the prop */
      M.multiplyMatrices(inv, o.matrixWorld); M.decompose(pos, q, sc);
      var x = n2(pos.x), y = n2(pos.y), z = n2(pos.z);
      if (o.isPointLight) { parts.push({ kind: 'light', color: hex(o.color), intensity: n2(o.intensity), dist: n2(o.distance || 8), x: x, y: y, z: z }); stats.light++; return; }
      if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || !o.geometry || (blobMat && o.material === blobMat)) return;   /* the contact shadow is the engine's, laid again under the rebuilt prop */
      var g = o.geometry, P = g.parameters || {}, t = g.type, p = null;
      if (o.material === MAT.hit || (o.material && o.material.visible === false)) {
        if (t !== 'BoxGeometry') return; var it = o.userData.it, pr = null; try { pr = it && (typeof it.prompt === 'function' ? it.prompt() : it.prompt); } catch (e) {}
        parts.push({ kind: 'hit', w: n2(P.width * sc.x), h: n2(P.height * sc.y), d: n2(P.depth * sc.z), x: x, y: y, z: z, prompt: typeof pr === 'string' && pr ? pr : 'The ' + (def.label || type) }); stats.hit++; return;
      }
      var R = new THREE.Matrix4().compose(pos, q, sc), sheared = false; for (var e = 0; e < 16; e++) if (Math.abs(R.elements[e] - M.elements[e]) > 1e-4) sheared = true;   /* a turn under a stretched parent skews: only a mesh holds that */
      eu.setFromQuaternion(q, 'YXZ'); var upright = near0(eu.x) && near0(eu.z);
      if (o.userData.sign && t === 'PlaneGeometry' && upright && !sheared && shapeHolds(g, t, P)) { skip.push(o); p = { kind: 'sign', lines: o.userData.sign.lines, w: n2(P.width * sc.x), h: n2(P.height * sc.y), x: x, y: y, z: z, ry: n2(eu.y * D) }; if (o.userData.sign.opt) p.opt = o.userData.sign.opt; parts.push(p); stats.sign++; return; }
      if (sheared || !shapeHolds(g, t, P)) p = null;
      else if (t === 'BoxGeometry') p = { kind: 'box', w: n2(P.width * Math.abs(sc.x)), h: n2(P.height * Math.abs(sc.y)), d: n2(P.depth * Math.abs(sc.z)) };
      else if (t === 'CylinderGeometry' && Math.abs(sc.x - sc.z) < 1e-3) { p = { kind: 'cyl', r: n2(P.radiusTop * sc.x), h: n2(P.height * sc.y), seg: P.radialSegments }; if (Math.abs(P.radiusBottom - P.radiusTop) > 1e-4) p.rb = n2(P.radiusBottom * sc.x); }
      else if (t === 'SphereGeometry' && Math.abs(sc.x - sc.y) < 1e-3 && Math.abs(sc.x - sc.z) < 1e-3 && upright) p = { kind: 'sphere', r: n2(P.radius * sc.x) };
      else if (t === 'PlaneGeometry') { var ex = new THREE.Euler().setFromQuaternion(q, 'XYZ'); if (near0(ex.z)) { p = { kind: 'plane', w: n2(P.width * sc.x), h: n2(P.height * sc.y), x: x, y: y, z: z, rx: n2(ex.x * D), ry: n2(ex.y * D) }; matOf(o.material, p); parts.push(p); stats.plane++; return; } p = null; }
      if (p) { p.x = x; p.y = y; p.z = z; if (!near0(eu.y)) p.ry = n2(eu.y * D); if (!upright) { p.rx = n2(eu.x * D); p.rz = n2(eu.z * D); } matOf(o.material, p); parts.push(p); stats[p.kind]++; return; }
      // any other shape: a mesh of its corners in the prop's own space, a corner shared where faces meet
      var pa = g.attributes && g.attributes.position; if (!pa || pa.count > 6000) { stats.skipped++; return; }
      var V = [], F = [], seen = {}, v = new THREE.Vector3(), idx = g.index, flip = M.determinant() < 0;
      var vid = function (i) { v.fromBufferAttribute(pa, i).applyMatrix4(M); var key = n2(v.x) + ',' + n2(v.y) + ',' + n2(v.z); if (seen[key] === undefined) { seen[key] = V.length; V.push([n2(v.x), n2(v.y), n2(v.z)]); } return seen[key]; };
      var n = idx ? idx.count : pa.count; for (var f = 0; f + 2 < n; f += 3) { var a0 = vid(idx ? idx.getX(f) : f), a1 = vid(idx ? idx.getX(f + 1) : f + 1), a2 = vid(idx ? idx.getX(f + 2) : f + 2); if (a0 !== a1 && a1 !== a2 && a0 !== a2) F.push(flip ? [a0, a2, a1] : [a0, a1, a2]); }
      if (!F.length) return; p = { kind: 'mesh', x: 0, y: 0, z: 0, verts: V, faces: F }; matOf(o.material, p); parts.push(p); stats.mesh++;
    });
    (inst.ctx && inst.ctx.obstacles || []).forEach(function (ob) { parts.push({ kind: 'solid', w: n2(ob.x1 - ob.x0), d: n2(ob.z1 - ob.z0), h: n2(ob.y1 - ob.y0), x: n2((ob.x0 + ob.x1) / 2), y: n2(ob.y0), z: n2((ob.z0 + ob.z1) / 2) }); stats.solid++; });
    if (!parts.length) return { error: (def.label || type) + ' has nothing to read back' };
    var model = { parts: parts, autoSolid: false }, r = modelPreview(type, model);
    if (!r.ok) return { error: 'the parts did not build: ' + r.error };
    return { ok: true, model: model, code: r.code, stats: stats, mats: modelMatList(model) };
  }
  // ── Boot ──────────────────────────────────────────────────────────
  // The game's last part calls CO.boot(GAME). GAME carries the hooks (they merge into CO.game) and these steps, every one optional:
  //   freshState()             the game's default S              migrate(s, fresh)      its save migrations
  //   afterLoad(loaded)        repairs on S before the world      buildWorld(loaded)     the walls, the props (buildProps), the people
  //   afterBuild(loaded)       meshes for the saved things        startStats(loaded)     the start screen chips, as strings
  //   startNote(loaded)        the line under the chips           onEnter(loaded)        the first thing after the start button
  //   tick(dt)                 the world, once a frame while running    present(dt)     the game's own per-frame presentation
  //   menuCamera(dt)           the camera behind the start screen       hiddenTick(dt)  what still ticks in a hidden tab
  //   T                        what the game adds to the test handle    handle          the window property ('DEPOT')
  //   bake false               skip the static bake                     weather false   no weather state machine
  //   autoplay false           the game's own front menu handles the autoplay flag
  //   input false (in CO.setup)  the game binds its own keys and mouse;  editMode false, photo false, lighting false, hudFields false: those engine passes stay off
  //   render(dt)               the game draws the frame itself (return true)
  var loaded = false, autosaveT = 0, fpsN = 0, fpsT = 0, lastFrame = 0;
  function coBoot(GAME) {
    GAME = GAME || {}; if (!CO.game) CO.game = {}; for (var k in GAME) if (!(k in CO.game)) CO.game[k] = GAME[k]; CO.gameVersion = GAME.version || window[GAME.versionGlobal || 'GAME_VERSION'] || CO.gameVersion;
    loaded = loadSave(GAME.freshState || function () { return { day: 1, time: CAL.dayStart, bank: 0, log: [], ledger: [], stats: { earned: 0, spent: 0 }, layout: {}, custom: [], hdoors: {} }; }, GAME.migrate);
    if (GAME.afterLoad) GAME.afterLoad(loaded);
    runHooks('beforeBuild', loaded);
    terrainBuild();
    if (GAME.buildWorld) GAME.buildWorld(loaded);
    runHooks('afterBuild', loaded);
    if (GAME.afterBuild) GAME.afterBuild(loaded);
    worldEditsApply();   // part 26: what the editor moved, resized or removed of the world, before the bake
    applySettings(); resize();
    if (GAME.bake !== false && !/nobake=1/.test(location.search)) bakeStatic();
    if (!GAME.menuCamera) { camera.position.set(12, 3.6, 0); camera.lookAt(0, 1.4, 0); }   // a game with a menu camera of its own places the camera itself
    var st = $('dc-start-stats'); if (st) st.innerHTML = (GAME.startStats ? GAME.startStats(loaded) : (UI.start.length ? uiStartChips() : [loaded ? 'Day ' + S.day : 'New game'])).map(function (s) { return '<span>' + esc(s) + '</span>'; }).join('');
    var sn = $('dc-start-note'); if (sn) sn.textContent = GAME.startNote ? GAME.startNote(loaded) : ('Slot ' + BOOT_SLOT + (loaded ? ' · last saved ' + (S.savedAt ? new Date(S.savedAt).toLocaleString() : 'never') : ''));
    var sb = $('dc-start-btn'); if (sb) sb.addEventListener('click', enter);
    requestAnimationFrame(frame);
    // a hidden tab gets no animation frames; the world still ticks ten times a second
    setInterval(function () { if (!document.hidden) return; var n = performance.now(), dt = Math.min(0.05, Math.max(0.001, (n - lastFrame) / 1000)); lastFrame = n; worldTime += dt; if (ui.started && !ui.blocked() && !photo.on) { if (CO.game.tick) CO.game.tick(dt); updatePlayer(dt); doorsTick(dt); if (CO.game.hiddenTick) CO.game.hiddenTick(dt); scene.updateMatrixWorld(true); updateFocus(); updatePrompt(); } }, 50);
    window.addEventListener('beforeunload', function () { if (ui.started) saveNow(); });
    var handle = { enter: enter, bootSlot: BOOT_SLOT, version: CO.gameVersion || 'dev', engine: CO.version, T: coHandle() };
    if (GAME.T) { var gt = typeof GAME.T === 'function' ? GAME.T() : GAME.T; for (var tk in gt) handle.T[tk] = gt[tk]; }
    window[GAME.handle || 'CO_GAME'] = handle; CO.handle = handle; window.CO_EDITOR = CO.editor;   // the editor and the MCP server reach the bridge here, outside the closure
    if (/[?&]editor=1/.test(location.search)) { CO.editor.on = true; CO.editor.bind(); }   // opened in the editor's viewport: clicks select, the right button flies
    // <prefix>-autoplay in sessionStorage (or ?autoplay=1) presses the start button on the first frame; GAME.autoplay false leaves
    // the flag to the game's own front menu, which reads and presses it itself
    if (GAME.autoplay !== false) { var auto = false; try { auto = sessionStorage.getItem(CO.save.prefix + '-autoplay') === '1'; if (auto) sessionStorage.removeItem(CO.save.prefix + '-autoplay'); } catch (e) {} if (auto || /[?&]autoplay=1/.test(location.search)) setTimeout(enter, 50); }
    runHooks('boot', loaded);
    return handle;
  }
  function enter() {
    if (ui.started) return;
    ui.started = true; var s = $('dc-start'); if (s) s.hidden = true; var h = $('dc-hud'); if (h) h.hidden = false; hudDirty = true;
    lockPointer(); sfx('ok');
    if (CO.game.onEnter) CO.game.onEnter(loaded);
    if (/[?&]dev=1/.test(location.search) && !devLink.on) devLinkToggle();
    runHooks('enter', loaded);
  }
  // ── The frame loop ────────────────────────────────────────────────
  function frame(nowMs) {
    requestAnimationFrame(frame);
    var dt = Math.min(0.05, Math.max(0.001, (nowMs - lastFrame) / 1000)); lastFrame = nowMs;
    // paused by the editor: the world holds, the scene camera still flies, the frame still draws; one step runs a single frame through
    if (CO.paused && !CO.stepOnce) { if (photo.on && CO.game.photo !== false) photoTick(dt); updateLightBudget(); shadowTick(dt); if (!(CO.game.render && CO.game.render(dt))) renderFrame(dt); return; }
    CO.stepOnce = false; profBegin(); var pf = PROF.on ? performance.now() : 0;
    if (!ui.started) { if (CO.game.menuCamera) CO.game.menuCamera(dt); else { var ma = worldTime * 0.07; camera.position.set(Math.cos(ma) * 12, 3.6 + Math.sin(ma * 1.7) * 0.6, Math.sin(ma) * 9.5); camera.lookAt(Math.cos(ma + 1.2) * 4, 1.4, Math.sin(ma + 1.2) * 3); } }
    if (ui.started && !ui.blocked()) { if (photo.on && CO.game.photo !== false) photoTick(dt); else { if (CO.game.tick) CO.game.tick(dt); if (CO.game.weather !== false) tickWeatherState(dt); updatePlayer(dt); } autosaveT += dt; if (autosaveT > 30) { autosaveT = 0; save(); } }
    profMark('sim', pf); pf = PROF.on ? performance.now() : 0;
    worldTime += dt;
    if (CO.game.lighting !== false) lighting(dt); updateLightBudget(); shadowTick(dt); if (sky.dome || sky.rain) tickSky(dt); tickBursts(dt); doorsTick(dt); drawScreens(dt); editTick(); tickTraffic(dt); npcsTick(dt);
    profMark('world', pf); pf = PROF.on ? performance.now() : 0;
    if (CO.game.present) CO.game.present(dt); runHooks('frame', dt);
    for (var ai = 0; ai < animated.length; ai++) animated[ai](dt);
    profMark('present', pf); pf = PROF.on ? performance.now() : 0;
    updateFocus(); updatePrompt(); updateHud(dt); tickCards(dt); tickDevLink(dt);
    profMark('ui', pf); pf = PROF.on ? performance.now() : 0;
    if (!(CO.game.render && CO.game.render(dt))) renderFrame(dt);
    profMark('render', pf); profEnd();   // a game may render the frame itself (a security camera view, a picture in picture)
    if (SET.fps) { fpsN++; fpsT += dt; if (fpsT >= 0.5) { var f = $('h-fps'); if (f) f.textContent = Math.round(fpsN / fpsT) + ' fps · ' + (post.calls || renderer.info.render.calls) + ' draws'; fpsN = 0; fpsT = 0; } }
  }
  // ── The handle: the engine's part of window.<handle>.T, for the editor and the smoke tests ──
  function coHandle() {
    return {
      get S() { return S; }, CO: CO, editor: CO.editor, player: player, ui: ui, edit: edit, photo: photo, SET: SET, scene: scene, camera: camera, renderer: renderer, baked: baked, MAT: MAT, TEX: TEX, NRM: NRM, solids: solids, dyn: dyn, inter: inter, screens: screens, hdoors: hdoors, lampMeshes: lampMeshes, sky: sky, NAV: NAV, PROPS: PROPS, propInst: propInst, HOOKS: HOOKS,
      run: function (sec) { var n = Math.round(sec / 0.05); for (var i = 0; i < n; i++) { if (CO.game.tick) CO.game.tick(0.05); if (CO.game.step) CO.game.step(0.05); } scene.updateMatrixWorld(true); },
      setTime: function (h) { S.time = h; hudDirty = true; },
      save: save, saveNow: saveNow, loadSave: loadSave, pay: pay, enter: enter, floorY: floorY, route: route, navFreeAt: navFreeAt, collides: collides, updatePlayer: updatePlayer, updateFocus: updateFocus, useFocus: useFocus, focusText: function () { return focusText; },
      lookAt: function (x, y, z) { camera.position.set(player.x, player.y + 1.62, player.z); camera.lookAt(x, y, z); camera.updateMatrixWorld(true); player.yaw = Math.atan2(-(x - player.x), -(z - player.z)); player.pitch = Math.atan2(y - camera.position.y, Math.sqrt(dist2(x, z, player.x, player.z))); updateFocus(); return focusText; },
      buildProp: buildProp, buildProps: buildProps, propPlacement: propPlacement, propWorld: propWorld, removePropInst: removePropInst, catalogueData: catalogueData, editToggle: editToggle, editGrab: editGrab, editDrop: editDrop, editRotate: editRotate, editReset: editReset, editRemove: editRemove, editRestore: editRestore, editBuy: editBuy,
      panelAct: panelAct, hd: hd, doorById: doorById, doorUse: doorUse, doorLock: doorLock, doorsTick: doorsTick, doorSolids: doorSolids, lockAll: lockAll, drawScreens: drawScreens, screenTap: screenTap, screenZoneAt: screenZoneAt, screenDirtyAll: screenDirtyAll,
      openPanel: openPanel, closePanel: closePanel, renderPanel: renderPanel, panelHtml: function () { var b = $('dc-panel-body'); return b ? b.innerHTML : ''; }, openMenu: openMenu, closeMenu: closeMenu, menuAct: menuAct, settingsHtml: settingsHtml, applySettings: applySettings, showCard: showCard, hideCards: hideCards,
      photoToggle: photoToggle, photoTick: photoTick, photoZoom: photoZoom, updateHud: updateHud, toast: toast, logEvent: logEvent, sfx: sfx,
      devCommand: devCommand, devCommandList: devCommandList, devLink: devLink, devLinkToggle: devLinkToggle, devState: devState,
      THREE: THREE, makeHuman: makeHuman, animateHuman: animateHuman, say: say, setMood: setMood, walkAlong: walkAlong, carMesh: carMesh, trafficAdd: trafficAdd, driveStep: driveStep, vehicleBlocked: vehicleBlocked,
      pickWeather: pickWeather, tickWeatherState: tickWeatherState, lighting: lighting, buildSky: buildSky, season: season, isSunday: isSunday, nowAbs: nowAbs,
      bakeStatic: bakeStatic, unbakeStatic: unbakeStatic, rebake: rebake, renderFrame: renderFrame, post: post, resize: resize,
      propSeed: propSeed, seededF: seededF, mixHex: mixHex, fmtTime: fmtTime, money: money, hook: hook, runHooks: runHooks,
      counts: function () { return { draws: (post.calls || renderer.info.render.calls), inter: inter.length, dyn: dyn.length, baked: baked.draws, hidden: baked.hidden }; }
    };
  }
  CO.boot = coBoot;
  // ── The sample ────────────────────────────────────────────────────
  var walkers = [], people = [], carT = 0;
  var GAME = {
    handle: 'CO_SAMPLE', version: '0.1.0',
    floorY: function (x, z) { return 0; },
    insideWalk: function (x, z) { return Math.abs(x) < 10 && Math.abs(z) < 10; },
    indoors: function (x, z) { return Math.abs(x) < 10 && Math.abs(z) < 10; },
    roofAt: function (x, z) { return Math.abs(x) < 10 && Math.abs(z) < 10 ? 4 : 0; },
    wallPlanes: function () { return [{ a: 'z', v: -9.83, n: 1, x0: -10, x1: 10 }, { a: 'x', v: -9.83, n: 1, z0: -10, z1: 10 }]; },
    editClamp: function (pt) { return { x: clamp(pt.x, -9.5, 9.5), z: clamp(pt.z, -9.5, 9.5) }; },
    doorOpeners: function () { return walkers.concat(people.map(function (p) { return { x: p.rec.x, z: p.rec.z }; })); },
    stepSurface: function (x, z) { return Math.abs(x) < 10 && Math.abs(z) < 10 ? 'floor' : 'outside'; },
    freshState: function () { return { day: 1, time: 9, bank: 500, level: 1, log: [], ledger: [], stats: { earned: 0, spent: 0 }, layout: {}, custom: [], hdoors: {}, presses: 0 }; },
    buildWorld: function (loaded) {
      // the room: a slab, four walls (the north one with a doorway), the linings, a roof, lamps, and a hinged door in the doorway
      plane(20, 20, MAT.floor, 0, 0, 0, -Math.PI / 2);
      box(13.15, 4, 0.3, MAT.wall, -3.575, 2, -10); box(5.95, 4, 0.3, MAT.wall, 7.175, 2, -10); box(1.2, 1.7, 0.3, MAT.wall, 3.6, 3.15, -10);
      box(20.3, 4, 0.3, MAT.wall, 0, 2, 10); box(0.3, 4, 20, MAT.wall, -10, 2, 0); box(0.3, 4, 20, MAT.wall, 10, 2, 0);
      solid(-10.15, 3, -10.15, -9.85); solid(4.2, 10.15, -10.15, -9.85); solid(-10.15, 10.15, 9.85, 10.15); solid(-10.15, -9.85, -10.15, 10.15); solid(9.85, 10.15, -10.15, 10.15);
      GAME.northSegs = lineWall('z', -10, -9.85, 9.85, 3, MAT.plaster, [[3, 4.2, 2.3]], 1); lineWall('x', -10, -9.85, 9.85, 3, MAT.plaster, [], 1);
      roomFloor(MAT.carpet, -9.85, -2, 2, 9.85, 1.0);
      plane(20, 20, MAT.roofIn, 0, 4, 0, Math.PI / 2);
      troffer(-6, 3.9, 6); troffer(-6, 3.9, 8); highBay(4, 3.2, 0, 4);
      GAME.door = hingedDoor('north', 3.1, -10, true, 'the north door', { pushbar: true });
      // outside: grass, a fence to the south, a tree, a lamp post, the sky and a car on a lane
      plane(300, 300, MAT.grass, 0, -0.03, 0, -Math.PI / 2);
      fenceRun(-14, 14, 14, 14); tree(13, -13, 1.1); lampPost(12, 12, 0, 5);
      buildSky({ clouds: 4, rainN: 1500, snowN: 800 });
      traffic.x0 = -60; traffic.x1 = 60; GAME.car = trafficAdd(20, 1, 8);
      // two people: one walks a loop through the doorway, one stands and talks
      var a = makeHuman({ name: 'Ann', vest: MAT.hivis, style: 'short' }), b = makeHuman({ name: 'Bo', style: 'long', hardhat: MAT.yellow });
      a.position.set(-6, 0, -6); b.position.set(6, 0, 6); scene.add(a); scene.add(b);
      people.push({ g: a, rec: { x: -6, z: -6, yaw: 0, speed: 1.6, path: [] }, loop: [{ x: 3.6, z: -12 }, { x: -6, z: -6 }], at: 0 }, { g: b, rec: { x: 6, z: 6, yaw: 0 }, still: true });
      buildProps();
      navSetup({ x0: -16, z0: -16, width: 32, depth: 32, cell: 0.4 });
    },
    tick: function (dt) {
      people.forEach(function (p) {
        if (p.still) { animateHuman(p.g, dt, 'wait', 0, player ? { x: player.x, y: player.y + 1.6, z: player.z } : null, false); return; }
        if (!p.rec.path.length) { p.rec.path = route({ x: p.rec.x, z: p.rec.z }, p.loop[p.at]); p.at = (p.at + 1) % p.loop.length; }
        var done = walkAlong(p.rec, p.rec.path, p.rec.speed, dt); p.g.position.set(p.rec.x, 0, p.rec.z); p.g.rotation.y = p.rec.yaw; animateHuman(p.g, dt, done ? 'idle' : 'walk', 1, null, false);
      });
      carT += dt;
      S.time += dt / 60;   // a game minute a second
      hudDirty = hudDirty || Math.floor(S.time * 60) !== GAME.lastMin; GAME.lastMin = Math.floor(S.time * 60);
    },
    startStats: function (loaded) { return loaded ? ['Day ' + S.day, money(S.bank), 'presses ' + S.presses] : ['A new room', money(500)]; },
    hud: function () { var p = $('h-presses'); if (p) p.textContent = (S.presses || 0) + ' presses'; },
    panel: function (kind, tab) { if (kind === 'info') return { title: 'The sample room', tabs: [['one', 'One'], ['two', 'Two']], tab: tab || 'one', body: '<p>Tab ' + esc(tab || 'one') + '. Presses: ' + (S.presses || 0) + '</p>' + btn('press', '', 'Press from the panel', 'primary') }; return null; },
    panelAct: function (act) { if (act === 'press') { S.presses = (S.presses || 0) + 1; renderPanel(); return true; } return false; },
    guideHtml: function () { return '<p>Walk with WASD, press E on the lever, Tab does nothing here.</p>'; },
    commands: { press: function () { S.presses = (S.presses || 0) + 1; return 'presses ' + S.presses; } },
    devState: function () { return { presses: S.presses || 0, people: people.length }; },
    T: function () { return { GAME: GAME, people: people, walkers: walkers, northSegs: GAME.northSegs, door: GAME.door, car: GAME.car, lever: GAME.lever, traffic: traffic, spanCut: spanCut, lineWall: lineWall, roomFloor: roomFloor, troffer: troffer, highBay: highBay, fenceRun: fenceRun, tree: tree, lampPost: lampPost, insideWalk: insideWalk, inRect: inRect, navSetup: navSetup, yawWrap: yawWrap, sfxCount: function () { return sfxCount; }, SFX: SFX, geoCache: geoCache, BEVEL: BEVEL, bevelGeo: bevelGeo, roundCylGeo: roundCylGeo, boxGeo: boxGeo, taperGeo: taperGeo, textTex: textTex, box: box, cyl: cyl, sign: sign, groundBlob: groundBlob, disposeTree: disposeTree, burst: burst, tickBursts: tickBursts, bursts: bursts, lightBudget: lightBudget, seededStream: seededStream, hexCss: hexCss, mergeById: mergeById, scFit: scFit, catalogueHtml: catalogueHtml, cards: cards, tickCards: tickCards, tickSky: tickSky, weatherFlash: function () { return weatherFlash; }, updateLightBudget: updateLightBudget, shadowTick: shadowTick, faceTex: faceTex, humanGeo: humanGeo, collides: collides, panel: panel }; }
  };
  // the props: a crate stack you can carry, a sign on the wall, a panel with a touch screen, a lever, and a chair in the catalogue
  defProp('crateStack', { label: 'crate stack', x: -4, z: 2, rot: 0, cat: 'room', build: function (c) { for (var i = 0; i < 6; i++) c.box(0.9, 0.5, 0.9, MAT.wood, (i % 3) * 1.0 - 1, 0.25 + Math.floor(i / 3) * 0.5, 0); c.solid(-1.5, 1.5, -0.45, 0.45, 0, 1.0); } });
  defProp('wallSign', { label: 'wall sign', x: 0, z: -9.82, rot: 0, cat: 'wall', wall: true, build: function (c) { c.sign(['CO ENGINE', 'sample room'], 2.4, 0.6, 0, 2.6, 0.01, 0, { bg: '#1b232c' }); } });
  defProp('panel', { label: 'control panel', x: 8, z: -9.5, rot: 0, cat: 'hall', build: function (c) {
    c.box(0.9, 1.3, 0.22, MAT.grey, 0, 1.45, -0.11); c.solid(-0.45, 0.45, -0.25, 0.05, 0, 2.2);
    touchScreen({ w: 420, h: 330, pw: 0.78, ph: 0.616, x: 0, y: 1.5, z: 0.012, parent: c.group, title: 'Sample panel', draw: function (ctx, sc) { scBg(ctx, sc.w, sc.h); scHead(ctx, sc.w, 'SAMPLE PANEL', 'Day ' + S.day); scText(ctx, 16, 66, 'Presses: ' + (S.presses || 0)); scButton(sc, 16, 80, 120, 40, 'Press', true, function () { S.presses = (S.presses || 0) + 1; }); scButton(sc, 148, 80, 120, 40, 'Lights', !S.lightsOff, function () { S.lightsOff = !S.lightsOff; }); } });
  } });
  defProp('lever', { label: 'lever', x: 7, z: -7, rot: 0, cat: 'hall', build: function (c) { c.box(0.3, 1.0, 0.3, MAT.steelDark, 0, 0.5, 0); c.solid(-0.2, 0.2, -0.2, 0.2, 0, 1.1); GAME.lever = c.hit(0.5, 1.2, 0.5, 0, 0.6, 0, { prompt: function () { return 'Pull the lever'; }, use: function () { S.presses = (S.presses || 0) + 1; openPanel('info'); } }); } });
  defProp('xChair', { extra: true, label: 'chair', cat: 'room', price: 40, desc: 'A chair.', build: function (c) { c.box(0.44, 0.05, 0.44, MAT.red, 0, 0.46, 0); c.box(0.44, 0.5, 0.05, MAT.red, 0, 0.72, -0.2); [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]].forEach(function (p) { c.cyl(0.02, 0.45, MAT.steelDark, p[0], 0.22, p[1], 6); }); c.solid(-0.25, 0.25, -0.25, 0.25, 0, 1); } });
  CO.setup({ canvas: 'co-canvas', save: 'co-sample', game: GAME, spawn: { x: 0, z: 5, yaw: 0 }, sun: { box: 30, far: 90, mapSize: 2048, target: [0, 0, 0] }, lightBudget: 6 });
  CO.boot(GAME);
})();
