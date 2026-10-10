//@ Co Engine, part 60: the editor bridge. CO.editor is what the editor window and the MCP server drive: the scene as a tree, a selection, an inspector record, live edits, assets, spawning, picking, pause and step, a screenshot.
  // ── The editor bridge ─────────────────────────────────────────────
  // The editor shows the running game in its viewport and talks to it through this object (executeJavaScript into the page, or the
  // dev link). Everything here reads or writes the live scene and the save; nothing runs unless the editor asks. Objects are named
  // by id: a prop by its prop id, anything else by an editor id stamped on userData the first time it is listed.
  var EOBJ = {}, eidN = 0, editorSel = null, editorHelper = null, eRay = new THREE.Raycaster(), editorMulti = [], editorHelpers2 = [], groupDrag = null, pendingOff = null;   // editorSel is the last of editorMulti, the things selected together
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
      if (o === CO.root || o.userData.editor || isPropRoot(o) || o.userData.worldKey) return;
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
    var worldL = WORLD_ITEMS.filter(function (o) { return o.parent; }).map(function (o) { return { id: eid(o), name: worldName(o), type: 'world', n: o.children.length, vis: o.visible !== false, edited: !!WORLD_EDITS[o.userData.worldKey] }; });
    return { props: props, lights: lights, people: people, doors: doors, screens: screensL, vehicles: vehicles, other: other, world: worldL, selection: editorMulti.slice(), counts: { baked: baked, statics: statics, inter: inter.length, solids: solids.length, dyn: dyn.length }, extra: extra, time: S ? { day: S.day, time: S.time } : null, selected: editorSel, paused: !!CO.paused, scene: !!photo.on, started: !!ui.started, engine: CO.version, game: CO.gameVersion };
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
    if (o.userData.worldKey) { r.worldItem = { key: o.userData.worldKey, kind: worldKind(o), edited: !!WORLD_EDITS[o.userData.worldKey], solids: (o.userData.solids || []).length }; r.name = worldName(o); r.type = 'world'; }
    if (editorMulti.length > 1 && editorMulti.indexOf(id) >= 0) r.together = editorMulti.length;
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
    var isWorld = !!(o.userData && o.userData.worldKey);
    if (isWorld && o.userData.movesOnly && (p[0] === 'rotation' || p[0] === 'scale')) return worldName(o) + ' moves but does not turn or resize: the rules of the game are built around its shape'; if (isWorld && (p[0] === 'position' || p[0] === 'rotation' || p[0] === 'scale' || p[0] === 'visible' || p[0] === 'world') && baked.meshes.length) unbakeStatic();
    if (p[0] === 'world' && p[1] === 'reset' && isWorld) { var b0 = o.userData.worldBase; o.position.set(b0.x, b0.y, b0.z); o.rotation.y = b0.ry; o.scale.set(b0.sx, b0.sy, b0.sz); o.visible = true; o.updateMatrixWorld(true); worldRecord(o); shadowDirty = true; if (editorHelper) editorHelper.update(); return 'ok'; }
    if (p[0] === 'position' || p[0] === 'rotation' || p[0] === 'scale') { o[p[0]][p[1]] = p[0] === 'rotation' ? (+v) * Math.PI / 180 : +v; o.updateMatrixWorld(true); if (isWorld) worldRecord(o); shadowDirty = true; if (editorHelper) editorHelper.update(); return 'ok'; }
    if (p[0] === 'visible') { o.visible = !!v && v !== 'false'; if (isWorld) worldRecord(o); shadowDirty = true; return 'ok'; }
    if (p[0] === 'material') { var m = o.material; if (!m) return 'no material'; if (p[1] === 'color' || p[1] === 'emissive') { if (!m[p[1]]) return 'no ' + p[1]; m[p[1]].set(String(v)); } else m[p[1]] = +v; m.needsUpdate = true; return 'ok'; }
    if (p[0] === 'light') { if (!o.isLight) return 'not a light'; if (p[1] === 'color') o.color.set(String(v)); else o[p[1]] = +v; return 'ok'; }
    if (p[0] === 'name') { o.name = String(v); return 'ok'; }
    return 'unknown path ' + path;
  }
  function editorSelect(id, add) {
    var o = id ? eobj(id) : null, nid = o ? (propInst[id] ? id : eid(o)) : null;
    if (add && nid) { var at = editorMulti.indexOf(nid); if (at >= 0) { editorMulti.splice(at, 1); nid = null; } else editorMulti.push(nid); }
    else editorMulti = nid ? [nid] : [];
    editorMulti = editorMulti.filter(function (k) { return !!eobj(k); });
    editorSel = nid || editorMulti[editorMulti.length - 1] || null;
    editorHelpersShow();
    return editorSel ? editorInspect(editorSel) : null;
  }
  function editorHelpersShow() {
    if (editorHelper) { scene.remove(editorHelper); editorHelper.geometry.dispose(); editorHelper = null; }
    editorHelpers2.forEach(function (h) { scene.remove(h); h.geometry.dispose(); }); editorHelpers2 = [];
    editorMulti.forEach(function (k) { var o = eobj(k); if (!o) return; var hb = new THREE.BoxHelper(o, k === editorSel ? 0xf5b53d : 0x5aa9ff); hb.userData.editor = true; hb.userData.noBake = true; hb.material.depthTest = false; hb.renderOrder = 9; scene.add(hb); if (k === editorSel) editorHelper = hb; else editorHelpers2.push(hb); });
  }
  function editorHelpersUpdate() { if (editorHelper) editorHelper.update(); editorHelpers2.forEach(function (h) { h.update(); }); }
  // what can be dragged: a prop that is not fixed, a world item
  // ── the selection box ──
  var boxSel = null;
  function boxSelStart(e) {
    var el = document.createElement('div'); el.style.cssText = 'position:fixed;z-index:50;border:1px dashed #f5b53d;background:rgba(245,181,61,0.08);pointer-events:none;left:' + e.clientX + 'px;top:' + e.clientY + 'px;width:0;height:0';
    document.body.appendChild(el); boxSel = { x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY, add: e.ctrlKey || e.metaKey, el: el };
  }
  function boxSelMove(e) { var B = boxSel; B.x1 = e.clientX; B.y1 = e.clientY; var l = Math.min(B.x0, B.x1), t = Math.min(B.y0, B.y1); B.el.style.left = l + 'px'; B.el.style.top = t + 'px'; B.el.style.width = Math.abs(B.x1 - B.x0) + 'px'; B.el.style.height = Math.abs(B.y1 - B.y0) + 'px'; }
  // what stands inside the box on the screen: the four corners of its footprint on the ground project into it (a roof or a sign that
  // leans out in the picture does not count against it; the ground and the road, far bigger than any box, never fit)
  function boxSelEnd(e) {
    var B = boxSel; boxSel = null; if (B.el.parentNode) B.el.parentNode.removeChild(B.el);
    var l = Math.min(B.x0, e.clientX), r = Math.max(B.x0, e.clientX), t = Math.min(B.y0, e.clientY), b = Math.max(B.y0, e.clientY);
    if (r - l < 4 && b - t < 4) { if (!B.add) editorSelect(null); return; }
    var rc = canvas.getBoundingClientRect(), v = new THREE.Vector3(), bb = new THREE.Box3(), found = [];
    scene.updateMatrixWorld(true);
    var inside = function (o) { bb.setFromObject(o); if (bb.isEmpty()) return false; for (var k = 0; k < 4; k++) { v.set(k & 1 ? bb.max.x : bb.min.x, bb.min.y, k & 2 ? bb.max.z : bb.min.z).project(camera); if (v.z > 1) return false; var sx = rc.left + (v.x + 1) / 2 * rc.width, sy = rc.top + (1 - v.y) / 2 * rc.height; if (sx < l || sx > r || sy < t || sy > b) return false; } return true; };
    for (var id in propInst) if (propInst[id].g.visible !== false && inside(propInst[id].g)) found.push(id);
    WORLD_ITEMS.forEach(function (o) { if (o.parent && o.visible && inside(o)) found.push(eid(o)); });
    if (!B.add) editorMulti = []; found.forEach(function (k) { if (editorMulti.indexOf(k) < 0) editorMulti.push(k); });
    editorSel = editorMulti[editorMulti.length - 1] || null; editorHelpersShow();
    console.log('[co-editor] ' + JSON.stringify({ select: editorSel, selection: editorMulti.slice(), boxed: found.length }));
  }
  function editorMovable(id) { if (propInst[id]) { var d = propDef(id); return !(d && d.fixed); } var o = eobj(id); return !!(o && o.userData.worldKey); }
  // a drag starts on a selected thing: one thing drags the way it always did (walls snap), several move together by the same step
  function editorDragStart(e, hq) {
    var ids = editorMulti.filter(editorMovable); if (ids.indexOf(hq.id) < 0) return false;
    if (ids.some(function (k) { return !propInst[k]; }) && baked.meshes.length) unbakeStatic();
    if (ids.length === 1) {
      var id = ids[0], g1 = eobj(id), p1 = pointOnPlane(e, g1.position.y); if (!p1) return false;
      propDrag = propInst[id] ? { id: id, g: g1, y: g1.position.y, off: p1.clone().sub(g1.position), before: layoutSnap(id), moved: false } : { id: id, g: g1, y: g1.position.y, off: p1.clone().sub(g1.position), world: true, before: { x: g1.position.x, z: g1.position.z }, moved: false };
      return true;
    }
    var hg = eobj(hq.id), p0 = pointOnPlane(e, hg.position.y); if (!p0) return false;
    groupDrag = { y: hg.position.y, p0: p0.clone(), moved: false, items: ids.map(function (k) { var g = eobj(k); return { id: k, g: g, prop: !!propInst[k], x0: g.position.x, z0: g.position.z, before: propInst[k] ? layoutSnap(k) : { x: g.position.x, z: g.position.z } }; }) };
    return true;
  }
  // several things moved: each kept where it now stands (a prop in the layout, a world item in src/00-world.js), one undo step for all
  function editorGroupCommit(GD) {
    var after = GD.items.map(function (it) { return { x: Math.round(it.g.position.x * 100) / 100, z: Math.round(it.g.position.z * 100) / 100 }; });
    var put = function (which) {
      GD.items.forEach(function (it, i) {
        if (it.prop) { if (which === 'before') layoutRestore(it.id, it.before); else { var P = propPlacement(it.id); if (!S.layout) S.layout = {}; var Lz = S.layout[it.id] = S.layout[it.id] || { x: P.x, z: P.z, rot: P.rot, h: P.h || 0 }; Lz.x = after[i].x; Lz.z = after[i].z; rebuildProp(it.id); } }
        else { var g = eobj(it.id), q = which === 'before' ? it.before : after[i]; g.position.x = q.x; g.position.z = q.z; g.updateMatrixWorld(true); worldRecord(g); }
      });
      save(); shadowDirty = true; editorHelpersShow();
    };
    put('after'); histPush('move ' + GD.items.length + ' things', function () { put('before'); }, function () { put('after'); });
    console.log('[co-editor] ' + JSON.stringify({ movedTogether: GD.items.map(function (it) { return it.id; }) }));
    return GD.items.length;
  }
  function editorMoveSel(dx, dz) {
    var ids = editorMulti.filter(editorMovable); if (!ids.length) return 'nothing selected that moves';
    if (ids.some(function (k) { return !propInst[k]; }) && baked.meshes.length) unbakeStatic();
    var GD = { items: ids.map(function (k) { var g = eobj(k); return { id: k, g: g, prop: !!propInst[k], before: propInst[k] ? layoutSnap(k) : { x: g.position.x, z: g.position.z } }; }) };
    GD.items.forEach(function (it) { it.g.position.x += +dx || 0; it.g.position.z += +dz || 0; });
    return 'moved ' + editorGroupCommit(GD);
  }
  function editorRemoveSel() { var ids = editorMulti.slice(), out = ids.map(function (k) { return editorRemove(k); }); editorSelect(null); return out; }
  // what the crosshair or a click is on: the nearest visible mesh, named as its prop when it belongs to one
  function editorPick(nx, ny) {
    scene.updateMatrixWorld(true);   /* a prop rebuilt this tick has no world matrix until the next frame */
    eRay.setFromCamera({ x: nx === undefined ? 0 : nx, y: ny === undefined ? 0 : ny }, camera); eRay.far = 120;
    var hits = eRay.intersectObjects(scene.children, true);
    // a baked merge is skipped and the hidden original behind it counts: it is the thing the player would name
    for (var i = 0; i < hits.length; i++) { var h = hits[i].object; if (h.userData.baked || h.userData.editor || h.material === MAT.hit || h === editorHelper || h.isPoints || h.userData.noBake || (!h.visible && !h.userData.bakedAway) || (h.material && h.material.transparent && h.material.opacity < 0.9 && !h.userData.screen)) continue;   /* not a blob, a helper or a glass pane */ var pid = propIdOf(h), isProp = !!(pid && propInst[pid]), wi = isProp ? null : worldItemOf(h); return { id: isProp ? pid : wi ? eid(wi) : eid(h), prop: isProp, world: !!wi, distance: rnd(hits[i].distance), point: [rnd(hits[i].point.x), rnd(hits[i].point.y), rnd(hits[i].point.z)] }; }
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
    var wo = eobj(id); if (wo && wo.userData.worldKey) { if (baked.meshes.length) unbakeStatic(); wo.visible = false; worldRecord(wo); if (editorSel === id) editorSelect(null); shadowDirty = true; histPush('remove ' + worldName(wo), function () { wo.visible = true; worldRecord(wo); shadowDirty = true; }, function () { wo.visible = false; worldRecord(wo); shadowDirty = true; }); return 'removed ' + worldName(wo) + ' (kept in src/00-world.js; Put it back in the inspector or Ctrl+Z brings it back)'; }
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
      // Shift and the left button in the scene camera draw a selection box (Ctrl and Shift add to what is selected)
      if (e.button === 0 && e.shiftKey && photo.on) { boxSelStart(e); e.preventDefault(); return; }
      // the left button: a click selects, Ctrl and a click adds to the selection or takes away; a drag on a selected thing moves it and
      // everything selected with it, with Ctrl in the game view and without in the scene camera
      if (e.button === 0) {
        var rq = canvas.getBoundingClientRect(), qx = ((e.clientX - rq.left) / rq.width) * 2 - 1, qy = -((e.clientY - rq.top) / rq.height) * 2 + 1, hq = editorPick(qx, qy), add = e.ctrlKey || e.metaKey;
        pendingOff = null;
        if (add) { if (hq) { if (editorMulti.indexOf(hq.id) >= 0) pendingOff = hq.id; else editorSelect(hq.id, true); } }
        else if (!hq || editorMulti.indexOf(hq.id) < 0) editorSelect(hq ? hq.id : null);
        else { editorSel = hq.id; editorHelpersShow(); }
        console.log('[co-editor] ' + JSON.stringify({ select: editorSel, selection: editorMulti.slice(), point: hq ? hq.point : null, nx: qx, ny: qy }));
        if (hq && (add || photo.on) && editorMulti.indexOf(hq.id) >= 0 && editorDragStart(e, hq)) { e.preventDefault(); return; }
      }
      if (e.button === 2) { CO.editor.drag = true; e.preventDefault(); }
    });
    document.addEventListener('mouseup', function (e) {
      if (e.button === 2) CO.editor.drag = false; if (e.button === 0) toolDown = false;
      if (e.button === 0 && boxSel) { boxSelEnd(e); return; }
      var moved0 = (groupDrag && groupDrag.moved) || (propDrag && propDrag.moved);
      if (e.button === 0 && pendingOff) { var po = pendingOff; pendingOff = null; if (!moved0) { editorSelect(po, true); console.log('[co-editor] ' + JSON.stringify({ select: editorSel, selection: editorMulti.slice() })); } }
      if (e.button === 0 && groupDrag) { var GD0 = groupDrag; groupDrag = null; if (GD0.moved) editorGroupCommit(GD0); return; }
      if (e.button === 0 && toolStroke) { var TS = toolStroke; toolStroke = null; var afterH = Float32Array.from(TERRAIN.heights), afterP = Uint8Array.from(TERRAIN.paint); histPush('terrain ' + TS.mode, function () { terrainRestore(TS.h, TS.p); }, function () { terrainRestore(afterH, afterP); }); }
      if (e.button === 0 && propDrag && propDrag.world) { var DW = propDrag; propDrag = null; if (DW.moved) { var gw = DW.g, bw = DW.before, aw = { x: gw.position.x, z: gw.position.z }; worldRecord(gw); histPush('move ' + worldName(gw), function () { gw.position.x = bw.x; gw.position.z = bw.z; gw.updateMatrixWorld(true); worldRecord(gw); shadowDirty = true; }, function () { gw.position.x = aw.x; gw.position.z = aw.z; gw.updateMatrixWorld(true); worldRecord(gw); shadowDirty = true; }); console.log('[co-editor] ' + JSON.stringify({ moved: DW.id, x: wr(aw.x), z: wr(aw.z), world: true })); } return; }
      if (e.button === 0 && propDrag) { var D = propDrag; propDrag = null; if (D.moved) { var P = propPlacement(D.id), x = Math.round(D.g.position.x * 100) / 100, z = Math.round(D.g.position.z * 100) / 100; if (!S.layout) S.layout = {}; S.layout[D.id] = S.layout[D.id] || { x: P.x, z: P.z, rot: P.rot, h: P.h || 0 }; S.layout[D.id].x = x; S.layout[D.id].z = z; if (D.rot !== undefined) S.layout[D.id].rot = D.rot; rebuildProp(D.id); save(); var after = layoutSnap(D.id), bef = D.before; histPush('move ' + D.id, function () { layoutRestore(D.id, bef); }, function () { layoutRestore(D.id, after); }); editorSelect(D.id); console.log('[co-editor] ' + JSON.stringify({ moved: D.id, x: x, z: z })); } }
      if (e.button === 0 && partDrag) { console.log('[co-editor] ' + JSON.stringify({ partDragEnd: partDrag.part, type: partDrag.type })); partDrag = null; }
    });
    canvas.addEventListener('mousemove', function (e) {
      if (toolDown && editorTool.mode && editorTool.mode !== 'model' && TERRAIN.on) toolApply(e);
      if (boxSel) { boxSelMove(e); return; }
      if (groupDrag) { var pg = pointOnPlane(e, groupDrag.y); if (!pg) return; var sg = e.shiftKey ? 0.5 : 0.05, gdx = snapTo(pg.x - groupDrag.p0.x, sg), gdz = snapTo(pg.z - groupDrag.p0.z, sg); groupDrag.items.forEach(function (it) { it.g.position.x = it.x0 + gdx; it.g.position.z = it.z0 + gdz; it.g.updateMatrixWorld(true); }); if (gdx || gdz) groupDrag.moved = true; editorHelpersUpdate(); shadowDirty = true; return; }
      if (propDrag) { var p = pointOnPlane(e, propDrag.y); if (!p) return; var s = e.shiftKey ? 0.5 : 0.05, nx2 = snapTo(p.x - propDrag.off.x, s), nz2 = snapTo(p.z - propDrag.off.z, s); var dd = propDrag.world ? null : propDef(propDrag.id); if (dd && dd.wall) { var ws2 = wallSnap({ x: nx2, z: nz2 }, s); if (ws2) { nx2 = ws2.x; nz2 = ws2.z; if (propDrag.g.rotation.y !== ws2.rot * Math.PI / 2) { propDrag.g.rotation.y = ws2.rot * Math.PI / 2; propDrag.rot = ws2.rot; } } } if (nx2 !== propDrag.g.position.x || nz2 !== propDrag.g.position.z) { propDrag.g.position.x = nx2; propDrag.g.position.z = nz2; propDrag.moved = true; if (editorHelper) editorHelper.update(); shadowDirty = true; } return; }
      if (partDrag) { var pp = pointOnPlane(e, partDrag.y); if (!pp) return; var now = performance.now(); if (now - dragT < 40) return; dragT = now; var st = e.shiftKey ? 0.25 : 0.05; if (partDrag.vert !== undefined) { var lv = partDrag.mesh.worldToLocal(pp.clone()); console.log('[co-editor] ' + JSON.stringify({ vertDrag: partDrag.part, v: partDrag.vert, type: partDrag.type, x: snapTo(lv.x, st / 5), z: snapTo(lv.z, st / 5) })); return; } var local = partDrag.g.worldToLocal(pp.clone().sub(partDrag.off)); console.log('[co-editor] ' + JSON.stringify({ partDrag: partDrag.part, type: partDrag.type, x: snapTo(local.x, st), z: snapTo(local.z, st) })); }
    });
    window.addEventListener('blur', function () { CO.editor.drag = false; });
    canvas.addEventListener('contextmenu', function (e) { if (CO.editor.on) e.preventDefault(); });
    // Ctrl and the wheel turn the prop under the pointer (or the selected one) a quarter at a time
    canvas.addEventListener('wheel', function (e) { if (!CO.editor.on || !ui.started || !(e.ctrlKey || e.metaKey)) return; e.preventDefault(); e.stopImmediatePropagation(); var r2 = canvas.getBoundingClientRect(), wx = ((e.clientX - r2.left) / r2.width) * 2 - 1, wy = -((e.clientY - r2.top) / r2.height) * 2 + 1, hw = editorPick(wx, wy), id = hw && hw.prop && propInst[hw.id] ? hw.id : hw && hw.world ? hw.id : editorSel; var wt = id && !propInst[id] ? eobj(id) : null; if (wt && wt.userData.worldKey) { var ry0 = wt.rotation.y * 180 / Math.PI; editorSet(id, 'rotation.y', Math.round(ry0 + (e.deltaY > 0 ? -90 : 90))); editorSelect(id); return; } if (!id || !propInst[id]) return; var dw = propDef(id); if (dw && dw.fixed) return; var rot = propPlacement(id).rot || 0; editorSet(id, 'prop.rot', (rot + (e.deltaY > 0 ? 1 : 3)) % 4); editorSelect(id); console.log('[co-editor] ' + JSON.stringify({ moved: id, rot: (rot + (e.deltaY > 0 ? 1 : 3)) % 4 })); }, { capture: true, passive: false });
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
    if (head === 'world') { var wo = eobj(id); if (!wo || !wo.userData.worldKey) return 'not a world item'; var snap = function () { return { p: wo.position.clone(), ry: wo.rotation.y, s: wo.scale.clone(), v: wo.visible }; }, put = function (q) { wo.position.copy(q.p); wo.rotation.y = q.ry; wo.scale.copy(q.s); wo.visible = q.v; wo.updateMatrixWorld(true); worldRecord(wo); shadowDirty = true; }, w0 = snap(), rw = editorApply(id, path, value), w1 = snap(); if (rw === 'ok') histPush('put back ' + worldName(wo), function () { put(w0); }, function () { put(w1); }); return rw; }
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
  // the build code this prop stands on is also another prop's (a pack's loop, a builder used twice): saving over it would reshape them all
  function buildShared(type) { var b0 = ORIG_BUILD[type] || PROPS[type].build, s0 = b0 ? b0.toString() : ''; if (!s0) return false; for (var k in PROPS) { if (k === type) continue; var b = ORIG_BUILD[k] || PROPS[k].build; if (b && (b === b0 || b.toString() === s0)) return true; } return false; }
  function editorSource(type) {
    var def = PROPS[type]; if (!def) return { error: 'no prop definition ' + type };
    var fields = {}; ['label', 'cat', 'x', 'z', 'rot', 'y', 'wall', 'fixed', 'extra', 'price', 'desc', 'lvl', 'ico', 'noBlob'].forEach(function (k) { if (def[k] !== undefined) fields[k] = def[k]; });
    return { type: type, fields: fields, build: def.build ? def.build.toString() : null, after: def.after ? def.after.toString() : null, original: ORIG_BUILD[type] ? ORIG_BUILD[type].toString() : null, modified: !!ORIG_BUILD[type] && def.build !== ORIG_BUILD[type], shared: buildShared(type) || !!MODEL_OVER[type], canOverride: true, instances: propTypeIds(type), kit: Object.keys(editorKit()) };
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
    model: modelOf, modelPreview: modelPreview, modelStart: modelStart, modelPick: modelPick, modelMirror: modelMirror, modelCode: modelCode, modelConvert: modelConvert, worldCode: worldCode, selection: function () { return editorMulti.slice(); }, selectMany: function (ids) { editorMulti = (ids || []).filter(function (k) { return !!eobj(k); }); editorSel = editorMulti[editorMulti.length - 1] || null; editorHelpersShow(); return editorMulti.slice(); }, moveSel: editorMoveSel, removeSel: editorRemoveSel, worldItems: function () { return WORLD_ITEMS.map(function (o) { return { id: eid(o), key: o.userData.worldKey, name: worldName(o), hidden: !o.visible }; }); },
    physics: physicsState, bodyAdd: function (id, opt) { var o = eobj(id); if (!o) return { error: 'no such object ' + id }; var B = body(o, opt || {}); return { ok: true, id: B.id, size: [B.hx * 2, B.hy * 2, B.hz * 2] }; }, bodyRemove: function (id) { var o = eobj(id); return !!o && removeBody(o); }, impulse: function (id, vx, vy, vz) { var o = eobj(id); return !!o && impulse(o, vx, vy, vz); },
    springAdd: function (id, opt) { var o = eobj(id); if (!o) return { error: 'no such object ' + id }; var S2 = spring(o, opt || {}); return { ok: true, anchor: S2.anchor, k: S2.k }; }, springRemove: function (id) { var o = eobj(id); return !!o && unspring(o); },
    drop: editorDrop, hingeAdd: function (id, opt) { var o = eobj(id); if (!o) return { error: 'no such object ' + id }; var H = hinge(o, opt || {}); return { ok: true, pivot: H.pivot, length: H.length, axis: H.axis }; }, hingeRemove: function (id) { var o = eobj(id); return !!o && removeHinge(o); },
    ids: function () { return { props: Object.keys(propInst), objects: Object.keys(EOBJ) }; }
  };
