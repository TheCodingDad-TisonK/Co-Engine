// Builds one game file from the engine's parts and the game's parts.
//
// A game on Co Engine ships as ONE file inside ONE closure, so any static host can serve its game/ folder as it is. The
// parts exist so the code can be read and changed a system at a time. The engine's parts (engine/NN-*.js) go first, in
// name order, then the game's (src/NN-*.js). This script opens the closure, joins the parts, closes it, and refuses to
// build a top-level function declared twice, on either side: one closure means a second `function foo(` silently
// replaces the first. Never edit the built file by hand.
//
//   //@ ...   at column 0: a note for the reader, left out of the build
//
// The game names its paths in co.json at its root (every field optional):
//   { "out": "game/depot.js", "src": "src", "engine": "node_modules/co-engine/engine", "name": "Depot Co" }
//
// Usage:  node build-game.js [--game <dir>] [--check]
//   --game   the game's folder (default: the current folder)
//   --check  exit 1 if the built file differs from what the parts build
'use strict';
const fs = require('fs');
const path = require('path');

function readConfig(gameDir) {
  const file = path.join(gameDir, 'co.json');
  const cfg = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  const engine = cfg.engine ? path.resolve(gameDir, cfg.engine) : path.join(__dirname, '..', 'engine');
  return { dir: gameDir, out: path.resolve(gameDir, cfg.out || 'game/game.js'), src: path.resolve(gameDir, cfg.src || 'src'), engine, name: cfg.name || path.basename(gameDir) };
}

function parts(dir) { return fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => /^\d\d-.*\.js$/.test(n)).sort() : []; }

const OPEN = "(function () {\n  'use strict';\n  if (typeof THREE === 'undefined') { document.body.innerHTML = '<p style=\"padding:40px;font-family:sans-serif\">three.js failed to load (vendor/three/three.min.js).</p>'; return; }\n";
const CLOSE = '})();\n';

function build(cfg) {
  const problems = [];
  const eng = parts(cfg.engine), game = parts(cfg.src);
  if (!eng.length) problems.push('no engine parts in ' + cfg.engine);
  const read = (dir, n) => fs.readFileSync(path.join(dir, n), 'utf8').split('\n').filter((line) => !/^\/\/@/.test(line)).join('\n');
  const body = eng.map((n) => read(cfg.engine, n)).join('') + game.map((n) => read(cfg.src, n)).join('');
  const js = OPEN + body + CLOSE;
  // a top-level function may follow a closing brace on the same line, so both shapes are counted
  const seen = {};
  { const re = /^(?:  |\}\s+)function ([A-Za-z0-9_$]+)\(/gm; let m; while ((m = re.exec(js))) seen[m[1]] = (seen[m[1]] || 0) + 1; }
  Object.keys(seen).filter((n) => seen[n] > 1).forEach((n) => problems.push('function ' + n + ' is declared ' + seen[n] + ' times at the top level'));
  return { js, engine: eng, game, problems };
}

function main() {
  const argv = process.argv.slice(2), at = argv.indexOf('--game');
  const cfg = readConfig(path.resolve(at >= 0 ? argv[at + 1] : '.'));
  const check = argv.includes('--check');
  const r = build(cfg);
  const rel = path.relative(cfg.dir, cfg.out).split(path.sep).join('/');
  if (r.problems.length) { console.error('build-game: ' + r.problems.join('\n  ')); process.exit(1); }
  const cur = fs.existsSync(cfg.out) ? fs.readFileSync(cfg.out, 'utf8') : null;
  const label = r.engine.length + ' engine parts + ' + r.game.length + ' game parts';
  if (check) {
    if (cur !== r.js) { console.error('build-game: ' + rel + ' is not what the parts build. Edit the parts, then build.'); process.exit(1); }
    console.log('build-game: ' + rel + ' matches (' + label + ')');
  } else if (cur !== r.js) { fs.mkdirSync(path.dirname(cfg.out), { recursive: true }); fs.writeFileSync(cfg.out, r.js); console.log('build-game: wrote ' + rel + ' (' + label + ', ' + r.js.split('\n').length + ' lines)'); }
  else console.log('build-game: ' + rel + ' already up to date');
}

if (require.main === module) main();
module.exports = { build, parts, readConfig };
