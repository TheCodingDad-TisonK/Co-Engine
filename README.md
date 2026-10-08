# Co Engine

The runtime, editor and template behind [Grow Co.](https://github.com/TheCodingDad-TisonK/Grow-Co) and [Depot Co.](https://github.com/TheCodingDad-TisonK/Depot-Co): one HTML page, one closure, three.js, no bundler, no framework. Every texture, figure and sound is generated in code.

**Status:** milestone 2 done, v0.1.0: the runtime stands in seventeen parts (the head, the three.js layer and the base palette, the bake, props and build mode, doors and touch screens, people, the world kit, the route finder, weather and the sky, vehicles, sound, settings and saves, the shell, the player, the dev link, the boot), with the tooling and the workflow templates beside it. The engine's own smoke boots a sample room through the whole loop. The editor shell runs and ships as one exe. Next is milestone 3: Depot Co on the engine. The contract a game writes against is `docs/ENGINE.md`. The plan is `docs/PLAN.md`; the inventory of what the two games share is `docs/M1-INVENTORY.md`; the two candidate games are planned in `docs/games/`.

## Run it

```
npm install
npm test            # builds the sample room, lints it, runs the engine's smoke in a hidden Electron window
npm run editor      # the editor from the repo
npm run editor:exe  # the editor as one portable exe in dist/
```

The editor opens a game folder (Depot Co, Grow Co, or a game made from the sample), builds it, checks it, runs it in a window, runs its tests, and links to the running game over the dev link on 127.0.0.1:8432 with a readout and the game's own command list. "New game from the sample" copies the sample room, three.js and this engine's parts into an empty folder that then builds on its own.

## What it will be

- **The runtime** (`engine/`): the parts both games carry today, joined in front of a game's own `src/` by the same build script the games use. 3D helpers and materials, the prop system with catalogue and build mode, bake, doors, the people rig, the screen kit, the sound synth, save slots, the HUD and menu shell, the Electron shell, the dev console link, the smoke harness and the build, lint, brand and icon tools.
- **The editor** (`editor/`): a desktop program that opens a game folder, shows the real game page as the scene, and edits layouts, props, config tables and texts through an inspector, saving clean diffs to the game's own files.
- **The template** (`template/`): a starter game. Clone, install, start, and a room runs.

A game pins a tag:

```json
"co-engine": "github:TheCodingDad-TisonK/Co-Engine#v0.1.0"
```

## Licence

MIT. Made by TheCodingDad.
