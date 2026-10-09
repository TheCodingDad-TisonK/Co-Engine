# The engine contract

What a game on Co Engine writes against, as of v0.1.4. One HTML page, one closure: the build script opens the closure, joins the engine's parts (`engine/NN-*.js`) in front of the game's (`src/NN-*.js`), and closes it. A game part may use any engine name at its top level once `CO.setup` has run, which the game's first part does.

## The two calls

**`CO.setup(cfg)`** in the game's first part. It reads the settings and the save slot, makes the renderer, the scene, the camera, the sun and the sky bounce, draws the base textures and the palette, binds the page, makes the player, then runs the `setup` hooks.

| cfg | default | what it is |
|---|---|---|
| `canvas` | `co-canvas` | the canvas element id (made if missing) |
| `save` | `co-game` | the save key prefix: `<prefix>-slot` holds the slot number, `<prefix>-slot<n>` the save, `<prefix>-settings` the settings; `?save=<name>` on the page opens `<prefix>-<name>` instead, a save of its own |
| `settingsKey`, `slots` | prefix-settings, 3 | |
| `settings` | | extra settings with their defaults, merged over the engine's (`sens, invertY, quality, sound, vol, fps, fov, film, bob`) |
| `game` | `{}` | the hook object, `CO.game` (section 3); `CO.boot(GAME)` merges more into it |
| `spawn` | `{x: 0, z: 0, yaw: 0}` | where the player stands at boot |
| `exposure, background, fog, fov, near, far` | 0.82, 0x8fb0d4, {70, 190}, SET.fov, 0.08, 260 | the renderer and the camera (`background: null` for none) |
| `env` | true | the reflection studio |
| `hemi` | `{sky, ground, intensity}` | the sky bounce |
| `sun` | `{color, intensity, box 70, near, far 230, mapSize 4096, target [0,0,-20]}` | the shadow-casting sun |
| `lightBudget` | 12 | how many point lights stay visible |
| `post` | true | the post pass (grade, vignette, grain) |
| `palette` | true | `false` skips the engine's textures, normal maps and materials: the game draws its own |
| `input` | true | `false` binds none of the engine's keys, mouse or pointer lock: the game has its own |
| `saveDebounce` | 0 | milliseconds: `save()` coalesces a burst of calls into one write; `saveNow()` writes at once |

**`CO.boot(GAME)`** in the game's last part. It loads the save, builds the world, applies the settings, bakes, fills the start screen, starts the frame loop and publishes the handle.

| GAME | what it is |
|---|---|
| `handle` | the window property the game publishes (`DEPOT`): `window.<handle> = { enter, bootSlot, version, engine, T }` |
| `version`, `versionGlobal` | the game's version, or the global `sync-version` writes (`GAME_VERSION`) |
| `freshState()` | the game's default `S` |
| `migrate(s, fresh, missing)` | its save migrations, run on a loaded save with the fresh state's missing top-level keys already filled in; `missing[key]` is true for each one that was, so an old save can be told from a new field |
| `afterLoad(loaded)` | repairs on `S` before the world is built |
| `buildWorld(loaded)` | the walls, the floors, the props (`buildProps()`), the people, the sky (`buildSky`) |
| `afterBuild(loaded)` | meshes for the saved things |
| `bake` | `false` skips the static bake |
| `startStats(loaded)`, `startNote(loaded)` | the start screen's chips (strings) and the line under them |
| `onEnter(loaded)` | after the start button |
| `tick(dt)` | the world, once a frame while running (not blocked, not in photo mode) |
| `weather` | `false` turns the weather state machine off (the game ticks `tickWeatherState` itself) |
| `autoplay` | `false` leaves the `<prefix>-autoplay` session flag to the game's own front menu |
| `editMode`, `photo`, `lighting`, `hudFields` | `false` switches that engine pass off: the game brings its own build mode, photo mode, light by the hour, or HUD fields |
| `render(dt)` | draws the frame itself; return true |
| `boxSolid(w, h, d, x, y, z, opts)` | takes a `box(..., { solid: true })` footprint into the game's own blockers |
| `present(dt)` | the game's own per-frame presentation, after the engine's |
| `menuCamera(dt)` | the camera behind the start screen (default: an orbit) |
| `hiddenTick(dt)` | what still ticks in a hidden tab beside `tick` and the doors |
| `step(dt)` | what `T.run` calls beside `tick`, for the tests |
| `T` | an object or a function returning one: what the game adds to the test handle |

Any other field of GAME is a hook (section 3).

## The frame

Each frame, in order: the menu camera until `enter`; then, when started and not blocked, `photoTick` or `GAME.tick(dt)`, the weather, `updatePlayer(dt)`, the autosave timer; `worldTime` advances; `lighting`, the light budget, the shadow timer, the sky, bursts, doors, screens, build mode, traffic; `GAME.present(dt)` and the `frame` hooks; the `animated` list; focus, prompt, HUD, cards, the dev link; the render; the FPS readout.

While `CO.paused` is true the frame only ticks the scene camera, the light budget and the shadows and renders; nothing in the world moves. `CO.stepOnce = true` lets exactly one full frame through. The editor's pause and step buttons set these.

## 3. Hooks on CO.game

All optional. Where a hook returns a value the engine uses it; where it returns true the engine treats the thing as handled.

**World**
- `floorY(x, z, y)`: the floor height; default 0. `insideWalk(x, z)`: walkable ground for the crew; default everywhere. `indoors(x, z)`: under a roof, for the rain's sound. `roofAt(x, z)`: the roof height over a point, for the rain and snow; default 0 (outdoors). `powered()`: the mains, for the lamps; default true. `shadowLive()`: something big is moving, redraw the shadow map every frame.
- `groundY(x, z)`: the floor a prop stands on. `wallPlanes()`: faces a wall prop can hang on, `[{a: 'x'|'z', v, n, z0, z1 | x0, x1}]`. `editClamp(pt, def)`: keep a carried prop inside the site; returns `{x, z}`. `canEdit()`: gates build mode. `editBlocked()`: F2 does nothing now.
- `resolveDef(id, def)`: rewrite a prop's default spot for the world as it stands. `propAllowed(id, def)`: whether a prop stands now. `propWhere(id)`: where a removed prop stood, in words. `propOpen(def)`: whether a catalogue item is for sale now. `catalogueGroups`: `[[cat, heading, note]]`.
- `navPass(x, z)`: a point outside the walkable ground a walker may still cross (a docked trailer). `doorOpeners()`: `[{x, z}]`, the people with keys that doors open for.

**Player and input**
- `playerOverride(dt)`: take the frame (a vehicle, a seat); return true. `speedMul()`: scales the walk. `stepSurface(x, z, y)`: the step sound's surface. `collides(x, z, opt)`: the game's own blockers. `skipDyn(d)`: a dynamic blocker to ignore now.
- `hitObjects()`: more meshes to look at (instanced meshes). `hitDef(hit)`: a `{prompt, use, alt}` for one of them. `hitPriority(hit, first)`: this hit wins over the nearer one. `focusOff()`: no focus now.
- `useOverride()`: E, before the focus. `useFallback()`: E with nothing focused. `putDown()`: G with nothing focused.
- `mouseLook(e, sx, iy)`: take the mouse. `key(e)`: take a key before the engine's own bindings (after F12, F3, F9, Esc, F2 and build mode). `escape()`: take Esc first. `wheel(dir, e)`: take the wheel. `scanToggle(on)`: the game's own overlay the engine closes. `blocked()`: more layers that block the world. `photoBlocked()`: no photo mode now. `promptHidden()`: hide the E prompt.

**Shell**
- `hud()`: fill the HUD fields (under the dirty throttle). `panel(kind, tab)`: `{title, tabs: [[id, label]], tab, body}`. `panelAct(act, arg)`: a `data-act` button; return true when taken. The engine takes `restore` and `buy` only on its own catalogue panel, so a game's shop may have a `buy` of its own. `menu(k, button)`: a `data-menu` the engine does not know. `menuLine()`: the pause menu's first line. `guideHtml()`, `statsHtml()`, `settingsHtml()`: extra rows (`data-set` names the engine does not know go to `setting(k, v)`). `saveLooksRight(s)`: before an import.
- `devState()`: extra readout fields. `commands`: `{name: function (arg) { return 'what happened'; }}`.

## 4. Hooks on the bus

`hook(name, fn)` registers; the engine calls `runHooks(name, ...)`: `setup(cfg)`, `beforeBuild(loaded)`, `afterBuild(loaded)`, `boot(loaded)`, `enter(loaded)`, `frame(dt)`, `hud()`, `lighting(day, dawn, overcast, power)`, `sky(weather, dt)`, `weather(kind, prev)`, `settings(SET)`, `menuOpen()`, `panelAct(act, arg)`, `photo(on)`, `propCtx(ctx, g, id)`, `propBuilt(id, inst, def)`, `propRemoved(id, inst)`, `propPlaced(id, inst, def)`, `propDeleted(id, def)`, `editBought(c, def)`, `lockAll(lock)`, `humanMade(g, opt)`.

## 5. The page

The engine reads these elements when they exist and does nothing when they do not: `dc-start`, `dc-start-btn`, `dc-start-stats`, `dc-start-note`; `dc-hud` with `h-prompt`, `h-toasts`, `h-feed`, `h-fps`, `h-devlink`, `h-edit`, `h-day`, `h-clock`, `h-cash`; `dc-panel` with `dc-panel-title`, `dc-panel-tabs`, `dc-panel-body`, `dc-panel-close`; `dc-menu` with `.dc-menu-btns`, `dc-menu-body`, `dc-menu-sub`, `dc-m-devlink` and buttons carrying `data-menu` (`resume, back, edit, devlink, settings, guide, stats, saves, download, import, reset, quit`, else the game's); any card element named in `showCard`.

## 6. The prop definition

`defProp(id, def)`: `label, x, z, rot, y, cat, wall, fixed, extra, price, ico, desc, lvl, noBlob, quietPlace, when(), snap(def, pt, selfId), build(ctx, P, inst), after(ctx, P, inst)`. The ctx: `box, cyl, sphere, plane, sign, hit, solid, light, dynGroup, add, group, obstacles, id`, plus what the `propCtx` hooks add. Placement: `S.layout[id] = {x, z, rot, h, hidden}`; bought copies: `S.custom = [{id, type, x, z, rot, h}]`.

## 7. The editor bridge

Since 0.1.5 the page carries `CO.editor` (`engine/60-editor.js`), published as `window.CO_EDITOR` and switched on by `?editor=1` in the page's query (the editor's viewport loads the page with `?dev=1&editor=1`). It is the one surface the editor, the MCP server and a test talk to:

- `tree()`: what stands in the scene, by category (props by catalogue group, lights, people, doors, screens, vehicles, other), with counts, the time, the selection, the pause and scene-camera flags. Every object gets a stable id (`e<n>` stamped in `userData.eid`; a placed prop's id is its layout key).
- `inspect(id)`: the transform, material, geometry, light, screen and prop fields (type, label, category, x, z, turn, height, hidden, moved, solids) of one thing; `set(id, path, value)` edits them (`prop.x`, `prop.z`, `prop.rot`, `prop.h`, `prop.hidden`, `prop.reset` go through the layout and the save; `position.*`, `rotation.*` in degrees, `scale.*`, `visible`, `material.color`, `material.emissive`, any numeric material or light field, `name` edit the live object).
- `select(id)` draws the selection box, `pick(nx, ny)` raycasts a viewport point (baked merges, helpers, hit volumes and hidden things skipped), `frame(id)` flies the scene camera to a thing, `spawn(type, x, z)` places a copy ahead of the camera, `remove(id)` takes a placed prop out.
- `mode('scene' | 'game')` is the engine's photo camera on or off; `pause(v)` and `step()` drive `CO.paused` and `CO.stepOnce`; `enter()` starts the game from its menu (`GAME.editorEnter` when the game's own menu needs a click, else the engine's `enter`); `command(line)` runs a dev command; `assets()` lists the prop definitions, materials, textures, sounds, people presets and catalogue groups; `shot(q)` returns the viewport as a JPEG data URL; `sfx(name)` plays a sound.
- In the viewport there is no pointer lock (a locked pointer in an embedded page brings Electron down): a left click picks and selects, and the look follows the mouse while the right button is held, in the scene camera and in the game alike. The game reports a selection with a `console.log('[co-editor] {...}')` line that the editor catches.
- A game extends the tree and the inspector with `GAME.editorTree(eid)` (extra categories) and `GAME.editorInspect(obj)` (a `game` group of fields), and names its menu's start with `GAME.editorEnter()`.
- The same bridge is what the editor's MCP server (`editor/mcp.js`) exposes to Claude Code, tool by tool (status, scene_tree, inspect, set, select, frame, spawn, remove, camera, pause, step, command, assets, screenshot, console_log, plus open_game, play, reload, build, check, test on the editor itself). A game folder's `.mcp.json` names it; the template carries one.

## 8. The test handle

`window.<handle>.T` carries the engine's part (`S`, `player`, `ui`, `edit`, `run(sec)`, `setTime`, `lookAt`, the props, doors, screens, panels, menu, cards, photo, dev link, people, vehicles, weather, bake and helpers; see `coHandle` in `engine/90-boot.js`) merged with `GAME.T`. The smoke runner (`tools/smoke-runner.js`) wraps a scenario body with `T`, a live `S`, `ok`, `info`, `near` and `wait`, and fails the run on any page error.
