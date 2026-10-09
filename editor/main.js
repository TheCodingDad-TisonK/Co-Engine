// Co Engine, the editor: one window that opens a game folder, builds it, checks it, runs it, tests it, and talks to the running
// game over the dev link. This is the shell every later panel (the scene, the inspector, the packs) plugs into. It runs from the
// repo with `npm run editor` and ships as one portable exe with `npm run editor:exe`.
'use strict';
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';   // dev-only noise in the console pane; the packaged app never prints it
const { app, BrowserWindow, Menu, ipcMain, dialog, shell, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { createServer } = require('./devserver');
const buildGame = require('../tools/build-game');
const lintGate = require('../tools/lint-gate');

const PORT = +(process.env.CO_DEV_PORT || 8432);
const PACKED = app.isPackaged;
const ENGINE_DIR = path.join(__dirname, '..', 'engine');            // inside the asar when packed; fs reads it fine
const VENDOR_DIR = path.join(__dirname, '..', 'vendor');
const SAMPLE_DIR = path.join(__dirname, '..', 'tests', 'sample');
// a name and a user-data folder of its own, before the single-instance lock: the lock is keyed by that folder, and the games
// run from the editor must never share it
app.setName('Co Engine'); app.setPath('userData', path.join(app.getPath('appData'), 'Co Engine'));
// a self-picture (--shot) must paint even when another window covers this one: Windows occlusion would otherwise leave the capture empty
if (process.argv.some((x) => x.startsWith('--shot='))) app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

let win = null, srv = null; const gameWins = [];
// --open=<dir> opens that game in the viewport at once; --shot=<file.png> then saves a picture of the window after --after=<ms> and quits (the editor's own smoke);
// --demo=1 selects the first prop, frames it in the scene camera and opens the assets, so the picture shows the editor at work; --ask=<text> sends that to the Claude panel once the game runs
const ARG = (name) => { const a = process.argv.find((x) => x.startsWith('--' + name + '=')); return a ? a.slice(name.length + 3) : null; };
const RECENT = () => path.join(app.getPath('userData'), 'recent.json');
function readRecent() { try { return JSON.parse(fs.readFileSync(RECENT(), 'utf8')); } catch (e) { return []; } }
function writeRecent(list) { try { fs.writeFileSync(RECENT(), JSON.stringify(list.slice(0, 12), null, 2)); } catch (e) {} }
function remember(dir) { const list = readRecent().filter((d) => d !== dir); list.unshift(dir); writeRecent(list); }

// what a folder is: a game on the engine (co.json), a game with its own scripts (package.json), or nothing
function describe(dir) {
  const out = { dir, name: path.basename(dir), kind: 'none', page: null, scripts: {} };
  try {
    const co = path.join(dir, 'co.json'), pkg = path.join(dir, 'package.json');
    if (fs.existsSync(pkg)) { const p = JSON.parse(fs.readFileSync(pkg, 'utf8')); out.name = p.productName || p.name || out.name; out.scripts = p.scripts || {}; out.version = p.version; out.kind = 'npm'; }
    if (fs.existsSync(co)) { const c = JSON.parse(fs.readFileSync(co, 'utf8')); out.name = c.name || out.name; out.kind = 'engine'; out.co = c; }
    const pages = ['game/index.html', 'index.html']; for (const pg of pages) if (fs.existsSync(path.join(dir, pg))) { out.page = pg; break; }
  } catch (e) { out.error = e.message; }
  return out;
}
function send(ch, data) { if (win && !win.isDestroyed()) win.webContents.send(ch, data); }
// the editor's actions for the MCP server (editor/mcp.js, over POST /editor): each is a round trip to the editor page, which answers through 'editor-reply'
const pending = new Map(); let pendingSeq = 0;
function askEditor(action, args) {
  return new Promise((resolve, reject) => {
    if (!win || win.isDestroyed()) { reject(new Error('the editor window is not open')); return; }
    const id = ++pendingSeq, ms = (action === 'test' || action === 'release' || action === 'run_script') ? 900000 : (action === 'build' || action === 'check' || action === 'play' || action === 'open_game' || action === 'reload') ? 180000 : 30000;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('the editor did not answer ' + action + ' in time')); }, ms);
    pending.set(id, { resolve, reject, timer });
    send('editor-act', { id, action, args: args || {} });
  });
}
ipcMain.on('editor-reply', (e, m) => { const p = pending.get(m.id); if (!p) return; pending.delete(m.id); clearTimeout(p.timer); if (m.error) p.reject(new Error(m.error)); else p.resolve(m.result); });
function log(text, kind) { send('log', { t: Date.now(), kind: kind || 'out', text }); }

// the engine's own build, in process: no node on the path needed
function buildEngineGame(dir, check) {
  const cfg = buildGame.readConfig(dir); if (!cfg.engine || !fs.existsSync(cfg.engine)) cfg.engine = ENGINE_DIR;
  const r = buildGame.build(cfg);
  if (r.problems.length) { log('build-game: ' + r.problems.join('\n  '), 'err'); return false; }
  const cur = fs.existsSync(cfg.out) ? fs.readFileSync(cfg.out, 'utf8') : null, rel = path.relative(dir, cfg.out).split(path.sep).join('/');
  if (check) { if (cur !== r.js) { log('build-game: ' + rel + ' is not what the parts build', 'err'); return false; } log('build-game: ' + rel + ' matches (' + r.engine.length + ' engine parts + ' + r.game.length + ' game parts)'); return true; }
  if (cur !== r.js) { fs.mkdirSync(path.dirname(cfg.out), { recursive: true }); fs.writeFileSync(cfg.out, r.js); log('build-game: wrote ' + rel + ' (' + r.engine.length + ' engine parts + ' + r.game.length + ' game parts, ' + r.js.split('\n').length + ' lines)'); }
  else log('build-game: ' + rel + ' already up to date');
  return true;
}
function lintDir(dir) { const d = path.join(dir, 'game'); if (!fs.existsSync(d)) { log('lint-gate: no game/ folder', 'err'); return false; } const found = lintGate.lint(d); if (!found.length) { log('lint-gate: clean'); return true; } found.forEach((f) => log(f.file + ':' + f.line + ': [' + f.rule + '] ' + f.msg, 'err')); return false; }
// a game's own npm script, streamed into the log
const running = {};
function runScript(dir, script) {
  return new Promise((resolve) => {
    const key = dir + ':' + script; if (running[key]) { log(script + ' is already running', 'err'); resolve(false); return; }
    log('> npm run ' + script + '   (' + dir + ')', 'cmd');
    const child = spawn('npm run ' + script, { cwd: dir, shell: true, env: Object.assign({}, process.env, { ELECTRON_RUN_AS_NODE: '' }) });
    running[key] = child;
    const pipe = (stream, kind) => { let buf = ''; stream.on('data', (c) => { buf += c.toString(); const lines = buf.split(/\r?\n/); buf = lines.pop(); lines.forEach((l) => { if (l.trim()) log(l, kind); }); }); stream.on('end', () => { if (buf.trim()) log(buf, kind); }); };
    pipe(child.stdout, 'out'); pipe(child.stderr, 'err');
    child.on('close', (code) => { delete running[key]; log('npm run ' + script + ' exited with ' + code, code ? 'err' : 'ok'); resolve(code === 0); });
    child.on('error', (e) => { delete running[key]; log('could not run npm: ' + e.message, 'err'); resolve(false); });
  });
}
function openGame(dir, page, dev) {
  const gw = new BrowserWindow({ width: 1280, height: 760, backgroundColor: '#0b0f14', title: path.basename(dir), autoHideMenuBar: true, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } });
  gw.loadFile(path.join(dir, page), dev ? { query: { dev: '1' } } : undefined);
  gw.webContents.on('before-input-event', (event, input) => { if (input.type === 'keyDown' && input.key === 'F11') { gw.setFullScreen(!gw.isFullScreen()); event.preventDefault(); } if (input.type === 'keyDown' && input.control && input.shift && input.key.toLowerCase() === 'i') { gw.webContents.toggleDevTools(); event.preventDefault(); } });
  gw.webContents.setWindowOpenHandler(({ url }) => { try { if (/^https?:$/.test(new URL(url).protocol)) shell.openExternal(url); } catch (e) {} return { action: 'deny' }; });
  gw.on('closed', () => { const i = gameWins.indexOf(gw); if (i >= 0) gameWins.splice(i, 1); send('games', { open: gameWins.length }); });
  gameWins.push(gw); send('games', { open: gameWins.length });
  log('opened ' + page + (dev ? ' with the dev link' : ''));
}
// a new game from the sample: the sample's parts, page and co.json copied into a folder of the user's choosing, with three.js
// and a copy of this editor's engine parts beside it, so the folder builds on its own with the engine version it was made with
// (engine/VERSION says which). Pinning a tag of the engine repo replaces the copy once the engine is published.
function newGame(dir) {
  const name = path.basename(dir);
  ['src', 'game', path.join('vendor', 'three'), 'engine'].forEach((d) => fs.mkdirSync(path.join(dir, d), { recursive: true }));
  fs.copyFileSync(path.join(SAMPLE_DIR, 'src', '01-sample.js'), path.join(dir, 'src', '01-game.js'));
  fs.copyFileSync(path.join(VENDOR_DIR, 'three', 'three.min.js'), path.join(dir, 'vendor', 'three', 'three.min.js'));
  fs.readdirSync(ENGINE_DIR).filter((n) => /^\d\d-.*\.js$/.test(n)).forEach((n) => fs.copyFileSync(path.join(ENGINE_DIR, n), path.join(dir, 'engine', n)));
  fs.writeFileSync(path.join(dir, 'engine', 'VERSION'), app.getVersion() + '\n');
  try { fs.copyFileSync(mcpConfigPath(), path.join(dir, '.mcp.json')); } catch (e) {}   // Claude Code in that folder gets this editor as its MCP server
  const page = fs.readFileSync(path.join(SAMPLE_DIR, 'index.html'), 'utf8').replace('../../vendor/three/three.min.js', 'vendor/three/three.min.js').replace('game/sample.js', 'game/game.js').replace('<title>Co Engine sample</title>', '<title>' + name.replace(/[<>&]/g, '') + '</title>');
  fs.writeFileSync(path.join(dir, 'index.html'), page);
  fs.writeFileSync(path.join(dir, 'co.json'), JSON.stringify({ name, out: 'game/game.js', src: 'src', engine: 'engine' }, null, 2) + '\n');
  fs.writeFileSync(path.join(dir, '.gitignore'), 'node_modules/\n');
  log('new game ' + name + ' from the sample at ' + dir + ' (engine ' + app.getVersion() + ' copied beside it)', 'ok');
  return describe(dir);
}

ipcMain.handle('recent', () => readRecent().map(describe));
ipcMain.handle('open-dialog', async () => { const r = await dialog.showOpenDialog(win, { title: 'Open a game folder', properties: ['openDirectory'] }); if (r.canceled || !r.filePaths.length) return null; const dir = r.filePaths[0]; remember(dir); return describe(dir); });
ipcMain.handle('new-dialog', async () => { const r = await dialog.showOpenDialog(win, { title: 'Choose an empty folder for the new game', properties: ['openDirectory', 'createDirectory'] }); if (r.canceled || !r.filePaths.length) return null; const dir = r.filePaths[0]; if (fs.readdirSync(dir).length) { log('that folder is not empty: ' + dir, 'err'); return null; } const d = newGame(dir); remember(dir); buildEngineGame(dir, false); return describe(dir); });
ipcMain.handle('describe', (e, dir) => describe(dir));
ipcMain.handle('forget', (e, dir) => { writeRecent(readRecent().filter((d) => d !== dir)); return true; });
ipcMain.handle('act', async (e, dir, what) => {
  const d = describe(dir); if (d.kind === 'none') { log('not a game folder: ' + dir, 'err'); return false; }
  if (what === 'build') return d.kind === 'engine' ? buildEngineGame(dir, false) : runScript(dir, 'build');
  if (what === 'check') return d.kind === 'engine' ? (buildEngineGame(dir, true) && lintDir(dir)) : runScript(dir, 'check');
  if (what === 'test') return d.scripts.test ? runScript(dir, 'test') : (log('no test script in that game', 'err'), false);
  if (what === 'run' || what === 'dev') { if (!d.page) { log('no page to run (game/index.html or index.html)', 'err'); return false; } if (d.kind === 'engine') buildEngineGame(dir, false); openGame(dir, d.page, what === 'dev'); return true; }
  if (what === 'folder') { shell.openPath(dir); return true; }
  if (what === 'web') { if (!d.page) { log('no page to copy', 'err'); return false; } if (d.kind === 'engine' && !buildEngineGame(dir, false)) return false; const out = path.join(dir, 'dist', 'web'); fs.rmSync(out, { recursive: true, force: true }); const skip = new Set(['node_modules', 'dist', 'src', '.git', '.github', 'tests', 'docs', 'brand', 'build']); const copy = (from, to) => { fs.mkdirSync(to, { recursive: true }); for (const n of fs.readdirSync(from)) { if (skip.has(n) || /\.(md|json|ps1|sh|log)$/i.test(n) && n !== 'co.json') continue; const s = path.join(from, n), t = path.join(to, n), st = fs.statSync(s); if (st.isDirectory()) copy(s, t); else fs.copyFileSync(s, t); } }; copy(dir, out); log('web folder: ' + out + ' (open ' + d.page + ' in a browser, or serve the folder)', 'ok'); shell.openPath(out); return true; }
  if (what === 'portable') { if (!d.scripts) return false; log('portable exe: electron-builder --win portable', 'cmd'); return new Promise((resolve) => { const ch = spawn('npx electron-builder --win portable --x64 --publish never', { cwd: dir, shell: true }); ch.stdout.on('data', (c) => String(c).split(/\r?\n/).forEach((l) => { if (l.trim()) log(l, 'out'); })); ch.stderr.on('data', (c) => String(c).split(/\r?\n/).forEach((l) => { if (l.trim()) log(l, 'err'); })); ch.on('close', (code) => { log('portable exe: exited with ' + code + (code ? '' : ', see dist/'), code ? 'err' : 'ok'); resolve(code === 0); }); }); }
  if (what === 'dist') { const dd = path.join(dir, 'dist'); if (!fs.existsSync(dd)) { log('no dist/ yet: build an installer first', 'err'); return false; } shell.openPath(dd); return true; }
  return false;
});
ipcMain.handle('cmd', (e, name, arg) => { if (!srv) return false; srv.send(name, arg); return true; });
// the layout file the editor keeps in step with the scene: src/00-layout.js, written only when it changed
// the prop packs that ship with the engine (packs/<name>/pack.js + pack.json): what each holds, and whether a game has it
const PACKS_DIR = path.join(__dirname, '..', 'packs');
function listPacks(dir) {
  let names = []; try { names = fs.readdirSync(PACKS_DIR).filter((n) => fs.existsSync(path.join(PACKS_DIR, n, 'pack.js'))); } catch (e) { return []; }
  const d = dir ? describe(dir) : null, srcDir = dir ? path.join(dir, (d.co && d.co.src) || 'src') : null;
  return names.map((n) => {
    let meta = {}; try { meta = JSON.parse(fs.readFileSync(path.join(PACKS_DIR, n, 'pack.json'), 'utf8')); } catch (e) {}
    const code = fs.readFileSync(path.join(PACKS_DIR, n, 'pack.js'), 'utf8'), props = []; const re = /defProp\('(\w+)',\s*\{[^\n]*?label:\s*'([^']*)'/g; let m; while ((m = re.exec(code))) props.push({ id: m[1], label: m[2] });
    const file = srcDir ? path.join(srcDir, '00-pack-' + n + '.js') : null, has = !!(file && fs.existsSync(file)), current = has && fs.readFileSync(file, 'utf8') === code;
    return { name: n, title: meta.title || n, description: meta.description || '', since: meta.since || '', props, file: '00-pack-' + n + '.js', added: has, current };
  });
}
ipcMain.handle('packs-list', (e, dir) => { const list = listPacks(dir || null); const seen = new Set(list.map((p) => p.name)); const d0 = dir ? describe(dir) : null, srcDir = dir ? path.join(dir, (d0.co && d0.co.src) || 'src') : null;
  // the packs your other games carry: their packs/<name>/pack.js folders, made with Make a pack
  readRecent().forEach((g) => { if (dir && path.resolve(g) === path.resolve(dir)) return; const pd = path.join(g, 'packs'); let names = []; try { names = fs.readdirSync(pd).filter((n) => fs.existsSync(path.join(pd, n, 'pack.js'))); } catch (err) { return; } names.forEach((n) => { if (seen.has(n)) return; seen.add(n); let meta = {}; try { meta = JSON.parse(fs.readFileSync(path.join(pd, n, 'pack.json'), 'utf8')); } catch (err) {} const code = fs.readFileSync(path.join(pd, n, 'pack.js'), 'utf8'), props = []; const re = /defProp\("?'?(\w+)/g; let m; while ((m = re.exec(code))) props.push({ id: m[1], label: m[1] }); const file = srcDir ? path.join(srcDir, '00-pack-' + n + '.js') : null, has = !!(file && fs.existsSync(file)); list.push({ name: n, title: meta.title || n, description: meta.description || '', props, file: '00-pack-' + n + '.js', added: has, current: has && fs.readFileSync(file, 'utf8') === code, from: describe(g).name, src: path.join(pd, n, 'pack.js') }); }); });
  return list; });
ipcMain.handle('pack-make', (e, q) => { if (!/^[a-z0-9-]+$/.test(q.name || '')) return { error: 'a pack name is letters, digits and dashes' }; const pd = path.join(q.dir, 'packs', q.name); fs.mkdirSync(pd, { recursive: true }); fs.writeFileSync(path.join(pd, 'pack.js'), q.code); fs.writeFileSync(path.join(pd, 'pack.json'), JSON.stringify({ name: q.name, title: q.title || q.name, description: q.description || '', from: describe(q.dir).name }, null, 2) + '\n'); return { ok: true, file: 'packs/' + q.name + '/pack.js' }; });
// the game's files for the Project tab, and reading and writing one (text files inside the game folder only)
const TEXT_EXT = /\.(js|json|html|css|md|txt|yml|yaml)$/i;
function insideGame(dir, rel) { const p = path.resolve(dir, rel); return p.startsWith(path.resolve(dir) + path.sep) ? p : null; }
ipcMain.handle('game-files', (e, dir) => { const d = describe(dir), srcName = (d.co && d.co.src) || 'src', out = []; const add = (rel, group) => { const p = path.join(dir, rel); try { const st = fs.statSync(p); if (st.isFile()) out.push({ rel: rel.split(path.sep).join('/'), name: path.basename(rel), group, size: st.size, editor: /^00-/.test(path.basename(rel)) && group === 'src' }); } catch (err) {} };
  try { fs.readdirSync(path.join(dir, srcName)).filter((n) => TEXT_EXT.test(n)).sort().forEach((n) => add(path.join(srcName, n), 'src')); } catch (err) {}
  try { fs.readdirSync(path.join(dir, 'packs')).forEach((n) => { add(path.join('packs', n, 'pack.js'), 'packs'); }); } catch (err) {}
  ['co.json', 'package.json', 'CHANGELOG.md', 'README.md', d.page || 'index.html'].forEach((n) => add(n, 'game')); try { fs.readdirSync(path.join(dir, 'tests')).filter((n) => /\.js$/.test(n)).forEach((n) => add(path.join('tests', n), 'tests')); } catch (err) {} return out; });
ipcMain.handle('file-read', (e, dir, rel) => { const p = insideGame(dir, rel); if (!p || !TEXT_EXT.test(p)) return { error: 'only text files inside the game folder' }; try { return { text: fs.readFileSync(p, 'utf8') }; } catch (err) { return { error: err.message }; } });
ipcMain.handle('file-write', (e, dir, rel, text) => { const p = insideGame(dir, rel); if (!p || !TEXT_EXT.test(p)) return { error: 'only text files inside the game folder' }; if (typeof text !== 'string') return { error: 'no text' }; fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); return { ok: true, file: rel }; });
ipcMain.handle('pack-add', (e, q) => {
  const d = describe(q.dir); if (d.kind === 'none') return { error: 'not a game folder' };
  const src = q.src && fs.existsSync(q.src) ? q.src : path.join(PACKS_DIR, q.name, 'pack.js'); if (!fs.existsSync(src)) return { error: 'no such pack: ' + q.name };
  const srcDir = path.join(q.dir, (d.co && d.co.src) || 'src'); if (!fs.existsSync(srcDir)) return { error: 'no src/ folder in ' + q.dir };
  const file = path.join(srcDir, '00-pack-' + q.name + '.js'); fs.copyFileSync(src, file); log('pack: ' + q.name + ' is in src/00-pack-' + q.name + '.js', 'ok'); return { ok: true, file: 'src/00-pack-' + q.name + '.js' };
});
ipcMain.handle('part-write', (e, q) => {
  const d = describe(q.dir), srcDir = path.join(q.dir, (d.co && d.co.src) || 'src'); if (!fs.existsSync(srcDir)) return { error: 'no src/ folder in ' + q.dir };
  if (!/^00-[a-z]+\.js$/.test(q.name || '')) return { error: 'a part the editor writes is named 00-<name>.js' };
  const file = path.join(srcDir, q.name), exists = fs.existsSync(file);
  if (!exists && q.onlyIfExists) return { ok: true, skipped: true };
  const cur = exists ? fs.readFileSync(file, 'utf8') : null; if (cur === q.code) return { ok: true, same: true, file: 'src/' + q.name };
  if (q.code === '' && exists) { fs.unlinkSync(file); return { ok: true, wrote: true, removed: true, file: 'src/' + q.name }; }
  fs.writeFileSync(file, q.code); return { ok: true, wrote: true, file: 'src/' + q.name };
});
ipcMain.handle('layout-write', (e, q) => {
  const d = describe(q.dir), srcDir = path.join(q.dir, (d.co && d.co.src) || 'src'); if (!fs.existsSync(srcDir)) return { error: 'no src/ folder in ' + q.dir };
  const file = path.join(srcDir, '00-layout.js'), exists = fs.existsSync(file);
  if (!exists && q.onlyIfExists) return { ok: true, skipped: true };
  const cur = exists ? fs.readFileSync(file, 'utf8') : null; if (cur === q.code) return { ok: true, same: true, file: 'src/00-layout.js' };
  fs.writeFileSync(file, q.code); return { ok: true, wrote: true, file: 'src/00-layout.js' };
});
ipcMain.handle('open-url', (e, url) => { if (/^https:\/\//.test(String(url))) { shell.openExternal(url); return true; } return false; });
// ── Release: bump, changelog, build, commit, tag, push, the GitHub release ──
const { execFileSync } = require('child_process');
function git(dir, args) { return execFileSync('git', args, { cwd: dir, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
function findExe(name) { const names = process.platform === 'win32' ? [name + '.exe', name + '.cmd', name] : [name]; for (const d of (process.env.PATH || '').split(path.delimiter)) for (const n of names) { const p = path.join(d, n); try { if (fs.statSync(p).isFile()) return p; } catch (e2) {} } return null; }
function bump(v, part) { const a = v.split('.').map((x) => +x || 0); while (a.length < 3) a.push(0); if (part === 'major') return (a[0] + 1) + '.0.0'; if (part === 'minor') return a[0] + '.' + (a[1] + 1) + '.0'; return a[0] + '.' + a[1] + '.' + (a[2] + 1); }
ipcMain.handle('release-preflight', (e, dir) => {
  try {
    const d = describe(dir); if (d.kind === 'none') return { error: 'not a game folder' };
    const pkgPath = path.join(dir, 'package.json'); if (!fs.existsSync(pkgPath)) return { error: 'no package.json: a release needs one (the version lives there)' };
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')), version = pkg.version || '0.0.0';
    let branch = null, remote = null, dirty = [], lastTag = null;
    try { branch = git(dir, ['rev-parse', '--abbrev-ref', 'HEAD']); } catch (e2) { return { error: 'not a git repository (git init, add a remote, then release)' }; }
    try { remote = git(dir, ['remote', 'get-url', 'origin']); } catch (e2) {}
    try { dirty = git(dir, ['status', '--porcelain']).split('\n').filter(Boolean); } catch (e2) {}
    try { lastTag = git(dir, ['describe', '--tags', '--abbrev=0']); } catch (e2) {}
    return { name: pkg.productName || d.name, version, next: { patch: bump(version, 'patch'), minor: bump(version, 'minor'), major: bump(version, 'major') }, branch, remote, dirty, lastTag, hasChangelog: fs.existsSync(path.join(dir, 'CHANGELOG.md')), canInstaller: !!(d.scripts && d.scripts.installer), gh: !!findExe('gh') };
  } catch (e2) { return { error: e2.message }; }
});
ipcMain.handle('release', async (e, q) => {
  const dir = q.dir, d = describe(dir), steps = [];
  const say = (t, kind) => { steps.push(t); log('release: ' + t, kind || 'cmd'); };
  try {
    if (!/^\d+\.\d+\.\d+$/.test(q.version || '')) return { error: 'the version must be three numbers, like 1.2.3' };
    const pkgPath = path.join(dir, 'package.json'), pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')), name = pkg.productName || d.name, tag = 'v' + q.version;
    try { git(dir, ['rev-parse', '--verify', '--quiet', 'refs/tags/' + tag]); return { error: 'the tag ' + tag + ' exists already; pick another version' }; } catch (e2) {}
    const title = (q.title || '').trim(), notes = (q.notes || '').trim(), date = new Date().toISOString().slice(0, 10);
    // 1. the version in package.json (and the lock's top-level copy)
    const old = pkg.version; pkg.version = q.version; fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n'); say('package.json ' + old + ' to ' + q.version, 'ok');
    const lockPath = path.join(dir, 'package-lock.json'); if (fs.existsSync(lockPath)) { try { const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8')); lock.version = q.version; if (lock.packages && lock.packages['']) lock.packages[''].version = q.version; fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n'); } catch (e2) { say('package-lock.json not updated: ' + e2.message, 'err'); } }
    // 2. the changelog entry on top
    const clPath = path.join(dir, 'CHANGELOG.md'); const entry = '## ' + q.version + ' (' + date + ')' + (title ? ': ' + title : '') + '\n\n' + (notes || '- Maintenance release.') + '\n\n';
    if (fs.existsSync(clPath)) { const cl = fs.readFileSync(clPath, 'utf8'); const m = /^(# [^\n]*\n\n?)/.exec(cl); fs.writeFileSync(clPath, m ? m[1] + (m[1].endsWith('\n\n') ? '' : '\n') + entry + cl.slice(m[1].length) : entry + cl); } else fs.writeFileSync(clPath, '# Changelog\n\n' + entry);
    say('CHANGELOG.md: ' + q.version + (title ? ': ' + title : ''), 'ok');
    // 3. build (stamps game/version.js) and check
    if (d.kind === 'engine') { if (!buildEngineGame(dir, false)) return { error: 'the build failed; nothing committed (the version and the changelog are changed on disk, revert them or fix the build and release again)' }; } else if (d.scripts && d.scripts.build) { if (!(await runScript(dir, 'build'))) return { error: 'npm run build failed; nothing committed' }; }
    if (d.scripts && d.scripts.check) { if (!(await runScript(dir, 'check'))) return { error: 'npm run check failed; nothing committed' }; }
    let installer = false;
    if (q.installer && d.scripts && d.scripts.installer) { say('building the installer'); if (!(await runScript(dir, 'installer'))) return { error: 'npm run installer failed; nothing committed' }; const dist = path.join(dir, 'dist'); const exes = fs.existsSync(dist) ? fs.readdirSync(dist).filter((n) => /\.exe$/i.test(n) && !/^__/.test(n)) : []; const desk = app.getPath('desktop'); exes.forEach((n) => { try { fs.copyFileSync(path.join(dist, n), path.join(desk, n)); say('on the Desktop: ' + n, 'ok'); installer = true; } catch (e2) { say('could not copy ' + n + ': ' + e2.message, 'err'); } }); }
    // 4. commit and tag
    git(dir, ['add', '-A']);
    const staged = git(dir, ['status', '--porcelain']);
    if (staged) { git(dir, ['commit', '-q', '-m', 'Release ' + tag + (title ? ': ' + title : '')]); say('committed: Release ' + tag, 'ok'); } else say('nothing to commit', 'out');
    const branch = git(dir, ['rev-parse', '--abbrev-ref', 'HEAD']);
    let urls = {}; let remote = null; try { remote = git(dir, ['remote', 'get-url', 'origin']); } catch (e2) {}
    const slug = remote && /github\.com[:/]([^/]+\/[^/.]+)/.exec(remote) ? /github\.com[:/]([^/]+\/[^/.]+)/.exec(remote)[1] : null;
    if (q.publish && remote) {
      git(dir, ['push', '-q', 'origin', 'HEAD']); say('pushed ' + branch, 'ok');
      const gh = findExe('gh');
      if (gh && slug) {
        const nf = path.join(app.getPath('userData'), 'release-notes.md'); fs.writeFileSync(nf, (notes || '- Maintenance release.') + '\n');
        try { execFileSync(gh, ['release', 'create', tag, '--repo', slug, '--target', branch, '--title', name + ' ' + q.version + (title ? ': ' + title : ''), '--notes-file', nf], { cwd: dir, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }); say('GitHub release ' + tag + ' created with your notes; the workflow attaches the installer', 'ok'); try { git(dir, ['fetch', '-q', '--tags']); } catch (e3) {} }
        catch (e2) { say('gh release create failed (' + String(e2.stderr || e2.message).trim().split('\n')[0] + '); tagging and pushing instead', 'err'); git(dir, ['tag', tag]); git(dir, ['push', '-q', 'origin', tag]); say('pushed the tag ' + tag, 'ok'); }
      } else { git(dir, ['tag', tag]); git(dir, ['push', '-q', 'origin', tag]); say('pushed the tag ' + tag + ' (no gh: the workflow writes the notes)', 'ok'); }
      if (slug) urls = { release: 'https://github.com/' + slug + '/releases/tag/' + tag, actions: 'https://github.com/' + slug + '/actions' };
    } else { git(dir, ['tag', tag]); say('tagged ' + tag + ' locally' + (q.publish ? ' (no remote to push to)' : ' (not pushed)'), 'ok'); }
    return { ok: true, tag, urls, installer, steps };
  } catch (e2) { const msg = String(e2.stderr || e2.message).trim(); say(msg, 'err'); return { error: msg, steps }; }
});
ipcMain.handle('script', (e, dir, name) => { const d = describe(dir); if (!d.scripts || !d.scripts[name]) { log('no such npm script: ' + name, 'err'); return false; } return runScript(dir, name); });
// the pack writer: a build function's new text replaces its old text in the src/ part that holds it (exact, then allowing for whitespace); a new definition is appended to the part with the most defProp calls
ipcMain.handle('pack-write', (e, q) => {
  const d = describe(q.dir), srcDir = path.join(q.dir, (d.co && d.co.src) || 'src');
  if (!fs.existsSync(srcDir)) return { error: 'no src/ folder in ' + q.dir };
  const files = fs.readdirSync(srcDir).filter((n) => /\.js$/.test(n)).sort();
  if (q.oldText && typeof q.newText === 'string') {
    for (const n of files) { const p = path.join(srcDir, n), t = fs.readFileSync(p, 'utf8'), i = t.indexOf(q.oldText); if (i >= 0) { if (t.indexOf(q.oldText, i + 1) >= 0) return { error: 'the old code appears twice in src/' + n + '; edit that file by hand' }; fs.writeFileSync(p, t.slice(0, i) + q.newText + t.slice(i + q.oldText.length)); log('pack: wrote src/' + n, 'ok'); return { ok: true, file: 'src/' + n }; } }
    const re = new RegExp(q.oldText.trim().split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+'));
    for (const n of files) { const p = path.join(srcDir, n), t = fs.readFileSync(p, 'utf8'), m = re.exec(t); if (m) { fs.writeFileSync(p, t.slice(0, m.index) + q.newText + t.slice(m.index + m[0].length)); log('pack: wrote src/' + n, 'ok'); return { ok: true, file: 'src/' + n, note: 'matched allowing for whitespace' }; } }
    return { error: 'the original build code was not found in src/ (changed on disk since the game was built?)' };
  }
  if (q.append) {
    let best = null, bestN = 0; for (const n of files) { const c = (fs.readFileSync(path.join(srcDir, n), 'utf8').match(/defProp\(/g) || []).length; if (c > bestN) { bestN = c; best = n; } }
    if (!best) { best = '50-props.js'; fs.writeFileSync(path.join(srcDir, best), '//@ the props written from the Co Engine editor\n'); }
    const p = path.join(srcDir, best); let t = fs.readFileSync(p, 'utf8'); if (!/\n$/.test(t)) t += '\n'; fs.writeFileSync(p, t + '  ' + q.append.replace(/\s+$/, '').replace(/\n/g, '\n  ') + '\n'); log('pack: appended to src/' + best, 'ok'); return { ok: true, file: 'src/' + best, appended: true };
  }
  return { error: 'nothing to write' };
});
const PKG_VERSION = (() => { try { return require('../package.json').version; } catch (e) { return app.getVersion(); } })();
ipcMain.handle('info', () => ({ version: PACKED ? app.getVersion() : PKG_VERSION, port: PORT, packed: PACKED, engine: ENGINE_DIR, node: process.versions.node, electron: process.versions.electron }));
// what Claude is told when the panel starts it in a game's folder
const SYSTEM_PROMPT = (dir, name) => [
  'You are working inside the Co Engine editor, on the game in this folder: ' + dir + ' ("' + name + '").',
  'The editor runs the game in its viewport, and the co-editor MCP tools are your eyes and hands in it: status, scene_tree, inspect, set, select, frame, spawn, remove, camera, pause, step, command, assets, screenshot, console_log, build, check, test, play, reload, open_game. Call status first.',
  'A game on Co Engine is one HTML page and one closure, built from the engine\'s parts (node_modules/co-engine/engine) and the game\'s own src/ parts; edit src/, never the built game file. After editing src/ call play, so the viewport runs the new code, and screenshot to look at the result. docs/ENGINE.md in the engine package is the contract a game writes against.',
  'prop.* fields (x, z, rot, h, hidden) persist through the layout and the save; the other inspector fields edit the live object only, so a lasting change to a prop\'s look belongs in its definition in src/.',
  'Keep answers short and concrete. Never put an em dash in anything that ships (the lint gate refuses it). Do not commit or push unless asked in so many words.'
].join('\n');
// Claude Code on this machine: the native exe first (an npm .cmd needs a shell), then whatever the PATH says
function findClaude() {
  const names = process.platform === 'win32' ? ['claude.exe', 'claude.cmd', 'claude'] : ['claude'];
  const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  dirs.push(path.join(app.getPath('home'), '.local', 'bin'), path.join(app.getPath('appData'), 'npm'), path.join(app.getPath('appData'), 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'bin'));
  for (const n of names) for (const d of dirs) { const p = path.join(d, n); try { if (fs.statSync(p).isFile()) return p; } catch (e) {} }
  return null;
}
// the MCP config the panel hands Claude: this editor as the server co-editor. From the repo node runs editor/mcp.js; packed, the exe runs a copy of it as node
function mcpConfigPath() {
  const dir = app.getPath('userData'); let script = path.join(__dirname, 'mcp.js'), command = 'node'; const env = { CO_DEV_PORT: String(PORT) };
  if (PACKED) { script = path.join(dir, 'mcp.js'); try { fs.writeFileSync(script, fs.readFileSync(path.join(__dirname, 'mcp.js'))); } catch (e) {} command = process.execPath; env.ELECTRON_RUN_AS_NODE = '1'; }
  const file = path.join(dir, 'mcp.json'); fs.writeFileSync(file, JSON.stringify({ mcpServers: { 'co-editor': { command, args: [script], env } } }, null, 2)); return file;
}
let claudeProc = null;
// the child's environment: the port, and never the mark of a Claude Code session this editor may have been started from (a nested session refuses to run)
function childEnv() { const env = Object.assign({}, process.env, { CO_DEV_PORT: String(PORT) }); delete env.CLAUDECODE; delete env.CLAUDE_CODE_ENTRYPOINT; return env; }
ipcMain.handle('claude-where', () => findClaude());
ipcMain.handle('mcp-config', () => mcpConfigPath());
ipcMain.handle('claude-stop', () => { if (!claudeProc) return false; try { claudeProc.kill(); } catch (e) {} claudeProc = null; return true; });
ipcMain.handle('claude-ask', (e, q) => {
  const exe = findClaude(); if (!exe) return { error: 'Claude Code is not installed on this machine: npm install -g @anthropic-ai/claude-code (or the installer at claude.com/code), then press Send again.' };
  if (claudeProc) return { error: 'Claude is still answering; press Stop first.' };
  const dir = q.dir && fs.existsSync(q.dir) ? q.dir : app.getPath('home'), d = describe(dir);
  const sys = path.join(app.getPath('userData'), 'claude-system.md'); fs.writeFileSync(sys, SYSTEM_PROMPT(dir, d.name));
  const args = ['-p', '--output-format', 'stream-json', '--verbose', '--mcp-config', mcpConfigPath(), '--append-system-prompt-file', sys, '--permission-mode', 'acceptEdits',
    '--allowedTools', 'mcp__co-editor__*', 'Read', 'Edit', 'Write', 'MultiEdit', 'Glob', 'Grep', 'Bash(npm run:*)', 'Bash(npm test:*)', 'Bash(node tools/:*)', 'Bash(git status:*)', 'Bash(git diff:*)', 'Bash(git log:*)'];
  if (q.session) args.push('--resume', q.session);
  if (q.model) args.push('--model', q.model);
  const useShell = /\.cmd$/i.test(exe), quote = (a) => (/[\s"]/.test(a) ? '"' + a.replace(/"/g, '\\"') + '"' : a);
  let proc;
  try { proc = spawn(useShell ? quote(exe) : exe, useShell ? args.map(quote) : args, { cwd: dir, shell: useShell, windowsHide: true, env: childEnv() }); }
  catch (e2) { return { error: 'could not start ' + exe + ': ' + e2.message }; }
  claudeProc = proc;
  let buf = '', session = q.session || null;
  const relay = (m) => {
    if (m.session_id) session = m.session_id;
    if (m.type === 'system' && m.subtype === 'init') { send('claude', { kind: 'init', session: m.session_id, model: m.model, mcp: (m.mcp_servers || []).map((s) => s.name + ': ' + s.status).join(', '), tools: (m.tools || []).filter((t) => /^mcp__co-editor__/.test(t)).length }); return; }
    if (m.type === 'assistant' && m.message && Array.isArray(m.message.content)) { for (const c of m.message.content) { if (c.type === 'text' && c.text) send('claude', { kind: 'text', text: c.text }); else if (c.type === 'tool_use') send('claude', { kind: 'tool', name: c.name, input: c.input }); } return; }
    if (m.type === 'user' && m.message && Array.isArray(m.message.content)) { for (const c of m.message.content) if (c.type === 'tool_result') send('claude', { kind: 'tool_result', error: !!c.is_error, text: typeof c.content === 'string' ? c.content : (Array.isArray(c.content) ? c.content.filter((x) => x.type === 'text').map((x) => x.text).join('\n') : '') }); return; }
    if (m.type === 'result') { send('claude', { kind: 'result', ok: m.subtype === 'success', session: m.session_id, cost: m.total_cost_usd, turns: m.num_turns, ms: m.duration_ms, text: m.subtype === 'success' ? '' : (m.result || m.subtype || '') }); }
  };
  const line = (s) => { s = s.trim(); if (!s) return; let m; try { m = JSON.parse(s); } catch (e3) { send('claude', { kind: 'raw', text: s }); return; } relay(m); };
  proc.stdout.on('data', (c) => { buf += c; let i; while ((i = buf.indexOf('\n')) >= 0) { line(buf.slice(0, i)); buf = buf.slice(i + 1); } });
  proc.stderr.on('data', (c) => { const s = String(c).trim(); if (s) send('claude', { kind: 'err', text: s }); });
  proc.on('error', (e4) => { send('claude', { kind: 'err', text: e4.message }); });
  proc.on('close', (code) => { if (buf.trim()) line(buf); if (claudeProc === proc) claudeProc = null; send('claude', { kind: 'done', code, session }); });
  proc.stdin.on('error', () => {}); proc.stdin.end(q.prompt);
  return { ok: true, exe };
});
// the page the viewport loads: the game's page as a file url
ipcMain.handle('page-url', (e, dir) => { const d = describe(dir); if (!d.page) return null; return 'file:///' + path.join(dir, d.page).split(path.sep).join('/'); });

function open() {
  // the games in the viewport run in their own session (persist:co-editor): their saves live beside the editor's data, never in a player's install
  const ses = session.fromPartition('persist:co-editor'); ses.setPermissionRequestHandler((wc, permission, cb) => cb(permission === 'fullscreen'));   // no pointer lock in the viewport: a locked pointer in a webview guest brings the app down
  win = new BrowserWindow({ width: 1440, height: 900, minWidth: 1100, minHeight: 680, backgroundColor: '#0b0f14', title: 'Co Engine', autoHideMenuBar: true, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: false, webviewTag: true, preload: path.join(__dirname, 'preload.js') } });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, 'index.html'));
  win.webContents.on('before-input-event', (event, input) => { if (input.type === 'keyDown' && input.control && input.shift && input.key.toLowerCase() === 'i') { win.webContents.toggleDevTools(); event.preventDefault(); } });
  win.on('closed', () => { win = null; });
  const openDir = ARG('open'), shot = ARG('shot'), demo = ARG('demo'), ask = ARG('ask');
  if (openDir) win.webContents.on('did-finish-load', () => { remember(openDir); setTimeout(() => send('auto', { dir: openDir, demo, ask }), 400); if (shot) setTimeout(async () => { try { const img = await win.webContents.capturePage(); fs.writeFileSync(shot, img.toPNG()); console.log('shot: ' + shot + (img.isEmpty() ? ' (EMPTY: the page did not paint)' : '')); } catch (e2) { console.error('shot failed: ' + e2.message); } try { const text = await askEditor('console_log', { n: 80 }); fs.writeFileSync(shot + '.log', text); } catch (e3) { fs.writeFileSync(shot + '.log', 'no console: ' + e3.message); } app.quit(); }, +(ARG('after') || 9000)); });
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(() => {
    srv = createServer({ port: PORT, editor: askEditor, version: PACKED ? app.getVersion() : PKG_VERSION });
    srv.listen((err) => { if (err) { console.error('co-engine: the port ' + PORT + ' is taken (' + err.message + '). Set CO_DEV_PORT to another one.'); } open(); setTimeout(() => log(err ? 'dev link: port ' + PORT + ' is taken, no game can link' : 'dev link listening on 127.0.0.1:' + PORT, err ? 'err' : 'ok'), 600); });
  });
  app.on('window-all-closed', () => { if (claudeProc) { try { claudeProc.kill(); } catch (e) {} } if (srv) srv.close(); app.quit(); });
}
