//@ Co Engine, part 50: the dev link. The game side of the editor and the dev console: a readout out, commands in, over 127.0.0.1.
  // ── The dev link ──────────────────────────────────────────────────
  // The editor (and the dev console) run a local server on 127.0.0.1:8432. The game links to it with Ctrl+Shift+D, when started
  // with ?dev=1, or, in the desktop app, by itself: every five seconds while unlinked it asks the port once and links when
  // something answers. While linked it posts a readout once a second and takes commands over a server-sent event stream; every
  // command goes through devCommand, the same code the tests call. The HUD element h-devlink shows LINKED.
  var DEV_PORT = 8432, devLink = { on: false, es: null, t: 0, sent: 0, got: 0, fails: 0, last: '', manualOff: false, probeT: 0 };
  var DEV_AUTO = /Electron/i.test(navigator.userAgent);
  function devProbe() {
    try { var opt = { mode: 'cors', cache: 'no-store' }; if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) opt.signal = AbortSignal.timeout(800);
      fetch('http://127.0.0.1:' + DEV_PORT + '/state', opt).then(function (r) { if (r.ok && !devLink.on && !devLink.manualOff) devLinkToggle(); }).catch(function () {}); } catch (e) {}
  }
  // the readout: the engine's fields, then whatever the game adds in CO.game.devState()
  function devState() {
    var st = { version: CO.gameVersion || 'dev', engine: CO.version, day: S && S.day, time: S ? Math.round((S.time || 0) * 100) / 100 : 0, clock: fmtTime(S && S.time || 0), bank: S && S.bank, level: S && S.level, weather: S && S.weather ? S.weather.kind : 'clear', player: player ? { x: Math.round(player.x * 10) / 10, z: Math.round(player.z * 10) / 10 } : null, commands: devCommandList() };
    if (CO.game && CO.game.devState) { var extra = CO.game.devState(); for (var k in extra) st[k] = extra[k]; }
    return st;
  }
  // the commands: the engine's base set, and the game's in CO.game.commands as { name: function (arg) { return 'what happened'; } }
  var DEV_COMMANDS = {
    cash: function (n) { pay(typeof n === 'number' ? n : 1000, 'Dev console'); return 'bank ' + money(S.bank); },
    setTime: function (h) { if (typeof h === 'number') { S.time = ((h % 24) + 24) % 24; hudDirty = true; return 'time ' + fmtTime(S.time); } return 'setTime needs an hour'; },
    saveNow: function () { save(); return 'saved to ' + SAVE; },
    reload: function () { save(); setTimeout(function () { location.reload(); }, 200); return 'reloading'; },
    tp: function (arg) { if (!player) return 'no player'; var m = /^(-?[\d.]+)[ ,]+(-?[\d.]+)$/.exec(String(arg || '')); if (!m) return 'tp needs "x, z"'; player.x = +m[1]; player.z = +m[2]; player.y = floorY(player.x, player.z); return 'at ' + player.x + ', ' + player.z; },
    weather: function (kind) { if (!S.weather) S.weather = { wet: 0, snow: 0, wind: 0.4 }; S.weather.kind = kind || 'clear'; S.weather.until = nowAbs() + 6; return 'weather ' + S.weather.kind; }
  };
  function devCommandList() { var out = Object.keys(DEV_COMMANDS); if (CO.game && CO.game.commands) for (var k in CO.game.commands) if (out.indexOf(k) < 0) out.push(k); return out; }
  function devCommand(name, arg) {
    var fn = (CO.game && CO.game.commands && CO.game.commands[name]) || DEV_COMMANDS[name];
    if (!fn) return 'unknown command ' + name;
    try { var r = fn(arg); hudDirty = true; return r === undefined ? 'ok' : String(r); } catch (e) { return 'error: ' + (e && e.message || e); }
  }
  function devLinkBadge() { var b = $('h-devlink'); if (!b) return; b.hidden = !devLink.on; b.textContent = devLink.on ? (devLink.es && devLink.es.readyState === 1 ? 'LINKED · editor' : 'LINKING...') : ''; }
  function devLinkToggle() {
    if (devLink.on) { devLink.manualOff = true; devLinkStop('Editor unlinked. Ctrl+Shift+D links again.'); return; }
    devLink.manualOff = false;
    if (typeof EventSource === 'undefined') { toast('No EventSource in this browser: the editor cannot link.', 'bad'); return; }
    devLink.on = true; devLink.fails = 0;
    try { var es = new EventSource('http://127.0.0.1:' + DEV_PORT + '/events'); devLink.es = es;
      es.onopen = function () { devLink.fails = 0; devLinkBadge(); toast('Editor linked', 'good'); };
      es.onmessage = function (ev) { var cmd; try { cmd = JSON.parse(ev.data); } catch (e) { return; } if (!cmd || !cmd.name) return; devLink.got++; var res = devCommand(cmd.name, cmd.arg); devLink.last = cmd.name + ': ' + res; devPost('/result', { id: cmd.id, name: cmd.name, result: res }); };
      es.onerror = function () { devLink.fails++; devLinkBadge(); if (devLink.fails === 1) toast('Nothing answering on 127.0.0.1:' + DEV_PORT + '. Open the editor; the game keeps trying.', ''); if (devLink.fails > 30) devLinkStop('Editor link: gave up after 30 tries'); };
    } catch (e) { devLinkStop('Editor link: could not open'); return; }
    devLinkBadge(); logEvent('Editor link opened. Ctrl+Shift+D unlinks.');
  }
  function devLinkStop(why) { if (devLink.es) { try { devLink.es.close(); } catch (e) {} } devLink.es = null; devLink.on = false; devLinkBadge(); if (why) toast(why, ''); }
  function devPost(path, body) { try { fetch('http://127.0.0.1:' + DEV_PORT + path, { method: 'POST', mode: 'cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true }).then(function () { devLink.sent++; }).catch(function () {}); } catch (e) {} }
  function tickDevLink(dt) {
    if (!devLink.on) { if (!DEV_AUTO || devLink.manualOff || ui.testing) return; devLink.probeT += dt; if (devLink.probeT < 5) return; devLink.probeT = 0; devProbe(); return; }
    devLink.t += dt; if (devLink.t < 1) return; devLink.t = 0; if (devLink.es && devLink.es.readyState === 1) devPost('/state', devState());
  }
