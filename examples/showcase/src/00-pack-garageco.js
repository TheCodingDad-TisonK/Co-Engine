//@ Co Engine pack: Garage Co.. The lock-up's props: the tool wall, the workbench, the desk, the trolley jack, axle stands, the oil drum, the parts rack, the notice board, the compressor, a stool and a planter, sealed in a scope of their own. Generated from Garage Co.'s src/ by the Co Engine pack tools; regenerate rather than edit.
  // the pack waits for the engine: a game part ahead of CO.setup runs it on the beforeBuild hook, the editor runs it at once
  var garagecoPack = function (HOST_DEF) {
    // the game's own defProp calls land here first; each is registered below as a pack prop
    var P_DEFS = [], defProp = function (id, def) { P_DEFS.push({ id: id, def: def }); return def; };
    // Garage Co.'s carried code, in its part order
    // the state the props read: a sandboxed save of the game itself, never the host game
    var S = { day: 1, bank: 400, rep: 10, level: 1, xp: 0, doorOpen: false, job: null, done: [], stats: { earned: 0, spent: 0, jobs: 0, fixed: 0 } };
    /* 01-garage.js */
    var GAME = {}, G = { lamps: [], rollT: 0, nextCarAt: 0, customerNearDoor: false };
    /* 01-garage.js */
    var LOCKUP = { x: 5, z: 4, h: 3.6, doorW: 3.2, doorH: 3.0 };
    /* 01-garage.js */
    var BAY = { x: 5, z: 12 }, DESK = { x: -3.2, z: -2.6 }, DESK_STAND = { x: -3.2, z: -1.0 };
    /* 01-garage.js */
    var FAULTS = [
        { id: 'oil', symptom: 'The oil light has been on since Tuesday.', job: 'an oil and filter change', secs: 8, price: 60 },
        { id: 'brakes', symptom: 'It squeals every time I brake.', job: 'new front brake pads', secs: 10, price: 120 },
        { id: 'bulb', symptom: 'The left headlight is out.', job: 'a headlight bulb', secs: 4, price: 15 },
        { id: 'battery', symptom: 'It would not start this morning.', job: 'a new battery', secs: 6, price: 95 }
      ];
    /* 01-garage.js */
    function faultOf(car) { return FAULTS.filter(function (f) { return f.id === car.fault; })[0] || FAULTS[0]; }
    /* 01-garage.js */
    var CHROME_RED = std({ color: 0xc8342a, roughness: 0.45, metalness: 0.3 });
    /* 02-jobs.js */
    function customerGo(goal) { var c = G.customer; if (!c) return; c.goal = goal; c.walking = true; var to = goal === 'car' ? { x: G.car.x + 1.7, z: G.car.z } : DESK_STAND; c.rec.path = route({ x: c.rec.x, z: c.rec.z }, to); }
    /* 02-jobs.js */
    function takeJob() {
        var J = S.job; if (!J || J.state !== 'waiting') return false;
        J.state = 'taken'; var f = faultOf(J.car); sfx('ok'); toast('Job card: ' + f.job + ' for ' + money(J.price) + '. E at the car starts the work.', 'good'); logEvent('Took the job: ' + f.job + ' on ' + J.car.name + "'s " + J.car.make + '.', 'good');
        if (G.customer) say(G.customer.g, 'Great. I will wait here.'); screenDirtyAll(); hudDirty = true; return true;
      }
    /* 02-jobs.js */
    function takePayment() {
        var J = S.job; if (!J || J.state !== 'done') return false;
        var f = faultOf(J.car); pay(J.price, f.job + ' for ' + J.car.name); S.stats.jobs++; S.rep = Math.min(100, S.rep + 1);
        S.done.unshift({ day: S.day, t: fmtTime(S.time), name: J.car.name, make: J.car.make, job: f.job, price: J.price }); if (S.done.length > 30) S.done.pop();
        sfx('cash'); toast(J.car.name + ' paid ' + money(J.price) + '.', 'good'); logEvent(J.car.name + ' paid ' + money(J.price) + ' for ' + f.job + '.', 'good');
        J.state = 'paid'; if (G.customer) { say(G.customer.g, 'Lovely, thanks. See you next time.'); customerGo('car'); } else { J.state = 'leaving'; if (G.car) G.car.leg = 3; }
        addXp(15); screenDirtyAll(); hudDirty = true; return true;
      }
    /* 02-jobs.js */
    function xpFor(level) { return 40 + level * 20; }
    /* 02-jobs.js */
    function addXp(n) { S.xp += n; while (S.xp >= xpFor(S.level)) { S.xp -= xpFor(S.level); S.level++; sfx('levelup'); toast('Level ' + S.level + '.', 'rare'); logEvent('Level ' + S.level + '. Word is getting round.', 'good'); } hudDirty = true; }
    /* 02-jobs.js */
    function drawJobCard(c, sc) {
        scBg(c, sc.w, sc.h); scHead(c, sc.w, 'JOB CARD', 'Day ' + S.day);
        var J = S.job;
        if (!J) { scText(c, 16, 70, 'No car in. The next one is on its way.', '#a0acb8'); scText(c, 16, 100, S.stats.jobs + ' jobs done, ' + money(S.stats.earned) + ' taken.', '#a0acb8'); return; }
        var f = faultOf(J.car);
        scText(c, 16, 70, J.car.make + ' · ' + J.car.plate, '#eef1f5', 16); scText(c, 16, 92, J.car.name + ': ' + f.symptom, '#a0acb8', 13);
        scText(c, 16, 122, J.state === 'waiting' ? 'Customer coming to the desk' : J.state === 'taken' ? 'Job: ' + f.job : J.state === 'fixing' ? 'Working: ' + Math.round(J.progress * 100) + '%' : J.state === 'done' ? 'Fixed: take ' + money(J.price) + ' at the desk' : 'Paid. ' + J.car.name + ' is leaving.', J.state === 'done' ? '#5fd38d' : '#f5b53d', 15);
        scText(c, 16, 150, 'Price ' + money(J.price) + ' · about ' + f.secs + ' seconds of work', '#a0acb8', 13);
        if (J.state === 'waiting' && G.customer && !G.customer.walking) scButton(sc, 16, 180, 160, 40, 'Take the job', true, takeJob);
        if (J.state === 'done' && G.customer && !G.customer.walking) scButton(sc, 16, 180, 180, 40, 'Take the payment', true, takePayment);
      }
    /* 02-rollpanel.js */
    function rollDoorToggle() { S.doorOpen = !S.doorOpen; sfx(S.doorOpen ? 'unlock' : 'lock'); hudDirty = true; screenDirtyAll(); }
    /* 02-rollpanel.js */
    function jobLine() {
        var j = S.job; if (!j) return 'No job. The next car comes when it comes.';
        var who = j.car && j.car.model ? j.car.model : 'A car';
        return { coming: who + ' is on its way in.', waiting: who + ' waits at the desk: take the job.', taken: who + ' is in the bay: find the fault.', fixing: who + ': fixing it.', done: who + ' is fixed: the customer pays at the till.', paid: who + ' is paid up; it can leave.', leaving: who + ' is leaving.' }[j.state] || (who + ': ' + j.state);
      }
    // the definitions, each in a guard: one that cannot build here is left out rather than breaking the pack
    try {
      defProp('toolWall', { label: 'tool wall', cat: 'garage', wall: true, x: 1.5, z: -3.83, rot: 0, build: function (c) {
          c.box(2.4, 1.2, 0.04, MAT.wood, 0, 1.5, 0); for (var i = 0; i < 9; i++) { var x = -1.05 + i * 0.26; c.cyl(0.012, 0.3, MAT.steel, x, 1.75 - (i % 3) * 0.12, 0.05, 6); c.box(0.06, 0.05, 0.03, MAT.rubber, x, 1.62 - (i % 3) * 0.12, 0.05); }
          c.sign(['TOOLS', 'put it back where you found it'], 1.4, 0.3, 0, 2.3, 0.03, 0, { bg: '#1b232c' });
        } })
    } catch (e) { if (typeof console !== "undefined") console.warn("garageco pack: toolWall: " + e.message); }
    try {
      defProp('bench', { label: 'workbench', cat: 'garage', x: -3.6, z: 0.6, rot: 1, build: function (c) {
          c.box(2.2, 0.08, 0.8, MAT.wood, 0, 0.9, 0); c.box(2.1, 0.5, 0.7, MAT.steelDark, 0, 0.3, 0); [-0.95, 0.95].forEach(function (x) { c.box(0.08, 0.86, 0.7, MAT.steelDark, x, 0.43, 0); });
          c.box(0.5, 0.25, 0.3, MAT.red, -0.6, 1.07, -0.1); c.box(0.3, 0.1, 0.2, MAT.black, 0.5, 0.99, 0.1); c.solid(-1.1, 1.1, -0.4, 0.4, 0, 1.0);
          // the job card: a small screen on a stand at the bench's end, drawn from the state
          c.box(0.06, 0.5, 0.06, MAT.steelDark, 0.95, 1.2, -0.3);
          touchScreen({ w: 360, h: 240, pw: 0.6, ph: 0.4, x: 0.95, y: 1.6, z: -0.29, ry: 0, parent: c.group, title: 'Job card', draw: drawJobCard });
        } })
    } catch (e) { if (typeof console !== "undefined") console.warn("garageco pack: bench: " + e.message); }
    try {
      defProp('desk', { label: 'desk', cat: 'garage', x: DESK.x, z: DESK.z, rot: 0, build: function (c) {
          c.box(1.6, 0.06, 0.8, MAT.wood, 0, 0.78, 0); c.box(0.08, 0.75, 0.7, MAT.steelDark, -0.72, 0.38, 0); c.box(0.08, 0.75, 0.7, MAT.steelDark, 0.72, 0.38, 0); c.box(0.5, 0.6, 0.6, MAT.steelDark, 0.45, 0.3, 0);
          c.box(0.32, 0.02, 0.44, MAT.paper, -0.3, 0.82, 0.05); c.box(0.3, 0.2, 0.02, MAT.black, 0.35, 0.92, -0.25);
          c.hit(0.5, 0.2, 0.5, -0.3, 0.9, 0.05, { prompt: function () { return 'Read the clipboard: the jobs'; }, use: function () { openPanel('jobs'); } });
          c.solid(-0.8, 0.8, -0.4, 0.4, 0, 0.85);
        } })
    } catch (e) { if (typeof console !== "undefined") console.warn("garageco pack: desk: " + e.message); }
    try {
      defProp('jack', { label: 'trolley jack', cat: 'garage', x: 1.4, z: 1.2, rot: 0, build: function (c) {
          c.box(0.3, 0.12, 0.7, CHROME_RED, 0, 0.1, 0); c.cyl(0.06, 0.1, MAT.steel, 0, 0.21, -0.1, 12); var h = c.cyl(0.015, 1.0, MAT.steelDark, 0, 0.55, 0.55, 6); h.rotation.x = 0.9;
          [[0.13, -0.28], [-0.13, -0.28], [0.13, 0.3], [-0.13, 0.3]].forEach(function (p) { var w = c.cyl(0.05, 0.04, MAT.rubber, p[0], 0.05, p[1], 10); w.rotation.z = Math.PI / 2; });
          c.solid(-0.2, 0.2, -0.4, 0.6, 0, 0.4);
        } })
    } catch (e) { if (typeof console !== "undefined") console.warn("garageco pack: jack: " + e.message); }
    try {
      defProp('stands', { label: 'axle stands', cat: 'garage', x: 3.2, z: -2.8, rot: 0, build: function (c) {
          [-0.3, 0.3].forEach(function (x) { c.cyl(0.05, 0.45, MAT.steelDark, x, 0.45, 0, 8); c.box(0.36, 0.04, 0.36, MAT.steelDark, x, 0.02, 0); c.box(0.12, 0.05, 0.16, MAT.steelDark, x, 0.7, 0); });
          c.solid(-0.5, 0.5, -0.2, 0.2, 0, 0.75);
        } })
    } catch (e) { if (typeof console !== "undefined") console.warn("garageco pack: stands: " + e.message); }
    try {
      defProp('drum', { label: 'oil drum', cat: 'garage', x: 4.2, z: -0.5, rot: 0, build: function (c) { c.cyl(0.3, 0.9, MAT.blue, 0, 0.45, 0, 16); c.cyl(0.31, 0.03, MAT.steelDark, 0, 0.3, 0, 16); c.cyl(0.31, 0.03, MAT.steelDark, 0, 0.6, 0, 16); c.solid(-0.32, 0.32, -0.32, 0.32, 0, 0.9); } })
    } catch (e) { if (typeof console !== "undefined") console.warn("garageco pack: drum: " + e.message); }
    try {
      defProp('rack', { label: 'parts rack', cat: 'garage', x: 4.5, z: -2.2, rot: 3, build: function (c) {
          [-0.9, 0.9].forEach(function (x) { c.box(0.05, 2.0, 0.4, MAT.rack, x, 1.0, 0); }); [0.4, 1.0, 1.6].forEach(function (y) { c.box(1.85, 0.04, 0.4, MAT.steel, 0, y, 0); });
          c.box(0.3, 0.3, 0.3, MAT.wood, -0.5, 0.57, 0); c.box(0.4, 0.2, 0.25, MAT.black, 0.3, 1.12, 0); c.box(0.5, 0.15, 0.3, MAT.yellow, -0.4, 1.7, 0);
          c.solid(-0.95, 0.95, -0.22, 0.22, 0, 2.0);
        } })
    } catch (e) { if (typeof console !== "undefined") console.warn("garageco pack: rack: " + e.message); }
    try {
      defProp('noticeBoard', { label: 'notice board', cat: 'garage', wall: true, x: -4.83, z: -2.6, rot: 1, build: function (c) { c.box(1.2, 0.9, 0.04, MAT.wood, 0, 1.7, 0); c.plane(1.1, 0.8, MAT.cork, 0, 1.7, 0.025, 0, 0); c.sign(['OPEN 8 TO 6'], 0.5, 0.16, 0.2, 1.9, 0.03, 0, { bg: '#f3efe4', fg: '#1b232c' }); } })
    } catch (e) { if (typeof console !== "undefined") console.warn("garageco pack: noticeBoard: " + e.message); }
    try {
      defProp('xCompressor', { extra: true, label: 'compressor', cat: 'garage', price: 300, desc: 'A tank on wheels, a motor on top. Air for the tools.', build: function (c) { var t = c.cyl(0.25, 0.9, MAT.red, 0, 0.45, 0, 16); t.rotation.z = Math.PI / 2; c.box(0.3, 0.25, 0.3, MAT.black, 0, 0.75, 0); c.cyl(0.06, 0.04, MAT.rubber, -0.3, 0.1, 0.2, 10).rotation.z = Math.PI / 2; c.cyl(0.06, 0.04, MAT.rubber, 0.3, 0.1, 0.2, 10).rotation.z = Math.PI / 2; c.solid(-0.5, 0.5, -0.3, 0.3, 0, 0.9); } })
    } catch (e) { if (typeof console !== "undefined") console.warn("garageco pack: xCompressor: " + e.message); }
    try {
      defProp('xStool', { extra: true, label: 'stool', cat: 'garage', price: 25, desc: 'A mechanic sits down sometimes.', build: function (c) { c.cyl(0.18, 0.05, MAT.red, 0, 0.6, 0, 16); c.cyl(0.02, 0.58, MAT.chrome, 0, 0.3, 0, 8); c.cyl(0.2, 0.03, MAT.steelDark, 0, 0.02, 0, 16); c.solid(-0.2, 0.2, -0.2, 0.2, 0, 0.65); } })
    } catch (e) { if (typeof console !== "undefined") console.warn("garageco pack: xStool: " + e.message); }
    try {
      defProp('xPlanter', { extra: true, label: 'planter', cat: 'yard', yard: true, price: 40, desc: 'A tub of green by the door.', build: function (c) { c.box(0.6, 0.45, 0.6, MAT.grey, 0, 0.22, 0); c.sphere(0.3, std({ color: 0x4f7f3a, roughness: 1 }), 0, 0.65, 0); c.solid(-0.3, 0.3, -0.3, 0.3, 0, 0.9); } })
    } catch (e) { if (typeof console !== "undefined") console.warn("garageco pack: xPlanter: " + e.message); }
    // each definition as a pack prop: placeable in the editor, never sold, its uses saying what it is (the game logic stays behind)
    var SKIP = ["rollPanel"], seenBuild = new Map(), seenId = {};
    P_DEFS.forEach(function (e) {
      var d = e.def; if (!d || typeof d.build !== 'function' || SKIP.indexOf(e.id) >= 0 || seenBuild.has(d.build)) return; seenBuild.set(d.build, 1);
      var base = (/^x[A-Z]/.test(e.id) ? e.id.slice(1) : e.id).replace(/[^A-Za-z0-9]/g, ''), nid = "ga" + base.charAt(0).toUpperCase() + base.slice(1);
      if (seenId[nid] || PROPS[nid]) return; seenId[nid] = 1;
      var label = d.label || base, inert = { prompt: function () { return 'The ' + label; }, use: function () { toast('The ' + label + ' (from Garage Co.)', ''); } };
      HOST_DEF(nid, { extra: true, shop: false, label: label, cat: "garage co", ico: d.ico, wall: !!d.wall, noBlob: !!d.noBlob, desc: 'From Garage Co.: ' + label + '.', build: function (c, P, inst) {
        var h0 = c.hit; c.hit = function (w, h, dd, x, y, z) { return h0.call(c, w, h, dd, x, y, z, inert); };
        
        try { d.build(c, P, inst); if (d.after) d.after(c, P, inst); } finally { c.hit = h0; }
      } });
    });
    // the pack's own materials by name, for a prop read back as parts in the Model tab (Co Engine 0.8.0): a getter, so a cache filled later is seen
    CO.packMats = CO.packMats || {}; CO.packMats["garageco"] = function () { return { GAME: GAME, G: G, LOCKUP: LOCKUP, BAY: BAY, DESK: DESK, DESK_STAND: DESK_STAND, FAULTS: FAULTS, CHROME_RED: CHROME_RED, S: S }; };
  };
  if (CO.cfg && typeof scene !== 'undefined' && scene) garagecoPack(defProp); else hook('beforeBuild', function () { garagecoPack(defProp); });
