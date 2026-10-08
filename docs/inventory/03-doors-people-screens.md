# Inventory 03: doors, people, screens (Depot Co = A, Grow Co = B)

Read-only pass on 2026-10-08. Every top-level function in the nine files appears once below. Grow Co's `guard.say` and `guard.startCheck` count as top-level because they are assigned at file scope. Helpers nested inside `makeHuman` (`mesh`, `leg`, `arm`, and B's `strands`) are listed where the brief asked for them, but they are not in the counts. Two B helpers that this layer depends on sit outside the read set: `walkAlong` (11-customers-line.js:47) and `deskTrim` (23-board.shop.js:28, 23-board.desk.js:101). A's office PC (`pc.on`) and its dock-door `setDoor` (06-building.js:172) are also outside the read set.

Three structural facts:
- A's 06-doors.js holds A's whole touch-screen kit (lines 2 to 21) as well as the doors.
- A's doors swing on a hinge. B's doors slide.
- A's rig says in its header that it was built at Grow Co.'s proportions: the HUMAN_GEO sizes match, and A scales the figure by 0.93.

## 1. Identical

| name(s) | A file:line | B file:line | note |
|---|---|---|---|
| (no top-level function) | none | none | No top-level function has the same body in both games. |
| `mesh` (nested in makeHuman) | 11-staff.js:85 | 09-humans-guard.js:76 | Byte-identical helper: makes a mesh, positions it, turns on castShadow, adds it to a parent. |
| (data, not functions) | 11-staff.js:53-74 | 09-humans-guard.js:43-65 | HUMAN_GEO limb, head and hair-shell geometry and their scale() calls are the same. B adds toe, afro, scalp, skirt, coat and strand. A adds lace, belt, buckle, placket, button, pocket, vest, band, strap and peak. The eye drawing inside faceTex is also line-for-line the same (A 22-35, B 12-25). |

## 2. Same name, different body

| name(s) | A file:line | B file:line | note |
|---|---|---|---|
| `touchScreen` | 06-doors.js:4 | 23-screen-kit.js:5 | A builds the mesh, parents it, registers its own prompt and use with `addInter`, and uses `res` plus a `dirty` flag. B returns a mesh with no parent and no interaction, and adds `scale`, `hot`/`hotZone`, `live` ms, a `tap(z)` dispatcher, `wheel` and `kind`. |
| `faceTex` | 11-staff.js:16 | 09-humans-guard.js:8 | A is `(key, mood, skin, blink)`: traits come from a hash of the key through faceSpec, it draws with the `tex()` helper, and its moods include tired. B is `(mood, glasses, spec, blink)`: an explicit spec (lipstick, eyeColor, browColor, freckles), its own canvas, and sad/sleepy moods. |
| `makeHuman` | 11-staff.js:76 | 09-humans-guard.js:66 | A takes `opt` (vest, hardhat, name tag, cap, rolled, random beard and glasses), stores parts as `u.legs`/`u.arms`/`u.torso`/`u.head`/`u.face`, scales by 0.93 and uses `groundBlob`. B takes `spec`, stores parts in `userData.parts` {lLeg, rLeg, lArm, rArm, torso, head, face, chest}, and adds coat, skirt, logo, afro, mohawk, ponytail, five hats, six hand props, a setMood closure and `floorBlob`. |
| `animateHuman` | 11-staff.js:139 | 09-humans-guard.js:163 | A is `(g, dt, mode, speed, look{x,y,z}, carry)` with modes walk, idle, wait, work and sit, carry poses true, 'jack' and 'tow', and runs blink and the speech-bubble timer inside. B is `(g, dt, state, speed, lookAt Vector3)` with a rope hold, prop poses, an impatient wait and hunch, blinks through `humanBlink`, and has no carry pose. |
| `leg` (nested) | 11-staff.js:87 | 09-humans-guard.js:78 | Same pivots and sizes. B adds optional socks and creates its materials inline. A uses shared LACE_M and SOLE_M. |
| `arm` (nested) | 11-staff.js:106 | 09-humans-guard.js:100 | Same pivots. A has rolled sleeves only. B has short sleeves (`longSleeve: false`), rolled, a watch, and keeps `userData.hand`. |
| `doorPose` | 06-doors.js:47 | 19-doors-fixtures-intro.js:12 | A turns the hinge by `t * 1.65 * swing` and sets the LED colour. B slides the leaf group 1.2 m along its wall. |
| `doorPrompt` | 06-doors.js:48 | 19-doors-fixtures-intro.js:78 | A takes the door object and returns plain text. B takes the interact data, depends on whether you hold the keyring, and returns HTML with `<small>`. |
| `navBuild` | 11-staff.js:190 | 10-staff-paths.js:9 | A builds a 0.4 m grid from `solids`, with blocked = 2 outside the walkable halls. B builds a 0.2 m grid from `world.obstacles` (ground floor only), as three grids: `grid` (locked doors block), `raw` (no door blocks) and `staff` (keyholders pass). |
| `carryBack` | 11-staff.js:504 | 10-staff-paths.js:267 | Name collision only. A walks the worker to a rack slot and racks the box. B puts the crate in their arms straight back into S.storage. |

## 3. Same purpose, different names

| name(s) | A file:line | B file:line | note |
|---|---|---|---|
| `hingedDoor` / `slideDoor` | 06-doors.js:27 | 19-doors-fixtures-intro.js:5 | A: swinging leaf, optional window and pushbar, a frame on its own static group, saved in S.hdoors {open, locked}. B: sliding leaf with glass panes, a DOOR_NAMES label, floor level, an obstacle, saved in S.doors and S.doorLocks. |
| `hd` / `doorById` (map) | 06-doors.js:46 | 19-doors-fixtures-intro.js:3 | Door state lookup. A reads saved state by id with a default. B keeps the state on the runtime record. |
| `doorUse` / `toggleDoor` | 06-doors.js:49 | 19-doors-fixtures-intro.js:19 | A: Shift sends it to lock, and a locked door refuses. B: also refuses while the player stands in the doorway, handles `relock`, and saves. |
| `doorLock` / `keyDoor` | 06-doors.js:50 | 19-doors-fixtures-intro.js:72 | A: you always carry the keys, and it closes before locking. B: needs the keyring item in the hotbar and refuses while you are in the doorway. |
| `doorsTick` / `updateDoors` | 06-doors.js:51 | 19-doors-fixtures-intro.js:24 | A: a walking staff member within 1.3 m holds the leaf open for that moment only, with no state change. B: anyone opens an unlocked door, a keyholder passes a locked one, it closes 4 s after the last person is clear, plus a special staff door. Both ease `t` toward the target the same way (`1 - 0.006^dt`). |
| `doorSolids` / `doorObstacle` | 06-doors.js:60 | 19-doors-fixtures-intro.js:13 | A pushes a collision box for each door less than half open into an `out` list on every call. B keeps one `world.obstacles` entry, added or removed when the door changes. |
| `lockAll` / `doorsAll` | 06-doors.js:61 | 19-doors-fixtures-intro.js:16 | A locks or unlocks everything, also shuts the dock doors and logs it (night mode). B has open, close, lock and unlock modes and includes the staff door. |
| LED inside `doorPose` / `doorLed` | 06-doors.js:47 | 19-doors-fixtures-intro.js:14 | Green unlocked, red locked. B sets both color and emissive. |
| `cabinetBuild` / `buildSecScreen` + `drawSecScreen` | 06-doors.js:66 | 24-screens.js:81, 92 | The wall screen that controls the doors. The door-list widget is the shared part. A's lights, night mode and dock doors, and B's cameras and alerts pages, are game content. |
| `screenZone` / `touchUpdate` | 06-doors.js:13 | 23-screen-kit.js:41 | Hit test from crosshair UV to a zone. A raycasts on demand with the shared `ray`. B runs every frame for the screen of the focused kind, tracks the hot zone and triggers redraws. |
| `screenTap` / `touchTap` | 06-doors.js:14 | 23-screen-kit.js:54 | A runs the zone's `act` closure and sets a ripple. B calls `sc.tap(zone)` (string act plus id) and stamps the tap point for the ripple. |
| `drawScreens` / `tDraw` | 06-doors.js:15 | 23-screen-kit.js:40 | A loops over all screens, redraws the dirty ones, and handles autoPage and the ripple ring. B redraws one screen when its hot zone changes, the cursor moves or `live` ms pass (66 ms throttle), and draws the cursor. |
| prompt closure in `touchScreen` / `touchPrompt` | 06-doors.js:10 | 23-screen-kit.js:56 | The zone label as the interaction prompt. B returns HTML with an idle hint. |
| `scBg` / `scrBg` | 06-doors.js:18 | 23-screen-kit.js:61 | A: flat #0d1216, amber radial, 16 px dot grid. B: vertical gradient, accent radial through scrRgba, a dot grid scaled to the width, a vignette. |
| `scHead` / `scrHead` | 06-doors.js:19 | 23-screen-kit.js:68 | A: amber title, subtitle or `fmtTime(S.time)` on the right, a rule. B: header band, emoji badge, title and subtitle, `clockText()`, gradient rule. |
| `scButton` / `tBtn` | 06-doors.js:20 | 23-screen-kit.js:25 | A: flat rounded rect that shrinks the font to fit and pushes a zone with a closure. B: draws through scrBtnBody and tZone, has a hot glow, a sub line and an off state, and keys zones by "act:id". |
| `scText` / `scrTitle` | 06-doors.js:21 | 23-screen-kit.js:101 | A clamps text width to the screen edge at any resolution. B is bold with no width clamp. |
| `scanFit` / `deskTrim` | 13-scanner-device.js:155 | (23-board.shop.js:28, outside the set) | Text fit with an ellipsis. A uses a binary search. B trims in a loop. |
| `setMood` / `userData.setMood` closure | 11-staff.js:136 | 09-humans-guard.js:151 | Swaps the face texture for a mood. B keeps it as a closure inside makeHuman. |
| blink inline / `humanBlink` | 11-staff.js:166 | 09-humans-guard.js:158 | A blinks inside animateHuman for 0.12 s every 2 to 6.5 s. B uses a separate function, 0.11 s every 2.2 to 6.7 s, and skips sleepy faces. |
| carry poses inline / `carryPose` | 11-staff.js:149-151 | 10-staff-paths.js:270 | A sets the arms inside animateHuman (true, jack, tow). B overrides the arms after animateHuman has run. |
| `say` / `workerSay`, `guard.say` | 11-staff.js:170 | 10-staff-paths.js:132; 09-humans-guard.js:218 | Speech bubble. A draws a word-wrapped bubble sprite per call, times it in animateHuman and sets the talk mood. B swaps a textTex on a sprite built once and hides it with setTimeout. |
| `route` / `navPath` + `routeTo` | 11-staff.js:211 | 10-staff-paths.js:30, 56 | A* with string pulling and no corner cutting. A: linear open-list scan, 20000 steps, returns [b] on failure. B: binary heap, typed arrays, 60000 iterations, falls back to the nearest reachable cell, grid chosen per call. |
| `NAV.dirty` flag / `navKey` | 11-staff.js:189 | 10-staff-paths.js:7 | Rebuilding the grid. A uses a dirty flag. B uses a checksum of the obstacles and door locks. |
| `navOpen` / `navFree` | 11-staff.js:200 | 10-staff-paths.js:26 | Cell test. A's version carries game exceptions (staff door strip, docked trailers). B's is a plain lookup in the chosen grid. |
| `navCell` / `navFreeAt` | 11-staff.js:208 | 10-staff-paths.js:27 | A maps world position to a clamped cell. B tests whether a world point is free. |
| `navNearestOpen` / `navNearest` | 11-staff.js:209 | 10-staff-paths.js:28 | Ring search. A searches radius 8 and returns the input cell if nothing is found. B searches radius 10 and returns null. |
| `navLine` / `navLos` | 11-staff.js:210 | 10-staff-paths.js:29 | Line of sight on the grid. A steps half a cell and checks diagonal corners. B steps 0.1 m. |
| `staffWalk` / `walkAlong` | 11-staff.js:310 | (11-customers-line.js:47, outside the set) | Path follower. A moves a data record (st.x, st.z, st.yaw) with game speed rules and sets the next state. B moves the Group, returns true on arrival, and has rope gating and easeYaw. |
| `staffGo` / `guardGo` | 11-staff.js:309 | 10-staff-paths.js:352 | Plan a route and start walking with a callback or next state. B also lifts the guard's post obstacle. |
| `buildScanner` / `deviceEl` | 13-scanner-device.js:13 | 24-screens.js:240 | Hand-held device. A is a 3D prop held in the hand with a 300x380 canvas at 2x resolution, a laser and an LED, plus the floor waypoint marker. B is a DOM overlay (phone or tablet). |
| `tickScanner` / `deviceOpen` + `deviceClose` | 13-scanner-device.js:216 | 24-screens.js:250, 251 | Show and hide. A raises the device with a lerp on Tab and also runs the waypoint, the HUD heading and the scan beep. B toggles the overlay and the pointer lock. |
| `drawScanner` / `deviceRender` | 13-scanner-device.js:156 | 24-screens.js:271 | Render pages. A draws a canvas row list (tabs, cursor, scroll, swatch, right column, act and nav glyphs). B renders HTML app panes. |
| `drawScanMap` / `ensureCityMap` | 13-scanner-map.js:13 | 24-screens.js:262 | Top-down map. A draws on the device canvas (its body is site content). B uses an overlay canvas, drawn by drawCityMap elsewhere. |

## 4. In one game only but engine-worthy

| name(s) | A file:line | B file:line | note |
|---|---|---|---|
| `screenDirtyAll` | 06-doors.js:16 | none | Marks every screen dirty. Needed if the engine keeps A's dirty model. |
| `faceSpec` | 11-staff.js:15 | none | Fixed face traits from a key hash. Covers B's explicit spec when none is given. |
| `staffWait`, `idleAt` | 11-staff.js:482, 483 | none (B uses job.dur inside updateOneWorker) | Generic walker behaviours: wait, then call back; walk to a spot, then idle. |
| `scanScroll`, `scanAct`, `scanGo`, `scanClearNav`, `scanArrow` | 13-scanner-device.js:215, 205, 210, 214, 198 | none | Row-list device kit: move the cursor, run the row's action, set and clear a waypoint, heading arrow. Generic over the row model `{text, sub, right, sw, nav, act}`. |
| `setDoor` | none | 19-doors-fixtures-intro.js:15 | One setter for door state (open, lock, relock, save, obstacle, LED). A writes state inline. Collides with A's dock `setDoor(i, open)` in 06-building.js:172. |
| `staffKey`, `staffPass` | none | 19-doors-fixtures-intro.js:20, 21 | Per-door keyholder flag. A keyholder unlocks, walks through, and the door relocks when it shuts. |
| `folkNear` | none | 19-doors-fixtures-intro.js:22 | Is anyone (player or listed people) within r. Used for auto-close. |
| `doorAt`, `npcDoors` | none | 10-staff-paths.js:59, 67 | A walker opens the door it reaches. A locked door is returned to the caller. A does this inside doorsTick. |
| `tZone`, `scrBtnBody`, `tCursor`, `touchFor` | none | 23-screen-kit.js:12, 14, 32, 55 | Zone registration with hot highlight, button body, crosshair cursor and tap ripple, lookup by kind. |
| `touchHint` | none | 23-screen-kit.js:53 | First-use hint. Engine-worthy once the text and the `xs()` save flag are parameters. |
| `scrRgba`, `scrCard`, `scrStat`, `scrPill`, `scrMeter`, `scrFoot`, `scrLcd` | none | 23-screen-kit.js:60, 80, 86, 91, 97, 102, 104 | Drawing kit pieces A lacks. They read DESK_* colour and font globals, which should become a theme. |
| `screenShell`, `litPlane` | none | 23-screen-kit.js:112, 123 | Screen housing (rim, bezel, camera dot, LED) and a plain lit canvas plane. |
| `pcEl`, `pcOpen`, `pcClose`, `pcApp`, `pcRender`, `updatePcZoom` | none | 24-screens.js:190, 200, 204, 219, 220, 208 | Sit at a PC, the camera flies into the screen, a DOM desktop with apps. The app list is game. A has its own PC outside the read set: compare before merging. |
| `wheelOpen`, `wheelClose`, `wheelPick` | none | 24-screens.js:299, 307, 308 | Radial quick menu. The items are game. |
| `fixtureAdd`, `fixtureFromBuild`, `fixtureSign`, `applyFixtures`, `fxFace`, `fxCarry`, `fxHover`, `fxDrop`, `fxReset` | none | 19-doors-fixtures-intro.js:83, 93, 94, 95, 99, 100, 108, 109, 110 | Wall-hung or table fixture edit mode. Engine-worthy, but it belongs in an edit or placement part, not 21/22/23. |
| `intro`, `introRunning`, `introSkip`, `introRestart`, `introFinish`, `updateIntro`, `introDraw` | none | 19-doors-fixtures-intro.js:128, 129, 130, 131, 132, 139, 150 | Guided-step runner that polls save predicates. The steps and the bonus are game. It belongs in a tutorial part, not this layer. |

## 5. Stays in the game

| name(s) | A file:line | B file:line | note |
|---|---|---|---|
| Night doors, cabinet stub: `anyDoorUnlockedAtNight`, `buildControlCabinet` | 06-doors.js:62, 65 | none | Depot rules. |
| Depot staff roster and lifecycle: `voice`, `staffSay`, `staffById`, `onBreak`, `hireStaff`, `fireStaff`, `buildStaffMesh`, `staffDropAll`, `tickStaff`, `staffPrompt`, `staffUse`, `punctWord` | 11-staff.js:251, 252, 253, 254, 255, 263, 269, 296, 333, 478, 479, 477 | none | Shifts, clock, pay, voices. |
| Depot roles: `roleHasWork`, `roleThink`, `receiverThink`, `pickerThink`, `packerThink`, `carryToBin`, `pickInFlight`, `skuDemand` | 11-staff.js:382, 389, 484, 511, 533, 510, 320, 327 | none | Staff job logic. |
| Depot forklift driver: `staffDriving`, `driverSpot`, `driverJob`, `driverThink`, `forkFollow`, `forkTurnTo`, `driveTick`, `driverDismount` | 11-staff.js:295, 401, 402, 413, 423, 431, 432, 458 | none | Vehicle driving by staff. |
| Depot spots and jacks: `slotStand`, `benchSide`, `clockStand`, `clockFaceYaw`, `breakSpot`, `hasJack`, `jackRank`, `jackHome`, `jackFollow`, `staffRank`, `spreadSpot` | 11-staff.js:237, 464, 465, 466, 472, 473, 474, 475, 280, 480, 481 | none | Places on the site and the pallet jack prop. The tow/jack arm poses stay in the rig. |
| Depot scanner pages: `scanSlotNav`, `scanPickSlot`, `scanDoorNav`, `scanPropNav`, `scanLane`, `scanReturnsNav`, `scanReturnsWhere`, `scanPageRows`, `scanReadout`, `drawScanFoot`, `scanSignAct`, `mapBounds` | 13-scanner-device.js:38, 39, 42, 43, 44, 46, 47, 48, 135, 190, 203; 13-scanner-map.js:8 | none | Row content, readouts, site bounds. |
| Grow locks and keyring: `locks`, `isLocked`, `shutterOpen`, `setShutter`, `toggleLock`, `lockedStop`, `lockNote`, `hasKeys`, `syncKeyHook`, `keyHookPrompt`, `keyHookInteract` | none | 19-doors-fixtures-intro.js:55, 56, 57, 58, 59, 66, 67, 68, 69, 70, 71 | Cabinet shutters and the keyring item. |
| Grow intro content: `anySeed`, `anyPotSoil`, `introMenuHtml` | none | 19-doors-fixtures-intro.js:115, 116, 162 | Step predicates and the pause-menu HTML. |
| Grow guard: `buildGuard`, `updateGuard`, `guard.startCheck`, `guardIdLine`, `guardOff`, `guardShift`, `guardTask`, `guardTaskLabel`, `guardMenu`, `updateGuardTasks` | none | 09-humans-guard.js:208, 219, 235, 236; 10-staff-paths.js:180, 181, 192, 105, 217, 353 | Security guard behaviour and orders. |
| Grow crew: `crewHireCost`, `crewList`, `crewName`, `crewOnFloor`, `crewShift`, `taskWords`, `workerTaskLabel`, `crewLine`, `buildWorker`, `removeWorker`, `crewSync`, `hireWorker`, `fireWorker`, `payWages`, `workerTask`, `postStart`, `postSet`, `postClear`, `workerMenu` | none | 10-staff-paths.js:79, 80, 90, 91, 92, 103, 104, 112, 116, 125, 133, 146, 158, 165, 179, 194, 199, 208, 209 | Hiring, pay, voices, posting. |
| Grow crew jobs: `workerFillLine`, `workerPick`, `workerServe`, `workerTakeBroom`, `workerDropBroom`, `restockDest`, `restockNext`, `carrySet`, `restockTake`, `restockArrive`, `restockJob`, `workerNextJob`, `updateWorker`, `updateOneWorker` | none | 10-staff-paths.js:219, 224, 232, 244, 245, 249, 260, 261, 275, 279, 299, 308, 322, 330 | Serve, restock, clean, water. |
| Grow screens content: `buildPos`, `drawRegister`, `drawPosCust`, `drawPos`, `posTap`, `secCamLabel`, `secTap`, `officeSeat`, `drawPcScreen`, `pcApps`, `phoneOpen`, `paneWallet`, `panePeople`, `paneTablet`, `wheelItems`, `paneDesk` | none | 24-screens.js:3, 20, 21, 28, 68, 91, 124, 137, 141, 189, 252, 253, 254, 263, 286, 309 | Till, security, PC, phone and wheel content. |

## Summary

1. Function counts: A 06-doors.js 21, 11-staff.js 56, 13-scanner-device.js 20, 13-scanner-map.js 2 (A total 99). B 19-doors-fixtures-intro.js 43, 09-humans-guard.js 9, 10-staff-paths.js 53, 23-screen-kit.js 23, 24-screens.js 32 (B total 160).
2. Per section: (1) identical 0 top-level, 1 nested helper; (2) same name, different body 8 names (16 functions) plus 2 nested; (3) same purpose 34 rows (29 A and 34 B functions); (4) engine-worthy in one game only 9 A and 45 B; (5) stays in game 53 A and 73 B.
3. "21-doors.js": one door record (open, locked, t, auto, relock) behind a save adapter. Two leaf motions: hinge (A hingedDoor/doorPose) and slide (B slideDoor/doorPose). Plus doorLed, setDoor, toggle and lock (doorUse/toggleDoor, doorLock/keyDoor), keyholder pass (staffKey, staffPass), walker auto-open with 4 s auto-close (doorsTick/updateDoors, folkNear, doorAt, npcDoors), collision export (doorSolids/doorObstacle), bulk lock (lockAll/doorsAll) and doorPrompt. Names, the staff door, the keyring and the cabinet content stay in the games.
4. "22-people.js": HUMAN_GEO with palettes passed in, faceSpec plus a merged faceTex, a merged makeHuman that returns one parts object and takes the union of options, a merged animateHuman (walk, idle, wait, work, sit; carry true/jack/tow; prop poses as hooks), humanBlink, setMood, the say bubble, a walker (walkAlong/staffWalk, staffGo, staffWait, idleAt), and the grid router (B's heap navPath with nearest-reachable fallback, navLos, navNearest, a rebuild key, optional door-aware grids).
5. "23-screens.js": a merged touchScreen (res/scale, a dirty flag plus a live interval, zones, a hot zone, tap by closure or dispatcher), the hit test and redraw loop (screenZone/touchUpdate, drawScreens/tDraw), tCursor and the ripple, touchPrompt, touchFor, screenShell, litPlane, a themed drawing kit (bg, head, button, text, card, stat, pill, meter, foot, lcd, rgba, text fit) with fonts and colours in a theme object in place of Bahnschrift and DESK_* globals, and the row-list device kit with the waypoint (scanScroll, scanAct, scanGo, scanClearNav, scanArrow). The PC zoom and the quick wheel are optional extras.
