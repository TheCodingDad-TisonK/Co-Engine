# Inventory 02: props, build mode, player (Depot Co = A, Grow Co = B)

Read-only pass on 2026-10-08.

**File abbreviations.** A06 = `Depot Co\src\06-props.js`, A12 = `Depot Co\src\12-player.js`, A12p = `Depot Co\src\12-photo.js`. B28 / B29 / B30 = `RF Grow Co\src\28-props.js`, `29-prop-defs.js`, `30-edit-player-hands.js`.

**Where B keeps the rest of this layer.** Some of B's player and build-mode code lives in other files, so it is cited by full name: `32-interaction.js` (the focus raycast), `34-processing-panes.js` (pointer lock), `35-daynight-input.js` (input listeners), `35-dlcy-photo.js` (photo mode), `game/grow3d-creative.js` (the Del key remove and restore; outside `src/`).

**Headline.** No top-level function has the same body in both games. Section 1 therefore lists only shared state and shared code blocks.

## 1. Identical

| name(s) | A file:line | B file:line | note |
|---|---|---|---|
| `PROPS`, `PROP_ORDER`, `propInst` | A06:6 | B28:5 | Same three registries with the same roles. |
| `ray` (Raycaster, far 3.4) | A12:65 | 32-interaction.js:3 | Same. B also enables `TOWN_LAYER`. |
| edit hover reach (`ray.far = 7`, then back to 3.4) | A12:86 | B30:28, B30:30 | The same trick in both. |
| carried-prop floor point (ray hits the floor plane within 10 m, otherwise 2.6 m ahead) | A06:141-145 (in `editAim`) | B30:21-22 (in `editUpdate`) | Same lines. B then clamps the point to ROOM. |
| layout record written on drop (`{x, z}` rounded to 0.01, `rot`) | A06:204 | B30:49 | Same. A also stores `h`. |
| quarter-turn group rotation (`g.rotation.y = P.rot * PI/2`) | A06:77 | B28:102 | Same. |
| keyup listener | A12:158 | 35-daynight-input.js:76 | Same. B adds `taskPress` on Space. |
| window blur listener (`player.keys = {}`) | A12:161 | 35-daynight-input.js:77 | Byte-same. |

## 2. Same name, different body

| name(s) | A file:line | B file:line | note |
|---|---|---|---|
| `defProp` | A06:14 | B28:6 | A resolves the per-stage spot (`at`, `grown`, `wallX`, `unwallX`, `ungrown`, `abs`, `keep`, `yard`) and sets `def.id`. B only registers the def. |
| `propPlacement` | A06:28 | B28:66 | A merges `S.custom` records and `h`. B adds `floor` and `unit`, and sets `hidden` when the unit is not owned or its DLC is off. |
| `propCtx` | A06:39 | B28:74 | The signatures clash. A has `cyl(r,h,mat,..,seg,rb)`, `sphere`, `plane`, `poster`, and `solid` with a y range (x0/x1). B has `cyl(rt,rb,h,mat,..)`, `box` with options (`solid`, `sharp`, `cast`), `placard`, `fern`, `lit`, `dynGroup`, and `solid` as x1/x2 with no y. |
| `rotAABB` | A06:34 | B28:98 | The same quarter-turn mapping. A uses trig on `x0/x1/z0/z1`; B uses a discrete switch on `x1/x2/z1/z2`. |
| `buildProp` | A06:74 | B28:99 | A: removes the old instance via `removePropInst`, gates on `propStageOk`, takes y from `def.y` or `propGroundY`, skips registering hidden props, handles `beltPath`, sizes its ground blob to the footprint, adds to `scene`. B: cleans up the old instance inline, registers hidden props invisibly, takes y from `floor`, adds to `world.group`, honours `noBlob`, and passes `id` to `after`. |
| `propWorld` | 12-machines.js:20 | B28:113 | A works from the placement maths and returns `{x, z, a}`. B uses the group's `localToWorld` and returns a Vector3. |
| `editToggle` | A06:97 | B30:7 | A is gated by `unlocked('build')` and unbakes/bakes the static meshes. B runs `hooks.editMode` and writes the HUD hint. |
| `editHelper` | A06:106 | B30:15 | A takes a colour (orange while carrying, green while hovering). B is always green. |
| `editGrab` | A06:194 | B30:38 | A takes an id, refuses `fixed` props, ghosts the prop and resets the snap state. B grabs `edit.hover`, with fixture and tent branches. |
| `editDrop` | A06:201 | B30:44 | A takes `cancel`, stores `h`, and toasts belt links. B has fixture and tent branches. |
| `editRotate` | A06:208 | B30:52 | Same core. A refuses `fixed` props and loose wall props, and cycles belt snaps. B rotates fixtures and refuses the tent. |
| `editReset` | A06:215 | B30:59 | A refuses `fixed` props. B has fixture and tent branches. |
| `updatePlayer` | A12:30 | B30:110 | A: fork and PC cameras, speed 4.0 with a 1.55 run multiplier, buffs, jack, jump vy 6 with gravity 16, eye 1.62. B: drive, knockdown, crouch, sit, van, lerped velocity at 2.6/4.6/1.3, eye 1.65 stored in `pos.y`. |
| `interact` | A12:80 | 32-interaction.js:164 | **The name collides.** In A it is the per-frame focus raycast. In B it is the E-press action. |
| `lockPointer` | A12:114 | 34-processing-panes.js:53 | B retries after Chromium's cool-down via `lockRetry`. |
| `player` (state) | A12:3 | B30:92 | A uses flat `x/y/z`, `vy`, `grounded`, `tool`. B uses `pos` (Vector3), `vel`, `floor`, `air`, `crouch`, `radius`, `inVan`. |
| `edit` (state) | A06:96 | B30:5 | A has `snap`, `snapCycle`, `grabRot`, `wallAim`. B has `hover`, `tentDelta`, `grabbedFx`, `hoverFx`. |
| `photo` (state) | A12p:5 | 35-dlcy-photo.js:5 | A uses `x/y/z` and `speed`. B uses `pos`, `dir` and `side` vectors. |
| `focus` (state) | A12:6 | 32-interaction.js:4 | A's shape is `{prompt(), use(), alt, editId, prop, src}`. B's is `{mesh, data:{kind}, dist}`, read through `promptFor`. |
| keydown listener | A12:125 | 35-daynight-input.js:30 | The same edit keys (F2, E, R, Backspace; A adds Del, C, G). The rest is each game's own key map. |
| pointerlockchange listener | A12:116 | 35-daynight-input.js:92 | A opens the menu on unlock. B lets a hook claim the unlock first. |
| wheel listener | A12:159 | 35-daynight-input.js:75 | Different routing (A: photo, scanner, PC, in-world screens; B: its own targets). |

## 3. Same purpose, different names

| name(s) | A file:line | B file:line | note |
|---|---|---|---|
| `buildProps` / `buildAllProps` | A06:91 | B28:112 | A filters on `extra`, `propStageOk` and `when`, then builds `S.custom`. B builds every id (its gating lives in `hidden`), then calls `defightSoon`. |
| `removePropInst` / prologue of `buildProp` | A06:55 | B28:101 | A also purges game registries (lamps, clocks, fans, screens, belts) and sets `NAV.dirty`. B disposes the tree and its lights. |
| `propGroundY` / `P.floor` y | A06:92 | B28:102 | A: inside the hall, on a docked trailer, or yard height. B: the floor level (0 or `UP.y`). |
| `propStageOk` / `dlcProp` plus the owned check | A06:23 | B28:65, B28:68 | Both answer "may this prop stand now". A: stage, level, shed. B: DLC and unit ownership. |
| `editTick` / `editUpdate` | A06:182 | B30:16 | B also does the hover raycast and prompt. In A those live in `interact` (A12:84-88). |
| `editAim` / inline aim in `editUpdate` | A06:140 | B30:21-23 | A adds belt snap, wall snap, the yard zone and grid snap at 0.05. B only clamps to ROOM. |
| `editRemove` / `propRemove` | A06:220 | grow3d-creative.js:156 | A sells custom extras back at half price. B refuses the tent. |
| `editRestore` / `propRestore` | A06:228 | grow3d-creative.js:157 | Near-identical bodies (delete `hidden`, `buildProp`, save, toast). |
| `editBuy` / `buyUnit` | A06:229 | B28:47 | A pushes a `uid` record into `S.custom` and grabs it. B raises `S.units`, gates on licence/upgrade, costs 1.35^n, and pins the new unit's layout. |
| catalogue's Removed filter / `hiddenProps` | A06:241 | B28:73 | The same query. |
| `interact` / `updateFocus` | A12:80 | 32-interaction.js:5 | The focus raycast. A has screen and bench priority; B has container yield. |
| `useFocus` / `interact` | A12:109 | 32-interaction.js:164 | The E press. |
| `focusText` / `setFocus` | A12:6 | 32-interaction.js:22 | A stores a string for the HUD. B writes the prompt into the DOM. |
| `centre` / `center` | A12:66 | 32-interaction.js:3 | The same Vector2(0, 0). |
| `collides` / `moveWithCollision` + `obstacleActive` | A12:23 | B30:94, B30:93 | A: y-range solids plus `dyn`, and a floor step check. B: floor-level filter, and an obstacle the player already overlaps is skipped. |
| `solids` + `dyn` / `world.obstacles` | 05-three.js:359 | B28:108 | `{x0,x1,z0,z1,y0,y1,prop}` against `{x1,x2,z1,z2,tag,prop,floorLevel}`. |
| `hitBox` + `inter` + `userData.it` / `interactable` + `world.interact` + `userData.interact` | A06:49, 05-three.js:355-357 | B28:80, 06-three.js:354 | Behaviour-object hits (A) against kind-data hits (B). |
| `userData.dynamic` group / `ctx.dynGroup` (`userData.dyn`) | A06:335 | B28:95 | A builds an unbaked sub-group by hand in each prop; B has a ctx helper for it. |
| step-sound surface (inline) / `floorSurface` | A12:52 | B30:109 | |
| mousemove listener / `onMouseMove` | A12:117 | B30:138 (bound at 35-daynight-input.js:78) | Same look maths. Pitch clamp is 1.5 in A and 1.45 in B. |
| `photoToggle` / `photoOn` + `photoOff` | A12p:6 | 35-dlcy-photo.js:7, 13 | A: F9, hides the HUD, holds the clock. B: started from the dev console, the world keeps running, hides the UI after a 3.5 s delay. |
| `photoTick` / `updatePhoto` | A12p:16 | 35-dlcy-photo.js:17 | A: speed 6 (x3 with Shift), y clamped. B: speed 3 or 9, hides the hands. |
| `photoZoom` / photo wheel listener | A12p:15 | 35-dlcy-photo.js:24 | FOV 20-110 in steps of 4 (A) against 20-95 in steps of 3 (B). |
| photo look (inside A's mousemove) / photo mousemove listener | A12:120 | 35-dlcy-photo.js:23 | |

## 4. In one game only but engine-worthy

| name(s) | A file:line | B file:line | note |
|---|---|---|---|
| `propDef`, `customById` | A06:26, A06:27 | none | Custom (bought) instances whose `type` points at a def. |
| `propLabel` | A06:33 | none | B reads `PROPS[id].label` directly. |
| `propIdOf` | A06:93 | none | Walks up the parents to find `propId`. |
| `ghostProp` | A06:181 | none | Carried prop drawn semi-transparent. |
| `propSeed`, `seededF` | A06:138, A06:139 | none | Stable per-prop randomness. |
| `catalogueHtml` (shape) | A06:239 | none | A Removed list plus extras grouped by `cat`. `CAT_GROUPS` and `comfortText` are game data. |
| `def.when` gate | A06:25, A06:91 | none | A generic availability hook. |
| `def.fixed` | A06:196, 210, 216, 221; A12:87 | none | Cannot be grabbed, turned or removed. |
| `def.wall` snap | A06:148-152 | none | The mechanism is engine; the wall list (`wallPlanes`) is game data. |
| `def.yard` zone clamp | A06:153-155 | none | Generalise to a named placement zone. |
| `def.y` override | A06:77 | none | |
| layout `h` (height offset) | A06:30-31, A06:204 | none | |
| `editDrop(cancel)` plus G/Esc to put it back | A06:201, A12:144 | none | |
| `unbakeStatic` | A06:251 | (B has 06-three-bake.js) | Belongs to the bake layer, not to props. |
| `screenUnderCrosshair` | A12:160 | none | Belongs to the screens layer. |
| footprint-sized ground blob | A06:86 | none | B's `groundBlob(g)` is automatic. |
| `unitBase`, `unitCount`, `unitIds` | none | B28:10-12 | Derived ids `base#n` for `def.multi`. |
| `unitSpot`, `registerUnits` | none | B28:16, B28:36 | Takes ROOM bounds from config. |
| `propGone`, `inGoneProp` | none | B28:71, B28:72 | |
| `propFront` | none | B28:114 | The spot a person stands on to use a prop. |
| `ctx.light`, `noBlob`, `after(..., id)` | none | B28:104, B28:110, B28:109 | |
| floor levels (`P.floor`, `obstacleActive`, `player.floor`) | none | B28:69, B30:93 | |
| `hooks.editMode`, `editTarget` (generalised as a root hook) | none | B30:11, B30:6 | |
| escape rule (an obstacle already overlapped is skipped) | none | B30:100 | |
| `lockRetry` | none | 34-processing-panes.js:54 | |
| hotbar: `bindHotbar`, `held`, `hotbarFull`, `freeSlot`, `selectSlot` | none | B30:151-155 | |
| hands rig | none | B30:161-166 | |
| `burst`, `updateBursts` | none | B30:68, B30:82 | Particles layer. |
| `mixHex` | none | B30:167 | Colour utility. |
| `propExtra` | none | B29:663 | Composes extra build steps onto a def. |
| `segCross`, `segDist` | none | B29:301, B29:302 | Geometry utilities. |

## 5. Stays in the game

| name(s) | A file:line | B file:line | note |
|---|---|---|---|
| hall growth: `grown`, `HALL_GROW`, the at/wallX block in `defProp` | A06:8, 9, 15-20 | none | Becomes the game's def-resolve hook. |
| stage/level rules: `propStageOk` body, `applyLevelUnlocks` | A06:23, A06:25 | none | |
| belts: `beltSpill`, `beltSnap`, belt branches | A06:68, 161; belt branches at 82, 188, 206, 224 | none | The engine gets a per-def `snap` hook instead. |
| `wallPlanes` (geometry), `propWhere`, `CAT_GROUPS` | A06:114, 130, 238 | none | |
| 53 content builders | A06:256-603 | none | `chairBuild`, `tableBuild`, `lockerBuild`, `cotBuild`, `coffeeBuild`, `vendingBuild`, `fridgeBuild`, `coolerBuild`, `hooksBuild`, `noticeBuild`, `calendarBuild`, `clockBuild`, `posterBuild`, `extinguisherBuild`, `firstAidBuild`, `binPrompt`, `binUse`, `binBuild`, `broomBuild`, `wetFloorBuild`, `palletModel`, `emptiesBuild`, `balerBuild`, `wrapperBuild`, `hoseBuild`, `plantBuild`, `deskBuild`, `officeChairBuild`, `cabinetsBuild`, `coatStandBuild`, `kpiBuild`, `certificateBuild`, `shedTableBuild`, `flaskBuild`, `benchBuild`, `benchScreenDraw`, `shelterBuild`, `dumpsterBuild`, `flagBuild`, `parkingSignBuild`, `canopy`, `treeBuild`, `bollardBuild`, `benchSeatBuild`, `timeclockBuild`, `consoleBuild`, `breakerBuild`, `boardBuild`, `chargerBuild`, `lampPostBuild`, `carBuild`, `paintedBuild`, `aisleSignBuild`. |
| A's player-side game logic | A12:8, 67, 111 | none | `rebuildDyn`, `srcDef`, `jackSetDown`; plus the `ui`/`buff` state, the fork/PC/jack branches and the scanner key map. |
| units' game rules: `machCost`, `upgById`, `unitLock`, `PROP_DLC`, `dlcProp` body | none | B28:13, 14, 15, 64, 65 | |
| 12 content builders | none | B29 | `legs4`, `drawer`, `chair`, `officeChairBuild`, `bookshelfBuild`, `sofaBuild`, `coffeeTableBuild`, `crateBuild`, `lobbyBench`, `warmStrip`, `lobbyBenchExtra`, `bookshelfExtra`. |
| rope system (13 functions) | none | B29:285-374 | `ropeStyle`, `ropeBuild`, `ropeGate`, `ropeSegs`, `ropeHeld`, `guardCanRope`, `ropePose`, `updateRopeGates`, `updateGuardRope`, `exitPath`, `ropeMenu`, `ropeAdd`, `ropeUp`. |
| tent and fixture branches in build mode | none | B30:6-64 | Fixture code is in 19-doors-fixtures-intro.js. |
| held-item labels: `HELD_LABEL`, `slotIcon`, `slotLabel`, `pileLot`, `heldLabel`, `budCola` | none | B30:149-171 | |
| B's player-side game logic | none | B30:96-98, 109-130 | Drive, knockdown, sit, van and crouch branches; city, ROOM and stair bounds; the surface map. |

## Prop definition contract

1. **A (Depot Co)** uses `{label, x, z, rot, build(ctx,P,inst), after, cat, wall, yard, fixed, y, beltPath, extra, price, ico, desc, when(), stage, lvl, shed, at{stage:{x,z,rot}}, abs, keep}`. `defProp` adds `id`.
2. A's placement is the def default, overridden by `S.layout[id]` (`x, z, rot, h, hidden`). Bought copies live in `S.custom` (`id, type, x, z, rot, h`).
3. **B (Grow Co)** uses `{label, x, z, rot, build(ctx,P), after(ctx,P,inst,id), floor, multi{max, price, gap, ico, name, lic, upg}, noBlob}`. `registerUnits` adds `unit`. DLC gating is a side table (`PROP_DLC`), not a def field.
4. B's placement is the def default, overridden by `S.layout[id]` (`x, z, rot, hidden`). Extra units are `S.units[base]` with ids `base#n`.
5. The proposed union has three groups: engine core fields, engine hooks on a def, and game-side fields.
6. **Engine core fields:** `id, label, x, z, rot, floor, y, build, after, cat, extra, price, ico, desc, fixed, wall, zone` (replacing `yard`), `noBlob, multi{max, gap, price, ico, name}`.
7. **Engine hooks on a def:** `when()` for availability, `snap(def, pt, selfId)` (a belt piece supplies one), `root()` for a prop whose mesh is not its group (the tent).
8. **Game-side fields**, read only by the game's hooks: `stage, lvl, shed, at, abs, keep, beltPath, multi.lic, multi.upg`.
9. **Engine-level game hooks:** `resolveDef(id, def)`, `allowed(id)`, `groundY(P, def)`, `onRemove(id, inst)`, `wallPlanes()`, `zones`, `where(id)`, `unitPrice(base, n)`.
10. **State shape:** `S.layout` keeps `x, z, rot, h, hidden`. `S.custom` and `S.units` both stay, since custom bought copies and numbered units are different models and both are engine.

## Summary

1. **Functions per file.** A06 has 88 (35 system, 53 content). A12 has 9 named functions plus 6 anonymous listeners. A12p has 3. B28 has 21, B29 has 28, B30 has 26.
2. **Rows per section.** Section 1: 8 (shared state and code blocks, no whole functions). Section 2: 22. Section 3: 23. Section 4: 30 (16 from A, 14 from B). Section 5: 11 grouped rows.
3. **`20-props.js` should contain:** the registries and `defProp` with a `resolveDef` hook; `propDef`, `customById`, `propLabel`, `propPlacement` (layout, custom, units, hidden); one obstacle shape and one `rotAABB`; a base `propCtx` with a single `cyl` signature, `solid` with an optional y range, `hit`, `light`, `dynGroup`, and a way for the game to extend the ctx; `buildProp` and `removePropInst` with the `allowed`, `groundY` and `onRemove` hooks, plus `buildProps`; `propWorld`, `propFront`, `propIdOf`, `propGone`, `inGoneProp`, `propSeed`; the multi-unit functions; build mode: toggle, helper, aim (wall, zone, grid and the `snap` hook), tick, grab, drop with cancel, rotate, reset, remove, restore, buy, and the catalogue data model.
4. **`42-player.js` should contain:** one player state shape; movement and collision with floor levels, y ranges and the escape rule; the walk, run, jump, bob and step core, with surface, vehicle and seat hooks; mouse look; pointer lock with retry; key state; `updateFocus` and `useFocus` with `setFocus`; the hotbar; the hands rig; photo mode.
5. **Before merging, the engine has to settle these conflicts:** `player.x` against `player.pos.x`; obstacle field names (x0/x1 against x1/x2); the `ctx.cyl` argument order; the focus object shape and the `interact` name; whether hidden props get an instance; the group parent (`scene` against `world.group`); whether `editGrab` takes an argument.
