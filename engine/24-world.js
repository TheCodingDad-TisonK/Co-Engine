//@ Co Engine, part 24: the world kit. Walls with openings, room floors, ceiling lamps, fences, trees, and the floor height.
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
