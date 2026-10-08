// The Electron shell for a game on Co Engine: one window, no browser chrome, the game page loaded from the game folder.
// A game's main.js is two lines: require this module and call it with the game's folder. co.json supplies the rest:
//   { "name": "Depot Co", "title": "Depot Co.", "page": "game/index.html", "background": "#0b0f14", "pictures": "Depot Co", "icon": "game/logo-256.png" }
//   require('co-engine/shell/main.js')(__dirname);
'use strict';
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');

module.exports = function runShell(dir, extra) {
  const co = Object.assign({}, fs.existsSync(path.join(dir, 'co.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'co.json'), 'utf8')) : {}, extra || {});
  const title = co.title || co.name || 'Game', page = path.join(dir, co.page || 'game/index.html'), pictures = co.pictures || co.name || 'Game';
  let win = null;
  function createWindow() {
    win = new BrowserWindow({ width: 1600, height: 900, minWidth: 1024, minHeight: 600, backgroundColor: co.background || '#0b0f14', title, icon: co.icon ? path.join(dir, co.icon) : undefined, autoHideMenuBar: true, show: false,
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false } });   // the world keeps running while the window is in the background
    Menu.setApplicationMenu(null);
    win.loadFile(page, process.argv.includes('--dev-link') ? { query: { dev: '1' } } : undefined);   // --dev-link: the game links to the editor from the first frame
    win.once('ready-to-show', () => { win.maximize(); win.show(); });
    // F11 toggles fullscreen, Ctrl+Shift+I opens the developer tools, Ctrl+R reloads (the game autosaves)
    win.webContents.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') return;
      if (input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); event.preventDefault(); }
      else if (input.control && input.shift && input.key.toLowerCase() === 'i') { win.webContents.toggleDevTools(); event.preventDefault(); }
      else if (input.control && !input.shift && input.key.toLowerCase() === 'r') { win.reload(); event.preventDefault(); }
    });
    // the game never navigates anywhere; anything that tries opens in the real browser instead (http(s) only)
    const openWeb = (url) => { try { if (/^https?:$/.test(new URL(url).protocol)) shell.openExternal(url); } catch (e) {} };
    win.webContents.setWindowOpenHandler(({ url }) => { openWeb(url); return { action: 'deny' }; });
    win.webContents.on('will-navigate', (event, url) => { if (!url.startsWith('file:')) { event.preventDefault(); openWeb(url); } });
    // F12 in the game saves a screenshot: it arrives here as a download and goes under Pictures\<game> without a dialog
    win.webContents.session.on('will-download', (event, item) => {
      const name = item.getFilename(); if (!/\.png$/i.test(name)) return;
      const out = path.join(app.getPath('pictures'), pictures);
      try { fs.mkdirSync(out, { recursive: true }); item.setSavePath(path.join(out, name)); } catch (e) { /* no Pictures folder: the dialog appears instead */ }
    });
    win.on('closed', () => { win = null; });
  }
  if (!app.requestSingleInstanceLock()) { app.quit(); return; }   // one running copy: a second launch focuses the first, so two windows never fight over the same save
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(createWindow);
  app.on('window-all-closed', () => app.quit());
};
