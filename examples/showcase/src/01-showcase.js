//@ the showcase: a hall on Co Engine to build in with every pack prop. A shop front, an office, a lounge and a stock room under one roof, a roll-up doorway onto a forecourt with a gate, the sky and a road. The props are placed in the Co Engine editor and live in src/00-layout.js.
  // ── The showcase ──────────────────────────────────────────────────
  // the hall is 36 by 26 m, centred on the origin; the south wall has a 5 m doorway onto the forecourt (z 13 to 24) and the road past it
  var HALL = { x: 18, z: 13, h: 5 }, DOOR_W = 5, YARD_Z = 24;
  var GAME = {
    handle: 'CO_SHOWCASE', version: '0.1.0',
    floorY: function () { return 0; },
    insideWalk: function (x, z) { return Math.abs(x) < 40 && z > -HALL.z - 0.2 && z < YARD_Z + 8; },
    indoors: function (x, z) { return Math.abs(x) < HALL.x && Math.abs(z) < HALL.z; },
    roofAt: function (x, z) { return Math.abs(x) < HALL.x && Math.abs(z) < HALL.z ? HALL.h : 0; },
    wallPlanes: function () { return [
      { a: 'z', v: -HALL.z + 0.17, n: 1, x0: -HALL.x, x1: HALL.x }, { a: 'z', v: HALL.z - 0.17, n: -1, x0: -HALL.x, x1: HALL.x },
      { a: 'x', v: -HALL.x + 0.17, n: 1, z0: -HALL.z, z1: HALL.z }, { a: 'x', v: HALL.x - 0.17, n: -1, z0: -HALL.z, z1: HALL.z },
      { a: 'x', v: -6.17, n: -1, z0: -HALL.z, z1: -2 }, { a: 'x', v: -5.83, n: 1, z0: -HALL.z, z1: -2 }, { a: 'x', v: 5.83, n: -1, z0: -HALL.z, z1: -2 }, { a: 'x', v: 6.17, n: 1, z0: -HALL.z, z1: -2 }
    ]; },
    editClamp: function (pt) { return { x: clamp(pt.x, -38, 38), z: clamp(pt.z, -HALL.z + 0.4, YARD_Z + 6) }; },
    stepSurface: function (x, z) { return Math.abs(x) < HALL.x && Math.abs(z) < HALL.z ? 'floor' : 'outside'; },
    freshState: function () { return { day: 1, time: 10, bank: 2000, level: 1, log: [], ledger: [], stats: { earned: 0, spent: 0 }, layout: {}, custom: [], hdoors: {} }; },
    buildWorld: function () {
      var X = HALL.x, Z = HALL.z, H = HALL.h;
      // the hall: a slab, the outer walls (a doorway in the south one), two partitions at x = -6 and x = 6 from the north wall to z = -2
      // (the office on the west, the stock room on the east, the lounge between), a roof, lamps
      plane(2 * X, 2 * Z, MAT.floor, 0, 0, 0, -Math.PI / 2);
      box(2 * X + 0.3, H, 0.3, MAT.wall, 0, H / 2, -Z); box(0.3, H, 2 * Z, MAT.wall, -X, H / 2, 0); box(0.3, H, 2 * Z, MAT.wall, X, H / 2, 0);
      var side = (2 * X - DOOR_W) / 2; box(side, H, 0.3, MAT.wall, -X + side / 2, H / 2, Z); box(side, H, 0.3, MAT.wall, X - side / 2, H / 2, Z); box(DOOR_W, H - 3.4, 0.3, MAT.wall, 0, 3.4 + (H - 3.4) / 2, Z);
      solid(-X - 0.15, X + 0.15, -Z - 0.15, -Z + 0.15); solid(-X - 0.15, -X + 0.15, -Z, Z); solid(X - 0.15, X + 0.15, -Z, Z); solid(-X, -DOOR_W / 2, Z - 0.15, Z + 0.15); solid(DOOR_W / 2, X, Z - 0.15, Z + 0.15);
      [-6, 6].forEach(function (px) { box(0.3, 3.2, Z - 2, MAT.plaster, px, 1.6, -Z + (Z - 2) / 2); solid(px - 0.15, px + 0.15, -Z, -2); });
      roomFloor(MAT.carpet, -X + 0.15, -6.15, -Z + 0.15, -2, 1.0); roomFloor(MAT.vinyl, -5.85, 5.85, -Z + 0.15, -2, 1.0);
      plane(2 * X, 2 * Z, MAT.roofIn, 0, H, 0, Math.PI / 2);
      [-12, 0, 12].forEach(function (lx) { [-7, 4].forEach(function (lz) { highBay(lx, H - 0.6, lz, 4); }); });
      troffer(-12, 3.1, -9); troffer(12, 3.1, -9);
      // the forecourt: asphalt to the road, a kerb either side of the entrance, the road with its line
      plane(2 * X, YARD_Z - Z, MAT.yard, 0, 0.002, (Z + YARD_Z) / 2, -Math.PI / 2);
      plane(240, 240, MAT.grass, 0, -0.03, 0, -Math.PI / 2);
      plane(240, 7, MAT.yard, 0, 0.004, YARD_Z + 4, -Math.PI / 2); plane(240, 0.12, MAT.whiteLine, 0, 0.006, YARD_Z + 4, -Math.PI / 2);
      box(2 * X, 0.14, 0.3, MAT.trim, 0, 0.07, YARD_Z);
      buildSky({ clouds: 4, rainN: 800, snowN: 500 });
      traffic.x0 = -100; traffic.x1 = 100; trafficAdd(YARD_Z + 2.4, 1, 9); trafficAdd(YARD_Z + 5.6, -1, 7);
      buildProps();
      navSetup({ x0: -40, z0: -16, width: 80, depth: 48, cell: 0.5 });
    },
    tick: function (dt) { S.time += dt / 60; if (S.time >= 24) { S.time -= 24; S.day++; } hudDirty = hudDirty || Math.floor(S.time * 60) !== GAME.lastMin; GAME.lastMin = Math.floor(S.time * 60); },
    startStats: function (loaded) { return loaded ? ['Day ' + S.day, money(S.bank)] : ['The showcase', 'every pack prop to build with']; },
    guideHtml: function () { return '<p>The showcase hall: build with every pack prop in the Co Engine editor. Walk with WASD, look with the mouse, E uses what the dot is on.</p>'; },
    commands: { night: function () { S.time = 22; return 'night'; }, day: function () { S.time = 11; return 'day'; } },
    devState: function () { return { props: Object.keys(propInst).length }; },
    T: function () { return { GAME: GAME, HALL: HALL }; }
  };
  CO.setup({ canvas: 'co-canvas', save: 'co-showcase', game: GAME, spawn: { x: 0, z: 18, yaw: 0 }, sun: { box: 60, far: 160, mapSize: 2048, target: [0, 0, 4] }, lightBudget: 10 });
  CO.boot(GAME);
