# Inventory 01: the three.js helper layer and the static bake (Depot Co = A, Grow Co = B)

Read-only pass on 2026-10-08. All five files read in full: A `05-three.js`, `05-post.js`, `14-bake.js`; B `06-three.js`, `06-three-bake.js`. Line numbers are each function's opening line. Some B counterparts live outside B's two three files and are given with their own file names (resize, updateLightBudget, burst/updateBursts, the shadow timer). A's unbakeStatic lives in `06-props.js:251`.

## 1. Identical

| name(s) | A file:line | B file:line | note |
|---|---|---|---|
| taperGeo | 05-three.js:315 | 06-three.js:299 | Same body character for character. Only the comment above it differs. |
| resize | 05-three.js:18 | 35-daynight-input.js:95 | Same body. In B it sits in the day/night part, not in 06-three.js. |

## 2. Same name, different body

| name(s) | A file:line | B file:line | note |
|---|---|---|---|
| canvas, renderer | 05-three.js:3-10 | 06-three.js:3-10 | Same options and same timer-driven shadow map. Canvas id is dc-canvas vs g3-canvas; exposure 0.82 vs 0.78. |
| scene | 05-three.js:11-13 | 06-three.js:13, fog at 367 | A sets background 0x8fb0d4 and fog 70..190. B sets no background and fog 0x9fb7d0 30..110. |
| camera | 05-three.js:14 | 06-three.js:31-33 | A is (SET.fov, near 0.08, far 260). B is (75, 0.2, 200) with rotation order YXZ and TOWN_LAYER enabled. |
| hemi, sun | 05-three.js:37, 39-41 | 06-three.js:358-361 | Same rig shape, game values. A: 4096 map, box ±70, far 230, normalBias and radius set. B: 2048 map, box ±34, far 60. |
| buildEnvStudio | 05-three.js:23 | 06-three.js:17 | Same studio. A: troffer gain 1.1, sigma 0.04, silent catch, studio never disposed. B: troffer gain 3.4, extra green pane, DoubleSide panes, sigma 0.035, console.warn, disposes the studio. |
| lightBudget | 05-three.js:60 | 06-three.js:12 | The cap field is named `n` in A and `point` in B. |
| updateLightBudget | 05-three.js:61 | 36-boot.js:100 | Same algorithm. A ticks on worldTime seconds (2 s, 0.1 s) and adds -3 hysteresis for lamps already on. B ticks on now() milliseconds (2000, 100) with no hysteresis. |
| grain | 05-three.js:81 | 06-three.js:58 | A: (n, alpha, dark), random grey or black, fixed alpha, float size 1..4. B: (n, alpha), black or white, alpha scaled by distance from 0.5, size randi(1,3). |
| textTex | 05-three.js:151 | 06-three.js:165 | The signatures differ: A is (lines, opt{w,h}) and B is (lines, w, h, opts). A: 1x canvas, square enamel plate via isPlate, one font size, repeat-wrapped through tex(). B: 2x supersampled, rounded plate via roundRect, bigger title line, measureText shrink per line, SIGN_FONT. |
| glowMat | 05-three.js:280 | 06-three.js:276 | A: base colour 0x111111, default k 1, tags userData.glow (A's bake reads it). B: base colour = hex, default 1.5, no tag. |
| BEVEL | 05-three.js:297 | 06-three.js:282 | max and faces are identical. B adds an `on` switch. |
| bevelGeo | 05-three.js:298 | 06-three.js:283 | Vertex math identical. A: cutoffs 30 mm / 4 m, cached in geoCache, falls back to cached boxGeo. B: honours BEVEL.on, cutoffs 24 mm / 3.2 m, no cache, fresh BoxGeometry. |
| roundCylGeo | 05-three.js:317 | 06-three.js:302 | Vertex math identical. A caches by key 'c...'. B honours BEVEL.on and does not cache. |
| box | 05-three.js:334 | 06-three.js:339 | A: (…, parent), sharp only when mat.map, default parent scene. B: (…, opts{sharp,r,cast,receive,parent,solid,tag,floorLevel}), uses bevelSkip, metre-tiled UVs from userData.tile, default parent world.group, pushes to world.obstacles. |
| cyl | 05-three.js:340 | 06-three.js:348 | The argument order differs. A is (r, h, mat, x, y, z, parent, seg, rb) with seg default 12. B is (rt, rb, h, mat, x, y, z, parent, seg) with seg default 18 and default parent world.group. |
| burst (and bursts) | 05-three.js:366-367 | 30-edit-player-hands.js:67-68 | A: n defaults to 20, velocity as {x,y,z}, faster spread, opacity 0.9, life counts up. B: n required, velocity as arrays, gentler speeds, smoke at opacity 0.55 and size 0.07, life counts down. |
| TEX | 05-three.js:85-133, 287-288 | 06-three.js:93-157 | Shared keys (concrete, brick, wood, grass, asphalt, fabric) hold different art. A's fabric is navy and its white weave is named `cloth`; B's white weave is named `fabric`. The entries are game content. |
| MAT | 05-three.js:215-279, 289 | 06-three.js:193-249 | Many shared keys (floor, wall, trim, chrome, gunmetal, steel, glass, screenGlass, plastic, black, white, tile, rubber) with different values. A's screen is a dark basic material; B's is green emissive. Both sign plates need MAT.gunmetal and MAT.chrome. |
| groundBlob (name collision) | 05-three.js:353 | 06-three.js:327 | Different contracts under one name. A's groundBlob is B's floorBlob (section 3). B's groundBlob auto-fits a group (section 4). Counted there, not here. |

## 3. Same purpose, different names

| name(s) | A file:line | B file:line | note |
|---|---|---|---|
| tex / makeTex | 05-three.js:77 | 06-three.js:41 | A: (w, h, draw, rx, ry), always repeat-wraps, anisotropy 8. B: (w, h, draw, [rx, ry]), sets repeat only when given, anisotropy 4. Same draw(ctx, w, h) contract. |
| heightNoise / noiseFill | 05-three.js:195 | 06-three.js:49 | Both fill a base colour, then speckle it. The argument order differs: A is (base, n, amp) and B is (base, amp, n). A uses grey at alpha 0.6; B uses signed white/black. |
| normalTex / makeBump | 05-three.js:182 | 06-three.js:54 | Different technique. A Sobel-filters a height canvas into a linear tangent-space normalMap. B returns a mid-grey canvas used as a bumpMap. |
| isPlate + sign / signBack | 05-three.js:150, 342 | 06-three.js:186 | A's sign builds the text plane and then the plate (+0.03, r 0.004, studs when w>=0.5 and h>=0.12). B's signBack only adds the plate (+0.024, r 0.005, noDefight, studs when w>0.5 and h>0.2) to a mesh the caller already made. B's sign builders are local to callers, e.g. 13-basement.js:25. |
| std / colorMat | 05-three.js:214 (rewrapped 285) | 06-three.js:274 | A: raw MeshStandardMaterial(o), rewrapped to apply dimEnv. B: colour-first shortcut (hex, rough 0.7, metal 0, extra). |
| groundBlob / floorBlob | 05-three.js:353 | 06-three.js:323 | Both lay a contact-shadow plane. A: (w, d, x, z, parent, y), plane w×d, tagged noBake, parent scene. B: (w, d, x, y, z, parent, k), plane grown 1.55x + 0.16, polygonOffset, optional opacity via a cloned material, tags noDefight/soft/blob, raycast off. |
| blobTex, blobMat / BLOB_TEX, BLOB_MAT | 05-three.js:351-352 | 06-three.js:320-321 | A: radial gradient at full opacity. B: blurred rounded rect at opacity 0.62. |
| addInter, inter / interactable, world.interact | 05-three.js:355-356 | 06-three.js:354, 37 | A tags userData.it into `inter`. B tags userData.interact into world.interact. |
| solid, solids, dyn / box opts.solid into world.obstacles | 05-three.js:359-360 | 06-three.js:345 | A: a standalone world AABB with a y range. B: an xz box pushed from box(), carrying tag and floorLevel. |
| (inline in box: mat.map ? boxGeo : bevelGeo) / bevelSkip | 05-three.js:335 | 06-three.js:338 | Both decide when a box stays sharp. B's rule lists named MAT floor and wall entries plus userData.tile. |
| tickBursts / updateBursts | 05-three.js:375 | 30-edit-player-hands.js:84 | A: one gravity of 6, smoke rises, particles bounce. B: gravity per mode, particles stop at the floor. |
| worldTime / world.time | 05-three.js:16 | 06-three.js:37 | The clock for anything that sways or pulses. |
| shadowDirty, shadowT / shadowT, updateShadowTimer | 05-three.js:15 | 36-boot.js:113-114 | The timer-driven shadow redraw. A uses a dirty flag; B has a function with a driving override. |
| baked / BAKE | 14-bake.js:6 | 06-three-bake.js:12 | A: stats only. B: config (every 60 frames, 6 ms budget, layer 31), buckets, pending list, ?nobake and ?bakelog. |
| bakeable / bakeCandidate + bakeParentOk | 14-bake.js:7 | 06-three-bake.js:15, 30 | A rejects transparent, glow, noBake materials, MAT.hit/screen/exit, userData.it, inter members, userData.dynamic ancestors, anything under the camera. B rejects named meshes, meshes with children, skinned, vertexColors, morph targets, NaN transforms, and any userData key other than propId/fxId. B's parent chain must reach world.group with no dyn, interact or noBake. |
| bakeStatic / bakeTick + bakeFlush + bakeBuild | 14-bake.js:15 | 06-three-bake.js:76, 110, 62 | A: one shot over the whole scene into world space; originals hidden; frustumCulled false; re-run by unbake+bake pairs (06-props.js:102-103, 06-props3-halls.js:134, 12-machines6-sorter.js:253, 13-ui.js:180). B: incremental, merged mesh in each parent's space, originals moved to layer 31, moved meshes detected and returned, time-budgeted, waits on _df.t. |
| (inline merge in bakeStatic) / bakeMergeGeo | 14-bake.js:22-35 | 06-three-bake.js:42 | A: JS arrays, applyMatrix4(matrixWorld), zero normals when missing, drops uv if any member lacks it. B: preallocated Float32Array, parent space with a normal matrix, normals required, zero uv when missing, computes bounds. |
| (inline key in bakeStatic) / bakeKey | 14-bake.js:19 | 06-three-bake.js:34 | A: material uuid + cast + receive. B: parent id + material signature + shadow + layers + renderOrder + culling + fxId + soft, plus an 8×4×8 m chunk for loose meshes. |
| unbakeStatic / bakeReturn | 06-props.js:251 | 06-three-bake.js:71 | A undoes everything at once. B gives back one mesh and tags it noBake. |

## 4. In one game only but engine-worthy

| name(s) | A file:line | B file:line | note |
|---|---|---|---|
| blotches, cracks | 05-three.js:83-84 | none | Pure canvas painters. |
| roughTex | 05-three.js:210 | none | Linear roughness map from a canvas. B has no roughness maps. |
| dimEnv | 05-three.js:283 | none | Caps envMapIntensity per material kind. B sets none. |
| geoCache, boxGeo | 05-three.js:292-293 | none | Box geometry cache. B allocates a fresh BoxGeometry every time. |
| plane, sphere | 05-three.js:337, 341 | none | Placers. The only game coupling is the default parent (scene). |
| hitBox | 05-three.js:357 | none | Needs an invisible material (A MAT.hit, B MAT.none at 06-three.js:248) and the interact registry. |
| animated, animate | 05-three.js:363-364 | none | A per-frame update registry. |
| _v, _v2, _m4, _q, _s1, _e | 05-three.js:361 | none | Shared scratch math objects. |
| post, postResize, renderFrame | 05-post.js:3, 24, 25 | none | Post pass: grade, vignette, grain, chroma. Its only game coupling is SET.quality and weatherFlash; those should become a quality flag and a uniform hook. |
| makeAlphaTex | none | 06-three.js:45 | Clamp-wrapped cut-out texture. |
| tileDraw, brickDraw, woodDraw, plankDraw | none | 06-three.js:59, 63, 86, 67 | Parametric painters. plankDraw has its tones and seeds hard-coded; make them parameters. |
| emojiTex, roundRect, SIGN_FONT | none | 06-three.js:158, 191, 164 | Canvas utilities. |
| disposeTree, clearKids | none | 06-three.js:264, 272 | Frees GPU buffers while protecting shared assets. |
| disposeShared, disposeKeep | none | 06-three.js:254, 253 | Hard-codes Grow Co tables (PROD_M, faceCache, HUMAN_GEO, the leaf geometries). The engine needs a "register keep" call instead. |
| archLeafGeo, leafAt | none | 06-three.js:335, 337 | A generic arched strip and a placer. Neither touches state. |
| sprite | none | 06-three.js:351 | Sprite placer, default parent world.group. |
| groundBlob (auto-fit) | none | 06-three.js:327 | Measures a group's footprint near the floor and calls floorBlob. |
| bakeMatSig, bakeSnap, bakeMoved, bakeAttached | none | 06-three-bake.js:26, 39, 40, 109 | Pure helpers: material signature, transform snapshot, change test, attached-to-scene test. |
| bakeDescribe | none | 06-three-bake.js:41 | A debug label. Only light coupling (world.group, propId). |

## 5. Stays in the game

| name(s) | A file:line | B file:line | note |
|---|---|---|---|
| Texture content: cardboardTex, posterTex, POSTER_KINDS, poster, NRM, RGH, CARD, TEX entries | 05-three.js:134, 166, 180, 349, 196-209, 211, 281, 85-133 | 06-three.js:93-157 (incl. poster1-3, leaf, bud) | Brand art and SKUs. The engine supplies the painters; the game supplies the entries. |
| Material content: MAT entries, extra MATs | 05-three.js:215-279, 289 | 06-three.js:193-249, 273 | Game palette. |
| fabricMat | none | 06-three.js:275 | Clones MAT.fabric. |
| Light rig: hallLights, HIGH_BAYS, officeLight, breakLight, lobbyLight, yardLights | 05-three.js:42-55 | none | Depends on BOOT_STAGE and HALL. |
| Light rig: roomLight 1-3, tentLight, tentFill, fogCol, SNOW_FOG, RAIN_FOG | none | 06-three.js:357-366 | Depends on ROOM and the tent. |
| World state: ROOM, world, TOWN_LAYER, clock, _df, FROND_GEO, BIGLEAF_GEO | none | 06-three.js:36-37, 33-34, 11, 336 | Game state declared in the three file. |
| bakeSoft | none | 06-three-bake.js:23 | Exists for Grow Co's sightLine "soft" tag. Could become an optional classifier hook. |

## Summary

1. Function counts: A 05-three.js has 34 (33 declarations plus `std`), 05-post.js has 2, 14-bake.js has 2. B 06-three.js has 32 and 06-three-bake.js has 14. That is 38 in A and 46 in B, every one placed above.
2. By section (A / B): 1 Identical 2 / 1; 2 Same name 10 / 8 (B's updateLightBudget and burst live outside these files); 3 Same purpose 12 / 16; 4 One game only 11 / 19; 5 Stays in game 3 / 2.
3. "10-three.js" should hold:
   - **Setup:** a renderer and scene factory (canvas id, exposure, fog as parameters), resize, buildEnvStudio with its panes as parameters, and one updateLightBudget (A's hysteresis, one time unit, one cap field name).
   - **Textures:** one texture factory (accepting rx/ry or an array) plus makeAlphaTex. Both relief paths, normalTex and the bump map. Unified painters (grain with a mode, heightNoise/noiseFill in one argument order, blotches, cracks, tile, brick, wood and plank painters, roughTex, roundRect, emojiTex).
   - **Geometry and placers:** BEVEL with the `on` switch, bevelGeo and roundCylGeo with optional caching, boxGeo, taperGeo, archLeafGeo, and box/cyl/plane/sphere/sprite/leafAt behind a settable default parent.
   - **Signs and blobs:** textTex with both plate styles and signBack, plus floorBlob and auto-fit groundBlob.
   - **Lifecycle and registries:** disposeTree and clearKids over a registered keep-set, dimEnv, glowMat with its glow tag, burst and its tick, the animate registry, one interact registry, and A's post pass as an option.
4. "11-bake.js" should be B's incremental bake (parent-space buckets, material signatures, chunked culling, self-healing returns, time budget) with hooks for: the root group; extra exclusions (A needs userData.it, glow, transparent, MAT.hit/screen/exit and userData.dynamic); a defer-pass test (B's _df.t); a soft classifier; force-pass and off entry points to replace A's bakeStatic/unbakeStatic pairs. Watch B's "any userData key blocks" rule: it would silently stop baking A meshes that carry harmless tags. A also says `dynamic` where B says `dyn`.
5. Migration traps: the cyl argument order, box(parent) vs box(opts), textTex's signature, the swapped noiseFill/heightNoise arguments, the groundBlob name collision, the default parent (scene vs world.group), `lightBudget.n` vs `.point`, and noBake set on the material in A vs on the object in B. Each needs a shim or a renamed call site when its game moves over.
