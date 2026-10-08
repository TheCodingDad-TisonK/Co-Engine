# A new game on Co Engine

This folder is the template: one room, a door, a touch screen, a prop you can carry, a chair in the catalogue, two people, a car on a lane, weather. Clone it, rename it, and start replacing the room.

```
npm install        # fetches the engine at the tag named in package.json, and Electron
npm run build      # joins the engine parts and src/ into game/game.js
npm start          # the desktop window
npm run dev        # the same, linked to the Co Engine editor from the first frame
npm test           # the check script, then the smoke in a hidden window
```

Or open this folder in the Co Engine editor: it builds, runs and tests it from there, and links to the running game.

The engine's contract, every hook and every page element, is in the engine repo under `docs/ENGINE.md`. The parts in `src/` are joined in file-name order after the engine's; `//@` lines at column 0 are notes for the reader and are left out of the build.
