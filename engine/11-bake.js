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
  function bakeStatic() {
    scene.updateMatrixWorld(true);
    var byMat = {}, list = [];
    scene.traverse(function (o) { if (bakeable(o)) list.push(o); });
    list.forEach(function (o) { var k = o.material.uuid + (o.castShadow ? 'c' : '') + (o.receiveShadow ? 'r' : ''); (byMat[k] = byMat[k] || { mat: o.material, items: [] }).items.push(o); });
    Object.keys(byMat).forEach(function (k) {
      var grp = byMat[k]; if (grp.items.length < 2) return;
      var pos = [], nor = [], uv = [], hasUv = true;
      grp.items.forEach(function (o) {
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
      var mesh = new THREE.Mesh(merged, grp.mat); mesh.castShadow = grp.items[0].castShadow; mesh.receiveShadow = grp.items[0].receiveShadow; mesh.frustumCulled = false; mesh.userData.baked = true;
      scene.add(mesh); baked.meshes.push(mesh);
      grp.items.forEach(function (o) { o.visible = false; o.userData.bakedAway = true; baked.hidden++; });
      baked.draws++;
    });
    shadowDirty = true;
  }
  // everything back the way it was: the merged meshes go, the originals show. A world that changed (a prop moved, a wall grew)
  // calls unbakeStatic, changes, then bakeStatic again.
  function unbakeStatic() { baked.meshes.forEach(function (m) { scene.remove(m); m.geometry.dispose(); }); baked.meshes = []; baked.draws = 0; baked.hidden = 0; scene.traverse(function (o) { if (o.userData.bakedAway) { o.visible = true; o.userData.bakedAway = false; } }); }
  function rebake() { unbakeStatic(); bakeStatic(); }
