//@ Co Engine, part 60: the editor bridge. CO.editor is what the editor window and the MCP server drive: the scene as a tree, a selection, an inspector record, live edits, assets, spawning, picking, pause and step, a screenshot.
  // ── The editor bridge ─────────────────────────────────────────────
  // The editor shows the running game in its viewport and talks to it through this object (executeJavaScript into the page, or the
  // dev link). Everything here reads or writes the live scene and the save; nothing runs unless the editor asks. Objects are named
  // by id: a prop by its prop id, anything else by an editor id stamped on userData the first time it is listed.
  var EOBJ = {}, eidN = 0, editorSel = null, editorHelper = null, eRay = new THREE.Raycaster();
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
    for (var id in propInst) { var d = propInst[id].def || propDef(id) || {}; (props[d.cat || 'other'] = props[d.cat || 'other'] || []).push({ id: id, name: propLabel(id), type: 'prop', custom: !!customById(id), n: propInst[id].g.children.length }); }
    var roots = CO.root && CO.root !== scene ? [scene, CO.root] : [scene];
    roots.forEach(function (r) { r.children.forEach(function (o) {
      if (o === CO.root || o.userData.editor || isPropRoot(o)) return;
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
    return { props: props, lights: lights, people: people, doors: doors, screens: screensL, vehicles: vehicles, other: other, counts: { baked: baked, statics: statics, inter: inter.length, solids: solids.length, dyn: dyn.length }, extra: extra, time: S ? { day: S.day, time: S.time } : null, selected: editorSel, paused: !!CO.paused, scene: !!photo.on, started: !!ui.started, engine: CO.version, game: CO.gameVersion };
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
    if (propInst[id]) { var inst = propInst[id], def = inst.def || propDef(id) || {}, P = propPlacement(id), c = customById(id); r.prop = { id: id, type: c ? c.type : id, label: def.label, cat: def.cat || null, custom: !!c, fixed: !!def.fixed, wall: !!def.wall, extra: !!def.extra, price: def.price || 0, lvl: def.lvl || null, desc: def.desc || '', x: rnd(P.x), z: rnd(P.z), rot: P.rot, h: rnd(P.h || 0), hidden: !!P.hidden, moved: !!(S && S.layout && S.layout[id]), obstacles: inst.ctx.obstacles.length }; }
    if (o.userData.screen) r.screen = { title: o.userData.screen.title || '', w: o.userData.screen.w, h: o.userData.screen.h, zones: o.userData.screen.zones.length };
    try { var g = CO.game && CO.game.editorInspect ? CO.game.editorInspect(id, o) : null; if (g) r.game = g; } catch (e) { r.game = { error: String(e && e.message || e) }; }
    return r;
  }
  // a live edit: a prop's placement (kept in the save, rebuilt), or an object's transform, visibility, material or light (not kept)
  function editorSet(id, path, value) {
    var o = eobj(id); if (!o) return 'no such object ' + id;
    var p = String(path).split('.'), v = value;
    if (p[0] === 'prop') {
      if (!propInst[id]) return id + ' is not a prop';
      var P = propPlacement(id); if (!S.layout) S.layout = {}; var L = S.layout[id] = S.layout[id] || { x: P.x, z: P.z, rot: P.rot, h: P.h || 0 };
      if (p[1] === 'hidden') { if (v && v !== 'false') L.hidden = true; else delete L.hidden; } else if (p[1] === 'reset') { delete S.layout[id]; } else if (p[1] === 'rot') L.rot = ((Math.round(+v) % 4) + 4) % 4; else L[p[1]] = +v;
      buildProp(id); save(); editorSelect(propInst[id] ? id : null); return 'ok';
    }
    if (p[0] === 'position' || p[0] === 'rotation' || p[0] === 'scale') { o[p[0]][p[1]] = p[0] === 'rotation' ? (+v) * Math.PI / 180 : +v; o.updateMatrixWorld(true); shadowDirty = true; if (editorHelper) editorHelper.update(); return 'ok'; }
    if (p[0] === 'visible') { o.visible = !!v && v !== 'false'; shadowDirty = true; return 'ok'; }
    if (p[0] === 'material') { var m = o.material; if (!m) return 'no material'; if (p[1] === 'color' || p[1] === 'emissive') { if (!m[p[1]]) return 'no ' + p[1]; m[p[1]].set(String(v)); } else m[p[1]] = +v; m.needsUpdate = true; return 'ok'; }
    if (p[0] === 'light') { if (!o.isLight) return 'not a light'; if (p[1] === 'color') o.color.set(String(v)); else o[p[1]] = +v; return 'ok'; }
    if (p[0] === 'name') { o.name = String(v); return 'ok'; }
    return 'unknown path ' + path;
  }
  function editorSelect(id) {
    var o = id ? eobj(id) : null; editorSel = o ? (propInst[id] ? id : eid(o)) : null;
    if (editorHelper) { scene.remove(editorHelper); editorHelper.geometry.dispose(); editorHelper = null; }
    if (o) { editorHelper = new THREE.BoxHelper(o, 0xf5b53d); editorHelper.userData.editor = true; editorHelper.userData.noBake = true; editorHelper.material.depthTest = false; editorHelper.renderOrder = 9; scene.add(editorHelper); }
    return editorSel ? editorInspect(editorSel) : null;
  }
  // what the crosshair or a click is on: the nearest visible mesh, named as its prop when it belongs to one
  function editorPick(nx, ny) {
    eRay.setFromCamera({ x: nx === undefined ? 0 : nx, y: ny === undefined ? 0 : ny }, camera); eRay.far = 120;
    var hits = eRay.intersectObjects(scene.children, true);
    // a baked merge is skipped and the hidden original behind it counts: it is the thing the player would name
    for (var i = 0; i < hits.length; i++) { var h = hits[i].object; if (h.userData.baked || h.userData.editor || h.material === MAT.hit || h === editorHelper || h.isPoints || h.userData.noBake || (!h.visible && !h.userData.bakedAway) || (h.material && h.material.transparent && h.material.opacity < 0.9 && !h.userData.screen)) continue;   /* not a blob, a helper or a glass pane */ var pid = propIdOf(h); return { id: pid && propInst[pid] ? pid : eid(h), prop: !!(pid && propInst[pid]), distance: rnd(hits[i].distance), point: [rnd(hits[i].point.x), rnd(hits[i].point.y), rnd(hits[i].point.z)] }; }
    return null;
  }
  function aheadPoint(dist) { var d = new THREE.Vector3(); camera.getWorldDirection(d); var p = camera.position.clone().add(d.multiplyScalar(dist || 3)); return { x: p.x, z: p.z, y: floorY(p.x, p.z) }; }
  // a new copy of a prop definition, free, where the camera looks (or at x, z): kept in the save as a bought extra would be
  function editorSpawn(type, x, z) {
    var def = PROPS[type]; if (!def) return 'no prop definition ' + type;
    if (x === undefined || z === undefined) { var a = aheadPoint(3); x = a.x; z = a.z; }
    if (!S.custom) S.custom = []; var c = { id: uid('cp'), type: type, x: Math.round(x * 20) / 20, z: Math.round(z * 20) / 20, rot: 0, h: 0 }; S.custom.push(c);
    buildProp(c.id); save(); editorSelect(c.id); return c.id;
  }
  function editorRemove(id) {
    var c = customById(id);
    if (c) { S.custom.splice(S.custom.indexOf(c), 1); removePropInst(id); save(); if (editorSel === id) editorSelect(null); return 'removed ' + id; }
    if (propInst[id]) { if (!S.layout) S.layout = {}; S.layout[id] = S.layout[id] || {}; S.layout[id].hidden = true; buildProp(id); save(); if (editorSel === id) editorSelect(null); return 'hidden ' + id + ' (the catalogue brings it back)'; }
    var o = eobj(id); if (!o) return 'no such object ' + id; if (o.parent) o.parent.remove(o); if (editorSel === id) editorSelect(null); shadowDirty = true; return 'removed ' + id + ' until the next reload';
  }
  // the scene view is the engine's free camera: the world holds still, the camera flies. frame(id) brings the camera to a thing.
  function editorEnter() { if (ui.started) return true; if (CO.game && CO.game.editorEnter) CO.game.editorEnter(); else enter(); return ui.started; }
  function editorMode(m) {
    if (m === 'scene') { editorEnter(); if (ui.menuOpen) closeMenu(); if (ui.panelOpen) closePanel(); if (!photo.on) photoToggle(true); return photo.on ? 'scene' : 'game'; }
    if (photo.on) photoToggle(false); return 'game';
  }
  function editorFrame(id) {
    var o = eobj(id); if (!o) return 'no such object ' + id;
    var box3 = new THREE.Box3().setFromObject(o), c = box3.getCenter(new THREE.Vector3()), s = box3.getSize(new THREE.Vector3()), d = Math.max(2.2, Math.max(s.x, s.y, s.z) * 1.6 + 1.2);
    if (editorMode('scene') !== 'scene') return 'the scene view did not open';
    var yaw = photo.yaw, px = c.x + Math.sin(yaw) * d, pz = c.z + Math.cos(yaw) * d, py = c.y + d * 0.45;
    photo.x = px; photo.y = py; photo.z = pz; photo.pitch = -Math.atan2(py - c.y, Math.sqrt((px - c.x) * (px - c.x) + (pz - c.z) * (pz - c.z)));
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
  function editorBind() {
    canvas.addEventListener('mousedown', function (e) {
      if (!CO.editor.on || !ui.started) return;
      if (e.button === 0) { var r = canvas.getBoundingClientRect(), nx = ((e.clientX - r.left) / r.width) * 2 - 1, ny = -((e.clientY - r.top) / r.height) * 2 + 1, hit = editorPick(nx, ny); editorSelect(hit ? hit.id : null); console.log('[co-editor] ' + JSON.stringify({ select: hit ? hit.id : null, point: hit ? hit.point : null })); }
      if (e.button === 2) { CO.editor.drag = true; e.preventDefault(); }
    });
    document.addEventListener('mouseup', function (e) { if (e.button === 2) CO.editor.drag = false; });
    window.addEventListener('blur', function () { CO.editor.drag = false; });
    canvas.addEventListener('contextmenu', function (e) { if (CO.editor.on) e.preventDefault(); });
  }
  CO.editor = {
    on: false, drag: false, bind: editorBind,
    tree: editorTree, children: editorChildren, inspect: editorInspect, set: editorSet, select: editorSelect, pick: editorPick, frame: editorFrame, spawn: editorSpawn, remove: editorRemove, assets: editorAssets, shot: editorShot,
    mode: editorMode, enter: editorEnter, pause: function (v) { CO.paused = v === undefined ? !CO.paused : !!v; return CO.paused; }, step: function () { CO.stepOnce = true; return 'step'; },
    selected: function () { return editorSel; }, state: function () { return devState(); }, sfx: function (k) { sfx(k); return k; }, command: function (name, arg) { return devCommand(name, arg); }, log: function (n) { return S && S.log ? S.log.slice(0, n || 30) : []; },
    ids: function () { return { props: Object.keys(propInst), objects: Object.keys(EOBJ) }; }
  };
