// Writes a pack from game-extract.js's JSON: node game-pack-gen.js <config.json>
// config: { extract, out, name, title, game, prefix, cat, header, replace: { name: text }, sandboxAfter, sandbox, skip: [ids] }
'use strict';
const fs = require('fs');
const C = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), X = JSON.parse(fs.readFileSync(C.extract, 'utf8'));
const SKIP = new Set(C.skip || []), REPL = C.replace || {};
const indent = (t, n) => t.split('\n').map((l) => ' '.repeat(n) + l).join('\n');
const fn = C.name.replace(/-/g, '') + 'Pack', L = [];
const packVars = [...new Set(X.decls.filter((d) => /^\s*var\s/.test(d.text) && !d.names.some((n) => REPL[n] !== undefined)).flatMap((d) => d.names).concat(['S']))].map((n) => n + ': ' + n).join(', ');
L.push('//@ Co Engine pack: ' + C.title + '. ' + C.header + ' Generated from ' + C.game + "'s src/ by the Co Engine pack tools; regenerate rather than edit.");
L.push('  // the pack waits for the engine: a game part ahead of CO.setup runs it on the beforeBuild hook, the editor runs it at once');
L.push('  var ' + fn + ' = function (HOST_DEF) {');
L.push('    // the game\'s own defProp calls land here first; each is registered below as a pack prop');
L.push('    var P_DEFS = [], defProp = function (id, def) { P_DEFS.push({ id: id, def: def }); return def; };');
if (C.prologue) L.push(indent(C.prologue, 4));
L.push('    // ' + C.game + "'s carried code, in its part order");
let sandboxed = !C.sandboxAfter; if (!C.sandboxAfter && C.sandbox) { L.push('    // the state the props read: a sandboxed save of the game itself, never the host game'); L.push(indent(C.sandbox, 4)); }
for (const d of X.decls) {
  const r = d.names.find((n) => REPL[n] !== undefined);
  L.push('    /* ' + d.file + ' */');
  L.push(r ? indent(REPL[r], 4) : indent(d.text.replace(/^  /, ''), 4));
  if (!sandboxed && d.names.includes(C.sandboxAfter)) { L.push('    // the state the props read: a sandboxed fresh ' + C.game + ' save, never the host game\'s'); L.push(indent(C.sandbox, 4)); sandboxed = true; }
}
if (!sandboxed && C.sandboxAfter) throw new Error('no declaration named ' + C.sandboxAfter);
if (C.epilogue) { L.push('    // after the carried code: what the props expect the game to have set up'); L.push(indent(C.epilogue, 4)); }
L.push('    // the definitions, each in a guard: one that cannot build here is left out rather than breaking the pack');
for (const r of X.roots) { if (r.ids.every((i) => SKIP.has(i))) continue; L.push('    try {'); L.push(indent(r.text.replace(/^  /, ''), 6)); L.push('    } catch (e) { if (typeof console !== "undefined") console.warn(' + JSON.stringify(C.name + ' pack: ' + r.ids.join(',') + ': ') + ' + e.message); }'); }
L.push(`    // each definition as a pack prop: placeable in the editor, never sold, its uses saying what it is (the game logic stays behind)
    var SKIP = ${JSON.stringify([...SKIP])}, seenBuild = new Map(), seenId = {};
    P_DEFS.forEach(function (e) {
      var d = e.def; if (!d || typeof d.build !== 'function' || SKIP.indexOf(e.id) >= 0 || seenBuild.has(d.build)) return; seenBuild.set(d.build, 1);
      var base = (/^x[A-Z]/.test(e.id) ? e.id.slice(1) : e.id).replace(/[^A-Za-z0-9]/g, ''), nid = ${JSON.stringify(C.prefix)} + base.charAt(0).toUpperCase() + base.slice(1);
      if (seenId[nid] || PROPS[nid]) return; seenId[nid] = 1;
      var label = d.label || base, inert = { prompt: function () { return 'The ' + label; }, use: function () { toast('The ' + label + ' (from ${C.game})', ''); } };
      HOST_DEF(nid, { extra: true, shop: false, label: label, cat: ${JSON.stringify(C.cat)}, ico: d.ico, wall: !!d.wall, noBlob: !!d.noBlob, desc: 'From ${C.game}: ' + label + '.', build: function (c, P, inst) {
        var h0 = c.hit; c.hit = function (w, h, dd, x, y, z) { return h0.call(c, w, h, dd, x, y, z, inert); };
        ${C.ctxSetup || ''}
        try { d.build(c, P, inst); if (d.after) d.after(c, P, inst); } finally { c.hit = h0; }
      } });
    });
    // the pack's own materials by name, for a prop read back as parts in the Model tab (Co Engine 0.8.0): a getter, so a cache filled later is seen
    CO.packMats = CO.packMats || {}; CO.packMats[${JSON.stringify(C.name)}] = function () { return { ${packVars} }; };
  };
  if (CO.cfg && typeof scene !== 'undefined' && scene) ${fn}(defProp); else hook('beforeBuild', function () { ${fn}(defProp); });
`);
fs.writeFileSync(C.out, L.join('\n'));
console.log('wrote ' + C.out + ': ' + L.join('\n').split('\n').length + ' lines, ' + X.roots.length + ' roots');
