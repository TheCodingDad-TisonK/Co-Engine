// Writes packs/growco/pack.js from the extractor's JSON: node grow-pack-gen.js <extract.json> <out pack.js> [skip ids comma list]
'use strict';
const fs = require('fs');
const X = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), OUT = process.argv[3], SKIP = new Set((process.argv[4] || '').split(',').filter(Boolean));
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const indent = (t) => t.split('\n').map((l) => '  ' + l).join('\n');
const STANDIN = ['world', 'xs', 'dlcOn', 'dlcProp', 'unitIds', 'unitBase', 'drive', 'sec', 'deskBoard', 'held', 'PROPS', 'PROP_ORDER', 'growDefProp', 'propExtra'];
const packVars = [...new Set(X.decls.filter((d) => /^\s*var\s/.test(d.text) && !d.names.some((n) => STANDIN.includes(n))).flatMap((d) => d.names).concat(['S']))].map((n) => n + ': ' + n).join(', ');
const lines = [];
lines.push("//@ Co Engine pack: Grow Co. Every prop the grow shop has (its counters, shelves, bins, vending and coffee machines, fridges, sofas, desks, screens, plants, racks, lockers and more), carried with the helpers, materials and textures they are drawn with, sealed in a scope of their own so nothing clashes with the game they land in. Shop logic stays behind: a prop that fills from the shop's stock stands empty, a machine you use says what it is. Generated from Grow Co's src/ by the Co Engine editor's pack tools; regenerate rather than edit.");
lines.push('  // the pack waits for the engine: a game part ahead of CO.setup runs it on the beforeBuild hook, the editor runs it at once');
lines.push('  var growcoPack = function (HOST_MAT, HOST_TEX) {');
lines.push("    // stand-ins for the shop systems the props reach for: harmless, empty, never saved");
lines.push("    var G_DEFS = {}, G_ORDER = [];");
lines.push("    var world = { group: CO.root || scene, interact: [], obstacles: [], lights: [], doors: [], fixtures: [], screens: [], reg: null, shelves: [], dyn: [] };");
lines.push("    var xs = function () { return { jobs: [], strains: [], stock: {}, flags: {}, owned: {}, upgrades: {}, dlc: {} }; };");
lines.push("    var dlcOn = function () { return true; }, dlcProp = function () { return true; }, unitIds = function () { return []; }, unitBase = function (id) { return id; };");
lines.push("    var drive = { on: false }, sec = { view: { on: false } }, deskBoard = { lastFetch: 0, data: null }, held = function () { return null; };");
lines.push("    var growDefProp = function (id, def) { G_DEFS[id] = def; G_ORDER.push(id); }, propExtra = function (id, fn) { var d = G_DEFS[id]; if (!d) return; var b = d.build; d.build = function (c, P) { b(c, P); try { fn(c, P); } catch (e) {} }; };");
lines.push("    var PROPS = G_DEFS, PROP_ORDER = G_ORDER;");
lines.push("    var G_FIX = [], fixtureFromBuild = function (id, label, yaw, fn) { G_FIX.push({ id: id, label: label, fn: fn }); }, fixtureAdd = function () {}, buildPos = function () {};");
lines.push("    // Grow's own carried code, in its part order");
for (const d of X.decls) { if (d.names.some((n) => ['world', 'xs', 'dlcOn', 'dlcProp', 'unitIds', 'unitBase', 'drive', 'sec', 'deskBoard', 'held', 'PROPS', 'PROP_ORDER', 'growDefProp', 'propExtra'].includes(n))) continue; lines.push('    /* ' + d.file + ' */'); lines.push(indent(indent(d.text.replace(/^  /, '')))); }
// a host material Grow lacks still resolves
lines.push("    // the shop state the props read at build time: a sandboxed fresh Grow save with every upgrade on, never the host game's save");
lines.push("    var S = fresh(); S.upgrades = S.upgrades || {}; ['lobby', 'generator', 'lights', 'vip', 'arcade', 'vault'].forEach(function (k) { S.upgrades[k] = true; }); S.dlc = { breeding: { owned: true }, hydrobay: { owned: true }, merch: { owned: true }, cup: { owned: true } };");
lines.push("    for (var hk in HOST_MAT) if (MAT[hk] === undefined) MAT[hk] = HOST_MAT[hk]; for (var tk in HOST_TEX) if (TEX[tk] === undefined) TEX[tk] = HOST_TEX[tk];");
lines.push("    // the defs and their add-ons, each in a guard: a def whose part reads shop state at load is left out rather than breaking the pack");
for (const d of X.defs) { if (SKIP.has(d.id)) continue; lines.push('    try { ' + d.text.replace(/\n/g, '\n      ') + '; } catch (e) { if (typeof console !== "undefined") console.warn("growco pack: " + ' + JSON.stringify(d.id) + ' + ": " + e.message); }'); }
for (const f of (X.fixtures || [])) { lines.push('    try { ' + f.text.replace(/\n/g, '\n      ') + '; } catch (e) {}'); }
for (const e of X.extras) { if (SKIP.has(e.id)) continue; lines.push('    try { ' + e.text.replace(/\n/g, '\n      ') + '; } catch (e) {}'); }
lines.push(`    // each Grow prop as an engine prop: Grow's own build context on the prop's group, its obstacles as solids, a use that says what it is
    var LABEL_OVERRIDE = {};
    G_ORDER.forEach(function (gid) {
      var d = G_DEFS[gid]; if (!d || typeof d.build !== 'function') return;
      var label = LABEL_OVERRIDE[gid] || d.label || gid;
      defProp('gc' + gid.charAt(0).toUpperCase() + gid.slice(1), { extra: true, shop: false, label: label, cat: 'grow co', desc: 'From Grow Co.: ' + label + '.', build: function (c, P, inst) {
        var g = growPropCtx(c.group, c.id, 0), gh = g.hit; g.light = function (l, x, y, z) { l.position.set(x, y, z); c.group.add(l); return l; };
        g.hit = function (w, h, dd, x, y, z, data) { var m = gh.apply(g, arguments); c.hit(w, h, dd, x, y, z, { prompt: function () { return 'The ' + label; }, use: function () { toast('The ' + label + ' (from Grow Co.)', ''); } }); return m; };
        var oldWG = world.group; world.group = c.group; world.tentGroup = null;   /* a prop that builds into the shop's world (the tent) builds into its own group, at its own origin */
        try { d.build(g, Object.assign({}, P || {}, { x: 0, z: 0, rot: 0, floor: 0, unit: 1, hidden: false }), inst); } finally { world.group = oldWG; }
        (g.obstacles || []).forEach(function (o) { c.solid(Math.min(o.x1, o.x2), Math.max(o.x1, o.x2), Math.min(o.z1, o.z2), Math.max(o.z1, o.z2), 0, 2.4); });
      } });
    });
    // the fixtures: each builds into a scratch group (the shop built them straight into its world), which is re-centred on its footprint and set on the floor
    G_FIX.forEach(function (fx) {
      defProp('gc' + fx.id.charAt(0).toUpperCase() + fx.id.slice(1), { extra: true, shop: false, label: fx.label, cat: 'grow co', desc: 'From Grow Co.: the ' + fx.label + '. It sits on the floor: raise it onto a counter with PageUp or the height field.', build: function (c) {
        var tmp = new THREE.Group(), oldRoot = CO.root, oldWG = world.group; CO.root = tmp; world.group = tmp; world.reg = world.reg || { drawerT: 0, lastSale: null };
        try { fx.fn(); } catch (e) {} finally { CO.root = oldRoot; world.group = oldWG; }
        tmp.updateMatrixWorld(true); var b3 = new THREE.Box3().setFromObject(tmp); if (b3.isEmpty()) return; var cx = (b3.min.x + b3.max.x) / 2, cz = (b3.min.z + b3.max.z) / 2, y0 = b3.min.y;
        tmp.children.slice().forEach(function (ch) { ch.position.x -= cx; ch.position.z -= cz; ch.position.y -= y0; c.group.add(ch); });
        c.hit(Math.max(0.2, b3.max.x - b3.min.x), Math.max(0.2, b3.max.y - b3.min.y), Math.max(0.2, b3.max.z - b3.min.z), 0, (b3.max.y - b3.min.y) / 2, 0, { prompt: function () { return 'The ' + fx.label; }, use: function () { toast('The ' + fx.label + ' (from Grow Co.)', ''); } });
      } });
    });
    // the pack's own materials by name, for a prop read back as parts in the Model tab (Co Engine 0.8.0): a getter, so a cache filled later is seen
    CO.packMats = CO.packMats || {}; CO.packMats.growco = function () { return { ${packVars} }; };
  };
  if (CO.cfg && typeof scene !== 'undefined' && scene) growcoPack(MAT, TEX); else hook('beforeBuild', function () { growcoPack(MAT, TEX); });
`);
fs.writeFileSync(OUT, lines.join('\n'));
console.log('wrote ' + OUT + ': ' + lines.join('\n').split('\n').length + ' lines, ' + X.defs.filter((d) => !SKIP.has(d.id)).length + ' defs');
