// The smoke runner: boots a real game page in a hidden Electron window and runs scenario bodies in it.
//
// A scenario is { name, body, before, after }: body is JavaScript source run inside the page with the handle's T and the
// shared helpers in scope; before(win) and after(win, result) are optional Node-side hooks (seed a save, read one back).
// Scenarios run in order in one window, the page reloaded before each, so a chain of scenarios can carry a save across
// reloads the way a game does. Any page error (console level 2 and up, a gone renderer) fails the run.
//
//   run({ page, handle, scenarios, settle, timeout, userDataPrefix })
//     page      the HTML file to load
//     handle    the window property the game publishes (window.<handle>.T is the test handle)
//     settle    ms to wait after the page loads (default 1200)
//     timeout   ms per scenario (default 240000; SMOKE_TIMEOUT overrides)
//
// One rule for scenario bodies: no backslash-quote inside the body text; a check message that needs an apostrophe is reworded.
'use strict';
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

function prologue(handle) {
  return [
    '  const H = window[' + JSON.stringify(handle) + ']; if (!H || !H.T) throw new Error("no test handle at window.' + handle + '.T");',
    '  const T = H.T; if (T.ui) T.ui.testing = true;',
    '  const out = [], errs = []; window.__smoke = { out, errs };',
    '  const ok = (cond, msg) => { out.push((cond ? "ok   " : "FAIL ") + msg); if (!cond) errs.push(msg); };',
    '  const info = (msg) => { out.push("info " + msg); };',
    '  const near = (a, b, eps, msg) => ok(Math.abs(a - b) <= (eps === undefined ? 1e-6 : eps), msg + " (" + a + " vs " + b + ")");',
    '  const wait = (ms) => new Promise((r) => setTimeout(r, ms));',
    '  // S is the live state whatever object the game holds now: a load replaces the state object and a scenario must follow it',
    '  const S = new Proxy({}, { get: (_, k) => (T.S || {})[k], set: (_, k, v) => { T.S[k] = v; return true; }, has: (_, k) => k in (T.S || {}), deleteProperty: (_, k) => { delete T.S[k]; return true; }, ownKeys: () => Reflect.ownKeys(T.S || {}), getOwnPropertyDescriptor: (_, k) => { const d = Object.getOwnPropertyDescriptor(T.S || {}, k); if (d) d.configurable = true; return d; } });'
  ].join('\n');
}
const EPILOGUE = [
  '  } catch (e) { errs.push("scenario threw: " + (e && e.stack || e)); }',
  '  return { out, errs, pending: !!(T.ui && T.ui.rebuildPending) };',
  '})()'].join('\n');
function wrap(handle, body) { return '(async () => {\n' + prologue(handle) + '\n  try {\n' + body + '\n' + EPILOGUE; }

async function run(opt) {
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
  app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), (opt.userDataPrefix || 'co-smoke') + '-')));
  app.commandLine.appendSwitch('enable-unsafe-swiftshader');
  if (process.env.CI) app.disableHardwareAcceleration();
  await app.whenReady();
  const win = new BrowserWindow({ show: false, width: 1280, height: 720, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, offscreen: true } });
  const pageErrors = [];
  win.webContents.on('console-message', (e, level, msg, line, src) => { if (level >= 2 && !/Electron Security Warning/.test(msg)) pageErrors.push(msg + ' @ ' + String(src).split('/').pop() + ':' + line); });
  win.webContents.on('render-process-gone', (e, d) => { pageErrors.push('renderer gone: ' + d.reason); });
  let total = 0, failed = 0;
  const list = opt.scenarios;
  for (let i = 0; i < list.length; i++) {
    const sc = list[i];
    await win.loadFile(opt.page);
    if (sc.before) { await sc.before(win); await win.loadFile(opt.page); }
    await new Promise((r) => setTimeout(r, opt.settle || 1200));
    const errsBefore = pageErrors.length, t0 = Date.now();
    let result;
    const limit = +(process.env.SMOKE_TIMEOUT || opt.timeout || 240000);
    try { result = await Promise.race([win.webContents.executeJavaScript(wrap(opt.handle, sc.body), true), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), limit))]); }
    catch (e) { let partial = null; try { partial = await Promise.race([win.webContents.executeJavaScript('window.__smoke && { out: window.__smoke.out.slice(-6), n: window.__smoke.out.length }', true), new Promise((r) => setTimeout(() => r(null), 3000))]); } catch (e2) {} result = { out: partial ? ['info stopped after ' + partial.n + ' checks; the last: ' + partial.out.join(' | ')] : [], errs: ['scenario threw: ' + (e && e.message || e)] }; }
    if (sc.after) { try { await sc.after(win, result); } catch (e) { result.errs.push('after hook threw: ' + (e && e.message || e)); } }
    console.log('-- ' + sc.name + ' (' + Math.round((Date.now() - t0) / 1000) + ' s)');
    result.out.forEach((l) => console.log('  ' + l));
    result.errs.filter((e) => /^scenario threw|^after hook/.test(e)).forEach((l) => console.log('  ' + l));
    pageErrors.slice(errsBefore).forEach((l) => console.log('  PAGE ' + l));
    total += result.out.filter((l) => /^ok/.test(l)).length; failed += result.errs.length + (pageErrors.length - errsBefore);
  }
  console.log(failed ? 'smoke: FAILED (' + failed + ') with ' + total + ' checks passed' : 'smoke: all ' + total + ' checks passed across ' + list.length + ' scenario' + (list.length === 1 ? '' : 's'));
  app.exit(failed ? 1 : 0);
}

module.exports = { run, wrap };
