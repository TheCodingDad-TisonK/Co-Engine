# M1: the inventory

What the two games share, what moves into Co Engine, what stays in each game, and where the surprises are. Written 2026-10-08 from six layer reports in `docs/inventory/`, each a read-only pass over Depot Co 1.21.0 (A) and Grow Co 1.28.3 (B). The reports carry the line numbers; this page carries the decisions.

## 1. The numbers

| | Depot Co (A) | Grow Co (B) |
|---|---|---|
| Source | 7,153 lines, 39 parts | 11,400 lines, 53 parts (13 DLC) |
| Top-level functions | 847 | 1,204 |
| Identical function name in both | 71 | |
| Engine-layer functions read in detail | 285 | 433 |
| Of those, the same thing in both games (same name or same purpose) | about 190 pairs | |
| Engine-worthy but in one game only | about 60 (A) | about 110 (B) |
| Engine-worthy helpers hiding in the game-content files | 80 rows, 50 of them in both games | |

Byte-identical code is rare: `taperGeo`, `resize`, the four synth primitives, twelve SFX voices, nine utilities in the head, `saveSettings`, `toast` to within a lifetime constant, the nested `mesh` helper of the people rig, the HUMAN_GEO sizes. Everything else is the same idea written twice with drift: a different argument order, a different default parent, a different field name, a different time unit. The engine is mostly a merge, not a copy.

## 2. What moves: the engine parts and where each comes from

| Engine part | Takes from A | Takes from B | The merge decision |
|---|---|---|---|
| `00-head` | the closure, utilities, `money` with a sign, `pad2`, `dist2`, `uid`, `fmtTime`, `BOOT_SAVE` raw peek | `mtof`, the `?save=` override and legacy-key move | One head. |
| `10-three` | `tex`, `normalTex`, `roughTex`, `blotches`, `cracks`, `dimEnv`, `geoCache`, `plane`, `sphere`, `hitBox`, `animate`, scratch math, the post pass, `mkInst`/`setInst`, `spiralPts`, the cable tube | `makeAlphaTex`, the tile/brick/wood/plank painters, `roundRect`, `emojiTex`, `disposeTree`, `archLeafGeo`, `sprite`, auto-fit `groundBlob`, `mergeGeo`/`lumpy`, `prodMat` cache, `pipRender` | One texture factory, one `box` with options, one `cyl` argument order, one default-parent setting, `BEVEL.on` plus caching, `textTex` with both plate styles, `floorBlob` plus auto-fit, the "rbx" closure written 11 times becomes one helper. |
| `11-bake` | the exclusion list (`userData.it`, glow, transparent, hit/screen/exit, `dynamic`) | the incremental bake: parent-space buckets, material signature, chunking, time budget, self-healing returns | B's bake with A's exclusions as hooks, plus force and off entry points to replace A's unbake/bake pairs. Watch B's "any userData key blocks" rule. |
| `20-props` | `defProp` with a `resolveDef` hook, `propPlacement` with custom copies and `h`, `fixed`, `wall` snap, zone clamp, `when`, `ghostProp`, `propSeed`, drop-with-cancel, the catalogue model, the belt mechanism as a prop capability | hidden-prop instances, `floor` levels, `multi` units, `propFront`, `propGone`, `ctx.light`, `dynGroup`, `noBlob`, `after(..., id)`, the `editTarget` root hook | One def contract (section 4). One obstacle shape. One `propCtx`. Build mode merged with `snap` as a per-def hook. |
| `21-doors` | hinged leaf, pushbar, LED, lock on Shift | sliding leaf, `setDoor`, keyholder pass, auto-close after 4 s, `folkNear`, `doorAt`/`npcDoors`, one obstacle entry | One door record behind a save adapter; two leaf motions. The dock `setDoor` name collision in A is renamed. |
| `22-people` | `faceSpec` from a key hash, carry poses (true, jack, tow), work and sit modes, bubble per call | explicit face spec, hats, hand props, coat, skirt, `humanBlink`, `setMood`, `walkAlong`, prop poses | Same rig (B's proportions, A scaled 0.93): merged `makeHuman` returning one parts object, merged `animateHuman` with carry and prop poses as hooks, one bubble (B wrote it six times). |
| `23-screens` | dirty-flag redraw, `screenDirtyAll`, text clamp, the row-list device kit with the waypoint (`scanScroll`, `scanAct`, `scanGo`, `scanArrow`) | hot zone, `live` interval, `tap` dispatcher, cursor and ripple, `screenShell`, `litPlane`, the drawing kit (card, stat, pill, meter, foot, lcd), the PC zoom, the quick wheel | One `touchScreen`, one themed drawing kit with fonts and colours in a theme object. |
| `24-world` | `lineWall` with openings, `roomFloor`, `troffer`, `highBay`, `floorY` family, `fenceRun`, the sky dome, pigeons, `paintBay`, the span-cutting helper (A wrote it three times) | `wallZ`/`wallX`, `floorPlane`, `roomLamp`, `pendant`, facades, plots, flora scatter, `roomOf` | Walls, floors, fences, roads, lamps, flora, facades: the world kit. |
| `25-nav` | the game exceptions as a hook | the heap A*, typed arrays, partial paths, `navKey`, door-aware grids, `walkAlong`, `yawWrap`, `easeYaw`, pedestrians | B's router. A's `route` is retired. |
| `26-weather` | `pickWeather`, `tickWeatherState`, rain and snow points, puddles, snow tint, thunder, rain ambience, `lighting` by hour, the flag in the wind | the weather block of `updateExpansion`, fog lerp, `updateDayNight` | One state machine, one particle cloud, one hour-driven lighting pass with the game's colours as parameters. Same season formula in both. |
| `27-vehicles` | car, van, truck and trailer meshes, tyres, the forklift drive, `forkCollides`, lane traffic | `carBody`, `vanBody`, `vehState`, hinged doors and bonnet, lamps, `enterCar`/`updateDrive`, `carBlocked`, traffic that stops for the player, the dashboard | Vehicle meshes and a drivable-vehicle core with a game hook for the controls. |
| `30-sound` | `audio` with `SET.vol`, `sfx` re-applying volume, the radio scheduler | `hum` loop voice, 56 voices to pick the 12 shared ones from | 12 base voices in the engine; the game adds its own table. One radio with distance gain from a sources list. |
| `40-state` | immediate `save` with `savedAt`, the wiped guard, the one-time failure toast | debounced `save`, `saveNow`, the recover key, `bootFailed`, `fill` plus `SAVE_V` migrate, the storage listener, B's save export and import | Slots, settings, migration frame, recovery. The game gives `freshState` and `migrate`. |
| `41-shell` | HUD throttle, `updatePrompt`, `menuBody`, `btn`, the level card and the day report frames with `daySnapshot`/`closeDay` | layered `ui.blocked`, `closeTopUi`, `refreshOpen`, `lockRetry`, `slider`/`check`/`select`/`chip`, the task bar, the fade overlay and zone teleport, the attract camera | The HUD and menu shell. The game fills the HUD fields, the menu list, the guide and the stats. |
| `42-player` | fork and PC camera hooks, jump, `collides` with y ranges, photo mode on F9 | `pos` vector, floor levels, the escape rule, crouch, sit, drive hooks, the hotbar, the hands rig | One player state shape. The `interact` name collision (A: focus raycast, B: the E press) is settled as `updateFocus` and `useFocus`. |
| `43-format` | `dueText`, `myHours`, `propSeed`, `seededF` | `clockText`, `minsLeft`, `shortAgo`, `kg`, `wsMerge`, `mixHex`, `unitRoll`, `deskTrim`, `deskWrap` | Text, time, number and colour helpers. |
| `50-devlink` | the whole SSE link, probe, badge, `devState`, the command dispatcher | the F8 in-page console as a second front end | A's link. The command table is engine commands plus `GAME.commands`. |
| `90-boot` | the per-frame world tick, the hidden-tab interval, the orbit menu camera | the fixed 1 s sim, offline catch-up, `bootFailed`, `runHooks('boot')`, the `dlcDefine` module registry | One boot with named hooks; two tick modes. B's `//#if desk` lines keep working. |
| `tools/` | `build-game` duplicate regex, `sync-version` write-if-changed, `smoke.js` chain runner, `smoke-lib` prologue with the live-state Proxy, the dev console with its self test | `build-game` flavours, `render-brand` from HTML pages, `verify-icon`, `test/run.js` isolated runner, `preload.js` fake clock and seeded random | One runner with chain and isolated modes behind a handle contract; one build script; B's brand pipeline; a new `check-syntax`. |
| workflows | `release.yml` with the extra-build step | `issue-triage.yml` | `test`, `release`, `wiki-sync` as-is; `issue-triage` reads its map from a game file. |

## 3. What stays in each game

**Depot Co:** `02-config` (the ladder, the stages, the catalogue, clients, economy), the hall and yard layouts, 53 prop content builders, the production wing and its machines, the belt network (the mechanism is engine, the wiring is game), the sorter, the mezzanine, the returns hall, trucks and the schedule, orders, returns, contracts, the staff roles and the forklift driver, the time clock, the scanner pages and the PC apps, the intro steps, the seven smoke scenarios and their helpers (`mkOrder`, `quietDocks`, `clearOut`, `grabParcel`, `crewOff`, `climbTo`).

**Grow Co:** `01-config` (strains, tents, licences), the sim, the actions, the plants and tents, the customers and the queue, the crew and guard jobs, the van trade, the basement works, the city as content (the kit is engine), the deliveries, robberies and police, the DLC files, the two office boards, the 17 unit test files.

The rule of thumb that fell out: if it takes a position, a material, a mesh or a canvas, it is engine; if it reads a SKU, a strain, a client or a level, it is game.

## 4. Contracts the engine has to fix before any code moves

1. **The prop def.** Engine fields: `id, label, x, z, rot, floor, y, build, after, cat, extra, price, ico, desc, fixed, wall, zone, noBlob, multi{max, gap, price, ico, name}`. Engine hooks on a def: `when()`, `snap(def, pt, selfId)`, `root()`. Game-side fields, read only by the game's hooks: `stage, lvl, shed, at, abs, keep, beltPath, multi.lic, multi.upg`. Game hooks: `resolveDef`, `allowed`, `groundY`, `onRemove`, `wallPlanes`, `zones`, `where`, `unitPrice`.
2. **The game object.** `GAME.freshState`, `GAME.migrate(s, from)`, `GAME.peek(raw)`, `GAME.buildWorld`, `GAME.tick(dt)` with `tickMode` per frame or fixed, `GAME.present(dt)`, `GAME.hud`, `GAME.menu`, `GAME.guide`, `GAME.startStats`, `GAME.onEnter`, `GAME.commands`, `GAME.devState`, `GAME.T`, `GAME.handle`, `GAME.radioSources`, `GAME.settings`, `GAME.catchUp`.
3. **The test handle.** Each game names its namespace, state getter, test handle, step function, boot function and save key prefix, so one runner serves both the chain mode (A) and the isolated mode (B).
4. **One player state** (`pos` vector or flat `x/y/z`, pick one), **one obstacle shape** (`x0/x1` or `x1/x2`, pick one), **one `cyl` argument order**, **one default parent**, **one `lightBudget` cap name**, **`noBake` on the object, not the material**.

## 5. The surprises

- **Almost nothing is byte-identical.** 71 names match, and most of those bodies have drifted. The engine is a merge of two drafts of the same thing, and the merge needs both suites green to be trusted.
- **Grow Co has the better infrastructure, Depot Co the better content tooling.** B's bake, router, brand pipeline, recovery boot, save import and test determinism are ahead. A's prop placement rules, belt mechanism, scenario chain, dev console and duplicate-function guard are ahead. The engine takes each from where it is best, which means neither game migrates by deleting files; both change.
- **Name collisions that mean different things:** `groundBlob` (A: contact shadow plane; B: auto-fit), `interact` (A: focus raycast; B: the E press), `carryBack`, `stockCount`, `setDoor` (A: dock door; B: hinged door). Each gets renamed on one side before the merge.
- **The bevelled-box closure is written eleven times** across the two games. The speech bubble six times in Grow Co alone. The span-cutting helper three times in Depot Co alone. These are the cheapest wins and the clearest proof that a shared layer is overdue.
- **Two tick models.** Depot Co ticks the world every frame with real-time waits in its tests; Grow Co runs a fixed one-second sim with offline catch-up and a fake clock in its tests. The engine supports both; the test runner has to as well.
- **Grow Co's desk build.** The `//#if desk` preprocessor and the `.desk.js`/`.shop.js` flavours are a build feature the engine's build script must keep.

## 6. What M2 builds first

In this order, each step leaving the engine's own smoke green:

1. `00-head`, `10-three`, `11-bake`, `43-format`: the pure layer. No game state anywhere.
2. `20-props`, `21-doors`, `24-world`, `25-nav`: the world kit, with a sample scene in `tests/` that stands one room, one door, one person and one prop pack.
3. `22-people`, `23-screens`, `26-weather`, `27-vehicles`: the living layer.
4. `30-sound`, `40-state`, `41-shell`, `42-player`, `50-devlink`, `90-boot`: the shell, and the GAME contract becomes real.
5. `tools/`, `shell/main.js`, the workflows, the dev console.

Then M3: Depot Co's `src/` loses what the engine now has, gains its hooks, pins v0.1, and its 503 checks decide.
