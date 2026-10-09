//@ Co Engine, part 28: physics. A rigid-body layer for props and items: gravity, the ground (the floor or the terrain), the engine's solids, body against body, sliding with friction, a bounce, sleep. Shapes are the boxes and spheres the engine draws; the step is semi-implicit Euler with separation by the smallest overlap, enough for crates that fall, stack and slide. CO.physicsSolver plugs a full solver in later: it takes the same body list.
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
  function physicsStep(dt) {
    var bodies = PHYS.bodies, i, j, k;
    hingeStep(dt);
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
    for (i = 0; i < bodies.length; i++) { var D = bodies[i]; if (D.kinematic || D.asleep) continue; if (D.onGround && D.vel.lengthSq() < 0.0025) { D.still += dt; if (D.still > PHYS.sleepT) { D.asleep = true; D.vel.set(0, 0, 0); } } else D.still = 0; }
    PHYS.stepped++;
  }
  function physicsTick(dt) {
    if (!PHYS.on || (!PHYS.bodies.length && !HINGES.length) || (CO.game && CO.game.physics === false)) return;
    if (CO.physicsSolver && CO.physicsSolver.step) { CO.physicsSolver.step(PHYS.bodies, dt, PHYS); return; }
    var left = Math.min(dt, 0.1); while (left > 0) { var h = Math.min(PHYS.maxStep, left); physicsStep(h); left -= h; }
    PHYS.bodies.forEach(function (B) { if (B.obj.userData && B.obj.userData.dynamic === undefined) shadowDirty = true; });
  }
  animate(physicsTick);
  function physicsState() { return { on: PHYS.on && !(CO.game && CO.game.physics === false), g: PHYS.g, hinges: HINGES.map(function (H) { return { id: H.obj.userData && (H.obj.userData.propId || H.obj.userData.eid) || H.obj.name || null, angle: rnd(H.angle), length: H.length, axis: H.axis }; }), bodies: PHYS.bodies.map(function (B) { return { id: B.id, mass: B.mass, asleep: B.asleep, onGround: B.onGround, x: rnd(B.obj.position.x), y: rnd(B.obj.position.y), z: rnd(B.obj.position.z), vy: rnd(B.vel.y) }; }), stepped: PHYS.stepped, solver: CO.physicsSolver ? 'plugged' : 'built in' }; }
