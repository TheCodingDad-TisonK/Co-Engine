// The editor's link to a running game: a small Node http server on 127.0.0.1 that a game on Co Engine links to (the engine's
// devlink part, Ctrl+Shift+D, or on its own in the desktop app) and the editor's panels read from. No dependencies. Two sides:
//   the game    GET  /events   a server-sent event stream; every command the editor sends arrives here as one JSON event
//               POST /state    the readout of the save, once a second while linked
//               POST /result   what a command did, by id
//   the editor  GET  /state    the last readout the game posted, with how long ago
//               GET  /ui       a server-sent event stream of readouts, results and log rows, so the panels never poll
//               POST /cmd      { name, arg }: queued to every linked game, answered with the command id
// Every route answers CORS headers, because the game page is file:// and the editor page is file:// too.
'use strict';
const http = require('http');

function createServer(opts) {
  opts = opts || {};
  const port = opts.port || 8432, host = opts.host || '127.0.0.1';
  const games = new Set(), uis = new Set();
  let state = null, stateAt = 0, seq = 0;
  const results = [], log = [];
  const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' };
  function json(res, code, body) { res.writeHead(code, Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, CORS)); res.end(JSON.stringify(body)); }
  function sse(res, set) { res.writeHead(200, Object.assign({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' }, CORS)); res.write(': hello\n\n'); set.add(res); res.on('close', () => { set.delete(res); }); }
  function push(set, event, data) { const text = (event ? 'event: ' + event + '\n' : '') + 'data: ' + JSON.stringify(data) + '\n\n'; for (const r of set) { try { r.write(text); } catch (e) { set.delete(r); } } }
  function body(req, cb) { let s = ''; req.on('data', (c) => { s += c; if (s.length > 1e6) req.destroy(); }); req.on('end', () => { try { cb(null, s ? JSON.parse(s) : {}); } catch (e) { cb(e); } }); }
  function note(kind, text) { const row = { t: Date.now(), kind, text }; log.push(row); if (log.length > 200) log.shift(); push(uis, 'log', row); }
  function send(name, arg) { const cmd = { id: ++seq, name: String(name), arg: arg === undefined ? null : arg, at: Date.now() }; push(games, null, cmd); note('cmd', name + (arg !== undefined && arg !== null ? ' ' + arg : '') + (games.size ? '' : ' (no game linked)')); return cmd; }
  const server = http.createServer((req, res) => {
    const url = (req.url || '/').split('?')[0];
    if (req.method === 'OPTIONS') { res.writeHead(204, CORS); res.end(); return; }
    if (req.method === 'GET' && url === '/events') { sse(res, games); note('link', 'a game linked'); push(uis, 'games', { n: games.size }); res.on('close', () => { note('link', 'a game unlinked'); push(uis, 'games', { n: games.size }); }); return; }
    if (req.method === 'GET' && url === '/ui') { sse(res, uis); if (state) push(uis, 'state', { state, age: Date.now() - stateAt }); push(uis, 'games', { n: games.size }); return; }
    if (req.method === 'GET' && url === '/state') { json(res, 200, { state, age: state ? Date.now() - stateAt : null, games: games.size, results: results.slice(-20), log: log.slice(-50) }); return; }
    if (req.method === 'POST' && url === '/state') { body(req, (err, b) => { if (err) { json(res, 400, { error: 'bad json' }); return; } state = b; stateAt = Date.now(); push(uis, 'state', { state, age: 0 }); json(res, 200, { ok: true }); }); return; }
    if (req.method === 'POST' && url === '/result') { body(req, (err, b) => { if (err) { json(res, 400, { error: 'bad json' }); return; } results.push(b); if (results.length > 100) results.shift(); note('result', (b.name || '?') + ': ' + (b.result || '')); push(uis, 'result', b); json(res, 200, { ok: true }); }); return; }
    if (req.method === 'POST' && url === '/cmd') { body(req, (err, b) => { if (err || !b || !b.name) { json(res, 400, { error: 'a command needs a name' }); return; } const cmd = send(b.name, b.arg); json(res, 200, { ok: true, id: cmd.id, games: games.size }); }); return; }
    res.writeHead(404, CORS); res.end('not found');
  });
  return { server, port, host, send, games, uis, get state() { return state; }, get stateAt() { return stateAt; }, results, log, note,
    listen(cb) { server.listen(port, host, () => { if (cb) cb(null, port); }); server.on('error', (e) => { if (cb) cb(e); }); return server; },
    close(cb) { for (const r of games) { try { r.end(); } catch (e) {} } for (const r of uis) { try { r.end(); } catch (e) {} } games.clear(); uis.clear(); server.close(cb); } };
}

module.exports = { createServer };
