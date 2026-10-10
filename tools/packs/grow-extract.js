// The Grow Co pack extractor. Reads Grow Co's src/ parts and the engine's parts, finds every growDefProp and propExtra, and walks
// the names their code uses back to Grow's own top-level declarations (helpers, geometry, constants), stopping at names the engine
// already has (those come from the host game) and at a stop-list of Grow systems (stubbed in the pack).
//   node grow-extract.js report        what it would carry
//   node grow-extract.js write <out>   write the pack's carried code as JSON { decls: [...], defs: [...], extras: [...] }
'use strict';
const fs = require('fs'), path = require('path');
const GROW = process.env.GROW_SRC || 'C:/Users/tison/Desktop/RF Grow Co/src', ENGINE = path.join(__dirname, '..', '..', 'engine');

// a scanner that steps over strings, template literals, comments and regex literals
function skipper(src) {
  return function (i) {
    const c = src[i], n = src[i + 1];
    if (c === '/' && n === '/') { const e = src.indexOf('\n', i); return e < 0 ? src.length : e; }
    if (c === '/' && n === '*') { const e = src.indexOf('*/', i + 2); return e < 0 ? src.length : e + 2; }
    if (c === "'" || c === '"' || c === '`') { let j = i + 1; while (j < src.length && src[j] !== c) { if (src[j] === '\\') j++; j++; } return j + 1; }
    if (c === '/') { // a regex when the previous meaningful char cannot end an expression
      let k = i - 1; while (k >= 0 && /\s/.test(src[k])) k--; const p = src[k];
      if (k < 0 || /[(,=:[!&|?{};+\-*%<>~^]/.test(p) || /\b(return|typeof|in|of)$/.test(src.slice(Math.max(0, k - 6), k + 1))) {
        let j = i + 1, cls = false; while (j < src.length) { const ch = src[j]; if (ch === '\\') { j += 2; continue; } if (ch === '[') cls = true; else if (ch === ']') cls = false; else if (ch === '/' && !cls) break; else if (ch === '\n') return i + 1; j++; } j++; while (/[a-z]/.test(src[j] || '')) j++; return j;
      }
    }
    return -1;
  };
}
// the end of the balanced span that opens at src[i] (one of ( [ {)
function spanEnd(src, i) {
  const sk = skipper(src), open = src[i], close = { '(': ')', '[': ']', '{': '}' }[open]; let depth = 0, j = i;
  while (j < src.length) { const s = sk(j); if (s >= 0) { j = s; continue; } const ch = src[j]; if (ch === '(' || ch === '[' || ch === '{') depth++; else if (ch === ')' || ch === ']' || ch === '}') { depth--; if (depth === 0) return j + 1; } j++; }
  return src.length;
}
// the end of a statement that starts at i: the first ; at depth 0
function stmtEnd(src, i) {
  const sk = skipper(src); let depth = 0, j = i;
  while (j < src.length) { const s = sk(j); if (s >= 0) { j = s; continue; } const ch = src[j]; if ('([{'.includes(ch)) depth++; else if (')]}'.includes(ch)) depth--; else if (ch === ';' && depth === 0) return j + 1; j++; }
  return src.length;
}
// the top-level declarations of a part: two-space indented function and var statements
function decls(src, file) {
  const out = []; const re = /^  (function\s+([A-Za-z_$][\w$]*)\s*\(|var\s+)/gm; let m;
  while ((m = re.exec(src))) {
    const start = m.index; let end, names = [];
    if (m[2]) { const b = src.indexOf('{', start + m[0].length); const pe = spanEnd(src, src.indexOf('(', start)); end = spanEnd(src, src.indexOf('{', pe)); names = [m[2]]; }
    else { end = stmtEnd(src, start); const body = src.slice(start + 6, end - 1); // split the var list at depth 0 commas
      let depth = 0, cur = '', parts = []; const sk = skipper(body); for (let j = 0; j < body.length;) { const s = sk(j); if (s >= 0) { cur += body.slice(j, s); j = s; continue; } const ch = body[j]; if ('([{'.includes(ch)) depth++; else if (')]}'.includes(ch)) depth--; if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; } else cur += ch; j++; } parts.push(cur);
      names = parts.map((p) => (p.trim().match(/^[A-Za-z_$][\w$]*/) || [''])[0]).filter(Boolean); }
    out.push({ names, text: src.slice(start, end), file, start }); re.lastIndex = end;
  }
  return out;
}
// the identifiers a piece of code uses, not after a dot and not as an object key
function idents(code) {
  const sk = skipper(code), out = new Set(); let j = 0;
  while (j < code.length) { const s = sk(j); if (s >= 0) { j = s; continue; } const m = /^[A-Za-z_$][\w$]*/.exec(code.slice(j, j + 64)); if (m && !/[\w$.]/.test(code[j - 1] || '')) { const after = code.slice(j + m[0].length).match(/^\s*:/), before = code.slice(0, j).match(/[{,]\s*$/); if (!(after && before)) out.add(m[0]); j += m[0].length; continue; } j += m ? m[0].length : 1; }
  return out;
}
const KW = new Set('var let const function return if else for while do break continue new typeof instanceof in of this true false null undefined Math JSON Object Array String Number Boolean THREE window document console parseInt parseFloat isNaN Infinity NaN Date setTimeout clearTimeout setInterval Set Map Promise performance requestAnimationFrame try catch finally throw switch case default delete void arguments Error RegExp Uint8Array Float32Array'.split(' '));
// Grow systems the pack does not carry: their code is game logic; the pack gives each a harmless stand-in
const STOP = new Set(['world', 'S', 'player', 'ui', 'sec', 'pc', 'dev', 'drive', 'sleep', 'cityMap', 'hooks', 'focus', 'edit', 'camera', 'scene', 'renderer', 'sfx', 'toast', 'logEvent', 'save', 'hud', 'actions', 'lineup', 'customer', 'xs', 'S_', 'buff', 'DEV', 'deskBoard', 'radio', 'scope', 'photo', 'task', 'dlcOn', 'dlcProp', 'unitBase', 'unitIds', 'propInst', 'PROPS', 'PROP_ORDER', 'growBuildProp', 'propExtra', 'growDefProp', 'heldItem', 'held', 'CO', 'GAME', 'fixtureFromBuild', 'fixtureAdd', 'buildPos']);

const engineNames = new Set(); fs.readdirSync(ENGINE).filter((n) => /\.js$/.test(n)).forEach((n) => decls(fs.readFileSync(path.join(ENGINE, n), 'utf8'), n).forEach((d) => d.names.forEach((x) => engineNames.add(x))));
const growDecls = [], byName = {}; const files = fs.readdirSync(GROW).filter((n) => /\.js$/.test(n) && !/desk/.test(n)).sort();
const sources = {}; files.forEach((n) => { const src = fs.readFileSync(path.join(GROW, n), 'utf8'); sources[n] = src; decls(src, n).forEach((d) => { growDecls.push(d); d.names.forEach((x) => { if (!byName[x]) byName[x] = d; }); }); });

// the roots: every growDefProp(...) and propExtra(...) call, with the part it sits in
const defs = [], extras = [];
files.forEach((n) => { const src = sources[n]; let m; const re = /growDefProp\(\s*'([\w]+)'/g; while ((m = re.exec(src))) { if (/function growDefProp/.test(src.slice(Math.max(0, m.index - 20), m.index))) continue; const open = src.indexOf('(', m.index); const end = spanEnd(src, open); defs.push({ id: m[1], text: src.slice(m.index, end), file: n }); re.lastIndex = end; }
  const re2 = /propExtra\(\s*'([\w]+)'/g; while ((m = re2.exec(src))) { if (/function propExtra/.test(src.slice(Math.max(0, m.index - 20), m.index))) continue; const open = src.indexOf('(', m.index); const end = spanEnd(src, open); extras.push({ id: m[1], text: src.slice(m.index, end), file: n }); re2.lastIndex = end; } });

// the counter and wall fixtures Grow builds inside its shop code: the till, the tip jar, the cards, the bell, the key hook, the roster
const FIX_IDS = ['counterTill', 'tipJar', 'bizCards', 'deskBell', 'keyHook', 'roster'], fixtures = [];
files.forEach((n) => { const src = sources[n]; let m; const re = /fixtureFromBuild\(\s*'([\w]+)'/g; while ((m = re.exec(src))) { if (!FIX_IDS.includes(m[1])) continue; const open = src.indexOf('(', m.index); const end = spanEnd(src, open); fixtures.push({ id: m[1], text: src.slice(m.index, end), file: n }); re.lastIndex = end; } });
// the walk
const want = new Map(), unresolved = {}, stopped = {};
function visit(code, from) { idents(code).forEach((x) => { if (KW.has(x) || engineNames.has(x) && !byName[x] || want.has(x)) return; if (STOP.has(x)) { stopped[x] = (stopped[x] || 0) + 1; return; } const d = byName[x]; if (!d) { if (!engineNames.has(x)) unresolved[x] = (unresolved[x] || []).concat(from).slice(0, 4); return; } if (engineNames.has(x) && d) { /* both: the host's wins unless the grow one differs; carry grow's */ } want.set(x, d); d.names.forEach((y) => want.set(y, d)); visit(d.text, x); }); }
// the prop ctx Grow builds its props with travels too
visit('growPropCtx', 'ctx'); visit('fresh', 'state');
defs.forEach((d) => visit(d.text, d.id)); fixtures.forEach((f) => visit(f.text, f.id + '#')); extras.forEach((e) => visit(e.text, e.id + '+'));
const carried = [...new Set(want.values())].sort((a, b) => files.indexOf(a.file) - files.indexOf(b.file) || a.start - b.start);
if (process.argv[2] === 'write') {
  fs.writeFileSync(process.argv[3], JSON.stringify({ decls: carried.map((d) => ({ names: d.names, file: d.file, text: d.text })), defs, extras, fixtures, stopped, unresolved }, null, 1));
  console.log('wrote ' + carried.length + ' declarations, ' + defs.length + ' defs, ' + extras.length + ' extras');
} else {
  console.log('defs ' + defs.length + ', extras ' + extras.length + ', carried declarations ' + carried.length + ', lines ' + carried.reduce((s, d) => s + d.text.split('\n').length, 0));
  console.log('by part: ' + Object.entries(carried.reduce((o, d) => (o[d.file] = (o[d.file] || 0) + 1, o), {})).map(([k, v]) => k + ':' + v).join(' '));
  console.log('stopped: ' + Object.entries(stopped).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ':' + v).join(' '));
  console.log('unresolved: ' + Object.entries(unresolved).map(([k, v]) => k + '<' + v.join(',') + '>').join(' ').slice(0, 1500));
  console.log('largest: ' + carried.slice().sort((a, b) => b.text.length - a.text.length).slice(0, 15).map((d) => d.names[0] + '(' + d.file + ' ' + d.text.split('\n').length + ')').join(' '));
}
