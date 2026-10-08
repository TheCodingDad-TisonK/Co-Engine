//@ Co Engine, part 20: the prop system and build mode. Every movable thing is a definition with a default spot; build mode moves, turns, removes, restores and adds them.
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
  function defProp(id, def) { if (CO.game && CO.game.resolveDef) CO.game.resolveDef(id, def); def.id = id; PROPS[id] = def; PROP_ORDER.push(id); return def; }
  function propAllowed(id) { var d = PROPS[id]; if (!d) return true; if (d.extra) return true; if (CO.game && CO.game.propAllowed && !CO.game.propAllowed(id, d)) return false; return true; }
  function propDef(id) { if (PROPS[id]) return PROPS[id]; var c = customById(id); return c ? PROPS[c.type] : null; }
  function customById(id) { return (S && S.custom || []).filter(function (c) { return c.id === id; })[0] || null; }
  function propPlacement(id) {
    var d = PROPS[id], c = customById(id), o = (S && S.layout && S.layout[id]) || {};
    if (c) return { x: typeof o.x === 'number' ? o.x : c.x, z: typeof o.z === 'number' ? o.z : c.z, rot: typeof o.rot === 'number' ? o.rot : (c.rot || 0), h: typeof o.h === 'number' ? o.h : (c.h || 0), hidden: !!o.hidden, custom: true };
    return { x: typeof o.x === 'number' ? o.x : d.x, z: typeof o.z === 'number' ? o.z : d.z, rot: typeof o.rot === 'number' ? o.rot : (d.rot || 0), h: o.h || 0, hidden: !!o.hidden, custom: false };
  }
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
  function propGroundY(x, z) { return CO.game && CO.game.groundY ? CO.game.groundY(x, z) : 0; }
  function buildProp(id) {
    removePropInst(id);
    var def = propDef(id); if (!def) return null; if (!propAllowed(id)) return null;
    var P = propPlacement(id), g = new THREE.Group(); g.userData.propId = id; g.position.set(P.x, typeof def.y === 'number' ? def.y : propGroundY(P.x, P.z), P.z); g.rotation.y = P.rot * Math.PI / 2;
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
  function buildProps() { PROP_ORDER.forEach(function (id) { if (!PROPS[id].extra && propAllowed(id) && (!PROPS[id].when || PROPS[id].when())) buildProp(id); }); (S && S.custom || []).forEach(function (c) { if (PROPS[c.type]) buildProp(c.id); }); }
  function propIdOf(obj) { for (var o = obj; o; o = o.parent) if (o.userData && o.userData.propId) return o.userData.propId; return null; }
  function propWorld(prop, lx, lz) { var P = propPlacement(prop), a = P.rot * Math.PI / 2; return { x: P.x + lx * Math.cos(a) + lz * Math.sin(a), z: P.z - lx * Math.sin(a) + lz * Math.cos(a), a: a }; }

  // ── Build mode ────────────────────────────────────────────────────
  var edit = { on: false, grabbed: null, helper: null, snap: true, wallAim: null, snapCycle: 0, grabRot: 0, snapText: '' };   // snapCycle: which snap (or free heading) R has walked to for the carried piece
  var ray = new THREE.Raycaster(); ray.far = 3.4; var centre = new THREE.Vector2(0, 0);
  function editAllowed() { return CO.game && CO.game.canEdit ? CO.game.canEdit() : true; }
  function editToggle() {
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
    if (!edit.on) return;
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
  function editRestore(id) { if (S.layout && S.layout[id]) { delete S.layout[id].hidden; } buildProp(id); sfx('ok'); toast('The ' + propLabel(id) + ' is back', 'good'); save(); }
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
    var hidden = PROP_ORDER.filter(function (id) { return !PROPS[id].extra && propPlacement(id).hidden; }), groups = {};
    PROP_ORDER.forEach(function (id) { var d = PROPS[id]; if (!d.extra) return; (groups[d.cat || 'other'] = groups[d.cat || 'other'] || []).push(id); });
    return { hidden: hidden, groups: groups };
  }
