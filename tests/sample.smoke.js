// The engine's own smoke: the sample room (tests/sample) on the pure layer. Run by tests/smoke.js. No backslash-quote in the body.
'use strict';
module.exports = `
  ok(!!T.renderer && !!T.scene && !!T.camera && T.CO.ready === true, 'CO.setup made the renderer, the scene and the camera');
  await wait(400);
  ok(T.frames() > 3, 'the frame loop runs: ' + T.frames() + ' frames');
  ok(T.calls() > 0, 'the post pass drew the scene: ' + T.calls() + ' draw calls');
  ok(T.post.on === true && !!T.post.rt, 'the post pass is on with a render target');
  ok(T.lightBudget.n === 6, 'the light budget took the setup value');
  // the palette and the sheets
  ok(Object.keys(T.MAT).length >= 50 && Object.keys(T.TEX).length >= 20 && Object.keys(T.NRM).length >= 10, 'the base palette stands: ' + Object.keys(T.MAT).length + ' materials, ' + Object.keys(T.TEX).length + ' textures, ' + Object.keys(T.NRM).length + ' normal maps');
  ok(T.MAT.hit.userData.noBake === true && T.MAT.screen.userData.noBake === true && T.MAT.exit.userData.noBake === true, 'the hit, screen and exit materials are flagged out of the bake');
  ok(T.MAT.wall.envMapIntensity > 0 && T.MAT.wall.envMapIntensity <= 0.45, 'materials take little from the environment map: ' + T.MAT.wall.envMapIntensity);
  // the bake
  ok(T.baked.draws >= 2 && T.baked.hidden >= 44, 'the bake merged the crates and the walls: ' + T.baked.draws + ' draws from ' + T.baked.hidden + ' meshes');
  ok(T.lever.visible === true && !T.lever.userData.bakedAway, 'an interactive hit box stays out of the bake');
  ok(T.spinner.children[0].visible === true && !T.spinner.children[0].userData.bakedAway, 'a dynamic group stays out of the bake');
  T.unbakeStatic(); ok(T.baked.draws === 0 && T.crates.every((c) => c.visible && !c.userData.bakedAway), 'unbake shows every original again');
  T.rebake(); ok(T.baked.draws >= 2 && T.crates.every((c) => !c.visible), 'rebake merges them again');
  // geometry
  ok(T.bevelGeo(1, 1, 1) === T.bevelGeo(1, 1, 1) && T.bevelGeo(1, 1, 1) !== T.boxGeo(1, 1, 1), 'a bevelled box is cached and differs from the sharp one');
  ok(T.bevelGeo(0.02, 1, 1) === T.boxGeo(0.02, 1, 1) && T.bevelGeo(1, 1, 5) === T.boxGeo(1, 1, 5), 'a sheet thinner than 30 mm and a run longer than 4 m stay sharp');
  ok(T.roundCylGeo(0.3, 0.3, 1).attributes.position.count > 100 && T.roundCylGeo(0.3, 0.3, 1) === T.roundCylGeo(0.3, 0.3, 1), 'a turned part gets eased rims and enough sides, and is cached');
  ok(T.roundCylGeo(0.01, 0.01, 1).attributes.position.count === new THREE.CylinderGeometry(0.01, 0.01, 1, 18).attributes.position.count && T.roundCylGeo(0.01, 0.01, 1).attributes.position.count < T.roundCylGeo(0.3, 0.3, 1).attributes.position.count, 'a wire is left alone: a plain cylinder, fewer vertices than an eased one');
  { T.BEVEL.on = false; const g = T.bevelGeo(0.7, 0.7, 0.7); T.BEVEL.on = true; ok(g === T.boxGeo(0.7, 0.7, 0.7), 'BEVEL.on off makes every box sharp'); }
  { const tg = T.taperGeo(new THREE.BoxGeometry(1, 1, 1, 1, 3, 1), 1, 0.5, 0.5); ok(tg.attributes.position.count > 0, 'taperGeo returns a geometry'); }
  // signs and text
  { const t = T.textTex(['HI'], { bg: '#1b232c' }); ok(t.image.width === 512 && t.image.height === 128, 'textTex draws a 512 by 128 plate by default'); }
  ok(T.scene.children.some((m) => m.isMesh && m.children.length === 5), 'the sign on the wall carries its plate and four studs');
  // placers and the root
  { const g2 = new THREE.Group(); T.CO.root = g2; const b = T.box(1, 1, 1, T.MAT.wood, 0, 0, 0); T.CO.root = null; ok(b.parent === g2, 'CO.root redirects the default parent'); }
  { const b2 = T.box(1, 1, 1, T.MAT.wood, 0, 0, 0); ok(b2.parent === T.scene, 'with no root the scene is the parent'); T.scene.remove(b2); }
  ok(T.solids.length === 4, 'four wall solids');
  ok(T.inter.length === 1 && T.inter[0] === T.lever && T.lever.userData.it.prompt() === 'Pull the lever', 'the hit box is on the interact list with its prompt');
  { const g3 = new THREE.Group(); T.box(1, 1, 1, T.MAT.wood, 0, 0, 0, g3); T.cyl(0.2, 1, T.MAT.chrome, 0, 0, 0, g3); T.disposeTree(g3); ok(T.boxGeo(1, 1, 1).attributes.position.count > 0 && T.MAT.wood.map.image, 'disposeTree leaves the cached geometry and the palette alone'); }
  { const gb = T.groundBlob(1, 1, 0, 0); ok(gb.material.userData.noBake === true && gb.userData.noBake === true, 'a ground blob never bakes'); T.scene.remove(gb); }
  // particles
  T.burst(0, 1, 0, 0xffffff, 10); ok(T.bursts.length === 1, 'a burst is live'); T.tickBursts(2); ok(T.bursts.length === 0, 'and gone after its life');
  // the pure helpers
  ok(T.propSeed('a', 1) === T.propSeed('a', 1) && T.propSeed('a', 1) !== T.propSeed('b', 1) && T.propSeed('a', 1) !== T.propSeed('a', 2) && T.propSeed('a', 1) >= 0 && T.propSeed('a', 1) < 1, 'propSeed is the same every time and differs by id and by throw');
  { const s1 = T.seededStream('tree-3'), s2 = T.seededStream('tree-3'); ok(s1() === s2() && s1() === s2(), 'a seeded stream replays'); }
  ok(T.mixHex(0x000000, 0xffffff, 0.5) === 0x808080 && T.hexCss(0x0a0b0c) === '#0a0b0c', 'colour helpers');
  ok(T.fmtTime(25.5) === '01:30' && T.money(-1234) === '-$1,234' && T.money(5) === '$5', 'time and money text');
  { const list = [{ id: 'a', v: 1 }, { id: 'b', v: 2 }]; T.mergeById(list, [{ id: 'b', v: 3 }, { id: 'c', v: 4 }]); ok(list.length === 3 && list[1].v === 3 && list[2].id === 'c', 'mergeById replaces by id and appends the rest'); }
  { let n = 0; T.hook('smoke', () => { n += 1; }); T.hook('smoke', () => { throw new Error('boom'); }); T.hook('smoke', () => { n += 10; }); const ce = console.error; let logged = 0; console.error = () => { logged++; }; T.runHooks('smoke'); console.error = ce; ok(n === 11 && logged === 1, 'hooks run in order, a throwing one is logged and does not stop the next'); }
  T.resize(); ok(T.camera.aspect > 0, 'resize keeps the camera sane');
  info('draws ' + T.calls() + ', baked ' + T.baked.draws + ' from ' + T.baked.hidden + ', frames ' + T.frames());
`;
