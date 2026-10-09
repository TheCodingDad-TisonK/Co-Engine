//@ Co Engine, part 12: materials from a layer graph. CO.material(name, graph) composes a material from the painters the engine has (fills, grain, blotches, cracks, noise, bricks, planks, tiles, stripes, checks), with a roughness map, a normal map from height noise, emissive and glow, and registers it as MAT[name]. The editor's Materials tab edits the graph live and writes src/00-materials.js.
  // ── Materials from a layer graph ───────────────────────────────────
  // A graph: { size, repeat: [rx, ry], layers: [{ type, color, color2, alpha, blend, n, size, gap, angle, dark }], roughness: 0.9 or
  // { base, amp }, metalness, bump: { amp, strength } or null, emissive, emissiveIntensity, glow, transparent, opacity }. The layers paint
  // one canvas from the bottom up; the same canvas is the colour map. A game's src/00-materials.js calls CO.material before the boot,
  // so a build function can say MAT.myBrick; the editor calls it again while running and every mesh on that material follows.
  var MATGRAPH = {}, MATGRAPH_ORDER = [];
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
    m.userData.glow = !!g.glow; m.userData.graph = true; m.name = name; m.needsUpdate = true;
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
