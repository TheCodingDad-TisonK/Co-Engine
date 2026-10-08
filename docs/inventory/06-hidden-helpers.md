# Inventory 06: engine-worthy helpers hiding in the game-content files (Depot Co = A, Grow Co = B)

Read-only pass on 2026-10-08 over every part the other five inventories did not cover: 24 file parts in A and 37 files in B. Line numbers come from the current working trees. "(nested)" means the helper is a closure inside a bigger build function, so it has to be lifted out before the engine can share it. "(outside scan)" points into a file another inventory covers and is only there to show the pairing.

## 1. Engine-worthy helpers

| helper | A file:line | B file:line (or none) | what it does | engine part |
|---|---|---|---|---|
| Fence run | 06-yard.js:68 fenceRun (nested in buildYard) | 07-building.js:359 fenceRun (nested in buildAnnex) | Posts, mesh panels and rails along a segment. A also adds a solid and three barbed wires | 24-world |
| Tree | 06-yard.js:18 tree; 06-props.js:519 canopy, 520 treeBuild | 14-city.js:36 broadleafGeo, 45 pineGeo, 72 plantTree; 14-city.js:318 tree (nested) | Trunk plus lumpy crown. A builds one mesh per tree with a seeded jitter. B uses instanced merged geometry | 24-world |
| Bush, tuft, flower, scatter | none | 14-city.js:50 bushGeo, 51 cardGeo, 73 plantBush, 75 plantFlower, 76 plantTuft, 78 scatterGreenery | Crossed alpha cards and lumpy bushes, scattered over open ground | 24-world |
| Instanced pool | 07-items.js:8 mkInst, 16 setInst | 14-city.js:52 floraSet, 65 plant, 34 placeM | InstancedMesh with a cap and a running count, plus per-instance matrix and tint | 10-three |
| Geometry merge and deform | 06-props.js:519 canopy (vertex jitter) | 14-city.js:26 mergeGeo, 31 lumpy, 35 alongM | Merge parts into one non-indexed geometry, add a bulge field, place a cylinder along a direction | 10-three |
| Seeded random | 06-props.js:138 propSeed (FNV hash), 139 seededF; 06-props.js:522 LCG (nested) | 14-city.js:24 frnd, 25 fr; 14-city.js:348 rnd (nested) | Deterministic random from an id or a seed | 43-format |
| Chance helper | none | 21-police-lobby.js:304 unitRoll | Succeeds if any of n tries at probability p does | 43-format |
| Street lamp | 06-props.js:600 lampPostBuild; 06-yard.js:146 (inline road lamps) | 14-city.js:311 lamp (nested); 22-dehum-street-rooms.js:80 (inline) | Post, arm and a glowing head | 24-world |
| Road | 06-yard.js:142-147 (inline in buildYard) | 14-city.js:211 cityRoad; 22-dehum-street-rooms.js:67 buildStreet (70-77) | Tarmac plane, kerbs or pavement, centre dashes | 24-world |
| Street furniture | 06-props.js:529 benchSeatBuild, 345 binBuild, 513 dumpsterBuild, 528 bollardBuild, 503 shelterBuild, 515 parkingSignBuild | 14-city.js:322 bench, 328 bin, 329 hydrant, 330 bollard, 331 planter, 334 shelter (all nested); 22-dehum-street-rooms.js:86-92 (inline) | Bench, bin, bollard, shelter, hydrant | 20-props |
| Flag in the wind | 06-props.js:514 flagBuild; 06-yard.js:188 (vertex wave in tickYard) | none | Cloth that waves with the weather's wind | 26-weather |
| Car mesh | 06-yard.js:5 carMesh; 06-props.js:601 carBuild | 14-city.js:265 carBody; 14-city.js:344 parked (nested) | Bevelled body, glass, wheels, lamps, plates | 27-vehicles |
| Van mesh | 08-trucks.js:17 buildVanMesh | 14-city.js:223 ownVanBody; 22-dehum-street-rooms.js:41 vanBody | Cab plus cargo box, livery | 27-vehicles |
| Truck and trailer mesh | 08-trucks.js:38 buildTruckMesh, 13 truckWheel | none (B's delivery vehicle is vanBody) | Tractor, trailer, wheels | 27-vehicles |
| Bevelled box into a group | 06-yard.js:7 rbx; 06-props2-factory.js:109, 174, 203 rbx; 10-vehicles.js:42 rb | 14-city.js:225 and 267 add, 324 bx; 22-dehum-street-rooms.js:43 vm; 21-police-lobby.js:33 part; 31-models-machines.js:338 add | The same one-line closure written 11 times: new Mesh(bevelGeo), position, castShadow, add to parent | 10-three |
| Wheel or tyre | 08-trucks.js:13 truckWheel; 10-vehicles.js:43 tyre (nested); 06-yard.js:11 (inline) | inside 14-city.js:265 carBody | Tyre cylinder, rim and hub | 27-vehicles |
| Traffic | 06-yard.js:147 (spawn), 187 (loop in tickYard) | 14-city.js:462-464 (spawn); 15-car.js:132 laneCount, 133 updateCity | Cars in lanes that wrap at the edge. B also keeps a gap and stops for the player | 27-vehicles |
| Drivable vehicle | 10-vehicles.js:127 startDrive, 134 stopDrive, 152 forkGearCycle, 153 updateFork | 15-car.js:43 enterCar, 52 exitCar, 63 updateDrive, 9 ignition, 17 parkBrake, 62 engineSound | Get in and out, throttle and steer, camera | 27-vehicles |
| Vehicle collision | 10-vehicles.js:144 forkCollides | 14-city.js:466 carBlocked | Vehicle footprint tested against the AABB solids | 27-vehicles |
| Vehicle record and parts | none | 14-city.js:7 vehState, 16 selectVehicle, 445 spawnVehicle (nested), 249 and 280 hinge (nested); 15-car.js:6 carPartSet, 30 updateCarParts, 19 carLamps | Saved vehicle state, several vehicles, hinged doors, boot and bonnet, headlamps | 27-vehicles |
| Vehicle proximity | (dist2 lives in 01-head) | 16-town-van.js:3 carNear; 35-dlcx-farm.js:21 farmVehicleNear (duplicate) | Is the vehicle within r of a point | 27-vehicles |
| Dashboard canvas | none | 15-car.js:94 dashShow, 96 drawDash, 95 dashRound (copy of 06-three.js:191 roundRect) | Canvas HUD while driving | 41-shell |
| Sky | 06-yard.js:39-42 (gradient shader dome), 23 cloudTex, 24 discTex, 170-173 (sun, moon, cloud sprites), 189-192 (follow camera) | none found in scanned files (35-daynight-input.js:9 sets scene.background, outside scan) | Sky dome, sun and moon discs, drifting clouds | 26-weather |
| Weather state | 14-life.js:7 pickWeather, 19 tickWeatherState | 17-upstairs-expansion.js:258 (inline in updateExpansion at 254) | Pick by season with weights, hold until a set time, then pick again | 26-weather |
| Rain and snow particles | 06-yard.js:177 mkPoints (nested), 175-176 streak and flake textures, 197-198 (fall) | 17-upstairs-expansion.js:251 (Points build), 263 (fall) | Points cloud around the camera, falling and wrapping | 26-weather |
| Weather on ground, fog and sky | 06-yard.js:199-202 (puddles, snow tint on materials, overcast clouds); 14-events.js:65-70 (overcast dims the sun and greys the sky) | 17-upstairs-expansion.js:259-262 (fog near and far lerp, snow mix) | What the weather does to the scene | 26-weather |
| Thunder and rain sound | 14-life.js:26-27 (weatherFlash), 32 ambience | none | Lightning flash and looping filtered-noise rain | 26-weather |
| Season and weekday | 14-life.js:4 season (returns an index), 5 isSunday | 17-upstairs-expansion.js:85 season (returns a name), 86 weekend | Same formula in both: ((day - 1) / 7) % 4 | 26-weather |
| Game clock | 14-events.js:3 tickTime; 08-trucks.js:11 nowAbs | 32-interaction.js:154 gameHour; 01-config.js:131 nightNow | Hour of day, faster at night, absolute hours | 26-weather |
| Lighting by hour | 14-events.js:61 lighting | 35-daynight-input.js:4 updateDayNight (outside scan) | Sun angle, colour and intensity; sky, fog and hemisphere light; lamps at night | 26-weather |
| Shadow refresh throttle | 14-events.js:85 shadowTick | 36-boot.js:115 updateShadowTimer (outside scan) | Redraw the shadow map only when needed | 10-three |
| Time text | 09-orders.js:8 dueText; 11-timeclock.js:92 myHours | 32-interaction.js:155 clockText; 35-dlc-kit.js:26 minsLeft; 23-board.desk.js:21 shortAgo, 100 deskAge (copy at 23-board.shop.js:27) | HH:MM, "in N days", "5m ago", minutes or seconds left | 43-format |
| Unit text | none | 13-basement.js:15 kg | Rounded weight with its unit | 43-format |
| Wall clock | 06-props.js:335 clockBuild; 06-dressing.js:5 tickClocks | 22-dehum-street-rooms.js:141-145 (build, inline), 177 (tick) | Clock face whose hands follow the time | 20-props |
| Nav grid and A* | 11-staff.js:190 navBuild, 200 navOpen, 208 navCell, 209 navNearestOpen, 210 navLine, 211 route | 10-staff-paths.js:7 navKey, 9 navBuild, 26 navFree, 27 navFreeAt, 28 navNearest, 29 navLos, 30 navPath, 56 routeTo | Grid from the AABB solids, A* with no corner cutting, then string pulling. B's version is the better one: binary heap, typed arrays, a partial path when blocked, and a key that rebuilds the grid | 25-nav |
| Follow a path | 11-staff.js:310 staffWalk; 12-machines2-automation.js:48 agvWalk | 11-customers-line.js:47 walkAlong | Step to waypoints at a speed, ease the yaw | 25-nav |
| Yaw wrap and turn | 11-staff.js:315 (inline), 431 forkTurnTo | 11-customers-line.js:45 yawWrap, 46 easeYaw; 21-police-lobby.js:398 turnTo | Turn the short way round | 25-nav |
| NPC opens doors on a path | none | 10-staff-paths.js:59 doorAt, 67 npcDoors | Nearest shut door ahead; open it, or report it locked | 25-nav |
| Pedestrians | none (guards only, 06-yard.js:186) | 22-dehum-street-rooms.js:98 spawnPed, 107 cityLanes, 108 spawnCityPed, 116 updateCityPeds, 128 updatePeds | Walkers on pavement lanes who pause, despawn and respawn | 25-nav |
| Ambient birds | 06-dressing.js:107 buildPigeons, 117 tickPigeons | none | Birds on perches that fly off when you come near | 24-world |
| floorY and ramps | 06-building.js:303 floorY; 12-machines5-upper.js:15 stairY, 18 upperFloorY; 12-machines6-sorter.js:167 walkoverY; 06-props.js:92 propGroundY | 17-upstairs-expansion.js:5 stair2Y (26-radio-dust-tv.js:176 groundY, outside scan) | Floor height at x, z: decks, stairs, ramps | 24-world |
| Rect and AABB tests | 12-machines5-upper.js:14 inRect; 06-props3-halls.js:25 inRectH; 06-building.js:310 insideHall | 14-city.js:184 cityClear, 298 sceneFree; 25-shop-controls.js:315 roomOf, 316 roomLit | Point in rectangle, rectangle overlap, which room a point is in | 24-world |
| Cutting openings out of a span | 06-building.js:117 segs (nested), 210 (inline in lineWall); 06-props3-halls.js:44 hallSegs | 07-building.js:11 and 24 (gap sort inside wallZ and wallX), 83 skinX | Take the openings out of a 1D span. Written 3 times in A alone | 24-world |
| Wall with openings and skirting | 06-building.js:209 lineWall; 06-props3-halls.js:53 hallFace, 46 hallColumn, 45 hallDado | 07-building.js:9 wallZ, 23 wallX, 37 trimZ, 38 trimX | Wall pieces round doors and windows, with skirting and cove | 24-world |
| Room floor plane | 06-building.js:236 roomFloor | 07-building.js:77 floorPlane | Clone the material, repeat the texture per metre. Nearly identical in both | 10-three |
| Ceiling lights | 06-building.js:96 troffer, 89 highBay | 07-building.js:59 roomLamp, 67 pendant, 58 ceilingVent, 57 wallOutlet | Recessed troffer with a lens (B adds a PointLight), pendant lamp | 20-props |
| Floor markings | 06-building.js:56-58 lineX, lineZ, square (nested); 06-dressing.js:38 paintBay | 14-city.js:393 (inline bay lines) | Painted lines and bays with a label | 24-world |
| Signs and pictures | 06-props2-factory.js:399 wallSignBuild, 400 floorSignBuild, 429 exitSignBuild; 06-props.js:337 posterBuild, 603 aisleSignBuild; 06-props4-furniture.js:92 pictureTex, 99 pictureBuild | 07-building.js:45 signPlane, 50 framedPoster; 13-basement.js:25 sign (nested), 127 setTobSign | Text plane on a wall or floor, framed print, sign that redraws from a cache | 20-props |
| Building facades | none (neighbours inline at 06-yard.js:127) | 14-city.js:110 facadeTex, 134 shopfrontTex, 146 facadeMat, 152 styleOf, 153 facadeBox, 158 cityWinMat, 162 cityDetail, 177 cityBldg | Five facade styles, windows lit at night, UVs repeated per storey and bay | 24-world |
| City plot placement | none | 14-city.js:184 cityClear, 202 cityFill, 203 citySpot | Is a plot free; find the nearest free one | 24-world |
| Awning and shopfront | none | 07-building.js:196 awning (nested); 14-city.js:218 cityDoor | Striped awning, glass door, fascia sign, hit box | 20-props |
| Belts as a mechanism | 12-machines.js:19 defBelt, 21 beltLen, 22 beltPoint, 26 beltItems, 27 beltGapOf, 28 beltStartFree, 29 beltPush, 95 tickBelts, 114 drawBeltItems; 12-machines6-sorter.js:60 beltInsert, 61 beltD; 06-props.js:161 beltSnap | 13-basement.js:143 (inline belt items in updateTobacco) | Polyline belt with items at distance d, gaps between them, sinks and feeders, snapping | 20-props |
| Conveyor mesh | 06-props2-factory.js:69 conveyorBuild, 87 conveyorPath, 386 arcPath, 396 beltPieceBuild | 13-basement.js:74 (inline) | Frame, legs, rollers, a scrolling belt top | 20-props |
| Spiral geometry | 12-machines6-sorter.js:30 spiralPts, 31 spiralDress | none | Helix points and a spiral chute | 10-three |
| Handrail run with gaps | 12-machines5-upper.js:105 railRun | none | Posts and rails along an axis, skipping gaps | 20-props |
| Status lamps | 06-props2-factory.js:64 lampStack; 12-machines.js:121 lampSet | 13-basement.js:26 beacon (nested) | Green, amber and red tower lamp, set by machine status | 20-props |
| Machine dressing | 06-props2-factory.js:169 eStop, 170 cabinet | 13-basement.js:93 gauge, 94 feet, 95 panel (all nested) | E-stop, control cabinet, gauge, feet | 20-props |
| Cable or rope | 14-life.js:116-119 (sagging CatmullRom tube inside tickCables at 108) | 29-prop-defs.js:286 ropeBuild (outside scan) | Sagging tube between two points, rebuilt only when an end moves | 10-three |
| Vending, fridge, coffee | 06-props.js:306 vendingBuild, 326 coolerBuild; 14-events.js:52 drinkCoffee | 31-models-machines.js:206 vendParts, 238 syncVending, 285 vendDispense, 132 fridgeParts, 137 coffParts, 189 coffBrew | Machine mesh and its use | 20-props |
| Small product meshes | 06-props.js:349 palletModel, 455 flaskBuild | 31-models-machines.js:89 cartonBox, 142 cupMesh, 218 drinkMesh, 229 snackMesh, 4 prodMat; 08-tent-plants-shelves.js:287 crateMesh | Carton with a printed face, cup, can, wrapped bar, pallet | 20-props |
| Furniture | 06-props.js:256 chairBuild, 280 cotBuild; 06-props4-furniture.js:26 tvBuild, 54 fanStandBuild, 66 rugBuild, 72 bookshelfBuild, 105 seatBuild, 116 paddedChairBuild, 123 roundTableBuild | 29-prop-defs.js:23 officeChairBuild, 111 bookshelfBuild, 121 sofaBuild, 128 coffeeTableBuild (outside scan) | Room furniture prop builders | 20-props |
| Material cache | none | 31-models-machines.js:4 prodMat; 13-basement.js:122 glassM2 | Build a material once per key | 10-three |
| Picture-in-picture render | none | 07-building.js:312 pipRender, 296 buildSecCams | Render to a target without redrawing the shadow map | 10-three |
| Speech bubble | 11-staff.js:170 say (rig part), 252 staffSay | 10-staff-paths.js:132 workerSay; 12-logistics-bat.js:50 courierSay; 11-customers-line.js:135 lineSay; 17-upstairs-expansion.js:32 vipSay; 20-robberies.js:32 robberSay; 21-police-lobby.js:297 loungerSay | The same textTex bubble swap with a timeout, written six times in B | 22-people |
| Screen fade | 14-events.js:49-50 (inline in sleepNow) | 13-basement.js:17 tobFade; 27-sit-smoke-sleep.js:78 fadeEl; 20-robberies.js:129 hurtFlash | Full-screen overlay that fades to black or red | 41-shell |
| Zone teleport | none | 13-basement.js:18 goBasement, 19 leaveBasement; 17-upstairs-expansion.js:92 enterZone, 93 leaveZone | Fade, move the player and set the floor, fade back | 41-shell |
| Card or popup | 14-events.js:139 showLevelCard, 147 hideLevelCard, 148 tickLevelCard | 32-interaction.js:345 ctxOpen, 352 ctxClose | Titled card with lines and actions, timed or closed by a key | 41-shell |
| Hold-to-do task bar | none | 34-processing-panes.js:11 taskEl, 12 taskStart, 24 taskTick, 33 taskPress, 39 taskFinish, 49 taskCancel, 51 taskChain | Timing minigame overlay that can be chained | 41-shell |
| HTML widgets | none | 34-processing-panes.js:69 chip, 442 slider, 443 check, 444 select; 35-dlc-kit.js:27 barHtml | Settings form controls, chip, progress bar | 41-shell |
| Canvas text and list helpers | 13-pc.js:40 pcRows | 23-board.desk.js:101 deskTrim, 137 deskWrap, 102 deskDot, 103 deskTile, 116 deskZone, 122 deskBtn (copied at 23-board.shop.js:28, 74, 29, 30, 54, 60) | Trim with an ellipsis, word wrap, scrolling rows, tiles, tap zones | 43-format (text), 41-shell (widgets) |
| LCD readout | none | 35-dlc-kit.js:50 readout | Small lit canvas plane that redraws only when its lines change | 41-shell |
| Pointer lock retry | none | 34-processing-panes.js:53 lockPointer, 54 lockRetry | Works round Chromium refusing a re-lock after Esc | 41-shell |
| Screenshot, save export and import | 13-ui.js:237 screenshot (outside scan) | 34-processing-panes.js:276 screenshot, 287 saveExport, 292 saveImportRead, 308 saveImportApply | PNG download; save as JSON and load it back | 41-shell |
| Photo mode | 12-photo.js (outside scan) | 35-dlcy-photo.js:7 photoOn, 13 photoOff, 17 updatePhoto | Free-flying camera with the HUD hidden | 41-shell |
| Menu attract camera | none | 35-dlcy-menudrive.js:8 menuDriveWanted, 12 menuDriveCurve, 17 updateMenuDrive | Camera rides a CatmullRom loop behind the menu | 41-shell |
| Plugin and hook registry | none | 35-dlc-kit.js:9 dlcDefine, 10 dlcState, 17 dlcEach, 18 dlcStep, 19 dlcNewDay; 35-dlcy-upgrades.js:8 dlcUpgDefine, 20 upgProp; 05-actions.js:188 runHooks | Register modules, give each its own state, call its tick and new-day hooks inside a try | 41-shell |
| Map overlay | 13-scanner-map.js (outside scan) | 15-car.js:146 toggleCityMap, 150 drawCityMap | Top-down canvas map | 41-shell |
| Guided intro | 14-events.js:167 introStep, 177 introIndex, 178 introText | 19-doors-fixtures-intro.js (outside scan) | Tutorial steps ticked off by key | 41-shell |
| Data merge | none | 01-config.js:54 wsMerge | Merge a list by id: replace if the id exists, else append | 43-format |
| Colour lerp | none | 35-dlcx-breeding.js:5 breedMix (duplicates 30-edit-player-hands.js:167 mixHex) | Blend two hex colours | 43-format |
| Gate and door setters | 06-yard.js:185 (gates in tickYard) | 12-logistics-bat.js:18 rollerSet, 19 garageSet, 20 barrierSet, 21 gateSet, 24-27 (animation in updateTruck) | Four near-identical setters: flag, sound, obstacle toggle, lerped motion | 24-world (with the doors part) |
| Facing target and line of sight | none | 12-logistics-bat.js:75 facingTargets; 20-robberies.js:103 sightLine | Pick what the player faces inside a cone; check line of sight | 24-world |
| Synth tone and noise | 14-life.js:68 rTone, 69 rNoise | 26-radio-dust-tv.js:25 tone, 26 noiseHit (outside scan) | Oscillator and noise bursts for the radio | 30-sound |

**Things both games have under different names:** yard fence (fenceRun in both); tree (tree, treeBuild / plantTree, broadleafGeo); car (carMesh / carBody); van (buildVanMesh / ownVanBody, vanBody); traffic (tickYard / updateCity); drivable vehicle (forklift startDrive, updateFork / car enterCar, updateDrive); vehicle collision (forkCollides / carBlocked); street lamp (lampPostBuild / lamp); road (buildYard / cityRoad, buildStreet); bench, bin, bollard, shelter (prop builders / nested in buildScenery); weather (pickWeather / inline in updateExpansion); rain and snow (mkPoints / the wx Points); season (index / name); Sunday and weekend (isSunday / weekend); day and night lighting (lighting / updateDayNight); shadow throttle (shadowTick / updateShadowTimer); clock text (fmtTime, dueText / clockText, gameHour); wall clock (clockBuild, tickClocks / inline); navigation grid (route / navPath); path follow (staffWalk, agvWalk / walkAlong); yaw wrap (forkTurnTo / yawWrap, easeYaw, turnTo); floorY (floorY, stairY, upperFloorY / stair2Y, groundY); walls with openings (lineWall, hallSegs, segs / wallZ, wallX); room floor (roomFloor / floorPlane); ceiling lamp (troffer / roomLamp); signs and posters (wallSignBuild, pictureBuild / signPlane, framedPoster); conveyor belts (the full mechanism / inline in updateTobacco); status lamps (lampStack / beacon); cable or rope (tickCables / ropeBuild); vending machine and fridge (vendingBuild, coolerBuild / vendParts, fridgeParts); coffee (drinkCoffee / coffBrew); bookshelf (bookshelfBuild in both); speech bubble (say / six copies of xxxSay); fade overlay (sleepNow / tobFade, fadeEl); level card versus context card (showLevelCard / ctxOpen); sleep (sleepNow / napBed); screenshot (13-ui / 34-processing-panes); photo mode (12-photo / 35-dlcy-photo); radio synth (rTone / tone); map (13-scanner-map / drawCityMap); guided intro (introStep / 19-doors-fixtures-intro).

## 2. Game-content files: what each one is (and what stays in the game)

**Depot Co**

| file | what it is |
|---|---|
| 02-config.js | Catalogue, clients, level ladder, six building stages, layout numbers, economy. All game. |
| 06-building.js | The hall: floor, walls, dock doors, racks, office, bench, break corner, shed lining. Engine candidates: lineWall, roomFloor, troffer, highBay, floorY. |
| 06-dressing.js | Fixed hall dressing: KPI board, painted bays, snack machine, pigeons. Engine candidates: paintBay, the pigeons, tickClocks. |
| 06-props.js (content part, 256-603) | Prop builders: chairs, cot, vending, cooler, notice board, clock, posters, bins, baler, wrapper, desk, timeclock, tree, lamp post, car, signs. |
| 06-props2-factory.js | The production wing and machine props: conveyors, pack line, moulder, hopper, palletiser, silo, QC, signs. |
| 06-props3-halls.js | The annex halls and their rack rows. Engine candidates: hallSegs, hallFace, inRectH. |
| 06-props4-furniture.js | Room furniture: TV, dartboard, microwave, fan, rugs, bookshelf, printer, pictures, seats, round table. |
| 06-yard.js | The yard: ground, lanes, dock shelters, fence and gates, car park, neighbours, road and traffic, sky, weather visuals. |
| 07-items.js | Boxes, pallets, parcels: instanced meshes, rack slots, floor, the hand. Game, except mkInst and setInst. |
| 08-trucks.js | Truck schedule, van and truck meshes, docking, unloading, loading, departure. |
| 09-orders.js | Clients, order generation, the packing bench, parcels, contracts, shipping. All game. |
| 09-returns.js | Returns flow, inspection desks, restock. All game. |
| 10-vehicles.js | Pallet jack, picking cart, forklift: meshes, tools, driving the forklift. |
| 11-staff.js (non-rig part, 185-558) | The aisle router (nav and A*), hiring, the three staff role AIs, forklift autodrive. |
| 11-timeclock.js | Time clock, shifts, wages, lateness, timesheet. All game. |
| 12-machines.js | Machine registry, the belt mechanism, pack line, moulder, hopper, palletiser, baler, wrapper status. |
| 12-machines2-automation.js | Shipping belt to the dock loader, the AGV. |
| 12-machines3-gantry.js | Gantry pickers over the rack rows. All game. |
| 12-machines5-upper.js | Mezzanine: lift, deck, upper rack, rails. Engine candidates: railRun, stairY, inRect. |
| 12-machines6-sorter.js | Sortation deck: spirals, scanner, cells, staging bays. Engine candidate: spiralPts. |
| 12-machines7-returns.js | The returns hall: dock, belt, desks, cage, compactor. All game. |
| 13-pc.js | Office PC apps drawn on a monitor. Engine candidate: pcRows as a list widget. |
| 14-events.js | Clock tick, day roll, lighting by hour, sleep, coffee, power cuts, inspector, prowler, levels, intro. |
| 14-life.js | Seasons and weather, rain ambience and thunder, radio, forklift battery and cables, wrapper. |

**Grow Co**

| file | what it is |
|---|---|
| 01-config.js | Strains, lights, tents, supplies, upgrades, licences, the Workshop fold-in. Game, except wsMerge. |
| 04-sim.js | The sim: growth, drying, curing, events, customers, ID cards. All game. |
| 05-actions.js | Player actions (buy, plant, harvest, pack, sell). Engine candidate: runHooks. |
| 07-building.js | Rooms, walls, doorways, lobby, exterior, annex and yard, security cams, fixtures. Engine candidates: wallZ and wallX, floorPlane, roomLamp, pendant, signPlane, framedPoster, pipRender. |
| 08-tent-plants-shelves.js | Tent, plant meshes, drying line, goods shelf, storage racking. Game, except crateMesh. |
| 10-staff-paths.js | Waypoints, nav grid and A*, NPC doors, the crew, the guard, restock jobs. |
| 11-customers-line.js | The window customer, the queue, the rope gate. Engine candidates: walkAlong, yawWrap, easeYaw. |
| 12-logistics-bat.js | Van deliveries, bank courier, the bat. Engine candidates: the gate and door setters, facingTargets. |
| 13-basement.js | The tobacco works in the basement. Game; its belt is the only one in B. |
| 14-city.js | The city: flora, facades, roads, plots, scenery, car and van bodies, spawning vehicles, traffic. Mostly engine. |
| 15-car.js | Car controls, parts, lamps, engine sound, dashboard, traffic update, city map. Mostly engine. |
| 16-town-van.js | Trading in town, the shop van. Game. |
| 17-upstairs-expansion.js | Upstairs VIP, interiors, lab, roof, heat, police, weather and blackouts. Engine candidates: the weather block, season, weekend, stair2Y, enterZone and leaveZone. |
| 18-deliveries.js | Delivery rounds, the tablet, place menus. Game. |
| 20-robberies.js | Robberies and weapons. Game, except hurtFlash and sightLine. |
| 21-police-lobby.js | Police response, fights, lobby visitors. Game, except turnTo and unitRoll. |
| 22-dehum-street-rooms.js | Dehumidifiers, the street, pedestrians, room dressing, wall clock, the van body. |
| 23-board.desk.js | Office wall screen for the desk build. Its canvas helpers are copied in 23-board.shop. |
| 23-board.shop.js | Office wall screen for the standalone build. Duplicate helper set. |
| 25-shop-controls.js | Curtains, shop controls, staff door, control cabinet, room lights. Engine candidates: roomOf, lightSwitch. |
| 27-sit-smoke-sleep.js | Sitting, eating, smoking, the bed. Engine candidate: fadeEl. |
| 31-models-machines.js | Product models, vending, fridge and coffee machines, held items, the sale. Engine candidates: the product meshes and prodMat. |
| 32-interaction.js | Prompts, what E does, the context card, the game hour. Engine candidates: ctxOpen, gameHour, clockText. |
| 34-processing-panes.js | Task minigame, all HTML panes, settings, saves, screenshot, dev tools, HUD. Engine candidates: task bar, widgets, lockPointer, save export, screenshot. |
| 35-dlc-kit.js | The DLC framework plus shared helpers (minsLeft, barHtml, readout, plantFigure). Framework is engine. |
| 35-dlcx-breeding.js, 35-dlcx-cup.js, 35-dlcx-farm.js, 35-dlcx-finance.js, 35-dlcx-hydro.js, 35-dlcx-merch.js | DLC: breeding lab, Cannabis Cup, the out-of-town farm, bank and insurance, hydroponics bay, merch stand. Game. |
| 35-dlcy-cigars.js, 35-dlcy-lab.js, 35-dlcy-roof.js | DLC extensions: cigars, extraction lab grades, roof barrels and hives. Game. |
| 35-dlcy-menudrive.js | Attract camera behind the main menu. Engine. |
| 35-dlcy-photo.js | Photo mode. Engine. |
| 35-dlcy-upgrades.js | Per-DLC upgrades framework. Engine-leaning. |

## 3. Summary

24 file parts in A and 37 files in B were scanned, giving 80 engine-worthy helper rows. 50 of them exist in both games, 6 only in A, and 24 only in B; the 37 pairings above that go by different names come out of those 50.

The first big win is the navigation grid. It is two full A* plus string-pulling implementations: A 11-staff.js:190-236 and B 10-staff-paths.js:7-56. B's version, with a heap, typed arrays and partial paths, is the one to keep. walkAlong, staffWalk, agvWalk and the three yaw-wrap helpers fold in with it.

The second is world weather and time. The two games carry duplicate weather state machines (A 14-life.js:7-29, B 17-upstairs-expansion.js:255-263), duplicate rain and snow Points and fog, the same season formula, and two hour-driven lighting passes. A also has the only sky dome (06-yard.js:39-42).

The third is vehicles and the street kit. That covers car, van and truck mesh builders (A 06-yard.js:5, 08-trucks.js:17 and 38; B 14-city.js:223 and 265, 22-dehum-street-rooms.js:41), lane traffic, vehicle collision, fence runs, roads, lamps and street furniture. Inside them is the bevelled-box closure written 11 times.

Smaller but cheap to lift: walls with openings plus the room floor plane, which are near identical in the two games; B's six copies of the speech bubble; B's board text helpers, copied once per build in 23-board.desk.js and 23-board.shop.js.
