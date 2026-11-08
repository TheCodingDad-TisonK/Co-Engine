//@ Co Engine, part 11: the static-geometry bake. Every mesh that never moves is merged by material into a handful of draws.
  // ── Static bake ───────────────────────────────────────────────────
  // Thousands of small boxes (bracing, trims, props) each cost a draw call. After the world is built, everything that cannot
  // move or change is merged into one mesh per material. Anything interactive, animated, glowing, transparent, instanced, or
  // under a group flagged dynamic is left alone, so doors, trucks, people, lamps and screens behave as before.
  // A material is kept out of the bake with material.userData.noBake = true (the engine sets it on MAT.hit; a game sets it on
  // its screens and its lit signs). An object is kept out with object.userData.noBake or an ancestor's userData.dynamic.
  var baked = { meshes: [], hidden: 0, draws: 0 };
  function bakeable(o) {
    if (!o.isMesh || o.isInstancedMesh || o.isSprite || !o.visible) return false;
    for (var a = o.parent; a; a = a.parent) if (a.visible === false) return false;   /* a removed world item stays out of the bake */
    var m = o.material; if (!m || Array.isArray(m) || m.userData.glow || m.userData.noBake || m.transparent) return false;
    if (o.userData.it || o.userData.noBake || inter.indexOf(o) >= 0) return false;
    if (!(o.geometry && o.geometry.attributes && o.geometry.attributes.position)) return false;
    for (var p = o; p; p = p.parent) { if (p.userData && p.userData.dynamic) return false; if (!p.visible) return false; if (p === camera) return false; }
    return true;
  }
  // The static bake used to be one mesh per material, and one mesh spans the whole site: it can never leave the frustum, so
  // every corner of it is drawn (and shadowed) whole wherever the player stands. It now bakes per material per CHUNK, a cell of
  // the site grid, so the cells behind the player cull away and only the scenery near the view is drawn. A material spread too
  // thin for a cell (a lone mesh in each) still merges whole, exactly as it did before, so no mesh regresses to a separate draw.
  var BAKE_CHUNK = 96;   // metres: the side of the grid cell the static bake splits into
  // Two meshes merge only if they carry the SAME material object. Games build hundreds of visually identical materials (each
  // std({...}) call is a fresh material), so merge by the material's rendering properties instead: same look = same draw.
  function bakeMatKey(m) {
    var t = function (x) { return x ? x.uuid : ''; };
    return m.type + '|' + (m.color && m.color.getHex ? m.color.getHex() : '') + '|' +
      (m.emissive && m.emissive.getHex ? m.emissive.getHex() : '') + '|' + (m.emissiveIntensity || 0) + '|' +
      (m.roughness || 0) + '|' + (m.metalness || 0) + '|' + (m.opacity === undefined ? 1 : m.opacity) + '|' +
      (m.transparent ? 1 : 0) + '|' + m.side + '|' + (m.flatShading ? 1 : 0) + '|' + (m.vertexColors ? 1 : 0) + '|' +
      (m.envMapIntensity || 0) + '|' + t(m.map) + '|' + t(m.normalMap) + '|' + t(m.roughnessMap) + '|' + t(m.metalnessMap) + '|' +
      t(m.emissiveMap) + '|' + t(m.alphaMap) + '|' + t(m.aoMap) + '|' + t(m.envMap) + '|' +
      (m.name || '') + '|' + (m.customProgramCacheKey ? m.customProgramCacheKey() : '');
  }
  var _bakeWp = new THREE.Vector3();
  function bakeBatch(mat, items) {
    var pos = [], nor = [], uv = [], hasUv = true;
    items.forEach(function (o) {
      var g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      g.applyMatrix4(o.matrixWorld);
      var pa = g.attributes.position.array, na = g.attributes.normal ? g.attributes.normal.array : null, ua = g.attributes.uv ? g.attributes.uv.array : null;
      for (var i = 0; i < pa.length; i++) pos.push(pa[i]);
      if (na) for (var j = 0; j < na.length; j++) nor.push(na[j]); else for (var j2 = 0; j2 < pa.length; j2++) nor.push(0);
      if (ua) for (var u = 0; u < ua.length; u++) uv.push(ua[u]); else hasUv = false;
      g.dispose();
    });
    var merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    merged.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    if (hasUv && uv.length === pos.length / 3 * 2) merged.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    merged.computeBoundingSphere();
    var mesh = new THREE.Mesh(merged, mat); mesh.castShadow = items[0].castShadow; mesh.receiveShadow = items[0].receiveShadow; mesh.frustumCulled = true; mesh.userData.baked = true;
    scene.add(mesh); baked.meshes.push(mesh);
    items.forEach(function (o) { o.visible = false; o.userData.bakedAway = true; baked.hidden++; });
    baked.draws++;
  }
  function bakeStatic() {
    scene.updateMatrixWorld(true);
    var byMat = {}, list = [];
    scene.traverse(function (o) { if (bakeable(o)) list.push(o); });
    list.forEach(function (o) {
      var k = bakeMatKey(o.material) + (o.castShadow ? 'c' : '') + (o.receiveShadow ? 'r' : '');
      (byMat[k] = byMat[k] || { mat: o.material, items: [] }).items.push(o);
    });
    Object.keys(byMat).forEach(function (k) {
      var grp = byMat[k];
      if (grp.items.length < 2) return;
      var cells = {}, strays = [];
      grp.items.forEach(function (o) {
        o.getWorldPosition(_bakeWp);
        var ck = Math.floor(_bakeWp.x / BAKE_CHUNK) + ',' + Math.floor(_bakeWp.z / BAKE_CHUNK);
        (cells[ck] = cells[ck] || []).push(o);
      });
      Object.keys(cells).forEach(function (ck) {
        var cell = cells[ck];
        if (cell.length >= 2) bakeBatch(grp.mat, cell); else strays = strays.concat(cell);
      });
      if (strays.length >= 2) bakeBatch(grp.mat, strays);   // a sparse material still bakes whole, so it never loses the merge
    });
    shadowDirty = true;
  }
  // everything back the way it was: the merged meshes go, the originals show. A world that changed (a prop moved, a wall grew)
  // calls unbakeStatic, changes, then bakeStatic again.
  function unbakeStatic() { baked.meshes.forEach(function (m) { scene.remove(m); m.geometry.dispose(); }); baked.meshes = []; baked.draws = 0; baked.hidden = 0; scene.traverse(function (o) { if (o.userData.bakedAway) { o.visible = true; o.userData.bakedAway = false; } }); }
  function rebake() { unbakeStatic(); bakeStatic(); }
