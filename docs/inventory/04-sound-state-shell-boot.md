# Inventory 04: sound, state, shell, boot, devlink (Depot Co = A, Grow Co = B)

Read-only pass on 2026-10-08. A is `Depot Co\src\`, B is `RF Grow Co\src\`. Line numbers are per file. Where a counterpart lives outside the assigned files, its file is named in the cell. In B `26-radio-dust-tv.js` only the radio part (lines 1 to 47) was read closely; its other functions are listed by name in section 5.

## 1. Identical

| name(s) | A file:line | B file:line | note |
|---|---|---|---|
| closure opener and three.js guard | 01-head.js:8-10 | 00-head.js:9-11 | Same text, only the comment banner differs. |
| now | 01-head.js:22 | 00-head.js:21 | Identical |
| clamp | 01-head.js:23 | 00-head.js:22 | Identical |
| lerp | 01-head.js:24 | 00-head.js:23 | Identical |
| randi | 01-head.js:26 | 00-head.js:26 | Identical |
| randf | 01-head.js:27 | 00-head.js:27 | Identical |
| pick | 01-head.js:28 | 00-head.js:28 | Identical |
| $ | 01-head.js:29 | 00-head.js:29 | Identical |
| esc | 01-head.js:30 | 00-head.js:30 | Identical |
| saveSettings | 01-head.js:39 | 02-state.js:10 | Identical |
| sTone | 04-sound.js:26 | 03-log-sound.js:26 | Byte-identical |
| sNoise | 04-sound.js:27 | 03-log-sound.js:27 | Byte-identical |
| sThud | 04-sound.js:28 | 03-log-sound.js:28 | Byte-identical |
| sBeep | 04-sound.js:29 | 03-log-sound.js:29 | Byte-identical |
| toast | 04-sound.js:16 | 03-log-sound.js:16 | Only the lifetime differs, 2600 ms vs 2400 ms. Make it a constant. |
| resize | 05-three.js:18 (outside the read set) | 35-daynight-input.js:95 | Identical. Both games bind window resize to it. |
| SFX voices ok, bad, rare, click, cash, pickup, putdown, crate, roller, door, bell, chime | 04-sound.js:31,32,33,34,35,36,37,38,40,51,49,50 | 03-log-sound.js:37,38,39,40,41,53,54,55,59,57,68,69 | 12 voices with the same body. They are the engine's base SFX set. |

## 2. Same name, different body

| name(s) | A file:line | B file:line | note |
|---|---|---|---|
| money | 01-head.js:25 | 00-head.js:24 | A prints negatives as -$ (abs). B has no sign handling. |
| SAVE | 01-head.js:14 | 00-head.js:15 (desk), 18 | A is 'depotco-slot'+BOOT_SLOT. B adds a ?save= override, moves the legacy rfgrowco-v1 key into slot1, and has a `//#if desk` variant. |
| SETTINGS_KEY | 01-head.js:21 | 00-head.js:16, 19 | Value only ('depotco-settings' vs 'rfgrowco-settings' / 'rf-grow3d-settings'). |
| SET | 01-head.js:37 | 02-state.js:4 | A is a literal with defaults (vol, film, bob). B starts empty and is filled by loadSettings, with keys dayNight, dayLength, headBob, hudScale and no vol. |
| load | 03-state.js:43 | 02-state.js:51 | A parses, fills defaults, runs every migration inline and returns a bool. B checks the recover key, falls back to fresh() in memory with saveBlocked, and delegates to loadNormalise and migrate. |
| save | 03-state.js:95 | 02-state.js:102 | A writes at once (stamps savedAt, wiped guard, failure toast once). B is a 300 ms debounce over writeSave. |
| logEvent | 04-sound.js:3 | 03-log-sound.js:3 | A stores S.day plus game time from fmtTime(S.time). B stores wall-clock time only. |
| feedPush | 04-sound.js:8 | 03-log-sound.js:8 | Same frame. The timestamp is game clock in A and wall clock in B. |
| audio | 04-sound.js:24 | 03-log-sound.js:24 | A's bus gain is SET.vol. B's is fixed at 0.9 and declares a `hum` voice. |
| sfx | 04-sound.js:68 | 03-log-sound.js:88 | A re-applies SET.vol to sfxBus on every call. B does not. |
| SFX (table) | 04-sound.js:30 (36 voices) | 03-log-sound.js:30 (56 voices) | Six shared names differ: step (surfaces steel/outside vs tile/planks/rubber), siren (4 vs 6 notes), gate (0.9 vs 0.6 s), vend (B adds a thud), coffee (B adds a sawtooth), levelup (triangle vs sine). |
| ui | 12-player.js:4 | 33-ui.js:3 | A's flags are started, menu, panel, scan, rebuilding, testing, and blocked() checks 3 of them. B's blocked() checks 9 layers plus !started, and B carries the panel methods. |
| openPanel | 13-ui.js:43 | 33-ui.js:6 (ui.openPanel) | A sets panel.kind/tab, closes the scanner, suppresses the menu. B is a method that sets a default tab per kind and plays an sfx per kind. |
| closePanel | 13-ui.js:48 | 33-ui.js:10 (ui.closePanel) | A sets hudDirty. B relocks only if the menu is shut and plays 'close'. |
| openMenu | 13-ui.js:189 | 34-processing-panes.js:314 | A saves, prints "Saved at ... slot N" and sets the devlink button label. B plays sfx and hides the dev button. |
| closeMenu | 13-ui.js:190 | 34-processing-panes.js:315 | B plays 'close' and relocks only if no panel is open. |
| settingsHtml | 13-ui.js:208 | 34-processing-panes.js:425 | A is raw labels (sens, invertY, fov, bob, quality, sound, vol, film, fps, intro). B uses the slider/check/select helpers and adds day/night, day length and HUD scale. |
| applySettings | 13-ui.js:228 | 34-processing-panes.js:470 | A: film post, rain/snow counts, budget 16/10/6, shadow 4096/2048, volume. B: PCFSoft type, budget 12/8/5, shadow 2048/1024, hudScale font size. |
| screenshot | 13-ui.js:237 | 34-processing-panes.js:276 | A: renderFrame plus toBlob, name depot-co-<ms>. B: renderer.render plus toDataURL, name growco-day-date-time, with an error toast. |
| guideHtml | 13-ui.js:242 | 34-processing-panes.js:454 | Both are a game text string. B also ships a separate game/guide.js. |
| lockPointer | 12-player.js:114 | 34-processing-panes.js:53 | A refuses while ui.blocked(). B retries through lockRetry after the Chromium Esc cooldown. |
| frame | 15-boot.js:36 | 36-boot.js:119 | A: dt from the rAF timestamp, clamped to 0.05, the world ticks inside the frame. B: dt from THREE.Clock, clamped to 0.1, the sim runs on a separate 1 s interval. |
| radio | 14-life.js:46 | 26-radio-dust-tv.js:3 | A is plain state with a gain into sfxBus. B is an object with methods and its own master, lowpass and compressor into the destination. |
| STATIONS | 14-life.js:41 | 26-radio-dust-tv.js:4 | A is an array of 3 (root plus semitones, 16th grid, hat/kick patterns). B is keyed, 5 entries including off (MIDI notes, 8th grid, swing, style flags). |
| updateLightBudget | 05-three.js:61 | 36-boot.js:100 | A uses worldTime seconds, hysteresis for lamps already on, and lightBudget.n. B uses wall-clock ms, lightBudget.point and no hysteresis. |
| stockCount | 07-items.js:77 | 02-state.js:115 | Name collision, game logic in both (boxes of a SKU vs packed goods in the cabinet). Keep it out of the engine namespace. |

## 3. Same purpose, different names

| name(s) | A file:line | B file:line | note |
|---|---|---|---|
| BOOT_SLOT / slot inside SAVE IIFE | 01-head.js:13 | 00-head.js:18 | A exposes the slot number. B folds it into the key. |
| inline settings read / loadSettings + DEFAULT_SETTINGS | 01-head.js:38 | 02-state.js:5, 3 | B can re-run its read (storage listener) and migrates one old value. |
| freshState / fresh | 03-state.js:3 | 02-state.js:15 | The game's default S. This is GAME.freshState. |
| inline migrations in load / migrate + loadNormalise | 03-state.js:47-87 | 02-state.js:89, 62 | A gates steps on s.hall and s.flags. B gates on SAVE_V `from` and uses a fill(dst, src, depth). This is GAME.migrate. |
| save (immediate) / saveNow + writeSave | 03-state.js:95 | 02-state.js:103, 101 | Same write. B's failure guard is saveFailed, A's is save.failed (03-state.js:96). |
| wiped + wipe / saveBlocked + resetShop | 03-state.js:100-101 | 02-state.js:47, 34-processing-panes.js:303 | A removes the key, then the menu reloads. B writes fresh(), sets the skip-splash and autoplay flags, and reloads through the pageReload seam (34-processing-panes.js:302). |
| broken-save copy in load catch / keepBrokenSave | 03-state.js:90 | 02-state.js:50 | Both keep SAVE+'-broken'. |
| beforeunload save / pagehide + beforeunload saveNow | 15-boot.js:50 | 02-state.js:104 | B also covers pagehide. |
| addXp / gainXp | 03-state.js:104 | 03-log-sound.js:96 | A has LEVEL_CAP and calls onLevelUp. B has no cap and toasts, unlocks strains and bursts inline. |
| fmtTime / clockText | 01-head.js:32 | 32-interaction.js:155 | A is pure fmtTime(h). B reads gameHour(). |
| updateHud / hud | 13-ui.js:4 | 34-processing-panes.js:484 | A throttles itself (hudDirty or 0.25 s) and is called every frame. B is called on demand (simTick, afterAction) and caches the hotbar by key. |
| renderPanel / ui.render | 13-ui.js:49 | 33-ui.js:12 | Title, tabs and body into the panel DOM. B adds hooks.panel[kind]. |
| menu click listener | 13-ui.js:192 | 34-processing-panes.js:316 | data-menu dispatch. A swaps the button list for menuBody with a Back button. B fills a body under the buttons. |
| settings input listener / settingsInput | 13-ui.js:222 | 34-processing-panes.js:447 | Same SET write, then saveSettings and applySettings. B updates the value label. |
| save export/import inline / savesHtml, saveExport, saveImportRead, saveImportApply, saveSlotName | 13-ui.js:201-204 | 34-processing-panes.js:286, 287, 292, 308, 285 | A: textarea plus download plus paste. B: file picker, a confirm page and a newer-version warning. B is the better base. |
| pcHtml('stats') branch / paneStats + paneStatsInner | 13-ui.js:103-108 (menu at 200) | 34-processing-panes.js:218, 219 | Lifetime stats. Both feed the pause menu. |
| enter / start button handler | 15-boot.js:23 | 36-boot.js:35 | Sets ui.started, hides the start screen, shows the HUD, locks the pointer, sfx and a log line. A also auto-links devlink with dev=1. |
| start stats inline / startScreen + chip | 15-boot.js:20-21 | 36-boot.js:28, 34-processing-panes.js:69 | Start-screen chips and a note. |
| tickWorld / simTick | 15-boot.js:35 | 36-boot.js:44 | A: variable dt per frame. B: fixed 1 s step plus a debounced save every tick. This is GAME.tick. |
| hidden-tab setInterval / setInterval(simTick) | 15-boot.js:49 | 36-boot.js:53 | A ticks every 50 ms only while hidden. B's sim always runs on its own interval. |
| window.DEPOT + T / window.RFGROW + RFGROW.test | 15-boot.js:53 | 36-boot.js:133, 135, 138 | The test and automation handle. This is GAME.T. |
| devCommand + DEV_COMMANDS / devAction + DEV | 13-ui.js:122, 121 | 34-processing-panes.js:389, 341 | Cheat dispatch. A returns a message string, B toasts. This is GAME.commands. |
| devLinkToggle / devOpen + devClose | 14-devlink.js:24 | 34-processing-panes.js:376, 388 | Same job, different front end. A links to an external console over SSE. B opens an F8 in-page console behind the Dev Tools DLC. |
| shadowTick / updateShadowTimer | 14-events.js:85 | 36-boot.js:115 | Shadow map refresh cadence. A also refreshes on a dirty flag or live movers. |
| lighting / updateDayNight | 14-events.js:61 | 35-daynight-input.js:4 | Sky, sun and fog per hour. The body is game. |
| keydown listener | 12-player.js:125 | 35-daynight-input.js:30 | Esc ladder, F-keys, game keys. |
| radioStart / radio.ensure + radio.set | 14-life.js:54 | 26-radio-dust-tv.js:13, 14 | Bus creation plus a 120 ms scheduler interval. Same pattern in both. |
| radioSchedule / radio.schedule + radio.playStep | 14-life.js:55 | 26-radio-dust-tv.js:21, 27 | 0.35 s lookahead scheduler. A puts the step inline, B separates it. |
| rTone / tone | 14-life.js:68 | 26-radio-dust-tv.js:25 | A has an f1 sweep and lowpass. B has a dest parameter and attack. |
| rNoise / noiseHit | 14-life.js:69 | 26-radio-dust-tv.js:26 | Same highpass hit. B takes a dest parameter. |
| tickRadio / radio.update | 14-life.js:71 | 26-radio-dust-tv.js:41 | Distance gain. A uses one source (dress.radio), indoor factor and power. B uses the nearest of world.speakers and shop().volume. |
| radioUse / radioNext | 14-life.js:48 | 26-radio-dust-tv.js:47 | Cycle station plus toast. A goes off after the last station, B cycles through 'off'. |

## 4. In one game only, but engine-worthy

| name(s) | A file:line | B file:line | note |
|---|---|---|---|
| devLink, DEV_PORT, DEV_AUTO | 14-devlink.js:7, 11 | none | Link state and Electron auto-probe. |
| devProbe, devLinkBadge, devLinkToggle, devLinkStop, devPost, tickDevLink | 14-devlink.js:12, 23, 24, 36, 37, 38 | none | Whole SSE plus POST link. Port and badge id become parameters. |
| devState | 14-devlink.js:16 | none | Engine fields (version, day, time, bank, level) plus GAME.devState() for the rest. |
| showLevelCard, hideLevelCard, tickLevelCard | 14-events.js:139, 147, 148 | none (gainXp toasts at 03-log-sound.js:101) | Card frame plus timer. GAME supplies the opens list. |
| showDayReport, hideDayReport, tickReport | 14-report.js:18, 27, 28 | none | Day card frame plus timer. GAME supplies the grid rows. |
| daySnapshot, closeDay, DAY_KEEP | 14-report.js:8, 9, 7 | none | Snapshot-delta-keep-N mechanism. GAME supplies the field list. |
| menuBody | 13-ui.js:191 | none | Body takes over the card with a Back button. |
| btn | 13-ui.js:56 | none | data-act button helper. |
| updatePrompt | 13-ui.js:22 | none | The E prompt. Needs a GAME focus-text hook. |
| hudDirty throttle | 03-state.js:111, 13-ui.js:5 | none | Dirty flag plus 0.25 s HUD cadence. |
| pad2, dist2, uid | 01-head.js:31, 33, 34 | none | Utilities |
| BOOT_SAVE (raw peek before layout) | 01-head.js:18 | none | Lets a game size the world from the save before building it (A uses it for BOOT_STAGE). |
| RECOVER_KEY, bootIssue, BOOT_FRESH_MSG, recoverTag | none | 02-state.js:47, 48, 49 | Boot recovery state. |
| bootFailed | none | 36-boot.js:5 | Reloads once into a fresh in-memory game and never writes the slot. A has only the catch inside load. |
| migrate (fill depth plus SAVE_V gate) | none | 02-state.js:89, 14 | The engine owns the fill and the version. GAME.migrate(s, from) owns the steps. |
| lockRetry | none | 34-processing-panes.js:54 | Chromium Esc cooldown retry. |
| closeTopUi | none | 35-daynight-input.js:89 | Right-click closes one layer. Needs a layer registry. |
| ui.refreshOpen | none | 33-ui.js:11 | Re-render every open surface. |
| storage listener (settings sync across tabs) | none | 34-processing-panes.js:480 | Re-reads settings when another tab changes them. |
| slider, check, select, chip | none | 34-processing-panes.js:442, 443, 444, 69 | Settings and start-screen helpers. |
| mtof, STATION_ORDER | none | 26-radio-dust-tv.js:12, 11 | Radio utilities |
| offline catch-up | none | 36-boot.js:15-17 | Elapsed time capped at 6 h, then step(elapsed, true). Optional GAME.catchUp. |
| hooks, runHooks | none | 05-actions.js:187, 188 | The existing hook bus. The engine's GAME hooks generalise it. |
| defightScene, defightSoon | none | 36-boot.js:59, 95 | Z-fight pass. A render utility, outside the parts named here. |

## 5. Stays in the game

- **A 01-head.js:** stageForOwned, BOOT_STAGE.
- **A 03-state.js:** the freshState body, the migration steps inside load, pay, addRep, addXp's ladder cap.
- **A 13-ui.js, HUD and panels:** the updateHud fields; scanner: scanToggle, scanPageOpen, scanPage, sw, SCAN_PAGES, SCAN_LVL; PC and bench: PC_TABS, TAB_LVL, tabOpen, pcTabs, orderCard, pcHtml, benchHtml, panelAct; shop: shopShows, buyUpgrade.
- **A 13-ui.js, other:** the devCommand bodies, the guideHtml text, the intro settings row.
- **A 14-report.js:** reportHtml, reportRows.
- **A 14-devlink.js:** devState's game fields.
- **A 15-boot.js:** tickWorld, the load repairs at 15-boot.js:3-17, the menu orbit camera at :39, the start-chip text, the T entries.
- **A 14-life.js:** radioPrompt and the STATIONS data.
- **B 00-head.js:** gram.
- **B 02-state.js:** the loadNormalise body, the fresh body, slots, lightObj, lightIdx; stash and lots: stashOf, lotOf, stashAdd, stashDraw, lotAdd, stockOf, stockCount, isGoods, stockStore, stockDraw, stockTake, stockToShelf, shelfToStock, lotDraw, lotCount, strainsWithGoods, syncTotals, curedAvgQ, curedAvgThc; plantById, plantAtSlot.
- **B 03-log-sound.js:** gainXp's unlocks, humUpdate; prices: ECON, gradeMult, premiumMult, repMult, gramValue, bagPrice, jointPrice, cookiePrice, unitPrice; books: COST, headcount, spendOp, books, bookSale, billLines, dailyFixed, drawFunds, payBills, bizTax, taxDue, taxDay, monthlyTax; text: daysText, kindName.
- **B 26-radio-dust-tv.js:** the STATIONS data, and radioNext's shop()/applyShopState; panes: FRONT_CURTAINS, MINI_CTL, paneMiniCtl, paneControls; dust: binsFull, dustList, spawnDust, dustSpotFree, updateDust, syncDust, sweep, buildBroom, syncBroom; upstairs: UP, STAIR, STAIR2, stairT, groundY, upBox, buildUpstairs; TV: tv, TV_CHANNELS, buildGrowCam, tvCycle (two copies under `#if desk`), drawTv, drawNews, tvInView, updateTv.
- **B 33-ui.js:** the ui.render panel list.
- **B 35-daynight-input.js:** the updateDayNight body; the keydown, wheel and mousedown key maps.
- **B 36-boot.js:** the build call list at :19, the simTick body, the start chips, the frame update list at :122-127, the RFGROW entries.

## How each boot runs

**A (Depot Co):**
1. 01-head reads BOOT_SLOT, sets SAVE, peeks BOOT_SAVE, derives BOOT_STAGE and reads SET.
2. 02-config builds the layout tables for that stage. `S = freshState()` runs while the file is parsed.
3. The world parts define their builders.
4. 15-boot:3 calls `load()` (migrations inline) and `sorterSpots()`. Lines 4-7 reconcile S.site with BOOT_STAGE and queue the "builders were in" toast.
5. Line 8 calls `buildWorld(); buildTools(); buildScanner()`. Line 9 builds truck and staff meshes. Lines 11-15 repair orphaned orders, returns and pallets.
6. Lines 16-18 run `updateHandMesh, applySettings, resize, rebuildDyn, drawBoard, buildAgv, bakeStatic`. Line 19 places the menu camera. Lines 20-21 fill the start screen.
7. Line 31 binds `enter`. Line 47 starts `requestAnimationFrame(frame)`. Line 49 starts the hidden-tab interval, line 50 the beforeunload save, line 53 sets `window.DEPOT`.

A's frame order: reschedule, then dt clamped to [0.001, 0.05]; if not started, the orbit camera; if started and not blocked: photoTick, or tickWorld (tickTime, tickTrucks, tickOrders, tickReturns, tickStaff, tickEvents, rebuildDyn) plus updatePlayer, autosave every 30 s; worldTime increments; presentation: doorAnim, placeTools, syncInstances, lighting, updateLightBudget, shadowTick, tickDressing, tickYard, tickLife, tickBursts, doorsTick, drawScreens, tickScanner, tickReport, editTick, tickTimeClock, tickPc, animated[]; shell: interact, updatePrompt, updateHud, tickLevelCard, tickDevLink; renderFrame, then the FPS readout.

**B (Grow Co):**
1. 00-head resolves SAVE (slot, override, legacy move). 02-state defines settings and installs the unload saves. Parts 03-35 register hooks and DLC.
2. 36-boot:13 opens a try block: `loadSettings(); load()` (recover check, parse, loadNormalise, migrate), then `dlcLoaded()`.
3. Offline catch-up: `step(elapsed, true)`, then `shop()` and offline dust.
4. Line 19 makes about 25 build calls, then applyFixtures, applyDlcWorld, introDraw, applyShopState, syncDust, applySettings, resize, updateDayNight. The catch calls `bootFailed`.
5. Line 21 runs `runHooks(hooks.boot)`, then defightScene twice, async model load, camera to player.
6. The startScreen IIFE fills the chips and binds the start button. The bootIssue note follows.
7. Line 53 starts `setInterval(simTick, 1000)`. Line 130 calls `frame()` directly. Then `window.RFGROW` and `.test`.

B's frame order: reschedule, then dt = min(getDelta, 0.1); desk board fetch; always run: curtains, staff door, radio.update, broom, TV, editUpdate, hooks.frame; if the menu is not open, about 33 world and NPC updates; always run: updateDayNight, updateLightBudget, bakeTick, updateShadowTimer, security, pcZoom, menuDrive, photo; debounced defight; render (security cam or main camera), then FPS. The simulation itself is simTick, once a second: step(1), events, customers, debounced save, hud.

## Proposed engine boot (90-boot.js)

`CO.boot(GAME)` runs:
1. 40-state picks the slot and key, merges engine defaults with GAME.settings, and peeks the raw save (`GAME.peek(raw)` returns layout parameters).
2. Inside a try: `S = loadSave(GAME.freshState, GAME.migrate)` (fill plus SAVE_V gate plus the recover key); `GAME.afterLoad(S, loaded)`; optional `GAME.catchUp(elapsed)`; `GAME.buildWorld()`; `applySettings()` (engine part, then `GAME.applySettings`); `resize()`; `runHooks('boot')`. The catch calls `bootFailed`.
3. Start screen: chips come from `GAME.startStats(S, loaded)`. `enter()` sets ui.started, locks the pointer and calls `GAME.onEnter(loaded)`.
4. Each frame: dt clamp; `GAME.menuCamera(dt)` until started; if running, `GAME.tick(dt)` per frame, or on a fixed interval when `GAME.tickMode = 'fixed'`; autosave timer; `GAME.present(dt)`; shell: prompt, `GAME.hud()` under the dirty throttle, level and day cards, devlink tick; `GAME.render(dt)`, or `renderer.render` by default; FPS.
5. Hidden-tab tick when `GAME.tickWhileHidden`.
6. `window[GAME.handle] = { enter, version, T: merge(engineT, GAME.T) }`. The devlink and F8 command table is `merge(engineCommands, GAME.commands)`.

## Summary

1. **Function counts per file.** A: 01-head 15, 03-state 7, 04-sound 9 (plus 36 SFX voices), 13-ui 26 (plus 5 listeners), 14-devlink 7, 15-boot 3 (plus the rAF, the interval, the unload listener and the handle), 14-report 7. Total 74. B: 00-head 10, 02-state 35, 03-log-sound 33 (plus 56 SFX voices), the 26 radio part 9 (30 in the whole file), 33-ui 5 ui methods, 35-daynight-input 3 (plus 11 listeners), 36-boot 8. Total 103 with the radio part only, 124 with all of 26.
2. **Counts per section.** Section 1 has 17 rows, section 2 has 26, section 3 has 34, section 4 has 23, and section 5 covers about 120 names in groups.
3. **"00-head.js" and "30-sound.js".** 00-head.js: the closure and the guard, plus the utilities from section 1, pad2, dist2, uid, fmtTime, mtof, and a signed money. 30-sound.js: audio with SET.vol, sTone/sNoise/sThud/sBeep, sfx, the 12 base voices (GAME adds the rest), the radio scheduler plus tone/noise into a radio bus with distance gain from `GAME.radioSources`, and the hum loop-voice helper.
4. **"40-state.js" and "41-shell.js".** 40-state.js: slot and key with the override and legacy move, SET defaults merged with GAME rows, load and saveSettings plus the storage sync, the raw peek, load with the recover key and keepBrokenSave, fill plus versioned migrate, debounced save plus saveNow plus writeSave with a one-time failure toast and saveBlocked, wipe/reset, the unload listeners. 41-shell.js: the ui layer registry (blocked, closeTopUi, refreshOpen), logEvent/feedPush/toast, the HUD throttle and prompt, the panel frame, the pause menu with menuBody, the settings panel with its helpers, applySettings, guide and stats slots, B-style save export/import, screenshot, resize, lockPointer/lockRetry, the level card and day card frames with daySnapshot/closeDay, btn and chip.
5. **"50-devlink.js" and "90-boot.js".** 50-devlink.js: A's SSE link (port, probe, devState with GAME fields, badge, toggle, stop, post, tick) plus a devCommand dispatcher over the engine commands (saveNow, reload, setTime, cash, level) and GAME.commands. B's F8 console can be a second front end on the same table. 90-boot.js: the boot above. Design choice: A runs its world tick per frame and B runs a fixed 1 s sim with offline catch-up. The engine needs both modes. B's `//#if desk` preprocessor lines have to keep working inside the engine parts.
