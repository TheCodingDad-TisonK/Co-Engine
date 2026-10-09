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
  script: (dir, name) => ipcRenderer.invoke('script', dir, name),
  packWrite: (q) => ipcRenderer.invoke('pack-write', q),
  layoutWrite: (q) => ipcRenderer.invoke('layout-write', q),
  releasePreflight: (dir) => ipcRenderer.invoke('release-preflight', dir),
  release: (q) => ipcRenderer.invoke('release', q),
  openUrl: (url) => ipcRenderer.invoke('open-url', url),
  info: () => ipcRenderer.invoke('info'),
  pageUrl: (dir) => ipcRenderer.invoke('page-url', dir),
  onAuto: (fn) => { ipcRenderer.on('auto', (e, d) => fn(d)); },
  onLog: (fn) => { ipcRenderer.on('log', (e, row) => fn(row)); },
  onGames: (fn) => { ipcRenderer.on('games', (e, d) => fn(d)); },
  // the editor's actions, asked by the MCP server through the main process, answered by the page
  onEditorAct: (fn) => { ipcRenderer.on('editor-act', (e, m) => fn(m)); },
  editorReply: (id, result, error) => ipcRenderer.send('editor-reply', { id, result, error }),
  // the Claude panel
  claudeAsk: (q) => ipcRenderer.invoke('claude-ask', q),
  claudeStop: () => ipcRenderer.invoke('claude-stop'),
  claudeWhere: () => ipcRenderer.invoke('claude-where'),
  mcpConfig: () => ipcRenderer.invoke('mcp-config'),
  onClaude: (fn) => { ipcRenderer.on('claude', (e, m) => fn(m)); }
});
