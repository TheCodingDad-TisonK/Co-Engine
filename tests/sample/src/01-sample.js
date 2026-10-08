//@ the sample game: one room on Co Engine, enough to prove the layers underneath it stand
  // ── The sample ────────────────────────────────────────────────────
  // the game's hooks: a flat floor, walkable ground inside the room, two wall faces a wall prop can hang on, a clamp that keeps
  // a carried prop inside, and the list of walkers that doors open for
  var walkers = [];
  var GAME = {
    floorY: function (x, z) { return 0; },
    insideWalk: function (x, z) { return Math.abs(x) < 10 && Math.abs(z) < 10; },
    wallPlanes: function () { return [{ a: 'z', v: -9.83, n: 1, x0: -10, x1: 10 }, { a: 'x', v: -9.83, n: 1, z0: -10, z1: 10 }]; },
    editClamp: function (pt) { return { x: clamp(pt.x, -9.5, 9.5), z: clamp(pt.z, -9.5, 9.5) }; },
    doorOpeners: function () { return walkers; }
  };
  CO.setup({ canvas: 'co-canvas', save: 'co-sample', game: GAME, sun: { box: 30, far: 90, mapSize: 2048, target: [0, 0, 0] }, lightBudget: 6 });
  var loaded = loadSave(function () { return { day: 1, time: 9, bank: 500, level: 1, log: [], ledger: [], stats: { earned: 0, spent: 0 }, layout: {}, custom: [], hdoors: {}, presses: 0 }; });
  // the room: a slab, four walls (the north one with a doorway), the linings, a roof, lamps, and a hinged door in the doorway
  plane(20, 20, MAT.floor, 0, 0, 0, -Math.PI / 2);
  box(13.15, 4, 0.3, MAT.wall, -3.575, 2, -10); box(5.95, 4, 0.3, MAT.wall, 7.175, 2, -10); box(1.2, 1.7, 0.3, MAT.wall, 3.6, 3.15, -10);   // the north wall round a 1.2 m doorway at x 3 to 4.2
  box(20.3, 4, 0.3, MAT.wall, 0, 2, 10); box(0.3, 4, 20, MAT.wall, -10, 2, 0); box(0.3, 4, 20, MAT.wall, 10, 2, 0);
  solid(-10.15, 3, -10.15, -9.85); solid(4.2, 10.15, -10.15, -9.85); solid(-10.15, 10.15, 9.85, 10.15); solid(-10.15, -9.85, -10.15, 10.15); solid(9.85, 10.15, -10.15, 10.15);
  var northSegs = lineWall('z', -10, -9.85, 9.85, 3, MAT.plaster, [[3, 4.2, 2.3]], 1); lineWall('x', -10, -9.85, 9.85, 3, MAT.plaster, [], 1);
  roomFloor(MAT.carpet, -9.85, -2, 2, 9.85, 1.0);
  plane(20, 20, MAT.roofIn, 0, 4, 0, Math.PI / 2);
  troffer(-6, 3.9, 6); troffer(-6, 3.9, 8); highBay(4, 3.2, 0, 4);
  var door = hingedDoor('north', 3.1, -10, true, 'the north door', { pushbar: true });
  // outside: a fence to the south and a tree in the corner
  fenceRun(-14, 14, 14, 14); tree(13, -13, 1.1);
  // props: a crate stack you can carry, a sign on the wall, a panel with a touch screen, and a chair in the catalogue
  defProp('crateStack', { label: 'crate stack', x: -4, z: 2, rot: 0, cat: 'room', build: function (c) { for (var i = 0; i < 6; i++) c.box(0.9, 0.5, 0.9, MAT.wood, (i % 3) * 1.0 - 1, 0.25 + Math.floor(i / 3) * 0.5, 0); c.solid(-1.5, 1.5, -0.45, 0.45, 0, 1.0); } });
  defProp('wallSign', { label: 'wall sign', x: 0, z: -9.82, rot: 0, cat: 'wall', wall: true, build: function (c) { c.sign(['CO ENGINE', 'sample room'], 2.4, 0.6, 0, 2.6, 0.01, 0, { bg: '#1b232c' }); } });
  defProp('panel', { label: 'control panel', x: 8, z: -9.5, rot: 0, cat: 'hall', build: function (c) {
    c.box(0.9, 1.3, 0.22, MAT.grey, 0, 1.45, -0.11); c.solid(-0.45, 0.45, -0.25, 0.05, 0, 2.2);
    touchScreen({ w: 420, h: 330, pw: 0.78, ph: 0.616, x: 0, y: 1.5, z: 0.012, parent: c.group, title: 'Sample panel', draw: function (ctx, sc) { scBg(ctx, sc.w, sc.h); scHead(ctx, sc.w, 'SAMPLE PANEL', 'Day ' + S.day); scText(ctx, 16, 66, 'Presses: ' + (S.presses || 0)); scButton(sc, 16, 80, 120, 40, 'Press', true, function () { S.presses = (S.presses || 0) + 1; }); scButton(sc, 148, 80, 120, 40, 'Lights', !S.lightsOff, function () { S.lightsOff = !S.lightsOff; }); } });
  } });
  defProp('xChair', { extra: true, label: 'chair', cat: 'room', price: 40, desc: 'A chair.', build: function (c) { c.box(0.44, 0.05, 0.44, MAT.red, 0, 0.46, 0); c.box(0.44, 0.5, 0.05, MAT.red, 0, 0.72, -0.2); [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]].forEach(function (p) { c.cyl(0.02, 0.45, MAT.steelDark, p[0], 0.22, p[1], 6); }); c.solid(-0.25, 0.25, -0.25, 0.25, 0, 1); } });
  buildProps();
  navSetup({ x0: -16, z0: -16, width: 32, depth: 32, cell: 0.4 });
  camera.position.set(0, 1.6, 7); camera.lookAt(0, 1, -2);
  bakeStatic(); resize(); renderFrame(0.016);
  var frames = 0, last = performance.now();
  function sampleFrame() { requestAnimationFrame(sampleFrame); var t = performance.now(), dt = Math.min(0.05, (t - last) / 1000); last = t; worldTime += dt; doorsTick(dt); drawScreens(dt); editTick(); animated.forEach(function (fn) { fn(dt); }); updateLightBudget(); tickBursts(dt); renderFrame(dt); frames++; }
  sampleFrame();
  window.CO_SAMPLE = { T: { CO: CO, get S() { return S; }, SET: SET, scene: scene, renderer: renderer, camera: camera, baked: baked, MAT: MAT, TEX: TEX, NRM: NRM, solids: solids, inter: inter, screens: screens, hdoors: hdoors, door: door, walkers: walkers, northSegs: northSegs, lampMeshes: lampMeshes, geoCache: geoCache, BEVEL: BEVEL, NAV: NAV,
    PROPS: PROPS, propInst: propInst, edit: edit, defProp: defProp, buildProp: buildProp, buildProps: buildProps, propPlacement: propPlacement, propWorld: propWorld, removePropInst: removePropInst, rotAABB: rotAABB, catalogueData: catalogueData,
    editToggle: editToggle, editGrab: editGrab, editDrop: editDrop, editRotate: editRotate, editReset: editReset, editRemove: editRemove, editRestore: editRestore, editBuy: editBuy, editAim: editAim,
    hd: hd, doorUse: doorUse, doorLock: doorLock, doorPose: doorPose, doorsTick: doorsTick, doorSolids: doorSolids, lockAll: lockAll, anyDoorUnlocked: anyDoorUnlocked, doorById: doorById,
    drawScreens: drawScreens, screenZoneAt: screenZoneAt, screenTap: screenTap, screenDirtyAll: screenDirtyAll, scFit: scFit,
    spanCut: spanCut, lineWall: lineWall, roomFloor: roomFloor, troffer: troffer, highBay: highBay, fenceRun: fenceRun, tree: tree, lampPost: lampPost, floorY: floorY, insideWalk: insideWalk, inRect: inRect,
    navSetup: navSetup, navBuild: navBuild, navFreeAt: navFreeAt, route: route, walkAlong: walkAlong, yawWrap: yawWrap,
    sfx: sfx, SFX: SFX, sfxCount: function () { return sfxCount; }, toast: toast, logEvent: logEvent,
    loadSave: loadSave, save: save, pay: pay, saveSettings: saveSettings, loaded: loaded,
    bevelGeo: bevelGeo, roundCylGeo: roundCylGeo, boxGeo: boxGeo, taperGeo: taperGeo, textTex: textTex, tex: tex, normalTex: normalTex, box: box, cyl: cyl, sign: sign, groundBlob: groundBlob, disposeTree: disposeTree, clearKids: clearKids,
    bakeStatic: bakeStatic, unbakeStatic: unbakeStatic, rebake: rebake, renderFrame: renderFrame, post: post, resize: resize, burst: burst, tickBursts: tickBursts, bursts: bursts, updateLightBudget: updateLightBudget, lightBudget: lightBudget,
    propSeed: propSeed, seededF: seededF, seededStream: seededStream, mixHex: mixHex, hexCss: hexCss, mergeById: mergeById, fmtTime: fmtTime, money: money, hook: hook, runHooks: runHooks, HOOKS: HOOKS,
    frames: function () { return frames; }, calls: function () { return post.calls; } } };
