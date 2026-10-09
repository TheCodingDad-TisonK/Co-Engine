# Co Engine

The runtime, editor and template behind [Grow Co.](https://github.com/TheCodingDad-TisonK/Grow-Co) and [Depot Co.](https://github.com/TheCodingDad-TisonK/Depot-Co): one HTML page, one closure, three.js, no bundler, no framework. Every texture, figure and sound is generated in code.

**Status:** milestones 1 to 5 done (2026-10-09, v0.1.4): the runtime stands in eighteen parts, Depot Co 1.22 and Grow Co 1.29 run on it, the template installs from a fresh folder and Garage Co's first room stands on it. Milestones 6 and 7, the editor, are done at v0.1.7: the game runs inside the editor window with a scene camera, a hierarchy, an inspector, assets, a console and a play bar over the engine's editor bridge (`CO.editor`); undo and redo; the Pack tab edits a prop's build code live and saves it back into `src/`; the Profiler tab shows the frame's phases and the renderer's counts; the Build menu runs the game's scripts; and the same editor is an MCP server (`editor/mcp.js`), so Claude Code can see and change the running game from a terminal or from the Claude panel inside the editor. Milestone 8 is done at v0.2.0: a heightmap terrain with sculpt and paint brushes and flora scatter, materials from a layer graph edited live, and engine packs (a control panel, a gate, a barrier, a lever, signs, yard props) that the Assets tab adds to any game. Milestone 9 is done at v0.2.1: clips as data with an Animation tab that plays, scrubs and keys them on props and people, and UI as data (HUD chips, panels with buttons, start chips) in a UI tab. Next are the modeller and physics (M10, M11). The contract a game writes against is `docs/ENGINE.md`. The plan is `docs/PLAN.md`; the inventory of what the two games share is `docs/M1-INVENTORY.md`; the two candidate games are planned in `docs/games/`.

## Run it

```
npm install
npm test            # builds the sample room, lints it, runs the engine's smoke in a hidden Electron window
npm run editor      # the editor from the repo
npm run editor:exe  # the editor as one portable exe in dist/
node editor/mcp.js  # the editor as an MCP server on stdio (Claude Code starts it through .mcp.json)
```

The editor opens a game folder (Depot Co, Grow Co, Garage Co, or a game made from the sample), builds it and runs it in the viewport: Scene flies a camera over the running game, the hierarchy lists what stands in it, the inspector edits what you click (a prop's place through the layout and the save, or the live transform, material and light), the assets pane places props, the console runs the game's commands, and the play bar pauses, steps and restarts. Check, Test and the dev link on 127.0.0.1:8432 are there too.

What you change goes into the game's `src/`: the layout (where props stand, what is hidden, the copies you placed) writes itself to `src/00-layout.js` a moment after each change, the Pack tab writes build functions back into the part that holds them, and Ctrl+S saves everything pending. Release… in the Build menu bumps the version, writes the changelog entry, builds and checks, commits, tags, pushes and creates the GitHub release that the repo's workflow fills with the installer. Undo and redo (Ctrl+Z, Ctrl+Y) cover every edit the editor makes. The Pack tab shows the selected prop's build function; edit it and every placed copy rebuilds as you type, Revert drops the change, Save to src writes it into the game's part, New prop starts a definition from a template. The Profiler tab draws the frame's phases (sim, world, present, ui, render) against the 60 fps line with draws, triangles, textures, programs, heap and the scene counts. The Build menu lists build, check, test and the game's other npm scripts (installer, brand, zip) and opens the folders. The Terrain tab makes the ground a heightmap and the left button sculpts and paints it in Scene mode (raise, lower, smooth, flatten, paint; scatter props over it). The Materials tab composes materials from layers (bricks, planks, tiles, grain, blotches, cracks and more) with a picture beside the stack; a build function uses them as MAT.name. Assets lists the engine's packs and adds one to the game with a click. The Animation tab plays, scrubs and keys clips (wave, nod, spin, bob and your own) on the selected prop or person. The UI tab makes HUD chips, panels with buttons and start screen chips from expressions over the game's state, without code.

The Claude panel runs Claude Code in the open game's folder with the editor as its MCP server, so it can read and edit `src/`, build and test, and through the editor see the scene, select and move props, fly the camera and take screenshots. The same tools reach a terminal Claude Code: a game made from the template carries a `.mcp.json` that names `node_modules/co-engine/editor/mcp.js` as the server `co-editor`, and the engine repo's own `.mcp.json` names `editor/mcp.js`; the editor has to be open with the game playing for the scene tools to answer. The tools are status, open_game, play, reload, build, check, test, run_script, scene_tree, inspect, set, select, frame, spawn, remove, undo, redo, history, camera, pause, step, command, assets, screenshot, console_log, prop_source, prop_preview, prop_revert, prop_define, pack_save, profile, layout_save, save, release_preflight and release.

The latest editor exe is attached to each tag at [releases/latest](https://github.com/TheCodingDad-TisonK/Co-Engine/releases/latest); a tag push builds it. "New game from the sample" copies the sample room, three.js and this engine's parts into an empty folder that then builds on its own.

## What it will be

- **The runtime** (`engine/`): the parts both games carry today, joined in front of a game's own `src/` by the same build script the games use. 3D helpers and materials, the prop system with catalogue and build mode, bake, doors, the people rig, the screen kit, the sound synth, save slots, the HUD and menu shell, the Electron shell, the dev console link, the smoke harness and the build, lint, brand and icon tools.
- **The editor** (`editor/`): a desktop program that opens a game folder, shows the real game page as the scene, and edits layouts, props, config tables and texts through an inspector, saving clean diffs to the game's own files.
- **The template** (`template/`): a starter game. Clone, install, start, and a room runs.

A game pins a tag:

```json
"co-engine": "github:TheCodingDad-TisonK/Co-Engine#v0.1.0"
```

## Support

The engine and the games on it are free and stay free. The work is visible first on Patreon, with builds a week early and a vote on what comes next: https://www.patreon.com/cw/thecodingdad

## Licence

MIT. Made by TheCodingDad.
