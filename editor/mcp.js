#!/usr/bin/env node
// The Co Engine editor as an MCP server, so Claude Code (in a terminal, or in the editor's own Claude panel) can see and change
// the running game: the scene tree, the inspector, the selection, the scene camera, placing and removing props, pause and step,
// the game's commands, a screenshot, the console, and build, check, test, play and reload.
//
// It is a thin client: every tool call is one POST to the editor's dev link server (127.0.0.1:8432, CO_DEV_PORT to move it),
// which hands it to the editor window, which talks to the game through the engine's editor bridge (CO.editor). Nothing here
// knows the game; the editor has to be open with a game playing for most tools to answer.
//
// Stdio transport, newline-delimited JSON-RPC 2.0, protocol 2024-11-05. No dependencies.
//
//   Claude Code:   .mcp.json  { "mcpServers": { "co-editor": { "command": "node", "args": ["node_modules/co-engine/editor/mcp.js"] } } }
//   by hand:       echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node editor/mcp.js
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const PORT = +(process.env.CO_DEV_PORT || 8432);
const VERSION = (() => { try { return require('../package.json').version; } catch (e) { return '0.0.0'; } })();

const TOOLS = [
  { name: 'status', description: 'What the editor is doing: the open game, whether it runs in the viewport, the camera mode, pause, the selection, how many games are linked. Call this first.', input: {} },
  { name: 'open_game', description: 'Open a game folder in the editor and play it in the viewport (builds it first). The folder holds a co.json.', input: { dir: { type: 'string', description: 'absolute path of the game folder' } }, required: ['dir'] },
  { name: 'play', description: 'Build the open game and (re)start it in the viewport. Use after editing src/ so the viewport runs the new code.', input: {} },
  { name: 'reload', description: 'Reload the viewport page without rebuilding (the save and the layout come back from the browser storage).', input: {} },
  { name: 'build', description: 'Build the open game (joins the engine parts and src/ into the game file, stamps the version). Returns the build log.', input: {} },
  { name: 'check', description: 'Run the open game\'s checks: the build in check mode, the lint gate (no em dashes in shipped prose, no branding), the syntax check. Returns the log.', input: {} },
  { name: 'test', description: 'Run the open game\'s test suite (npm test) and return the log. Can take a minute or more.', input: {} },
  { name: 'scene_tree', description: 'Everything that stands in the running scene, by category: props by catalogue group (with their layout ids), lights, people, doors, screens, vehicles, other objects, plus counts, the time, the selection and the pause and camera flags.', input: {} },
  { name: 'inspect', description: 'One object in detail: transform (position, rotation in degrees, scale, world position), material, geometry, light, screen, and for a placed prop its layout fields (type, label, category, x, z, turn, height, hidden, moved, solids). Ids come from scene_tree.', input: { id: { type: 'string' } }, required: ['id'] },
  { name: 'set', description: 'Edit one field of an object. Paths: prop.x, prop.z, prop.rot (quarter turns), prop.h, prop.hidden, prop.reset (go through the layout and the save, so they persist); position.x|y|z, rotation.x|y|z (degrees), scale.x|y|z, visible, material.color, material.emissive (hex like #ff8800), any numeric material or light field (material.roughness, light.intensity), name (edit the live object only).', input: { id: { type: 'string' }, path: { type: 'string' }, value: { description: 'number, string or boolean as the field takes' } }, required: ['id', 'path', 'value'] },
  { name: 'select', description: 'Select an object (draws the selection box and fills the inspector), or clear the selection with no id.', input: { id: { type: 'string' } } },
  { name: 'frame', description: 'Fly the scene camera to an object so it fills the viewport (switches to the scene camera).', input: { id: { type: 'string' } }, required: ['id'] },
  { name: 'spawn', description: 'Place a copy of a prop definition in the scene, at x, z or ahead of the camera. Prop types come from assets. Returns the new id.', input: { type: { type: 'string' }, x: { type: 'number' }, z: { type: 'number' } }, required: ['type'] },
  { name: 'remove', description: 'Take a placed prop out of the scene and the layout.', input: { id: { type: 'string' } }, required: ['id'] },
  { name: 'camera', description: 'The viewport camera: "scene" flies freely over the running game (the editor\'s scene view), "game" is the player\'s own view.', input: { mode: { type: 'string', enum: ['scene', 'game'] } }, required: ['mode'] },
  { name: 'pause', description: 'Freeze or resume the game loop in the viewport (the scene camera still moves).', input: { on: { type: 'boolean' } }, required: ['on'] },
  { name: 'step', description: 'With the game paused, let exactly one frame through.', input: {} },
  { name: 'command', description: 'Run one of the game\'s dev commands in the viewport, as typed in the editor console (the readout lists them: cash 500, setTime 9, tp 2, 3, weather rain, and whatever the game adds).', input: { line: { type: 'string' } }, required: ['line'] },
  { name: 'assets', description: 'What the game can place and paint with: the prop definitions by catalogue group, the materials, the textures, the sounds, the people presets.', input: {} },
  { name: 'screenshot', description: 'A picture of the viewport as it is now (a JPEG). Given a file path it is also written there.', input: { file: { type: 'string', description: 'optional absolute path ending in .jpg' }, quality: { type: 'number', description: '0 to 1, default 0.85' } } },
  { name: 'console_log', description: 'The last lines of the editor console: build output, the game\'s log, errors from the viewport.', input: { n: { type: 'number', description: 'how many lines, default 60' } } },
  { name: 'undo', description: 'Undo the last editor edit in the viewport (a set, a spawn, a remove). The game\'s own play is not on the stack.', input: {} },
  { name: 'redo', description: 'Redo the last undone editor edit.', input: {} },
  { name: 'history', description: 'The undo and redo stacks as step labels, newest last.', input: {} },
  { name: 'prop_source', description: 'A prop definition: its build function\'s source, its fields (label, cat, x, z, rot, extra, price ...), its placed instances, whether a preview is in effect (and the original then), and the kit names a build function may use.', input: { type: { type: 'string', description: 'the prop definition id, as scene_tree and assets list it' } }, required: ['type'] },
  { name: 'prop_preview', description: 'Compile a new build function for a prop type and rebuild every placed copy in the viewport at once; nothing is written to disk. code is a function expression, function (c, P, inst) { ... }, using the kit (c.box, c.cyl, c.sign, c.solid, MAT, THREE, tex ...). A build that throws is refused and the previous one stays.', input: { type: { type: 'string' }, code: { type: 'string' } }, required: ['type', 'code'] },
  { name: 'prop_revert', description: 'Drop a previewed build and put the original back.', input: { type: { type: 'string' } }, required: ['type'] },
  { name: 'prop_define', description: 'Run a whole definition live: defProp(id, { label, cat, x, z, rot, build: function (c) { ... } }). A placed one (x, z, not extra) builds at once; an extra: true one joins the assets to place. A known id redefines it in place. Nothing is written until pack_save.', input: { code: { type: 'string' } }, required: ['code'] },
  { name: 'pack_save', description: 'Write code into the game\'s src/: with type, the build function replaces that prop\'s build in the part that holds it; with new: true, a whole defProp(...) is appended to the props part. The code is run in the viewport first and refused if it throws. Then call play so the built game carries it.', input: { type: { type: 'string' }, code: { type: 'string' }, new: { type: 'boolean' } }, required: ['code'] },
  { name: 'profile', description: 'The profiler: fps, frame time (avg, p95, max), the frame\'s phases (sim, world, present, ui, render) in ms, draws, triangles, programs, geometries, textures, heap, the scene counts (props, baked, dynamic, interactive, solids, lights against the budget) and the last 120 frames as samples. on: true starts sampling (call again a second later for numbers), on: false stops it.', input: { on: { type: 'boolean' } } },
  { name: 'run_script', description: 'Run one of the game\'s npm scripts (installer, brand, zip ... whatever its package.json lists besides build, check and test) and return the log. Can take minutes.', input: { name: { type: 'string' } }, required: ['name'] },
  { name: 'layout_save', description: 'Write the scene\'s layout into the game\'s src/00-layout.js now: every prop that stands away from its definition and every placed copy. The editor does this on its own a moment after each change; call it to be sure before a build or a release.', input: {} },
  { name: 'save', description: 'Save everything pending into src/: the layout, and the Pack tab\'s build code if it was edited. What Ctrl+S does in the editor.', input: {} },
  { name: 'release_preflight', description: 'What a release would do: the current version and the next patch, minor and major, the branch and remote, the uncommitted files that would go into the release commit, whether an installer script and gh exist.', input: {} },
  { name: 'release', description: 'Release the open game: set the version in package.json, write the changelog entry (title and notes), build and check, optionally build the installer and put it on the Desktop, commit everything as "Release vX.Y.Z", and with publish (the default) push, create the GitHub release with the notes and let the repo\'s workflow attach the installer. Only on the user\'s word: it commits and publishes.', input: { version: { type: 'string', description: 'three numbers, like 1.2.3' }, title: { type: 'string' }, notes: { type: 'string', description: 'Markdown, one line per change' }, publish: { type: 'boolean', description: 'default true' }, installer: { type: 'boolean' } }, required: ['version'] }
];

function post(action, args) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ action, args: args || {} });
    const req = http.request({ host: '127.0.0.1', port: PORT, path: '/editor', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }, timeout: (action === 'test' || action === 'run_script' || action === 'release') ? 900000 : 120000 }, (res) => {
      let s = ''; res.on('data', (c) => { s += c; }); res.on('end', () => { try { resolve(JSON.parse(s)); } catch (e) { reject(new Error('the editor answered with something that is not JSON: ' + s.slice(0, 200))); } });
    });
    req.on('timeout', () => { req.destroy(new Error('the editor did not answer in time')); });
    req.on('error', (e) => { reject(new Error(e.code === 'ECONNREFUSED' ? 'the Co Engine editor is not open (nothing listens on 127.0.0.1:' + PORT + '); start it and press Play' : e.message)); });
    req.end(data);
  });
}

async function call(name, args) {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) throw new Error('no such tool: ' + name);
  const r = await post(name, args);
  if (!r || r.ok === false) throw new Error(r && r.error ? r.error : 'the editor refused');
  if (name === 'screenshot') {
    const url = typeof r.result === 'string' ? r.result : '';
    const m = /^data:(image\/\w+);base64,(.+)$/.exec(url);
    if (!m) throw new Error('no picture came back' + (url ? ': ' + url.slice(0, 80) : ''));
    let note = 'the viewport, ' + Math.round(m[2].length * 0.75 / 1024) + ' KB';
    if (args && args.file) { fs.mkdirSync(path.dirname(args.file), { recursive: true }); fs.writeFileSync(args.file, Buffer.from(m[2], 'base64')); note += ', written to ' + args.file; }
    return { content: [{ type: 'text', text: note }, { type: 'image', data: m[2], mimeType: m[1] }] };
  }
  const v = r.result;
  return { content: [{ type: 'text', text: typeof v === 'string' ? v : JSON.stringify(v, null, 2) }] };
}

function toolList() {
  return TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: { type: 'object', properties: t.input, required: t.required || [], additionalProperties: false } }));
}

function reply(id, result) { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n'); }
function fail(id, code, message) { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n'); }

async function handle(msg) {
  if (!msg || msg.jsonrpc !== '2.0') return;
  const id = msg.id, m = msg.method;
  if (id === undefined || id === null) return;   // a notification (initialized, cancelled): nothing to answer
  try {
    if (m === 'initialize') return reply(id, { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'co-editor', version: VERSION }, instructions: 'The Co Engine editor. Call status first; most tools need the editor open with a game playing in its viewport. After editing a game\'s src/, call play so the viewport runs the new code. prop.* fields persist through the layout and the save; the other fields edit the live object only.' });
    if (m === 'ping') return reply(id, {});
    if (m === 'tools/list') return reply(id, { tools: toolList() });
    if (m === 'tools/call') {
      const p = msg.params || {};
      try { return reply(id, await call(p.name, p.arguments || {})); }
      catch (e) { return reply(id, { content: [{ type: 'text', text: e.message }], isError: true }); }
    }
    if (m === 'resources/list') return reply(id, { resources: [] });
    if (m === 'prompts/list') return reply(id, { prompts: [] });
    return fail(id, -32601, 'method not found: ' + m);
  } catch (e) { return fail(id, -32603, e.message); }
}

if (require.main === module) {
  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  rl.on('line', (line) => { line = line.trim(); if (!line) return; let msg; try { msg = JSON.parse(line); } catch (e) { fail(null, -32700, 'parse error'); return; } handle(msg); });
  rl.on('close', () => process.exit(0));
}

module.exports = { TOOLS, toolList, call, post };
