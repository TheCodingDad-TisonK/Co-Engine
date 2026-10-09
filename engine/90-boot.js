//@ Co Engine, part 90: the boot. CO.boot(GAME) loads the save, builds the world, runs the frame loop and publishes the handle.
  // ── Boot ──────────────────────────────────────────────────────────
  // The game's last part calls CO.boot(GAME). GAME carries the hooks (they merge into CO.game) and these steps, every one optional:
  //   freshState()             the game's default S              migrate(s, fresh)      its save migrations
  //   afterLoad(loaded)        repairs on S before the world      buildWorld(loaded)     the walls, the props (buildProps), the people
  //   afterBuild(loaded)       meshes for the saved things        startStats(loaded)     the start screen chips, as strings
  //   startNote(loaded)        the line under the chips           onEnter(loaded)        the first thing after the start button
  //   tick(dt)                 the world, once a frame while running    present(dt)     the game's own per-frame presentation
  //   menuCamera(dt)           the camera behind the start screen       hiddenTick(dt)  what still ticks in a hidden tab
  //   T                        what the game adds to the test handle    handle          the window property ('DEPOT')
  //   bake false               skip the static bake                     weather false   no weather state machine
  //   autoplay false           the game's own front menu handles the autoplay flag
  //   input false (in CO.setup)  the game binds its own keys and mouse;  editMode false, photo false, lighting false, hudFields false: those engine passes stay off
  //   render(dt)               the game draws the frame itself (return true)
  var loaded = false, autosaveT = 0, fpsN = 0, fpsT = 0, lastFrame = 0;
  function coBoot(GAME) {
    GAME = GAME || {}; if (!CO.game) CO.game = {}; for (var k in GAME) if (!(k in CO.game)) CO.game[k] = GAME[k]; CO.gameVersion = GAME.version || window[GAME.versionGlobal || 'GAME_VERSION'] || CO.gameVersion;
    loaded = loadSave(GAME.freshState || function () { return { day: 1, time: CAL.dayStart, bank: 0, log: [], ledger: [], stats: { earned: 0, spent: 0 }, layout: {}, custom: [], hdoors: {} }; }, GAME.migrate);
    if (GAME.afterLoad) GAME.afterLoad(loaded);
    runHooks('beforeBuild', loaded);
    if (GAME.buildWorld) GAME.buildWorld(loaded);
    runHooks('afterBuild', loaded);
    if (GAME.afterBuild) GAME.afterBuild(loaded);
    applySettings(); resize();
    if (GAME.bake !== false && !/nobake=1/.test(location.search)) bakeStatic();
    if (!GAME.menuCamera) { camera.position.set(12, 3.6, 0); camera.lookAt(0, 1.4, 0); }   // a game with a menu camera of its own places the camera itself
    var st = $('dc-start-stats'); if (st) st.innerHTML = (GAME.startStats ? GAME.startStats(loaded) : [loaded ? 'Day ' + S.day : 'New game']).map(function (s) { return '<span>' + esc(s) + '</span>'; }).join('');
    var sn = $('dc-start-note'); if (sn) sn.textContent = GAME.startNote ? GAME.startNote(loaded) : ('Slot ' + BOOT_SLOT + (loaded ? ' · last saved ' + (S.savedAt ? new Date(S.savedAt).toLocaleString() : 'never') : ''));
    var sb = $('dc-start-btn'); if (sb) sb.addEventListener('click', enter);
    requestAnimationFrame(frame);
    // a hidden tab gets no animation frames; the world still ticks ten times a second
    setInterval(function () { if (!document.hidden) return; var n = performance.now(), dt = Math.min(0.05, Math.max(0.001, (n - lastFrame) / 1000)); lastFrame = n; worldTime += dt; if (ui.started && !ui.blocked() && !photo.on) { if (CO.game.tick) CO.game.tick(dt); updatePlayer(dt); doorsTick(dt); if (CO.game.hiddenTick) CO.game.hiddenTick(dt); scene.updateMatrixWorld(true); updateFocus(); updatePrompt(); } }, 50);
    window.addEventListener('beforeunload', function () { if (ui.started) saveNow(); });
    var handle = { enter: enter, bootSlot: BOOT_SLOT, version: CO.gameVersion || 'dev', engine: CO.version, T: coHandle() };
    if (GAME.T) { var gt = typeof GAME.T === 'function' ? GAME.T() : GAME.T; for (var tk in gt) handle.T[tk] = gt[tk]; }
    window[GAME.handle || 'CO_GAME'] = handle; CO.handle = handle; window.CO_EDITOR = CO.editor;   // the editor and the MCP server reach the bridge here, outside the closure
    if (/[?&]editor=1/.test(location.search)) { CO.editor.on = true; CO.editor.bind(); }   // opened in the editor's viewport: clicks select, the right button flies
    // <prefix>-autoplay in sessionStorage (or ?autoplay=1) presses the start button on the first frame; GAME.autoplay false leaves
    // the flag to the game's own front menu, which reads and presses it itself
    if (GAME.autoplay !== false) { var auto = false; try { auto = sessionStorage.getItem(CO.save.prefix + '-autoplay') === '1'; if (auto) sessionStorage.removeItem(CO.save.prefix + '-autoplay'); } catch (e) {} if (auto || /[?&]autoplay=1/.test(location.search)) setTimeout(enter, 50); }
    runHooks('boot', loaded);
    return handle;
  }
  function enter() {
    if (ui.started) return;
    ui.started = true; var s = $('dc-start'); if (s) s.hidden = true; var h = $('dc-hud'); if (h) h.hidden = false; hudDirty = true;
    lockPointer(); sfx('ok');
    if (CO.game.onEnter) CO.game.onEnter(loaded);
    if (/[?&]dev=1/.test(location.search) && !devLink.on) devLinkToggle();
    runHooks('enter', loaded);
  }
  // ── The frame loop ────────────────────────────────────────────────
  function frame(nowMs) {
    requestAnimationFrame(frame);
    var dt = Math.min(0.05, Math.max(0.001, (nowMs - lastFrame) / 1000)); lastFrame = nowMs;
    // paused by the editor: the world holds, the scene camera still flies, the frame still draws; one step runs a single frame through
    if (CO.paused && !CO.stepOnce) { if (photo.on && CO.game.photo !== false) photoTick(dt); updateLightBudget(); shadowTick(dt); if (!(CO.game.render && CO.game.render(dt))) renderFrame(dt); return; }
    CO.stepOnce = false;
    if (!ui.started) { if (CO.game.menuCamera) CO.game.menuCamera(dt); else { var ma = worldTime * 0.07; camera.position.set(Math.cos(ma) * 12, 3.6 + Math.sin(ma * 1.7) * 0.6, Math.sin(ma) * 9.5); camera.lookAt(Math.cos(ma + 1.2) * 4, 1.4, Math.sin(ma + 1.2) * 3); } }
    if (ui.started && !ui.blocked()) { if (photo.on && CO.game.photo !== false) photoTick(dt); else { if (CO.game.tick) CO.game.tick(dt); if (CO.game.weather !== false) tickWeatherState(dt); updatePlayer(dt); } autosaveT += dt; if (autosaveT > 30) { autosaveT = 0; save(); } }
    worldTime += dt;
    if (CO.game.lighting !== false) lighting(dt); updateLightBudget(); shadowTick(dt); if (sky.dome || sky.rain) tickSky(dt); tickBursts(dt); doorsTick(dt); drawScreens(dt); editTick(); tickTraffic(dt);
    if (CO.game.present) CO.game.present(dt); runHooks('frame', dt);
    for (var ai = 0; ai < animated.length; ai++) animated[ai](dt);
    updateFocus(); updatePrompt(); updateHud(dt); tickCards(dt); tickDevLink(dt);
    if (!(CO.game.render && CO.game.render(dt))) renderFrame(dt);   // a game may render the frame itself (a security camera view, a picture in picture)
    if (SET.fps) { fpsN++; fpsT += dt; if (fpsT >= 0.5) { var f = $('h-fps'); if (f) f.textContent = Math.round(fpsN / fpsT) + ' fps · ' + (post.calls || renderer.info.render.calls) + ' draws'; fpsN = 0; fpsT = 0; } }
  }
  // ── The handle: the engine's part of window.<handle>.T, for the editor and the smoke tests ──
  function coHandle() {
    return {
      get S() { return S; }, CO: CO, editor: CO.editor, player: player, ui: ui, edit: edit, photo: photo, SET: SET, scene: scene, camera: camera, renderer: renderer, baked: baked, MAT: MAT, TEX: TEX, NRM: NRM, solids: solids, dyn: dyn, inter: inter, screens: screens, hdoors: hdoors, lampMeshes: lampMeshes, sky: sky, NAV: NAV, PROPS: PROPS, propInst: propInst, HOOKS: HOOKS,
      run: function (sec) { var n = Math.round(sec / 0.05); for (var i = 0; i < n; i++) { if (CO.game.tick) CO.game.tick(0.05); if (CO.game.step) CO.game.step(0.05); } scene.updateMatrixWorld(true); },
      setTime: function (h) { S.time = h; hudDirty = true; },
      save: save, saveNow: saveNow, loadSave: loadSave, pay: pay, enter: enter, floorY: floorY, route: route, navFreeAt: navFreeAt, collides: collides, updatePlayer: updatePlayer, updateFocus: updateFocus, useFocus: useFocus, focusText: function () { return focusText; },
      lookAt: function (x, y, z) { camera.position.set(player.x, player.y + 1.62, player.z); camera.lookAt(x, y, z); camera.updateMatrixWorld(true); player.yaw = Math.atan2(-(x - player.x), -(z - player.z)); player.pitch = Math.atan2(y - camera.position.y, Math.sqrt(dist2(x, z, player.x, player.z))); updateFocus(); return focusText; },
      buildProp: buildProp, buildProps: buildProps, propPlacement: propPlacement, propWorld: propWorld, removePropInst: removePropInst, catalogueData: catalogueData, editToggle: editToggle, editGrab: editGrab, editDrop: editDrop, editRotate: editRotate, editReset: editReset, editRemove: editRemove, editRestore: editRestore, editBuy: editBuy,
      hd: hd, doorById: doorById, doorUse: doorUse, doorLock: doorLock, doorsTick: doorsTick, doorSolids: doorSolids, lockAll: lockAll, drawScreens: drawScreens, screenTap: screenTap, screenZoneAt: screenZoneAt, screenDirtyAll: screenDirtyAll,
      openPanel: openPanel, closePanel: closePanel, renderPanel: renderPanel, panelHtml: function () { var b = $('dc-panel-body'); return b ? b.innerHTML : ''; }, openMenu: openMenu, closeMenu: closeMenu, menuAct: menuAct, settingsHtml: settingsHtml, applySettings: applySettings, showCard: showCard, hideCards: hideCards,
      photoToggle: photoToggle, photoTick: photoTick, photoZoom: photoZoom, updateHud: updateHud, toast: toast, logEvent: logEvent, sfx: sfx,
      devCommand: devCommand, devCommandList: devCommandList, devLink: devLink, devLinkToggle: devLinkToggle, devState: devState,
      makeHuman: makeHuman, animateHuman: animateHuman, say: say, setMood: setMood, walkAlong: walkAlong, carMesh: carMesh, trafficAdd: trafficAdd, driveStep: driveStep, vehicleBlocked: vehicleBlocked,
      pickWeather: pickWeather, tickWeatherState: tickWeatherState, lighting: lighting, buildSky: buildSky, season: season, isSunday: isSunday, nowAbs: nowAbs,
      bakeStatic: bakeStatic, unbakeStatic: unbakeStatic, rebake: rebake, renderFrame: renderFrame, post: post, resize: resize,
      propSeed: propSeed, seededF: seededF, mixHex: mixHex, fmtTime: fmtTime, money: money, hook: hook, runHooks: runHooks,
      counts: function () { return { draws: (post.calls || renderer.info.render.calls), inter: inter.length, dyn: dyn.length, baked: baked.draws, hidden: baked.hidden }; }
    };
  }
  CO.boot = coBoot;
