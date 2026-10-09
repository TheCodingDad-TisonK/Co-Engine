# Co Engine: the plan

Written 2026-10-08, after 1.21.0 of Depot Co. Decisions taken so far: the engine lives in its own repo and every game pins a tag of it; Depot Co moves onto it first; the name is Co Engine (repo `TheCodingDad-TisonK/Co-Engine`, package `co-engine`, tags `v0.x.y`); the engine gets an editor of its own in the spirit of Unity, Godot and Unreal, not only a runtime library; and Claude works inside that editor, seeing what you see and acting through the same tools you click.

## 1. What it is

Four pillars, built in this order:

1. **The runtime.** The layer both games already carry twice: the 3D helpers, the prop system, build mode, bake, doors, the people rig, the screen kit, the sound synth, save slots, the HUD and menu shell, the Electron shell, the dev link, and the build, lint, brand, icon and smoke tooling. One repo, versioned by tag. A game's build joins the engine parts in front of its own parts, the way `src/NN-*.js` works today. Still one HTML page, one closure, no bundler, no framework.
2. **The editor.** A desktop program of its own (Electron, like the dev console but grown up) that opens a game folder, shows the scene, and edits what the engine understands: the layout, the props and their placement, the prop packs, the config tables, the screens and texts. It hosts the real game page for play-in-editor and talks to it over the dev link that exists today. It writes the game's source files on disk, so a change in the editor is a diff in git.
3. **The template.** A starter repo: config, one room, one prop pack, one person, one scenario, one screen. `git clone`, `npm install`, `npm start` and a game runs. Game three starts here.
4. **The assistant.** Claude inside the editor. The editor publishes its own actions as tools over a local MCP server, and a Claude session attaches to them: it sees the scene, the selection, the console and the logs, and it places, moves, edits, runs and tests through the same channel the inspector uses. Section 6 says how.

What it is not: a general engine. No physics beyond the AABB solids we have, no mesh or animation editor, no shader graph, no platforms beyond the browser and Electron. The editor edits this engine's data, nothing else. That limit is what makes it buildable by one person.

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
5. **M5, Grow Co on the engine.** The engine grows what Grow Co needs that Depot Co did not (the city, the car, the basement are game parts; the shelf kit and the customers' line may be packs). Its suite passes. DLC parts untouched.
6. **M6, the editor v1.** The MCP server over the editor's actions, then project, scene, inspector, play, console, and the Claude panel attached to the server. Writes layouts, placements, config and texts.
7. **M7, the editor v2.** Pack authoring with live preview, undo and redo as a diff stack, the profiler, the build menu.
8. **M8, terrain and the material graph.** The two with the most visible payoff for game three: a sculpted yard or town instead of a flat plane, and materials composed from the painters in a graph.
9. **M9, the animation timeline.** Clips as data, an engine player part, the people rig on clips.
10. **M10, the prop modeller.** Primitives, bevels, extrusions and lathes with gizmos, written out as build code; then vertex editing on data meshes.
11. **M11, physics.** The rigid-body layer for props and items, with the plug for a full solver.

Each of M8 to M11 is a project of its own, sized like the expansion. They are ordered by what a new game feels first.

M1 to M3 is the big block, the largest piece of work since the expansion. Everything after is incremental.

## 8. Rules

- The engine is released by tag; a game pins a tag; a game never builds against a branch.
- An engine change runs the engine smoke, then every game that will pick up the tag. A change that only one game wants is a game part, not an engine part.
- No game code in the engine, no engine code in a game. The build script refuses a duplicate top-level function on either side, so a copied helper cannot hide.
- The one-page, one-closure, no-bundler shape stays. A player's install is one exe or one folder.
- No Claude branding anywhere, no em dashes in shipped prose, the same lint gate in every repo.
