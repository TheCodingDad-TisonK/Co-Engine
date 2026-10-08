// The bridge between the editor page and the Electron main process: a small, named API, nothing else of Node reaches the page.
'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('co', {
  recent: () => ipcRenderer.invoke('recent'),
  openDialog: () => ipcRenderer.invoke('open-dialog'),
  newDialog: () => ipcRenderer.invoke('new-dialog'),
  describe: (dir) => ipcRenderer.invoke('describe', dir),
  forget: (dir) => ipcRenderer.invoke('forget', dir),
  act: (dir, what) => ipcRenderer.invoke('act', dir, what),
  cmd: (name, arg) => ipcRenderer.invoke('cmd', name, arg),
  info: () => ipcRenderer.invoke('info'),
  onLog: (fn) => { ipcRenderer.on('log', (e, row) => fn(row)); },
  onGames: (fn) => { ipcRenderer.on('games', (e, d) => fn(d)); }
});
