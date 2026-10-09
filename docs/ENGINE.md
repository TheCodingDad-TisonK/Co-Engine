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

`defProp(id, def)`: `label, x, z, rot, y, cat, wall, fixed, extra, price, ico, desc, lvl, noBlob, quietPlace, when(), snap(def, pt, selfId), build(ctx, P, inst), after(ctx, P, inst)`. The ctx: `box, cyl, sphere, plane, sign, hit, solid, light, dynGroup, add, group, obstacles, id`, plus what the `propCtx` hooks add.

Where a prop stands comes from three layers, each over the last: the definition's `x, z, rot`; the **shipped layout** (0.1.8), `CO.layout({ props: { id: { x, z, rot, h, hidden } }, placed: [{ id, type, x, z, rot, h }] })`, which the editor writes into `src/00-layout.js` (the first part in the build, so the boot sees it) whenever something is moved, hidden or placed in it; and the player's save, `S.layout[id] = {x, z, rot, h, hidden}`. `placed` entries are copies of a definition that ship with the game, built like props under their own ids; a player's own bought copies live in `S.custom = [{id, type, x, z, rot, h}]`. `propPlacement(id)` resolves the three layers, `propDefault(id)` the shipped place without the save. The editor's bridge reports the file to write with `layout()` (`props`, `placed`, `changed`, `copies`, `pending`, `code`) and takes the written one as the new baseline with `layoutAdopt(L)`: the copies it carries leave the editor's save and the save's overrides equal to the baseline go, so `pending` reads 0 until the next change.

## 6b. The terrain (0.2.0)

`CO.terrain({ w, d, cell, x0, z0, heights, paint, palette, maxH })` makes the ground a heightmap: `w` by `d` cells of `cell` metres from `x0, z0`, `heights` as `(w + 1) * (d + 1)` corner values row by row, `paint` as `w * d` indices into `palette` (`grass, dirt, gravel, sand, road, snow, water` by default; `CO.terrainPaint(name, { base, dots, n, r })` adds one). The editor writes it into `src/00-terrain.js`, which runs before the boot; `terrainBuild()` makes the mesh (one `BufferGeometry` under a painted canvas, out of the bake) when the world builds. `terrainY(x, z)` is the ground height (bilinear; 0 off the terrain) and the engine's `floorY` and `propGroundY` take the higher of the game's floor and the terrain, so the player and the props follow the ground. `terrainBrush(x, z, mode, radius, strength, tex)` raises, lowers, smooths or flattens the corners within the radius with a soft falloff, or paints the cells; `terrainScatter(type, count, onPaint, seed)` places copies of a definition on the cells painted with one name, through the shipped layout. In the editor the Terrain tab makes one and the left button sculpts and paints it in Scene mode.

## 6c. Materials from a layer graph (0.2.0)

`CO.material(name, graph)` paints a texture from a stack of layers and registers it as `MAT[name]`, so a build function can say `MAT.myBrick`. A graph is `{ size, repeat: [rx, ry], layers: [{ type, color, color2, alpha, blend, n, size, size2, gap, angle, dark, vary }], roughness: 0.9 or { base, amp }, metalness, bump: { amp, strength } or null, emissive, emissiveIntensity, glow, opacity }`; the layer types are `fill, grain, blotches, cracks, noise, bricks, planks, tiles, stripes, checks, rings, speckle`, the blends the canvas's. Calling it again for the same name updates the same material in place, so every mesh on it follows. The editor writes `src/00-materials.js`; its Materials tab edits the stack with a picture (`matShot`) beside it.

## 6d. Packs (0.2.0)

A pack is a folder `packs/<name>/` in the engine with `pack.js` (a part: `defProp` calls and their helpers, built from the engine's kit alone) and `pack.json` (title, description). The editor's Assets tab lists the packs and copies one into a game as `src/00-pack-<name>.js`; the game then places the props from Assets and ships what it placed through the layout. Pack props are `extra: true, shop: false`: placeable in the editor, not sold by the catalogue. `basics` carries a control panel with a touch screen that opens and closes the gates, a sliding gate and a boom barrier (use them by hand or from the panel; their state lives in `S.pack`), a lever, signs, a crate, a pallet, a bench, a bin, a cone, a lamp post, a fence section and a planter.

## 6e. Clips: animation as data (0.2.1)

`CO.clip(name, { duration, loop, tracks: [{ path, keys: [[t, value, ease]] }], events: [[t, name]] })` registers a clip; `playClip(obj, name, { loop, speed, blend, hold, onDone })` plays it on an object and `stopClip(obj)` stops it; the engine drives the playing list every frame (`clipTick` on the animated list, after the game's own passes, so a clip's keys win over the people rig's limb motion while it plays). A path names a node and a field: `rotation.x`, `position.y`, `scale.z`, `visible`, `opacity` on the object, `child.2.rotation.y` its third child, `name.lamp.rotation.z` a named descendant, and on a person `leg.0`, `knee.1`, `arm.0`, `elbow.1`, `torso`, `head` with their fields. Ease is `smooth` (default), `linear`, `in`, `out` or `step`; `blend` eases in from the pose the object had; an event fires `runHooks('clipEvent', obj, name, play)`. The built-in clips are `wave, nod, cheer, point, lift` for a person and `spin, bob, swing, blink` for a prop. The editor's Animation tab plays, scrubs and keys a clip on the selected object (`clipKeyPose` writes the current pose into every track at a time) and writes the game's own clips to `src/00-clips.js`.

## 6f. UI as data (0.2.1)

`CO.ui({ hud: [{ label, value, color }], panels: { kind: { title, text, buttons: [{ label, action, primary, close }] } }, start: [expr], menuLine: expr, guide: text })` describes HUD chips (a row of their own under the engine's), panels (`openPanel(kind)` shows one: paragraphs and `- ` lists from the text, buttons that run a dev command such as `cash 100` or an expression), the start screen's chips, the pause menu's line and the guide, without code. Every value is an expression over the kit (`S.day`, `money(S.bank)`, `fmtTime(S.time)`). The game's own `GAME.hud`, `GAME.panel`, `GAME.startStats`, `GAME.menuLine` and `GAME.guideHtml` still win where they exist. The editor's UI tab edits it and writes `src/00-ui.js`.

## 7. The editor bridge

Since 0.1.5 the page carries `CO.editor` (`engine/60-editor.js`), published as `window.CO_EDITOR` and switched on by `?editor=1` in the page's query (the editor's viewport loads the page with `?dev=1&editor=1`). It is the one surface the editor, the MCP server and a test talk to:

- `tree()`: what stands in the scene, by category (props by catalogue group, lights, people, doors, screens, vehicles, other), with counts, the time, the selection, the pause and scene-camera flags. Every object gets a stable id (`e<n>` stamped in `userData.eid`; a placed prop's id is its layout key).
- `inspect(id)`: the transform, material, geometry, light, screen and prop fields (type, label, category, x, z, turn, height, hidden, moved, solids) of one thing; `set(id, path, value)` edits them (`prop.x`, `prop.z`, `prop.rot`, `prop.h`, `prop.hidden`, `prop.reset` go through the layout and the save; `position.*`, `rotation.*` in degrees, `scale.*`, `visible`, `material.color`, `material.emissive`, any numeric material or light field, `name` edit the live object).
- `select(id)` draws the selection box, `pick(nx, ny)` raycasts a viewport point (baked merges, helpers, hit volumes and hidden things skipped), `frame(id)` flies the scene camera to a thing, `spawn(type, x, z)` places a copy ahead of the camera, `remove(id)` takes a placed prop out.
- `mode('scene' | 'game')` is the engine's photo camera on or off; `pause(v)` and `step()` drive `CO.paused` and `CO.stepOnce`; `enter()` starts the game from its menu (`GAME.editorEnter` when the game's own menu needs a click, else the engine's `enter`); `command(line)` runs a dev command; `assets()` lists the prop definitions, materials, textures, sounds, people presets and catalogue groups; `shot(q)` returns the viewport as a JPEG data URL; `sfx(name)` plays a sound.
- In the viewport there is no pointer lock (a locked pointer in an embedded page brings Electron down): a left click picks and selects, and the look follows the mouse while the right button is held, in the scene camera and in the game alike. The game reports a selection with a `console.log('[co-editor] {...}')` line that the editor catches.
- A game extends the tree and the inspector with `GAME.editorTree(eid)` (extra categories) and `GAME.editorInspect(obj)` (a `game` group of fields), and names its menu's start with `GAME.editorEnter()`.
- **Undo and redo** (0.1.7): every edit the bridge makes is a step on a stack, `undo()`, `redo()`, `history()`: a prop field as a layout snapshot before and after, a live field as its old and new value (`get(id, path)` reads one), a spawn, a remove. Ctrl+Z and Ctrl+Y work in the viewport and in the editor. The game's own build mode is play, not editing, and is not on the stack.
- **Pack authoring** (0.1.7): `source(type)` gives a prop definition's build function as text, its fields, its placed instances and the kit; `preview(type, code)` compiles a new build function and rebuilds every placed copy at once (a build that throws is refused and the previous one stays); `revert(type)` puts the original back; `define(code)` runs a whole `defProp(...)` live (a placed one builds at once, an extra joins the assets, a known id is redefined in place); `adopt(type)` makes a previewed build the baseline after it was saved. The code runs outside the closure with the kit in scope: `kit()` lists the names (THREE, MAT, TEX, S, SET, box, cyl, sign, tex, textTex, std, glowMat, clamp, lerp, uid, floorY, propWorld and the rest of the engine's helpers), and a game adds its own with `GAME.editorKit` (an object, or a function returning one). The editor writes the saved function back into the `src/` part that holds it, and appends a new definition to the part with the most `defProp` calls.
- **The profiler** (0.1.7): `profile(true)` starts sampling, `profile()` reports fps, the frame's phases (sim, world, present, ui, render) in ms as averages and the last 120 frames, p95 and max, draws and triangles of the scene pass, programs, geometries, textures, the heap, and the counts (props, baked meshes and their draws, dynamic, interactive, solids, animated, lights against the budget); `profile(false)` stops it and drops the samples. The frame marks its phases only while sampling is on.
- **Saved into src** (0.1.8): the editor writes `src/00-layout.js` a moment after every move, hide, spawn or remove (its tree refresh compares `layout().code` with what it last wrote), the Pack tab writes build functions back where they live, and Ctrl+S (`save`) does both at once. **Release** (0.1.8): from the Build menu or the `release` tool, with a version, a title and notes: `package.json` and the lock take the version, `CHANGELOG.md` gets the entry on top, the game builds and checks (and builds the installer onto the Desktop when asked), everything is committed as `Release vX.Y.Z`, pushed, and the GitHub release is created with the notes (through `gh` when it is on the PATH, else by pushing the tag), after which the repo's Release workflow attaches the installer. `release_preflight` tells what would happen first.
- The same bridge is what the editor's MCP server (`editor/mcp.js`) exposes to Claude Code, tool by tool (status, scene_tree, inspect, set, select, frame, spawn, remove, camera, pause, step, command, assets, screenshot, console_log, plus undo, redo, history, prop_source, prop_preview, prop_revert, prop_define, pack_save, profile, layout_save, save, release_preflight, release, terrain, terrain_new, terrain_brush, terrain_scatter, terrain_off, materials, material_set, material_remove, material_shot, packs, pack_add, clips, clip_set, clip_play, clip_stop, clip_key, clip_remove, ui, ui_set, ui_open, and open_game, play, reload, build, check, test, run_script on the editor itself). A game folder's `.mcp.json` names it; the template carries one.

## 8. The test handle

`window.<handle>.T` carries the engine's part (`S`, `player`, `ui`, `edit`, `run(sec)`, `setTime`, `lookAt`, the props, doors, screens, panels, menu, cards, photo, dev link, people, vehicles, weather, bake and helpers; see `coHandle` in `engine/90-boot.js`) merged with `GAME.T`. The smoke runner (`tools/smoke-runner.js`) wraps a scenario body with `T`, a live `S`, `ok`, `info`, `near` and `wait`, and fails the run on any page error.
