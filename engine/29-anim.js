//@ Co Engine, part 29: the animation timeline. Clips are data: named tracks of keys on paths into an object (a prop's parts, a person's limbs), played by the engine each frame with easing, loops, speed, a blend in, and events. CO.clip(name, clip) registers one (a game's src/00-clips.js, written by the editor); playClip(obj, name, opt) runs it. The people rig takes clips over its own limb motion while one plays.
  // ── Clips ─────────────────────────────────────────────────────────
  // A clip: { duration, loop, tracks: [{ path, keys: [[t, value, ease]] }], events: [[t, name]] }. A path names a node and a field:
  // 'rotation.x' on the object itself, 'child.2.position.y' the third child, 'name.lamp.rotation.z' a named descendant, and on a
  // person 'leg.0', 'knee.1', 'arm.0', 'elbow.1', 'torso', 'head' (the rig's parts). Values are numbers; ease is 'linear', 'smooth',
  // 'in', 'out' or 'step'. Times are seconds.
  var CLIPS = {}, CLIP_ORDER = [], playing = [];
  CO.clip = function (name, clip) { if (!name) return CLIPS; if (clip === null) { delete CLIPS[name]; CLIP_ORDER.splice(CLIP_ORDER.indexOf(name), 1); return null; } clip = JSON.parse(JSON.stringify(clip || {})); clip.duration = clip.duration || clipLength(clip); if (!clip.tracks) clip.tracks = []; if (!CLIPS[name]) CLIP_ORDER.push(name); CLIPS[name] = clip; return clip; };
  function clipLength(c) { var d = 0; (c.tracks || []).forEach(function (t) { (t.keys || []).forEach(function (k) { d = Math.max(d, k[0]); }); }); (c.events || []).forEach(function (e) { d = Math.max(d, e[0]); }); return d || 1; }
  function easeV(k, f) { if (k === 'step') return 0; if (k === 'in') return f * f; if (k === 'out') return 1 - (1 - f) * (1 - f); if (k === 'linear') return f; return f * f * (3 - 2 * f); }
  function trackValue(keys, t) {
    if (!keys || !keys.length) return undefined; if (t <= keys[0][0]) return keys[0][1]; var last = keys[keys.length - 1]; if (t >= last[0]) return last[1];
    for (var i = 0; i < keys.length - 1; i++) { var a = keys[i], b = keys[i + 1]; if (t >= a[0] && t <= b[0]) { var f = b[0] === a[0] ? 1 : (t - a[0]) / (b[0] - a[0]); return a[1] + (b[1] - a[1]) * easeV(b[2] || 'smooth', f); } }
    return last[1];
  }
  // the node and field a path names, on an object (a person's parts come from the rig's userData)
  function clipTarget(obj, path) {
    var p = String(path).split('.'), node = obj, u = obj.userData || {}, i = 0;
    if (p[0] === 'child') { node = obj.children[+p[1]]; i = 2; }
    else if (p[0] === 'name') { node = obj.getObjectByName(p[1]); i = 2; }
    else if (p[0] === 'leg' && u.legs) { node = u.legs[+p[1]]; i = 2; }
    else if (p[0] === 'knee' && u.legs) { node = u.legs[+p[1]] && u.legs[+p[1]].userData.knee; i = 2; }
    else if (p[0] === 'arm' && u.arms) { node = u.arms[+p[1]]; i = 2; }
    else if (p[0] === 'elbow' && u.arms) { node = u.arms[+p[1]] && u.arms[+p[1]].userData.elbow; i = 2; }
    else if (p[0] === 'torso' && u.torso) { node = u.torso; i = 1; }
    else if (p[0] === 'head' && u.head) { node = u.head; i = 1; }
    if (!node) return null; var prop = p[i], axis = p[i + 1];
    if (prop === 'visible' || prop === 'intensity' || prop === 'opacity') return { node: node, set: function (v) { if (prop === 'opacity' && node.material) { node.material.opacity = v; node.material.transparent = v < 1; } else node[prop] = prop === 'visible' ? v >= 0.5 : v; }, get: function () { return prop === 'opacity' && node.material ? node.material.opacity : (prop === 'visible' ? (node.visible ? 1 : 0) : node[prop]); } };
    if (!node[prop] || axis === undefined) return null;
    return { node: node, set: function (v) { node[prop][axis] = v; }, get: function () { return node[prop][axis]; } };
  }
  // play a clip on an object: it joins the playing list and the frame drives it; a second play on the same object replaces the first
  function playClip(obj, name, opt) {
    var clip = CLIPS[name]; if (!clip || !obj) return null; opt = opt || {};
    stopClip(obj);
    var tracks = clip.tracks.map(function (t) { var tg = clipTarget(obj, t.path); return tg ? { keys: t.keys, tg: tg, from: tg.get() } : null; }).filter(Boolean);
    var P = { obj: obj, name: name, clip: clip, t: 0, speed: opt.speed || 1, loop: opt.loop !== undefined ? !!opt.loop : !!clip.loop, blend: opt.blend === undefined ? 0.2 : +opt.blend, tracks: tracks, fired: {}, done: false, onDone: opt.onDone || null, hold: opt.hold !== false };
    playing.push(P); if (obj.userData) obj.userData.clip = P; return P;
  }
  function stopClip(obj) { for (var i = playing.length - 1; i >= 0; i--) if (playing[i].obj === obj) { playing[i].done = true; playing.splice(i, 1); } if (obj && obj.userData) obj.userData.clip = null; }
  function clipTick(dt) {
    for (var i = playing.length - 1; i >= 0; i--) {
      var P = playing[i], c = P.clip; P.t += dt * P.speed; var t = P.t, over = t >= c.duration;
      if (over) { if (P.loop) { t = P.t = c.duration ? P.t % c.duration : 0; P.fired = {}; } else t = c.duration; }
      var w = P.blend > 0 ? Math.min(1, P.t / P.blend) : 1;
      P.tracks.forEach(function (tr) { var v = trackValue(tr.keys, t); if (v === undefined) return; tr.tg.set(w < 1 ? tr.from + (v - tr.from) * w : v); });
      (c.events || []).forEach(function (e) { if (!P.fired[e[0] + ':' + e[1]] && t >= e[0]) { P.fired[e[0] + ':' + e[1]] = true; runHooks('clipEvent', P.obj, e[1], P); } });
      if (over && !P.loop) { P.done = true; playing.splice(i, 1); if (P.obj.userData) P.obj.userData.clip = null; if (!P.hold) P.tracks.forEach(function (tr) { tr.tg.set(tr.from); }); if (P.onDone) P.onDone(P); }
    }
  }
  animate(clipTick);
  // what the editor reads and writes
  function clipList() { return { order: CLIP_ORDER.slice(), clips: JSON.parse(JSON.stringify(CLIPS)), playing: playing.map(function (P) { return { name: P.name, t: Math.round(P.t * 100) / 100, loop: P.loop, obj: P.obj.userData && (P.obj.userData.propId || P.obj.userData.eid) || P.obj.name || null }; }) }; }
  function clipCode() {
    if (!CLIP_ORDER.length) return '';
    var lines = ['//@ the clips the editor saved: animation as data, played by the engine. Written by the Co Engine editor; it sorts first in src/ so a game can play them from its first frame. Edit them in the editor rather than here.'];
    CLIP_ORDER.forEach(function (n) { if (BUILTIN_CLIPS[n] && JSON.stringify(BUILTIN_CLIPS[n]) === JSON.stringify(CLIPS[n])) return; lines.push('  CO.clip(' + JSON.stringify(n) + ', ' + JSON.stringify(CLIPS[n]) + ');'); });
    if (lines.length === 1) return ''; lines.push(''); return lines.join('\n');
  }
  // a pose from the current transforms of the paths a clip names: a key at time t for every track
  function clipKeyPose(obj, name, t, ease) { var c = CLIPS[name]; if (!c) return null; var n = 0; c.tracks.forEach(function (tr) { var tg = clipTarget(obj, tr.path); if (!tg) return; var v = Math.round(tg.get() * 1000) / 1000, keys = tr.keys || (tr.keys = []), at = keys.findIndex(function (k) { return Math.abs(k[0] - t) < 1e-6; }); if (at >= 0) keys[at] = [t, v, ease || keys[at][2]]; else { keys.push([t, v, ease || 'smooth']); keys.sort(function (a, b) { return a[0] - b[0]; }); } n++; }); c.duration = Math.max(c.duration || 0, t); return n; }
  // the clips every game starts with: a person's gestures, and a few for props
  var BUILTIN_CLIPS = {
    wave: { duration: 1.6, loop: false, tracks: [{ path: 'arm.1.rotation.x', keys: [[0, -0.2], [0.3, -2.6], [1.3, -2.6], [1.6, -0.2]] }, { path: 'elbow.1.rotation.x', keys: [[0, -0.15], [0.3, -0.6], [0.55, -1.2], [0.8, -0.5], [1.05, -1.2], [1.3, -0.6], [1.6, -0.15]] }, { path: 'arm.1.rotation.z', keys: [[0, -0.1], [0.3, -0.5], [1.3, -0.5], [1.6, -0.1]] }] },
    nod: { duration: 0.9, loop: false, tracks: [{ path: 'head.rotation.x', keys: [[0, 0], [0.25, 0.35], [0.5, -0.05], [0.7, 0.3], [0.9, 0]] }] },
    cheer: { duration: 1.4, loop: false, tracks: [{ path: 'arm.0.rotation.x', keys: [[0, -0.2], [0.35, -2.9], [1.0, -2.9], [1.4, -0.2]] }, { path: 'arm.1.rotation.x', keys: [[0, -0.2], [0.35, -2.9], [1.0, -2.9], [1.4, -0.2]] }, { path: 'torso.position.y', keys: [[0, 0.86], [0.35, 0.92], [0.5, 0.86], [0.7, 0.92], [0.9, 0.86]] }] },
    point: { duration: 1.2, loop: false, tracks: [{ path: 'arm.1.rotation.x', keys: [[0, -0.2], [0.3, -1.5], [1.0, -1.5], [1.2, -0.2]] }, { path: 'elbow.1.rotation.x', keys: [[0, -0.15], [0.3, -0.05], [1.0, -0.05], [1.2, -0.15]] }, { path: 'head.rotation.y', keys: [[0, 0], [0.3, -0.3], [1.0, -0.3], [1.2, 0]] }] },
    lift: { duration: 1.6, loop: false, tracks: [{ path: 'torso.position.y', keys: [[0, 0.86], [0.5, 0.62], [1.1, 0.62], [1.6, 0.86]] }, { path: 'knee.0.rotation.x', keys: [[0, 0], [0.5, 1.2], [1.1, 1.2], [1.6, 0]] }, { path: 'knee.1.rotation.x', keys: [[0, 0], [0.5, 1.2], [1.1, 1.2], [1.6, 0]] }, { path: 'leg.0.rotation.x', keys: [[0, 0], [0.5, -1.0], [1.1, -1.0], [1.6, 0]] }, { path: 'leg.1.rotation.x', keys: [[0, 0], [0.5, -1.0], [1.1, -1.0], [1.6, 0]] }, { path: 'arm.0.rotation.x', keys: [[0, -0.2], [0.5, -0.9], [1.1, -0.9], [1.6, -0.2]] }, { path: 'arm.1.rotation.x', keys: [[0, -0.2], [0.5, -0.9], [1.1, -0.9], [1.6, -0.2]] }], events: [[1.1, 'lifted']] },
    spin: { duration: 2, loop: true, tracks: [{ path: 'rotation.y', keys: [[0, 0, 'linear'], [2, 6.2832, 'linear']] }] },
    bob: { duration: 1.5, loop: true, tracks: [{ path: 'position.y', keys: [[0, 0], [0.75, 0.25], [1.5, 0]] }] },
    swing: { duration: 2.4, loop: true, tracks: [{ path: 'rotation.z', keys: [[0, -0.35], [1.2, 0.35], [2.4, -0.35]] }] },
    blink: { duration: 0.8, loop: true, tracks: [{ path: 'visible', keys: [[0, 1, 'step'], [0.4, 0, 'step'], [0.8, 1, 'step']] }] }
  };
  Object.keys(BUILTIN_CLIPS).forEach(function (n) { CO.clip(n, BUILTIN_CLIPS[n]); });
