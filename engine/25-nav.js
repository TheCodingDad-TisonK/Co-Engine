//@ Co Engine, part 25: the route finder. A grid over the site, A* with no corner cutting, then string pulling.
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
