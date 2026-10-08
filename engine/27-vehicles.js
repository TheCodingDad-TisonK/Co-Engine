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
    var ws = rbx(g, 0.06, 0.5, 1.5, 0.02, glass, 0.98, 1.1, 0); ws.rotation.z = -0.55; var rw = rbx(g, 0.06, 0.5, 1.5, 0.02, glass, -1.45, 1.1, 0); rw.rotation.z = 0.5; rbx(g, 2.1, 0.44, 0.04, 0.01, glass, -0.25, 1.12, 0.84); rbx(g, 2.1, 0.44, 0.04, 0.01, glass, -0.25, 1.12, -0.84);
    [-1, 1].forEach(function (s) { box(0.02, 0.4, 0.02, MAT.black, -0.25, 1.12, s * 0.86, g); box(0.02, 0.4, 0.02, MAT.black, 0.5, 1.1, s * 0.86, g); box(0.14, 0.02, 0.03, MAT.chrome, -0.6, 0.78, s * 0.92, g); box(0.14, 0.02, 0.03, MAT.chrome, 0.3, 0.78, s * 0.92, g); box(0.12, 0.1, 0.16, paint, 0.6, 1.2, s * 1.0, g); });
    g.userData.wheels = [];
    [[1.4, 0.95], [1.4, -0.95], [-1.4, 0.95], [-1.4, -0.95]].forEach(function (p) { var w = cyl(0.33, 0.22, MAT.rubber, p[0], 0.33, p[1], g, 20); w.rotation.x = Math.PI / 2; cyl(0.2, 0.23, MAT.chrome, p[0], 0.33, p[1], g, 14).rotation.x = Math.PI / 2; for (var sp = 0; sp < 5; sp++) { var spk = box(0.04, 0.26, 0.24, MAT.black, p[0], 0.33, p[1], g); spk.rotation.x = sp * 1.257; } var arch = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.05, 6, 14, Math.PI), paint); arch.position.set(p[0], 0.35, p[1] * 0.96); arch.rotation.y = Math.PI / 2; g.add(arch); g.userData.wheels.push(w); });
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
  function tickTraffic(dt) { traffic.cars.forEach(function (c) { c.g.position.x += c.dir * c.v * dt; if (c.g.position.x > traffic.x1) c.g.position.x = traffic.x0; if (c.g.position.x < traffic.x0) c.g.position.x = traffic.x1; var ws = c.g.userData.wheels; if (ws) ws.forEach(function (w) { w.rotation.z -= c.dir * c.v * dt / 0.33; }); }); }
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
