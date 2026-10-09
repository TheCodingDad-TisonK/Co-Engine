// The MCP server against a stand-in editor: the dev link server with a stub action handler in place of the editor window,
// editor/mcp.js as a child process, JSON-RPC over its stdio. Checks the handshake, the tool list, that a call reaches the
// handler with its arguments, that an error comes back as an isError result, the screenshot image block, and the message
// when no editor is open. node tests/mcp.test.js
'use strict';
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const readline = require('readline');
const { createServer } = require('../editor/devserver');

const PORT = 8497;
let n = 0, failed = 0;
function ok(c, what) { n++; if (!c) { failed++; console.log('  FAIL ' + what); } else console.log('  ok ' + what); }

const calls = [];
const JPEG = 'data:image/jpeg;base64,' + Buffer.from('not a real jpeg, just bytes for the test').toString('base64');
const srv = createServer({ port: PORT, version: 'test', editor: (action, args) => {
  calls.push({ action, args });
  if (action === 'status') return { project: { name: 'stub' }, running: true };
  if (action === 'screenshot') return JPEG;
  if (action === 'inspect') { if (!args.id) throw new Error('inspect needs an id'); return { id: args.id, prop: { x: 1 } }; }
  if (action === 'console_log') return 'line one\nline two';
  return { echoed: action, args };
} });

function start(port) {
  const p = spawn(process.execPath, [path.join(__dirname, '..', 'editor', 'mcp.js')], { env: Object.assign({}, process.env, { CO_DEV_PORT: String(port) }) });
  p.lines = readline.createInterface({ input: p.stdout });
  p.stderr.on('data', (c) => process.stderr.write(c));
  return p;
}
function rpc(proc, msg) {
  return new Promise((resolve) => {
    const onLine = (l) => { let m; try { m = JSON.parse(l); } catch (e) { return; } if (m.id === msg.id) { proc.lines.off('line', onLine); resolve(m); } };
    proc.lines.on('line', onLine);
    proc.stdin.write(JSON.stringify(msg) + '\n');
  });
}
const EXPECTED = ['status', 'open_game', 'play', 'reload', 'build', 'check', 'test', 'scene_tree', 'inspect', 'set', 'select', 'frame', 'spawn', 'remove', 'camera', 'pause', 'step', 'command', 'assets', 'screenshot', 'console_log', 'undo', 'redo', 'history', 'prop_source', 'prop_preview', 'prop_revert', 'prop_define', 'pack_save', 'profile', 'run_script', 'layout_save', 'save', 'release_preflight', 'release', 'terrain', 'terrain_new', 'terrain_brush', 'terrain_scatter', 'terrain_off', 'materials', 'material_set', 'material_remove', 'material_shot', 'packs', 'pack_add', 'clips', 'clip_set', 'clip_play', 'clip_stop', 'clip_key', 'clip_remove', 'ui', 'ui_set', 'ui_open'];

(async () => {
  await new Promise((res, rej) => srv.listen((e) => (e ? rej(e) : res())));
  const p = start(PORT);
  let r = await rpc(p, { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '0' } } });
  ok(r.result && r.result.serverInfo && r.result.serverInfo.name === 'co-editor', 'initialize names the server');
  ok(r.result && r.result.capabilities && r.result.capabilities.tools, 'initialize offers tools');
  p.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  r = await rpc(p, { jsonrpc: '2.0', id: 2, method: 'tools/list' });
  const tools = r.result.tools || [], names = tools.map((t) => t.name);
  ok(names.length === EXPECTED.length, 'tools/list lists ' + names.length + ' tools');
  EXPECTED.forEach((t) => ok(names.indexOf(t) >= 0, 'tool ' + t));
  ok(tools.every((t) => t.inputSchema && t.inputSchema.type === 'object' && t.description), 'every tool has a schema and a description');
  const setT = tools.find((t) => t.name === 'set'); ok(setT && setT.inputSchema.required.join() === 'id,path,value', 'set requires id, path, value');
  r = await rpc(p, { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'status', arguments: {} } });
  ok(!r.result.isError && /stub/.test(r.result.content[0].text), 'status reaches the editor and comes back as text');
  ok(calls[calls.length - 1].action === 'status', 'the editor saw the status action');
  r = await rpc(p, { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'set', arguments: { id: 'crate1', path: 'prop.x', value: 2.5 } } });
  const last = calls[calls.length - 1]; ok(last.action === 'set' && last.args.id === 'crate1' && last.args.path === 'prop.x' && last.args.value === 2.5, 'set passes id, path and a numeric value through');
  r = await rpc(p, { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'inspect', arguments: {} } });
  ok(r.result.isError === true && /needs an id/.test(r.result.content[0].text), 'an editor error comes back as an isError result, not a crash');
  r = await rpc(p, { jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'screenshot', arguments: {} } });
  ok(r.result.content.length === 2 && r.result.content[1].type === 'image' && r.result.content[1].mimeType === 'image/jpeg' && r.result.content[1].data.length > 10, 'screenshot comes back as an image block');
  const file = path.join(os.tmpdir(), 'co-mcp-test-' + process.pid + '.jpg');
  r = await rpc(p, { jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'screenshot', arguments: { file } } });
  ok(fs.existsSync(file) && /written to/.test(r.result.content[0].text), 'screenshot with a file writes it'); try { fs.unlinkSync(file); } catch (e) {}
  r = await rpc(p, { jsonrpc: '2.0', id: 8, method: 'tools/call', params: { name: 'console_log', arguments: { n: 2 } } });
  ok(/line one/.test(r.result.content[0].text), 'console_log returns the text as is');
  r = await rpc(p, { jsonrpc: '2.0', id: 9, method: 'tools/call', params: { name: 'nothing_here', arguments: {} } });
  ok(r.result.isError && /no such tool/.test(r.result.content[0].text), 'an unknown tool is an error result');
  r = await rpc(p, { jsonrpc: '2.0', id: 10, method: 'ping' }); ok(r.result && !r.error, 'ping answers');
  r = await rpc(p, { jsonrpc: '2.0', id: 11, method: 'made/up' }); ok(r.error && r.error.code === -32601, 'an unknown method is a JSON-RPC error');
  p.stdin.end(); await new Promise((res) => p.on('close', res));
  // nothing listening on the port: the message says what to do
  const p2 = start(PORT + 1);
  r = await rpc(p2, { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'status', arguments: {} } });
  ok(r.result.isError && /editor is not open/.test(r.result.content[0].text), 'with no editor the error says to start it');
  p2.stdin.end(); await new Promise((res) => p2.on('close', res));
  // the route itself
  const g = await new Promise((res) => http.get({ host: '127.0.0.1', port: PORT, path: '/editor' }, (resp) => { let s = ''; resp.on('data', (c) => { s += c; }); resp.on('end', () => res(JSON.parse(s))); }));
  ok(g.ok && g.editor === true && g.version === 'test', 'GET /editor reports the editor and the version');
  srv.close();
  console.log(failed ? 'mcp: ' + failed + ' of ' + n + ' checks FAILED' : 'mcp: all ' + n + ' checks passed');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
