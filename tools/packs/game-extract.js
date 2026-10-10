'use strict';
const fs = require('fs'), path = require('path');
const ENGINE = path.join(__dirname, '..', '..', 'engine');

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
  // a top-level declaration starts a two-space line, or follows the one before it on the same line ("}  function next(")
  const out = []; const re = /^  (function\s+([A-Za-z_$][\w$]*)\s*\(|var\s+)/gm, tail = /^[ \t;]*(function\s+([A-Za-z_$][\w$]*)\s*\(|var\s+)/; let m;
  function take(start, fname) {
    let end, names = [];
    if (fname) { const pe = spanEnd(src, src.indexOf('(', start)); end = spanEnd(src, src.indexOf('{', pe)); names = [fname]; }
    else { end = stmtEnd(src, start); const body = src.slice(start + 4, end - 1);
      let depth = 0, cur = '', parts = []; const sk = skipper(body); for (let j = 0; j < body.length;) { const s = sk(j); if (s >= 0) { cur += body.slice(j, s); j = s; continue; } const ch = body[j]; if ('([{'.includes(ch)) depth++; else if (')]}'.includes(ch)) depth--; if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; } else cur += ch; j++; } parts.push(cur);
      names = parts.map((p) => (p.trim().match(/^[A-Za-z_$][\w$]*/) || [''])[0]).filter(Boolean); }
    out.push({ names, text: src.slice(start, end), file, start }); return end;
  }
  while ((m = re.exec(src))) {
    let end = take(m.index + 2, m[2]), t;
    while ((t = tail.exec(src.slice(end, end + 300))) && src.slice(end, end + t.index + t[0].length).indexOf('\n') < 0) end = take(end + t[0].length - t[1].length, t[2]);
    re.lastIndex = end;
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
// game-extract.js: the general pack extractor for a game built on the engine's defProp.
//   node game-extract.js <game src dir> report|write <out.json> [stop names comma list]
const SRC = process.argv[2], MODE = process.argv[3], OUTF = process.argv[4];
const STOP = new Set(['S', 'CO', 'GAME', 'defProp', 'propInst', 'PROPS', 'PROP_ORDER', 'scene', 'renderer', 'camera', 'player', 'toast', 'sfx', 'hud', 'ui', 'save'].concat((process.argv[5] || '').split(',').filter(Boolean)));
const engineNames = new Set(); fs.readdirSync(ENGINE).filter((n) => /\.js$/.test(n)).forEach((n) => decls(fs.readFileSync(path.join(ENGINE, n), 'utf8'), n).forEach((d) => d.names.forEach((x) => engineNames.add(x))));
const files = fs.readdirSync(SRC).filter((n) => /\.js$/.test(n) && !/^00-/.test(n)).sort();
const sources = {}, byName = {}; files.forEach((n) => { const src = fs.readFileSync(path.join(SRC, n), 'utf8'); sources[n] = src; decls(src, n).forEach((d) => d.names.forEach((x) => { if (!byName[x]) byName[x] = d; })); });
const defs = [];
files.forEach((n) => { const src = sources[n]; let m; const re = /(^|[^\w$.])defProp\(\s*'([\w]+)'/gm; while ((m = re.exec(src))) { const at = m.index + m[1].length; const open = src.indexOf('(', at); const end = spanEnd(src, open); const line = src.slice(src.lastIndexOf('\n', at) + 1, at); defs.push({ id: m[2], text: src.slice(at, end), file: n, indent: line.length }); re.lastIndex = end; } });
// a def inside a loop or a call travels with its whole top-level statement; one inside a function declaration is left out (nothing calls it)
function enclosing(src, at) {
  const re = /^  (?=\S)/gm; let m, best = -1; while ((m = re.exec(src)) && m.index < at) best = m.index; if (best < 0) return null;
  const head = src.slice(best + 2, best + 40);
  if (/^function/.test(head)) return { fn: true, start: best };
  let end; const mh = /^(for|if|while)\s*\(/.exec(head);
  if (mh) { const pe = spanEnd(src, src.indexOf('(', best)); let k = pe; while (/\s/.test(src[k])) k++; end = src[k] === '{' ? spanEnd(src, k) : stmtEnd(src, k); }
  else end = stmtEnd(src, best);
  return end > at ? { fn: false, start: best, text: src.slice(best, end) } : null;
}
const roots = [], seenRoot = new Set(), leftOut = [];
defs.forEach((d) => { if (d.indent <= 2) { roots.push({ ids: [d.id], text: d.text, file: d.file }); return; }
  const src = sources[d.file], at = src.indexOf(d.text), e = enclosing(src, at);
  if (!e || e.fn) { leftOut.push(d.id + '(' + d.file + ')'); return; }
  const key = d.file + ':' + e.start; if (seenRoot.has(key)) { roots.find((r) => r.key === key).ids.push(d.id); return; } seenRoot.add(key); roots.push({ key: key, ids: [d.id], text: e.text, file: d.file }); });
const want = new Map(), unresolved = {}, stopped = {};
function visit(code, from) { idents(code).forEach((x) => { if (KW.has(x) || engineNames.has(x) && !byName[x] || want.has(x)) return; if (STOP.has(x)) { stopped[x] = (stopped[x] || 0) + 1; return; } const d = byName[x]; if (!d) { if (!engineNames.has(x)) unresolved[x] = (unresolved[x] || []).concat(from).slice(0, 4); return; } want.set(x, d); d.names.forEach((y) => want.set(y, d)); visit(d.text, x); }); }
roots.forEach((r) => visit(r.text, r.ids[0])); (process.argv[6] || '').split(',').filter(Boolean).forEach((n) => visit(n, 'extra'));
const carried = [...new Set(want.values())].sort((a, b) => files.indexOf(a.file) - files.indexOf(b.file) || a.start - b.start);
if (MODE === 'write') { fs.writeFileSync(OUTF, JSON.stringify({ decls: carried.map((d) => ({ names: d.names, file: d.file, text: d.text })), defs, roots: roots.map((r) => ({ ids: r.ids, text: r.text, file: r.file })), leftOut, stopped, unresolved }, null, 1)); console.log('wrote ' + carried.length + ' declarations, ' + defs.length + ' defs'); }
else {
  console.log('defs ' + defs.length + ', roots ' + roots.length + ', left out ' + leftOut.join(' ') + ', carried declarations ' + carried.length + ', lines ' + carried.reduce((s, d) => s + d.text.split('\n').length, 0));
  console.log('by part: ' + Object.entries(carried.reduce((o, d) => (o[d.file] = (o[d.file] || 0) + 1, o), {})).map(([k, v]) => k + ':' + v).join(' '));
  console.log('stopped: ' + Object.entries(stopped).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ':' + v).join(' '));
  console.log('unresolved: ' + Object.entries(unresolved).map(([k, v]) => k + '<' + v.join(',') + '>').join(' ').slice(0, 1500));
  console.log('largest: ' + carried.slice().sort((a, b) => b.text.length - a.text.length).slice(0, 15).map((d) => d.names[0] + '(' + d.file + ' ' + d.text.split('\n').length + ')').join(' '));
}
