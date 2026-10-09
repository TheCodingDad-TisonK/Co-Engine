// Puts the engine's three.js beside a game's page: node vendor-three.js [--game <dir>]
// A game page loads vendor/three/three.min.js from its own folder, so any static host can serve the game as it is. The copy
// comes from the engine package (vendor/three/three.min.js) and is written only when it is missing or differs, so a game
// that vendors its own three.js keeps it: co.json "three": false turns the copy off altogether, "three": "<path>" names
// where it goes (default: the page's folder, vendor/three/three.min.js).
'use strict';
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2), at = argv.indexOf('--game'), dir = path.resolve(at >= 0 ? argv[at + 1] : '.');
const co = fs.existsSync(path.join(dir, 'co.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'co.json'), 'utf8')) : {};
if (co.three === false) { console.log('vendor-three: off (co.json)'); process.exit(0); }
const src = path.join(__dirname, '..', 'vendor', 'three', 'three.min.js');
const pageDir = path.dirname(path.resolve(dir, co.page || 'game/index.html'));
const out = path.resolve(dir, typeof co.three === 'string' ? co.three : path.join(pageDir, 'vendor', 'three', 'three.min.js'));
const want = fs.readFileSync(src);
if (fs.existsSync(out) && fs.readFileSync(out).equals(want)) { console.log('vendor-three: ' + path.relative(dir, out).split(path.sep).join('/') + ' is current'); process.exit(0); }
fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, want);
console.log('vendor-three: wrote ' + path.relative(dir, out).split(path.sep).join('/') + ' (' + want.length + ' bytes)');
