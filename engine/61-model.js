//@ Co Engine, part 61: the prop modeller. A model is a list of parts (boxes, cylinders, spheres, planes, signs, lights, solids, hit boxes) as data; the engine writes it out as a prop's build code with the model kept in a comment at the top, so the editor can read it back, edit a part, mirror, snap, and see every copy rebuild. A prop that was not made this way starts from a box.
  // ── The prop modeller ─────────────────────────────────────────────
  // A part: { kind, mat, x, y, z, ry (degrees), name } plus, by kind: box { w, h, d, r (bevel) }, cyl { r, h, seg, rb }, sphere { r },
  // plane { w, h, rx }, sign { lines, w, h }, light { color, intensity, dist }, solid { w, d, h } (an obstacle, not drawn), hit { w, h, d, prompt }.
  // A model: { parts: [...], autoSolid: true } (autoSolid adds one obstacle around every box and cylinder that touches the ground).
  var MODEL_MARK = '/*@model ';
  function modelFrom(code) { var i = String(code || '').indexOf(MODEL_MARK); if (i < 0) return null; var j = code.indexOf('*/', i); if (j < 0) return null; try { return JSON.parse(code.slice(i + MODEL_MARK.length, j).trim()); } catch (e) { return null; } }
  function n2(v) { return Math.round((+v || 0) * 1000) / 1000; }
  function matRef(m) { return /^[A-Za-z_]\w*$/.test(m || '') ? 'MAT.' + m : 'MAT.grey'; }
  function packMat(pk, path, hex, rough, metal) { var get = CO.packMats && CO.packMats[pk], v = get ? get() : null; String(path).split('.').forEach(function (k) { v = v && typeof v === 'object' ? v[k] : null; }); return v && v.isMaterial ? v : hex ? modelMat(hex, rough === undefined ? 0.8 : rough, metal || 0) : MAT.grey; }
  function partMat(p) { if (p.img && !p.mat) return 'modelImgMat(' + JSON.stringify(p.img) + ', ' + JSON.stringify(p.color || '#ffffff') + ', ' + (p.basic ? 1 : 0) + ', ' + (p.clear || 0) + ', ' + n2(p.rough === undefined ? 0.8 : p.rough) + ', ' + n2(p.metal || 0) + ')'; if (p.mat && p.mat.indexOf('/') > 0) { var sl = p.mat.indexOf('/'); return 'packMat(' + JSON.stringify(p.mat.slice(0, sl)) + ', ' + JSON.stringify(p.mat.slice(sl + 1)) + (p.color ? ', ' + JSON.stringify(p.color) + ', ' + n2(p.rough === undefined ? 0.8 : p.rough) + ', ' + n2(p.metal || 0) : '') + ')'; } return !p.mat && p.color ? 'modelMat(' + JSON.stringify(p.color) + ', ' + n2(p.rough === undefined ? 0.8 : p.rough) + ', ' + n2(p.metal || 0) + (p.glow || p.opacity !== undefined ? ', ' + JSON.stringify(p.glow || '') : '') + (p.opacity !== undefined ? ', ' + n2(p.opacity) : '') + ')' : matRef(p.mat); }
  function modelPartCode(p, i) {
    var x = n2(p.x), y = n2(p.y), z = n2(p.z), ry = (p.rx || p.rz) && p.kind !== 'plane' ? ' p' + i + '.rotation.set(' + n2((p.rx || 0) * Math.PI / 180) + ', ' + n2((p.ry || 0) * Math.PI / 180) + ', ' + n2((p.rz || 0) * Math.PI / 180) + ', "YXZ");' : p.ry ? ' p' + i + '.rotation.y = ' + n2(p.ry * Math.PI / 180) + ';' : '', tag = ' p' + i + '.userData.part = ' + i + ';';
    if (p.kind === 'box') return p.r ? 'var p' + i + ' = box(' + n2(p.w) + ', ' + n2(p.h) + ', ' + n2(p.d) + ', ' + partMat(p) + ', ' + x + ', ' + y + ', ' + z + ', { parent: c.group, r: ' + n2(p.r) + ' });' + ry + tag : 'var p' + i + ' = c.box(' + n2(p.w) + ', ' + n2(p.h) + ', ' + n2(p.d) + ', ' + partMat(p) + ', ' + x + ', ' + y + ', ' + z + ');' + ry + tag;
    if (p.kind === 'mesh') { var vs = (p.verts || []).map(function (q) { return [n2(q[0]), n2(q[1]), n2(q[2])]; }), fs = (p.faces || []).map(function (q) { return [q[0] | 0, q[1] | 0, q[2] | 0]; }); return 'var p' + i + ' = (function () { var V = ' + JSON.stringify(vs) + ', F = ' + JSON.stringify(fs) + ', pos = [], map = []; F.forEach(function (f) { f.forEach(function (k) { pos.push(V[k][0], V[k][1], V[k][2]); map.push(k); }); }); var geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals(); var m = new THREE.Mesh(geo, ' + partMat(p) + '); m.castShadow = m.receiveShadow = true; m.userData.vertexEdit = true; m.userData.vertMap = map; return c.add(m); })(); p' + i + '.position.set(' + x + ', ' + y + ', ' + z + ');' + ry + tag; }
    if (p.kind === 'lathe') return 'var p' + i + ' = c.add(new THREE.Mesh(new THREE.LatheGeometry(' + JSON.stringify((p.points || [[0.3, 0], [0.4, 0.5], [0.2, 1]]).map(function (q) { return [n2(q[0]), n2(q[1])]; })) + '.map(function (q) { return new THREE.Vector2(q[0], q[1]); }), ' + (p.seg || 24) + '), ' + partMat(p) + ')); p' + i + '.position.set(' + x + ', ' + y + ', ' + z + '); p' + i + '.castShadow = p' + i + '.receiveShadow = true;' + ry + tag;
    if (p.kind === 'extrude') return 'var p' + i + ' = c.add(new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape(' + JSON.stringify((p.shape || [[-0.5, 0], [0.5, 0], [0, 0.8]]).map(function (q) { return [n2(q[0]), n2(q[1])]; })) + '.map(function (q) { return new THREE.Vector2(q[0], q[1]); })), { depth: ' + n2(p.depth || 0.2) + ', bevelEnabled: false }), ' + partMat(p) + ')); p' + i + '.position.set(' + x + ', ' + y + ', ' + z + '); p' + i + '.castShadow = p' + i + '.receiveShadow = true;' + ry + tag;
    if (p.kind === 'cyl') return 'var p' + i + ' = c.cyl(' + n2(p.r) + ', ' + n2(p.h) + ', ' + partMat(p) + ', ' + x + ', ' + y + ', ' + z + (p.seg || p.rb ? ', ' + (p.seg || 16) + (p.rb ? ', ' + n2(p.rb) : '') : '') + ');' + ry + tag;
    if (p.kind === 'sphere') return 'var p' + i + ' = c.sphere(' + n2(p.r) + ', ' + partMat(p) + ', ' + x + ', ' + y + ', ' + z + ');' + tag;
    if (p.kind === 'plane') return 'var p' + i + ' = c.plane(' + n2(p.w) + ', ' + n2(p.h) + ', ' + partMat(p) + ', ' + x + ', ' + y + ', ' + z + ', ' + n2((p.rx || 0) * Math.PI / 180) + ', ' + n2((p.ry || 0) * Math.PI / 180) + ');' + tag;
    if (p.kind === 'sign') return 'var p' + i + ' = c.sign(' + JSON.stringify(p.lines || ['SIGN']) + ', ' + n2(p.w || 1) + ', ' + n2(p.h || 0.4) + ', ' + x + ', ' + y + ', ' + z + ', ' + n2((p.ry || 0) * Math.PI / 180) + (p.opt ? ', ' + JSON.stringify(p.opt) : '') + ');' + (' if (p' + i + ' && p' + i + '.userData) p' + i + '.userData.part = ' + i + ';');
    if (p.kind === 'light') return 'var p' + i + ' = c.light(' + JSON.stringify(p.color || '#ffd9a0') + ', ' + n2(p.intensity || 1) + ', ' + n2(p.dist || 8) + ', ' + x + ', ' + y + ', ' + z + ');' + tag;
    if (p.kind === 'solid') return 'c.solid(' + n2(x - p.w / 2) + ', ' + n2(x + p.w / 2) + ', ' + n2(z - p.d / 2) + ', ' + n2(z + p.d / 2) + ', ' + n2(y) + ', ' + n2(y + p.h) + ');';
    if (p.kind === 'hit') return 'c.hit(' + n2(p.w) + ', ' + n2(p.h) + ', ' + n2(p.d) + ', ' + x + ', ' + y + ', ' + z + ', { prompt: function () { return ' + JSON.stringify(p.prompt || 'Use it') + '; }, use: function () { toast(' + JSON.stringify(p.prompt || 'Used') + ', ""); } });';
    return '';
  }
  function modelCode(model) {
    model = model || { parts: [] }; var lines = ['function (c, P, inst) {', '  ' + MODEL_MARK + JSON.stringify(model) + ' */'];
    (model.parts || []).forEach(function (p, i) { var l = modelPartCode(p, i); if (l) lines.push('  ' + l); });
    if (model.autoSolid !== false) (model.parts || []).forEach(function (p) { if ((p.kind === 'box' || p.kind === 'cyl') && n2(p.y) - (p.kind === 'box' ? p.h : p.h) / 2 < 0.3) { var hw = p.kind === 'box' ? p.w / 2 : p.r, hd = p.kind === 'box' ? p.d / 2 : p.r, top = n2(p.y) + p.h / 2; lines.push('  c.solid(' + n2(p.x - hw) + ', ' + n2(p.x + hw) + ', ' + n2(p.z - hd) + ', ' + n2(p.z + hd) + ', 0, ' + n2(top) + ');'); } });
    lines.push('}'); return lines.join('\n');
  }
  function modelOf(type) { var def = PROPS[type]; if (!def || !def.build) return { error: 'no prop definition ' + type }; var src = def.build.toString(), m = modelFrom(src); return { type: type, model: m, modelled: !!m, code: src, mats: modelMatList(m) }; }
  function modelMatList(m) { var out = Object.keys(MAT).filter(function (k) { return k !== 'hit'; }); ((m && m.parts) || []).forEach(function (p) { if (p.mat && out.indexOf(p.mat) < 0) out.push(p.mat); }); return out; }
  function modelPreview(type, model) { var code = modelCode(model); var r = editorPreview(type, code); r.code = code; return r; }
  function modelStart(type) { var def = PROPS[type]; if (!def) return { error: 'no prop definition ' + type }; var m = { parts: [{ kind: 'box', mat: 'wood', x: 0, y: 0.5, z: 0, w: 1, h: 1, d: 1, ry: 0 }], autoSolid: true }; return modelPreview(type, m).ok ? { ok: true, model: m, code: modelCode(m) } : { error: 'the first box did not build' }; }
  // which part of a modelled prop is under a viewport point
  function modelPick(type, nx, ny) { var ids = propTypeIds(type); scene.updateMatrixWorld(true); eRay.setFromCamera({ x: nx || 0, y: ny || 0 }, camera); eRay.far = 120; for (var k = 0; k < ids.length; k++) { var inst = propInst[ids[k]]; if (!inst) continue; var hits = eRay.intersectObject(inst.g, true); for (var i = 0; i < hits.length; i++) { var o = hits[i].object; while (o && o !== inst.g) { if (o.userData && o.userData.part !== undefined) return { part: o.userData.part, id: ids[k], distance: rnd(hits[i].distance) }; o = o.parent; } } } return null; }
  function modelMirror(model, axis) { var m = JSON.parse(JSON.stringify(model)); m.parts.forEach(function (p) { if (axis === 'z') { p.z = -n2(p.z); if (p.ry) p.ry = -p.ry; if (p.rx) p.rx = -p.rx; if (p.verts) p.verts.forEach(function (v) { v[2] = -v[2]; }); } else { p.x = -n2(p.x); if (p.ry) p.ry = -p.ry; if (p.rz) p.rz = -p.rz; if (p.verts) p.verts.forEach(function (v) { v[0] = -v[0]; }); } if (p.faces) p.faces.forEach(function (f) { var s = f[1]; f[1] = f[2]; f[2] = s; }); }); return m; }
  // ── Parts from a prop drawn in code (0.8.0) ──────────────────────
  // The selected prop's placed copy is read back as a model: every box, cylinder, sphere and plane keeps its size and turn, a sign
  // keeps its lines, a light its colour, a use box its prompt, an obstacle becomes a solid, and any other shape becomes a mesh of
  // its corners (vertex drag works on it). A material the palette names keeps its name; any other keeps its colour, roughness,
  // metalness and glow (a picture or a texture drawn in code becomes its plain colour). Nothing is built to read it: the copy that
  // stands is what is read, so no stray uses or screens are left behind.
  var modelMats = {}, modelImgs = {};
  // a picture drawn in code, carried in the model as a PNG (at most 512 px a side) and made into a material once per picture
  function modelImgMat(src, hex, basic, clear, rough, metal) {
    var k = src.length + ':' + src.slice(-48) + hex + basic + clear + rough + metal; if (modelImgs[k]) return modelImgs[k];
    var t = new THREE.TextureLoader().load(src); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8;
    var o = { map: t, color: new THREE.Color(hex), transparent: !!clear, opacity: typeof clear === 'number' && clear > 0 && clear < 1 ? clear : 1 }; return (modelImgs[k] = basic ? new THREE.MeshBasicMaterial(o) : std(Object.assign(o, { roughness: rough, metalness: metal })));
  }
  function imgOf(map) { var im = map && map.image; if (!im || !(im.width > 0) || !(im.height > 0)) return null; try { var s = Math.min(1, 512 / Math.max(im.width, im.height)), cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(im.width * s)); cv.height = Math.max(1, Math.round(im.height * s)); cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height); return cv.toDataURL('image/png'); } catch (e) { return null; } }
  function modelMat(hex, rough, metal, glow, opacity) { var see = typeof opacity === 'number' && opacity < 1, k = hex + ',' + rough + ',' + metal + ',' + (glow || '') + ',' + (see ? opacity : ''); if (!modelMats[k]) modelMats[k] = std({ color: new THREE.Color(hex), roughness: rough, metalness: metal, emissive: glow ? new THREE.Color(glow) : new THREE.Color(0), emissiveIntensity: glow ? 1 : 0, transparent: see, opacity: see ? opacity : 1, depthWrite: !see }); return modelMats[k]; }
  // which pack names a material: a carried variable, or an entry of a table or a cache one holds ("growco/MAT.wood", "depotco/FABRIC")
  function packMatName(m) {
    if (!m || !CO.packMats) return null;
    for (var pk in CO.packMats) { var vals; try { vals = CO.packMats[pk](); } catch (e) { continue; }
      for (var k in vals) { var v = vals[k]; if (!v || typeof v !== 'object') continue; if (v === m) return pk + '/' + k; if (v.isMaterial || v.isTexture || v.isObject3D || v.isBufferGeometry) continue;
        var ks = Object.keys(v); if (ks.length > 4000) continue; for (var j = 0; j < ks.length; j++) if (v[ks[j]] === m && /^[\w$]+$/.test(ks[j])) return pk + '/' + k + '.' + ks[j]; } }
    return null;
  }
  function modelConvert(type) {
    var def = PROPS[type]; if (!def) return { error: 'no prop definition ' + type };
    var ids = propTypeIds(type), inst = null; for (var k = 0; k < ids.length && !inst; k++) inst = propInst[ids[k]] || null;
    if (!inst) return { error: 'place a ' + (def.label || type) + ' first: the parts are read from a copy that stands' };
    var root = inst.g; root.updateMatrixWorld(true);
    var inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), M = new THREE.Matrix4(), pos = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), eu = new THREE.Euler(), D = 180 / Math.PI;
    var parts = [], stats = { box: 0, cyl: 0, sphere: 0, plane: 0, sign: 0, mesh: 0, light: 0, hit: 0, solid: 0, colour: 0, skipped: 0 }, skip = [];
    function near0(a) { return Math.abs(a) < 1e-3; }
    function hex(c) { return '#' + c.getHexString(); }
    function matOf(m, p) {
      if (Array.isArray(m)) m = m[0];
      for (var key in MAT) if (MAT[key] === m) { p.mat = key; return; }
      var pm = packMatName(m); if (pm) { p.mat = pm; if (m.color) { p.color = hex(m.color); p.rough = typeof m.roughness === 'number' ? n2(m.roughness) : 0.8; p.metal = typeof m.metalness === 'number' ? n2(m.metalness) : 0; } stats.pack = (stats.pack || 0) + 1; return; }
      if (m && m.map && m.map !== (typeof blobTex !== 'undefined' ? blobTex : null)) { var img = imgOf(m.map); if (img) { p.img = img; p.basic = !!m.isMeshBasicMaterial; p.clear = m.transparent ? (m.opacity < 1 ? n2(m.opacity) : 1) : 0; stats.picture = (stats.picture || 0) + 1; } }
      if (!p.img) stats.colour++; p.color = m && m.color ? hex(m.color) : '#888888'; p.rough = m && typeof m.roughness === 'number' ? n2(m.roughness) : 0.8; p.metal = m && typeof m.metalness === 'number' ? n2(m.metalness) : 0;
      if (m && m.emissive && m.emissive.getHex() && (m.emissiveIntensity || 0) > 0) p.glow = hex(m.emissive.clone().multiplyScalar(Math.min(1, m.emissiveIntensity)));
      if (m && m.transparent && m.opacity < 1) p.opacity = n2(m.opacity);
    }
    // a shape whose corners were moved after it was made (a bent frond, a tapered leg) is only what its numbers say if its bounds agree
    function shapeHolds(g, t, P) {
      var b = new THREE.Box3().setFromBufferAttribute(g.attributes.position), ok = function (v, w) { return Math.abs(v - w) < 2e-3; };
      if (t === 'BoxGeometry') return ok(b.min.x, -P.width / 2) && ok(b.max.x, P.width / 2) && ok(b.min.y, -P.height / 2) && ok(b.max.y, P.height / 2) && ok(b.min.z, -P.depth / 2) && ok(b.max.z, P.depth / 2);
      if (t === 'CylinderGeometry') { var rm = Math.max(P.radiusTop, P.radiusBottom); return ok(b.min.y, -P.height / 2) && ok(b.max.y, P.height / 2) && b.max.x <= rm + 2e-3 && b.max.x >= rm * 0.7 && b.max.z <= rm + 2e-3; }
      if (t === 'SphereGeometry') return ok(b.max.y, P.radius) && ok(b.min.y, -P.radius) && ok(b.max.x, P.radius);
      if (t === 'PlaneGeometry') return ok(b.min.x, -P.width / 2) && ok(b.max.x, P.width / 2) && ok(b.min.y, -P.height / 2) && ok(b.max.y, P.height / 2) && ok(b.min.z, 0) && ok(b.max.z, 0);
      return false;
    }
    function under(o, list) { for (var a = o.parent; a && a !== root; a = a.parent) if (list.indexOf(a) >= 0) return true; return false; }
    root.traverse(function (o) {
      if (o === root || under(o, skip)) return;
      for (var a = o; a && a !== root; a = a.parent) if (a.visible === false && !a.userData.bakedAway && !(a.isMesh && a.material === MAT.hit)) return;   /* a piece the static bake merged away is hidden but still part of the prop */
      M.multiplyMatrices(inv, o.matrixWorld); M.decompose(pos, q, sc);
      var x = n2(pos.x), y = n2(pos.y), z = n2(pos.z);
      if (o.isPointLight) { parts.push({ kind: 'light', color: hex(o.color), intensity: n2(o.intensity), dist: n2(o.distance || 8), x: x, y: y, z: z }); stats.light++; return; }
      if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || !o.geometry || (blobMat && o.material === blobMat)) return;   /* the contact shadow is the engine's, laid again under the rebuilt prop */
      var g = o.geometry, P = g.parameters || {}, t = g.type, p = null;
      if (o.material === MAT.hit || (o.material && o.material.visible === false)) {
        if (t !== 'BoxGeometry') return; var it = o.userData.it, pr = null; try { pr = it && (typeof it.prompt === 'function' ? it.prompt() : it.prompt); } catch (e) {}
        parts.push({ kind: 'hit', w: n2(P.width * sc.x), h: n2(P.height * sc.y), d: n2(P.depth * sc.z), x: x, y: y, z: z, prompt: typeof pr === 'string' && pr ? pr : 'The ' + (def.label || type) }); stats.hit++; return;
      }
      var R = new THREE.Matrix4().compose(pos, q, sc), sheared = false; for (var e = 0; e < 16; e++) if (Math.abs(R.elements[e] - M.elements[e]) > 1e-4) sheared = true;   /* a turn under a stretched parent skews: only a mesh holds that */
      eu.setFromQuaternion(q, 'YXZ'); var upright = near0(eu.x) && near0(eu.z);
      if (o.userData.sign && t === 'PlaneGeometry' && upright && !sheared && shapeHolds(g, t, P)) { skip.push(o); p = { kind: 'sign', lines: o.userData.sign.lines, w: n2(P.width * sc.x), h: n2(P.height * sc.y), x: x, y: y, z: z, ry: n2(eu.y * D) }; if (o.userData.sign.opt) p.opt = o.userData.sign.opt; parts.push(p); stats.sign++; return; }
      if (sheared || !shapeHolds(g, t, P)) p = null;
      else if (t === 'BoxGeometry') p = { kind: 'box', w: n2(P.width * Math.abs(sc.x)), h: n2(P.height * Math.abs(sc.y)), d: n2(P.depth * Math.abs(sc.z)) };
      else if (t === 'CylinderGeometry' && Math.abs(sc.x - sc.z) < 1e-3) { p = { kind: 'cyl', r: n2(P.radiusTop * sc.x), h: n2(P.height * sc.y), seg: P.radialSegments }; if (Math.abs(P.radiusBottom - P.radiusTop) > 1e-4) p.rb = n2(P.radiusBottom * sc.x); }
      else if (t === 'SphereGeometry' && Math.abs(sc.x - sc.y) < 1e-3 && Math.abs(sc.x - sc.z) < 1e-3 && upright) p = { kind: 'sphere', r: n2(P.radius * sc.x) };
      else if (t === 'PlaneGeometry') { var ex = new THREE.Euler().setFromQuaternion(q, 'XYZ'); if (near0(ex.z)) { p = { kind: 'plane', w: n2(P.width * sc.x), h: n2(P.height * sc.y), x: x, y: y, z: z, rx: n2(ex.x * D), ry: n2(ex.y * D) }; matOf(o.material, p); parts.push(p); stats.plane++; return; } p = null; }
      if (p) { p.x = x; p.y = y; p.z = z; if (!near0(eu.y)) p.ry = n2(eu.y * D); if (!upright) { p.rx = n2(eu.x * D); p.rz = n2(eu.z * D); } matOf(o.material, p); parts.push(p); stats[p.kind]++; return; }
      // any other shape: a mesh of its corners in the prop's own space, a corner shared where faces meet
      var pa = g.attributes && g.attributes.position; if (!pa || pa.count > 6000) { stats.skipped++; return; }
      var V = [], F = [], seen = {}, v = new THREE.Vector3(), idx = g.index, flip = M.determinant() < 0;
      var vid = function (i) { v.fromBufferAttribute(pa, i).applyMatrix4(M); var key = n2(v.x) + ',' + n2(v.y) + ',' + n2(v.z); if (seen[key] === undefined) { seen[key] = V.length; V.push([n2(v.x), n2(v.y), n2(v.z)]); } return seen[key]; };
      var n = idx ? idx.count : pa.count; for (var f = 0; f + 2 < n; f += 3) { var a0 = vid(idx ? idx.getX(f) : f), a1 = vid(idx ? idx.getX(f + 1) : f + 1), a2 = vid(idx ? idx.getX(f + 2) : f + 2); if (a0 !== a1 && a1 !== a2 && a0 !== a2) F.push(flip ? [a0, a2, a1] : [a0, a1, a2]); }
      if (!F.length) return; p = { kind: 'mesh', x: 0, y: 0, z: 0, verts: V, faces: F }; matOf(o.material, p); parts.push(p); stats.mesh++;
    });
    (inst.ctx && inst.ctx.obstacles || []).forEach(function (ob) { parts.push({ kind: 'solid', w: n2(ob.x1 - ob.x0), d: n2(ob.z1 - ob.z0), h: n2(ob.y1 - ob.y0), x: n2((ob.x0 + ob.x1) / 2), y: n2(ob.y0), z: n2((ob.z0 + ob.z1) / 2) }); stats.solid++; });
    if (!parts.length) return { error: (def.label || type) + ' has nothing to read back' };
    var model = { parts: parts, autoSolid: false }, r = modelPreview(type, model);
    if (!r.ok) return { error: 'the parts did not build: ' + r.error };
    return { ok: true, model: model, code: r.code, stats: stats, mats: modelMatList(model) };
  }
