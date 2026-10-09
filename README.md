# Co Engine

The runtime, editor and template behind [Grow Co.](https://github.com/TheCodingDad-TisonK/Grow-Co) and [Depot Co.](https://github.com/TheCodingDad-TisonK/Depot-Co): one HTML page, one closure, three.js, no bundler, no framework. Every texture, figure and sound is generated in code.

**Status:** milestones 1 to 5 done (2026-10-09, v0.1.4): the runtime stands in eighteen parts, Depot Co 1.22 and Grow Co 1.29 run on it, the template installs from a fresh folder and Garage Co's first room stands on it. Milestone 6, the editor, is in progress: since v0.1.5 the game runs inside the editor window with a scene camera, a hierarchy, an inspector, assets, a console and a play bar over the engine's editor bridge (`CO.editor`); the MCP server and the Claude panel are next. The contract a game writes against is `docs/ENGINE.md`. The plan is `docs/PLAN.md`; the inventory of what the two games share is `docs/M1-INVENTORY.md`; the two candidate games are planned in `docs/games/`.

## Run it

```
npm install
npm test            # builds the sample room, lints it, runs the engine's smoke in a hidden Electron window
npm run editor      # the editor from the repo
npm run editor:exe  # the editor as one portable exe in dist/
```

The editor opens a game folder (Depot Co, Grow Co, Garage Co, or a game made from the sample), builds it and runs it in the viewport: Scene flies a camera over the running game, the hierarchy lists what stands in it, the inspector edits what you click (a prop's place through the layout and the save, or the live transform, material and light), the assets pane places props, the console runs the game's commands, and the play bar pauses, steps and restarts. Check, Test and the dev link on 127.0.0.1:8432 are there too. "New game from the sample" copies the sample room, three.js and this engine's parts into an empty folder that then builds on its own.

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
