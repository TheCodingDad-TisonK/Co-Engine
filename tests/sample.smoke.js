// The engine's own smoke: the sample room (tests/sample) on the engine's parts. Run by tests/smoke.js. No backslash-quote in the body.
'use strict';
module.exports = `
  ok(!!T.renderer && !!T.scene && !!T.camera && T.CO.ready === true, 'CO.setup made the renderer, the scene and the camera');
  await wait(400);
  ok(T.frames() > 3, 'the frame loop runs: ' + T.frames() + ' frames');
  ok(T.calls() > 0, 'the post pass drew the scene: ' + T.calls() + ' draw calls');
  ok(T.post.on === true && !!T.post.rt, 'the post pass is on with a render target');
  ok(T.lightBudget.n === 6, 'the light budget took the setup value');
  // state and settings
  ok(T.CO.save.key === 'co-sample-slot1' && T.loaded === false && S.bank === 500 && S.day === 1, 'a fresh save on slot 1 of the co-sample prefix: bank ' + S.bank);
  ok(T.SET.fov === 75 && T.SET.vol === 0.8 && T.camera.fov === 75, 'the settings defaults stand and the camera took the fov');
  T.pay(-10, 'a test'); ok(S.bank === 490 && S.ledger[0].n === -10 && S.ledger[0].why === 'a test' && S.stats.spent === 10, 'pay writes the bank, the ledger and the stats');
  // the palette and the sheets
  ok(Object.keys(T.MAT).length >= 50 && Object.keys(T.TEX).length >= 20 && Object.keys(T.NRM).length >= 10, 'the base palette stands: ' + Object.keys(T.MAT).length + ' materials, ' + Object.keys(T.TEX).length + ' textures, ' + Object.keys(T.NRM).length + ' normal maps');
  ok(T.MAT.hit.userData.noBake === true && T.MAT.screen.userData.noBake === true && T.MAT.exit.userData.noBake === true, 'the hit, screen and exit materials are flagged out of the bake');
  // the world kit
  ok(T.northSegs.length === 2 && T.northSegs[0][1] === 3 && T.northSegs[1][0] === 4.2, 'lineWall left the doorway out of the north lining');
  { const sc2 = T.spanCut(0, 10, [[3, 4], [9, 12]]); ok(sc2.length === 2 && sc2[0][1] === 3 && sc2[1][0] === 4 && sc2[1][1] === 9, 'spanCut takes the openings out of a span'); }
  ok(T.lampMeshes.length === 3, 'two troffers and a high bay put three lenses on the lamp list');
  ok(T.solids.some((s) => s.y1 === 2.6 && s.z0 > 13 && s.x1 - s.x0 > 27), 'the fence run left a solid the length of the run');
  ok(T.floorY(3, 3) === 0 && T.insideWalk(0, 0) === true && T.insideWalk(12, 0) === false, 'the floor and the walkable ground come from the game hooks');
  // props
  ok(!!T.propInst.crateStack && !!T.propInst.wallSign && !!T.propInst.panel && !T.propInst.xChair, 'the three props stand and the catalogue chair does not');
  ok(T.propPlacement('crateStack').x === -4 && T.solids.some((s) => s.prop === 'crateStack' && Math.abs(s.x0 - (-5.5)) < 0.01), 'a prop stands at its default spot with its solid in world space');
  ok(T.propInst.crateStack.g.children.some((o) => o.userData.noBake), 'a free-standing prop gets its ground blob');
  ok(!T.propInst.wallSign.g.children.some((o) => o.userData.noBake), 'a wall prop gets no blob');
  ok(T.propWorld('crateStack', 1, 0).x === -3 && T.propWorld('crateStack', 1, 0).z === 2, 'propWorld maps a local point');
  // build mode
  T.editToggle(); ok(T.edit.on === true, 'build mode on');
  T.editGrab('crateStack'); ok(T.edit.grabbed === 'crateStack' && !T.solids.some((s) => s.prop === 'crateStack') && T.propInst.crateStack.g.children.some((o) => o.userData.ghosted), 'grabbing lifts the solid and ghosts the prop');
  T.propInst.crateStack.g.position.set(2, 0, 2); T.editDrop(false);
  ok(!T.edit.grabbed && S.layout.crateStack.x === 2 && T.propPlacement('crateStack').x === 2 && T.solids.some((s) => s.prop === 'crateStack' && Math.abs(s.x0 - 0.5) < 0.01), 'dropping writes the layout and rebuilds the prop there');
  T.editRotate('crateStack'); { const sld = T.solids.filter((s) => s.prop === 'crateStack')[0]; ok(S.layout.crateStack.rot === 1 && Math.abs((sld.x1 - sld.x0) - 0.9) < 0.01 && Math.abs((sld.z1 - sld.z0) - 3.0) < 0.01, 'a quarter turn turns the solid with the prop'); }
  T.editReset('crateStack'); ok(!S.layout.crateStack && T.propPlacement('crateStack').x === -4, 'reset puts it back where it started');
  T.editRemove('crateStack'); ok(S.layout.crateStack.hidden === true && !T.propInst.crateStack && !T.solids.some((s) => s.prop === 'crateStack'), 'removing hides a built-in prop and lifts its solid');
  ok(T.catalogueData().hidden.indexOf('crateStack') >= 0 && T.catalogueData().groups.room.indexOf('xChair') >= 0, 'the catalogue data lists the removed prop and the chair');
  T.editRestore('crateStack'); ok(!!T.propInst.crateStack && !S.layout.crateStack.hidden, 'restore brings it back');
  { const bank0 = S.bank; const c = T.editBuy('xChair'); ok(!!c && S.custom.length === 1 && S.bank === bank0 - 40 && T.edit.grabbed === c.id && !!T.propInst[c.id], 'buying a catalogue prop charges, records and carries it');
    T.editDrop(false); ok(!T.edit.grabbed && !!T.propInst[c.id] && T.solids.some((s) => s.prop === c.id), 'dropping it places it with its solid');
    T.editRemove(c.id); ok(S.custom.length === 0 && !T.propInst[c.id] && S.bank === bank0 - 20, 'removing a bought prop sells it back for half'); }
  T.editToggle(); ok(T.edit.on === false && T.baked.draws > 0, 'build mode off bakes again');
  // the save round trip
  T.save(); { const raw = JSON.parse(localStorage.getItem('co-sample-slot1')); ok(raw.bank === S.bank && raw.ledger.length === S.ledger.length && typeof raw.savedAt === 'number', 'save wrote the slot'); }
  { const before = S.bank; const ok2 = T.loadSave(() => ({ day: 1, time: 9, bank: 1, level: 1, log: [], ledger: [], stats: { earned: 0, spent: 0 }, layout: {}, custom: [], hdoors: {}, extra: 7 })); ok(ok2 === true && S.bank === before && S.extra === 7, 'loadSave reads the slot back and fills a new key from the fresh state'); }
  // doors
  ok(T.hdoors.length === 1 && T.hd('north').open === false && T.door.t === 0, 'the north door starts closed');
  T.doorUse(T.door); ok(T.hd('north').open === true, 'E opens it'); for (let i = 0; i < 40; i++) T.doorsTick(0.1); ok(T.door.t > 0.9, 'and the leaf swings: t ' + T.door.t.toFixed(2));
  { const out = []; T.doorSolids(out); ok(out.length === 0, 'an open door blocks nothing'); }
  T.doorUse(T.door); for (let i = 0; i < 40; i++) T.doorsTick(0.1); { const out = []; T.doorSolids(out); ok(T.hd('north').open === false && T.door.t < 0.1 && out.length === 1, 'closed again, and it blocks the doorway'); }
  T.doorLock(T.door); ok(T.hd('north').locked === true, 'Shift+E locks'); T.doorUse(T.door); ok(T.hd('north').open === false, 'a locked door stays shut'); T.doorLock(T.door); ok(T.hd('north').locked === false, 'and unlocks');
  T.walkers.push({ x: 3.6, z: -10.5 }); for (let i = 0; i < 40; i++) T.doorsTick(0.1); ok(T.door.t > 0.9, 'a walker with keys has the door open for them'); T.walkers.length = 0; for (let i = 0; i < 40; i++) T.doorsTick(0.1); ok(T.door.t < 0.1, 'and it closes behind them');
  T.lockAll(true); ok(T.hd('north').locked === true && T.anyDoorUnlocked() === false, 'night mode locks every door'); T.lockAll(false); ok(T.anyDoorUnlocked() === true, 'and the morning unlocks them');
  ok(T.doorById('north') === T.door && T.doorById('nope') === null, 'doorById');
  // screens
  ok(T.screens.length === 1, 'the panel registered one touch screen');
  T.drawScreens(0.016); { const sc = T.screens[0]; ok(sc.zones.length === 2 && sc.zones[0].label === 'Press', 'drawing laid out two tap zones');
    const z = T.screenZoneAt(sc, 20, 90); ok(!!z && z.label === 'Press', 'a zone is found by logical coordinates'); T.screenTap(sc, z); ok(S.presses === 1 && sc.dirty === true, 'a tap runs the zone and dirties the screen');
    sc.dirty = false; T.screenDirtyAll(); ok(sc.dirty === true, 'screenDirtyAll'); }
  { const c2 = document.createElement('canvas').getContext('2d'); c2.font = '14px Arial'; const fit = T.scFit(c2, 'a very long line of text that will not fit', 60); ok(fit.length < 20 && /…$/.test(fit), 'scFit trims with an ellipsis'); }
  // navigation
  ok(T.navFreeAt(0, 0) === true && T.navFreeAt(-4, 2) === false && T.navFreeAt(12, 0) === false, 'the grid: open floor, the crate stack, outside the room');
  { const path = T.route({ x: -8, z: 2 }, { x: 0, z: 2 }); ok(path.length >= 2 && path[path.length - 1].x === 0, 'a route round the crate stack has a corner: ' + path.length + ' waypoints'); }
  { const path2 = T.route({ x: -8, z: 8 }, { x: 8, z: 8 }); ok(path2.length === 1, 'a clear run is one waypoint'); }
  { const rec = { x: 0, z: 0, yaw: 0 }, p = [{ x: 2, z: 0 }]; let done = false; for (let i = 0; i < 30 && !done; i++) done = T.walkAlong(rec, p, 1, 0.1); ok(done && Math.abs(rec.x - 2) < 1e-9 && Math.abs(rec.yaw - Math.PI / 2) < 0.2, 'walkAlong reaches the waypoint facing the way it went'); }
  ok(Math.abs(T.yawWrap(Math.PI * 3)) - Math.PI < 1e-9, 'yawWrap');
  // sound and the log
  T.sfx('ok'); T.sfx('nope'); ok(T.sfxCount() >= 1, 'sfx plays a voice and falls back to the click for an unknown one');
  T.toast('hello', 'good'); T.logEvent('something happened', 'rare'); ok(S.log[0].msg === 'something happened', 'logEvent writes the log without a feed element on the page');
  // the bake and the geometry, as before
  ok(T.baked.draws >= 2 && T.baked.hidden >= 20, 'the bake merged the walls and the crates: ' + T.baked.draws + ' draws from ' + T.baked.hidden + ' meshes');
  ok(T.door.leaf.visible === true && !T.door.leaf.userData.bakedAway, 'the door leaf stays out of the bake');
  ok(T.bevelGeo(1, 1, 1) === T.bevelGeo(1, 1, 1) && T.bevelGeo(1, 1, 1) !== T.boxGeo(1, 1, 1), 'a bevelled box is cached and differs from the sharp one');
  ok(T.bevelGeo(0.02, 1, 1) === T.boxGeo(0.02, 1, 1) && T.bevelGeo(1, 1, 5) === T.boxGeo(1, 1, 5), 'a sheet thinner than 30 mm and a run longer than 4 m stay sharp');
  ok(T.roundCylGeo(0.3, 0.3, 1).attributes.position.count > 100 && T.roundCylGeo(0.3, 0.3, 1) === T.roundCylGeo(0.3, 0.3, 1), 'a turned part gets eased rims and enough sides, and is cached');
  ok(T.roundCylGeo(0.01, 0.01, 1).attributes.position.count === new THREE.CylinderGeometry(0.01, 0.01, 1, 18).attributes.position.count, 'a wire is left alone');
  { const t = T.textTex(['HI'], { bg: '#1b232c' }); ok(t.image.width === 512 && t.image.height === 128, 'textTex draws a 512 by 128 plate by default'); }
  { const g2 = new THREE.Group(); T.CO.root = g2; const b = T.box(1, 1, 1, T.MAT.wood, 0, 0, 0); T.CO.root = null; ok(b.parent === g2, 'CO.root redirects the default parent'); }
  T.burst(0, 1, 0, 0xffffff, 10); ok(T.bursts.length === 1, 'a burst is live'); T.tickBursts(2); ok(T.bursts.length === 0, 'and gone after its life');
  ok(T.propSeed('a', 1) === T.propSeed('a', 1) && T.propSeed('a', 1) !== T.propSeed('b', 1), 'propSeed is the same every time and differs by id');
  ok(T.mixHex(0x000000, 0xffffff, 0.5) === 0x808080 && T.fmtTime(25.5) === '01:30' && T.money(-1234) === '-$1,234', 'colour, time and money helpers');
  { let n = 0; T.hook('smoke', () => { n += 1; }); T.hook('smoke', () => { throw new Error('boom'); }); T.hook('smoke', () => { n += 10; }); const ce = console.error; let logged = 0; console.error = () => { logged++; }; T.runHooks('smoke'); console.error = ce; ok(n === 11 && logged === 1, 'hooks run in order, a throwing one is logged and does not stop the next'); }
  T.resize(); ok(T.camera.aspect > 0, 'resize keeps the camera sane');
  info('draws ' + T.calls() + ', baked ' + T.baked.draws + ' from ' + T.baked.hidden + ', frames ' + T.frames() + ', solids ' + T.solids.length);
`;
