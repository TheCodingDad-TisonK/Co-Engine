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

let win = null, srv = null; const gameWins = [];
// --open=<dir> opens that game in the viewport at once; --shot=<file.png> then saves a picture of the window after --after=<ms> and quits (the editor's own smoke);
// --demo=1 selects the first prop, frames it in the scene camera and opens the assets, so the picture shows the editor at work
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
  return false;
});
ipcMain.handle('cmd', (e, name, arg) => { if (!srv) return false; srv.send(name, arg); return true; });
const PKG_VERSION = (() => { try { return require('../package.json').version; } catch (e) { return app.getVersion(); } })();
ipcMain.handle('info', () => ({ version: PACKED ? app.getVersion() : PKG_VERSION, port: PORT, packed: PACKED, engine: ENGINE_DIR, node: process.versions.node, electron: process.versions.electron }));
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
  const openDir = ARG('open'), shot = ARG('shot'), demo = !!ARG('demo');
  if (openDir) win.webContents.on('did-finish-load', () => { remember(openDir); setTimeout(() => send('auto', { dir: openDir, demo }), 400); if (shot) setTimeout(async () => { try { const img = await win.webContents.capturePage(); fs.writeFileSync(shot, img.toPNG()); console.log('shot: ' + shot); } catch (e2) { console.error('shot failed: ' + e2.message); } app.quit(); }, +(ARG('after') || 9000)); });
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(() => {
    srv = createServer({ port: PORT });
    srv.listen((err) => { if (err) { console.error('co-engine: the port ' + PORT + ' is taken (' + err.message + '). Set CO_DEV_PORT to another one.'); } open(); setTimeout(() => log(err ? 'dev link: port ' + PORT + ' is taken, no game can link' : 'dev link listening on 127.0.0.1:' + PORT, err ? 'err' : 'ok'), 600); });
  });
  app.on('window-all-closed', () => { if (srv) srv.close(); app.quit(); });
}
