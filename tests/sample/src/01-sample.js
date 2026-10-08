//@ the sample game: one room on Co Engine, enough to prove the layer underneath it stands
  // ── The sample ────────────────────────────────────────────────────
  CO.setup({ canvas: 'co-canvas', fov: 75, sun: { box: 30, far: 90, mapSize: 2048, target: [0, 0, 0] }, lightBudget: 6 });
  // a room: a slab, four walls, a roof plane, a strip of hazard paint, a sign on the north wall, a lamp in the middle
  plane(20, 20, MAT.floor, 0, 0, 0, -Math.PI / 2);
  box(20.3, 4, 0.3, MAT.wall, 0, 2, -10); box(20.3, 4, 0.3, MAT.wall, 0, 2, 10); box(0.3, 4, 20, MAT.wall, -10, 2, 0); box(0.3, 4, 20, MAT.wall, 10, 2, 0);
  solid(-10.15, 10.15, -10.15, -9.85); solid(-10.15, 10.15, 9.85, 10.15); solid(-10.15, -9.85, -10.15, 10.15); solid(9.85, 10.15, -10.15, 10.15);
  plane(20, 20, MAT.roofIn, 0, 4, 0, Math.PI / 2);
  plane(4, 0.4, MAT.hazard, 0, 0.005, -8, -Math.PI / 2);
  sign(['CO ENGINE', 'sample room'], 2.4, 0.6, 0, 2.6, -9.82, 0, { bg: '#1b232c' });
  // a stack of crates to bake: the same material many times over
  var crates = [];
  for (var i = 0; i < 40; i++) { var cx = -6 + (i % 8) * 1.7, cz = 2 + Math.floor(i / 8) * 1.4, ch = 0.5 + propSeed('crate' + i, 1) * 0.4; crates.push(box(0.9, ch, 0.9, MAT.wood, cx, ch / 2, cz)); }
  // a bevelled cylinder and a chrome sphere, so the eased geometry draws
  cyl(0.3, 1.2, MAT.chrome, 6, 0.6, -4); sphere(0.35, MAT.red, -6, 0.35, -4);
  // something interactive and something dynamic: neither may bake
  var lever = hitBox(0.4, 1.0, 0.4, 7, 0.5, -7, { prompt: function () { return 'Pull the lever'; }, use: function () { CO.pulled = (CO.pulled || 0) + 1; } });
  var spinner = new THREE.Group(); spinner.userData.dynamic = true; scene.add(spinner); box(0.2, 1.4, 0.2, MAT.yellow, -7, 0.7, -7, spinner); animate(function (dt) { spinner.rotation.y += dt; });
  var lamp = new THREE.PointLight(0xffeacc, 0.6, 16, 2); lamp.position.set(0, 3.5, 0); scene.add(lamp);
  camera.position.set(0, 1.6, 7); camera.lookAt(0, 1, -2);
  bakeStatic(); resize(); renderFrame(0.016);
  var frames = 0;
  function sampleFrame() { requestAnimationFrame(sampleFrame); worldTime += 1 / 60; animated.forEach(function (fn) { fn(1 / 60); }); updateLightBudget(); tickBursts(1 / 60); renderFrame(1 / 60); frames++; }
  sampleFrame();
  window.CO_SAMPLE = { T: { CO: CO, scene: scene, renderer: renderer, camera: camera, baked: baked, MAT: MAT, TEX: TEX, NRM: NRM, solids: solids, inter: inter, crates: crates, lever: lever, spinner: spinner, geoCache: geoCache, BEVEL: BEVEL,
    bevelGeo: bevelGeo, roundCylGeo: roundCylGeo, boxGeo: boxGeo, taperGeo: taperGeo, textTex: textTex, tex: tex, normalTex: normalTex, box: box, cyl: cyl, sign: sign, groundBlob: groundBlob, disposeTree: disposeTree, clearKids: clearKids,
    bakeStatic: bakeStatic, unbakeStatic: unbakeStatic, rebake: rebake, renderFrame: renderFrame, post: post, resize: resize, burst: burst, tickBursts: tickBursts, bursts: bursts, updateLightBudget: updateLightBudget, lightBudget: lightBudget,
    propSeed: propSeed, seededF: seededF, seededStream: seededStream, mixHex: mixHex, hexCss: hexCss, mergeById: mergeById, fmtTime: fmtTime, money: money, hook: hook, runHooks: runHooks, HOOKS: HOOKS,
    frames: function () { return frames; }, calls: function () { return post.calls; } } };
