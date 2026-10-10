//@ Co Engine, part 47: NPCs as data. CO.npcs({ characters, spawners, workers, spots }) describes the people of a game and what they do, step by step: a customer who parks, walks to the desk, talks and leaves; a worker who keeps a counter through the day. The editor's NPCs tab edits it and writes src/00-npcs.js; a game hears what they do through the 'npc' hook and GAME.npcEvent(name, npc).
  // ── NPCs as data ──────────────────────────────────────────────────
  // characters: { id: { names: ['Sam', 'Alex'], look: { shirt, pants, skin, hair, style }, speed, car, steps: [...] } }
  // spawners:   [{ id, character, x, z, every, max, hours: [from, to], park: [x, z], on }]    car: arrives at x, z and parks at park
  // workers:    [{ id, character, x, z, ry, home: [x, z], hours: [from, to] }]                  stands at x, z through the hours
  // spots:      { name: { x, z, ry } }                                                         places the steps go to
  // A step is { do, ... }:
  //   walk { to }        to a spot's name, 'x, z', 'player', 'home' (where it came from), 'car' or 'post' (a worker's place)
  //   say { text, wait } a speech bubble ({name} is the NPC's name); wait is how long it stands for it (it reads its length)
  //   wait { seconds }   wander { radius, seconds }   face { to }   mood { mood: happy, sad, angry, talk, neutral }
  //   talk { prompt, text, choices: [{ label, say, run, then }] }   waits for the player to press E on it, then offers the
  //                      choices in a panel; then is next (the default), stay, leave, repeat or 'step 3'
  //   until { test, every }   waits for an expression over the kit to come true (npc is the NPC: npc.data, npc.name)
  //   run { code }       a dev command (cash 50) or code over the kit, with npc
  //   event { name }     tells the game: runHooks('npc', name, npc) and GAME.npcEvent(name, npc)
  //   leave              back to the car or the way it came, and gone        repeat   from the first step again   goto { step }
  // A worker runs its character's steps over and over while its hours last, then goes home. An NPC is not saved: spawners and
  // workers make them again from the data when the game loads.
  var NPCS = { characters: {}, spawners: [], workers: [], spots: {} }, npcList = [], npcSeq = 0, npcTimers = {};
  var NPC_COLS = { shirt: 0x3f6a9e, pants: 0x2f3440 };
  CO.npcs = function (data) {
    if (data === undefined) return npcData();
    data = JSON.parse(JSON.stringify(data || {}));
    NPCS = { characters: data.characters || {}, spawners: data.spawners || [], workers: data.workers || [], spots: data.spots || {} };
    npcClear(); npcTimers = {}; return npcData();
  };
  function npcData() { return JSON.parse(JSON.stringify(NPCS)); }
  function npcCode() {
    if (!Object.keys(NPCS.characters).length && !NPCS.spawners.length && !NPCS.workers.length && !Object.keys(NPCS.spots).length) return '';
    return '//@ the NPCs the editor saved: characters and what they do, their spawners, the workers and the spots they go to, as data. Written by the Co Engine editor; it sorts first in src/. Edit it in the editor rather than here.\n  CO.npcs(' + JSON.stringify(NPCS, null, 2).replace(/\n/g, '\n  ') + ');\n';
  }
  function npcClear() { npcList.slice().forEach(function (n) { npcRemove(n); }); npcList = []; }
  function npcHex(v, d) { if (typeof v === 'number') return v; var m = /^#?([0-9a-f]{6})$/i.exec(String(v || '')); return m ? parseInt(m[1], 16) : d; }
  function npcHour() { return S && typeof S.time === 'number' ? S.time : null; }
  function npcInHours(h) { if (!h || h.length !== 2) return true; var t = npcHour(); if (t === null) return true; return h[0] <= h[1] ? t >= h[0] && t < h[1] : t >= h[0] || t < h[1]; }
  function npcPoint(n, to) {
    to = String(to === undefined ? '' : to).trim();
    if (to === 'player' && player) return { x: player.x, z: player.z };
    if (to === 'home') return { x: n.home.x, z: n.home.z };
    if (to === 'post' && n.post) return { x: n.post.x, z: n.post.z, ry: n.post.ry };
    if (to === 'car' && n.car) return { x: n.carDoor.x, z: n.carDoor.z };
    var sp = NPCS.spots[to]; if (sp) return { x: +sp.x || 0, z: +sp.z || 0, ry: sp.ry };
    var m = /^(-?[\d.]+)\s*[, ]\s*(-?[\d.]+)$/.exec(to); if (m) return { x: +m[1], z: +m[2] };
    if (to.indexOf('prop:') === 0 && typeof propPlacement === 'function') { var pp = propPlacement(to.slice(5)); if (pp) { var w = propWorld(to.slice(5), 0, 1.2); return { x: w.x, z: w.z }; } }
    return null;
  }
  function npcSay(n, text) { var t = String(text || '').replace(/\{name\}/g, n.name); say(n.g, t); runHooks('npcSay', n.pub, t); return t; }
  function npcRun(n, code) {
    code = String(code || '').trim(); if (!code) return;
    var sp = code.indexOf(' '), name = sp < 0 ? code : code.slice(0, sp), arg = sp < 0 ? undefined : code.slice(sp + 1).trim();
    if (devCommandList().indexOf(name) >= 0) { if (arg !== undefined && arg !== '' && !isNaN(arg)) arg = +arg; var r = devCommand(name, arg); hudDirty = true; return r; }
    try { new Function('K', 'npc', 'with (K) { ' + code + '\n }')(editorKit(), n.pub); hudDirty = true; } catch (e) { toast(n.name + ': ' + e.message, 'bad'); }
  }
  function npcTest(n, expr) { try { return !!new Function('K', 'npc', 'with (K) { return (' + expr + '\n); }')(editorKit(), n.pub); } catch (e) { return false; } }
  // a person in the world with its own record: where it is, the step it is on, what it waits for
  function npcMake(charId, at, opt) {
    var ch = NPCS.characters[charId]; if (!ch) return null; opt = opt || {};
    var look = ch.look || {}, names = (ch.names && ch.names.length ? ch.names : [charId]), name = opt.name || names[Math.floor(Math.random() * names.length)];
    var hopt = { key: charId + ':' + name + ':' + (++npcSeq) };
    if (look.skin) hopt.skin = npcHex(look.skin); if (look.hair) hopt.hair = npcHex(look.hair); if (look.style) hopt.style = look.style;
    if (look.shirt) hopt.shirt = std({ map: TEX.cloth, color: npcHex(look.shirt, NPC_COLS.shirt), roughness: 0.92 }); if (look.pants) hopt.pants = std({ map: TEX.cloth, color: npcHex(look.pants, NPC_COLS.pants), roughness: 0.95 });
    var g = makeHuman(hopt); g.userData.dynamic = true; g.userData.npc = true; scene.add(g);
    var n = { id: 'npc' + npcSeq, ch: ch, charId: charId, name: name, g: g, x: at.x, z: at.z, yaw: at.ry || 0, path: null, speed: ch.speed || 1.4, step: 0, t: 0, state: 'start', talkOpen: false, home: { x: at.x, z: at.z }, data: {}, spawner: opt.spawner || null, worker: opt.worker || null, post: opt.post || null, car: null, carDoor: null, gone: false };
    n.pub = { id: n.id, name: name, character: charId, data: n.data, get x() { return n.x; }, get z() { return n.z; }, get step() { return n.step; }, say: function (t) { return npcSay(n, t); }, leave: function () { npcLeave(n); }, go: function (i) { npcGoto(n, i); }, next: function () { npcNext(n); } };
    n.hit = hitBox(0.8, 1.9, 0.8, 0, 0.95, 0, { prompt: function () { var st = npcStepNow(n); return st && st.do === 'talk' && n.state === 'talk' ? String(st.prompt || 'Talk to {name}').replace(/\{name\}/g, n.name) : ''; }, use: function () { npcTalk(n); } }, g);
    npcList.push(n); npcPlace(n); runHooks('npcSpawn', n.pub); return n;
  }
  function npcPlace(n) { n.g.position.set(n.x, floorY(n.x, n.z), n.z); n.g.rotation.y = n.yaw; }
  function npcRemove(n) {
    n.gone = true; if (n.talkOpen && ui.panelOpen && panel.kind === 'npc') closePanel();
    var k = inter.indexOf(n.hit); if (k >= 0) inter.splice(k, 1); scene.remove(n.g);
    if (n.car) { scene.remove(n.car.g); var tk = traffic.cars.indexOf(n.car.rec); if (tk >= 0) traffic.cars.splice(tk, 1); }
    var i = npcList.indexOf(n); if (i >= 0) npcList.splice(i, 1); runHooks('npcGone', n.pub);
  }
  function npcStepNow(n) { var steps = n.ch.steps || []; return steps[n.step] || null; }
  function npcNext(n) { n.step++; n.state = 'start'; n.t = 0; n.path = null; }
  function npcGoto(n, i) { n.step = Math.max(0, i | 0); n.state = 'start'; n.t = 0; n.path = null; }
  function npcLeave(n) { n.leaving = true; n.state = 'start'; n.path = null; n.t = 0; }
  // the route finder where its grid covers both ends; outside it a straight walk; either way the walk ends on the point itself
  function npcOnGrid(q) { if (NAV.dirty || !NAV.grid) navBuild(); return !!NAV.grid && q.x >= NAV.x0 && q.z >= NAV.z0 && q.x < NAV.x0 + NAV.w * NAV.cell && q.z < NAV.z0 + NAV.h * NAV.cell; }
  function npcWalkTo(n, p) { var path = npcOnGrid(n) && npcOnGrid(p) ? route({ x: n.x, z: n.z }, { x: p.x, z: p.z }) : null; if (!path || !path.length) path = [{ x: p.x, z: p.z }]; else { var last = path[path.length - 1]; if (Math.hypot(last.x - p.x, last.z - p.z) > 0.5) path.push({ x: p.x, z: p.z }); } n.path = path; n.faceTo = p.ry; }
  // the player pressed E on an NPC at a talk step: its words and the choices, in a panel
  function npcTalk(n) { var st = npcStepNow(n); if (!st || st.do !== 'talk') return; n.talkOpen = true; NPC_PANEL.n = n; n.yaw = Math.atan2(player.x - n.x, player.z - n.z); setMood(n.g, 'talk'); openPanel('npc'); }
  var NPC_PANEL = { n: null };
  function npcPanelSpec() {
    var n = NPC_PANEL.n, st = n && npcStepNow(n); if (!n || !st) return { title: '', tabs: [], body: '' };
    var choices = st.choices && st.choices.length ? st.choices : [{ label: 'OK' }];
    return { title: n.name, tabs: [], body: '<div class="dc-how">' + uiTextHtml(String(st.text || '').replace(/\{name\}/g, n.name)) + '</div><div class="dc-menu-row" style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">' + choices.map(function (c, i) { return '<button class="dc-btn' + (i === 0 ? ' primary' : '') + '" data-act="npc" data-arg="' + i + '">' + esc(c.label || 'OK') + '</button>'; }).join('') + '</div>' };
  }
  function npcChoice(i) {
    var n = NPC_PANEL.n, st = n && npcStepNow(n); if (!n || !st) { closePanel(); return true; }
    var c = (st.choices && st.choices[+i]) || {}; n.talkOpen = false; NPC_PANEL.n = null; closePanel();
    if (c.say) npcSay(n, c.say); if (c.run) npcRun(n, c.run);
    runHooks('npc', 'choice', n.pub, c.label); if (CO.game && CO.game.npcEvent) CO.game.npcEvent('choice', n.pub, c.label);
    var then = String(c.then || 'next').trim();
    if (then === 'stay') n.state = 'talk'; else if (then === 'leave') npcLeave(n); else if (then === 'repeat') npcGoto(n, 0); else if (/^step\s+\d+$/.test(then)) npcGoto(n, +then.slice(5) - 1); else npcNext(n);
    return true;
  }
  // one NPC, one frame: its car, its walk, the step it is on
  function npcTick(n, dt) {
    if (n.car && n.car.moving) { npcCarTick(n, dt); return; }
    var moving = false;
    if (n.path && n.path.length) { var done = walkAlong(n, n.path, n.speed, dt); moving = !done; if (done) { n.path = null; if (typeof n.faceTo === 'number') n.yaw = n.faceTo; } }
    npcPlace(n); animateHuman(n.g, dt, moving ? 'walk' : 'idle', n.speed);
    if (moving) return;
    if (n.leaving) { npcLeaveTick(n, dt); return; }
    var st = npcStepNow(n);
    if (!st) { if (n.worker) { npcGoto(n, 0); return; } npcLeave(n); return; }
    if (n.worker && !npcInHours(n.worker.hours) && st.do !== 'talk') { npcLeave(n); return; }
    var first = n.state === 'start'; if (first) { n.state = 'run'; n.t = 0; } n.t += dt;
    switch (st.do) {
      case 'walk': if (first) { var p = npcPoint(n, st.to); if (p) npcWalkTo(n, p); else npcNext(n); } else npcNext(n); break;
      case 'say': if (first) { var t = npcSay(n, st.text); n.wait = st.wait !== undefined ? +st.wait : 1.2 + t.length * 0.05; } else if (n.t >= n.wait) npcNext(n); break;
      case 'wait': if (n.t >= (+st.seconds || 1)) npcNext(n); break;
      case 'wander': if (first) { n.wanderAt = { x: n.x, z: n.z }; n.wanderT = 0; } if (n.t >= (+st.seconds || 10)) { npcNext(n); break; } n.wanderT -= dt; if (n.wanderT <= 0) { var r = +st.radius || 3, a = Math.random() * Math.PI * 2, d = Math.random() * r; npcWalkTo(n, { x: n.wanderAt.x + Math.cos(a) * d, z: n.wanderAt.z + Math.sin(a) * d }); n.wanderT = randf(2, 5); } break;
      case 'face': var fp = npcPoint(n, st.to); if (fp) n.yaw = Math.atan2(fp.x - n.x, fp.z - n.z); else if (typeof st.ry === 'number') n.yaw = st.ry; npcNext(n); break;
      case 'mood': setMood(n.g, st.mood || 'neutral'); npcNext(n); break;
      case 'talk': if (first) n.state = 'talk'; else n.state = 'talk'; break;
      case 'until': if (!n.untilT || n.untilT <= 0) { n.untilT = +st.every || 0.5; if (npcTest(n, st.test || 'true')) npcNext(n); } else n.untilT -= dt; break;
      case 'run': npcRun(n, st.code); npcNext(n); break;
      case 'event': runHooks('npc', st.name || 'event', n.pub); if (CO.game && CO.game.npcEvent) CO.game.npcEvent(st.name || 'event', n.pub); npcNext(n); break;
      case 'leave': npcLeave(n); break;
      case 'repeat': npcGoto(n, 0); break;
      case 'goto': npcGoto(n, (+st.step || 1) - 1); break;
      default: npcNext(n);
    }
  }
  // leaving: walk back to the car and drive off, or walk back the way it came, and go
  function npcLeaveTick(n, dt) {
    if (n.state === 'start') { n.state = 'walking'; var p = n.car ? n.carDoor : n.home; npcWalkTo(n, p); return; }
    if (n.car) { n.g.visible = false; n.car.moving = true; n.car.back = true; n.car.i = n.car.path.length - 1; return; }
    npcRemove(n);
  }
  // a car that brings its NPC: from the spawner along to its parking place, then the NPC gets out; leaving reverses it
  function npcCarStart(n, sp) {
    var path = [{ x: +sp.x, z: +sp.z }].concat((sp.via || []).map(function (q) { return { x: +q[0], z: +q[1] }; })).concat([{ x: +sp.park[0], z: +sp.park[1] }]);
    var g = carMesh(); g.userData.dynamic = true; scene.add(g); var rec = { g: g, npc: true, road: true, dir: 1, z: 0, v: 0 }; traffic.cars.push(rec);
    var c = { g: g, rec: rec, path: path, i: 0, x: path[0].x, z: path[0].z, yaw: 0, v: 0, moving: true, back: false };
    var a = path[path.length - 2] || path[0], b = path[path.length - 1], yaw = Math.atan2(-(b.z - a.z), b.x - a.x);
    n.car = c; n.carDoor = { x: b.x - Math.sin(yaw) * 1.6, z: b.z - Math.cos(yaw) * 1.6 };   // the driver's side: to the left of the way the car faces
    n.g.visible = false; npcCarPlace(c);
  }
  function npcCarPlace(c) { c.g.position.set(c.x, floorY(c.x, c.z), c.z); c.g.rotation.y = c.yaw; }
  function npcCarTick(n, dt) {
    var c = n.car, tgt = c.back ? c.path[c.i - 1] : c.path[c.i + 1];
    if (!tgt) { c.moving = false; if (c.back) { npcRemove(n); return; } n.x = n.carDoor.x; n.z = n.carDoor.z; n.g.visible = true; npcPlace(n); return; }
    var dx = tgt.x - c.x, dz = tgt.z - c.z, d = Math.hypot(dx, dz), last = c.back ? c.i - 1 === 0 : c.i + 1 === c.path.length - 1, want = last && !c.back ? Math.min(7, Math.max(1.2, d * 0.9)) : 7;
    c.v += clamp(want - c.v, -6 * dt, 3 * dt); var step = c.v * dt;
    var yaw = Math.atan2(-dz, dx); c.yaw = c.yaw + Math.atan2(Math.sin(yaw - c.yaw), Math.cos(yaw - c.yaw)) * Math.min(1, dt * 4);   // leaving, it turns round as it pulls away
    if (d <= step) { c.x = tgt.x; c.z = tgt.z; c.i += c.back ? -1 : 1; } else { c.x += dx / d * step; c.z += dz / d * step; }
    npcCarPlace(c); var ws = c.g.userData.wheels; if (ws) ws.forEach(function (w) { w.rotation.z -= c.v * dt / 0.33; });
  }
  function npcSpawn(sp) {
    var at = { x: +sp.x || 0, z: +sp.z || 0, ry: sp.ry || 0 }, ch = NPCS.characters[sp.character]; if (!ch) return null;
    var n = npcMake(sp.character, at, { spawner: sp }); if (!n) return null;
    if (ch.car && sp.park) npcCarStart(n, sp);
    return n;
  }
  function npcWorkerStart(w) {
    var home = w.home ? { x: +w.home[0], z: +w.home[1] } : { x: +w.x, z: +w.z }, inside = !w.hours;
    var n = npcMake(w.character, inside ? { x: +w.x, z: +w.z, ry: w.ry || 0 } : { x: home.x, z: home.z }, { worker: w, post: { x: +w.x, z: +w.z, ry: w.ry || 0 }, name: w.name });
    if (!n) return null; n.home = home; if (!inside) npcWalkTo(n, n.post); return n;
  }
  // the frame: spawners make NPCs on their clock and inside their hours, workers come and go with theirs, every NPC steps
  function npcsTick(dt) {
    if (!ui.started) return;
    NPCS.spawners.forEach(function (sp, i) {
      if (sp.on === false) return; var key = sp.id || 'sp' + i, mine = npcList.filter(function (n) { return n.spawner === sp; }).length;
      if (!npcInHours(sp.hours) || mine >= (sp.max === undefined ? 1 : +sp.max)) return;
      npcTimers[key] = (npcTimers[key] === undefined ? Math.min(3, +sp.every || 30) : npcTimers[key]) - dt;
      if (npcTimers[key] <= 0) { npcTimers[key] = Math.max(1, +sp.every || 30); npcSpawn(sp); }
    });
    NPCS.workers.forEach(function (w) { var have = npcList.some(function (n) { return n.worker === w; }); if (!have && npcInHours(w.hours) && !w.off) npcWorkerStart(w); });
    npcList.slice().forEach(function (n) { if (!n.gone) npcTick(n, dt); });
  }
  // the editor's way to look: one NPC now from a spawner, a character at a point, or what each NPC is doing
  function npcSpawnNow(ref) {
    if (typeof ref === 'string' && /^\d+$/.test(ref)) ref = +ref;
    var sp = typeof ref === 'number' ? NPCS.spawners[ref] : NPCS.spawners.filter(function (s) { return s.id === ref; })[0];
    if (sp) { var n = npcSpawn(sp); return n ? n.pub.id : null; }
    if (NPCS.characters[ref]) { var a = aheadPoint(4); var m = npcMake(ref, { x: a.x, z: a.z }); return m ? m.pub.id : null; }
    return null;
  }
  function npcInfo() { return npcList.map(function (n) { var st = npcStepNow(n); return { id: n.id, name: n.name, character: n.charId, x: Math.round(n.x * 10) / 10, z: Math.round(n.z * 10) / 10, step: n.step + 1, doing: n.leaving ? 'leave' : n.car && n.car.moving ? 'drive' : st ? st.do : 'done', state: n.state, worker: !!n.worker }; }); }
  function npcAim() { var a = aheadPoint(6); return { x: Math.round(a.x * 10) / 10, z: Math.round(a.z * 10) / 10, ry: Math.round(camera.rotation.y * 100) / 100 }; }
