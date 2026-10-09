//@ Co Engine, part 40: settings, the save slot, load and save, the ledger
  // ── Settings (not part of the save: they belong to the machine) ───
  var SET_DEFAULTS = { sens: 1, invertY: false, quality: 'high', sound: true, vol: 0.8, fps: false, fov: 75, film: true, bob: true };
  function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(SET)); } catch (e) {} }
  function loadSettings() { try { var ss = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null'); if (ss) for (var sk in ss) if (sk in SET) SET[sk] = ss[sk]; } catch (e) {} return SET; }
  // ── The slot and the raw peek ─────────────────────────────────────
  // cfg.save is the save key prefix ('depotco'): the slot number lives at <prefix>-slot, the save at <prefix>-slot<n>, the
  // settings at <prefix>-settings unless cfg.settingsKey says otherwise. BOOT_SAVE is the raw save before anything is laid out,
  // so a game can size its world from it (a building stage) before it builds.
  function coSetupState(cfg) {
    var prefix = cfg.save || 'co-game';
    BOOT_SLOT = (function () { try { var q = /[?&]slot=(\d)/.exec(location.search); var sl = q ? +q[1] : +(localStorage.getItem(prefix + '-slot') || 1); return sl >= 1 && sl <= (cfg.slots || 3) ? sl : 1; } catch (e) { return 1; } })();
    var named = /[?&]save=([A-Za-z0-9_-]+)/.exec(location.search);   // ?save=<name>: a save of its own beside the slots, for development and for a reporter's file
    SAVE = named ? prefix + '-' + named[1] : prefix + '-slot' + BOOT_SLOT; SETTINGS_KEY = cfg.settingsKey || prefix + '-settings';
    BOOT_SAVE = (function () { try { var raw = localStorage.getItem(SAVE), s = raw ? JSON.parse(raw) : null; return s && typeof s === 'object' ? s : null; } catch (e) { return null; } })();
    SET = {}; for (var k in SET_DEFAULTS) SET[k] = SET_DEFAULTS[k]; if (cfg.settings) for (var k2 in cfg.settings) SET[k2] = cfg.settings[k2];
    loadSettings();
    CO.save = { prefix: prefix, key: SAVE, slot: BOOT_SLOT, named: named ? named[1] : null };
  }
  function setSlot(n) { try { localStorage.setItem(CO.save.prefix + '-slot', String(n)); } catch (e) {} }
  // ── Load and save ─────────────────────────────────────────────────
  // loadSave(fresh, migrate): S becomes the slot's save, with every top-level key the fresh state has and the save lacks filled in,
  // then the game's migrate(s, fresh, missing) run on it (missing[key] is true for each key that was filled in, so a migration can
  // tell an old save from a new field); or the fresh state when there is no save or it will not parse (the broken copy is kept
  // beside the slot). Returns true when a save was loaded.
  function loadSave(fresh, migrate) {
    var f = fresh(); S = f;
    try {
      var raw = localStorage.getItem(SAVE); if (!raw) return false;
      var s = JSON.parse(raw); if (!s || typeof s !== 'object') return false;
      var missing = {}; for (var k in f) if (!(k in s)) { s[k] = f[k]; missing[k] = true; }
      if (migrate) { var m = migrate(s, f, missing); if (m && typeof m === 'object') s = m; }
      S = s; return true;
    } catch (e) {
      try { if (typeof console !== 'undefined') console.error('co-engine: the save in ' + SAVE + ' could not be loaded', e); var brokenRaw = localStorage.getItem(SAVE); if (brokenRaw) localStorage.setItem(SAVE + '-broken', brokenRaw); } catch (e2) {}
      S = fresh(); return false;
    }
  }
  // save() writes the slot, or with cfg.saveDebounce (ms) schedules one write for a burst of calls; saveNow() writes at once (the unload)
  var saveT = 0, wiped = false, saveTimer = null;
  function writeSave() {
    if (wiped || !S) return;
    try { S.savedAt = now(); localStorage.setItem(SAVE, JSON.stringify(S)); saveT = now(); save.failed = false; }
    catch (e) { if (!save.failed) { save.failed = true; toast('The save could not be written: the browser refused the storage. Export it from the pause menu.', 'bad'); if (typeof console !== 'undefined') console.error('co-engine: save failed', e); } }   // said once, not at every autosave
  }
  function save() { var ms = CO.cfg && CO.cfg.saveDebounce; if (!ms) { writeSave(); return; } if (saveTimer) return; saveTimer = setTimeout(function () { saveTimer = null; writeSave(); }, ms); }
  function saveNow() { if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; } writeSave(); }
  function wipe() { wiped = true; try { localStorage.removeItem(SAVE); } catch (e) {} }
  function exportSave() { return JSON.stringify(S); }
  // ── The ledger ────────────────────────────────────────────────────
  function pay(n, why) { S.bank = (S.bank || 0) + n; if (S.stats) { if (n >= 0) S.stats.earned = (S.stats.earned || 0) + n; else S.stats.spent = (S.stats.spent || 0) + -n; } if (S.ledger) { S.ledger.unshift({ day: S.day, t: fmtTime(S.time || 0), n: n, why: why }); if (S.ledger.length > 80) S.ledger.pop(); } hudDirty = true; }
