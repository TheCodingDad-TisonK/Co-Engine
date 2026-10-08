//@ the sample game: one room on Co Engine, booted through the engine's own loop, enough to prove every layer underneath it stands
  // ── The sample ────────────────────────────────────────────────────
  var walkers = [], people = [], carT = 0;
  var GAME = {
    handle: 'CO_SAMPLE', version: '0.1.0',
    floorY: function (x, z) { return 0; },
    insideWalk: function (x, z) { return Math.abs(x) < 10 && Math.abs(z) < 10; },
    indoors: function (x, z) { return Math.abs(x) < 10 && Math.abs(z) < 10; },
    roofAt: function (x, z) { return Math.abs(x) < 10 && Math.abs(z) < 10 ? 4 : 0; },
    wallPlanes: function () { return [{ a: 'z', v: -9.83, n: 1, x0: -10, x1: 10 }, { a: 'x', v: -9.83, n: 1, z0: -10, z1: 10 }]; },
    editClamp: function (pt) { return { x: clamp(pt.x, -9.5, 9.5), z: clamp(pt.z, -9.5, 9.5) }; },
    doorOpeners: function () { return walkers.concat(people.map(function (p) { return { x: p.rec.x, z: p.rec.z }; })); },
    stepSurface: function (x, z) { return Math.abs(x) < 10 && Math.abs(z) < 10 ? 'floor' : 'outside'; },
    freshState: function () { return { day: 1, time: 9, bank: 500, level: 1, log: [], ledger: [], stats: { earned: 0, spent: 0 }, layout: {}, custom: [], hdoors: {}, presses: 0 }; },
    buildWorld: function (loaded) {
      // the room: a slab, four walls (the north one with a doorway), the linings, a roof, lamps, and a hinged door in the doorway
      plane(20, 20, MAT.floor, 0, 0, 0, -Math.PI / 2);
      box(13.15, 4, 0.3, MAT.wall, -3.575, 2, -10); box(5.95, 4, 0.3, MAT.wall, 7.175, 2, -10); box(1.2, 1.7, 0.3, MAT.wall, 3.6, 3.15, -10);
      box(20.3, 4, 0.3, MAT.wall, 0, 2, 10); box(0.3, 4, 20, MAT.wall, -10, 2, 0); box(0.3, 4, 20, MAT.wall, 10, 2, 0);
      solid(-10.15, 3, -10.15, -9.85); solid(4.2, 10.15, -10.15, -9.85); solid(-10.15, 10.15, 9.85, 10.15); solid(-10.15, -9.85, -10.15, 10.15); solid(9.85, 10.15, -10.15, 10.15);
      GAME.northSegs = lineWall('z', -10, -9.85, 9.85, 3, MAT.plaster, [[3, 4.2, 2.3]], 1); lineWall('x', -10, -9.85, 9.85, 3, MAT.plaster, [], 1);
      roomFloor(MAT.carpet, -9.85, -2, 2, 9.85, 1.0);
      plane(20, 20, MAT.roofIn, 0, 4, 0, Math.PI / 2);
      troffer(-6, 3.9, 6); troffer(-6, 3.9, 8); highBay(4, 3.2, 0, 4);
      GAME.door = hingedDoor('north', 3.1, -10, true, 'the north door', { pushbar: true });
      // outside: grass, a fence to the south, a tree, a lamp post, the sky and a car on a lane
      plane(300, 300, MAT.grass, 0, -0.03, 0, -Math.PI / 2);
      fenceRun(-14, 14, 14, 14); tree(13, -13, 1.1); lampPost(12, 12, 0, 5);
      buildSky({ clouds: 4, rainN: 1500, snowN: 800 });
      traffic.x0 = -60; traffic.x1 = 60; GAME.car = trafficAdd(20, 1, 8);
      // two people: one walks a loop through the doorway, one stands and talks
      var a = makeHuman({ name: 'Ann', vest: MAT.hivis, style: 'short' }), b = makeHuman({ name: 'Bo', style: 'long', hardhat: MAT.yellow });
      a.position.set(-6, 0, -6); b.position.set(6, 0, 6); scene.add(a); scene.add(b);
      people.push({ g: a, rec: { x: -6, z: -6, yaw: 0, speed: 1.6, path: [] }, loop: [{ x: 3.6, z: -12 }, { x: -6, z: -6 }], at: 0 }, { g: b, rec: { x: 6, z: 6, yaw: 0 }, still: true });
      buildProps();
      navSetup({ x0: -16, z0: -16, width: 32, depth: 32, cell: 0.4 });
    },
    tick: function (dt) {
      people.forEach(function (p) {
        if (p.still) { animateHuman(p.g, dt, 'wait', 0, player ? { x: player.x, y: player.y + 1.6, z: player.z } : null, false); return; }
        if (!p.rec.path.length) { p.rec.path = route({ x: p.rec.x, z: p.rec.z }, p.loop[p.at]); p.at = (p.at + 1) % p.loop.length; }
        var done = walkAlong(p.rec, p.rec.path, p.rec.speed, dt); p.g.position.set(p.rec.x, 0, p.rec.z); p.g.rotation.y = p.rec.yaw; animateHuman(p.g, dt, done ? 'idle' : 'walk', 1, null, false);
      });
      carT += dt;
      S.time += dt / 60;   // a game minute a second
      hudDirty = hudDirty || Math.floor(S.time * 60) !== GAME.lastMin; GAME.lastMin = Math.floor(S.time * 60);
    },
    startStats: function (loaded) { return loaded ? ['Day ' + S.day, money(S.bank), 'presses ' + S.presses] : ['A new room', money(500)]; },
    hud: function () { var p = $('h-presses'); if (p) p.textContent = (S.presses || 0) + ' presses'; },
    panel: function (kind, tab) { if (kind === 'info') return { title: 'The sample room', tabs: [['one', 'One'], ['two', 'Two']], tab: tab || 'one', body: '<p>Tab ' + esc(tab || 'one') + '. Presses: ' + (S.presses || 0) + '</p>' + btn('press', '', 'Press from the panel', 'primary') }; return null; },
    panelAct: function (act) { if (act === 'press') { S.presses = (S.presses || 0) + 1; renderPanel(); return true; } return false; },
    guideHtml: function () { return '<p>Walk with WASD, press E on the lever, Tab does nothing here.</p>'; },
    commands: { press: function () { S.presses = (S.presses || 0) + 1; return 'presses ' + S.presses; } },
    devState: function () { return { presses: S.presses || 0, people: people.length }; },
    T: function () { return { GAME: GAME, people: people, walkers: walkers, northSegs: GAME.northSegs, door: GAME.door, car: GAME.car, lever: GAME.lever, traffic: traffic, spanCut: spanCut, lineWall: lineWall, roomFloor: roomFloor, troffer: troffer, highBay: highBay, fenceRun: fenceRun, tree: tree, lampPost: lampPost, insideWalk: insideWalk, inRect: inRect, navSetup: navSetup, yawWrap: yawWrap, sfxCount: function () { return sfxCount; }, SFX: SFX, geoCache: geoCache, BEVEL: BEVEL, bevelGeo: bevelGeo, roundCylGeo: roundCylGeo, boxGeo: boxGeo, taperGeo: taperGeo, textTex: textTex, box: box, cyl: cyl, sign: sign, groundBlob: groundBlob, disposeTree: disposeTree, burst: burst, tickBursts: tickBursts, bursts: bursts, lightBudget: lightBudget, seededStream: seededStream, hexCss: hexCss, mergeById: mergeById, scFit: scFit, catalogueHtml: catalogueHtml, cards: cards, tickCards: tickCards, tickSky: tickSky, weatherFlash: function () { return weatherFlash; }, updateLightBudget: updateLightBudget, shadowTick: shadowTick, faceTex: faceTex, humanGeo: humanGeo, collides: collides, panel: panel }; }
  };
  // the props: a crate stack you can carry, a sign on the wall, a panel with a touch screen, a lever, and a chair in the catalogue
  defProp('crateStack', { label: 'crate stack', x: -4, z: 2, rot: 0, cat: 'room', build: function (c) { for (var i = 0; i < 6; i++) c.box(0.9, 0.5, 0.9, MAT.wood, (i % 3) * 1.0 - 1, 0.25 + Math.floor(i / 3) * 0.5, 0); c.solid(-1.5, 1.5, -0.45, 0.45, 0, 1.0); } });
  defProp('wallSign', { label: 'wall sign', x: 0, z: -9.82, rot: 0, cat: 'wall', wall: true, build: function (c) { c.sign(['CO ENGINE', 'sample room'], 2.4, 0.6, 0, 2.6, 0.01, 0, { bg: '#1b232c' }); } });
  defProp('panel', { label: 'control panel', x: 8, z: -9.5, rot: 0, cat: 'hall', build: function (c) {
    c.box(0.9, 1.3, 0.22, MAT.grey, 0, 1.45, -0.11); c.solid(-0.45, 0.45, -0.25, 0.05, 0, 2.2);
    touchScreen({ w: 420, h: 330, pw: 0.78, ph: 0.616, x: 0, y: 1.5, z: 0.012, parent: c.group, title: 'Sample panel', draw: function (ctx, sc) { scBg(ctx, sc.w, sc.h); scHead(ctx, sc.w, 'SAMPLE PANEL', 'Day ' + S.day); scText(ctx, 16, 66, 'Presses: ' + (S.presses || 0)); scButton(sc, 16, 80, 120, 40, 'Press', true, function () { S.presses = (S.presses || 0) + 1; }); scButton(sc, 148, 80, 120, 40, 'Lights', !S.lightsOff, function () { S.lightsOff = !S.lightsOff; }); } });
  } });
  defProp('lever', { label: 'lever', x: 7, z: -7, rot: 0, cat: 'hall', build: function (c) { c.box(0.3, 1.0, 0.3, MAT.steelDark, 0, 0.5, 0); c.solid(-0.2, 0.2, -0.2, 0.2, 0, 1.1); GAME.lever = c.hit(0.5, 1.2, 0.5, 0, 0.6, 0, { prompt: function () { return 'Pull the lever'; }, use: function () { S.presses = (S.presses || 0) + 1; openPanel('info'); } }); } });
  defProp('xChair', { extra: true, label: 'chair', cat: 'room', price: 40, desc: 'A chair.', build: function (c) { c.box(0.44, 0.05, 0.44, MAT.red, 0, 0.46, 0); c.box(0.44, 0.5, 0.05, MAT.red, 0, 0.72, -0.2); [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]].forEach(function (p) { c.cyl(0.02, 0.45, MAT.steelDark, p[0], 0.22, p[1], 6); }); c.solid(-0.25, 0.25, -0.25, 0.25, 0, 1); } });
  CO.setup({ canvas: 'co-canvas', save: 'co-sample', game: GAME, spawn: { x: 0, z: 5, yaw: 0 }, sun: { box: 30, far: 90, mapSize: 2048, target: [0, 0, 0] }, lightBudget: 6 });
  CO.boot(GAME);
