# Co Engine: the plan

Written 2026-10-08, after 1.21.0 of Depot Co. Decisions taken so far: the engine lives in its own repo and every game pins a tag of it; Depot Co moves onto it first; the name is Co Engine (repo `TheCodingDad-TisonK/Co-Engine`, package `co-engine`, tags `v0.x.y`); the engine gets an editor of its own in the spirit of Unity, Godot and Unreal, not only a runtime library; and Claude works inside that editor, seeing what you see and acting through the same tools you click.

## 1. What it is

Four pillars, built in this order:

1. **The runtime.** The layer both games already carry twice: the 3D helpers, the prop system, build mode, bake, doors, the people rig, the screen kit, the sound synth, save slots, the HUD and menu shell, the Electron shell, the dev link, and the build, lint, brand, icon and smoke tooling. One repo, versioned by tag. A game's build joins the engine parts in front of its own parts, the way `src/NN-*.js` works today. Still one HTML page, one closure, no bundler, no framework.
2. **The editor.** A desktop program of its own (Electron, like the dev console but grown up) that opens a game folder, shows the scene, and edits what the engine understands: the layout, the props and their placement, the prop packs, the config tables, the screens and texts. It hosts the real game page for play-in-editor and talks to it over the dev link that exists today. It writes the game's source files on disk, so a change in the editor is a diff in git.
3. **The template.** A starter repo: config, one room, one prop pack, one person, one scenario, one screen. `git clone`, `npm install`, `npm start` and a game runs. Game three starts here.
4. **The assistant.** Claude inside the editor. The editor publishes its own actions as tools over a local MCP server, and a Claude session attaches to them: it sees the scene, the selection, the console and the logs, and it places, moves, edits, runs and tests through the same channel the inspector uses. Section 6 says how.

What it is becoming: a general engine for Tyson's games, grown one milestone at a time and never ahead of a game that needs the next piece. The first day set a narrow guard rail here (no physics, no animation editor, no shader graph); Tyson struck it on 2026-10-09, and by that evening physics, an animation timeline, a material graph and a prop modeller had first versions in. The page and Electron are the platforms today because that is where the games ship; nothing in the engine rules another platform out. Each capability arrives as a first version a game can use, and its row in the milestone list says what it still owes.

## 2. What exists today

Measured on 2026-10-08:

| | Depot Co | Grow Co |
|---|---|---|
| Source | 7,153 lines in 39 parts | 11,400 lines in 53 parts (13 are DLC) |
| Top-level functions | 847 | 1,204 |
| Same function name in both | 71 | |
| Tooling | `build-game`, `lint-gate`, `sync-version`, `make-icon`, `render-brand`, `serve`, `main.js` differ by 2 to 111 lines each: forks of one original | |

The 71 shared names are the engine's spine: `box`, `cyl`, `mesh`, `pane`, `sign`, `textTex`, `faceTex`, `bevelGeo`, `taperGeo`, `roundCylGeo`, `glowMat`, `grain`, `groundBlob`, `rotAABB`, `wallX`, `fenceRun`, `tree`; `defProp`, `buildProp`, `buildProps`, `propCtx`, `propPlacement`, `propWorld`, `editToggle`, `editGrab`, `editDrop`, `editRotate`, `editReset`, `editHelper`; `makeHuman`, `animateHuman`, `arm`, `leg`, `carryBack`; `setDoor`, `doorPose`, `doorPrompt`; `touchScreen`, `frame`; `audio`, `sfx`, `sTone`, `sNoise`, `sBeep`, `sThud`, `burst`; `save`, `load`, `saveSettings`, `applySettings`, `settingsHtml`, `guideHtml`, `openMenu`, `closeMenu`, `toast`, `feedPush`, `logEvent`, `screenshot`, `resize`, `lockPointer`, `updatePlayer`, `interact`, `navBuild`, `updateLightBudget`, `season`, `stockCount`. Many more are the same function under two names, found when the parts are laid side by side.

## 3. Repo layout

```
Co-Engine/
  engine/            the runtime parts, NN-*.js, joined in front of a game's src/
    00-head.js       the closure opens, the S and SET contracts
    10-three.js      helpers, materials, geometries, signs, text
    11-bake.js
    20-props.js      defProp, placement, catalogue, build mode, customs, layout overrides
    21-doors.js
    22-people.js     the rig, walk cycles, faces, carry poses
    23-screens.js    the painted screen kit, buttons, dials
    30-sound.js      the synth, the radio stations
    40-state.js      save slots, settings, migration hooks
    41-shell.js      HUD, pause menu, toasts, feed, photo mode, screenshots
    42-player.js     movement, pointer lock, interaction, hands
    50-devlink.js    the console link
    90-boot.js       buildWorld hooks, the frame loop, the T handle base
  tools/             build-game, lint-gate, sync-version, make-icon, render-brand, serve, smoke-lib, smoke runner
  shell/main.js      the Electron window
  devconsole/        the console as it is today; grows into the editor's play panel
  editor/            pillar two, see section 5
  template/          pillar three
  packs/             prop packs shared by every game: yard, furniture, people, signs
  tests/             the engine's own smoke: a sample scene that uses every system
```

A game keeps `src/` for its own parts, `game/` for the built page, and names the engine in `package.json`:

```json
"co-engine": "github:TheCodingDad-TisonK/Co-Engine#v0.3.0"
```

`build-game.js` reads the engine's parts from `node_modules/co-engine/engine/`, then the game's `src/`, and refuses a duplicate top-level function exactly as it does now.

## 4. The contract between engine and game

The engine never knows a game. A game registers itself through a handful of hooks, all optional:

- `GAME.config`: the tables (`UNLOCK`, `XP_TABLE`, stages, economy) in whatever shape the game likes.
- `GAME.freshState()` and `GAME.migrate(save)`: the game's save fields; the engine owns slots, settings and the version stamp.
- `GAME.buildWorld()`: walls, floors, rooms, yard. The engine gives `box`, `wallX`, `fenceRun`, solids and the bake.
- `GAME.props`: `defProp` calls, with stage and level gating as a game decision (a `when` on the def).
- `GAME.tick(dt)`: the game's systems, called from the engine's frame loop after the player and before the HUD.
- `GAME.hud(hudDirty)`, `GAME.menu`, `GAME.guide`: the game's lines in the shell's HUD, menu and guide.
- `GAME.commands`: dev console commands beyond the engine's own (money, time, teleport, save, reload).
- `GAME.T`: what the game adds to the test handle.

A prop pack is a folder with `pack.js` (the `defProp` calls and build functions) and nothing else; a game lists the packs it ships. The same folder works in any game on the same engine tag.

## 5. The editor

**What "like Unity, Godot or Unreal" means here.** The shape of those editors, scoped to this engine's data:

| Unity has | Co Engine's editor has |
|---|---|
| Hierarchy | The scene tree: rooms, walls, docks, props, people, machines, belts, with the layout file each one lives in |
| Scene view with gizmos | The real game page in edit mode: free-fly, top-down and first-person cameras; move, rotate and height handles; grid, wall and belt snap |
| Inspector | Every field of the selected thing, typed, with units, live in the scene as you type |
| Project window | The game folder: parts, packs, layouts, config tables, texts, scenarios |
| Prefabs | Prop packs: a def plus its build function, droppable between games |
| Play, pause, step | The game runs in place; pause, step one tick, set the clock, pick the save slot |
| Console | The dev console's log, the game's events, page errors |
| Profiler | Draw calls, baked and dynamic mesh counts, frame time, light budget |
| Project settings | The config tables: ladder, economy, stages, clients, keys |
| Build menu | Installer, portable exe, web folder, from the same button the workflow uses |
| Undo and redo | On every inspector and scene edit, as a diff stack over the game's files |
| Asset store | The pack folders of the other games on this engine |
| Modelling | A prop modeller: boxes, cylinders, bevels, extrusions and lathes placed with gizmos, mirrored and snapped, written out as the prop's build code with a live preview. Later, vertex editing of a mesh kept as data beside the code |
| Animation | A timeline: keyframe tracks on a prop's parts (position, rotation, scale, a material value), looping or one-shot clips kept as data, played by an engine part, with the people rig's walk cycles as the first clips |
| Shader graph | A material graph: nodes for the painters the engine already has (grain, noise, bricks, wood, planks, blotches, cracks), colour and roughness maps, emissive and glow, compiled to a material. Later, GLSL nodes through three.js onBeforeCompile |
| Physics | A rigid-body layer for props and items: gravity, stacking, sliding, simple joints, on the AABB and sphere shapes the engine has, with a switch to plug a full solver in later |
| Terrain | A heightmap terrain with sculpt and paint brushes, splat textures, flora scatter from the world kit, and roads that follow the ground |

All of that is in. The first editor (M6) ships the rows above the modelling row; the five tool rows follow one by one (section 7). The principle stays: a prop is code that draws it, so every tool writes code or data the game loads, never a binary only the editor can read.

An Electron app, `npm run editor` in the engine repo, later its own exe like the dev console. One window, three columns.

**Left: the project.** The game folder opened, its parts, its packs, its layouts, its config tables, its texts. Click a prop def and the inspector shows it.

**Middle: the scene.** The real game page, hosted in a BrowserView, running the engine's edit mode with the editor's own camera (free fly, top down, the player's eyes). Click a prop and it is selected in the inspector. Drag, rotate, snap, place from the catalogue: all of it is build mode as it exists today, driven from outside over the dev link instead of from the keyboard.

**Right: the inspector.** The selected thing as fields: a prop's position, rotation, height, stage, level, label, category, price, the pack it comes from; a room's walls; a dock's position; a config row; a screen's text. Edit a field and the scene updates live through the same `devCommand` channel the console uses. Save writes the game's source file (the layout table, the prop def, the config row) on disk, formatted the way the file already is, so git shows a clean diff.

**Bottom: play.** Play, pause, stop, the clock, the level, the money, the save slot, the console's log. This is the dev console as it exists, docked.

**What it edits in version one:** placement and parameters of existing props, layouts, config tables, texts. **Version two:** prop packs, with a live preview of a build function as you type it, and the people's looks. **Not planned:** modelling meshes by hand, animation curves, materials beyond the palette.

The editor is built after the runtime is out of Depot Co, because it edits the runtime's data model and that model is only fixed once one game runs on it. Its first version can be small: the dev console with a scene tree and an inspector is already most of column three and the bottom.

## 6. The assistant: Claude inside the editor

The editor is the one program Claude works in, the way you do.

- **The editor is an MCP server.** It publishes its actions as tools: list and select scene objects, place, move, rotate and remove a prop, read and write a layout row, a config row or a text, run, pause and step the game, take a screenshot of the scene view, read the console and the page errors, run a smoke scenario, read a pack. Every tool is the same function the inspector button calls, so what Claude can do and what you can do are one list.
- **A chat panel hosts a Claude session.** The editor embeds Claude Code in a terminal panel (ConPTY and xterm.js, as the Implementation Desk already does), started in the game folder with the editor's MCP server attached and a `co-engine` skill loaded that teaches it the engine's contracts, the pack format, the test harness and the rules of this office (no branding, no em dashes, one feature one PR). You type in plain words; it reads the scene and acts.
- **Both directions.** Claude's edits show up in the scene live and in the inspector; your clicks show up to Claude as selection and state, so "move this one" means the thing you have selected.
- **Nothing new on the wire.** The dev link the console uses today carries state out and commands in. The editor's server is that link grown to the editor's full action list.

The assistant ships with the first editor (M6), not after it. The MCP server is built first inside M6 because it is also what the editor's own panels call.

## 7. Order of work and milestones

Each milestone ends with every suite green and a tag.

1. **M1, the inventory.** Done 2026-10-08 (`docs/M1-INVENTORY.md`). Lay the shared parts of both games side by side, name every function that is the same thing, and write the list of what moves and what stays. One document. No code moves yet.
2. **M2, Co Engine v0.1.** Done 2026-10-08, tag v0.1.0. The runtime repo with the parts from Depot Co, the tooling, the Electron shell, the dev console, the smoke harness, and an engine smoke of its own on a sample scene. Depot Co is not touched yet.
3. **M3, Depot Co 1.22.0 on the engine.** Done 2026-10-09 on Depot Co's main; the engine moved to v0.1.2 for what the move taught (the missing-key map for migrations, the catalogue-only panel actions, the autoplay flag left to a game's own menu, the shell in the npm package). Depot Co's `src/` lost the engine parts and pins v0.1.2. Its 503 checks pass. No player-visible change; the changelog says so.
4. **M4, the template and game three's first room.** Done 2026-10-09: the template installs, builds and passes its test from a fresh folder (engine v0.1.3), and game three is Garage Co, started in its own repo with its first room, the lock-up, and a 38-check smoke of the whole loop. Garden Co is game four. The template repo runs. If game three has a name by then, it starts here.
5. **M5, Grow Co on the engine.** Done 2026-10-09 as Grow Co. 1.29.0 on engine v0.1.4, standalone only (the desk copy is frozen). The engine grew a compatibility layer rather than absorbing the shop's kit: box with an options object, cyl and sprite in the shop's argument orders, switches that turn the engine's input, build mode, photo mode, light pass, HUD fields and prompt off, a render override, a debounced save, named saves. Where the shop's kit differs from the engine's it keeps its behaviour under names of its own; merging those kits (the people rig, the props, the screens) is work still owed. 92 tests pass. The engine grows what Grow Co needs that Depot Co did not (the city, the car, the basement are game parts; the shelf kit and the customers' line may be packs). Its suite passes. DLC parts untouched.
6. **M6, the editor v1.** Done 2026-10-09 at engine v0.1.6. The first half landed at v0.1.5: the game runs inside the editor window (a webview viewport loading the real page with `?editor=1`), the editor bridge `CO.editor` (tree, inspect, set, select, pick, frame, spawn, remove, mode, pause, step, enter, command, assets, shot), and the panels around it: hierarchy with a filter, inspector (prop fields through the layout and the save, transform, material, light, geometry, screen), assets with Place, console with the command line, readout, the play bar (Play, pause, step, reload, Scene or Game camera, the window). The second half landed at v0.1.6: the editor is an MCP server (`editor/mcp.js`, stdio, twenty-one tools over the same bridge through the dev link server's `/editor` route), a `.mcp.json` in the engine repo and in the template, and the Claude panel, which runs Claude Code in the game's folder with that server and shows the answer, the tool calls and the cost. Still owed from the M6 list: writing config tables and texts from the inspector (today it writes layouts and placements through the save, and live fields), and a scene camera for Grow Co, whose own photo mode stands in for the engine's.
7. **M7, the editor v2.** Done 2026-10-09 at engine v0.1.7. Undo and redo as a stack of steps (prop fields, live fields, spawn, remove; Ctrl+Z and Ctrl+Y in the viewport and the editor). Pack authoring in the Pack tab: a prop's build function edited live, every placed copy rebuilt as you type, Revert, Save to src (the editor writes the function back into the part that holds it, or appends a new definition), New prop from a template; the code compiles against the engine's kit, which a game extends with `GAME.editorKit`. The Profiler tab: the frame's phases as stacked bars with the 60 fps line, draws, triangles, programs, textures, heap, and the scene counts, sampled only while the tab is open. The Build menu: build, check, test, the game's other npm scripts (installer, brand, zip), run in a window, the folders. The side panels and the dock resize. Ten more MCP tools carry the same to Claude. Also from this milestone: the brand tool writes the .ico itself (no module), the template carries brand files so a new game builds an installer, the smoke runner ignores a CI driver's performance notes, and the engine's own Release workflow attaches the editor exe to each tag. Not done, and moved to M8 and later: undo across the game's own build mode, editing a definition's fields (label, price, category) in the inspector rather than in the code, and pack folders shared between games (section 7's `packs/`). **v0.1.8, the same day, after Tyson asked how an edit reaches a release:** what the editor changes goes into `src/` as a matter of course. The shipped layout (`CO.layout`, `src/00-layout.js`) sits between the definitions and the save and the editor writes it a moment after every move, hide, spawn or remove; placed copies ship with the game; Ctrl+S saves everything pending; and Release… in the Build menu (and the `release` tool) bumps the version, writes the changelog entry, builds, checks, commits, tags, pushes and creates the GitHub release that the repo's workflow fills with the installer. Since v0.4.0 Grow Co.'s own props read the shipped layout too (its placement consults `CO.layout()` and `GAME.buildProp` names its builder), so the editor moves them like any other.
8. **M8, terrain and the material graph.** Done 2026-10-09 at engine v0.2.0. The terrain (`engine/23-terrain.js`): a heightmap over cells with a paint per cell, one mesh under a painted canvas, the ground height under the player and the props, raise, lower, smooth, flatten and paint brushes driven by the left button in Scene mode, flora scatter through the shipped layout, and `src/00-terrain.js` written by the editor like the layout. The material graph (`engine/12-matgraph.js`): `CO.material(name, graph)` paints a texture from a layer stack (twelve layer types, blends, roughness and normal maps, emissive, glow) and registers `MAT[name]`, live in the Materials tab with a picture, saved as `src/00-materials.js`. Also from this milestone, because Tyson hit it while placing a gate in Garage Co.: packs. `packs/basics` ships a control panel with a touch screen, a sliding gate and a boom barrier it opens and closes, a lever, signs and a dozen yard props; the Assets tab adds a pack to any game as `src/00-pack-<name>.js`. v0.4.0 added the road brush (a flattened, painted strip in one stroke) and feathered seams between paints. Still owed: GLSL nodes in the material graph.
9. **M9, the animation timeline.** Done 2026-10-09 at engine v0.2.1. Clips as data (`engine/29-anim.js`): named tracks of keys on paths into an object or a person's limbs, with easing, loops, speed, a blend in and events; `playClip` and `stopClip`; nine built-in clips (wave, nod, cheer, point, lift; spin, bob, swing, blink); the Animation tab plays, scrubs and keys a clip on the selected object and writes `src/00-clips.js`. In the same version, because Tyson asked how to make UI: UI as data (`engine/44-ui.js`): HUD chips, panels with text and buttons, start chips, the pause line and the guide, as expressions over the kit, edited in the UI tab and written to `src/00-ui.js`. v0.4.0 added the dope sheet: a row per track with the value curve, keys that drag to retime, a ruler that scrubs. Still owed: clips that blend with each other (one clip per object at a time), and the people rig's own walk as a clip (it stays procedural).
10. **M10, the prop modeller.** Done 2026-10-09 at engine v0.3.0, as a first version: a model is a list of parts (boxes, cylinders, spheres, planes, signs, lights, solids, uses) as data, written out as the prop's build code with the model kept in a comment so it reads back (`engine/61-model.js`); the Model tab edits, adds, duplicates, mirrors and nudges the parts, picks one by clicking it in the viewport, previews every copy live and saves the code into `src/`. v0.4.0 added bevelled boxes, lathes and extrusions as part kinds, and dragging a picked part over the ground in the viewport (the selected prop drags the same way in Scene mode). Still owed: a full three-axis gizmo with handles, and vertex editing on data meshes.
11. **M11, physics.** Done 2026-10-09 at engine v0.3.0, as a first version: a rigid-body layer (`engine/28-physics.js`) with gravity, the ground and the terrain, the engine's solids, body against body, friction, a bounce and sleep, on axis-aligned boxes; `body`, `removeBody`, `impulse`; `CO.physicsSolver` plugs a full solver in; the editor's Drop lets a placed prop fall and writes where it rests into the layout. v0.4.0 added spheres that roll and a hinge joint (a pendulum from a pivot). Still owed: tumbling boxes, sliders and springs, and a game's items thrown by the player (the API is there; no game uses it yet).

**v0.5.0 (2026-10-09), against the editor table in section 5:** the Project tab lists the game's files and the File tab edits one; the Settings tab edits the tuning tables (`CO.table`, `src/00-tables.js`); the scene view gains a Top camera, Ctrl and mouse to drag any prop in either view, Ctrl and the wheel to turn it, PageUp and PageDown for its height, and wall snap; the play bar picks the save (slot 1, an editor save, fresh each Play); terrain strokes, material and UI edits join undo; the hierarchy says where a prop comes from; packs come from your other games too and a game makes a pack of its own props; the modeller gains mesh parts with vertex dragging; materials take a GLSL snippet; physics gains a spring; clips animate material values; the build menu makes a web folder and a portable exe. What the table still asks for and is not in: a node-based shader graph (the materials are a layer stack with a GLSL line), a full three-axis gizmo with handles, belt snap (no game has belts in the engine yet), and undo as a diff over the game's files (undo is over the editor's edits).

**v0.6.0 (2026-10-10):** the Grow Co. pack (every Grow Co. prop and its counter fixtures, 67 in all, generated from Grow Co.'s source and sealed in its own scope), editor code running inside the engine's scope, a prop's height applied to the prop, `run_js` for playtests, and `examples/showcase`: a hall built by a playtest that drove the editor through its MCP tools with every pack prop, with the checks it ran (placing, the control panel opening and closing the gate, the prompts, the lights at night, no console errors).

**v0.7.0 (2026-10-10):** the Depot Co. pack (131 props) and the Garage Co. pack (11 props), generated by `tools/packs/make-pack.js` from each game's source, so every game's props can be placed in every other game. The showcase carries all four packs.

**v0.8.0 (2026-10-10):** Parts from this prop: the Model tab reads any prop drawn in code back as parts you can edit (sizes, turns, materials, pictures, corners), so an existing prop is reshaped without Blender. A prop whose build is shared (every pack prop) is saved as an override of that prop alone in `src/00-models.js`; before, saving one pack prop from the Pack tab would have rewritten the shared code under all of them.

**v0.9.0 (2026-10-10):** the world is editable. Everything a game builds straight into its world (walls, floors, lamps, trees, fences, the asphalt) is a world item the editor selects, moves, turns, resizes and removes, kept in `src/00-world.js` and laid on the world before the bake, its solids following it. Ctrl and a click select several things, props and world items alike, and they move together; Ctrl no longer flies the scene camera down.

**v0.9.1 (2026-10-10):** a selection box (Shift and a drag in the scene camera) picks a building and everything in it at once; doors move with the item they are built in; an item can be marked moves-only so a game's rules can follow a building's place.

**v0.12.1 (2026-10-11):** the editor keeps every game on its engine: a bar names an older pin and Update installs the matching tag and builds. menu first opens a game at its start screen. The made start screen keeps the page card's disclaimer and links, and the page's own card no longer flashes up first. Depot Co. and Grow Co., left on 0.8.0, move to the current engine.

**v0.12.0 (2026-10-10):** the menu maker and the NPC creator. The Menus tab makes the start screen, the pause menu, the settings (the engine's, and switches, sliders and lists of a game's own) and text pages in a theme, live in the viewport, saved into src/00-menus.js; a new game starts on it. The NPCs tab makes characters and what they do step by step (walk, say, talk with choices, wait, wander, wait until, run, tell the game, leave), spawners that bring them on a clock, by car or on foot, and workers who keep a place through their hours, saved into src/00-npcs.js.

**v0.11.0 (2026-10-10):** traffic that follows the roads a game lays. Road pieces carry lanes that join where the pieces meet; roadTraffic keeps cars on the network, turning at junctions, one approach at a time through a junction with room on the far side, giving way on a roundabout ring that takes a car per 10 m, slowing for bends, never locking two cars against each other. The dev command lanes draws the network. Garage Co.'s road moves onto it.

**v0.10.0 (2026-10-10):** thirteen new packs, 189 props, for any game: buildings (sheds to pre-built apartments, an office tower, a supermarket and a car park), cars and vans, city streets (lamps that light, traffic lights that cycle, signs, street furniture, pedestrians that walk), nature, industrial, farm, park and play, home, office, shop and market, harbour, camping, and roads (straights, a crossroads, a T-junction, a bend, a roundabout and a dead end that join end to end, with markings and roadside kit). Moving parts sit in dynamic groups so the bake leaves them free. Still owed: traffic that follows road pieces a game lays (cars today drive the lanes a game gives them).

**v0.9.2 to v0.9.4 (2026-10-10):** typing in a text box no longer moves the selection; the editor runs a game's scripts with Electron as Electron and a failed release undoes itself; duplicate, copy and paste (Ctrl+D, Ctrl+C, Ctrl+V) for props and world items, a world item's copy kept as a world copy.

Each of M8 to M11 is a project of its own, sized like the expansion. They are ordered by what a new game feels first. All four shipped a first version on 2026-10-09 (v0.2.0 to v0.3.0); what each still owes is listed in its row and is the next work when a game asks for it.

M1 to M3 is the big block, the largest piece of work since the expansion. Everything after is incremental.

A note after M5 (2026-10-09): the editor exe that shipped with M2 is a launcher (build, check, test, run, link), not the editor Tyson asked for on day one. M6 is where the Unity feeling comes from (viewport, hierarchy, inspector, assets, console, play bar, the Claude panel) and it starts now, before M7 to M11.

## 8. Rules

- The engine is released by tag; a game pins a tag; a game never builds against a branch.
- An engine change runs the engine smoke, then every game that will pick up the tag. A change that only one game wants is a game part, not an engine part.
- No game code in the engine, no engine code in a game. The build script refuses a duplicate top-level function on either side, so a copied helper cannot hide.
- The one-page, one-closure, no-bundler shape stays. A player's install is one exe or one folder.
- No Claude branding anywhere, no em dashes in shipped prose, the same lint gate in every repo.
