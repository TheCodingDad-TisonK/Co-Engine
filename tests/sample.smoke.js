// The engine's own smoke: the sample room (tests/sample) booted through CO.boot. Run by tests/smoke.js. No backslash-quote in the body.
'use strict';
module.exports = `
  ok(!!T.renderer && !!T.scene && !!T.camera && T.CO.ready === true && typeof T.enter === 'function', 'CO.setup and CO.boot ran: renderer, scene, camera and the handle stand');
  ok(T.ui.started === false && !document.getElementById('dc-start').hidden, 'the start screen is up before enter');
  ok(/A new room/.test(document.getElementById('dc-start-stats').textContent) && /Slot 1/.test(document.getElementById('dc-start-note').textContent), 'the start screen chips and note come from the game and the engine');
  T.enter(); ok(T.ui.started === true && document.getElementById('dc-start').hidden && !document.getElementById('dc-hud').hidden, 'enter hides the start screen and shows the HUD');
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
  { const E = T.editor; const tr = E.tree(); ok(!!tr && !!tr.props.room && tr.props.room.some((p) => p.id === 'crateStack') && tr.lights.length >= 2 && tr.doors.length === 1 && tr.screens.length === 1 && tr.people.length === 2 && tr.vehicles.length === 1 && tr.counts.statics > 5, 'the editor tree lists the props, the lights, the door, the screen, the people, the car and the static world: ' + JSON.stringify(tr.counts));
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
`;
