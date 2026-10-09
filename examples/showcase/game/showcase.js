(function () {
  'use strict';
  if (typeof THREE === 'undefined') { document.body.innerHTML = '<p style="padding:40px;font-family:sans-serif">three.js failed to load (vendor/three/three.min.js).</p>'; return; }
  // ── Co Engine ─────────────────────────────────────────────────────
  // The engine parts come first in the closure, the game's parts after. The engine declares the names both sides share
  // here, unassigned, and fills them when the game calls CO.setup (the renderer, the scene, the palette) and CO.boot (the
  // state, the shell, the frame loop). A game part may use any of them at its top level once CO.setup has run.
  var CO = { version: '0.6.0', cfg: null, game: null, root: null, flash: 0, ready: false, paused: false, stepOnce: false, editor: null };
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
  function parentOf(p) { return p || CO.root || scene; }
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
  function defProp(id, def) { if (CO.game && CO.game.resolveDef) CO.game.resolveDef(id, def); def.id = id; PROPS[id] = def; PROP_ORDER.push(id); return def; }
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
  function tickTraffic(dt) { if (!traffic || !traffic.cars) return; traffic.cars.forEach(function (c) { c.g.position.x += c.dir * c.v * dt; if (c.g.position.x > traffic.x1) c.g.position.x = traffic.x0; if (c.g.position.x < traffic.x0) c.g.position.x = traffic.x1; var ws = c.g.userData.wheels; if (ws) ws.forEach(function (w) { w.rotation.z -= c.dir * c.v * dt / 0.33; }); }); }
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
    else if (CO.game && CO.game.menu) CO.game.menu(k, b);
  }
  // ── Settings ──────────────────────────────────────────────────────
  function settingsHtml() {
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
    SET[k] = v; saveSettings(); applySettings();
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
    var f = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), r = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0), u = (k.Space ? 1 : 0) - (k.KeyC || k.ControlLeft ? 1 : 0);
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
  var EOBJ = {}, eidN = 0, editorSel = null, editorHelper = null, eRay = new THREE.Raycaster();
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
      if (o === CO.root || o.userData.editor || isPropRoot(o)) return;
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
    return { props: props, lights: lights, people: people, doors: doors, screens: screensL, vehicles: vehicles, other: other, counts: { baked: baked, statics: statics, inter: inter.length, solids: solids.length, dyn: dyn.length }, extra: extra, time: S ? { day: S.day, time: S.time } : null, selected: editorSel, paused: !!CO.paused, scene: !!photo.on, started: !!ui.started, engine: CO.version, game: CO.gameVersion };
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
    if (p[0] === 'position' || p[0] === 'rotation' || p[0] === 'scale') { o[p[0]][p[1]] = p[0] === 'rotation' ? (+v) * Math.PI / 180 : +v; o.updateMatrixWorld(true); shadowDirty = true; if (editorHelper) editorHelper.update(); return 'ok'; }
    if (p[0] === 'visible') { o.visible = !!v && v !== 'false'; shadowDirty = true; return 'ok'; }
    if (p[0] === 'material') { var m = o.material; if (!m) return 'no material'; if (p[1] === 'color' || p[1] === 'emissive') { if (!m[p[1]]) return 'no ' + p[1]; m[p[1]].set(String(v)); } else m[p[1]] = +v; m.needsUpdate = true; return 'ok'; }
    if (p[0] === 'light') { if (!o.isLight) return 'not a light'; if (p[1] === 'color') o.color.set(String(v)); else o[p[1]] = +v; return 'ok'; }
    if (p[0] === 'name') { o.name = String(v); return 'ok'; }
    return 'unknown path ' + path;
  }
  function editorSelect(id) {
    var o = id ? eobj(id) : null; editorSel = o ? (propInst[id] ? id : eid(o)) : null;
    if (editorHelper) { scene.remove(editorHelper); editorHelper.geometry.dispose(); editorHelper = null; }
    if (o) { editorHelper = new THREE.BoxHelper(o, 0xf5b53d); editorHelper.userData.editor = true; editorHelper.userData.noBake = true; editorHelper.material.depthTest = false; editorHelper.renderOrder = 9; scene.add(editorHelper); }
    return editorSel ? editorInspect(editorSel) : null;
  }
  // what the crosshair or a click is on: the nearest visible mesh, named as its prop when it belongs to one
  function editorPick(nx, ny) {
    scene.updateMatrixWorld(true);   /* a prop rebuilt this tick has no world matrix until the next frame */
    eRay.setFromCamera({ x: nx === undefined ? 0 : nx, y: ny === undefined ? 0 : ny }, camera); eRay.far = 120;
    var hits = eRay.intersectObjects(scene.children, true);
    // a baked merge is skipped and the hidden original behind it counts: it is the thing the player would name
    for (var i = 0; i < hits.length; i++) { var h = hits[i].object; if (h.userData.baked || h.userData.editor || h.material === MAT.hit || h === editorHelper || h.isPoints || h.userData.noBake || (!h.visible && !h.userData.bakedAway) || (h.material && h.material.transparent && h.material.opacity < 0.9 && !h.userData.screen)) continue;   /* not a blob, a helper or a glass pane */ var pid = propIdOf(h); return { id: pid && propInst[pid] ? pid : eid(h), prop: !!(pid && propInst[pid]), distance: rnd(hits[i].distance), point: [rnd(hits[i].point.x), rnd(hits[i].point.y), rnd(hits[i].point.z)] }; }
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
      // Ctrl and the left button grab whatever prop is under the pointer, in the game view as well as the scene camera; in the scene camera the selected prop drags without Ctrl
      if (e.button === 0 && (e.ctrlKey || e.metaKey)) { var rc = canvas.getBoundingClientRect(), cx = ((e.clientX - rc.left) / rc.width) * 2 - 1, cy = -((e.clientY - rc.top) / rc.height) * 2 + 1, hc = editorPick(cx, cy); if (hc && hc.prop && propInst[hc.id] && editorSel !== hc.id) { editorSelect(hc.id); console.log('[co-editor] ' + JSON.stringify({ select: hc.id, point: hc.point })); } }
      if (e.button === 0 && (photo.on || e.ctrlKey || e.metaKey) && editorSel && propInst[editorSel]) { var r1 = canvas.getBoundingClientRect(), sx = ((e.clientX - r1.left) / r1.width) * 2 - 1, sy = -((e.clientY - r1.top) / r1.height) * 2 + 1, hit1 = editorPick(sx, sy); var defS = propDef(editorSel); if (hit1 && hit1.id === editorSel && hit1.prop && !(defS && defS.fixed)) { var inst1 = propInst[editorSel], gy = inst1.g.position.y, p1 = pointOnPlane(e, gy); if (p1) { propDrag = { id: editorSel, g: inst1.g, y: gy, off: p1.clone().sub(inst1.g.position), before: layoutSnap(editorSel), moved: false }; e.preventDefault(); return; } } }
      if (e.button === 0) { var r = canvas.getBoundingClientRect(), nx = ((e.clientX - r.left) / r.width) * 2 - 1, ny = -((e.clientY - r.top) / r.height) * 2 + 1, hit = editorPick(nx, ny); editorSelect(hit ? hit.id : null); console.log('[co-editor] ' + JSON.stringify({ select: hit ? hit.id : null, point: hit ? hit.point : null, nx: nx, ny: ny })); }
      if (e.button === 2) { CO.editor.drag = true; e.preventDefault(); }
    });
    document.addEventListener('mouseup', function (e) {
      if (e.button === 2) CO.editor.drag = false; if (e.button === 0) toolDown = false;
      if (e.button === 0 && toolStroke) { var TS = toolStroke; toolStroke = null; var afterH = Float32Array.from(TERRAIN.heights), afterP = Uint8Array.from(TERRAIN.paint); histPush('terrain ' + TS.mode, function () { terrainRestore(TS.h, TS.p); }, function () { terrainRestore(afterH, afterP); }); }
      if (e.button === 0 && propDrag) { var D = propDrag; propDrag = null; if (D.moved) { var P = propPlacement(D.id), x = Math.round(D.g.position.x * 100) / 100, z = Math.round(D.g.position.z * 100) / 100; if (!S.layout) S.layout = {}; S.layout[D.id] = S.layout[D.id] || { x: P.x, z: P.z, rot: P.rot, h: P.h || 0 }; S.layout[D.id].x = x; S.layout[D.id].z = z; if (D.rot !== undefined) S.layout[D.id].rot = D.rot; rebuildProp(D.id); save(); var after = layoutSnap(D.id), bef = D.before; histPush('move ' + D.id, function () { layoutRestore(D.id, bef); }, function () { layoutRestore(D.id, after); }); editorSelect(D.id); console.log('[co-editor] ' + JSON.stringify({ moved: D.id, x: x, z: z })); } }
      if (e.button === 0 && partDrag) { console.log('[co-editor] ' + JSON.stringify({ partDragEnd: partDrag.part, type: partDrag.type })); partDrag = null; }
    });
    canvas.addEventListener('mousemove', function (e) {
      if (toolDown && editorTool.mode && editorTool.mode !== 'model' && TERRAIN.on) toolApply(e);
      if (propDrag) { var p = pointOnPlane(e, propDrag.y); if (!p) return; var s = e.shiftKey ? 0.5 : 0.05, nx2 = snapTo(p.x - propDrag.off.x, s), nz2 = snapTo(p.z - propDrag.off.z, s); var dd = propDef(propDrag.id); if (dd && dd.wall) { var ws2 = wallSnap({ x: nx2, z: nz2 }, s); if (ws2) { nx2 = ws2.x; nz2 = ws2.z; if (propDrag.g.rotation.y !== ws2.rot * Math.PI / 2) { propDrag.g.rotation.y = ws2.rot * Math.PI / 2; propDrag.rot = ws2.rot; } } } if (nx2 !== propDrag.g.position.x || nz2 !== propDrag.g.position.z) { propDrag.g.position.x = nx2; propDrag.g.position.z = nz2; propDrag.moved = true; if (editorHelper) editorHelper.update(); shadowDirty = true; } return; }
      if (partDrag) { var pp = pointOnPlane(e, partDrag.y); if (!pp) return; var now = performance.now(); if (now - dragT < 40) return; dragT = now; var st = e.shiftKey ? 0.25 : 0.05; if (partDrag.vert !== undefined) { var lv = partDrag.mesh.worldToLocal(pp.clone()); console.log('[co-editor] ' + JSON.stringify({ vertDrag: partDrag.part, v: partDrag.vert, type: partDrag.type, x: snapTo(lv.x, st / 5), z: snapTo(lv.z, st / 5) })); return; } var local = partDrag.g.worldToLocal(pp.clone().sub(partDrag.off)); console.log('[co-editor] ' + JSON.stringify({ partDrag: partDrag.part, type: partDrag.type, x: snapTo(local.x, st), z: snapTo(local.z, st) })); }
    });
    window.addEventListener('blur', function () { CO.editor.drag = false; });
    canvas.addEventListener('contextmenu', function (e) { if (CO.editor.on) e.preventDefault(); });
    // Ctrl and the wheel turn the prop under the pointer (or the selected one) a quarter at a time
    canvas.addEventListener('wheel', function (e) { if (!CO.editor.on || !ui.started || !(e.ctrlKey || e.metaKey)) return; e.preventDefault(); e.stopImmediatePropagation(); var r2 = canvas.getBoundingClientRect(), wx = ((e.clientX - r2.left) / r2.width) * 2 - 1, wy = -((e.clientY - r2.top) / r2.height) * 2 + 1, hw = editorPick(wx, wy), id = hw && hw.prop && propInst[hw.id] ? hw.id : editorSel; if (!id || !propInst[id]) return; var dw = propDef(id); if (dw && dw.fixed) return; var rot = propPlacement(id).rot || 0; editorSet(id, 'prop.rot', (rot + (e.deltaY > 0 ? 1 : 3)) % 4); editorSelect(id); console.log('[co-editor] ' + JSON.stringify({ moved: id, rot: (rot + (e.deltaY > 0 ? 1 : 3)) % 4 })); }, { capture: true, passive: false });
    window.addEventListener('keydown', function (e) { if (!CO.editor.on || !(e.ctrlKey || e.metaKey)) return; var k = (e.key || '').toLowerCase(); if (k === 'z' && !e.shiftKey) { e.preventDefault(); console.log('[co-editor] ' + JSON.stringify({ history: editorUndoStep() })); } else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); console.log('[co-editor] ' + JSON.stringify({ history: editorRedoStep() })); } });
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
  function editorSource(type) {
    var def = PROPS[type]; if (!def) return { error: 'no prop definition ' + type };
    var fields = {}; ['label', 'cat', 'x', 'z', 'rot', 'y', 'wall', 'fixed', 'extra', 'price', 'desc', 'lvl', 'ico', 'noBlob'].forEach(function (k) { if (def[k] !== undefined) fields[k] = def[k]; });
    return { type: type, fields: fields, build: def.build ? def.build.toString() : null, after: def.after ? def.after.toString() : null, original: ORIG_BUILD[type] ? ORIG_BUILD[type].toString() : null, modified: !!ORIG_BUILD[type] && def.build !== ORIG_BUILD[type], instances: propTypeIds(type), kit: Object.keys(editorKit()) };
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
    ui: uiData, uiSet: function (data) { var prev = uiData(), next = JSON.parse(JSON.stringify(data || {})); CO.ui(next); if (ui.panelOpen) renderPanel(); histPush('UI', function () { CO.ui(prev); }, function () { CO.ui(next); }); return uiData(); },
    tables: tablesList, tableSet: tableSet, tablesCode: tablesCode, uiCode: uiCode, uiOpen: function (kind) { openPanel(kind); return !!UI.panels[kind]; }, uiEval: uiEval,
    packCode: function (types) { var ids = (types && types.length ? types : PROP_ORDER.filter(function (id) { return !/^pk[A-Z]/.test(id); })).filter(function (id) { return PROPS[id] && PROPS[id].build; }); var lines = ['//@ a pack made in the Co Engine editor from ' + (CO.game && CO.game.handle || 'a game') + '\'s props. A prop that calls the game\'s own functions needs them in the game it goes to.']; ids.forEach(function (id) { var d = PROPS[id], f = {}; ['label', 'cat', 'wall', 'fixed', 'price', 'desc', 'lvl', 'ico', 'noBlob'].forEach(function (k) { if (d[k] !== undefined) f[k] = d[k]; }); f.extra = true; f.shop = false; var body = JSON.stringify(f); lines.push('  defProp(' + JSON.stringify(id) + ', Object.assign(' + body + ', { build: ' + d.build.toString() + (d.after ? ', after: ' + d.after.toString() : '') + ' }));'); }); return { ids: ids, code: lines.join('\n') + '\n' }; },
    run: function (code) { var r = closureRun(String(code)); try { return r === undefined ? null : JSON.parse(JSON.stringify(r)); } catch (e) { return String(r); } },
    model: modelOf, modelPreview: modelPreview, modelStart: modelStart, modelPick: modelPick, modelMirror: modelMirror, modelCode: modelCode,
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
  function modelPartCode(p, i) {
    var x = n2(p.x), y = n2(p.y), z = n2(p.z), ry = p.ry ? ' p' + i + '.rotation.y = ' + n2(p.ry * Math.PI / 180) + ';' : '', tag = ' p' + i + '.userData.part = ' + i + ';';
    if (p.kind === 'box') return p.r ? 'var p' + i + ' = box(' + n2(p.w) + ', ' + n2(p.h) + ', ' + n2(p.d) + ', ' + matRef(p.mat) + ', ' + x + ', ' + y + ', ' + z + ', { parent: c.group, r: ' + n2(p.r) + ' });' + ry + tag : 'var p' + i + ' = c.box(' + n2(p.w) + ', ' + n2(p.h) + ', ' + n2(p.d) + ', ' + matRef(p.mat) + ', ' + x + ', ' + y + ', ' + z + ');' + ry + tag;
    if (p.kind === 'mesh') { var vs = (p.verts || []).map(function (q) { return [n2(q[0]), n2(q[1]), n2(q[2])]; }), fs = (p.faces || []).map(function (q) { return [q[0] | 0, q[1] | 0, q[2] | 0]; }); return 'var p' + i + ' = (function () { var V = ' + JSON.stringify(vs) + ', F = ' + JSON.stringify(fs) + ', pos = [], map = []; F.forEach(function (f) { f.forEach(function (k) { pos.push(V[k][0], V[k][1], V[k][2]); map.push(k); }); }); var geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals(); var m = new THREE.Mesh(geo, ' + matRef(p.mat) + '); m.castShadow = m.receiveShadow = true; m.userData.vertexEdit = true; m.userData.vertMap = map; return c.add(m); })(); p' + i + '.position.set(' + x + ', ' + y + ', ' + z + ');' + ry + tag; }
    if (p.kind === 'lathe') return 'var p' + i + ' = c.add(new THREE.Mesh(new THREE.LatheGeometry(' + JSON.stringify((p.points || [[0.3, 0], [0.4, 0.5], [0.2, 1]]).map(function (q) { return [n2(q[0]), n2(q[1])]; })) + '.map(function (q) { return new THREE.Vector2(q[0], q[1]); }), ' + (p.seg || 24) + '), ' + matRef(p.mat) + ')); p' + i + '.position.set(' + x + ', ' + y + ', ' + z + '); p' + i + '.castShadow = p' + i + '.receiveShadow = true;' + ry + tag;
    if (p.kind === 'extrude') return 'var p' + i + ' = c.add(new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape(' + JSON.stringify((p.shape || [[-0.5, 0], [0.5, 0], [0, 0.8]]).map(function (q) { return [n2(q[0]), n2(q[1])]; })) + '.map(function (q) { return new THREE.Vector2(q[0], q[1]); })), { depth: ' + n2(p.depth || 0.2) + ', bevelEnabled: false }), ' + matRef(p.mat) + ')); p' + i + '.position.set(' + x + ', ' + y + ', ' + z + '); p' + i + '.castShadow = p' + i + '.receiveShadow = true;' + ry + tag;
    if (p.kind === 'cyl') return 'var p' + i + ' = c.cyl(' + n2(p.r) + ', ' + n2(p.h) + ', ' + matRef(p.mat) + ', ' + x + ', ' + y + ', ' + z + (p.seg || p.rb ? ', ' + (p.seg || 16) + (p.rb ? ', ' + n2(p.rb) : '') : '') + ');' + ry + tag;
    if (p.kind === 'sphere') return 'var p' + i + ' = c.sphere(' + n2(p.r) + ', ' + matRef(p.mat) + ', ' + x + ', ' + y + ', ' + z + ');' + tag;
    if (p.kind === 'plane') return 'var p' + i + ' = c.plane(' + n2(p.w) + ', ' + n2(p.h) + ', ' + matRef(p.mat) + ', ' + x + ', ' + y + ', ' + z + ', ' + n2((p.rx || 0) * Math.PI / 180) + ', ' + n2((p.ry || 0) * Math.PI / 180) + ');' + tag;
    if (p.kind === 'sign') return 'var p' + i + ' = c.sign(' + JSON.stringify(p.lines || ['SIGN']) + ', ' + n2(p.w || 1) + ', ' + n2(p.h || 0.4) + ', ' + x + ', ' + y + ', ' + z + ', ' + n2((p.ry || 0) * Math.PI / 180) + ');' + (' if (p' + i + ' && p' + i + '.userData) p' + i + '.userData.part = ' + i + ';');
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
  function modelOf(type) { var def = PROPS[type]; if (!def || !def.build) return { error: 'no prop definition ' + type }; var src = def.build.toString(), m = modelFrom(src); return { type: type, model: m, modelled: !!m, code: src, mats: Object.keys(MAT).filter(function (k) { return k !== 'hit'; }) }; }
  function modelPreview(type, model) { var code = modelCode(model); var r = editorPreview(type, code); r.code = code; return r; }
  function modelStart(type) { var def = PROPS[type]; if (!def) return { error: 'no prop definition ' + type }; var m = { parts: [{ kind: 'box', mat: 'wood', x: 0, y: 0.5, z: 0, w: 1, h: 1, d: 1, ry: 0 }], autoSolid: true }; return modelPreview(type, m).ok ? { ok: true, model: m, code: modelCode(m) } : { error: 'the first box did not build' }; }
  // which part of a modelled prop is under a viewport point
  function modelPick(type, nx, ny) { var ids = propTypeIds(type); scene.updateMatrixWorld(true); eRay.setFromCamera({ x: nx || 0, y: ny || 0 }, camera); eRay.far = 120; for (var k = 0; k < ids.length; k++) { var inst = propInst[ids[k]]; if (!inst) continue; var hits = eRay.intersectObject(inst.g, true); for (var i = 0; i < hits.length; i++) { var o = hits[i].object; while (o && o !== inst.g) { if (o.userData && o.userData.part !== undefined) return { part: o.userData.part, id: ids[k], distance: rnd(hits[i].distance) }; o = o.parent; } } } return null; }
  function modelMirror(model, axis) { var m = JSON.parse(JSON.stringify(model)); m.parts.forEach(function (p) { if (axis === 'z') { p.z = -n2(p.z); if (p.ry) p.ry = -p.ry; } else { p.x = -n2(p.x); if (p.ry) p.ry = -p.ry; } }); return m; }
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
    if (CO.game.lighting !== false) lighting(dt); updateLightBudget(); shadowTick(dt); if (sky.dome || sky.rain) tickSky(dt); tickBursts(dt); doorsTick(dt); drawScreens(dt); editTick(); tickTraffic(dt);
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
  CO.layout({
    props: {
    },
    placed: [
      { id: "cp-mv1k72xd-1", type: "gcOfficeDesk", x: -14.5, z: -10.5, rot: 0, h: 0 },
      { id: "cp-mv1k7579-2", type: "gcCabinet", x: -17.2, z: -11.8, rot: 1, h: 0 },
      { id: "cp-mv1k75hh-3", type: "gcBookshelf", x: -11, z: -12.4, rot: 0, h: 0 },
      { id: "cp-mv1k75tj-4", type: "gcFernOffice", x: -17, z: -3.2, rot: 0, h: 0 },
      { id: "cp-mv1k75tz-5", type: "gcWaterCooler", x: -7, z: -12.3, rot: 0, h: 0 },
      { id: "cp-mv1k75us-6", type: "gcFloorLamp", x: -17.2, z: -7.2, rot: 0, h: 0 },
      { id: "cp-mv1k78ol-7", type: "gcGunLocker", x: -17.4, z: -5.2, rot: 1, h: 0 },
      { id: "cp-mv1k78r1-8", type: "gcVault", x: -8.6, z: -12, rot: 0, h: 0 },
      { id: "cp-mv1k78rl-9", type: "gcGuardBoard", x: -13, z: -12.75, rot: 0, h: 0 },
      { id: "cp-mv1k78sm-a", type: "gcKeyHook", x: -6.4, z: -6, rot: 1, h: 0 },
      { id: "cp-mv1k78u6-b", type: "gcRoster", x: -6.4, z: -9, rot: 1, h: 0 },
      { id: "cp-mv1k78xf-c", type: "gcSofa", x: -2.5, z: -10.5, rot: 0, h: 0 },
      { id: "cp-mv1k78yb-d", type: "gcCouchUp", x: 2.6, z: -10.8, rot: 0, h: 0 },
      { id: "cp-mv1k7cb0-e", type: "gcVipTable", x: 0, z: -6.5, rot: 0, h: 0 },
      { id: "cp-mv1k7cbx-f", type: "gcMagTable", x: -4.5, z: -6.5, rot: 0, h: 0 },
      { id: "cp-mv1k7ccj-g", type: "gcLobbyPlant", x: 5, z: -12.2, rot: 0, h: 0 },
      { id: "cp-mv1k7cd6-h", type: "gcArcade", x: 5, z: -4, rot: 3, h: 0 },
      { id: "cp-mv1k7fjk-i", type: "gcBed", x: -4.4, z: -3.6, rot: 1, h: 0 },
      { id: "cp-mv1k7j8m-j", type: "gcDining", x: 2.5, z: -4.2, rot: 0, h: 0 },
      { id: "cp-mv1k7j9h-k", type: "gcUpRug", x: 0, z: -9, rot: 0, h: 0 },
      { id: "cp-mv1k7jae-l", type: "gcUpDresser", x: -5.2, z: -12.3, rot: 0, h: 0 },
      { id: "cp-mv1k7jb9-m", type: "gcUpBooks", x: 3.6, z: -12.4, rot: 0, h: 0 },
      { id: "cp-mv1k7jcg-n", type: "gcUpPlant1", x: -5.3, z: -8, rot: 0, h: 0 },
      { id: "cp-mv1k7jde-o", type: "gcHallClockTable", x: 0.6, z: -12.4, rot: 0, h: 0 },
      { id: "cp-mv1k7jev-p", type: "gcRack", x: 8.2, z: -11.5, rot: 0, h: 0 },
      { id: "cp-mv1k7jgc-q", type: "gcStoreRack", x: 11.5, z: -11.8, rot: 0, h: 0 },
      { id: "cp-mv1k7jho-r", type: "gcProcShelf", x: 15, z: -12.2, rot: 0, h: 0 },
      { id: "cp-mv1k7jj1-s", type: "gcPotShelf", x: 17.2, z: -9.5, rot: 3, h: 0 },
      { id: "cp-mv1k7jun-t", type: "gcCureShelf", x: 17.2, z: -6, rot: 3, h: 0 },
      { id: "cp-mv1k7jwm-u", type: "gcDryRack", x: 12, z: -7.5, rot: 0, h: 0 },
      { id: "cp-mv1k7jxz-v", type: "gcDryTable", x: 8.5, z: -6.5, rot: 1, h: 0 },
      { id: "cp-mv1k7k0c-w", type: "gcJarBoxes", x: 14.5, z: -8.5, rot: 0, h: 0 },
      { id: "cp-mv1k7k1d-x", type: "gcCrates", x: 15.5, z: -3.5, rot: 0, h: 0 },
      { id: "cp-mv1k7k2g-y", type: "gcSoilSacks", x: 12.5, z: -3.4, rot: 0, h: 0 },
      { id: "cp-mv1k7k3v-z", type: "gcBucket", x: 10.6, z: -3.5, rot: 0, h: 0 },
      { id: "cp-mv1k7k5j-10", type: "gcHose", x: 6.8, z: -3.4, rot: 1, h: 0 },
      { id: "cp-mv1k7k8a-11", type: "gcFan", x: 9.5, z: -9, rot: 0, h: 0 },
      { id: "cp-mv1k7k97-12", type: "gcBench", x: 13.5, z: -5.2, rot: 2, h: 0 },
      { id: "cp-mv1k7m7o-13", type: "gcBagLine", x: 9.8, z: -4.4, rot: 0, h: 0 },
      { id: "cp-mv1k7m8x-14", type: "gcStockCabinet", x: 17.2, z: -3.2, rot: 3, h: 0 },
      { id: "cp-mv1k7mbz-15", type: "gcTrash", x: 6.8, z: -8.2, rot: 0, h: 0 },
      { id: "cp-mv1k7mdm-16", type: "gcGoodsShelf", x: -15.5, z: 1, rot: 1, h: 0 },
      { id: "cp-mv1k7vt7-17", type: "gcGoodsShelf", x: -15.5, z: 4.5, rot: 1, h: 0 },
      { id: "cp-mv1k80sq-18", type: "gcCigCabinet", x: -10.5, z: 0.6, rot: 0, h: 0 },
      { id: "cp-mv1k80ug-19", type: "gcFridge", x: -7.5, z: 0.6, rot: 0, h: 0 },
      { id: "cp-mv1k85vp-1a", type: "gcVending", x: -4.6, z: 0.6, rot: 0, h: 0 },
      { id: "cp-mv1k8b8h-1b", type: "gcLobbyCoffee", x: -2.2, z: 0.6, rot: 0, h: 0 },
      { id: "cp-mv1k8bxd-1c", type: "gcCoffeeBar", x: 2, z: 0.8, rot: 0, h: 0 },
      { id: "cp-mv1k8bza-1d", type: "gcMenuScreen", x: 5, z: 0.4, rot: 0, h: 0 },
      { id: "cp-mv1k8iuo-1e", type: "gcQueueRope", x: -2, z: 8.5, rot: 0, h: 0 },
      { id: "cp-mv1k8iw7-1f", type: "gcTabletDock", x: 7, z: 0.6, rot: 0, h: 0 },
      { id: "cp-mv1k8iyc-1g", type: "gcTrophyCase", x: 10, z: 0.6, rot: 0, h: 0 },
      { id: "cp-mv1k8q49-1h", type: "gcMerchStand", x: -10, z: 6, rot: 0, h: 0 },
      { id: "cp-mv1k8q61-1i", type: "gcHydroBay", x: 14.5, z: 3, rot: 3, h: 0 },
      { id: "cp-mv1k8q92-1j", type: "gcBreedBench", x: 11, z: 6, rot: 0, h: 0 },
      { id: "cp-mv1k8qax-1k", type: "gcTent", x: 14, z: 9, rot: 0, h: 0 },
      { id: "cp-mv1k8qd4-1l", type: "gcCellarHatch", x: 8, z: 10, rot: 0, h: 0 },
      { id: "cp-mv1k8qum-1m", type: "gcFernHall", x: -17, z: 11.6, rot: 0, h: 0 },
      { id: "cp-mv1k8qxn-1n", type: "gcFernLobby", x: 17, z: 11.6, rot: 0, h: 0 },
      { id: "cp-mv1k8qzr-1o", type: "gcLobbyBenchL", x: -6, z: 11.4, rot: 2, h: 0 },
      { id: "cp-mv1k8r41-1p", type: "gcLobbyBenchR", x: 6, z: 11.4, rot: 2, h: 0 },
      { id: "cp-mv1k8r7r-1q", type: "gcWindowSeat", x: -13, z: 11.6, rot: 2, h: 0 },
      { id: "cp-mv1k8rsb-1r", type: "gcUpPlant2", x: 3, z: 11.8, rot: 0, h: 0 },
      { id: "cp-mv1k8rtn-1s", type: "gcUpPlant3", x: -3, z: 11.8, rot: 0, h: 0 },
      { id: "cp-mv1k8rv4-1t", type: "gcTrash", x: -8, z: 9.5, rot: 0, h: 0 },
      { id: "cp-mv1k8rww-1u", type: "pkCrate", x: -4.5, z: 4.5, rot: 0, h: 0 },
      { id: "cp-mv1k8rz2-1v", type: "pkCrate", x: -3.6, z: 4.5, rot: 0, h: 0 },
      { id: "cp-mv1k8s0v-1w", type: "pkCrate", x: -2.7, z: 4.5, rot: 0, h: 0 },
      { id: "cp-mv1k8s2c-1x", type: "pkCrate", x: -1.8, z: 4.5, rot: 0, h: 0 },
      { id: "cp-mv1k8s51-1y", type: "pkGate", x: 0, z: 22.6, rot: 0, h: 0 },
      { id: "cp-mv1k8s7h-1z", type: "pkPanel", x: -3.4, z: 21.6, rot: 2, h: 0 },
      { id: "cp-mv1k8se9-20", type: "pkBarrier", x: 9, z: 22.6, rot: 0, h: 0 },
      { id: "cp-mv1k8sgi-21", type: "pkLampPost", x: -12, z: 20, rot: 0, h: 0 },
      { id: "cp-mv1k8t1v-22", type: "pkLampPost", x: 12, z: 20, rot: 0, h: 0 },
      { id: "cp-mv1k8y7h-23", type: "pkLampPost", x: -12, z: 15, rot: 0, h: 0 },
      { id: "cp-mv1k8ywk-24", type: "pkLampPost", x: 12, z: 15, rot: 0, h: 0 },
      { id: "cp-mv1k8ziv-25", type: "pkFence", x: -14, z: 23.6, rot: 0, h: 0 },
      { id: "cp-mv1k8zkm-26", type: "pkFence", x: -12, z: 23.6, rot: 0, h: 0 },
      { id: "cp-mv1k8zm3-27", type: "pkFence", x: 14, z: 23.6, rot: 0, h: 0 },
      { id: "cp-mv1k8znq-28", type: "pkFence", x: 16, z: 23.6, rot: 0, h: 0 },
      { id: "cp-mv1k8zq4-29", type: "pkCone", x: 4, z: 21, rot: 0, h: 0 },
      { id: "cp-mv1k8zth-2a", type: "pkCone", x: 5, z: 21, rot: 0, h: 0 },
      { id: "cp-mv1k8zw4-2b", type: "pkBench", x: -8, z: 14.4, rot: 2, h: 0 },
      { id: "cp-mv1k9019-2c", type: "pkBin", x: -6, z: 14.2, rot: 0, h: 0 },
      { id: "cp-mv1k903i-2d", type: "pkPlanter", x: 6, z: 14.2, rot: 0, h: 0 },
      { id: "cp-mv1k9065-2e", type: "pkSign", x: 3, z: 18, rot: 2, h: 0 },
      { id: "cp-mv1k90bh-2f", type: "pkLever", x: -5.5, z: 21.6, rot: 0, h: 0 },
      { id: "cp-mv1k90da-2g", type: "pkPallet", x: 16, z: 16, rot: 0, h: 0 },
      { id: "cp-mv1k90fc-2h", type: "pkWallScreen", x: -2.5, z: 13.3, rot: 2, h: 0 },
      { id: "cp-mv1k90ko-2i", type: "pkWallSign", x: 3, z: 13.3, rot: 2, h: 0 },
      { id: "cp-mv1k90nu-2j", type: "gcCounterTill", x: -4.5, z: 4.5, rot: 2, h: 0.9 },
      { id: "cp-mv1k90uh-2k", type: "gcTipJar", x: -3.6, z: 4.4, rot: 0, h: 0.9 },
      { id: "cp-mv1k90xl-2l", type: "gcBizCards", x: -2.8, z: 4.5, rot: 0, h: 0.96 },
      { id: "cp-mv1k9106-2m", type: "gcDeskBell", x: -1.9, z: 4.5, rot: 0, h: 0.94 },
    ]
  });
  // the pack's state in the save: which gates and barriers are open, which levers are on
  function pkState() { if (!S.pack) S.pack = { gates: {}, switches: {} }; if (!S.pack.gates) S.pack.gates = {}; if (!S.pack.switches) S.pack.switches = {}; return S.pack; }
  function pkToggleGate(id) { var P = pkState(); P.gates[id] = !P.gates[id]; sfx(P.gates[id] ? 'open' : 'close'); buildProp(id); save(); screenDirtyAll(); }
  function pkGates() { return Object.keys(propInst).filter(function (id) { var d = propDef(id); return d && (d.id === 'pkGate' || d.id === 'pkBarrier'); }); }
  function pkTimeLabel() { var h = Math.floor(S.time || 0), m = Math.floor(((S.time || 0) - h) * 60); return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m; }

  // ── a control panel: a standing cabinet with a touch screen; the screen lists the gates and barriers and opens or closes them, counts presses, and shows the time ──
  defProp('pkPanel', { extra: true, shop: false, label: 'control panel', cat: 'pack', desc: 'A standing panel with a touch screen: the gates and barriers in the game open and close from it.', build: function (c) {
    c.box(0.9, 1.3, 0.22, MAT.grey, 0, 1.45, -0.11); c.box(0.5, 0.8, 0.3, MAT.steelDark, 0, 0.4, -0.08); c.box(0.9, 0.04, 0.3, MAT.steelDark, 0, 0.82, -0.08); c.solid(-0.45, 0.45, -0.25, 0.05, 0, 2.2);
    touchScreen({ w: 420, h: 330, pw: 0.78, ph: 0.616, x: 0, y: 1.5, z: 0.012, parent: c.group, title: 'Control panel', draw: function (ctx, sc) {
      scBg(ctx, sc.w, sc.h); scHead(ctx, sc.w, 'CONTROL PANEL', pkTimeLabel()); var P = pkState(), gates = pkGates(), y = 70;
      if (!gates.length) scText(ctx, 16, y, 'No gate or barrier placed yet.'); else gates.forEach(function (g, i) { if (i > 4) return; var open = !!P.gates[g], d = propDef(g); scText(ctx, 16, y + 20, (d.id === 'pkBarrier' ? 'Barrier ' : 'Gate ') + (i + 1) + ': ' + (open ? 'open' : 'closed')); scButton(sc, 250, y, 150, 34, open ? 'Close' : 'Open', !open, function () { pkToggleGate(g); }); y += 46; });
      scButton(sc, 16, sc.h - 56, 140, 40, 'Press', true, function () { S.presses = (S.presses || 0) + 1; }); scText(ctx, 170, sc.h - 30, 'Presses: ' + (S.presses || 0));
    } });
  } });
  // ── a wall screen: the time and a note, on a bracket ──
  defProp('pkWallScreen', { extra: true, shop: false, label: 'wall screen', cat: 'pack', wall: true, desc: 'A screen on a wall bracket showing the time and the day.', build: function (c) {
    c.box(0.1, 0.1, 0.12, MAT.steelDark, 0, 1.7, 0.06); c.box(0.84, 0.52, 0.04, MAT.black, 0, 1.7, 0.14);
    touchScreen({ w: 400, h: 240, pw: 0.78, ph: 0.468, x: 0, y: 1.7, z: 0.165, parent: c.group, title: 'Wall screen', autoPage: true, draw: function (ctx, sc) { scBg(ctx, sc.w, sc.h); scHead(ctx, sc.w, pkTimeLabel(), 'Day ' + (S.day || 1)); scText(ctx, 16, 110, 'Co Engine', null, 28); scText(ctx, 16, 150, 'basics pack: wall screen'); } });
  } });

  // ── a sliding gate between two posts: 3.2 m wide; the leaf slides aside when open and the way is free ──
  defProp('pkGate', { extra: true, shop: false, label: 'sliding gate', cat: 'pack', desc: 'A 3.2 m sliding gate. Use it, or a control panel, to open and close it.', build: function (c, P, inst) {
    var open = !!pkState().gates[inst.id], w = 3.2, h = 2.0;
    c.box(0.2, 2.3, 0.2, MAT.steelDark, -w / 2 - 0.1, 1.15, 0); c.box(0.2, 2.3, 0.2, MAT.steelDark, w / 2 + 0.1, 1.15, 0);   /* the posts */
    c.box(w + 0.4, 0.06, 0.06, MAT.steel, 0, 0.05, 0);   /* the rail */
    var g = c.dynGroup(), off = open ? w - 0.3 : 0; g.position.x = off;   /* the leaf, slid aside when open */
    box(w, 0.08, 0.08, MAT.steel, 0, h, 0, g); box(w, 0.08, 0.08, MAT.steel, 0, 0.14, 0, g); box(0.08, h, 0.08, MAT.steel, -w / 2 + 0.04, h / 2 + 0.07, 0, g); box(0.08, h, 0.08, MAT.steel, w / 2 - 0.04, h / 2 + 0.07, 0, g);
    for (var i = 1; i < 12; i++) box(0.04, h - 0.1, 0.04, MAT.steelDark, -w / 2 + i * (w / 12), h / 2 + 0.07, 0, g);
    box(0.5, 0.3, 0.02, MAT.yellow, 0, 1.2, 0.05, g);
    if (!open) c.solid(-w / 2, w / 2, -0.12, 0.12, 0, 2.3); else c.solid(w / 2 - 0.3, w / 2 + w, -0.12, 0.12, 0, 2.3);
    c.solid(-w / 2 - 0.2, -w / 2, -0.12, 0.12, 0, 2.3); c.solid(w / 2, w / 2 + 0.2, -0.12, 0.12, 0, 2.3);
    c.hit(w, 2.2, 0.5, off, 1.1, 0, { prompt: function () { return open ? 'Close the gate' : 'Open the gate'; }, use: function () { pkToggleGate(inst.id); } });
  } });
  // ── a boom barrier: a post and an arm that lifts ──
  defProp('pkBarrier', { extra: true, shop: false, label: 'boom barrier', cat: 'pack', desc: 'A boom barrier over a 3.5 m lane. Use it, or a control panel, to lift and lower it.', build: function (c, P, inst) {
    var open = !!pkState().gates[inst.id];
    c.box(0.36, 1.1, 0.36, MAT.grey, -1.9, 0.55, 0); c.box(0.3, 0.1, 0.3, MAT.steelDark, -1.9, 1.12, 0); c.solid(-2.1, -1.7, -0.2, 0.2, 0, 1.3);
    var g = c.dynGroup(); g.position.set(-1.7, 1.05, 0); g.rotation.z = open ? Math.PI / 2 - 0.1 : 0;
    box(3.6, 0.1, 0.1, MAT.white, 1.8, 0, 0, g); for (var i = 0; i < 4; i++) box(0.45, 0.11, 0.11, MAT.red, 0.5 + i * 0.9, 0, 0, g);
    if (!open) c.solid(-1.7, 1.9, -0.15, 0.15, 0.6, 1.4);
    c.hit(0.8, 1.6, 0.8, -1.9, 0.8, 0, { prompt: function () { return open ? 'Lower the barrier' : 'Lift the barrier'; }, use: function () { pkToggleGate(inst.id); } });
  } });
  // ── a lever that switches something on and off (the game reads S.pack.switches[id]) ──
  defProp('pkLever', { extra: true, shop: false, label: 'lever', cat: 'pack', desc: 'A lever: on or off, kept in the save as S.pack.switches[id].', build: function (c, P, inst) {
    var on = !!pkState().switches[inst.id];
    c.box(0.3, 1.0, 0.3, MAT.steelDark, 0, 0.5, 0); c.box(0.34, 0.06, 0.34, MAT.yellow, 0, 1.03, 0); c.solid(-0.2, 0.2, -0.2, 0.2, 0, 1.1);
    var g = c.dynGroup(); g.position.set(0, 1.05, 0); g.rotation.x = on ? -0.9 : 0.9; box(0.04, 0.5, 0.04, MAT.steel, 0, 0.25, 0, g); box(0.1, 0.1, 0.1, MAT.red, 0, 0.5, 0, g);
    c.hit(0.6, 1.4, 0.6, 0, 0.7, 0, { prompt: function () { return on ? 'Switch it off' : 'Switch it on'; }, use: function () { pkState().switches[inst.id] = !on; sfx('click'); buildProp(inst.id); save(); } });
  } });

  // ── signs ──
  defProp('pkSign', { extra: true, shop: false, label: 'standing sign', cat: 'pack', desc: 'A sign on two legs. Change its lines in the Pack tab.', build: function (c) { c.box(0.05, 1.2, 0.05, MAT.steelDark, -0.5, 0.6, 0); c.box(0.05, 1.2, 0.05, MAT.steelDark, 0.5, 0.6, 0); c.sign(['NOTICE', 'edit me in the Pack tab'], 1.2, 0.6, 0, 1.5, 0.03, 0); c.solid(-0.55, 0.55, -0.1, 0.1, 0, 1.9); } });
  defProp('pkWallSign', { extra: true, shop: false, label: 'wall sign', cat: 'pack', wall: true, desc: 'A sign for a wall. Change its lines in the Pack tab.', build: function (c) { c.sign(['AREA 1'], 1.6, 0.5, 0, 2.1, 0.03, 0); } });
  // ── things that stand around ──
  defProp('pkCrate', { extra: true, shop: false, label: 'crate', cat: 'pack', desc: 'A wooden crate.', build: function (c) { c.box(0.9, 0.9, 0.9, MAT.wood, 0, 0.45, 0); c.box(0.92, 0.06, 0.92, MAT.steelDark, 0, 0.3, 0); c.box(0.92, 0.06, 0.92, MAT.steelDark, 0, 0.6, 0); c.solid(-0.45, 0.45, -0.45, 0.45, 0, 0.9); } });
  defProp('pkPallet', { extra: true, shop: false, label: 'pallet', cat: 'pack', desc: 'An empty pallet.', build: function (c) { for (var i = 0; i < 5; i++) c.box(1.2, 0.03, 0.12, MAT.wood, 0, 0.14, -0.4 + i * 0.2); for (var j = 0; j < 3; j++) c.box(0.1, 0.1, 1.0, MAT.wood, -0.5 + j * 0.5, 0.06, 0); c.solid(-0.6, 0.6, -0.5, 0.5, 0, 0.16); } });
  defProp('pkBench', { extra: true, shop: false, label: 'bench', cat: 'pack', desc: 'A bench for two.', build: function (c) { c.box(1.6, 0.06, 0.4, MAT.wood, 0, 0.45, 0); c.box(1.6, 0.4, 0.05, MAT.wood, 0, 0.7, -0.2); c.box(0.06, 0.45, 0.4, MAT.steelDark, -0.7, 0.22, 0); c.box(0.06, 0.45, 0.4, MAT.steelDark, 0.7, 0.22, 0); c.solid(-0.8, 0.8, -0.25, 0.25, 0, 0.9); } });
  defProp('pkBin', { extra: true, shop: false, label: 'bin', cat: 'pack', desc: 'A steel bin.', build: function (c) { c.cyl(0.28, 0.8, MAT.steelDark, 0, 0.4, 0, 14); c.cyl(0.3, 0.05, MAT.black, 0, 0.82, 0, 14); c.solid(-0.3, 0.3, -0.3, 0.3, 0, 0.9); } });
  defProp('pkCone', { extra: true, shop: false, label: 'traffic cone', cat: 'pack', desc: 'An orange cone.', build: function (c) { c.box(0.4, 0.04, 0.4, MAT.black, 0, 0.02, 0); c.cyl(0.1, 0.6, MAT.red, 0, 0.34, 0, 10, 0.2); c.cyl(0.11, 0.08, MAT.white, 0, 0.4, 0, 10); c.solid(-0.2, 0.2, -0.2, 0.2, 0, 0.7); } });
  defProp('pkLampPost', { extra: true, shop: false, label: 'lamp post', cat: 'pack', desc: 'A lamp post with a warm light at night.', build: function (c) { c.cyl(0.07, 3.4, MAT.steelDark, 0, 1.7, 0, 10); c.box(0.5, 0.06, 0.06, MAT.steelDark, 0.22, 3.4, 0); c.box(0.4, 0.12, 0.3, MAT.grey, 0.4, 3.4, 0); c.box(0.36, 0.02, 0.26, MAT.yellow, 0.4, 3.33, 0); c.light(0xffd9a0, 1.2, 9, 0.4, 3.2, 0); c.solid(-0.12, 0.12, -0.12, 0.12, 0, 3.6); } });
  defProp('pkFence', { extra: true, shop: false, label: 'fence section', cat: 'pack', desc: 'A 2 m mesh fence section with two posts.', build: function (c) { c.box(0.08, 1.9, 0.08, MAT.steelDark, -1, 0.95, 0); c.box(0.08, 1.9, 0.08, MAT.steelDark, 1, 0.95, 0); c.plane(2, 1.7, MAT.mesh, 0, 1.0, 0, 0, 0); c.box(2, 0.04, 0.04, MAT.steel, 0, 1.86, 0); c.solid(-1.04, 1.04, -0.06, 0.06, 0, 1.95); } });
  defProp('pkPlanter', { extra: true, shop: false, label: 'planter', cat: 'pack', desc: 'A concrete planter with a shrub.', build: function (c) { c.box(1.2, 0.5, 0.6, MAT.block, 0, 0.25, 0); c.box(1.1, 0.04, 0.5, MAT.yard, 0, 0.5, 0); c.sphere(0.32, MAT.grass, -0.3, 0.75, 0); c.sphere(0.28, MAT.grass, 0.3, 0.7, 0.05); c.solid(-0.6, 0.6, -0.3, 0.3, 0, 1.1); } });
  // the pack waits for the engine: a game part ahead of CO.setup runs it on the beforeBuild hook, the editor runs it at once
  var growcoPack = function (HOST_MAT, HOST_TEX) {
    // stand-ins for the shop systems the props reach for: harmless, empty, never saved
    var G_DEFS = {}, G_ORDER = [];
    var world = { group: CO.root || scene, interact: [], obstacles: [], lights: [], doors: [], fixtures: [], screens: [], reg: null, shelves: [], dyn: [] };
    var xs = function () { return { jobs: [], strains: [], stock: {}, flags: {}, owned: {}, upgrades: {}, dlc: {} }; };
    var dlcOn = function () { return true; }, dlcProp = function () { return true; }, unitIds = function () { return []; }, unitBase = function (id) { return id; };
    var drive = { on: false }, sec = { view: { on: false } }, deskBoard = { lastFetch: 0, data: null }, held = function () { return null; };
    var growDefProp = function (id, def) { G_DEFS[id] = def; G_ORDER.push(id); }, propExtra = function (id, fn) { var d = G_DEFS[id]; if (!d) return; var b = d.build; d.build = function (c, P) { b(c, P); try { fn(c, P); } catch (e) {} }; };
    var PROPS = G_DEFS, PROP_ORDER = G_ORDER;
    var G_FIX = [], fixtureFromBuild = function (id, label, yaw, fn) { G_FIX.push({ id: id, label: label, fn: fn }); }, fixtureAdd = function () {}, buildPos = function () {};
    // Grow's own carried code, in its part order
    /* 00-head.js */
    var money = function (n) { return '$' + Math.floor(n).toLocaleString('en-US'); };
    /* 00-head.js */
    var gram = function (n) { return (Math.round(n * 10) / 10) + 'g'; };
    /* 01-config.js */
    var STRAINS = [
        { id: 'sunflower', name: 'Sunflower Kush', emoji: '🌻', seed: 10,  growMs: 3600000, yield: 12, thc: 1.0, lvl: 1, bud: 0x7fc96b, hair: 0xffb347, leaf: 0x4caf50 },
        { id: 'amber',     name: 'Amber Haze',     emoji: '🍯', seed: 18,  growMs: 4320000, yield: 16, thc: 1.3, lvl: 2, bud: 0xa8c95a, hair: 0xff8c1a, leaf: 0x5cb85c },
        { id: 'widow',     name: 'Green Widow',    emoji: '🕸️', seed: 32,  growMs: 5040000, yield: 24, thc: 1.5, lvl: 4, bud: 0xd8e6c8, hair: 0xffd27f, leaf: 0x3d9a4a },
        { id: 'diesel',    name: 'Diesel Drift',   emoji: '⛽', seed: 48,  growMs: 5760000, yield: 18, thc: 1.9, lvl: 6, bud: 0x6fa85a, hair: 0xff5722, leaf: 0x2e7d32 },
        { id: 'runtz',     name: 'Rainbow Runtz',  emoji: '🌈', seed: 85,  growMs: 6480000, yield: 22, thc: 2.4, lvl: 9, bud: 0x9b6fd6, hair: 0xff69b4, leaf: 0x5a3f9e }
      ];
    /* 01-config.js */
    var strainById = function (id) { for (var i = 0; i < STRAINS.length; i++) if (STRAINS[i].id === id) return STRAINS[i]; return STRAINS[0]; };
    /* 01-config.js */
    var SUPPLIES = [
        { id: 'soil',      ico: '🪴', name: 'Bag of soil',      price: 4,  hint: 'One per planting' },
        { id: 'pot',       ico: '🫙', name: 'Grow pot',         price: 12, hint: 'A reusable grow slot' },
        { id: 'nutrients', ico: '🧪', name: 'Nutrients',        price: 6,  hint: 'Feed a plant: +yield, +quality' },
        { id: 'remedy',    ico: '🧴', name: 'Pest spray',       price: 9,  hint: 'Cures a pest or mould outbreak' },
        { id: 'bag',       ico: '🛍️', name: 'Baggies (×10)',    price: 8,  qty: 10, hint: 'Package eighths' },
        { id: 'paper',     ico: '📄', name: 'Papers (×20)',     price: 6,  qty: 20, hint: 'Roll joints' },
        { id: 'tip',       ico: '🚬', name: 'Filter tips (×20)', price: 4, qty: 20, hint: 'Roll joints' },
        { id: 'grinder',   ico: '⚙️', name: 'Grinder',          price: 60, tool: true, hint: 'Bought once. The workbench needs it to bag or roll' },
        { id: 'jar',       ico: '🏺', name: 'Curing jar',       price: 15, hint: 'One batch cures per jar, and two always can; the rest wait on the shelf' },
        { id: 'mix',       ico: '🍪', name: 'Cookie mix (6 cookies)', price: 8, hint: 'Bake edibles at the bench: one box + 1 g of stash' },
        { id: 'lighter',   ico: '🔥', name: 'Lighters (box of 20)', price: 10, qty: 20, stock: 'display', hint: 'Counter display · sells for $3' },
        { id: 'rpaper',    ico: '📄', name: 'Retail papers (×10)', price: 12, qty: 10, stock: 'display', hint: 'Counter display · sells for $4' },
        { id: 'rgrinder',  ico: '⚙️', name: 'Grinders (×5)',      price: 30, qty: 5,  stock: 'display', hint: 'Counter display · sells for $15' },
        { id: 'drink',     ico: '🥤', name: 'Drinks (case of 12)', price: 18, qty: 12, stock: 'vend', hint: 'Restock the vending machine' },
        { id: 'snack',     ico: '🍫', name: 'Snacks (box of 12)',  price: 15, qty: 12, stock: 'vend', hint: 'Restock the vending machine' },
        { id: 'cup',       ico: '🥡', name: 'Cups (sleeve of 50)', price: 10, qty: 50, stock: 'coffee', hint: 'For the lobby coffee machine' },
        { id: 'beans',     ico: '☕', name: 'Coffee beans (40 cups)', price: 30, qty: 40, stock: 'coffee', hint: 'For the lobby coffee machine' }
      ];
    /* 01-config.js */
    function supplyById(id) { for (var i = 0; i < SUPPLIES.length; i++) if (SUPPLIES[i].id === id) return SUPPLIES[i]; return null; }
    /* 01-config.js */
    function itemName(id) { if (id.indexOf('seed_') === 0) return strainById(id.slice(5)).name + ' seeds'; var it = supplyById(id); return it ? it.name.replace(/ \(.*\)$/, '') : id; }
    /* 01-config.js */
    function itemIcon(id) { if (id.indexOf('seed_') === 0) return strainById(id.slice(5)).emoji; var it = supplyById(id); return it ? it.ico : '📦'; }
    /* 01-config.js */
    function itemPack(id) { if (id.indexOf('seed_') === 0) return 5; var it = supplyById(id); return it && it.qty ? it.qty : 10; }
    /* 01-config.js */
    var LIGHTS = [
        { id: 'none', name: 'Windowsill', spd: 1.0,  qual: 0,  yld: 0.85, draw: 0,  price: 0,   color: 0xfff1d0, intensity: 0.0 },
        { id: 'cfl',  name: 'CFL lamp',   spd: 1.05, qual: 6,  yld: 0.95, draw: 0.8,  price: 60,  color: 0xfff4c8, intensity: 2.5 },
        { id: 'led',  name: 'LED panel',  spd: 1.12, qual: 12, yld: 1.15, draw: 1.8, price: 260, color: 0xd070ff, intensity: 4.5 },
        { id: 'hps',  name: 'HPS rig',    spd: 1.18, qual: 18, yld: 1.35, draw: 5.0, price: 800, color: 0xffb060, intensity: 6.0 },
        { id: 'qb',   name: 'Quantum board', spd: 1.26, qual: 26, yld: 1.55, draw: 3.6, price: 2600, color: 0xffe6ff, intensity: 7.5 },
        { id: 'array', name: 'Full-spectrum array', spd: 1.35, qual: 34, yld: 1.80, draw: 6.0, price: 7000, color: 0xfff8f0, intensity: 9.0 }
      ];
    /* 01-config.js */
    var TENTS = [
        { slots: 4,  price: 0,    cols: 2, rows: 2 },
        { slots: 6,  price: 240,  cols: 3, rows: 2 },
        { slots: 9,  price: 900,  cols: 3, rows: 3, lic: 'cult2' },
        { slots: 12, price: 2600, cols: 4, rows: 3, lic: 'cult2' },
        { slots: 16, price: 7000, cols: 4, rows: 4, lic: 'cult3' },
        { slots: 20, price: 16000, cols: 5, rows: 4, lic: 'cult3' }
      ];
    /* 01-config.js */
    var UPGRADES = [
        { id: 'autowater', ico: '💧', name: 'Auto-waterer',      price: 300, d: 'Plants never go thirsty again.' },
        { id: 'roller',    ico: '🤖', name: 'Rolling machine',   price: 360, d: 'Roll 5 joints at once, no paper/tip waste.' },
        { id: 'rack',      ico: '🗄️', name: 'Curing rack',       price: 220, d: 'Curing is 60% faster and reaches higher quality.' },
        { id: 'security',  ico: '🛡️', name: 'Security & sealing', price: 520, d: 'Halves the chance of pest and mould outbreaks.' },
        { id: 'dehumid',   ico: '🌬️', name: 'Industrial dehumidifiers', price: 320, d: 'Both units pull moisture twice as fast and can be set as low as 40%.' },
        { id: 'doser',     ico: '🧪', name: 'Nutrient doser',    price: 450, d: 'Every plant is fed automatically when it starts flowering.' },
        { id: 'trimmer',   ico: '✂️', name: 'Trimming machine',  price: 600, d: 'Cleaner harvests: +15% yield from every plant.' },
        { id: 'sign',      ico: '🪧', name: 'Neon sign & flyers', price: 380, d: 'Word gets round: customers turn up 35% more often.' },
        { id: 'lobby',     ico: '☕', name: 'Lobby coffee machine', price: 300, d: 'Customers wait 50% longer and tip a little rep.' },
        { id: 'robovac',   ico: '🤖', name: 'Robot vacuum',      price: 480, d: 'Dust builds up half as fast.' },
        { id: 'rack2',     ico: '🧊', name: 'Climate cure cabinet', price: 1800, req: 'rack', d: 'Curing 2.4× faster and +20 quality cap.' },
        { id: 'hydro',     ico: '💦', name: 'Hydroponic loop',   price: 4000, req: 'autowater', d: 'Plants grow 12% faster.' },
        { id: 'security2', ico: '📹', name: 'CCTV & alarms',     price: 2600, req: 'security', d: 'Outbreaks cut to a quarter.' },
        { id: 'panic',     ico: '🚨', name: 'Silent alarm',      price: 450, d: 'Press P during a robbery: police arrive in about 20 s and arrest whoever is still inside.' },
        { id: 'guardgun',  ico: '🦺', name: 'Armed guard',    price: 2400, d: 'Your guard carries a sidearm and stands up to armed robbers. Without it he almost never stops a gun. Only counts while you hold the firearms licence.' },
        { id: 'roller2',   ico: '🏭', name: 'Industrial roller', price: 1800, req: 'roller', d: 'Rolls 10 joints at a time.' },
        { id: 'hvac',      ico: '❄️', name: 'Climate control HVAC', price: 7000, req: 'dehumid', d: 'Humidity locks to target almost instantly and rooms run drier.' },
        { id: 'trimmer2',  ico: '🔪', name: 'Precision trimmer', price: 4200, req: 'trimmer', d: '+30% yield in total.' },
        { id: 'billboard', ico: '🛣️', name: 'Billboard & socials', price: 3600, req: 'sign', d: 'Customers turn up 60% more often in total.' },
        { id: 'lounge2',   ico: '🛋️', name: 'Lobby refit',       price: 2400, req: 'lobby', d: 'Customers wait twice as long and tip 2 rep.' },
        { id: 'genetics',  ico: '🧬', name: 'Genetics lab',      price: 12000, lvl: 8, d: 'Every new plant starts with +10 quality.' },
        { id: 'ownvan',    ico: '🚐', name: 'Own delivery van',  price: 16000, lvl: 6, d: 'Orders land in the back room within 20 seconds.' },
        { id: 'solar',     ico: '☀️', name: 'Solar roof',        price: 9000, d: 'Supplies cost 10% less (stacks with a wholesale account) and the power bill falls by 35%.' },
        { id: 'scale',     ico: '⚖️', name: 'Digital scale',     price: 260,  d: 'Eighths weigh out at 3.2 g instead of 3.5 g.' },
        { id: 'cones',     ico: '🍦', name: 'Pre-rolled cones',  price: 700,  d: 'Joints take 0.8 g instead of 1 g.' },
        { id: 'skylight',  ico: '🌤️', name: 'Skylight',          price: 2200, d: 'Plants grow 6% faster.' },
        { id: 'fintech',   ico: '💳', name: 'Payment terminal',  price: 1800,  d: 'Card sales pay 3% more and the ATM waives its fee.' },
        { id: 'ozone',     ico: '🫧', name: 'Ozone air scrubber', price: 700, d: 'Mould never takes hold, only pests.' },
        { id: 'tipjar',    ico: '🫙', name: 'Vintage tip jar',   price: 350,  d: 'Tips are doubled.' },
        { id: 'grinder2',  ico: '⚡', name: 'Electric grinder',  price: 400,  d: 'No more hand grinding before bagging or rolling.' },
        { id: 'bagger',    ico: '🏭', name: 'Auto-bagging line', price: 6000, req: 'scale', d: 'Bags weigh and seal themselves, so a whole stash bags in one go.' },
        { id: 'oven',      ico: '🔥', name: 'Convection oven',   price: 600,  d: 'Cookies bake themselves to the second, so a whole stash bakes in one go.' }
      ];
    /* 01-config.js */
    var LICENCES = [
        { id: 'retail',    ico: '🪪', name: 'Retail licence',       price: 800,  lvl: 2,  d: 'Customers may pay by card. Without it everyone pays cash.' },
        { id: 'catering',  ico: '☕', name: 'Vending & catering permit', price: 450, d: 'The vending machine and coffee machine may sell.' },
        { id: 'amusement', ico: '🕹️', name: 'Amusement permit',     price: 400,  d: 'The arcade cabinet may take coins.' },
        { id: 'lounge',    ico: '🛋️', name: 'Lounge licence',       price: 700,  rep: 200, d: 'Customers may sit and smoke in the lobby, and each one buys a joint off the goods shelf to do it.' },
        { id: 'cult2',     ico: '🌱', name: 'Cultivation permit II', price: 900, lvl: 3, d: 'Unlocks the ' + tentSizes('cult2') + ' tents and the roof greenhouse beds. Plants grow 5% faster.' },
        { id: 'cult3',     ico: '🌳', name: 'Cultivation permit III', price: 6000, lvl: 6, req: 'cult2', d: 'Unlocks the ' + tentSizes('cult3') + ' tents.' },
        { id: 'wholesale', ico: '📦', name: 'Wholesale account',    price: 3600, lvl: 4, d: 'Supplies 15% cheaper and the van comes twice as fast.' },
        { id: 'tobacco',   ico: '🚬', name: 'Tobacco manufacturing licence', price: 3000, lvl: 8, dlc: 'tobacco', d: 'Run the RF Smoking line in the basement: grow, cure, roll and pack your own cigarettes.' },
        { id: 'firearm',   ico: '🔫', name: 'Firearms licence',     price: 3000, lvl: 4, rep: 240, d: 'Lets you buy and carry the pistol and shotgun from the weapon locker. Shoot a bystander and it\'s revoked.' },
        { id: 'premium',   ico: '🎩', name: 'Connoisseur permit',   price: 3000, rep: 320, d: 'Connoisseurs visit and pay 2.2× for quality.' },
        { id: 'latehours', ico: '🌙', name: 'Late-hours licence',   price: 1000, rep: 400, d: 'From 20:00 to 02:00 customers come a third more often and pay 5% more.' },
        { id: 'brand',     ico: '®️', name: 'Brand registration',   price: 4000, rep: 480, d: '+4% on every price.' },
        { id: 'export',    ico: '🚢', name: 'Export licence',       price: 14000, lvl: 10, rep: 960, d: 'Bulk contracts under Bank on the office PC: sell up to 100 g of a strain at 70% of gram value, paid next day.' }
      ];
    /* 01-config.js */
    function tentSizes(lic) {   // '9 and 12-slot': read off the tent table, so a pack tent that needs the permit is named with the rest
        var n = TENTS.filter(function (t) { return t.lic === lic; }).map(function (t) { return t.slots; });
        return n.length ? (n.length > 1 ? n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1] : n[0]) + '-slot' : 'bigger';
      }
    /* 01-config.js */
    function licById(id) { for (var i = 0; i < LICENCES.length; i++) if (LICENCES[i].id === id) return LICENCES[i]; return null; }
    /* 01-config.js */
    function hasLic(id) { if (id === 'tobacco' && !dlcOn('tobacco')) return false; return !!(S.lic && S.lic[id]); }
    /* 01-config.js */
    var DLC_NAME = { tobacco: 'RF Smoking: the Tobacco Works', lab: 'The Extraction Lab', greenhouse: 'The Roof Greenhouse', dev: 'Dev Tools' };
    /* 01-config.js */
    function nightNow() { var h = gameHour(); return h >= 20 || h < 2; }
    /* 01-config.js */
    function bagGrams() { return S.upgrades.scale ? 3.2 : 3.5; }
    /* 01-config.js */
    function jointGrams() { return S.upgrades.cones ? 0.8 : 1; }
    /* 01-config.js */
    function supplyDisc() { return (hasLic('wholesale') ? 0.85 : 1) * (S.upgrades.solar ? 0.9 : 1); }
    /* 01-config.js */
    var DRY_MS_BASE = 135000, CURE_CAP_BASE = 22, THIRST_RATE = 1 / 450, HAZARD_CHANCE = 0.002;
    /* 02-state.js */
    var SAVE_V = 2;
    /* 02-state.js */
    function fresh() {
        return {
          v: SAVE_V, bank: 220, xp: 0, level: 1, rep: 0,
          till: 0, tips: 0, vault: 0, pocket: 0, pending: [], courier: null,   // cash lives in places until you move it
          units: { vending: 1, lobbyCoffee: 1, arcade: 1, fridge: 1 },   // how many of each machine the shop owns
          storage: {}, order: null, deliveries: [],
          display: { lighter: 6, rpaper: 4, rgrinder: 1 }, noCustomersUntil: 0, courierBanUntil: 0,
          stock: { bags: {}, joints: {}, cookies: {} }, staff: { worker: false, task: 'idle', guardTask: 'door' },   // the back-room stock cabinet for packed goods; who works here and what they are on
          hotbar: [null, null, null, null, null, null], slot: 0,   // what you carry: six slots, the active one is what E and G act on   // counter display stock; cooldowns after trouble   // the back room and what the machines hold
          supplies: { soil: 0, pot: 1, nutrients: 0, remedy: 0, bag: 0, paper: 0, tip: 0, grinder: 0, jar: 1 },
          light: 'none', tent: 0, upgrades: {}, lic: {},
          rh: { grow: 62, dry: 62 }, dehum: { grow: 55, dry: 55 },
          clock: 9, day: 1,   // in-game time of day (hours) and day counter for the day/night cycle   // room humidity and each dehumidifier's target (0 = off)
          plants: [], batches: [],
          cured: { g: 0, qSum: 0, thcSum: 0 },
          pkg: { bags: { n: 0, qSum: 0, thcSum: 0 }, joints: { n: 0, qSum: 0, thcSum: 0 }, cookies: { n: 0, qSum: 0, thcSum: 0 } },   // derived totals, kept in step with stash/lots by syncTotals()
          stash: {}, lots: { bags: {}, joints: {}, cookies: {} },   // per strain: stash[strain] = {g,qSum,thcSum}; lots[kind][strain] = {n,qSum,thcSum}
          market: 1.0, event: null, customer: null,
          log: [], stats: { harvested: 0, sold: 0, earned: 0, plants: 0 },
          books: { monthGross: 0, dayGross: 0, exciseDue: 0, lastDayCosts: 0, arrears: 0, month: 1, lastBill: null, dayOther: 0, monthOther: 0 },   // the ledger: what has been taken, what is owed
          lastTick: now(), lastEvent: now(), lastCustomer: now(), created: now(), steps3d: 0,
          intro: { i: 0, done: false, skipped: false },   // the guided intro, only for a brand new shop
          potSoil: {}, held: null,
          vip: null, car: null, flyerDay: 0,   // where the car was left and what is in its trunk
          tob: null, cigStock: {}, cigShutter: false,   // the basement line, the cabinet behind the counter and its roller shutter
          armory: { pepper: false, taser: false, pistol: false, shotgun: false, rifle: false, ak: false, spray: 0, rounds: 0, shells: 0, cartridges: 0, bullets: 0 }   // what the weapon locker holds
        };
      }
    /* 02-state.js */
    function slots() { return TENTS[S.tent].slots; }
    /* 02-state.js */
    function lightObj() { for (var i = 0; i < LIGHTS.length; i++) if (LIGHTS[i].id === S.light) return LIGHTS[i]; return LIGHTS[0]; }
    /* 02-state.js */
    function lightIdx() { for (var i = 0; i < LIGHTS.length; i++) if (LIGHTS[i].id === S.light) return i; return 0; }
    /* 02-state.js */
    function stashOf(id) { return S.stash[id] || (S.stash[id] = { g: 0, qSum: 0, thcSum: 0 }); }
    /* 02-state.js */
    function lotOf(kind, id) { return S.lots[kind][id] || (S.lots[kind][id] = { n: 0, qSum: 0, thcSum: 0 }); }
    /* 02-state.js */
    function plantAtSlot(slot) { for (var i = 0; i < S.plants.length; i++) if (S.plants[i].slot === slot) return S.plants[i]; return null; }
    /* 03-log-sound.js */
    var ECON = {
        baseGram: 5.5,        // $/g, plain low-grade flower at an average market
        gradeExp: 0.8,        // quality x potency, with diminishing returns
        repCap: 0.10,         // reputation is worth at most +10% on price; mostly it buys footfall
        brandBonus: 0.04, lateBonus: 0.05, chillBonus: 0.02,
        bagMarkup: 1.08,      // an eighth carries a packaging premium
        jointMarkup: 1.35,    // a pre-roll carries a convenience premium
        cookieShare: 0.40,    // one cookie is worth 0.40 x the gram it came from (six to a gram)
        excise: 0.15,         // sales tax inside the shelf price, held back and paid with the monthly bill
        taxRate: 0.10,        // business tax on the month's gross...
        taxHighRate: 0.20,    // ...and on the part of a big month over taxHighFrom, so a finished shop still has a bill that grows with it
        taxHighFrom: 60000
      };
    /* 03-log-sound.js */
    function gradeMult(q, thc) { return Math.pow((0.6 + (q / 100) * 0.8) * thc, ECON.gradeExp); }
    /* 03-log-sound.js */
    function premiumMult() { return 1 + Math.min(ECON.repCap, S.rep / 1000) + (hasLic('brand') ? ECON.brandBonus : 0) + (hasLic('latehours') && nightNow() ? ECON.lateBonus : 0) + (S.chill && S.chill.until > now() ? ECON.chillBonus : 0); }
    /* 03-log-sound.js */
    function repMult() { return premiumMult(); }
    /* 03-log-sound.js */
    function gramValue(q, thc) { return ECON.baseGram * gradeMult(q, thc) * S.market * premiumMult() * (shop().markup || 1); }
    /* 03-log-sound.js */
    function bagPrice(q, thc) { return gramValue(q, thc) * bagGrams() * ECON.bagMarkup; }
    /* 03-log-sound.js */
    function jointPrice(q, thc) { return gramValue(q, thc) * jointGrams() * ECON.jointMarkup; }
    /* 03-log-sound.js */
    function cookiePrice(q, thc) { return gramValue(q, thc) * ECON.cookieShare; }
    /* 03-log-sound.js */
    var COST = {
        rentBase: 20,          // the unit itself, per day
        rentPerSlot: 7,        // floor space for every tent slot
        rentBasement: 35,      // the tobacco works downstairs
        rentBranch: 90,        // the second shop
        branchManager: 120,    // the one person who runs it, a flat day rate
        guardWage: 60,         // the security guard on the door, for any day he is on shift
        driverKeep: 6,         // packs of each kind the driver leaves on the rack for round jobs
        rentFreeDays: 10,      // a fit-out period before the first rent falls, as a real lease gives you
        powerBase: 6,          // shop lights, fridge, till, security
        waterPerPlant: 0.4,
        payRate: 220,          // a day of one employee, fully loaded: wage, payroll tax and cover
        freeSlots: 8,          // up to eight slots is still a job one person can do
        slotsPerGrower: 3,     // past that, one more grower for every three further slots
        processPerGram: 0.55,  // trimming, lab testing and compliance on every gram harvested
        arrearsRep: 2,         // reputation lost for every day the bills go unpaid
        arrearsShare: 0.5      // at most this share of what the bank still holds after the bills goes on the arrears each morning, so one good day is never swept away whole
      };
    /* 03-log-sound.js */
    function headcount() {   // nobody runs a commercial grow room and a basement works on their own; the branch has its own manager on the bill
        return Math.max(0, Math.ceil((slots() - COST.freeSlots) / COST.slotsPerGrower)) + (hasLic('tobacco') ? 2 : 0);
      }
    /* 03-log-sound.js */
    function books() {
        if (!S.books) S.books = { monthGross: 0, dayGross: 0, exciseDue: 0, lastDayCosts: 0, arrears: 0, month: 1, lastBill: null, dayOther: 0, monthOther: 0 };
        if (S.books.dayOther === undefined) { S.books.dayOther = 0; S.books.monthOther = 0; }   // saves written before production costs existed
        return S.books;
      }
    /* 03-log-sound.js */
    function bookSale(total) {   // every dollar of trade passes through here; the taxman takes his cut of it later
        var B = books();
        S.stats.earned = (S.stats.earned || 0) + total;
        B.monthGross += total; B.dayGross += total; B.exciseDue += total * ECON.excise;
      }
    /* 03-log-sound.js */
    function billLines() {   // what the morning bill is made of, itemised so the P&L panel can show it
        var X = xs(), L = lightObj(), sl = slots(), solar = S.upgrades.solar ? 0.65 : 1;
        var free = (S.day || 1) <= COST.rentFreeDays;
        var rent = free ? 0 : COST.rentBase + sl * COST.rentPerSlot + (hasLic('tobacco') ? COST.rentBasement : 0) + (X.branch ? COST.rentBranch : 0);
        var power = (COST.powerBase + sl * (L.draw || 0) + (S.upgrades.hvac ? 8 : 0) + (S.upgrades.security2 ? 3 : 0) + (S.upgrades.bagline ? 4 : 0)) * solar;
        var roster = (X.staff.driver ? 1 : 0) + (X.staff.night ? 1 : 0) + (X.staff.labtech ? 1 : 0) + (X.staff.operator ? (hasLic('tobacco') ? 2 : 1) : 0);   /* roster hires are staff too; the operator runs the basement, which covers the two it needs */
        var hired = crewList().filter(function (w) { return !w.off; }).length + roster, need = headcount();
        var rows = [
          { k: 'Rent', v: rent, d: free ? 'fit-out period, rent free until day ' + (COST.rentFreeDays + 1) : sl + ' slots' + (X.branch ? ' + branch' : '') + (hasLic('tobacco') ? ' + basement' : '') },
          { k: 'Power', v: power, d: L.name + ' over ' + sl + ' slots' + (S.upgrades.solar ? ', solar roof taking 35% off' : '') },
          { k: 'Water', v: S.plants.length * COST.waterPerPlant, d: S.plants.length + ' plants in the tent' },
          { k: 'Payroll', v: Math.max(0, need - hired) * COST.payRate, d: need ? need + ' staff the place needs, ' + Math.min(need, hired) + ' of them covered by people you hired' : 'just you, for now' }
        ];
        if (!guardOff() && !free) rows.push({ k: 'Guard', v: COST.guardWage, d: 'the guard on the door. Send him home and there\'s no wage that day' });   /* his wage starts with the rent: a new shop has no takings yet */
        if (X.branch) rows.push({ k: 'Branch manager', v: COST.branchManager, d: 'runs Green Leaf for you, a flat day rate' });
        return rows;
      }
    /* 03-log-sound.js */
    function dailyFixed() { return billLines().reduce(function (a, r) { return a + r.v; }, 0); }
    /* 03-log-sound.js */
    function drawFunds(n) {   // a bill comes out of the bank first, then the vault, then the till
        var need = n, take;
        take = Math.min(S.bank, need); S.bank -= take; need -= take;
        if (need > 0) { take = Math.min(S.vault, need); S.vault -= take; need -= take; }
        if (need > 0) { take = Math.min(S.till, need); S.till -= take; need -= take; }
        return n - need;   // what was actually paid
      }
    /* 03-log-sound.js */
    function payBills(offline) {
        var B = books(), rows = billLines();
        var fixed = rows.reduce(function (a, r) { return a + r.v; }, 0);   // the staff the place needs; payWages then settles the named crew on top
        var paid = drawFunds(fixed), short = fixed - paid;
        B.lastBill = { day: S.day, rows: rows, paid: paid, short: short };
        B.lastDayCosts = fixed + B.dayOther; B.dayGross = 0; B.dayOther = 0;
        if (short > 0.5) {
          B.arrears += short; S.rep = Math.max(0, S.rep - COST.arrearsRep);
          logEvent('Bills came to ' + money(fixed) + ' and only ' + money(paid) + ' was there: ' + money(short) + ' into arrears, rep -' + COST.arrearsRep, 'bad');
          if (!offline) toast('Bills unpaid: ' + money(short) + ' into arrears', 'bad');
        } else {
          logEvent('Morning bills paid: ' + money(fixed) + ' (' + rows.slice(0, 3).map(function (r) { return r.k.toLowerCase() + ' ' + money(r.v); }).join(', ') + ')', '');
          if (B.arrears > 0.5) { var cl = drawFunds(Math.min(B.arrears, Math.floor(S.bank * COST.arrearsShare))); if (cl > 0.5) { B.arrears -= cl; var arrTxt = 'Paid ' + money(cl) + ' off the arrears' + (B.arrears > 0.5 ? ', ' + money(B.arrears) + ' still owing' : ', all square'); logEvent(arrTxt, B.arrears > 0.5 ? '' : 'good'); if (!offline) toast('🏦 ' + arrTxt, B.arrears > 0.5 ? '' : 'good'); } }   /* an instalment, never the whole balance: the rest of the debt waits for tomorrow */
        }
        payWages(offline);
        monthlyTax(offline);
      }
    /* 03-log-sound.js */
    function bizTax(gross) { return Math.min(gross, ECON.taxHighFrom) * ECON.taxRate + Math.max(0, gross - ECON.taxHighFrom) * ECON.taxHighRate; }
    /* 03-log-sound.js */
    function taxDue() { var B = books(); return Math.round(B.exciseDue + bizTax(B.monthGross)); }
    /* 03-log-sound.js */
    function taxDay() { return (Math.floor(((S.day || 1) - 1) / 28) + 1) * 28 + 1; }
    /* 03-log-sound.js */
    function monthlyTax(offline) {
        var B = books(), m = Math.floor(((S.day || 1) - 1) / 28) + 1;
        if (m === B.month) return;
        B.month = m;
        var bill = taxDue(), gross = B.monthGross;
        B.exciseDue = 0; B.monthGross = 0; B.monthOther = 0;
        if (bill <= 0) return;
        var paid = drawFunds(bill), short = bill - paid;
        if (short > 0.5) {
          B.arrears += short; S.rep = Math.max(0, S.rep - 5);
          logEvent('Tax on ' + money(gross) + ' of trade came to ' + money(bill) + ' and only ' + money(paid) + ' was there, rep -5', 'bad');
          if (!offline) toast('Tax bill short by ' + money(short), 'bad');
        } else {
          logEvent('Tax paid: ' + money(bill) + ' on ' + money(gross) + ' of trade last month', '');
          if (!offline) toast('Tax bill paid: ' + money(bill), '');
        }
      }
    /* 03-log-sound.js */
    function daysText(ms) {   // grow times span days now, so minutes stopped being the useful unit
        var d = ms / 60000 / (+SET.dayLength || 20);
        return d >= 1 ? (Math.round(d * 10) / 10) + ' days' : Math.ceil(ms / 60000) + ' min';
      }
    /* 03-log-sound.js */
    function unitPrice(kind, q, thc) { return kind === 'bags' ? bagPrice(q, thc) : kind === 'cookies' ? cookiePrice(q, thc) : jointPrice(q, thc); }
    /* 03-log-sound.js */
    function kindName(kind, n) { return kind === 'bags' ? (n === 1 ? 'bag' : 'bags') : kind === 'cookies' ? (n === 1 ? 'cookie' : 'cookies') : (n === 1 ? 'joint' : 'joints'); }
    /* 04-sim.js */
    function step(dt, offline) {
        var L = lightObj(); var auto = !!S.upgrades.autowater;
        { var dKey = SET.dayNight === 'cycle' ? 'clock' : 'dayAcc'; S[dKey] = (+S[dKey] || 0) + dt / 60 / (+SET.dayLength || 20) * 24;   /* with the sky pinned to one hour the days still pass, so rent, wages and tax still fall */ var rolled = 0; while (S[dKey] >= 24) { if (offline && rolled >= 1) { S[dKey] %= 24; break; }   /* time away turns the calendar one day at most: the bills fall once, not once for every day the window was shut */ rolled++; S[dKey] -= 24; S.day = (S.day || 1) + 1; S.regDay = S.day; S.regSold = 0; payBills(offline); expansionNewDay(offline); dlcNewDay(offline); if (binsFull()) { S.rep = Math.max(0, S.rep - 1); logEvent('🗑️ A full bin stood all night and the place smells of it (rep -1)', 'bad'); } if (!offline) { logEvent('🌅 Day ' + S.day + ' begins', ''); toast('🌅 Day ' + S.day, ''); sfx('chime'); } var loose = S.till + coinTotal() + S.tips; if (loose > 0) logEvent('🧾 Overnight: ' + money(S.till) + ' in the till, ' + money(coinTotal()) + ' in the machines, ' + money(S.tips) + ' in the tip jar. Empty them into the vault.', ''); } if (offline && rolled && S[dKey] > 8) S[dKey] = 8; }   /* back from time away, the day starts in the morning: the leftover clock used to land near midnight and the next bill fell minutes later */
        creditPending(offline); updateLogistics(dt, offline); dlcStep(dt, offline);
        // humidity: each room drifts toward its moisture load; a running dehumidifier pulls it down to its target
        var pull = S.upgrades.hvac ? 4.0 : S.upgrades.dehumid ? 1.6 : 0.8; var wetBatches = S.batches.filter(function (b) { return !b.cured; }).length;
        var loads = { grow: 60 + S.plants.length * 1.2, dry: 58 + wetBatches * 2.5 }; if (S.upgrades.hvac) { loads.grow -= 6; loads.dry -= 6; }
        ['grow', 'dry'].forEach(function (z) { var rh = S.rh[z]; rh += (loads[z] - rh) * Math.min(1, 0.03 * dt); var tgt = S.dehum[z]; if (tgt > 0 && rh > tgt) rh = Math.max(tgt, rh - pull * dt); S.rh[z] = clamp(rh, 30, 95); });
        for (var i = 0; i < S.plants.length; i++) {
          var p = S.plants[i];
          if (p.progress < 1) {
            var thirstPen = auto ? 1 : (p.thirst > 0.8 ? 0.35 : p.thirst > 0.5 ? 0.7 : 1);
            var rate = (1000 / strainById(p.strain).growMs) * L.spd * thirstPen * (S.upgrades.hydro ? 1.12 : 1) * (hasLic('cult2') ? 1.05 : 1) * (S.upgrades.skylight ? 1.06 : 1);
            var was = p.progress;
            p.progress = clamp(p.progress + rate * dt, 0, 1);
            if (!offline && was < 1 && p.progress >= 1) { logEvent('🌸 A ' + strainById(p.strain).name + ' is ready to harvest', 'good'); }
          }
          if (S.upgrades.doser && !p.fed && p.progress > 0.35) { p.fed = true; p.quality = clamp(p.quality + 12, 20, 100); if (!offline) logEvent('🧪 The doser fed a ' + strainById(p.strain).name, ''); }
          var thWas = p.thirst, thRate = THIRST_RATE * (S.rh.grow < 42 ? 1.3 : 1);
          if (!auto) p.thirst = clamp(p.thirst + thRate * dt, 0, 1);
          if (!auto && p.thirst > 0.7) { var dryDt = thWas > 0.7 ? dt : Math.max(0, dt - (0.7 - thWas) / thRate); p.quality = clamp(p.quality - 0.5 * dryDt, 20, 100); }   /* only the part of the step actually spent thirsty costs quality */
          if (p.hazard) p.quality = clamp(p.quality - 0.8 * dt, 20, 100);
          else if (!offline && p.progress > 0.4 && p.progress < 1) {
            var hc = HAZARD_CHANCE * (S.upgrades.security2 ? 0.25 : S.upgrades.security ? 0.5 : 1) * moldMult();
            if (Math.random() < hc * dt) { p.hazard = !S.upgrades.ozone && Math.random() < (S.rh.grow > 60 ? 0.7 : 0.4) ? 'mold' : 'pest'; logEvent('⚠ ' + (p.hazard === 'pest' ? 'Spider mites' : 'Mould') + ' hit a ' + strainById(p.strain).name + '. Spray it before it spreads.', 'bad'); toast('⚠ ' + (p.hazard === 'pest' ? 'Pest' : 'Mould') + ' outbreak', 'bad'); }
          }
        }
        var rackFast = S.upgrades.rack2 ? 2.4 : S.upgrades.rack ? 1.6 : 1, cureCap = CURE_CAP_BASE + (S.upgrades.rack2 ? 20 : S.upgrades.rack ? 10 : 0), jarsFree = cureSlots();
        for (var b = 0; b < S.batches.length; b++) {
          var batch = S.batches[b];
          if (batch.cured && jarsFree-- <= 0) continue;   /* no jar for this one yet: it waits, oldest batches cure first */
          if (!batch.cured) { if (batch.dry === undefined) batch.dry = clamp((now() - batch.startedAt) / dryMs(), 0, 1); batch.dry = clamp(batch.dry + (dt * 1000 / dryMs()) * dryFactor(), 0, 1); if (batch.dry >= 1) { batch.cured = true; if (!offline) logEvent('🏺 A batch has finished drying and gone to the curing shelf', ''); } }
          else { var gained = 0.5 * rackFast * dt; if (batch.quality < batch.baseQ + cureCap) batch.quality = clamp(batch.quality + gained, 0, Math.min(100, batch.baseQ + cureCap)); }
        }
        if (!offline) {
          var target = (S.event && S.event.mult) ? S.event.mult : 1.0;
          S.market += ((target - S.market) * 0.02 + (Math.random() - 0.5) * 0.03) * Math.min(dt, 3);
          S.market = clamp(S.market, 0.85, 1.20);
          if (S.event && now() > S.event.until) { logEvent(S.event.type === '420' ? '🔥 The 420 rush is over. Prices are back to normal.' : S.event.type === 'cup' ? '🏆 The Cannabis Cup has left town' : 'Over: ' + S.event.label, ''); S.event = null; }
          if (S.customer && now() > S.customer.until && (S.customer.arrived || S.customer.stage || now() - (S.customer.spawnedAt || 0) > 180000)) { if (S.customer.stage) { logEvent('🚶 ' + S.customer.who + ' got tired of waiting to pay and walked (rep -2)', 'bad'); S.rep = Math.max(0, S.rep - 2); if (!offline) toast('🚶 ' + S.customer.who + ' walked out without paying', 'bad'); } else if (!offline) logEvent('🚶 ' + S.customer.who + ' gave up waiting at the window and left', ''); S.customer = null; }
        }
        if (offline && !ui.started && dt > 2) offlineWorks(dt);   // the boot catch-up: the step at start-up is the only offline one before the start screen is passed
      }
    /* 04-sim.js */
    function offlineWorks(secs) {
        secs = clamp(secs, 0, 6 * 3600); if (secs <= 0) return;
        var T = tob(), busy = T.bays.some(function (b) { return b.stage === 'grow'; }) || T.kiln.on || T.shred.on || T.maker.on || T.packer.on;
        if (busy) { var fl = player.floor; player.floor = 0; for (var t = 0; t < secs; t += 0.25) updateTobacco(Math.min(0.25, secs - t)); player.floor = fl; }   /* a quarter second at a time, the packer's cycle is 1.2 s; off the basement floor the tick skips its animation */
        labTick(secs); roofTick(secs * 0.75, true);   /* the beds only grow in daylight, and night runs 20:00 to 02:00 */
        if (busy) logEvent('🏭 The basement line kept running while you were away', '');
      }
    /* 05-actions.js */
    function cashOnSite() { return S.till + coinTotal() + S.tips + S.vault + S.pocket; }
    /* 05-actions.js */
    function pendingDue(p) { return SET.dayNight === 'cycle' ? (S.day || 1) >= p.dueDay : now() >= p.dueAt; }
    /* 05-actions.js */
    function creditPending(offline) { if (!S.pending.length) return; var keep = []; S.pending.forEach(function (p) { if (pendingDue(p)) { S.bank += p.amount; logEvent('🏦 Bank deposit cleared: ' + money(p.amount), 'good'); if (!offline) toast('🏦 ' + money(p.amount) + ' landed in the bank', 'good'); } else keep.push(p); }); S.pending = keep; }
    /* 06-three.js */
    var ROOM = { x: 12, z: 9, h: 3.4 };
    /* 06-three.js */
    function makeTex(w, h, draw, repeat) {
        var c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
        var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (repeat) t.repeat.set(repeat[0], repeat[1]); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
      }
    /* 06-three.js */
    function noiseFill(ctx, w, h, base, amp, n) {
        ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
        for (var i = 0; i < n; i++) { var v = Math.floor((Math.random() - 0.5) * amp); ctx.fillStyle = 'rgba(' + (v > 0 ? 255 : 0) + ',' + (v > 0 ? 255 : 0) + ',' + (v > 0 ? 255 : 0) + ',' + Math.abs(v) / 255 + ')'; ctx.fillRect(Math.random() * w, Math.random() * h, randi(1, 4), randi(1, 4)); }
      }
    /* 06-three.js */
    function makeBump(w, h, draw, repeat) {
        var c = document.createElement('canvas'); c.width = w; c.height = h; var ctx = c.getContext('2d'); ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, w, h); draw(ctx, w, h);
        var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (repeat) t.repeat.set(repeat[0], repeat[1]); t.anisotropy = 4; return t;
      }
    /* 06-three.js */
    function noiseGrain(ctx, w, h, n, alpha) { for (var i = 0; i < n; i++) { var v = Math.random(); ctx.fillStyle = 'rgba(' + (v > 0.5 ? '255,255,255' : '0,0,0') + ',' + (Math.abs(v - 0.5) * alpha) + ')'; ctx.fillRect(Math.random() * w, Math.random() * h, randi(1, 3), randi(1, 3)); } }
    /* 06-three.js */
    function tileDraw(ctx, w, h, cols, rows, fill, grout, groutW, jitter) {
        ctx.fillStyle = grout; ctx.fillRect(0, 0, w, h); var tw = w / cols, th = h / rows;
        for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) { var f = typeof fill === 'function' ? fill(c, r) : fill; ctx.fillStyle = f; ctx.fillRect(c * tw + groutW / 2, r * th + groutW / 2, tw - groutW, th - groutW); if (jitter) { ctx.fillStyle = 'rgba(0,0,0,' + randf(0, jitter) + ')'; ctx.fillRect(c * tw + groutW / 2, r * th + groutW / 2, tw - groutW, th - groutW); } }
      }
    /* 06-three.js */
    function brickDraw(ctx, w, h, cols, rows, fill, grout, groutW, bump) {
        ctx.fillStyle = grout; ctx.fillRect(0, 0, w, h); var bw = w / cols, bh = h / rows;
        for (var r = 0; r < rows; r++) { var off = (r % 2) * bw / 2; for (var c = -1; c <= cols; c++) { var x = c * bw + off; ctx.fillStyle = bump ? ('rgb(' + [140, 150, 160][(c + r) % 3] + ',' + [140, 150, 160][(c + r) % 3] + ',' + [140, 150, 160][(c + r) % 3] + ')') : (typeof fill === 'function' ? fill(c, r) : fill); ctx.fillRect(x + groutW / 2, r * bh + groutW / 2, bw - groutW, bh - groutW); } }
      }
    /* 06-three.js */
    function plankDraw(ctx, w, h, bump) {
        var rows = 10, rh = h / rows, tones = ['#a9773f', '#9a6a3e', '#b0804a', '#946638', '#a57242', '#8d5f34', '#b68a54'], seed = [0.13, 0.62, 0.37, 0.81, 0.25, 0.7, 0.05, 0.5, 0.92, 0.44];
        if (bump) { ctx.fillStyle = '#8c8c8c'; ctx.fillRect(0, 0, w, h); }
        for (var r = 0; r < rows; r++) {
          var x = -seed[r] * w * 0.6, n = 0;
          while (x < w) {
            var len = w * (0.34 + ((r * 7 + n * 5) % 5) * 0.07), y = r * rh; n++;
            ctx.save(); ctx.beginPath(); ctx.rect(x, y, len, rh); ctx.clip();
            if (!bump) { ctx.fillStyle = tones[(r * 3 + n * 2) % tones.length]; ctx.fillRect(x, y, len, rh); }
            for (var i = 0; i < 26; i++) { var gy = y + Math.random() * rh, dk = Math.random() < 0.7; ctx.strokeStyle = (bump ? (dk ? 'rgba(0,0,0,' : 'rgba(255,255,255,') : (dk ? 'rgba(50,28,10,' : 'rgba(255,225,180,')) + randf(0.05, bump ? 0.16 : 0.22) + ')'; ctx.lineWidth = randf(0.6, 2.2); ctx.beginPath(); ctx.moveTo(x - 4, gy); ctx.bezierCurveTo(x + len * 0.3, gy + randf(-5, 5), x + len * 0.7, gy + randf(-5, 5), x + len + 4, gy + randf(-4, 4)); ctx.stroke(); }
            if (!bump && Math.random() < 0.3) { var kx = x + randf(0.2, 0.8) * len, ky = y + randf(0.3, 0.7) * rh; for (var k = 0; k < 5; k++) { ctx.strokeStyle = 'rgba(40,22,8,' + (0.3 - k * 0.05) + ')'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(kx, ky, 5 + k * 5, 3 + k * 2.4, 0, 0, 6.29); ctx.stroke(); } }
            ctx.restore();
            ctx.fillStyle = bump ? '#1c1c1c' : 'rgba(30,18,8,.85)'; ctx.fillRect(x, y, bump ? 4 : 3, rh); ctx.fillRect(x, y, len, bump ? 4 : 3);
            if (!bump) { ctx.fillStyle = 'rgba(255,235,200,.10)'; ctx.fillRect(x + 3, y + 3, len - 3, 2); }
            x += len;
          }
        }
      }
    /* 06-three.js */
    function woodDraw(ctx, w, h, base, inks, n, bump) {
        if (base) { ctx.fillStyle = base; ctx.fillRect(0, 0, w, h); var tone = ctx.createLinearGradient(0, 0, 0, h); tone.addColorStop(0, 'rgba(255,230,190,.10)'); tone.addColorStop(0.5, 'rgba(0,0,0,.08)'); tone.addColorStop(1, 'rgba(255,230,190,.06)'); ctx.fillStyle = tone; ctx.fillRect(0, 0, w, h); }
        var drift = []; for (var k = 0; k < 4; k++) drift.push(randf(-10, 10));
        for (var i = 0; i < n; i++) { var y = Math.random() * h, dark = Math.random() < 0.72; ctx.strokeStyle = inks[dark ? 0 : 1] + (dark ? randf(0.05, bump ? 0.3 : 0.24) : randf(0.03, 0.1)) + ')'; ctx.lineWidth = randf(0.5, dark ? 2.2 : 1.2); ctx.beginPath(); ctx.moveTo(-4, y); ctx.bezierCurveTo(w * 0.3, y + drift[0] + randf(-3, 3), w * 0.65, y + drift[1] + randf(-3, 3), w + 4, y + drift[2] + randf(-3, 3)); ctx.stroke(); }
        for (var a = 0; a < 3; a++) { var cx = Math.random() * w, cy = Math.random() * h; for (var rr = 0; rr < 7; rr++) { ctx.strokeStyle = inks[0] + randf(0.06, 0.16) + ')'; ctx.lineWidth = randf(0.8, 1.8); ctx.beginPath(); ctx.ellipse(cx, cy, 40 + rr * 22, 5 + rr * 4.5, 0, 0, Math.PI * 2); ctx.stroke(); } }
        for (var p = 0; p < 900; p++) { ctx.fillStyle = inks[0] + randf(0.08, 0.22) + ')'; ctx.fillRect(Math.random() * w, Math.random() * h, randf(3, 12), 1); }
      }
    /* 06-three.js */
    var TEX = {
        concrete: makeTex(512, 512, function (ctx, w, h) { noiseFill(ctx, w, h, '#6d6f6a', 30, 14000); for (var i = 0; i < 40; i++) { var bl = ctx.createRadialGradient(0, 0, 0, 0, 0, 1); bl.addColorStop(0, 'rgba(' + (i % 2 ? '255,255,255,' : '0,0,0,') + randf(0.03, 0.08) + ')'); bl.addColorStop(1, 'rgba(0,0,0,0)'); ctx.save(); ctx.translate(Math.random() * w, Math.random() * h); ctx.scale(randf(30, 110), randf(20, 70)); ctx.fillStyle = bl; ctx.beginPath(); ctx.arc(0, 0, 1, 0, 6.29); ctx.fill(); ctx.restore(); } ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 3; ctx.strokeRect(1.5, 1.5, w - 3, h - 3);   /* a poured slab: cloudy, with a saw-cut joint round each bay */ }, [6, 4.5]),
        concreteBump: makeBump(512, 512, function (ctx, w, h) { noiseGrain(ctx, w, h, 9000, 0.35); ctx.strokeStyle = '#303030'; ctx.lineWidth = 6; ctx.strokeRect(3, 3, w - 6, h - 6); }, [6, 4.5]),
        wall: makeTex(256, 256, function (ctx, w, h) { noiseFill(ctx, w, h, '#d9d5c9', 8, 2500); }, [4, 2]),
        wallBump: makeBump(256, 256, function (ctx, w, h) { noiseGrain(ctx, w, h, 5000, 0.18); }, [4, 2]),
        accent: makeTex(256, 256, function (ctx, w, h) { noiseFill(ctx, w, h, '#2f5a45', 10, 2500); }, [4, 2]),
        brick: makeTex(512, 256, function (ctx, w, h) { brickDraw(ctx, w, h, 8, 8, function () { return pick(['#8a4a3a', '#95553f', '#7c4335', '#9a5c48', '#83483a']); }, '#c9c2b4', 6); noiseGrain(ctx, w, h, 6000, 0.25); }, [1, 1]),   /* repeat 1: box() sizes brick UVs in metres so every panel shows the same brick */
        brickBump: makeBump(512, 256, function (ctx, w, h) { brickDraw(ctx, w, h, 8, 8, null, '#303030', 6, true); noiseGrain(ctx, w, h, 4000, 0.2); }, [3, 1.5]),
        brickDark: makeTex(512, 256, function (ctx, w, h) { brickDraw(ctx, w, h, 8, 8, function () { return pick(['#2d3034', '#33363b', '#2a2c30', '#383b40']); }, '#4a4d52', 6); noiseGrain(ctx, w, h, 5000, 0.25); }, [1, 1]),
        tile: makeTex(512, 512, function (ctx, w, h) { tileDraw(ctx, w, h, 4, 4, function (c, r) { return (c + r) % 2 ? '#d7d2c4' : '#c8c2b2'; }, '#8d877b', 6, 0.06); noiseGrain(ctx, w, h, 8000, 0.2); }, [6, 2.5]),
        tileBump: makeBump(512, 512, function (ctx, w, h) { tileDraw(ctx, w, h, 4, 4, '#8a8a8a', '#2a2a2a', 6, 0); noiseGrain(ctx, w, h, 5000, 0.15); }, [6, 2.5]),
        planks: makeTex(1024, 1024, function (ctx, w, h) { plankDraw(ctx, w, h, false); }, [4, 4]),
        planksBump: makeBump(1024, 1024, function (ctx, w, h) { plankDraw(ctx, w, h, true); }, [4, 4]),
        rubber: makeTex(256, 256, function (ctx, w, h) { noiseFill(ctx, w, h, '#2e3236', 14, 4000); ctx.fillStyle = 'rgba(255,255,255,.05)'; for (var y = 0; y < h; y += 16) for (var x = 0; x < w; x += 16) { ctx.beginPath(); ctx.arc(x + 8 + ((y / 16) % 2) * 0, y + 8, 3, 0, Math.PI * 2); ctx.fill(); } }, [10, 6]),
        rubberBump: makeBump(256, 256, function (ctx, w, h) { ctx.fillStyle = '#a8a8a8'; for (var y = 0; y < h; y += 16) for (var x = 0; x < w; x += 16) { ctx.beginPath(); ctx.arc(x + 8, y + 8, 3, 0, Math.PI * 2); ctx.fill(); } noiseGrain(ctx, w, h, 3000, 0.12); }, [10, 6]),
        ceiling: makeTex(512, 512, function (ctx, w, h) { tileDraw(ctx, w, h, 2, 2, '#e7e4dc', '#b9b5aa', 8, 0); for (var i = 0; i < 2600; i++) { ctx.fillStyle = 'rgba(0,0,0,' + randf(0.04, 0.16) + ')'; ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }, [10, 7.5]),
        ceilingBump: makeBump(512, 512, function (ctx, w, h) { tileDraw(ctx, w, h, 2, 2, '#8a8a8a', '#3a3a3a', 8, 0); noiseGrain(ctx, w, h, 5000, 0.2); }, [10, 7.5]),
        wood: makeTex(512, 512, function (ctx, w, h) { woodDraw(ctx, w, h, '#946a3f', ['rgba(60,34,12,', 'rgba(255,220,170,'], 150, false); }, [2, 1]),
        woodBump: makeBump(512, 512, function (ctx, w, h) { woodDraw(ctx, w, h, null, ['rgba(0,0,0,', 'rgba(255,255,255,'], 110, true); }, [2, 1]),
        darkwood: makeTex(512, 512, function (ctx, w, h) { woodDraw(ctx, w, h, '#432d1c', ['rgba(0,0,0,', 'rgba(255,200,150,'], 170, false); }, [2, 1]),
        stone: makeTex(512, 512, function (ctx, w, h) { noiseFill(ctx, w, h, '#e9e6de', 16, 9000); for (var i = 0; i < 26; i++) { ctx.strokeStyle = 'rgba(90,96,100,' + randf(0.05, 0.2) + ')'; ctx.lineWidth = randf(0.6, 2.4); ctx.beginPath(); var x = Math.random() * w, y = Math.random() * h; ctx.moveTo(x, y); for (var s = 0; s < 5; s++) { x += randf(-90, 90); y += randf(30, 110); ctx.lineTo(x, y); } ctx.stroke(); } for (var f = 0; f < 500; f++) { ctx.fillStyle = 'rgba(' + (Math.random() < 0.5 ? '60,60,64' : '255,255,255') + ',' + randf(0.1, 0.35) + ')'; ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h, randf(0.5, 1.8), 0, 6.29); ctx.fill(); } }, [1, 1]),
        brushed: makeTex(256, 256, function (ctx, w, h) { ctx.fillStyle = '#9ea4ac'; ctx.fillRect(0, 0, w, h); for (var y = 0; y < h; y++) { ctx.fillStyle = 'rgba(' + (Math.random() > 0.5 ? '255,255,255' : '0,0,0') + ',' + randf(0.02, 0.12) + ')'; ctx.fillRect(0, y, w, 1); } }, [1, 1]),
        fabric: makeTex(128, 128, function (ctx, w, h) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); for (var y = 0; y < h; y += 2) for (var x = 0; x < w; x += 2) { ctx.fillStyle = 'rgba(0,0,0,' + (((x + y) / 2) % 2 ? 0.14 : 0.04) + ')'; ctx.fillRect(x, y, 2, 2); } }, [6, 6]),
        tent: makeTex(128, 128, function (ctx, w, h) { noiseFill(ctx, w, h, '#1c1f24', 10, 800); ctx.strokeStyle = 'rgba(255,255,255,.06)'; for (var i = 0; i < w; i += 8) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(w, i); ctx.stroke(); } }, [3, 3]),
        mylar: makeTex(128, 128, function (ctx, w, h) { var g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#c9ccd2'); g.addColorStop(.5, '#f2f3f5'); g.addColorStop(1, '#b9bcc4'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); for (var i = 0; i < 40; i++) { ctx.strokeStyle = 'rgba(255,255,255,' + randf(0.1, 0.4) + ')'; ctx.lineWidth = randf(1, 3); ctx.beginPath(); var x = Math.random() * w; ctx.moveTo(x, 0); ctx.lineTo(x + randf(-30, 30), h); ctx.stroke(); } }, [2, 2]),
        soil: makeTex(128, 128, function (ctx, w, h) { noiseFill(ctx, w, h, '#3a2a1c', 50, 3000); ctx.fillStyle = 'rgba(230,220,200,.5)'; for (var i = 0; i < 40; i++) ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2); }),
        terracotta: makeTex(128, 128, function (ctx, w, h) { noiseFill(ctx, w, h, '#b35a2a', 26, 3000); }, [2, 1]),
        grass: makeTex(512, 512, function (ctx, w, h) { noiseFill(ctx, w, h, '#4f7f3b', 26, 16000); var cols = ['#3f6f2e', '#5c8f44', '#6f9a4a', '#45752f', '#7ea25a']; for (var i = 0; i < 2600; i++) { var x = Math.random() * w, y = Math.random() * h; ctx.strokeStyle = cols[i % cols.length]; ctx.lineWidth = randf(0.8, 1.6); ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + randf(-4, 4), y - randf(4, 9), x + randf(-6, 6), y - randf(8, 16)); ctx.stroke(); } ctx.fillStyle = 'rgba(70,50,30,.16)'; for (var d = 0; d < 14; d++) { ctx.beginPath(); ctx.ellipse(Math.random() * w, Math.random() * h, randf(14, 40), randf(8, 22), Math.random() * 3, 0, 6.29); ctx.fill(); } }, [52, 52]),
        foliage: makeTex(256, 256, function (ctx, w, h) { ctx.fillStyle = '#4c7f36'; ctx.fillRect(0, 0, w, h); var cols = ['#3f6f2c', '#5a9040', '#6fa64b', '#4a7d33', '#87b85a', '#356a27']; for (var i = 0; i < 900; i++) { ctx.fillStyle = cols[i % cols.length]; ctx.beginPath(); ctx.ellipse(Math.random() * w, Math.random() * h, randf(5, 11), randf(3, 6), Math.random() * 3.2, 0, 6.29); ctx.fill(); } ctx.fillStyle = 'rgba(255,255,220,.10)'; for (var j = 0; j < 300; j++) { ctx.beginPath(); ctx.ellipse(Math.random() * w, Math.random() * h, randf(2, 5), randf(1.5, 3), Math.random() * 3.2, 0, 6.29); ctx.fill(); } }, [2, 2]),
        pine: makeTex(256, 256, function (ctx, w, h) { ctx.fillStyle = '#2d5a2a'; ctx.fillRect(0, 0, w, h); var cols = ['#254d22', '#38703a', '#2f6330', '#457f45', '#1f4520']; for (var i = 0; i < 2400; i++) { ctx.strokeStyle = cols[i % cols.length]; ctx.lineWidth = 1; var x = Math.random() * w, y = Math.random() * h; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + randf(-3, 3), y + randf(4, 10)); ctx.stroke(); } }, [2, 2]),
        bark: makeTex(128, 256, function (ctx, w, h) { noiseFill(ctx, w, h, '#5a4330', 24, 3000); ctx.strokeStyle = 'rgba(0,0,0,.35)'; for (var i = 0; i < 90; i++) { ctx.lineWidth = randf(1, 3); var x = Math.random() * w; ctx.beginPath(); ctx.moveTo(x, 0); ctx.bezierCurveTo(x + randf(-6, 6), h * .3, x + randf(-6, 6), h * .7, x + randf(-4, 4), h); ctx.stroke(); } ctx.strokeStyle = 'rgba(255,230,200,.12)'; for (var j = 0; j < 40; j++) { var x2 = Math.random() * w; ctx.beginPath(); ctx.moveTo(x2, 0); ctx.lineTo(x2 + randf(-3, 3), h); ctx.stroke(); } }, [1, 2]),
        tuft: makeAlphaTex(128, 128, function (ctx, w, h) { var cols = ['#4a8a34', '#5f9e42', '#3d7a2c', '#78b04e', '#8cc25a']; for (var i = 0; i < 46; i++) { ctx.strokeStyle = cols[i % cols.length]; ctx.lineWidth = randf(1.5, 3.5); var x0 = w / 2 + randf(-22, 22), x1 = x0 + randf(-30, 30), y1 = randf(4, 50); ctx.beginPath(); ctx.moveTo(x0, h); ctx.quadraticCurveTo(x0 + (x1 - x0) * 0.3, h * 0.55, x1, y1); ctx.stroke(); } }),
        flower: makeAlphaTex(64, 64, function (ctx, w, h) { ctx.strokeStyle = '#4b6b3a'; ctx.lineWidth = 2; [[20, 30], [32, 22], [44, 30]].forEach(function (p) { ctx.beginPath(); ctx.moveTo(p[0] + (32 - p[0]) * 0.5, h); ctx.lineTo(p[0], p[1]); ctx.stroke(); ctx.fillStyle = '#ffffff'; for (var k = 0; k < 5; k++) { ctx.beginPath(); ctx.ellipse(p[0] + Math.cos(k * 1.256) * 5, p[1] + Math.sin(k * 1.256) * 5, 4, 3, k * 1.256, 0, 6.29); ctx.fill(); } ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(p[0], p[1], 2.5, 0, 6.29); ctx.fill(); }); }),
        frond: makeAlphaTex(128, 512, function (ctx, w, h) { ctx.strokeStyle = '#2f5f2a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(w / 2, h); ctx.lineTo(w / 2, 6); ctx.stroke(); for (var i = 0; i < 26; i++) { var t = i / 26, y = h - 18 - t * (h - 40), len = (8 + Math.sin(Math.min(1, t * 1.25) * Math.PI) * 50) * (1 - t * 0.25); [-1, 1].forEach(function (sd) { var gr = ctx.createLinearGradient(w / 2, y, w / 2 + sd * len, y - 12); gr.addColorStop(0, '#2f6e30'); gr.addColorStop(1, i % 2 ? '#6fb45a' : '#58a048'); ctx.fillStyle = gr; ctx.save(); ctx.translate(w / 2, y); ctx.rotate(sd * -0.5); ctx.beginPath(); ctx.ellipse(sd * len / 2, 0, len / 2, 6.5 - t * 3, 0, 0, 6.29); ctx.fill(); ctx.restore(); }); } }),
        bigleaf: makeAlphaTex(256, 512, function (ctx, w, h) { var gr = ctx.createLinearGradient(0, h, w, 0); gr.addColorStop(0, '#1f5a2c'); gr.addColorStop(0.6, '#2f7a3a'); gr.addColorStop(1, '#4f9a4c'); ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(w / 2, h - 4); ctx.bezierCurveTo(w * 1.05, h * 0.82, w * 1.0, h * 0.25, w / 2, 6); ctx.bezierCurveTo(0, h * 0.25, -w * 0.05, h * 0.82, w / 2, h - 4); ctx.fill(); ctx.strokeStyle = 'rgba(190,230,170,.55)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(w / 2, h - 4); ctx.lineTo(w / 2, 14); ctx.stroke(); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(190,230,170,.3)'; for (var i = 1; i < 11; i++) { var y = h - i * (h / 11.5); [-1, 1].forEach(function (sd) { ctx.beginPath(); ctx.moveTo(w / 2, y); ctx.quadraticCurveTo(w / 2 + sd * w * 0.25, y - 26, w / 2 + sd * w * 0.42, y - 62); ctx.stroke(); }); } }),
        asphalt: makeTex(256, 256, function (ctx, w, h) { noiseFill(ctx, w, h, '#34363b', 26, 9000); }, [30, 4]),
        pavement: makeTex(256, 256, function (ctx, w, h) { tileDraw(ctx, w, h, 2, 2, function (c, r) { return pick(['#a3a39d', '#9c9c96', '#a9a9a2']); }, '#7a7a74', 4, 0.05); noiseGrain(ctx, w, h, 4000, 0.2); }, [45, 1.6]),
        pavementBump: makeBump(256, 256, function (ctx, w, h) { tileDraw(ctx, w, h, 2, 2, '#8a8a8a', '#303030', 4, 0); noiseGrain(ctx, w, h, 3000, 0.15); }, [45, 1.6]),
        leaf: makeTex(256, 512, function (ctx, w, h) {
          ctx.clearRect(0, 0, w, h);
          // seven serrated leaflets fanning from the base
          var cx = w / 2, cy = h * 0.92;
          var lens = [0.32, 0.55, 0.8, 0.9, 0.8, 0.55, 0.32];
          var angs = [-1.25, -0.85, -0.42, 0, 0.42, 0.85, 1.25];
          for (var i = 0; i < 7; i++) {
            var L = lens[i] * h, a = angs[i];
            ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
            var grd = ctx.createLinearGradient(0, 0, 0, -L); grd.addColorStop(0, '#2a6e30'); grd.addColorStop(0.55, '#4f9f48'); grd.addColorStop(1, '#8ad474');
            ctx.fillStyle = grd; ctx.beginPath(); ctx.moveTo(0, 0);
            var steps = 18;
            for (var s = 1; s <= steps; s++) { var t = s / steps; var wdt = Math.sin(t * Math.PI) * L * 0.11 + (s % 2 ? L * 0.025 : 0); ctx.lineTo(wdt, -t * L); }
            for (var s2 = steps; s2 >= 1; s2--) { var t2 = s2 / steps; var wdt2 = Math.sin(t2 * Math.PI) * L * 0.11 + (s2 % 2 ? L * 0.025 : 0); ctx.lineTo(-wdt2, -t2 * L); }
            ctx.closePath(); ctx.fill();
            ctx.strokeStyle = 'rgba(200,240,180,.55)'; ctx.lineWidth = Math.max(1, w / 128); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -L); ctx.stroke(); ctx.strokeStyle = 'rgba(20,60,20,.4)'; ctx.lineWidth = Math.max(1, w / 180);
            for (var v = 1; v < 6; v++) { var vy = -L * v / 6; ctx.beginPath(); ctx.moveTo(0, vy); ctx.lineTo(L * 0.09, vy - L * 0.06); ctx.moveTo(0, vy); ctx.lineTo(-L * 0.09, vy - L * 0.06); ctx.stroke(); }
            ctx.restore();
          }
        }),
        bud: makeTex(256, 256, function (ctx, w, h) { noiseFill(ctx, w, h, '#8ccf78', 50, 7000); for (var c = 0; c < 70; c++) { var cx = Math.random() * w, cy = Math.random() * h, cr = randf(8, 20), cg = ctx.createRadialGradient(cx - cr * 0.3, cy - cr * 0.3, 1, cx, cy, cr); cg.addColorStop(0, 'rgba(225,255,200,.5)'); cg.addColorStop(0.6, 'rgba(90,150,70,.25)'); cg.addColorStop(1, 'rgba(30,70,30,.4)'); ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(cx, cy, cr, 0, 6.29); ctx.fill(); } ctx.fillStyle = 'rgba(255,255,255,.75)'; for (var i = 0; i < 700; i++) ctx.fillRect(Math.random() * w, Math.random() * h, 1.4, 1.4); ctx.fillStyle = 'rgba(255,150,60,.55)'; for (var j = 0; j < 30; j++) { ctx.beginPath(); var x = Math.random() * w, y = Math.random() * h; ctx.moveTo(x, y); ctx.lineTo(x + randf(-6, 6), y + randf(-6, 6)); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,150,60,.6)'; ctx.stroke(); } }, [2, 2]),
        poster1: makeTex(256, 384, function (ctx, w, h) { ctx.fillStyle = '#12261a'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#6fdc8c'; ctx.font = '600 44px "Segoe UI",sans-serif'; ctx.textAlign = 'center'; ctx.fillText('GROW', w / 2, 90); ctx.fillText('LOCAL', w / 2, 140); ctx.font = '22px "Segoe UI",sans-serif'; ctx.fillStyle = '#c9e8d0'; ctx.fillText('small batch · hand cured', w / 2, 200); ctx.fillStyle = '#6fdc8c'; for (var i = 0; i < 7; i++) { ctx.save(); ctx.translate(w / 2, 300); ctx.rotate((i - 3) * 0.4); ctx.fillRect(-4, -70, 8, 70); ctx.restore(); } }),
        poster2: makeTex(256, 384, function (ctx, w, h) { ctx.fillStyle = '#3a2a1e'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#ffc857'; ctx.font = '600 40px "Segoe UI",sans-serif'; ctx.textAlign = 'center'; ctx.fillText('GROW CO.', w / 2, 80); ctx.font = '600 92px "Segoe UI",sans-serif'; ctx.fillText('420', w / 2, 210); ctx.font = '20px "Segoe UI",sans-serif'; ctx.fillStyle = '#f0e0c0'; ctx.fillText('prices up every rush', w / 2, 260); ctx.fillText('ask at the window', w / 2, 290); ctx.strokeStyle = '#ffc857'; ctx.lineWidth = 4; ctx.strokeRect(14, 14, w - 28, h - 28); }),
        poster3: makeTex(256, 384, function (ctx, w, h) { ctx.fillStyle = '#1a1c2e'; ctx.fillRect(0, 0, w, h); var g = ctx.createRadialGradient(w / 2, h * 0.4, 10, w / 2, h * 0.4, 150); g.addColorStop(0, '#ff69b4'); g.addColorStop(0.5, '#7a4aa8'); g.addColorStop(1, '#1a1c2e'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#ffffff'; ctx.font = '600 34px "Segoe UI",sans-serif'; ctx.textAlign = 'center'; ctx.fillText('RAINBOW', w / 2, 300); ctx.fillText('RUNTZ', w / 2, 340); ctx.font = '18px "Segoe UI",sans-serif'; ctx.fillText('level 9 unlock', w / 2, 370); })
      };
    /* 06-three.js */
    function emojiTex(emoji, size, bg) {
        var c = document.createElement('canvas'); c.width = c.height = size || 128; var ctx = c.getContext('2d');
        if (bg) { ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(c.width / 2, c.height / 2, c.width / 2 - 2, 0, Math.PI * 2); ctx.fill(); }
        ctx.font = Math.floor(c.width * 0.62) + 'px "Segoe UI Emoji","Apple Color Emoji",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(emoji, c.width / 2, c.height / 2 + c.width * 0.04);
        var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
      }
    /* 06-three.js */
    var SIGN_FONT = 'Bahnschrift,"DIN Alternate","Segoe UI Variable Display","Segoe UI",system-ui,sans-serif';
    /* 06-three.js */
    function signTex(lines, w, h, opts) {
        opts = opts || {}; var K = 2, c = document.createElement('canvas'); c.width = w * K; c.height = h * K; var ctx = c.getContext('2d'); ctx.scale(K, K);
        var own = opts.bg !== undefined, r = Math.min(16, h * 0.2), accent = opts.titleColor || '#6fdc8c';
        if (own) { ctx.fillStyle = opts.bg; roundRect(ctx, 2, 2, w - 4, h - 4, r); ctx.fill(); ctx.strokeStyle = opts.line || 'rgba(111,220,140,.6)'; ctx.lineWidth = 3; roundRect(ctx, 2, 2, w - 4, h - 4, r); ctx.stroke(); }
        else {   /* the shop's own sign plate: near-black enamel, a hairline of the sign's colour set in from the edge */
          var g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#1b211f'); g.addColorStop(1, '#0a0d0c'); ctx.fillStyle = g; roundRect(ctx, 1, 1, w - 2, h - 2, r); ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 2; roundRect(ctx, 1, 1, w - 2, h - 2, r); ctx.stroke();
          ctx.strokeStyle = opts.line || accent; ctx.globalAlpha = opts.line ? 1 : 0.55; ctx.lineWidth = 1.5; roundRect(ctx, 6, 6, w - 12, h - 12, Math.max(2, r - 4)); ctx.stroke(); ctx.globalAlpha = 1;
        }
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        var fs = opts.size || 30, rows = lines.map(function (l, i) {
          var title = i === 0 && lines.length > 1, size = title ? fs * 1.1 : (lines.length > 1 && !own ? fs * 0.86 : fs), wt = opts.bold || title || (lines.length === 1 && !own) ? '600 ' : '';
          ctx.font = wt + size + 'px ' + SIGN_FONT; var tw = ctx.measureText(l).width, max = w - (own ? 10 : 22); if (tw > max) size = Math.max(6, size * max / tw);
          return { t: l, size: size, wt: wt, col: i === 0 && opts.titleColor ? opts.titleColor : (opts.color || (i === 0 ? '#f3eee0' : '#b9c2b6')) };
        });
        var total = rows.reduce(function (a, rw) { return a + rw.size * 1.22; }, 0), y = h / 2 - total / 2;
        rows.forEach(function (rw) { ctx.font = rw.wt + rw.size + 'px ' + SIGN_FONT; ctx.fillStyle = rw.col; ctx.fillText(rw.t, w / 2, y + rw.size * 0.64); y += rw.size * 1.22; });
        var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; return t;
      }
    /* 06-three.js */
    function signBack(m, w, h) {
        var pl = new THREE.Mesh(bevelGeo(w + 0.024, h + 0.024, 0.014, 0.005), MAT.gunmetal); pl.position.z = -0.0085; pl.castShadow = true; pl.userData.noDefight = true; m.add(pl);
        if (w > 0.5 && h > 0.2) [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) { var st = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.006, 12), MAT.chrome); st.rotation.x = Math.PI / 2; st.position.set(s[0] * (w / 2 - 0.028), s[1] * (h / 2 - 0.028), 0.003); m.add(st); });
        return m;
      }
    /* 06-three.js */
    var MAT = {
        floor: new THREE.MeshStandardMaterial({ map: TEX.concrete, bumpMap: TEX.concreteBump, bumpScale: 0.02, roughness: 0.85, metalness: 0.05 }),
        tile: new THREE.MeshStandardMaterial({ map: TEX.tile, bumpMap: TEX.tileBump, bumpScale: 0.03, roughness: 0.35, metalness: 0.05 }),
        planks: new THREE.MeshStandardMaterial({ map: TEX.planks, bumpMap: TEX.planksBump, bumpScale: 0.025, roughness: 0.55 }),
        rubber: new THREE.MeshStandardMaterial({ map: TEX.rubber, bumpMap: TEX.rubberBump, bumpScale: 0.03, roughness: 0.9 }),
        wall: new THREE.MeshStandardMaterial({ map: TEX.wall, bumpMap: TEX.wallBump, bumpScale: 0.01, roughness: 0.92 }),
        accent: new THREE.MeshStandardMaterial({ map: TEX.accent, bumpMap: TEX.wallBump, bumpScale: 0.01, roughness: 0.9 }),
        brick: new THREE.MeshStandardMaterial({ map: TEX.brick, bumpMap: TEX.brickBump, bumpScale: 0.06, roughness: 0.95 }),
        brickDark: new THREE.MeshStandardMaterial({ map: TEX.brickDark, bumpMap: TEX.brickBump, bumpScale: 0.06, roughness: 0.9 }),
        ceiling: new THREE.MeshStandardMaterial({ map: TEX.ceiling, bumpMap: TEX.ceilingBump, bumpScale: 0.02, roughness: 1 }),
        trim: new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.5 }),
        wood: new THREE.MeshStandardMaterial({ map: TEX.wood, bumpMap: TEX.woodBump, bumpScale: 0.006, roughness: 0.52 }),
        darkwood: new THREE.MeshStandardMaterial({ map: TEX.darkwood, bumpMap: TEX.woodBump, bumpScale: 0.006, roughness: 0.48 }),
        metal: new THREE.MeshStandardMaterial({ map: TEX.brushed, color: 0xd0d4da, roughness: 0.4, metalness: 0.85 }),
        chrome: new THREE.MeshStandardMaterial({ color: 0xe8ecf2, roughness: 0.15, metalness: 1.0 }),
        black: new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.6 }),
        plastic: new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.45, metalness: 0.05 }),
        tent: new THREE.MeshStandardMaterial({ map: TEX.tent, roughness: 0.9, side: THREE.DoubleSide }),
        mylar: new THREE.MeshStandardMaterial({ map: TEX.mylar, roughness: 0.25, metalness: 0.35, side: THREE.BackSide }),
        pot: new THREE.MeshStandardMaterial({ map: TEX.terracotta, roughness: 0.85 }),
        soil: new THREE.MeshStandardMaterial({ map: TEX.soil, roughness: 1 }),
        stem: new THREE.MeshStandardMaterial({ color: 0x4f8a3a, roughness: 0.8 }),
        leaf: new THREE.MeshStandardMaterial({ map: TEX.leaf, transparent: true, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8 }),
        glass: new THREE.MeshPhysicalMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.1, side: THREE.DoubleSide }),
        screenGlass: new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.07, roughness: 0.04, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.03, depthWrite: false }),   /* the sheet of glass over a lit screen: nearly invisible head on, a highlight at an angle */
        steel: new THREE.MeshStandardMaterial({ map: TEX.brushed, color: 0x8b929b, roughness: 0.34, metalness: 0.9 }),
        gunmetal: new THREE.MeshStandardMaterial({ map: TEX.brushed, color: 0x4a5058, roughness: 0.38, metalness: 0.85 }),
        alu: new THREE.MeshStandardMaterial({ color: 0xc9ced4, roughness: 0.28, metalness: 0.92 }),
        gloss: new THREE.MeshPhysicalMaterial({ color: 0x14171b, roughness: 0.22, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.08 }),   /* piano-black plastic: bezels, device shells */
        soft: new THREE.MeshStandardMaterial({ color: 0x1f2226, roughness: 0.82, metalness: 0.0 }),   /* soft-touch rubberised plastic: keys, grips, feet */
        brass: new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.3, metalness: 1.0 }),
        jar: new THREE.MeshPhysicalMaterial({ color: 0xd8f0ff, transparent: true, opacity: 0.35, roughness: 0.05 }),
        jarLid: new THREE.MeshStandardMaterial({ color: 0x2b2f33, roughness: 0.5, metalness: 0.4 }),
        bud: new THREE.MeshStandardMaterial({ map: TEX.bud, color: 0x7fc96b, roughness: 0.9 }),
        grass: new THREE.MeshStandardMaterial({ map: TEX.grass, roughness: 1 }),
        foliage: new THREE.MeshStandardMaterial({ map: TEX.foliage, roughness: 0.95 }),
        pine: new THREE.MeshStandardMaterial({ map: TEX.pine, roughness: 0.95 }),
        bark: new THREE.MeshStandardMaterial({ map: TEX.bark, roughness: 0.95 }),
        frond: new THREE.MeshStandardMaterial({ map: TEX.frond, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.7 }),
        bigleaf: new THREE.MeshPhysicalMaterial({ map: TEX.bigleaf, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.3 }),
        ceramic: new THREE.MeshPhysicalMaterial({ color: 0xeee9dc, roughness: 0.28, clearcoat: 0.8, clearcoatRoughness: 0.12 }),
        tuft: new THREE.MeshStandardMaterial({ map: TEX.tuft, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1 }),
        flower: new THREE.MeshStandardMaterial({ map: TEX.flower, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 }),
        asphalt: new THREE.MeshStandardMaterial({ map: TEX.asphalt, roughness: 1 }),
        pavement: new THREE.MeshStandardMaterial({ map: TEX.pavement, bumpMap: TEX.pavementBump, bumpScale: 0.03, roughness: 0.95 }),
        tree: new THREE.MeshStandardMaterial({ color: 0x2f6b33, roughness: 1 }),
        trunk: new THREE.MeshStandardMaterial({ color: 0x5a3d22, roughness: 1 }),
        screen: new THREE.MeshStandardMaterial({ color: 0x0b1a12, emissive: 0x2dd67a, emissiveIntensity: 0.6, roughness: 0.3 }),
        counter: new THREE.MeshStandardMaterial({ map: TEX.darkwood, bumpMap: TEX.woodBump, bumpScale: 0.006, color: 0x8a9a8a, roughness: 0.55 }),
        counterTop: new THREE.MeshPhysicalMaterial({ map: TEX.stone, color: 0xd6d1c6, roughness: 0.22, metalness: 0.02, clearcoat: 0.6, clearcoatRoughness: 0.15 }),
        register: new THREE.MeshStandardMaterial({ color: 0x3b4650, roughness: 0.4, metalness: 0.3 }),
        rope: new THREE.MeshStandardMaterial({ color: 0x8a7a5a, roughness: 1 }),
        fabric: new THREE.MeshStandardMaterial({ map: TEX.fabric, color: 0x4a3b5c, roughness: 0.95 }),
        white: new THREE.MeshStandardMaterial({ color: 0xf5f5f0, roughness: 0.6 }),
        highlight: new THREE.MeshBasicMaterial({ color: 0x6fdc8c, transparent: true, opacity: 0.25, side: THREE.DoubleSide }),
        none: new THREE.MeshBasicMaterial({ visible: false })
      };
    /* 06-three.js */
    var disposeKeep = { set: null, sig: '' };
    /* 06-three.js */
    function disposeShared() {
        var tabs = [MAT, TEX, typeof PROD_M === 'object' ? PROD_M : null, typeof faceCache === 'object' ? faceCache : null, typeof HUMAN_GEO === 'object' ? HUMAN_GEO : null];
        var geos = [typeof FROND_GEO === 'object' ? FROND_GEO : null, typeof BIGLEAF_GEO === 'object' ? BIGLEAF_GEO : null, typeof LEAF_GEO === 'object' ? LEAF_GEO : null, typeof LEAF_GEO_SM === 'object' ? LEAF_GEO_SM : null, typeof BUD_GEO === 'object' ? BUD_GEO : null];
        var sig = tabs.map(function (tb) { return tb ? Object.keys(tb).length : '-'; }).join(',') + '/' + geos.map(function (g) { return g ? 1 : 0; }).join('');
        if (disposeKeep.set && disposeKeep.sig === sig) return disposeKeep.set;
        var set = new Set();
        tabs.forEach(function (tb) { if (tb) for (var k in tb) { var v = tb[k]; if (v && typeof v === 'object') { set.add(v); if (v.map) set.add(v.map); } } });
        geos.forEach(function (g) { if (g) set.add(g); });
        disposeKeep.set = set; disposeKeep.sig = sig; return set;
      }
    /* 06-three.js */
    function dropTree(root) {
        if (!root || !root.traverse) return; var keep = disposeShared();
        root.traverse(function (o) {
          if (o.geometry && o.geometry.dispose && !o.isSprite && !keep.has(o.geometry) && !(o.geometry.userData && o.geometry.userData.shared)) o.geometry.dispose();   /* the engine's cached geometries are shared by every mesh built from them */   /* every sprite shares three.js's one quad */
          var ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
          ms.forEach(function (m) { if (!m || keep.has(m)) return; if (m.map && m.map.isCanvasTexture && !keep.has(m.map)) m.map.dispose(); if (m.dispose) m.dispose(); });
        });
      }
    /* 06-three.js */
    function dropKids(g) { while (g.children.length) { var ch = g.children[0]; g.remove(ch); dropTree(ch); } }
    /* 06-three.js */
    function colorMat(hex, rough, metal, extra) { var m = new THREE.MeshStandardMaterial({ color: hex, roughness: rough === undefined ? 0.7 : rough, metalness: metal || 0 }); if (extra) for (var k in extra) m[k] = extra[k]; return m; }
    /* 06-three.js */
    function fabricMat(hex) { var m = MAT.fabric.clone(); m.color.setHex(hex); return m; }
    /* 06-three.js */
    function emitMat(hex, intensity) { return new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: intensity || 1.5, roughness: 0.4 }); }
    /* 06-three.js */
    var BLOB_TEX = makeAlphaTex(128, 128, function (ctx, w, h) { ctx.shadowColor = 'rgba(0,0,0,1)'; ctx.shadowBlur = 26; ctx.fillStyle = 'rgba(0,0,0,.92)'; roundRect(ctx, 34, 34, w - 68, h - 68, 10); ctx.fill(); ctx.fill(); });
    /* 06-three.js */
    var BLOB_MAT = new THREE.MeshBasicMaterial({ map: BLOB_TEX, color: 0x000000, transparent: true, opacity: 0.62, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    /* 06-three.js */
    function floorBlob(w, d, x, y, z, parent, k) {
        var m = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.55 + 0.16, d * 1.55 + 0.16), BLOB_MAT); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.renderOrder = 1; m.userData.noDefight = true; m.userData.soft = true; m.userData.blob = true; m.raycast = function () {};
        if (k) { m.material = BLOB_MAT.clone(); m.material.opacity = k; } (parent || world.group).add(m); return m;
      }
    /* 06-three.js */
    function archLeafGeo(w, len, bow, fold) { var g = new THREE.PlaneGeometry(w, len, 2, 8); g.translate(0, len / 2, 0); var p = g.attributes.position; for (var i = 0; i < p.count; i++) { var t = p.getY(i) / len, x = p.getX(i); p.setXYZ(i, x, p.getY(i) * (1 - 0.16 * t * t), t * t * bow - Math.abs(x) * fold); } g.computeVertexNormals(); return g; }
    /* 06-three.js */
    var FROND_GEO = archLeafGeo(0.2, 0.78, 0.34, 0.35), BIGLEAF_GEO = archLeafGeo(0.3, 0.52, 0.16, 0.25);
    /* 06-three.js */
    function leafAt(geo, mat, x, y, z, yaw, tilt, sc, parent) { var m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.order = 'YXZ'; m.rotation.set(tilt, yaw, 0); m.scale.setScalar(sc); m.castShadow = true; parent.add(m); return m; }
    /* 06-three.js */
    function bevelSkip(mat) { return !mat || mat === MAT.none || mat === MAT.wall || mat === MAT.accent || mat === MAT.trim || mat === MAT.ceiling || mat === MAT.floor || mat === MAT.tile || mat === MAT.planks || mat === MAT.rubber || mat === MAT.asphalt || mat === MAT.pavement || mat === MAT.grass || mat === MAT.glass || mat.visible === false || !!(mat.userData && mat.userData.tile); }
    /* 06-three.js */
    function interactable(mesh, data) { mesh.userData.interact = data; world.interact.push(mesh); return mesh; }
    /* 06-three.js */
    var tentLight = new THREE.SpotLight(0xffffff, 0, 9, Math.PI / 3.2, 0.5, 1.2);
    /* 06-three.js */
    var tentFill = new THREE.PointLight(0xffffff, 0, 8, 1.5);
    /* 07-building.js */
    var WALL_T = 0.2;
    /* 07-building.js */
    function signPlane(lines, w, h, x, y, z, rotY, opts) {
        opts = opts || {}; var tex = signTex(lines, Math.round(w * 320), Math.round(h * 320), Object.assign({ size: Math.round(h * 48) }, opts));
        var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true })); m.position.set(x, y, z); m.rotation.y = rotY || 0; world.group.add(m); if (opts.bg === undefined) signBack(m, w, h); fixtureSign(m, lines); return m;
      }
    /* 08-tent-plants-shelves.js */
    var TENT_ORIGIN = { x: -6.6, z: -6.1 };
    /* 08-tent-plants-shelves.js */
    function tentSize() { var t = TENTS[S.tent]; var big = t.rows >= 4 || t.cols >= 5; var pitch = big ? 1.15 : 1.3, m = big ? 0.5 : 0.6; return { w: t.cols * pitch + m, d: t.rows * pitch + m, cols: t.cols, rows: t.rows, pitch: pitch, m: m }; }
    /* 08-tent-plants-shelves.js */
    function slotPos(i) {
        var ts = tentSize(); var c = i % ts.cols, r = Math.floor(i / ts.cols);
        return { x: TENT_ORIGIN.x - ts.w / 2 + ts.m / 2 + ts.pitch / 2 + c * ts.pitch, z: TENT_ORIGIN.z - ts.d / 2 + ts.m / 2 + ts.pitch / 2 + r * ts.pitch };
      }
    /* 08-tent-plants-shelves.js */
    function makePot(parent, hasSoil) {
        var pot = new THREE.Mesh(roundCylGeo(0.26, 0.2, 0.3, 24), MAT.pot); pot.position.y = 0.15; pot.castShadow = true; pot.receiveShadow = true; parent.add(pot);
        var rim = new THREE.Mesh(new THREE.TorusGeometry(0.255, 0.02, 8, 24), MAT.pot); rim.rotation.x = Math.PI / 2; rim.position.y = 0.3; parent.add(rim);
        var band = new THREE.Mesh(roundCylGeo(0.262, 0.262, 0.05, 24), colorMat(0x9a4a22, 0.9)); band.position.y = 0.26; parent.add(band);
        var saucer = new THREE.Mesh(roundCylGeo(0.3, 0.27, 0.025, 24), colorMat(0x8a4020, 0.9)); saucer.position.y = 0.0125; saucer.receiveShadow = true; parent.add(saucer);
        var soil = new THREE.Mesh(new THREE.SphereGeometry(0.235, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), MAT.soil); soil.scale.y = 0.12; soil.position.y = 0.285; soil.visible = !!hasSoil; parent.add(soil);
        return { pot: pot, soil: soil };
      }
    /* 08-tent-plants-shelves.js */
    function buildTent() {
        if (world.tentGroup) { world.group.remove(world.tentGroup); dropTree(world.tentGroup); world.interact = world.interact.filter(function (m) { return !m.userData.tent; }); world.obstacles = world.obstacles.filter(function (o) { return o.tag !== 'tent' && o.tag !== 'pot'; }); }
        var g = new THREE.Group(); world.tentGroup = g; world.group.add(g);
        var ts = tentSize(); var h = 2.4; var ox = TENT_ORIGIN.x, oz = TENT_ORIGIN.z;
        // tent shell: back + two sides + roof, open front (toward +z). Mylar inside.
        var back = box(ts.w, h, 0.03, MAT.tent, ox, h / 2, oz - ts.d / 2, { parent: g, solid: true, tag: 'tent' }); back.material = MAT.tent;
        box(0.03, h, ts.d, MAT.tent, ox - ts.w / 2, h / 2, oz, { parent: g, solid: true, tag: 'tent' });
        box(0.03, h, ts.d, MAT.tent, ox + ts.w / 2, h / 2, oz, { parent: g, solid: true, tag: 'tent' });
        box(ts.w, 0.03, ts.d, MAT.tent, ox, h, oz, { parent: g });
        // front top valance so it reads as a tent with a rolled-up door, zipper tapes down both front edges
        box(ts.w, 0.4, 0.03, MAT.tent, ox, h - 0.2, oz + ts.d / 2, { parent: g });
        var roll = new THREE.Mesh(roundCylGeo(0.09, 0.09, ts.w - 0.1, 12), MAT.tent); roll.rotation.z = Math.PI / 2; roll.position.set(ox, h - 0.42, oz + ts.d / 2); g.add(roll);
        var zipM = colorMat(0x8a8d93, 0.5, 0.3); [-1, 1].forEach(function (sd) { var zt = new THREE.Mesh(bevelGeo(0.03, h - 0.4, 0.012), zipM); zt.position.set(ox + sd * (ts.w / 2 - 0.05), (h - 0.4) / 2, oz + ts.d / 2 + 0.02); g.add(zt); var pull = new THREE.Mesh(bevelGeo(0.02, 0.05, 0.02), MAT.chrome); pull.position.set(ox + sd * (ts.w / 2 - 0.05), h - 0.5, oz + ts.d / 2 + 0.03); g.add(pull); });
        // metal frame: corner poles, top rails, a wider foot on each corner
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) { cyl(0.022, 0.022, h, MAT.metal, ox + c[0] * ts.w / 2, h / 2, oz + c[1] * ts.d / 2, g, 10); cyl(0.05, 0.06, 0.03, MAT.plastic, ox + c[0] * ts.w / 2, 0.015, oz + c[1] * ts.d / 2, g, 12); var cn = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), MAT.plastic); cn.position.set(ox + c[0] * ts.w / 2, h, oz + c[1] * ts.d / 2); g.add(cn); });
        [-1, 1].forEach(function (sd) { var r1 = new THREE.Mesh(roundCylGeo(0.018, 0.018, ts.w, 8), MAT.metal); r1.rotation.z = Math.PI / 2; r1.position.set(ox, h, oz + sd * ts.d / 2); g.add(r1); var r2 = new THREE.Mesh(roundCylGeo(0.018, 0.018, ts.d, 8), MAT.metal); r2.rotation.x = Math.PI / 2; r2.position.set(ox + sd * ts.w / 2, h, oz); g.add(r2); });
        // side vents with mesh, an inline fan + carbon filter hanging under the roof at the back
        [-1, 1].forEach(function (sd) { var vt = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.025, 8, 24), MAT.tent); vt.rotation.y = Math.PI / 2; vt.position.set(ox + sd * ts.w / 2, 0.7, oz - ts.d / 4); g.add(vt); var mesh = new THREE.Mesh(new THREE.CircleGeometry(0.15, 24), new THREE.MeshStandardMaterial({ color: 0x555a60, roughness: 0.9, transparent: true, opacity: 0.85, side: THREE.DoubleSide })); mesh.rotation.y = Math.PI / 2; mesh.position.copy(vt.position); g.add(mesh); });
        var cf = new THREE.Mesh(roundCylGeo(0.15, 0.15, 0.55, 16), colorMat(0xe6e6e6, 0.9)); cf.rotation.z = Math.PI / 2; cf.position.set(ox - ts.w / 2 + 0.5, h - 0.25, oz - ts.d / 2 + 0.3); g.add(cf);
        var inl = new THREE.Mesh(roundCylGeo(0.1, 0.1, 0.35, 14), MAT.plastic); inl.rotation.z = Math.PI / 2; inl.position.set(ox - ts.w / 2 + 1.0, h - 0.25, oz - ts.d / 2 + 0.3); g.add(inl);
        var duct2 = new THREE.Mesh(roundCylGeo(0.075, 0.075, ts.w - 1.4, 10), colorMat(0xc5c8cd, 0.4, 0.6)); duct2.rotation.z = Math.PI / 2; duct2.position.set(ox + 0.5, h - 0.25, oz - ts.d / 2 + 0.3); g.add(duct2);
        [0.5, 1.0].forEach(function (dx) { [-0.12, 0.12].forEach(function (dz) { var strap = new THREE.Mesh(bevelGeo(0.02, 0.2, 0.02), MAT.black); strap.position.set(ox - ts.w / 2 + dx, h - 0.1, oz - ts.d / 2 + 0.3 + dz); g.add(strap); }); });
        // mylar liner: a box slightly inside with BackSide material
        var liner = new THREE.Mesh(bevelGeo(ts.w - 0.02, h - 0.02, ts.d - 0.02), [MAT.mylar, MAT.mylar, MAT.mylar, MAT.mylar, MAT.none, MAT.mylar]); liner.position.set(ox, h / 2, oz); g.add(liner);
        // tray floor with a lip, a power strip along the back edge
        box(ts.w - 0.06, 0.03, ts.d - 0.06, MAT.black, ox, 0.015, oz, { parent: g, cast: false });
        box(ts.w - 0.06, 0.05, 0.02, MAT.plastic, ox, 0.025, oz + ts.d / 2 - 0.04, { parent: g, cast: false });
        box(0.3, 0.04, 0.06, MAT.white, ox + ts.w / 2 - 0.4, 0.05, oz - ts.d / 2 + 0.1, { parent: g, cast: false }); for (var ps = 0; ps < 4; ps++) { var sk = new THREE.Mesh(roundCylGeo(0.012, 0.012, 0.01, 8), MAT.black); sk.position.set(ox + ts.w / 2 - 0.51 + ps * 0.07, 0.075, oz - ts.d / 2 + 0.1); g.add(sk); }
        // light rig
        world.lampGroup = new THREE.Group(); g.add(world.lampGroup);
        var L = lightObj(), li = lightIdx();
        var rail = new THREE.Mesh(bevelGeo(ts.w - 0.4, 0.04, 0.04), MAT.metal); rail.position.set(ox, h - 0.1, oz); world.lampGroup.add(rail);
        if (li === 0) {
          // windowsill tier: no lamp; a dangling empty hook and a note
          cyl(0.01, 0.01, 0.4, MAT.metal, ox, h - 0.32, oz, world.lampGroup, 6);
          var hook = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.006, 6, 12, Math.PI), MAT.metal); hook.position.set(ox, h - 0.52, oz); world.lampGroup.add(hook);
          var note = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.38), new THREE.MeshBasicMaterial({ map: signTex(['no lamp yet', 'plants use the window'], 512, 160, { size: 42, color: '#ffc857' }), transparent: true, side: THREE.DoubleSide })); note.position.set(ox, h - 0.62, oz); world.lampGroup.add(note);
        } else {
          var lampMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: L.color, emissiveIntensity: 1.6 + li * 0.4 });
          var n = li === 1 ? 2 : 1; var lw = li === 1 ? 0.25 : Math.min(ts.w - 0.8, 0.6 + ts.cols * 0.35);
          for (var k = 0; k < n; k++) {
            var lx = ox + (n === 1 ? 0 : (k === 0 ? -ts.w / 4 : ts.w / 4));
            // ratchet hangers: two straps with a small buckle each
            [-0.15, 0.15].forEach(function (dz) { cyl(0.006, 0.006, 0.3, MAT.black, lx + dz * (li === 1 ? 0 : lw * 1.5), h - 0.27, oz + (li === 1 ? dz * 0.3 : 0), world.lampGroup, 6); var bk = new THREE.Mesh(bevelGeo(0.03, 0.04, 0.02), MAT.plastic); bk.position.set(lx + dz * (li === 1 ? 0 : lw * 1.5), h - 0.2, oz + (li === 1 ? dz * 0.3 : 0)); world.lampGroup.add(bk); });
            if (li === 1) { var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), lampMat); bulb.position.set(lx, h - 0.5, oz); world.lampGroup.add(bulb); var hood = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.22, 20, 1, true), new THREE.MeshStandardMaterial({ color: 0xd8dce0, roughness: 0.3, metalness: 0.7, side: THREE.DoubleSide })); hood.position.set(lx, h - 0.38, oz); world.lampGroup.add(hood); var sock = new THREE.Mesh(roundCylGeo(0.03, 0.03, 0.06, 10), MAT.black); sock.position.set(lx, h - 0.3, oz); world.lampGroup.add(sock); }
            else {
              var dd = li === 2 ? 0.5 : 0.36; var housing = new THREE.Mesh(bevelGeo(lw, 0.08, dd), colorMat(li === 2 ? 0x2a2d33 : 0xd8dce0, 0.4, 0.5)); housing.position.set(lx, h - 0.46, oz); world.lampGroup.add(housing);
              for (var fin = 0; fin < 7; fin++) { var f = new THREE.Mesh(bevelGeo(lw - 0.06, 0.05, 0.01), colorMat(0x8a8f96, 0.4, 0.6)); f.position.set(lx, h - 0.39, oz - dd / 2 + 0.05 + fin * (dd - 0.1) / 6); world.lampGroup.add(f); }
              if (li === 2) { for (var bar = 0; bar < 4; bar++) { var strip = new THREE.Mesh(bevelGeo(lw - 0.08, 0.015, 0.05), lampMat); strip.position.set(lx, h - 0.505, oz - dd / 2 + 0.08 + bar * (dd - 0.16) / 3); world.lampGroup.add(strip); } for (var dio = 0; dio < 10; dio++) { for (var bar2 = 0; bar2 < 4; bar2++) { var d = new THREE.Mesh(bevelGeo(0.02, 0.01, 0.02), colorMat(0xffffff, 0.2, 0.2, { emissive: new THREE.Color(0xffffff), emissiveIntensity: 1.5 })); d.position.set(lx - (lw - 0.14) / 2 + dio * (lw - 0.14) / 9, h - 0.514, oz - dd / 2 + 0.08 + bar2 * (dd - 0.16) / 3); world.lampGroup.add(d); } } }
              else { var refl = new THREE.Mesh(bevelGeo(lw - 0.04, 0.02, dd - 0.04), lampMat); refl.position.set(lx, h - 0.51, oz); world.lampGroup.add(refl); var tube = new THREE.Mesh(roundCylGeo(0.02, 0.02, lw - 0.2, 10), emitMat(0xffd080, 2.2)); tube.rotation.z = Math.PI / 2; tube.position.set(lx, h - 0.53, oz); world.lampGroup.add(tube); var ball = new THREE.Mesh(bevelGeo(0.18, 0.1, 0.12), MAT.plastic); ball.position.set(lx + lw / 2 + 0.1, h - 0.46, oz); world.lampGroup.add(ball); }
            }
          }
          tentLight.color.setHex(L.color);
        }
        tentLight.intensity = L.intensity; tentLight.position.set(ox, h - 0.5, oz); tentLight.target.position.set(ox, 0, oz); tentLight.distance = 7; tentLight.angle = Math.PI / (li >= 2 ? 2.6 : 3.4);
        tentFill.color.setHex(li === 0 ? 0xfff1d0 : L.color); tentFill.intensity = li === 0 ? 0.45 : 0.35 + li * 0.35; tentFill.position.set(ox, h - 0.7, oz); tentFill.distance = Math.max(ts.w, ts.d) + 2;
        // thermometer / hygrometer on the back wall of the tent
        var hyg = new THREE.Mesh(bevelGeo(0.12, 0.08, 0.02), MAT.white); hyg.position.set(ox + ts.w / 2 - 0.4, 1.5, oz - ts.d / 2 + 0.04); g.add(hyg); var hs = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.04), new THREE.MeshBasicMaterial({ map: signTex(['24° 58%'], 160, 80, { size: 40, bg: '#101410', titleColor: '#6fdc8c', line: 'rgba(0,0,0,0)' }) })); hs.position.set(ox + ts.w / 2 - 0.4, 1.5, oz - ts.d / 2 + 0.051); g.add(hs);
        // pots
        for (var i = 0; i < ts.cols * ts.rows; i++) {
          var sp = slotPos(i); var hasPot = i < (S.supplies.pot || 0) || !!plantAtSlot(i);
          var slotG = new THREE.Group(); slotG.position.set(sp.x, 0, sp.z); g.add(slotG);
          if (hasPot) {
            var pm = makePot(slotG, S.potSoil[i] || plantAtSlot(i));
            interactable(pm.pot, { kind: 'slot', slot: i, label: 'Empty pot', tent: true }); pm.pot.userData.tent = true;
            world.obstacles.push({ x1: sp.x - 0.2, x2: sp.x + 0.2, z1: sp.z - 0.2, z2: sp.z + 0.2, tag: 'pot' });   // slim enough to squeeze between the rows of a packed tent
            if (S.upgrades.autowater) { var stake = new THREE.Mesh(roundCylGeo(0.006, 0.006, 0.2, 6), MAT.plastic); stake.position.set(0.15, 0.38, 0.1); slotG.add(stake); var dripper = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), MAT.plastic); dripper.position.set(0.15, 0.48, 0.1); slotG.add(dripper); }
          } else {
            var marker = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.24, 24), MAT.highlight); marker.rotation.x = -Math.PI / 2; marker.position.y = 0.04; slotG.add(marker);
            var markerHit = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.5), MAT.none); markerHit.position.y = 0.15; slotG.add(markerHit);
            interactable(markerHit, { kind: 'slot', slot: i, label: 'Empty slot (no pot)', tent: true, noPot: true }); markerHit.userData.tent = true;
          }
          slotG.userData.slot = i;
        }
        // drip lines when auto-waterer owned: a manifold along the back with a feed line to every pot, and the reservoir
        if (S.upgrades.autowater) {
          var tubeM = colorMat(0x222a33, 0.6); var tube = new THREE.Mesh(roundCylGeo(0.015, 0.015, ts.w - 0.3, 6), tubeM); tube.rotation.z = Math.PI / 2; tube.position.set(ox, 0.36, oz - ts.d / 2 + 0.2); g.add(tube);
          for (var q = 0; q < ts.cols * ts.rows; q++) { var qp = slotPos(q); var len = qp.z + 0.1 - (oz - ts.d / 2 + 0.2); var ft = new THREE.Mesh(roundCylGeo(0.006, 0.006, len, 5), tubeM); ft.rotation.x = Math.PI / 2; ft.position.set(qp.x + 0.15, 0.36, oz - ts.d / 2 + 0.2 + len / 2); g.add(ft); }
          var res = box(0.4, 0.6, 0.4, colorMat(0x2b6fb3, 0.4), ox + ts.w / 2 + 0.35, 0.3, oz - ts.d / 2 + 0.3, { parent: g }); box(0.42, 0.04, 0.42, colorMat(0x1f4f80, 0.5), ox + ts.w / 2 + 0.35, 0.62, oz - ts.d / 2 + 0.3, { parent: g }); box(0.14, 0.1, 0.1, MAT.plastic, ox + ts.w / 2 + 0.35, 0.69, oz - ts.d / 2 + 0.3, { parent: g });
          var lvl = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.4), new THREE.MeshBasicMaterial({ color: 0x9fd8ff })); lvl.position.set(ox + ts.w / 2 + 0.35, 0.3, oz - ts.d / 2 + 0.505); g.add(lvl);
          world.obstacles.push({ x1: ox + ts.w / 2 + 0.1, x2: ox + ts.w / 2 + 0.6, z1: oz - ts.d / 2 + 0.05, z2: oz - ts.d / 2 + 0.55, tag: 'tent' });
        }
        // security camera when owned
        if (S.upgrades.security) { var cam = box(0.16, 0.1, 0.24, MAT.black, ox + ts.w / 2 - 0.15, h - 0.15, oz + ts.d / 2 - 0.15, { parent: g }); cam.rotation.y = -0.6; var lens = new THREE.Mesh(roundCylGeo(0.03, 0.04, 0.04, 12), MAT.black); lens.rotation.x = Math.PI / 2; lens.rotation.y = -0.6; lens.position.set(ox + ts.w / 2 - 0.22, h - 0.15, oz + ts.d / 2 - 0.05); g.add(lens); var led = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), emitMat(0xff0000, 2)); led.position.set(ox + ts.w / 2 - 0.05, h - 0.15, oz + ts.d / 2 - 0.05); g.add(led); }
        // tent sign
        var tentSign = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.5), new THREE.MeshBasicMaterial({ map: signTex(['GROW TENT', ts.cols * ts.rows + ' slots · ' + L.name], 512, 170, { size: 40, titleColor: '#6fdc8c' }), transparent: true })); tentSign.position.set(ox, h - 0.2, oz + ts.d / 2 + 0.03); g.add(tentSign);
        g.traverse(function (o) { if (o.isMesh) o.userData.propId = 'tent'; });
        // rebuild plants
        for (var pid in world.plants) { var pm2 = world.plants[pid]; if (pm2.parent) pm2.parent.remove(pm2); }
        world.plants = {};
        syncPlants();
      }
    /* 08-tent-plants-shelves.js */
    var LEAF_GEO = archLeafGeo(0.27, 0.48, -0.13, -0.16);
    /* 08-tent-plants-shelves.js */
    var LEAF_GEO_SM = archLeafGeo(0.17, 0.31, -0.08, -0.14);
    /* 08-tent-plants-shelves.js */
    var BUD_GEO = (function () { var g = new THREE.IcosahedronGeometry(0.05, 2), p = g.attributes.position; for (var i = 0; i < p.count; i++) { var x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + 0.2 * Math.sin(x * 95 + 1) * Math.sin(y * 85 + 2) * Math.sin(z * 75 + 3) + 0.1 * Math.sin(x * 210) * Math.sin(z * 190); p.setXYZ(i, x * k, y * k * 1.15, z * k); } g.computeVertexNormals(); return g; })();
    /* 08-tent-plants-shelves.js */
    function makePlantMesh(p) {
        var st = strainById(p.strain); var g = new THREE.Group();
        var stemM = MAT.stem.clone(); stemM.color.setHex(st.leaf).lerp(new THREE.Color(0x6a5a3a), 0.35);
        var stem = new THREE.Mesh(roundCylGeo(0.01, 0.024, 1, 10), stemM); stem.castShadow = true; g.add(stem);
        var leafMat = MAT.leaf.clone(); leafMat.color.setHex(st.leaf); g.userData.leafMat = leafMat;
        var leaves = new THREE.Group(); g.add(leaves);
        // nodes climb the stem; each carries two opposite fan leaves and, higher up, a short side branch with its own leaf
        var NODES = 7;
        for (var i = 0; i < NODES; i++) {
          var node = new THREE.Group(); node.rotation.y = i * 2.4 + Math.random() * 0.3; node.userData.h = 0.12 + (i / (NODES - 1)) * 0.82; node.userData.order = i; leaves.add(node);
          [0, Math.PI].forEach(function (side) {
            var holder = new THREE.Group(); holder.rotation.y = side; node.add(holder);
            var lf = new THREE.Mesh(LEAF_GEO, leafMat); lf.castShadow = true; lf.position.set(0, 0, 0.02); lf.rotation.x = -1.0 - Math.random() * 0.3; holder.add(lf); holder.userData.tilt = lf;
            var petiole = new THREE.Mesh(roundCylGeo(0.004, 0.006, 0.12, 5), stemM); petiole.position.set(0, 0.02, 0.06); petiole.rotation.x = -1.1; holder.add(petiole);
          });
          if (i >= 2) {
            var br = new THREE.Group(); br.rotation.y = Math.PI / 2 + Math.random() * 0.4; node.add(br); node.userData.branch = br;
            var bl = 0.14 + (NODES - i) * 0.03; var bs = new THREE.Mesh(roundCylGeo(0.005, 0.009, bl, 6), stemM); bs.position.set(0, bl * 0.35, bl * 0.35); bs.rotation.x = -0.8; br.add(bs);
            var bh = new THREE.Group(); bh.position.set(0, bl * 0.7, bl * 0.7); br.add(bh); var blf = new THREE.Mesh(LEAF_GEO_SM, leafMat); blf.rotation.x = -0.9; blf.castShadow = true; bh.add(blf); bh.userData.tilt = blf;
            var sb = new THREE.Group(); sb.position.copy(bh.position); br.add(sb); node.userData.sideBuds = sb;
            for (var q2 = 0; q2 < 3; q2++) { var sbud = new THREE.Mesh(BUD_GEO, null); sbud.position.set((Math.random() - 0.5) * 0.04, q2 * 0.035, (Math.random() - 0.5) * 0.04); sbud.userData.base = sbud.position.clone(); sb.add(sbud); }
          }
        }
        g.userData.leaves = leaves;
        // main cola: a stack of calyx clusters with pistils, denser toward the top
        var buds = new THREE.Group(); g.add(buds);
        var budMat = MAT.bud.clone(); budMat.color.setHex(st.bud); g.userData.budMat = budMat;
        var hairMat = new THREE.MeshStandardMaterial({ color: st.hair, roughness: 1 }); g.userData.hairMat = hairMat;
        for (var b = 0; b < 11; b++) {
          var bud = new THREE.Mesh(BUD_GEO, budMat); bud.castShadow = true; bud.rotation.set(Math.random() * 3, Math.random() * 6.28, Math.random() * 3);
          var ba = b * 2.4, brad = 0.06 * (1 - b / 14); bud.position.set(Math.cos(ba) * brad, 0.72 + b * 0.04, Math.sin(ba) * brad);   /* a spiral up the cola, drawing in toward the tip */ bud.userData.base = bud.position.clone(); bud.userData.rs = 0.75 + Math.random() * 0.5;
          for (var hh = 0; hh < 3; hh++) { var hair = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.05, 5), hairMat); var ha = Math.random() * 6.28; hair.position.set(Math.cos(ha) * 0.04, 0.01 + Math.random() * 0.03, Math.sin(ha) * 0.04); hair.rotation.set(Math.random() - 0.5, 0, Math.random() - 0.5); bud.add(hair); }
          var sugar = new THREE.Mesh(LEAF_GEO_SM, leafMat); sugar.scale.set(0.45, 0.45, 0.45); sugar.position.set(0.03, -0.02, 0); sugar.rotation.set(-0.6, Math.random() * 6.28, 0); bud.add(sugar);
          buds.add(bud);
        }
        g.userData.buds = buds;
        g.traverse(function (o) { if (o.isMesh && o.material === null) o.material = budMat; });
        // trichome sparkle when ready
        var spN = 40, spPos = new Float32Array(spN * 3); for (var s = 0; s < spN; s++) { spPos[s * 3] = (Math.random() - 0.5) * 0.24; spPos[s * 3 + 1] = Math.random() * 0.4; spPos[s * 3 + 2] = (Math.random() - 0.5) * 0.24; }
        var spGeo = new THREE.BufferGeometry(); spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3));
        var sparkle = new THREE.Points(spGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.018, transparent: true, opacity: 0.0, depthWrite: false })); sparkle.visible = false; g.add(sparkle); g.userData.sparkle = sparkle;
        // hazard visuals
        var pests = new THREE.Group(); g.add(pests);
        for (var k = 0; k < 12; k++) { var m = new THREE.Mesh(new THREE.SphereGeometry(0.011, 6, 6), colorMat(0x3a2a1a, 1)); m.scale.set(1, 0.7, 1.3); m.userData.a = Math.random() * 6.28; m.userData.r = 0.1 + Math.random() * 0.2; m.userData.h = 0.2 + Math.random() * 0.6; pests.add(m); }
        var web = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false })); web.position.set(0.1, 0.5, 0.1); web.rotation.set(-0.4, 0.5, 0.3); pests.add(web);
        pests.visible = false; g.userData.pests = pests;
        var mold = new THREE.Group(); g.add(mold);
        for (var q = 0; q < 8; q++) { var mm = new THREE.Mesh(new THREE.SphereGeometry(0.04 + Math.random() * 0.03, 8, 8), new THREE.MeshStandardMaterial({ color: 0xd8dcd0, roughness: 1, transparent: true, opacity: 0.85 })); mm.scale.y = 0.5; mm.position.set((Math.random() - 0.5) * 0.24, 0.3 + Math.random() * 0.55, (Math.random() - 0.5) * 0.24); mold.add(mm); }
        mold.visible = false; g.userData.mold = mold;
        // status label sprite
        var label = new THREE.Sprite(new THREE.SpriteMaterial({ map: signTex([''], 8, 8), transparent: true, depthWrite: false })); label.scale.set(0.9, 0.36, 1); label.position.y = 1.55; g.add(label); g.userData.label = label; g.userData.labelKey = '';
        g.userData.plantId = p.id;
        return g;
      }
    /* 08-tent-plants-shelves.js */
    function syncPlants() {
        // ensure every plant has a mesh in the right slot; remove stale
        var seen = {};
        for (var i = 0; i < S.plants.length; i++) {
          var p = S.plants[i]; seen[p.id] = true; var sp = slotPos(p.slot);
          var m = world.plants[p.id];
          if (!m) { m = makePlantMesh(p); world.plants[p.id] = m; world.tentGroup.add(m); interactable(m.children[0], { kind: 'plant', pid: p.id, tent: true }); m.children[0].userData.tent = true; m.userData.hit = m.children[0]; }
          m.position.set(sp.x, 0.3, sp.z);
          m.userData.slot = p.slot;
        }
        for (var pid in world.plants) if (!seen[pid]) { var mm = world.plants[pid]; world.tentGroup.remove(mm); dropTree(mm); world.interact = world.interact.filter(function (x) { return x !== mm.userData.hit; }); delete world.plants[pid]; }
      }
    /* 08-tent-plants-shelves.js */
    var GOODS_ROWS = 3, GOODS_CELL = 0.85;
    /* 08-tent-plants-shelves.js */
    function goodsCols() { return Math.max(2, Math.ceil(STRAINS.length / GOODS_ROWS)); }
    /* 08-tent-plants-shelves.js */
    function goodsWidth() { return goodsCols() * GOODS_CELL; }
    /* 08-tent-plants-shelves.js */
    function syncGoods() {
        var inst = propInst.goodsShelf; if (!inst) return;
        var gg = inst.ctx.dynGroup(); var gate = gg.userData.shutter; dropKids(gg); if (gate) gg.add(gate);   /* restocking must not throw the roll gate away with the goods */
        world.interact = world.interact.filter(function (m) { return m.userData.dynGroup !== 'goods'; });
        var cellW = 0.8, cellY = [0.185, 0.76, 1.32], cols = goodsCols();
        STRAINS.forEach(function (st, i) {
          var col = i % cols, row = Math.floor(i / cols); if (row > GOODS_ROWS - 1) return;
          var cx = (col - (cols - 1) / 2) * GOODS_CELL, cy = cellY[2 - row]; var bags = lotOf('bags', st.id), joints = lotOf('joints', st.id), stash = stashOf(st.id);
          var cookies = lotOf('cookies', st.id); var any = bags.n > 0 || joints.n > 0 || cookies.n > 0 || stash.g > 0;
          // price card on the back panel
          var bq = bags.n ? bags.qSum / bags.n : 0, jq = joints.n ? joints.qSum / joints.n : 0;
          var lines = [st.emoji + ' ' + st.name, any ? ('bags ' + bags.n + (bags.n ? ' · ' + money(bagPrice(bq, bags.thcSum / bags.n)) : '') + '   joints ' + joints.n + (joints.n ? ' · ' + money(jointPrice(jq, joints.thcSum / joints.n)) : '') + (cookies.n ? '   cookies ' + cookies.n + ' · ' + money(cookiePrice(cookies.qSum / cookies.n, cookies.thcSum / cookies.n)) : '')) : 'sold out'];
          var card = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.12), new THREE.MeshBasicMaterial({ map: signTex(lines, 448, 78, { size: 26, bg: any ? '#f3e9cf' : '#d9d2c2', color: '#222', titleColor: any ? '#1a6a2a' : '#666', line: 'rgba(0,0,0,0)' }), transparent: true, side: THREE.DoubleSide })); card.position.set(cx, cy - 0.075, 0.222); card.rotation.x = -0.35; gg.add(card);   // price tag hangs off the front lip of each shelf, tilted up so the low rows read from standing height
          // bags: stacked flat, three per layer
          for (var b = 0; b < Math.min(bags.n, 9); b++) { var bm = productBaggie(st, 1.15); bm.position.set(cx - 0.26 + (b % 3) * 0.11, cy + 0.05 + Math.floor(b / 3) * 0.05, 0.02 + (b % 2) * 0.03); bm.rotation.set(-1.35, (b % 3 - 1) * 0.12, 0); gg.add(bm); }   /* the same baggie the customer is handed */
          if (bags.n > 0) { var bh = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.28, 0.3), MAT.none); bh.position.set(cx - 0.16, cy + 0.14, 0.02); gg.add(bh); interactable(bh, { kind: 'lot', item: 'bags', strain: st.id }); bh.userData.dynGroup = 'goods'; bh.userData.propId = 'goodsShelf'; }
          // cookies: a small jar in the middle of the cell
          if (cookies.n > 0) { var cj = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.14, 14, 1, true), MAT.jar); cj.position.set(cx + 0.02, cy + 0.07, 0.06); gg.add(cj); var cjl = new THREE.Mesh(roundCylGeo(0.058, 0.058, 0.015, 14), MAT.jarLid); cjl.position.set(cx + 0.02, cy + 0.145, 0.06); gg.add(cjl); for (var ck2 = 0; ck2 < Math.min(cookies.n, 6); ck2++) { var cm = new THREE.Mesh(roundCylGeo(0.04, 0.04, 0.012, 10), colorMat(0xb5763a, 0.9)); cm.position.set(cx + 0.02, cy + 0.012 + ck2 * 0.018, 0.06); cm.rotation.y = ck2 * 0.5; gg.add(cm); } var ch = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 0.16), MAT.none); ch.position.set(cx + 0.02, cy + 0.1, 0.06); gg.add(ch); interactable(ch, { kind: 'lot', item: 'cookies', strain: st.id }); ch.userData.dynGroup = 'goods'; ch.userData.propId = 'goodsShelf'; }
          // joints: standing in a glass tube
          var tube = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 14, 1, true), MAT.jar); tube.position.set(cx + 0.2, cy + 0.1, 0.03); gg.add(tube);
          var tbase = new THREE.Mesh(roundCylGeo(0.062, 0.062, 0.015, 14), MAT.darkwood); tbase.position.set(cx + 0.2, cy + 0.008, 0.03); gg.add(tbase);
          for (var j = 0; j < Math.min(joints.n, 12); j++) { var ja = j / 12 * Math.PI * 2, jr = j < 6 ? 0.02 : 0.04; var jm = productJoint(1.7); jm.position.set(cx + 0.2 + Math.cos(ja) * jr, cy + 0.1, 0.03 + Math.sin(ja) * jr); jm.rotation.z = (j % 2 ? 1 : -1) * 0.08; gg.add(jm); }
          if (joints.n > 0) { var jh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.3), MAT.none); jh.position.set(cx + 0.2, cy + 0.14, 0.02); gg.add(jh); interactable(jh, { kind: 'lot', item: 'joints', strain: st.id }); jh.userData.dynGroup = 'goods'; jh.userData.propId = 'goodsShelf'; }
        });
        gg.traverse(function (o) { if (o.isMesh) o.userData.propId = o.userData.propId || 'goodsShelf'; });
      }
    /* 08-tent-plants-shelves.js */
    var RACK = { cols: 6, y: [0.12, 0.66, 1.2, 1.74], w: 3.0 };
    /* 08-tent-plants-shelves.js */
    function rackBayX(i) { return -RACK.w / 2 + RACK.w / RACK.cols * (i % RACK.cols + 0.5); }
    /* 08-tent-plants-shelves.js */
    function rackBayY(i) { return RACK.y[Math.floor(i / RACK.cols)]; }
    /* 08-tent-plants-shelves.js */
    function rackBayCode(i) { return 'ABCD'.charAt(Math.floor(i / RACK.cols)) + (i % RACK.cols + 1); }
    /* 08-tent-plants-shelves.js */
    function rackBays() {   // item -> bay, kept in the save; a bay is freed when its item runs out
        var X = xs(); if (!X.bays || typeof X.bays !== 'object') X.bays = {};
        var B = X.bays, n = RACK.cols * RACK.y.length;
        Object.keys(B).forEach(function (k) { if (!((S.storage[k] || 0) > 0) || !(B[k] >= 0 && B[k] < n)) delete B[k]; });
        Object.keys(S.storage).forEach(function (k) {
          if (!((S.storage[k] || 0) > 0) || B[k] !== undefined) return;
          var used = {}; Object.keys(B).forEach(function (q) { used[B[q]] = true; });
          for (var i = 0; i < n; i++) if (!used[i]) { B[k] = i; break; }
        });
        return B;
      }
    /* 08-tent-plants-shelves.js */
    function crateMesh(id, w, h, d) {   // a taped kraft carton with the item's icon on its face
        var G = new THREE.Group();
        var body = new THREE.Mesh(bevelGeo(w, h, d), prodMat('crateKraft', function () { return new THREE.MeshStandardMaterial({ color: 0xa8804a, roughness: 0.9 }); })); body.castShadow = true; G.add(body);
        var tape = new THREE.Mesh(bevelGeo(w + 0.01, 0.025, d + 0.01), prodMat('crateTape', function () { return new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.9 }); })); G.add(tape);
        var face = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w, h) * 0.7, Math.min(w, h) * 0.7), prodMat('crateIco' + id, function () { return new THREE.MeshBasicMaterial({ map: signTex([itemIcon(id)], 96, 96, { size: 64, bg: '#f3e9cf', line: 'rgba(0,0,0,0)' }), transparent: true }); }));
        face.position.z = d / 2 + 0.002; G.add(face);
        return G;
      }
    /* 08-tent-plants-shelves.js */
    function syncStorage() {
        var inst = propInst.storeRack; if (!inst) return;
        var gg = inst.ctx.dynGroup(); dropKids(gg);
        world.interact = world.interact.filter(function (m) { return m.userData.dynGroup !== 'storage'; });
        var B = rackBays(), byBay = {}; Object.keys(B).forEach(function (k) { byBay[B[k]] = k; });
        var plateOpt = { size: 30, bg: '#f7f3e6', color: '#1c1f24', titleColor: '#1c1f24', line: 'rgba(0,0,0,0)' };
        for (var i = 0; i < RACK.cols * RACK.y.length; i++) {
          var x = rackBayX(i), y = rackBayY(i), id = byBay[i], code = rackBayCode(i);
          var plateM = id ? new THREE.MeshBasicMaterial({ map: signTex([code + '  ' + itemIcon(id) + ' ' + itemName(id) + '  ×' + S.storage[id]], 500, 90, plateOpt) })
            : prodMat('bayPlate' + code, function () { return new THREE.MeshBasicMaterial({ map: signTex([code + '  empty'], 500, 90, Object.assign({}, plateOpt, { color: '#8a8f96', titleColor: '#8a8f96' })) }); });
          var plate = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.09), plateM); plate.position.set(x, y - 0.035, 0.296); gg.add(plate);
          if (!id) continue;
          var stacks = Math.min(2, Math.ceil(S.storage[id] / itemPack(id)));
          for (var s = 0; s < stacks; s++) { var cr = crateMesh(id, 0.36, 0.2, 0.3); cr.position.set(x, y + 0.11 + s * 0.21, 0.04); gg.add(cr); }
          var hit = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.21 * stacks + 0.1, 0.42), MAT.none); hit.position.set(x, y + 0.105 * stacks + 0.05, 0.02); gg.add(hit); interactable(hit, { kind: 'storeItem', item: id, bay: i }); hit.userData.dynGroup = 'storage'; hit.userData.propId = 'storeRack';
        }
        gg.traverse(function (o) { if (o.isMesh) o.userData.propId = o.userData.propId || 'storeRack'; });
      }
    /* 08-tent-plants-shelves.js */
    function syncDisplay() {
        var dg = world.displayGroup; if (!dg) return; dropKids(dg); var d = S.display || {};
        for (var i = 0; i < Math.min(d.lighter || 0, 8); i++) { var lt = new THREE.Mesh(bevelGeo(0.025, 0.07, 0.012), colorMat([0xc94a3a, 0x2f6b9a, 0x3aa36a, 0xffd166, 0xf2f2f2, 0x7a5aa8][i % 6], 0.4)); lt.position.set(0.73 + i * 0.045, 1.12, 4.32); dg.add(lt); var cap = new THREE.Mesh(bevelGeo(0.025, 0.015, 0.012), MAT.chrome); cap.position.set(0.73 + i * 0.045, 1.163, 4.32); dg.add(cap); }
        for (var p = 0; p < Math.min(d.rpaper || 0, 5); p++) { var pk = new THREE.Mesh(bevelGeo(0.05, 0.075, 0.012), colorMat(p % 2 ? 0xf5f0e0 : 0xd9b36a, 0.8)); pk.position.set(0.75 + p * 0.065, 1.195, 4.18); pk.rotation.x = 0.15; dg.add(pk); }
        for (var q = 0; q < Math.min(d.rgrinder || 0, 3); q++) { var gr = new THREE.Mesh(roundCylGeo(0.028, 0.028, 0.03, 12), colorMat([0x2a2d33, 0x8a6a2a, 0x3a3f46][q], 0.4, 0.6)); gr.position.set(1.07 + q * 0.065, 1.1, 4.3); dg.add(gr); }
        dg.traverse(function (o) { if (o.isMesh) { o.castShadow = false; o.userData.propId = 'counter'; } });
      }
    /* 08-tent-plants-shelves.js */
    function syncShelf() {
        if (!propInst.cureShelf || !propInst.dryRack || !propInst.bench) return;
        var g = propInst.cureShelf.ctx.dynGroup(); dropKids(g);
        var lg = propInst.dryRack.ctx.dynGroup(); dropKids(lg);
        var bg = propInst.bench.ctx.dynGroup(); dropKids(bg);
        world.interact = world.interact.filter(function (m) { return m.userData.dynGroup !== 'shelf' && m.userData.dynGroup !== 'bench'; });
        syncGoods(); syncStorage(); syncDisplay();
        var jarsOwned = S.supplies.jar || 0;
        var cured = S.batches.filter(function (b) { return b.cured; }); var drying = S.batches.filter(function (b) { return !b.cured; });
        var total = Math.max(jarsOwned, cured.length);
        for (var i = 0; i < Math.min(total, 24); i++) {
          var row = Math.floor(i / 6), col = i % 6; var x = -1.25 + col * 0.5, y = 0.52 + row * 0.55, z = 0;
          var filled = i < cured.length;
          var jar = new THREE.Mesh(roundCylGeo(0.09, 0.09, 0.2, 14), MAT.jar); jar.position.set(x, y + 0.1, z); g.add(jar);
          if (filled) { var jh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.3, 0.24), MAT.none); jh.position.set(x, y + 0.12, z); g.add(jh); interactable(jh, { kind: 'jar', bid: cured[i].id }); jh.userData.dynGroup = 'shelf'; jh.userData.propId = 'cureShelf'; }
          var lid = new THREE.Mesh(roundCylGeo(0.095, 0.095, 0.025, 14), MAT.jarLid); lid.position.set(x, y + 0.21, z); g.add(lid);
          if (filled) { var b = cured[i]; var bst2 = strainById(b.strain || 'sunflower'), fl2 = clamp(b.grams / 24, 0.3, 1); var nugM2 = prodMat('jarnug' + bst2.id, function () { return new THREE.MeshStandardMaterial({ color: bst2.bud, roughness: 0.9 }); }); var nugD2 = prodMat('jarnugd' + bst2.id, function () { return new THREE.MeshStandardMaterial({ color: mixHex(bst2.bud, 0x30401f, 0.38), roughness: 0.95 }); }); for (var nz2 = 0; nz2 < Math.round(5 + fl2 * 13); nz2++) { var na2 = nz2 * 2.399, nr2 = 0.05 * Math.sqrt(((nz2 % 7) / 7) + 0.14); var nm2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.019 + (nz2 % 3) * 0.005, 0), nz2 % 4 === 0 ? nugD2 : nugM2); nm2.position.set(x + Math.cos(na2) * nr2, y + 0.025 + (nz2 % 5) * 0.026 * fl2, z + Math.sin(na2) * nr2); nm2.scale.set(1, 0.8, 1); nm2.rotation.set(na2, na2 * 1.7, 0.3); nm2.castShadow = false; g.add(nm2); } var waits = i >= cureSlots(); var lbl = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.06), new THREE.MeshBasicMaterial({ map: signTex(waits ? [gram(b.grams) + ' q' + Math.round(b.quality), 'waiting for a jar'] : [gram(b.grams) + ' q' + Math.round(b.quality)], 160, 60, { size: waits ? 18 : 30, bg: waits ? '#f3d9b0' : '#f3e9cf', color: '#222', titleColor: '#222', line: 'rgba(0,0,0,0)' }) })); lbl.position.set(x, y + 0.1, z + 0.095); g.add(lbl); }
        }
        if (S.upgrades.rack) { var rack = new THREE.Mesh(bevelGeo(3.0, 0.02, 0.45), MAT.metal); rack.position.set(0, 2.75, 0); g.add(rack); }
        var hw = 3.25, ly = 2.1; var n = drying.length;
        for (var d = 0; d < n; d++) {
          var bx = -hw + 0.4 + (d % 14) * ((hw * 2 - 0.8) / 13); var b2 = drying[d];
          var peg = new THREE.Mesh(bevelGeo(0.02, 0.07, 0.015), new THREE.MeshStandardMaterial({ color: 0xd9c9a0 })); peg.position.set(bx, ly - 0.14, 0); lg.add(peg);
          var str = new THREE.Mesh(roundCylGeo(0.006, 0.006, 0.12, 4), MAT.rope); str.position.set(bx, ly - 0.23, 0); lg.add(str);
          var bunch = new THREE.Group(); bunch.position.set(bx, ly - 0.3, 0); lg.add(bunch);
          var col2 = strainById(b2.strain || 'sunflower');
          for (var k = 0; k < 5; k++) { var bb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05 + Math.random() * 0.03, 1), new THREE.MeshStandardMaterial({ color: col2.bud, roughness: 1 })); bb.position.set((Math.random() - 0.5) * 0.08, -k * 0.07, (Math.random() - 0.5) * 0.08); bb.castShadow = true; bunch.add(bb); }
          var lp = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.3), MAT.leaf); lp.position.set(0.02, -0.2, 0.03); lp.rotation.x = Math.PI; bunch.add(lp);
        }
        // bench contents (local: bench runs along x, working side is +z; the stash jar sits left, packed goods pile right)
        var by = 0.93;
        if (S.supplies.grinder) { var gr = new THREE.Mesh(roundCylGeo(0.06, 0.06, 0.05, 20), MAT.chrome); gr.position.set(-0.45, by + 0.025, 0.1); bg.add(gr); var grTop = new THREE.Mesh(roundCylGeo(0.06, 0.06, 0.02, 20), colorMat(0x3a3f46, 0.4, 0.6)); grTop.position.set(-0.45, by + 0.06, 0.1); bg.add(grTop); for (var gt = 0; gt < 8; gt++) { var tooth = new THREE.Mesh(bevelGeo(0.012, 0.012, 0.012), MAT.chrome); var ga = gt / 8 * Math.PI * 2; tooth.position.set(-0.45 + Math.cos(ga) * 0.035, by + 0.075, 0.1 + Math.sin(ga) * 0.035); bg.add(tooth); } var gl = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.03), new THREE.MeshBasicMaterial({ map: signTex(['GRIND'], 80, 30, { size: 20, bg: 'rgba(0,0,0,0)', color: '#e8f1ea', titleColor: '#e8f1ea', line: 'rgba(0,0,0,0)' }), transparent: true })); gl.position.set(-0.45, by + 0.025, 0.161); bg.add(gl); }
        if (S.upgrades.roller) { var rm = new THREE.Mesh(bevelGeo(0.34, 0.14, 0.22), colorMat(0x2a2d33, 0.4, 0.3)); rm.position.set(0.55, by + 0.07, -0.05); bg.add(rm); var rmTop = new THREE.Mesh(bevelGeo(0.3, 0.02, 0.18), MAT.chrome); rmTop.position.set(0.55, by + 0.15, -0.05); bg.add(rmTop); var slot = new THREE.Mesh(bevelGeo(0.2, 0.03, 0.03), MAT.black); slot.position.set(0.55, by + 0.1, 0.07); bg.add(slot); var rmled = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), emitMat(0x00ff66, 2)); rmled.position.set(0.68, by + 0.12, 0.065); bg.add(rmled); }
        if ((S.supplies.bag || 0) > 0) { var bagbox = new THREE.Mesh(bevelGeo(0.16, 0.1, 0.1), colorMat(0xe8e8ee, 0.6)); bagbox.position.set(-0.15, by + 0.05, -0.22); bg.add(bagbox); var bagLbl = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.05), new THREE.MeshBasicMaterial({ map: signTex(['BAGGIES'], 120, 50, { size: 24, bg: '#f3e9cf', color: '#222', titleColor: '#222', line: 'rgba(0,0,0,0)' }) })); bagLbl.position.set(-0.15, by + 0.05, -0.169); bg.add(bagLbl); }
        if ((S.supplies.paper || 0) > 0) { var pp = new THREE.Mesh(bevelGeo(0.08, 0.02, 0.05), colorMat(0xffffff, 0.6)); pp.position.set(0.05, by + 0.01, -0.22); bg.add(pp); var pp2 = new THREE.Mesh(bevelGeo(0.08, 0.02, 0.05), colorMat(0xd8c8a0, 0.6)); pp2.position.set(0.14, by + 0.01, -0.2); pp2.rotation.y = 0.3; bg.add(pp2); }
        var toShelf = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.07), new THREE.MeshBasicMaterial({ map: signTex(['packed goods → shelf'], 300, 70, { size: 24, bg: '#f3e9cf', color: '#222', titleColor: '#1a6a2a', line: 'rgba(0,0,0,0)' }), transparent: true })); toShelf.position.set(1.0, by + 0.001, 0.2); toShelf.rotation.x = -Math.PI / 2; bg.add(toShelf);
        var stash = new THREE.Mesh(roundCylGeo(0.11, 0.11, 0.26, 20), MAT.jar); stash.position.set(-0.85, by + 0.13, -0.12); bg.add(stash); var stashLid = new THREE.Mesh(roundCylGeo(0.115, 0.115, 0.03, 20), MAT.jarLid); stashLid.position.set(-0.85, by + 0.275, -0.12); bg.add(stashLid);
        if (S.cured.g > 0) { var fill = clamp(S.cured.g / 60, 0.08, 1); var sm = new THREE.Mesh(roundCylGeo(0.095, 0.095, 0.22 * fill, 14), MAT.bud); sm.position.set(-0.85, by + 0.02 + 0.11 * fill, -0.12); bg.add(sm); }
        var stashLbl = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.07), new THREE.MeshBasicMaterial({ map: signTex(['STASH', gram(S.cured.g)], 160, 70, { size: 26, bg: '#f3e9cf', color: '#222', titleColor: '#1a6a2a', line: 'rgba(0,0,0,0)' }), transparent: true })); stashLbl.position.set(-0.85, by + 0.12, -0.12 + 0.111); bg.add(stashLbl);
        bg.traverse(function (o) { if (o.isMesh) o.userData.propId = o.userData.propId || 'bench'; }); g.traverse(function (o) { if (o.isMesh) o.userData.propId = o.userData.propId || 'cureShelf'; }); lg.traverse(function (o) { if (o.isMesh) o.userData.propId = o.userData.propId || 'dryRack'; });
      }
    /* 09-humans-guard.js */
    var SKINS = [0xf1c9a5, 0xe0ac7e, 0xc68642, 0x8d5524, 0xffdbb4, 0x5c3a1e];
    /* 09-humans-guard.js */
    var HAIRS = [0x2b1b12, 0x5a3a1a, 0xc08a2a, 0x9a2f1a, 0x222222, 0xb9b9b9, 0x7a4a9a, 0x3a1a0a];
    /* 09-humans-guard.js */
    var SHIRTS = [0x4a7fbf, 0xd64a9a, 0x3aa36a, 0xe0c25a, 0xc94a3a, 0x7a5aa8, 0xf2f2f2, 0x2a2a2a, 0xff8c42];
    /* 09-humans-guard.js */
    var PANTS = [0x2a3a5a, 0x333333, 0x6a5a4a, 0x8a8a8a, 0x3a5a3a];
    /* 09-humans-guard.js */
    var faceCache = {};
    /* 09-humans-guard.js */
    function personFace(mood, glasses, spec, blink) {
        spec = spec || {}; var key = mood + (glasses ? 'g' : '') + (spec.lipstick ? 'l' : '') + (spec.freckles ? 'f' : '') + (spec.eyeColor || '') + (blink ? 'b' : ''); if (faceCache[key]) return faceCache[key];
        var c = document.createElement('canvas'); c.width = c.height = 256; var ctx = c.getContext('2d'); ctx.clearRect(0, 0, 256, 256);
        var eyeY = 112, iris = spec.eyeColor || '#3a5a8a', closed = blink || mood === 'sleepy', squint = mood === 'happy' ? 12 : mood === 'angry' ? 12.5 : 15;
        [84, 172].forEach(function (x, i) {
          var sd = i ? 1 : -1, px = x + (mood === 'shifty' ? 8 : 0);
          if (closed) { ctx.strokeStyle = '#3a2a20'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - 21, eyeY + 1); ctx.quadraticCurveTo(x, eyeY + 9, x + 21, eyeY + 1); ctx.stroke(); return; }
          ctx.save(); ctx.beginPath(); ctx.ellipse(x, eyeY, 22, squint, 0, 0, Math.PI * 2); ctx.clip();
          ctx.fillStyle = '#fbf8f2'; ctx.fillRect(x - 24, eyeY - 18, 48, 36);
          var ig = ctx.createRadialGradient(px, eyeY + 1, 2, px, eyeY + 1, 11); ig.addColorStop(0, iris); ig.addColorStop(0.75, iris); ig.addColorStop(1, 'rgba(10,15,25,.9)'); ctx.fillStyle = ig; ctx.beginPath(); ctx.arc(px, eyeY + 1, 10.5, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#0b0b0d'; ctx.beginPath(); ctx.arc(px, eyeY + 1, 4.8, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.beginPath(); ctx.arc(px + 4, eyeY - 4, 3.2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.arc(px - 4, eyeY + 5, 1.6, 0, Math.PI * 2); ctx.fill();
          var lid = ctx.createLinearGradient(0, eyeY - squint, 0, eyeY - squint + 12); lid.addColorStop(0, 'rgba(40,20,10,.5)'); lid.addColorStop(1, 'rgba(40,20,10,0)'); ctx.fillStyle = lid; ctx.fillRect(x - 24, eyeY - squint, 48, 12);   /* the lid's shadow on the eye */
          ctx.restore();
          ctx.strokeStyle = '#2f2019'; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.ellipse(x, eyeY, 22, squint, 0, Math.PI * 1.02, Math.PI * 1.98); ctx.stroke();
          ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(60,35,25,.45)'; ctx.beginPath(); ctx.ellipse(x, eyeY, 22, squint, 0, Math.PI * 0.12, Math.PI * 0.88); ctx.stroke();
          ctx.lineWidth = 2.5; ctx.strokeStyle = '#2f2019'; ctx.beginPath(); ctx.moveTo(x + sd * 21, eyeY - 3); ctx.lineTo(x + sd * 27, eyeY - 8); ctx.stroke();   /* one lash at the outer corner */
        });
        // brows: thick at the nose, fine at the temple
        ctx.fillStyle = spec.browColor || '#2a1a10'; var tilt = mood === 'angry' ? 12 : mood === 'sad' ? -10 : mood === 'happy' ? -3 : 0;
        [[58, 110, 1], [198, 146, -1]].forEach(function (b) { var y0 = 84 - tilt * b[2] * (b[2] > 0 ? 1 : 1), y1 = 84 + tilt; ctx.beginPath(); ctx.moveTo(b[0], 84 - tilt + 2); ctx.quadraticCurveTo((b[0] + b[1]) / 2, 72, b[1], 84 + tilt - 4); ctx.lineTo(b[1], 84 + tilt + 5); ctx.quadraticCurveTo((b[0] + b[1]) / 2, 80, b[0], 84 - tilt + 4); ctx.closePath(); ctx.fill(); });
        // the nose is modelled: only the shadow under its tip is drawn
        ctx.fillStyle = 'rgba(70,35,20,.22)'; ctx.beginPath(); ctx.ellipse(128, 166, 17, 5, 0, 0, Math.PI * 2); ctx.fill();
        // mouth
        var lip = spec.lipstick ? '#c02040' : '#8a4536'; ctx.strokeStyle = lip; ctx.lineCap = 'round'; ctx.lineWidth = spec.lipstick ? 8 : 4.5; ctx.beginPath();
        if (mood === 'happy') { ctx.fillStyle = '#4a1a1a'; ctx.beginPath(); ctx.moveTo(96, 186); ctx.quadraticCurveTo(128, 216, 160, 186); ctx.quadraticCurveTo(128, 194, 96, 186); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(102, 188.5); ctx.quadraticCurveTo(128, 196, 154, 188.5); ctx.quadraticCurveTo(128, 203, 102, 188.5); ctx.fill(); ctx.beginPath(); ctx.moveTo(96, 186); ctx.quadraticCurveTo(128, 216, 160, 186); ctx.stroke(); }
        else if (mood === 'sad') { ctx.moveTo(100, 200); ctx.quadraticCurveTo(128, 182, 156, 200); ctx.stroke(); }
        else if (mood === 'angry') { ctx.moveTo(100, 196); ctx.quadraticCurveTo(128, 186, 156, 192); ctx.stroke(); }
        else if (mood === 'talk') { ctx.fillStyle = '#3a1a1a'; ctx.beginPath(); ctx.ellipse(128, 194, 16, 12, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#c0605a'; ctx.beginPath(); ctx.ellipse(128, 200, 9, 5, 0, 0, Math.PI * 2); ctx.fill(); }
        else { ctx.moveTo(104, 192); ctx.quadraticCurveTo(128, 199, 152, 192); ctx.stroke(); }
        if (mood !== 'talk' && mood !== 'happy') { ctx.strokeStyle = 'rgba(90,40,30,.25)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(114, 205); ctx.quadraticCurveTo(128, 210, 142, 205); ctx.stroke(); }   /* the shade under the lower lip */
        ctx.fillStyle = 'rgba(255,110,110,' + (mood === 'happy' ? 0.26 : 0.12) + ')'; [62, 194].forEach(function (x) { var bl = ctx.createRadialGradient(x, 152, 2, x, 152, 22); bl.addColorStop(0, ctx.fillStyle); bl.addColorStop(1, 'rgba(255,110,110,0)'); ctx.save(); ctx.fillStyle = bl; ctx.beginPath(); ctx.arc(x, 152, 22, 0, Math.PI * 2); ctx.fill(); ctx.restore(); });
        if (spec.freckles) { ctx.fillStyle = 'rgba(120,70,40,.5)'; for (var f = 0; f < 22; f++) { ctx.beginPath(); ctx.arc(60 + Math.random() * 136, 136 + Math.random() * 30, 1.6, 0, Math.PI * 2); ctx.fill(); } }
        var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; faceCache[key] = t; return t;
      }
    /* 09-humans-guard.js */
    var HUMAN_GEO = {
        thigh: roundCylGeo(0.088, 0.068, 0.42, 18), shin: roundCylGeo(0.064, 0.046, 0.4, 18), knee: new THREE.SphereGeometry(0.068, 14, 10),
        shoe: bevelGeo(0.12, 0.085, 0.27, 0.036, 3), sole: bevelGeo(0.128, 0.03, 0.285, 0.012, 1), toe: new THREE.SphereGeometry(0.056, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        hips: bevelGeo(0.36, 0.18, 0.22, 0.08, 3), torso: taperGeo(bevelGeo(0.4, 0.5, 0.24, 0.1, 3), 0.5, 0.86, 0.9), chest: bevelGeo(0.44, 0.26, 0.26, 0.11, 3),
        upperArm: roundCylGeo(0.054, 0.044, 0.3, 14), foreArm: roundCylGeo(0.044, 0.034, 0.3, 14), elbow: new THREE.SphereGeometry(0.047, 12, 10), shoulder: new THREE.SphereGeometry(0.072, 14, 10),
        hand: bevelGeo(0.075, 0.1, 0.036, 0.016, 2), thumb: roundCylGeo(0.012, 0.012, 0.05, 8), cuff: roundCylGeo(0.043, 0.04, 0.035, 14), hem: roundCylGeo(0.058, 0.056, 0.04, 16), collar: bevelGeo(0.085, 0.036, 0.012, 0.004, 1),
        neck: roundCylGeo(0.05, 0.062, 0.1, 14), head: new THREE.SphereGeometry(0.17, 28, 20), ear: new THREE.SphereGeometry(0.03, 10, 8), nose: new THREE.SphereGeometry(0.021, 12, 10),
        hairCap: new THREE.SphereGeometry(0.17, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), hairLong: new THREE.SphereGeometry(0.17, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.62), afro: new THREE.SphereGeometry(0.17, 20, 14), scalp: new THREE.SphereGeometry(0.17, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
        skirt: roundCylGeo(0.2, 0.32, 0.4, 20), coat: bevelGeo(0.46, 0.66, 0.28, 0.08, 3)
      };
    /* 09-humans-guard.js */
    function makePerson(spec) {
        spec = spec || {};
        var skin = new THREE.MeshStandardMaterial({ color: spec.skin || pick(SKINS), roughness: 0.75 });
        var shirt = new THREE.MeshStandardMaterial({ map: TEX.fabric, color: spec.shirt || pick(SHIRTS), roughness: 0.9 });
        var pants = new THREE.MeshStandardMaterial({ map: TEX.fabric, color: spec.pants || pick(PANTS), roughness: 0.9 });
        var hairM = new THREE.MeshStandardMaterial({ color: spec.hair || pick(HAIRS), roughness: 0.62 }), hairSide = hairM.clone(); hairSide.side = THREE.DoubleSide;
        var shoeM = new THREE.MeshStandardMaterial({ color: spec.shoes || pick([0x1e1a18, 0x3a2a1a, 0xf2f2f2, 0xc94a3a, 0x2f6b9a]), roughness: 0.6 });
        var soleM = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.9 });
        var g = new THREE.Group(); var P = { mood: 'neutral' }; g.userData.parts = P; g.userData.spec = spec;
        floorBlob(0.36, 0.3, 0, 0.012, 0.02, g, 0.5);   /* a shadow at the feet: the lamps indoors cast none */
        function mesh(geo, mat, x, y, z, parent) { var m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; (parent || g).add(m); return m; }
        // legs: hip pivot → thigh → knee pivot → shin → shoe
        function leg(side) {
          var hip = new THREE.Group(); hip.position.set(side * 0.1, 0.86, 0); g.add(hip);
          mesh(HUMAN_GEO.thigh, pants, 0, -0.21, 0, hip);
          var knee = new THREE.Group(); knee.position.set(0, -0.42, 0); hip.add(knee); hip.userData.knee = knee;
          mesh(HUMAN_GEO.knee, pants, 0, 0, 0, knee); mesh(HUMAN_GEO.shin, pants, 0, -0.2, 0, knee);
          var shoe = mesh(HUMAN_GEO.shoe, shoeM, 0, -0.4, 0.05, knee); mesh(HUMAN_GEO.sole, soleM, 0, -0.445, 0.05, knee); mesh(HUMAN_GEO.hem, pants, 0, -0.35, 0, knee);
          mesh(bevelGeo(0.1, 0.02, 0.06), new THREE.MeshStandardMaterial({ color: 0xffffff }), 0, -0.36, 0.12, knee);   // laces patch
          if (spec.socks) mesh(roundCylGeo(0.052, 0.052, 0.08, 10), new THREE.MeshStandardMaterial({ color: 0xf2f2f2 }), 0, -0.34, 0, knee);
          return hip;
        }
        P.lLeg = leg(-1); P.rLeg = leg(1);
        // torso: hips block, shirt torso, chest, shoulders; collar, buttons, belt, pockets
        P.torso = new THREE.Group(); P.torso.position.y = 0.86; g.add(P.torso);
        mesh(HUMAN_GEO.hips, pants, 0, 0.02, 0, P.torso);
        mesh(bevelGeo(0.38, 0.05, 0.24), new THREE.MeshStandardMaterial({ color: spec.belt || 0x3a2a1a, roughness: 0.5 }), 0, 0.1, 0, P.torso); mesh(bevelGeo(0.05, 0.04, 0.02), MAT.chrome, 0, 0.1, 0.125, P.torso);
        mesh(HUMAN_GEO.torso, shirt, 0, 0.36, 0, P.torso); P.chest = mesh(HUMAN_GEO.chest, shirt, 0, 0.52, 0, P.torso);
        if (!spec.coat) [-1, 1].forEach(function (sd) { var cl = mesh(HUMAN_GEO.collar, shirt, sd * 0.05, 0.648, 0.118, P.torso); cl.rotation.set(-0.35, sd * -0.25, sd * -0.62); });
        if (!spec.coat) { mesh(bevelGeo(0.12, 0.05, 0.03), shirt, 0, 0.62, 0.13, P.torso); for (var b = 0; b < 4; b++) mesh(roundCylGeo(0.008, 0.008, 0.006, 8), new THREE.MeshStandardMaterial({ color: 0xf2f2f2 }), 0, 0.2 + b * 0.11, 0.125, P.torso).rotation.x = Math.PI / 2; mesh(bevelGeo(0.1, 0.1, 0.005), new THREE.MeshStandardMaterial({ map: TEX.fabric, color: shirt.color.clone().multiplyScalar(0.85), roughness: 0.9 }), -0.11, 0.48, 0.125, P.torso); }
        if (spec.coat) { var coatM = new THREE.MeshStandardMaterial({ map: TEX.fabric, color: spec.coat, roughness: 0.9 }); var coat = mesh(HUMAN_GEO.coat, coatM, 0, 0.33, -0.02, P.torso); [-1, 1].forEach(function (s) { var lapel = mesh(bevelGeo(0.09, 0.28, 0.015), coatM, s * 0.09, 0.5, 0.135, P.torso); lapel.rotation.z = s * 0.35; }); mesh(bevelGeo(0.06, 0.34, 0.02), shirt, 0, 0.42, 0.13, P.torso); }
        if (spec.skirt) { mesh(HUMAN_GEO.skirt, new THREE.MeshStandardMaterial({ map: TEX.fabric, color: spec.skirt, roughness: 0.9 }), 0, -0.14, 0, P.torso); }
        if (spec.logo) { var lg = mesh(new THREE.PlaneGeometry(0.16, 0.16), new THREE.MeshBasicMaterial({ map: signTex([spec.logo], 128, 128, { size: 70, bg: 'rgba(0,0,0,0)', line: 'rgba(0,0,0,0)', color: '#fff' }), transparent: true }), 0, 0.42, 0.126, P.torso); lg.castShadow = false; }
        // arms: shoulder pivot → upper arm → elbow pivot → forearm → hand with thumb; sleeve depends on longSleeve
        function arm(side) {
          var sh = new THREE.Group(); sh.position.set(side * 0.27, 0.6, 0); P.torso.add(sh);
          mesh(HUMAN_GEO.shoulder, shirt, 0, 0, 0, sh);
          var sleeveM = spec.longSleeve === false ? skin : shirt; mesh(HUMAN_GEO.upperArm, sleeveM, 0, -0.16, 0, sh);
          if (spec.longSleeve === false) mesh(roundCylGeo(0.056, 0.05, 0.1, 10), shirt, 0, -0.06, 0, sh);
          var el = new THREE.Group(); el.position.set(0, -0.31, 0); sh.add(el); sh.userData.elbow = el;
          mesh(HUMAN_GEO.elbow, sleeveM, 0, 0, 0, el); mesh(HUMAN_GEO.foreArm, spec.longSleeve === false || spec.rolled ? skin : shirt, 0, -0.15, 0, el);
          if (spec.watch && side > 0) mesh(roundCylGeo(0.045, 0.045, 0.02, 10), new THREE.MeshStandardMaterial({ color: 0x1c1c22 }), 0, -0.27, 0, el);
          if (!(spec.longSleeve === false || spec.rolled)) mesh(HUMAN_GEO.cuff, shirt, 0, -0.285, 0, el);
          var hand = mesh(HUMAN_GEO.hand, skin, 0, -0.35, 0, el); var th = mesh(HUMAN_GEO.thumb, skin, side * 0.04, -0.33, 0.01, el); th.rotation.z = side * 0.6;
          sh.userData.hand = hand; return sh;
        }
        P.lArm = arm(-1); P.rArm = arm(1);
        // head: neck, skull, ears, face decal, hair style, facial hair, glasses frames
        P.head = new THREE.Group(); P.head.position.set(0, 0.66, 0); P.torso.add(P.head);
        mesh(HUMAN_GEO.neck, skin, 0, 0.04, 0, P.head); var headM = mesh(HUMAN_GEO.head, skin, 0, 0.24, 0, P.head); mesh(HUMAN_GEO.nose, skin, 0, 0.222, 0.164, P.head);
        [-1, 1].forEach(function (s) { mesh(HUMAN_GEO.ear, skin, s * 0.165, 0.24, -0.01, P.head); if (spec.earrings) mesh(new THREE.SphereGeometry(0.012, 6, 6), MAT.chrome, s * 0.17, 0.2, -0.01, P.head); });
        var style = spec.hairStyle || (spec.ponytail ? 'ponytail' : pick(['short', 'short', 'long', 'bun', 'afro', 'ponytail', 'mohawk']));
        if (!spec.bald) {
          var hy = 0.24;
          function strands(n, y0, len, r, back) { for (var i = 0; i < n; i++) { var a = back ? Math.PI * 0.55 + (i / (n - 1)) * Math.PI * 0.9 : (i % 2 ? 1 : -1) * (0.9 + Math.floor(i / 2) * 0.35); var st = mesh(bevelGeo(0.07, len, 0.06), hairM, Math.sin(a) * r, y0 - len / 2, Math.cos(a) * r, P.head); st.rotation.y = a; st.rotation.x = 0.05; } }
          if (style === 'afro') { mesh(HUMAN_GEO.afro, hairM, 0, hy + 0.05, -0.02, P.head); for (var q = 0; q < 10; q++) { var pf = mesh(new THREE.SphereGeometry(0.07, 8, 6), hairM, (Math.random() - 0.5) * 0.4, hy + 0.1 + (Math.random() - 0.5) * 0.3, -0.02 + (Math.random() - 0.5) * 0.36, P.head); } }
          else if (style === 'long') { mesh(HUMAN_GEO.hairLong, hairM, 0, hy, 0, P.head); mesh(HUMAN_GEO.fringe, hairM, 0, hy, 0, P.head); mesh(HUMAN_GEO.hairFall, hairSide, 0, hy - 0.16, -0.012, P.head); mesh(HUMAN_GEO.sideL, hairM, 0, hy, 0, P.head); mesh(HUMAN_GEO.sideR, hairM, 0, hy, 0, P.head); }
          else if (style === 'bun') { mesh(HUMAN_GEO.hairCap, hairM, 0, hy, 0, P.head); mesh(new THREE.SphereGeometry(0.075, 12, 10), hairM, 0, hy + 0.14, -0.14, P.head); mesh(new THREE.TorusGeometry(0.075, 0.008, 6, 14), new THREE.MeshStandardMaterial({ color: 0xc94a3a }), 0, hy + 0.14, -0.14, P.head).rotation.x = Math.PI / 2; mesh(HUMAN_GEO.fringe, hairM, 0, hy, 0, P.head); mesh(HUMAN_GEO.sideL, hairM, 0, hy, 0, P.head); mesh(HUMAN_GEO.sideR, hairM, 0, hy, 0, P.head); }
          else if (style === 'mohawk') { mesh(HUMAN_GEO.scalp, new THREE.MeshStandardMaterial({ color: skin.color.clone().multiplyScalar(0.82), roughness: 0.8 }), 0, hy, 0, P.head); for (var mk = 0; mk < 6; mk++) { var sp = mesh(bevelGeo(0.05, 0.13 + (mk === 2 || mk === 3 ? 0.04 : 0), 0.05), hairM, 0, hy + 0.24, 0.14 - mk * 0.056, P.head); sp.rotation.x = -0.15 + mk * 0.06; } }
          else if (style === 'ponytail') { mesh(HUMAN_GEO.hairCap, hairM, 0, hy, 0, P.head); var tail = mesh(roundCylGeo(0.05, 0.028, 0.36, 10), hairM, 0, hy - 0.08, -0.2, P.head); tail.rotation.x = 0.35; mesh(new THREE.SphereGeometry(0.055, 10, 8), hairM, 0, hy + 0.08, -0.16, P.head); mesh(new THREE.TorusGeometry(0.045, 0.01, 6, 12), new THREE.MeshStandardMaterial({ color: 0xc94a3a }), 0, hy + 0.08, -0.17, P.head).rotation.x = 0.4; mesh(HUMAN_GEO.fringe, hairM, 0, hy, 0, P.head); mesh(HUMAN_GEO.sideL, hairM, 0, hy, 0, P.head); mesh(HUMAN_GEO.sideR, hairM, 0, hy, 0, P.head); }
          else { mesh(HUMAN_GEO.hairCap, hairM, 0, hy, 0, P.head); mesh(HUMAN_GEO.fringe, hairM, 0, hy, 0, P.head); mesh(HUMAN_GEO.sideL, hairM, 0, hy, 0, P.head); mesh(HUMAN_GEO.sideR, hairM, 0, hy, 0, P.head); mesh(HUMAN_GEO.nape, hairM, 0, hy, 0, P.head); }   // short: cap, fringe, sideburns, nape
        }
        if (spec.beard) { mesh(HUMAN_GEO.beard, hairSide, 0, 0.24, 0, P.head); }
        if (spec.moustache) { mesh(bevelGeo(0.12, 0.025, 0.03), hairM, 0, 0.175, 0.168, P.head); }
        P.face = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.28), new THREE.MeshBasicMaterial({ map: personFace(spec.mood || 'neutral', false, spec), transparent: true, depthWrite: false })); P.face.position.set(0, 0.245, 0.17); P.head.add(P.face);
        if (spec.glasses) { var fr = new THREE.MeshStandardMaterial({ color: spec.glassColor || 0x222222, roughness: 0.4, metalness: 0.5 }); [-0.06, 0.06].forEach(function (x) { var ring = mesh(new THREE.TorusGeometry(0.038, 0.006, 6, 16), fr, x, 0.255, 0.178, P.head); var lens = mesh(new THREE.CircleGeometry(0.036, 16), new THREE.MeshPhysicalMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0.25, roughness: 0.05 }), x, 0.255, 0.176, P.head); lens.castShadow = false; }); mesh(bevelGeo(0.03, 0.006, 0.006), fr, 0, 0.26, 0.178, P.head); [-1, 1].forEach(function (s) { var tmp = mesh(bevelGeo(0.006, 0.006, 0.16), fr, s * 0.1, 0.255, 0.085, P.head); }); }
        // hats / accessories
        var capM = new THREE.MeshStandardMaterial({ map: TEX.fabric, color: spec.capColor || 0xc94a3a, roughness: 0.9 });
        if (spec.hat === 'straw') { var sm = new THREE.MeshStandardMaterial({ color: 0xd9b46a, roughness: 1 }); mesh(roundCylGeo(0.31, 0.31, 0.02, 18), sm, 0, 0.36, 0, P.head); mesh(roundCylGeo(0.15, 0.18, 0.12, 16), sm, 0, 0.42, 0, P.head); mesh(new THREE.TorusGeometry(0.165, 0.012, 6, 16), new THREE.MeshStandardMaterial({ color: 0x3a2a1a }), 0, 0.38, 0, P.head).rotation.x = Math.PI / 2; }
        if (spec.hat === 'cap') { mesh(new THREE.SphereGeometry(0.182, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), capM, 0, 0.26, 0, P.head); var peak = mesh(bevelGeo(0.2, 0.015, 0.14), capM, 0, 0.28, 0.2, P.head); peak.rotation.x = 0.15; mesh(new THREE.SphereGeometry(0.02, 8, 6), capM, 0, 0.44, 0, P.head); }
        if (spec.hat === 'nurse') { mesh(bevelGeo(0.22, 0.09, 0.16), new THREE.MeshStandardMaterial({ color: 0xffffff }), 0, 0.4, -0.02, P.head); mesh(bevelGeo(0.1, 0.03, 0.01), new THREE.MeshStandardMaterial({ color: 0xe03030 }), 0, 0.41, 0.065, P.head); mesh(bevelGeo(0.03, 0.1, 0.01), new THREE.MeshStandardMaterial({ color: 0xe03030 }), 0, 0.41, 0.065, P.head); }
        if (spec.hat === 'flowers') { for (var f = 0; f < 8; f++) { var a = f / 8 * Math.PI * 2; mesh(new THREE.SphereGeometry(0.035, 8, 8), new THREE.MeshStandardMaterial({ color: [0xff6b9d, 0xffd166, 0x9ad0ff, 0xf2f2f2][f % 4] }), Math.cos(a) * 0.17, 0.36, Math.sin(a) * 0.17, P.head); mesh(new THREE.SphereGeometry(0.012, 6, 6), new THREE.MeshStandardMaterial({ color: 0xffd166 }), Math.cos(a) * 0.17, 0.36, Math.sin(a) * 0.17 + 0.03, P.head); } mesh(new THREE.TorusGeometry(0.17, 0.01, 6, 20), new THREE.MeshStandardMaterial({ color: 0x3a8f40 }), 0, 0.36, 0, P.head).rotation.x = Math.PI / 2; }
        if (spec.hat === 'beanie') { mesh(new THREE.SphereGeometry(0.19, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), capM, 0, 0.25, 0, P.head); mesh(new THREE.TorusGeometry(0.175, 0.03, 8, 20), capM, 0, 0.26, 0, P.head).rotation.x = Math.PI / 2; mesh(new THREE.SphereGeometry(0.04, 8, 8), capM, 0, 0.45, 0, P.head); }
        if (spec.bowtie) { mesh(bevelGeo(0.05, 0.05, 0.03), new THREE.MeshStandardMaterial({ color: 0xc94a3a }), -0.04, 0.63, 0.13, P.torso).rotation.z = 0.3; mesh(bevelGeo(0.05, 0.05, 0.03), new THREE.MeshStandardMaterial({ color: 0xc94a3a }), 0.04, 0.63, 0.13, P.torso).rotation.z = -0.3; mesh(new THREE.SphereGeometry(0.014, 6, 6), new THREE.MeshStandardMaterial({ color: 0x8a2a2a }), 0, 0.63, 0.14, P.torso); }
        if (spec.necklace) { mesh(new THREE.TorusGeometry(0.08, 0.006, 6, 16, Math.PI), MAT.chrome, 0, 0.62, 0.11, P.torso).rotation.z = Math.PI; }
        if (spec.backpack) { var bpM = new THREE.MeshStandardMaterial({ map: TEX.fabric, color: spec.backpackColor || 0x2f6b9a, roughness: 0.9 }); mesh(bevelGeo(0.3, 0.4, 0.14), bpM, 0, 0.4, -0.19, P.torso); mesh(bevelGeo(0.2, 0.14, 0.05), bpM, 0, 0.3, -0.28, P.torso); [-0.12, 0.12].forEach(function (x) { mesh(bevelGeo(0.05, 0.4, 0.02), bpM, x, 0.42, 0.13, P.torso); }); }
        var rh = P.rArm.userData.elbow, lh = P.lArm.userData.elbow;
        if (spec.prop === 'cane') { var cane = mesh(roundCylGeo(0.012, 0.012, 0.85, 8), new THREE.MeshStandardMaterial({ color: 0x5a3d22 }), 0, -0.6, 0.05, rh); cane.rotation.x = 0.1; mesh(new THREE.TorusGeometry(0.04, 0.012, 6, 12, Math.PI), new THREE.MeshStandardMaterial({ color: 0x5a3d22 }), 0, -0.2, 0.05, rh).rotation.z = Math.PI; mesh(roundCylGeo(0.02, 0.02, 0.03, 8), MAT.black, 0, -1.02, 0.09, rh); }
        if (spec.prop === 'board') { var bd2 = mesh(bevelGeo(0.2, 0.025, 0.75), new THREE.MeshStandardMaterial({ color: 0x4a2a6a }), 0.06, -0.3, 0, lh); bd2.rotation.z = 0.15; mesh(new THREE.PlaneGeometry(0.16, 0.5), new THREE.MeshBasicMaterial({ map: signTex(['SK8'], 100, 300, { size: 60, bg: 'rgba(0,0,0,0)', line: 'rgba(0,0,0,0)', color: '#ffd166' }), transparent: true }), 0.075, -0.3, 0, lh).rotation.set(0, Math.PI / 2, -0.15 + Math.PI / 2); [0.25, -0.25].forEach(function (z) { [0.05, -0.05].forEach(function (dx) { mesh(roundCylGeo(0.03, 0.03, 0.03, 10), new THREE.MeshStandardMaterial({ color: 0xffd166 }), 0.09 + dx * 0.3, -0.3 - 0.02, z, lh).rotation.z = Math.PI / 2; }); mesh(bevelGeo(0.04, 0.03, 0.12), MAT.chrome, 0.1, -0.31, z, lh); }); }
        if (spec.prop === 'book') { mesh(bevelGeo(0.16, 0.22, 0.05), new THREE.MeshStandardMaterial({ color: 0x8a2a2a }), 0.02, -0.34, 0.08, lh); mesh(bevelGeo(0.15, 0.2, 0.04), new THREE.MeshStandardMaterial({ color: 0xf0e8d8 }), 0.03, -0.34, 0.085, lh); }
        if (spec.prop === 'bag') { var bagM = new THREE.MeshStandardMaterial({ map: TEX.fabric, color: 0x6a4a2a, roughness: 0.9 }); mesh(bevelGeo(0.2, 0.24, 0.1), bagM, 0, -0.5, 0.02, rh); mesh(new THREE.TorusGeometry(0.06, 0.008, 6, 12, Math.PI), bagM, 0, -0.38, 0.02, rh); mesh(bevelGeo(0.18, 0.06, 0.11), new THREE.MeshStandardMaterial({ color: 0x4a3a2a }), 0, -0.41, 0.02, rh); }
        if (spec.prop === 'phone') { mesh(bevelGeo(0.07, 0.13, 0.01), new THREE.MeshStandardMaterial({ color: 0x111111 }), 0, -0.36, 0.05, rh); mesh(new THREE.PlaneGeometry(0.06, 0.11), new THREE.MeshStandardMaterial({ color: 0x223355, emissive: 0x3355aa, emissiveIntensity: 0.9 }), 0, -0.36, 0.056, rh).castShadow = false; }
        if (spec.prop === 'coffee') { mesh(roundCylGeo(0.035, 0.03, 0.12, 12), new THREE.MeshStandardMaterial({ color: 0xf2f2f2 }), 0, -0.36, 0.05, rh); mesh(roundCylGeo(0.037, 0.037, 0.015, 12), new THREE.MeshStandardMaterial({ color: 0x3a2a1a }), 0, -0.3, 0.05, rh); mesh(roundCylGeo(0.037, 0.037, 0.03, 12), new THREE.MeshStandardMaterial({ color: 0xc8a97a }), 0, -0.37, 0.05, rh); }
        if (spec.hunch) P.torso.rotation.x = 0.18;
        g.userData.skinMat = skin; g.userData.glasses = !!spec.glasses;
        g.userData.setMood = function (mood) { if (P.mood === mood) return; P.mood = mood; P.face.material.map = personFace(mood, false, spec); P.face.material.needsUpdate = true; P.blinking = false; };
        g.userData.blinkT = 1 + Math.random() * 4;
        g.userData.phase = Math.random() * 6.28; g.userData.phase0 = g.userData.phase;
        return g;
      }
    /* 09-humans-guard.js */
    var guard = { h: null, bubble: null, sayT: 0, state: 'idle', armT: 0 };
    /* 10-staff-paths.js */
    var WORKER_HIRE = 400, WORKER_WAGE = COST.payRate, CREW_MAX = 3;
    /* 10-staff-paths.js */
    var CREW_LOOK = [
        { name: 'Jo',   skin: 0xf1c27d, hair: 0x5a3a1a, hairStyle: 'ponytail', shirt: 0x2f6b4a, at: [-1.5, 1.2] },
        { name: 'Mika', skin: 0xc68642, hair: 0x1c1c22, shirt: 0x2f5b8a, at: [-2.5, 1.5] },
        { name: 'Sam',  skin: 0xe0ac7e, hair: 0x8a6a3a, shirt: 0x8a5a2f, at: [-0.5, 1.6] }
      ];
    /* 10-staff-paths.js */
    function crewHireCost() { return Math.round(WORKER_HIRE * Math.pow(1.6, crewList().length)); }
    /* 10-staff-paths.js */
    function crewList() {   // the saved crew, migrating the single assistant that used to live on a boolean
        if (!S.staff) S.staff = {};
        if (!Array.isArray(S.staff.crew)) {
          S.staff.crew = S.staff.worker ? [{ look: 0, task: S.staff.task || 'idle' }] : [];
        }
        if (S.staff.crew.length > CREW_MAX) S.staff.crew.length = CREW_MAX;   /* keep the same array: callers hold on to it */
        S.staff.crew.forEach(function (c, i) { if (typeof c.look !== 'number') c.look = i; if (!c.task) c.task = 'idle'; });
        S.staff.worker = S.staff.crew.length > 0;   /* a few places still ask the old question */
        return S.staff.crew;
      }
    /* 10-staff-paths.js */
    function crewName(i) { var c = crewList()[i]; return c ? CREW_LOOK[c.look % CREW_LOOK.length].name : 'nobody'; }
    /* 10-staff-paths.js */
    var WORKER_TASKS = [['serve', '🛎️ Serve the window'], ['restock', '📦 Restock the supply rack and machines'], ['clean', '🧹 Sweep the floors'], ['water', '💧 Tend the plants'], ['idle', '☕ Take a break']];
    /* 10-staff-paths.js */
    var GUARD_TASKS = [['door', '🪪 Watch the door'], ['patrol', '🚶 Patrol the lobby'], ['sweep', '🧹 Sweep the lobby'], ['restock', '📦 Restock the counter display']];
    /* 10-staff-paths.js */
    function taskWords(label) { return String(label).replace(/^[^A-Za-z]+/, ''); }
    /* 10-staff-paths.js */
    function workerTaskLabel(i) { var c = crewList()[i === undefined ? (worker ? worker.idx : 0) : i]; var t = WORKER_TASKS.filter(function (x) { return x[0] === ((c && c.task) || 'idle'); })[0]; return t ? taskWords(t[1]) : 'Take a break'; }
    /* 10-staff-paths.js */
    var WORKER_NONE = { g: null, h: null, state: 'idle', path: [], t: 0, job: null, bubble: null, sayT: 0, idleT: 0, coolT: 0, hasBroom: false, idx: 0 };
    /* 10-staff-paths.js */
    var crew = [];
    /* 10-staff-paths.js */
    var worker = WORKER_NONE;
    /* 10-staff-paths.js */
    function buildWorker(rec) {
        if (!rec || rec.g) return;
        var L = CREW_LOOK[rec.look % CREW_LOOK.length];
        var g = new THREE.Group(); g.position.set(L.at[0], 0, L.at[1]); world.group.add(g); rec.g = g;
        rec.h = makePerson({ skin: L.skin, hair: L.hair, hairStyle: L.hairStyle, shirt: L.shirt, pants: 0x2a2d33, shoes: 0x333333, watch: true, logo: '🌿', mood: 'happy' }); g.add(rec.h);
        var badge = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.06), new THREE.MeshBasicMaterial({ map: signTex(['STAFF'], 160, 60, { size: 30, bg: '#6fdc8c', color: '#062010', line: 'rgba(0,0,0,0)' }) })); badge.position.set(0.1, 0.5, 0.148); rec.h.userData.parts.torso.add(badge);
        rec.bubble = sprite(signTex(['…'], 512, 160, { size: 44 }), 1.4, 0.44, 0, 2.25, 0, g); rec.bubble.visible = false;
        var hb = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.1, 0.5), MAT.none); hb.position.y = 1.25; rec.h.add(hb); interactable(hb, { kind: 'worker', idx: rec.idx });
      }
    /* 10-staff-paths.js */
    function removeWorker(rec) {
        rec = rec || worker; carryBack(rec, true); if (!rec.g) return;   /* a crate in their arms goes back into storage; the caller settles the saved record */
        rec.hasBroom = false; rec.broomMesh = null; syncBroom();
        world.group.remove(rec.g); dropTree(rec.g);
        world.interact = world.interact.filter(function (m) { var d = m.userData.interact; return !(d && d.kind === 'worker' && (d.idx || 0) === (rec.idx || 0)); });   /* this one's hit box, not everybody's */
        rec.g = null; rec.h = null; rec.bubble = null; rec.state = 'idle'; rec.job = null; rec.path = [];
      }
    /* 10-staff-paths.js */
    function crewSync() {   // runtime records follow the saved crew: build the new ones, clear out the gone ones
        var list = crewList();
        crew.filter(function (r) { return r.idx >= list.length; }).forEach(function (r) { removeWorker(r); });
        crew = crew.filter(function (r) { return r.idx < list.length; });
        list.forEach(function (c, i) {
          var r = crew.filter(function (x) { return x.idx === i; })[0];
          if (!r) { r = { idx: i, look: c.look, g: null, h: null, state: 'idle', path: [], t: 0, job: null, bubble: null, sayT: 0, idleT: 0, coolT: 0, hasBroom: false }; crew.push(r); if (c.carry) { S.storage[c.carry.item] = (S.storage[c.carry.item] || 0) + c.carry.n; syncStorage(); } c.carry = null; }   /* a crate that was in their arms when the game was saved is back on the racking */
          r.look = c.look;
          if (c.off) { removeWorker(r); c.carry = null; r.job = null; r.path = []; r.state = 'idle'; } else buildWorker(r);
        });
        crew.sort(function (a, b) { return a.idx - b.idx; });
        worker = crew[0] || WORKER_NONE;
      }
    /* 10-staff-paths.js */
    function payWages(offline) {
        var list = crewList(); if (!list.length) return;
        for (var i = list.length - 1; i >= 0; i--) {
          if (list[i].off) { logEvent('🏠 ' + crewName(i) + ' was off, no wage', ''); continue; }   /* sent home means sent home: no work, no pay, no quitting over it */
          if (S.bank + S.vault + S.till >= WORKER_WAGE) { drawFunds(WORKER_WAGE); logEvent('💸 Paid ' + crewName(i) + ' ' + money(WORKER_WAGE), ''); }
          else {
            var nm = crewName(i); list.splice(i, 1);
            if (!offline) { toast('👋 ' + nm + ' quit. There wasn\'t enough for the wage.', 'bad'); }
            logEvent('👋 ' + nm + ' walked out: there wasn\'t enough for the wage', 'bad');
          }
        }
        S.staff.worker = list.length > 0; crewSync();
      }
    /* 10-staff-paths.js */
    function guardOff() { if (!S.staff) S.staff = {}; return !!S.staff.guardOff; }
    /* 10-staff-paths.js */
    function carrySet(rec, c, unsaved) {   // what a crew member has in their arms; kept on their saved record so a reload never loses it
        var saved = !unsaved && crewList()[rec.idx]; if (saved) saved.carry = c ? { item: c.item, n: c.n } : null;
        if (rec.carryMesh && rec.carryMesh.parent) { rec.carryMesh.parent.remove(rec.carryMesh); dropTree(rec.carryMesh); }
        rec.carryMesh = null; rec.carry = c || null;
        if (c && rec.h) { var m = crateMesh(c.item, 0.4, 0.26, 0.32); m.position.set(0, 0.3, 0.3); rec.h.userData.parts.torso.add(m); rec.carryMesh = m; }
      }
    /* 10-staff-paths.js */
    function carryBack(rec, unsaved) {   // a crate still in their arms goes back into storage
        if (!rec || !rec.carry) return; var c = rec.carry; S.storage[c.item] = (S.storage[c.item] || 0) + c.n; carrySet(rec, null, unsaved); syncStorage();
      }
    /* 12-logistics-bat.js */
    var ORDER_WAIT = 15000, VAN_TRIP = 75000;
    /* 12-logistics-bat.js */
    function orderSummary(items) { return Object.keys(items).map(function (k) { return items[k] + '× ' + itemName(k); }).join(', '); }
    /* 12-logistics-bat.js */
    function storageAdd(items) { Object.keys(items).forEach(function (k) { S.storage[k] = (S.storage[k] || 0) + items[k]; }); world.dirtyStorage = true; }
    /* 12-logistics-bat.js */
    var courier = { g: null, h: null, state: 'away', path: [], t: 0, bubble: null };
    /* 12-logistics-bat.js */
    function updateLogistics(dt, offline) {
        // an open order closes a few seconds after the last click and becomes a delivery on its way
        if (S.order && now() - S.order.at > ORDER_WAIT) { S.deliveries.push({ items: S.order.items, due: now() + (S.upgrades.ownvan ? 20000 : hasLic('wholesale') ? VAN_TRIP / 2 : VAN_TRIP) }); logEvent('🚚 Order dispatched: ' + orderSummary(S.order.items), ''); if (!offline) toast('🚚 Order dispatched. The supplier\'s van is on its way to the back door.', ''); S.order = null; }
        // deliveries that came due while the window was closed just land in storage
        if (offline) { var keep = []; S.deliveries.forEach(function (d) { if (now() >= d.due) { storageAdd(d.items); logEvent('📦 Delivered while you were away: ' + orderSummary(d.items), 'good'); } else keep.push(d); }); S.deliveries = keep; }
        // courier: called from the bank app, turns up a minute or two later
        if (S.courier && S.courier.state === 'called' && now() >= S.courier.at && !offline) { S.courier.state = 'arriving'; courierArrive(); }   // a courier that came due while the game was closed simply turns up on the next live tick
        if (S.courier && S.courier.state !== 'called' && courier.state === 'away' && !offline && ui.started) { courierArrive(); }   // booked and supposedly here but no body (reload mid-visit): walk them in again instead of blocking the bank app forever
      }
    /* 12-logistics-bat.js */
    function rollerSet(open) { if (world.rollerOpen !== open && world.rollerDoor) sfx('roller'); world.rollerOpen = open; world.obstacles = world.obstacles.filter(function (o) { return o.tag !== 'roller'; }); if (!open) world.obstacles.push({ x1: 3.0, x2: 6.0, z1: -12.75, z2: -12.35, tag: 'roller', floorLevel: 0 }); }
    /* 12-logistics-bat.js */
    function gateSet(open) { if (world.gateOpen !== open && world.yardGate) sfx('gate'); world.gateOpen = open; world.obstacles = world.obstacles.filter(function (o) { return o.tag !== 'gate'; }); if (!open) world.obstacles.push({ x1: 3.0, x2: 6.0, z1: (world.yardGateZ || -18) - 0.15, z2: (world.yardGateZ || -18) + 0.15, tag: 'gate', floorLevel: 0 }); }
    /* 12-logistics-bat.js */
    function courierArrive() {
        if (!courier.g) { courier.g = new THREE.Group(); world.group.add(courier.g); courier.bubble = sprite(signTex(['…'], 512, 160, { size: 44 }), 1.5, 0.58, 0, 2.25, 0, courier.g); }
        if (courier.h) { courier.g.remove(courier.h); dropTree(courier.h); }
        courier.h = makePerson({ skin: 0xe0ac7e, hair: 0x2b1b12, shirt: 0x1f3a5f, pants: 0x1f3a5f, hat: 'cap', capColor: 0x1f3a5f, longSleeve: true, hairStyle: 'short', watch: true, shoes: 0x111111, logo: '🏦', mood: 'neutral' });
        courier.g.add(courier.h); var el = courier.h.userData.parts.lArm.userData.elbow; var cs = new THREE.Mesh(bevelGeo(0.3, 0.22, 0.1), colorMat(0x1a1c20, 0.5, 0.3)); cs.position.set(0, -0.45, 0.02); el.add(cs);
        var hb = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.1, 0.5), MAT.none); hb.position.y = 1.25; hb.userData.courier = true; courier.h.add(hb); interactable(hb, { kind: 'courier' });
        courier.g.position.set(4.5, 0, -21); courier.g.visible = true; courier.state = 'in'; courier.path = [{ x: 4.5, z: -16 }, { x: 4.5, z: -11.6 }]; gateSet(true); rollerSet(true);
        courier.bubble.visible = false; toast('🏦 The bank courier is at the back gate', ''); logEvent('🏦 Bank courier arrived for a ' + money(S.courier.amount) + ' pickup', '');
      }
    /* 13-basement.js */
    var CIG_SKUS = {
        cigNS: { name: 'RF Smoking 10s',       type: 'normal', size: 10, price: 7,  col: 0xb5121b, top: 0xf4f1ea },
        cigNB: { name: 'RF Smoking 20s',       type: 'normal', size: 20, price: 13, col: 0xb5121b, top: 0xf4f1ea },
        cigLS: { name: 'RF Smoking Light 10s', type: 'light',  size: 10, price: 8,  col: 0xdfe6ee, top: 0x2f6b9a },
        cigLB: { name: 'RF Smoking Light 20s', type: 'light',  size: 20, price: 14, col: 0xdfe6ee, top: 0x2f6b9a }
      };
    /* 13-basement.js */
    var TOB = { wholesale: 0.5, driverShare: 0.45, growT: 200, sowCost: 20, bayKg: 2, kilnMax: 8, kilnT: 60, cureYield: 0.2, shredKgS: 0.02, stickKg: { normal: 0.0008, light: 0.0006 }, sticksS: 6, packS: 1.2, matCost: 50, matUnits: 100, carton: 10 };
    /* 13-basement.js */
    var tobUI = { signs: {}, bays: [], beacons: {}, spin: [], beltItems: [], rackG: null, kilnGlow: null, t: 0, fade: null };
    /* 13-basement.js */
    function tobFresh() { return { bays: [{ stage: 'empty', t: 0 }, { stage: 'empty', t: 0 }, { stage: 'empty', t: 0 }, { stage: 'empty', t: 0 }], leaf: 0, kiln: { on: false, kg: 0, t: 0 }, cured: 0, shred: { on: false }, cut: 0, maker: { on: false, mode: 'normal' }, sticks: { normal: 0, light: 0 }, packer: { on: false, size: 10, type: 'normal', t: 0 }, mat: 0, packs: { cigNS: 0, cigNB: 0, cigLS: 0, cigLB: 0 }, made: 0 }; }
    /* 13-basement.js */
    function tob() { if (!S.tob || !S.tob.bays) S.tob = tobFresh(); return S.tob; }
    /* 13-basement.js */
    function skuOf(type, size) { return 'cig' + (type === 'light' ? 'L' : 'N') + (size === 20 ? 'B' : 'S'); }
    /* 13-basement.js */
    function kg(n) { return (Math.round(n * 100) / 100) + ' kg'; }
    /* 13-basement.js */
    function syncTobRack() {
        var g = tobUI.rackG; if (!g) return; dropKids(g); var T = tob();
        CIG_KEYS.forEach(function (k, i) { var K = CIG_SKUS[k]; var cartons = Math.min(8, Math.ceil(T.packs[k] / TOB.carton)); for (var c = 0; c < cartons; c++) { var w = K.size === 20 ? 0.3 : 0.24; var m = new THREE.Mesh(bevelGeo(w, 0.1, 0.4), colorMat(K.col, 0.6)); m.position.set(-0.75 + (c % 4) * 0.5, [0.37, 0.92, 1.47, 2.02][i] + Math.floor(c / 4) * 0.105, 0); g.add(m); var band = new THREE.Mesh(bevelGeo(w + 0.004, 0.03, 0.404), colorMat(K.top, 0.6)); band.position.copy(m.position); band.position.y += 0.03; g.add(band); } });
      }
    /* 13-basement.js */
    function setTobSign(key, lines) { var s = tobUI.signs[key]; if (!s) return; var txt = lines.join('|'); if (s.txt === txt) return; s.txt = txt; var ob = s.mesh.material.map; s.mesh.material.map = signTex(lines, s.w, s.h, s.opts); s.mesh.material.needsUpdate = true; if (ob) ob.dispose(); }
    /* 13-basement.js */
    function packerReady(T) { var P = T.packer; return T.sticks[P.type] >= P.size && T.mat >= (P.size === 20 ? 2 : 1); }
    /* 13-basement.js */
    function updateTobacco(dt) {
        var T = tob();
        T.bays.forEach(function (b, i) { if (b.stage !== 'grow') return; b.t += dt; if (b.t >= TOB.growT) { b.stage = 'ready'; toast('🌿 Tobacco bay ' + (i + 1) + ' is ready to harvest', 'good'); save(); } });
        var K = T.kiln; if (K.on) { if (K.kg <= 0 && T.leaf >= 1) { K.kg = Math.min(TOB.kilnMax, T.leaf); T.leaf -= K.kg; K.t = 0; } if (K.kg > 0) { K.t += dt; if (K.t >= TOB.kilnT) { T.cured += K.kg * TOB.cureYield; logEvent('🔥 Kiln finished a load: ' + kg(K.kg * TOB.cureYield) + ' of cured leaf', ''); K.kg = 0; K.t = 0; save(); } } }
        if (T.shred.on && tobSpare(T) > 0) { var c = Math.min(tobSpare(T), TOB.shredKgS * dt); T.cured -= c; T.cut += c; }
        if (T.maker.on && T.cut > 0) { var per = TOB.stickKg[T.maker.mode]; var n = Math.min(TOB.sticksS * dt, T.cut / per); T.cut = Math.max(0, T.cut - n * per); T.sticks[T.maker.mode] += n; }
        var P = T.packer; if (P.on && packerReady(T)) { P.t += dt; if (P.t >= TOB.packS) { P.t = 0; T.sticks[P.type] -= P.size; T.mat -= P.size === 20 ? 2 : 1; var sku = skuOf(P.type, P.size); T.packs[sku]++; T.made++; if (T.packs[sku] % TOB.carton === 1 || T.packs[sku] % TOB.carton === 0) syncTobRack(); } }
        if (player.floor !== -1) return;
        // everything below is only what you can see from the floor
        var run = { kiln: K.on && K.kg > 0, shred: T.shred.on && tobSpare(T) > 0, maker: T.maker.on && T.cut > 0, packer: P.on && packerReady(T) }; var armed = { kiln: K.on, shred: T.shred.on, maker: T.maker.on, packer: P.on };
        tobUI.spin.forEach(function (s) { if (run[s.key]) s.g.rotation[s.axis] += s.speed * dt; });
        tobUI.t += dt; var blink = Math.sin(tobUI.t * 6) > 0;
        Object.keys(tobUI.beacons).forEach(function (k) { var m = tobUI.beacons[k].material; m.emissiveIntensity = run[k] ? (blink ? 2.2 : 0.6) : armed[k] ? 0.7 : 0.08; m.color.setHex(run[k] ? 0x39d353 : 0xff8a1c); m.emissive.setHex(run[k] ? 0x39d353 : 0xff8a1c); });
        if (tobUI.kilnGlow) tobUI.kilnGlow.material.emissiveIntensity = run.kiln ? 1.6 + Math.sin(tobUI.t * 3) * 0.4 : 0.05;
        tobUI.beltItems.forEach(function (o) { var on = o.lane === 0 ? run.shred : run.maker; o.m.visible = on; if (!on) return; var r = o.lane === 0 ? [3.6, 1.9] : [-0.35, -1.75]; var f = (tobUI.t * 0.35 + o.off) % 1; o.m.position.x = r[0] + (r[1] - r[0]) * f; });
        T.bays.forEach(function (b, i) { var g = tobUI.bays[i]; if (!g) return; g.visible = b.stage !== 'empty'; var gr = b.stage === 'ready' ? 1 : clamp(b.t / TOB.growT, 0, 1); var sc = 0.12 + gr * 0.88; g.scale.set(sc, sc, sc); });
        tobUI.signT = (tobUI.signT || 0) - dt; if (tobUI.signT > 0) return; tobUI.signT = 0.5;
        T.bays.forEach(function (b, i) { setTobSign('bay' + i, ['BAY ' + (i + 1), b.stage === 'empty' ? 'empty · E to sow' : b.stage === 'ready' ? 'ready · E to cut' : 'growing ' + Math.round(b.t / TOB.growT * 100) + '%']); });
        setTobSign('kiln', ['KILN', !K.on ? 'off' : K.kg > 0 ? 'curing ' + kg(K.kg) : 'waiting for leaf', K.kg > 0 ? Math.ceil(TOB.kilnT - K.t) + ' s left' : 'leaf in: ' + kg(T.leaf)]);
        setTobSign('shred', ['SHREDDER', !T.shred.on ? 'off' : run.shred ? 'cutting' : 'idle', 'cured: ' + kg(T.cured)]);
        setTobSign('maker', ['MAKER', (T.maker.mode === 'light' ? 'LIGHT' : 'NORMAL') + (T.maker.on ? run.maker ? ' · rolling' : ' · idle' : ' · off'), 'cut: ' + kg(T.cut), 'N ' + Math.floor(T.sticks.normal) + ' · L ' + Math.floor(T.sticks.light)]);
        setTobSign('packer', ['PACKER', (P.type === 'light' ? 'LIGHT ' : 'NORMAL ') + P.size + 's' + (P.on ? run.packer ? ' · packing' : ' · starved' : ' · off'), 'materials: ' + T.mat, 'packed: ' + T.made]);
        setTobSign('rack', ['FINISHED GOODS', CIG_KEYS.map(function (k) { return (CIG_SKUS[k].type === 'light' ? 'L' : 'N') + CIG_SKUS[k].size + ': ' + T.packs[k]; }).join('   ')]);
      }
    /* 13-basement.js */
    function cigStock(k) { if (!S.cigStock) S.cigStock = {}; return S.cigStock[k] || 0; }
    /* 13-basement.js */
    function syncCigCab() {
        var inst = propInst.cigCabinet; if (!inst) return; var g = inst.ctx.dynGroup(); var keep = g.userData.shutter; dropKids(g); if (keep) g.add(keep);
        Object.keys(CIG_SKUS).forEach(function (k, i) { var K = CIG_SKUS[k], n = Math.min(i < 4 ? 5 : K.shape === 'cigar' ? 2 : 3, cigStock(k)), big = K.size === 20; for (var p = 0; p < n; p++) { var w = big ? 0.075 : 0.06, hh = big ? 0.11 : 0.09; var m = productCigPack(K, big ? 1.3 : 1.25); m.position.set((i < 4 ? -0.47 : i < 8 ? -0.03 : 0.25) + p * (K.shape === 'cigar' ? 0.11 : 0.082), [1.62, 1.27, 0.92, 0.57][i % 4] + (K.shape ? 0.05 : hh / 2), 0.06);   /* three columns: what the packer makes, what the lab makes, and the cigars and the honey */ m.traverse(function (o) { if (o.isMesh) o.castShadow = false; }); g.add(m); } });   /* the cabinet shows the same pack you hand over */
        g.traverse(function (o) { if (o.isMesh) o.userData.propId = 'cigCabinet'; });
      }
    /* 14-city.js */
    function vehState(id) {   /* S.car and S.van: where it stands, what is in the back, lights, handbrake, odometer, which parts are open */
        var d = id === 'van' ? { x: 7.0, z: -15.3 } : { x: 12.8, z: -18.25 };   /* the van is 5 m long: at 7.0 its tail clears the garage wall */
        if (!S[id] || typeof S[id].x !== 'number') S[id] = { x: d.x, z: d.z, h: Math.PI / 2, trunk: {} }; if (!S[id].trunk) S[id].trunk = {};
        if (typeof S[id].lights !== 'number') S[id].lights = 0; if (typeof S[id].brake !== 'boolean') S[id].brake = true; if (typeof S[id].odo !== 'number') S[id].odo = 0;
        if (!S[id].open) S[id].open = { doorL: false, doorR: false, boot: false, bonnet: false, hatch: false, counter: false };
        if (!S[id].cigs || typeof S[id].cigs !== 'object') S[id].cigs = {};   /* cartons ride in whichever vehicle they were loaded into */
        return S[id];
      }
    /* 14-city.js */
    function carState() { return vehState(drive.veh || 'car'); }
    /* 14-city.js */
    var FLORA = { seed: 91, sets: {}, _m: new THREE.Matrix4(), _p: new THREE.Vector3(), _q: new THREE.Quaternion(), _s: new THREE.Vector3(), _c: new THREE.Color(), _e: new THREE.Euler(), UP: new THREE.Vector3(0, 1, 0) };
    /* 14-city.js */
    function frnd() { FLORA.seed = (FLORA.seed * 1103515245 + 12345) & 0x7fffffff; return FLORA.seed / 0x7fffffff; }
    /* 14-city.js */
    function fr(a, b) { return a + (b - a) * frnd(); }
    /* 16-town-van.js */
    function carNear(x, z, r) { return Math.hypot(drive.g.position.x - x, drive.g.position.z - z) < r; }
    /* 17-upstairs-expansion.js */
    var DIVX = 2.0;
    /* 17-upstairs-expansion.js */
    var CIG_KEYS = ['cigNS', 'cigNB', 'cigLS', 'cigLB'];
    /* 17-upstairs-expansion.js */
    var exp = { zoneLight: null, zone: '', wx: null, wxKind: '', beacon: null, dropHit: null, getaway: null, opT: 0, heatBand: 0, roofBeds: [], roofSigns: [], genLed: null };
    /* 17-upstairs-expansion.js */
    function powerOn() { return !!S.upgrades.generator || now() > (xs().blackoutUntil || 0); }
    /* 17-upstairs-expansion.js */
    function seasonLabel() { return ['Spring', 'Summer', 'Autumn', 'Winter'][Math.floor(((S.day || 1) - 1) / 7) % 4]; }
    /* 17-upstairs-expansion.js */
    function weekend() { var d = (S.day || 1) % 7; return d === 6 || d === 0; }
    /* 17-upstairs-expansion.js */
    function labTick(dt) {   // a lab batch runs down its timer; the caller decides whether there is power
        if (!dlcOn('lab')) return;   /* switched off: a running batch waits */
        var X = xs(), J = X.lab.job; if (J) { J.t += dt; if (J.t >= J.dur) { labShelve(J); X.lab.job = null; sfx('ok'); toast('🧪 Lab batch done: ' + J.n + ' × ' + CIG_SKUS[J.sku].name + ' waiting on the lab shelf', 'good'); save(); } }
      }
    /* 17-upstairs-expansion.js */
    function roofTick(dt, catchUp) {   // catchUp: time already scaled for the daylight share, so the hour it happens to be now does not matter
        var X = xs(), W = X.weather, gh = dlcOn('greenhouse');   /* switched off: the beds wait as they are */
        X.roof.forEach(function (b, i) { if (gh && b.stage === 'grow' && (catchUp || !nightNow())) { b.t += dt * (W.kind === 'rain' || roofWatered() ? 1.5 : 1) * (seasonLabel() === 'Winter' ? 0.5 : 1); if (b.t >= 260) { b.stage = 'ready'; toast('🌿 Roof bed ' + (i + 1) + ' is ready', 'good'); } } var g = exp.roofBeds[i]; if (g) { g.visible = gh && b.stage !== 'empty'; var sc = b.stage === 'ready' ? 1 : 0.1 + clamp(b.t / 260, 0, 1) * 0.9; g.scale.set(1, sc, 1); } });
      }
    /* 18-deliveries.js */
    var BRANCH_PAY = 9, BRANCH_CAP = 60;
    /* 18-deliveries.js */
    function jobsOf(via) { return xs().jobs.filter(function (j) { return j.via === via; }); }
    /* 18-deliveries.js */
    function jobGoods(j) { return j.via === 'branch' ? 'goods for the branch' : j.via === 'tablet' ? CIG_SKUS[j.sku].name : kindName(j.kind, j.qty); }
    /* 18-deliveries.js */
    function tabletHas() { for (var i = 0; i < 6; i++) if (S.hotbar[i] && S.hotbar[i].kind === 'tablet') return true; return false; }
    /* 18-deliveries.js */
    function tabletHere() { var X = xs(); if (!hasLic('tobacco')) return false; if (X.tablet === 'car') return drive.on || carNear(player.pos.x, player.pos.z, 11); return X.tablet === 'hand' && tabletHas(); }
    /* 18-deliveries.js */
    function paneJobs(tab) {
        var X = xs(), list = jobsOf(tab), rows = [], pos = drive.on ? drive.g.position : player.pos, bj = jobsOf('branch')[0];
        var br = bj ? '<p class="g3-sub2">🏪 <b>Green Leaf, your branch</b> (#' + (X.jobs.indexOf(bj) + 1) + ' on the map, ' + Math.round(Math.hypot(bj.x - pos.x, bj.z - pos.z)) + ' m away): carry bags, joints or cookies to the blue beacon out front and press <b>E</b>. It pays ' + money(BRANCH_PAY) + ' a unit each morning for up to ' + BRANCH_CAP + ' a day (' + (X.branchUnits || 0) + ' dropped off today).</p>' : '';
        if (tab === 'tablet' && !hasLic('tobacco')) return br + '<p class="g3-empty">The RF Smoking round needs the tobacco licence. Buy it at the office PC, and the tablet on the office dock wakes up.</p>';
        if (tab === 'tablet' && !tabletHere()) return br + '<p class="g3-empty">The tablet is ' + (X.tablet === 'car' ? 'in the car, and the car isn\'t here' : 'on its dock in the office') + '. Fetch it, and it rides in the car once you drive off with it.</p>';
        if (!list.length) return br + '<p class="g3-empty">' + (tab === 'tablet' ? 'No round jobs right now. They come in while the shop is open, once the basement is making packs.' : 'Nobody is ringing. Pack some joints or bags and the phone starts going.') + '</p>';
        list.forEach(function (j) {
          var n = X.jobs.indexOf(j) + 1, left = Math.max(0, Math.round((j.until - now()) / 1000)), km = Math.round(Math.hypot(j.x - pos.x, j.z - pos.z)) + ' m';
          var have = j.via === 'tablet' ? ((carState().cigs[j.sku] || 0) + ' in the car · ' + tob().packs[j.sku] + ' on the rack') : (S.pkg[j.kind].n + ' packed');
          rows.push('<tr><td><b>#' + n + '</b></td><td><b>' + j.addr + '</b><br><small>' + km + ' away · ' + have + '</small></td>' +
            '<td>' + j.qty + ' × ' + jobGoods(j) + '</td>' +
            '<td class="' + (left < 60 ? 'bad' : '') + '">' + Math.floor(left / 60) + ' min ' + (left % 60) + ' s</td>' +
            '<td><b>' + (j.via === 'tablet' ? money(j.pay) : '~' + money(Math.round(unitPrice(j.kind, 60, 1.2) * j.qty * 1.6))) + '</b><br><small>' + (j.via === 'tablet' ? 'to the bank' : 'cash, +heat') + '</small></td></tr>');
        });
        return br + '<p class="g3-sub2">' + (tab === 'tablet' ? 'Load packs into the car or the van at home (Shift+E on it), drive the round, and press <b>E</b> at each beacon. Numbers match the map on <b>M</b>.' : 'Carry the goods in your hands and press <b>E</b> at the beacon. Cash goes in your pocket and it raises your heat.') + '</p>' +
          '<table class="g3-jobs"><tr><th></th><th>Address</th><th>Order</th><th>Left</th><th>Pays</th></tr>' + rows.join('') + '</table>';
      }
    /* 18-deliveries.js */
    function expansionNewDay(offline) {
        var X = xs(), wages = (X.staff.driver ? 90 : 0) + (X.staff.operator ? 80 : 0) + (X.staff.night ? 70 : 0) + (X.staff.labtech ? LAB_TECH.wage : 0); if (wages) { var wPaid = drawFunds(wages); if (wages - wPaid > 0.5) books().arrears += wages - wPaid; if (!offline) logEvent('💼 Extra staff wages: ' + money(wages), ''); }
        if (X.staff.driver) { var T = tob(), val = 0, n = 0; CIG_KEYS.forEach(function (k) { var sell = Math.max(0, T.packs[k] - COST.driverKeep); n += sell; val += sell * CIG_SKUS[k].price * TOB.driverShare; T.packs[k] -= sell; });   /* a little under the tobacconist: he saves you the drive */   /* he leaves a few of each kind on the rack so the round jobs can still be filled */ if (n) { S.bank += Math.round(val); bookSale(Math.round(val)); syncTobRack(); if (!offline) { logEvent('🚚 Your driver sold ' + n + ' packs wholesale for ' + money(Math.round(val)), 'good'); toast('🚚 Driver: ' + n + ' packs wholesaled · ' + money(Math.round(val)), 'good'); } } }
        if (X.branch) { var bu = Math.min(BRANCH_CAP, X.branchUnits || 0), inc = Math.round(bu * BRANCH_PAY + Math.max(0, S.rep) * 2); X.branchUnits = 0; S.bank += inc; bookSale(inc); logEvent('🏪 Green Leaf (your branch) sent over ' + money(inc) + ': ' + bu + ' units you dropped off at ' + money(BRANCH_PAY) + ' each, plus ' + money(Math.max(0, S.rep) * 2) + ' on your name', inc > 0 ? 'good' : ''); if (!offline) toast('🏪 Branch takings: ' + money(inc) + (bu ? '' : ' (nothing dropped off yesterday, stock it at the blue beacon)'), bu ? 'good' : ''); }
        if (!offline && weekend()) toast('📅 It\'s the weekend. Expect more people through the door.', ''); if (!offline && (S.day % 28) === 25) toast('🎉 Holiday week starts. Footfall is up by half.', 'rare');
      }
    /* 19-doors-fixtures-intro.js */
    var FIXTURES = [], fxById = {}, fxSignCount = {}, fxRay = new THREE.Raycaster(), fxTick = 0;
    /* 19-doors-fixtures-intro.js */
    function fixtureSign(m, lines) { var key = 'sign:' + String(lines && lines[0] || 'sign').slice(0, 32); fxSignCount[key] = (fxSignCount[key] || 0) + 1; fixtureAdd(key + '#' + fxSignCount[key], 'sign “' + String(lines && lines[0] || '').slice(0, 24) + '”', [m], 0); }
    /* 22-dehum-street-rooms.js */
    function syncRack() {
        if (!propInst.rack) return; var g = propInst.rack.ctx.dynGroup(); dropKids(g);
        world.interact = world.interact.filter(function (m) { return m.userData.dynGroup !== 'rack'; });
        var rx = 0, rz = 0;
        var soil = Math.min(S.supplies.soil || 0, 6);
        for (var i = 0; i < soil; i++) { var sack = productSoilSack(1.5); sack.position.set(rx - 0.32 + (i % 3) * 0.3, 0.41, rz - 0.1 + Math.floor(i / 3) * 0.2); sack.rotation.y = ((i % 3) - 1) * 0.08; sack.rotation.y = (i % 2) * 0.2; sack.castShadow = true; g.add(sack); }
        var nut = Math.min(S.supplies.nutrients || 0, 5), spr = Math.min(S.supplies.remedy || 0, 4);
        for (var n = 0; n < nut; n++) { var bt = productNutrientBottle(1.35); bt.position.set(rx - 0.36 + n * 0.1, 0.88, rz - 0.1); bt.rotation.y = n * 0.5; g.add(bt); }
        for (var sI = 0; sI < spr; sI++) { var sb = productSprayBottle(1.3); sb.position.set(rx + 0.1 + sI * 0.1, 0.9, rz + 0.1); sb.rotation.y = Math.PI + sI * 0.3; g.add(sb); }
        if ((S.supplies.bag || 0) > 0) { var bx = cartonBox(0.22, 0.14, 0.16, ['BAGGIES', 'x100'], 0xe8e8ee, '#3a4a42'); bx.position.set(rx - 0.3, 1.44, rz + 0.1); g.add(bx); }
        if ((S.supplies.paper || 0) > 0) { var px = cartonBox(0.16, 0.08, 0.12, ['PAPERS', 'king size'], 0xf5e6c8, '#5a4a2a'); px.position.set(rx, 1.41, rz + 0.12); g.add(px); }
        if ((S.supplies.tip || 0) > 0) { var tx = cartonBox(0.12, 0.08, 0.12, ['TIPS', 'filter'], 0xc8b48a, '#4a3a22'); tx.position.set(rx + 0.25, 1.41, rz + 0.12); g.add(tx); }
        var spare = Math.min(Math.max(0, (S.supplies.pot || 0) - S.plants.length), 4);
        for (var pI = 0; pI < spare; pI++) { var pt = new THREE.Mesh(roundCylGeo(0.11, 0.09, 0.14, 14), MAT.pot); pt.position.set(rx - 0.3 + pI * 0.2, 1.93, rz); g.add(pt); }
        var jars = Math.min(S.supplies.jar || 0, 3); for (var jI = 0; jI < jars; jI++) { var jr = new THREE.Mesh(roundCylGeo(0.06, 0.06, 0.14, 12), MAT.jar); jr.position.set(rx + 0.2 + jI * 0.14, 1.93, rz + 0.12); g.add(jr); }
        var sx2 = 0; STRAINS.forEach(function (st) { var n = S.supplies['seed_' + st.id] || 0; if (!n) return; var pk = productSeedPacket(st, 1.35); pk.position.set(rx - 0.36 + (sx2 % 6) * 0.16, 1.48 - Math.floor(sx2 / 6) * 0.19, rz - 0.15);   /* six to a row, then the next shelf down */ pk.rotation.x = -0.35; g.add(pk); var ph = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.16, 0.12), MAT.none); ph.position.copy(pk.position); g.add(ph); interactable(ph, { kind: 'rackItem', item: 'seed_' + st.id, label: st.name + ' seed' }); ph.userData.dynGroup = 'rack'; ph.userData.propId = 'rack'; sx2++; });
        if (soil > 0) { var sh = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.3, 0.44), MAT.none); sh.position.set(rx, 0.42, rz); g.add(sh); interactable(sh, { kind: 'rackItem', item: 'soil', label: 'bag of soil' }); sh.userData.dynGroup = 'rack'; sh.userData.propId = 'rack'; }
        if (nut > 0) { var nh = new THREE.Mesh(new THREE.BoxGeometry(0.1 * nut + 0.04, 0.18, 0.1), MAT.none); nh.position.set(rx - 0.36 + (nut - 1) * 0.05, 0.9, rz - 0.1); g.add(nh); interactable(nh, { kind: 'rackItem', item: 'nutrients', label: 'nutrients' }); nh.userData.dynGroup = 'rack'; nh.userData.propId = 'rack'; }
        if (spr > 0) { var rh = new THREE.Mesh(new THREE.BoxGeometry(0.1 * spr + 0.04, 0.22, 0.1), MAT.none); rh.position.set(rx + 0.1 + (spr - 1) * 0.05, 0.94, rz + 0.1); g.add(rh); interactable(rh, { kind: 'rackItem', item: 'remedy', label: 'pest spray' }); rh.userData.dynGroup = 'rack'; rh.userData.propId = 'rack'; }
          g.traverse(function (o) { if (o.isMesh) o.userData.propId = 'rack'; });
      }
    /* 23-board.js */
    var DESK_PAGES = ['overview', 'prs', 'seats', 'fleet', 'watch'];
    /* 23-board.js */
    var DESK_PAGE_LABEL = { overview: 'Overview', prs: 'Stock', seats: 'Staff', fleet: 'Production', watch: 'Security' };
    /* 23-board.js */
    var DESK_INK = '#e8f1ea', DESK_DIM = '#8fa596', DESK_MUTE = '#4d5e52', DESK_OK = '#6fdc8c', DESK_WARN = '#ffc857', DESK_BAD = '#ff6b6b';
    /* 23-board.js */
    function deskTrim(ctx, text, maxW) { text = String(text || ''); if (ctx.measureText(text).width <= maxW) return text; while (text.length > 4 && ctx.measureText(text + '…').width > maxW) text = text.slice(0, -2); return text + '…'; }
    /* 23-board.js */
    function dashRows() {
        var X = typeof xs === 'function' ? xs() : { heat: 0, staff: {}, weather: { kind: 'clear' } }, T = typeof tob === 'function' ? tob() : null, packs = T ? CIG_KEYS.reduce(function (a, k) { return a + T.packs[k]; }, 0) : 0;
        var staffN = crewList().length + 1 + (X.staff.driver ? 1 : 0) + (X.staff.operator ? 1 : 0) + (X.staff.night ? 1 : 0);
        return {
          overview: [['Bank', money(S.bank), 'cash on site ' + money(cashOnSite())], ['Rep', String(Math.round(S.rep)), 'level ' + S.level], ['Market', (S.market || 1).toFixed(2) + '×', shop().open ? 'shop is open' : 'shop is closed'], ['Day', String(S.day || 1), (typeof seasonLabel === 'function' ? seasonLabel() : '') + ' · ' + X.weather.kind]],
          prs: [['Cured stash', Math.round(S.cured.g) + ' g', 'ready to pack'], ['Eighth bags', String(S.pkg.bags.n), 'on the goods shelf'], ['Joints', String(S.pkg.joints.n), 'on the goods shelf'], ['Cookies', String(S.pkg.cookies.n), 'on the goods shelf']],
          seats: [['People on the payroll', String(staffN), 'guard included'], ['Driver', X.staff.driver ? 'hired' : 'none', 'wholesale and deliveries'], ['Basement operator', X.staff.operator ? 'hired' : 'none', 'keeps the line running'], ['Night guard', X.staff.night ? 'hired' : 'none', 'stops break-ins']],
          fleet: [['Cigarette packs', String(packs), 'on the basement rack'], ['Plants growing', String(S.plants.length), 'in the tent'], ['Roof beds', String((X.roof || []).filter(function (b) { return b.stage !== 'empty'; }).length), 'sown'], ['Lab', X.lab && X.lab.job ? 'running' : 'idle', 'extraction and edibles']],
          watch: [['Heat', Math.round(X.heat) + ' / 100', X.heat >= 60 ? 'inspections likely' : X.heat >= 30 ? 'noticed' : 'quiet'], ['Robberies', String(S.stats.heists || 0), (S.stats.foiled || 0) + ' foiled'], ['Lost to robbers', money(S.stats.robbed || 0), 'all time'], ['Power', typeof powerOn === 'function' && !powerOn() ? 'CUT' : 'on', S.upgrades.generator ? 'generator standing by' : 'no generator']]
        };
      }
    /* 23-board.js */
    var DESK_TAB_X = 470, DESK_TAB_W = 170, DESK_TAB_H = 44, DESK_TAB_Y = 30, DESK_FONT = '"Segoe UI",system-ui,sans-serif';
    /* 23-screen-kit.js */
    var SCR_MONO = '"Cascadia Mono",Consolas,monospace', SCR_EMOJI = '"Segoe UI Emoji","Segoe UI Symbol","Apple Color Emoji",sans-serif';
    /* 23-screen-kit.js */
    function tCursor(sc, ctx) {
        var c = sc.cur, t = now();
        if (sc.tapAt && t - sc.tapAt < 350) { var k = (t - sc.tapAt) / 350; ctx.strokeStyle = 'rgba(111,220,140,' + (1 - k).toFixed(2) + ')'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(sc.tapX, sc.tapY, 10 + k * 40, 0, Math.PI * 2); ctx.stroke(); }
        if (!c) return; var r = Math.max(8, Math.round(sc.w / 110));
        ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 6;
        ctx.strokeStyle = 'rgba(255,255,255,.92)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = sc.hotZone ? DESK_OK : 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.arc(c.x, c.y, r * 0.36, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
    /* 23-screen-kit.js */
    function tDraw(sc) { var ctx = sc.canvas.getContext('2d'); ctx.setTransform(sc.scale, 0, 0, sc.scale, 0, 0); sc.zones = []; sc.drawAt = now(); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; sc.draw(sc, ctx); tCursor(sc, ctx); sc.tex.needsUpdate = true; }
    /* 23-screen-kit.js */
    function scrRgba(hex, a) { var n = parseInt(String(hex).slice(1), 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; }
    /* 23-screen-kit.js */
    function scrBg(ctx, W, H, accent) {   // near black, the accent bleeding in from the top left, a fine dot grid, darker corners
        var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0e1613'); g.addColorStop(1, '#060a08'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        var r = ctx.createRadialGradient(W * 0.1, -H * 0.15, 10, W * 0.1, -H * 0.15, W * 0.8); r.addColorStop(0, scrRgba(accent, 0.24)); r.addColorStop(1, scrRgba(accent, 0)); ctx.fillStyle = r; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = 'rgba(255,255,255,.04)'; var st = Math.max(14, Math.round(W / 40)); for (var y = st; y < H; y += st) for (var x = st; x < W; x += st) ctx.fillRect(x, y, 1.5, 1.5);
        var v = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, W * 0.8); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.42)'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
      }
    /* 23-screen-kit.js */
    function scrCard(ctx, x, y, w, h, o) {
        o = o || {}; var r = o.r || 14, g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, o.tint ? scrRgba(o.tint, 0.16) : 'rgba(255,255,255,.065)'); g.addColorStop(1, o.tint ? scrRgba(o.tint, 0.05) : 'rgba(255,255,255,.025)');
        ctx.fillStyle = g; roundRect(ctx, x, y, w, h, r); ctx.fill(); ctx.strokeStyle = o.tint ? scrRgba(o.tint, 0.45) : 'rgba(255,255,255,.1)'; ctx.lineWidth = 1.5; ctx.stroke();
        if (o.bar) { ctx.fillStyle = o.bar; roundRect(ctx, x + 7, y + 12, 4, h - 24, 2); ctx.fill(); }
      }
    /* 23-screen-kit.js */
    function scrStat(ctx, x, y, w, h, label, value, col) {
        scrCard(ctx, x, y, w, h, { r: Math.min(12, h / 4) }); var fs = Math.round(h * 0.4);
        ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = DESK_DIM; ctx.font = '600 ' + Math.round(h * 0.25) + 'px ' + DESK_FONT; ctx.fillText(deskTrim(ctx, label, w - 16), x + Math.round(h * 0.22), y + Math.round(h * 0.12));
        ctx.fillStyle = col || DESK_INK; ctx.font = '700 ' + fs + 'px ' + SCR_MONO; ctx.fillText(deskTrim(ctx, String(value), w - 16), x + Math.round(h * 0.22), y + Math.round(h * 0.46));
      }
    /* 23-screen-kit.js */
    function scrMeter(ctx, x, y, w, h, frac, col) {
        ctx.fillStyle = 'rgba(255,255,255,.08)'; roundRect(ctx, x, y, w, h, h / 2); ctx.fill(); var fw = Math.max(h, w * clamp(frac, 0, 1));
        var g = ctx.createLinearGradient(x, 0, x + fw, 0); g.addColorStop(0, scrRgba(col, 0.55)); g.addColorStop(1, col); ctx.fillStyle = g; roundRect(ctx, x, y, fw, h, h / 2); ctx.fill();
      }
    /* 23-screen-kit.js */
    function scrLcd(ctx, W, H, accent) {
        var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0c1511'); g.addColorStop(1, '#050907'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = scrRgba(accent, 0.08); for (var y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
        ctx.strokeStyle = scrRgba(accent, 0.45); ctx.lineWidth = 2; roundRect(ctx, 3, 3, W - 6, H - 6, 8); ctx.stroke(); ctx.textBaseline = 'top'; ctx.textAlign = 'left';
      }
    /* 23-screen-kit.js */
    function screenShell(g, pw, ph, o) {
        o = o || {}; var bz = o.bezel === undefined ? 0.02 : o.bezel, th = o.depth || 0.026, rim = o.rim === undefined ? 0.005 : o.rim, led = o.led === undefined ? 0x6fdc8c : o.led;
        var back = new THREE.Mesh(bevelGeo(pw + 2 * (bz + rim), ph + 2 * (bz + rim), th, Math.min(0.01, th * 0.42)), o.rimMat || MAT.alu); back.position.z = -th / 2 - 0.0035; back.castShadow = true; g.add(back);
        var bezel = new THREE.Mesh(bevelGeo(pw + 2 * bz, ph + 2 * bz, 0.008, 0.003), MAT.gloss); bezel.position.z = -0.0046; bezel.userData.noDefight = true; g.add(bezel);
        if (bz >= 0.012) {
          var cam = new THREE.Mesh(new THREE.CircleGeometry(Math.min(0.004, bz * 0.22), 10), colorMat(0x05070a, 0.15, 0.6)); cam.position.set(0, ph / 2 + bz / 2, 0.0002); g.add(cam);
          if (led) { var l = new THREE.Mesh(new THREE.CircleGeometry(Math.min(0.0035, bz * 0.18), 8), new THREE.MeshBasicMaterial({ color: led, toneMapped: false })); l.position.set(pw / 2 - 0.01, -ph / 2 - bz / 2, 0.0002); g.add(l); }
        }
        return { back: back, bezel: bezel };
      }
    /* 23-screen-kit.js */
    function litPlane(canvas, pw, ph) { var tex = new THREE.CanvasTexture(canvas); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 8; var m = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); m.userData.tex = tex; return m; }
    /* 24-screens.js */
    function drawRegister() { if (world.reg && world.reg.sc) tDraw(world.reg.sc); }
    /* 24-screens.js */
    function drawPcScreen() {
        var P = world.pcScr; if (!P) return; P.at = now(); var ctx = P.canvas.getContext('2d'), W = 960, H = 540; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        if (typeof powerOn === 'function' && !powerOn()) { ctx.fillStyle = '#020303'; ctx.fillRect(0, 0, W, H); P.mesh.userData.tex.needsUpdate = true; return; }
        var g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#12271f'); g.addColorStop(0.55, '#0a1712'); g.addColorStop(1, '#050b08'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        var r1 = ctx.createRadialGradient(W * 0.8, H * 1.1, 10, W * 0.8, H * 1.1, 560); r1.addColorStop(0, 'rgba(111,220,140,.34)'); r1.addColorStop(1, 'rgba(111,220,140,0)'); ctx.fillStyle = r1; ctx.fillRect(0, 0, W, H);
        var r2 = ctx.createRadialGradient(W * 0.1, -40, 10, W * 0.1, -40, 520); r2.addColorStop(0, 'rgba(124,196,255,.26)'); r2.addColorStop(1, 'rgba(124,196,255,0)'); ctx.fillStyle = r2; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = 'rgba(4,9,7,.62)'; ctx.fillRect(0, 0, W, 30); ctx.fillStyle = DESK_INK; ctx.font = '600 15px ' + DESK_FONT; ctx.textBaseline = 'middle'; ctx.fillText('🌿 Grow Co. OS', 14, 16);
        ctx.textAlign = 'right'; ctx.fillStyle = DESK_DIM; ctx.font = '600 15px ' + SCR_MONO; ctx.fillText(clockText() + ' · day ' + (S.day || 1), W - 14, 16); ctx.textAlign = 'left';
        var cols = ['#2f6d4a', '#7a6a2a', '#4a5560', '#2f5f8a', '#8a4a3a', '#5d4a8a'];
        pcApps().slice(0, 8).forEach(function (a, i) { var x = 26 + Math.floor(i / 4) * 96, y = 52 + (i % 4) * 104; var ig = ctx.createLinearGradient(x, y, x + 58, y + 58); ig.addColorStop(0, cols[i % 6]); ig.addColorStop(1, 'rgba(0,0,0,.55)'); ctx.fillStyle = cols[i % 6]; roundRect(ctx, x, y, 58, 58, 16); ctx.fill(); ctx.fillStyle = ig; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.textAlign = 'center'; ctx.font = '30px ' + SCR_EMOJI; ctx.fillStyle = '#fff'; ctx.fillText(a[1], x + 29, y + 31); ctx.font = '500 13px ' + DESK_FONT; ctx.fillStyle = DESK_INK; ctx.fillText(a[2], x + 29, y + 74); ctx.textAlign = 'left'; });
        // the open window: today's figures
        var wx = 250, wy = 56, ww = 680, wh = 400; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 16; ctx.fillStyle = '#0f1c16'; roundRect(ctx, wx, wy, ww, wh, 14); ctx.fill(); ctx.restore();
        ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = 1.5; roundRect(ctx, wx, wy, ww, wh, 14); ctx.stroke();
        ctx.fillStyle = 'rgba(0,0,0,.3)'; roundRect(ctx, wx, wy, ww, 38, 14); ctx.fill(); ctx.fillStyle = DESK_INK; ctx.font = '600 16px ' + DESK_FONT; ctx.fillText('📊 Dashboard', wx + 16, wy + 20);
        [DESK_BAD, DESK_WARN, DESK_OK].forEach(function (c2, i) { ctx.fillStyle = c2; ctx.beginPath(); ctx.arc(wx + ww - 22 - i * 20, wy + 19, 6, 0, Math.PI * 2); ctx.fill(); });
        ctx.textBaseline = 'top'; var X = xs(), st = [['Bank', money(S.bank), DESK_OK], ['Cash on site', money(cashOnSite()), DESK_INK], ['Rep', String(Math.floor(S.rep)), DESK_WARN], ['Market', (S.market || 1).toFixed(2) + '×', DESK_INK]], sw = (ww - 40 - 3 * 10) / 4;
        st.forEach(function (s, i) { scrStat(ctx, wx + 20 + i * (sw + 10), wy + 54, sw, 70, s[0], s[1], s[2]); });
        scrCard(ctx, wx + 20, wy + 138, 400, 244, { r: 12 }); ctx.fillStyle = DESK_DIM; ctx.font = '600 14px ' + DESK_FONT; ctx.fillText('On the shelf', wx + 36, wy + 150);
        var bars = [['Bags', S.pkg.bags.n, '#6fdc8c'], ['Joints', S.pkg.joints.n, '#f0b94d'], ['Cookies', S.pkg.cookies.n, '#7cc4ff'], ['Cured, g', Math.round(S.cured.g), '#c9a0ff']], mx = Math.max(10, bars[0][1], bars[1][1], bars[2][1], bars[3][1]);
        bars.forEach(function (b, i) { var by = wy + 186 + i * 47; ctx.fillStyle = DESK_INK; ctx.font = '15px ' + DESK_FONT; ctx.fillText(b[0], wx + 36, by); ctx.textAlign = 'right'; ctx.font = '700 15px ' + SCR_MONO; ctx.fillText(String(b[1]), wx + 404, by); ctx.textAlign = 'left'; scrMeter(ctx, wx + 36, by + 24, 368, 8, b[1] / mx, b[2]); });
        scrCard(ctx, wx + 434, wy + 138, 226, 244, { r: 12, tint: shop().open ? DESK_OK : DESK_BAD }); ctx.fillStyle = DESK_DIM; ctx.font = '600 14px ' + DESK_FONT; ctx.fillText('The shop', wx + 450, wy + 150);
        ctx.fillStyle = shop().open ? DESK_OK : DESK_BAD; ctx.font = '800 44px ' + DESK_FONT; ctx.fillText(shop().open ? 'Open' : 'Closed', wx + 450, wy + 174);
        ctx.fillStyle = DESK_INK; ctx.font = '15px ' + DESK_FONT; [['Level', String(S.level || 1)], ['Plants', String(S.plants.length)], ['Heat', Math.round(X.heat) + ' / 100'], ['Crew', String(crewList().length)]].forEach(function (l, i) { var ly = wy + 240 + i * 32; ctx.fillStyle = DESK_DIM; ctx.fillText(l[0], wx + 450, ly); ctx.textAlign = 'right'; ctx.fillStyle = DESK_INK; ctx.font = '700 15px ' + SCR_MONO; ctx.fillText(l[1], wx + 644, ly); ctx.textAlign = 'left'; ctx.font = '15px ' + DESK_FONT; });
        // the dock
        var dn = Math.min(pcApps().length, 10), dw = dn * 46 + 96, dx = (W - dw) / 2, dy = H - 62; ctx.fillStyle = 'rgba(4,9,7,.7)'; roundRect(ctx, dx, dy, dw, 50, 16); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 1.5; ctx.stroke();
        var sg = ctx.createLinearGradient(0, dy + 8, 0, dy + 42); sg.addColorStop(0, '#7fe79a'); sg.addColorStop(1, '#3fb865'); ctx.fillStyle = sg; roundRect(ctx, dx + 8, dy + 8, 80, 34, 10); ctx.fill(); ctx.fillStyle = '#04210f'; ctx.font = '700 15px ' + DESK_FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('Start', dx + 48, dy + 26);
        ctx.font = '24px ' + SCR_EMOJI; ctx.fillStyle = '#fff'; pcApps().slice(0, dn).forEach(function (a, i) { ctx.fillText(a[1], dx + 96 + i * 46 + 21, dy + 27); }); ctx.fillStyle = DESK_OK; ctx.fillRect(dx + 96 + 7 * 46 + 12, dy + 44, 18, 3);
        ctx.textAlign = 'left'; ctx.textBaseline = 'top'; P.mesh.userData.tex.needsUpdate = true;
      }
    /* 24-screens.js */
    var PC_APPS = [
        ['shop', '🛒', 'Supplies', function () { return paneShop(); }],
        ['seeds', '🌱', 'Seed bank', function () { return paneSeeds(); }],
        ['gear', '⚙️', 'Gear', function () { return paneUpgrades(); }],
        ['lic', '🪪', 'Licences', function () { return paneLicences(); }],
        ['staff', '🧑‍🔧', 'Staff', function () { return paneStaff(); }],
        ['bank', '🏦', 'Bank', function () { return paneBank(); }],
        ['jobs', '🚚', 'Deliveries', function () { return '<div class="g3-box">' + paneJobs(hasLic('tobacco') && tabletHere() ? 'tablet' : 'phone') + '</div>'; }],
        ['desk', '🖥️', typeof drawShopBoard === 'function' ? 'Live desk' : 'Dashboard', function () { return paneDesk(); }],
        ['diary', '📒', 'Diary', function () { return paneLog(); }],
        ['stats', '📊', 'Stats', function () { return paneStats(); }],
        ['settings', '⚙', 'Settings', function () { return '<div class="g3-box">' + growSettingsHtml() + '</div>'; }],
        ['guide', '📖', 'Guide', function () { return '<div class="g3-box g3-menu-body" style="margin:0;padding:12px 14px">' + guideHtml() + '</div>'; }],
        ['finance', '💰', 'Finance', function () { return paneFinance(); }, 'finance'],
        ['merch', '👕', 'Merch', function () { return paneMerch(); }, 'merch'],
        ['cup', '🏆', 'The Cup', function () { return paneCup(); }, 'cup'],
        ['breed', '🧬', 'Cultivars', function () { return paneBreed(); }, 'breeding'],
        ['upgrades', '⬆️', 'DLC upgrades', function () { return paneDlcUpg(); }]
      ];
    /* 24-screens.js */
    function pcApps() { return PC_APPS.filter(function (a) { return !a[4] || dlcOn(a[4]); }); }
    /* 24-screens.js */
    var wheel = { open: false, el: null, items: [] };
    /* 24-screens.js */
    function paneDesk() {
        var all = dashRows(); var h = '<div class="g3-box"><div class="g3-chips">' + DESK_PAGES.map(function (p, i) { return '<button class="g3-btn' + (i === deskBoard.page ? ' primary' : '') + '" data-act="deskPage" data-id="' + i + '">' + DESK_PAGE_LABEL[p] + '</button>'; }).join('') + '</div></div>';
        (all[DESK_PAGES[deskBoard.page]] || []).forEach(function (r) { h += '<div class="g3-row"><span class="ico">📊</span><span class="meta"><span class="n">' + esc(r[0]) + ' · ' + esc(r[1]) + '</span><span class="own">' + esc(r[2]) + '</span></span></div>'; });
        return h;
      }
    /* 25-shop-controls.js */
    function shop() { if (!S.shop) S.shop = { open: true, lights: true, radio: 'off', volume: 0.5, curtains: {}, staffDoor: false }; if (!S.shop.curtains) S.shop.curtains = {}; if (!S.shop.rooms) S.shop.rooms = {}; if (typeof S.shop.markup !== 'number') S.shop.markup = 1; if (typeof S.shop.volume !== 'number') S.shop.volume = 0.5; return S.shop; }
    /* 26-radio-dust-tv.js */
    function tone(type, freq, t, dur, gain, dest, attack) { var o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + (attack || 0.01)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05); }
    /* 26-radio-dust-tv.js */
    function binsFull() { var M = xs().mach || {}; return Object.keys(M).some(function (k) { return M[k] && typeof M[k] === 'object' && (M[k].trash || 0) >= 12; }); }
    /* 26-radio-dust-tv.js */
    function syncBroom() { var onWall = !(held() && held().kind === 'broom') && !crew.some(function (r) { return r.hasBroom; }); (world.broomMeshes || []).forEach(function (m) { m.visible = onWall; }); }
    /* 28-props.js */
    function unitCount(base) { var d = PROPS[base]; if (!d || !d.multi) return 1; var n = (S.units && S.units[base]) || 1; return clamp(Math.round(n), 1, d.multi.max); }
    /* 28-props.js */
    function machCost(base, n) { return Math.round(PROPS[base].multi.price * Math.pow(1.35, n - 2)); }
    /* 28-props.js */
    function upgById(id) { for (var i = 0; i < UPGRADES.length; i++) if (UPGRADES[i].id === id) return UPGRADES[i]; return { name: id }; }
    /* 28-props.js */
    function unitLock(base) { var m = PROPS[base].multi; if (m.lic && !hasLic(m.lic)) return licById(m.lic).name; if (m.upg && !S.upgrades[m.upg]) return upgById(m.upg).name; return null; }
    /* 28-props.js */
    function growPropPlacement(id) {
        var d = PROPS[id]; var o = (S.layout && S.layout[id]) || {}; var base = unitBase(id), L = (CO.layout && CO.layout().props[id]) || {};   /* the layout the editor shipped sits between the definition and the save */
        var owned = base === id || unitIds(base).indexOf(id) >= 0;   /* a unit you sold or reset away keeps its prop record but builds nothing */
        return { x: typeof o.x === 'number' ? o.x : (typeof L.x === 'number' ? L.x : d.x), z: typeof o.z === 'number' ? o.z : (typeof L.z === 'number' ? L.z : d.z), rot: typeof o.rot === 'number' ? o.rot : (typeof L.rot === 'number' ? L.rot : (d.rot || 0)), floor: d.floor || 0, unit: d.unit || 1, hidden: !!o.hidden || !owned || !dlcProp(id) };
      }
    /* 28-props.js */
    function growPropCtx(g, id, floorLevel) {
        var obs = [];
        var ctx = {
          box: function (w, h, d, mat, x, y, z, opts) { opts = opts || {}; var m = new THREE.Mesh(opts.sharp || bevelSkip(mat) ? new THREE.BoxGeometry(w, h, d) : bevelGeo(w, h, d, opts.r), mat); m.position.set(x, y, z); m.castShadow = opts.cast !== false; m.receiveShadow = opts.receive !== false; g.add(m); if (opts.solid) obs.push({ x1: x - w / 2, x2: x + w / 2, z1: z - d / 2, z2: z + d / 2 }); return m; },
          cyl: function (rt, rb, h, mat, x, y, z, seg) { var m = new THREE.Mesh(roundCylGeo(rt, rb, h, seg || 18), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; },
          add: function (m) { g.add(m); return m; },
          hit: function (w, h, d, x, y, z, data) { var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), MAT.none); m.position.set(x, y, z); g.add(m); if (data) data.propId = id;   /* the prompt has to know WHICH machine it is looking at, not just what kind */ interactable(m, data); m.userData.propId = id; return m; },
          sign: function (lines, w, h, x, y, z, rotY, opts) { opts = opts || {}; var tex = signTex(lines, Math.round(w * 320), Math.round(h * 320), Object.assign({ size: Math.round(h * 48) }, opts)); var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true })); m.position.set(x, y, z); m.rotation.y = rotY || 0; g.add(m); if (opts.bg === undefined && h >= 0.15) signBack(m, w, h); return m; },
          placard: function (lines, w, h, x, y, z, opts) {   /* a counter sign: a weighted foot, two slim posts, the plate between them */
            var by = y - h / 2 - 0.245; ctx.box(Math.min(w * 0.7, 0.34), 0.014, 0.09, MAT.gunmetal, x, by + 0.007, z - 0.01, { cast: false });
            [-1, 1].forEach(function (sd) { var st = new THREE.Mesh(roundCylGeo(0.006, 0.006, 0.25 + h * 0.5, 8), MAT.chrome); st.position.set(x + sd * Math.min(w * 0.3, 0.14), by + (0.25 + h * 0.5) / 2, z - 0.012); g.add(st); });
            return ctx.sign(lines, w, h, x, y, z, 0, opts); },
          solid: function (x1, x2, z1, z2) { obs.push({ x1: x1, x2: x2, z1: z1, z2: z2 }); },
          fern: function (x, z, s, y0) {   /* a fern in a glazed pot on a saucer: two rings of fronds, the outer ones lying lower */
            y0 = y0 || 0; var at = function (yy) { return y0 + yy * s; };
            ctx.cyl(0.2 * s, 0.205 * s, 0.025 * s, colorMat(0xd8d2c2, 0.4), x, at(0.0125), z, 28); ctx.cyl(0.2 * s, 0.15 * s, 0.36 * s, MAT.ceramic, x, at(0.2), z, 28); ctx.cyl(0.215 * s, 0.205 * s, 0.045 * s, MAT.ceramic, x, at(0.385), z, 28); ctx.cyl(0.185 * s, 0.185 * s, 0.012 * s, MAT.soil, x, at(0.402), z, 20);
            for (var i = 0; i < 17; i++) { var a = i * 2.399, ring = i % 3; leafAt(FROND_GEO, MAT.frond, x + Math.cos(a) * 0.04 * s, at(0.4), z + Math.sin(a) * 0.04 * s, Math.PI / 2 - a, 0.25 + ring * 0.38 + ((i * 7) % 5) * 0.03, s * (1.05 - ring * 0.12 + ((i * 3) % 4) * 0.04), g); }
            obs.push({ x1: x - 0.25, x2: x + 0.25, z1: z - 0.25, z2: z + 0.25 }); },
          lit: function (col, w, h, x, y, z, ry, rx) { var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: col, toneMapped: false })); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, 0); g.add(m); return m; },   /* a lit strip or a pilot light: shown in its own colour whatever the room is doing */
          group: g, obstacles: obs, floor: floorLevel, dyn: null
        };
        ctx.dynGroup = function () { if (!ctx.dyn) { ctx.dyn = new THREE.Group(); ctx.dyn.userData.dyn = true; g.add(ctx.dyn); } return ctx.dyn; };   /* what a sync() refills is never baked */
        return ctx;
      }
    /* 28-props.js */
    function growPropWorld(id, lx, lz) { var inst = propInst[id]; inst.g.updateMatrixWorld(true); var v = new THREE.Vector3(lx, 0, lz); inst.g.localToWorld(v); return v; }
    /* 29-prop-defs.js */
    function legs4(c, w, d, h, mat, inset, thick) { inset = inset || 0.06; thick = thick || 0.05; [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (l) { c.box(thick, h - 0.012, thick, mat, l[0] * (w / 2 - inset), h / 2 + 0.006, l[1] * (d / 2 - inset)); c.box(thick + 0.012, 0.012, thick + 0.012, MAT.soft, l[0] * (w / 2 - inset), 0.006, l[1] * (d / 2 - inset), { cast: false }); }); }
    /* 29-prop-defs.js */
    function drawer(c, w, h, d, x, y, z, mat) {
        c.box(w, h, d, mat || MAT.darkwood, x, y, z); var f = z + d / 2;
        c.box(w - 0.012, h - 0.012, 0.004, MAT.black, x, y, f + 0.001, { cast: false }); c.box(w - 0.026, h - 0.026, 0.016, MAT.wood, x, y, f + 0.008, { cast: false });
        var hw = Math.min(0.2, w * 0.45); [-1, 1].forEach(function (sd) { c.cyl(0.005, 0.005, 0.022, MAT.chrome, x + sd * hw * 0.42, y, f + 0.026, 8).rotation.x = Math.PI / 2; });
        c.cyl(0.006, 0.006, hw, MAT.chrome, x, y, f + 0.038, 10).rotation.z = Math.PI / 2;
      }
    /* 29-prop-defs.js */
    function chair(c, x, z, rotY, seatM, frameM) {
        var g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotY || 0; c.add(g);
        function m(geo, mat, px, py, pz) { var mm = new THREE.Mesh(geo, mat); mm.position.set(px, py, pz); mm.castShadow = true; g.add(mm); return mm; }
        m(bevelGeo(0.44, 0.05, 0.44), seatM, 0, 0.45, 0); m(bevelGeo(0.44, 0.06, 0.4), seatM, 0, 0.5, 0.01);
        var back = m(bevelGeo(0.42, 0.42, 0.04), seatM, 0, 0.74, -0.2); back.rotation.x = -0.08;
        [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]].forEach(function (l) { m(roundCylGeo(0.018, 0.018, 0.45, 8), frameM || MAT.chrome, l[0], 0.225, l[1]); });
        c.solid(x - 0.25, x + 0.25, z - 0.25, z + 0.25);
        return g;
      }
    /* 29-prop-defs.js */
    function officeChairBuild(c) {
        var seatM = fabricMat(0x24272c), meshM = fabricMat(0x15171a), shellM = MAT.soft;
        c.cyl(0.05, 0.06, 0.05, MAT.chrome, 0, 0.115, 0, 14); c.cyl(0.024, 0.024, 0.2, MAT.chrome, 0, 0.24, 0, 12); c.cyl(0.034, 0.034, 0.14, MAT.soft, 0, 0.37, 0, 12);
        for (var i = 0; i < 5; i++) { var a = i / 5 * Math.PI * 2; var arm = c.box(0.3, 0.026, 0.046, MAT.alu, Math.cos(a) * 0.16, 0.085, Math.sin(a) * 0.16); arm.rotation.y = -a; c.cyl(0.014, 0.014, 0.05, MAT.soft, Math.cos(a) * 0.3, 0.06, Math.sin(a) * 0.3, 8); var wh = c.cyl(0.03, 0.03, 0.04, MAT.black, Math.cos(a) * 0.3, 0.03, Math.sin(a) * 0.3, 12); wh.rotation.z = Math.PI / 2; wh.rotation.y = -a; }
        c.box(0.3, 0.04, 0.3, shellM, 0, 0.445, 0);                                                      /* the mechanism under the seat */
        c.box(0.5, 0.07, 0.5, seatM, 0, 0.5, -0.01, { r: 0.03 }); c.box(0.44, 0.03, 0.12, seatM, 0, 0.525, -0.2, { r: 0.012 });   /* the pad, with a waterfall front edge */
        c.box(0.05, 0.36, 0.03, shellM, 0, 0.64, 0.27).rotation.x = 0.16;                                /* the spine the back hangs on */
        var back = c.box(0.46, 0.56, 0.035, meshM, 0, 0.86, 0.275, { r: 0.016 }); back.rotation.x = 0.12;
        [-0.235, 0.235].forEach(function (x) { c.box(0.022, 0.58, 0.05, shellM, x, 0.86, 0.275).rotation.x = 0.12; });   /* the frame round the mesh */
        c.box(0.5, 0.024, 0.05, shellM, 0, 1.147, 0.31).rotation.x = 0.12; c.box(0.36, 0.07, 0.05, seatM, 0, 0.72, 0.245, { r: 0.02 }).rotation.x = 0.12;   /* top rail, lumbar pad */
        c.box(0.03, 0.12, 0.024, shellM, 0, 1.2, 0.325).rotation.x = 0.12; c.box(0.3, 0.13, 0.06, seatM, 0, 1.29, 0.33, { r: 0.025 }).rotation.x = 0.05;   /* headrest */
        [-0.29, 0.29].forEach(function (x) { c.box(0.03, 0.2, 0.04, shellM, x, 0.6, 0.02); c.box(0.03, 0.03, 0.14, shellM, x, 0.5, 0.05); c.box(0.07, 0.03, 0.27, seatM, x, 0.712, -0.02, { r: 0.012 }); });
        c.solid(-0.3, 0.3, -0.3, 0.3);
      }
    /* 29-prop-defs.js */
    function bookshelfBuild(c, w, h, rows) {
        // open carcass (sides, base, back) so the books on the shelves are actually visible; the old solid block hid them
        [-1, 1].forEach(function (sd) { c.box(0.06, h, 0.3, MAT.darkwood, sd * (w / 2 - 0.03), h / 2, 0); }); c.box(w, 0.08, 0.3, MAT.darkwood, 0, 0.04, 0); c.box(w, h, 0.05, MAT.darkwood, 0, h / 2, -0.125); c.box(w - 0.12, h - 0.12, 0.01, colorMat(0x2a1c10, 0.8), 0, h / 2, -0.097, { cast: false }); c.solid(-w / 2, w / 2, -0.15, 0.15);
        for (var r = 0; r < rows; r++) { var sy = 0.3 + r * ((h - 0.4) / rows); c.box(w - 0.06, 0.025, 0.28, MAT.wood, 0, sy, 0.01, { cast: false }); var bx = -w / 2 + 0.06; var lean = 0; while (bx < w / 2 - 0.12) { var bw = randf(0.035, 0.08), bh = randf(0.2, 0.32); var bk = c.box(bw, bh, randf(0.16, 0.22), colorMat(pick([0xc94a3a, 0x2f6b9a, 0x3aa36a, 0xe0c25a, 0x7a5aa8, 0xf2f2f2, 0x8a4a2a, 0x1c1c22]), 0.9), bx + bw / 2, sy + bh / 2 + 0.012, 0.03, { cast: false }); if (Math.random() < 0.15 && bx > -w / 2 + 0.2) { bk.rotation.z = 0.18; bk.position.x += 0.02; bx += 0.03; } bx += bw + 0.008; if (Math.random() < 0.12) bx += randf(0.05, 0.12); } if (r === rows - 1) { c.cyl(0.05, 0.04, 0.12, MAT.jar, w / 2 - 0.15, sy + 0.07, 0.05, 12); } }
        c.box(w, 0.06, 0.32, MAT.darkwood, 0, h - 0.03, 0.005);
      }
    /* 29-prop-defs.js */
    function sofaBuild(c, w, seatM, pipeM) {
        // upholstery is soft, so every cushion is a box with a generous radius: a plinth, seat pads, back pads that lean, rolled arms, turned feet
        var d = 0.85; c.box(w, 0.22, d, pipeM, 0, 0.2, 0, { solid: true, r: 0.03 }); c.box(w - 0.04, 0.04, d - 0.04, MAT.black, 0, 0.07, 0, { cast: false });
        var n = Math.max(1, Math.round(w / 0.62)); for (var i = 0; i < n; i++) { var cx = -w / 2 + 0.15 + (w - 0.3) * (i + 0.5) / n; var cw = (w - 0.3) / n - 0.012; c.box(cw, 0.17, d - 0.26, seatM, cx, 0.39, 0.09, { r: 0.05 }); c.box(cw, 0.44, 0.17, seatM, cx, 0.63, -0.3, { r: 0.06 }).rotation.x = -0.14; }
        c.box(w, 0.52, 0.13, pipeM, 0, 0.55, -0.39, { r: 0.04 }); [-1, 1].forEach(function (sd) { c.box(0.15, 0.36, d, seatM, sd * (w / 2 - 0.075), 0.5, 0, { r: 0.06 }); var roll = c.cyl(0.085, 0.085, d - 0.02, seatM, sd * (w / 2 - 0.075), 0.69, 0, 20); roll.rotation.x = Math.PI / 2; });
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (l) { c.cyl(0.028, 0.018, 0.09, MAT.darkwood, l[0] * (w / 2 - 0.1), 0.045, l[1] * (d / 2 - 0.1), 12); });
      }
    /* 29-prop-defs.js */
    function coffeeTableBuild(c, x, z, w, d) { c.box(w, 0.035, d, MAT.wood, x, 0.42, z, { solid: true }); c.box(w - 0.1, 0.02, d - 0.1, MAT.darkwood, x, 0.2, z, { cast: false }); legs4({ box: function (a, b, e, m, px, py, pz) { return c.box(a, b, e, m, px + x, py, pz + z); } }, w, d, 0.4, MAT.chrome, 0.06, 0.03); }
    /* 29-prop-defs.js */
    function crateBuild(c, x, y, z, s) {   // a slatted pine crate: corner posts, three boards a side with gaps you can see through, a lid of planks, rope handles
        s = s || 0.55; var hgt = s * 0.9, pine = MAT.wood, inner = colorMat(0x2a1c10, 0.9);
        c.box(s - 0.05, hgt - 0.04, s - 0.05, inner, x, y + hgt / 2, z, { cast: false });
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (p) { c.box(0.045, hgt, 0.045, pine, x + p[0] * (s / 2 - 0.0225), y + hgt / 2, z + p[1] * (s / 2 - 0.0225)); });
        for (var b = 0; b < 3; b++) { var by = y + hgt * (0.17 + b * 0.33); [-1, 1].forEach(function (d) { c.box(s, hgt * 0.27, 0.018, pine, x, by, z + d * (s / 2 - 0.004)); c.box(0.018, hgt * 0.27, s, pine, x + d * (s / 2 - 0.004), by, z); }); }
        for (var l = 0; l < 4; l++) c.box(s / 4 - 0.008, 0.018, s, pine, x - s / 2 + s / 8 + l * s / 4, y + hgt + 0.004, z, { cast: false });
        [-1, 1].forEach(function (d) { var h = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 6, 14, Math.PI), MAT.rope); h.position.set(x + d * (s / 2 + 0.004), y + hgt * 0.62, z); h.rotation.set(0, Math.PI / 2, Math.PI); c.add(h); });
      }
    /* 29-prop-defs.js */
    function lobbyBench(c) { for (var s = -0.7; s <= 0.7; s += 0.14) c.box(0.12, 0.05, 0.45, MAT.wood, s, 0.55, 0); c.box(1.6, 0.05, 0.45, MAT.none, 0, 0.55, 0, { solid: true, cast: false }); for (var b = 0; b < 3; b++) c.box(1.6, 0.09, 0.03, MAT.wood, 0, 0.72 + b * 0.12, -0.2 - b * 0.02); [-0.65, 0.65].forEach(function (x) { c.box(0.05, 0.55, 0.45, colorMat(0x2a2d33, 0.4, 0.6), x, 0.275, 0); c.box(0.05, 0.5, 0.05, colorMat(0x2a2d33, 0.4, 0.6), x, 0.8, -0.2); }); }
    /* 29-prop-defs.js */
    var ROPE_COLORS = { red: 0xc94a3a, navy: 0x2a3a6a, black: 0x1a1a1c, gold: 0xc9a44a, green: 0x2e7d4f }, ROPE_POSTS = { chrome: [0xd8dde2, 0.25, 0.95], brass: [0xb8913a, 0.35, 0.85], black: [0x1a1a1c, 0.4, 0.6] }, ROPE_LENS = [1.2, 1.8, 2.4, 3.0];
    /* 29-prop-defs.js */
    function ropeStyle(id) { if (!S.ropes) S.ropes = {}; var st = S.ropes[id] || {}; return { color: ROPE_COLORS[st.color] ? st.color : 'red', len: ROPE_LENS.indexOf(st.len) >= 0 ? st.len : 1.8, posts: ROPE_POSTS[st.posts] ? st.posts : 'chrome', kind: st.kind === 'belt' ? 'belt' : 'rope', open: !!st.open }; }
    /* 29-prop-defs.js */
    function ropeBuild(c) {   // two posts and a velvet rope (or a retractable belt) clipped between them, along local x; unhooked, it hangs down the far post
        var id = c.group.userData.propId, st = ropeStyle(id), hx = st.len / 2, pf = ROPE_POSTS[st.posts], postM = colorMat(pf[0], pf[1], pf[2]), bandM = new THREE.MeshStandardMaterial({ map: TEX.fabric, color: ROPE_COLORS[st.color], roughness: 1 });
        [-hx, hx].forEach(function (x) { c.cyl(0.025, 0.025, 0.95, postM, x, 0.475, 0, 12); c.cyl(0.16, 0.18, 0.03, postM, x, 0.015, 0, 20); var ball = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 10), postM); ball.position.set(x, 0.98, 0); ball.castShadow = true; c.add(ball); c.solid(x - 0.15, x + 0.15, -0.15, 0.15); });
        var piv = new THREE.Group(); piv.position.set(-hx, 0.93, 0); c.add(piv);
        if (st.kind === 'belt') { var belt = new THREE.Mesh(bevelGeo(st.len - 0.05, 0.05, 0.006), bandM); belt.position.set(hx, -0.03, 0); belt.castShadow = true; piv.add(belt); }
        else { var rope = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(hx, -0.12 * st.len, 0), new THREE.Vector3(st.len, 0, 0)), 20, 0.022, 8, false), bandM); rope.castShadow = true; piv.add(rope); }
        var clip = new THREE.Mesh(bevelGeo(0.05, 0.035, 0.03), postM); clip.position.set(st.len - 0.03, st.kind === 'belt' ? -0.03 : 0, 0); piv.add(clip);
        var G = ropeGate(id); G.pivot = piv; G.len = st.len; ropePose(G);
        c.hit(st.len + 0.3, 1.05, 0.35, 0, 0.52, 0, { kind: 'rope' });
      }
    /* 29-prop-defs.js */
    var ropeGates = {}, ropeSegList = [];
    /* 29-prop-defs.js */
    function ropeGate(id) { return ropeGates[id] || (ropeGates[id] = { open: 0, clip: false, want: false, waitT: 0, idleT: 0, pivot: null, len: 1.8 }); }
    /* 29-prop-defs.js */
    function ropePose(G) { if (!G.pivot) return; G.pivot.rotation.z = -G.open * Math.PI / 2; G.pivot.scale.x = 1 + (Math.min(1, 0.86 / G.len) - 1) * G.open; }
    /* 29-prop-defs.js */
    function warmStrip(c, w, x, y, z) { return c.box(w, 0.012, 0.02, emitMat(0xffe2b0, 1.2), x, y, z, { cast: false, sharp: true }); }
    /* 29-prop-defs.js */
    function lobbyBenchExtra(c) {
        var iron = colorMat(0x2a2d33, 0.4, 0.6);
        [-0.65, 0.65].forEach(function (x) { c.box(0.075, 0.032, 0.46, MAT.wood, x, 0.815, 0.0, { r: 0.012 }); c.box(0.05, 0.25, 0.05, iron, x, 0.675, 0.19); c.box(0.07, 0.02, 0.54, iron, x, 0.01, 0, { cast: false }); var sc = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 8, 18, Math.PI), iron); sc.position.set(x, 0.3, 0); sc.rotation.y = Math.PI / 2; c.add(sc); });
        c.box(1.26, 0.035, 0.035, iron, 0, 0.3, 0.0, { cast: false }); c.box(1.6, 0.05, 0.035, MAT.wood, 0, 1.06, -0.245, { r: 0.012 });
        for (var b = 0; b < 3; b++) [-0.5, 0, 0.5].forEach(function (x) { c.cyl(0.008, 0.008, 0.008, MAT.brass, x, 0.72 + b * 0.12, -0.182 - b * 0.02, 8).rotation.x = Math.PI / 2; });
      }
    /* 29-prop-defs.js */
    function bookshelfExtra(w, h) { return function (c) {
        c.box(w + 0.1, 0.05, 0.38, MAT.darkwood, 0, h + 0.025, 0.02, { r: 0.012 }); c.box(w + 0.05, 0.035, 0.35, MAT.darkwood, 0, h - 0.015, 0.012, { cast: false }); c.box(w + 0.04, 0.1, 0.02, MAT.darkwood, 0, 0.05, 0.16, { cast: false });
        [-1, 1].forEach(function (sd) { c.box(0.07, h - 0.1, 0.012, MAT.darkwood, sd * (w / 2 - 0.03), h / 2, 0.156, { cast: false }); });
        c.box(w - 0.14, 0.012, 0.02, emitMat(0xffe2b0, 1.0), 0, h - 0.075, 0.12, { cast: false, sharp: true });
        c.cyl(0.05, 0.04, 0.07, MAT.ceramic, -w / 2 + 0.2, h + 0.085, 0.02, 16); for (var i = 0; i < 7; i++) leafAt(LEAF_GEO_SM, MAT.bigleaf, -w / 2 + 0.2, h + 0.12, 0.02, i * 0.9, 0.5 + (i % 3) * 0.2, 0.26, c.group);
        c.box(0.2, 0.03, 0.14, colorMat(0x8a2a2a, 0.8), w / 2 - 0.25, h + 0.065, 0.02).rotation.y = 0.3; c.box(0.18, 0.025, 0.13, colorMat(0x2f6b9a, 0.8), w / 2 - 0.25, h + 0.093, 0.02).rotation.y = -0.1;
      }; }
    /* 30-edit-player-hands.js */
    function freeSlot() { if (!S.hotbar[S.slot]) return S.slot; for (var i = 0; i < 6; i++) if (!S.hotbar[i]) return i; return -1; }
    /* 31-models-machines.js */
    var PROD_M = {};
    /* 31-models-machines.js */
    function prodMat(key, make) { return PROD_M[key] || (PROD_M[key] = make()); }
    /* 31-models-machines.js */
    function productJoint(s) {   // a tapered cone of paper: card roach, twisted tail, scorched tip
        var G = new THREE.Group();
        var paperM = prodMat('paper', function () { return new THREE.MeshStandardMaterial({ color: 0xf7f3e6, roughness: 0.95 }); });
        var roachM = prodMat('roach', function () { return new THREE.MeshStandardMaterial({ color: 0xc19a63, roughness: 0.9 }); });
        var ashM = prodMat('ash', function () { return new THREE.MeshStandardMaterial({ color: 0x3a3330, roughness: 1 }); });
        var b = new THREE.Mesh(roundCylGeo(0.0074 * s, 0.005 * s, 0.084 * s, 8), paperM); b.position.y = 0.012 * s; G.add(b);
        var r = new THREE.Mesh(roundCylGeo(0.0051 * s, 0.0051 * s, 0.02 * s, 8), roachM); r.position.y = -0.04 * s; G.add(r);
        var t = new THREE.Mesh(new THREE.ConeGeometry(0.0074 * s, 0.017 * s, 8), paperM); t.position.y = 0.0625 * s; G.add(t);
        var a = new THREE.Mesh(roundCylGeo(0.0076 * s, 0.0076 * s, 0.004 * s, 8), ashM); a.position.y = 0.0535 * s; G.add(a);
        return G;
      }
    /* 31-models-machines.js */
    function productBaggie(st, s) {   // a zip-lock you can see the bud through, with the strain on the label
        var G = new THREE.Group();
        var filmM = prodMat('film', function () { return new THREE.MeshStandardMaterial({ color: 0xeef7f0, roughness: 0.12, transparent: true, opacity: 0.4 }); });
        var zipM = prodMat('zip', function () { return new THREE.MeshStandardMaterial({ color: 0xf7fbf8, roughness: 0.5 }); });
        var nugM = prodMat('nug' + st.id, function () { return new THREE.MeshStandardMaterial({ color: st.bud, roughness: 0.9 }); });
        G.add(new THREE.Mesh(bevelGeo(0.076 * s, 0.062 * s, 0.017 * s), filmM));
        for (var q = 0; q < 5; q++) { var n = new THREE.Mesh(new THREE.IcosahedronGeometry((0.0105 + (q % 3) * 0.0022) * s, 0), nugM); n.position.set((-0.021 + (q % 3) * 0.021) * s, (-0.014 + Math.floor(q / 3) * 0.015) * s, 0); n.scale.set(1, 0.85, 0.7); n.rotation.set(q, q * 1.4, 0.4); G.add(n); }
        var zip = new THREE.Mesh(bevelGeo(0.078 * s, 0.006 * s, 0.019 * s), zipM); zip.position.y = 0.027 * s; G.add(zip);
        var lip = new THREE.Mesh(bevelGeo(0.078 * s, 0.008 * s, 0.013 * s), filmM); lip.position.y = 0.035 * s; G.add(lip);
        var lab = new THREE.Mesh(new THREE.PlaneGeometry(0.056 * s, 0.019 * s), prodMat('lab' + st.id, function () { return new THREE.MeshBasicMaterial({ map: signTex([st.name], 260, 88, { size: 34, bg: '#f4efdf', color: '#2a2a2a', titleColor: '#2a2a2a', line: 'rgba(0,0,0,0)' }), transparent: true }); }));
        lab.position.set(0, 0.0125 * s, 0.0091 * s); G.add(lab);
        return G;
      }
    /* 31-models-machines.js */
    function productCigPack(K, s) {   // a hinge-lid pack: foil collar, lid seam, printed face and a health band
        if (K.shape === 'cigar') return productCigar(K, s); if (K.shape === 'jar') return productHoneyJar(K, s);
        var G = new THREE.Group(), big = K.size === 20;
        var w = (big ? 0.056 : 0.046) * s, ht = (big ? 0.088 : 0.074) * s, d = (big ? 0.023 : 0.019) * s;
        var bodyM = prodMat('cig' + K.name, function () { return new THREE.MeshStandardMaterial({ color: K.col, roughness: 0.55 }); });
        var lidM = prodMat('cigl' + K.name, function () { return new THREE.MeshStandardMaterial({ color: mixHex(K.col, 0x000000, 0.25), roughness: 0.55 }); });
        var foilM = prodMat('foil', function () { return new THREE.MeshStandardMaterial({ color: 0xd8dde2, roughness: 0.25, metalness: 0.8 }); });
        G.add(new THREE.Mesh(bevelGeo(w, ht * 0.72, d), bodyM));
        var lid = new THREE.Mesh(bevelGeo(w * 1.008, ht * 0.28, d * 1.008), lidM); lid.position.y = ht * 0.5; G.add(lid);
        var seam = new THREE.Mesh(bevelGeo(w * 1.012, 0.0015 * s, d * 1.012), foilM); seam.position.y = ht * 0.36; G.add(seam);
        var face = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, ht * 0.5), prodMat('cigf' + K.name, function () { return new THREE.MeshBasicMaterial({ map: signTex(['RF', K.type === 'light' ? 'LIGHT' : 'SMOKING', K.size + 's'], 200, 260, { size: 44, bg: '#' + ('000000' + K.col.toString(16)).slice(-6), color: '#' + ('000000' + K.top.toString(16)).slice(-6), titleColor: '#' + ('000000' + K.top.toString(16)).slice(-6), line: 'rgba(0,0,0,0)' }), transparent: true }); }));
        face.position.set(0, -ht * 0.03, d / 2 + 0.0004 * s); G.add(face);
        var band = new THREE.Mesh(bevelGeo(w * 0.94, ht * 0.16, 0.0008 * s), prodMat('cigb', function () { return new THREE.MeshStandardMaterial({ color: 0x14181b, roughness: 0.9 }); }));
        band.position.set(0, -ht * 0.27, d / 2 + 0.0006 * s); G.add(band);
        return G;
      }
    /* 31-models-machines.js */
    function productSoilSack(s) {   /* heat-sealed compost sack with a printed front */
        var G = new THREE.Group();
        var sackM = prodMat('sack', function () { return new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 1 }); });
        var foldM = prodMat('sackfold', function () { return new THREE.MeshStandardMaterial({ color: 0x3a291b, roughness: 1 }); });
        G.add(new THREE.Mesh(bevelGeo(0.15 * s, 0.17 * s, 0.095 * s), sackM));
        [1, -1].forEach(function (e) { var fo = new THREE.Mesh(bevelGeo(0.155 * s, 0.022 * s, 0.03 * s), foldM); fo.position.y = e * 0.093 * s; G.add(fo); });
        var fc = new THREE.Mesh(new THREE.PlaneGeometry(0.125 * s, 0.105 * s), prodMat('sacklab', function () { return new THREE.MeshBasicMaterial({ map: signTex(['GROW CO.', 'potting soil', '20 L'], 250, 210, { size: 40, bg: '#6d4f30', color: '#e9dcc2', titleColor: '#9ff0b5', line: 'rgba(0,0,0,0)' }), transparent: true }); }));
        fc.position.set(0, 0.006 * s, 0.0481 * s); G.add(fc); return G;
      }
    /* 31-models-machines.js */
    function productNutrientBottle(s) {   /* shoulder, neck, ribbed cap, wrapped label */
        var G = new THREE.Group();
        var botM = prodMat('nutbot', function () { return new THREE.MeshStandardMaterial({ color: 0xcdea55, roughness: 0.35, transparent: true, opacity: 0.94 }); });
        var capM = prodMat('nutcap', function () { return new THREE.MeshStandardMaterial({ color: 0x2a2f26, roughness: 0.6 }); });
        var b1 = new THREE.Mesh(roundCylGeo(0.029 * s, 0.031 * s, 0.105 * s, 14), botM); b1.position.y = -0.005 * s; G.add(b1);
        var sh = new THREE.Mesh(roundCylGeo(0.014 * s, 0.029 * s, 0.026 * s, 14), botM); sh.position.y = 0.061 * s; G.add(sh);
        var nk = new THREE.Mesh(roundCylGeo(0.013 * s, 0.013 * s, 0.016 * s, 12), capM); nk.position.y = 0.082 * s; G.add(nk);
        var cp = new THREE.Mesh(roundCylGeo(0.0155 * s, 0.0155 * s, 0.011 * s, 16), capM); cp.position.y = 0.094 * s; G.add(cp);
        var lb = new THREE.Mesh(new THREE.CylinderGeometry(0.0305 * s, 0.0305 * s, 0.05 * s, 16, 1, true), prodMat('nutlab', function () { return new THREE.MeshBasicMaterial({ map: signTex(['BLOOM', 'nutrients'], 300, 120, { size: 44, bg: '#1f3a14', color: '#cdea55', titleColor: '#ffffff', line: 'rgba(0,0,0,0)' }), transparent: true, side: THREE.DoubleSide }); }));
        lb.position.y = -0.006 * s; G.add(lb); return G;
      }
    /* 31-models-machines.js */
    function productSprayBottle(s) {   /* trigger sprayer with the fluid line showing through the tank */
        var G = new THREE.Group();
        var tankM = prodMat('spraytank', function () { return new THREE.MeshStandardMaterial({ color: 0xe8f2ee, roughness: 0.18, transparent: true, opacity: 0.55 }); });
        var fluidM = prodMat('sprayfluid', function () { return new THREE.MeshStandardMaterial({ color: 0x8fd6b0, roughness: 0.3, transparent: true, opacity: 0.85 }); });
        var headM = prodMat('sprayhead', function () { return new THREE.MeshStandardMaterial({ color: 0x2f3a36, roughness: 0.7 }); });
        var t1 = new THREE.Mesh(roundCylGeo(0.029 * s, 0.032 * s, 0.115 * s, 14), tankM); t1.position.y = -0.012 * s; G.add(t1);
        var fl = new THREE.Mesh(roundCylGeo(0.026 * s, 0.029 * s, 0.055 * s, 12), fluidM); fl.position.y = -0.04 * s; G.add(fl);
        var nk2 = new THREE.Mesh(roundCylGeo(0.016 * s, 0.016 * s, 0.02 * s, 12), headM); nk2.position.y = 0.055 * s; G.add(nk2);
        var hd = new THREE.Mesh(bevelGeo(0.03 * s, 0.036 * s, 0.048 * s), headM); hd.position.set(0, 0.082 * s, -0.012 * s); G.add(hd);
        var nz = new THREE.Mesh(bevelGeo(0.012 * s, 0.01 * s, 0.03 * s), headM); nz.position.set(0, 0.095 * s, -0.04 * s); G.add(nz);
        var tg = new THREE.Mesh(bevelGeo(0.016 * s, 0.026 * s, 0.008 * s), prodMat('spraytrig', function () { return new THREE.MeshStandardMaterial({ color: 0x59d08a, roughness: 0.6 }); })); tg.position.set(0, 0.068 * s, 0.016 * s); G.add(tg);
        var lb2 = new THREE.Mesh(new THREE.CylinderGeometry(0.0325 * s, 0.0325 * s, 0.05 * s, 16, 1, true), prodMat('spraylab', function () { return new THREE.MeshBasicMaterial({ map: signTex(['PEST OFF', 'ready to use'], 300, 120, { size: 40, bg: '#123a2a', color: '#bfeed6', titleColor: '#ffffff', line: 'rgba(0,0,0,0)' }), transparent: true, side: THREE.DoubleSide }); }));
        lb2.position.y = 0.006 * s; G.add(lb2); return G;
      }
    /* 31-models-machines.js */
    function productSeedPacket(st, s) {   /* foil sachet, heat-sealed top, tear notch, printed front */
        var G = new THREE.Group();
        var foilM = prodMat('seedfoil', function () { return new THREE.MeshStandardMaterial({ color: 0xc9cdd2, roughness: 0.3, metalness: 0.55 }); });
        var sealM = prodMat('seedseal', function () { return new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.5, metalness: 0.4 }); });
        G.add(new THREE.Mesh(bevelGeo(0.072 * s, 0.098 * s, 0.009 * s), foilM));
        var sl = new THREE.Mesh(bevelGeo(0.074 * s, 0.014 * s, 0.004 * s), sealM); sl.position.y = 0.054 * s; G.add(sl);
        var nt = new THREE.Mesh(bevelGeo(0.006 * s, 0.008 * s, 0.005 * s), sealM); nt.position.set(0.033 * s, 0.05 * s, 0); G.add(nt);
        var fa = new THREE.Mesh(new THREE.PlaneGeometry(0.064 * s, 0.086 * s), prodMat('seedlab' + st.id, function () { return new THREE.MeshBasicMaterial({ map: signTex([st.emoji, st.name, 'feminised'], 210, 285, { size: 30, bg: '#f4efdf', color: '#3a4a36', titleColor: '#1a6a2a', line: 'rgba(0,0,0,.18)' }), transparent: true }); }));
        fa.position.z = 0.0047 * s; G.add(fa); return G;
      }
    /* 31-models-machines.js */
    function cartonBox(w, h2, d, lines, hex, ink) {   /* a plain box with its front printed, for the small consumables */
        var G = new THREE.Group();
        G.add(new THREE.Mesh(bevelGeo(w, h2, d), new THREE.MeshStandardMaterial({ color: hex, roughness: 0.85 })));
        var key = 'carton' + lines.join('|');
        var face = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.86, h2 * 0.74), prodMat(key, function () { return new THREE.MeshBasicMaterial({ map: signTex(lines, 260, 150, { size: 46, bg: 'rgba(0,0,0,0)', color: ink, titleColor: ink, line: 'rgba(0,0,0,0)' }), transparent: true }); }));
        face.position.z = d / 2 + 0.001; G.add(face); return G;
      }
    /* 31-models-machines.js */
    function machState(id) {
        var X = xs(); if (!X.mach || typeof X.mach !== 'object') X.mach = {};
        if (!X.mach.perUnit) {   /* saves from before there could be two machines kept every machine's state in one object; split it out by prop */
          var o = X.mach; X.mach = { perUnit: true };
          X.mach.vending = { vendDoor: !!o.vendDoor, tray: Array.isArray(o.tray) ? o.tray : [] };
          X.mach.lobbyCoffee = { coffDoor: !!o.coffDoor, cup: o.cup || 0 };
          X.mach.fridge = { fridgeDoor: !!o.fridgeDoor, fridge: typeof o.fridge === 'number' ? o.fridge : 6 };   /* the fridge you start with comes stocked; any you buy later start empty */
        }
        if (!X.mach.own) {   /* saves from before 1.25 kept one coin box and one stock for every machine of a kind: both go to the first machine of the kind */
          X.mach.own = true; var ob = S.box || {}, first = function (b) { return X.mach[b] || (X.mach[b] = {}); };
          [['vending', ob.vend], ['lobbyCoffee', ob.coffee], ['arcade', ob.arcade]].forEach(function (p) { if (p[1] > 0) { var u = first(p[0]); u.box = (u.box || 0) + p[1]; } });
          first('vending').stock = Object.assign({}, S.vendStock || { drink: 12, snack: 12 });   /* a new shop's first machine comes stocked, as it always has */
          first('lobbyCoffee').stock = Object.assign({}, S.coffeeStock || { cup: 40, beans: 40 });
          delete S.box; delete S.vendStock; delete S.coffeeStock;
        }
        var m = X.mach[id || 'vending'] || (X.mach[id || 'vending'] = {});
        if (!Array.isArray(m.tray)) m.tray = [];
        if (typeof m.cup !== 'number') m.cup = 0;
        if (typeof m.fridge !== 'number') m.fridge = 0;
        if (!m.stock || typeof m.stock !== 'object') m.stock = {};
        return m;
      }
    /* 31-models-machines.js */
    function machStock(id) { return machState(id).stock; }
    /* 31-models-machines.js */
    function stockTotal(base, k) { return unitIds(base).reduce(function (a, u) { return a + (machStock(u)[k] || 0); }, 0); }
    /* 31-models-machines.js */
    function coinBox(id) { return machState(id).box || 0; }
    /* 31-models-machines.js */
    function coinTotal(base) { var t = 0; (base ? [base] : ['vending', 'lobbyCoffee', 'fridge', 'arcade']).forEach(function (b) { unitIds(b).forEach(function (u) { t += coinBox(u); }); }); return t; }
    /* 31-models-machines.js */
    function fridgeParts(id) {
        var inst = propInst[id || 'fridge']; if (!inst) return null; var p = inst.g.userData.frParts;
        if (!p || !p.door || !p.door.parent) { p = {}; inst.g.traverse(function (o) { if (o.userData.fridgeDoor) p.door = o; if (o.userData.fridgeShelves) p.shelves = o; }); inst.g.userData.frParts = p; }
        return p.door ? p : null;
      }
    /* 31-models-machines.js */
    function coffParts(id) {
        var inst = propInst[id || 'lobbyCoffee']; if (!inst) return null; var p = inst.g.userData.cfParts;
        if (!p || !p.cups || !p.cups.parent) { p = {}; inst.g.traverse(function (o) { if (o.userData.coffCups) p.cups = o; if (o.userData.coffBrew) p.brew = o; if (o.userData.coffLid) p.lid = o; if (o.userData.coffBeans) p.beans = o; if (o.userData.coffCupHit) p.cupHit = o; }); inst.g.userData.cfParts = p; }
        return p.cups ? p : null;
      }
    /* 31-models-machines.js */
    function cupMesh(s2, full) {   // a paper cup, with a lid and a sleeve once it is poured
        var G = new THREE.Group();
        var paper = prodMat('cuppaper', function () { return new THREE.MeshStandardMaterial({ color: 0xf7f7f2, roughness: 0.85 }); });
        G.add(new THREE.Mesh(roundCylGeo(0.035 * s2, 0.027 * s2, 0.095 * s2, 14), paper));
        if (full) {
          var lidM = prodMat('cuplid', function () { return new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.6 }); });
          var l = new THREE.Mesh(roundCylGeo(0.037 * s2, 0.037 * s2, 0.012 * s2, 14), lidM); l.position.y = 0.052 * s2; G.add(l);
          var sip = new THREE.Mesh(roundCylGeo(0.008 * s2, 0.008 * s2, 0.012 * s2, 8), lidM); sip.position.set(0.022 * s2, 0.06 * s2, 0); G.add(sip);
          var slv = new THREE.Mesh(new THREE.CylinderGeometry(0.0365 * s2, 0.031 * s2, 0.04 * s2, 14, 1, true), prodMat('cupslv', function () { return new THREE.MeshBasicMaterial({ map: signTex(['GROW CO.'], 300, 110, { size: 44, bg: '#6d4f30', color: '#f4e8d2', titleColor: '#f4e8d2', line: 'rgba(0,0,0,0)' }), transparent: true, side: THREE.DoubleSide }); }));
          slv.position.y = -0.006 * s2; G.add(slv);
        }
        return G;
      }
    /* 31-models-machines.js */
    function syncFridge(id) {
        if (!id) { unitIds('fridge').forEach(function (u) { syncFridge(u); }); return; }
        var p = fridgeParts(id); if (!p || !p.shelves) return;
        (p.shelves.userData.slots || []).forEach(function (m) { p.shelves.remove(m); });
        p.shelves.userData.slots = [];
        var n = Math.min(machState(id).fridge || 0, 16);
        for (var i = 0; i < n; i++) {
          var col = i % 4, row = Math.floor(i / 4);
          var d = drinkMesh(1); d.position.set(-0.24 + col * 0.16, 0.445 + row * 0.36, -0.02 + (i % 2) * 0.12);
          p.shelves.add(d); p.shelves.userData.slots.push(d);
        }
        p.shelves.traverse(function (o) { if (o.isMesh) { o.castShadow = false; o.userData.propId = id; } });
      }
    /* 31-models-machines.js */
    function syncCoffee(id) {
        if (!id) { unitIds('lobbyCoffee').forEach(function (u) { syncCoffee(u); }); return; }
        var p = coffParts(id); if (!p) return;
        (p.cups.userData.slots || []).forEach(function (m) { p.cups.remove(m); });
        p.cups.userData.slots = [];
        var st = machStock(id), stack = Math.min(Math.ceil((st.cup || 0) / 6), 7);
        for (var i = 0; i < stack; i++) { var cu = cupMesh(1, false); cu.position.y = i * 0.022; p.cups.add(cu); p.cups.userData.slots.push(cu); }
        if (p.beans) { var lvl = clamp((st.beans || 0) / 40, 0.05, 1); p.beans.scale.y = lvl; p.beans.position.y = 1.40 + 0.06 * lvl; p.beans.visible = (st.beans || 0) > 0; }
        dropKids(p.brew);
        if (machState(id).cup > 0) { var c2 = cupMesh(1, true); p.brew.add(c2); }
        if (p.cupHit) p.cupHit.position.y = machState(id).cup > 0 ? 1.02 : -50;
        p.cups.traverse(function (o) { if (o.isMesh) { o.castShadow = false; o.userData.propId = id; } });
        p.brew.traverse(function (o) { if (o.isMesh) { o.castShadow = false; o.userData.propId = id; } });
      }
    /* 31-models-machines.js */
    function vendParts(id) {
        var inst = propInst[id || 'vending']; if (!inst) return null;
        var p = inst.g.userData.vendParts;
        if (!p || !p.door || !p.door.parent) {
          p = {}; inst.g.traverse(function (o) {
            if (o.userData.vendDoor) p.door = o; if (o.userData.vendRacks) p.racks = o;
            if (o.userData.vendTray) p.tray = o; if (o.userData.vendFlap) p.flap = o; if (o.userData.vendDisp) p.disp = o;
          });
          inst.g.userData.vendParts = p;
        }
        return p.door ? p : null;
      }
    /* 31-models-machines.js */
    function drinkMesh(s2) {   // a can: tapered body, a printed wrap, a chamfered top and a ring pull
        var G = new THREE.Group();
        var canM = prodMat('canbody', function () { return new THREE.MeshStandardMaterial({ color: 0xd8dde2, roughness: 0.3, metalness: 0.75 }); });
        var b = new THREE.Mesh(roundCylGeo(0.031 * s2, 0.031 * s2, 0.1 * s2, 14), canM); G.add(b);
        var top = new THREE.Mesh(roundCylGeo(0.026 * s2, 0.031 * s2, 0.012 * s2, 14), canM); top.position.y = 0.056 * s2; G.add(top);
        var bot = new THREE.Mesh(roundCylGeo(0.031 * s2, 0.026 * s2, 0.012 * s2, 14), canM); bot.position.y = -0.056 * s2; G.add(bot);
        var wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.0315 * s2, 0.0315 * s2, 0.072 * s2, 16, 1, true), prodMat('canwrap', function () { return new THREE.MeshBasicMaterial({ map: signTex(['GROW', 'COLA'], 300, 170, { size: 60, bg: '#1d6fd6', color: '#ffffff', titleColor: '#ffd166', line: 'rgba(0,0,0,0)' }), transparent: true, side: THREE.DoubleSide }); }));
        G.add(wrap);
        var tab = new THREE.Mesh(new THREE.TorusGeometry(0.008 * s2, 0.0018 * s2, 4, 8), canM); tab.position.y = 0.063 * s2; tab.rotation.x = Math.PI / 2; G.add(tab);
        return G;
      }
    /* 31-models-machines.js */
    function snackMesh(s2) {   // a flow-wrapped bar, crimped at both ends
        var G = new THREE.Group();
        var wrapM = prodMat('snackwrap', function () { return new THREE.MeshStandardMaterial({ color: 0x6b2f8a, roughness: 0.45, metalness: 0.25 }); });
        G.add(new THREE.Mesh(bevelGeo(0.105 * s2, 0.018 * s2, 0.05 * s2), wrapM));
        [-1, 1].forEach(function (e) { var cr = new THREE.Mesh(bevelGeo(0.018 * s2, 0.011 * s2, 0.052 * s2), wrapM); cr.position.x = e * 0.06 * s2; G.add(cr); });
        var fa = new THREE.Mesh(new THREE.PlaneGeometry(0.086 * s2, 0.04 * s2), prodMat('snackface', function () { return new THREE.MeshBasicMaterial({ map: signTex(['GROW BAR'], 280, 120, { size: 52, bg: '#6b2f8a', color: '#ffd166', titleColor: '#ffd166', line: 'rgba(0,0,0,0)' }), transparent: true }); }));
        fa.position.z = 0.0255 * s2; G.add(fa);
        return G;
      }
    /* 31-models-machines.js */
    function syncVending(id) {   // the coils hold exactly what the machine is stocked with
        if (!id) { unitIds('vending').forEach(function (u) { syncVending(u); }); return; }
        var p = vendParts(id); if (!p || !p.racks) return;
        var racks = p.racks;
        (racks.userData.slots || []).forEach(function (m) { racks.remove(m); });
        racks.userData.slots = [];
        var st = machStock(id), drinks = Math.min(st.drink || 0, 8), snacks = Math.min(st.snack || 0, 8);
        for (var i = 0; i < drinks; i++) {
          var col = i % 4, row = Math.floor(i / 4);
          var d = drinkMesh(1); d.position.set(-0.225 + col * 0.15, 0.585 - row * 0.29, 0.02); racks.add(d); racks.userData.slots.push(d);
        }
        for (var j = 0; j < snacks; j++) {
          var c2 = j % 4, r2 = Math.floor(j / 4);
          var sn = snackMesh(1); sn.position.set(-0.225 + c2 * 0.15, -0.02 - r2 * 0.29, 0.02); sn.rotation.z = Math.PI / 2; racks.add(sn); racks.userData.slots.push(sn);
        }
        racks.traverse(function (o) { if (o.isMesh) { o.castShadow = false; o.userData.propId = id; } });
        syncTray(id);
      }
    /* 31-models-machines.js */
    function syncTray(id) {   // whatever has dropped sits in the delivery tray until you take it
        id = id || 'vending';
        var p = vendParts(id); if (!p || !p.tray) return;
        dropKids(p.tray);
        var M = machState(id);
        M.tray.slice(0, 4).forEach(function (it, i) {
          var m = it === 'drink' ? drinkMesh(1) : snackMesh(1);
          m.position.set(-0.16 + i * 0.11, 0.035, 0);
          if (it === 'drink') m.rotation.z = Math.PI / 2; else m.rotation.y = 0.3;
          p.tray.add(m);
        });
        p.tray.traverse(function (o) { if (o.isMesh) { o.castShadow = false; o.userData.propId = id; } });
        if (!p.trayHit) { var inst2 = propInst[id]; if (inst2) inst2.g.traverse(function (o) { if (o.userData.interact && o.userData.interact.kind === 'vendTray') p.trayHit = o; }); }
        if (p.trayHit) p.trayHit.position.y = M.tray.length ? 0.42 : -50;   /* an empty tray must not swallow the machine's prompt */
      }
    /* 31-models-machines.js */
    function take(item) { var i = freeSlot(); if (i < 0) { toast('Your hands are full. G puts something down, 1 to 6 picks a slot.', 'bad'); return false; } S.hotbar[i] = item; S.slot = i; sfx(item.kind === 'crate' ? 'crate' : 'pickup'); return true; }
    /* 31-models-machines.js */
    function starterCost() { var d = supplyDisc(); return Math.round(supplyById('soil').price * d) + Math.round(strainById('sunflower').seed * d) + Math.round(supplyById('nutrients').price * d); }
    /* 32-interaction.js */
    function dryMs() { return DRY_MS_BASE; }
    /* 32-interaction.js */
    function gameHour() { if (SET.dayNight === 'day') return 13; if (SET.dayNight === 'evening') return 19.2; if (SET.dayNight === 'night') return 1; if (SET.dayNight === 'cycle') return S.clock || 0; var d = new Date(); return d.getHours() + d.getMinutes() / 60; }
    /* 32-interaction.js */
    function clockText() { var h = gameHour(); var hh = Math.floor(h), mm = Math.floor((h - hh) * 60); return (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm; }
    /* 32-interaction.js */
    function dryFactor() { return clamp(1 + (55 - S.rh.dry) / 40, 0.5, 1.4); }
    /* 32-interaction.js */
    function moldMult() { var r = S.rh.grow; return r > 60 ? 1 + (r - 60) / 12 : r < 45 ? 0.6 : 1; }
    /* 32-interaction.js */
    function cureSlots() { return Math.max(2, S.supplies.jar || 0); }
    /* 34-processing-panes.js */
    function paneShop() {
        var h = '<div class="g3-grid"><div class="g3-box"><h3>🛒 Supplies</h3><div class="desc">Paid from the bank (' + money(S.bank) + '). Orders are boxed up and the supplier\'s van drops them in the back room a couple of minutes later. Carry crates from there to the supply rack or the machines.</div>' + (S.order ? '<div class="g3-chips"><span class="g3-chip amber">open order: ' + esc(orderSummary(S.order.items)) + '</span></div>' : '') + (S.deliveries.length ? '<div class="g3-chips">' + S.deliveries.map(function (d) { return '<span class="g3-chip">🚚 ' + esc(orderSummary(d.items)) + ' · ~' + Math.max(0, Math.ceil((d.due - now()) / 1000)) + ' s</span>'; }).join('') + '</div>' : '');
        SUPPLIES.forEach(function (it) { var own = it.tool ? (S.supplies[it.id] ? 'owned' : 'not yet') : (S.supplies[it.id] || 0); h += '<div class="g3-row"><span class="ico">' + it.ico + '</span><span class="meta"><span class="n">' + it.name + '</span><span class="own">' + (it.stock === 'vend' ? 'machines: ' + stockTotal('vending', it.id) : it.stock === 'coffee' ? 'machines: ' + stockTotal('lobbyCoffee', it.id) : 'rack: ' + own) + ((S.storage[it.id] || 0) ? ' · back room: ' + S.storage[it.id] : '') + ' · ' + it.hint + '</span></span><span class="price">' + money(Math.round(it.price * supplyDisc())) + '</span><button class="g3-btn" data-act="buy" data-id="' + it.id + '"' + (it.tool && S.supplies[it.id] ? ' disabled' : '') + '>Buy</button></div>'; });
        h += '</div><div class="g3-box"><h3>🌿 Grow room</h3><div class="desc">What you have on hand right now.</div><div class="g3-chips">' +
          chip('cash', money(S.bank)) + chip('soil', S.supplies.soil || 0) + chip('pots free', (S.supplies.pot || 0) - S.plants.length) + chip('nutrients', S.supplies.nutrients || 0) + chip('spray', S.supplies.remedy || 0) + chip('baggies', S.supplies.bag || 0) + chip('papers', S.supplies.paper || 0) + chip('tips', S.supplies.tip || 0) + chip('jars', S.supplies.jar || 0) + '</div>' +
          '<div class="desc">Seeds in stock:</div><div class="g3-chips">' + STRAINS.map(function (s) { return chip(s.emoji + ' ' + s.name, S.supplies['seed_' + s.id] || 0); }).join('') + '</div>' +
          '<div class="desc" style="margin-top:10px">Starter kit: soil + a pot per plant, a seed, then water till harvest. Cure it, grind it, bag or roll it, sell it at the window.</div>' +
          '<button class="g3-btn primary wide" data-act="starter">🧰 Buy starter bundle · ' + money(starterCost()) + ' <small>(soil + Sunflower Kush seed + nutrients)</small></button>' +
          '</div></div>';
        return h;
      }
    /* 34-processing-panes.js */
    function chip(k, v) { return '<span class="g3-chip">' + k + ' <b>' + v + '</b></span>'; }
    /* 34-processing-panes.js */
    function paneSeeds() {
        var h = '<div class="g3-box"><h3>🌱 Seed bank</h3><div class="desc">Higher strains unlock as you level up. Grow time is at windowsill speed; lamps make it faster.</div><div class="g3-strains">';
        STRAINS.forEach(function (s) { var locked = S.level < s.lvl; h += '<div class="g3-strain ' + (locked ? 'locked' : '') + '"><div class="top"><span class="emoji">' + s.emoji + '</span><span class="nm">' + s.name + '</span></div><div class="traits"><span>⏱ <b>' + daysText(s.growMs) + '</b></span><span>🌾 <b>' + s.yield + 'g</b></span><span>💪 <b>' + s.thc.toFixed(1) + '×</b></span></div><div class="traits"><span><i class="sw" style="background:#' + s.bud.toString(16).padStart(6, '0') + '"></i>bud</span><span>seeds: <b>' + (S.supplies['seed_' + s.id] || 0) + '</b></span></div>' + (locked ? '<div class="g3-tier">🔒 level ' + s.lvl + '</div>' : '<button class="g3-btn primary wide" data-act="buySeed" data-id="' + s.id + '">Buy seed · ' + money(Math.round(s.seed * supplyDisc())) + '</button>') + '</div>'; });
        return h + '</div></div>';
      }
    /* 34-processing-panes.js */
    function paneLicences() {
        var h = '<div class="g3-grid"><div class="g3-box"><h3>🪪 Licences & permits</h3><div class="desc">Paid from the bank (' + money(S.bank) + '). Some need a level or some rep first. Level ' + S.level + ' · rep ' + Math.floor(S.rep) + '.</div>';
        LICENCES.forEach(function (L) {
          if (L.dlc && !dlcOn(L.dlc)) return;   /* a DLC that is switched off: its licence isn't for sale */
          var own = hasLic(L.id); var why = !own && (L.req && !hasLic(L.req) ? 'needs ' + licById(L.req).name : L.lvl && S.level < L.lvl ? 'level ' + L.lvl : L.rep && S.rep < L.rep ? 'rep ' + L.rep : '');
          h += '<div class="g3-row"><span class="ico">' + L.ico + '</span><span class="meta"><span class="n">' + L.name + '</span><span class="own">' + (L.id === 'cult2' && !dlcOn('greenhouse') ? L.d.replace(' and the roof greenhouse beds', '') : L.d) + '</span></span>' + (own ? '<span class="g3-tier">✓ held</span>' : why ? '<span class="g3-tier">🔒 ' + why + '</span>' : '<button class="g3-btn primary" data-act="buyLic" data-id="' + L.id + '">' + money(L.price) + '</button>') + '</div>';
        });
        h += '</div><div class="g3-box"><h3>📋 What you can do</h3><div class="g3-chips">' + chip('card payments', hasLic('retail') ? 'yes' : 'cash only') + chip('connoisseurs', hasLic('premium') ? 'visit' : 'no') + chip('lounge', hasLic('lounge') ? 'open' : 'closed') + chip('machines', hasLic('catering') ? 'selling' : 'off') + chip('arcade', hasLic('amusement') ? 'on' : 'off') + chip('tent limit', TENTS.filter(function (t) { return !t.lic || hasLic(t.lic); }).reduce(function (m, t) { return Math.max(m, t.slots); }, 0) + ' slots') + chip('supply discount', Math.round((1 - supplyDisc()) * 100) + '%') + chip('export', hasLic('export') ? 'contracts open' : 'no') + '</div><div class="desc" style="margin-top:8px">Shops that were already trading when licensing arrived kept the retail, catering, amusement and lounge permits.</div></div></div>';
        return h;
      }
    /* 34-processing-panes.js */
    function paneUpgrades() {
        var L = lightObj(); var li = lightIdx(); var nextL = LIGHTS[li + 1]; var nextT = TENTS[S.tent + 1];
        var h = '<div class="g3-grid"><div class="g3-box"><h3>⚙️ Gear upgrades</h3><div class="desc">Every upgrade shows up in the room.</div>';
        h += '<div class="g3-row"><span class="ico">💡</span><span class="meta"><span class="n">Lighting</span><span class="own">Faster growth + higher quality. now: ' + L.name + '</span></span>' + (nextL ? '<button class="g3-btn primary" data-act="buyLight">' + nextL.name + ' · ' + money(nextL.price) + '</button>' : '<span class="g3-tier">maxed</span>') + '</div>';
        h += '<div class="g3-row"><span class="ico">⛺</span><span class="meta"><span class="n">Grow tent</span><span class="own">More plant slots. now: ' + slots() + ' slots</span></span>' + (nextT ? (nextT.lic && !hasLic(nextT.lic) ? '<span class="g3-tier">🔒 ' + nextT.slots + ' slots needs ' + licById(nextT.lic).name + '</span>' : '<button class="g3-btn primary" data-act="buyTent">' + nextT.slots + ' slots · ' + money(nextT.price) + '</button>') : '<span class="g3-tier">maxed</span>') + '</div>';
        UPGRADES.forEach(function (u) { var why = !S.upgrades[u.id] && (u.req && !S.upgrades[u.req] ? 'needs ' + (UPGRADES.filter(function (x) { return x.id === u.req; })[0] || { name: u.req }).name : u.lvl && S.level < u.lvl ? 'level ' + u.lvl : ''); h += '<div class="g3-row"><span class="ico">' + u.ico + '</span><span class="meta"><span class="n">' + u.name + '</span><span class="own">' + u.d + '</span></span>' + (S.upgrades[u.id] ? '<span class="g3-tier">✓ installed</span>' : why ? '<span class="g3-tier">🔒 ' + why + '</span>' : '<button class="g3-btn primary" data-act="buyUpg" data-id="' + u.id + '">' + money(u.price) + '</button>') + '</div>'; });
        h += '</div><div class="g3-box"><h3>🥤 Machines</h3><div class="desc">Buy another and it lands beside the one you have. Press <b>F2</b> to drag it anywhere you like. They share the shop\'s stock and float.</div>';
        ['vending', 'lobbyCoffee', 'arcade', 'fridge', 'queueRope'].forEach(function (base) {
          var d = PROPS[base]; if (!d || !d.multi) return;
          var have = unitCount(base), full = have >= d.multi.max, locked = unitLock(base);
          h += '<div class="g3-row"><span class="ico">' + d.multi.ico + '</span><span class="meta"><span class="n">' + (d.multi.name || d.label.replace(/^./, function (m2) { return m2.toUpperCase(); })) + '</span><span class="own">' + have + ' of ' + d.multi.max +
            (locked ? ' · needs the ' + locked : full ? ' · the shop is full' : '') + (base === 'fridge' ? ' · one stood in the lobby sells cold drinks to customers at $2 a can, with the catering permit' : '') + '</span></span>' +
            (full || locked ? '<span class="g3-tier">' + (full ? 'max' : '🔒') + '</span>' : '<button class="g3-btn primary" data-act="buyUnit" data-id="' + base + '">' + money(machCost(base, have + 1)) + '</button>') + '</div>';
        });
        var rDown = unitIds('queueRope').filter(function (u) { return growPropPlacement(u).hidden; }).length; if (rDown) h += '<div class="g3-row"><span class="ico">🪢</span><span class="meta"><span class="n">Rope lines taken down</span><span class="own">' + rDown + ' in the back, free to put up again where they stood</span></span><button class="g3-btn" data-act="ropeUp">Put one back up</button></div>';
        h += '</div><div class="g3-box"><h3>📈 Business</h3><div class="g3-chips">' + chip('market', S.market.toFixed(2) + '×') + chip('rep', Math.floor(S.rep)) + chip('price mult', '×' + repMult().toFixed(2)) + chip('level', S.level) + '</div><div class="desc">Rep adds up to 10% to a price and brings people through the door. Connoisseurs (🎩) pay 2.2× for quality 70+.</div>' + paneStatsInner() + '</div></div>';
        return h;
      }
    /* 34-processing-panes.js */
    function moneyRows() {
        return '<div class="g3-chips">' + chip('bank', money(S.bank)) + chip('vault', money(S.vault)) + chip('pocket', money(S.pocket)) + '</div><div class="g3-chips">' + chip('till', money(S.till)) + chip('vending', money(coinTotal('vending'))) + chip('fridges', money(coinTotal('fridge'))) + chip('coffee', money(coinTotal('lobbyCoffee'))) + chip('arcade', money(coinTotal('arcade'))) + chip('tip jar', money(S.tips)) + '</div>';
      }
    /* 34-processing-panes.js */
    function paneLedger() {
        var B = books(), rows = billLines(), L = B.lastBill, daily = dailyFixed();
        function row(ico, n, own) { return '<div class="g3-row"><span class="ico">' + ico + '</span><span class="meta"><span class="n">' + n + '</span><span class="own">' + own + '</span></span></div>'; }
        var h = '<h3>Profit &amp; loss</h3><div class="desc">The bills fall every morning whether or not there is anything ready to sell. Tax is settled on the first of each month.</div>';
        h += rows.map(function (r) { return row('−', r.k + ' ' + money(r.v), esc(r.d)); }).join('');
        h += row('=', money(daily) + ' a day', 'what the business costs to stand still');
        h += row('$', money(B.dayGross) + ' taken today', money(B.monthGross) + ' so far this month');
        h += row('−', money(B.dayOther) + ' spent on the crop today', 'trimming, testing and compliance at $' + COST.processPerGram.toFixed(2) + ' a gram, ' + money(B.monthOther) + ' this month');
        h += row('%', money(taxDue()) + ' tax owed', Math.round(ECON.excise * 100) + '% excise sits inside every sale, plus ' + Math.round(ECON.taxRate * 100) + '% on the month, and ' + Math.round(ECON.taxHighRate * 100) + '% on what the month takes over ' + money(ECON.taxHighFrom) + '. Due on day ' + taxDay() + '.');
        if (B.arrears > 0.5) h += row('!', money(B.arrears) + ' in arrears', 'unpaid bills, paid down by instalment on each morning the bills clear. Rep falls on any morning they cannot be paid');
        if (L && L.short > 0.5) h += '<div class="desc">Day ' + L.day + ': ' + money(L.short) + ' of that morning\'s bill went unpaid.</div>';
        return h;
      }
    /* 34-processing-panes.js */
    function paneBank() {
        var h = '<div class="g3-grid"><div class="g3-box"><h3>🏦 Bank · ' + money(S.bank) + '</h3><div class="desc">Online orders and upgrades are paid from the bank. Card sales land here straight away. Cash has to be collected: book a courier, meet them at the back door with the money in your pocket, and it clears the next morning.</div>' + moneyRows();
        h += '<div class="desc" style="margin-top:10px">Book a cash pickup</div><div class="g3-chips">' + [100, 500, 1000, 2500, 5000, 10000, 25000, 50000].map(function (a) { return '<button class="g3-btn' + (a <= S.vault + S.pocket ? ' primary' : '') + '" data-act="courierCall" data-id="' + a + '"' + (S.courier ? ' disabled' : '') + '>' + money(a) + '</button>'; }).join('') + '<button class="g3-btn" data-act="courierCall" data-id="all"' + (S.courier || S.vault + S.pocket < 50 ? ' disabled' : '') + '>all cash on hand · ' + money(S.vault + S.pocket) + '</button></div>';
        if (S.courier) h += '<div class="desc" style="margin-top:8px">Courier booked for <b>' + money(S.courier.amount) + '</b> · ' + (S.courier.state === 'called' ? 'arriving at the back gate shortly' : 'waiting in the back room now') + '</div>';
        if (hasLic('export')) { h += '<div class="desc" style="margin-top:10px">Bulk contracts (70% of gram value, paid tomorrow)</div>'; var anyX = false; STRAINS.forEach(function (st) { var sg = stashOf(st.id).g; if (sg < 20) return; anyX = true; var q = stashOf(st.id).qSum / sg, thc = stashOf(st.id).thcSum / sg; h += '<div class="g3-row"><span class="ico">' + st.emoji + '</span><span class="meta"><span class="n">' + st.name + ' · ' + gram(sg) + ' in the stash</span><span class="own">' + money(gramValue(q, thc) * 0.7) + ' per gram</span></span></div><div class="g3-chips">' + [20, 50, 100].filter(function (n) { return n <= sg; }).map(function (n) { return '<button class="g3-btn" data-act="exportSell" data-id="' + st.id + ':' + n + '">sell ' + n + ' g · ' + money(gramValue(q, thc) * 0.7 * n) + '</button>'; }).join('') + '</div>'; }); if (!anyX) h += '<div class="g3-empty">no strain has 20 g cured yet</div>'; }
        h += '</div><div class="g3-box">' + paneLedger() + '<h3 style="margin-top:12px">📒 In transit</h3>' + (S.pending.length ? S.pending.map(function (p) { return '<div class="g3-row"><span class="ico">🚚</span><span class="meta"><span class="n">' + money(p.amount) + '</span><span class="own">clears ' + (SET.dayNight === 'cycle' ? 'on day ' + p.dueDay : 'tomorrow') + '</span></span></div>'; }).join('') : '<div class="g3-empty">nothing in transit</div>');
        h += '<h3 style="margin-top:12px">🚚 Deliveries</h3>' + (S.order ? '<div class="g3-row"><span class="ico">🛒</span><span class="meta"><span class="n">Open order</span><span class="own">' + esc(orderSummary(S.order.items)) + ' · dispatches in a moment</span></span></div>' : '') + (S.deliveries.length ? S.deliveries.map(function (d) { return '<div class="g3-row"><span class="ico">🚚</span><span class="meta"><span class="n">' + esc(orderSummary(d.items)) + '</span><span class="own">van arrives in ~' + Math.max(0, Math.ceil((d.due - now()) / 1000)) + ' s at the back door</span></span></div>'; }).join('') : (S.order ? '' : '<div class="g3-empty">no deliveries on the road</div>')) + '</div></div>';
        return h;
      }
    /* 34-processing-panes.js */
    function paneStaff() {
        var st = S.staff, list = crewList();
        var h = '<div class="g3-grid"><div class="g3-box"><h3>🧑‍🔧 Shop floor · ' + list.length + ' of ' + CREW_MAX + '</h3>';
        h += '<div class="desc">Your crew serve the window, restock the supply rack and the machines, sweep and tend the plants. Each one takes ' + money(WORKER_WAGE) + ' a day at the morning bill (the bank first, then the vault, then the till), and walks if it isn\'t there. Give orders with <b>Shift+E</b> on them, or from here.</div>';
        if (!list.length) h += '<div class="g3-empty">Nobody on the floor but you.</div>';
        list.forEach(function (c, i) {
          h += '<div class="g3-row"><span class="ico">' + (c.off ? '🏠' : '🧑‍🔧') + '</span><span class="meta"><span class="n">' + crewName(i) + '</span><span class="own">' + (c.off ? 'at home · no wage while they are off' : workerTaskLabel(i) + (c.post ? ' · posted at ' + c.post.x.toFixed(0) + ', ' + c.post.z.toFixed(0) : '') + ' · ' + money(WORKER_WAGE) + ' a day') + '</span></span><button class="g3-btn' + (c.off ? ' primary' : '') + '" data-act="crewShift" data-id="' + i + '">' + (c.off ? '📞 Call in' : '🏠 Send home') + '</button><button class="g3-btn" data-act="fire" data-id="' + i + '">Let go</button></div>';
          if (!c.off) h += '<div class="g3-chips">' + WORKER_TASKS.map(function (t) { return '<button class="g3-btn' + (c.task === t[0] ? ' primary' : '') + '" data-act="workerTask" data-id="' + i + '|' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>';
        });
        if (list.length < CREW_MAX) h += '<button class="g3-btn primary wide" data-act="hire">🤝 Hire ' + CREW_LOOK[Math.min(list.length, CREW_LOOK.length - 1)].name + ' · ' + money(crewHireCost()) + ' now + ' + money(WORKER_WAGE) + ' a day</button>';
        else h += '<div class="desc">That\'s as many as the shop floor will take.</div>';
        h += '</div><div class="g3-box"><h3>🛡️ The guard · ' + (guardOff() ? 'off shift' : 'on the door') + '</h3>' +
          '<button class="g3-btn wide' + (guardOff() ? ' primary' : '') + '" data-act="guardShift">' + (guardOff() ? '📞 Call the guard in' : '🏠 Send the guard home') + '</button>' +
          '<div class="desc">The guard checks IDs at the door by default. Send him on a patrol to keep robbers away and break up fights faster, or give him a chore. He always comes back to the door when someone walks in. <b>Shift+E</b> on him works too. He draws ' + money(COST.guardWage) + ' a day on the morning bill while he\'s on shift. He and the crew carry a key to every door you leave marked staff key on the control box, and lock it again behind them.</div><div class="g3-chips">' + GUARD_TASKS.map(function (t) { return '<button class="g3-btn' + (st.guardTask === t[0] ? ' primary' : '') + '" data-act="guardTask" data-id="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div></div></div>';
        return h;
      }
    /* 34-processing-panes.js */
    function paneLog() { return '<div class="g3-box"><h3>📜 Grow diary</h3>' + paneLogInner(60) + '</div>'; }
    /* 34-processing-panes.js */
    function paneLogInner(n) { if (!S.log.length) return '<div class="g3-empty">Your grow diary will fill up here.</div>'; return '<div class="g3-log">' + S.log.slice(0, n).map(function (e) { return '<div class="' + e.kind + '"><span class="t">' + e.t + '</span>' + e.msg + '</div>'; }).join('') + '</div>'; }
    /* 34-processing-panes.js */
    function paneStats() { return '<div class="g3-box"><h3>📊 Lifetime stats</h3>' + paneStatsInner() + '</div>'; }
    /* 34-processing-panes.js */
    function paneStatsInner() { var days = Math.max(1, Math.floor((now() - (S.created || now())) / 86400000) + 1); return '<div class="g3-chips">' + chip('planted', S.stats.plants) + chip('harvested', gram(S.stats.harvested)) + chip('units sold', S.stats.sold) + chip('earned', money(S.stats.earned)) + chip('day', days) + chip('level', S.level) + chip('rep', Math.floor(S.rep)) + '</div>'; }
    /* 34-processing-panes.js */
    function growSettingsHtml() {
        return '<h4>Settings</h4><div id="g3-settings">' +
          slider('Field of view', 'fov', 60, 110, 1, SET.fov, '°') +
          slider('Mouse sensitivity', 'sens', 0.3, 2.5, 0.1, SET.sens, '×') +
          check('Invert mouse Y', 'invertY', SET.invertY) +
          check('Head bob', 'headBob', SET.headBob) +
          check('Sound effects', 'sound', SET.sound) +
          check('Show FPS', 'fps', SET.fps) +
          select('Graphics quality', 'quality', [['high', 'High (shadows, full res)'], ['medium', 'Medium (soft shadows off)'], ['low', 'Low (no shadows, half res)']], SET.quality) +
          select('Time of day', 'dayNight', [['cycle', 'Day/night cycle'], ['clock', 'Follow the real clock'], ['day', 'Always day'], ['evening', 'Golden hour'], ['night', 'Always night']], SET.dayNight) +
          select('Day length', 'dayLength', [['10', '10 real minutes'], ['20', '20 real minutes'], ['40', '40 real minutes'], ['60', '1 real hour']], SET.dayLength) +
          '</div><p style="margin-top:8px">Settings apply live and are remembered.</p>';
      }
    /* 34-processing-panes.js */
    function slider(label, key, min, max, step, val, unit) { return '<div class="g3-slider"><label>' + label + '</label><input type="range" data-set="' + key + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '"><small>' + val + unit + '</small></div>'; }
    /* 34-processing-panes.js */
    function check(label, key, val) { return '<div class="g3-slider"><label>' + label + '</label><input type="checkbox" data-set="' + key + '"' + (val ? ' checked' : '') + '></div>'; }
    /* 34-processing-panes.js */
    function select(label, key, opts, val) { return '<div class="g3-slider"><label>' + label + '</label><select data-set="' + key + '">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === val ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>'; }
    /* 34-processing-panes.js */
    function guideHtml() {
        if (window.RF_GUIDE) return window.RF_GUIDE.map(function (c) { return '<h4>' + c.icon + ' ' + c.title + '</h4>' + c.html; }).join('');   /* standalone: the full guide, same text as the main menu */
        return '<h4>Your hands do the work</h4><p>Everything is carried. <b>E</b> picks a thing up, or uses what you\'re holding on what you look at. <b>G</b> puts it back. One thing at a time.</p>' +
          '<h4>The loop</h4><p>The <b>office PC</b> in the office: order soil and baggies under Supplies, a seed in the Seed bank, and a grinder. Orders land on the <b>supply rack</b> next to it, or as crates in the back room. Take a bag of soil to the <b>tent</b>, fill a pot, fetch a seed and plant it. Grab the <b>watering can</b> by the tent when a plant says it\'s thirsty, feed it <b>nutrients</b> once for quality, and <b>spray</b> pests or mould fast.</p>' +
          '<h4>Harvest</h4><p>A plant that\'s ready glows. Harvest it with empty hands, carry the bunch to the <b>drying line</b> in the dry room and hang it. Dry batches go to the <b>curing shelf</b> in jars and keep gaining quality. Take a jar to the <b>workbench</b>, empty it into your stash, then bag, roll or bake there. Finished goods go on the <b>goods shelf</b>.</p>' +
          '<h4>Money</h4><p>Customers come to <b>the window</b>. Take what they want off the goods shelf and hand it over. They pay when the order is complete, and you take the money at the <b>till</b>. Connoisseurs (🎩) pay 2.2× for quality 70+. Goods rung up at the till as a walk-up sale fetch 85% of the board price, 12 a day.</p>' +
          '<h4>Build mode</h4><p>Press <b>F2</b> (or Build mode in this menu) to rearrange the place: look at any piece of furniture, a sign or a screen, <b>E</b> grabs it, carry it to a spot, <b>R</b> turns it, <b>E</b> drops it, <b>Backspace</b> puts it back where it came from and <b>Del</b> removes it. <b>C</b> opens the catalogue: furniture to buy and shapes to build your own, which take <b>[ ]</b> to scale, <b>P</b> to paint and <b>X</b> to copy. Your layout is saved.</p>' +
          '<h4>Upstairs</h4><p>The stairs in the office lead to your <b>flat</b>: a kitchen (fridge snacks, eat at the table), a couch and a <b>big TV</b> (E cycles: shop dashboard, grow cam, house news), and a bed. Eating gives you a speed boost for 10 min.</p>' +
          '<h4>The shop</h4><p>The <b>control box</b> in the security room opens or closes the shop, runs the lights and picks a radio station. The <b>front panel</b> behind the till and the <b>office panel</b> do part of the same job where you stand. <b>Curtains</b> on every window and the door open with E. The <b>staff door</b> opens with E and shuts itself 4 s after people are through. Dust settles on the floors, and the <b>broom</b> hangs in the processing room.</p>' +
          '<h4>Keys</h4><p><b>WASD</b> move · <b>Shift</b> run · <b>Space</b> jump · <b>Ctrl</b> crouch · <b>E</b> or click: pick up, use, talk · <b>Shift+E</b> the second action · <b>Ctrl+E</b> sends a crew member home · <b>G</b> put back · <b>I</b> inventory · <b>Tab</b> quick wheel · <b>F</b> phone · <b>Esc</b> pause</p>';
      }
    /* 35-dlc-kit.js */
    var DLCX = { list: [], kinds: {} };
    /* 35-dlc-kit.js */
    function dlcState(id, defaults) {
        if (!S.dlc || typeof S.dlc !== 'object' || Array.isArray(S.dlc)) S.dlc = {}; var st = S.dlc[id]; if (!st || typeof st !== 'object') st = S.dlc[id] = {};
        for (var k in defaults) if (st[k] === undefined || st[k] === null && defaults[k] !== null && typeof defaults[k] === 'object') st[k] = JSON.parse(JSON.stringify(defaults[k]));
        return st;
      }
    /* 35-dlc-kit.js */
    function dlcEach(fn, a, b) { DLCX.list.forEach(function (o) { if (o[fn] && dlcOn(o.id)) { try { o[fn](a, b); } catch (e) { console.error('[dlc ' + o.id + '] ' + fn, e); } } }); }
    /* 35-dlc-kit.js */
    function dlcStep(dt, offline) { dlcEach('tick', dt, offline); }
    /* 35-dlc-kit.js */
    function dlcNewDay(offline) { dlcEach('newDay', offline); }
    /* 35-dlc-kit.js */
    function strainsWithSeed(n) { return STRAINS.filter(function (st) { return (S.supplies['seed_' + st.id] || 0) >= (n || 1); }); }
    /* 35-dlc-kit.js */
    function minsLeft(sec) { sec = Math.max(0, Math.ceil(sec)); return sec >= 90 ? Math.round(sec / 60) + ' min' : sec + ' s'; }
    /* 35-dlc-kit.js */
    function barHtml(frac, cls) { return '<div class="g3-bar' + (cls ? ' ' + cls : '') + '"><span style="width:' + Math.round(clamp(frac, 0, 1) * 100) + '%"></span></div>'; }
    /* 35-dlc-kit.js */
    function notFitted(c, w, d, lines, kind) {
        var tape = colorMat(0xe3b52c, 0.7); c.box(w, 0.006, 0.05, tape, 0, 0.006, d / 2, { cast: false, sharp: true }); c.box(w, 0.006, 0.05, tape, 0, 0.006, -d / 2, { cast: false, sharp: true }); c.box(0.05, 0.006, d, tape, -w / 2, 0.006, 0, { cast: false, sharp: true }); c.box(0.05, 0.006, d, tape, w / 2, 0.006, 0, { cast: false, sharp: true });
        c.cyl(0.12, 0.14, 0.03, MAT.gunmetal, 0, 0.015, 0, 20); c.cyl(0.012, 0.012, 1.25, MAT.alu, 0, 0.64, 0, 10); c.sign(lines, 0.7, 0.3, 0, 1.4, 0.012, 0, { titleColor: '#f0b94d' });
        c.hit(w, 1.7, d, 0, 0.85, 0, { kind: kind });
      }
    /* 35-dlc-kit.js */
    function plantFigure(st) {
        var g = new THREE.Group(), stemM = MAT.stem.clone(), leafM = MAT.leaf.clone(), budM = MAT.bud.clone(); stemM.color.setHex(st.leaf).lerp(new THREE.Color(0x6a5a3a), 0.35); leafM.color.setHex(st.leaf); budM.color.setHex(st.bud);
        var stem = new THREE.Mesh(roundCylGeo(0.008, 0.018, 1, 8), stemM); stem.castShadow = true; g.add(stem);
        var nodes = [], buds = [];
        for (var i = 0; i < 6; i++) { var n = new THREE.Group(); n.rotation.y = i * 2.4; [0, Math.PI].forEach(function (sd) { var hld = new THREE.Group(); hld.rotation.y = sd; var lf = new THREE.Mesh(LEAF_GEO, leafM); lf.rotation.x = -1.05; lf.castShadow = true; hld.add(lf); n.add(hld); }); g.add(n); nodes.push(n); }
        for (var b = 0; b < 7; b++) { var bd = new THREE.Mesh(BUD_GEO, budM); bd.rotation.set(b, b * 2.1, b * 0.7); bd.castShadow = true; g.add(bd); buds.push(bd); }
        g.userData.set = function (pr, size) {
          size = size || 1; pr = clamp(pr, 0, 1); var hgt = (0.06 + pr * 0.8) * size; stem.scale.set(0.5 + pr * 0.8, hgt, 0.5 + pr * 0.8); stem.position.y = hgt / 2;
          nodes.forEach(function (n, k) { var on = k < Math.floor(1 + pr * 6.5) && pr > 0.04; n.visible = on; if (!on) return; n.position.y = Math.min(hgt - 0.02, (0.14 + k / 5 * 0.8) * hgt); n.scale.setScalar(clamp((pr * 6.5 - k) / 1.5, 0.15, 1) * (0.4 + pr * 0.6) * (1 - k / 14) * size); });
          var ft = clamp((pr - 0.62) / 0.38, 0, 1);
          buds.forEach(function (bd, b) { var t = clamp(ft * 1.5 - b * 0.08, 0, 1); bd.visible = t > 0; var s = (0.4 + t * 1.1) * (1 - b * 0.06) * size; bd.scale.set(s, s * 1.2, s); var a = b * 2.4, r = 0.045 * (1 - b / 9) * size; bd.position.set(Math.cos(a) * r, hgt * (0.62 + b * 0.065), Math.sin(a) * r); });
        };
        g.userData.set(0); return g;
      }
    /* 35-dlc-kit.js */
    function readout(pw, ph, accent) {
        var cv = document.createElement('canvas'); cv.width = 384; cv.height = Math.round(384 * ph / pw); var m = litPlane(cv, pw, ph), last = '';
        m.userData.draw = function (lines, col) { var key = lines.join('|') + (col || ''); if (key === last) return; last = key; var ctx = cv.getContext('2d'), W = cv.width, H = cv.height; scrLcd(ctx, W, H, col || accent || DESK_OK); ctx.fillStyle = col || accent || DESK_OK; ctx.font = '700 30px ' + DESK_FONT; ctx.fillText(deskTrim(ctx, lines[0] || '', W - 36), 18, 16); ctx.fillStyle = DESK_INK; ctx.font = '24px ' + DESK_FONT; for (var i = 1; i < lines.length; i++) ctx.fillText(deskTrim(ctx, lines[i], W - 36), 18, 22 + i * 34); m.userData.tex.needsUpdate = true; };
        return m;
      }
    /* 35-dlcx-breeding.js */
    var BREED = { fee: 150, ms: 480000, seeds: 6, max: 12, price: 900 };
    /* 35-dlcx-breeding.js */
    function breedState() { return dlcState('breeding', { owned: false, strains: [], job: null, pickA: '', pickB: '', name: '' }); }
    /* 35-dlcx-breeding.js */
    function breedStats(st) { return 'strength ' + st.thc.toFixed(2) + '× · ' + st.yield + ' g a plant · ' + Math.round(st.growMs / 60000) + ' min · seed ' + money(st.seed); }
    /* 35-dlcx-breeding.js */
    function paneBreed() {
        var B = breedState(), h = '<div class="g3-grid"><div class="g3-box"><h3>🧬 The cross</h3>';
        if (B.job) {
          var J = B.job, a = strainById(J.a), b = strainById(J.b), k = clamp(J.t / (BREED.ms / 1000), 0, 1);
          h += '<div class="g3-customer"><span class="avatar">' + a.emoji + '</span><div><span class="who">' + esc(a.name) + ' × ' + esc(b.name) + '</span><span class="req">' + (k >= 1 ? 'The pods have split: the seed is ready.' : 'Pollinated. ' + minsLeft((1 - k) * BREED.ms / 1000) + ' until the seed is ripe.') + '</span></div><span class="avatar">' + b.emoji + '</span></div>' + barHtml(k, 'q');
          if (k >= 1) h += '<div class="desc" style="margin-top:12px">What came out: <b>' + breedStats(J.child) + '</b>' + (J.child.star ? '. One plant in the tray stood out, and you kept that one.' : '.') + ' Give it a name.</div><div class="g3-slider"><label>Name</label><input type="text" data-breed="name" maxlength="24" value="' + esc(B.name) + '" style="flex:2;background:#0c1712;color:var(--ink);border:1px solid var(--panel-line);border-radius:8px;padding:7px 10px"></div><button class="g3-btn primary wide" data-act="breedFinish">🧬 Name it and take the ' + BREED.seeds + ' seeds</button>';
        } else {
          var have = strainsWithSeed(1);
          h += '<div class="desc">Pick a mother and a father. The seed takes after both: strength, yield and how long it takes to grow land somewhere between them, give or take. It costs a seed of each and ' + money(BREED.fee) + ' for the lab work.</div>';
          if (have.length < 2) h += '<div class="g3-empty">You need seeds of two different strains on the supply rack. The Seed bank on the office PC sells them.</div>';
          else {
            [['pickA', 'Mother'], ['pickB', 'Father']].forEach(function (p) { h += '<div class="desc" style="margin:10px 0 2px">' + p[1] + '</div><div class="g3-chips">' + have.map(function (st) { return '<button class="g3-btn' + (B[p[0]] === st.id ? ' primary' : '') + '" data-act="breedPick" data-id="' + p[0] + ':' + st.id + '">' + st.emoji + ' ' + esc(st.name) + '</button>'; }).join('') + '</div>'; });
            var ok = B.pickA && B.pickB && B.pickA !== B.pickB;
            h += '<button class="g3-btn primary wide" data-act="breedStart"' + (ok && B.strains.length < BREED.max ? '' : ' disabled') + '>🧬 Start the cross · ' + money(BREED.fee) + ' · about ' + Math.round(BREED.ms / 60000) + ' min</button>';
          }
        }
        h += '</div><div class="g3-box"><h3>📚 Your cultivars · ' + B.strains.length + ' of ' + BREED.max + '</h3><div class="desc">Everything you have bred. The Seed bank sells more seed of each, and customers ask for them by name.</div>';
        if (!B.strains.length) h += '<div class="g3-empty">Nothing yet. Your first cross goes here.</div>';
        B.strains.forEach(function (st) { var pa = strainById(st.parents[0]), pb = strainById(st.parents[1]); h += '<div class="g3-row"><span class="ico"><i class="sw" style="display:block;width:18px;height:18px;border-radius:50%;background:#' + ('000000' + st.bud.toString(16)).slice(-6) + '"></i></span><span class="meta"><span class="n">' + esc(st.name) + (st.star ? ' ★' : '') + '</span><span class="own">' + breedStats(st) + '</span><span class="own">' + esc(pa.name) + ' × ' + esc(pb.name) + ' · ' + (S.supplies['seed_' + st.id] || 0) + ' seeds on the rack</span></span></div>'; });
        return h + '</div></div>';
      }
    /* 35-dlcx-cup.js */
    var CUP = { every: 7, grams: 10, rivals: ['Green Leaf', 'Uptown Buds', 'Old Mill Farms', 'Harbour Hydro', 'The Potting Shed'], metal: { gold: 0xd9b23a, silver: 0xc4c9cf, bronze: 0xb0703a }, shelf: 9 };
    /* 35-dlcx-cup.js */
    function cupState() { return dlcState('cup', { entry: null, trophies: [], history: [] }); }
    /* 35-dlcx-cup.js */
    function cupNext() { var d = S.day || 1; return Math.ceil((d + 0.001) / CUP.every) * CUP.every; }
    /* 35-dlcx-cup.js */
    function cupScore(q, thc) { return q * 0.62 + (thc - 1) * 22; }
    /* 35-dlcx-cup.js */
    function cupGolds() { return cupState().trophies.filter(function (t) { return t.metal === 'gold'; }).length; }
    /* 35-dlcx-cup.js */
    function paneCup() {
        var C = cupState(), next = cupNext(), left = next - (S.day || 1), h = '<div class="g3-grid"><div class="g3-box"><h3>🏆 The next Cup · day ' + next + '</h3><div class="desc">' + (left === 1 ? 'Judging is tomorrow morning.' : 'Judging is in ' + left + ' days.') + ' Three judges score one jar from every grower in town on how well it was grown, how strong it is and how it was cured. You enter ' + CUP.grams + ' g of one strain.</div>';
        if (C.entry) { var st = strainById(C.entry.strain); h += '<div class="g3-customer premium"><span class="avatar">' + st.emoji + '</span><div><span class="who">' + esc(st.name) + '</span><span class="req">quality ' + C.entry.q + ' · strength ' + C.entry.thc.toFixed(2) + '× · in the entry jar</span></div></div><button class="g3-btn wide" data-act="cupWithdraw">Take it back into the stash</button>'; }
        else h += '<div class="g3-empty">No jar entered yet.</div>';
        var can = STRAINS.filter(function (st) { return stashOf(st.id).g >= CUP.grams; });
        h += '<div class="desc" style="margin-top:12px">' + (C.entry ? 'Enter a different jar instead' : 'Enter a jar') + '</div>';
        if (!can.length) h += '<div class="g3-empty">You need ' + CUP.grams + ' g of one cured strain in the stash.</div>';
        can.sort(function (a, b) { var sa = stashOf(a.id), sb = stashOf(b.id); return cupScore(sb.qSum / sb.g, sb.thcSum / sb.g) - cupScore(sa.qSum / sa.g, sa.thcSum / sa.g); }).forEach(function (st) { var s = stashOf(st.id), q = s.qSum / s.g, t = s.thcSum / s.g; h += '<div class="g3-row"><span class="ico">' + st.emoji + '</span><span class="meta"><span class="n">' + esc(st.name) + '</span><span class="own">quality ' + Math.round(q) + ' · strength ' + t.toFixed(2) + '× · ' + gram(s.g) + ' in the stash</span></span><button class="g3-btn" data-act="cupEnter" data-id="' + st.id + '">Enter ' + CUP.grams + ' g</button></div>'; });
        h += '</div><div class="g3-box"><h3>🥇 The cabinet</h3><div class="g3-chips">' + ['gold', 'silver', 'bronze'].map(function (m) { return chip(m, C.trophies.filter(function (t) { return t.metal === m; }).length); }).join('') + '</div><div class="desc">Every gold cup in the cabinet brings more people through the door: ' + Math.round((cupFootfall() - 1) * 100) + '% more at the moment, up to 15%.</div>';
        if (!C.history.length) h += '<div class="g3-empty">No Cup has been judged yet.</div>';
        C.history.forEach(function (r) { h += '<div class="g3-row"><span class="ico">' + (['·', '🥇', '🥈', '🥉'][r.place] || '·') + '</span><span class="meta"><span class="n">Day ' + r.day + '</span><span class="own">' + esc(r.note) + '</span></span></div>'; });
        return h + '</div></div>';
      }
    /* 35-dlcx-cup.js */
    function cupFootfall() { return 1 + Math.min(0.15, cupGolds() * 0.03); }
    /* 35-dlcx-cup.js */
    function trophyMesh(metal, s) {   // a two-handled cup on a stepped base
        var g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: CUP.metal[metal], roughness: 0.22, metalness: 1 }), wood = MAT.darkwood;
        function add(geo, mat, y) { var x = new THREE.Mesh(geo, mat); x.position.y = y; x.castShadow = true; g.add(x); return x; }
        add(roundCylGeo(0.05, 0.055, 0.03, 20), wood, 0.015); add(roundCylGeo(0.036, 0.042, 0.016, 20), m, 0.038); add(roundCylGeo(0.01, 0.014, 0.06, 12), m, 0.076); add(new THREE.SphereGeometry(0.016, 12, 10), m, 0.082);
        var bowl = add(new THREE.CylinderGeometry(0.052, 0.022, 0.085, 24, 1, true), m, 0.148); bowl.material = m.clone(); bowl.material.side = THREE.DoubleSide; add(new THREE.TorusGeometry(0.052, 0.004, 8, 24), m, 0.19).rotation.x = Math.PI / 2; add(roundCylGeo(0.024, 0.02, 0.01, 16), m, 0.108);
        [-1, 1].forEach(function (sd) { var h = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.0045, 8, 16, Math.PI), m); h.position.set(sd * 0.05, 0.15, 0); h.rotation.z = sd * -Math.PI / 2; g.add(h); });
        g.scale.setScalar(s || 1); return g;
      }
    /* 35-dlcx-finance.js */
    var FIN = { rate: 0.005, cap: 500, loans: [{ id: 'small', name: 'Starter loan', sum: 2000, lvl: 1 }, { id: 'mid', name: 'Business loan', sum: 6000, lvl: 4 }, { id: 'big', name: 'Expansion loan', sum: 15000, lvl: 8 }], days: 10, interest: 0.12,
        cover: [{ id: 'robbery', ico: '🦹', name: 'Robbery cover', day: 35, d: 'Pays back 75% of whatever robbers got away with, the morning after.' }, { id: 'power', ico: '⚡', name: 'Power cover', day: 12, d: 'Pays $150 for every power cut, for the stock that spoils and the trade you lose.' }, { id: 'stock', ico: '🌙', name: 'Break-in cover', day: 18, d: 'Pays $400 after a night break-in.' }] };
    /* 35-dlcx-finance.js */
    function finState() { var F = dlcState('finance', { savings: 0, earned: 0, loan: null, cover: {}, claims: [], seen: null }); if (!F.seen) F.seen = { robbed: S.stats.robbed || 0, breakins: S.stats.breakins || 0, cuts: 0 }; return F; }
    /* 35-dlcx-finance.js */
    function paneFinance() {
        var F = finState(), h = '<div class="g3-grid"><div class="g3-box"><h3>💰 Savings · ' + money(F.savings) + '</h3><div class="desc">Money you don\'t need this week earns ' + (FIN.rate * 100).toFixed(1) + '% a day here, up to ' + money(FIN.cap) + ' a day. Robbers can\'t reach it and the morning bills don\'t draw on it. Interest so far: ' + money(F.earned) + '.</div>';
        h += '<div class="desc">Pay in from the bank (' + money(S.bank) + ')</div><div class="g3-chips">' + [100, 500, 1000, 5000].map(function (n) { return '<button class="g3-btn" data-act="finIn" data-id="' + n + '"' + (S.bank >= n ? '' : ' disabled') + '>' + money(n) + '</button>'; }).join('') + '<button class="g3-btn" data-act="finIn" data-id="all"' + (S.bank >= 1 ? '' : ' disabled') + '>all of it</button></div>';
        h += '<div class="desc">Take out</div><div class="g3-chips">' + [100, 500, 1000, 5000].map(function (n) { return '<button class="g3-btn" data-act="finOut" data-id="' + n + '"' + (F.savings >= n ? '' : ' disabled') + '>' + money(n) + '</button>'; }).join('') + '<button class="g3-btn" data-act="finOut" data-id="all"' + (F.savings >= 1 ? '' : ' disabled') + '>all of it</button></div>';
        h += '<h3 style="margin-top:16px">🏦 Borrowing</h3>';
        if (F.loan) h += '<div class="g3-customer premium"><span class="avatar">📄</span><div><span class="who">' + F.loan.name + ' · ' + money(F.loan.left) + ' to pay</span><span class="req">' + money(F.loan.daily) + ' every morning' + (F.loan.missed ? ' · ' + F.loan.missed + ' payment' + (F.loan.missed === 1 ? '' : 's') + ' missed' : '') + '</span></div></div>' + barHtml(1 - F.loan.left / (F.loan.sum * (1 + FIN.interest)), 'q') + '<button class="g3-btn wide" data-act="finSettle">Pay it off now · ' + money(Math.round(F.loan.left * 0.95)) + '</button>';
        else { h += '<div class="desc">One loan at a time. It costs ' + Math.round(FIN.interest * 100) + '% and goes back in ' + FIN.days + ' daily payments. A morning you can\'t pay costs you rep and adds to the debt.</div>'; FIN.loans.forEach(function (L) { var ok = (S.level || 1) >= L.lvl; h += '<div class="g3-row"><span class="ico">💵</span><span class="meta"><span class="n">' + L.name + ' · ' + money(L.sum) + '</span><span class="own">' + (ok ? money(Math.ceil(L.sum * (1 + FIN.interest) / FIN.days)) + ' a day for ' + FIN.days + ' days' : 'from level ' + L.lvl) + '</span></span><button class="g3-btn" data-act="finBorrow" data-id="' + L.id + '"' + (ok ? '' : ' disabled') + '>Borrow</button></div>'; }); }
        h += '</div><div class="g3-box"><h3>🛡️ Insurance</h3><div class="desc">The premium goes out with the morning bills. A claim is paid into the bank the morning after.</div>';
        FIN.cover.forEach(function (c) { var on = !!F.cover[c.id]; h += '<div class="g3-row"><span class="ico">' + c.ico + '</span><span class="meta"><span class="n">' + c.name + ' · ' + money(c.day) + ' a day</span><span class="own">' + c.d + '</span></span><button class="g3-btn' + (on ? ' primary' : '') + '" data-act="finCover" data-id="' + c.id + '">' + (on ? 'Covered' : 'Take it out') + '</button></div>'; });
        h += '<h3 style="margin-top:16px">📬 Statements</h3>'; if (!F.claims.length) h += '<div class="g3-empty">Nothing has been paid out yet.</div>';
        F.claims.forEach(function (c) { h += '<div class="g3-row"><span class="ico">📄</span><span class="meta"><span class="n">Day ' + c.day + ' · ' + money(c.sum) + '</span><span class="own">' + esc(c.text) + '</span></span></div>'; });
        return h + '</div></div>';
      }
    /* 35-dlcx-hydro.js */
    var HYDRO = { sites: 8, price: 1800, spd: 1.8, slow: 0.45, phLo: 5.5, phHi: 6.5, feedCost: 14, phCost: 5, phDrift: 0.00022, feedUse: 0.018 };
    /* 35-dlcx-hydro.js */
    function hydroState() { var H = dlcState('hydrobay', { owned: false, sites: [], ph: 6.0, feed: 100 }); while (H.sites.length < HYDRO.sites) H.sites.push(null); return H; }
    /* 35-dlcx-hydro.js */
    function hydroSitePos(i) { return { x: -0.9 + (i % 4) * 0.6, y: i < 4 ? 0.8 : 1.42, z: 0.02 }; }
    /* 35-dlcx-hydro.js */
    function hydroSync() {   // what stands in the channels, rebuilt from the save
        var W = world.hydro; if (!W || !W.dyn || !W.dyn.parent) return; dropKids(W.dyn); W.figs = [];
        hydroState().sites.forEach(function (p, i) { if (!p) return; var f = plantFigure(strainById(p.strain)), s = hydroSitePos(i); f.position.set(s.x, s.y + 0.04, s.z); f.userData.set(p.progress, 0.62); f.userData.site = i; W.dyn.add(f); W.figs.push(f); });
      }
    /* 35-dlcx-merch.js */
    var MERCH = { price: 600, lot: 10, wait: 90, items: [
        { id: 'tee', ico: '👕', name: 'T-shirt', one: 'a T-shirt', cost: 9, sell: 24 }, { id: 'cap', ico: '🧢', name: 'Cap', one: 'a cap', cost: 7, sell: 18 },
        { id: 'mug', ico: '☕', name: 'Mug', one: 'a mug', cost: 5, sell: 14 }, { id: 'tote', ico: '👜', name: 'Tote bag', one: 'a tote bag', cost: 4, sell: 12 }],
        levels: [0, 10, 30, 60, 100, 150, 210, 280, 360, 450, 550], tiers: [[0.8, 'keen', 1.35], [1, 'fair', 1], [1.25, 'dear', 0.6]] };
    /* 35-dlcx-merch.js */
    function merchState() { var M = dlcState('merch', { owned: false, stock: {}, tier: 1, brand: 0, sold: 0, takings: 0, orders: [], t: 0 }); if (typeof M.stock.hoodie !== 'number') M.stock.hoodie = 0; MERCH.items.forEach(function (it) { if (typeof M.stock[it.id] !== 'number') M.stock[it.id] = 0; }); return M; }
    /* 35-dlcx-merch.js */
    function merchLevel() { var b = merchState().brand, l = 0; MERCH.levels.forEach(function (n, i) { if (b >= n) l = i; }); return l; }
    /* 35-dlcx-merch.js */
    function merchPrice(it) { return Math.round(it.sell * MERCH.tiers[merchState().tier][0]); }
    /* 35-dlcx-merch.js */
    function paneMerch() {
        var M = merchState(), lv = merchLevel(), nextAt = MERCH.levels[lv + 1], h = '<div class="g3-grid"><div class="g3-box"><h3>👕 The stand</h3>';
        if (!M.owned) return h + '<div class="g3-empty">The merch stand is not in the lobby yet. E on its outline fits it for ' + money(MERCH.price) + '.</div></div></div>';
        h += '<div class="desc">People in the lobby buy while they wait, and the money goes in the till. A box is ' + MERCH.lot + ' of one thing, printed with the shop\'s mark.</div>';
        MERCH.items.forEach(function (it) { var due = M.orders.filter(function (o) { return o.id === it.id; }).length * MERCH.lot; h += '<div class="g3-row"><span class="ico">' + it.ico + '</span><span class="meta"><span class="n">' + it.name + ' · ' + M.stock[it.id] + ' on the stand' + (due ? ' <small>' + due + ' on the way</small>' : '') + '</span><span class="own">costs ' + money(it.cost) + ' · sells for ' + money(merchPrice(it)) + '</span></span><button class="g3-btn" data-act="merchOrder" data-id="' + it.id + '">Order ' + MERCH.lot + ' · ' + money(it.cost * MERCH.lot) + '</button></div>'; });
        h += '<div class="desc" style="margin-top:12px">Prices</div><div class="g3-chips">' + MERCH.tiers.map(function (t, i) { return '<button class="g3-btn' + (M.tier === i ? ' primary' : '') + '" data-act="merchTier" data-id="' + i + '">' + Math.round(t[0] * 100) + '% · ' + t[1] + '</button>'; }).join('') + '</div><div class="desc">Keen prices sell faster and spread the name sooner. Dear ones earn more on each and sell slowly.</div>';
        h += '</div><div class="g3-box"><h3>📣 The brand · level ' + lv + '</h3><div class="desc">Every sale puts the shop\'s name on somebody\'s back. Each level brings 2% more people through the door, up to 20%.</div>' + (nextAt ? barHtml((M.brand - MERCH.levels[lv]) / (nextAt - MERCH.levels[lv]), 'q') + '<div class="desc" style="margin-top:6px">' + (nextAt - M.brand) + ' more sales to level ' + (lv + 1) + '</div>' : '<div class="desc">As well known as a shop this size gets.</div>');
        h += '<div class="g3-chips" style="margin-top:12px">' + chip('sold', M.sold) + chip('takings', money(M.takings)) + chip('footfall', '+' + (lv * 2) + '%') + '</div></div></div>';
        return h;
      }
    /* 35-dlcx-merch.js */
    function teeGeo() {   // a T-shirt cut flat: body, sleeves, a scooped neck
        var s = new THREE.Shape(), P = [[-0.17, -0.26], [0.17, -0.26], [0.17, 0.1], [0.28, 0.03], [0.34, 0.12], [0.2, 0.26], [0.08, 0.26]]; s.moveTo(P[0][0], P[0][1]); for (var i = 1; i < P.length; i++) s.lineTo(P[i][0], P[i][1]);
        s.quadraticCurveTo(0, 0.18, -0.08, 0.26); [[-0.2, 0.26], [-0.34, 0.12], [-0.28, 0.03], [-0.17, 0.1]].forEach(function (p) { s.lineTo(p[0], p[1]); }); s.closePath();
        return new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1 });
      }
    /* 35-dlcx-merch.js */
    var TEE_GEO = teeGeo(), MERCH_COLS = [0x15171b, 0xf3eee0, 0x2f6b4a, 0x6fdc8c, 0x7a2f3a];
    /* 35-dlcx-merch.js */
    function merchMark(w) { var m = new THREE.Mesh(new THREE.PlaneGeometry(w, w), new THREE.MeshBasicMaterial({ map: emojiTex('🌿', 96, '#0f1a15'), transparent: true })); return m; }
    /* 35-dlcx-merch.js */
    function merchSync() {
        var W = world.merch; if (!W || !W.dyn || !W.dyn.parent) return; dropKids(W.dyn); var M = merchState(), g = W.dyn;
        function add(geo, mat, x, y, z, ry) { var m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry || 0; m.castShadow = true; g.add(m); return m; }
        [1, -1].forEach(function (face) {
          var ry = face > 0 ? 0 : Math.PI, z0 = face * 0.06;
          for (var i = 0; i < Math.min(5, Math.ceil(M.stock.tee / 4)); i++) { var t = add(TEE_GEO, fabricMat(MERCH_COLS[(i + (face > 0 ? 0 : 2)) % 5]), face * (-0.56 + i * 0.28), 1.42, z0 + face * (0.05 + (i % 2) * 0.03), ry); t.rotation.y += face * 0.18; t.scale.setScalar(0.78); var mk = merchMark(0.12); mk.position.set(0, 0.02, 0.018); t.add(mk); add(roundCylGeo(0.004, 0.004, 0.16, 6), MAT.chrome, t.position.x, 1.66, t.position.z - face * 0.0, 0).rotation.x = Math.PI / 2; }
          for (var hd2 = 0; hd2 < Math.min(3, Math.ceil((M.stock.hoodie || 0) / 5)); hd2++) { var hm = fabricMat([0x15171b, 0x2f6b4a, 0x7a2f3a][hd2]), hx = face * (-0.5 + hd2 * 0.5), hb2 = add(TEE_GEO, hm, hx, 1.06, z0 + face * 0.06, ry); hb2.scale.set(0.9, 0.95, 1.6); var hood = add(new THREE.SphereGeometry(0.075, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), hm, hx, 1.24, z0 + face * 0.05, ry); hood.scale.set(1, 1.1, 0.7); var mk3 = merchMark(0.1); mk3.position.set(0, 0.0, 0.012); hb2.add(mk3); }
          for (var c2 = 0; c2 < Math.min(4, Math.ceil(M.stock.cap / 5)); c2++) { var cm = fabricMat(MERCH_COLS[(c2 + 1) % 5]), cx = face * (-0.5 + c2 * 0.33), cap = add(new THREE.SphereGeometry(0.085, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), cm, cx, 1.875, z0 + face * 0.1, ry); var pk = add(bevelGeo(0.13, 0.012, 0.09, 0.005), cm, cx, 1.88, z0 + face * 0.19, ry); pk.rotation.x = face * 0.12; }
          for (var m2 = 0; m2 < Math.min(5, Math.ceil(M.stock.mug / 4)); m2++) { var mm = colorMat(MERCH_COLS[(m2 + 3) % 5], 0.25), mx = face * (-0.56 + m2 * 0.28); add(roundCylGeo(0.04, 0.036, 0.09, 18), mm, mx, 0.795, z0 + face * 0.14, ry); var hd = add(new THREE.TorusGeometry(0.024, 0.007, 8, 14, Math.PI), mm, mx + 0.042, 0.795, z0 + face * 0.14, 0); hd.rotation.z = -Math.PI / 2; }
          for (var b = 0; b < Math.min(3, Math.ceil(M.stock.tote / 6)); b++) { var bm = fabricMat(b % 2 ? 0xe9dfc6 : 0x2f6b4a), bx = face * (-0.4 + b * 0.4), bag = add(bevelGeo(0.26, 0.3, 0.03, 0.01), bm, bx, 0.36, z0 + face * 0.16, ry); var mk2 = merchMark(0.13); mk2.position.set(0, -0.02, 0.0165); bag.add(mk2); var hl = add(new THREE.TorusGeometry(0.06, 0.006, 6, 14, Math.PI), bm, bx, 0.51, z0 + face * 0.16, ry); }
        });
      }
    /* 35-dlcy-cigars.js */
    var CIGAR = { leaf: 0.02, lot: 5, rollS: 40, ageS: 480, cap: 40, keep: [0, 0.5, 1, 2], take: 10 };
    /* 35-dlcy-cigars.js */
    function cigarState() { var C = dlcState('cigars', { job: null, humidor: [], keep: 0.5, rolled: 0 }); if (CIGAR.keep.indexOf(C.keep) < 0) C.keep = 0.5; return C; }
    /* 35-dlcy-cigars.js */
    function tobSpare(T) { return Math.max(0, T.cured - (dlcOn('tobacco') ? cigarState().keep : 0)); }
    /* 35-dlcy-cigars.js */
    function cigarModel(s) {   // one cigar: a tapered body, a rounded head and a band
        var G = new THREE.Group(), wrap = colorMat(0x5a3a1e, 0.75), b = new THREE.Mesh(roundCylGeo(0.0085 * s, 0.0095 * s, 0.125 * s, 12), wrap); b.rotation.z = Math.PI / 2; b.castShadow = true; G.add(b);
        var hd = new THREE.Mesh(new THREE.SphereGeometry(0.0085 * s, 10, 8), wrap); hd.position.x = -0.0625 * s; hd.scale.x = 1.4; G.add(hd);
        var bd = new THREE.Mesh(new THREE.CylinderGeometry(0.0092 * s, 0.0094 * s, 0.018 * s, 12), colorMat(0xb5121b, 0.5)); bd.rotation.z = Math.PI / 2; bd.position.x = -0.03 * s; G.add(bd);
        var gd = new THREE.Mesh(new THREE.CylinderGeometry(0.0094 * s, 0.0096 * s, 0.004 * s, 12), MAT.brass); gd.rotation.z = Math.PI / 2; gd.position.x = -0.03 * s; G.add(gd);
        return G;
      }
    /* 35-dlcy-cigars.js */
    function productCigar(K, s) {   // what you hold and what stands in the cabinet: three cigars in an open cedar tray
        var G = new THREE.Group(), cedar = colorMat(0x9a6a3a, 0.7); var tray = new THREE.Mesh(bevelGeo(0.075 * s, 0.012 * s, 0.14 * s), cedar); tray.position.y = -0.03 * s; G.add(tray);
        for (var i = 0; i < 3; i++) { var c = cigarModel(s); c.rotation.y = Math.PI / 2; c.position.set((i - 1) * 0.022 * s, -0.014 * s, 0); G.add(c); }
        return G;
      }
    /* 35-dlcy-lab.js */
    var LAB_TECH = { wage: 85, maxQ: 60, grams: 10, stock: 24 };
    /* 35-dlcy-lab.js */
    function labState() { var L = xs().lab; if (!L.q || typeof L.q !== 'object') L.q = {}; if (typeof L.honey !== 'number') L.honey = 0; return L; }
    /* 35-dlcy-lab.js */
    function mixQ(qa, na, qb, nb) { if (qa === undefined || na <= 0) return qb; if (qb === undefined || nb <= 0) return qa; return (qa * na + qb * nb) / (na + nb); }
    /* 35-dlcy-lab.js */
    function labShelve(J) { var L = labState(); if (typeof J.q === 'number') L.q[J.sku] = mixQ(L.q[J.sku], L.out[J.sku] || 0, J.q, J.n); L.out[J.sku] = (L.out[J.sku] || 0) + J.n; }
    /* 35-dlcy-roof.js */
    function roofxState() { return dlcState('roofkit', { water: 60, honey: 0 }); }
    /* 35-dlcy-roof.js */
    function roofWatered() { return dlcHas('greenhouse', 'barrels') && roofxState().water > 1; }
    /* 35-dlcy-roof.js */
    function productHoneyJar(K, s) {
        var G = new THREE.Group(), glass = new THREE.MeshPhysicalMaterial({ color: 0xe0a028, transparent: true, opacity: 0.9, roughness: 0.12 });
        var body = new THREE.Mesh(roundCylGeo(0.024 * s, 0.022 * s, 0.06 * s, 16), glass); body.castShadow = true; G.add(body);
        var lid = new THREE.Mesh(roundCylGeo(0.025 * s, 0.025 * s, 0.012 * s, 16), MAT.brass); lid.position.y = 0.036 * s; G.add(lid);
        var lab = new THREE.Mesh(new THREE.CylinderGeometry(0.0245 * s, 0.0245 * s, 0.028 * s, 16, 1, true, -0.9, 1.8), new THREE.MeshBasicMaterial({ map: signTex(['HONEY', 'from the roof'], 180, 90, { size: 30, bg: '#fff3c8', color: '#5a3a0a', titleColor: '#5a3a0a', line: 'rgba(0,0,0,0)' }) })); G.add(lab);
        return G;
      }
    /* 35-dlcy-upgrades.js */
    var DLC_UPG = {}, DLC_UPG_ORDER = [];
    /* 35-dlcy-upgrades.js */
    function dlcUpgState() { if (!S.dlcUpg || typeof S.dlcUpg !== 'object' || Array.isArray(S.dlcUpg)) S.dlcUpg = {}; return S.dlcUpg; }
    /* 35-dlcy-upgrades.js */
    function dlcOwns(dlc, id) { var u = dlcUpgState()[dlc]; return !!(u && u[id]); }
    /* 35-dlcy-upgrades.js */
    function dlcHas(dlc, id) { return dlcOwns(dlc, id) && dlcOn(dlc); }
    /* 35-dlcy-upgrades.js */
    function paneDlcUpg() {
        var h = '', any = false;
        DLC_UPG_ORDER.forEach(function (dlc) {
          if (!dlcOn(dlc)) return; any = true;
          var G = DLC_UPG[dlc], own = G.list.filter(function (u) { return dlcOwns(dlc, u.id); }).length;
          h += '<div class="g3-box"><h3>' + G.ico + ' ' + esc(DLC_NAME[dlc] || dlc) + ' · ' + own + ' of ' + G.list.length + '</h3>';
          G.list.forEach(function (u) {
            var has = dlcOwns(dlc, u.id), lv = (S.level || 1) >= (u.lvl || 1), ok = !has && lv && S.bank >= u.price;
            h += '<div class="g3-row"><span class="ico">' + u.ico + '</span><span class="meta"><span class="n">' + u.name + (has ? '' : ' · ' + money(u.price)) + '</span><span class="own">' + u.d + (has || lv ? '' : ' From level ' + u.lvl + '.') + '</span></span><button class="g3-btn' + (has ? ' primary' : '') + '" data-act="dlcUpgBuy" data-id="' + dlc + ':' + u.id + '"' + (ok ? '' : ' disabled') + '>' + (has ? 'Fitted' : 'Buy') + '</button></div>';
          });
          h += '</div>';
        });
        if (!any) return '<div class="g3-grid"><div class="g3-box"><h3>⬆️ Upgrades</h3><div class="g3-empty">Every DLC has three upgrades of its own, and no DLC is switched on. Switch one on under Workshop and DLC in the main menu.</div></div></div>';
        return '<div class="desc" style="margin:0 0 12px">Three upgrades for every DLC you have switched on. They are paid from the bank and last for good. The bank holds ' + money(S.bank) + '.</div><div class="g3-grid">' + h + '</div>';
      }
    // the shop state the props read at build time: a sandboxed fresh Grow save with every upgrade on, never the host game's save
    var S = fresh(); S.upgrades = S.upgrades || {}; ['lobby', 'generator', 'lights', 'vip', 'arcade', 'vault'].forEach(function (k) { S.upgrades[k] = true; }); S.dlc = { breeding: { owned: true }, hydrobay: { owned: true }, merch: { owned: true }, cup: { owned: true } };
    for (var hk in HOST_MAT) if (MAT[hk] === undefined) MAT[hk] = HOST_MAT[hk]; for (var tk in HOST_TEX) if (TEX[tk] === undefined) TEX[tk] = HOST_TEX[tk];
    // the defs and their add-ons, each in a guard: a def whose part reads shop state at load is left out rather than breaking the pack
    try { growDefProp('officeDesk', { label: 'office desk', x: -ROOM.x + 0.55, z: 1.0, rot: 1, build: function (c) {
          // desk along local x, laptop faces the chair at +z; drawers on the right, cable tidy, lamp, mug, notepad
          c.box(1.6, 0.05, 0.72, MAT.wood, 0, 0.78, 0, { solid: true }); c.box(1.62, 0.02, 0.74, MAT.darkwood, 0, 0.745, 0, { cast: false });
          c.box(0.06, 0.78, 0.06, MAT.metal, -0.74, 0.39, -0.3); c.box(0.06, 0.78, 0.06, MAT.metal, -0.74, 0.39, 0.3); c.box(0.06, 0.02, 0.6, MAT.metal, -0.74, 0.01, 0);
          c.box(0.45, 0.7, 0.66, MAT.darkwood, 0.55, 0.36, 0, { cast: false }); drawer(c, 0.41, 0.18, 0.62, 0.55, 0.6, 0); drawer(c, 0.41, 0.18, 0.62, 0.55, 0.38, 0); drawer(c, 0.41, 0.18, 0.62, 0.55, 0.16, 0);
          // the PC: a widescreen monitor on an aluminium stand with its desktop on it, a keyboard and mouse on a desk mat, and a
          // tower under the desk. The picture is live: the clock runs and the figures are the shop's own. E on it sits you down.
          c.box(0.24, 0.012, 0.18, MAT.alu, -0.15, 0.811, -0.19, { cast: false, r: 0.005 }); c.box(0.055, 0.26, 0.018, MAT.alu, -0.15, 0.94, -0.225);
          var mg = new THREE.Group(); mg.position.set(-0.15, 1.115, -0.19); mg.rotation.x = -0.06; c.add(mg);
          screenShell(mg, 0.6, 0.3375, { bezel: 0.008, depth: 0.022, rim: 0.003, rimMat: MAT.gunmetal });
          var chin = new THREE.Mesh(bevelGeo(0.616, 0.022, 0.012, 0.004), MAT.gloss); chin.position.set(0, -0.188, -0.004); mg.add(chin);
          var pled = new THREE.Mesh(new THREE.CircleGeometry(0.003, 8), new THREE.MeshBasicMaterial({ color: 0x6fdc8c, toneMapped: false })); pled.position.set(0.28, -0.188, 0.0025); mg.add(pled);
          var hub = new THREE.Mesh(bevelGeo(0.12, 0.12, 0.03), MAT.gunmetal); hub.position.set(0, -0.03, -0.038); mg.add(hub);
          var pcv = document.createElement('canvas'); pcv.width = 960; pcv.height = 540; var pcScr = litPlane(pcv, 0.6, 0.3375); pcScr.position.z = 0.0005; mg.add(pcScr);
          var pgl = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.3375), MAT.screenGlass); pgl.position.z = 0.0016; mg.add(pgl);
          world.pcScr = { canvas: pcv, mesh: pcScr, at: 0 }; drawPcScreen();
          c.light(new THREE.PointLight(0x9fd8ff, 0.16, 1.4), -0.15, 1.1, 0.2);
          c.box(0.78, 0.006, 0.32, MAT.soft, -0.05, 0.809, 0.12, { cast: false });                                                   /* desk mat */
          var kbM = colorMat(0x2a2f36, 0.5, 0.2), keyM = colorMat(0x16181c, 0.6), keyL = colorMat(0x3a4048, 0.55);
          c.box(0.4, 0.016, 0.135, kbM, -0.15, 0.817, 0.12, { cast: false, r: 0.006 });
          for (var kr = 0; kr < 4; kr++) for (var kc = 0; kc < 13; kc++) c.box(0.025, 0.006, 0.024, (kr + kc) % 7 === 0 ? keyL : keyM, -0.327 + kc * 0.0295, 0.828, 0.072 + kr * 0.0285, { cast: false });
          c.box(0.15, 0.006, 0.022, keyM, -0.15, 0.828, 0.186, { cast: false }); c.box(0.05, 0.006, 0.022, keyL, -0.3, 0.828, 0.186, { cast: false }); c.box(0.05, 0.006, 0.022, keyL, 0.0, 0.828, 0.186, { cast: false });
          var mouse = c.box(0.058, 0.03, 0.105, MAT.gloss, 0.17, 0.824, 0.12, { r: 0.014 }); mouse.rotation.y = 0.12; c.box(0.006, 0.006, 0.02, colorMat(0x6fdc8c, 0.4, 0, { emissive: new THREE.Color(0x6fdc8c), emissiveIntensity: 0.8 }), 0.167, 0.838, 0.095, { cast: false });
          c.box(0.19, 0.44, 0.44, MAT.gloss, -0.35, 0.23, -0.05, { r: 0.012 }); c.box(0.004, 0.36, 0.36, MAT.glass, -0.253, 0.23, -0.05, { cast: false });   /* the tower, with a window in its side */
          c.box(0.004, 0.3, 0.012, emitMat(0x6fdc8c, 1.4), -0.256, 0.23, 0.1, { cast: false }); c.cyl(0.05, 0.05, 0.02, colorMat(0x22262b, 0.4, 0.6), -0.3, 0.3, -0.05, 18).rotation.z = Math.PI / 2;
          c.box(0.012, 0.012, 0.004, emitMat(0x6fdc8c, 1.2), -0.35, 0.42, 0.172, { cast: false }); c.light(new THREE.PointLight(0x6fdc8c, 0.12, 1.0), -0.2, 0.25, 0.1);
          c.hit(0.66, 0.46, 0.3, -0.15, 1.08, -0.12, { kind: 'laptop', label: 'PC', prompt: 'Use the PC' });
          c.cyl(0.075, 0.08, 0.018, MAT.gunmetal, -0.65, 0.814, -0.22, 24); var la1 = c.box(0.016, 0.36, 0.016, MAT.alu, -0.65, 0.99, -0.26, { sharp: true }); la1.rotation.x = -0.22; var la2 = c.box(0.016, 0.34, 0.016, MAT.alu, -0.65, 1.2, -0.17, { sharp: true }); la2.rotation.x = 1.05;
          c.cyl(0.013, 0.013, 0.03, MAT.soft, -0.65, 1.16, -0.3, 10).rotation.z = Math.PI / 2; var lh = c.box(0.05, 0.014, 0.26, MAT.gunmetal, -0.65, 1.27, 0.02, { r: 0.005 }); lh.rotation.x = 0.12; c.lit(0xfff0cc, 0.036, 0.22, -0.65, 1.2615, 0.02, 0, Math.PI / 2 + 0.12);
          c.light(new THREE.PointLight(0xffe0a8, 0.35, 2.5), -0.6, 1.15, -0.1);
          c.cyl(0.04, 0.035, 0.09, colorMat(0xf5f5f0, 0.5), 0.2, 0.85, -0.2, 14); var hdl = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.007, 6, 12, Math.PI), colorMat(0xf5f5f0, 0.5)); hdl.position.set(0.24, 0.85, -0.2); hdl.rotation.y = Math.PI / 2; c.add(hdl);
          c.box(0.16, 0.01, 0.22, MAT.white, 0.5, 0.81, 0.15, { cast: false }); c.box(0.14, 0.002, 0.2, new THREE.MeshBasicMaterial({ map: signTex(['to do', 'water · feed', 'order soil', 'call supplier'], 140, 200, { size: 24, bg: '#fffbe6', color: '#333', titleColor: '#1a6a2a', line: 'rgba(0,0,0,0)' }) }), 0.5, 0.816, 0.15, { cast: false }); var pen = c.cyl(0.005, 0.005, 0.14, colorMat(0x2a4a8a, 0.4), 0.62, 0.815, 0.15, 6); pen.rotation.set(Math.PI / 2, 0, 0.3);
          c.box(0.24, 0.12, 0.16, MAT.plastic, -0.55, 0.86, 0.22); c.box(0.2, 0.01, 0.12, MAT.white, -0.55, 0.925, 0.22, { cast: false }); c.box(0.02, 0.01, 0.06, emitMat(0x6fdc8c, 1), -0.45, 0.925, 0.28, { cast: false });   // small printer
          c.box(0.1, 0.06, 0.04, MAT.black, -0.1, 0.5, -0.33, { cast: false }); c.cyl(0.008, 0.008, 0.5, MAT.black, -0.1, 0.25, -0.35, 5);   // cable tidy + power lead
          c.box(1.62, 0.05, 0.05, MAT.darkwood, 0, 0.755, -0.37, { cast: false });
          officeChairBuild({ box: function (w, h, d, mat, x, y, z, o) { return c.box(w, h, d, mat, x, y + 0, z + 0.75, o); }, cyl: function (rt, rb, h, mat, x, y, z, s) { return c.cyl(rt, rb, h, mat, x, y, z + 0.75, s); }, solid: function (a, b, d, e) { c.solid(a, b, d + 0.75, e + 0.75); } });
          // a name plate where the sign on a stick used to stand: a wedge of dark wood with a brass plate
          var npl = c.box(0.24, 0.06, 0.05, MAT.darkwood, 0.55, 0.835, -0.24, { r: 0.01 }); npl.rotation.x = -0.35;
          var npf = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.04), new THREE.MeshStandardMaterial({ map: signTex(['GROW CO. · OFFICE'], 420, 80, { size: 40, bold: true, bg: '#c9a24a', color: '#2a2210', titleColor: '#2a2210', line: 'rgba(60,45,10,.6)' }), roughness: 0.35, metalness: 0.7 })); npf.position.set(0.55, 0.838, -0.213); npf.rotation.x = -0.35; c.add(npf);
        } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "officeDesk" + ": " + e.message); }
    try { growDefProp('tabletDock', { label: 'tablet dock', x: -10.4, z: 3.55, rot: 2, build: function (c) {
          // a charging plinth against the office wall: the tablet stands in the cradle, screen out, until you take it
          var body = colorMat(0x2b2f35, 0.55, 0.3);
          c.box(0.52, 0.05, 0.36, MAT.darkwood, 0, 0.93, 0, { cast: false }); c.box(0.54, 0.02, 0.38, MAT.darkwood, 0, 0.955, 0, { cast: false });
          c.box(0.44, 0.9, 0.3, body, 0, 0.47, 0.02, { cast: true }); c.box(0.56, 0.04, 0.4, MAT.metal, 0, 0.03, 0.02, { cast: false });
          c.box(0.46, 0.5, 0.02, colorMat(0x1b1f24, 0.7), 0, 0.5, -0.16, { cast: false });   /* recessed back so the plinth is not one flat slab */
          c.box(0.36, 0.035, 0.11, MAT.metal, 0, 0.965, -0.05, { cast: false });   /* the cradle lip the tablet leans in */
          var lit = hasLic('tobacco'), inDock = xs().tablet === 'dock';
          var tg = new THREE.Group(); tg.position.set(0, 0.975, -0.05); tg.rotation.x = -0.3; tg.userData.tabletBody = true; tg.userData.builtLit = lit; c.add(tg);
          var shell = new THREE.Mesh(bevelGeo(0.38, 0.28, 0.016), colorMat(0x1b1f24, 0.4, 0.5)); shell.position.y = 0.13; shell.castShadow = true; tg.add(shell);
          var scr = new THREE.Mesh(new THREE.PlaneGeometry(0.345, 0.245), lit ? new THREE.MeshBasicMaterial({ map: signTex(['RF SMOKING', 'delivery round'], 300, 210, { size: 34, bg: '#0d1511', color: '#8fa596', titleColor: '#ffc857' }) }) : MAT.screen);
          scr.position.set(0, 0.13, 0.01); tg.add(scr);
          c.cyl(0.016, 0.016, 0.02, emitMat(lit ? 0x6fdc8c : 0xd0201a, 1.4), 0.21, 0.962, 0.1, 10);   /* charge light: green once the licence is in */
          c.sign(['DELIVERY ROUND'], 0.40, 0.072, 0, 0.74, 0.178, 0, { size: 13, titleColor: '#ffc857', bg: '#141a16' });   /* the plinth front face is at z 0.17, and the plate is only 128 px wide: one short line at 13 px is what fits */
          c.solid(-0.27, 0.27, -0.2, 0.2);
          c.hit(0.56, 0.9, 0.44, 0, 0.72, 0.02, { kind: 'tabletDock' });
        } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "tabletDock" + ": " + e.message); }
    try { growDefProp('rack', { label: 'supply rack', x: -ROOM.x + 0.45, z: -1.0, rot: 1, build: function (c) {
          // boltless steel shelving: decks with a rolled lip, punched uprights, a cross brace at the back, levelling feet
          var shelfM = MAT.steel, postM = MAT.gunmetal; for (var s = 0; s < 4; s++) { var sy = 0.25 + s * 0.55; c.box(0.9, 0.03, 0.5, shelfM, 0, sy, 0); c.box(0.9, 0.05, 0.016, postM, 0, sy - 0.006, 0.25, { cast: false }); c.box(0.9, 0.05, 0.016, postM, 0, sy - 0.006, -0.25, { cast: false }); [-0.445, 0.445].forEach(function (x) { c.box(0.016, 0.05, 0.5, postM, x, sy - 0.006, 0, { cast: false }); }); c.sign([['SOIL', 'FEED · SPRAY', 'PAPERS · BAGS', 'POTS · JARS'][s]], 0.16, 0.03, -0.32, sy - 0.006, 0.2595, 0, { size: 13, bg: '#f3e9cf', color: '#222', titleColor: '#222', line: 'rgba(0,0,0,.3)' }); }
          [[-0.44, -0.24], [0.44, -0.24], [-0.44, 0.24], [0.44, 0.24]].forEach(function (p) { c.box(0.04, 2.0, 0.04, postM, p[0], 1.0, p[1]); for (var h = 0; h < 12; h++) c.box(0.012, 0.03, 0.042, MAT.black, p[0], 0.1 + h * 0.16, p[1], { cast: false, sharp: true }); c.cyl(0.03, 0.036, 0.024, MAT.soft, p[0], 0.012, p[1], 12); });
          [1, -1].forEach(function (sd) { var br = c.box(0.014, 1.36, 0.006, postM, 0, 1.05, -0.262, { cast: false, sharp: true }); br.rotation.z = sd * 0.68; }); c.cyl(0.012, 0.012, 0.012, MAT.chrome, 0, 1.05, -0.268, 10).rotation.x = Math.PI / 2;
          c.box(0.9, 0.03, 0.03, postM, 0, 2.0, -0.24); c.box(0.9, 0.03, 0.03, postM, 0, 2.0, 0.24);
          c.solid(-0.5, 0.5, -0.3, 0.3); c.hit(0.9, 2.0, 0.5, 0, 1.0, 0, { kind: 'inventory', label: 'Supply rack', prompt: 'Check stock' });
          c.sign(['SUPPLIES', 'soil · nutrients · spray · seeds'], 0.9, 0.3, 0, 2.2, 0.02, 0, { titleColor: '#6fdc8c' }); c.dynGroup();
        }, after: function () { syncRack(); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "rack" + ": " + e.message); }
    try { growDefProp('cabinet', { label: 'filing cabinet', x: -4.6, z: 3.3, rot: 3, build: function (c) {
          // three drawers, each with a pull, a card in a holder and its own shadow gap; a lock at the top corner
          var cabM = colorMat(0x70777f, 0.4, 0.55), frontM = colorMat(0x7d848c, 0.36, 0.55); c.box(0.5, 1.16, 0.6, cabM, 0, 0.62, 0, { solid: true }); c.box(0.46, 0.04, 0.56, MAT.soft, 0, 0.02, 0, { cast: false });
          [0.24, 0.62, 1.0].forEach(function (y) { c.box(0.46, 0.35, 0.006, MAT.black, 0, y, 0.302, { cast: false, sharp: true }); c.box(0.445, 0.335, 0.024, frontM, 0, y, 0.312, { r: 0.006 }); c.box(0.2, 0.022, 0.014, MAT.black, 0, y + 0.1, 0.325, { cast: false, sharp: true }); c.box(0.2, 0.008, 0.022, MAT.chrome, 0, y + 0.113, 0.33, { cast: false, sharp: true }); c.box(0.11, 0.055, 0.004, MAT.chrome, 0, y - 0.04, 0.326, { cast: false, sharp: true }); c.box(0.098, 0.043, 0.004, MAT.white, 0, y - 0.04, 0.3275, { cast: false, sharp: true }); });
          c.cyl(0.012, 0.012, 0.008, MAT.chrome, 0.18, 1.14, 0.327, 12).rotation.x = Math.PI / 2;
          c.box(0.36, 0.006, 0.26, MAT.white, 0, 1.204, 0.05, { cast: false }); c.box(0.3, 0.02, 0.2, colorMat(0xf5f5f0), 0, 1.21, 0.05, { cast: false });   // paper tray
          c.fern(0, 0, 0.4, 1.21);
        } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "cabinet" + ": " + e.message); }
    try { growDefProp('bookshelf', { label: 'bookshelf', x: -4.3, z: -0.9, rot: 3, build: function (c) { bookshelfBuild(c, 1.0, 1.8, 4); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "bookshelf" + ": " + e.message); }
    try { growDefProp('fernOffice', { label: 'fern', x: -11.5, z: 3.4, build: function (c) { c.fern(0, 0, 1.0); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "fernOffice" + ": " + e.message); }
    try { growDefProp('fernHall', { label: 'fern', x: 3.6, z: 3.5, build: function (c) { c.fern(0, 0, 0.9); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "fernHall" + ": " + e.message); }
    try { growDefProp('fernLobby', { label: 'fern', x: 10.8, z: 5.0, build: function (c) { c.fern(0, 0, 1.1); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "fernLobby" + ": " + e.message); }
    try { growDefProp('sofa', { label: 'sofa + coffee table', x: -2.4, z: -1.3, rot: 0, build: function (c) {
          var seatM = fabricMat(0x4a3b5c), pipeM = fabricMat(0x352a42);
          sofaBuild(c, 1.9, seatM, pipeM);
          [-0.5, 0.5].forEach(function (x) { var cu = c.box(0.4, 0.13, 0.4, fabricMat(x < 0 ? 0xe0c25a : 0x3aa36a), x, 0.62, -0.14, { r: 0.055 }); cu.rotation.set(1.05, x < 0 ? 0.2 : -0.15, 0); });
          coffeeTableBuild(c, 0, 1.15, 1.0, 0.6);
          c.box(0.3, 0.02, 0.22, new THREE.MeshBasicMaterial({ map: signTex(['GROW', 'monthly'], 150, 110, { size: 30, bg: '#6fdc8c', color: '#062010', titleColor: '#062010', line: 'rgba(0,0,0,0)' }) }), -0.15, 0.45, 1.15, { cast: false }); c.box(0.26, 0.015, 0.2, colorMat(0xffc857), -0.05, 0.462, 1.2, { cast: false }).rotation.y = 0.2;
          c.cyl(0.05, 0.04, 0.12, MAT.jar, 0.3, 0.5, 1.25); c.cyl(0.03, 0.03, 0.06, colorMat(0x8a2a2a, 0.5), 0.3, 0.47, 1.25, 10);
          var cst = c.cyl(0.14, 0.12, 0.12, colorMat(0x2a2d33, 0.5), 0.32, 0.5, 1.05, 16); c.box(0.16, 0.16, 0.16, colorMat(0x1a1c1e, 0.5), 0.32, 0.5, 1.05).visible = false;
          c.hit(2.0, 1.2, 1.0, 0, 0.6, 0, { kind: 'couch', seat: 'sofa' });
        }, after: function (c, P) { var v = growPropWorld('sofa', 0, 0.1); world.sofaSeat = { x: v.x, z: v.z, yaw: P.rot * Math.PI / 2 - Math.PI }; } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "sofa" + ": " + e.message); }
    try { growDefProp('fridge', { label: 'drinks fridge', x: 3.3, z: -1.5, rot: 0, multi: { max: 3, price: 500, gap: 1.0, ico: '🧊' }, build: function (c) {
          // a shop's display fridge: a black cabinet, a lit header, light strips up both sides of a white interior, a louvred kick plate
          // and a hinged glass door in a black frame. The shelves hold what is actually in it.
          var shellM = MAT.gloss, inner = colorMat(0xf2f5f7, 0.6), frameM = colorMat(0x15181b, 0.35, 0.4);
          c.box(0.8, 1.9, 0.06, inner, 0, 0.95, -0.32, { cast: false });
          c.box(0.06, 1.9, 0.7, shellM, -0.37, 0.95, 0);
          c.box(0.06, 1.9, 0.7, shellM, 0.37, 0.95, 0);
          [-1, 1].forEach(function (sd) { c.box(0.004, 1.44, 0.6, inner, sd * 0.338, 0.97, 0, { cast: false, sharp: true }); c.lit(0xeaf6ff, 0.02, 1.4, sd * 0.334, 0.97, 0.26, -sd * Math.PI / 2); });
          c.box(0.8, 0.06, 0.7, shellM, 0, 1.87, 0, { cast: false });
          c.box(0.8, 0.22, 0.7, frameM, 0, 0.11, 0); for (var lv = 0; lv < 6; lv++) c.box(0.6, 0.012, 0.01, MAT.black, 0, 0.05 + lv * 0.026, 0.352, { cast: false, sharp: true });
          [[-0.34, -0.3], [0.34, -0.3], [-0.34, 0.3], [0.34, 0.3]].forEach(function (f) { c.cyl(0.03, 0.03, 0.02, MAT.soft, f[0], 0.005, f[1], 12); });
          c.solid(-0.42, 0.42, -0.36, 0.36);
          c.box(0.72, 0.17, 0.03, frameM, 0, 1.78, 0.345, { cast: false }); c.lit(0x0d2b3a, 0.66, 0.13, 0, 1.78, 0.3615);
          c.sign(['ICE COLD'], 0.46, 0.11, 0, 1.78, 0.366, 0, { size: 34, bold: true, bg: 'rgba(0,0,0,0)', titleColor: '#7fe0ff', line: 'rgba(0,0,0,0)' });
          c.lit(0xeaf6ff, 0.6, 0.02, 0, 1.675, 0.28, 0, Math.PI / 2);
          var door = new THREE.Group(); door.position.set(-0.35, 0.96, 0.33); c.add(door); door.userData.fridgeDoor = true;
          function fb(w, h2, d2, m, x, y, z, noCast) { var b = new THREE.Mesh(bevelGeo(w, h2, d2), m); b.position.set(x, y, z); b.castShadow = !noCast; door.add(b); return b; }
          fb(0.04, 1.5, 0.05, frameM, 0, 0, 0); fb(0.04, 1.5, 0.05, frameM, 0.7, 0, 0);
          fb(0.74, 0.04, 0.05, frameM, 0.35, 0.735, 0, true); fb(0.74, 0.04, 0.05, frameM, 0.35, -0.735, 0, true);
          var gl = new THREE.Mesh(new THREE.PlaneGeometry(0.67, 1.44), new THREE.MeshPhysicalMaterial({ color: 0xdff0ff, transparent: true, opacity: 0.16, roughness: 0.02, clearcoat: 1, side: THREE.DoubleSide }));
          gl.position.set(0.35, 0, 0.004); gl.castShadow = false; door.add(gl);
          var hdl = new THREE.Mesh(roundCylGeo(0.012, 0.012, 0.5, 12), MAT.alu); hdl.position.set(0.665, 0, 0.06); door.add(hdl); [-0.2, 0.2].forEach(function (y) { var hp = new THREE.Mesh(bevelGeo(0.02, 0.02, 0.04), MAT.alu); hp.position.set(0.665, y, 0.04); door.add(hp); });
          var shelves = new THREE.Group(); c.add(shelves); shelves.userData.fridgeShelves = true; shelves.userData.slots = [];
          for (var r = 0; r < 4; r++) { var sh = new THREE.Mesh(bevelGeo(0.66, 0.014, 0.55), MAT.alu); sh.position.set(0, 0.38 + r * 0.36, 0); sh.castShadow = false; shelves.add(sh); var tag = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.028, 0.004), colorMat(0xf5f5f0, 0.6)); tag.position.set(0, 0.375 + r * 0.36, 0.278); shelves.add(tag); }
          c.light(new THREE.PointLight(0xbfe8ff, 0.55, 2.6), 0, 1.45, 0.15);
          c.hit(0.82, 1.9, 0.72, 0, 0.95, 0, { kind: 'fridge' });
        }, after: function (c, P, inst, id) { syncFridge(id); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "fridge" + ": " + e.message); }
    try { growDefProp('coffeeBar', { label: 'coffee bar', x: 1.2, z: -1.7, rot: 0, build: function (c) {
          c.box(1.2, 0.9, 0.5, MAT.darkwood, 0, 0.45, 0, { solid: true }); c.box(1.26, 0.04, 0.56, MAT.counterTop, 0, 0.92, 0, { cast: false }); c.box(1.2, 0.06, 0.02, MAT.chrome, 0, 0.03, 0.25, { cast: false });
          drawer(c, 0.5, 0.2, 0.02, -0.3, 0.7, 0.24); drawer(c, 0.5, 0.2, 0.02, 0.3, 0.7, 0.24);
          // the espresso machine: a polished body on four feet, a group head with its portafilter, a steam wand, a gauge, and cups warming on top
          var body = MAT.steel, dark = MAT.gloss;
          c.box(0.36, 0.3, 0.3, body, -0.28, 1.13, -0.04, { r: 0.02 }); c.box(0.36, 0.05, 0.34, dark, -0.28, 1.3, -0.03, { r: 0.012 }); c.box(0.36, 0.04, 0.32, dark, -0.28, 0.975, -0.03); [[-0.43, -0.16], [-0.13, -0.16], [-0.43, 0.1], [-0.13, 0.1]].forEach(function (f) { c.cyl(0.018, 0.022, 0.03, MAT.chrome, f[0], 0.952, f[1], 10); });
          c.box(0.3, 0.012, 0.13, MAT.chrome, -0.28, 0.958, 0.14, { cast: false }); for (var gs = 0; gs < 7; gs++) c.box(0.28, 0.006, 0.006, MAT.black, -0.28, 0.966, 0.085 + gs * 0.018, { cast: false, sharp: true });   /* drip tray */
          c.cyl(0.034, 0.038, 0.04, MAT.chrome, -0.34, 1.1, 0.13, 16); c.cyl(0.036, 0.03, 0.022, MAT.chrome, -0.34, 1.07, 0.13, 16); var pf = c.box(0.022, 0.018, 0.14, MAT.black, -0.34, 1.07, 0.22, { r: 0.006 });   /* group head, portafilter and its handle */
          var wand = c.cyl(0.006, 0.006, 0.16, MAT.chrome, -0.15, 1.06, 0.14, 8); wand.rotation.z = -0.25; c.cyl(0.014, 0.014, 0.03, MAT.soft, -0.17, 1.14, 0.14, 10);
          c.cyl(0.03, 0.03, 0.012, MAT.chrome, -0.22, 1.2, 0.113, 18).rotation.x = Math.PI / 2; c.cyl(0.025, 0.025, 0.004, MAT.white, -0.22, 1.2, 0.121, 18).rotation.x = Math.PI / 2; c.box(0.003, 0.02, 0.002, colorMat(0xc0271b, 0.5), -0.215, 1.206, 0.124, { cast: false, sharp: true }).rotation.z = -0.6;
          c.lit(0xff5040, 0.012, 0.012, -0.4, 1.2, 0.112); c.lit(0x6fdc8c, 0.012, 0.012, -0.37, 1.2, 0.112);
          [[-0.38, 0], [-0.3, 0.02], [-0.22, -0.01], [-0.34, -0.1]].forEach(function (p, i) { c.cyl(0.034, 0.026, 0.06, MAT.ceramic, p[0], 1.355, p[1] - 0.04, 16); });
          // the grinder beside it, with beans in the hopper
          c.box(0.13, 0.26, 0.17, dark, -0.0, 1.07, -0.08, { r: 0.015 }); c.cyl(0.075, 0.045, 0.13, MAT.jar, 0.0, 1.27, -0.08, 18); c.cyl(0.062, 0.04, 0.08, colorMat(0x3a2210, 1), 0.0, 1.255, -0.08, 14); c.cyl(0.078, 0.078, 0.014, dark, 0.0, 1.342, -0.08, 18); c.box(0.06, 0.012, 0.08, MAT.chrome, 0.0, 1.0, 0.03, { cast: false });
          for (var cI = 0; cI < 4; cI++) { var mc = [0xf5f5f0, 0x6fdc8c, 0xffc857, 0x9ad0ff][cI]; c.cyl(0.035, 0.03, 0.08, colorMat(mc, 0.3), 0.16 + cI * 0.095, 0.98, 0.1, 16); var hd = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.006, 8, 12, Math.PI), colorMat(mc, 0.3)); hd.position.set(0.195 + cI * 0.095, 0.98, 0.1); hd.rotation.z = -Math.PI / 2; c.add(hd); }
          c.cyl(0.06, 0.05, 0.16, MAT.jar, 0.47, 1.02, -0.12, 18); c.cyl(0.05, 0.045, 0.1, colorMat(0x4a2a12, 1), 0.47, 0.995, -0.12, 14); c.cyl(0.062, 0.062, 0.015, MAT.jarLid, 0.47, 1.108, -0.12, 18);
          c.box(0.1, 0.12, 0.07, MAT.ceramic, 0.3, 1.0, -0.15, { r: 0.012 }); c.sign(['sugar'], 0.08, 0.04, 0.3, 1.0, -0.114, 0, { size: 20, bg: 'rgba(0,0,0,0)', color: '#333', titleColor: '#333', line: 'rgba(0,0,0,0)' });
          c.placard(['COFFEE', 'help yourself'], 0.42, 0.16, 0.36, 1.22, 0.2, { titleColor: '#ffc857' });
        } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "coffeeBar" + ": " + e.message); }
    try { growDefProp('waterCooler', { label: 'water cooler', x: -3.6, z: 3.5, rot: 3, build: function (c) {
          // a white tower with a dark alcove the cups stand in, two taps over a gridded drip tray, the bottle upside down on top, a cup tube on the side
          var white = colorMat(0xeef0f2, 0.35, 0.05), grey = colorMat(0xc9cdd2, 0.4, 0.1);
          c.box(0.34, 0.92, 0.34, white, 0, 0.47, 0, { r: 0.03 }); c.box(0.36, 0.03, 0.36, MAT.soft, 0, 0.015, 0, { cast: false }); c.box(0.3, 0.26, 0.02, colorMat(0x1a1d21, 0.5), 0, 0.68, 0.168, { cast: false }); c.box(0.26, 0.012, 0.11, grey, 0, 0.555, 0.2, { cast: false }); for (var gs = 0; gs < 6; gs++) c.box(0.24, 0.005, 0.006, MAT.black, 0, 0.563, 0.158 + gs * 0.017, { cast: false, sharp: true });
          [[-0.06, 0x3a7fd6], [0.06, 0xd63a2a]].forEach(function (t) { c.box(0.028, 0.05, 0.05, grey, t[0], 0.77, 0.2, { r: 0.006 }); c.box(0.034, 0.018, 0.04, colorMat(t[1], 0.4), t[0], 0.805, 0.205, { r: 0.005 }); c.cyl(0.008, 0.008, 0.03, MAT.chrome, t[0], 0.735, 0.21, 8); });
          c.lit(0x6fdc8c, 0.01, 0.01, 0.12, 0.86, 0.1715); c.lit(0xff5040, 0.01, 0.01, 0.1, 0.86, 0.1715);
          c.cyl(0.11, 0.13, 0.05, grey, 0, 0.95, 0, 24);
          var bottle = new THREE.Mesh(roundCylGeo(0.14, 0.14, 0.4, 28), MAT.jar); bottle.position.set(0, 1.19, 0); c.add(bottle); c.cyl(0.14, 0.06, 0.07, MAT.jar, 0, 0.965, 0, 24); [1.08, 1.22].forEach(function (y) { var rib = new THREE.Mesh(new THREE.TorusGeometry(0.141, 0.006, 6, 28), MAT.jar); rib.rotation.x = Math.PI / 2; rib.position.y = y; c.add(rib); });
          var water = new THREE.Mesh(new THREE.CylinderGeometry(0.128, 0.128, 0.3, 24), new THREE.MeshPhysicalMaterial({ color: 0x8fd0ff, transparent: true, opacity: 0.55, roughness: 0.1 })); water.position.set(0, 1.15, 0); c.add(water);
          var tube = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.34, 14, 1, true), new THREE.MeshPhysicalMaterial({ color: 0xdff0ff, transparent: true, opacity: 0.3, roughness: 0.05, side: THREE.DoubleSide })); tube.position.set(-0.205, 0.72, 0.08); c.add(tube); for (var k = 0; k < 6; k++) c.cyl(0.03, 0.025, 0.05, colorMat(0xffffff, 0.6), -0.205, 0.59 + k * 0.045, 0.08, 12); c.box(0.02, 0.3, 0.05, grey, -0.18, 0.72, 0.08, { cast: false });
          c.hit(0.5, 1.5, 0.5, 0, 0.75, 0, { kind: 'cooler' }); c.solid(-0.2, 0.2, -0.2, 0.2); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "waterCooler" + ": " + e.message); }
    try { growDefProp('bench', { label: 'workbench', x: ROOM.x - 0.6, z: 1.0, rot: 3, build: function (c) {
          // bench runs along local x, the working side faces +z (into the room after rot 3); tools on the back rail
          c.box(2.4, 0.06, 0.8, MAT.wood, 0, 0.9, 0, { solid: true }); c.box(2.4, 0.85, 0.7, MAT.darkwood, 0, 0.45, 0, { cast: false }); c.box(2.4, 0.03, 0.03, MAT.chrome, 0, 0.93, 0.4, { cast: false });
          drawer(c, 0.5, 0.2, 0.02, -0.9, 0.7, 0.34); drawer(c, 0.5, 0.2, 0.02, -0.3, 0.7, 0.34); c.box(0.9, 0.5, 0.02, MAT.wood, 0.6, 0.45, 0.34, { cast: false }); c.box(0.12, 0.018, 0.02, MAT.chrome, 0.6, 0.55, 0.36, { cast: false });
          c.hit(2.4, 0.02, 0.8, 0, 0.93, 0, { kind: 'bench', label: 'Workbench', prompt: 'Grind, bag & roll' });
          var mat = c.box(0.7, 0.01, 0.45, MAT.black, 0, 0.935, 0.05, { cast: false }); interactable(mat, { kind: 'bench', label: 'Workbench', prompt: 'Grind, bag & roll' }); c.box(0.68, 0.002, 0.43, colorMat(0x2a2d33, 0.9), 0, 0.941, 0.05, { cast: false });
          // stool, back rail with tools, a lamp, a scale, a tray of tips
          c.cyl(0.18, 0.18, 0.06, fabricMat(0x24272c), -1.0, 0.57, 0.65, 24); c.cyl(0.16, 0.16, 0.02, MAT.black, -1.0, 0.535, 0.65, 24); c.cyl(0.024, 0.024, 0.52, MAT.chrome, -1.0, 0.27, 0.65, 12); var fr = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.01, 8, 28), MAT.chrome); fr.rotation.x = Math.PI / 2; fr.position.set(-1.0, 0.24, 0.65); c.add(fr); [0, 1.57].forEach(function (a) { c.box(0.3, 0.012, 0.012, MAT.chrome, -1.0, 0.24, 0.65, { sharp: true, cast: false }).rotation.y = a; }); c.cyl(0.19, 0.21, 0.025, MAT.chrome, -1.0, 0.0125, 0.65, 28); c.solid(-1.2, -0.8, 0.45, 0.85);
          c.box(2.44, 0.54, 0.02, MAT.darkwood, 0, 1.35, -0.392, { cast: false }); c.box(0.16, 0.1, 0.12, MAT.gunmetal, 1.12, 0.98, 0.3, { r: 0.012 }); c.box(0.05, 0.11, 0.13, MAT.gunmetal, 1.12, 0.985, 0.42); c.cyl(0.008, 0.008, 0.22, MAT.chrome, 1.12, 0.96, 0.44, 8).rotation.x = Math.PI / 2; c.cyl(0.006, 0.006, 0.12, MAT.chrome, 1.12, 0.96, 0.545, 8).rotation.z = Math.PI / 2;   /* the pegboard's frame, and a vise on the corner */
          c.box(2.4, 0.5, 0.03, colorMat(0x8a6a4a, 0.9), 0, 1.35, -0.38); for (var px = -1.1; px <= 1.1; px += 0.08) for (var py = 1.15; py <= 1.55; py += 0.08) { var hole = c.cyl(0.005, 0.005, 0.04, MAT.black, px, py, -0.38, 5); hole.rotation.x = Math.PI / 2; }
          var sc = c.cyl(0.006, 0.006, 0.2, MAT.chrome, -0.9, 1.35, -0.35, 6); sc.rotation.z = 0.4; var sc2 = c.cyl(0.006, 0.006, 0.2, MAT.chrome, -0.9, 1.35, -0.35, 6); sc2.rotation.z = -0.4; c.cyl(0.02, 0.02, 0.01, colorMat(0xc94a3a, 0.5), -0.9, 1.25, -0.35, 8);   // scissors
          c.box(0.03, 0.22, 0.01, MAT.chrome, -0.6, 1.35, -0.35); c.box(0.04, 0.06, 0.012, MAT.black, -0.6, 1.25, -0.35);   // knife
          [0.3, 0.45, 0.6].forEach(function (x, i) { c.cyl(0.022, 0.022, 0.16, colorMat([0xd9ff5a, 0xffffff, 0x3ad0ff][i], 0.5), x, 1.24, -0.34, 10); });   // bottles on the rail
          c.box(0.3, 0.03, 0.3, MAT.metal, -0.75, 0.945, -0.1); c.box(0.12, 0.03, 0.08, MAT.black, -0.75, 0.96, 0.06); c.box(0.08, 0.002, 0.03, MAT.screen, -0.75, 0.976, 0.06, { cast: false });   // scale
          c.cyl(0.07, 0.075, 0.02, MAT.gunmetal, 1.05, 0.94, -0.3, 20); var ba1 = c.box(0.018, 0.5, 0.018, MAT.alu, 1.0, 1.18, -0.3, { sharp: true }); ba1.rotation.z = 0.2; var ba2 = c.box(0.018, 0.42, 0.018, MAT.alu, 0.83, 1.5, -0.24, { sharp: true }); ba2.rotation.z = 1.0; ba2.rotation.y = -0.3; c.cyl(0.014, 0.014, 0.034, MAT.soft, 0.95, 1.42, -0.3, 10).rotation.x = Math.PI / 2;
          var bsh = c.box(0.3, 0.02, 0.07, MAT.gunmetal, 0.62, 1.44, -0.16, { r: 0.006 }); bsh.rotation.z = 0.12; c.lit(0xfff0cc, 0.27, 0.05, 0.62, 1.4285, -0.16, 0, Math.PI / 2).rotation.z = 0; c.light(new THREE.PointLight(0xfff0d0, 0.4, 2.6), 0.62, 1.3, -0.05);
          c.box(0.2, 0.03, 0.14, MAT.plastic, 0.9, 0.945, 0.15); for (var t = 0; t < 8; t++) c.cyl(0.006, 0.006, 0.03, colorMat(0xd8c8a0, 0.8), 0.83 + (t % 4) * 0.045, 0.975, 0.12 + Math.floor(t / 4) * 0.06, 5);   // tip tray
          c.placard(['PROCESSING', 'grind · bag · roll'], 0.6, 0.2, -0.95, 1.1, 0.2, { titleColor: '#ffc857' }); c.dynGroup();
        }, after: function () { syncShelf(); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "bench" + ": " + e.message); }
    try { growDefProp('trash', { label: 'bin', x: ROOM.x - 0.6, z: -1.4, build: function (c) {
          // a brushed steel pedal bin: a black foot ring, a band round the rim, a domed lid on a hinge at the back, a pedal at the front
          c.cyl(0.17, 0.155, 0.5, MAT.steel, 0, 0.26, 0, 28); c.cyl(0.162, 0.168, 0.03, MAT.soft, 0, 0.015, 0, 28); c.cyl(0.176, 0.176, 0.025, MAT.chrome, 0, 0.5, 0, 28); c.box(0.09, 0.012, 0.07, MAT.soft, 0, 0.02, 0.2, { cast: false }); c.box(0.02, 0.012, 0.08, MAT.chrome, 0, 0.03, 0.15, { cast: false, sharp: true });
          var lidG = new THREE.Group(); lidG.position.set(0, 0.515, -0.17); c.add(lidG);   /* hinged at the back edge so E can lift it */ var lidTop = new THREE.Mesh(new THREE.SphereGeometry(0.182, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2), MAT.steel); lidTop.scale.y = 0.28; lidTop.position.z = 0.17; lidTop.castShadow = true; lidG.add(lidTop); var knob = new THREE.Mesh(roundCylGeo(0.18, 0.18, 0.012, 28), MAT.chrome); knob.position.set(0, -0.004, 0.17); lidG.add(knob); var hinge = new THREE.Mesh(roundCylGeo(0.012, 0.012, 0.1, 10), MAT.soft); hinge.rotation.z = Math.PI / 2; lidG.add(hinge);
          var hm = c.hit(0.5, 0.75, 0.5, 0, 0.36, 0, { kind: 'trash' }); (world.trashLids = world.trashLids || {})[hm.userData.propId] = lidG; c.solid(-0.2, 0.2, -0.2, 0.2); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "trash" + ": " + e.message); }
    try { growDefProp('crates', { label: 'crates', x: 5.3, z: -1.4, build: function (c) { crateBuild(c, -0.3, 0, 0); crateBuild(c, -0.3, 0.5, 0, 0.5); crateBuild(c, 0.3, 0, 0.05); c.solid(-0.6, 0.6, -0.3, 0.35); c.sign(['FRAGILE'], 0.3, 0.1, 0.3, 0.35, 0.33, 0, { size: 30, bg: '#f0e0c0', color: '#c9302c', titleColor: '#c9302c', line: 'rgba(0,0,0,0)' }); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "crates" + ": " + e.message); }
    try { growDefProp('cureShelf', { label: 'curing shelf', x: 6.5, z: -ROOM.z + 0.35, rot: 0, build: function (c) {
          for (var i = 0; i < 4; i++) { c.box(3.0, 0.04, 0.4, MAT.wood, 0, 0.5 + i * 0.55, 0); c.box(3.0, 0.04, 0.02, MAT.darkwood, 0, 0.5 + i * 0.55, 0.2, { cast: false }); }
          c.box(0.06, 2.3, 0.4, MAT.darkwood, -1.5, 1.15, 0); c.box(0.06, 2.3, 0.4, MAT.darkwood, 1.5, 1.15, 0); c.box(0.06, 2.3, 0.4, MAT.darkwood, 0, 1.15, 0); c.box(3.0, 2.3, 0.02, colorMat(0x2a1c10, 0.8), 0, 1.15, -0.19, { cast: false }); c.solid(-1.5, 1.5, -0.2, 0.25);
          c.hit(3.0, 2.3, 0.5, 0, 1.15, 0, { kind: 'shelf', label: 'Curing shelf', prompt: 'Curing jars' });
          for (var s = 0; s < 4; s++) c.sign([['SHELF A', 'SHELF B', 'SHELF C', 'SHELF D'][s]], 0.3, 0.06, 1.3, 0.48 + s * 0.55, 0.212, 0, { size: 24, bg: '#f3e9cf', color: '#222', titleColor: '#222', line: 'rgba(0,0,0,.3)' });
          var hyg = c.box(0.14, 0.09, 0.02, MAT.white, -1.3, 2.0, 0.2); c.sign(['62% RH'], 0.1, 0.05, -1.3, 2.0, 0.212, 0, { size: 28, bg: '#101410', titleColor: '#6fdc8c', line: 'rgba(0,0,0,0)' });
          c.sign(['CURING SHELF', 'jars gain quality while they sit'], 1.4, 0.4, 0, 2.55, 0.05, 0, { titleColor: '#6fdc8c' }); c.dynGroup();
        }, after: function () { syncShelf(); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "cureShelf" + ": " + e.message); }
    try { growDefProp('dryRack', { label: 'drying line', x: 6.25, z: -5.2, rot: 0, build: function (c) {
          var hw = 3.25, ly = 2.1;
          [-hw, hw].forEach(function (px) { c.box(0.08, ly + 0.1, 0.08, MAT.wood, px, (ly + 0.1) / 2, 0); c.box(0.7, 0.06, 0.12, MAT.wood, px, 0.03, 0); c.box(0.12, 0.06, 0.7, MAT.wood, px, 0.03, 0); var b1 = c.box(0.06, 0.9, 0.06, MAT.wood, px, 0.55, 0.28); b1.rotation.x = 0.55; var b2 = c.box(0.06, 0.9, 0.06, MAT.wood, px, 0.55, -0.28); b2.rotation.x = -0.55; c.box(0.1, 0.1, 0.1, MAT.plastic, px, ly, 0); c.solid(px - 0.36, px + 0.36, -0.36, 0.36); });
          var bar = new THREE.Mesh(roundCylGeo(0.03, 0.03, hw * 2, 12), MAT.wood); bar.rotation.z = Math.PI / 2; bar.position.set(0, ly, 0); bar.castShadow = true; c.add(bar);
          var wire = new THREE.Mesh(roundCylGeo(0.008, 0.008, hw * 2, 6), MAT.metal); wire.rotation.z = Math.PI / 2; wire.position.set(0, ly - 0.12, 0); c.add(wire);
          for (var pg = 0; pg < 12; pg++) c.box(0.02, 0.06, 0.015, colorMat(0xd9c9a0, 0.9), -hw + 0.3 + pg * 0.55, ly - 0.14, 0, { cast: false });
          c.hit(hw * 2, 0.9, 0.3, 0, ly - 0.4, 0, { kind: 'line', label: 'Drying line', prompt: 'Hang harvests here' });
          // a clip fan on the post keeps the air moving
          var fanG = new THREE.Group(); fanG.position.set(-hw + 0.1, 1.4, 0.1); fanG.rotation.y = 0.8; c.add(fanG); var fb = new THREE.Mesh(roundCylGeo(0.1, 0.1, 0.06, 16), MAT.plastic); fb.rotation.x = Math.PI / 2; fanG.add(fb); var cage = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.008, 6, 24), MAT.chrome); cage.position.z = 0.05; fanG.add(cage); var blades = new THREE.Group(); blades.position.z = 0.04; fanG.add(blades); for (var b = 0; b < 3; b++) { var blm = new THREE.Mesh(bevelGeo(0.05, 0.14, 0.004), colorMat(0xe0e0e0, 0.5)); blm.position.y = 0.08; var hold = new THREE.Group(); hold.rotation.z = b * Math.PI * 2 / 3; hold.add(blm); blades.add(hold); } c.box(0.06, 0.1, 0.08, MAT.plastic, -hw + 0.06, 1.3, 0.02); world.clipFan = blades;
          c.sign(['DRYING LINE', 'hang fresh harvests here · ~45 s'], 1.4, 0.4, 0, ly + 0.35, 0, 0, { titleColor: '#6fdc8c' }); c.dynGroup();
        }, after: function () { syncShelf(); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "dryRack" + ": " + e.message); }
    try { growDefProp('dryTable', { label: 'scale table', x: 1.2, z: -3.2, rot: 0, build: function (c) { c.box(0.9, 0.05, 0.6, MAT.wood, 0, 0.78, 0, { solid: true }); legs4(c, 0.9, 0.6, 0.76, MAT.metal); c.box(0.3, 0.03, 0.3, MAT.metal, 0, 0.82, 0); c.box(0.12, 0.025, 0.08, MAT.black, 0, 0.85, 0.15); c.box(0.08, 0.002, 0.03, MAT.screen, 0, 0.864, 0.15, { cast: false }); c.box(0.2, 0.01, 0.28, MAT.white, -0.3, 0.81, 0.05, { cast: false }); c.cyl(0.005, 0.005, 0.12, colorMat(0x2a4a8a, 0.4), -0.25, 0.815, 0.1, 6).rotation.set(Math.PI / 2, 0, 0.5); c.cyl(0.06, 0.06, 0.14, MAT.jar, 0.3, 0.88, -0.15, 12); c.cyl(0.062, 0.062, 0.015, MAT.jarLid, 0.3, 0.955, -0.15, 12); c.box(0.16, 0.1, 0.16, colorMat(0xe8e8ee, 0.6), 0.32, 0.86, 0.15); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "dryTable" + ": " + e.message); }
    try { growDefProp('jarBoxes', { label: 'jar boxes', x: 10.6, z: -8.2, build: function (c) { var bxM = colorMat(0xc8a97a, 1); [[0.3, 0, 0], [0.3, 0, 0.42], [-0.3, 0, 0]].forEach(function (b) { c.box(0.5, 0.4, 0.5, bxM, b[0], 0.2 + b[2], b[1], { solid: b[2] === 0 }); c.box(0.52, 0.03, 0.52, colorMat(0xb08c5a, 1), b[0], 0.4 + b[2], b[1], { cast: false }); c.box(0.5, 0.06, 0.02, colorMat(0xb08c5a, 1), b[0], 0.2 + b[2], b[1] + 0.25, { cast: false }); c.sign(['JARS ×12'], 0.3, 0.08, b[0], 0.15 + b[2], b[1] + 0.26, 0, { size: 24, bg: '#f3e9cf', color: '#222', titleColor: '#222', line: 'rgba(0,0,0,.3)' }); }); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "jarBoxes" + ": " + e.message); }
    try { growDefProp('hose', { label: 'hose reel + watering can', x: -ROOM.x + 0.55, z: -3.0, rot: 1, build: function (c) {
          c.box(0.5, 0.06, 0.5, MAT.metal, -0.15, 0.03, 0); c.box(0.06, 1.8, 0.06, MAT.metal, -0.15, 0.9, 0); c.box(0.2, 0.06, 0.06, MAT.metal, -0.15, 1.1, -0.15);
          var reel = c.cyl(0.28, 0.28, 0.14, colorMat(0x2f7a34, 0.6), -0.15, 1.1, 0.08); reel.rotation.x = Math.PI / 2; for (var r = 0; r < 5; r++) { var loop = new THREE.Mesh(new THREE.TorusGeometry(0.2 + r * 0.015, 0.012, 6, 24), colorMat(0x3a8f40, 0.7)); loop.position.set(-0.15, 1.1, 0.08 + (r - 2) * 0.03); c.add(loop); }
          var hub = c.cyl(0.16, 0.16, 0.18, MAT.metal, -0.15, 1.1, 0.08); hub.rotation.x = Math.PI / 2; var crank = c.box(0.03, 0.14, 0.03, MAT.black, -0.06, 1.17, 0.19); var knob = c.cyl(0.015, 0.015, 0.08, MAT.plastic, -0.06, 1.24, 0.23, 8); knob.rotation.x = Math.PI / 2;
          var nozzle = c.cyl(0.02, 0.03, 0.14, colorMat(0xffc857, 0.4), -0.35, 0.6, 0.1, 8); nozzle.rotation.z = 0.5; var hoseTail = c.cyl(0.012, 0.012, 0.5, colorMat(0x3a8f40, 0.7), -0.3, 0.82, 0.1, 6); hoseTail.rotation.z = 0.3;
          var tap = c.box(0.06, 0.06, 0.06, MAT.chrome, -0.15, 0.45, -0.28); var wheel = c.cyl(0.04, 0.04, 0.02, colorMat(0xc94a3a, 0.5), -0.15, 0.5, -0.28, 12);
          var canM = colorMat(0x3a8fd6, 0.45, 0.35);
          c.cyl(0.13, 0.15, 0.3, canM, 0.35, 0.15, 0.1, 20); c.cyl(0.14, 0.14, 0.02, colorMat(0x2a6fb0, 0.45, 0.35), 0.35, 0.3, 0.1, 20); c.cyl(0.05, 0.05, 0.04, canM, 0.35, 0.32, 0.1, 12);
          var spout = c.cyl(0.018, 0.028, 0.36, canM, 0.55, 0.3, 0.1, 8); spout.rotation.z = -0.95; var rose = c.cyl(0.05, 0.035, 0.05, canM, 0.69, 0.42, 0.1, 12); rose.rotation.z = -0.95; c.cyl(0.048, 0.048, 0.01, colorMat(0x8a8f96, 0.5, 0.5), 0.71, 0.435, 0.1, 12).rotation.z = -0.95;
          var handle = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.014, 8, 20, Math.PI), canM); handle.position.set(0.35, 0.3, 0.1); c.add(handle); var handle2 = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 8, 16, Math.PI * 0.6), canM); handle2.position.set(0.26, 0.2, 0.1); handle2.rotation.z = Math.PI * 0.35; c.add(handle2);
          c.hit(0.5, 0.55, 0.5, 0.35, 0.27, 0.1, { kind: 'water', label: 'Watering can', prompt: 'Water a plant' }); c.solid(-0.4, 0.15, -0.3, 0.3);
          c.sign(['WATER', 'grab the can · E on a plant'], 0.6, 0.2, -0.15, 1.68, 0.1, 0, { titleColor: '#6fc3ff' });
        } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "hose" + ": " + e.message); }
    try { growDefProp('fan', { label: 'floor fan', x: -2.0, z: -7.9, rot: 0, build: function (c) {
          var fbase = new THREE.Mesh(roundCylGeo(0.2, 0.22, 0.04, 20), MAT.black); fbase.position.y = 0.02; c.add(fbase); c.box(0.06, 0.03, 0.06, colorMat(0x8a8f96, 0.5), 0.1, 0.05, 0.1, { cast: false });
          var fpole = new THREE.Mesh(roundCylGeo(0.02, 0.02, 0.9, 10), MAT.chrome); fpole.position.y = 0.47; c.add(fpole); c.cyl(0.03, 0.03, 0.05, MAT.plastic, 0, 0.5, 0, 10);
          world.fanHead = new THREE.Group(); world.fanHead.position.y = 0.95; c.add(world.fanHead);
          var motor = new THREE.Mesh(roundCylGeo(0.06, 0.06, 0.16, 14), MAT.plastic); motor.rotation.x = Math.PI / 2; motor.position.z = -0.1; world.fanHead.add(motor);
          world.fanHead.add(new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.012, 6, 28), MAT.chrome)); var cageBack = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.02, 28, 1, true), MAT.chrome); cageBack.rotation.x = Math.PI / 2; cageBack.position.z = -0.05; world.fanHead.add(cageBack);
          for (var w = 0; w < 12; w++) { var wire = new THREE.Mesh(bevelGeo(0.004, 0.44, 0.004), MAT.chrome); wire.rotation.z = w * Math.PI / 12; wire.position.z = 0.02; world.fanHead.add(wire); }
          var hubc = new THREE.Mesh(roundCylGeo(0.03, 0.03, 0.03, 12), MAT.plastic); hubc.rotation.x = Math.PI / 2; hubc.position.z = 0.02; world.fanHead.add(hubc);
          world.fanBlades = new THREE.Group(); world.fanHead.add(world.fanBlades);
          for (var b = 0; b < 3; b++) { var bl = new THREE.Mesh(bevelGeo(0.08, 0.19, 0.005), colorMat(0xdddddd, 0.5)); bl.position.y = 0.1; bl.rotation.y = 0.3; var holder = new THREE.Group(); holder.rotation.z = b * Math.PI * 2 / 3; holder.add(bl); world.fanBlades.add(holder); }
          c.solid(-0.22, 0.22, -0.22, 0.22);
        }, after: function (c, P) { world.fanBaseYaw = Math.atan2(TENT_ORIGIN.x - P.x, TENT_ORIGIN.z - P.z) - P.rot * Math.PI / 2; } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "fan" + ": " + e.message); }
    try { growDefProp('soilSacks', { label: 'soil sacks', x: -11.3, z: -5.2, build: function (c) { var sackM = new THREE.MeshStandardMaterial({ map: TEX.fabric, color: 0x5a3a22, roughness: 1 }); [[0, 0, 0, 0.1], [0, 0, 0.3, -0.2], [0.55, 0, 0, 0.3]].forEach(function (b) { var s = c.box(0.5, 0.28, 0.35, sackM, b[0], 0.14 + b[2], b[1], { solid: b[2] === 0, r: 0.09 }); s.rotation.y = b[3]; c.sign(['POTTING SOIL', '25 L'], 0.3, 0.12, b[0], 0.14 + b[2], b[1] + 0.176, b[3], { size: 26, bg: '#e8dcc0', color: '#3a2a1a', titleColor: '#1a6a2a', line: 'rgba(0,0,0,0)' }); }); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "soilSacks" + ": " + e.message); }
    try { growDefProp('bucket', { label: 'bucket', x: -11.2, z: -3.9, build: function (c) { c.cyl(0.16, 0.13, 0.3, colorMat(0x2f7a34, 0.6), 0, 0.15, 0); c.cyl(0.165, 0.165, 0.02, colorMat(0x255f2a, 0.6), 0, 0.3, 0); var hd = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.008, 6, 20, Math.PI), MAT.chrome); hd.position.y = 0.3; hd.rotation.z = 0; c.add(hd); c.cyl(0.14, 0.14, 0.01, new THREE.MeshPhysicalMaterial({ color: 0x6fb0e0, transparent: true, opacity: 0.6 }), 0, 0.25, 0, 20); c.solid(-0.2, 0.2, -0.2, 0.2); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "bucket" + ": " + e.message); }
    try { growDefProp('potShelf', { label: 'pot shelf', x: -9.5, z: -ROOM.z + 0.3, rot: 0, build: function (c) { [0.4, 1.0, 1.6].forEach(function (y) { c.box(1.2, 0.03, 0.3, MAT.wood, 0, y, 0); c.box(1.2, 0.03, 0.02, MAT.darkwood, 0, y, 0.15, { cast: false }); }); [-0.55, 0.55].forEach(function (x) { c.box(0.04, 1.7, 0.3, MAT.metal, x, 0.85, 0); }); for (var p = 0; p < 3; p++) { for (var st = 0; st < 3; st++) { c.cyl(0.12 - st * 0.01, 0.09, 0.14, MAT.pot, -0.4 + p * 0.4, 1.69 + st * 0.03, 0, 16); } c.cyl(0.12, 0.09, 0.16, MAT.pot, -0.4 + p * 0.4, 1.1, 0, 16); c.cyl(0.125, 0.125, 0.02, MAT.pot, -0.4 + p * 0.4, 1.18, 0, 16); } c.box(0.3, 0.2, 0.2, colorMat(0xe8e8ee, 0.6), -0.3, 0.52, 0); c.cyl(0.08, 0.08, 0.2, MAT.jar, 0.3, 0.52, 0, 12); c.sign(['POTS', 'spares'], 0.4, 0.12, 0, 1.85, 0.02, 0, { titleColor: '#6fdc8c' }); c.solid(-0.6, 0.6, -0.15, 0.15); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "potShelf" + ": " + e.message); }
    try { growDefProp('tent', { label: 'grow tent', x: -6.6, z: -6.1, rot: 0, build: function (c, P) { TENT_ORIGIN.x = P.x; TENT_ORIGIN.z = P.z; buildTent(); if (world.tentGroup) world.tentGroup.traverse(function (o) { if (o.isMesh) o.userData.propId = 'tent'; }); }, after: function () { if (propInst.fan) { var f = propInst.fan; world.fanBaseYaw = Math.atan2(TENT_ORIGIN.x - f.P.x, TENT_ORIGIN.z - f.P.z) - f.P.rot * Math.PI / 2; } } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "tent" + ": " + e.message); }
    try { growDefProp('lobbyBenchL', { label: 'lobby bench', x: -8.5, z: 8.2, rot: 2, build: lobbyBench }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "lobbyBenchL" + ": " + e.message); }
    try { growDefProp('lobbyBenchR', { label: 'lobby bench', x: 8.5, z: 8.2, rot: 2, build: lobbyBench }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "lobbyBenchR" + ": " + e.message); }
    try { growDefProp('magTable', { label: 'magazine table', x: -6.6, z: 7.6, build: function (c) { c.cyl(0.32, 0.32, 0.03, MAT.wood, 0, 0.45, 0, 24); c.cyl(0.03, 0.03, 0.44, MAT.chrome, 0, 0.22, 0, 10); c.cyl(0.2, 0.22, 0.02, MAT.chrome, 0, 0.01, 0, 24); c.box(0.3, 0.01, 0.22, new THREE.MeshBasicMaterial({ map: signTex(['HIGH', 'times'], 150, 110, { size: 34, bg: '#6fdc8c', color: '#062010', titleColor: '#062010', line: 'rgba(0,0,0,0)' }) }), -0.05, 0.47, 0, { cast: false }); c.box(0.3, 0.01, 0.22, new THREE.MeshBasicMaterial({ map: signTex(['GROW', 'weekly'], 150, 110, { size: 34, bg: '#ffc857', color: '#332200', titleColor: '#332200', line: 'rgba(0,0,0,0)' }) }), 0.1, 0.48, -0.05, { cast: false }).rotation.y = 0.3; c.solid(-0.33, 0.33, -0.33, 0.33); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "magTable" + ": " + e.message); }
    try { growDefProp('queueRope', { label: 'rope line', x: 0.35, z: 7.45, rot: 0, multi: { max: 8, price: 40, gap: 2.2, ico: '🪢', name: 'Rope line' }, build: ropeBuild }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "queueRope" + ": " + e.message); }
    try { growDefProp('lobbyPlant', { label: 'lobby plant', x: -10.5, z: 5.0, build: function (c) {
          // a rubber plant in a tall charcoal planter: a woody stem, glossy leaves climbing it in a spiral
          c.cyl(0.26, 0.2, 0.5, colorMat(0x2a2d33, 0.35, 0.1), 0, 0.26, 0, 32); c.cyl(0.275, 0.262, 0.04, colorMat(0x1f2226, 0.35, 0.1), 0, 0.5, 0, 32); c.cyl(0.21, 0.21, 0.025, MAT.soft, 0, 0.0125, 0, 28); c.cyl(0.24, 0.24, 0.02, MAT.soil, 0, 0.51, 0, 24);
          c.cyl(0.014, 0.024, 1.1, MAT.bark, 0, 1.05, 0, 10); c.cyl(0.01, 0.014, 0.5, MAT.bark, 0.05, 1.5, 0.02, 8).rotation.z = -0.22; c.cyl(0.01, 0.014, 0.45, MAT.bark, -0.05, 1.35, -0.03, 8).rotation.z = 0.3;
          for (var i = 0; i < 18; i++) { var a = i * 2.399, y = 0.75 + i * 0.058; leafAt(BIGLEAF_GEO, MAT.bigleaf, Math.cos(a) * 0.03, y, Math.sin(a) * 0.03, Math.PI / 2 - a, 0.7 + (i % 4) * 0.12 - i * 0.02, 0.85 + (i % 3) * 0.12, c.group); }
          c.solid(-0.3, 0.3, -0.3, 0.3); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "lobbyPlant" + ": " + e.message); }
    try { growDefProp('lobbyCoffee', { label: 'lobby coffee machine', x: ROOM.x - 0.4, z: 8.1, rot: 3, multi: { max: 4, price: 600, gap: 0.95, ico: '☕', lic: 'catering', upg: 'lobby', name: 'Coffee machine' }, build: function (c) {
          if (!S.upgrades.lobby) return;   // stand + machine appear with the upgrade
          c.box(0.6, 0.9, 0.5, MAT.darkwood, 0, 0.45, 0, { solid: true }); c.box(0.66, 0.04, 0.56, MAT.counterTop, 0, 0.92, 0, { cast: false });
          // a bean-to-cup machine: the upper half overhangs a brew bay, the cup stands on a grille under two nozzles, a lit screen and
          // three buttons on the fascia. It stands against a back board that carries the sign, so nothing is propped up in front of it.
          var body = colorMat(0x16171b, 0.25, 0.4), chrome = MAT.chrome, fascia = MAT.steel;
          c.box(0.64, 1.0, 0.03, MAT.darkwood, 0, 1.44, -0.262, { cast: false }); c.box(0.68, 0.05, 0.08, MAT.darkwood, 0, 1.96, -0.24, { r: 0.012 });
          c.box(0.36, 0.18, 0.24, body, 0, 1.03, -0.11, { r: 0.012 }); c.box(0.36, 0.28, 0.38, body, 0, 1.26, -0.04, { r: 0.03 });                                  /* the foot, and the head that overhangs it */
          [-0.165, 0.165].forEach(function (x) { c.box(0.03, 0.18, 0.15, body, x, 1.03, 0.075, { r: 0.008 }); });                                                        /* cheeks either side of the bay */
          c.box(0.3, 0.17, 0.006, fascia, 0, 1.03, 0.013, { cast: false, sharp: true });                                                                                 /* the back of the bay */
          c.box(0.09, 0.035, 0.07, chrome, 0, 1.105, 0.095, { cast: false, r: 0.008 }); [-0.02, 0.02].forEach(function (x) { c.cyl(0.007, 0.005, 0.03, chrome, x, 1.075, 0.1, 8); });   /* the spout and its two nozzles */
          c.box(0.34, 0.034, 0.17, body, 0, 0.957, 0.075, { r: 0.008 }); for (var gs = 0; gs < 7; gs++) c.box(0.27, 0.004, 0.012, chrome, 0, 0.976, 0.015 + gs * 0.02, { cast: false, sharp: true });   /* the drip tray and its grille */
          c.box(0.33, 0.24, 0.008, fascia, 0, 1.265, 0.151, { cast: false, r: 0.006 }); c.box(0.36, 0.012, 0.006, chrome, 0, 1.135, 0.152, { cast: false });
          c.box(0.215, 0.13, 0.008, MAT.gloss, -0.04, 1.29, 0.157, { cast: false, r: 0.006 });
          var cscr = new THREE.Mesh(new THREE.PlaneGeometry(0.195, 0.11), new THREE.MeshBasicMaterial({ map: signTex(['COFFEE', 'espresso · latte · tea'], 312, 176, { size: 44, bg: '#0a1410', color: '#9fd8b4', titleColor: '#f0b94d', line: 'rgba(0,0,0,0)' }), toneMapped: false })); cscr.position.set(-0.04, 1.29, 0.1615); c.add(cscr);
          [[1.335, 0x6fdc8c], [1.29, 0xf0b94d], [1.245, 0xe8eef4]].forEach(function (k) { var bt = c.cyl(0.015, 0.015, 0.012, colorMat(k[1], 0.3), 0.125, k[0], 0.157, 14); bt.rotation.x = Math.PI / 2; });
          c.lit(0x6fdc8c, 0.012, 0.012, 0.125, 1.2, 0.1565); c.box(0.12, 0.014, 0.004, chrome, -0.04, 1.2, 0.156, { cast: false });
          c.cyl(0.108, 0.112, 0.02, body, 0, 1.408, -0.04, 24);                                                                                                         /* the collar the hopper sits in */
          // the bean hopper on top: a clear cone you can see the level in, with a lid that lifts
          var hop = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.096, 0.17, 24, 1, true), new THREE.MeshPhysicalMaterial({ color: 0xdff0ff, transparent: true, opacity: 0.28, roughness: 0.05, side: THREE.DoubleSide }));
          hop.position.set(0, 1.49, -0.04); hop.castShadow = false; c.add(hop);
          var lid = new THREE.Group(); lid.position.set(0, 1.575, -0.15); c.add(lid); lid.userData.coffLid = true;
          var lm = new THREE.Mesh(roundCylGeo(0.104, 0.104, 0.018, 24), body); lm.position.set(0, 0, 0.11); lid.add(lm); var lk = new THREE.Mesh(roundCylGeo(0.018, 0.022, 0.02, 12), MAT.chrome); lk.position.set(0, 0.018, 0.11); lid.add(lk);
          var beans = new THREE.Mesh(roundCylGeo(0.093, 0.09, 0.12, 20), new THREE.MeshStandardMaterial({ map: TEX.soil || null, color: 0x3a2010, roughness: 1 }));
          beans.position.set(0, 1.46, -0.04); beans.castShadow = false; c.add(beans); beans.userData.coffBeans = true;
          // the cup stack beside it, and the cup that lands under the spout
          var cups = new THREE.Group(); cups.position.set(0.21, 0.96, -0.08); c.add(cups); cups.userData.coffCups = true; cups.userData.slots = [];
          var brewG = new THREE.Group(); brewG.position.set(0, 1.026, 0.095); c.add(brewG); brewG.userData.coffBrew = true;
          c.hit(0.72, 1.6, 0.62, 0, 0.8, 0, { kind: 'lobbyCoffee' });
          var cupHit = c.hit(0.24, 0.2, 0.22, 0, 1.02, 0.12, { kind: 'coffeeCup' }); cupHit.userData.coffCupHit = true;   /* parked out of the world while there is no cup, so it never steals the machine's own prompt */
          c.sign(['COFFEE', 'help yourself · $2 a cup'], 0.5, 0.16, 0, 1.8, -0.244, 0, { titleColor: '#ffc857' });
        }, after: function (c, P, inst, id) { syncCoffee(id); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "lobbyCoffee" + ": " + e.message); }
    try { growDefProp('vending', { label: 'vending machine', x: ROOM.x - 0.5, z: 6.8, rot: 3, multi: { max: 4, price: 900, gap: 1.15, ico: '🥤', lic: 'catering' }, build: function (c, P) {
          var SKIN = [[0x8f1f1a, '#ffc857'], [0x14507a, '#8fd0ff'], [0x1d6b45, '#b6f2c9'], [0x2b2f36, '#e8eef4']];   /* a row of identical red machines would read as a copy-paste, so every unit gets its own livery */
          var sk = SKIN[(((P && P.unit) || 1) - 1) % SKIN.length];
          var shell = colorMat(sk[0], 0.45, 0.25), dark = colorMat(0x1a1d21, 0.6), steel = colorMat(0x9aa0a6, 0.35, 0.7), inner = colorMat(0x23272c, 0.8);
          // a shell, not a block: the front-left is left open so you can see the stock behind the glass
          c.box(0.95, 1.95, 0.06, inner, 0, 0.975, -0.33, { cast: false });          /* back */
          c.box(0.06, 1.95, 0.72, shell, -0.445, 0.975, 0);                          /* left side */
          c.box(0.06, 1.95, 0.72, shell, 0.445, 0.975, 0);                           /* right side */
          c.box(0.95, 0.06, 0.72, shell, 0, 1.92, 0, { cast: false });               /* top */
          c.box(0.95, 0.16, 0.72, dark, 0, 0.08, 0);                                 /* kick plate */
          c.box(0.26, 1.78, 0.72, shell, 0.315, 1.03, 0);                            /* the keypad pillar */
          c.box(0.62, 0.04, 0.68, inner, -0.13, 0.62, 0.01, { cast: false });        /* floor of the cabinet */
          c.solid(-0.48, 0.48, -0.37, 0.37);
          c.box(0.99, 0.05, 0.76, dark, 0, 1.97, 0, { cast: false });
          c.box(0.86, 0.24, 0.03, dark, 0, 1.79, 0.355, { cast: false });
          c.sign(['SNACKS & DRINKS'], 0.78, 0.15, 0, 1.79, 0.373, 0, { size: 30, bold: true, bg: '#101812', titleColor: sk[1], line: 'rgba(255,255,255,.35)' });
      
          // the glazed service door, hinged on the left upright
          var door = new THREE.Group(); door.position.set(-0.43, 1.12, 0.345); c.add(door); door.userData.vendDoor = true;
          function dbox(w, h2, d2, m, x, y, z, noCast) { var b = new THREE.Mesh(bevelGeo(w, h2, d2), m); b.position.set(x, y, z); b.castShadow = !noCast; door.add(b); return b; }
          dbox(0.04, 1.42, 0.05, shell, 0, 0, 0);
          dbox(0.04, 1.42, 0.05, shell, 0.6, 0, 0);
          dbox(0.64, 0.05, 0.05, shell, 0.3, 0.685, 0, true);
          dbox(0.64, 0.05, 0.05, shell, 0.3, -0.685, 0, true);
          var glass = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 1.36), new THREE.MeshPhysicalMaterial({ color: 0xdff0ff, transparent: true, opacity: 0.18, roughness: 0.02, metalness: 0.05, side: THREE.DoubleSide }));
          glass.position.set(0.3, 0, 0.004); glass.castShadow = false; door.add(glass);
          var handle = new THREE.Mesh(bevelGeo(0.025, 0.3, 0.05), steel); handle.position.set(0.56, 0, 0.05); door.add(handle);
      
          // the racks, which ride out with the door
          var racks = new THREE.Group(); racks.position.set(-0.13, 1.06, 0.02); c.add(racks); racks.userData.vendRacks = true;
          for (var r = 0; r < 4; r++) {
            var sy = 0.5 - r * 0.29;
            var shelf = new THREE.Mesh(bevelGeo(0.6, 0.012, 0.4), colorMat(0x3a3d42, 0.5)); shelf.position.set(0, sy, 0); shelf.castShadow = false; racks.add(shelf);
            for (var k = 0; k < 4; k++) {
              var coil = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.0032, 5, 10), steel);
              coil.position.set(-0.215 + k * 0.143, sy + 0.032, 0.13); coil.rotation.x = Math.PI / 2; coil.castShadow = false; racks.add(coil);
            }
          }
          racks.userData.slots = [];
      
          // the delivery tray, its flap, and the hit box you press E on to reach in
          c.box(0.62, 0.03, 0.34, dark, -0.13, 0.3, 0.08, { cast: false });
          c.box(0.66, 0.02, 0.36, dark, -0.13, 0.58, 0.08, { cast: false });
          var flap = new THREE.Mesh(bevelGeo(0.56, 0.24, 0.012), new THREE.MeshPhysicalMaterial({ color: 0x2a2f36, transparent: true, opacity: 0.5, roughness: 0.2 }));
          flap.position.set(-0.13, 0.44, 0.358); flap.castShadow = false; c.add(flap); flap.userData.vendFlap = true;
          c.hit(0.6, 0.3, 0.34, -0.13, 0.42, 0.2, { kind: 'vendTray' });
          var tray = new THREE.Group(); tray.position.set(-0.13, 0.33, 0.1); c.add(tray); tray.userData.vendTray = true;
      
          // the panel
          c.box(0.2, 0.14, 0.02, MAT.screen, 0.315, 1.6, 0.362, { cast: false });
          var disp = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.12), new THREE.MeshBasicMaterial({ map: signTex(['READY'], 200, 130, { size: 48, bg: '#08120c', color: '#6fdc8c', titleColor: '#6fdc8c', line: 'rgba(0,0,0,0)' }), transparent: true }));
          disp.position.set(0.315, 1.6, 0.3735); disp.castShadow = false; c.add(disp); disp.userData.vendDisp = true;
          for (var bq = 0; bq < 6; bq++) {
            var bx2 = 0.265 + (bq % 2) * 0.1, by2 = 1.4 - Math.floor(bq / 2) * 0.12;
            c.box(0.075, 0.075, 0.018, colorMat(bq === 0 ? 0x6fdc8c : 0xd8dce0, 0.4), bx2, by2, 0.366, { cast: false });
          }
          c.box(0.1, 0.014, 0.02, MAT.chrome, 0.315, 1.05, 0.368, { cast: false });
          c.box(0.07, 0.06, 0.02, dark, 0.315, 0.92, 0.368, { cast: false });
          c.hit(0.95, 1.95, 0.75, 0, 0.97, 0, { kind: 'vending' });
          c.light(new THREE.PointLight(0xbfe8ff, 0.5, 2.6), -0.13, 1.5, 0.2);
        }, after: function (c, P, inst, id) { syncVending(id); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "vending" + ": " + e.message); }
    try { growDefProp('menuScreen', { label: 'menu screen', x: 4.0, z: 4 + WALL_T / 2 + 0.05, rot: 0, build: function (c) {
          // the menu board over the lobby: a lit panel in the same housing as every other screen in the shop
          var mg = new THREE.Group(); mg.position.set(0, 2.05, 0.03); c.add(mg); screenShell(mg, 1.3, 0.72, { bezel: 0.03, depth: 0.04 });
          var cv = document.createElement('canvas'); cv.width = 1040; cv.height = 576; var x2 = cv.getContext('2d'); scrBg(x2, 1040, 576, DESK_OK);
          x2.textAlign = 'left'; x2.textBaseline = 'top'; x2.fillStyle = DESK_OK; x2.font = '700 84px ' + SIGN_FONT; x2.fillText('Today', 60, 48); x2.fillStyle = scrRgba(DESK_OK, 0.5); x2.fillRect(60, 156, 920, 3);
          [['Eighths', 'bagged fresh at the bench'], ['Joints', 'rolled by hand, one strain each'], ['Top shelf', 'on request at the window']].forEach(function (r, i) { var y = 186 + i * 104; x2.fillStyle = DESK_INK; x2.font = '600 54px ' + SIGN_FONT; x2.fillText(r[0], 60, y); x2.fillStyle = DESK_DIM; x2.font = '32px ' + SIGN_FONT; x2.fillText(r[1], 62, y + 58); });
          x2.fillStyle = DESK_WARN; x2.font = '600 34px ' + SIGN_FONT; x2.textAlign = 'right'; x2.fillText('ID required', 980, 72);
          var scr = litPlane(cv, 1.3, 0.72); scr.position.z = 0.0005; mg.add(scr); var gl = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.72), MAT.screenGlass); gl.position.z = 0.0016; mg.add(gl); c.light(new THREE.PointLight(0x6fdc8c, 0.25, 3), 0, 2.0, 0.4);
        } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "menuScreen" + ": " + e.message); }
    try { growDefProp('goodsShelf', { label: 'goods shelf', x: 6.5, z: 3.55, rot: 2, build: function (c) {
          var wood = MAT.darkwood, w = goodsWidth(), d = 0.42, cols = goodsCols();
          c.box(w, 0.05, d, wood, 0, 0.16, 0, { solid: true }); [0.74, 1.3, 1.86].forEach(function (y) { c.box(w, 0.035, d, wood, 0, y, 0); });
          c.box(w, 2.0, 0.03, colorMat(0x2b2119, 0.9), 0, 1.0, -d / 2 + 0.015, { cast: false });   // back panel
          [-1, 1].forEach(function (s) { c.box(0.05, 2.0, d, wood, s * (w / 2 - 0.025), 1.0, 0); });
          for (var dv = 1; dv < cols; dv++) c.box(0.05, 1.8, d, wood, (dv - cols / 2) * GOODS_CELL, 1.06, 0);   // uprights, and a divider between every pair of cells
          c.box(w, 0.06, d + 0.02, wood, 0, 2.03, 0);
          c.sign(['GROW CO.', 'house menu · bags & joints'], Math.min(w - 0.2, 2.2), 0.3, 0, 2.2, 0.0, 0, { titleColor: '#6fdc8c', bg: '#0f1a12' });
          for (var i = 0; i < cols + 1; i++) c.add(spot(0xfff1d0, 0.35, 1.2, (i - cols / 2) * GOODS_CELL, 1.98, 0.12));   // a downlight over every divider
          var gg = c.dynGroup(); var gsh = new THREE.Group(); var gst = colorMat(0xa7adb4, 0.35, 0.8), gdk = colorMat(0x5b6168, 0.4, 0.7);
          var gpanel = new THREE.Mesh(bevelGeo(w - 0.12, 1.9, 0.014), gst); gsh.add(gpanel);
          for (var gs = 0; gs < 17; gs++) { var gbar = new THREE.Mesh(bevelGeo(w - 0.12, 0.012, 0.02), gdk); gbar.position.y = -0.9 + gs * 0.113; gsh.add(gbar); }
          var ghd = new THREE.Mesh(bevelGeo(0.3, 0.035, 0.035), gdk); ghd.position.set(0, -0.86, 0.02); gsh.add(ghd);
          gsh.position.set(0, 1.02, d / 2 + 0.05);   /* in front of the price cards, which hang off the shelf lips */ gg.userData.shutter = gsh; gg.add(gsh);
          var fz = d / 2 + 0.05, fd = 0.1;   /* the gate cannot sit flush without clipping the price cards, so an outer frame closes the slot it leaves at the edges */
          [-1, 1].forEach(function (s) { c.box(0.05, 2.0, fd, wood, s * (w / 2 - 0.025), 1.0, fz); }); c.box(w, 0.2, fd, wood, 0, 1.9, fz); c.box(w, 0.08, fd, wood, 0, 0.04, fz); c.box(w + 0.03, 0.06, fd + 0.04, wood, 0, 2.03, fz);   /* jambs, a head box hiding the rolled-up gate, a sill it lands on, and the shelf top carried over the frame */
          c.hit(w, 2.0, d, 0, 1.0, 0, { kind: 'goodsShelf' });
          function spot(col, inten, dist, x, y, z) { var l = new THREE.PointLight(col, inten, dist); l.position.set(x, y, z); return l; }
        }, after: function () { syncGoods(); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "goodsShelf" + ": " + e.message); }
    try { growDefProp('stockCabinet', { label: 'stock cabinet', x: 7.55, z: -11.9, rot: 3, build: function (c) {
          // a steel security cabinet: two doors with pressed panels and louvres, bar handles, three hinges a side, a keypad lock, a plinth
          var steel = colorMat(0x505761, 0.42, 0.65), doorM = colorMat(0x5b626c, 0.38, 0.65), dark = colorMat(0x2a2d33, 0.5, 0.5);
          c.box(1.2, 1.94, 0.55, steel, 0, 1.03, 0, { solid: true }); c.box(1.24, 0.04, 0.59, dark, 0, 2.02, 0); c.box(1.16, 0.06, 0.51, dark, 0, 0.03, 0);
          [-0.3, 0.3].forEach(function (x) { var sd = x < 0 ? -1 : 1; c.box(0.575, 1.86, 0.006, MAT.black, x, 1.03, 0.277, { cast: false, sharp: true }); c.box(0.56, 1.845, 0.024, doorM, x, 1.03, 0.287, { r: 0.006 }); c.box(0.44, 0.7, 0.008, steel, x, 0.62, 0.301, { cast: false, r: 0.003 }); c.box(0.44, 0.62, 0.008, steel, x, 1.42, 0.301, { cast: false, r: 0.003 }); for (var v = 0; v < 5; v++) c.box(0.3, 0.014, 0.006, MAT.black, x, 1.78 + v * 0.03, 0.302, { cast: false, sharp: true });
            c.cyl(0.009, 0.009, 0.3, MAT.chrome, x - sd * 0.23, 1.05, 0.325, 10); [-0.12, 0.12].forEach(function (dy) { c.box(0.016, 0.016, 0.03, MAT.chrome, x - sd * 0.23, 1.05 + dy, 0.31, { cast: false, sharp: true }); }); [0.3, 1.03, 1.76].forEach(function (y) { c.cyl(0.012, 0.012, 0.09, dark, x + sd * 0.285, y, 0.29, 10); }); });
          c.box(0.09, 0.13, 0.03, MAT.gloss, 0, 1.3, 0.305, { r: 0.006 }); for (var kk = 0; kk < 9; kk++) c.box(0.016, 0.016, 0.004, colorMat(0xb9c0c6, 0.5), -0.024 + (kk % 3) * 0.024, 1.3 - Math.floor(kk / 3) * 0.024, 0.3215, { cast: false, sharp: true }); c.lit(0x6fdc8c, 0.012, 0.012, 0.024, 1.345, 0.3205); c.lit(0x5a1a1a, 0.012, 0.012, -0.024, 1.345, 0.3205);   // keypad lock
          c.sign(['STOCK', 'packed goods · locked'], 0.4, 0.13, 0.3, 1.62, 0.306, 0, { size: 22, bg: '#f3e9cf', color: '#222', titleColor: '#1a6a2a', line: 'rgba(0,0,0,.3)' });
          c.hit(1.3, 2.0, 0.8, 0, 1.0, 0.1, { kind: 'stock' });
        } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "stockCabinet" + ": " + e.message); }
    try { growDefProp('storeRack', { label: 'storage racking', x: 0.5, z: -10.85, rot: 1, build: function (c) {
          var frameM = colorMat(0x2a5aa8, 0.45, 0.5), beamM = colorMat(0xe07a1f, 0.45, 0.4), deckM = colorMat(0x9aa0a6, 0.4, 0.8);
          [-1.5, 0, 1.5].forEach(function (x) { [-0.26, 0.26].forEach(function (z) { c.box(0.06, 2.3, 0.06, frameM, x, 1.15, z); }); for (var b = 0; b < 5; b++) c.box(0.03, 0.03, 0.5, frameM, x, 0.25 + b * 0.45, 0); });   /* uprights with their cross braces */
          RACK.y.forEach(function (y) { [-0.27, 0.27].forEach(function (z) { c.box(3.06, 0.07, 0.04, beamM, 0, y - 0.035, z); }); c.box(2.96, 0.015, 0.5, deckM, 0, y + 0.005, 0); });
          c.solid(-1.55, 1.55, -0.32, 0.32); c.hit(3.1, 2.3, 0.6, 0, 1.15, 0, { kind: 'storage' });
          c.sign(['STORAGE', 'deliveries land here · E takes a crate · E with a crate racks it'], 1.9, 0.32, 0, 2.5, 0.02, 0, { titleColor: '#ffc857' }); c.dynGroup();
        }, after: function () { syncStorage(); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "storeRack" + ": " + e.message); }
    try { growDefProp('bagLine', { label: 'trim & bag line', x: 4.5, z: 2.9, rot: 1, build: function (c) {
          // a bench-top line: a hopper over a trimming drum, a short belt on rollers, a control box with a stop button, a chute into the bag holder
          var st = MAT.steel, dk = MAT.gunmetal, belt = colorMat(0x16181b, 0.85);
          c.box(1.2, 0.06, 0.6, st, 0, 0.87, 0, { solid: true }); c.box(1.14, 0.5, 0.54, dk, 0, 0.6, 0, { cast: false }); [[-0.55, -0.25], [0.55, -0.25], [-0.55, 0.25], [0.55, 0.25]].forEach(function (l) { c.box(0.05, 0.84, 0.05, st, l[0], 0.42, l[1]); c.cyl(0.035, 0.04, 0.02, MAT.soft, l[0], 0.01, l[1], 12); }); c.box(1.1, 0.03, 0.5, st, 0, 0.2, 0, { cast: false });
          c.box(0.5, 0.42, 0.46, dk, -0.3, 1.11, 0, { r: 0.02 }); var drum = c.cyl(0.17, 0.17, 0.4, st, -0.3, 1.13, 0.0, 24); drum.rotation.x = Math.PI / 2; c.lit(0x0c0f0d, 0.3, 0.2, -0.3, 1.13, 0.232); for (var sl = 0; sl < 5; sl++) c.box(0.26, 0.008, 0.006, st, -0.3, 1.06 + sl * 0.035, 0.234, { cast: false, sharp: true });
          c.cyl(0.26, 0.15, 0.32, st, -0.3, 1.49, 0, 28); c.cyl(0.272, 0.272, 0.02, MAT.chrome, -0.3, 1.655, 0, 28); c.cyl(0.24, 0.24, 0.01, colorMat(0x3f7a3a, 1), -0.3, 1.6, 0, 20);
          c.box(0.6, 0.02, 0.36, belt, 0.28, 0.93, 0, { cast: false }); [0.0, 0.56].forEach(function (x) { var rl = c.cyl(0.03, 0.03, 0.38, MAT.chrome, x, 0.92, 0, 14); rl.rotation.x = Math.PI / 2; }); [-0.19, 0.19].forEach(function (z) { c.box(0.62, 0.05, 0.016, st, 0.28, 0.93, z, { cast: false }); });
          c.box(0.16, 0.2, 0.1, MAT.gloss, 0.2, 1.1, -0.26, { r: 0.01 }); c.lit(0x6fdc8c, 0.02, 0.02, 0.16, 1.15, -0.2095); c.lit(0xf0b94d, 0.02, 0.02, 0.2, 1.15, -0.2095); c.cyl(0.022, 0.022, 0.024, colorMat(0xd0201a, 0.35), 0.24, 1.08, -0.2, 16).rotation.x = Math.PI / 2; c.cyl(0.03, 0.03, 0.008, colorMat(0xe3b52c, 0.5), 0.24, 1.08, -0.208, 16).rotation.x = Math.PI / 2;
          var ch = c.box(0.2, 0.012, 0.3, st, 0.66, 0.84, 0, { sharp: true }); ch.rotation.z = -0.55; c.box(0.2, 0.25, 0.04, MAT.white, 0.72, 0.62, 0.1, { cast: false });
          c.sign(['TRIM & BAG'], 0.6, 0.12, 0, 0.6, 0.272, 0, { size: 26, titleColor: '#6fdc8c', bg: '#101410' }); c.hit(1.3, 1.8, 0.8, 0, 0.9, 0.05, { kind: 'bagLine' });
        } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "bagLine" + ": " + e.message); }
    try { growDefProp('vipTable', { label: 'lounge table + armchairs', floor: 1, x: 7.4, z: -1.6, rot: 0, build: function (c) {
          var velvet = colorMat(0x5a1f3a, 0.95), brass = colorMat(0xc9a24a, 0.35, 0.8);
          c.cyl(0.45, 0.45, 0.05, MAT.darkwood, 0, 0.62, 0, 20); c.cyl(0.05, 0.05, 0.6, brass, 0, 0.3, 0, 10); c.cyl(0.28, 0.3, 0.04, brass, 0, 0.02, 0, 16); c.cyl(0.07, 0.05, 0.03, MAT.jar, 0.1, 0.66, 0.05, 12); c.cyl(0.015, 0.015, 0.2, colorMat(0xfff3c8, 0.4), -0.12, 0.75, -0.08, 8);
          [-0.95, 0.95].forEach(function (x) { c.box(0.7, 0.35, 0.7, velvet, x, 0.28, 0); c.box(0.14, 0.75, 0.7, velvet, x + (x > 0 ? 0.3 : -0.3), 0.6, 0); c.box(0.7, 0.3, 0.12, velvet, x, 0.58, -0.32); c.box(0.7, 0.3, 0.12, velvet, x, 0.58, 0.32); [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]].forEach(function (l) { c.box(0.05, 0.12, 0.05, brass, x + l[0], 0.06, l[1]); }); });
          c.solid(-1.3, 1.3, -0.4, 0.4);
        } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "vipTable" + ": " + e.message); }
    try { growDefProp('cellarHatch', { label: 'basement hatch', x: 3.3, z: -0.4, rot: 3, build: function (c) {
          var st = colorMat(0x8d949c, 0.35, 0.8), dk = colorMat(0x2b2f35, 0.5, 0.6);
          c.box(1.3, 0.04, 1.3, dk, 0, 0.02, 0, { cast: false }); c.box(1.1, 0.012, 1.1, MAT.black, 0, 0.042, 0, { cast: false });
          var lid = c.box(1.2, 0.05, 1.2, st, 0, 0.64, -0.6); lid.rotation.x = -Math.PI / 2 + 0.06;   // the lid stands open flat against the wall, the ladder comes up in front of it
          [-0.4, 0.4].forEach(function (x) { c.cyl(0.022, 0.022, 1.1, colorMat(0xf2c21a, 0.6), x, 0.55, -0.42, 8); }); for (var r = 0; r < 3; r++) c.box(0.8, 0.03, 0.03, st, 0, 0.12 + r * 0.3, -0.42, { cast: false });
          c.sign(['RF SMOKING ↓', 'basement works'], 0.9, 0.26, 0, 1.45, -0.6, 0, { size: 26, bg: '#14100c', titleColor: '#e8c27a', color: '#b9a88a', line: 'rgba(232,194,122,.5)' }); c.box(0.04, 1.5, 0.04, dk, 0, 0.75, -0.63);
          c.solid(-0.65, 0.65, -0.8, -0.55); c.hit(1.3, 1.5, 1.3, 0, 0.75, 0, { kind: 'cellarDown' });
        } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "cellarHatch" + ": " + e.message); }
    try { growDefProp('cigCabinet', { label: 'cigarette cabinet', x: 2.5, z: 3.68, rot: 2, build: function (c) {
          var m = colorMat(0x2b2f35, 0.5, 0.5), inner = colorMat(0xe9e4d8, 0.8), st = colorMat(0xa7adb4, 0.35, 0.8), dk = colorMat(0x5b6168, 0.4, 0.7);
          c.box(1.2, 2.0, 0.05, m, 0, 1.0, -0.175); c.box(0.05, 2.0, 0.4, m, -0.6, 1.0, 0); c.box(0.05, 2.0, 0.4, m, 0.6, 1.0, 0); c.box(1.2, 0.06, 0.4, m, 0, 1.97, 0); c.box(1.2, 0.42, 0.4, m, 0, 0.21, 0); c.box(1.1, 1.5, 0.01, inner, 0, 1.17, -0.145, { cast: false });
          [0.57, 0.92, 1.27, 1.62].forEach(function (y) { c.box(1.1, 0.025, 0.3, m, 0, y - 0.013, 0, { cast: false }); }); c.box(1.2, 0.14, 0.1, m, 0, 1.9, 0.22); c.box(0.03, 1.5, 0.03, st, -0.565, 1.15, 0.2, { cast: false }); c.box(0.03, 1.5, 0.03, st, 0.565, 1.15, 0.2, { cast: false });
          c.sign(['RF SMOKING'], 0.7, 0.1, 0, 1.9, 0.272, 0, { size: 26, bg: '#14100c', titleColor: '#e8c27a', line: 'rgba(0,0,0,0)' });
          var g = c.dynGroup(); var sh = new THREE.Group(); var panel = new THREE.Mesh(bevelGeo(1.1, 1.45, 0.014), st); sh.add(panel); for (var s = 0; s < 14; s++) { var gr = new THREE.Mesh(bevelGeo(1.1, 0.012, 0.02), dk); gr.position.y = -0.69 + s * 0.105; sh.add(gr); } var hd = new THREE.Mesh(bevelGeo(0.3, 0.035, 0.035), dk); hd.position.set(0, -0.66, 0.02); sh.add(hd); sh.position.set(0, 1.145, 0.2); g.userData.shutter = sh; g.add(sh);
          c.solid(-0.6, 0.6, -0.2, 0.2); c.hit(1.25, 2.0, 0.5, 0, 1.0, 0.03, { kind: 'cigCab' });
        }, after: function () { syncCigCab(); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "cigCabinet" + ": " + e.message); }
    try { growDefProp('gunLocker', { label: 'weapon locker', x: -2.6, z: 3.68, rot: 2, build: function (c) {
          // a gun cabinet: heavy gauge steel, two doors with louvres and recessed pulls, a hasp and padlock, hazard tape along the plinth
          var m = colorMat(0x3b4048, 0.42, 0.75), m2 = colorMat(0x454b54, 0.38, 0.75);
          c.box(0.8, 1.44, 0.36, m, 0, 0.78, 0, { solid: true }); c.box(0.78, 0.06, 0.34, MAT.soft, 0, 0.03, 0, { cast: false }); c.box(0.84, 0.03, 0.4, m, 0, 1.515, 0);
          [-0.2, 0.2].forEach(function (x) { var sd = x < 0 ? -1 : 1; c.box(0.385, 1.36, 0.006, MAT.black, x, 0.78, 0.182, { cast: false, sharp: true }); c.box(0.372, 1.345, 0.02, m2, x, 0.78, 0.19, { r: 0.005 }); for (var v = 0; v < 4; v++) { c.box(0.2, 0.014, 0.006, MAT.black, x, 1.26 + v * 0.035, 0.2015, { cast: false, sharp: true }); c.box(0.2, 0.014, 0.006, MAT.black, x, 0.2 + v * 0.035, 0.2015, { cast: false, sharp: true }); } c.box(0.03, 0.12, 0.006, MAT.black, x - sd * 0.14, 0.8, 0.2015, { cast: false, sharp: true }); c.box(0.012, 0.12, 0.012, MAT.chrome, x - sd * 0.15, 0.8, 0.206, { cast: false, sharp: true }); [0.25, 0.78, 1.31].forEach(function (y) { c.cyl(0.01, 0.01, 0.08, MAT.soft, x + sd * 0.192, y, 0.192, 10); }); });
          c.box(0.07, 0.04, 0.008, MAT.chrome, 0, 0.62, 0.205, { cast: false, sharp: true }); c.box(0.04, 0.05, 0.022, MAT.brass, 0, 0.575, 0.212, { r: 0.006 }); var shk = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.004, 6, 12, Math.PI), MAT.chrome); shk.position.set(0, 0.6, 0.212); c.add(shk);
          for (var hz = 0; hz < 8; hz++) c.box(0.05, 0.03, 0.004, colorMat(hz % 2 ? 0x15171b : 0xe3b52c, 0.5), -0.35 + hz * 0.1, 0.09, 0.184, { cast: false, sharp: true });
          c.sign(['WEAPONS', 'staff only'], 0.5, 0.16, 0, 1.62, -0.17, 0, { size: 26, titleColor: '#ff6b6b', bg: '#101410' });
          c.hit(0.85, 1.5, 0.46, 0, 0.75, 0, { kind: 'locker' });
        } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "gunLocker" + ": " + e.message); }
    try { growDefProp('vault', { label: 'vault', x: -ROOM.x + 0.45, z: 2.4, rot: 1, build: function (c) {
          // a safe worth the name: a body on four feet, a door proud of its frame on two barrel hinges, a five-spoke wheel, a combination dial, a brass plate
          var m = colorMat(0x2a2d33, 0.42, 0.7), m2 = colorMat(0x353940, 0.36, 0.75);
          c.box(0.7, 0.9, 0.7, m, 0, 0.5, 0, { solid: true, r: 0.02 }); [[-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28]].forEach(function (f) { c.cyl(0.04, 0.045, 0.05, MAT.soft, f[0], 0.025, f[1], 14); });
          c.box(0.64, 0.84, 0.01, MAT.black, 0, 0.5, 0.352, { cast: false, sharp: true }); c.box(0.6, 0.8, 0.05, m2, 0, 0.5, 0.375, { r: 0.012 }); c.box(0.5, 0.7, 0.008, m, 0, 0.5, 0.402, { cast: false, r: 0.003 });
          [0.24, 0.76].forEach(function (y) { c.cyl(0.022, 0.022, 0.14, MAT.steel, -0.315, y, 0.375, 14); c.cyl(0.026, 0.026, 0.012, MAT.chrome, -0.315, y + 0.076, 0.375, 14); });
          var wheel = new THREE.Group(); wheel.position.set(0.1, 0.46, 0.43); c.add(wheel); var rim = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.011, 10, 36), MAT.chrome); rim.castShadow = true; wheel.add(rim); for (var sp = 0; sp < 5; sp++) { var spoke = new THREE.Mesh(roundCylGeo(0.007, 0.007, 0.11, 8), MAT.chrome); spoke.rotation.z = sp * Math.PI * 2 / 5; spoke.position.set(-Math.sin(spoke.rotation.z) * 0.055, Math.cos(spoke.rotation.z) * 0.055, 0); wheel.add(spoke); } var hubw = new THREE.Mesh(roundCylGeo(0.03, 0.034, 0.04, 20), MAT.steel); hubw.rotation.x = Math.PI / 2; hubw.position.z = -0.008; wheel.add(hubw);
          var dial = new THREE.Mesh(roundCylGeo(0.06, 0.066, 0.03, 32), MAT.steel); dial.rotation.x = Math.PI / 2; dial.position.set(-0.14, 0.64, 0.418); c.add(dial); var dk = new THREE.Mesh(roundCylGeo(0.026, 0.03, 0.03, 20), MAT.chrome); dk.rotation.x = Math.PI / 2; dk.position.set(-0.14, 0.64, 0.445); c.add(dk);
          for (var t = 0; t < 24; t++) { var tk = c.box(0.003, t % 6 ? 0.008 : 0.014, 0.002, MAT.white, -0.14 + Math.cos(t / 24 * Math.PI * 2) * 0.05, 0.64 + Math.sin(t / 24 * Math.PI * 2) * 0.05, 0.4345, { cast: false, sharp: true }); tk.rotation.z = t / 24 * Math.PI * 2 + Math.PI / 2; }
          c.lit(0xff5040, 0.012, 0.012, -0.14, 0.73, 0.4075);
          c.sign(['VAULT'], 0.26, 0.06, 0, 0.84, 0.4075, 0, { size: 22, bold: true, bg: '#c9a24a', color: '#2a2210', titleColor: '#2a2210', line: 'rgba(60,45,10,.6)' });
          c.hit(0.8, 1.0, 0.8, 0, 0.5, 0, { kind: 'vault' });
        } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "vault" + ": " + e.message); }
    try { growDefProp('arcade', { label: 'arcade cabinet', x: -ROOM.x + 0.45, z: 6.4, rot: 1, multi: { max: 4, price: 750, gap: 1.0, ico: '🕹️', lic: 'amusement' }, build: function (c) {
          // an upright cabinet with the proper silhouette: two side panels cut to the classic profile, a lit marquee, a screen leaning
          // back behind its bezel, a sloped control deck with a stick and six buttons, a coin door with two slots
          var body = colorMat(0x15171b, 0.45, 0.1), trim = colorMat(0x6fdc8c, 0.4, 0, { emissive: new THREE.Color(0x2f8a4a), emissiveIntensity: 0.6 });
          var sh = new THREE.Shape(); [[-0.35, 0], [0.35, 0], [0.35, 0.92], [0.5, 1.0], [0.5, 1.12], [0.3, 1.18], [0.24, 1.6], [0.4, 1.66], [0.4, 1.86], [-0.35, 1.86]].forEach(function (p, i) { if (i) sh.lineTo(p[0], p[1]); else sh.moveTo(p[0], p[1]); }); sh.closePath();
          [-0.34, 0.34].forEach(function (x) { var side = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1 }), body); side.rotation.y = -Math.PI / 2; side.position.set(x + 0.015, 0, 0); side.castShadow = true; c.add(side); var edge = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: false }), trim); edge.rotation.y = -Math.PI / 2; edge.scale.set(1.012, 1.006, 1); edge.position.set(x + (x < 0 ? -0.013 : 0.019), -0.004, 0.004); c.add(edge); });
          c.box(0.65, 1.84, 0.04, body, 0, 0.93, -0.33); c.box(0.65, 0.92, 0.04, body, 0, 0.46, 0.33); c.box(0.65, 0.04, 0.72, body, 0, 1.85, 0.02); c.box(0.65, 0.06, 0.66, MAT.soft, 0, 0.03, 0, { cast: false }); c.solid(-0.37, 0.37, -0.36, 0.5);
          c.lit(0xe8fff0, 0.62, 0.18, 0, 1.76, 0.402); var marquee = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.17), new THREE.MeshBasicMaterial({ map: signTex(['GROW RUSH'], 300, 85, { size: 46, bold: true, bg: '#0d2a18', titleColor: '#6fdc8c', line: 'rgba(111,220,140,.8)' }), toneMapped: false })); marquee.position.set(0, 1.76, 0.404); c.add(marquee);
          var sg = new THREE.Group(); sg.position.set(0, 1.39, 0.255); sg.rotation.x = -0.14; c.add(sg); screenShell(sg, 0.52, 0.39, { bezel: 0.04, depth: 0.03, rimMat: body, led: 0 });
          var gv = document.createElement('canvas'); gv.width = 416; gv.height = 312; var gx = gv.getContext('2d'); gx.fillStyle = '#06130c'; gx.fillRect(0, 0, 416, 312); gx.fillStyle = '#0d2a18'; for (var gy = 0; gy < 312; gy += 26) gx.fillRect(0, gy, 416, 1); gx.fillStyle = '#6fdc8c'; gx.font = '700 40px ' + SCR_MONO; gx.textAlign = 'center'; gx.fillText('GROW RUSH', 208, 64); gx.font = '20px ' + SCR_MONO; gx.fillStyle = '#f0b94d'; gx.fillText('HI 042000', 208, 96);
          [[60, 230, '#6fdc8c'], [130, 200, '#6fdc8c'], [200, 240, '#f0b94d'], [270, 190, '#6fdc8c'], [340, 225, '#ff6b5e']].forEach(function (p) { gx.fillStyle = '#5a3a22'; gx.fillRect(p[0] - 14, p[1] + 24, 28, 22); gx.fillStyle = p[2]; for (var lf = 0; lf < 5; lf++) gx.fillRect(p[0] - 3 + (lf - 2) * 9, p[1] - Math.abs(lf - 2) * -8, 6, 26); });
          gx.fillStyle = '#e8f1ea'; gx.font = '18px ' + SCR_MONO; gx.fillText('INSERT COIN', 208, 294);
          var gs = litPlane(gv, 0.52, 0.39); gs.position.z = 0.0005; sg.add(gs); var gg = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.39), MAT.screenGlass); gg.position.z = 0.0016; sg.add(gg);
          var deck = new THREE.Group(); deck.position.set(0, 1.06, 0.4); deck.rotation.x = 0.42; c.add(deck); var dp = new THREE.Mesh(bevelGeo(0.65, 0.03, 0.26), colorMat(0x1f2226, 0.5)); dp.castShadow = true; deck.add(dp);
          var stick = new THREE.Mesh(roundCylGeo(0.008, 0.008, 0.09, 8), MAT.chrome); stick.position.set(-0.17, 0.06, 0); deck.add(stick); var ball = new THREE.Mesh(new THREE.SphereGeometry(0.028, 16, 12), colorMat(0xc94a3a, 0.25)); ball.position.set(-0.17, 0.115, 0); deck.add(ball); var boot = new THREE.Mesh(roundCylGeo(0.02, 0.034, 0.014, 16), MAT.soft); boot.position.set(-0.17, 0.022, 0); deck.add(boot);
          [[0.02, -0.03, 0xffd166], [0.1, -0.05, 0xff6b5e], [0.18, -0.03, 0x7cc4ff], [0.04, 0.045, 0x6fdc8c], [0.12, 0.025, 0xf3eee0], [0.2, 0.045, 0xc9a0ff]].forEach(function (b) { var ring = new THREE.Mesh(roundCylGeo(0.024, 0.026, 0.008, 18), MAT.black); ring.position.set(b[0], 0.019, b[1]); deck.add(ring); var bt = new THREE.Mesh(roundCylGeo(0.019, 0.019, 0.016, 18), colorMat(b[2], 0.3)); bt.position.set(b[0], 0.028, b[1]); deck.add(bt); });
          c.box(0.34, 0.3, 0.012, colorMat(0x22262b, 0.4, 0.6), 0, 0.56, 0.356, { r: 0.004 }); [-0.07, 0.07].forEach(function (x) { c.lit(0xff5040, 0.05, 0.07, x, 0.62, 0.3625); c.box(0.004, 0.036, 0.004, MAT.black, x, 0.62, 0.3635, { cast: false, sharp: true }); }); c.box(0.1, 0.04, 0.01, MAT.chrome, 0, 0.5, 0.366, { cast: false, sharp: true }); c.cyl(0.01, 0.01, 0.008, MAT.chrome, 0.13, 0.56, 0.366, 10).rotation.x = Math.PI / 2;   // coin door
          c.light(new THREE.PointLight(0x6fdc8c, 0.4, 3), 0, 1.4, 0.7);
          c.hit(0.8, 2.0, 0.9, 0, 1.0, 0.1, { kind: 'arcade' });
        } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "arcade" + ": " + e.message); }
    try { growDefProp('procShelf', { label: 'storage shelf', x: 8.5, z: -1.55, rot: 0, build: function (c) {
          var shelfM = colorMat(0x8a8f96, 0.35, 0.8); for (var s = 0; s < 4; s++) c.box(1.6, 0.03, 0.45, shelfM, 0, 0.3 + s * 0.5, 0);
          [[-0.78, -0.2], [0.78, -0.2], [-0.78, 0.2], [0.78, 0.2]].forEach(function (p) { c.box(0.035, 1.9, 0.035, shelfM, p[0], 0.95, p[1]); });
          c.box(0.5, 0.3, 0.35, colorMat(0xc8a97a, 1), -0.45, 0.47, 0); c.box(0.4, 0.25, 0.3, colorMat(0xe8e8ee, 0.7), 0.35, 0.44, 0); c.sign(['BAGGIES'], 0.3, 0.08, 0.35, 0.44, 0.152, 0, { size: 26, bg: '#f3e9cf', color: '#222', titleColor: '#222', line: 'rgba(0,0,0,.3)' });
          for (var j = 0; j < 6; j++) { c.cyl(0.06, 0.06, 0.14, MAT.jar, -0.6 + j * 0.24, 0.89, 0, 12); c.cyl(0.062, 0.062, 0.015, MAT.jarLid, -0.6 + j * 0.24, 0.965, 0, 12); }
          c.box(0.6, 0.2, 0.3, colorMat(0x3a5a3a, 0.9), -0.4, 1.42, 0); c.box(0.3, 0.14, 0.2, colorMat(0xf5e6c8, 0.8), 0.3, 1.39, 0); c.box(0.5, 0.08, 0.3, MAT.white, 0.4, 1.86, 0); c.cyl(0.09, 0.09, 0.2, colorMat(0x2b6fb3, 0.4), -0.5, 1.92, 0, 14);
          c.solid(-0.8, 0.8, -0.25, 0.25);
        } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "procShelf" + ": " + e.message); }
    try { growDefProp('hallClockTable', { label: 'side table', x: -3.5, z: 1.6, rot: 1, build: function (c) { c.box(0.5, 0.04, 0.5, MAT.wood, 0, 0.7, 0, { solid: true }); legs4(c, 0.5, 0.5, 0.68, MAT.darkwood, 0.05, 0.04); c.box(0.44, 0.03, 0.44, MAT.wood, 0, 0.25, 0, { cast: false }); c.cyl(0.06, 0.05, 0.16, colorMat(0xf5f5f0, 0.5), -0.1, 0.8, 0, 14); for (var i = 0; i < 5; i++) { var fl = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), colorMat([0xff6b9d, 0xffd166, 0x9ad0ff, 0xff8c42, 0xf2f2f2][i], 0.8)); fl.position.set(-0.1 + Math.cos(i * 1.3) * 0.05, 0.95 + (i % 2) * 0.04, Math.sin(i * 1.3) * 0.05); c.add(fl); var st = c.cyl(0.004, 0.004, 0.14, MAT.stem, -0.1 + Math.cos(i * 1.3) * 0.03, 0.88, Math.sin(i * 1.3) * 0.03, 5); } c.box(0.14, 0.2, 0.03, MAT.darkwood, 0.14, 0.82, -0.05); c.box(0.11, 0.16, 0.005, new THREE.MeshBasicMaterial({ map: signTex(['📷', 'the crew'], 110, 160, { size: 30, bg: '#f0ead8', color: '#333', titleColor: '#333', line: 'rgba(0,0,0,0)' }) }), 0.14, 0.82, -0.032, { cast: false }); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "hallClockTable" + ": " + e.message); }
    try { growDefProp('floorLamp', { label: 'floor lamp', x: -1.2, z: -1.6, rot: 0, build: function (c) {
          // a drum-shade floor lamp: a stone foot, a brass stem with a collar, a linen shade with a diffuser under it
          c.cyl(0.17, 0.18, 0.04, colorMat(0x2a2c2f, 0.3, 0.05), 0, 0.02, 0, 32); c.cyl(0.012, 0.012, 1.56, MAT.brass, 0, 0.82, 0, 12); c.cyl(0.024, 0.024, 0.05, MAT.brass, 0, 0.07, 0, 14); c.cyl(0.02, 0.02, 0.04, MAT.brass, 0, 1.5, 0, 14);
          var shM = new THREE.MeshStandardMaterial({ map: TEX.fabric, color: 0xf3ead2, side: THREE.DoubleSide, emissive: 0xffe0a0, emissiveIntensity: 0.55, roughness: 0.95 }); var sh = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.3, 32, 1, true), shM); sh.position.y = 1.7; c.add(sh);
          [1.85, 1.55].forEach(function (y, i) { var rg = new THREE.Mesh(new THREE.TorusGeometry(i ? 0.22 : 0.2, 0.005, 6, 32), MAT.brass); rg.rotation.x = Math.PI / 2; rg.position.y = y; c.add(rg); }); c.cyl(0.19, 0.19, 0.006, new THREE.MeshBasicMaterial({ color: 0xfff1cf, toneMapped: false }), 0, 1.57, 0, 24); c.cyl(0.035, 0.035, 0.1, emitMat(0xffe9b0, 1.6), 0, 1.68, 0, 12);
          c.light(new THREE.PointLight(0xffe0a0, 0.45, 5), 0, 1.6, 0); c.solid(-0.2, 0.2, -0.2, 0.2); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "floorLamp" + ": " + e.message); }
    try { growDefProp('guardBoard', { label: 'notice board', x: 5.0, z: ROOM.z - 0.13, rot: 2, build: function (c) { c.box(1.0, 0.7, 0.03, colorMat(0x8a6a4a, 0.9), 0, 1.7, 0); c.box(1.04, 0.74, 0.02, MAT.darkwood, 0, 1.7, -0.01, { cast: false }); [['NO ID', 'NO ENTRY', '#fff', '#c9302c'], ['LOST', 'grey cat, answers to Kush', '#333', '#f0ead8'], ['BAND', 'friday · the dry room', '#062010', '#6fdc8c'], ['WANTED', 'trimmers · ask inside', '#332200', '#ffc857']].forEach(function (n, i) { var x = -0.32 + (i % 2) * 0.36, y = 1.86 - Math.floor(i / 2) * 0.32; var note = c.sign([n[0], n[1]], 0.3, 0.24, x, y, 0.02, 0, { size: 22, bg: n[3], color: n[2], titleColor: n[2], line: 'rgba(0,0,0,.2)' }); note.rotation.z = (i % 2 ? -0.06 : 0.05); var pin = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), colorMat([0xc94a3a, 0x3a7fd6, 0xffd166, 0x3aa36a][i], 0.4)); pin.position.set(x, y + 0.1, 0.03); c.add(pin); }); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "guardBoard" + ": " + e.message); }
    try { growDefProp('dining', { label: 'dining set', floor: 1, x: -4, z: -5.6, rot: 0, build: function (c) {
          c.box(1.6, 0.05, 0.9, MAT.wood, 0, 0.75, 0, { solid: true }); c.box(1.5, 0.04, 0.8, MAT.darkwood, 0, 0.72, 0, { cast: false }); legs4(c, 1.6, 0.9, 0.72, MAT.darkwood, 0.1, 0.06);
          chair(c, -0.5, -0.8, 0, fabricMat(0x3a5a3a), MAT.darkwood); chair(c, 0.5, -0.8, 0, fabricMat(0x3a5a3a), MAT.darkwood); chair(c, -0.5, 0.8, Math.PI, fabricMat(0x3a5a3a), MAT.darkwood); chair(c, 0.5, 0.8, Math.PI, fabricMat(0x3a5a3a), MAT.darkwood);
          c.hit(1.8, 0.8, 1.1, 0, 0.7, 0, { kind: 'eatspot', label: 'dining table' });
          [-0.35, 0.35].forEach(function (x) { c.cyl(0.14, 0.12, 0.012, colorMat(0xf5f5f0, 0.4), x, 0.786, 0, 20); c.cyl(0.05, 0.045, 0.1, MAT.jar, x + 0.2, 0.83, -0.2, 12); c.box(0.02, 0.005, 0.14, MAT.chrome, x - 0.18, 0.783, 0, { cast: false }); c.box(0.02, 0.005, 0.14, MAT.chrome, x + 0.18, 0.783, 0, { cast: false }); });
          var vase = new THREE.Mesh(roundCylGeo(0.05, 0.035, 0.18, 12), MAT.jar); vase.position.set(0, 0.87, 0); c.add(vase); for (var f = 0; f < 4; f++) { c.cyl(0.004, 0.004, 0.2, MAT.stem, Math.cos(f * 1.6) * 0.02, 1.02, Math.sin(f * 1.6) * 0.02, 5); var fl = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), colorMat([0xff6b9d, 0xffd166, 0xf2f2f2, 0xff8c42][f], 0.8)); fl.position.set(Math.cos(f * 1.6) * 0.04, 1.12, Math.sin(f * 1.6) * 0.04); c.add(fl); }
          c.box(0.24, 0.005, 0.24, colorMat(0xe0c25a, 1), -0.35, 0.78, 0, { cast: false }); c.box(0.24, 0.005, 0.24, colorMat(0xe0c25a, 1), 0.35, 0.78, 0, { cast: false });
        } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "dining" + ": " + e.message); }
    try { growDefProp('couchUp', { label: 'couch + coffee table', floor: 1, x: DIVX - 3.7, z: 0.5, rot: 1, build: function (c) {
          // built along local x with the back at -z; rot 1 turns the back to the wall side (-x) so it faces the TV on the right wall
          var seatM = fabricMat(0x3b4a5c), pipeM = fabricMat(0x2a3542);
          sofaBuild(c, 2.4, seatM, pipeM);
          [-0.6, 0.6].forEach(function (x) { var cu = c.box(0.42, 0.13, 0.42, fabricMat(x < 0 ? 0xe0c25a : 0xc94a3a), x, 0.62, -0.14, { r: 0.055 }); cu.rotation.set(1.05, x < 0 ? -0.2 : 0.25, 0); });
          c.box(1.2, 0.14, 0.3, fabricMat(0x8a8a8a), 0.2, 0.34, 0.0).rotation.z = 0.02;   // throw blanket
          c.hit(2.5, 1.2, 1.2, 0, 0.6, 0, { kind: 'couch', seat: 'couchUp' });
          coffeeTableBuild(c, 0, 1.3, 1.2, 0.7);
          c.box(0.16, 0.16, 0.12, MAT.black, 0.3, 0.52, 1.3); c.box(0.14, 0.02, 0.1, MAT.plastic, 0.3, 0.6, 1.3, { cast: false }); var mug = new THREE.Mesh(roundCylGeo(0.04, 0.035, 0.09, 12), colorMat(0x6fdc8c, 0.5)); mug.position.set(-0.3, 0.49, 1.2); c.add(mug); c.box(0.18, 0.02, 0.12, MAT.black, -0.1, 0.45, 1.4, { cast: false }); for (var b = 0; b < 12; b++) c.box(0.012, 0.005, 0.012, colorMat(0x8a8f96), -0.16 + (b % 6) * 0.024, 0.462, 1.38 + Math.floor(b / 6) * 0.03, { cast: false });   // remote
          c.box(0.24, 0.02, 0.3, colorMat(0xe8e8ee, 0.7), 0.35, 0.45, 1.15, { cast: false }); c.box(0.2, 0.01, 0.26, new THREE.MeshBasicMaterial({ map: signTex(['grow', 'notes'], 100, 130, { size: 26, bg: '#f0ead8', color: '#333', titleColor: '#1a6a2a', line: 'rgba(0,0,0,0)' }) }), 0.35, 0.462, 1.15, { cast: false });
          c.box(4.5, 0.02, 3.6, new THREE.MeshStandardMaterial({ map: TEX.fabric, color: 0x5a3a2a, roughness: 1 }), 0, 0.01, 1.4, { cast: false }); c.box(4.2, 0.005, 3.3, new THREE.MeshStandardMaterial({ map: TEX.fabric, color: 0x7a4a34, roughness: 1 }), 0, 0.022, 1.4, { cast: false });
          c.box(0.03, 1.7, 0.03, MAT.chrome, -1.6, 0.85, -0.2); c.cyl(0.14, 0.16, 0.02, MAT.black, -1.6, 0.01, -0.2, 18); var lshade = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 0.32, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0xf1e7c8, side: THREE.DoubleSide, emissive: 0xffe0a0, emissiveIntensity: 0.4 })); lshade.position.set(-1.6, 1.8, -0.2); c.add(lshade); c.light(new THREE.PointLight(0xffe0a0, 0.4, 5), -1.6, 1.7, -0.2);
        }, after: function (c, P) { var v = growPropWorld('couchUp', 0, 0.1); world.couchSeat = { x: v.x, z: v.z, yaw: -Math.PI / 2 + P.rot * Math.PI / 2 - Math.PI / 2 }; } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "couchUp" + ": " + e.message); }
    try { growDefProp('bed', { label: 'bed', floor: 1, x: -8.5, z: 6.9, rot: 0, build: function (c) {
          c.box(1.6, 0.4, 2.1, MAT.darkwood, 0, 0.2, 0, { solid: true }); c.box(1.5, 0.22, 2.0, fabricMat(0xe8e8ee), 0, 0.51, 0); c.box(1.52, 0.02, 2.02, colorMat(0xd0d0d8, 0.9), 0, 0.51, 0, { cast: false });
          var duvet = c.box(1.54, 0.18, 1.25, fabricMat(0x3a6a4a), 0, 0.68, 0.38); c.box(1.54, 0.04, 0.2, fabricMat(0x2f5a3c), 0, 0.78, -0.2, { cast: false });
          [-0.38, 0.38].forEach(function (x) { c.box(0.62, 0.14, 0.42, fabricMat(0xffffff), x, 0.69, -0.78).rotation.y = x < 0 ? 0.05 : -0.05; });
          c.box(1.6, 0.9, 0.08, MAT.darkwood, 0, 0.6, -1.05); for (var s = -0.65; s <= 0.65; s += 0.26) c.box(0.16, 0.5, 0.02, MAT.wood, s, 0.7, -1.0, { cast: false });
          c.box(0.5, 0.55, 0.45, MAT.darkwood, 1.1, 0.275, -0.9, { solid: true }); drawer(c, 0.42, 0.18, 0.02, 1.1, 0.4, -0.67); drawer(c, 0.42, 0.18, 0.02, 1.1, 0.17, -0.67);
          c.cyl(0.08, 0.06, 0.03, MAT.black, 1.1, 0.57, -0.9, 14); c.cyl(0.012, 0.012, 0.22, MAT.chrome, 1.1, 0.68, -0.9, 8); var sh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.14, 14, 1, true), new THREE.MeshStandardMaterial({ color: 0xf1e7c8, side: THREE.DoubleSide, emissive: 0xffe0a0, emissiveIntensity: 0.3 })); sh.position.set(1.1, 0.82, -0.9); c.add(sh); c.light(new THREE.PointLight(0xffe0a0, 0.3, 3), 1.1, 0.8, -0.9);
          c.box(0.1, 0.16, 0.06, MAT.black, 0.95, 0.63, -0.8); c.box(0.08, 0.05, 0.005, MAT.screen, 0.95, 0.66, -0.768, { cast: false }); c.box(0.12, 0.18, 0.03, colorMat(0x8a2a2a, 0.8), 1.25, 0.64, -0.95).rotation.z = 0.1;
          c.hit(1.8, 1.0, 2.3, 0, 0.5, 0, { kind: 'bed' });
          c.box(1.2, 0.02, 0.6, new THREE.MeshStandardMaterial({ map: TEX.fabric, color: 0x6a5a4a, roughness: 1 }), 0, 0.01, 1.4, { cast: false });
        }, after: function (c, P) { var v = growPropWorld('bed', 0, 0.3); world.bedSpot = { x: v.x, z: v.z, yaw: Math.PI + P.rot * Math.PI / 2 }; } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "bed" + ": " + e.message); }
    try { growDefProp('upBooks', { label: 'bookshelf', floor: 1, x: 4.0, z: -8.6, rot: 0, build: function (c) { bookshelfBuild(c, 1.6, 2.0, 4); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "upBooks" + ": " + e.message); }
    try { growDefProp('windowSeat', { label: 'window seat', floor: 1, x: -2.0, z: ROOM.z - 0.5, rot: 0, build: function (c) { c.box(6.0, 0.45, 0.6, MAT.wood, 0, 0.225, 0, { solid: true }); c.box(6.0, 0.08, 0.6, fabricMat(0x3a5a3a), 0, 0.49, 0); for (var k = 0; k < 4; k++) { var cu = c.box(0.5, 0.14, 0.5, fabricMat([0xe0c25a, 0x6fdc8c, 0xd64a9a, 0x3ad0ff][k]), -2.2 + k * 1.4, 0.6, 0); cu.rotation.y = (k % 2 ? 0.2 : -0.15); } c.box(0.4, 0.03, 0.28, colorMat(0x8a2a2a, 0.8), 1.2, 0.545, 0.1, { cast: false }); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "windowSeat" + ": " + e.message); }
    try { growDefProp('upPlant1', { label: 'plant', floor: 1, x: -8.5, z: -8.3, build: function (c) { c.fern(0, 0, 1.2); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "upPlant1" + ": " + e.message); }
    try { growDefProp('upPlant2', { label: 'plant', floor: 1, x: 11.2, z: -8.3, build: function (c) { c.fern(0, 0, 1.2); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "upPlant2" + ": " + e.message); }
    try { growDefProp('upPlant3', { label: 'plant', floor: 1, x: 11.2, z: 5.0, build: function (c) { c.fern(0, 0, 1.2); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "upPlant3" + ": " + e.message); }
    try { growDefProp('upRug', { label: 'rug', floor: 1, x: -4, z: 0.5, rot: 0, build: function (c) { c.box(3.6, 0.02, 2.6, new THREE.MeshStandardMaterial({ map: TEX.fabric, color: 0x4a3b5c, roughness: 1 }), 0, 0.01, 0, { cast: false }); c.box(3.2, 0.005, 2.2, new THREE.MeshStandardMaterial({ map: TEX.fabric, color: 0x6a4f7a, roughness: 1 }), 0, 0.022, 0, { cast: false }); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "upRug" + ": " + e.message); }
    try { growDefProp('upDresser', { label: 'dresser', floor: 1, x: -11.4, z: 4.5, rot: 1, build: function (c) { c.box(1.2, 0.9, 0.5, MAT.darkwood, 0, 0.45, 0, { solid: true }); c.box(1.24, 0.04, 0.54, MAT.wood, 0, 0.92, 0, { cast: false }); for (var r = 0; r < 3; r++) for (var q = 0; q < 2; q++) drawer(c, 0.52, 0.22, 0.02, -0.29 + q * 0.58, 0.2 + r * 0.27, 0.24); c.box(0.5, 0.6, 0.03, MAT.darkwood, 0.2, 1.3, -0.2); c.box(0.44, 0.54, 0.005, new THREE.MeshPhysicalMaterial({ color: 0xdfe8f0, roughness: 0.05, metalness: 0.9 }), 0.2, 1.3, -0.18, { cast: false }); c.cyl(0.05, 0.04, 0.12, MAT.jar, -0.4, 1.0, 0, 12); c.box(0.2, 0.25, 0.02, colorMat(0x8a2a2a, 0.8), -0.35, 1.06, -0.15).rotation.z = 0.1; } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "upDresser" + ": " + e.message); }
    try { growDefProp('breedBench', { label: 'breeding bench', x: -3.8, z: -ROOM.z + 0.45, rot: 0, build: function (c) {
          var B = breedState(); if (!B.owned) { notFitted(c, 1.7, 0.7, ['BREEDING BENCH', 'E to fit it · ' + money(BREED.price)], 'breedBench'); return; }
          // a steel bench with a lit hood over two mother-plant bays, a seed tray, a magnifier lamp and a read-out
          c.box(1.7, 0.05, 0.7, MAT.steel, 0, 0.9, 0, { solid: true }); c.box(1.6, 0.03, 0.6, MAT.gunmetal, 0, 0.3, 0, { cast: false }); [[-0.8, -0.3], [0.8, -0.3], [-0.8, 0.3], [0.8, 0.3]].forEach(function (l) { c.box(0.045, 0.88, 0.045, MAT.steel, l[0], 0.44, l[1]); c.cyl(0.03, 0.035, 0.02, MAT.soft, l[0], 0.01, l[1], 12); });
          drawer(c, 0.5, 0.16, 0.02, -0.5, 0.78, 0.33, MAT.gunmetal); drawer(c, 0.5, 0.16, 0.02, 0.05, 0.78, 0.33, MAT.gunmetal);
          [[-0.84, -0.32], [0.18, -0.32], [-0.84, 0.2], [0.18, 0.2]].forEach(function (p) { c.box(0.025, 0.95, 0.025, MAT.alu, p[0], 1.4, p[1], { sharp: true }); }); c.box(1.06, 0.04, 0.56, MAT.gunmetal, -0.33, 1.88, -0.06); c.lit(0xf6e8ff, 0.9, 0.06, -0.33, 1.855, -0.06, 0, Math.PI / 2); c.lit(0xffd9f2, 0.9, 0.06, -0.33, 1.855, 0.08, 0, Math.PI / 2);
          c.box(1.04, 0.95, 0.006, MAT.glass, -0.33, 1.4, -0.325, { cast: false, sharp: true }); c.light(new THREE.PointLight(0xf2d8ff, 0.5, 2.2), -0.33, 1.6, 0.1);
          var J = B.job, k = J ? clamp(J.t / (BREED.ms / 1000), 0, 1) : 0; world.breed = { figs: [], pods: null, scr: null };
          [[-0.62, J ? J.a : ''], [-0.04, J ? J.b : '']].forEach(function (p) { var pg = new THREE.Group(); pg.position.set(p[0], 0.925, -0.06); pg.scale.setScalar(0.62); c.add(pg); makePot(pg, !!J); if (J) { var f = plantFigure(strainById(p[1])); f.position.y = 0.3; pg.add(f); f.userData.set(0.75 + k * 0.25, 1.15); world.breed.figs.push(f); } });
          c.box(0.34, 0.03, 0.24, MAT.soft, 0.52, 0.94, 0.12, { r: 0.008 }); for (var s = 0; s < 12; s++) { var sd = c.cyl(0.016, 0.014, 0.02, colorMat(0x3a2a1c, 1), 0.4 + (s % 4) * 0.08, 0.965, 0.04 + Math.floor(s / 4) * 0.08, 10); if (J && k >= 1) c.cyl(0.006, 0.006, 0.012, colorMat(0xc9a66a, 0.6), 0.4 + (s % 4) * 0.08, 0.982, 0.04 + Math.floor(s / 4) * 0.08, 8); }
          c.cyl(0.04, 0.035, 0.1, MAT.jar, 0.74, 0.975, -0.2, 14); [-0.012, 0.012, 0].forEach(function (dx, i) { c.cyl(0.003, 0.003, 0.16, MAT.wood, 0.74 + dx, 1.02, -0.2 + (i - 1) * 0.01, 6).rotation.z = dx * 8; });
          c.cyl(0.06, 0.065, 0.016, MAT.gunmetal, 0.62, 0.933, -0.24, 18); var arm = c.box(0.014, 0.34, 0.014, MAT.alu, 0.58, 1.08, -0.24, { sharp: true }); arm.rotation.z = 0.3; var ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.009, 8, 24), MAT.gunmetal); ring.position.set(0.5, 1.25, -0.2); ring.rotation.x = Math.PI / 2 - 0.5; c.add(ring); var lens = new THREE.Mesh(new THREE.CircleGeometry(0.058, 20), MAT.jar); lens.position.copy(ring.position); lens.rotation.x = -0.5 - Math.PI / 2; c.add(lens);
          var scr = readout(0.36, 0.2, '#c9a0ff'), sg = new THREE.Group(); sg.position.set(0.55, 1.5, -0.3); c.add(sg); screenShell(sg, 0.36, 0.2, { bezel: 0.012, depth: 0.02, led: 0xc9a0ff }); scr.position.z = 0.0005; sg.add(scr); c.box(0.03, 0.5, 0.03, MAT.gunmetal, 0.55, 1.2, -0.325); world.breed.scr = scr;
          c.sign(['BREEDING BENCH', 'two parents, one new strain'], 0.9, 0.3, -0.33, 2.15, -0.3, 0, { titleColor: '#c9a0ff' });
          c.hit(1.7, 1.2, 0.7, 0, 1.4, 0, { kind: 'breedBench' });
        } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "breedBench" + ": " + e.message); }
    try { growDefProp('trophyCase', { label: 'trophy cabinet', x: -5.25, z: 4 + WALL_T / 2 + 0.24, rot: 0, build: function (c) {
          // a glazed cabinet in dark wood: three lit glass shelves, the entry jar on a stand in the middle of the top one
          var C = cupState(), w = 1.3, d = 0.42;
          c.box(w, 0.5, d, MAT.darkwood, 0, 0.25, 0, { solid: true }); drawer(c, 0.56, 0.3, 0.02, -0.31, 0.27, d / 2 - 0.01); drawer(c, 0.56, 0.3, 0.02, 0.31, 0.27, d / 2 - 0.01); c.box(w + 0.04, 0.04, d + 0.04, MAT.darkwood, 0, 0.52, 0); c.box(w + 0.04, 0.06, d + 0.04, MAT.darkwood, 0, 2.0, 0);
          c.box(w, 1.46, 0.02, colorMat(0x16241c, 0.9), 0, 1.26, -d / 2 + 0.01, { cast: false }); [-1, 1].forEach(function (sd) { c.box(0.04, 1.46, d, MAT.darkwood, sd * (w / 2 - 0.02), 1.26, 0); c.box(0.006, 1.4, d - 0.06, MAT.glass, sd * (w / 2 - 0.05), 1.26, 0, { cast: false, sharp: true }); });
          var gl = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.1, 1.42), new THREE.MeshPhysicalMaterial({ color: 0xdff0ff, transparent: true, opacity: 0.12, roughness: 0.02, clearcoat: 1, side: THREE.DoubleSide })); gl.position.set(0, 1.26, d / 2 - 0.01); c.add(gl); c.box(0.03, 1.46, 0.03, MAT.darkwood, 0, 1.26, d / 2 - 0.01); c.cyl(0.008, 0.008, 0.12, MAT.brass, 0.05, 1.2, d / 2 + 0.012, 8);
          var ys = [0.56, 1.04, 1.52]; ys.forEach(function (y) { if (y > 0.6) c.box(w - 0.1, 0.012, d - 0.06, MAT.glass, 0, y, 0, { cast: false, sharp: true }); c.lit(0xfff1cf, w - 0.14, 0.014, 0, y + 0.455, d / 2 - 0.05, 0, Math.PI / 2); });
          c.light(new THREE.PointLight(0xffe9b0, 0.5, 2.4), 0, 1.5, 0.5);
          var show = C.trophies.slice(-CUP.shelf).reverse(), order = { gold: 0, silver: 1, bronze: 2 }; show.sort(function (a, b) { return order[a.metal] - order[b.metal]; });
          show.forEach(function (t, i) { var row = Math.floor(i / 3), col = i % 3, tm = trophyMesh(t.metal, t.metal === 'gold' ? 1.35 : 1.15); tm.position.set(-0.4 + col * 0.4, [1.532, 1.052, 0.572][row], -0.04); c.add(tm); c.sign([t.strain, 'day ' + t.day], 0.26, 0.07, -0.4 + col * 0.4, [1.532, 1.052, 0.572][row] + 0.036, 0.13, 0, { size: 17, bg: '#c9a24a', color: '#2a2210', titleColor: '#2a2210', line: 'rgba(60,45,10,.6)' }); });
          if (!show.length) c.sign(['No cups yet', 'enter a jar and win one'], 0.6, 0.18, 0, 1.2, 0.0, 0, { size: 26, bg: 'rgba(0,0,0,0)', color: '#a2ad9c', titleColor: '#f3eee0', line: 'rgba(0,0,0,0)' });
          if (C.entry) { var st = strainById(C.entry.strain); c.cyl(0.07, 0.08, 0.03, MAT.darkwood, 0.45, 0.595, 0.1, 18); c.cyl(0.05, 0.05, 0.11, MAT.jar, 0.45, 0.665, 0.1, 18); c.cyl(0.042, 0.042, 0.07, colorMat(st.bud, 0.9), 0.45, 0.65, 0.1, 12); c.cyl(0.052, 0.052, 0.014, MAT.jarLid, 0.45, 0.727, 0.1, 18); }
          c.sign(['THE CANNABIS CUP', 'next judging: day ' + cupNext()], 1.1, 0.3, 0, 2.22, -0.1, 0, { titleColor: '#f0b94d' });
          c.hit(w, 2.0, d + 0.1, 0, 1.0, 0.03, { kind: 'trophyCase' });
        } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "trophyCase" + ": " + e.message); }
    try { growDefProp('hydroBay', { label: 'hydroponics bay', x: ROOM.x - 0.55, z: -5.9, rot: 3, build: function (c) {
          var H = hydroState(); world.hydro = null; if (!H.owned) { notFitted(c, 2.5, 0.7, ['HYDROPONICS BAY', 'E to fit it · ' + money(HYDRO.price)], 'hydroTank'); return; }
          // a rack on castors: two tiers of white channels with net pots, a light bar over each tier, the tank and pump underneath, a controller on the end
          var white = colorMat(0xf2f4f5, 0.35, 0.02), pipe = colorMat(0x2f6fb0, 0.4, 0.1);
          [[-1.2, -0.3], [1.2, -0.3], [-1.2, 0.3], [1.2, 0.3]].forEach(function (p) { c.box(0.045, 2.0, 0.045, MAT.alu, p[0], 1.04, p[1], { sharp: true }); c.cyl(0.035, 0.035, 0.04, MAT.soft, p[0], 0.02, p[1], 12); });
          [0.06, 0.62, 1.24, 2.02].forEach(function (y) { [-0.3, 0.3].forEach(function (z) { c.box(2.44, 0.035, 0.035, MAT.alu, 0, y, z, { sharp: true }); }); [-1.2, 1.2].forEach(function (x) { c.box(0.035, 0.035, 0.6, MAT.alu, x, y, 0, { sharp: true }); }); });
          [0.76, 1.38].forEach(function (y, t) {
            c.box(2.36, 0.09, 0.2, white, 0, y, 0.02, { r: 0.02 }); c.box(0.03, 0.11, 0.22, white, -1.19, y, 0.02); c.box(0.03, 0.11, 0.22, white, 1.19, y, 0.02);
            for (var i = 0; i < 4; i++) { var x = -0.9 + i * 0.6; c.cyl(0.06, 0.045, 0.05, MAT.black, x, y + 0.035, 0.02, 16); c.cyl(0.052, 0.052, 0.012, colorMat(0x8a5a3a, 1), x, y + 0.062, 0.02, 14); c.hit(0.5, 0.56, 0.5, x, y + 0.3, 0.04, { kind: 'hydroSite', i: t * 4 + i }); }
            c.box(2.3, 0.03, 0.12, MAT.gunmetal, 0, y + 0.56, 0.02, { r: 0.008 }); c.lit(0xfdf3ff, 2.2, 0.07, 0, y + 0.5435, 0.02, 0, Math.PI / 2); c.light(new THREE.PointLight(0xf6e8ff, 0.4, 2.0), 0, y + 0.4, 0.3);
            c.cyl(0.014, 0.014, 0.3, pipe, 1.12 - t * 0.06, y - 0.19, -0.12, 8);
          });
          c.box(1.5, 0.42, 0.5, colorMat(0x1f2a33, 0.45, 0.05), -0.3, 0.3, 0, { solid: true, r: 0.03 }); c.box(1.42, 0.02, 0.44, colorMat(0x3d7ab3, 0.15, 0.1, { transparent: true, opacity: 0.75 }), -0.3, 0.5, 0, { cast: false }); c.box(0.3, 0.02, 0.2, MAT.gunmetal, -0.8, 0.525, 0.05, { cast: false });
          c.box(0.22, 0.26, 0.24, MAT.gunmetal, 0.72, 0.22, 0, { r: 0.02 }); c.cyl(0.05, 0.05, 0.1, MAT.steel, 0.72, 0.4, 0, 14); c.cyl(0.016, 0.016, 1.2, pipe, 0.95, 0.9, -0.2, 8); c.cyl(0.016, 0.016, 0.5, pipe, 0.72, 0.5, -0.2, 8).rotation.z = 0.9; c.solid(-1.25, 1.25, -0.35, 0.35);
          var scr = readout(0.3, 0.2, '#7cc4ff'), sg = new THREE.Group(); sg.position.set(1.0, 1.05, 0.34); c.add(sg); c.box(0.36, 0.34, 0.06, MAT.gloss, 1.0, 1.0, 0.305, { r: 0.01 }); screenShell(sg, 0.3, 0.2, { bezel: 0.01, depth: 0.012, led: 0x7cc4ff }); scr.position.z = 0.0005; sg.add(scr); [[-0.07, 0x6fdc8c], [0, 0xf0b94d], [0.07, 0xff6b5e]].forEach(function (b) { c.cyl(0.014, 0.014, 0.012, colorMat(b[1], 0.35), 1.0 + b[0], 0.885, 0.34, 12).rotation.x = Math.PI / 2; });
          c.hit(1.6, 0.6, 0.6, -0.3, 0.3, 0.05, { kind: 'hydroTank' }); c.hit(0.4, 0.4, 0.2, 1.0, 1.0, 0.36, { kind: 'hydroTank' });
          c.sign(['HYDROPONICS', 'keep the tank at pH ' + HYDRO.phLo + ' to ' + HYDRO.phHi], 1.2, 0.3, 0, 2.25, 0.0, 0, { titleColor: '#7cc4ff' });
          world.hydro = { dyn: c.dynGroup(), figs: [], scr: scr };
        }, after: function () { hydroSync(); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "hydroBay" + ": " + e.message); }
    try { growDefProp('merchStand', { label: 'merch stand', x: -8.6, z: 6.2, rot: 0, build: function (c) {
          var M = merchState(); world.merch = null; if (!M.owned) { notFitted(c, 1.8, 0.7, ['MERCH STAND', 'E to fit it · ' + money(MERCH.price)], 'merchStand'); return; }
          // a two-sided gondola: a slatted panel on a weighted base, a rail of shirts on each face, a shelf of caps above, mugs and totes below
          c.box(1.7, 0.1, 0.62, MAT.gunmetal, 0, 0.05, 0, { solid: true, r: 0.012 }); c.box(1.6, 1.9, 0.05, MAT.darkwood, 0, 1.05, 0); for (var s = 0; s < 15; s++) [1, -1].forEach(function (f) { c.box(1.58, 0.012, 0.004, MAT.black, 0, 0.2 + s * 0.12, f * 0.027, { cast: false, sharp: true }); });
          [-0.82, 0.82].forEach(function (x) { c.box(0.04, 1.96, 0.1, MAT.alu, x, 1.05, 0); }); c.box(1.7, 0.04, 0.12, MAT.alu, 0, 2.02, 0);
          [1, -1].forEach(function (f) { c.box(1.5, 0.02, 0.22, MAT.steel, 0, 1.78, f * 0.14, { cast: false }); c.box(1.5, 0.02, 0.24, MAT.steel, 0, 0.74, f * 0.15, { cast: false }); c.cyl(0.008, 0.008, 1.5, MAT.chrome, 0, 1.66, f * 0.1, 8).rotation.z = Math.PI / 2; [-0.7, 0.7].forEach(function (x) { c.box(0.012, 0.012, 0.1, MAT.chrome, x, 1.66, f * 0.06, { sharp: true, cast: false }); }); [-0.4, 0, 0.4].forEach(function (x) { c.cyl(0.005, 0.005, 0.12, MAT.chrome, x, 0.56, f * 0.09, 6).rotation.x = Math.PI / 2; }); });
          c.sign(['GROW CO. MERCH', 'pay at the window'], 1.2, 0.26, 0, 2.2, 0.062, 0, { titleColor: '#6fdc8c' }); c.sign(['GROW CO. MERCH', 'pay at the window'], 1.2, 0.26, 0, 2.2, -0.062, Math.PI, { titleColor: '#6fdc8c' });
          c.light(new THREE.PointLight(0xfff1cf, 0.35, 2.4), 0, 2.1, 0.6); c.hit(1.8, 2.0, 0.8, 0, 1.0, 0, { kind: 'merchStand' });
          world.merch = { dyn: c.dynGroup() };
        }, after: function () { merchSync(); } }); } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + "merchStand" + ": " + e.message); }
    try { fixtureFromBuild('counterTill', 'till', 0, function () {
          // the cash drawer cabinet: brushed steel on rubber feet, the terminal bolted to its lid
          var reg = box(0.5, 0.118, 0.46, MAT.gunmetal, -1.0, 1.127, 3.55, { r: 0.01 });
          [[-0.2, -0.18], [0.2, -0.18], [-0.2, 0.18], [0.2, 0.18]].forEach(function (f) { cyl(0.022, 0.026, 0.012, MAT.soft, -1.0 + f[0], 1.066, 3.55 + f[1], null, 12); });
          box(0.46, 0.004, 0.42, MAT.steel, -1.0, 1.1875, 3.55, { cast: false });
          // the till is a tablet on a stand: its screen is a touch screen (look at it, press E), and the cash drawer sits under it
          world.reg = { drawerT: 0, lastSale: null };
          buildPos(-1.0, 3.62);
          var scrGlow = new THREE.PointLight(0x6fdc8c, 0.12, 1.0); scrGlow.position.set(-1.0, 1.3, 3.5); world.group.add(scrGlow);   /* in the group, so the glow goes where the till goes */
          var drawer = new THREE.Group(); drawer.position.set(-1.0, 1.118, 3.55); world.group.add(drawer); world.reg.drawer = drawer;
          (function () {
            function dm(geo, mat, x, y, z) { var m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); drawer.add(m); return m; }
            var trayM = colorMat(0x1a1d21, 0.7, 0.1), cupM = colorMat(0x2b3036, 0.6, 0.2);
            dm(bevelGeo(0.45, 0.07, 0.4), trayM, 0, 0, 0);
            var face = dm(bevelGeo(0.485, 0.102, 0.022, 0.007), MAT.steel, 0, 0, -0.233); face.castShadow = true;
            dm(new THREE.BoxGeometry(0.17, 0.016, 0.006), MAT.black, 0, -0.026, -0.2445); dm(new THREE.BoxGeometry(0.17, 0.005, 0.012), MAT.chrome, 0, -0.016, -0.248);   /* the finger pull and its lip */
            dm(new THREE.BoxGeometry(0.3, 0.004, 0.004), MAT.black, 0, 0.03, -0.2445);                                                                                   /* the slot cheques and big notes go through */
            var lock = dm(roundCylGeo(0.012, 0.012, 0.008, 16), MAT.brass, 0.19, 0.0, -0.246); lock.rotation.x = Math.PI / 2; dm(new THREE.BoxGeometry(0.003, 0.012, 0.003), MAT.black, 0.19, 0.0, -0.2505);
            /* inside, seen when it slides out: coin cups along the front, notes under sprung clips behind them */
            [[0x9ff0b5, 0], [0xe8e8ee, 1], [0xffd766, 2], [0x9ad0ff, 3], [0xf3b6c8, 4]].forEach(function (sl) {
              var x = -0.172 + sl[1] * 0.086;
              dm(new THREE.BoxGeometry(0.078, 0.004, 0.17), cupM, x, 0.037, 0.0); dm(new THREE.BoxGeometry(0.07, 0.014, 0.15), colorMat(sl[0], 0.85), x, 0.046, 0.0);
              dm(new THREE.BoxGeometry(0.06, 0.006, 0.012), MAT.chrome, x, 0.056, 0.035);
              if (sl[1] < 4) dm(new THREE.BoxGeometry(0.004, 0.026, 0.3), trayM, x + 0.043, 0.048, -0.04);
              dm(new THREE.BoxGeometry(0.078, 0.004, 0.085), cupM, x, 0.037, -0.145);
              var coinM = sl[1] % 3 === 0 ? MAT.chrome : sl[1] % 3 === 1 ? MAT.brass : colorMat(0xb87333, 0.35, 1);
              for (var cn = 0; cn < 2; cn++) dm(roundCylGeo(0.014, 0.014, 0.012 + ((sl[1] * 7 + cn * 3) % 4) * 0.005, 14), coinM, x - 0.017 + cn * 0.034, 0.048, -0.145 + (cn ? 0.012 : -0.012));
            });
            dm(new THREE.BoxGeometry(0.43, 0.026, 0.004), trayM, 0, 0.048, -0.095);
          })();
          drawRegister();
          // the receipt printer, with a length of paper curling out of it
          box(0.16, 0.12, 0.2, MAT.gloss, -0.66, 1.121, 3.68, { r: 0.012 }); box(0.15, 0.008, 0.11, MAT.plastic, -0.66, 1.183, 3.705, { cast: false }); box(0.1, 0.004, 0.006, MAT.black, -0.66, 1.1825, 3.638, { cast: false });
          (function () {
            var pg = new THREE.PlaneGeometry(0.08, 0.13, 1, 10), pp = pg.attributes.position;
            for (var i = 0; i < pp.count; i++) { var t = (pp.getY(i) + 0.065) / 0.13, a = t * 1.9; pp.setXYZ(i, pp.getX(i), Math.sin(a) * 0.055, -(1 - Math.cos(a)) * 0.055 - t * 0.012); }
            pg.computeVertexNormals(); var paper = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({ color: 0xfbfaf4, roughness: 0.9, side: THREE.DoubleSide })); paper.position.set(-0.66, 1.184, 3.638); paper.castShadow = true; world.group.add(paper);
            var pl = new THREE.Mesh(new THREE.CircleGeometry(0.004, 8), new THREE.MeshBasicMaterial({ color: 0x6fdc8c, toneMapped: false })); pl.position.set(-0.6, 1.188, 3.75); pl.rotation.x = -Math.PI / 2; world.group.add(pl);
            cyl(0.008, 0.008, 0.004, MAT.soft, -0.62, 1.189, 3.75, null, 10);
          })();
          // the card reader on its stalk, facing the window
          (function () {
            cyl(0.04, 0.046, 0.012, MAT.soft, -0.44, 1.067, 3.79, null, 18); cyl(0.011, 0.011, 0.075, MAT.alu, -0.44, 1.108, 3.79, null, 10);
            var rg = new THREE.Group(); rg.position.set(-0.44, 1.165, 3.795); rg.rotation.x = -0.62; world.group.add(rg);
            var body = new THREE.Mesh(bevelGeo(0.084, 0.165, 0.028, 0.011), MAT.gloss); body.castShadow = true; rg.add(body);
            var rc = document.createElement('canvas'); rc.width = 264; rc.height = 176; var rx = rc.getContext('2d'); scrLcd(rx, 264, 176, DESK_OK); rx.textAlign = 'center'; rx.fillStyle = DESK_INK; rx.font = '700 34px ' + DESK_FONT; rx.fillText('Tap or insert', 132, 34); rx.strokeStyle = DESK_OK; rx.lineWidth = 6; rx.lineCap = 'round'; for (var w = 0; w < 4; w++) { rx.beginPath(); rx.arc(96, 122, 14 + w * 14, -0.75, 0.75); rx.stroke(); }
            var rs = litPlane(rc, 0.066, 0.044); rs.position.set(0, 0.05, 0.0145); rg.add(rs);
            for (var kr = 0; kr < 4; kr++) for (var kc = 0; kc < 3; kc++) { var km = new THREE.Mesh(new THREE.BoxGeometry(0.017, 0.012, 0.004), kr === 3 ? colorMat([0xd0352b, 0xe3b52c, 0x39a85a][kc], 0.5) : colorMat(0xb9c0c6, 0.5)); km.position.set(-0.022 + kc * 0.022, 0.008 - kr * 0.018, 0.0155); rg.add(km); }
            var slot = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.004, 0.006), MAT.black); slot.position.set(0, -0.078, 0.008); rg.add(slot);
          })();
          // the scanner in its cradle, on the cashier's side
          (function () {
            box(0.09, 0.02, 0.12, MAT.soft, -1.37, 1.071, 3.5, { r: 0.008 }); cyl(0.016, 0.02, 0.06, MAT.soft, -1.37, 1.11, 3.52, null, 12);
            var sg = new THREE.Group(); sg.position.set(-1.37, 1.15, 3.5); sg.rotation.set(0.5, 0.25, 0); world.group.add(sg);
            var grip = new THREE.Mesh(bevelGeo(0.036, 0.13, 0.044, 0.014), MAT.soft); grip.position.set(0, -0.02, 0.02); grip.castShadow = true; sg.add(grip);
            var head = new THREE.Mesh(bevelGeo(0.066, 0.05, 0.11, 0.016), MAT.gloss); head.position.set(0, 0.06, -0.015); head.castShadow = true; sg.add(head);
            var eye = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.026), new THREE.MeshBasicMaterial({ color: 0xff3b30, toneMapped: false })); eye.position.set(0, 0.06, -0.0705); eye.rotation.y = Math.PI; sg.add(eye);
            var trig = new THREE.Mesh(bevelGeo(0.014, 0.03, 0.012, 0.004), colorMat(0xe3b52c, 0.5)); trig.position.set(0, 0.022, -0.006); sg.add(trig);
          })();
          interactable(reg, { kind: 'register', label: 'Till', prompt: 'Sell & serve' });
          }, { table: true, baseY: 1.06 }); } catch (e) {}
    try { fixtureFromBuild('tipJar', 'tip jar', 0, function () { cyl(0.08, 0.08, 0.18, MAT.jar, 1.2, 1.15, 3.55); cyl(0.09, 0.09, 0.02, MAT.jarLid, 1.2, 1.25, 3.55); interactable(box(0.22, 0.26, 0.22, MAT.none, 1.2, 1.15, 3.55, { cast: false }), { kind: 'tips' }); for (var c = 0; c < 6; c++) { var coin = cyl(0.02, 0.02, 0.004, MAT.chrome, 1.2 + randf(-0.04, 0.04), 1.07 + c * 0.006, 3.55 + randf(-0.04, 0.04), null, 10); coin.rotation.set(randf(-0.3, 0.3), 0, randf(-0.3, 0.3)); } }, { table: true, baseY: 1.06 }); } catch (e) {}
    try { fixtureFromBuild('bizCards', 'business cards', 0, function () { box(0.1, 0.03, 0.07, MAT.white, 0.8, 1.075, 3.5, { cast: false }); box(0.1, 0.005, 0.07, colorMat(0x6fdc8c), 0.8, 1.093, 3.5, { cast: false }); box(0.16, 0.08, 0.13, MAT.none, 0.8, 1.1, 3.5, { cast: false }); }, { table: true, baseY: 1.06 }); } catch (e) {}
    try { fixtureFromBuild('deskBell', 'desk bell', 0, function () { cyl(0.05, 0.06, 0.03, MAT.chrome, 0.4, 1.075, 3.5, null, 16); var bell = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), MAT.chrome); bell.position.set(0.4, 1.09, 3.5); world.group.add(bell); cyl(0.008, 0.008, 0.02, MAT.black, 0.4, 1.14, 3.5, null, 8); box(0.16, 0.12, 0.16, MAT.none, 0.4, 1.12, 3.5, { cast: false }); }, { table: true, baseY: 1.06 }); } catch (e) {}
    try { fixtureFromBuild('keyHook', 'key hook', -Math.PI / 2, function () {
            var brass = colorMat(0xc9a24a, 0.35, 0.8), board = colorMat(0x6b4a2a, 0.8), hx = -4.13;
            box(0.03, 0.2, 0.26, board, hx, 1.5, -0.4, { cast: false });
            [-0.07, 0.07].forEach(function (dz) { var pin = cyl(0.008, 0.008, 0.05, brass, hx - 0.025, 1.48, -0.4 + dz, null, 8); pin.rotation.z = Math.PI / 2; cyl(0.012, 0.012, 0.012, brass, hx - 0.05, 1.465, -0.4 + dz, null, 8).rotation.z = Math.PI / 2; });
            signPlane(['KEYS'], 0.2, 0.05, hx - 0.016, 1.575, -0.4, -Math.PI / 2, { size: 24, bg: '#6b4a2a', titleColor: '#e8c27a', line: 'rgba(0,0,0,0)' });
            var ring = new THREE.Group(); ring.position.set(hx - 0.05, 0, -0.47); world.group.add(ring); world.keyRing = ring;
            var loop = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.004, 8, 16), brass); loop.position.y = 1.45; loop.rotation.y = Math.PI / 2; ring.add(loop);
            for (var k = 0; k < 3; k++) { var b = new THREE.Mesh(bevelGeo(0.003, 0.045, 0.01), k === 1 ? colorMat(0x9aa0a6, 0.4, 0.7) : brass); b.position.set(0, 1.405, -0.015 + k * 0.015); ring.add(b); }
            var hit = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.42, 0.42), MAT.none); hit.position.set(hx - 0.1, 1.48, -0.42); world.group.add(hit); interactable(hit, { kind: 'keyHook' });
          }); } catch (e) {}
    try { fixtureFromBuild('roster', 'staff roster', -Math.PI / 2, function () { box(0.04, 1.0, 1.2, colorMat(0x8a6a3a, 0.9), -4.13, 1.7, 2.35, { cast: false }); signPlane(['STAFF ROSTER', 'driver · operator · night guard · technician'], 1.1, 0.36, -4.16, 1.95, 2.35, -Math.PI / 2, { size: 24 }); hit(0.4, 1.2, 1.3, -4.25, 1.7, 2.35, { kind: 'roster' }); }); } catch (e) {}
    try { propExtra('tabletDock', function (c) {
          [-0.232, 0.232].forEach(function (x) { c.box(0.018, 0.9, 0.31, MAT.alu, x, 0.47, 0.02, { cast: false }); });
          c.lit(0x6fdc8c, 0.4, 0.006, 0, 0.9, 0.173); c.lit(0x6fdc8c, 0.4, 0.006, 0, 0.12, 0.173);
          c.cyl(0.006, 0.006, 0.5, MAT.black, 0.17, 0.3, -0.16, 6); c.box(0.07, 0.11, 0.03, MAT.white, 0.17, 0.58, -0.175, { cast: false });
        }); } catch (e) {}
    try { propExtra('cureShelf', function (c) {
          c.box(3.16, 0.07, 0.48, MAT.darkwood, 0, 2.335, 0.02); c.box(3.1, 0.04, 0.44, MAT.darkwood, 0, 2.285, 0.01, { cast: false }); c.box(3.06, 0.1, 0.4, MAT.darkwood, 0, 0.05, 0);
          [1.05, 1.6, 2.15].forEach(function (y) { warmStrip(c, 1.4, -0.75, y - 0.027, 0.16); warmStrip(c, 1.4, 0.75, y - 0.027, 0.16); }); warmStrip(c, 1.4, -0.75, 2.258, 0.16); warmStrip(c, 1.4, 0.75, 2.258, 0.16);
          [-1.5, 0, 1.5].forEach(function (x) { c.box(0.075, 2.2, 0.012, MAT.darkwood, x, 1.2, 0.206, { cast: false }); });
          var ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.008, 8, 24), MAT.brass); ring.position.set(-1.3, 2.0, 0.214); c.add(ring);
        }); } catch (e) {}
    try { propExtra('dryRack', function (c) {
          var hw = 3.25, ly = 2.1;
          c.box(hw * 2 - 0.9, 0.012, 0.8, new THREE.MeshStandardMaterial({ map: TEX.fabric, color: 0x3d342a, roughness: 1 }), 0, 0.006, 0, { cast: false, sharp: true });
          [-hw, hw].forEach(function (px) { c.box(0.13, 0.16, 0.13, MAT.gunmetal, px, ly - 0.02, 0, { r: 0.01 }); c.box(0.13, 0.12, 0.13, MAT.gunmetal, px, 0.12, 0, { r: 0.01 }); });
          for (var h = 0; h < 12; h++) { var hk = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.004, 6, 14, Math.PI * 1.5), MAT.chrome); hk.position.set(-hw + 0.3 + h * 0.55, ly - 0.05, 0); hk.rotation.y = Math.PI / 2; c.add(hk); }
          var dial = c.cyl(0.07, 0.07, 0.025, MAT.white, hw - 0.002, 1.5, 0.06, 24); dial.rotation.x = Math.PI / 2; var rim = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.008, 8, 24), MAT.brass); rim.position.set(hw - 0.002, 1.5, 0.075); c.add(rim); var nd = c.box(0.004, 0.05, 0.002, colorMat(0xc0271b, 0.5), hw + 0.008, 1.51, 0.075, { cast: false, sharp: true }); nd.rotation.z = -0.6;
        }); } catch (e) {}
    try { propExtra('dryTable', function (c) {
          c.box(0.84, 0.03, 0.54, MAT.wood, 0, 0.25, 0, { cast: false }); c.box(0.5, 0.1, 0.02, MAT.darkwood, 0, 0.7, 0.29); c.box(0.12, 0.015, 0.02, MAT.chrome, 0, 0.7, 0.306, { cast: false });
          c.cyl(0.13, 0.13, 0.012, MAT.chrome, 0, 0.843, 0, 28); c.cyl(0.03, 0.04, 0.012, MAT.gunmetal, 0, 0.836, 0, 12); c.lit(0x6fdc8c, 0.07, 0.022, 0, 0.8665, 0.15, 0, -Math.PI / 2);
          c.box(0.3, 0.2, 0.3, colorMat(0xc8a97a, 1), -0.22, 0.365, 0); for (var j = 0; j < 3; j++) { c.cyl(0.05, 0.05, 0.12, MAT.jar, 0.08 + j * 0.13, 0.325, 0.05, 14); c.cyl(0.052, 0.052, 0.014, MAT.jarLid, 0.08 + j * 0.13, 0.392, 0.05, 14); }
          var roll = c.cyl(0.045, 0.045, 0.2, colorMat(0xf4f4f0, 0.5, 0, { transparent: true, opacity: 0.85 }), -0.3, 0.855, -0.2, 16); roll.rotation.z = Math.PI / 2;
          var sc1 = c.box(0.012, 0.004, 0.13, MAT.chrome, 0.1, 0.808, 0.2, { cast: false }); sc1.rotation.y = 0.5; var sc2 = c.box(0.012, 0.004, 0.13, MAT.chrome, 0.11, 0.81, 0.2, { cast: false }); sc2.rotation.y = 0.2; [0.06, 0.1].forEach(function (x) { var lp = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.004, 6, 12), colorMat(0xd0201a, 0.5)); lp.rotation.x = Math.PI / 2; lp.position.set(x + 0.02, 0.81, 0.265); c.add(lp); });
        }); } catch (e) {}
    try { propExtra('jarBoxes', function (c) {
          var tape = colorMat(0xd9c28a, 0.45), bxM = colorMat(0xc8a97a, 1);
          [[0.3, 0, 0.42], [0.3, 0, 0]].forEach(function (b) { c.box(0.06, 0.004, 0.53, tape, b[0], 0.418 + b[2], b[1], { cast: false, sharp: true }); c.box(0.06, 0.12, 0.004, tape, b[0], 0.36 + b[2], b[1] + 0.262, { cast: false, sharp: true }); });
          [-1, 1].forEach(function (sd) { var fl = c.box(0.5, 0.008, 0.24, bxM, -0.3, 0.47, sd * 0.33); fl.rotation.x = sd * 0.95; var f2 = c.box(0.24, 0.008, 0.5, bxM, -0.3 + sd * 0.33, 0.47, 0); f2.rotation.z = -sd * 0.95; });
          for (var i = 0; i < 9; i++) { c.cyl(0.06, 0.06, 0.03, MAT.jar, -0.45 + (i % 3) * 0.15, 0.4, -0.15 + Math.floor(i / 3) * 0.15, 14); c.cyl(0.062, 0.062, 0.014, MAT.jarLid, -0.45 + (i % 3) * 0.15, 0.424, -0.15 + Math.floor(i / 3) * 0.15, 14); }
        }); } catch (e) {}
    try { propExtra('hose', function (c) {
          c.box(0.5, 1.0, 0.02, MAT.gunmetal, -0.15, 1.05, -0.52, { cast: false }); [[-0.35, 0.62], [0.05, 0.62], [-0.35, 1.48], [0.05, 1.48]].forEach(function (p) { c.cyl(0.012, 0.012, 0.012, MAT.chrome, p[0], p[1], -0.506, 8).rotation.x = Math.PI / 2; }); [0.85, 1.35].forEach(function (y) { c.box(0.03, 0.03, 0.5, MAT.gunmetal, -0.15, y, -0.27, { cast: false }); });
          c.box(0.62, 0.02, 0.44, MAT.gunmetal, 0.42, 0.01, 0.1, { cast: false }); c.box(0.62, 0.03, 0.015, MAT.gunmetal, 0.42, 0.025, 0.32, { cast: false }); c.box(0.62, 0.03, 0.015, MAT.gunmetal, 0.42, 0.025, -0.12, { cast: false });
          c.cyl(0.015, 0.015, 0.22, colorMat(0xb87333, 0.3, 1), -0.15, 0.45, -0.4, 10).rotation.x = Math.PI / 2; c.cyl(0.015, 0.015, 0.45, colorMat(0xb87333, 0.3, 1), -0.15, 0.225, -0.5, 10);
          c.box(0.22, 0.006, 0.22, MAT.black, -0.15, 0.064, 0.0, { cast: false, sharp: true });
        }); } catch (e) {}
    try { propExtra('fan', function (c) {
          c.cyl(0.022, 0.022, 0.02, MAT.chrome, -0.1, 0.05, 0.1, 12); c.lit(0x6fdc8c, 0.012, 0.012, 0.1, 0.0665, 0.1, 0, -Math.PI / 2);
          var cord = c.cyl(0.006, 0.006, 0.5, MAT.black, 0, 0.008, -0.4, 6); cord.rotation.x = Math.PI / 2;
        }); } catch (e) {}
    try { propExtra('soilSacks', function (c) {
          c.box(0.07, 0.008, 0.14, MAT.steel, 0.55, 0.287, 0.04, { cast: false }); var th = c.cyl(0.014, 0.012, 0.13, MAT.wood, 0.55, 0.296, -0.09, 10); th.rotation.x = Math.PI / 2;
          var heap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), MAT.soil); heap.scale.set(1, 0.35, 0.8); heap.position.set(0, 0.575, 0); c.add(heap);
          [[0, 0.3, -0.2], [0.55, 0, 0.3]].forEach(function (b) { var seam = c.box(0.02, 0.26, 0.33, colorMat(0x7a5634, 1), b[0] + 0.235, 0.14 + b[1], 0, { cast: false, sharp: true }); seam.rotation.y = b[2]; });
        }); } catch (e) {}
    try { propExtra('bucket', function (c) {
          c.cyl(0.014, 0.014, 0.1, MAT.white, 0, 0.46, 0, 10).rotation.z = Math.PI / 2; [0.1, 0.22].forEach(function (y) { var rb = new THREE.Mesh(new THREE.TorusGeometry(0.14 + y * 0.09, 0.005, 6, 28), colorMat(0x255f2a, 0.6)); rb.rotation.x = Math.PI / 2; rb.position.y = y; c.add(rb); });
          c.box(0.1, 0.04, 0.07, colorMat(0xf2d24a, 0.95), 0.27, 0.02, 0.08, { r: 0.012 }); var br = c.box(0.14, 0.03, 0.05, MAT.wood, 0.24, 0.04, -0.1); br.rotation.y = 0.5; var bs = c.box(0.13, 0.025, 0.045, colorMat(0xe8e0c8, 1), 0.24, 0.0125, -0.1, { cast: false, sharp: true }); bs.rotation.y = 0.5;
        }); } catch (e) {}
    try { propExtra('potShelf', function (c) {
          [-0.7, 0.7].forEach(function (a) { var br = c.box(0.02, 1.55, 0.015, MAT.metal, 0, 0.85, -0.14, { cast: false }); br.rotation.z = a; });
          [-0.55, 0.55].forEach(function (x) { c.box(0.08, 0.015, 0.32, MAT.black, x, 0.0075, 0, { cast: false }); });
          c.box(0.3, 0.05, 0.2, MAT.black, 0.03, 0.44, 0.03); c.box(0.27, 0.01, 0.17, MAT.soil, 0.03, 0.462, 0.03, { cast: false, sharp: true });
          for (var i = 0; i < 8; i++) { var sx = -0.075 + (i % 4) * 0.07, sz = -0.01 + Math.floor(i / 4) * 0.08; c.cyl(0.003, 0.003, 0.04, MAT.stem, sx, 0.485, sz, 5); leafAt(LEAF_GEO_SM, MAT.leaf, sx, 0.5, sz, i * 1.3, 0.9, 0.22, c.group); leafAt(LEAF_GEO_SM, MAT.leaf, sx, 0.5, sz, i * 1.3 + Math.PI, 0.9, 0.22, c.group); }
          [-0.4, 0, 0.4].forEach(function (x) { c.box(0.1, 0.035, 0.002, MAT.white, x, 1.0, 0.162, { cast: false, sharp: true }); });
        }); } catch (e) {}
    try { propExtra('lobbyBenchL', lobbyBenchExtra); } catch (e) {}
    try { propExtra('lobbyBenchR', lobbyBenchExtra); } catch (e) {}
    try { propExtra('magTable', function (c) {
          c.cyl(0.24, 0.24, 0.02, MAT.wood, 0, 0.2, 0, 24); var rim = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.01, 8, 40), MAT.brass); rim.rotation.x = Math.PI / 2; rim.position.y = 0.455; c.add(rim);
          c.cyl(0.05, 0.04, 0.07, MAT.ceramic, 0.17, 0.5, 0.15, 16); c.cyl(0.044, 0.044, 0.01, MAT.soil, 0.17, 0.532, 0.15, 12); for (var i = 0; i < 7; i++) leafAt(LEAF_GEO_SM, MAT.bigleaf, 0.17, 0.535, 0.15, i * 0.9, 0.5 + (i % 3) * 0.2, 0.2, c.group);
          var mg = c.box(0.28, 0.008, 0.2, colorMat(0x7cc4ff, 0.6), 0.02, 0.215, 0.03, { cast: false }); mg.rotation.y = -0.4; var mg2 = c.box(0.28, 0.008, 0.2, colorMat(0xe05a8a, 0.6), -0.02, 0.224, 0.0, { cast: false }); mg2.rotation.y = 0.2;
        }); } catch (e) {}
    try { propExtra('storeRack', function (c) {
          var guard = colorMat(0xf2c21a, 0.5, 0.2);
          [-1.5, 0, 1.5].forEach(function (x) { [-0.26, 0.26].forEach(function (z) { c.box(0.13, 0.012, 0.13, MAT.gunmetal, x, 0.006, z, { cast: false }); [[-0.04, -0.04], [0.04, 0.04]].forEach(function (b) { c.cyl(0.008, 0.008, 0.008, MAT.chrome, x + b[0], 0.016, z + b[1], 6); }); }); });
          [-1.5, 1.5].forEach(function (x) { c.box(0.11, 0.4, 0.05, guard, x, 0.2, 0.31, { r: 0.012 }); c.box(0.112, 0.06, 0.052, MAT.black, x, 0.3, 0.31, { cast: false, sharp: true }); c.box(0.112, 0.06, 0.052, MAT.black, x, 0.14, 0.31, { cast: false, sharp: true }); });
          for (var w = 0; w <= 24; w++) c.box(0.008, 2.2, 0.008, MAT.gunmetal, -1.5 + w * 0.125, 1.15, -0.3, { cast: false, sharp: true }); for (var hz = 0; hz < 9; hz++) c.box(3.0, 0.008, 0.008, MAT.gunmetal, 0, 0.15 + hz * 0.26, -0.3, { cast: false, sharp: true });
        }); } catch (e) {}
    try { propExtra('cellarHatch', function (c) {
          var yel = colorMat(0xf2c21a, 0.6), blk = colorMat(0x17181a, 0.7);
          for (var i = 0; i < 8; i++) { var m = i % 2 ? blk : yel, o = -0.56 + i * 0.16; c.box(0.16, 0.006, 0.08, m, o, 0.044, 0.6, { cast: false, sharp: true }); c.box(0.08, 0.006, 0.16, m, -0.6, 0.044, o, { cast: false, sharp: true }); c.box(0.08, 0.006, 0.16, m, 0.6, 0.044, o, { cast: false, sharp: true }); }
          [-0.4, 0.4].forEach(function (x) { var lp = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.022, 8, 16, Math.PI), yel); lp.position.set(x, 1.1, -0.51); lp.rotation.y = Math.PI / 2; c.add(lp); c.cyl(0.022, 0.022, 1.1, yel, x, 0.55, -0.6, 8); c.box(0.14, 0.04, 0.07, MAT.gunmetal, x, 0.06, -0.63, { cast: false }); });
          for (var r = 0; r < 3; r++) for (var t = 0; t < 5; t++) c.box(0.1, 0.004, 0.032, blk, -0.3 + t * 0.15, 0.137 + r * 0.3, -0.42, { cast: false, sharp: true });
          var strut = c.cyl(0.012, 0.012, 0.7, MAT.chrome, 0.56, 0.4, -0.35, 8); strut.rotation.x = 0.75;
        }); } catch (e) {}
    try { propExtra('cigCabinet', function (c) {
          var door = colorMat(0x353a41, 0.5, 0.5);
          warmStrip(c, 1.08, 0, 1.822, 0.245); c.box(1.2, 0.09, 0.012, MAT.steel, 0, 0.045, 0.206, { cast: false });
          [-0.29, 0.29].forEach(function (x) { c.box(0.55, 0.28, 0.014, door, x, 0.265, 0.206, { cast: false, r: 0.006 }); c.box(0.014, 0.12, 0.02, MAT.chrome, x - Math.sign(x) * 0.22, 0.27, 0.224, { cast: false }); });
          c.cyl(0.014, 0.014, 0.012, MAT.brass, 0, 0.36, 0.215, 12).rotation.x = Math.PI / 2;
          [-0.612, 0.612].forEach(function (x) { c.box(0.008, 1.5, 0.05, MAT.brass, x + Math.sign(x) * 0.018, 1.15, 0.18, { cast: false }); });
          c.sign(['18+', 'ID on request'], 0.26, 0.09, 0.4, 0.47, 0.214, 0, { size: 16, bg: '#f3e9cf', color: '#222', titleColor: '#c9302c', line: 'rgba(0,0,0,.25)' });
        }); } catch (e) {}
    try { propExtra('procShelf', function (c) {
          var shelfM = colorMat(0x8a8f96, 0.35, 0.8);
          [[-0.78, -0.2], [0.78, -0.2], [-0.78, 0.2], [0.78, 0.2]].forEach(function (p) { c.cyl(0.035, 0.035, 0.03, MAT.black, p[0], 0.035, p[1], 12).rotation.z = Math.PI / 2; c.box(0.05, 0.03, 0.05, MAT.gunmetal, p[0], 0.08, p[1], { cast: false }); });
          for (var s = 0; s < 4; s++) { c.box(1.6, 0.045, 0.012, shelfM, 0, 0.31 + s * 0.5, 0.228, { cast: false }); c.box(0.2, 0.03, 0.002, MAT.white, -0.5 + s * 0.3, 0.31 + s * 0.5, 0.236, { cast: false, sharp: true }); }
          [-0.7, 0.7].forEach(function (a) { var br = c.box(0.015, 1.9, 0.01, shelfM, 0, 0.95, -0.215, { cast: false }); br.rotation.z = a * 0.95; });
          c.box(0.2, 0.28, 0.008, colorMat(0x5a4632, 0.7), 0.805, 1.3, 0.0, { cast: false }).rotation.y = Math.PI / 2; c.box(0.17, 0.22, 0.002, MAT.white, 0.811, 1.29, 0.0, { cast: false, sharp: true }).rotation.y = Math.PI / 2; c.box(0.02, 0.025, 0.07, MAT.chrome, 0.812, 1.425, 0, { cast: false });
        }); } catch (e) {}
    try { propExtra('guardBoard', function (c) {
          [[0, 2.065, 1.06, 0.03], [0, 1.335, 1.06, 0.03]].forEach(function (f) { c.box(f[2], f[3], 0.035, MAT.alu, f[0], f[1], 0.005, { cast: false }); }); [-0.515, 0.515].forEach(function (x) { c.box(0.03, 0.76, 0.035, MAT.alu, x, 1.7, 0.005, { cast: false }); });
          c.box(0.5, 0.02, 0.09, MAT.alu, 0, 1.22, 0.045); c.box(0.5, 0.06, 0.008, MAT.alu, 0, 1.25, 0.088, { cast: false }); [[-0.15, 0x6fdc8c], [0.0, 0xffc857], [0.15, 0x7cc4ff]].forEach(function (l) { c.box(0.11, 0.16, 0.012, colorMat(l[1], 0.8), l[0], 1.31, 0.05, { cast: false }).rotation.x = -0.15; });
        }); } catch (e) {}
    try { propExtra('bookshelf', bookshelfExtra(1.0, 1.8)); } catch (e) {}
    try { propExtra('upBooks', bookshelfExtra(1.6, 2.0)); } catch (e) {}
    try { propExtra('lobbyCoffee', function (c) {
          if (!S.upgrades.lobby) return;
          var door = colorMat(0x2a1c10, 0.6);
          [-0.147, 0.147].forEach(function (x) { c.box(0.275, 0.72, 0.014, door, x, 0.5, 0.256, { cast: false, r: 0.006 }); c.box(0.012, 0.14, 0.02, MAT.chrome, x - Math.sign(x) * 0.1, 0.62, 0.272, { cast: false }); }); c.box(0.6, 0.08, 0.012, MAT.black, 0, 0.04, 0.256, { cast: false });
          var wand = c.cyl(0.006, 0.006, 0.15, MAT.chrome, -0.215, 1.08, 0.06, 8); wand.rotation.z = 0.22; c.cyl(0.012, 0.012, 0.02, MAT.black, -0.2, 1.15, 0.06, 10); c.cyl(0.009, 0.007, 0.02, MAT.chrome, -0.232, 1.0, 0.06, 8);
          [-0.182, 0.182].forEach(function (x) { for (var v = 0; v < 5; v++) c.box(0.004, 0.01, 0.2, MAT.black, x, 1.2 + v * 0.03, -0.06, { cast: false, sharp: true }); });
          c.box(0.13, 0.06, 0.1, MAT.gunmetal, -0.22, 0.97, -0.14, { r: 0.008 }); for (var s = 0; s < 5; s++) { var st = c.cyl(0.003, 0.003, 0.11, MAT.wood, -0.26 + s * 0.02, 1.03, -0.14, 5); st.rotation.z = (s - 2) * 0.08; }
        }); } catch (e) {}
    try { propExtra('vending', function (c) {
          var dark = colorMat(0x1a1d21, 0.6);
          c.box(0.012, 1.3, 0.02, emitMat(0xeaf6ff, 1.3), -0.405, 1.12, 0.27, { cast: false, sharp: true });
          c.box(0.012, 1.78, 0.012, MAT.chrome, 0.19, 1.03, 0.362, { cast: false }); c.box(0.99, 0.02, 0.02, MAT.chrome, 0, 1.935, 0.37, { cast: false });
          c.box(0.11, 0.15, 0.03, MAT.gloss, 0.315, 0.74, 0.368, { cast: false, r: 0.008 }); c.lit(0x39a0ff, 0.07, 0.05, 0.315, 0.765, 0.3845); c.lit(0x6fdc8c, 0.07, 0.008, 0.315, 0.69, 0.3845);
          for (var v = 0; v < 8; v++) { c.box(0.004, 0.014, 0.34, dark, 0.477, 0.3 + v * 0.045, 0, { cast: false, sharp: true }); c.box(0.004, 0.014, 0.34, dark, -0.477, 0.3 + v * 0.045, 0, { cast: false, sharp: true }); }
          [[-0.4, -0.3], [0.4, -0.3], [-0.4, 0.3], [0.4, 0.3]].forEach(function (p) { c.box(0.1, 0.012, 0.1, MAT.black, p[0], 0.006, p[1] * 1.15, { cast: false, sharp: true }); });
          c.box(0.56, 0.035, 0.012, MAT.chrome, -0.13, 0.575, 0.362, { cast: false }); c.sign(['take it from the tray'], 0.4, 0.04, -0.13, 0.26, 0.362, 0, { size: 14, bg: '#1a1d21', titleColor: '#cfd6dc', line: 'rgba(0,0,0,0)' });
        }); } catch (e) {}
    try { propExtra('goodsShelf', function (c) {
          var w = goodsWidth(); [1.3, 1.86].forEach(function (y) { warmStrip(c, w - 0.2, 0, y - 0.026, 0.14); }); warmStrip(c, w - 0.2, 0, 1.99, 0.14);
          [-1, 1].forEach(function (s) { c.box(0.012, 1.9, 0.012, MAT.brass, s * (w / 2 + 0.002), 1.0, 0.31, { cast: false }); });
        }); } catch (e) {}
    try { propExtra('vipTable', function (c) {
          var brass = colorMat(0xc9a24a, 0.35, 0.8), plush = colorMat(0x6e2a4a, 0.95);
          var rim = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.012, 8, 44), brass); rim.rotation.x = Math.PI / 2; rim.position.y = 0.625; c.add(rim);
          c.box(3.3, 0.012, 1.9, new THREE.MeshStandardMaterial({ map: TEX.fabric, color: 0x2a1420, roughness: 1 }), 0, 0.006, 0, { cast: false, sharp: true }); c.box(3.0, 0.004, 1.6, new THREE.MeshStandardMaterial({ map: TEX.fabric, color: 0x4a2034, roughness: 1 }), 0, 0.014, 0, { cast: false, sharp: true });
          [-0.95, 0.95].forEach(function (x) { var sd = x > 0 ? 1 : -1; c.box(0.5, 0.1, 0.5, plush, x - sd * 0.06, 0.5, 0, { r: 0.04 }); var bc = c.box(0.1, 0.4, 0.48, plush, x + sd * 0.215, 0.76, 0, { r: 0.04 }); for (var b = 0; b < 4; b++) c.cyl(0.012, 0.012, 0.012, brass, x + sd * 0.16, 0.68 + Math.floor(b / 2) * 0.18, -0.12 + (b % 2) * 0.24, 8).rotation.z = Math.PI / 2; [-0.32, 0.32].forEach(function (z) { c.box(0.62, 0.02, 0.13, brass, x, 0.74, z, { cast: false, r: 0.008 }); }); });
          [[-0.28, 0.12], [0.26, -0.14]].forEach(function (g) { c.cyl(0.045, 0.045, 0.006, MAT.black, g[0], 0.648, g[1], 16); c.cyl(0.032, 0.026, 0.085, MAT.jar, g[0], 0.693, g[1], 14); c.cyl(0.028, 0.024, 0.03, colorMat(0xd9a23a, 0.3, 0, { transparent: true, opacity: 0.8 }), g[0], 0.667, g[1], 12); });
          c.cyl(0.06, 0.05, 0.02, MAT.gunmetal, 0.02, 0.655, -0.25, 16);
        }); } catch (e) {}
    try { propExtra('hallClockTable', function (c) {
          c.box(0.4, 0.1, 0.014, MAT.darkwood, 0, 0.63, 0.247, { cast: false, r: 0.006 }); c.cyl(0.012, 0.012, 0.02, MAT.brass, 0, 0.63, 0.262, 10).rotation.x = Math.PI / 2;
          var ck = c.cyl(0.055, 0.055, 0.035, MAT.brass, 0.13, 0.785, 0.14, 24); ck.rotation.x = Math.PI / 2; var cf = c.cyl(0.046, 0.046, 0.004, MAT.white, 0.13, 0.785, 0.159, 24); cf.rotation.x = Math.PI / 2; var h1 = c.box(0.004, 0.035, 0.002, MAT.black, 0.13, 0.797, 0.162, { cast: false, sharp: true }); var h2 = c.box(0.003, 0.028, 0.002, MAT.black, 0.141, 0.785, 0.162, { cast: false, sharp: true }); h2.rotation.z = Math.PI / 2; c.box(0.09, 0.012, 0.04, MAT.brass, 0.13, 0.726, 0.14, { cast: false });
          [[0.3, 0x8a2a2a], [0.26, 0x2f6b9a], [0.22, 0xe0c25a]].forEach(function (b, i) { c.box(b[0], 0.035, 0.2, colorMat(b[1], 0.85), 0.02, 0.284 + i * 0.036, 0, { cast: false }).rotation.y = (i - 1) * 0.15; });
        }); } catch (e) {}
    try { propExtra('dining', function (c) {
          [-0.38, 0.38].forEach(function (z) { c.box(1.38, 0.08, 0.03, MAT.darkwood, 0, 0.675, z, { cast: false }); }); [-0.72, 0.72].forEach(function (x) { c.box(0.03, 0.08, 0.74, MAT.darkwood, x, 0.675, 0, { cast: false }); });
          c.box(1.62, 0.004, 0.3, fabricMat(0xefe6d2), 0, 0.779, 0, { cast: false, sharp: true });
          [-0.35, 0.35].forEach(function (x) { var rng = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.006, 6, 28), colorMat(0x2f6b9a, 0.4)); rng.rotation.x = Math.PI / 2; rng.position.set(x, 0.794, 0); c.add(rng); c.box(0.1, 0.012, 0.1, fabricMat(0x3a5a3a), x - 0.3, 0.786, 0.22, { cast: false }).rotation.y = 0.4; });
          c.cyl(0.018, 0.016, 0.06, MAT.white, 0.13, 0.808, 0.12, 10); c.cyl(0.018, 0.016, 0.06, colorMat(0x3a3a3a, 0.5), 0.17, 0.808, 0.1, 10); c.cyl(0.019, 0.019, 0.012, MAT.chrome, 0.13, 0.842, 0.12, 10); c.cyl(0.019, 0.019, 0.012, MAT.chrome, 0.17, 0.842, 0.1, 10);
          c.box(0.34, 0.02, 0.2, MAT.wood, -0.02, 0.79, -0.26, { cast: false, r: 0.008 }).rotation.y = 0.2; var loaf = c.box(0.2, 0.08, 0.1, colorMat(0xb8793a, 0.9), -0.02, 0.84, -0.26, { r: 0.04 }); loaf.rotation.y = 0.2;
          c.box(2.6, 0.012, 2.4, new THREE.MeshStandardMaterial({ map: TEX.fabric, color: 0x3d4a3a, roughness: 1 }), 0, 0.006, 0, { cast: false, sharp: true });
        }); } catch (e) {}
    try { propExtra('couchUp', function (c) {
          c.box(0.45, 0.04, 0.45, MAT.wood, 1.6, 0.55, -0.1, { r: 0.012 }); legs4({ box: function (a, b, e, m, px, py, pz) { return c.box(a, b, e, m, px + 1.6, py, pz - 0.1); } }, 0.45, 0.45, 0.53, MAT.darkwood, 0.05, 0.035);
          c.cyl(0.06, 0.045, 0.09, MAT.ceramic, 1.6, 0.615, -0.1, 16); for (var i = 0; i < 9; i++) leafAt(LEAF_GEO_SM, MAT.bigleaf, 1.6, 0.66, -0.1, i * 0.7, 0.4 + (i % 3) * 0.22, 0.34, c.group);
          for (var f = 0; f < 30; f++) { c.box(0.012, 0.004, 0.09, colorMat(0xd8c9a8, 1), -2.2 + f * 0.152, 0.006, 3.24, { cast: false, sharp: true }); c.box(0.012, 0.004, 0.09, colorMat(0xd8c9a8, 1), -2.2 + f * 0.152, 0.006, -0.44, { cast: false, sharp: true }); }
          c.solid(1.35, 1.85, -0.35, 0.15);
        }); } catch (e) {}
    try { propExtra('bed', function (c) {
          c.box(1.72, 0.06, 0.13, MAT.wood, 0, 1.08, -1.05, { r: 0.02 }); c.box(1.64, 0.5, 0.06, MAT.darkwood, 0, 0.27, 1.07, { r: 0.012 }); c.box(1.7, 0.05, 0.09, MAT.wood, 0, 0.54, 1.07, { r: 0.015 });
          c.box(1.57, 0.035, 0.42, fabricMat(0xe0c25a), 0, 0.787, 0.76, { r: 0.015 }); c.box(1.58, 0.1, 0.03, fabricMat(0xe0c25a), 0, 0.73, 1.0, { cast: false });
          [-0.34, 0.34].forEach(function (x) { c.box(0.5, 0.1, 0.34, fabricMat(0x3a6a4a), x, 0.79, -0.6, { r: 0.045 }).rotation.x = 0.5; });
          c.box(0.55, 0.02, 0.5, MAT.wood, 1.1, 0.558, -0.9, { cast: false });
          [-0.34, -0.16].forEach(function (x, i) { var sl = c.box(0.1, 0.05, 0.26, fabricMat(0x8a4a2a), x, 0.045, 1.35, { r: 0.022 }); sl.rotation.y = i ? 0.08 : -0.12; c.box(0.1, 0.04, 0.12, fabricMat(0x6e3a20), x + (i ? 0.005 : -0.008), 0.075, 1.28, { r: 0.018 }).rotation.y = i ? 0.08 : -0.12; });
        }); } catch (e) {}
    try { propExtra('windowSeat', function (c) {
          for (var i = 0; i < 6; i++) { c.box(0.9, 0.3, 0.014, MAT.darkwood, -2.5 + i * 1.0, 0.245, 0.306, { cast: false, r: 0.008 }); c.cyl(0.014, 0.014, 0.02, MAT.brass, -2.5 + i * 1.0, 0.33, 0.32, 10).rotation.x = Math.PI / 2; }
          c.box(6.02, 0.07, 0.02, MAT.darkwood, 0, 0.035, 0.31, { cast: false }); c.box(6.04, 0.025, 0.64, MAT.wood, 0, 0.455, 0.0, { cast: false });
          [-2, -1, 0, 1, 2].forEach(function (x) { c.box(0.012, 0.082, 0.6, fabricMat(0x2f4a30), x, 0.49, 0, { cast: false, sharp: true }); }); c.box(6.0, 0.02, 0.02, fabricMat(0x2f4a30), 0, 0.52, 0.295, { cast: false });
          c.box(0.5, 0.09, 0.36, fabricMat(0xc9b28a), 2.7, 0.575, 0.0, { r: 0.03 }); c.box(0.5, 0.05, 0.36, fabricMat(0xb89a6e), 2.7, 0.64, 0.0, { r: 0.022 });
          c.cyl(0.04, 0.035, 0.09, colorMat(0x6fdc8c, 0.5), 1.55, 0.575, 0.12, 14);
        }); } catch (e) {}
    try { propExtra('upRug', function (c) {
          var cream = new THREE.MeshStandardMaterial({ map: TEX.fabric, color: 0xd8c9a8, roughness: 1 });
          [-1.0, 1.0].forEach(function (z) { c.box(3.0, 0.004, 0.035, cream, 0, 0.026, z, { cast: false, sharp: true }); }); [-1.5, 1.5].forEach(function (x) { c.box(0.035, 0.004, 2.035, cream, x, 0.026, 0, { cast: false, sharp: true }); });
          var dia = c.box(0.9, 0.004, 0.9, cream, 0, 0.0255, 0, { cast: false, sharp: true }); dia.rotation.y = Math.PI / 4; var di2 = c.box(0.72, 0.004, 0.72, new THREE.MeshStandardMaterial({ map: TEX.fabric, color: 0x6a4f7a, roughness: 1 }), 0, 0.027, 0, { cast: false, sharp: true }); di2.rotation.y = Math.PI / 4;
          for (var f = 0; f < 26; f++) [-1.85, 1.85].forEach(function (x) { c.box(0.1, 0.004, 0.014, cream, x, 0.006, -1.25 + f * 0.1, { cast: false, sharp: true }); });
        }); } catch (e) {}
    try { propExtra('upDresser', function (c) {
          c.box(1.23, 0.07, 0.53, MAT.black, 0, 0.035, 0, { cast: false });
          [-0.055, 0.455].forEach(function (x) { c.box(0.015, 0.62, 0.035, MAT.brass, x, 1.3, -0.195, { cast: false }); }); [0.995, 1.605].forEach(function (y) { c.box(0.525, 0.015, 0.035, MAT.brass, 0.2, y, -0.195, { cast: false }); });
          c.box(0.3, 0.014, 0.2, MAT.brass, 0.3, 0.947, 0.1, { cast: false, r: 0.006 }); [[0.22, 0xe05a8a, 0.09], [0.3, 0x7cc4ff, 0.12], [0.38, 0xf0b94d, 0.07]].forEach(function (b) { c.cyl(0.022, 0.026, b[2], colorMat(b[1], 0.15, 0, { transparent: true, opacity: 0.8 }), b[0], 0.954 + b[2] / 2, 0.1, 12); c.cyl(0.01, 0.01, 0.025, MAT.brass, b[0], 0.966 + b[2], 0.1, 8); });
          c.box(0.22, 0.05, 0.16, colorMat(0x3a2418, 0.6), -0.1, 0.965, 0.12, { r: 0.012 });
        }); } catch (e) {}
    // each Grow prop as an engine prop: Grow's own build context on the prop's group, its obstacles as solids, a use that says what it is
    var LABEL_OVERRIDE = {};
    G_ORDER.forEach(function (gid) {
      var d = G_DEFS[gid]; if (!d || typeof d.build !== 'function') return;
      var label = LABEL_OVERRIDE[gid] || d.label || gid;
      defProp('gc' + gid.charAt(0).toUpperCase() + gid.slice(1), { extra: true, shop: false, label: label, cat: 'grow co', desc: 'From Grow Co.: ' + label + '.', build: function (c, P, inst) {
        var g = growPropCtx(c.group, c.id, 0), gh = g.hit; g.light = function (l, x, y, z) { l.position.set(x, y, z); c.group.add(l); return l; };
        g.hit = function (w, h, dd, x, y, z, data) { var m = gh.apply(g, arguments); c.hit(w, h, dd, x, y, z, { prompt: function () { return 'The ' + label; }, use: function () { toast('The ' + label + ' (from Grow Co.)', ''); } }); return m; };
        var oldWG = world.group; world.group = c.group; world.tentGroup = null;   /* a prop that builds into the shop's world (the tent) builds into its own group, at its own origin */
        try { d.build(g, Object.assign({}, P || {}, { x: 0, z: 0, rot: 0, floor: 0, unit: 1, hidden: false }), inst); } finally { world.group = oldWG; }
        (g.obstacles || []).forEach(function (o) { c.solid(Math.min(o.x1, o.x2), Math.max(o.x1, o.x2), Math.min(o.z1, o.z2), Math.max(o.z1, o.z2), 0, 2.4); });
      } });
    });
    // the fixtures: each builds into a scratch group (the shop built them straight into its world), which is re-centred on its footprint and set on the floor
    G_FIX.forEach(function (fx) {
      defProp('gc' + fx.id.charAt(0).toUpperCase() + fx.id.slice(1), { extra: true, shop: false, label: fx.label, cat: 'grow co', desc: 'From Grow Co.: the ' + fx.label + '. It sits on the floor: raise it onto a counter with PageUp or the height field.', build: function (c) {
        var tmp = new THREE.Group(), oldRoot = CO.root, oldWG = world.group; CO.root = tmp; world.group = tmp; world.reg = world.reg || { drawerT: 0, lastSale: null };
        try { fx.fn(); } catch (e) {} finally { CO.root = oldRoot; world.group = oldWG; }
        tmp.updateMatrixWorld(true); var b3 = new THREE.Box3().setFromObject(tmp); if (b3.isEmpty()) return; var cx = (b3.min.x + b3.max.x) / 2, cz = (b3.min.z + b3.max.z) / 2, y0 = b3.min.y;
        tmp.children.slice().forEach(function (ch) { ch.position.x -= cx; ch.position.z -= cz; ch.position.y -= y0; c.group.add(ch); });
        c.hit(Math.max(0.2, b3.max.x - b3.min.x), Math.max(0.2, b3.max.y - b3.min.y), Math.max(0.2, b3.max.z - b3.min.z), 0, (b3.max.y - b3.min.y) / 2, 0, { prompt: function () { return 'The ' + fx.label; }, use: function () { toast('The ' + fx.label + ' (from Grow Co.)', ''); } });
      } });
    });
  };
  if (CO.cfg && typeof scene !== 'undefined' && scene) growcoPack(MAT, TEX); else hook('beforeBuild', function () { growcoPack(MAT, TEX); });
  // ── The showcase ──────────────────────────────────────────────────
  // the hall is 36 by 26 m, centred on the origin; the south wall has a 5 m doorway onto the forecourt (z 13 to 24) and the road past it
  var HALL = { x: 18, z: 13, h: 5 }, DOOR_W = 5, YARD_Z = 24;
  var GAME = {
    handle: 'CO_SHOWCASE', version: '0.1.0',
    floorY: function () { return 0; },
    insideWalk: function (x, z) { return Math.abs(x) < 40 && z > -HALL.z - 0.2 && z < YARD_Z + 8; },
    indoors: function (x, z) { return Math.abs(x) < HALL.x && Math.abs(z) < HALL.z; },
    roofAt: function (x, z) { return Math.abs(x) < HALL.x && Math.abs(z) < HALL.z ? HALL.h : 0; },
    wallPlanes: function () { return [
      { a: 'z', v: -HALL.z + 0.17, n: 1, x0: -HALL.x, x1: HALL.x }, { a: 'z', v: HALL.z - 0.17, n: -1, x0: -HALL.x, x1: HALL.x },
      { a: 'x', v: -HALL.x + 0.17, n: 1, z0: -HALL.z, z1: HALL.z }, { a: 'x', v: HALL.x - 0.17, n: -1, z0: -HALL.z, z1: HALL.z },
      { a: 'x', v: -6.17, n: -1, z0: -HALL.z, z1: -2 }, { a: 'x', v: -5.83, n: 1, z0: -HALL.z, z1: -2 }, { a: 'x', v: 5.83, n: -1, z0: -HALL.z, z1: -2 }, { a: 'x', v: 6.17, n: 1, z0: -HALL.z, z1: -2 }
    ]; },
    editClamp: function (pt) { return { x: clamp(pt.x, -38, 38), z: clamp(pt.z, -HALL.z + 0.4, YARD_Z + 6) }; },
    stepSurface: function (x, z) { return Math.abs(x) < HALL.x && Math.abs(z) < HALL.z ? 'floor' : 'outside'; },
    freshState: function () { return { day: 1, time: 10, bank: 2000, level: 1, log: [], ledger: [], stats: { earned: 0, spent: 0 }, layout: {}, custom: [], hdoors: {} }; },
    buildWorld: function () {
      var X = HALL.x, Z = HALL.z, H = HALL.h;
      // the hall: a slab, the outer walls (a doorway in the south one), two partitions at x = -6 and x = 6 from the north wall to z = -2
      // (the office on the west, the stock room on the east, the lounge between), a roof, lamps
      plane(2 * X, 2 * Z, MAT.floor, 0, 0, 0, -Math.PI / 2);
      box(2 * X + 0.3, H, 0.3, MAT.wall, 0, H / 2, -Z); box(0.3, H, 2 * Z, MAT.wall, -X, H / 2, 0); box(0.3, H, 2 * Z, MAT.wall, X, H / 2, 0);
      var side = (2 * X - DOOR_W) / 2; box(side, H, 0.3, MAT.wall, -X + side / 2, H / 2, Z); box(side, H, 0.3, MAT.wall, X - side / 2, H / 2, Z); box(DOOR_W, H - 3.4, 0.3, MAT.wall, 0, 3.4 + (H - 3.4) / 2, Z);
      solid(-X - 0.15, X + 0.15, -Z - 0.15, -Z + 0.15); solid(-X - 0.15, -X + 0.15, -Z, Z); solid(X - 0.15, X + 0.15, -Z, Z); solid(-X, -DOOR_W / 2, Z - 0.15, Z + 0.15); solid(DOOR_W / 2, X, Z - 0.15, Z + 0.15);
      [-6, 6].forEach(function (px) { box(0.3, 3.2, Z - 2, MAT.plaster, px, 1.6, -Z + (Z - 2) / 2); solid(px - 0.15, px + 0.15, -Z, -2); });
      roomFloor(MAT.carpet, -X + 0.15, -6.15, -Z + 0.15, -2, 1.0); roomFloor(MAT.vinyl, -5.85, 5.85, -Z + 0.15, -2, 1.0);
      plane(2 * X, 2 * Z, MAT.roofIn, 0, H, 0, Math.PI / 2);
      [-12, 0, 12].forEach(function (lx) { [-7, 4].forEach(function (lz) { highBay(lx, H - 0.6, lz, 4); }); });
      troffer(-12, 3.1, -9); troffer(12, 3.1, -9);
      // the forecourt: asphalt to the road, a kerb either side of the entrance, the road with its line
      plane(2 * X, YARD_Z - Z, MAT.yard, 0, 0.002, (Z + YARD_Z) / 2, -Math.PI / 2);
      plane(240, 240, MAT.grass, 0, -0.03, 0, -Math.PI / 2);
      plane(240, 7, MAT.yard, 0, 0.004, YARD_Z + 4, -Math.PI / 2); plane(240, 0.12, MAT.whiteLine, 0, 0.006, YARD_Z + 4, -Math.PI / 2);
      box(2 * X, 0.14, 0.3, MAT.trim, 0, 0.07, YARD_Z);
      buildSky({ clouds: 4, rainN: 800, snowN: 500 });
      traffic.x0 = -100; traffic.x1 = 100; trafficAdd(YARD_Z + 2.4, 1, 9); trafficAdd(YARD_Z + 5.6, -1, 7);
      buildProps();
      navSetup({ x0: -40, z0: -16, width: 80, depth: 48, cell: 0.5 });
    },
    tick: function (dt) { S.time += dt / 60; if (S.time >= 24) { S.time -= 24; S.day++; } hudDirty = hudDirty || Math.floor(S.time * 60) !== GAME.lastMin; GAME.lastMin = Math.floor(S.time * 60); },
    startStats: function (loaded) { return loaded ? ['Day ' + S.day, money(S.bank)] : ['The showcase', 'every pack prop to build with']; },
    guideHtml: function () { return '<p>The showcase hall: build with every pack prop in the Co Engine editor. Walk with WASD, look with the mouse, E uses what the dot is on.</p>'; },
    commands: { night: function () { S.time = 22; return 'night'; }, day: function () { S.time = 11; return 'day'; } },
    devState: function () { return { props: Object.keys(propInst).length }; },
    T: function () { return { GAME: GAME, HALL: HALL }; }
  };
  CO.setup({ canvas: 'co-canvas', save: 'co-showcase', game: GAME, spawn: { x: 0, z: 18, yaw: 0 }, sun: { box: 60, far: 160, mapSize: 2048, target: [0, 0, 4] }, lightBudget: 10 });
  CO.boot(GAME);
})();
