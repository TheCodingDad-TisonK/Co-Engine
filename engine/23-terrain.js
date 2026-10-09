//@ Co Engine, part 23: the terrain. A heightmap over a grid of cells with a paint index per cell, built as one mesh under a painted canvas texture: the ground height under anything, sculpt and paint brushes for the editor, flora scatter, and the part the editor writes (src/00-terrain.js) as CO.terrain({ ... }).
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
