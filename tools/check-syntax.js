// node --check on every top-level script of a game: game/*.js (never vendor/), main.js and the parts in src/ and engine/.
//   node check-syntax.js [--game <dir>]
// Replaces the hand-kept lists of files in a game's check script, so a new file never goes unchecked.
'use strict';
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const argv = process.argv.slice(2), at = argv.indexOf('--game'), dir = path.resolve(at >= 0 ? argv[at + 1] : '.');
const list = [];
const add = (d, filter) => { if (fs.existsSync(d)) fs.readdirSync(d).filter((n) => /\.js$/.test(n) && (!filter || filter(n))).forEach((n) => list.push(path.join(d, n))); };
add(path.join(dir, 'game')); if (fs.existsSync(path.join(dir, 'main.js'))) list.push(path.join(dir, 'main.js'));
let bad = 0;
for (const f of list) { const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' }); if (r.status !== 0) { bad++; console.error(path.relative(dir, f) + ': ' + (r.stderr || '').split('\n').slice(0, 3).join(' ')); } }
if (bad) { console.error('check-syntax: ' + bad + ' file(s) failed'); process.exit(1); }
console.log('check-syntax: ' + list.length + ' files parse');
