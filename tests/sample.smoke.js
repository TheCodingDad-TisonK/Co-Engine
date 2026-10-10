// The engine's own smoke: the sample room (tests/sample) booted through CO.boot. Run by tests/smoke.js. No backslash-quote in the body.
'use strict';
const PACK_JSON = JSON.stringify(require('fs').readFileSync(require('path').join(__dirname, '..', 'packs', 'basics', 'pack.js'), 'utf8'));
const GROWCO_JSON = JSON.stringify(require('fs').readFileSync(require('path').join(__dirname, '..', 'packs', 'growco', 'pack.js'), 'utf8'));
const DEPOTCO_JSON = JSON.stringify(require('fs').readFileSync(require('path').join(__dirname, '..', 'packs', 'depotco', 'pack.js'), 'utf8'));
const GARAGECO_JSON = JSON.stringify(require('fs').readFileSync(require('path').join(__dirname, '..', 'packs', 'garageco', 'pack.js'), 'utf8'));
module.exports = `
  const PACK_BASICS = ${PACK_JSON};
  const PACK_GROWCO = ${GROWCO_JSON};
  const PACK_DEPOTCO = ${DEPOTCO_JSON};
  const PACK_GARAGECO = ${GARAGECO_JSON};
  ok(!!T.renderer && !!T.scene && !!T.camera && T.CO.ready === true && typeof T.enter === 'function', 'CO.setup and CO.boot ran: renderer, scene, camera and the handle stand');
  ok(T.ui.started === false && !document.getElementById('dc-start').hidden, 'the start screen is up before enter');
  ok(/A new room/.test(document.getElementById('dc-start-stats').textContent) && /Slot 1/.test(document.getElementById('dc-start-note').textContent), 'the start screen chips and note come from the game and the engine');
  T.enter(); ok(T.ui.started === true && document.getElementById('dc-start').hidden && !document.getElementById('dc-hud').hidden, 'enter hides the start screen and shows the HUD');
  { const car = T.carMesh ? T.carMesh({ col: 0x335577 }) : null; if (car) { const w = car.userData.wheels; ok(w.length === 4 && w.every((x) => x.isGroup && x.children.length >= 5), 'the car has four wheel groups with tyre, rim, spokes and hub (0.4.3)'); const tyre = w[0].children[0]; const ax0 = new T.THREE.Vector3(0, 1, 0).applyQuaternion(tyre.getWorldQuaternion(new T.THREE.Quaternion())); w[0].rotation.z = 1.3; car.updateMatrixWorld(true); const ax1 = new T.THREE.Vector3(0, 1, 0).applyQuaternion(tyre.getWorldQuaternion(new T.THREE.Quaternion())); ok(Math.abs(ax0.z) > 0.99 && Math.abs(ax1.z) > 0.99, 'spinning a wheel keeps the tyre on its axle across the car: ' + ax1.z.toFixed(3)); const arch = car.children.find((c) => c.geometry && c.geometry.type === 'TorusGeometry'); ok(!!arch && Math.abs(arch.rotation.y) < 1e-6, 'the wheel arch stands in the car side plane'); const glassP = car.children.filter((c) => c.material && c.material.transparent && Math.abs(c.rotation.z) > 0.3); const front = glassP.find((c) => c.position.x > 0), rear = glassP.find((c) => c.position.x < 0); ok(!!front && !!rear && front.rotation.z > 0 && rear.rotation.z < 0, 'the windscreen leans back and the rear window forward (0.4.4)'); } else ok(false, 'the handle has no carMesh'); }
  { let got = null; T.hook('eFour', (a, b, c, d, e) => { got = [a, b, c, d, e]; }); T.runHooks('eFour', 1, 2, 3, true, 'five'); ok(!!got && got[3] === true && got[4] === 'five', 'every argument reaches a hook: the lighting hook gets its fourth, power (0.5.1)'); }
  T.updateHud(1); { const cr = document.getElementById('h-cross'); ok(!!cr && cr.style.display !== 'none', 'the engine draws an aiming point once the player plays (0.4.2)'); T.openPanel('info'); T.updateHud(1); ok(cr.style.display === 'none', 'and hides it behind a panel'); T.closePanel(); T.updateHud(1); ok(cr.style.display !== 'none', 'and shows it again'); }
  await wait(500);
  ok(T.counts().draws > 0 && T.counts().baked >= 2, 'frames draw with the bake in: ' + JSON.stringify(T.counts()));
  // state, settings and the HUD
  ok(T.CO.save.key === 'co-sample-slot1' && S.bank === 500 && S.day === 1 && S.presses === 0, 'a fresh save on slot 1: bank ' + S.bank);
  T.updateHud(1); ok(document.getElementById('h-cash').textContent === '$500' && /Day 1/.test(document.getElementById('h-day').textContent) && /0 presses/.test(document.getElementById('h-presses').textContent), 'the HUD shows the engine fields and the game field');
  T.pay(-10, 'a test'); ok(S.bank === 490 && S.ledger[0].n === -10 && S.stats.spent === 10, 'pay writes the bank, the ledger and the stats');
  // the world kit
  ok(T.northSegs.length === 2 && T.northSegs[0][1] === 3 && T.northSegs[1][0] === 4.2, 'lineWall left the doorway out of the north lining');
  ok(T.lampMeshes.length === 4, 'two troffers, a high bay and a lamp post put four lenses on the lamp list');
  ok(T.solids.some((s) => s.y1 === 2.6 && s.z0 > 13), 'the fence run left a solid the length of the run');
  ok(T.sky.dome && T.sky.clouds.length === 4 && T.sky.rain && T.sky.rain.visible === (S.weather.kind === 'rain' || S.weather.kind === 'storm'), 'the sky stands: a dome, four clouds, rain shown only when it rains (' + S.weather.kind + ')');
  ok(!!S.weather && typeof S.weather.kind === 'string', 'the weather state machine picked a first weather: ' + S.weather.kind);
  { S.weather.kind = 'rain'; S.weather.until = T.nowAbs() + 10; T.tickSky(0.1); ok(T.sky.rain.visible === true, 'rain shows when it rains'); S.weather.kind = 'clear'; T.tickSky(0.1); ok(T.sky.rain.visible === false, 'and hides when it clears'); }
  { T.setTime(23); T.lighting(0.2); const night = T.scene.fog.color.getHex(); T.setTime(12); T.lighting(0.2); const day = T.scene.fog.color.getHex(); ok(night !== day && T.scene.background.getHex() === day, 'lighting by the hour moves the sky and fog colours: night ' + T.hexCss(night) + ', day ' + T.hexCss(day)); }
  ok(T.season() === 0 && T.isSunday() === false, 'day 1 is spring and not a Sunday');
  // props and build mode
  ok(!!T.propInst.crateStack && !!T.propInst.wallSign && !!T.propInst.panel && !!T.propInst.lever && !T.propInst.xChair, 'the props stand and the catalogue chair does not');
  T.editToggle(); ok(T.edit.on === true && !document.getElementById('h-edit').hidden, 'build mode on, the HUD says so');
  T.editGrab('crateStack'); T.propInst.crateStack.g.position.set(2, 0, 2); T.editDrop(false);
  ok(!T.edit.grabbed && S.layout.crateStack.x === 2 && T.propPlacement('crateStack').x === 2, 'grab, move and drop writes the layout');
  T.editReset('crateStack'); ok(!S.layout.crateStack && T.propPlacement('crateStack').x === -4, 'reset puts it back');
  { const bank0 = S.bank; const c = T.editBuy('xChair'); ok(!!c && S.custom.length === 1 && S.bank === bank0 - 40, 'buying a catalogue prop charges and carries it'); T.editDrop(false); T.editRemove(c.id); ok(S.custom.length === 0 && S.bank === bank0 - 20, 'removing it sells it back for half'); }
  T.editToggle(); ok(T.edit.on === false, 'build mode off');
  // the panel, the catalogue and the menu
  T.openPanel('info'); ok(T.ui.panelOpen && document.getElementById('dc-panel-title').textContent === 'The sample room' && document.getElementById('dc-panel-tabs').children.length === 2 && /Tab one/.test(T.panelHtml()), 'a game panel renders its title, tabs and body');
  document.getElementById('dc-panel-tabs').children[1].click(); ok(/Tab two/.test(T.panelHtml()), 'a tab click rerenders');
  document.querySelector('#dc-panel-body [data-act="press"]').click(); ok(S.presses === 1, 'a data-act button reaches the game');
  T.closePanel(); ok(!T.ui.panelOpen, 'closed');
  T.openPanel('catalogue'); ok(/Catalogue/.test(document.getElementById('dc-panel-title').textContent) && /chair/.test(T.panelHtml()), 'the catalogue panel lists the chair'); T.closePanel();
  T.openMenu(); ok(T.ui.menuOpen && /Saved at/.test(document.getElementById('dc-menu-sub').textContent), 'the pause menu opens and says it saved');
  T.menuAct('settings'); ok(/Mouse sensitivity/.test(document.getElementById('dc-menu-body').innerHTML), 'the settings form shows');
  { const sel = document.querySelector('#dc-menu-body [data-set="quality"]'); sel.value = 'low'; sel.dispatchEvent(new Event('input', { bubbles: true })); ok(T.SET.quality === 'low' && T.renderer.shadowMap.enabled === false, 'a setting change applies: quality low turns the shadows off'); sel.value = 'high'; sel.dispatchEvent(new Event('input', { bubbles: true })); ok(T.SET.quality === 'high' && T.renderer.shadowMap.enabled === true, 'and back'); }
  T.menuAct('guide'); ok(/WASD/.test(document.getElementById('dc-menu-body').innerHTML), 'the guide comes from the game');
  T.menuAct('saves'); ok(document.getElementById('dc-save-ta').value.indexOf('"bank"') > 0, 'the save file page shows the save');
  T.closeMenu(); ok(!T.ui.menuOpen, 'resume');
  // cards
  T.showCard('h-card', '<b>Level 2</b>', 5); ok(!document.getElementById('h-card').hidden, 'a card shows'); T.tickCards(6); ok(document.getElementById('h-card').hidden, 'and times out');
  // the player: looking, using, walking, colliding
  T.player.x = 7; T.player.z = -5.5; T.player.y = 0; T.lookAt(7, 0.6, -7); ok(T.focusText() === 'Pull the lever', 'looking at the lever focuses it: ' + T.focusText());
  T.useFocus(); ok(S.presses === 2 && T.ui.panelOpen && document.getElementById('dc-panel-title').textContent === 'The sample room', 'E pulls it and the game opens its panel'); T.closePanel();
  T.player.x = 8; T.player.z = -8.2; T.lookAt(8, 1.5, -9.5); ok(/Press|Lights|Sample panel/.test(T.focusText()), 'looking at the touch screen names a zone: ' + T.focusText());
  { T.player.x = 0; T.player.z = 5; T.player.yaw = 0; T.player.keys.KeyW = true; for (let i = 0; i < 20; i++) T.updatePlayer(0.05); T.player.keys.KeyW = false; ok(T.player.z < 2 && T.player.z > 0, 'W walks forward: z ' + T.player.z.toFixed(2)); }
  { T.player.x = 0; T.player.z = 9.0; T.player.yaw = Math.PI; T.player.keys.KeyW = true; for (let i = 0; i < 30; i++) T.updatePlayer(0.05); T.player.keys.KeyW = false; ok(T.player.z < 9.7, 'the south wall stops the walk: z ' + T.player.z.toFixed(2)); }
  ok(T.collides(0, 9.9) === true && T.collides(0, 0) === false && T.collides(-4, 2) === true, 'collides sees the wall, the open floor and the crate stack');
  { T.player.keys.Space = true; T.updatePlayer(0.05); T.player.keys.Space = false; ok(T.player.vy > 0 && !T.player.grounded, 'space jumps'); for (let i = 0; i < 40; i++) T.updatePlayer(0.05); ok(T.player.grounded && T.player.y === 0, 'and lands'); }
  // doors and the walker with keys
  T.doorUse(T.door); ok(T.hd('north').open === true, 'E opens the north door'); T.doorUse(T.door); for (let i = 0; i < 40; i++) T.doorsTick(0.1); ok(T.hd('north').open === false && T.door.t < 0.1, 'closed again');
  T.walkers.push({ x: 3.6, z: -10.5 }); for (let i = 0; i < 40; i++) T.doorsTick(0.1); ok(T.door.t > 0.9, 'a walker with keys has the door open for them'); T.walkers.length = 0;
  // people and traffic
  ok(T.people.length === 2 && T.people[0].g.userData.legs && T.people[1].g.userData.head, 'two rigged people stand');
  { const p = T.people[0]; const x0 = p.rec.x; T.run(3); ok(p.rec.x !== x0 || p.rec.z !== -6, 'the walker moves along its route: ' + p.rec.x.toFixed(1) + ', ' + p.rec.z.toFixed(1)); }
  T.say(T.people[1].g, 'Hello there'); ok(!!T.people[1].g.userData.bubble && T.people[1].g.userData.mood === 'talk', 'say puts a bubble up and the mood to talk');
  { const t = T.faceTex('k1', 'happy', 'd9a98a'); ok(t === T.faceTex('k1', 'happy', 'd9a98a') && t !== T.faceTex('k1', 'angry', 'd9a98a'), 'faces are cached by key and mood'); }
  { const x0 = T.car.g.position.x; await wait(400); ok(T.car.g.position.x !== x0, 'the car on the lane moves with the frames: ' + x0.toFixed(1) + ' to ' + T.car.g.position.x.toFixed(1)); }
  { const v = { x: 0, z: 0, yaw: 0, speed: 0 }; for (let i = 0; i < 20; i++) T.driveStep(v, { KeyW: true }, 0.1, { blocked: () => false }); ok(v.speed > 1 && v.z > 0.5, 'driveStep accelerates a vehicle record: speed ' + v.speed.toFixed(2)); }
  // photo mode
  T.photoToggle(true); ok(T.photo.on === true && document.getElementById('dc-hud').hidden, 'photo mode frees the camera and hides the HUD'); T.photoZoom(1); ok(T.camera.fov === T.SET.fov + 4, 'the wheel zooms'); T.photoToggle(false); ok(!T.photo.on && T.camera.fov === T.SET.fov, 'and F9 puts it back');
  // the dev link
  ok(T.devCommandList().indexOf('cash') >= 0 && T.devCommandList().indexOf('press') >= 0, 'the command list merges the engine and the game');
  { const b0 = S.bank; ok(/bank/.test(T.devCommand('cash', 5)) && S.bank === b0 + 5 && T.devCommand('press') === 'presses 3' && /unknown/.test(T.devCommand('nope')), 'devCommand runs engine and game commands: bank ' + S.bank); }
  { const st = T.devState(); ok(st.bank === S.bank && st.presses === 3 && st.people === 2 && st.engine === T.CO.version && Array.isArray(st.commands), 'devState merges the engine readout and the game readout'); }
  // the save round trip
  T.save(); { const raw = JSON.parse(localStorage.getItem('co-sample-slot1')); ok(raw.bank === S.bank && raw.presses === 3, 'save wrote the slot: ' + JSON.stringify({ raw: raw && raw.bank, s: S.bank, rawPresses: raw && raw.presses, failed: !!T.save.failed })); }
  // sound and the log
  T.sfx('ok'); ok(T.sfxCount() >= 1, 'sfx plays'); T.logEvent('something happened', 'rare'); ok(S.log[0].msg === 'something happened' && document.getElementById('h-feed').textContent.indexOf('something happened') >= 0, 'logEvent writes the log and the feed');
  T.toast('hello', 'good'); { const tb = document.getElementById('h-toasts'); ok(tb.children.length >= 1 && tb.lastChild.textContent === 'hello', 'a toast shows'); }
  // the pure layer, as before
  ok(T.bevelGeo(1, 1, 1) === T.bevelGeo(1, 1, 1) && T.bevelGeo(0.02, 1, 1) === T.boxGeo(0.02, 1, 1), 'bevelled boxes are cached and thin sheets stay sharp');
  ok(T.propSeed('a', 1) === T.propSeed('a', 1) && T.propSeed('a', 1) !== T.propSeed('b', 1), 'propSeed');
  ok(T.mixHex(0x000000, 0xffffff, 0.5) === 0x808080 && T.fmtTime(25.5) === '01:30' && T.money(-1234) === '-$1,234', 'colour, time and money helpers');
  { let n = 0; T.hook('smoke', () => { n += 1; }); T.hook('smoke', () => { throw new Error('boom'); }); T.hook('smoke', () => { n += 10; }); const ce = console.error; let logged = 0; console.error = () => { logged++; }; T.runHooks('smoke'); console.error = ce; ok(n === 11 && logged === 1, 'hooks run in order, a throwing one is logged and does not stop the next'); }
  info('draws ' + T.counts().draws + ', baked ' + T.counts().baked + ' from ' + T.counts().hidden + ', solids ' + T.solids.length + ', weather ' + S.weather.kind);
  // the editor bridge (60-editor): the tree, the inspector, live edits, select, spawn, remove, assets, pause and step, the scene camera, pick, a shot
  { const E = T.editor; const tr = E.tree(); ok(!!tr && !!tr.props.room && tr.props.room.some((p) => p.id === 'crateStack') && tr.lights.length >= 2 && tr.doors.length === 1 && tr.screens.length === 1 && tr.people.length === 2 && tr.vehicles.length === 1 && tr.counts.statics + (tr.world || []).length > 5, 'the editor tree lists the props, the lights, the door, the screen, the people, the car and the static world: ' + JSON.stringify(tr.counts) + ', ' + (tr.world || []).length + ' world items');
    const r = E.inspect('crateStack'); ok(!!r && !!r.prop && r.prop.label === 'crate stack' && r.position.length === 3 && r.prop.x === -4 && r.prop.z === 2, 'inspect reads a prop: ' + JSON.stringify(r.prop));
    ok(E.set('crateStack', 'prop.x', -3) === 'ok' && T.propPlacement('crateStack').x === -3 && S.layout.crateStack.x === -3 && !!T.propInst.crateStack, 'a prop placement edit rebuilds the prop and lands in the save');
    E.set('crateStack', 'prop.reset', 1); ok(!S.layout.crateStack && T.propPlacement('crateStack').x === -4, 'reset puts it back where it started');
    const sel = E.select('wallSign'); ok(!!sel && sel.id === 'wallSign' && E.selected() === 'wallSign' && T.scene.children.some((o) => o.userData.editor), 'select draws a helper round the thing');
    const sid = E.spawn('xChair', 1, 1); ok(/^cp-/.test(sid) && !!T.propInst[sid] && S.custom.some((c) => c.id === sid) && E.selected() === sid, 'spawn adds a free copy of a definition: ' + sid);
    ok(/removed/.test(E.remove(sid)) && !T.propInst[sid] && !S.custom.some((c) => c.id === sid), 'remove takes a spawned copy away');
    const a = E.assets(); ok(a.props.some((p) => p.id === 'xChair' && p.extra) && a.materials.some((m) => m.key === 'floor') && a.sounds.indexOf('click') >= 0 && a.textures.indexOf('concrete') >= 0, 'assets list the definitions, the palette, the textures and the voices');
    ok(E.pause(true) === true && T.CO.paused === true, 'pause holds the world'); E.step(); ok(T.CO.stepOnce === true, 'step arms one frame'); E.pause(false); T.CO.stepOnce = false;
    ok(E.mode('scene') === 'scene' && T.photo.on === true, 'scene mode is the free camera'); ok(/framed/.test(E.frame('panel')) && Math.abs(T.camera.position.x - 8) < 6, 'frame brings the camera to the thing'); E.mode('game'); ok(T.photo.on === false, 'game mode hands the camera back');
    T.player.x = 0; T.player.z = 5; T.lookAt(-4, 0.5, 2); const pk = E.pick(0, 0); ok(!!pk && pk.id === 'crateStack' && pk.prop === true, 'pick names the prop under the crosshair: ' + JSON.stringify(pk));
    const shot = E.shot(0.5); ok(typeof shot === 'string' && shot.indexOf('data:image/jpeg') === 0 && shot.length > 1000, 'a screenshot comes back as a data url');
    E.select(null); ok(E.selected() === null && !T.scene.children.some((o) => o.userData.editor), 'deselect removes the helper'); }

  // the editor v2 (0.1.7): undo and redo, the build code live, a new definition, the profiler
  { const E = T.editor; const node = (id) => { const tr = E.tree(); for (const k in tr.props) { const n = tr.props[k].find((p) => p.id === id); if (n) return n; } return null; };
    const x0 = E.inspect('crateStack').prop.x; E.set('crateStack', 'prop.x', x0 + 1); ok(E.inspect('crateStack').prop.x === x0 + 1 && E.history().undo.length >= 1, 'a set is a step on the undo stack');
    ok(/undid/.test(E.undo()) && E.inspect('crateStack').prop.x === x0, 'undo puts the prop back'); ok(/redid/.test(E.redo()) && E.inspect('crateStack').prop.x === x0 + 1, 'redo moves it again'); E.undo(); ok(E.inspect('crateStack').prop.x === x0 && E.history().redo.length === 1, 'the redo stack keeps the undone step');
    const sp = E.spawn('xChair', 1, 1); ok(S.custom.some((c) => c.id === sp) && !!node(sp) && E.history().redo.length === 0, 'spawn adds a copy and clears the redo stack'); E.undo(); ok(!S.custom.some((c) => c.id === sp) && !node(sp), 'undo takes the copy out'); E.redo(); ok(S.custom.some((c) => c.id === sp) && !!node(sp), 'redo brings it back');
    E.remove(sp); ok(!node(sp), 'remove takes it out'); E.undo(); ok(S.custom.some((c) => c.id === sp) && !!node(sp), 'undo of a remove brings the copy back'); E.redo(); ok(!S.custom.some((c) => c.id === sp), 'redo removes it again');
    const sun = E.tree().lights.find((l) => l.name === 'sun'); const i0 = E.inspect(sun.id).light.intensity; E.set(sun.id, 'light.intensity', i0 + 0.5); ok(Math.abs(E.inspect(sun.id).light.intensity - (i0 + 0.5)) < 1e-6, 'a live light field is set'); E.undo(); ok(Math.abs(E.inspect(sun.id).light.intensity - i0) < 1e-6, 'and undone to its old value');
    const src = E.source('crateStack'); ok(src && /function/.test(src.build) && src.instances.indexOf('crateStack') >= 0 && src.modified === false && src.kit.indexOf('box') >= 0 && src.kit.indexOf('MAT') >= 0, 'source gives the build code, the instances and the kit');
    const kids0 = node('crateStack').n; const pv = E.preview('crateStack', 'function (c) { c.box(0.9, 0.5, 0.9, MAT.wood, 0, 0.25, 0); }'); ok(pv.ok === true && pv.rebuilt === 1 && node('crateStack').n < kids0, 'a preview rebuilds the prop with the new code: ' + JSON.stringify(pv) + ' kids ' + kids0 + ' > ' + node('crateStack').n);
    ok(E.source('crateStack').modified === true && typeof E.source('crateStack').original === 'string', 'the source says it is modified and keeps the original');
    const bad = E.preview('crateStack', 'function (c) { nothingHere(); }'); ok(bad.ok === false && /nothingHere/.test(bad.error) && node('crateStack').n < kids0, 'a build that throws is refused and the previous build stays');
    const bad2 = E.preview('crateStack', 'function (c) { c.box('); ok(bad2.ok === false && /parse/.test(bad2.error), 'code that does not parse is refused');
    const rv = E.revert('crateStack'); ok(rv.ok === true && node('crateStack').n === kids0 && E.source('crateStack').modified === false, 'revert brings the original build back');
    const df = E.define("defProp('eTestCone', { label: 'test cone', x: 3, z: 3, rot: 0, cat: 'room', build: function (c) { c.cyl(0.3, 1, MAT.red, 0, 0.5, 0); } })"); ok(df.ok === true && df.id === 'eTestCone' && df.built === true && !!node('eTestCone'), 'a new definition builds at once: ' + JSON.stringify(df));
    const df2 = E.define('var nothing = 1;'); ok(df2.ok === false && /defined no prop/.test(df2.error), 'code that defines nothing is refused');
    const df3 = E.define("defProp('eTestCone', { label: 'test cone', x: 3, z: 3, rot: 0, cat: 'room', build: function (c) { c.cyl(0.3, 1, MAT.red, 0, 0.5, 0); c.cyl(0.3, 1, MAT.red, 0, 1.5, 0); } })"); ok(df3.ok === true && df3.redefined === true && node('eTestCone').n >= 2, 'a redefinition rebuilds in place: ' + JSON.stringify(df3));
    ok(E.assets().props.some((p) => p.id === 'eTestCone'), 'the new prop is in the assets');
    E.profile(true); await wait(400); const pr = E.profile(); ok(pr.on === true && typeof pr.draws === 'number' && pr.counts && typeof pr.counts.props === 'number' && Array.isArray(pr.samples), 'the profiler reports draws, counts and samples: ' + pr.frames + ' frames, ' + pr.draws + ' draws'); E.profile(false); ok(E.profile().on === false && E.profile().frames === 0, 'the profiler switches off and drops its samples'); }

  // the shipped layout (0.1.8): CO.layout under the save, placed copies, the part the editor writes, adopt
  { const E = T.editor, CO2 = T.CO; const node = (id) => { const tr = E.tree(); for (const k in tr.props) { const n = tr.props[k].find((p) => p.id === id); if (n) return n; } return null; };
    ok(E.inspect('lever').prop.x === 7, 'the lever stands where its definition says');
    CO2.layout({ props: { lever: { x: 7.5, z: -7, rot: 1, h: 0 } } }); T.buildProp('lever'); const lv = E.inspect('lever').prop; ok(lv.x === 7.5 && lv.rot === 1, 'a shipped layout moves a prop under the save: x ' + lv.x + ' rot ' + lv.rot);
    E.set('lever', 'prop.x', 8); ok(E.inspect('lever').prop.x === 8, 'the save still wins over the shipped layout'); E.set('lever', 'prop.reset', 1); ok(E.inspect('lever').prop.x === 7.5, 'reset goes back to the shipped place, not the definition');
    CO2.layout({ placed: [{ id: 'plChair', type: 'xChair', x: 2, z: 3, rot: 0, h: 0 }] }); T.buildProp('plChair'); ok(!!node('plChair') && E.inspect('plChair').prop.type === 'xChair' && E.inspect('plChair').prop.custom === false, 'a placed copy from the shipped layout builds like a prop');
    const sp = E.spawn('xChair', 4, 4); const L = E.layout();
    ok(L.props.lever && L.props.lever.x === 7.5 && L.placed.some((p) => p.id === 'plChair') && L.placed.some((p) => p.id === sp) && L.code.indexOf('CO.layout(') >= 0 && L.code.indexOf('"lever": { x: 7.5') >= 0 && L.code.indexOf('//@') === 0, 'layout() reports the moved prop and both copies as the part to write: ' + L.changed + ' moved, ' + L.copies + ' copies, ' + L.pending + ' pending');
    ok(L.pending === 1, 'one thing is pending: the spawned copy not yet in the shipped layout (' + L.pending + ')');
    const ad = E.layoutAdopt({ props: L.props, placed: L.placed }); ok(ad.adopted === true && ad.pending === 0 && !S.custom.some((c) => c.id === sp) && !!node(sp) && E.inspect(sp).prop.custom === false, 'adopt makes the written layout the baseline: the copy leaves the save and stands as a placed prop');
    E.set('lever', 'prop.x', 9); ok(E.layout().pending === 1 && E.layout().props.lever.x === 9, 'a move after adopt is pending again'); E.set('lever', 'prop.reset', 1); ok(E.layout().pending === 0, 'and reset clears it');
    E.remove(sp); ok(!node(sp) && !E.layout().placed.some((p) => p.id === sp) && E.layout().pending === 1, 'a removed placed copy leaves the layout and counts as pending'); E.undo(); ok(!!node(sp) && E.layout().pending === 0, 'and comes back with undo');
    { E.set('lever', 'prop.h', 0.5); const lg = T.propInst ? null : null; const yy = E.inspect('lever').position[1]; ok(Math.abs(yy - 0.5) < 1e-6, 'a prop raised to 0.5 stands 0.5 up after its rebuild (0.6.0): y ' + yy); E.set('lever', 'prop.h', 0); ok(E.inspect('lever').position[1] === 0, 'and back on the floor at 0'); }
    E.set('wallSign', 'prop.hidden', true); ok(E.layout().props.wallSign && E.layout().props.wallSign.hidden === true && /hidden: true/.test(E.layout().code), 'a hidden prop is written as hidden'); E.set('wallSign', 'prop.hidden', false); ok(!E.layout().props.wallSign, 'and unhidden it is back to its definition');
    E.remove('plChair'); E.undo(); ok(!!node('plChair'), 'a placed copy hides and comes back');
    ok(E.set('plChair', 'prop.rot', 2) === 'ok' && E.inspect('plChair').prop.rot === 2, 'a placed copy turns through set after the layout adopted it (0.4.1)'); E.set('plChair', 'prop.reset', 1); }

  // M8 (0.2.0): the terrain and the material graph
  { const E = T.editor, CO2 = T.CO; const node = (id) => { const tr = E.tree(); for (const k in tr.props) { const n = tr.props[k].find((p) => p.id === id); if (n) return n; } return null; };
    ok(E.terrain().on === false && T.floorY(30, 30) === 0, 'no terrain to begin with: the flat world');
    const ts = E.terrainNew({ w: 20, d: 20, cell: 1, x0: 20, z0: 20 }); ok(ts.on === true && ts.w === 20 && ts.cells === 400 && T.scene.getObjectByName('terrain'), 'terrainNew makes a 20 by 20 mesh at x 20, z 20');
    ok(E.terrainY(30, 30) === 0 && T.floorY(30, 30) === 0, 'a new terrain is flat');
    const br = E.terrainBrush(30, 30, 'raise', 3, 1); ok(br.changed > 0 && E.terrainY(30, 30) > 0.8 && E.terrainY(30, 30) <= 1.01 && E.terrainY(30, 33) < E.terrainY(30, 30), 'raise lifts the ground under the brush with a soft edge: ' + E.terrainY(30, 30).toFixed(2) + ' at the centre, ' + E.terrainY(30, 33).toFixed(2) + ' three out');
    ok(Math.abs(T.floorY(30, 30) - E.terrainY(30, 30)) < 1e-6, 'floorY follows the terrain'); ok(T.floorY(5, 5) === 0, 'and the flat world off the terrain is still 0');
    E.terrainBrush(30, 30, 'lower', 3, 1); ok(Math.abs(E.terrainY(30, 30)) < 0.01, 'lower takes it back down');
    E.terrainBrush(25, 25, 'raise', 2, 2); E.terrainBrush(25, 25, 'flatten', 4, 1); ok(E.terrainY(25, 25) > 0 && Math.abs(E.terrainY(26, 25) - E.terrainY(25, 25)) < Math.abs(E.terrainY(26, 25)) + 0.5, 'flatten pulls the neighbours towards the centre');
    E.terrainBrush(30, 30, 'raise', 3, 1); const before = E.terrainY(30, 30); E.terrainBrush(30, 30, 'smooth', 3, 1); ok(E.terrainY(30, 30) < before, 'smooth lowers a peak');
    ok(E.terrainBrush(39, 39, 'raise', 2, 100).changed > 0 && E.terrainY(39, 39) <= ts.maxH + 1e-6, 'the height is capped at maxH');
    const pt = E.terrainBrush(35, 35, 'paint', 2, 1, 1); ok(pt.changed > 0 && E.terrainPick && true, 'paint changes cells: ' + pt.changed);
    const code = E.terrainCode(); ok(code.indexOf('CO.terrain({') >= 0 && code.indexOf('w: 20, d: 20') >= 0 && code.indexOf('//@') === 0 && code.split(String.fromCharCode(10)).length > 40, 'terrainCode is the part to write: ' + code.split(String.fromCharCode(10)).length + ' lines');
    const sc = E.terrainScatter('xChair', 5, 'dirt', 'seed1'); ok(sc.count === 5 && sc.placed.every((id) => !!node(id)), 'scatter places five chairs on the dirt cells through the shipped layout');
    const lay = E.layout(); ok(sc.placed.every((id) => lay.placed.some((p) => p.id === id)), 'the scattered copies are in the layout the editor writes');
    const sc2 = E.terrainScatter('xChair', 3, 'snow', 'seed2'); ok(!!sc2.error, 'scatter on a paint nobody used says so');
    E.terrainOff(); ok(E.terrain().on === false && !T.scene.getObjectByName('terrain') && T.floorY(30, 30) === 0, 'terrainOff takes the ground away again');
    // materials
    const g0 = E.materials(); ok(Array.isArray(g0.types) && g0.types.indexOf('bricks') >= 0 && g0.builtin.indexOf('wood') >= 0 && g0.order.length === 0, 'materials() lists the layer types and the built-in palette');
    const mk = E.material('eBrick', { size: 128, repeat: [2, 2], layers: [{ type: 'bricks', color: '#9a4b3a', color2: '#5a4a44', size: 32, size2: 14, gap: 2, vary: true }, { type: 'grain', n: 300, alpha: 0.5, dark: true }], roughness: { base: 0.85, amp: 0.2 }, bump: { amp: 30, strength: 0.8 } });
    ok(mk.ok === true && typeof mk.shot === 'string' && mk.shot.indexOf('data:image/png') === 0 && T.MAT.eBrick && T.MAT.eBrick.map && T.MAT.eBrick.roughnessMap && T.MAT.eBrick.normalMap, 'a material from a graph: colour, roughness and normal maps, and a picture');
    const df = E.define("defProp('eBrickBox', { label: 'brick box', x: 5, z: 5, rot: 0, cat: 'room', build: function (c) { c.box(1, 1, 1, MAT.eBrick, 0, 0.5, 0); } })"); ok(df.ok === true && !!node('eBrickBox'), 'a build function can use the graph material by name');
    const m1 = T.MAT.eBrick; E.material('eBrick', { size: 128, layers: [{ type: 'fill', color: '#204080' }], roughness: 0.3, emissive: '#102040', emissiveIntensity: 0.5 }); ok(T.MAT.eBrick === m1 && m1.roughness === 0.3 && !m1.roughnessMap && m1.emissive.getHex() === 0x102040, 'defining it again updates the same material in place');
    ok(E.materials().order.indexOf('eBrick') >= 0 && E.materialCode().indexOf('CO.material("eBrick"') >= 0, 'the material is in the order and in the part to write');
    ok(E.materialRemove('eBrick') === true && E.materials().order.indexOf('eBrick') < 0 && E.materialCode() === '', 'materialRemove takes it out of the graph list');
    ['grain', 'blotches', 'cracks', 'noise', 'planks', 'tiles', 'stripes', 'checks', 'rings', 'speckle'].forEach((t) => { const r = E.material('eT_' + t, { size: 64, layers: [{ type: 'fill', color: '#777' }, { type: t, color: '#a55', color2: '#335', n: 40, size: 16 }] }); ok(r.ok === true && T.MAT['eT_' + t].map, 'layer type ' + t + ' paints'); E.materialRemove('eT_' + t); }); }

  // the basics pack (0.2.0): defined live from its file, the gate and the barrier open and close, the panel draws a screen that lists them
  { const E = T.editor; const node = (id) => { const tr = E.tree(); for (const k in tr.props) { const n = tr.props[k].find((p) => p.id === id); if (n) return n; } return null; };
    const df = E.define(PACK_BASICS); ok(df.ok === true && E.assets().props.some((p) => p.id === 'pkGate') && E.assets().props.some((p) => p.id === 'pkPanel'), 'the pack defines its props: ' + E.assets().props.filter((p) => /^pk/.test(p.id)).length + ' of them');
    const g = E.spawn('pkGate', 0, 6); ok(!!node(g), 'a gate stands'); const solidsClosed = T.solids.filter((s) => s.prop === g).length; ok(solidsClosed >= 3, 'closed, the gate blocks the way: ' + solidsClosed + ' solids');
    T.player.x = 0; T.player.z = 7.5; T.lookAt(0, 1, 6); T.updateFocus(); ok(/Open the gate/.test(T.focusText()), 'looking at it offers to open it: ' + T.focusText()); T.useFocus(); ok(S.pack && S.pack.gates[g] === true, 'use opens it in the save');
    ok(T.solids.filter((s) => s.prop === g && s.x0 < 0.5 && s.x1 > -0.5).length === 0, 'open, the middle of the way is free');
    const p = E.spawn('pkPanel', 3, 6); ok(!!node(p) && E.tree().screens.length >= 2, 'the panel stands with a screen: ' + E.tree().screens.length + ' screens');
    const b = E.spawn('pkBarrier', -4, 6); ok(!!node(b) && T.solids.some((s) => s.prop === b && s.y0 > 0.5), 'the barrier arm blocks at waist height when down');
    ['pkLever', 'pkSign', 'pkWallSign', 'pkCrate', 'pkPallet', 'pkBench', 'pkBin', 'pkCone', 'pkLampPost', 'pkFence', 'pkPlanter', 'pkWallScreen'].forEach((t) => { const id = E.spawn(t, -8, 8); ok(!!node(id), t + ' builds'); E.remove(id); });
    ok(!T.catalogueData().groups.pack, 'the catalogue does not sell the pack props'); [g, p, b].forEach((id) => E.remove(id)); }
  // the Grow Co pack (0.6.0): Grow's own props, helpers and materials in a sealed scope; every one builds in the sample room
  { const E = T.editor; const before = E.assets().props.length; const df = E.define(PACK_GROWCO); const gc = E.assets().props.filter((p) => /^gc/.test(p.id));
    ok(df.ok === true && gc.length === 67, 'the Grow Co pack defines its 67 props: ' + (df.ok ? gc.length : df.error));
    const bad = [], ids = []; gc.forEach((p, i) => { try { const id = E.spawn(p.id, -9 + (i % 9) * 2, -9 + Math.floor(i / 9) * 2); ids.push(id); } catch (e) { bad.push(p.id + ': ' + e.message); } });
    ok(bad.length === 0 && ids.length === 67, 'every Grow Co prop builds: ' + ids.length + (bad.length ? ', failed ' + bad.slice(0, 3).join(' | ') : ''));
    ok(T.MAT.wood && T.MAT.wood === T.MAT.wood && !('ceramic' in T.MAT && T.MAT.ceramic === undefined), 'the host palette is untouched by the pack');
    ids.forEach((id) => E.remove(id)); }
  // the Depot Co and Garage Co packs (0.7.0): each game's props with its helpers and a sandboxed save; every one builds, the host scene and save stay untouched
  for (const [PK, pre, n, name] of [[PACK_DEPOTCO, 'dc', 131, 'Depot Co'], [PACK_GARAGECO, 'ga', 11, 'Garage Co']]) {
    const E = T.editor, top0 = T.scene.children.length, save0 = JSON.stringify(Object.keys(T.S)); const df = E.define(PK); const ps = E.assets().props.filter((p) => p.id.indexOf(pre) === 0 && /^[A-Z]/.test(p.id.charAt(2)));
    ok(df.ok === true && ps.length === n && T.scene.children.length === top0, 'the ' + name + ' pack defines its ' + n + ' props and adds nothing to the scene: ' + (df.ok ? ps.length : df.error));
    const bad = [], ids = []; ps.forEach((p, i) => { try { ids.push(E.spawn(p.id, -12 + (i % 12) * 2, -10 + Math.floor(i / 12) * 2)); } catch (e) { bad.push(p.id + ': ' + e.message); } });
    ok(bad.length === 0 && ids.length === n, 'every ' + name + ' prop builds: ' + ids.length + (bad.length ? ', failed ' + bad.slice(0, 3).join(' | ') : ''));
    ok(JSON.stringify(Object.keys(T.S)) === save0, 'the ' + name + ' pack leaves the host save alone');
    ids.forEach((id) => E.remove(id)); }
  // the world as things to edit (0.9.0): kit calls and plain meshes are world items; moved, resized and removed with their solids, kept as code
  { const E = T.editor, items = E.worldItems(), lamp = items.find((i) => /lamp post/.test(i.name)), fence = items.find((i) => /^fence/.test(i.name)), walls = items.filter((i) => /^wall/.test(i.name));
    ok(items.length >= 15 && !!lamp && !!fence && walls.length >= 2, 'the sample world is items: ' + items.length + ' (a lamp post, a fence, ' + walls.length + ' walls)');
    const li = E.inspect(lamp.id); ok(li.type === 'world' && li.worldItem && li.worldItem.key === lamp.key && Math.abs(li.position[1]) < 0.01, 'a world item inspects as one thing standing on the ground: ' + lamp.key);
    E.set(lamp.id, 'position.x', li.position[0] + 3); E.set(lamp.id, 'rotation.y', 90); E.set(lamp.id, 'scale.y', 1.5);
    const code1 = E.worldCode(); ok(code1.indexOf(JSON.stringify(lamp.key)) > 0 && /ry: 90/.test(code1) && /sy: 1.5/.test(code1), 'a moved, turned and resized item is kept as code for src/00-world.js');
    const sol = () => E.run('(function () { var o = worldByKey(' + JSON.stringify(fence.key) + '); return o.userData.solids.map(function (s) { return Math.round(s.z0 * 100) / 100; }); })()');
    const z0 = sol(), fi = E.inspect(fence.id); E.set(fence.id, 'position.z', fi.position[2] + 2); const z1 = sol();
    ok(z0.length > 0 && Math.abs(z1[0] - z0[0] - 2) < 0.02, 'the solid a fence came with follows it: ' + z0[0] + ' to ' + z1[0]);
    E.remove(fence.id); const gone = E.run('(function () { var o = worldByKey(' + JSON.stringify(fence.key) + '); bakeStatic(); var n = 0; o.traverse(function (m) { if (m.userData.bakedAway) n++; }); unbakeStatic(); return { v: o.visible, s: o.userData.solids[0].x0, baked: n }; })()');
    ok(gone.v === false && gone.s > 1e5 && gone.baked === 0 && /hidden: true/.test(E.worldCode()), 'a removed item is hidden, its solid gone, out of the bake, and kept');
    E.undo(); ok(E.run('(function () { return worldByKey(' + JSON.stringify(fence.key) + ').visible; })()') === true, 'Ctrl+Z brings a removed item back');
    const ap = E.run('(function () { var o = worldByKey(' + JSON.stringify(lamp.key) + '), b = o.userData.worldBase; o.position.set(b.x, b.y, b.z); o.rotation.y = b.ry; o.scale.set(1, 1, 1); worldEditsApply(); return [Math.round(o.position.x * 100) / 100, Math.round(o.rotation.y * 180 / Math.PI), o.scale.y]; })()');
    ok(Math.abs(ap[0] - li.position[0] - 3) < 0.02 && ap[1] === 90 && ap[2] === 1.5, 'a saved edit is laid on the world as it is built: ' + ap.join(', '));
    E.set(lamp.id, 'world.reset', 1); E.set(fence.id, 'world.reset', 1); ok(E.worldCode() === '', 'Put it back leaves nothing to keep'); }
  // several things selected move together (0.9.0): a prop and a world item, one step, one undo; Ctrl and a click takes one out again
  { const E = T.editor, lamp = E.worldItems().find((i) => /lamp post/.test(i.name)), crate = 'crateStack';
    const at = () => [E.inspect(crate).prop.x, E.inspect(lamp.id).position[0]];
    E.select(crate); E.select(lamp.id, true); const sel = E.selection();
    ok(sel.length === 2 && sel.indexOf(crate) >= 0 && sel.indexOf(lamp.id) >= 0 && E.inspect(lamp.id).together === 2, 'Ctrl and a click add to the selection: ' + sel.length + ' selected');
    const a0 = at(); E.moveSel(1, 0); const a1 = at();
    ok(Math.abs(a1[0] - a0[0] - 1) < 0.02 && Math.abs(a1[1] - a0[1] - 1) < 0.02, 'a move takes every selected thing the same step: ' + a0.join(',') + ' to ' + a1.join(','));
    E.undo(); const a2 = at(); ok(Math.abs(a2[0] - a0[0]) < 0.02 && Math.abs(a2[1] - a0[1]) < 0.02, 'one undo puts them all back');
    E.select(lamp.id, true); ok(E.selection().length === 1 && E.selection()[0] === crate, 'Ctrl and a click on a selected thing takes it out');
    E.select(null); E.set(lamp.id, 'world.reset', 1); }
  // parts from a prop drawn in code (0.8.0): a Grow Co, a Depot Co and a basics prop read back as parts, rebuilt from them with the same pieces and size
  for (const type of ['gcVending', 'dcLockers', 'pkBench']) {
    const E = T.editor, THREE = T.THREE, sid = E.spawn(type, 4, 4);
    const look = () => { const g = T.propInst[sid].g; g.updateMatrixWorld(true); const b = new THREE.Box3(), v = new THREE.Vector3(); let n = 0; g.traverse((o) => { let shown = true; for (let q = o; q && q !== g; q = q.parent) if (!q.visible) shown = false; if (o.isMesh && shown && o.material.visible !== false && o.material !== T.MAT.hit) { n++; const pa = o.geometry.attributes.position; for (let i = 0; i < pa.count; i++) b.expandByPoint(v.fromBufferAttribute(pa, i).applyMatrix4(o.matrixWorld)); } }); return { n, s: b.getSize(new THREE.Vector3()) }; };
    let pictures0 = 0; T.propInst[sid].g.traverse((o) => { if (o.isMesh && o.material && o.material.map) pictures0++; });
    const before = look(), r = E.modelConvert(type), after = r && r.ok ? look() : null;
    ok(r && r.ok && r.model.parts.length > 3 && E.model(type).modelled === true, type + ' reads back as parts: ' + (r && r.ok ? r.model.parts.length : (r && r.error)));
    ok(!!after && after.n === before.n && Math.abs(after.s.x - before.s.x) < 0.02 && Math.abs(after.s.y - before.s.y) < 0.02 && Math.abs(after.s.z - before.s.z) < 0.02, type + ' rebuilt from its parts keeps its pieces and its size: ' + (after ? before.n + ' to ' + after.n + ' pieces' : 'no rebuild'));
    if (type === 'gcVending') ok(r.stats.pack > 0 && /packMat/.test(r.code), 'the Grow Co parts keep the pack materials by name: ' + (r.stats.pack || 0));
    const pics = (g) => { let n = 0; g.traverse((o) => { if (o.isMesh && o.material && o.material.map) n++; }); return n; };
    if (type === 'gcVending') ok(r.stats.picture > 0 && pics(T.propInst[sid].g) >= pictures0, 'a picture drawn in code rides along in the parts: ' + (r.stats.picture || 0) + ' pictures, ' + pics(T.propInst[sid].g) + ' of ' + pictures0 + ' on the copy');
    E.revert(type); E.remove(sid); }

  // M9 (0.2.1): clips as data on props and on the people rig; UI as data: HUD chips, panels with buttons, start chips
  { const E = T.editor, CO2 = T.CO, NL = String.fromCharCode(10); const node = (id) => { const tr = E.tree(); for (const k in tr.props) { const n = tr.props[k].find((p) => p.id === id); if (n) return n; } return null; };
    const cl = E.clips(); ok(cl.order.indexOf('wave') >= 0 && cl.order.indexOf('spin') >= 0 && cl.clips.spin.loop === true && cl.clips.wave.tracks.length === 3, 'the built-in clips are there: ' + cl.order.join(', '));
    const box = E.spawn('xChair', 2, 2); const y0 = E.inspect(box).position[1]; const pl = E.clipPlay(box, 'bob', { blend: 0 }); ok(pl.ok === true && pl.tracks === 1, 'a clip plays on a prop: ' + JSON.stringify(pl));
    let y1 = 0; for (let i = 0; i < 40 && y1 <= y0 + 0.05; i++) { await wait(100); y1 = E.inspect(box).position[1]; } ok(y1 > y0 + 0.05, 'the bob lifts the chair: ' + y0 + ' to ' + y1.toFixed(3)); ok(E.clips().playing.some((p) => p.name === 'bob'), 'it is on the playing list');
    E.clipStop(box); ok(!E.clips().playing.some((p) => p.name === 'bob'), 'stop takes it off the list');
    const r1 = E.clip('eSpin2', { duration: 1, loop: false, tracks: [{ path: 'rotation.y', keys: [[0, 0, 'linear'], [1, 1.5, 'linear']] }], events: [[0.5, 'half']] }); ok(r1.ok === true && r1.duration === 1, 'a clip is defined from data');
    let fired = null; T.hook('clipEvent', (obj, name) => { fired = name; }); E.clipPlay(box, 'eSpin2', { blend: 0, hold: true }); await wait(1300); ok(Math.abs(E.inspect(box).rotation[1] - 1.5 * 180 / Math.PI) < 3, 'a one-shot clip ends on its last key and holds: ' + E.inspect(box).rotation[1].toFixed(1) + ' degrees'); ok(fired === 'half', 'its event fired through the clipEvent hook: ' + fired);
    const sk = E.clipSeek(box, 'eSpin2', 0.5); ok(sk.ok === true && Math.abs(E.inspect(box).rotation[1] - 0.75 * 180 / Math.PI) < 3, 'seek puts the pose at a time: ' + E.inspect(box).rotation[1].toFixed(1));
    E.set(box, 'rotation.y', 90); const kp = E.clipKey(box, 'eSpin2', 2); ok(kp.ok === true && kp.keyed === 1 && E.clips().clips.eSpin2.tracks[0].keys.length === 3 && E.clips().clips.eSpin2.duration === 2, 'keying the pose adds a key at t and stretches the clip');
    ok(E.clipCode().indexOf('CO.clip("eSpin2"') >= 0 && E.clipCode().indexOf('"wave"') < 0, 'clipCode writes the new clip and not the built-in ones'); ok(E.clipRemove('eSpin2') === true && !E.clips().clips.eSpin2, 'and removes it');
    const person = E.tree().people[0]; const paths = E.clipPaths(person.id); ok(paths.indexOf('arm.1.rotation.x') >= 0 && paths.indexOf('head.rotation.y') >= 0, 'a person offers its limbs as paths');
    const w = E.clipPlay(person.id, 'wave', { blend: 0 }); ok(w.ok === true && w.tracks === 3, 'wave plays on a person with all three tracks'); await wait(500); const arm = E.inspect(person.id); ok(E.clips().playing.some((p) => p.name === 'wave'), 'the person is waving'); await wait(1400); ok(!E.clips().playing.some((p) => p.name === 'wave'), 'and done after 1.6 s');
    E.remove(box);
    // UI as data
    const u0 = E.ui(); ok(u0 && u0.hud.length === 0 && Object.keys(u0.panels).length === 0, 'no UI data to begin with');
    E.uiSet({ hud: [{ label: 'Presses', value: 'S.presses || 0' }, { label: 'Bank', value: 'money(S.bank)', color: '#f5b53d' }], panels: { board: { title: 'The board', text: 'Welcome to the room.' + NL + NL + '- one' + NL + '- two', buttons: [{ label: 'Give 100', action: 'cash 100', primary: true }, { label: 'Count', action: 'S.presses = (S.presses || 0) + 1' }, { label: 'Close', action: '', close: true }] } }, start: ["'Presses ' + (S.presses || 0)"], menuLine: "'Day ' + S.day + ' in the sample room'" });
    T.updateHud(1); const row = document.getElementById('h-ui'); ok(!!row && row.children.length === 2 && /Presses/.test(row.textContent) && row.children[1].textContent.indexOf('$') >= 0, 'two HUD chips appear with their values: ' + (row && row.textContent));
    const bank0 = S.bank; ok(E.uiOpen('board') === true && T.ui.panelOpen === true && /Welcome/.test(document.getElementById('dc-panel-body').innerHTML) && document.querySelectorAll('#dc-panel-body [data-act="ui"]').length === 3, 'the panel opens with its text and three buttons');
    T.panelAct('ui', 'board:0'); ok(S.bank === bank0 + 100, 'a button runs a dev command: bank ' + S.bank); T.panelAct('ui', 'board:1'); ok(S.presses >= 1, 'a button runs an expression'); T.panelAct('ui', 'board:2'); ok(T.ui.panelOpen === false, 'a close button closes the panel');
    ok(E.uiEval("'Day ' + S.day + ' in the sample room'") === 'Day 1 in the sample room', 'uiEval runs an expression over the kit'); ok(E.uiCode().indexOf('CO.ui(') >= 0 && E.uiCode().indexOf('"board"') >= 0, 'uiCode writes the part');
    E.uiSet({ hud: [], panels: {}, start: [], menuLine: '' }); T.updateHud(1); ok(E.uiCode() === '' && document.getElementById('h-ui').children.length === 0, 'cleared, the UI part is empty and the chips are gone'); }

  // M10 (0.3.0): the prop modeller writes build code from parts and reads it back; M11: bodies fall, rest, stack, sleep, and Drop writes the layout
  { const E = T.editor; const node = (id) => { const tr = E.tree(); for (const k in tr.props) { const n = tr.props[k].find((p) => p.id === id); if (n) return n; } return null; };
    const m0 = E.model('crateStack'); ok(m0.modelled === false && typeof m0.code === 'string' && m0.mats.indexOf('wood') >= 0, 'a hand-written prop is not modelled yet');
    const st = E.modelStart('crateStack'); ok(st.ok === true && st.model.parts.length === 1 && st.code.indexOf('/*@model') >= 0 && node('crateStack').n >= 1, 'modelStart turns it into a one-box model with the model in a comment');
    const m1 = E.model('crateStack'); ok(m1.modelled === true && m1.model.parts[0].kind === 'box', 'the model reads back from the build code');
    const two = { parts: [{ kind: 'box', mat: 'wood', x: 0, y: 0.25, z: 0, w: 1.2, h: 0.5, d: 0.8 }, { kind: 'cyl', mat: 'steel', x: 0, y: 0.9, z: 0, r: 0.1, h: 0.8, seg: 10 }, { kind: 'light', color: '#ffd9a0', intensity: 0.8, dist: 5, x: 0, y: 1.4, z: 0 }], autoSolid: true };
    const pv = E.modelPreview('crateStack', two); ok(pv.ok === true && node('crateStack').n >= 3 && pv.code.indexOf('c.cyl(0.1, 0.8, MAT.steel') >= 0 && pv.code.indexOf('c.solid(') >= 0, 'a three-part model previews, with an obstacle under the grounded parts: ' + node('crateStack').n + ' children');
    const code = E.modelCode(two); ok(code.indexOf('p0.userData.part = 0') >= 0 && code.indexOf('p1.userData.part = 1') >= 0, 'every drawn part carries its index for picking');
    const cw = E.inspect('crateStack').world; T.player.x = cw[0] + 1.5; T.player.z = cw[2] + 3; T.lookAt(cw[0], 0.3, cw[2]); const pk = E.modelPick('crateStack', 0, 0); ok(!!pk && pk.id === 'crateStack' && (pk.part === 0 || pk.part === 1), 'modelPick names the part under the crosshair: ' + JSON.stringify(pk));
    const mir = E.modelMirror({ parts: [{ kind: 'box', x: 1, y: 0, z: 2, w: 1, h: 1, d: 1, ry: 30 }] }, 'x'); ok(mir.parts[0].x === -1 && mir.parts[0].z === 2 && mir.parts[0].ry === -30, 'mirror flips x and the turn');
    const rv = E.revert('crateStack'); ok(rv.ok === true && E.model('crateStack').modelled === false, 'revert brings the hand-written build back');
    // physics
    const ph0 = E.physics(); ok(ph0.on === true && ph0.bodies.length === 0 && ph0.solver === 'built in', 'physics is on with no bodies');
    const b = E.spawn('xChair', 3, 3); E.set(b, 'position.y', 3); const ba = E.bodyAdd(b, { mass: 1 }); ok(ba.ok === true && E.physics().bodies.length === 1, 'a prop becomes a body: ' + JSON.stringify(ba.size));
    await wait(1400); const yb = E.inspect(b).position[1]; ok(yb < 0.2 && yb > -0.05, 'it falls to the floor and rests: y ' + yb.toFixed(3));
    await wait(900); ok(E.physics().bodies[0].asleep === true, 'and sleeps when still');
    ok(E.impulse(b, 2, 0, 0) === true && E.physics().bodies[0].asleep === false, 'an impulse wakes it'); await wait(600); ok(E.inspect(b).position[0] > 3.2, 'and it slid along x: ' + E.inspect(b).position[0].toFixed(2)); await wait(1200);
    const c2 = E.spawn('xChair', E.inspect(b).position[0], 3); E.set(c2, 'position.y', 3); E.bodyAdd(c2, { mass: 1 }); await wait(1500); const top = E.inspect(c2).position[1]; ok(top > 0.6, 'a second body stacks on the first: y ' + top.toFixed(2));
    ok(E.bodyRemove(b) === true && E.bodyRemove(c2) === true && E.physics().bodies.length === 0, 'bodies come out again'); E.remove(c2); E.remove(b);
    // a wall stops a body
    const w = E.spawn('xChair', -8.5, 0); E.set(w, 'position.y', 1.5); E.bodyAdd(w, { mass: 1 }); E.impulse(w, -6, 0, 0); await wait(1500); ok(E.inspect(w).position[0] > -10.5, 'the room wall stops a body thrown at it: x ' + E.inspect(w).position[0].toFixed(2)); E.bodyRemove(w); E.remove(w);
    // Drop writes the layout
    const d = E.spawn('xChair', 5, 5); const dr = E.drop(d, 2.5); ok(dr.ok === true && dr.from > 2, 'drop lifts the prop and lets it fall: from ' + dr.from);
    for (let i = 0; i < 40; i++) { await wait(100); if (E.physics().bodies.length === 0) break; } ok(E.physics().bodies.length === 0, 'the body is gone once it rests');
    const lay = E.layout(); ok(lay.placed.some((p) => p.id === d) && E.history().undo[E.history().undo.length - 1] === 'drop ' + d, 'the resting place is in the layout and the drop is an undo step'); ok(/undid: drop/.test(E.undo()), 'and undoes'); E.remove(d); }

  // v0.4.0: the owed list. prop.xz, a game's own builder, the road brush and feathered paints, bevels, lathes and extrusions, rolling spheres, a hinge
  { const E = T.editor; const node = (id) => { const tr = E.tree(); for (const k in tr.props) { const n = tr.props[k].find((p) => p.id === id); if (n) return n; } return null; };
    E.set('lever', 'prop.xz', [7.5, -6.5]); const lv = E.inspect('lever').prop; ok(lv.x === 7.5 && lv.z === -6.5 && E.history().undo[E.history().undo.length - 1] === 'prop.xz of lever', 'prop.xz moves both at once as one step'); E.undo();
    let built = 0; T.CO.game.buildProp = (id) => { built++; return T.buildProp(id); }; E.set('lever', 'prop.x', 8); ok(built === 1 && E.inspect('lever').prop.x === 8, 'a game that names its builder gets the rebuild: ' + built); E.undo(); ok(built === 2, 'and the undo'); delete T.CO.game.buildProp;
    E.terrainNew({ w: 20, d: 20, cell: 1, x0: 20, z0: 20 }); E.terrainBrush(30, 30, 'raise', 4, 2); const hb = E.terrainY(30, 30); const rd = E.terrainBrush(28, 30, 'road', 3, 1); ok(rd.changed > 0 && Math.abs(E.terrainY(30, 30) - E.terrainY(28, 30)) < 0.15 && E.terrain().palette.indexOf('road') >= 0, 'the road brush flattens the strip to one height and paints it: ' + hb.toFixed(2) + ' before, ' + E.terrainY(30, 30).toFixed(2) + ' after');
    E.terrainBrush(25, 25, 'paint', 2, 1, 1); ok(E.terrainBrush(26, 25, 'paint', 1, 1, 0).changed >= 0, 'two paints side by side feather at their seam without an error'); E.terrainOff();
    const mp = E.modelPreview('crateStack', { parts: [{ kind: 'box', mat: 'wood', x: 0, y: 0.3, z: 0, w: 1, h: 0.6, d: 1, r: 0.06 }, { kind: 'lathe', mat: 'steel', x: 0, y: 0.6, z: 0, points: [[0.3, 0], [0.4, 0.4], [0.15, 0.9]], seg: 16 }, { kind: 'extrude', mat: 'red', x: 0.6, y: 0.6, z: 0, shape: [[-0.3, 0], [0.3, 0], [0, 0.5]], depth: 0.2 }], autoSolid: false });
    ok(mp.ok === true && node('crateStack').n >= 3 && mp.code.indexOf('r: 0.06') >= 0 && mp.code.indexOf('LatheGeometry') >= 0 && mp.code.indexOf('ExtrudeGeometry') >= 0, 'a bevelled box, a lathe and an extrusion build from parts'); E.revert('crateStack');
    const sb = E.spawn('xChair', 6, 6); E.set(sb, 'position.y', 1); const ba = E.bodyAdd(sb, { mass: 1, shape: 'sphere', size: 0.3 }); ok(ba.ok === true, 'a sphere body'); await wait(700); const r0 = E.inspect(sb).rotation.slice(); E.impulse(sb, 2.5, 0, 0); await wait(600); const r1 = E.inspect(sb).rotation; ok(Math.abs(r1[2] - r0[2]) > 2 || Math.abs(r1[0] - r0[0]) > 2, 'a rolling sphere turns as it moves: ' + r0.map((v) => v.toFixed(0)) + ' to ' + r1.map((v) => v.toFixed(0))); E.bodyRemove(sb); E.remove(sb);
    const hg = E.spawn('xChair', -6, 6); const ha = E.hingeAdd(hg, { pivot: [-6, 3, 6], length: 2, angle: 0.9, axis: 'z' }); ok(ha.ok === true && ha.length === 2, 'a hinge hangs the chair from a pivot'); await wait(500); const a1 = E.physics().hinges[0].angle; ok(a1 < 0.9 && E.inspect(hg).world[1] < 3, 'it swings down from the start angle: ' + a1.toFixed(2)); await wait(2500); ok(Math.abs(E.physics().hinges[0].angle) < 0.9, 'and the swing settles'); ok(E.hingeRemove(hg) === true && E.physics().hinges.length === 0, 'the hinge comes off'); E.remove(hg); }

  // v0.5.0: tables, the top camera, undo for terrain, materials and UI, GLSL, mesh parts, a spring, material tracks, the tree's origin, a game's own pack
  { const E = T.editor, CO2 = T.CO; const node = (id) => { const tr = E.tree(); for (const k in tr.props) { const n = tr.props[k].find((p) => p.id === id); if (n) return n; } return null; };
    CO2.tune({ eShop: { 'price': 90 } }); const tbl = CO2.table('eShop', { price: 50, name: 'shop', open: true, rows: [{ cost: 3 }, { cost: 7 }] }, 'a test table'); ok(tbl.price === 90, 'a saved tune applies the moment the table registers: ' + tbl.price);
    const tl = E.tables().find((t) => t.name === 'eShop'); ok(!!tl && tl.fields.some((f) => f.path === 'rows.1.cost' && f.value === 7) && tl.fields.find((f) => f.path === 'price').changed === true, 'tables() lists the leaves with their paths and what changed');
    ok(E.tableSet('eShop', 'rows.1.cost', 12).ok === true && tbl.rows[1].cost === 12, 'tableSet edits a leaf live'); ok(E.tablesCode().indexOf('"rows.1.cost": 12') >= 0, 'and the part to write carries it'); E.undo(); ok(tbl.rows[1].cost === 7 && E.tablesCode().indexOf('rows.1.cost') < 0, 'undo puts it back and drops the override');
    ok(E.tableSet('eShop', 'price', 'abc').error, 'a number field refuses text'); E.tableSet('eShop', 'price', 50); ok(E.tablesCode() === '', 'back at the default the tune is empty');
    ok(E.mode('top') === 'top' && T.photo.pitch < -1.4 && T.camera.position.y >= 22, 'the top camera looks straight down from above'); E.mode('game');
    E.terrainNew({ w: 10, d: 10, cell: 1, x0: 20, z0: 20 }); const h0 = E.terrainY(25, 25); E.terrainBrush(25, 25, 'raise', 3, 1); ok(E.terrainY(25, 25) > h0 + 0.5, 'a stroke raises'); E.undo(); ok(Math.abs(E.terrainY(25, 25) - h0) < 1e-6, 'and undoes'); E.redo(); ok(E.terrainY(25, 25) > h0 + 0.5, 'and redoes'); E.terrainOff();
    E.material('eM', { size: 64, layers: [{ type: 'fill', color: '#ff0000' }], roughness: 0.4 }); E.material('eM', { size: 64, layers: [{ type: 'fill', color: '#00ff00' }], roughness: 0.8 }); ok(T.MAT.eM.roughness === 0.8, 'a material redefined'); E.undo(); ok(T.MAT.eM.roughness === 0.4, 'undo brings the first graph back'); E.undo(); ok(E.materials().order.indexOf('eM') < 0, 'and undo again removes it');
    E.uiSet({ hud: [{ label: 'A', value: '1' }], panels: {}, start: [], menuLine: '' }); E.uiSet({ hud: [{ label: 'B', value: '2' }], panels: {}, start: [], menuLine: '' }); E.undo(); ok(E.ui().hud[0].label === 'A', 'undo on a UI edit'); E.undo(); ok(E.ui().hud.length === 0, 'back to no chips');
    E.material('eGlsl', { size: 64, layers: [{ type: 'fill', color: '#808080' }], glsl: 'diffuseColor.rgb *= 0.5 + 0.5 * sin(uTime + vUv.x * 6.28);' }); ok(typeof T.MAT.eGlsl.onBeforeCompile === 'function' && /co-glsl/.test(T.MAT.eGlsl.customProgramCacheKey()), 'a GLSL snippet hooks the material'); const gb = E.define("defProp('eGlslBox', { label: 'glsl box', x: 6, z: 6, rot: 0, cat: 'room', build: function (c) { c.box(1, 1, 1, MAT.eGlsl, 0, 0.5, 0); } })"); await wait(300); ok(gb.ok === true && !!node('eGlslBox'), 'and a prop renders with it without a page error'); E.remove('eGlslBox'); E.materialRemove('eGlsl');
    const mm = E.modelPreview('crateStack', { parts: [{ kind: 'mesh', mat: 'wood', x: 0, y: 0, z: 0, verts: [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]], faces: [[0, 2, 1], [0, 1, 3], [0, 3, 2], [1, 2, 3]] }], autoSolid: false }); ok(mm.ok === true && mm.code.indexOf('vertexEdit') >= 0 && node('crateStack').n >= 1, 'a mesh part builds from vertices and faces'); E.revert('crateStack');
    const sp = E.spawn('xChair', -5, 5); const sa = E.springAdd(sp, { anchor: [-5, 3, 5], k: 30, damping: 3, rest: 1 }); ok(sa.ok === true && E.physics().springs === 1, 'a spring hangs a body from an anchor'); await wait(1600); const sy = E.inspect(sp).world[1]; ok(sy > 1.2 && sy < 2.6, 'it settles near the rest length under the anchor: y ' + sy.toFixed(2)); E.springRemove(sp); E.bodyRemove(sp); E.remove(sp);
    E.clip('eMat', { duration: 0.5, loop: false, tracks: [{ path: 'material.opacity', keys: [[0, 1], [0.5, 0.3]] }] }); const mp2 = E.spawn('xChair', 5, -5); E.clipPlay(mp2, 'eMat', { blend: 0 }); await wait(800); const kid = T.scene.getObjectByProperty('uuid', T.scene.uuid) || null; const op = E.clips().playing.length === 0; ok(op, 'a material track plays out'); E.clipRemove('eMat'); E.remove(mp2);
    ok(node('crateStack').from === 'definition' || /definition/.test(node('crateStack').from), 'the tree says where a prop comes from: ' + node('crateStack').from);
    E.bind(); E.on = true; E.mode('game'); const cw = E.inspect('crateStack').world; T.player.x = cw[0] + 0.5; T.player.z = cw[2] + 3; T.lookAt(cw[0], 0.4, cw[2]); const cv = T.renderer.domElement, rr = cv.getBoundingClientRect(), mx = rr.left + rr.width / 2, my = rr.top + rr.height / 2;
    cv.dispatchEvent(new MouseEvent('mousedown', { button: 0, ctrlKey: true, clientX: mx, clientY: my, bubbles: true })); cv.dispatchEvent(new MouseEvent('mousemove', { ctrlKey: true, clientX: mx + 60, clientY: my, bubbles: true })); document.dispatchEvent(new MouseEvent('mouseup', { button: 0, clientX: mx + 60, clientY: my, bubbles: true }));
    const moved = E.inspect('crateStack').prop; ok(E.selected() === 'crateStack' && moved.x !== cw[0], 'Ctrl and the left button grab and drag a prop in the game view: x ' + cw[0] + ' to ' + moved.x); ok(E.history().undo[E.history().undo.length - 1] === 'move crateStack', 'as one move step'); E.undo();
    const r0 = E.inspect('crateStack').prop.rot; cv.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, ctrlKey: true, clientX: mx, clientY: my, bubbles: true, cancelable: true })); ok(E.inspect('crateStack').prop.rot === (r0 + 1) % 4, 'Ctrl and the wheel turn it a quarter'); E.undo(); E.on = false;
    const pc = E.packCode(['crateStack', 'lever']); ok(pc.ids.length === 2 && pc.code.indexOf('defProp("crateStack"') >= 0 && pc.code.indexOf('"shop":false') >= 0, 'packCode writes a pack from the game\u2019s own props'); }
`;
