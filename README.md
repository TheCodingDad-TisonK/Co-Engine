# Co Engine

The engine and editor behind [Grow Co.](https://github.com/TheCodingDad-TisonK/Grow-Co), [Depot Co.](https://github.com/TheCodingDad-TisonK/Depot-Co) and Garage Co.: one HTML page, one closure, three.js, no bundler, no framework. Every texture, figure and sound is generated in code, and the editor runs the real game while you build in it.

**Version 0.10.0** (2026-10-10). Every milestone of the plan has shipped a first version. What is still owed is listed in [docs/PLAN.md](docs/PLAN.md).

## What is in it

- **The runtime** (`engine/`): 3D helpers and materials, the prop system with catalogue and build mode, the static bake, doors and touch screens, the people rig, the world kit, the route finder, weather and the sky, vehicles, the sound synth, saves and settings, the HUD and menu shell, the player, terrain, a material graph, clips, UI as data, tuning tables, a prop modeller and rigid-body physics. A game adds its own parts after the engine's, in file-name order.
- **The editor** (`editor/`): a desktop program that opens a game folder and runs the game in its viewport, with a scene camera, a hierarchy, an inspector and a tab for each kind of work. Everything you change is written back into the game's own `src/`.
- **Asset packs** (`packs/`): props any game can place from the Assets tab.
- **The template** (`template/`) and **the showcase** (`examples/showcase`): a starter game, and a hall built with every pack prop that the editor opens like any game.

## Asset packs

| Pack | Props | What is in it |
|---|---|---|
| Basics | 15 | A control panel with a touch screen that opens the gates, a sliding gate, a boom barrier, a lever, signs, crates, a pallet, a bench, a bin, cones, lamp posts, fences, a planter |
| Grow Co. | 67 | The till, the tip jar and the desk bell, goods shelves, fridges, the vending and coffee machines, sofas, desks, racks, lockers, the vault, the arcade cabinet and more |
| Depot Co. | 131 | A rack row, belt pieces and the packing line, the moulder, palletiser, hopper, silo and dock loaders, consoles, lockers, office and break room furniture, signs, posters, floor paint and the yard |
| Garage Co. | 11 | The tool wall, the workbench, the desk, the trolley jack, axle stands, the oil drum, the parts rack, the notice board, the compressor, a stool, a planter |
| Buildings | 18 | a walk-in shed, a carport, a bus shelter, shipping containers, a kiosk, a site office, a lock-up, a house, a shop front, a petrol canopy, a warehouse, and whole city blocks: apartments, an office tower, a terrace, a cafe, a supermarket and a multi-storey car park |
| Cars and vans | 12 | three saloons, a hatchback, an estate, an SUV, a pickup, a van, a box truck, a taxi, a police car and a bus, each with its own number plate |
| City streets | 27 | street lamps that light at night, traffic lights that cycle, a zebra crossing, signs, manholes, roadworks, benches, bins, a hydrant, a post box, a phone box, bollards, a bike rack, street trees, a parking meter, planters, an advertising column, a billboard, a fountain, and pedestrians walking, chatting and waiting |
| Nature | 13 | an oak, a pine, a birch, a palm, a bush, a hedge, a rock, a boulder, a fallen log, a stump, a flower bed, tall grass and a pond. Each one varies a little with where it stands |
| Industrial | 13 | pallet stacks, drums, gas bottles, an IBC, a skip, scaffolding, a generator, a substation, a pipe stack, a cable reel, a cement mixer and a forklift |
| Farm | 13 | round and wrapped bales, a bale stack, a fence, a gate, a trough, a tractor, a trailer, a wheelbarrow, a scarecrow, a chicken coop, a water tank and a feed silo |
| Park and play | 11 | swings, a slide, a seesaw, a sandpit, a climbing frame, a picnic table, a football goal, a basketball hoop, a gazebo, a drinking fountain and a park sign |
| Home | 14 | a sofa, an armchair, a coffee table, a TV unit, a bookcase, a dining set, a double bed, a wardrobe, a kitchen run, a fridge, a floor lamp that lights, a rug, a house plant and a bathroom set |
| Office | 12 | a desk with two screens, an office chair, a meeting table with six chairs, a filing cabinet, a whiteboard, a water cooler, a copier, a partition, a reception desk, a server rack, an office plant and lockers |
| Shop and market | 13 | a checkout, stocked shelving, a drinks chiller, a chest freezer, a fruit and veg stand, a bakery counter, a magazine rack, trolleys, baskets, a market stall, a sandwich board, an ATM and an ice cream cart |
| Harbour | 14 | a jetty, a mooring bollard, a cleat with rope, a lifebuoy, a rowing boat, a motor boat, a fishing boat, a marker buoy, fish crates, lobster pots, a net rack, a lighthouse that lights, a dock crane and a harbour office |
| Camping | 13 | a dome tent, a ridge tent, a campfire that flickers and lights, a camping chair, a cool box, a barbecue, a picnic blanket, a log bench, a hammock, a canoe, a signpost, a camper van and a firewood pile |
| Roads | 16 | 10 m and 20 m straights, a crossroads, a T-junction, a 90 degree bend, a roundabout and a dead end, all 7 m of tarmac between 2 m pavements, plus a pavement strip, parking bays, a bus stop, a speed bump, a crash barrier, cones, lane arrows, a give way line and a sign gantry |

The thirteen packs below Garage Co. (0.10.0) are built for any game: a whole street, a campsite or a harbour can be laid out from them. The road pieces are 7 m of tarmac between 2 m pavements and join end to end.

A pack prop looks like the original and its use says what it is; the game logic behind it stays in its own game. The three game packs are generated from each game's source: `node tools/packs/make-pack.js depotco` (or `garageco`) regenerates one after its game changes, and Grow Co. has its own pair of tools beside it.

## Changing how a prop looks

No Blender needed. In the editor:

- **Model tab.** Build a prop from parts: boxes, cylinders, spheres, planes, signs, lights, lathes, extrusions and meshes whose corners you drag in the viewport. Click a part to pick it, nudge it with the arrows, change its material or colour, mirror the whole prop. Every placed copy rebuilds as you edit.
- **Parts from this prop** (0.8.0). Select any prop, pack props included, and the Model tab reads it back as parts. Sizes, turns and materials carry over, a picture drawn in code rides along, and glass stays see-through. Reshape and recolour it, then Save to src.
- **Pack tab.** The selected prop's build code, edited live; a build that throws is refused and the old one stays.
- **Claude panel.** Describe the change and Claude makes it while you watch.

A prop whose build code is shared, like every pack prop, is saved for that prop alone in `src/00-models.js`, so changing the vending machine never touches the other props of its pack.

## Run it

```
npm install
npm test            # builds the sample room, lints it, runs the engine's smoke in a hidden Electron window
npm run editor      # the editor from the repo
npm run editor:exe  # the editor as one portable exe in dist/
node editor/mcp.js  # the editor as an MCP server on stdio (Claude Code starts it through .mcp.json)
```

The editor exe is private: it is built with `npm run editor:exe` and is not published with the releases. "New game from the sample" copies the sample room, three.js and the engine's parts into an empty folder that then builds on its own.

## The editor

- **Scene, Top and Game views** over the running game; pause, step and restart from the play bar. Ctrl and the mouse drag and turn any prop in any view; PageUp and PageDown lift it.
- **Everything in the world is editable** (0.9.0): walls, floors, lamps, trees, fences and the ground the game builds can be moved, turned, resized and removed like props, and the change is kept in `src/00-world.js`.
- **Select several things** (0.9.0): Ctrl and a click adds to the selection; drag one and they all move together; Delete removes them all. Shift and a drag in the scene camera draw a box that selects everything standing inside it (0.9.1).
- **Duplicate, copy and paste** (0.9.4): Ctrl+D copies what is selected right beside it, Ctrl+C and Ctrl+V paste it where the camera looks. Trees, lamps, walls and props alike.
- **Hierarchy and inspector**: what stands in the game, and the place, material and light of what you click. Drop lets a prop fall under physics and keeps where it lands.
- **Tabs**: Console, Assets, Readout, Pack, Terrain (sculpt, paint, roads, scatter), Materials (layer stacks and GLSL), Profiler, Animation (clips and a dope sheet), UI (HUD chips, panels and buttons as data), Model, Settings (the game's tuning tables), File, and the Claude panel.
- **Saving**: the layout writes itself to `src/00-layout.js` a moment after each change, every other tab saves into its own part of `src/`, Ctrl+S saves everything pending, and undo and redo cover every edit.
- **Release…** in the Build menu bumps the version, writes the changelog entry, builds, checks, commits, tags, pushes and creates the GitHub release that the repo's workflow fills with the installer.

The editor is also an MCP server with 75 tools: Claude Code sees the scene, selects, places and moves props, flies the camera, takes screenshots, edits and saves props, models, terrain, materials, clips and UI, runs the game's commands, and builds, tests and releases. A game made from the template carries a `.mcp.json` that names the server; the editor has to be open with the game playing for the scene tools to answer.

## Docs

- [docs/ENGINE.md](docs/ENGINE.md): the contract a game writes against, part by part.
- [docs/PLAN.md](docs/PLAN.md): the milestones, what shipped in each version and what is still owed.
- [docs/games/](docs/games/): the next games, Garage Co. and Garden Co.

A game pins a tag, so an engine change never breaks a shipped game by surprise:

```json
"co-engine": "github:TheCodingDad-TisonK/Co-Engine#v0.10.0"
```

## Support

The engine and the games on it are free and stay free. The work is visible first on Patreon, with builds a week early and a vote on what comes next: https://www.patreon.com/cw/thecodingdad

## Licence

All rights reserved. You may download and try the editor; copying, sharing or using the engine, its packs or its template to make a game needs written permission. Releases up to v0.9.3 were MIT. See [LICENSE](LICENSE). Made by TheCodingDad.
