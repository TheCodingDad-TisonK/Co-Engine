// A tiny static server for playing a game in a browser: node serve.js [--game <dir>] [--port 8430] [--root game]
// The root is the game's page folder (co.json "web", default game/ when it holds an index.html, else the game folder itself).
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const argv = process.argv.slice(2), arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const dir = path.resolve(arg('--game', '.'));
const co = fs.existsSync(path.join(dir, 'co.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'co.json'), 'utf8')) : {};
const root = path.resolve(dir, arg('--root', co.web || (fs.existsSync(path.join(dir, 'game', 'index.html')) ? 'game' : '.')));
const port = +arg('--port', co.port || 8430), name = co.name || path.basename(dir);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };
http.createServer(function (req, res) {
  let rel = decodeURIComponent(req.url.split('?')[0]); if (rel === '/') rel = '/index.html';
  // a page outside game/ may reach up to its vendor and engine folders beside it
  const file = path.normalize(path.join(root, rel)), inRoot = file.indexOf(root) === 0, inDir = file.indexOf(dir) === 0;
  if (!inRoot && !inDir) { res.writeHead(403); return res.end(); }
  fs.readFile(file, function (err, data) { if (err) { res.writeHead(404); return res.end('not found'); } res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(data); });
}).listen(port, '127.0.0.1', function () { console.log(name + ' at http://127.0.0.1:' + port + '/'); });
