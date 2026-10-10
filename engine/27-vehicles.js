//@ Co Engine, part 27: vehicles. A car mesh, wheels, lane traffic, and the core of a vehicle you drive.
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
