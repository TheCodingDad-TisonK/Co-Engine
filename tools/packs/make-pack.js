// Regenerates a game pack from the game's src/: node tools/packs/make-pack.js <depotco|garageco> [game src dir]
// It walks every defProp in the game back to the helpers it uses (game-extract.js), then seals them in one scope with a sandboxed
// save (game-pack-gen.js, configured by <name>.json). The Grow Co pack has its own pair (grow-extract.js, grow-pack-gen.js) because
// Grow Co draws its props with a kit of its own. After a regenerate, refresh pack.json's props list from the editor's Assets.
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), { execFileSync } = require('child_process');
const name = process.argv[2]; if (!name || !fs.existsSync(path.join(__dirname, name + '.json'))) { console.error('usage: node tools/packs/make-pack.js <depotco|garageco> [game src dir]'); process.exit(2); }
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, name + '.json'), 'utf8')), src = process.argv[3] || cfg.src;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'co-pack-')), xj = path.join(tmp, 'extract.json'), cj = path.join(tmp, 'config.json');
execFileSync(process.execPath, [path.join(__dirname, 'game-extract.js'), src, 'write', xj, '', (cfg.carry || []).join(',')], { stdio: 'inherit' });
fs.writeFileSync(cj, JSON.stringify(Object.assign({}, cfg, { extract: xj, out: path.join(__dirname, '..', '..', 'packs', name, 'pack.js') })));
execFileSync(process.execPath, [path.join(__dirname, 'game-pack-gen.js'), cj], { stdio: 'inherit' });
