# Co Engine

The runtime, editor and template behind [Grow Co.](https://github.com/TheCodingDad-TisonK/Grow-Co) and [Depot Co.](https://github.com/TheCodingDad-TisonK/Depot-Co): one HTML page, one closure, three.js, no bundler, no framework. Every texture, figure and sound is generated in code.

**Status:** milestone 1, the inventory. Nothing runs yet. The plan is `docs/PLAN.md`; the inventory of what the two games share lands in `docs/M1-INVENTORY.md`.

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
