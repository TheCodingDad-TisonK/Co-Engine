//@ Co Engine, part 26: the world as things you can edit. What a game builds straight into its world is a world item: a kit call (a lamp post, a tree, a run of fence, a wall, a room's floor, a troffer, a high bay) groups what it builds into one item with the solids it adds, and any other mesh or group the build leaves at the top of the world is an item of its own. The editor selects, moves, turns, resizes and removes world items like props; CO.world({ key: edit }) in src/00-world.js keeps what was done and lays it on the world as it is built, before the bake.
  // ── World items ───────────────────────────────────────────────────
  // A key names an item by what it is and where the game built it ("lamp post@12,6", "mesh plane 34x19.2@0,13.6"), so it survives a
  // reload and most changes to the game's code. An edit is { x, y, z, ry (degrees), sx, sy, sz, hidden }, every field optional.
  var WORLD_EDITS = {}, WORLD_ITEMS = [], WORLD_PARENT = null;
  CO.world = function (edits) { if (edits && typeof edits === 'object') for (var k in edits) WORLD_EDITS[k] = edits[k]; return WORLD_EDITS; };
  // a kit call builds into a group of its own, centred on what it built and standing on the ground, so it turns and resizes about itself
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
  // after the build and before the bake: the saved edits laid on the world
  function worldEditsApply() { worldScan(); WORLD_ITEMS.forEach(function (o) { var e = WORLD_EDITS[o.userData.worldKey]; if (e) worldLay(o, e); }); }
  // what the editor keeps: the item as it stands now against where the game built it
  function worldRecord(o) {
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
    var keys = Object.keys(WORLD_EDITS).sort(); if (!keys.length) return '';
    var lines = ['//@ the world the editor changed: what was moved, turned, resized or removed of what the game builds straight into its world. Written by the Co Engine editor; it sorts first in src/ and is laid on the world as it is built. A key is the thing and where the game built it; delete a line to put that thing back.', '  CO.world({'];
    keys.forEach(function (k) { lines.push('    ' + JSON.stringify(k) + ': ' + JSON.stringify(WORLD_EDITS[k]).replace(/"(\w+)":/g, '$1: ').replace(/,(?=\w+: )/g, ', ').replace(/^\{/, '{ ').replace(/\}$/, ' }') + ','); });
    lines.push('  });'); return lines.join('\n') + '\n';
  }
